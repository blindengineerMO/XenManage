function parseDateValue(value) {
  const date = new Date(value || 0);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function sortByRecent(items, getValue) {
  return [...items].sort((left, right) => parseDateValue(getValue(right)) - parseDateValue(getValue(left)));
}

function getTaskName(task) {
  return `${task?.name_label || ''} ${task?.name_description || ''}`.toLowerCase();
}

function getMessageText(message) {
  return `${message?.name || ''} ${message?.body || ''} ${message?.cls || ''}`.toLowerCase();
}

function isResilienceTask(task) {
  return /(snapshot|backup|protect|replicat|failover|recover|restore|drill|migrat|evacuat)/.test(getTaskName(task));
}

function isResilienceMessage(message) {
  return /(failover|backup|recovery|restore|snapshot|replicat|protect|ha|disaster|evacuat|latency|storage)/.test(getMessageText(message));
}

function getSeverity(value) {
  const haystack = String(value || '').toLowerCase();

  if (/(critical|fatal|failed|failure|panic|error|offline|down|corrupt|timeout|lag|missed)/.test(haystack)) {
    return 'critical';
  }

  if (/(warn|warning|degraded|threshold|latency|retry|paused|stopped|maintenance|high|review)/.test(haystack)) {
    return 'warning';
  }

  if (/(resolved|healthy|restored|recovered|success|info|notice|complete)/.test(haystack)) {
    return 'info';
  }

  return 'notice';
}

function taskMatchesEntity(task, entity) {
  const haystack = `${task?.name_label || ''} ${task?.name_description || ''} ${task?.resident_on || ''}`.toLowerCase();
  const needles = [entity.ref, entity.uuid, entity.name_label, entity.name_description]
    .map((value) => String(value || '').toLowerCase().trim())
    .filter(Boolean);

  return needles.some((needle) => haystack.includes(needle));
}

function messageMatchesEntity(message, entity) {
  const haystack = `${message?.name || ''} ${message?.body || ''} ${message?.obj_uuid || ''}`.toLowerCase();
  const needles = [entity.uuid, entity.name_label, entity.name_description]
    .map((value) => String(value || '').toLowerCase().trim())
    .filter(Boolean);

  return needles.some((needle) => haystack.includes(needle));
}

function buildPolicyTier(vm) {
  const tags = (vm.tags || []).map((tag) => String(tag).toLowerCase());
  if (tags.some((tag) => ['prod', 'production', 'critical'].includes(tag))) return 'Tier-1';
  if (tags.some((tag) => ['edge', 'branch'].includes(tag))) return 'Edge';
  if (tags.some((tag) => ['staging', 'dev', 'test'].includes(tag))) return 'Non-Prod';
  return 'Standard';
}

function getPoolRefForVm(vm, hostsByRef) {
  if (vm.pool) return vm.pool;
  const residentHost = hostsByRef[vm.resident_on] || hostsByRef[vm.affinity];
  return residentHost?.pool || '';
}

function getRunbookMap(runbooks = []) {
  return Object.fromEntries((runbooks || []).map((runbook) => [runbook.poolRef, runbook]));
}

function getDrillsByPool(drills = []) {
  return drills.reduce((acc, drill) => {
    if (!drill?.poolRef) return acc;
    if (!acc[drill.poolRef]) {
      acc[drill.poolRef] = [];
    }
    acc[drill.poolRef].push(drill);
    return acc;
  }, {});
}

function getRecoveryTier(vm, runbook) {
  const explicit = String(vm?.other_config?.recovery_tier || '').trim();
  if (explicit) return explicit;
  return runbook?.recoveryTier || buildPolicyTier(vm);
}

function getRestartPriority(vm, runbook) {
  const explicit = String(vm?.other_config?.ha_restart_priority || '').trim();
  if (explicit) return explicit;
  if (runbook?.restartPriority) return runbook.restartPriority;

  const tier = buildPolicyTier(vm);
  if (tier === 'Tier-1') return 'high';
  if (tier === 'Edge') return 'medium';
  if (tier === 'Non-Prod') return 'low';
  return 'best-effort';
}

function getBackupWindowHours(vm, runbook) {
  const explicit = Number(vm?.other_config?.backup_window_hours || 0);
  if (explicit > 0) return explicit;
  if (Number(runbook?.backupWindowHours || 0) > 0) return Number(runbook.backupWindowHours);
  return buildPolicyTier(vm) === 'Tier-1' ? 12 : 24;
}

function getBackupAgeHours(timestamp) {
  const value = parseDateValue(timestamp);
  if (!value) return null;
  const diff = Date.now() - value;
  if (diff < 0) return 0;
  return Math.round((diff / 3600000) * 10) / 10;
}

function evaluateRestorePointStatus(ageHours, backupWindowHours, explicitStatus = '') {
  const normalized = String(explicitStatus || '').toLowerCase();

  if (normalized === 'missing') return 'missing';
  if (normalized === 'stale') return 'stale';

  if (ageHours === null) {
    return normalized === 'review' ? 'review' : 'missing';
  }

  if (normalized === 'review') return 'review';
  if (ageHours <= backupWindowHours) return 'current';
  if (ageHours <= backupWindowHours * 1.5) return 'review';
  return 'stale';
}

function getRestorePointTone(status) {
  if (status === 'missing' || status === 'stale') return 'critical';
  if (status === 'review') return 'warning';
  return 'success';
}

function getRestorePointLabel(status, ageHours, backupWindowHours) {
  if (status === 'current') return `Within ${backupWindowHours}h target`;
  if (status === 'review') return ageHours === null ? 'Verification needed' : `Aged ${ageHours}h`;
  if (status === 'stale') return ageHours === null ? 'Stale or unknown' : `Stale at ${ageHours}h`;
  return 'Missing restore point';
}

function buildDefaultRunbookSteps(pool, poolHosts = []) {
  return [
    `Confirm ${pool?.name_label || 'the pool'} backup currency and replication health.`,
    `Evacuate impacted workloads to ${poolHosts[0]?.name_label || 'an alternate host'} before failover work.`,
    'Validate network reachability, storage attach paths, and boot dependencies.',
    'Execute a restore or failover drill and capture operator findings before closure.',
  ];
}

function getLatestDrill(drills = []) {
  return sortByRecent(drills, (drill) => drill.executedAt)[0] || null;
}

function getDrillFreshnessState(drill) {
  if (!drill?.executedAt) return 'warning';
  const daysSinceDrill = (Date.now() - parseDateValue(drill.executedAt)) / 86400000;
  if (daysSinceDrill > 45) return 'warning';
  return drill.status || 'success';
}

function buildProtectionPolicies(vms, hostsByRef, poolsByRef, runbookByPool, drillsByPool, tasks, messages) {
  return vms.map((vm) => {
    const poolRef = getPoolRefForVm(vm, hostsByRef);
    const pool = poolsByRef[poolRef] || null;
    const runbook = runbookByPool[poolRef] || null;
    const relatedDrills = drillsByPool[poolRef] || [];
    const latestDrill = getLatestDrill(relatedDrills);
    const relatedTasks = sortByRecent(tasks.filter((task) => taskMatchesEntity(task, vm)), (task) => task.finished || task.created);
    const relatedMessages = sortByRecent(messages.filter((message) => messageMatchesEntity(message, vm)), (message) => message.timestamp);
    const lastSuccessTask = relatedTasks.find((task) => String(task.status || '').toLowerCase() === 'success');
    const criticalMessage = relatedMessages.find((message) => getSeverity(`${message.name} ${message.body}`) === 'critical');
    const tier = buildPolicyTier(vm);
    const backupWindowHours = getBackupWindowHours(vm, runbook);
    const backupAgeHours = getBackupAgeHours(lastSuccessTask?.finished || lastSuccessTask?.created || '');
    const restorePointStatus = evaluateRestorePointStatus(
      backupAgeHours,
      backupWindowHours,
      vm?.other_config?.restore_point_status || runbook?.restorePointStatus || ''
    );
    const restorePointTone = getRestorePointTone(restorePointStatus);
    const recoveryTier = getRecoveryTier(vm, runbook);
    const haRestartPriority = getRestartPriority(vm, runbook);

    let status = 'info';
    let recommendation = 'Baseline protection policy should be reviewed for this workload.';

    if (criticalMessage || restorePointTone === 'critical') {
      status = 'critical';
      recommendation = 'Investigate the latest protection alert or restore-point drift before relying on this workload for failover or restore operations.';
    } else if (lastSuccessTask && restorePointTone === 'success') {
      status = 'success';
      recommendation = 'Recent successful protection activity was detected. Validate restore drills during the next maintenance cycle.';
    } else if (restorePointTone === 'warning') {
      status = 'warning';
      recommendation = 'Protection looks present but the restore point is aging toward the runbook threshold. Re-verify backup freshness soon.';
    } else if (tier === 'Tier-1' && String(vm.power_state || '').toLowerCase() === 'running') {
      status = 'warning';
      recommendation = 'This production workload appears active without a recent resilience task in view. Confirm backup and snapshot coverage.';
    } else if (String(vm.power_state || '').toLowerCase() === 'suspended') {
      status = 'warning';
      recommendation = 'Suspended workloads should still be checked for snapshot and restore currency before planned maintenance.';
    }

    return {
      ref: vm.ref,
      poolRef,
      poolName: pool?.name_label || 'Unassigned Pool',
      name_label: vm.name_label || 'Virtual Machine',
      power_state: vm.power_state || 'Unknown',
      policy: tier,
      recoveryTier,
      status,
      hasRecentProtection: Boolean(lastSuccessTask),
      lastProtectedAt: lastSuccessTask?.finished || lastSuccessTask?.created || '',
      backupAgeHours,
      backupWindowHours,
      restorePointStatus,
      restorePointLabel: getRestorePointLabel(restorePointStatus, backupAgeHours, backupWindowHours),
      haRestartPriority,
      lastTaskLabel: lastSuccessTask?.name_label || relatedTasks[0]?.name_label || 'No recent protection task',
      lastAlertLabel: criticalMessage?.name || relatedMessages[0]?.name || 'No resilience alerts',
      recommendation,
      tags: vm.tags || [],
      uuid: vm.uuid || '',
      lastDrillAt: latestDrill?.executedAt || '',
      lastDrillStatus: latestDrill?.status || '',
      runbookOwner: runbook?.owner || '',
    };
  });
}

function buildHostPlans(hosts, poolsByRef, runbookByPool, drillsByPool, tasks, messages) {
  const enabledHosts = hosts.filter((host) => host.enabled);

  return hosts.map((host) => {
    const pool = poolsByRef[host.pool] || null;
    const runbook = runbookByPool[host.pool] || null;
    const latestDrill = getLatestDrill(drillsByPool[host.pool] || []);
    const relatedTasks = sortByRecent(tasks.filter((task) => taskMatchesEntity(task, host)), (task) => task.finished || task.created);
    const relatedMessages = sortByRecent(messages.filter((message) => messageMatchesEntity(message, host)), (message) => message.timestamp);
    const evacuationTarget = enabledHosts.find((candidate) => candidate.ref !== host.ref && candidate.pool === host.pool) || enabledHosts.find((candidate) => candidate.ref !== host.ref);
    const pendingTask = relatedTasks.find((task) => ['pending', 'queued'].includes(String(task.status || '').toLowerCase()));
    const criticalMessage = relatedMessages.find((message) => getSeverity(`${message.name} ${message.body}`) === 'critical');
    const maintenanceWindow = host?.other_config?.maintenance_window || runbook?.notes?.slice(0, 48) || 'No maintenance window';
    const haPolicy = String(host?.other_config?.ha_policy || runbook?.haPolicy || '').trim() || 'manual';

    let status = 'success';
    let summary = 'Failover posture looks healthy.';

    if (!host.enabled) {
      status = 'disabled';
      summary = 'Host is disabled or in maintenance posture.';
    } else if (criticalMessage) {
      status = 'critical';
      summary = 'Recent alerts indicate resilience risk on this host.';
    } else if (pendingTask) {
      status = 'pending';
      summary = 'Lifecycle or evacuation work is currently in progress.';
    } else if (!runbook) {
      status = 'warning';
      summary = 'No recovery runbook is attached to this host pool yet.';
    } else if (relatedMessages.length || getDrillFreshnessState(latestDrill) === 'warning') {
      status = 'warning';
      summary = 'Recent resilience-adjacent alerts or stale drill history should be reviewed.';
    }

    return {
      ref: host.ref,
      poolRef: host.pool || '',
      poolName: pool?.name_label || 'Standalone Host',
      name_label: host.name_label || host.hostname || 'Host',
      address: host.address || '',
      status,
      evacuationTarget: evacuationTarget ? (evacuationTarget.name_label || evacuationTarget.hostname || evacuationTarget.ref) : 'No alternate host available',
      standbyHostRef: runbook?.standbyHostRef || '',
      residentVmCount: Array.isArray(host.resident_VMs) ? host.resident_VMs.length : 0,
      recentTask: relatedTasks[0]?.name_label || 'No recent host resilience task',
      recentAlert: criticalMessage?.name || relatedMessages[0]?.name || 'No recent host alert',
      summary,
      haPolicy,
      restartPriority: runbook?.restartPriority || 'medium',
      lastDrillAt: latestDrill?.executedAt || '',
      lastDrillStatus: latestDrill?.status || '',
      maintenanceWindow,
      other_config: host.other_config || {},
      uuid: host.uuid || '',
    };
  });
}

function buildRecoveryPlans(pools, hosts, protectionPolicies, runbooks, drillsByPool, hostsByRef) {
  return pools.map((pool) => {
    const poolRunbook = runbooks.find((runbook) => runbook.poolRef === pool.ref) || null;
    const poolDrills = sortByRecent(drillsByPool[pool.ref] || [], (drill) => drill.executedAt);
    const latestDrill = poolDrills[0] || null;
    const poolHosts = hosts.filter((host) => String(host.pool || '').toLowerCase() === String(pool.ref || '').toLowerCase());
    const enabledHostCount = poolHosts.filter((host) => host.enabled).length;
    const poolPolicies = protectionPolicies.filter((policy) => policy.poolRef === pool.ref);
    const protectedVmCount = poolPolicies.filter((policy) => policy.hasRecentProtection).length;
    const atRiskVmCount = poolPolicies.filter((policy) => ['critical', 'warning'].includes(policy.status)).length;
    const staleRestorePointCount = poolPolicies.filter((policy) => ['stale', 'missing'].includes(policy.restorePointStatus)).length;
    const reviewRestorePointCount = poolPolicies.filter((policy) => policy.restorePointStatus === 'review').length;
    const hasRunbook = Boolean(poolRunbook);
    const standbyHostLabel = hostsByRef[poolRunbook?.standbyHostRef]?.name_label || hostsByRef[poolRunbook?.standbyHostRef]?.hostname || '';
    const drillState = getDrillFreshnessState(latestDrill);

    let status = 'success';
    let nextAction = 'Validate periodic restore drills and maintain a recent evacuation target list.';

    if (!hasRunbook) {
      status = 'warning';
      nextAction = 'Author a recovery runbook with failover order, standby host, and restore validation steps for this pool.';
    }

    if (enabledHostCount < 2 && status !== 'critical') {
      status = 'warning';
      nextAction = 'Add or re-enable additional failover capacity before relying on this pool for resilient recovery operations.';
    }

    if (staleRestorePointCount > 0 || atRiskVmCount > protectedVmCount) {
      status = 'critical';
      nextAction = 'Protection coverage appears thin relative to at-risk workloads. Prioritize backup verification and recovery testing.';
    } else if (reviewRestorePointCount > 0 || drillState === 'warning') {
      status = status === 'critical' ? status : 'warning';
      nextAction = latestDrill
        ? 'Recent drill history is aging or flagged. Schedule a restore verification and capture findings in the runbook.'
        : 'Log a restore or failover drill so operator readiness is visible for this pool.';
    }

    return {
      ref: pool.ref,
      name_label: pool.name_label || 'Pool',
      status,
      enabledHostCount,
      protectedVmCount,
      atRiskVmCount,
      staleRestorePointCount,
      reviewRestorePointCount,
      nextAction,
      hasRunbook,
      recoveryTier: poolRunbook?.recoveryTier || 'standard',
      haPolicy: poolRunbook?.haPolicy || 'manual',
      restartPriority: poolRunbook?.restartPriority || 'medium',
      backupWindowHours: Number(poolRunbook?.backupWindowHours || 24),
      rpoMinutes: Number(poolRunbook?.rpoMinutes || 60),
      rtoMinutes: Number(poolRunbook?.rtoMinutes || 120),
      restorePointStatus: staleRestorePointCount > 0 ? 'stale' : reviewRestorePointCount > 0 ? 'review' : 'current',
      owner: poolRunbook?.owner || '',
      standbyHostRef: poolRunbook?.standbyHostRef || '',
      standbyHostLabel,
      failoverNetworkRef: poolRunbook?.failoverNetworkRef || '',
      lastVerifiedAt: poolRunbook?.lastVerifiedAt || '',
      lastDrillAt: latestDrill?.executedAt || '',
      lastDrillStatus: latestDrill?.status || '',
      drillCount: poolDrills.length,
      runbookSteps: poolRunbook?.runbookSteps?.length ? poolRunbook.runbookSteps : buildDefaultRunbookSteps(pool, poolHosts),
      notes: poolRunbook?.notes || '',
      drills: poolDrills.slice(0, 5),
      uuid: pool.uuid || '',
    };
  });
}

function buildRecentEvents(tasks, messages, drills = []) {
  const taskEvents = tasks
    .filter(isResilienceTask)
    .map((task) => ({
      type: 'task',
      ref: task.ref,
      label: task.name_label || 'Task',
      status: task.status || 'info',
      timestamp: task.finished || task.created || '',
      detail: task.name_description || '',
    }));

  const messageEvents = messages
    .filter(isResilienceMessage)
    .map((message) => ({
      type: 'alert',
      ref: message.ref,
      label: message.name || 'Alert',
      status: getSeverity(`${message.name} ${message.body}`),
      timestamp: message.timestamp || '',
      detail: message.body || '',
    }));

  const drillEvents = drills.map((drill) => ({
    type: 'drill',
    ref: drill.id,
    label: `${drill.drillType || 'Recovery'} drill`,
    status: drill.status || 'info',
    timestamp: drill.executedAt || drill.createdAt || '',
    detail: drill.summary || drill.findings || '',
  }));

  return sortByRecent([...taskEvents, ...messageEvents, ...drillEvents], (event) => event.timestamp).slice(0, 14);
}

function buildResilienceOverview({ pools = [], hosts = [], vms = [], tasks = [], messages = [], runbooks = [], drills = [] }) {
  const hostsByRef = Object.fromEntries(hosts.map((host) => [host.ref, host]));
  const poolsByRef = Object.fromEntries(pools.map((pool) => [pool.ref, pool]));
  const runbookByPool = getRunbookMap(runbooks);
  const drillsByPool = getDrillsByPool(drills);
  const activeVms = vms.filter((vm) => !vm.is_a_template);
  const resilienceTasks = tasks.filter(isResilienceTask);
  const resilienceMessages = messages.filter(isResilienceMessage);
  const protectionPolicies = buildProtectionPolicies(
    activeVms,
    hostsByRef,
    poolsByRef,
    runbookByPool,
    drillsByPool,
    resilienceTasks,
    resilienceMessages
  );
  const hostPlans = buildHostPlans(hosts, poolsByRef, runbookByPool, drillsByPool, resilienceTasks, resilienceMessages);
  const recoveryPlans = buildRecoveryPlans(pools, hosts, protectionPolicies, runbooks, drillsByPool, hostsByRef);
  const recentEvents = buildRecentEvents(resilienceTasks, resilienceMessages, drills);

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      protectedVmCount: protectionPolicies.filter((policy) => policy.hasRecentProtection).length,
      atRiskVmCount: protectionPolicies.filter((policy) => ['critical', 'warning'].includes(policy.status)).length,
      maintenanceHostCount: hostPlans.filter((plan) => plan.status === 'disabled').length,
      recoveryPlanCount: recoveryPlans.length,
      recentEventCount: recentEvents.length,
      runbookCoverageCount: recoveryPlans.filter((plan) => plan.hasRunbook).length,
      staleRestorePointCount: protectionPolicies.filter((policy) => ['stale', 'missing'].includes(policy.restorePointStatus)).length,
      overdueDrillCount: recoveryPlans.filter((plan) => getDrillFreshnessState({ executedAt: plan.lastDrillAt, status: plan.lastDrillStatus }) === 'warning').length,
    },
    protectionPolicies,
    hostPlans,
    recoveryPlans,
    recentEvents,
    runbooks: sortByRecent(runbooks, (runbook) => runbook.updatedAt),
    drills: sortByRecent(drills, (drill) => drill.executedAt).slice(0, 20),
  };
}

module.exports = {
  buildResilienceOverview,
  isResilienceTask,
  isResilienceMessage,
};
