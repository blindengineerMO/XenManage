function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function nextDemoId(collection) {
  return collection.reduce((max, item) => Math.max(max, Number(item.id || 0)), 0) + 1;
}

let demoOpaqueCounter = 100;

function nextDemoOpaqueRef(prefix) {
  demoOpaqueCounter += 1;
  return `OpaqueRef:${prefix}-demo-${demoOpaqueCounter}`;
}

function registerDemoVifState(vifRef, {
  device = '0',
  MAC = '',
  currently_attached = true,
  MTU = 1500,
  locking_mode = 'network_default',
  qos_algorithm_type = '',
  qos_algorithm_params = {},
  qos_supported_algorithms = ['ratelimit'],
} = {}) {
  demoDb.vifStates[vifRef] = {
    currently_attached: Boolean(currently_attached),
    device: String(device || '0'),
    MAC: String(MAC || ''),
    MTU: Number(MTU || 1500),
    locking_mode: String(locking_mode || 'network_default'),
    qos_algorithm_type: String(qos_algorithm_type || ''),
    qos_algorithm_params: clone(qos_algorithm_params || {}),
    qos_supported_algorithms: Array.isArray(qos_supported_algorithms)
      ? qos_supported_algorithms.map((entry) => String(entry || '').trim()).filter(Boolean)
      : [],
  };
}

function unregisterDemoVifState(vifRef) {
  delete demoDb.vifStates[vifRef];
}

function buildDemoVifInventory() {
  return demoDb.vms.flatMap((vm) =>
    (Array.isArray(vm.VIFs) ? vm.VIFs : []).map((vifRef, index) => {
      const network = demoDb.networks.find((entry) => Array.isArray(entry.VIFs) && entry.VIFs.includes(vifRef)) || null;
      const state = demoDb.vifStates[vifRef] || {};
      return {
        ref: vifRef,
        uuid: `${String(vifRef).replace('OpaqueRef:', '')}-uuid`,
        VM: vm.ref,
        network: network?.ref || '',
        device: String(state.device || index),
        MAC: String(state.MAC || ''),
        MTU: Number(state.MTU || 1500),
        locking_mode: String(state.locking_mode || 'network_default'),
        qos_algorithm_type: String(state.qos_algorithm_type || ''),
        qos_algorithm_params: clone(state.qos_algorithm_params || {}),
        qos_supported_algorithms: Array.isArray(state.qos_supported_algorithms) ? [...state.qos_supported_algorithms] : [],
        currently_attached: Boolean(state.currently_attached),
        allowed_operations: Boolean(state.currently_attached) ? ['unplug', 'destroy'] : ['plug', 'destroy'],
      };
    })
  );
}

function getDemoTargetScope(targetKey = '') {
  const normalizedTargetKey = String(targetKey || '').trim() || 'demo-fabric';
  if (!normalizedTargetKey || normalizedTargetKey === 'demo-fabric') {
    return {
      targetKey: 'demo-fabric',
      pools: clone(demoDb.pools),
      hosts: clone(demoDb.hosts),
      srs: clone(demoDb.srs),
      networks: clone(demoDb.networks),
    };
  }

  if (normalizedTargetKey === 'demo-edge') {
    return {
      targetKey: normalizedTargetKey,
      pools: clone(demoDb.pools.filter((pool) => pool.ref === 'OpaqueRef:pool-demo-2')),
      hosts: clone(demoDb.hosts.filter((host) => host.pool === 'OpaqueRef:pool-demo-2')),
      srs: clone(demoDb.srs.filter((sr) => sr.ref === 'OpaqueRef:sr-demo-2')),
      networks: clone(demoDb.networks.filter((network) => network.ref === 'OpaqueRef:net-demo-2')),
    };
  }

  return getDemoTargetScope('demo-fabric');
}

function buildDemoVmInventory(targetKey = '') {
  const scope = getDemoTargetScope(targetKey);
  if (scope.targetKey === 'demo-fabric') {
    return clone(demoDb.vms);
  }

  const hostRefs = new Set(scope.hosts.map((host) => host.ref));
  return clone(demoDb.vms.filter((vm) =>
    vm.is_a_template
    || hostRefs.has(vm.resident_on)
    || hostRefs.has(vm.affinity)
  ));
}

function buildDemoConsoleLaunchUrl(vm = {}, consoleRecord = {}, targetKey = 'demo-fabric') {
  const host = encodeURIComponent(targetKey === 'demo-edge' ? 'demo-edge-gateway.lab.local' : 'demo-fabric-gateway.lab.local');
  const body = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>${vm.name_label || 'Console'}</title>
    <style>
      body { margin: 0; font-family: Arial, sans-serif; background: radial-gradient(circle at top, #15324d, #040b14 70%); color: #f5fbff; display: grid; place-items: center; min-height: 100vh; }
      .panel { width: min(760px, 92vw); background: rgba(6, 17, 30, 0.94); border: 1px solid rgba(111, 208, 255, 0.28); border-radius: 22px; padding: 28px; box-shadow: 0 26px 70px rgba(0,0,0,0.5); }
      h1 { margin: 0 0 8px; }
      p { color: #bfd8ea; line-height: 1.6; }
      .surface { margin-top: 18px; min-height: 380px; border-radius: 18px; background: linear-gradient(135deg, rgba(17, 38, 60, 0.9), rgba(5, 12, 22, 0.98)); border: 1px solid rgba(111, 208, 255, 0.16); display: grid; place-items: center; }
      .meta { font-family: "Courier New", monospace; font-size: 12px; color: #7ec2e8; margin-top: 16px; }
    </style>
  </head>
  <body>
    <div class="panel">
      <h1>${vm.name_label || 'Virtual Machine'} Console</h1>
      <p>This is the demo-mode console surface for ${vm.name_label || 'the selected workload'}. In a live Xen target, XenMange launches the session-authenticated console endpoint resolved from the XAPI console record.</p>
      <div class="surface">
        <div>
          <div style="font-size:54px;text-align:center;letter-spacing:6px">RFB</div>
          <div style="margin-top:10px;text-align:center;color:#9bc6de">${consoleRecord.protocol || 'rfb'} session prepared for ${vm.name_label || 'VM'}</div>
        </div>
      </div>
      <div class="meta">console=${consoleRecord.ref || '-'} · host=${decodeURIComponent(host)} · target=${targetKey}</div>
    </div>
  </body>
</html>`;

  return `data:text/html;charset=utf-8,${encodeURIComponent(body)}`;
}

function buildDemoVmConsoles(vm = {}, targetKey = 'demo-fabric') {
  return (Array.isArray(vm.consoles) ? vm.consoles : [])
    .map((consoleRef) => {
      const record = demoDb.consoles.find((entry) => entry.ref === consoleRef && entry.VM === vm.ref);
      if (!record) return null;
      return {
        ...clone(record),
        launchUrl: buildDemoConsoleLaunchUrl(vm, record, targetKey),
      };
    })
    .filter(Boolean);
}

function buildDemoVmCompatibility(vm = {}, targetKey = 'demo-fabric') {
  const scope = getDemoTargetScope(targetKey);
  const hostRecords = Array.isArray(scope.hosts) ? scope.hosts : [];
  const currentHostRef = String(vm.resident_on || vm.affinity || '').trim();
  const currentHost = hostRecords.find((host) => host.ref === currentHostRef) || null;
  const currentCpuModel = String(currentHost?.cpu_info?.modelname || '').trim().toLowerCase();
  const vmPlatformVersion = Number(vm.hardware_platform_version || 0) || 0;
  const lastBootCpuFlags = vm.last_boot_CPU_flags || {};

  const hosts = hostRecords.map((host) => {
    const sameCpuFamily = currentCpuModel
      ? String(host?.cpu_info?.modelname || '').trim().toLowerCase() === currentCpuModel
      : true;
    const compatible = Boolean(host.enabled) && !host.maintenance_mode && sameCpuFamily;
    let compatibilityError = '';
    if (!host.enabled) compatibilityError = 'HOST_DISABLED';
    else if (host.maintenance_mode) compatibilityError = 'HOST_IN_MAINTENANCE';
    else if (!sameCpuFamily) compatibilityError = 'CPU_FAMILY_MISMATCH';

    return {
      ref: host.ref,
      uuid: host.uuid || '',
      name_label: host.name_label || host.hostname || host.ref,
      address: host.address || '',
      enabled: Boolean(host.enabled),
      maintenance_mode: Boolean(host.maintenance_mode),
      pool: host.pool || '',
      currentResident: host.ref === currentHostRef,
      possiblePlacement: compatible || host.ref === currentHostRef,
      compatible: compatible || host.ref === currentHostRef,
      readiness: compatible || host.ref === currentHostRef ? 'compatible' : (host.maintenance_mode ? 'maintenance' : 'incompatible'),
      compatibilityError,
      sameCpuFamily,
      cpuModel: String(host?.cpu_info?.modelname || '').trim(),
      cpuCount: Number(host?.cpu_info?.cpu_count || 0) || 0,
      socketCount: Number(host?.cpu_info?.socket_count || 0) || 0,
    };
  });

  return {
    ref: vm.ref || '',
    uuid: vm.uuid || '',
    name_label: vm.name_label || vm.ref || 'Virtual machine',
    power_state: vm.power_state || '',
    resident_on: vm.resident_on || '',
    affinity: vm.affinity || '',
    hardwarePlatformVersion: vmPlatformVersion,
    lastBootCpuFlags: clone(lastBootCpuFlags),
    possibleHostRefs: hosts.filter((host) => host.possiblePlacement).map((host) => host.ref),
    hosts,
    maskingApiAvailable: false,
  };
}

function buildDemoVmPlacementRecommendations(vm = {}, targetKey = 'demo-fabric') {
  const WEIGHTS = { memory: 0.4, cpu: 0.3, network: 0.15, storage: 0.15 };
  const clampPercent = (value) => Math.max(0, Math.min(100, value));

  const compatibility = buildDemoVmCompatibility(vm, targetKey);
  const baseline = buildDemoCapacityBaseline();
  const hostMetricsMap = new Map((baseline.hosts || []).map((entry) => [entry.entityRef, entry]));

  const allVdis = Object.values(demoDb.vdis).flat();
  const vmSrRefs = [...new Set(
    demoDb.vbds
      .filter((vbd) => vbd.VM === vm.ref && vbd.type === 'Disk')
      .map((vbd) => allVdis.find((vdi) => vdi.ref === vbd.VDI)?.SR)
      .filter(Boolean)
  )];

  const srByRef = new Map(demoDb.srs.map((sr) => [sr.ref, sr]));
  const hostSrMap = new Map();
  demoDb.pbds.forEach((pbd) => {
    if (!pbd.currently_attached) return;
    if (!hostSrMap.has(pbd.host)) hostSrMap.set(pbd.host, new Set());
    hostSrMap.get(pbd.host).add(pbd.SR);
  });

  const vmMemoryBytes = Number(vm.memory_dynamic_max || vm.memory_static_max || 0);
  const candidateHosts = compatibility.hosts.filter((host) =>
    host.compatible && host.enabled && !host.maintenance_mode && !host.currentResident
  );

  const recommendations = candidateHosts.map((host) => {
    const metrics = hostMetricsMap.get(host.ref) || {};
    const memoryTotal = Number(metrics.memory_total_bytes || 0);
    const memoryFree = Number(metrics.memory_free_bytes || 0);
    let memoryScore = 0;
    let fits = false;
    let memoryDetail = 'No memory telemetry available for this host yet.';
    if (memoryTotal) {
      const projectedFree = memoryFree - vmMemoryBytes;
      fits = projectedFree >= 0;
      const projectedUsagePercent = clampPercent(((memoryTotal - projectedFree) / memoryTotal) * 100);
      memoryScore = fits ? clampPercent(100 - projectedUsagePercent) : 0;
      memoryDetail = fits
        ? `Projected memory usage after placement: ${Math.round(projectedUsagePercent)}%.`
        : `Not enough free memory (${Math.round(memoryFree / (1024 ** 3))} GiB free, ${Math.round(vmMemoryBytes / (1024 ** 3))} GiB required).`;
    }

    const cpuUsagePercent = metrics.cpu_usage_percent;
    const cpuScore = cpuUsagePercent === undefined ? 50 : clampPercent(100 - Number(cpuUsagePercent));
    const cpuDetail = cpuUsagePercent === undefined
      ? 'No recent CPU utilization sample; assumed neutral.'
      : `Current host CPU utilization: ${Math.round(Number(cpuUsagePercent))}%.`;

    const totalKibPerSec = Number(metrics.network_rx_kib_per_s || 0) + Number(metrics.network_tx_kib_per_s || 0);
    const networkScore = clampPercent(100 - (totalKibPerSec / (1024 * 1024)) * 100);
    const networkDetail = `Combined host network throughput: ${Math.round(totalKibPerSec)} KiB/s.`;

    let storageScore = 100;
    let storageDetail = 'This workload has no attached disks to relocate.';
    if (vmSrRefs.length) {
      const attachedSrs = hostSrMap.get(host.ref) || new Set();
      const localCount = vmSrRefs.filter((srRef) => attachedSrs.has(srRef)).length;
      if (localCount === vmSrRefs.length) {
        storageScore = 100;
        storageDetail = 'All attached storage is already reachable from this host.';
      } else {
        const sharedCount = vmSrRefs.filter((srRef) => srByRef.get(srRef)?.shared).length;
        if (sharedCount === vmSrRefs.length) {
          storageScore = 90;
          storageDetail = 'All attached storage is on shared repositories reachable pool-wide.';
        } else {
          const missing = vmSrRefs.length - localCount;
          storageScore = clampPercent(100 - (missing / vmSrRefs.length) * 100);
          storageDetail = `${missing} of ${vmSrRefs.length} attached disk(s) are on storage not reachable from this host.`;
        }
      }
    }

    const score = fits ? Math.round(
      (memoryScore * WEIGHTS.memory) + (cpuScore * WEIGHTS.cpu) + (networkScore * WEIGHTS.network) + (storageScore * WEIGHTS.storage)
    ) : 0;

    return {
      hostRef: host.ref,
      name_label: host.name_label,
      readiness: host.readiness,
      eligible: fits,
      score,
      factors: [
        { key: 'memory', label: 'Memory Headroom', score: Math.round(memoryScore), detail: memoryDetail },
        { key: 'cpu', label: 'CPU Headroom', score: Math.round(cpuScore), detail: cpuDetail },
        { key: 'network', label: 'Network Capacity', score: Math.round(networkScore), detail: networkDetail },
        { key: 'storage', label: 'Storage Locality', score: Math.round(storageScore), detail: storageDetail },
      ],
    };
  });

  recommendations.sort((left, right) => right.score - left.score);

  return {
    vmRef: vm.ref || '',
    evaluatedHostCount: candidateHosts.length,
    weights: WEIGHTS,
    recommendations: recommendations.slice(0, 5),
    excludedHostCount: compatibility.hosts.length - candidateHosts.length,
    notes: 'Scoring currently covers memory headroom, CPU utilization, network throughput, and storage locality. Disk/storage latency, NUMA topology, GPU-aware placement, VM-to-VM anti-affinity, licensing zone, and administrative placement policy are not modeled yet.',
  };
}
