/* ============================================
   Capacity Analytics Helpers
   ============================================ */

function formatPercent(part, total) {
  const numerator = Number(part);
  const denominator = Number(total);

  if (!denominator || Number.isNaN(numerator) || Number.isNaN(denominator)) {
    return '-';
  }

  return `${Math.max(0, Math.min(100, (numerator / denominator) * 100)).toFixed(0)}%`;
}

function formatTaskProgress(value) {
  const progress = Number(value);
  if (Number.isNaN(progress)) return '-';
  return `${Math.max(0, Math.min(100, progress * 100)).toFixed(0)}%`;
}

function clampPercentage(value) {
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return 0;
  return Math.max(0, Math.min(100, numeric));
}

function percentValue(part, total) {
  const numerator = Number(part);
  const denominator = Number(total);

  if (!denominator || Number.isNaN(numerator) || Number.isNaN(denominator)) {
    return 0;
  }

  return clampPercentage((numerator / denominator) * 100);
}

function formatPercentValue(value) {
  return `${clampPercentage(value).toFixed(0)}%`;
}

function getUtilizationStatus(value, thresholds = {}) {
  const percent = clampPercentage(value);
  const warning = thresholds.warning ?? 75;
  const critical = thresholds.critical ?? 90;

  if (percent >= critical) return 'critical';
  if (percent >= warning) return 'warning';
  return 'info';
}

function normalizeVmMemory(vm = {}) {
  return Math.max(0, Number(
    vm.memoryActualBytesLatest
    ?? vm.memory_actual_bytes
    ?? vm.memory_dynamic_max
    ?? vm.memory_static_max
    ?? vm.memory_target
    ?? 0
  ));
}

function normalizeVmConfiguredMemory(vm = {}) {
  return Math.max(0, Number(vm.memory_static_max || vm.memory_dynamic_max || vm.memory_target || 0));
}

function normalizeVmVcpus(vm = {}) {
  return Math.max(0, Number(vm.vcpuCountLatest ?? vm.VCPUs_at_startup ?? vm.VCPUs_max ?? 0));
}

function normalizeVmCpuUsage(vm = {}) {
  const numeric = Number(vm.cpuUsagePercentLatest ?? vm.cpu_usage_percent ?? 0);
  if (Number.isNaN(numeric)) return 0;
  return clampPercentage(numeric);
}

function getHistoryMetricSeries(history = {}, metricName = '') {
  return (history?.metrics || []).find((entry) => entry.metricName === metricName)?.points || [];
}

function normalizeTrendPoints(series = []) {
  return (Array.isArray(series) ? series : [])
    .map((point) => ({
      ts: Number(point?.ts || 0),
      value: Number(point?.value || 0),
    }))
    .filter((point) => Number.isFinite(point.ts) && Number.isFinite(point.value) && point.ts > 0)
    .sort((left, right) => left.ts - right.ts);
}

function formatForecastHorizon(hours) {
  const numeric = Number(hours);
  if (!Number.isFinite(numeric) || numeric < 0) return '';
  if (numeric < 24) return `~${Math.max(1, Math.round(numeric))}h`;
  const days = numeric / 24;
  if (days < 7) return `~${(Math.round(days * 10) / 10).toFixed(days < 3 ? 1 : 0)}d`;
  return `~${(Math.round((days / 7) * 10) / 10).toFixed(1)}w`;
}

function buildTrendSignal(series = [], {
  label = 'metric',
  warning = 75,
  critical = 90,
  valueKind = 'percent',
} = {}) {
  const points = normalizeTrendPoints(series);
  const recentPoints = points.slice(-Math.min(points.length, 6));
  const first = recentPoints[0];
  const last = recentPoints[recentPoints.length - 1];

  if (!first || !last || recentPoints.length < 3 || last.ts <= first.ts) {
    return {
      label,
      valueKind,
      hasHistory: false,
      pointCount: points.length,
      latest: Number(last?.value || 0),
      delta: 0,
      slopePerHour: 0,
      slopePerDay: 0,
      warningHours: null,
      criticalHours: null,
      status: 'insufficient',
    };
  }

  const durationMs = last.ts - first.ts;
  const slopePerHour = ((last.value - first.value) / durationMs) * 3600000;
  const slopePerDay = slopePerHour * 24;
  const projectHours = (threshold) => {
    if (last.value >= threshold) return 0;
    if (slopePerHour <= 0) return null;
    return (threshold - last.value) / slopePerHour;
  };

  const warningHours = projectHours(warning);
  const criticalHours = projectHours(critical);
  let status = 'stable';
  if (last.value >= critical) status = 'critical';
  else if (last.value >= warning) status = 'warning';
  else if (criticalHours !== null && criticalHours <= 24) status = 'critical';
  else if ((warningHours !== null && warningHours <= 48) || slopePerDay >= 8) status = 'warning';
  else if (slopePerDay > 1) status = 'rising';

  return {
    label,
    valueKind,
    hasHistory: true,
    pointCount: points.length,
    latest: Number(last.value || 0),
    delta: Number((last.value - first.value) || 0),
    slopePerHour,
    slopePerDay,
    warningHours,
    criticalHours,
    status,
  };
}

function buildCapacityAttribution(summary = {}, context = {}) {
  const hottestHost = context.hottestHost || null;
  const busiestStorage = context.busiestStorage || null;
  const dominantWorkload = context.dominantWorkload || null;
  const candidates = [];

  if (hottestHost) {
    candidates.push({
      label: `${hottestHost.name_label || hottestHost.hostname || 'Host'} is the current pressure leader at ${formatPercentValue(hottestHost.pressurePercent || hottestHost.memoryUsagePercent || 0)}`,
      nextAction: `Validate placement options for ${hottestHost.name_label || hottestHost.hostname || 'that host'} before the next maintenance or provisioning window.`,
      score: Math.max(
        Number(hottestHost.pressurePercent || 0),
        Number(hottestHost.memoryUsagePercent || 0),
        Number(hottestHost.cpuUsagePercentLatest || 0)
      ),
      entityType: 'host',
      entityRef: hottestHost.ref || '',
      entityUuid: hottestHost.uuid || '',
      entityName: hottestHost.name_label || hottestHost.hostname || hottestHost.address || hottestHost.ref || 'Host',
    });
  }

  if (busiestStorage) {
    candidates.push({
      label: `${busiestStorage.name_label || 'Storage repo'} is carrying the highest allocation pressure at ${formatPercentValue(busiestStorage.utilizationPercent || 0)}`,
      nextAction: `Review reclamation, snapshot churn, or expansion options on ${busiestStorage.name_label || 'that repository'}.`,
      score: Number(busiestStorage.utilizationPercent || 0),
      entityType: 'sr',
      entityRef: busiestStorage.ref || '',
      entityUuid: busiestStorage.uuid || '',
      entityName: busiestStorage.name_label || busiestStorage.ref || 'Storage Repo',
    });
  }

  if (dominantWorkload) {
    candidates.push({
      label: `${dominantWorkload.name_label || 'A workload'} is the dominant footprint on ${dominantWorkload.hostName || 'its host'}, consuming ${formatPercentValue(dominantWorkload.riskPercentOfHost || dominantWorkload.hostMemorySharePercent || 0)} of local memory headroom`,
      nextAction: `Inspect ${dominantWorkload.name_label || 'that workload'} for rebalance or rightsizing before projected drift hardens.`,
      score: Math.max(
        Number(dominantWorkload.riskPercentOfHost || 0),
        Number(dominantWorkload.hostMemorySharePercent || 0),
        Number(dominantWorkload.cpuUsagePercent || 0)
      ),
      entityType: 'vm',
      entityRef: dominantWorkload.ref || '',
      entityUuid: dominantWorkload.uuid || '',
      entityName: dominantWorkload.name_label || dominantWorkload.ref || 'Workload',
    });
  }

  return candidates.sort((left, right) => right.score - left.score)[0] || null;
}

function summarizeCapacityRisk(summary = {}, history = {}, historyRange = '24h', context = {}) {
  const memoryUsedPercent = Number(summary.memoryUsedPercent || 0);
  const storageUsedPercent = Number(summary.storageUsedPercent || 0);
  const memoryCommitPercent = Number(summary.memoryCommitPercent || 0);
  const imbalancePercent = Number(summary.imbalancePercent || 0);
  const noisyNeighborCount = Number(summary.noisyNeighborCount || 0);
  const hotHostCount = Number(summary.hotHostCount || 0);
  const attribution = buildCapacityAttribution(summary, context);
  const memorySignal = buildTrendSignal(getHistoryMetricSeries(history, 'cluster_memory_used_percent'), {
    label: 'memory',
    warning: 70,
    critical: 85,
  });
  const storageSignal = buildTrendSignal(getHistoryMetricSeries(history, 'cluster_storage_utilization_percent'), {
    label: 'storage',
    warning: 75,
    critical: 90,
  });
  const cpuSignal = buildTrendSignal(getHistoryMetricSeries(history, 'cluster_cpu_usage_percent'), {
    label: 'cpu',
    warning: 70,
    critical: 90,
  });
  const historySignals = [memorySignal, storageSignal, cpuSignal].filter((signal) => signal.hasHistory);
  const forecastBasis = historySignals.length
    ? `Derived from persisted ${historyRange} telemetry across memory, storage, and CPU trends.`
    : 'Inferred from current inventory, host telemetry, and active task state.';
  const criticalSignal = historySignals
    .filter((signal) => signal.criticalHours !== null)
    .sort((left, right) => left.criticalHours - right.criticalHours)[0] || null;
  const warningSignal = historySignals
    .filter((signal) => signal.warningHours !== null)
    .sort((left, right) => left.warningHours - right.warningHours)[0] || null;
  const risingSignals = historySignals.filter((signal) => signal.slopePerDay > 1);

  let status = 'success';
  let title = 'Capacity outlook stable';
  let detail = 'Live inventory suggests enough headroom for standard workload churn.';
  let nextAction = 'Keep telemetry under review during patching, template rollout, and recovery drills.';
  let confidence = forecastBasis;
  let attributionText = attribution?.label || '';

  if (memoryUsedPercent >= 90 || storageUsedPercent >= 92 || memoryCommitPercent >= 110 || hotHostCount >= 2) {
    status = 'critical';
    title = 'Immediate rebalancing recommended';
    detail = 'One or more headroom indicators crossed the critical envelope, raising the chance of provisioning or evacuation pressure.';
    nextAction = 'Migrate heavy workloads, reclaim storage, or add capacity before the next maintenance or failover event.';
    confidence = historySignals.length
      ? `${forecastBasis} Persisted telemetry confirms the environment is already operating beyond its normal buffer.`
      : forecastBasis;
  } else if (criticalSignal && criticalSignal.criticalHours !== null && criticalSignal.criticalHours <= 24) {
    status = 'critical';
    title = 'Critical threshold approaching';
    detail = `Persisted ${criticalSignal.label} telemetry is trending toward its critical band within ${formatForecastHorizon(criticalSignal.criticalHours)} if the current slope holds.`;
    nextAction = 'Schedule workload movement, cleanup, or capacity expansion before the projected threshold window closes.';
    confidence = `${forecastBasis} Latest ${criticalSignal.label} slope is rising by ${criticalSignal.slopePerDay.toFixed(1)} percentage points per day.`;
  } else if (warningSignal && warningSignal.warningHours !== null && warningSignal.warningHours <= 72) {
    status = 'warning';
    title = 'Capacity threshold approaching';
    detail = `Persisted ${warningSignal.label} telemetry projects the warning band within ${formatForecastHorizon(warningSignal.warningHours)} if recent utilization keeps climbing.`;
    nextAction = 'Review the hottest hosts and busiest repositories now so remediation can land before the projected threshold.';
    confidence = `${forecastBasis} Recent ${warningSignal.label} slope is ${warningSignal.slopePerDay.toFixed(1)} percentage points per day.`;
  } else if (memoryUsedPercent >= 78 || storageUsedPercent >= 85 || memoryCommitPercent >= 95 || noisyNeighborCount > 0 || imbalancePercent >= 35) {
    status = 'warning';
    title = 'Capacity drift detected';
    detail = 'The environment remains operable, but placement skew or commit pressure suggests rebalancing should be scheduled soon.';
    nextAction = 'Review the hottest host, busiest storage repository, and largest workloads before the next deployment wave.';
    confidence = historySignals.length
      ? `${forecastBasis} Recent telemetry is elevated even without an immediate projected threshold crossing.`
      : forecastBasis;
  } else if (risingSignals.length) {
    const fastestSignal = [...risingSignals].sort((left, right) => right.slopePerDay - left.slopePerDay)[0];
    status = 'info';
    title = 'Capacity trend rising';
    detail = `Persisted ${fastestSignal.label} telemetry is climbing at ${fastestSignal.slopePerDay.toFixed(1)} percentage points per day, even though current headroom remains acceptable.`;
    nextAction = 'Keep routine telemetry collection active and watch the next capacity window before scheduling large provisioning changes.';
    confidence = `${forecastBasis} Forecast confidence is moderate because thresholds are not yet near-term.`;
  } else if (historySignals.length) {
    const strongestDecline = [...historySignals].sort((left, right) => left.slopePerDay - right.slopePerDay)[0];
    detail = strongestDecline.slopePerDay < -0.5
      ? `Persisted telemetry shows utilization easing, with ${strongestDecline.label} pressure falling by ${Math.abs(strongestDecline.slopePerDay).toFixed(1)} percentage points per day across the current window.`
      : 'Persisted telemetry shows no near-term threshold crossings across the current capacity window.';
    confidence = `${forecastBasis} Forecast confidence is higher because the current trend line is flat-to-improving.`;
  }

  if (attribution && (status === 'critical' || status === 'warning' || status === 'info')) {
    nextAction = `${nextAction} ${attribution.nextAction}`;
  } else if (!attributionText && status === 'success' && context.hottestHost) {
    attributionText = `${context.hottestHost.name_label || context.hottestHost.hostname || 'The busiest host'} still retains acceptable headroom for routine churn.`;
  }

  return {
    status,
    title,
    detail,
    nextAction,
    confidence,
    attribution: attributionText,
    driver: attribution
      ? {
          entityType: attribution.entityType || '',
          entityRef: attribution.entityRef || '',
          entityUuid: attribution.entityUuid || '',
          entityName: attribution.entityName || '',
        }
      : null,
  };
}

function buildCapacityAnalytics({
  hosts = [],
  srs = [],
  vms = [],
  tasks = [],
  messages = [],
  clusterHistory = { metrics: [] },
  historyRange = '24h',
} = {}) {
  const hostList = Array.isArray(hosts) ? hosts : [];
  const srList = Array.isArray(srs) ? srs : [];
  const vmList = Array.isArray(vms) ? vms.filter((vm) => !vm.is_a_template) : [];
  const taskList = Array.isArray(tasks) ? tasks : [];
  const messageList = Array.isArray(messages) ? messages : [];

  const scopedEntityKey = (record = {}, ref = '') => {
    const targetKey = String(record?.scopeTargetKey || '').trim();
    const entityRef = String(ref || record?.ref || '').trim();
    return targetKey ? `${targetKey}::${entityRef}` : entityRef;
  };
  const hostsByRef = Object.fromEntries(hostList.map((host) => [scopedEntityKey(host), host]));
  const clusterMemoryTotal = hostList.reduce((sum, host) => sum + Number(host.memoryTotal || 0), 0);
  const clusterMemoryUsed = hostList.reduce((sum, host) => sum + Number(host.memoryUsed || 0), 0);
  const clusterStorageTotal = srList.reduce((sum, sr) => sum + Number(sr.physical_size || 0), 0);
  const clusterStorageAllocated = srList.reduce((sum, sr) => sum + Number(sr.virtual_allocation || 0), 0);

  const normalizedVms = vmList.map((vm) => {
    const hostRef = vm.resident_on || vm.affinity || '';
    const host = hostsByRef[scopedEntityKey(vm, hostRef)];
    const memoryDemand = normalizeVmMemory(vm);
    const configuredMemoryDemand = normalizeVmConfiguredMemory(vm);
    const vcpuDemand = normalizeVmVcpus(vm);
    const cpuUsagePercent = normalizeVmCpuUsage(vm);
    const powerState = String(vm.power_state || '').toLowerCase();
    const telemetryBacked = Number(vm.memoryActualBytesLatest || 0) > 0 || Number(vm.cpuUsagePercentLatest || 0) > 0;

    return {
      ...vm,
      hostRef,
      hostScopeEntityKey: scopedEntityKey(vm, hostRef),
      hostName: host?.name_label || host?.hostname || host?.address || hostRef || 'Unplaced',
      memoryDemand,
      configuredMemoryDemand,
      vcpuDemand,
      cpuUsagePercent,
      telemetryBacked,
      powerState,
      riskPercentOfHost: percentValue(memoryDemand, Number(host?.memoryTotal || 0)),
      hostMemorySharePercent: percentValue(memoryDemand, Number(host?.memoryUsed || host?.memoryTotal || 0)),
    };
  });

  const totalVmMemoryDemand = normalizedVms.reduce((sum, vm) => sum + vm.configuredMemoryDemand, 0);
  const totalVmObservedMemoryDemand = normalizedVms.reduce((sum, vm) => sum + vm.memoryDemand, 0);
  const totalVmVcpuDemand = normalizedVms.reduce((sum, vm) => sum + vm.vcpuDemand, 0);
  const averageHostVmMemory = hostList.length ? totalVmObservedMemoryDemand / hostList.length : 0;

  const hostBalanceRows = hostList.map((host) => {
    const assignedVms = normalizedVms.filter((vm) => vm.hostScopeEntityKey === scopedEntityKey(host));
    const vmMemoryDemand = assignedVms.reduce((sum, vm) => sum + vm.memoryDemand, 0);
    const vmConfiguredMemoryDemand = assignedVms.reduce((sum, vm) => sum + vm.configuredMemoryDemand, 0);
    const vmVcpuDemand = assignedVms.reduce((sum, vm) => sum + vm.vcpuDemand, 0);
    const vmCpuUsagePercent = assignedVms.length
      ? assignedVms.reduce((sum, vm) => sum + vm.cpuUsagePercent, 0) / assignedVms.length
      : 0;
    const dominantVm = [...assignedVms].sort((left, right) => right.memoryDemand - left.memoryDemand)[0] || null;
    const pressurePercent = Math.max(
      Number(host.memoryUsagePercent || 0),
      Number(host.cpuUsagePercentLatest || 0),
      percentValue(vmMemoryDemand, Number(host.memoryTotal || 0))
    );
    const imbalancePercent = averageHostVmMemory
      ? Math.abs(vmMemoryDemand - averageHostVmMemory) / averageHostVmMemory * 100
      : 0;
    const relatedAlerts = messageList.filter((message) => {
      const haystack = `${message?.name || ''} ${message?.body || ''} ${message?.obj_uuid || ''}`.toLowerCase();
      return haystack.includes(String(host.uuid || '').toLowerCase()) || haystack.includes(String(host.name_label || '').toLowerCase());
    });
    const noisyNeighbors = assignedVms
      .filter((vm) => pressurePercent >= 70
        && (
          vm.riskPercentOfHost >= 18
          || percentValue(vm.memoryDemand, vmMemoryDemand) >= 45
          || vm.cpuUsagePercent >= 60
        ))
      .sort((left, right) => right.memoryDemand - left.memoryDemand);

    return {
      ...host,
      assignedVms,
      vmMemoryDemand,
      vmConfiguredMemoryDemand,
      vmVcpuDemand,
      vmCpuUsagePercent,
      dominantVm,
      pressurePercent,
      imbalancePercent,
      alertCount: relatedAlerts.length,
      noisyNeighbors,
      workloadSharePercent: percentValue(vmMemoryDemand, totalVmObservedMemoryDemand),
      status: !host.enabled
        ? 'disabled'
        : host.live === false
          ? 'offline'
          : getUtilizationStatus(pressurePercent, { warning: 70, critical: 85 }),
    };
  }).sort((left, right) => {
    const priority = { critical: 0, warning: 1, offline: 2, info: 3, disabled: 4 };
    const statusDelta = (priority[left.status] ?? 99) - (priority[right.status] ?? 99);
    if (statusDelta !== 0) return statusDelta;
    return right.pressurePercent - left.pressurePercent;
  });

  const topVmConsumers = [...normalizedVms]
    .sort((left, right) => {
      const memoryDelta = right.memoryDemand - left.memoryDemand;
      if (memoryDelta !== 0) return memoryDelta;
      return right.vcpuDemand - left.vcpuDemand;
    })
    .slice(0, 8);

  const noisyNeighborCandidates = hostBalanceRows
    .flatMap((host) => host.noisyNeighbors.map((vm) => ({
      ...vm,
      hostRef: host.ref,
      hostName: host.name_label || host.hostname || host.address || host.ref,
      hostStatus: host.status,
      hostPressurePercent: host.pressurePercent,
      recommendation: `Review ${vm.name_label || 'this VM'} on ${host.name_label || 'the host'} before the next placement, maintenance, or failover event.`,
    })))
    .slice(0, 8);

  const summary = {
    hostCount: hostList.length,
    vmCount: normalizedVms.length,
    storageCount: srList.length,
    activeTaskCount: taskList.filter((task) => ['pending', 'queued'].includes(String(task.status || '').toLowerCase())).length,
    hotHostCount: hostBalanceRows.filter((host) => ['critical', 'warning'].includes(host.status)).length,
    noisyNeighborCount: noisyNeighborCandidates.length,
    memoryUsedPercent: percentValue(clusterMemoryUsed, clusterMemoryTotal),
    memoryCommitPercent: percentValue(totalVmMemoryDemand, clusterMemoryTotal),
    storageUsedPercent: percentValue(clusterStorageAllocated, clusterStorageTotal),
    imbalancePercent: hostBalanceRows.length
      ? Math.max(...hostBalanceRows.map((host) => Number(host.imbalancePercent || 0)))
      : 0,
    totalVmMemoryDemand,
    totalVmObservedMemoryDemand,
    totalVmVcpuDemand,
    clusterMemoryTotal,
    clusterMemoryUsed,
    clusterStorageTotal,
    clusterStorageAllocated,
  };

  const hottestHost = hostBalanceRows[0] || null;
  const busiestStorage = [...srList]
    .sort((left, right) => percentValue(right.virtual_allocation, right.physical_size) - percentValue(left.virtual_allocation, left.physical_size))[0] || null;
  const dominantWorkload = noisyNeighborCandidates[0] || topVmConsumers[0] || null;

  return {
    summary,
    hostBalanceRows,
    topVmConsumers,
    noisyNeighborCandidates,
    forecast: summarizeCapacityRisk(summary, clusterHistory, historyRange, {
      hottestHost,
      busiestStorage,
      dominantWorkload,
    }),
  };
}
