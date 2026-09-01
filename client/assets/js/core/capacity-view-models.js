function buildCapacityWorkspaceModel({
  hosts = [],
  srs = [],
  vms = [],
  tasks = [],
  messages = [],
  clusterHistory = { metrics: [] },
  historyRange = '24h',
  selectedEntityType = '',
  isCapacityAutomationTask = () => false,
  taskSlaMeta = () => ({ label: 'On Track', tone: 'success', isOverdue: false }),
  taskEvidenceChecklist = () => [],
  taskCompletionCriteria = () => [],
  colorClass = () => 'green',
} = {}) {
  const analytics = buildCapacityAnalytics({
    hosts,
    srs,
    vms,
    tasks,
    messages,
    clusterHistory,
    historyRange,
  });

  const hostList = Array.isArray(hosts) ? hosts : [];
  const storageList = Array.isArray(srs) ? srs : [];
  const taskList = Array.isArray(tasks) ? tasks : [];
  const topHosts = [...hostList].sort((left, right) => right.memoryUsagePercent - left.memoryUsagePercent);
  const topStorage = [...storageList].sort((left, right) => right.utilizationPercent - left.utilizationPercent);
  const hotHosts = hostList.filter((host) => host.memoryUsagePercent >= 85 && host.enabled);
  const storageRisks = storageList.filter((sr) => sr.utilizationPercent >= 85);
  const activeTasks = taskList.filter((task) => ['pending', 'queued'].includes((task.status || '').toLowerCase()));
  const capacityAutomationTasks = sortTasks(taskList.filter((task) => isCapacityAutomationTask(task)));
  const overdueAutomationTasks = capacityAutomationTasks.filter((task) => taskSlaMeta(task).isOverdue);
  const clusterMemory = hostList.reduce((accumulator, host) => {
    accumulator.total += host.memoryTotal;
    accumulator.used += host.memoryUsed;
    accumulator.free += host.memoryFree;
    return accumulator;
  }, { total: 0, used: 0, free: 0 });
  const clusterStorage = storageList.reduce((accumulator, sr) => {
    accumulator.total += Number(sr.physical_size || 0);
    accumulator.allocated += Number(sr.virtual_allocation || 0);
    accumulator.free += sr.freeBytes;
    return accumulator;
  }, { total: 0, allocated: 0, free: 0 });
  const liveHosts = hostList.filter((host) => host.live).length;
  const capacityForecast = analytics.forecast;

  const capacityCards = [
    {
      key: 'memory',
      label: 'Host Memory',
      value: formatPercentValue(analytics.summary.memoryUsedPercent),
      detail: `${formatBytes(clusterMemory.used)} used of ${formatBytes(clusterMemory.total)}`,
      icon: 'mdi-memory',
      valueClass: hostList.length ? `text-${colorClass(analytics.summary.memoryUsedPercent)}` : '',
    },
    {
      key: 'vm-commit',
      label: 'VM Commit',
      value: formatPercentValue(analytics.summary.memoryCommitPercent),
      detail: `${formatBytes(analytics.summary.totalVmMemoryDemand)} allocated across ${analytics.summary.vmCount} workloads`,
      icon: 'mdi-chart-sankey',
      valueClass: Array.isArray(vms) && vms.length ? `text-${colorClass(analytics.summary.memoryCommitPercent)}` : '',
    },
    {
      key: 'storage',
      label: 'Storage Commit',
      value: formatPercentValue(analytics.summary.storageUsedPercent),
      detail: `${formatBytes(clusterStorage.allocated)} allocated of ${formatBytes(clusterStorage.total)}`,
      icon: 'mdi-database',
      valueClass: storageList.length ? `text-${colorClass(analytics.summary.storageUsedPercent)}` : '',
    },
    {
      key: 'hot-hosts',
      label: 'Pressure Hosts',
      value: String(hotHosts.length),
      detail: hotHosts.length ? `${hotHosts[0].name_label || 'Host'} is the highest-pressure node` : 'No hosts above the pressure threshold',
      icon: 'mdi-thermometer-alert',
      valueClass: hotHosts.length ? 'text-amber' : 'text-green',
    },
    {
      key: 'neighbors',
      label: 'Noisy Neighbors',
      value: String(analytics.noisyNeighborCandidates.length),
      detail: analytics.noisyNeighborCandidates.length
        ? `${analytics.noisyNeighborCandidates[0].name_label || 'A workload'} dominates a hot host footprint`
        : 'No dominant VM signatures inferred',
      icon: 'mdi-transit-connection-variant',
      valueClass: analytics.noisyNeighborCandidates.length ? 'text-amber' : 'text-green',
    },
    {
      key: 'tasks',
      label: 'Active Tasks',
      value: String(activeTasks.length),
      detail: activeTasks.length ? 'Background maintenance or scans are still running' : 'No active background jobs reported',
      icon: 'mdi-progress-clock',
      valueClass: activeTasks.length ? 'text-cyan' : 'text-green',
    },
  ];

  const recommendations = [];

  if (hotHosts.length) {
    const host = hotHosts[0];
    recommendations.push({
      title: 'Rebalance compute load',
      detail: `${host.name_label || 'Host'} is running at ${formatPercentValue(host.memoryUsagePercent)} memory utilization across ${host.residentVmCount} resident VMs.`,
      status: 'warning',
    });
  }

  if (storageRisks.length) {
    const sr = storageRisks[0];
    recommendations.push({
      title: 'Expand or reclaim storage',
      detail: `${sr.name_label || 'Storage Repo'} is at ${formatPercentValue(sr.utilizationPercent)} allocation and should be reviewed before the next provisioning wave.`,
      status: sr.utilizationPercent >= 90 ? 'critical' : 'warning',
    });
  }

  if (analytics.noisyNeighborCandidates.length) {
    const vm = analytics.noisyNeighborCandidates[0];
    recommendations.push({
      title: 'Review dominant workload placement',
      detail: `${vm.name_label || 'A VM'} accounts for ${formatPercentValue(vm.riskPercentOfHost)} of ${vm.hostName}'s current memory footprint.`,
      status: vm.hostStatus || 'warning',
    });
  }

  if (activeTasks.length) {
    const task = activeTasks[0];
    recommendations.push({
      title: 'Track active maintenance',
      detail: `${task.name_label || 'Background task'} is still in progress and may affect host availability or capacity planning decisions.`,
      status: 'pending',
    });
  }

  if (capacityAutomationTasks.length) {
    const task = capacityAutomationTasks[0];
    recommendations.push({
      title: 'Staged capacity follow-through ready',
      detail: `${task.name_label || 'A remediation task'} already carries ${taskEvidenceChecklist(task).length} evidence checks and ${taskCompletionCriteria(task).length} completion criteria into the capacity queue, with ${taskSlaMeta(task).label.toLowerCase()} timing.`,
      status: taskSlaMeta(task).tone,
    });
  }

  if (overdueAutomationTasks.length) {
    const task = overdueAutomationTasks[0];
    recommendations.push({
      title: 'Overdue capacity follow-through',
      detail: `${task.name_label || 'A remediation task'} is ${taskSlaMeta(task).label.toLowerCase()} and should be reassigned or closed before the next provisioning wave.`,
      status: 'critical',
    });
  }

  recommendations.push({
    title: capacityForecast.title,
    detail: `${capacityForecast.detail} ${capacityForecast.confidence}`,
    status: capacityForecast.status,
  });

  if (!recommendations.length) {
    recommendations.push({
      title: 'Capacity healthy',
      detail: 'Current telemetry is within expected operating thresholds. Use this surface to watch for drift before peak load periods.',
      status: 'success',
    });
  }

  return {
    analytics,
    topHosts,
    topStorage,
    topVms: analytics.topVmConsumers,
    hostBalanceRows: analytics.hostBalanceRows,
    noisyNeighborCandidates: analytics.noisyNeighborCandidates,
    capacityForecast,
    clusterMemory,
    clusterStorage,
    liveHosts,
    hotHosts,
    storageRisks,
    activeTasks,
    capacityAutomationTasks,
    capacityCards,
    recommendations,
    inspectorTitle:
      selectedEntityType === 'host'
        ? 'Capacity Host Detail'
        : selectedEntityType === 'storage'
          ? 'Capacity Storage Detail'
          : selectedEntityType === 'vm'
            ? 'Capacity VM Detail'
            : 'Capacity Detail',
  };
}

function isCapacityViewRemediationTask(task = null) {
  return String(task?.task_kind || '').toLowerCase() === 'remediation' || String(task?.source || '').toLowerCase() === 'remediation';
}

function isCapacityViewAutomationTask(task = null) {
  if (!isCapacityViewRemediationTask(task)) return false;
  return task.target_route === '/capacity' || String(task.action_type || '').toLowerCase() === 'capacity';
}

function getCapacityTaskEvidenceChecklist(task = null) {
  return Array.isArray(task?.evidence_checklist) ? task.evidence_checklist : [];
}

function getCapacityTaskCompletionCriteria(task = null) {
  return Array.isArray(task?.completion_criteria) ? task.completion_criteria : [];
}

function buildCapacityAutomationTaskLocation(task = null) {
  if (!task?.ref) return null;
  return buildFocusedRoute('/activity', {
    kind: 'task',
    ref: task.ref || '',
    uuid: task.uuid || '',
    name: task.name_label || '',
    cls: 'task',
    source: 'capacity',
  });
}

function getCapacityHostStatus(host = null) {
  if (!host?.enabled) return 'disabled';
  if (!host?.live) return 'offline';
  return getUtilizationStatus(host.memoryUsagePercent, { warning: 70, critical: 85 });
}

function getCapacityStorageStatus(sr = null) {
  return getUtilizationStatus(sr?.utilizationPercent, { warning: 75, critical: 90 });
}

function getCapacityColorClass(percent) {
  const status = getUtilizationStatus(percent, { warning: 75, critical: 90 });
  if (status === 'critical') return 'red';
  if (status === 'warning') return 'amber';
  return 'green';
}

function buildCapacityHostRecommendation(host = null) {
  if ((host?.memoryUsagePercent || 0) >= 85) {
    return `Consider migrating one or more workloads from ${host?.name_label || 'this host'} or scheduling additional capacity before the next demand spike.`;
  }
  if (!host?.live) {
    return 'Live telemetry is unavailable for this host, so verify its metrics pipeline before relying on recent utilization data.';
  }
  return 'This host currently has enough headroom for normal operations, but keep it in rotation when reviewing balancing opportunities.';
}

function buildCapacityStorageRecommendation(sr = null) {
  if ((sr?.utilizationPercent || 0) >= 90) {
    return 'Immediate expansion, cleanup, or workload redistribution is recommended to avoid provisioning failures and snapshot pressure.';
  }
  if ((sr?.utilizationPercent || 0) >= 75) {
    return 'Capacity remains usable, but this repository should be watched during template deployments or snapshot-heavy maintenance.';
  }
  return 'Storage headroom is currently healthy for standard provisioning and maintenance activity.';
}

function buildCapacityVmRecommendation(vm = null) {
  if ((vm?.riskPercentOfHost || 0) >= 20) {
    return `${vm?.name_label || 'This workload'} is consuming a large share of its host's memory envelope. Validate whether it should remain pinned here or be redistributed before maintenance, evacuation, or new deployments.`;
  }
  if ((vm?.riskPercentOfHost || 0) >= 12) {
    return `${vm?.name_label || 'This workload'} is one of the larger workloads on its current host. Keep it in view when balancing capacity or planning recovery targets.`;
  }
  return 'This workload does not currently stand out as a likely contention driver based on live placement and configured memory demand.';
}

function buildCapacityForecastDriverRecord(capacityForecast = null, hostBalanceRows = [], srs = [], vms = []) {
  const driver = capacityForecast?.driver || null;
  if (!driver?.entityType) return null;

  if (driver.entityType === 'host') {
    const host = (Array.isArray(hostBalanceRows) ? hostBalanceRows : []).find((entry) => entry.ref === driver.entityRef || entry.uuid === driver.entityUuid) || null;
    return host ? { type: 'host', entity: host } : null;
  }
  if (driver.entityType === 'sr') {
    const storage = (Array.isArray(srs) ? srs : []).find((entry) => entry.ref === driver.entityRef || entry.uuid === driver.entityUuid) || null;
    return storage ? { type: 'storage', entity: storage } : null;
  }
  if (driver.entityType === 'vm') {
    const vm = (Array.isArray(vms) ? vms : []).find((entry) => entry.ref === driver.entityRef || entry.uuid === driver.entityUuid) || null;
    return vm ? { type: 'vm', entity: vm } : null;
  }

  return null;
}

function buildCapacityForecastRemediationDraft(capacityForecast = null, driver = null, username = '') {
  if (!driver?.entity) return null;

  const entity = driver.entity;
  const forecast = capacityForecast || {};
  const targetRoute = '/capacity';
  const relatedClass = driver.type === 'storage' ? 'sr' : driver.type;
  const relatedObject = entity.uuid || entity.ref || '';
  const driverName = entity.name_label || entity.hostname || entity.address || entity.ref || forecast.driver?.entityName || 'capacity driver';
  const dueDate = (() => {
    const next = new Date();
    next.setDate(next.getDate() + 1);
    const offsetDate = new Date(next.getTime() - next.getTimezoneOffset() * 60000);
    return offsetDate.toISOString().slice(0, 10);
  })();

  const lifecyclePlanSeed = driver.type === 'host'
    ? {
        enabled: true,
        baselineStatus: 'drifted',
        targetStage: 'maintenance',
        maintenanceWindow: entity.other_config?.maintenance_window || '',
        patchGroup: '',
        owner: username || '',
        nextAction: 'validate',
        rebootRequired: false,
        evacuationRequired: true,
        dueDate,
        notes: `Created from the Tuesday, August 25, 2026 capacity forecast for ${driverName}.`,
      }
    : null;
  const resilienceRunbookSeed = driver.type === 'storage'
    ? {
        enabled: true,
        recoveryTier: 'tier-1',
        haPolicy: 'priority-restart',
        restartPriority: 'high',
        backupWindowHours: 12,
        rpoMinutes: 30,
        rtoMinutes: 90,
        restorePointStatus: 'review',
        owner: username || '',
        standbyHostRef: '',
        failoverNetworkRef: '',
        runbookSteps: [
          `Validate backup currency for workloads backed by ${driverName}.`,
          `Confirm recovery capacity before additional allocation lands on ${driverName}.`,
        ],
        notes: `Created from the Tuesday, August 25, 2026 capacity forecast for ${driverName}.`,
      }
    : null;
  const vmMigrationSeed = driver.type === 'vm'
    ? {
        enabled: true,
        mode: 'same-pool',
        hostRef: '',
        destinationTargetKey: '',
        transferNetworkRef: '',
        srRef: '',
        vifNetworkMap: [],
        live: ['running', 'suspended'].includes(String(entity.power_state || '').toLowerCase()),
        copy: false,
        force: false,
        compress: ['running', 'suspended'].includes(String(entity.power_state || '').toLowerCase()),
        setAsHomeServer: true,
        notes: `Created from the Tuesday, August 25, 2026 capacity forecast for ${driverName}.`,
      }
    : null;

  return {
    nameLabel: `Capacity Follow-through: ${driverName}`,
    nameDescription: `${forecast.detail || 'Forecast-driven follow-through requested.'}\n\n${forecast.nextAction || 'Review the current pressure signature and capture the next operational step.'}`,
    actionType: 'capacity',
    assignee: username || '',
    dueDate,
    alertRef: '',
    alertUuid: '',
    alertSummary: forecast.title || 'Capacity forecast follow-through',
    targetRoute,
    relatedObject,
    relatedClass,
    workspaceSummary: forecast.attribution || `Open Capacity on ${driverName} and capture the next rebalancing or remediation step.`,
    evidenceChecklist: [
      `Review the current forecast driver for ${driverName}.`,
      'Capture whether the trend is sustained across the active telemetry window.',
      'Document the next balancing, cleanup, or protection step before closing the task.',
    ],
    completionCriteria: [
      'A named operator owns the follow-through.',
      'The forecast driver has been reviewed in Capacity.',
      'Any downstream Lifecycle or Resilience work has been launched or explicitly ruled out.',
    ],
    lifecyclePlanSeed,
    resilienceRunbookSeed,
    vmMigrationSeed,
  };
}

function buildCapacityTaskFocus(task = null, payload = {}) {
  return {
    kind: 'task',
    ref: task?.ref || '',
    uuid: task?.uuid || '',
    name: task?.name_label || payload.nameLabel || '',
    cls: 'task',
    source: 'capacity',
  };
}

function buildCapacityForecastAutomationRoute(mode = '', focus = null) {
  if (!focus) return null;
  if (mode === 'lifecycle') return buildFocusedRoute('/lifecycle', focus, { seedAction: 'lifecycle-plan' });
  if (mode === 'lifecycle-maintenance') return buildFocusedRoute('/lifecycle', focus, { seedAction: 'lifecycle-maintenance' });
  if (mode === 'resilience') return buildFocusedRoute('/resilience', focus, { seedAction: 'resilience-runbook' });
  if (mode === 'resilience-drill') return buildFocusedRoute('/resilience', focus, { seedAction: 'resilience-drill' });
  if (mode === 'vm-migration') return buildFocusedRoute('/vms', focus, { seedAction: 'vm-migration' });
  return buildFocusedRoute('/activity', focus);
}

function findCapacityFocusedEntity(focus = null, hostBalanceRows = [], srs = [], vms = []) {
  if (!focus) return null;
  if (focus.kind === 'host' || focus.cls === 'host') {
    const host = (Array.isArray(hostBalanceRows) ? hostBalanceRows : []).find((entry) =>
      recordMatchesRouteFocus(entry, focus, ['ref', 'uuid', 'name_label', 'hostname', 'address'])
    ) || null;
    return host ? { type: 'host', entity: host } : null;
  }
  if (focus.kind === 'storage' || focus.cls === 'sr' || focus.cls === 'vdi' || focus.cls === 'vbd') {
    const storage = (Array.isArray(srs) ? srs : []).find((entry) =>
      recordMatchesRouteFocus(entry, focus, ['ref', 'uuid', 'name_label'])
    ) || null;
    return storage ? { type: 'storage', entity: storage } : null;
  }
  if (focus.kind === 'vm' || focus.cls === 'vm') {
    const vm = (Array.isArray(vms) ? vms : []).find((entry) =>
      recordMatchesRouteFocus(entry, focus, ['ref', 'uuid', 'name_label'])
    ) || null;
    return vm ? { type: 'vm', entity: vm } : null;
  }
  return null;
}

function getCapacityMetricSeries(metricName = '', metrics = []) {
  return (Array.isArray(metrics) ? metrics : []).find((entry) => entry.metricName === metricName)?.points || [];
}

function buildCapacityMetricSeriesDescriptor(metricName = '', index = 0) {
  const normalized = String(metricName || '').trim().toLowerCase();
  if (normalized.includes('network_rx')) return { label: 'RX', color: 'rgba(95, 235, 185, 0.95)' };
  if (normalized.includes('network_tx')) return { label: 'TX', color: 'rgba(91, 192, 255, 0.95)' };
  if (normalized.includes('disk_read')) return { label: 'Read', color: 'rgba(255, 186, 73, 0.95)' };
  if (normalized.includes('disk_write')) return { label: 'Write', color: 'rgba(255, 111, 145, 0.95)' };

  const palette = [
    'rgba(95, 235, 185, 0.95)',
    'rgba(91, 192, 255, 0.95)',
    'rgba(255, 186, 73, 0.95)',
    'rgba(255, 111, 145, 0.95)',
  ];
  return {
    label: normalized || `series-${index + 1}`,
    color: palette[index % palette.length],
  };
}

function combineCapacityMetricSeries(metricNames = [], metrics = []) {
  return (Array.isArray(metricNames) ? metricNames : [])
    .map((metricName, index) => {
      const points = getCapacityMetricSeries(metricName, metrics);
      if (!points.length) return null;
      const descriptor = buildCapacityMetricSeriesDescriptor(metricName, index);
      return {
        key: metricName,
        label: descriptor.label,
        color: descriptor.color,
        points,
      };
    })
    .filter(Boolean);
}

function getCapacityHistoryStatus(series = [], thresholds = {}) {
  const points = Array.isArray(series) ? series : [];
  const latest = Number(points[points.length - 1]?.value || 0);
  if (thresholds.critical !== undefined && latest >= thresholds.critical) return 'critical';
  if (thresholds.warning !== undefined && latest >= thresholds.warning) return 'warning';
  return 'success';
}

function getCapacityScopedEntityKey(record = {}, ref = '') {
  const targetKey = String(record?.scopeTargetKey || '').trim();
  const entityRef = String(ref || record?.entityRef || record?.ref || '').trim();
  return targetKey ? `${targetKey}::${entityRef}` : entityRef;
}

function buildCapacityBaselineMaps(baseline = {}) {
  return {
    hostsByRef: Object.fromEntries((baseline?.hosts || []).map((entry) => [getCapacityScopedEntityKey(entry), entry])),
    vmsByRef: Object.fromEntries((baseline?.vms || []).map((entry) => [getCapacityScopedEntityKey(entry), entry])),
    storageByRef: Object.fromEntries((baseline?.storage || []).map((entry) => [getCapacityScopedEntityKey(entry), entry])),
  };
}

function buildCapacityHostRecords(hostRecords = [], metricsByRef = {}, baselineHostsByRef = {}) {
  return (Array.isArray(hostRecords) ? hostRecords : []).map((host) => {
    const entityKey = getCapacityScopedEntityKey(host);
    const metrics = metricsByRef[entityKey] || {};
    const baseline = baselineHostsByRef[entityKey] || {};
    const memoryTotal = Number(metrics.memory_total || 0);
    const memoryFree = Number(metrics.memory_free || 0);
    const memoryUsed = Math.max(0, memoryTotal - memoryFree);

    return {
      ...host,
      scopeEntityKey: entityKey,
      live: Boolean(metrics.live),
      memoryTotal,
      memoryFree,
      memoryUsed,
      memoryUsagePercent: percentValue(memoryUsed, memoryTotal),
      cpuUsagePercentLatest: Number(baseline.cpu_usage_percent || 0),
      latestTelemetryTs: Number(baseline.ts || 0),
      residentVmCount: Array.isArray(host.resident_VMs) ? host.resident_VMs.length : 0,
    };
  });
}

function buildCapacityStorageRecords(srRecords = [], baselineStorageByRef = {}) {
  return (Array.isArray(srRecords) ? srRecords : []).map((sr) => {
    const entityKey = getCapacityScopedEntityKey(sr);
    const baseline = baselineStorageByRef[entityKey] || {};
    const physical = Number(sr.physical_size || 0);
    const allocation = Number(sr.virtual_allocation || 0);
    const freeBytes = Math.max(0, physical - allocation);

    return {
      ...sr,
      scopeEntityKey: entityKey,
      freeBytes,
      utilizationPercent: percentValue(allocation, physical),
      latestUtilizationPercent: Number(baseline.utilization_percent || 0),
      latestTelemetryTs: Number(baseline.ts || 0),
    };
  });
}

function buildCapacityVmRecords(vmRecords = [], baselineVmsByRef = {}) {
  return (Array.isArray(vmRecords) ? vmRecords : []).map((vm) => {
    const entityKey = getCapacityScopedEntityKey(vm);
    const baseline = baselineVmsByRef[entityKey] || {};
    return {
      ...vm,
      scopeEntityKey: entityKey,
      memoryActualBytesLatest: Number(baseline.memory_actual_bytes || 0),
      memoryUsagePercentLatest: Number(baseline.memory_usage_percent || 0),
      cpuUsagePercentLatest: Number(baseline.cpu_usage_percent || 0),
      vcpuCountLatest: Number(baseline.vcpu_count || 0),
      latestTelemetryTs: Number(baseline.ts || 0),
    };
  });
}
