function normalizeHostSelectionRefs(values = []) {
  return Array.isArray(values) ? values.filter(Boolean) : [];
}

function filterSelectedHostRows(hosts = [], selectedRefs = []) {
  const selected = new Set(normalizeHostSelectionRefs(selectedRefs));
  return (Array.isArray(hosts) ? hosts : []).filter((host) => selected.has(host.ref));
}

function resolveHostMaintenanceState(host) {
  if (!host) return false;
  if (host.maintenance_mode === true) return true;
  return String(host.other_config?.maintenance_mode || '').toLowerCase() === 'true';
}

function countSelectedHostMaintenanceStates(hosts = []) {
  return (Array.isArray(hosts) ? hosts : []).reduce((counts, host) => {
    if (resolveHostMaintenanceState(host)) counts.maintenance += 1;
    else counts.ready += 1;
    return counts;
  }, { ready: 0, maintenance: 0 });
}

function summarizeSelectedHostMaintenanceStates(counts = {}) {
  const parts = [];
  if (counts.ready) parts.push(`${counts.ready} ready for maintenance`);
  if (counts.maintenance) parts.push(`${counts.maintenance} already in maintenance`);
  return parts.length ? parts.join(' · ') : 'No selected host maintenance states were recognized.';
}

function summarizeHostStringMap(record, emptyLabel = '-') {
  const entries = Object.entries(record || {})
    .filter(([key, value]) => String(key || '').trim() && String(value || '').trim())
    .map(([key, value]) => `${String(key).trim()}=${String(value).trim()}`);

  return entries.length ? entries.join(' · ') : emptyLabel;
}

function buildSelectedHostCpuSummary(host) {
  const cpuInfo = host?.cpu_info || host?.CPU_info || {};
  const count = Number(cpuInfo.cpu_count || cpuInfo.CPU_count || host?.host_CPUs?.length || 0) || 0;
  const sockets = Number(cpuInfo.socket_count || cpuInfo.sockets || 0) || 0;
  const coresPerSocket = Number(cpuInfo.cores_per_socket || cpuInfo.cores || 0) || 0;
  const threadsPerCore = Number(cpuInfo.threads_per_core || 0) || 0;
  const model = String(cpuInfo.modelname || cpuInfo.vendor || '').trim();

  const parts = [];
  if (count) parts.push(`${count} CPUs`);
  if (sockets) parts.push(`${sockets} sockets`);
  if (coresPerSocket) parts.push(`${coresPerSocket} cores/socket`);
  if (threadsPerCore) parts.push(`${threadsPerCore} threads/core`);
  if (model) parts.push(model);

  return parts.length ? parts.join(' · ') : 'No CPU topology was reported for this host.';
}

function buildSelectedHostHardwarePlatformSummary(host) {
  const versions = Array.isArray(host?.virtual_hardware_platform_versions)
    ? host.virtual_hardware_platform_versions
    : [];
  const normalized = versions
    .map((value) => String(value || '').trim())
    .filter(Boolean);

  return normalized.length
    ? normalized.join(', ')
    : 'No supported virtual hardware versions were reported for this host.';
}

function buildSelectedHostSchedGranLabel(host) {
  const value = String(host?.sched_gran || '').trim().toLowerCase();
  if (value === 'core') return 'Core scheduling';
  if (value === 'socket') return 'Socket scheduling';
  if (value === 'cpu') return 'CPU scheduling';
  return 'No host scheduler granularity was reported.';
}

function buildSelectedHostSslLegacyLabel(host) {
  if (host?.ssl_legacy === true) return 'Enabled for legacy compatibility';
  if (host?.ssl_legacy === false) return 'Disabled';
  return 'No host SSL legacy posture was reported.';
}

function buildSelectedHostLoggingSummary(host) {
  const entries = Object.entries(host?.logging || {})
    .filter(([key]) => String(key || '').trim())
    .map(([key, value]) => `${String(key).trim()}=${String(value || '').trim()}`);

  return entries.length ? entries.join(' · ') : 'No host-specific logging overrides are currently configured.';
}

function findAttachedHostTarget(attachedTargets = [], target = null) {
  if (!target || target.mode !== 'standalone') return null;
  const host = String(target.host || '').toLowerCase();
  const username = String(target.username || '').toLowerCase();
  const port = Number(target.port || 443) || 443;
  return (Array.isArray(attachedTargets) ? attachedTargets : []).find((entry) =>
    String(entry.host || '').toLowerCase() === host
    && String(entry.username || '').toLowerCase() === username
    && (Number(entry.port || 443) || 443) === port
  ) || null;
}

function isHostTargetAttached(attachedTargets = [], target = null) {
  return Boolean(findAttachedHostTarget(attachedTargets, target));
}

function isCurrentHostTarget(attachedTargets = [], target = null) {
  return Boolean(findAttachedHostTarget(attachedTargets, target)?.active);
}

function isHostTargetBusy(targetActionBusyId = null, targetActionBusyKind = '', target = null, kind = '') {
  return Number(targetActionBusyId || 0) === Number(target?.id || 0) && targetActionBusyKind === kind;
}

function findHostMetricSeries(metricHistory = null, metricName = '') {
  const metrics = Array.isArray(metricHistory?.metrics) ? metricHistory.metrics : [];
  return metrics.find((entry) => entry.metricName === metricName)?.points || [];
}

function combineHostMetricSeries(metricHistory = null, metricNames = []) {
  const buckets = new Map();
  (Array.isArray(metricNames) ? metricNames : []).forEach((metricName) => {
    const points = findHostMetricSeries(metricHistory, metricName);
    points.forEach((point) => {
      const ts = Number(point?.ts || 0);
      if (!ts) return;
      buckets.set(ts, (buckets.get(ts) || 0) + Number(point?.value || 0));
    });
  });
  return [...buckets.entries()]
    .sort((left, right) => left[0] - right[0])
    .map(([ts, value]) => ({ ts, value }));
}

function getHostHistoryStatus(series = [], thresholds = {}) {
  const points = Array.isArray(series) ? series : [];
  const latest = Number(points[points.length - 1]?.value || 0);
  if (thresholds.critical !== undefined && latest >= thresholds.critical) return 'critical';
  if (thresholds.warning !== undefined && latest >= thresholds.warning) return 'warning';
  return 'success';
}

function findHostByFocus(hosts = [], focus = null) {
  return (Array.isArray(hosts) ? hosts : []).find((host) =>
    recordMatchesRouteFocus(host, focus, ['ref', 'uuid', 'name_label', 'hostname', 'address'])
  ) || null;
}

function poolContainsHost(pool, host) {
  if (!pool || !host) return false;

  const poolRefs = new Set(
    [
      pool.master,
      ...(Array.isArray(pool.hosts) ? pool.hosts : []),
      ...(Array.isArray(pool.resident_hosts) ? pool.resident_hosts : []),
      ...(Array.isArray(pool.slaves) ? pool.slaves : []),
    ].filter(Boolean)
  );

  return poolRefs.has(host.ref) || poolRefs.has(host.uuid);
}

function resolveHostPool(host, relatedPools = []) {
  if (!host) return null;

  const pools = Array.isArray(relatedPools) ? relatedPools : [];
  const hostKeys = [host.pool, host.pool_ref, host.pool_uuid, host.pool_name]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase());

  if (hostKeys.length) {
    const directMatch = pools.find((pool) => {
      const poolKeys = [pool.ref, pool.uuid, pool.name_label]
        .filter(Boolean)
        .map((value) => String(value).toLowerCase());
      return hostKeys.some((value) => poolKeys.includes(value));
    });

    if (directMatch) return directMatch;
  }

  const relationshipMatch = pools.find((pool) => poolContainsHost(pool, host));
  if (relationshipMatch) return relationshipMatch;

  if (pools.length === 1) return pools[0];
  return null;
}
