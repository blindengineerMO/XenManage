function isRemediationActivityTask(task = null) {
  return String(task?.task_kind || task?.source || '').toLowerCase() === 'remediation';
}

function isTemplateDeploymentActivityTask(task = null) {
  return String(task?.task_kind || task?.source || '').toLowerCase() === 'template_deployment';
}

function buildActivityTaskSlaMeta(task = null) {
  const meta = getTaskDueMeta(task);
  if (isRemediationActivityTask(task)) return meta;

  if (isTemplateDeploymentActivityTask(task)) {
    const status = String(task.status || '').toLowerCase();
    if (status === 'success') {
      return {
        ...meta,
        tone: 'success',
        label: 'Validated',
        detail: task.validation_notes || task.result || 'Deployment validation completed successfully.',
      };
    }
    if (status === 'failure') {
      return {
        ...meta,
        tone: 'critical',
        label: 'Validation Failed',
        detail: task.validation_notes || task.result || 'Deployment validation failed and needs operator follow-through.',
      };
    }
    if (status === 'warning') {
      return {
        ...meta,
        tone: 'warning',
        label: 'Needs Review',
        detail: task.validation_notes || task.result || 'Deployment is waiting for operator review.',
      };
    }
    return {
      ...meta,
      tone: 'info',
      label: 'Awaiting Validation',
      detail: task.validation_notes || task.result || 'Deployment provisioning finished and validation is still pending.',
    };
  }

  return {
    ...meta,
    label: 'Background',
    tone: 'info',
    detail: 'Xen background tasks are tracked by status and progress rather than operator due dates.',
  };
}

function sortActivityAuditEntries(auditEntries = []) {
  return [...(Array.isArray(auditEntries) ? auditEntries : [])].sort((left, right) =>
    new Date(right.happenedAt || 0) - new Date(left.happenedAt || 0)
  );
}

function filterActivityTasks(tasks = [], activeFilter = 'all') {
  const sorted = sortTasks(Array.isArray(tasks) ? tasks : []);
  if (activeFilter === 'all') {
    return sorted;
  }
  return sorted.filter((task) => (task.status || '').toLowerCase() === activeFilter);
}

function filterActivityAuditEntries(auditEntries = [], activeFilter = 'all') {
  const sorted = sortActivityAuditEntries(auditEntries);
  if (activeFilter === 'all') {
    return sorted;
  }
  return sorted.filter((entry) => {
    const status = String(entry.status || '').toLowerCase();
    if (activeFilter === 'failure') {
      return status === 'failure' || status === 'critical' || status === 'error';
    }
    return status === activeFilter;
  });
}

function filterActivityLogs(logs = [], logSource = 'all', activeFilter = 'all') {
  let entries = [...(Array.isArray(logs) ? logs : [])];

  if (logSource !== 'all') {
    entries = entries.filter((entry) => entry.source === logSource);
  }

  if (activeFilter !== 'all') {
    entries = entries.filter((entry) => {
      const severity = String(entry.severity || '').toLowerCase();
      const status = String(entry.status || '').toLowerCase();
      if (activeFilter === 'failure') {
        return ['failure', 'critical', 'error'].includes(severity) || ['failure', 'critical', 'error'].includes(status);
      }
      return severity === activeFilter || status === activeFilter;
    });
  }

  return entries;
}

function buildActivitySummaryCards(tasks = [], auditEntries = [], logs = []) {
  const taskList = Array.isArray(tasks) ? tasks : [];
  const auditList = Array.isArray(auditEntries) ? auditEntries : [];
  const logList = Array.isArray(logs) ? logs : [];
  const pendingTasks = taskList.filter((task) => ['pending', 'queued'].includes(String(task.status || '').toLowerCase())).length;
  const remediationTasks = taskList.filter((task) => isRemediationActivityTask(task)).length;
  const operators = new Set(auditList.map((entry) => entry.operator || 'system'));
  const openRemediation = taskList.filter((task) => isRemediationActivityTask(task) && !buildActivityTaskSlaMeta(task).isClosed);
  const overdueRemediation = openRemediation.filter((task) => buildActivityTaskSlaMeta(task).isOverdue).length;
  const dueSoonRemediation = openRemediation.filter((task) => buildActivityTaskSlaMeta(task).isDueSoon).length;
  const agingRemediation = openRemediation.filter((task) => buildActivityTaskSlaMeta(task).isAging && !buildActivityTaskSlaMeta(task).isOverdue).length;

  return [
    {
      key: 'changes',
      label: 'Central Logs',
      value: String(logList.length),
      detail: logList.length ? `${logList[0].message || 'Recent log entry'} is the latest federated event` : 'No centralized log entries captured yet',
      icon: 'mdi-clipboard-text-clock-outline',
      valueClass: logList.length ? 'text-cyan' : '',
    },
    {
      key: 'operators',
      label: 'Operators',
      value: String(operators.size),
      detail: operators.size ? `${[...operators][0]} is present in the current audit window` : 'No named operators have generated activity yet',
      icon: 'mdi-account-group-outline',
      valueClass: operators.size ? 'text-green' : '',
    },
    {
      key: 'tasks',
      label: 'Tasks',
      value: String(taskList.length),
      detail: pendingTasks
        ? `${pendingTasks} active task${pendingTasks === 1 ? '' : 's'} still running, including ${remediationTasks} remediation follow-through item${remediationTasks === 1 ? '' : 's'}`
        : `${remediationTasks} remediation follow-through item${remediationTasks === 1 ? '' : 's'} recorded in the queue`,
      icon: 'mdi-progress-clock',
      valueClass: pendingTasks ? 'text-amber' : 'text-green',
    },
    {
      key: 'sla',
      label: 'Queue Watch',
      value: String(overdueRemediation),
      detail: overdueRemediation
        ? `${overdueRemediation} overdue · ${dueSoonRemediation} due soon · ${agingRemediation} aging without due dates`
        : `${dueSoonRemediation} due soon · ${agingRemediation} aging without due dates`,
      icon: 'mdi-timer-alert-outline',
      valueClass: overdueRemediation ? 'text-red' : (dueSoonRemediation || agingRemediation ? 'text-amber' : 'text-green'),
    },
  ];
}

function buildActivityOperatorRows(auditEntries = []) {
  const map = new Map();

  for (const entry of sortActivityAuditEntries(auditEntries)) {
    const operator = entry.operator || 'system';
    const current = map.get(operator) || { operator, count: 0, latestAt: '', categories: new Set() };
    current.count += 1;
    if (!current.latestAt || new Date(entry.happenedAt || 0) > new Date(current.latestAt || 0)) {
      current.latestAt = entry.happenedAt;
    }
    current.categories.add(entry.category || 'operations');
    map.set(operator, current);
  }

  return [...map.values()]
    .map((row) => ({
      ...row,
      categories: `${row.categories.size} categor${row.categories.size === 1 ? 'y' : 'ies'}`,
    }))
    .sort((left, right) => right.count - left.count)
    .slice(0, 8);
}

function buildActivityLogSourceRows(logSources = [], logs = []) {
  const sources = Array.isArray(logSources) ? logSources : [];
  const entries = Array.isArray(logs) ? logs : [];
  return sources
    .filter((source) => source.value !== 'all')
    .map((source) => {
      const count = entries.filter((entry) => entry.source === source.value).length;
      return {
        source: source.value,
        label: source.label,
        count,
        tone: count ? 'active' : 'idle',
      };
    });
}

function getActivityDetailTitle(selectedItemType = '') {
  if (selectedItemType === 'audit') return 'Audit Detail';
  if (selectedItemType === 'log') return 'Log Detail';
  return 'Task Detail';
}

function formatActivityTemplateLaunchMode(value) {
  const map = {
    queue: 'Queue Immediately',
    'lifecycle-plan': 'Launch Lifecycle Draft',
    'lifecycle-maintenance': 'Launch Maintenance Handoff',
    'resilience-runbook': 'Launch Recovery Runbook Draft',
    'resilience-drill': 'Launch Recovery Drill Handoff',
    'vm-migration': 'Launch VM Migration Handoff',
  };
  return map[String(value || 'draft').toLowerCase()] || 'Open Draft First';
}

function formatActivityTaskRecurrence(task = null) {
  const mode = String(task?.recurrence_mode || 'manual').toLowerCase();
  const scope = String(task?.recurrence_scope || 'object').toLowerCase();
  const scopeLabel = scope === 'alert' ? 'alert' : scope === 'class' ? 'class signature' : 'object';
  if (mode === 'once') return `Once per ${scopeLabel}`;
  if (mode === 'daily') return `Daily per ${scopeLabel}`;
  if (mode === 'weekly') return `Weekly per ${scopeLabel}`;
  if (mode === 'cooldown') return `${Number(task?.recurrence_cooldown_days || 1)}d cooldown per ${scopeLabel}`;
  return 'None';
}

function getActivityTaskEvidenceChecklist(task = null) {
  return Array.isArray(task?.evidence_checklist) ? task.evidence_checklist : [];
}

function getActivityTaskCompletionCriteria(task = null) {
  return Array.isArray(task?.completion_criteria) ? task.completion_criteria : [];
}

function getActivityTaskResult(task = null) {
  if (task?.result) return String(task.result);
  if (isTemplateDeploymentActivityTask(task) && task?.validation_notes) return String(task.validation_notes);
  if (task?.error_info && task.error_info.length) return task.error_info.map(String).join(' | ');
  return '-';
}

function getActivityTaskSourceLabel(task = null) {
  if (isRemediationActivityTask(task)) return 'remediation';
  if (isTemplateDeploymentActivityTask(task)) return 'template deployment';
  return 'background task';
}

function getActivityTaskSourceTitle(task = null) {
  if (isRemediationActivityTask(task)) return 'Remediation Task';
  if (isTemplateDeploymentActivityTask(task)) return 'Template Deployment Run';
  return 'Xen Background Task';
}

function formatActivityActionTypeLabel(value) {
  const map = {
    inspect: 'Inspect Related Object',
    monitor: 'Monitor Trend',
    review: 'Schedule Review',
    evacuate: 'Prepare Evacuation',
    snapshot: 'Create Protection Point',
    lifecycle: 'Lifecycle Review',
    capacity: 'Capacity Review',
    resilience: 'Resilience Review',
    governance: 'Governance Review',
  };
  return map[String(value || '').toLowerCase()] || 'Review';
}

function formatActivityAuditActionLabel(entry = null) {
  if (entry?.actionLabel) return entry.actionLabel;
  return String(entry?.action || 'activity').replace(/_/g, ' ');
}

function summarizeActivityChangedFields(entry = null) {
  if (!entry?.changedFields || !entry.changedFields.length) {
    return 'No field-level diff summary was captured for this entry.';
  }
  return entry.changedFields.map((change) => change.field).join(', ');
}

function formatActivityLogSourceLabel(value, logSources = []) {
  const source = (Array.isArray(logSources) ? logSources : []).find((entry) => entry.value === value);
  return source?.label || value || 'Source';
}

function resolveActivityAuditRecordLocation(entry = null) {
  if (!entry) return null;

  const entityType = String(entry.entityType || '').toLowerCase();
  const routeMap = {
    vm: { path: '/vms', kind: 'vm', cls: 'vm' },
    host: { path: '/hosts', kind: 'host', cls: 'host' },
    pool: { path: '/pools', kind: 'pool', cls: 'pool' },
    network: { path: '/networking', kind: 'network', cls: 'network' },
    sr: { path: '/storage', kind: 'storage', cls: 'sr' },
    vdi: { path: '/storage', kind: 'storage', cls: 'vdi' },
    vbd: { path: '/storage', kind: 'storage', cls: 'vbd' },
    alert: { path: '/alerts', kind: 'alert', cls: 'alert' },
    task: { path: '/activity', kind: 'task', cls: 'task' },
    template: { path: '/templates', kind: 'template', cls: 'template' },
  };

  const target = routeMap[entityType];
  if (!target) return null;

  return buildFocusedRoute(target.path, {
    kind: target.kind,
    ref: entry.entityRef || '',
    name: entry.entityName || entry.summary || '',
    cls: target.cls,
    source: 'activity',
  });
}

function resolveActivityTaskAlertLocation(task = null) {
  if (!task?.related_alert_ref && !task?.related_alert_uuid && !task?.related_alert_summary) return null;
  return buildFocusedRoute('/alerts', {
    kind: 'alert',
    ref: task.related_alert_ref || '',
    uuid: task.related_alert_uuid || '',
    name: task.related_alert_summary || task.name_label || '',
    cls: 'alert',
    source: 'activity',
  });
}

function canDraftActivityLifecyclePlan(task = null) {
  return Boolean(task?.lifecycle_plan_seed?.enabled);
}

function canDraftActivityResilienceRunbook(task = null) {
  return Boolean(task?.resilience_runbook_seed?.enabled);
}

function canDraftActivityVmMigration(task = null) {
  return Boolean(task?.vm_migration_seed?.enabled);
}

function buildActivityTaskFocus(task = null) {
  return {
    kind: 'task',
    ref: task?.ref || '',
    uuid: task?.uuid || '',
    name: task?.name_label || '',
    cls: 'task',
    source: 'activity',
  };
}

function buildActivityTaskLifecycleDraftLocation(task = null) {
  if (!canDraftActivityLifecyclePlan(task)) return null;
  return buildFocusedRoute('/lifecycle', buildActivityTaskFocus(task), {
    seedAction: 'lifecycle-plan',
  });
}

function buildActivityTaskLifecycleMaintenanceLocation(task = null) {
  if (!canDraftActivityLifecyclePlan(task)) return null;
  return buildFocusedRoute('/lifecycle', buildActivityTaskFocus(task), {
    seedAction: 'lifecycle-maintenance',
  });
}

function buildActivityTaskResilienceDraftLocation(task = null) {
  if (!canDraftActivityResilienceRunbook(task)) return null;
  return buildFocusedRoute('/resilience', buildActivityTaskFocus(task), {
    seedAction: 'resilience-runbook',
  });
}

function buildActivityTaskResilienceDrillLocation(task = null) {
  if (!canDraftActivityResilienceRunbook(task)) return null;
  return buildFocusedRoute('/resilience', buildActivityTaskFocus(task), {
    seedAction: 'resilience-drill',
  });
}

function buildActivityTaskVmMigrationLocation(task = null) {
  if (!canDraftActivityVmMigration(task)) return null;
  return buildFocusedRoute('/vms', buildActivityTaskFocus(task), {
    seedAction: 'vm-migration',
  });
}

function buildActivityTaskWorkspaceLocation(task = null) {
  if (!task?.target_route) return null;

  const cls = String(task.related_class || '').toLowerCase();
  const relatedObject = String(task.related_object || '').trim();
  const relatedObjectRef = relatedObject.startsWith('OpaqueRef:') ? relatedObject : '';
  const relatedObjectUuid = relatedObjectRef ? '' : relatedObject;
  const kindMap = {
    host: 'host',
    sr: 'storage',
    vdi: 'storage',
    vbd: 'storage',
    vm: 'vm',
    pool: 'pool',
    network: 'network',
    vif: 'network',
    pif: 'network',
    bond: 'network',
    vlan: 'network',
  };

  return buildFocusedRoute(task.target_route, {
    kind: kindMap[cls] || '',
    ref: relatedObjectRef,
    uuid: relatedObjectUuid,
    name: task.related_alert_summary || task.name_label || '',
    cls,
    source: 'activity',
  });
}

function buildActivityDeploymentVmLocation(task = null) {
  if (!task?.vm_ref) return null;
  return buildFocusedRoute('/vms', {
    kind: 'vm',
    ref: task.vm_ref,
    name: task.vm_name || task.name_label || '',
    cls: 'vm',
    source: 'activity',
  });
}

function buildActivityDeploymentTemplateLocation(task = null) {
  if (!task?.template_ref) return null;
  return buildFocusedRoute('/templates', {
    kind: 'template',
    ref: task.template_ref,
    name: task.template_name || '',
    cls: 'template',
    source: 'activity',
  });
}

function findActivityTaskByFocus(tasks = [], focus = null) {
  return (Array.isArray(tasks) ? tasks : []).find((task) =>
    recordMatchesRouteFocus(task, focus, ['ref', 'uuid', 'name_label'])
  ) || null;
}
