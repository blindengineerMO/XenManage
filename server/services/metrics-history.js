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
  host: ['memory_total_bytes', 'memory_free_bytes', 'memory_used_bytes', 'memory_used_percent'],
  vm: ['memory_actual_bytes', 'memory_static_max_bytes', 'memory_usage_percent', 'vcpu_count'],
  sr: ['allocation_bytes', 'physical_bytes', 'utilization_percent'],
};

function normalizeRange(range = '24h') {
  return RANGE_TO_MS[range] ? range : '24h';
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

function buildHostSamples(record, metrics, ts) {
  const total = Number(metrics?.memory_total || 0);
  const free = Number(metrics?.memory_free || 0);
  const used = Math.max(0, total - free);

  return [
    { entityType: 'host', entityRef: record.ref, metricName: 'memory_total_bytes', ts, value: total },
    { entityType: 'host', entityRef: record.ref, metricName: 'memory_free_bytes', ts, value: free },
    { entityType: 'host', entityRef: record.ref, metricName: 'memory_used_bytes', ts, value: used },
    { entityType: 'host', entityRef: record.ref, metricName: 'memory_used_percent', ts, value: percent(used, total) },
  ];
}

function buildVmSamples(record, metrics, ts) {
  const actual = Number(metrics?.memory_actual || record.memory_dynamic_max || record.memory_static_max || 0);
  const configured = Number(record.memory_static_max || record.memory_dynamic_max || actual || 0);

  return [
    { entityType: 'vm', entityRef: record.ref, metricName: 'memory_actual_bytes', ts, value: actual },
    { entityType: 'vm', entityRef: record.ref, metricName: 'memory_static_max_bytes', ts, value: configured },
    { entityType: 'vm', entityRef: record.ref, metricName: 'memory_usage_percent', ts, value: percent(actual, configured) },
    { entityType: 'vm', entityRef: record.ref, metricName: 'vcpu_count', ts, value: Number(record.VCPUs_at_startup || record.VCPUs_max || 0) },
  ];
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

  async captureSnapshot(xenApi, options = {}) {
    const now = Date.now();
    const latestTs = metricSampleModel.getLatestTimestamp();

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
      ...hosts.flatMap((record) => buildHostSamples(record, hostMetricMap[record.ref], ts)),
      ...vms.flatMap((record) => buildVmSamples(record, vmMetricMap[record.ref], ts)),
      ...srs.flatMap((record) => buildSrSamples(record, ts)),
    ];

    metricSampleModel.insertMany(samples);

    return {
      captured: true,
      ts,
      sampleCount: samples.length,
      hostCount: hosts.length,
      vmCount: vms.length,
      srCount: srs.length,
    };
  },

  listEntitySeries(entityType, entityRef, range = '24h') {
    const normalizedRange = normalizeRange(range);
    const sinceTs = rangeStart(normalizedRange);
    const metricNames = ENTITY_METRICS[entityType] || [];

    return {
      entityType,
      entityRef,
      range: normalizedRange,
      generatedAt: new Date().toISOString(),
      metrics: metricNames.map((metricName) => ({
        metricName,
        points: groupPoints(metricSampleModel.listEntityMetric(entityType, entityRef, metricName, sinceTs)),
      })),
    };
  },

  listClusterSeries(range = '24h') {
    const normalizedRange = normalizeRange(range);
    const sinceTs = rangeStart(normalizedRange);
    const hostUsed = metricSampleModel.listMetricAcrossEntities('host', 'memory_used_bytes', sinceTs);
    const hostTotal = metricSampleModel.listMetricAcrossEntities('host', 'memory_total_bytes', sinceTs);
    const srUsed = metricSampleModel.listMetricAcrossEntities('sr', 'allocation_bytes', sinceTs);
    const srTotal = metricSampleModel.listMetricAcrossEntities('sr', 'physical_bytes', sinceTs);
    const vmActual = metricSampleModel.listMetricAcrossEntities('vm', 'memory_actual_bytes', sinceTs);

    return {
      range: normalizedRange,
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
          metricName: 'cluster_vm_memory_actual_bytes',
          points: groupClusterSeries(vmActual),
        },
      ],
    };
  },
};

module.exports = metricsHistoryService;
