const { metricSampleModel } = require('../models/perf-db');

const FRESHNESS_WINDOW_MS = 24 * 60 * 60 * 1000;

const THRESHOLDS = [
  {
    entityType: 'host',
    metricName: 'memory_used_percent',
    cls: 'host',
    warningAt: 85,
    criticalAt: 95,
    buildName: (label, severity) => `${label} memory pressure ${severity === 'critical' ? 'critical' : 'elevated'}`,
    buildBody: (label, value, resolution) => `${label} is using ${value.toFixed(1)}% of host memory based on the latest persisted telemetry ${resolution === 'hourly' ? 'rollup' : 'sample'}.`,
  },
  {
    entityType: 'sr',
    metricName: 'utilization_percent',
    cls: 'sr',
    warningAt: 80,
    criticalAt: 92,
    buildName: (label, severity) => `${label} storage utilization ${severity === 'critical' ? 'critical' : 'elevated'}`,
    buildBody: (label, value, resolution) => `${label} is ${value.toFixed(1)}% allocated based on the latest persisted telemetry ${resolution === 'hourly' ? 'rollup' : 'sample'}.`,
  },
];

function toIso(ts) {
  const numericTs = Number(ts || 0);
  return numericTs > 0 ? new Date(numericTs).toISOString() : new Date().toISOString();
}

function buildSyntheticRef(entityType, metricName, entityRef) {
  return `OpaqueRef:telemetry:${entityType}:${metricName}:${entityRef}`;
}

function chooseLatestMetricRows(entityType, metricName, now = Date.now()) {
  const rawRows = metricSampleModel.listLatestMetricByEntity(entityType, metricName)
    .map((row) => ({ ...row, resolution: 'raw' }));
  const hourlyRows = metricSampleModel.listLatestHourlyMetricByEntity(entityType, metricName)
    .map((row) => ({ ...row, resolution: 'hourly' }));
  const selected = new Map();

  [...rawRows, ...hourlyRows].forEach((row) => {
    const ts = Number(row.ts || 0);
    if (!ts || now - ts > FRESHNESS_WINDOW_MS) return;

    const current = selected.get(row.entity_ref);
    if (!current || ts > Number(current.ts || 0)) {
      selected.set(row.entity_ref, row);
    }
  });

  return [...selected.values()];
}

async function listTelemetryAlerts(xenApi, options = {}) {
  const now = Number(options.now || Date.now());
  const [hostsResult, srsResult] = await Promise.all([
    xenApi?.getHosts ? xenApi.getHosts().catch(() => ({ records: {} })) : Promise.resolve({ records: {} }),
    xenApi?.getSRs ? xenApi.getSRs().catch(() => ({ records: {} })) : Promise.resolve({ records: {} }),
  ]);
  const inventory = {
    host: hostsResult?.records || {},
    sr: srsResult?.records || {},
  };

  return THRESHOLDS.flatMap((threshold) => {
    const latestRows = chooseLatestMetricRows(threshold.entityType, threshold.metricName, now);

    return latestRows.flatMap((row) => {
      const value = Number(row.value || 0);
      if (value < threshold.warningAt) return [];

      const severity = value >= threshold.criticalAt ? 'critical' : 'warning';
      const record = inventory[threshold.entityType]?.[row.entity_ref] || {};
      const label = String(record.name_label || record.name || row.entity_ref || threshold.entityType).trim();
      const entityUuid = String(record.uuid || row.entity_ref || '').trim();

      return [{
        ref: buildSyntheticRef(threshold.entityType, threshold.metricName, row.entity_ref),
        name: threshold.buildName(label, severity),
        cls: threshold.cls,
        body: threshold.buildBody(label, value, row.resolution),
        timestamp: toIso(row.ts),
        uuid: `telemetry:${threshold.entityType}:${threshold.metricName}:${entityUuid}`,
        obj_uuid: entityUuid,
        severity,
        metricName: threshold.metricName,
        metricValue: value,
        metricResolution: row.resolution,
        entityRef: row.entity_ref,
      }];
    });
  });
}

module.exports = {
  buildSyntheticRef,
  listTelemetryAlerts,
};
