/* ============================================
   Lifecycle View Helpers
   ============================================ */

function formatLifecycleStageLabel(value) {
  const map = {
    aligned: 'Aligned',
    review: 'Review',
    maintenance: 'Maintenance',
    remediate: 'Remediate',
  };
  return map[value] || 'Review';
}

function formatLifecycleBaselineLabel(value) {
  const map = {
    compliant: 'Compliant',
    drifted: 'Drifted',
    unknown: 'Unknown',
  };
  return map[value] || 'Unknown';
}

function formatLifecycleActionLabel(value) {
  const map = {
    none: 'No Action',
    scan: 'Run Scan',
    patch: 'Apply Patch',
    reboot: 'Schedule Reboot',
    validate: 'Validate Outcome',
  };
  return map[value] || 'Run Scan';
}

function plannerStatusForLifecycleRow(row = null) {
  if (!row?.lifecyclePlan) return 'info';
  if (row.lifecyclePlan.targetStage === 'remediate') return 'warning';
  if (row.lifecyclePlan.targetStage === 'maintenance') return 'pending';
  if (row.lifecyclePlan.targetStage === 'aligned' && row.lifecyclePlan.baselineStatus === 'compliant') return 'success';
  return 'info';
}

function isRemediationLifecycleTask(task = null) {
  return String(task?.task_kind || '').toLowerCase() === 'remediation'
    || String(task?.source || '').toLowerCase() === 'remediation';
}

function isLifecycleTaskRecord(task = null) {
  const haystack = `${task?.name_label || ''} ${task?.name_description || ''}`.toLowerCase();
  return /(patch|compliance|scan|baseline|maintenance|update|drift|reboot|remediat|firmware|lifecycle)/.test(haystack);
}

function isLifecycleAutomationTaskRecord(task = null) {
  if (!isRemediationLifecycleTask(task)) return false;
  return task.target_route === '/lifecycle' || String(task.action_type || '').toLowerCase() === 'lifecycle';
}

function isLifecycleAlertRecord(message = null) {
  const haystack = `${message?.name || ''} ${message?.body || ''} ${message?.cls || ''}`.toLowerCase();
  return /(maintenance|patch|compliance|drift|host|baseline|update|firmware)/.test(haystack);
}

function hostMatchesLifecycleTask(host = {}, task = null) {
  const haystack = `${task?.name_label || ''} ${task?.name_description || ''} ${task?.resident_on || ''} ${task?.related_object || ''} ${task?.workspace_summary || ''} ${task?.related_alert_summary || ''}`.toLowerCase();
  return haystack.includes((host.ref || '').toLowerCase())
    || haystack.includes((host.uuid || '').toLowerCase())
    || haystack.includes((host.name_label || '').toLowerCase())
    || haystack.includes((host.hostname || '').toLowerCase());
}

function hostMatchesLifecycleMessage(host = {}, message = null) {
  const haystack = `${message?.name || ''} ${message?.body || ''} ${message?.obj_uuid || ''}`.toLowerCase();
  return haystack.includes((host.uuid || '').toLowerCase())
    || haystack.includes((host.name_label || '').toLowerCase())
    || haystack.includes((host.hostname || '').toLowerCase());
}

function taskEvidenceChecklistForLifecycle(task = null) {
  return Array.isArray(task?.evidence_checklist) ? task.evidence_checklist : [];
}

function taskCompletionCriteriaForLifecycle(task = null) {
  return Array.isArray(task?.completion_criteria) ? task.completion_criteria : [];
}

function recordMatchesLifecycleValue(record, value, fields = [], extraValues = []) {
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

function hostRecordMatchesLifecycleValue(host = {}, value = '') {
  return recordMatchesLifecycleValue(host, value, ['ref', 'uuid', 'name_label', 'hostname', 'address'], [
    ...(Array.isArray(host?.PBDs) ? host.PBDs : []),
    ...(Array.isArray(host?.PIFs) ? host.PIFs : []),
    ...(Array.isArray(host?.resident_VMs) ? host.resident_VMs : []),
  ]);
}

function findLifecycleVmRecord(relatedVMs = [], value = '') {
  return (Array.isArray(relatedVMs) ? relatedVMs : []).find((vm) => recordMatchesLifecycleValue(vm, value, ['ref', 'uuid', 'name_label'], [
    ...(Array.isArray(vm?.VBDs) ? vm.VBDs : []),
    ...(Array.isArray(vm?.VIFs) ? vm.VIFs : []),
  ])) || null;
}

function findLifecycleStorageRecord(relatedStorage = [], value = '') {
  return (Array.isArray(relatedStorage) ? relatedStorage : []).find((sr) => recordMatchesLifecycleValue(sr, value, ['ref', 'uuid', 'name_label'], [
    ...(Array.isArray(sr?.VDIs) ? sr.VDIs : []),
    ...(Array.isArray(sr?.PBDs) ? sr.PBDs : []),
  ])) || null;
}

function findLifecyclePoolRecord(relatedPools = [], value = '') {
  return (Array.isArray(relatedPools) ? relatedPools : []).find((pool) => recordMatchesLifecycleValue(pool, value, ['ref', 'uuid', 'name_label'])) || null;
}

function findLifecycleNetworkRecord(relatedNetworks = [], value = '') {
  return (Array.isArray(relatedNetworks) ? relatedNetworks : []).find((network) =>
    recordMatchesLifecycleValue(network, value, ['ref', 'uuid', 'name_label', 'bridge'], [
      ...(Array.isArray(network?.PIFs) ? network.PIFs : []),
      ...(Array.isArray(network?.VIFs) ? network.VIFs : []),
    ])
  ) || null;
}

function findPreferredLifecycleHostForPool(pool = null, hostLifecycleRows = [], relatedPools = []) {
  if (!pool) return null;

  const hosts = Array.isArray(hostLifecycleRows) ? hostLifecycleRows : [];
  const master = hosts.find((host) => hostRecordMatchesLifecycleValue(host, pool.master));
  if (master) return master;

  return hosts.find((host) => poolContainsHost(pool, host) && host.enabled)
    || hosts.find((host) => poolContainsHost(pool, host))
    || hosts.find((host) => resolveHostPool(host, relatedPools)?.ref === pool.ref)
    || null;
}

function findLifecycleHostByVm(vm = null, hostLifecycleRows = [], relatedPools = []) {
  if (!vm) return null;

  const hosts = Array.isArray(hostLifecycleRows) ? hostLifecycleRows : [];
  const direct = hosts.find((host) =>
    [vm.resident_on, vm.affinity].some((value) => hostRecordMatchesLifecycleValue(host, value))
  );
  if (direct) return direct;

  const pool = findLifecyclePoolRecord(relatedPools, vm.pool);
  return findPreferredLifecycleHostForPool(pool, hosts, relatedPools);
}

function findLifecycleHostByStorage(sr = null, hostLifecycleRows = [], relatedPools = []) {
  if (!sr) return null;

  const hosts = Array.isArray(hostLifecycleRows) ? hostLifecycleRows : [];
  const hostPbdRefs = new Set(Array.isArray(sr.PBDs) ? sr.PBDs : []);
  if (hostPbdRefs.size) {
    const direct = hosts.find((host) =>
      Array.isArray(host.PBDs) && host.PBDs.some((ref) => hostPbdRefs.has(ref))
    );
    if (direct) return direct;
  }

  const defaultSrPool = (Array.isArray(relatedPools) ? relatedPools : []).find((pool) => pool.default_SR === sr.ref);
  return findPreferredLifecycleHostForPool(defaultSrPool, hosts, relatedPools);
}

function findLifecycleHostByNetwork(network = null, hostLifecycleRows = [], relatedPools = []) {
  if (!network) return null;

  const hosts = Array.isArray(hostLifecycleRows) ? hostLifecycleRows : [];
  const pifRefs = new Set(Array.isArray(network.PIFs) ? network.PIFs : []);
  if (pifRefs.size) {
    const direct = hosts.find((host) =>
      Array.isArray(host.PIFs) && host.PIFs.some((ref) => pifRefs.has(ref))
    );
    if (direct) return direct;
  }

  const migrationPool = (Array.isArray(relatedPools) ? relatedPools : []).find((pool) => pool.migration_network === network.ref);
  return findPreferredLifecycleHostForPool(migrationPool, hosts, relatedPools);
}

function buildBulkLifecycleMaintenancePayload(host = null, relatedPools = [], relatedNetworks = []) {
  const hostPool = resolveHostPool(host, relatedPools);
  const hostNetworkRecords = buildSelectedHostNetworkRecords(host, relatedNetworks, hostPool);
  const maintenanceNetworkOptions = buildHostMaintenanceNetworkOptions(hostPool, hostNetworkRecords, relatedNetworks);
  const draft = buildHostMaintenanceActionDraft(hostPool, maintenanceNetworkOptions);
  return {
    ...draft,
    evacuateRunningVms: host?.lifecyclePlan?.evacuationRequired !== false,
  };
}

function buildLifecyclePlanDeleteApprovalDraft(target = null) {
  return {
    actionKey: 'lifecycle_plan_delete',
    entityType: 'host',
    entityRef: target?.ref || '',
    entityName: target?.name_label || target?.hostname || target?.address || 'Host lifecycle plan',
    route: '/lifecycle',
  };
}

function findLifecycleTaskByFocus(tasks = [], focus = null) {
  return (Array.isArray(tasks) ? tasks : []).find((task) =>
    recordMatchesRouteFocus(task, focus, ['ref', 'uuid', 'name_label'])
  ) || null;
}

function findLifecycleHostByTask(task = null, {
  hostLifecycleRows = [],
  relatedPools = [],
  relatedVMs = [],
  relatedStorage = [],
  relatedNetworks = [],
} = {}) {
  if (!task) return null;

  const hosts = Array.isArray(hostLifecycleRows) ? hostLifecycleRows : [];
  const relatedObject = String(task.related_object || task.resident_on || '').trim();
  const relatedObjectLower = relatedObject.toLowerCase();
  const relatedClass = String(task.related_class || '').trim().toLowerCase();
  const directMatch = hosts.find((host) =>
    [host.ref, host.uuid, host.name_label, host.hostname, host.address]
      .filter(Boolean)
      .map((value) => String(value).trim().toLowerCase())
      .includes(relatedObjectLower)
  );

  if (directMatch) return directMatch;

  if (relatedObject) {
    if (!relatedClass || ['vm', 'vbd', 'vif'].includes(relatedClass)) {
      const vm = findLifecycleVmRecord(relatedVMs, relatedObject);
      const vmHost = findLifecycleHostByVm(vm, hosts, relatedPools);
      if (vmHost) return vmHost;
    }

    if (!relatedClass || ['sr', 'vdi'].includes(relatedClass)) {
      const sr = findLifecycleStorageRecord(relatedStorage, relatedObject);
      const storageHost = findLifecycleHostByStorage(sr, hosts, relatedPools);
      if (storageHost) return storageHost;
    }

    if (!relatedClass || relatedClass === 'pool') {
      const pool = findLifecyclePoolRecord(relatedPools, relatedObject);
      const poolHost = findPreferredLifecycleHostForPool(pool, hosts, relatedPools);
      if (poolHost) return poolHost;
    }

    if (!relatedClass || ['network', 'pif', 'vif'].includes(relatedClass)) {
      const network = findLifecycleNetworkRecord(relatedNetworks, relatedObject);
      const networkHost = findLifecycleHostByNetwork(network, hosts, relatedPools);
      if (networkHost) return networkHost;
    }
  }

  return hosts.find((host) => hostMatchesLifecycleTask(host, task)) || null;
}

function buildLifecycleReadinessChecklist(row = null) {
  const plan = row?.lifecyclePlan;
  return [
    {
      label: 'Planner coverage',
      detail: plan ? `Lifecycle plan updated ${formatDateTime(plan.updatedAt)}.` : 'No saved lifecycle plan exists for this host yet.',
      status: plan ? 'success' : 'warning',
    },
    {
      label: 'Evacuation readiness',
      detail: plan?.evacuationRequired
        ? 'Workloads must be drained or migrated before maintenance begins.'
        : 'No evacuation requirement has been marked for this host.',
      status: plan?.evacuationRequired ? 'pending' : 'info',
    },
    {
      label: 'Reboot coordination',
      detail: plan?.rebootRequired
        ? 'A reboot is part of this lifecycle plan and should be coordinated with the maintenance window.'
        : 'No reboot is currently required in the saved plan.',
      status: plan?.rebootRequired ? 'warning' : 'success',
    },
    {
      label: 'Alert posture',
      detail: row?.lastAlertLabel || 'No recent lifecycle alert',
      status: row?.relatedMessages?.length ? getMessageSeverity(row.relatedMessages[0]) : 'success',
    },
  ];
}
