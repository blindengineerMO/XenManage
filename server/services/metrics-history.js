const { metricSampleModel } = require('../models/perf-db');

const RANGE_TO_MS = {
  '1h': 60 * 60 * 1000,
  '6h': 6 * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
};

const STALE_SAMPLE_WINDOW_MS = 10 * 60 * 1000;

const ENTITY_METRICS = {
  host: ['memory_total_bytes', 'memory_free_bytes', 'memory_used_bytes', 'memory_used_percent', 'cpu_usage_percent', 'network_rx_kib_per_s', 'network_tx_kib_per_s'],
  vm: ['memory_actual_bytes', 'memory_static_max_bytes', 'memory_usage_percent', 'cpu_usage_percent', 'vcpu_count', 'network_rx_kib_per_s', 'network_tx_kib_per_s', 'disk_read_kib_per_s', 'disk_write_kib_per_s'],
  sr: ['allocation_bytes', 'physical_bytes', 'utilization_percent'],
};

const HOURLY_ROLLUP_RANGES = new Set(['7d', '30d']);
const RRD_CF_PREFIXES = new Set(['average', 'min', 'max', 'last']);

function normalizeRange(range = '24h') {
  return RANGE_TO_MS[range] ? range : '24h';
}

function shouldUseHourlyRollups(range = '24h') {
  return HOURLY_ROLLUP_RANGES.has(normalizeRange(range));
}

function rangeStart(range = '24h', now = Date.now()) {
  return now - RANGE_TO_MS[normalizeRange(range)];
}

function percent(numerator, denominator) {
  const top = Number(numerator || 0);
  const bottom = Number(denominator || 0);
  if (!bottom) return 0;
  return Math.max(0, Math.min(100, (top / bottom) * 100));
}

function normalizeClassRecords(records = {}) {
  return Object.entries(records).map(([ref, record]) => ({ ref, ...record }));
}

function normalizeLookupKey(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizePercentValue(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  const scaled = numeric >= 0 && numeric <= 1 ? numeric * 100 : numeric;
  return Math.max(0, Math.min(100, scaled));
}

function normalizeNonNegativeValue(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return null;
  return numeric;
}

function isHostCpuLegendMetric(metricName = '') {
  return /^cpu(?:_avg|_usage(?:_percent)?)?$/.test(String(metricName || '').trim().toLowerCase());
}

function isVmCpuLegendMetric(metricName = '') {
  return /^cpu\d+$/.test(String(metricName || '').trim().toLowerCase());
}

function isHostNetworkLegendMetric(metricName = '', direction = 'rx') {
  return new RegExp(`^pif_.+_${direction}$`).test(String(metricName || '').trim().toLowerCase());
}

function isVmNetworkLegendMetric(metricName = '', direction = 'rx') {
  return new RegExp(`^vif_.+_${direction}$`).test(String(metricName || '').trim().toLowerCase());
}

function isVmDiskLegendMetric(metricName = '', direction = 'read') {
  return new RegExp(`^vbd_.+_${direction}$`).test(String(metricName || '').trim().toLowerCase());
}

function buildEntityLookup(records = [], fields = []) {
  const lookup = new Map();

  for (const record of records) {
    fields.forEach((field) => {
      const candidate = record?.[field];
      const key = normalizeLookupKey(candidate);
      if (key && !lookup.has(key)) {
        lookup.set(key, record.ref);
      }
    });
  }

  return lookup;
}

function parseRrdLegend(legend = '') {
  const parts = String(legend || '').split(':');
  if (parts.length < 3) return null;

  const offset = RRD_CF_PREFIXES.has(normalizeLookupKey(parts[0])) ? 1 : 0;
  if (parts.length - offset < 3) return null;

  return {
    cf: offset ? normalizeLookupKey(parts[0]) : '',
    entityType: normalizeLookupKey(parts[offset]),
    identifier: normalizeLookupKey(parts.slice(offset + 1, -1).join(':')),
    metricName: normalizeLookupKey(parts[parts.length - 1]),
  };
}

function normalizeRrdLegends(payload = {}) {
  if (Array.isArray(payload.legends)) return payload.legends.map((entry) => String(entry || ''));
  if (Array.isArray(payload.meta?.legend)) return payload.meta.legend.map((entry) => String(entry || ''));
  return [];
}

function normalizeRrdRows(payload = {}) {
  if (!Array.isArray(payload.data)) return [];

  return payload.data
    .map((row) => {
      if (Array.isArray(row)) return row;
      if (!row || typeof row !== 'object') return [];

      const ts = Number(row.timestamp ?? row.ts ?? row.t ?? row.time ?? 0);
      if (Array.isArray(row.values)) return [ts, ...row.values];
      if (Array.isArray(row.data)) return [ts, ...row.data];
      return [];
    })
    .filter((row) => row.length > 1);
}

function parseHostCpuUsage(payload = {}, hosts = []) {
  const lookup = buildEntityLookup(hosts, ['ref', 'uuid', 'name_label', 'hostname', 'address']);
  const legends = normalizeRrdLegends(payload);
  const rows = normalizeRrdRows(payload);
  const latestByRef = new Map();

  legends.forEach((legend, index) => {
    const parsed = parseRrdLegend(legend);
    if (!parsed) return;

    if (parsed.entityType !== 'host' || !isHostCpuLegendMetric(parsed.metricName) || !parsed.identifier) return;

    const hostRef = lookup.get(parsed.identifier);
    if (!hostRef) return;

    for (let rowIndex = rows.length - 1; rowIndex >= 0; rowIndex -= 1) {
      const rawValue = Number(rows[rowIndex][index + 1]);
      const normalizedValue = normalizePercentValue(rawValue);
      if (normalizedValue === null) continue;
      latestByRef.set(hostRef, normalizedValue);
      break;
    }
  });

  return Object.fromEntries(latestByRef.entries());
}

function parseVmCpuUsage(payload = {}, vms = []) {
  const lookup = buildEntityLookup(vms, ['ref', 'uuid', 'name_label']);
  const recordsByRef = new Map(vms.map((record) => [record.ref, record]));
  const legends = normalizeRrdLegends(payload);
  const rows = normalizeRrdRows(payload);
  const totalsByRef = new Map();

  legends.forEach((legend, index) => {
    const parsed = parseRrdLegend(legend);
    if (!parsed) return;

    if (parsed.entityType !== 'vm' || !isVmCpuLegendMetric(parsed.metricName) || !parsed.identifier) return;

    const vmRef = lookup.get(parsed.identifier);
    if (!vmRef) return;

    for (let rowIndex = rows.length - 1; rowIndex >= 0; rowIndex -= 1) {
      const rawValue = Number(rows[rowIndex][index + 1]);
      const normalizedValue = normalizePercentValue(rawValue);
      if (normalizedValue === null) continue;

      const current = totalsByRef.get(vmRef) || { sum: 0, count: 0 };
      current.sum += normalizedValue;
      current.count += 1;
      totalsByRef.set(vmRef, current);
      break;
    }
  });

  return Object.fromEntries(
    [...totalsByRef.entries()]
      .map(([vmRef, totals]) => {
        const record = recordsByRef.get(vmRef) || {};
        const configuredVcpus = Number(record.VCPUs_at_startup || record.VCPUs_max || 0);
        const divisor = configuredVcpus > 0 ? configuredVcpus : totals.count;
        if (!divisor) return null;
        return [vmRef, totals.sum / divisor];
      })
      .filter(Boolean)
  );
}

function parseRrdMetricTotals(payload = {}, records = [], fields = [], entityType = '', matcher = () => false) {
  const lookup = buildEntityLookup(records, fields);
  const legends = normalizeRrdLegends(payload);
  const rows = normalizeRrdRows(payload);
  const totalsByRef = new Map();

  legends.forEach((legend, index) => {
    const parsed = parseRrdLegend(legend);
    if (!parsed) return;

    if (parsed.entityType !== entityType || !matcher(parsed.metricName) || !parsed.identifier) return;

    const entityRef = lookup.get(parsed.identifier);
    if (!entityRef) return;

    for (let rowIndex = rows.length - 1; rowIndex >= 0; rowIndex -= 1) {
      const normalizedValue = normalizeNonNegativeValue(rows[rowIndex][index + 1]);
      if (normalizedValue === null) continue;
      totalsByRef.set(entityRef, (totalsByRef.get(entityRef) || 0) + normalizedValue);
      break;
    }
  });

  return Object.fromEntries(totalsByRef.entries());
}

async function loadRrdDerivedMetrics(xenApi, hosts = [], vms = [], now = Date.now()) {
  if (!xenApi || typeof xenApi.getRrdUpdates !== 'function' || (!hosts.length && !vms.length)) {
    return {
      hostCpuUsage: {},
      vmCpuUsage: {},
      hostNetworkRx: {},
      hostNetworkTx: {},
      vmNetworkRx: {},
      vmNetworkTx: {},
      vmDiskRead: {},
      vmDiskWrite: {},
    };
  }

  try {
    const payload = await xenApi.getRrdUpdates({
      start: Math.max(0, Math.floor((now - STALE_SAMPLE_WINDOW_MS) / 1000)),
      cf: 'AVERAGE',
      interval: 60,
      host: true,
    });
    return {
      hostCpuUsage: parseHostCpuUsage(payload, hosts),
      vmCpuUsage: parseVmCpuUsage(payload, vms),
      hostNetworkRx: parseRrdMetricTotals(payload, hosts, ['ref', 'uuid', 'name_label', 'hostname', 'address'], 'host', (metricName) => isHostNetworkLegendMetric(metricName, 'rx')),
      hostNetworkTx: parseRrdMetricTotals(payload, hosts, ['ref', 'uuid', 'name_label', 'hostname', 'address'], 'host', (metricName) => isHostNetworkLegendMetric(metricName, 'tx')),
      vmNetworkRx: parseRrdMetricTotals(payload, vms, ['ref', 'uuid', 'name_label'], 'vm', (metricName) => isVmNetworkLegendMetric(metricName, 'rx')),
      vmNetworkTx: parseRrdMetricTotals(payload, vms, ['ref', 'uuid', 'name_label'], 'vm', (metricName) => isVmNetworkLegendMetric(metricName, 'tx')),
      vmDiskRead: parseRrdMetricTotals(payload, vms, ['ref', 'uuid', 'name_label'], 'vm', (metricName) => isVmDiskLegendMetric(metricName, 'read')),
      vmDiskWrite: parseRrdMetricTotals(payload, vms, ['ref', 'uuid', 'name_label'], 'vm', (metricName) => isVmDiskLegendMetric(metricName, 'write')),
    };
  } catch (error) {
    return {
      hostCpuUsage: {},
      vmCpuUsage: {},
      hostNetworkRx: {},
      hostNetworkTx: {},
      vmNetworkRx: {},
      vmNetworkTx: {},
      vmDiskRead: {},
      vmDiskWrite: {},
    };
  }
}

function buildHostSamples(record, metrics, ts, rrd = {}) {
  const total = Number(metrics?.memory_total || 0);
  const free = Number(metrics?.memory_free || 0);
  const used = Math.max(0, total - free);
  const samples = [
    { entityType: 'host', entityRef: record.ref, metricName: 'memory_total_bytes', ts, value: total },
    { entityType: 'host', entityRef: record.ref, metricName: 'memory_free_bytes', ts, value: free },
    { entityType: 'host', entityRef: record.ref, metricName: 'memory_used_bytes', ts, value: used },
    { entityType: 'host', entityRef: record.ref, metricName: 'memory_used_percent', ts, value: percent(used, total) },
  ];

  if (Number.isFinite(Number(rrd.cpuUsagePercent))) {
    samples.push({
      entityType: 'host',
      entityRef: record.ref,
      metricName: 'cpu_usage_percent',
      ts,
      value: Number(rrd.cpuUsagePercent),
    });
  }

  if (Number.isFinite(Number(rrd.networkRxKiBPerSecond))) {
    samples.push({
      entityType: 'host',
      entityRef: record.ref,
      metricName: 'network_rx_kib_per_s',
      ts,
      value: Number(rrd.networkRxKiBPerSecond),
    });
  }

  if (Number.isFinite(Number(rrd.networkTxKiBPerSecond))) {
    samples.push({
      entityType: 'host',
      entityRef: record.ref,
      metricName: 'network_tx_kib_per_s',
      ts,
      value: Number(rrd.networkTxKiBPerSecond),
    });
  }

  return samples;
}

function buildVmSamples(record, metrics, ts, rrd = {}) {
  const actual = Number(metrics?.memory_actual || record.memory_dynamic_max || record.memory_static_max || 0);
  const configured = Number(record.memory_static_max || record.memory_dynamic_max || actual || 0);
  const samples = [
    { entityType: 'vm', entityRef: record.ref, metricName: 'memory_actual_bytes', ts, value: actual },
    { entityType: 'vm', entityRef: record.ref, metricName: 'memory_static_max_bytes', ts, value: configured },
    { entityType: 'vm', entityRef: record.ref, metricName: 'memory_usage_percent', ts, value: percent(actual, configured) },
    { entityType: 'vm', entityRef: record.ref, metricName: 'vcpu_count', ts, value: Number(record.VCPUs_at_startup || record.VCPUs_max || 0) },
  ];

  if (Number.isFinite(Number(rrd.cpuUsagePercent))) {
    samples.push({
      entityType: 'vm',
      entityRef: record.ref,
      metricName: 'cpu_usage_percent',
      ts,
      value: Number(rrd.cpuUsagePercent),
    });
  }

  if (Number.isFinite(Number(rrd.networkRxKiBPerSecond))) {
    samples.push({
      entityType: 'vm',
      entityRef: record.ref,
      metricName: 'network_rx_kib_per_s',
      ts,
      value: Number(rrd.networkRxKiBPerSecond),
    });
  }

  if (Number.isFinite(Number(rrd.networkTxKiBPerSecond))) {
    samples.push({
      entityType: 'vm',
      entityRef: record.ref,
      metricName: 'network_tx_kib_per_s',
      ts,
      value: Number(rrd.networkTxKiBPerSecond),
    });
  }

  if (Number.isFinite(Number(rrd.diskReadKiBPerSecond))) {
    samples.push({
      entityType: 'vm',
      entityRef: record.ref,
      metricName: 'disk_read_kib_per_s',
      ts,
      value: Number(rrd.diskReadKiBPerSecond),
    });
  }

  if (Number.isFinite(Number(rrd.diskWriteKiBPerSecond))) {
    samples.push({
      entityType: 'vm',
      entityRef: record.ref,
      metricName: 'disk_write_kib_per_s',
      ts,
      value: Number(rrd.diskWriteKiBPerSecond),
    });
  }

  return samples;
}

function buildSrSamples(record, ts) {
  const allocation = Number(record.virtual_allocation || 0);
  const physical = Number(record.physical_size || 0);

  return [
    { entityType: 'sr', entityRef: record.ref, metricName: 'allocation_bytes', ts, value: allocation },
    { entityType: 'sr', entityRef: record.ref, metricName: 'physical_bytes', ts, value: physical },
    { entityType: 'sr', entityRef: record.ref, metricName: 'utilization_percent', ts, value: percent(allocation, physical) },
  ];
}

function groupPoints(rows = []) {
  return rows.map((row) => ({
    ts: Number(row.ts || 0),
    value: Number(row.value || 0),
  }));
}

function buildLatestMetricRows(entityType, metricName, targetKey = '') {
  const rawRows = metricSampleModel.listLatestMetricByEntity(entityType, metricName, targetKey);
  if (rawRows.length) {
    return {
      resolution: 'raw',
      rows: rawRows,
    };
  }

  return {
    resolution: 'hourly',
    rows: metricSampleModel.listLatestHourlyMetricByEntity(entityType, metricName, targetKey),
  };
}

function mergeLatestMetricSet(entityType, metricNames = [], targetKey = '') {
  const entities = new Map();
  let resolution = 'raw';

  metricNames.forEach((metricName) => {
    const metricRows = buildLatestMetricRows(entityType, metricName, targetKey);
    if (metricRows.resolution === 'hourly') {
      resolution = 'hourly';
    }

    metricRows.rows.forEach((row) => {
      const entityRef = String(row.entity_ref || '');
      if (!entityRef) return;

      const current = entities.get(entityRef) || {
        entityRef,
        ts: 0,
        metrics: {},
      };
      current.ts = Math.max(current.ts, Number(row.ts || 0));
      current.metrics[metricName] = Number(row.value || 0);
      entities.set(entityRef, current);
    });
  });

  return {
    resolution,
    entries: [...entities.values()].sort((left, right) => left.entityRef.localeCompare(right.entityRef)),
  };
}

function groupClusterSeries(rows = []) {
  const buckets = new Map();

  for (const row of rows) {
    const ts = Number(row.ts || 0);
    buckets.set(ts, (buckets.get(ts) || 0) + Number(row.value || 0));
  }

  return [...buckets.entries()]
    .sort((left, right) => left[0] - right[0])
    .map(([ts, value]) => ({ ts, value }));
}

function averageClusterSeries(rows = []) {
  const buckets = new Map();

  for (const row of rows) {
    const ts = Number(row.ts || 0);
    const current = buckets.get(ts) || { sum: 0, count: 0 };
    current.sum += Number(row.value || 0);
    current.count += 1;
    buckets.set(ts, current);
  }

  return [...buckets.entries()]
    .sort((left, right) => left[0] - right[0])
    .map(([ts, value]) => ({
      ts,
      value: value.count ? value.sum / value.count : 0,
    }));
}

function divideSeries(numeratorRows = [], denominatorRows = []) {
  const numerator = new Map(groupClusterSeries(numeratorRows).map((row) => [row.ts, row.value]));
  const denominator = new Map(groupClusterSeries(denominatorRows).map((row) => [row.ts, row.value]));

  return [...new Set([...numerator.keys(), ...denominator.keys()])]
    .sort((left, right) => left - right)
    .map((ts) => ({
      ts,
      value: percent(numerator.get(ts) || 0, denominator.get(ts) || 0),
    }));
}

const metricsHistoryService = {
  normalizeRange,
  shouldUseHourlyRollups,

  async captureSnapshot(xenApi, options = {}) {
    const now = Date.now();
    const targetKey = String(options.targetKey || '');
    const latestTs = metricSampleModel.getLatestTimestamp(targetKey);

    if (!options.force && latestTs && now - latestTs < STALE_SAMPLE_WINDOW_MS) {
      return { captured: false, ts: latestTs, sampleCount: 0 };
    }

    const [hostsResult, vmsResult, srsResult] = await Promise.all([
      xenApi.getHosts(),
      xenApi.getVMs(),
      xenApi.getSRs(),
    ]);

    const hosts = normalizeClassRecords(hostsResult.records);
    const vms = normalizeClassRecords(vmsResult.records).filter((record) => !record.is_a_template);
    const srs = normalizeClassRecords(srsResult.records);
    const {
      hostCpuUsage,
      vmCpuUsage,
      hostNetworkRx,
      hostNetworkTx,
      vmNetworkRx,
      vmNetworkTx,
      vmDiskRead,
      vmDiskWrite,
    } = await loadRrdDerivedMetrics(xenApi, hosts, vms, now);

    const hostMetrics = await Promise.all(hosts.map(async (record) => {
      try {
        return [record.ref, await xenApi.getHostMetrics(record.ref)];
      } catch (error) {
        return [record.ref, { live: false, memory_total: 0, memory_free: 0 }];
      }
    }));

    const vmMetrics = await Promise.all(vms.map(async (record) => {
      try {
        return [record.ref, await xenApi.getVMMetrics(record.ref)];
      } catch (error) {
        return [record.ref, null];
      }
    }));

    const hostMetricMap = Object.fromEntries(hostMetrics);
    const vmMetricMap = Object.fromEntries(vmMetrics);
    const ts = now;
    const samples = [
      ...hosts.flatMap((record) => buildHostSamples(record, hostMetricMap[record.ref], ts, {
        cpuUsagePercent: hostCpuUsage[record.ref],
        networkRxKiBPerSecond: hostNetworkRx[record.ref],
        networkTxKiBPerSecond: hostNetworkTx[record.ref],
      })),
      ...vms.flatMap((record) => buildVmSamples(record, vmMetricMap[record.ref], ts, {
        cpuUsagePercent: vmCpuUsage[record.ref],
        networkRxKiBPerSecond: vmNetworkRx[record.ref],
        networkTxKiBPerSecond: vmNetworkTx[record.ref],
        diskReadKiBPerSecond: vmDiskRead[record.ref],
        diskWriteKiBPerSecond: vmDiskWrite[record.ref],
      })),
      ...srs.flatMap((record) => buildSrSamples(record, ts)),
    ];

    metricSampleModel.insertMany(samples.map((sample) => ({ ...sample, targetKey })));

    return {
      captured: true,
      ts,
      sampleCount: samples.length,
      hostCount: hosts.length,
      vmCount: vms.length,
      srCount: srs.length,
    };
  },

  listEntitySeries(entityType, entityRef, range = '24h', targetKey = '') {
    const normalizedRange = normalizeRange(range);
    const sinceTs = rangeStart(normalizedRange);
    const metricNames = ENTITY_METRICS[entityType] || [];
    const useHourlyRollups = shouldUseHourlyRollups(normalizedRange);

    return {
      entityType,
      entityRef,
      range: normalizedRange,
      resolution: useHourlyRollups ? 'hourly' : 'raw',
      generatedAt: new Date().toISOString(),
      metrics: metricNames.map((metricName) => ({
        metricName,
        points: groupPoints(
          useHourlyRollups
            ? metricSampleModel.listEntityMetricHourly(entityType, entityRef, metricName, sinceTs, targetKey)
            : metricSampleModel.listEntityMetric(entityType, entityRef, metricName, sinceTs, targetKey)
        ),
      })),
    };
  },

  listClusterSeries(range = '24h', targetKey = '') {
    const normalizedRange = normalizeRange(range);
    const sinceTs = rangeStart(normalizedRange);
    const useHourlyRollups = shouldUseHourlyRollups(normalizedRange);
    const listAcross = useHourlyRollups
      ? metricSampleModel.listMetricAcrossEntitiesHourly.bind(metricSampleModel)
      : metricSampleModel.listMetricAcrossEntities.bind(metricSampleModel);
    const hostUsed = listAcross('host', 'memory_used_bytes', sinceTs, targetKey);
    const hostTotal = listAcross('host', 'memory_total_bytes', sinceTs, targetKey);
    const hostCpu = listAcross('host', 'cpu_usage_percent', sinceTs, targetKey);
    const hostNetworkRx = listAcross('host', 'network_rx_kib_per_s', sinceTs, targetKey);
    const hostNetworkTx = listAcross('host', 'network_tx_kib_per_s', sinceTs, targetKey);
    const srUsed = listAcross('sr', 'allocation_bytes', sinceTs, targetKey);
    const srTotal = listAcross('sr', 'physical_bytes', sinceTs, targetKey);
    const vmActual = listAcross('vm', 'memory_actual_bytes', sinceTs, targetKey);
    const vmNetworkRx = listAcross('vm', 'network_rx_kib_per_s', sinceTs, targetKey);
    const vmNetworkTx = listAcross('vm', 'network_tx_kib_per_s', sinceTs, targetKey);
    const vmDiskRead = listAcross('vm', 'disk_read_kib_per_s', sinceTs, targetKey);
    const vmDiskWrite = listAcross('vm', 'disk_write_kib_per_s', sinceTs, targetKey);

    return {
      range: normalizedRange,
      resolution: useHourlyRollups ? 'hourly' : 'raw',
      generatedAt: new Date().toISOString(),
      metrics: [
        {
          metricName: 'cluster_memory_used_percent',
          points: divideSeries(hostUsed, hostTotal),
        },
        {
          metricName: 'cluster_storage_utilization_percent',
          points: divideSeries(srUsed, srTotal),
        },
        {
          metricName: 'cluster_cpu_usage_percent',
          points: averageClusterSeries(hostCpu),
        },
        {
          metricName: 'cluster_vm_memory_actual_bytes',
          points: groupClusterSeries(vmActual),
        },
        {
          metricName: 'cluster_host_network_rx_kib_per_s',
          points: groupClusterSeries(hostNetworkRx),
        },
        {
          metricName: 'cluster_host_network_tx_kib_per_s',
          points: groupClusterSeries(hostNetworkTx),
        },
        {
          metricName: 'cluster_vm_network_rx_kib_per_s',
          points: groupClusterSeries(vmNetworkRx),
        },
        {
          metricName: 'cluster_vm_network_tx_kib_per_s',
          points: groupClusterSeries(vmNetworkTx),
        },
        {
          metricName: 'cluster_vm_disk_read_kib_per_s',
          points: groupClusterSeries(vmDiskRead),
        },
        {
          metricName: 'cluster_vm_disk_write_kib_per_s',
          points: groupClusterSeries(vmDiskWrite),
        },
      ],
    };
  },

  listCapacityBaseline(targetKey = '') {
    const hostMetrics = mergeLatestMetricSet('host', ENTITY_METRICS.host, targetKey);
    const vmMetrics = mergeLatestMetricSet('vm', ENTITY_METRICS.vm, targetKey);
    const storageMetrics = mergeLatestMetricSet('sr', ENTITY_METRICS.sr, targetKey);

    return {
      generatedAt: new Date().toISOString(),
      resolution: [hostMetrics, vmMetrics, storageMetrics].every((set) => set.resolution === 'raw') ? 'raw' : 'mixed',
      hosts: hostMetrics.entries.map((entry) => ({
        entityRef: entry.entityRef,
        ts: entry.ts,
        ...entry.metrics,
      })),
      vms: vmMetrics.entries.map((entry) => ({
        entityRef: entry.entityRef,
        ts: entry.ts,
        ...entry.metrics,
      })),
      storage: storageMetrics.entries.map((entry) => ({
        entityRef: entry.entityRef,
        ts: entry.ts,
        ...entry.metrics,
      })),
    };
  },
};

module.exports = metricsHistoryService;
