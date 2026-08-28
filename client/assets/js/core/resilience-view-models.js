function buildResilienceSummaryCards(summary = {}) {
  return [
    {
      key: 'protected',
      label: 'Protected Workloads',
      value: String(summary.protectedVmCount || 0),
      detail: 'Workloads with recent successful protection activity',
      icon: 'mdi-shield-check-outline',
      valueClass: (summary.protectedVmCount || 0) ? 'text-green' : '',
    },
    {
      key: 'risk',
      label: 'At-Risk Workloads',
      value: String(summary.atRiskVmCount || 0),
      detail: 'Workloads requiring protection review or follow-up',
      icon: 'mdi-alert-decagram-outline',
      valueClass: (summary.atRiskVmCount || 0) ? 'text-red' : 'text-green',
    },
    {
      key: 'runbooks',
      label: 'Runbook Coverage',
      value: `${summary.runbookCoverageCount || 0}/${summary.recoveryPlanCount || 0}`,
      detail: 'Pools with persisted recovery guidance and ownership',
      icon: 'mdi-book-open-page-variant-outline',
      valueClass: (summary.runbookCoverageCount || 0) < (summary.recoveryPlanCount || 0) ? 'text-amber' : 'text-green',
    },
    {
      key: 'restore',
      label: 'Restore Drift',
      value: String(summary.staleRestorePointCount || 0),
      detail: 'Workloads with stale or missing restore evidence',
      icon: 'mdi-database-alert-outline',
      valueClass: (summary.staleRestorePointCount || 0) ? 'text-red' : 'text-green',
    },
    {
      key: 'drills',
      label: 'Drill Gaps',
      value: String(summary.overdueDrillCount || 0),
      detail: `${summary.recentEventCount || 0} total resilience events in the current view`,
      icon: 'mdi-clipboard-pulse-outline',
      valueClass: (summary.overdueDrillCount || 0) ? 'text-amber' : 'text-green',
    },
  ];
}

function buildPrioritizedResiliencePolicies(protectionPolicies = []) {
  const priority = { critical: 0, warning: 1, pending: 2, success: 3, info: 4, notice: 5 };
  return [...(Array.isArray(protectionPolicies) ? protectionPolicies : [])].sort((left, right) => {
    const statusDelta = (priority[left.status] ?? 99) - (priority[right.status] ?? 99);
    if (statusDelta !== 0) return statusDelta;
    return new Date(right.lastProtectedAt || 0) - new Date(left.lastProtectedAt || 0);
  });
}

function buildPrioritizedResilienceHosts(hostPlans = []) {
  const priority = { critical: 0, pending: 1, warning: 2, disabled: 3, success: 4, info: 5 };
  return [...(Array.isArray(hostPlans) ? hostPlans : [])].sort((left, right) => (priority[left.status] ?? 99) - (priority[right.status] ?? 99));
}

function buildPrioritizedRecoveryPlans(recoveryPlans = []) {
  const priority = { critical: 0, warning: 1, pending: 2, success: 3, info: 4 };
  return [...(Array.isArray(recoveryPlans) ? recoveryPlans : [])].sort((left, right) => (priority[left.status] ?? 99) - (priority[right.status] ?? 99));
}

function isResilienceRemediationTask(task = null) {
  return String(task?.task_kind || '').toLowerCase() === 'remediation' || String(task?.source || '').toLowerCase() === 'remediation';
}

function isResilienceAutomationTask(task = null) {
  if (!isResilienceRemediationTask(task)) return false;
  return task.target_route === '/resilience' || String(task.action_type || '').toLowerCase() === 'resilience';
}

function buildResilienceAutomationTasks(automationTasks = []) {
  return sortTasks((Array.isArray(automationTasks) ? automationTasks : []).filter((task) => isResilienceAutomationTask(task)));
}

function buildResilienceRunbookDraft(activePlan = null, runbookSeed = null) {
  if (!activePlan) return null;
  if (!runbookSeed) return activePlan;
  return {
    ...activePlan,
    ...runbookSeed,
  };
}

function getResilienceInspectorTitle(selectedItemType = '') {
  if (selectedItemType === 'policy') return 'Protection Policy Detail';
  if (selectedItemType === 'host') return 'Failover Host Detail';
  if (selectedItemType === 'plan') return 'Recovery Plan Detail';
  return 'Resilience Detail';
}

function getResilienceRunbookWindowTitle(runbookLaunchMode = 'runbook') {
  return runbookLaunchMode === 'drill' ? 'Recovery Drill Handoff' : 'Recovery Runbook';
}

function getResilienceRunbookSubmitLabel(runbookLaunchMode = 'runbook') {
  return runbookLaunchMode === 'drill' ? 'Save Recovery Runbook Before Drill' : 'Save Recovery Runbook';
}

function getResilienceTaskEvidenceChecklist(task = null) {
  return Array.isArray(task?.evidence_checklist) ? task.evidence_checklist : [];
}

function getResilienceTaskCompletionCriteria(task = null) {
  return Array.isArray(task?.completion_criteria) ? task.completion_criteria : [];
}

function findResilienceTaskByFocus(automationTasks = [], focus = null) {
  return (Array.isArray(automationTasks) ? automationTasks : []).find((task) =>
    recordMatchesRouteFocus(task, focus, ['ref', 'uuid', 'name_label'])
  ) || null;
}

function resilienceRecordMatchesValue(record, value, fields = [], extraValues = []) {
  const needle = String(value || '').trim().toLowerCase();
  if (!record || !needle) return false;

  return [
    ...fields.map((field) => record?.[field]),
    ...extraValues,
  ]
    .filter(Boolean)
    .map((entry) => String(entry).trim().toLowerCase())
    .includes(needle);
}

function poolContainsResilienceHost(pool = null, host = null) {
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

function findResilienceHostRecord(value, relatedHosts = [], hostPlans = []) {
  return (Array.isArray(relatedHosts) ? relatedHosts : []).find((host) =>
    resilienceRecordMatchesValue(host, value, ['ref', 'uuid', 'name_label', 'hostname', 'address'], [
      ...(Array.isArray(host?.PBDs) ? host.PBDs : []),
      ...(Array.isArray(host?.PIFs) ? host.PIFs : []),
      ...(Array.isArray(host?.resident_VMs) ? host.resident_VMs : []),
    ])
  ) || (Array.isArray(hostPlans) ? hostPlans : []).find((host) =>
    resilienceRecordMatchesValue(host, value, ['ref', 'uuid', 'name_label', 'address'])
  ) || null;
}

function findResilienceVmRecord(value, relatedVMs = []) {
  return (Array.isArray(relatedVMs) ? relatedVMs : []).find((vm) =>
    resilienceRecordMatchesValue(vm, value, ['ref', 'uuid', 'name_label'], [
      ...(Array.isArray(vm?.VBDs) ? vm.VBDs : []),
      ...(Array.isArray(vm?.VIFs) ? vm.VIFs : []),
    ])
  ) || null;
}

function findResilienceStorageRecord(value, relatedStorage = []) {
  return (Array.isArray(relatedStorage) ? relatedStorage : []).find((sr) =>
    resilienceRecordMatchesValue(sr, value, ['ref', 'uuid', 'name_label'], [
      ...(Array.isArray(sr?.VDIs) ? sr.VDIs : []),
      ...(Array.isArray(sr?.PBDs) ? sr.PBDs : []),
    ])
  ) || null;
}

function findResiliencePoolRecord(value, relatedPools = []) {
  return (Array.isArray(relatedPools) ? relatedPools : []).find((pool) =>
    resilienceRecordMatchesValue(pool, value, ['ref', 'uuid', 'name_label'])
  ) || null;
}

function findResilienceNetworkRecord(value, networks = []) {
  return (Array.isArray(networks) ? networks : []).find((network) =>
    resilienceRecordMatchesValue(network, value, ['ref', 'uuid', 'name_label', 'bridge'], [
      ...(Array.isArray(network?.PIFs) ? network.PIFs : []),
      ...(Array.isArray(network?.VIFs) ? network.VIFs : []),
    ])
  ) || null;
}

function resolveResiliencePoolForHost(host = null, relatedPools = []) {
  if (!host) return null;

  const poolList = Array.isArray(relatedPools) ? relatedPools : [];
  const hostKeys = [host.pool, host.pool_ref, host.pool_uuid, host.pool_name, host.poolRef]
    .filter(Boolean)
    .map((value) => String(value).trim().toLowerCase());

  if (hostKeys.length) {
    const direct = poolList.find((pool) =>
      [pool.ref, pool.uuid, pool.name_label]
        .filter(Boolean)
        .map((value) => String(value).trim().toLowerCase())
        .some((value) => hostKeys.includes(value))
    );
    if (direct) return direct;
  }

  const relationship = poolList.find((pool) => poolContainsResilienceHost(pool, host));
  if (relationship) return relationship;

  if (poolList.length === 1) return poolList[0];
  return null;
}

function findResiliencePoolByVm(vm = null, relatedHosts = [], relatedPools = []) {
  if (!vm) return null;
  return findResiliencePoolRecord(vm.pool, relatedPools)
    || resolveResiliencePoolForHost(findResilienceHostRecord(vm.resident_on || vm.affinity, relatedHosts, []), relatedPools)
    || null;
}

function findResiliencePoolByStorage(sr = null, relatedHosts = [], relatedPools = []) {
  if (!sr) return null;

  const hostPbdRefs = new Set(Array.isArray(sr.PBDs) ? sr.PBDs : []);
  if (hostPbdRefs.size) {
    const host = (Array.isArray(relatedHosts) ? relatedHosts : []).find((entry) =>
      Array.isArray(entry.PBDs) && entry.PBDs.some((ref) => hostPbdRefs.has(ref))
    );
    const hostPool = resolveResiliencePoolForHost(host, relatedPools);
    if (hostPool) return hostPool;
  }

  return (Array.isArray(relatedPools) ? relatedPools : []).find((pool) => pool.default_SR === sr.ref) || null;
}

function findResiliencePoolByNetwork(network = null, relatedHosts = [], relatedPools = []) {
  if (!network) return null;

  const pifRefs = new Set(Array.isArray(network.PIFs) ? network.PIFs : []);
  if (pifRefs.size) {
    const host = (Array.isArray(relatedHosts) ? relatedHosts : []).find((entry) =>
      Array.isArray(entry.PIFs) && entry.PIFs.some((ref) => pifRefs.has(ref))
    );
    const hostPool = resolveResiliencePoolForHost(host, relatedPools);
    if (hostPool) return hostPool;
  }

  return (Array.isArray(relatedPools) ? relatedPools : []).find((pool) => pool.migration_network === network.ref) || null;
}

function resolveResilienceRecoveryPlanForPool(pool = null, recoveryPlans = []) {
  if (!pool) return null;
  const plans = Array.isArray(recoveryPlans) ? recoveryPlans : [];
  return plans.find((plan) => plan.ref === pool.ref)
    || plans.find((plan) => resilienceRecordMatchesValue(plan, pool.uuid, ['ref', 'uuid', 'name_label']))
    || plans.find((plan) => resilienceRecordMatchesValue(plan, pool.name_label, ['ref', 'uuid', 'name_label']))
    || null;
}

function findResilienceRecoveryPlanByTask(task = null, workspace = {}) {
  if (!task) return null;

  const recoveryPlans = Array.isArray(workspace.recoveryPlans) ? workspace.recoveryPlans : [];
  const relatedHosts = Array.isArray(workspace.relatedHosts) ? workspace.relatedHosts : [];
  const hostPlans = Array.isArray(workspace.hostPlans) ? workspace.hostPlans : [];
  const relatedVMs = Array.isArray(workspace.relatedVMs) ? workspace.relatedVMs : [];
  const relatedStorage = Array.isArray(workspace.relatedStorage) ? workspace.relatedStorage : [];
  const relatedPools = Array.isArray(workspace.relatedPools) ? workspace.relatedPools : [];
  const networks = Array.isArray(workspace.networks) ? workspace.networks : [];

  const relatedObject = String(task.related_object || '').trim().toLowerCase();
  const relatedClass = String(task.related_class || '').trim().toLowerCase();
  if (relatedObject) {
    const directPlan = recoveryPlans.find((plan) =>
      [plan.ref, plan.uuid, plan.name_label]
        .filter(Boolean)
        .map((value) => String(value).trim().toLowerCase())
        .includes(relatedObject)
    );
    if (directPlan) return directPlan;
  }

  if (relatedObject) {
    if (!relatedClass || relatedClass === 'host') {
      const relatedHost = findResilienceHostRecord(relatedObject, relatedHosts, hostPlans);
      const hostPool = resolveResiliencePoolForHost(relatedHost, relatedPools);
      const hostPlan = resolveResilienceRecoveryPlanForPool(hostPool, recoveryPlans);
      if (hostPlan) return hostPlan;
    }

    if (!relatedClass || ['vm', 'vbd', 'vif'].includes(relatedClass)) {
      const relatedVm = findResilienceVmRecord(relatedObject, relatedVMs);
      const vmPlan = resolveResilienceRecoveryPlanForPool(findResiliencePoolByVm(relatedVm, relatedHosts, relatedPools), recoveryPlans);
      if (vmPlan) return vmPlan;
    }

    if (!relatedClass || ['sr', 'vdi'].includes(relatedClass)) {
      const relatedStorageRecord = findResilienceStorageRecord(relatedObject, relatedStorage);
      const storagePlan = resolveResilienceRecoveryPlanForPool(findResiliencePoolByStorage(relatedStorageRecord, relatedHosts, relatedPools), recoveryPlans);
      if (storagePlan) return storagePlan;
    }

    if (!relatedClass || relatedClass === 'pool') {
      const relatedPool = findResiliencePoolRecord(relatedObject, relatedPools);
      const poolPlan = resolveResilienceRecoveryPlanForPool(relatedPool, recoveryPlans);
      if (poolPlan) return poolPlan;
    }

    if (!relatedClass || ['network', 'pif', 'vif'].includes(relatedClass)) {
      const relatedNetwork = findResilienceNetworkRecord(relatedObject, networks);
      const networkPlan = resolveResilienceRecoveryPlanForPool(findResiliencePoolByNetwork(relatedNetwork, relatedHosts, relatedPools), recoveryPlans);
      if (networkPlan) return networkPlan;
    }
  }

  return recoveryPlans.find((plan) => {
    const haystack = `${task?.name_label || ''} ${task?.name_description || ''} ${task?.workspace_summary || ''} ${task?.related_alert_summary || ''}`.toLowerCase();
    return haystack.includes(String(plan.name_label || '').toLowerCase());
  }) || null;
}

function buildResilienceFocusKey(focus = null, seedAction = '') {
  return `${getRouteFocusKey(focus)}|${String(seedAction || '').trim().toLowerCase()}`;
}

function buildResilienceAutomationTaskLocation(task = null) {
  if (!task?.ref) return null;
  return buildFocusedRoute('/activity', {
    kind: 'task',
    ref: task.ref || '',
    uuid: task.uuid || '',
    name: task.name_label || '',
    cls: 'task',
    source: 'resilience',
  });
}

function formatResilienceHours(value) {
  if (value === null || value === undefined || value === '') return 'Unknown';
  return `${value}h`;
}

function formatResilienceDrillType(value) {
  return String(value || 'restore')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function resolveResiliencePoolLabel(poolRef = '', recoveryPlans = []) {
  return (Array.isArray(recoveryPlans) ? recoveryPlans : []).find((plan) => plan.ref === poolRef)?.name_label || poolRef || 'Pool';
}

function getResilienceHostsForPlan(hostPlans = [], plan = null) {
  return (Array.isArray(hostPlans) ? hostPlans : []).filter((host) => host.poolRef === plan?.ref);
}

function buildResiliencePolicyChecklist(policy = null) {
  return [
    {
      label: 'Restore Point Freshness',
      detail: policy?.restorePointLabel,
      status: ['missing', 'stale'].includes(policy?.restorePointStatus) ? 'critical' : policy?.restorePointStatus === 'review' ? 'warning' : 'success',
    },
    {
      label: 'HA Restart Intent',
      detail: `VM restart priority is ${policy?.haRestartPriority}.`,
      status: policy?.haRestartPriority === 'best-effort' ? 'warning' : 'info',
    },
    {
      label: 'Drill Evidence',
      detail: policy?.lastDrillAt ? `Last drill logged ${formatDateTime(policy.lastDrillAt)}.` : 'No drill evidence recorded for this workload pool yet.',
      status: policy?.lastDrillAt ? (policy.lastDrillStatus || 'success') : 'warning',
    },
  ];
}

function buildResilienceHostChecklist(host = null) {
  return [
    {
      label: 'Alternate Capacity',
      detail: host?.evacuationTarget || 'No evacuation target recorded.',
      status: /no alternate/i.test(host?.evacuationTarget || '') ? 'critical' : 'success',
    },
    {
      label: 'HA Policy Coverage',
      detail: `Pool policy currently resolves to ${host?.haPolicy}.`,
      status: host?.haPolicy === 'disabled' ? 'warning' : 'info',
    },
    {
      label: 'Recent Drill',
      detail: host?.lastDrillAt ? `Last drill logged ${formatDateTime(host.lastDrillAt)}.` : 'No drill logged for this host pool.',
      status: host?.lastDrillAt ? (host.lastDrillStatus || 'success') : 'warning',
    },
  ];
}

function buildResiliencePlanChecklist(plan = null) {
  return [
    {
      label: 'Runbook Presence',
      detail: plan?.hasRunbook ? 'Recovery runbook is persisted for this pool.' : 'No persisted runbook yet.',
      status: plan?.hasRunbook ? 'success' : 'warning',
    },
    {
      label: 'Restore Coverage',
      detail: `${plan?.staleRestorePointCount || 0} stale and ${plan?.reviewRestorePointCount || 0} review-state workloads are tracked.`,
      status: plan?.staleRestorePointCount ? 'critical' : plan?.reviewRestorePointCount ? 'warning' : 'success',
    },
    {
      label: 'Drill Recency',
      detail: plan?.lastDrillAt ? `Last drill logged ${formatDateTime(plan.lastDrillAt)}.` : 'No drill logged for this pool.',
      status: plan?.lastDrillAt ? (plan.lastDrillStatus || 'success') : 'warning',
    },
  ];
}

function mapResilienceDrillStatusToTaskStatus(status = '') {
  const normalized = String(status || '').trim().toLowerCase();
  if (normalized === 'success') return 'success';
  if (normalized === 'warning') return 'warning';
  if (normalized === 'critical') return 'failure';
  return 'in_progress';
}
