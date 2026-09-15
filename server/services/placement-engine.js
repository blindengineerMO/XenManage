// Host placement recommendations for a VM on one xen target. Scores candidates
// from metrics-history capacity baseline: memory (hard fit), CPU, network, and
// SR locality. Consumed by routes/vms.js. A host that cannot fit the VM's
// dynamic/static max memory is ineligible (score 0) regardless of other factors.
// Weights are WEIGHTS at top of file. Disk latency, NUMA, GPU, anti-affinity,
// and admin policy are not modeled — see the notes string on getRecommendations.
const metricsHistoryService = require('./metrics-history');

const WEIGHTS = { memory: 0.4, cpu: 0.3, network: 0.15, storage: 0.15 };
const NETWORK_REFERENCE_CEILING_KIB_PER_SEC = 1024 * 1024; // generous 10GbE-class combined rx+tx ceiling

function toNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function clampPercent(value) {
  return Math.max(0, Math.min(100, value));
}

async function resolveVmMemoryRequirementBytes(xenApi, vmRef) {
  const vmRecord = await xenApi.getRecord('VM', vmRef);
  return toNumber(vmRecord.memory_dynamic_max) || toNumber(vmRecord.memory_static_max) || 0;
}

async function resolveVmSrRefs(xenApi, vmRef) {
  const [vbdsResult, vdisResult] = await Promise.all([
    xenApi.getVBDs(),
    xenApi.getClassRecords('VDI'),
  ]);
  const vbdRecords = Object.values(vbdsResult.records || {});
  const vdiRecords = vdisResult.records || {};
  const srRefs = new Set();
  for (const vbd of vbdRecords) {
    if (vbd.VM !== vmRef || vbd.type !== 'Disk') continue;
    const vdi = vdiRecords[vbd.VDI];
    if (vdi?.SR) srRefs.add(vdi.SR);
  }
  return [...srRefs];
}

async function resolveHostSrLocality(xenApi, hostRefs) {
  const [pbdsResult, srsResult] = await Promise.all([
    xenApi.getPBDs(),
    xenApi.getSRs(),
  ]);
  const pbdRecords = Object.values(pbdsResult.records || {});
  const srRecords = srsResult.records || {};
  const hostSrMap = new Map(hostRefs.map((ref) => [ref, new Set()]));
  for (const pbd of pbdRecords) {
    if (!hostSrMap.has(pbd.host) || !pbd.currently_attached) continue;
    hostSrMap.get(pbd.host).add(pbd.SR);
  }
  return { hostSrMap, srRecords };
}

function resolveHostMetricsMap(targetKey) {
  const baseline = metricsHistoryService.listCapacityBaseline(targetKey);
  return new Map((baseline.hosts || []).map((entry) => [entry.entityRef, entry]));
}

function scoreMemory(hostMetrics, vmMemoryBytes) {
  const memoryTotal = toNumber(hostMetrics?.memory_total_bytes);
  const memoryFree = toNumber(hostMetrics?.memory_free_bytes);
  if (!memoryTotal) {
    return { score: 0, fits: false, detail: 'No memory telemetry available for this host yet.' };
  }
  const projectedFree = memoryFree - vmMemoryBytes;
  const fits = projectedFree >= 0;
  const projectedUsagePercent = clampPercent(((memoryTotal - projectedFree) / memoryTotal) * 100);
  return {
    score: fits ? clampPercent(100 - projectedUsagePercent) : 0,
    fits,
    detail: fits
      ? `Projected memory usage after placement: ${Math.round(projectedUsagePercent)}%.`
      : `Not enough free memory (${Math.round(memoryFree / (1024 ** 3))} GiB free, ${Math.round(vmMemoryBytes / (1024 ** 3))} GiB required).`,
  };
}

function scoreCpu(hostMetrics) {
  const cpuUsagePercent = hostMetrics?.cpu_usage_percent;
  if (cpuUsagePercent === undefined || cpuUsagePercent === null) {
    return { score: 50, detail: 'No recent CPU utilization sample; assumed neutral.' };
  }
  return {
    score: clampPercent(100 - toNumber(cpuUsagePercent)),
    detail: `Current host CPU utilization: ${Math.round(toNumber(cpuUsagePercent))}%.`,
  };
}

function scoreNetwork(hostMetrics) {
  const rx = toNumber(hostMetrics?.network_rx_kib_per_s);
  const tx = toNumber(hostMetrics?.network_tx_kib_per_s);
  const totalKibPerSec = rx + tx;
  return {
    score: clampPercent(100 - (totalKibPerSec / NETWORK_REFERENCE_CEILING_KIB_PER_SEC) * 100),
    detail: `Combined host network throughput: ${Math.round(totalKibPerSec)} KiB/s.`,
  };
}

function scoreStorage(hostRef, vmSrRefs, hostSrMap, srRecords) {
  if (!vmSrRefs.length) {
    return { score: 100, detail: 'This workload has no attached disks to relocate.' };
  }
  const attachedSrs = hostSrMap.get(hostRef) || new Set();
  const localCount = vmSrRefs.filter((srRef) => attachedSrs.has(srRef)).length;
  if (localCount === vmSrRefs.length) {
    return { score: 100, detail: 'All attached storage is already reachable from this host.' };
  }
  const sharedCount = vmSrRefs.filter((srRef) => srRecords[srRef]?.shared).length;
  if (sharedCount === vmSrRefs.length) {
    return { score: 90, detail: 'All attached storage is on shared repositories reachable pool-wide.' };
  }
  const missing = vmSrRefs.length - localCount;
  return {
    score: clampPercent(100 - (missing / vmSrRefs.length) * 100),
    detail: `${missing} of ${vmSrRefs.length} attached disk(s) are on storage not reachable from this host.`,
  };
}

/**
 * Rank compatible, enabled, non-resident hosts for vmRef. targetKey selects the
 * metrics-history baseline. Returns { recommendations: [{ hostRef, eligible, score, factors }] }.
 */
async function getRecommendations(xenApi, vmRef, { targetKey = '', limit = 5 } = {}) {
  const [compatibility, vmMemoryBytes, vmSrRefs] = await Promise.all([
    xenApi.getVMCompatibility(vmRef),
    resolveVmMemoryRequirementBytes(xenApi, vmRef),
    resolveVmSrRefs(xenApi, vmRef),
  ]);

  const candidateHosts = (compatibility.hosts || []).filter((host) =>
    host.compatible && host.enabled && !host.maintenance_mode && !host.currentResident
  );
  const hostRefs = candidateHosts.map((host) => host.ref);

  const [{ hostSrMap, srRecords }] = await Promise.all([
    resolveHostSrLocality(xenApi, hostRefs),
  ]);
  const hostMetricsMap = resolveHostMetricsMap(targetKey);

  const recommendations = candidateHosts.map((host) => {
    const hostMetrics = hostMetricsMap.get(host.ref);
    const memory = scoreMemory(hostMetrics, vmMemoryBytes);
    const cpu = scoreCpu(hostMetrics);
    const network = scoreNetwork(hostMetrics);
    const storage = scoreStorage(host.ref, vmSrRefs, hostSrMap, srRecords);

    const eligible = memory.fits;
    const score = eligible
      ? Math.round(
        memory.score * WEIGHTS.memory
        + cpu.score * WEIGHTS.cpu
        + network.score * WEIGHTS.network
        + storage.score * WEIGHTS.storage
      )
      : 0;

    return {
      hostRef: host.ref,
      name_label: host.name_label,
      readiness: host.readiness,
      eligible,
      score,
      factors: [
        { key: 'memory', label: 'Memory Headroom', score: Math.round(memory.score), detail: memory.detail },
        { key: 'cpu', label: 'CPU Headroom', score: Math.round(cpu.score), detail: cpu.detail },
        { key: 'network', label: 'Network Capacity', score: Math.round(network.score), detail: network.detail },
        { key: 'storage', label: 'Storage Locality', score: Math.round(storage.score), detail: storage.detail },
      ],
    };
  });

  recommendations.sort((left, right) => right.score - left.score);

  return {
    vmRef,
    evaluatedHostCount: candidateHosts.length,
    weights: WEIGHTS,
    recommendations: recommendations.slice(0, limit),
    excludedHostCount: (compatibility.hosts || []).length - candidateHosts.length,
    notes: 'Scoring currently covers memory headroom, CPU utilization, network throughput, and storage locality. Disk/storage latency, NUMA topology, GPU-aware placement, VM-to-VM anti-affinity, licensing zone, and administrative placement policy are not modeled yet.',
  };
}

module.exports = { getRecommendations };
