const DEMO_RANGE_TO_MS = {
  '1h': 60 * 60 * 1000,
  '6h': 6 * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
};

const DEMO_RANGE_POINTS = {
  '1h': 6,
  '6h': 8,
  '24h': 12,
  '7d': 10,
  '30d': 12,
};

function normalizeDemoMetricRange(range = '24h') {
  return DEMO_RANGE_TO_MS[range] ? range : '24h';
}

function demoMetricPercent(numerator, denominator) {
  const top = Number(numerator || 0);
  const bottom = Number(denominator || 0);
  if (!bottom) return 0;
  return Math.max(0, Math.min(100, (top / bottom) * 100));
}

function metricSeed(value = '') {
  return String(value || '')
    .split('')
    .reduce((sum, character, index) => sum + (character.charCodeAt(0) * (index + 1)), 0);
}

function buildDemoTrendPoints(range, latestValue, options = {}) {
  const normalizedRange = normalizeDemoMetricRange(range);
  const pointCount = DEMO_RANGE_POINTS[normalizedRange] || 8;
  const totalMs = DEMO_RANGE_TO_MS[normalizedRange];
  const stepMs = Math.round(totalMs / Math.max(1, pointCount - 1));
  const now = Date.now();
  const amplitude = Number(options.amplitude ?? Math.max(1, Number(latestValue || 0) * 0.08));
  const floor = Number(options.floor ?? 0);
  const ceiling = Number(options.ceiling ?? Number.MAX_SAFE_INTEGER);
  const seed = metricSeed(options.seed || latestValue);

  return Array.from({ length: pointCount }, (_, index) => {
    const wave = Math.sin((index + 1) * 0.85 + seed / 25) * amplitude;
    const drift = (index - (pointCount / 2)) * (amplitude / Math.max(pointCount, 1)) * 0.18;
    const value = Math.max(floor, Math.min(ceiling, Number(latestValue || 0) + wave + drift));

    return {
      ts: now - ((pointCount - index - 1) * stepMs),
      value: Math.round(value * 100) / 100,
    };
  });
}

function buildDemoClusterMetrics(range = '24h') {
  const normalizedRange = normalizeDemoMetricRange(range);
  const totalMemory = demoDb.hosts.reduce((sum, host) => sum + Number(demoDb.hostMetrics[host.ref]?.memory_total || 0), 0);
  const freeMemory = demoDb.hosts.reduce((sum, host) => sum + Number(demoDb.hostMetrics[host.ref]?.memory_free || 0), 0);
  const usedMemory = Math.max(0, totalMemory - freeMemory);
  const averageCpu = demoDb.hosts.reduce((sum, host) => sum + demoHostCpuUsage(host.ref), 0) / Math.max(1, demoDb.hosts.length);
  const hostNetworkRx = demoDb.hosts.reduce((sum, host) => sum + demoHostNetworkRx(host.ref), 0);
  const hostNetworkTx = demoDb.hosts.reduce((sum, host) => sum + demoHostNetworkTx(host.ref), 0);
  const totalStorage = demoDb.srs.reduce((sum, sr) => sum + Number(sr.physical_size || 0), 0);
  const usedStorage = demoDb.srs.reduce((sum, sr) => sum + Number(sr.virtual_allocation || 0), 0);
  const vmMemory = demoDb.vms
    .filter((vm) => !vm.is_a_template)
    .reduce((sum, vm) => sum + Number(vm.memory_static_max || 0), 0);
  const activeVms = demoDb.vms.filter((vm) => !vm.is_a_template);
  const vmNetworkRx = activeVms.reduce((sum, vm) => sum + demoVmNetworkRx(vm), 0);
  const vmNetworkTx = activeVms.reduce((sum, vm) => sum + demoVmNetworkTx(vm), 0);
  const vmDiskRead = activeVms.reduce((sum, vm) => sum + demoVmDiskRead(vm), 0);
  const vmDiskWrite = activeVms.reduce((sum, vm) => sum + demoVmDiskWrite(vm), 0);

  return {
    range: normalizedRange,
    generatedAt: new Date().toISOString(),
    metrics: [
      {
        metricName: 'cluster_memory_used_percent',
        points: buildDemoTrendPoints(normalizedRange, demoMetricPercent(usedMemory, totalMemory), {
          amplitude: 6,
          floor: 20,
          ceiling: 98,
          seed: 'cluster-memory',
        }),
      },
      {
        metricName: 'cluster_storage_utilization_percent',
        points: buildDemoTrendPoints(normalizedRange, demoMetricPercent(usedStorage, totalStorage), {
          amplitude: 4,
          floor: 15,
          ceiling: 98,
          seed: 'cluster-storage',
        }),
      },
      {
        metricName: 'cluster_cpu_usage_percent',
        points: buildDemoTrendPoints(normalizedRange, averageCpu, {
          amplitude: 7,
          floor: 8,
          ceiling: 96,
          seed: 'cluster-cpu',
        }),
      },
      {
        metricName: 'cluster_vm_memory_actual_bytes',
        points: buildDemoTrendPoints(normalizedRange, vmMemory * 0.82, {
          amplitude: vmMemory * 0.06,
          floor: 0,
          seed: 'cluster-vm-memory',
        }),
      },
      {
        metricName: 'cluster_host_network_rx_kib_per_s',
        points: buildDemoTrendPoints(normalizedRange, hostNetworkRx, {
          amplitude: Math.max(16, hostNetworkRx * 0.15),
          floor: 0,
          seed: 'cluster-host-network-rx',
        }),
      },
      {
        metricName: 'cluster_host_network_tx_kib_per_s',
        points: buildDemoTrendPoints(normalizedRange, hostNetworkTx, {
          amplitude: Math.max(14, hostNetworkTx * 0.13),
          floor: 0,
          seed: 'cluster-host-network-tx',
        }),
      },
      {
        metricName: 'cluster_vm_network_rx_kib_per_s',
        points: buildDemoTrendPoints(normalizedRange, vmNetworkRx, {
          amplitude: Math.max(18, vmNetworkRx * 0.18),
          floor: 0,
          seed: 'cluster-vm-network-rx',
        }),
      },
      {
        metricName: 'cluster_vm_network_tx_kib_per_s',
        points: buildDemoTrendPoints(normalizedRange, vmNetworkTx, {
          amplitude: Math.max(16, vmNetworkTx * 0.16),
          floor: 0,
          seed: 'cluster-vm-network-tx',
        }),
      },
      {
        metricName: 'cluster_vm_disk_read_kib_per_s',
        points: buildDemoTrendPoints(normalizedRange, vmDiskRead, {
          amplitude: Math.max(16, vmDiskRead * 0.15),
          floor: 0,
          seed: 'cluster-vm-disk-read',
        }),
      },
      {
        metricName: 'cluster_vm_disk_write_kib_per_s',
        points: buildDemoTrendPoints(normalizedRange, vmDiskWrite, {
          amplitude: Math.max(12, vmDiskWrite * 0.14),
          floor: 0,
          seed: 'cluster-vm-disk-write',
        }),
      },
    ],
  };
}

function demoHostCpuUsage(ref) {
  const metrics = demoDb.hostMetrics[ref] || { memory_total: 0, memory_free: 0 };
  const total = Number(metrics.memory_total || 0);
  const free = Number(metrics.memory_free || 0);
  const used = Math.max(0, total - free);
  const pressure = demoMetricPercent(used, total);
  const offset = (metricSeed(`${ref}-cpu`) % 12) - 6;
  return Math.max(5, Math.min(95, pressure * 0.78 + 12 + offset));
}

function demoHostNetworkRx(ref) {
  const pressure = demoHostCpuUsage(ref);
  const offset = metricSeed(`${ref}-network-rx`) % 220;
  return Math.max(24, Math.round((pressure * 5.8) + 80 + offset));
}

function demoHostNetworkTx(ref) {
  const rx = demoHostNetworkRx(ref);
  const offset = metricSeed(`${ref}-network-tx`) % 140;
  return Math.max(18, Math.round((rx * 0.76) + offset));
}

function demoVmNetworkRx(vm = {}) {
  const configuredVcpus = Number(vm.VCPUs_at_startup || vm.VCPUs_max || 0);
  const base = vm.power_state === 'Running' ? 140 : vm.power_state === 'Suspended' ? 36 : 18;
  return Math.max(8, Math.round(base + (configuredVcpus * 32) + (metricSeed(`${vm.ref}-vm-rx`) % 90)));
}

function demoVmNetworkTx(vm = {}) {
  const rx = demoVmNetworkRx(vm);
  return Math.max(6, Math.round((rx * 0.68) + (metricSeed(`${vm.ref}-vm-tx`) % 60)));
}

function demoVmDiskRead(vm = {}) {
  const configuredGiB = Number(vm.memory_static_max || vm.memory_dynamic_max || 0) / (1024 ** 3);
  const base = vm.power_state === 'Running' ? 48 : vm.power_state === 'Suspended' ? 16 : 8;
  return Math.max(4, Math.round(base + (configuredGiB * 3.5) + (metricSeed(`${vm.ref}-disk-read`) % 70)));
}

function demoVmDiskWrite(vm = {}) {
  const read = demoVmDiskRead(vm);
  return Math.max(4, Math.round((read * 0.62) + (metricSeed(`${vm.ref}-disk-write`) % 44)));
}

function buildDemoHostMetricHistory(ref, range = '24h') {
  const normalizedRange = normalizeDemoMetricRange(range);
  const metrics = demoDb.hostMetrics[ref] || { memory_total: 0, memory_free: 0 };
  const total = Number(metrics.memory_total || 0);
  const free = Number(metrics.memory_free || 0);
  const used = Math.max(0, total - free);
  const cpuUsage = demoHostCpuUsage(ref);
  const networkRx = demoHostNetworkRx(ref);
  const networkTx = demoHostNetworkTx(ref);

  return {
    entityType: 'host',
    entityRef: ref,
    range: normalizedRange,
    generatedAt: new Date().toISOString(),
    metrics: [
      { metricName: 'memory_total_bytes', points: buildDemoTrendPoints(normalizedRange, total, { amplitude: 0, floor: 0, seed: `${ref}-total` }) },
      { metricName: 'memory_free_bytes', points: buildDemoTrendPoints(normalizedRange, free, { amplitude: Math.max(1, total * 0.05), floor: 0, ceiling: total, seed: `${ref}-free` }) },
      { metricName: 'memory_used_bytes', points: buildDemoTrendPoints(normalizedRange, used, { amplitude: Math.max(1, total * 0.04), floor: 0, ceiling: total, seed: `${ref}-used` }) },
      { metricName: 'memory_used_percent', points: buildDemoTrendPoints(normalizedRange, demoMetricPercent(used, total), { amplitude: 6, floor: 0, ceiling: 100, seed: `${ref}-used-percent` }) },
      { metricName: 'cpu_usage_percent', points: buildDemoTrendPoints(normalizedRange, cpuUsage, { amplitude: 7, floor: 0, ceiling: 100, seed: `${ref}-cpu` }) },
      { metricName: 'network_rx_kib_per_s', points: buildDemoTrendPoints(normalizedRange, networkRx, { amplitude: Math.max(8, networkRx * 0.18), floor: 0, seed: `${ref}-network-rx` }) },
      { metricName: 'network_tx_kib_per_s', points: buildDemoTrendPoints(normalizedRange, networkTx, { amplitude: Math.max(6, networkTx * 0.16), floor: 0, seed: `${ref}-network-tx` }) },
    ],
  };
}

function buildDemoVmMetricHistory(ref, range = '24h') {
  const normalizedRange = normalizeDemoMetricRange(range);
  const vm = demoDb.vms.find((entry) => entry.ref === ref) || {};
  const configured = Number(vm.memory_static_max || vm.memory_dynamic_max || 0);
  const actual = vm.power_state === 'Halted' ? configured * 0.08 : vm.power_state === 'Suspended' ? configured * 0.24 : configured * 0.78;
  const cpuUsage = Math.max(8, Math.min(94, (Number(vm.VCPUs_at_startup || 0) * 9) + (vm.power_state === 'Running' ? 18 : 6)));
  const networkRx = demoVmNetworkRx(vm);
  const networkTx = demoVmNetworkTx(vm);
  const diskRead = demoVmDiskRead(vm);
  const diskWrite = demoVmDiskWrite(vm);

  return {
    entityType: 'vm',
    entityRef: ref,
    range: normalizedRange,
    generatedAt: new Date().toISOString(),
    metrics: [
      { metricName: 'memory_actual_bytes', points: buildDemoTrendPoints(normalizedRange, actual, { amplitude: Math.max(1, configured * 0.09), floor: 0, ceiling: configured, seed: `${ref}-actual` }) },
      { metricName: 'memory_static_max_bytes', points: buildDemoTrendPoints(normalizedRange, configured, { amplitude: 0, floor: 0, seed: `${ref}-static` }) },
      { metricName: 'memory_usage_percent', points: buildDemoTrendPoints(normalizedRange, demoMetricPercent(actual, configured), { amplitude: 8, floor: 0, ceiling: 100, seed: `${ref}-usage` }) },
      { metricName: 'cpu_usage_percent', points: buildDemoTrendPoints(normalizedRange, cpuUsage, { amplitude: 9, floor: 0, ceiling: 100, seed: `${ref}-cpu` }) },
      { metricName: 'vcpu_count', points: buildDemoTrendPoints(normalizedRange, Number(vm.VCPUs_at_startup || 0), { amplitude: 0, floor: 0, seed: `${ref}-vcpu` }) },
      { metricName: 'network_rx_kib_per_s', points: buildDemoTrendPoints(normalizedRange, networkRx, { amplitude: Math.max(10, networkRx * 0.2), floor: 0, seed: `${ref}-network-rx` }) },
      { metricName: 'network_tx_kib_per_s', points: buildDemoTrendPoints(normalizedRange, networkTx, { amplitude: Math.max(8, networkTx * 0.18), floor: 0, seed: `${ref}-network-tx` }) },
      { metricName: 'disk_read_kib_per_s', points: buildDemoTrendPoints(normalizedRange, diskRead, { amplitude: Math.max(8, diskRead * 0.16), floor: 0, seed: `${ref}-disk-read` }) },
      { metricName: 'disk_write_kib_per_s', points: buildDemoTrendPoints(normalizedRange, diskWrite, { amplitude: Math.max(6, diskWrite * 0.14), floor: 0, seed: `${ref}-disk-write` }) },
    ],
  };
}

function buildDemoStorageMetricHistory(ref, range = '24h') {
  const normalizedRange = normalizeDemoMetricRange(range);
  const sr = demoDb.srs.find((entry) => entry.ref === ref) || {};
  const allocation = Number(sr.virtual_allocation || 0);
  const physical = Number(sr.physical_size || 0);

  return {
    entityType: 'sr',
    entityRef: ref,
    range: normalizedRange,
    generatedAt: new Date().toISOString(),
    metrics: [
      { metricName: 'allocation_bytes', points: buildDemoTrendPoints(normalizedRange, allocation, { amplitude: Math.max(1, physical * 0.03), floor: 0, ceiling: physical, seed: `${ref}-allocation` }) },
      { metricName: 'physical_bytes', points: buildDemoTrendPoints(normalizedRange, physical, { amplitude: 0, floor: 0, seed: `${ref}-physical` }) },
      { metricName: 'utilization_percent', points: buildDemoTrendPoints(normalizedRange, demoMetricPercent(allocation, physical), { amplitude: 4, floor: 0, ceiling: 100, seed: `${ref}-utilization` }) },
    ],
  };
}

function buildDemoCapacityBaseline() {
  const generatedAt = new Date().toISOString();
  const hosts = demoDb.hosts.map((host) => {
    const metrics = demoDb.hostMetrics[host.ref] || { memory_total: 0, memory_free: 0 };
    const total = Number(metrics.memory_total || 0);
    const free = Number(metrics.memory_free || 0);
    const used = Math.max(0, total - free);

    return {
      entityRef: host.ref,
      ts: generatedAt,
      memory_total_bytes: total,
      memory_free_bytes: free,
      memory_used_bytes: used,
      memory_used_percent: demoMetricPercent(used, total),
      cpu_usage_percent: demoHostCpuUsage(host.ref),
      network_rx_kib_per_s: demoHostNetworkRx(host.ref),
      network_tx_kib_per_s: demoHostNetworkTx(host.ref),
    };
  });

  const vms = demoDb.vms
    .filter((vm) => !vm.is_a_template)
    .map((vm) => {
      const configured = Number(vm.memory_static_max || vm.memory_dynamic_max || 0);
      const actual = vm.power_state === 'Halted' ? configured * 0.08 : vm.power_state === 'Suspended' ? configured * 0.24 : configured * 0.78;

      return {
        entityRef: vm.ref,
        ts: generatedAt,
        memory_actual_bytes: Math.round(actual),
        memory_static_max_bytes: configured,
        memory_usage_percent: demoMetricPercent(actual, configured),
        cpu_usage_percent: Math.max(8, Math.min(94, (Number(vm.VCPUs_at_startup || 0) * 9) + (vm.power_state === 'Running' ? 18 : 6))),
        vcpu_count: Number(vm.VCPUs_at_startup || 0),
        network_rx_kib_per_s: demoVmNetworkRx(vm),
        network_tx_kib_per_s: demoVmNetworkTx(vm),
        disk_read_kib_per_s: demoVmDiskRead(vm),
        disk_write_kib_per_s: demoVmDiskWrite(vm),
      };
    });

  const storage = demoDb.srs.map((sr) => {
    const allocation = Number(sr.virtual_allocation || 0);
    const physical = Number(sr.physical_size || 0);

    return {
      entityRef: sr.ref,
      ts: generatedAt,
      allocation_bytes: allocation,
      physical_bytes: physical,
      utilization_percent: demoMetricPercent(allocation, physical),
    };
  });

  return {
    generatedAt,
    resolution: 'raw',
    hosts,
    vms,
    storage,
  };
}
