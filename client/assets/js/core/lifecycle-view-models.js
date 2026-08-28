function inferLifecyclePlanDefaults(host, relatedTasks = [], relatedMessages = []) {
  if (!host?.enabled) {
    return {
      baselineStatus: 'unknown',
      targetStage: 'maintenance',
      nextAction: 'validate',
    };
  }

  if ((Array.isArray(relatedMessages) ? relatedMessages : []).some((message) => getMessageSeverity(message) === 'critical')) {
    return {
      baselineStatus: 'drifted',
      targetStage: 'remediate',
      nextAction: 'patch',
    };
  }

  if ((Array.isArray(relatedTasks) ? relatedTasks : []).some((task) => ['pending', 'queued'].includes((task.status || '').toLowerCase()))) {
    return {
      baselineStatus: 'unknown',
      targetStage: 'review',
      nextAction: 'validate',
    };
  }

  const lifecycleText = `${host?.other_config?.lifecycle || ''} ${(host?.tags || []).join(' ')}`.toLowerCase();
  if (/(patched|compliant|managed|current)/.test(lifecycleText)) {
    return {
      baselineStatus: 'compliant',
      targetStage: 'aligned',
      nextAction: 'none',
    };
  }

  return {
    baselineStatus: 'unknown',
    targetStage: 'review',
    nextAction: 'scan',
  };
}

function normalizeLifecycleSelectionRefs(values = []) {
  return Array.isArray(values) ? values.filter(Boolean) : [];
}

function resolveLifecycleSelectionMaintenanceState(host) {
  if (!host) return false;
  if (host.maintenance_mode === true) return true;
  return String(host?.other_config?.maintenance_mode || '').toLowerCase() === 'true';
}

function filterSelectedLifecycleRows(hostLifecycleRows = [], selectedRefs = []) {
  const selected = new Set(normalizeLifecycleSelectionRefs(selectedRefs));
  return (Array.isArray(hostLifecycleRows) ? hostLifecycleRows : []).filter((row) => selected.has(row.ref));
}

function buildLifecycleSelectionProfile(hostLifecycleRows = [], selectedRefs = []) {
  const rows = filterSelectedLifecycleRows(hostLifecycleRows, selectedRefs);

  if (!rows.length) {
    return {
      rows,
      plannedRows: [],
      maintenanceReadyRows: [],
      maintenanceActiveRows: [],
      summary: 'No lifecycle targets selected.',
    };
  }

  const plannedRows = rows.filter((row) => Boolean(row.lifecyclePlan));
  const maintenanceReadyRows = rows.filter((row) =>
    row.lifecyclePlan?.targetStage === 'maintenance' && !resolveLifecycleSelectionMaintenanceState(row)
  );
  const maintenanceActiveRows = rows.filter((row) => resolveLifecycleSelectionMaintenanceState(row));

  const parts = [];
  if (plannedRows.length) parts.push(`${plannedRows.length} saved plan${plannedRows.length === 1 ? '' : 's'}`);
  if (maintenanceReadyRows.length) parts.push(`${maintenanceReadyRows.length} ready for maintenance`);
  if (maintenanceActiveRows.length) parts.push(`${maintenanceActiveRows.length} already in maintenance`);

  return {
    rows,
    plannedRows,
    maintenanceReadyRows,
    maintenanceActiveRows,
    summary: parts.join(' · ') || 'Selected lifecycle targets are ready for review.',
  };
}

function buildHostLifecycleRowModel({
  host = null,
  lifecycleTasks = [],
  lifecycleAlerts = [],
  planMap = {},
  hostMatchesTask = () => false,
  hostMatchesMessage = () => false,
  formatStageLabel = (value) => value,
} = {}) {
  if (!host) return null;

  const relatedTasks = (Array.isArray(lifecycleTasks) ? lifecycleTasks : []).filter((task) => hostMatchesTask(host, task));
  const relatedMessages = (Array.isArray(lifecycleAlerts) ? lifecycleAlerts : []).filter((message) => hostMatchesMessage(host, message));
  const lifecycleText = `${host?.other_config?.lifecycle || ''} ${(host.tags || []).join(' ')}`.toLowerCase();
  const savedPlan = planMap[host.ref] || null;
  const inferredPlan = inferLifecyclePlanDefaults(host, relatedTasks, relatedMessages);
  const maintenanceWindow = savedPlan?.maintenanceWindow || host?.other_config?.maintenance_window || 'No window defined';
  let lifecycleStatus = 'warning';
  let lifecycleHint = 'review';
  let summary = 'Baseline review recommended.';
  let recommendation = 'Validate patch level, maintenance readiness, and any desired-state drift before the next maintenance cycle.';

  if (!host.enabled || lifecycleText.includes('maintenance') || (host.tags || []).some((tag) => String(tag).toLowerCase().includes('maintenance'))) {
    lifecycleStatus = 'disabled';
    lifecycleHint = 'maintenance';
    summary = 'Host is in maintenance or pre-maintenance posture.';
    recommendation = 'Confirm evacuation, snapshot coverage, and patch window details before taking further action.';
  } else if (relatedTasks.some((task) => ['pending', 'queued'].includes((task.status || '').toLowerCase()))) {
    lifecycleStatus = 'pending';
    lifecycleHint = 'scanning';
    summary = 'Lifecycle work is currently in progress.';
    recommendation = 'Allow the active compliance or maintenance task to complete, then reassess drift and baseline health.';
  } else if (relatedMessages.some((message) => getMessageSeverity(message) === 'critical')) {
    lifecycleStatus = 'critical';
    lifecycleHint = 'risk';
    summary = 'Critical lifecycle or maintenance signal detected.';
    recommendation = 'Investigate the related alert before scheduling further remediation so lifecycle work does not amplify an existing fault.';
  } else if (/(patched|compliant|managed|current)/.test(lifecycleText)) {
    lifecycleStatus = 'success';
    lifecycleHint = 'aligned';
    summary = 'Host appears aligned with the expected lifecycle posture.';
    recommendation = 'Keep this host in the compliant set and use it as a preferred target when draining or rebalancing adjacent nodes.';
  } else if (relatedMessages.length) {
    lifecycleStatus = 'warning';
    lifecycleHint = 'attention';
    summary = 'Recent lifecycle-adjacent alerts suggest review is needed.';
    recommendation = 'Inspect the alert context and confirm whether a patch, reboot, or maintenance action should be scheduled.';
  }

  const baselineStatus = savedPlan?.baselineStatus || inferredPlan.baselineStatus;
  const targetStage = savedPlan?.targetStage || inferredPlan.targetStage;
  const nextAction = savedPlan?.nextAction || inferredPlan.nextAction;

  if (savedPlan?.targetStage === 'maintenance' && !['critical', 'disabled'].includes(lifecycleStatus)) {
    lifecycleStatus = 'pending';
    lifecycleHint = 'maintenance';
    summary = 'Maintenance work is scheduled for this host.';
    recommendation = savedPlan.notes || 'Verify evacuation, patch bundles, and communication windows before starting maintenance.';
  } else if (savedPlan?.targetStage === 'remediate' && lifecycleStatus === 'success') {
    lifecycleStatus = 'warning';
    lifecycleHint = 'attention';
    summary = 'A remediation plan exists even though the host currently looks healthy.';
    recommendation = savedPlan.notes || 'Reconfirm whether this remediation is still needed before execution.';
  } else if (savedPlan?.targetStage === 'aligned' && savedPlan?.baselineStatus === 'compliant' && !relatedMessages.length && host.enabled) {
    lifecycleStatus = 'success';
    lifecycleHint = 'aligned';
    summary = 'Saved lifecycle plan indicates this host is aligned.';
    recommendation = savedPlan.notes || 'Use this host as an aligned reference point for the rest of the maintenance ring.';
  } else if (savedPlan?.targetStage === 'review' && lifecycleStatus === 'success') {
    lifecycleStatus = 'warning';
    lifecycleHint = 'review';
    summary = 'Lifecycle review is still scheduled for this host.';
    recommendation = savedPlan.notes || 'Validate whether the review can be closed or should progress to remediation.';
  }

  const planLabel = savedPlan
    ? `${formatStageLabel(savedPlan.targetStage)} · ${savedPlan.owner || 'Unassigned'} · ${savedPlan.patchGroup || 'No patch group'}`
    : 'No saved lifecycle plan';

  return {
    ...host,
    lifecycleStatus,
    lifecycleHint,
    maintenanceWindow,
    baselineStatus,
    targetStage,
    nextAction,
    summary,
    recommendation,
    relatedTasks,
    relatedMessages,
    lastTaskLabel: relatedTasks[0]?.name_label || 'No recent lifecycle task',
    lastAlertLabel: relatedMessages[0] ? getMessageHeadline(relatedMessages[0]) : 'No recent lifecycle alert',
    lifecyclePlan: savedPlan,
    planLabel,
  };
}

function buildLifecycleWorkspaceModel({
  hosts = [],
  lifecycleTasks = [],
  lifecycleAutomationTasks = [],
  lifecycleAlerts = [],
  lifecyclePlans = [],
  taskSlaMeta = () => ({ label: 'On Track', tone: 'success', isOverdue: false }),
  taskEvidenceChecklist = () => [],
  taskCompletionCriteria = () => [],
  hostMatchesTask = () => false,
  hostMatchesMessage = () => false,
  formatStageLabel = (value) => value,
} = {}) {
  const planMap = (Array.isArray(lifecyclePlans) ? lifecyclePlans : []).reduce((accumulator, plan) => {
    accumulator[plan.hostRef] = plan;
    return accumulator;
  }, {});
  const priority = { critical: 0, pending: 1, warning: 2, disabled: 3, success: 4, notice: 5, info: 6 };
  const hostLifecycleRows = (Array.isArray(hosts) ? hosts : [])
    .map((host) => buildHostLifecycleRowModel({
      host,
      lifecycleTasks,
      lifecycleAlerts,
      planMap,
      hostMatchesTask,
      hostMatchesMessage,
      formatStageLabel,
    }))
    .filter(Boolean)
    .sort((left, right) => {
      const statusDelta = (priority[left.lifecycleStatus] ?? 99) - (priority[right.lifecycleStatus] ?? 99);
      if (statusDelta !== 0) return statusDelta;
      return String(left.name_label || '').localeCompare(String(right.name_label || ''));
    });

  const compliantHosts = hostLifecycleRows.filter((row) => row.lifecycleStatus === 'success');
  const maintenanceHosts = hostLifecycleRows.filter((row) => row.lifecycleStatus === 'disabled' || row.lifecycleHint === 'maintenance');
  const actionHosts = hostLifecycleRows.filter((row) => ['critical', 'warning', 'pending'].includes(row.lifecycleStatus));
  const plannedHosts = hostLifecycleRows.filter((row) => Boolean(row.lifecyclePlan));
  const driftedPlanHosts = plannedHosts.filter((row) => row.baselineStatus === 'drifted');
  const rebootQueue = plannedHosts.filter((row) => row.lifecyclePlan?.rebootRequired);
  const evacuationQueue = plannedHosts.filter((row) => row.lifecyclePlan?.evacuationRequired);
  const upcomingPlanRows = [...plannedHosts].sort((left, right) => {
    const leftDue = left.lifecyclePlan?.dueDate ? new Date(left.lifecyclePlan.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
    const rightDue = right.lifecyclePlan?.dueDate ? new Date(right.lifecyclePlan.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
    if (leftDue !== rightDue) return leftDue - rightDue;
    return new Date(right.lifecyclePlan?.updatedAt || 0) - new Date(left.lifecyclePlan?.updatedAt || 0);
  });

  const lifecycleCards = [
    {
      key: 'aligned',
      label: 'Baseline Aligned',
      value: `${compliantHosts.length}/${(Array.isArray(hosts) ? hosts : []).length}`,
      detail: compliantHosts.length ? `${compliantHosts[0].name_label || 'Host'} is the leading compliant node` : 'No hosts are currently marked aligned',
      icon: 'mdi-shield-check-outline',
      valueClass: compliantHosts.length ? 'text-green' : 'text-amber',
    },
    {
      key: 'review',
      label: 'Needs Review',
      value: String(actionHosts.length),
      detail: actionHosts.length ? `${actionHosts[0].name_label || 'Host'} is highest priority` : 'No lifecycle review backlog detected',
      icon: 'mdi-clipboard-alert-outline',
      valueClass: actionHosts.length ? 'text-amber' : 'text-green',
    },
    {
      key: 'planned',
      label: 'Planned Waves',
      value: String(plannedHosts.length),
      detail: plannedHosts.length ? `${plannedHosts[0].name_label || 'Host'} is included in the planner queue` : 'No saved lifecycle plans yet',
      icon: 'mdi-calendar-clock-outline',
      valueClass: plannedHosts.length ? 'text-cyan' : 'text-green',
    },
    {
      key: 'jobs',
      label: 'Reboot Queue',
      value: String(rebootQueue.length),
      detail: rebootQueue.length ? 'One or more hosts are expected to reboot during remediation' : 'No reboots are currently staged',
      icon: 'mdi-restart',
      valueClass: rebootQueue.length ? 'text-red' : 'text-green',
    },
  ];

  const recommendations = [];
  const overdueAutomationTasks = (Array.isArray(lifecycleAutomationTasks) ? lifecycleAutomationTasks : []).filter((task) => taskSlaMeta(task).isOverdue);

  if (driftedPlanHosts.length) {
    const host = driftedPlanHosts[0];
    recommendations.push({
      title: 'Prioritize drifted baselines',
      detail: `${host.name_label || 'Host'} is marked drifted and already has a saved remediation plan. Confirm the patch wave is still sequenced correctly.`,
      status: 'warning',
    });
  }

  if (rebootQueue.length) {
    const host = rebootQueue[0];
    recommendations.push({
      title: 'Validate reboot sequencing',
      detail: `${host.name_label || 'Host'} is marked for reboot. Make sure maintenance communications, drain targets, and rollback notes are ready first.`,
      status: 'pending',
    });
  }

  if (evacuationQueue.length) {
    const host = evacuationQueue[0];
    recommendations.push({
      title: 'Check evacuation targets',
      detail: `${host.name_label || 'Host'} requires workload evacuation before remediation. Validate host capacity and guest placement before the window starts.`,
      status: 'warning',
    });
  }

  if ((Array.isArray(lifecycleTasks) ? lifecycleTasks : []).length) {
    const task = lifecycleTasks[0];
    recommendations.push({
      title: 'Watch active lifecycle jobs',
      detail: `${task.name_label || 'Task'} should be monitored through completion so its result can update the compliance queue.`,
      status: task.status || 'pending',
    });
  }

  if ((Array.isArray(lifecycleAutomationTasks) ? lifecycleAutomationTasks : []).length) {
    const task = lifecycleAutomationTasks[0];
    recommendations.push({
      title: 'Staged remediation brief ready',
      detail: `${task.name_label || 'A remediation task'} already carries ${taskEvidenceChecklist(task).length} evidence checks and ${taskCompletionCriteria(task).length} completion criteria into the lifecycle queue, with ${taskSlaMeta(task).label.toLowerCase()} timing.`,
      status: taskSlaMeta(task).tone,
    });
  }

  if (overdueAutomationTasks.length) {
    const task = overdueAutomationTasks[0];
    recommendations.push({
      title: 'Escalate overdue lifecycle follow-through',
      detail: `${task.name_label || 'A remediation task'} is ${taskSlaMeta(task).label.toLowerCase()} and should be reconciled before the next maintenance wave starts.`,
      status: 'critical',
    });
  }

  if (!recommendations.length) {
    recommendations.push({
      title: 'Lifecycle posture healthy',
      detail: 'No obvious lifecycle drift was inferred from the current hosts, messages, tasks, and planner state.',
      status: 'success',
    });
  }

  const coverageItems = [
    {
      label: 'Hosts With Saved Plan',
      detail: `${plannedHosts.length} of ${(Array.isArray(hosts) ? hosts : []).length} hosts are represented in the lifecycle planner.`,
      value: `${plannedHosts.length}/${(Array.isArray(hosts) ? hosts : []).length}`,
      badgeClass: plannedHosts.length ? 'badge-info' : 'badge-halted',
    },
    {
      label: 'Maintenance-Staged Hosts',
      detail: upcomingPlanRows.length ? `${upcomingPlanRows[0].name_label || 'Host'} is the next scheduled lifecycle target.` : 'No maintenance waves are scheduled yet.',
      value: String(upcomingPlanRows.filter((row) => row.targetStage === 'maintenance').length),
      badgeClass: upcomingPlanRows.filter((row) => row.targetStage === 'maintenance').length ? 'badge-running' : 'badge-info',
    },
    {
      label: 'Planner Owners Assigned',
      detail: `${plannedHosts.filter((row) => row.lifecyclePlan?.owner).length} plans have a named owner.`,
      value: String(plannedHosts.filter((row) => row.lifecyclePlan?.owner).length),
      badgeClass: plannedHosts.filter((row) => row.lifecyclePlan?.owner).length ? 'badge-running' : 'badge-halted',
    },
  ];

  return {
    planMap,
    hostLifecycleRows,
    compliantHosts,
    maintenanceHosts,
    actionHosts,
    plannedHosts,
    driftedPlanHosts,
    rebootQueue,
    evacuationQueue,
    upcomingPlanRows,
    lifecycleCards,
    recommendations,
    coverageItems,
  };
}

function buildLifecyclePlannerModel({
  plannerHost = null,
  plannerSeed = null,
  plannerLaunchMode = 'plan',
  plannerSourceTask = null,
  relatedPools = [],
  relatedNetworks = [],
} = {}) {
  const initialValue = !plannerHost
    ? null
    : !plannerSeed
      ? plannerHost.lifecyclePlan
      : {
          ...(plannerHost.lifecyclePlan || {}),
          ...plannerSeed,
        };
  const hostPool = resolveHostPool(plannerHost, relatedPools);
  const hostNetworkRecords = buildSelectedHostNetworkRecords(plannerHost, relatedNetworks, hostPool);
  const maintenanceNetworkOptions = buildHostMaintenanceNetworkOptions(hostPool, hostNetworkRecords, relatedNetworks);

  return {
    initialValue,
    windowTitle: plannerLaunchMode === 'maintenance' ? 'Maintenance Handoff' : 'Lifecycle Plan',
    targetTitle: plannerLaunchMode === 'maintenance' ? 'Maintenance Target' : 'Planning Target',
    submitLabel: plannerLaunchMode === 'maintenance' ? 'Save Lifecycle Plan Before Maintenance' : 'Save Lifecycle Plan',
    hostPool,
    hostMaintenanceMode: resolveHostMaintenanceState(plannerHost),
    maintenanceNetworkOptions,
    maintenanceDraft: {
      ...buildHostMaintenanceActionDraft(hostPool, maintenanceNetworkOptions),
      evacuateRunningVms: initialValue?.evacuationRequired !== false,
    },
    canExecuteMaintenance: Boolean(plannerHost && (plannerHost.lifecyclePlan || plannerSeed || plannerSourceTask)),
  };
}

if (typeof module !== 'undefined') {
  module.exports = {
    filterSelectedLifecycleRows,
    buildLifecycleSelectionProfile,
    resolveLifecycleSelectionMaintenanceState,
  };
}
