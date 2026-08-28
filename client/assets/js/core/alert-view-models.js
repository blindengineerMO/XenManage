function formatAlertActionLabel(value) {
  const map = {
    none: 'No Action',
    inspect: 'Inspect Related Object',
    monitor: 'Monitor Trend',
    review: 'Schedule Review',
    evacuate: 'Prepare Evacuation',
    snapshot: 'Create Protection Point',
    lifecycle: 'Open Lifecycle Review',
    capacity: 'Open Capacity Review',
    resilience: 'Open Resilience Review',
    governance: 'Open Governance Review',
  };
  return map[value] || 'No Action';
}

function formatAlertClassLabel(value) {
  const map = {
    host: 'Host',
    sr: 'Storage Repository',
    vdi: 'VDI',
    vbd: 'VBD',
    vm: 'VM',
    pool: 'Pool',
    network: 'Network',
    vif: 'VIF',
    pif: 'PIF',
    bond: 'Bond',
    vlan: 'VLAN',
    task: 'Task',
  };
  return map[value] || 'Any Class';
}

function formatAlertTargetRouteLabel(route) {
  const map = {
    '/hosts': 'Hosts',
    '/storage': 'Storage',
    '/vms': 'Virtual Machines',
    '/pools': 'Pools',
    '/networking': 'Networking',
    '/activity': 'Activity',
    '/inventory': 'Inventory',
    '/capacity': 'Capacity',
    '/resilience': 'Resilience',
    '/lifecycle': 'Lifecycle',
    '/governance': 'Governance',
  };
  return map[route] || 'Any Workspace';
}

function decorateAlertMessages(messages = []) {
  return sortMessages(Array.isArray(messages) ? messages : []).map((message) => ({
    ...message,
    effectiveSeverity: getMessageSeverity(message),
    summary: getMessageHeadline(message),
    stateLabel: message.stateLabel || (message.suppressed ? 'suppressed' : message.acknowledged ? 'acknowledged' : 'open'),
  }));
}

function filterAlertMessages(messages = [], activeFilter = 'all') {
  const queue = Array.isArray(messages) ? messages : [];

  if (activeFilter === 'all') {
    return queue;
  }

  if (activeFilter === 'open') {
    return queue.filter((message) => !message.acknowledged && !message.suppressed);
  }

  if (activeFilter === 'acknowledged') {
    return queue.filter((message) => message.acknowledged);
  }

  if (activeFilter === 'suppressed') {
    return queue.filter((message) => message.suppressed);
  }

  if (activeFilter === 'policy') {
    return queue.filter((message) => Boolean(message.policyName));
  }

  return queue.filter((message) => message.effectiveSeverity === activeFilter);
}

function findSelectedAlertMessage(messages = [], selectedRef = '') {
  if (!selectedRef) return null;
  return (Array.isArray(messages) ? messages : []).find((message) => message.ref === selectedRef) || null;
}

function buildSelectedAlertRows(messages = [], selectedRefs = []) {
  const selected = new Set(Array.isArray(selectedRefs) ? selectedRefs : []);
  return (Array.isArray(messages) ? messages : []).filter((message) => selected.has(message.ref));
}

function buildAlertCards(messages = [], policies = []) {
  const counts = (Array.isArray(messages) ? messages : []).reduce((acc, message) => {
    acc[message.effectiveSeverity] = (acc[message.effectiveSeverity] || 0) + 1;
    if (message.acknowledged) acc.acknowledged += 1;
    if (message.suppressed) acc.suppressed += 1;
    if (message.policyName) acc.policy += 1;
    if (!message.acknowledged && !message.suppressed) acc.open += 1;
    return acc;
  }, { critical: 0, warning: 0, info: 0, notice: 0, open: 0, acknowledged: 0, suppressed: 0, policy: 0 });

  return [
    {
      key: 'open',
      label: 'Open Alerts',
      value: String(counts.open),
      detail: counts.open ? `${counts.critical} critical and ${counts.warning} warning alerts still need attention` : 'No unacknowledged active alerts',
      icon: 'mdi-bell-ring-outline',
      valueClass: counts.open ? 'text-amber' : 'text-green',
    },
    {
      key: 'critical',
      label: 'Critical',
      value: String(counts.critical),
      detail: counts.critical ? 'Production-impacting signals should stay at the top of the queue' : 'No critical alerts detected',
      icon: 'mdi-alert-octagon-outline',
      valueClass: counts.critical ? 'text-red' : 'text-green',
    },
    {
      key: 'policy',
      label: 'Policy Managed',
      value: String(counts.policy),
      detail: counts.policy ? `${(Array.isArray(policies) ? policies : []).length} suppression policies are influencing part of the queue` : 'No active policy matches in the current queue',
      icon: 'mdi-shield-sun-outline',
      valueClass: counts.policy ? 'text-cyan' : 'text-green',
    },
    {
      key: 'suppressed',
      label: 'Suppressed',
      value: String(counts.suppressed),
      detail: counts.suppressed ? 'Temporarily silenced alerts remain visible with expiration timestamps' : 'No alerts are currently suppressed',
      icon: 'mdi-bell-off-outline',
      valueClass: counts.suppressed ? 'text-cyan' : 'text-green',
    },
  ];
}

function resolveAlertWorkflowRoute(message = {}) {
  const actionMap = {
    lifecycle: { route: '/lifecycle', label: 'Lifecycle Review' },
    capacity: { route: '/capacity', label: 'Capacity Review' },
    resilience: { route: '/resilience', label: 'Resilience Review' },
    governance: { route: '/governance', label: 'Governance Review' },
  };

  if (actionMap[message.healthAction]) {
    return actionMap[message.healthAction];
  }

  const cls = String(message.cls || '').toLowerCase();
  if (cls === 'host') return { route: '/lifecycle', label: 'Lifecycle Review' };
  if (cls === 'sr' || cls === 'vdi' || cls === 'vbd') return { route: '/capacity', label: 'Capacity Review' };
  if (cls === 'vm') return { route: '/governance', label: 'Governance Review' };
  if (cls === 'pool') return { route: '/resilience', label: 'Resilience Review' };
  return { route: '', label: '' };
}

function buildAlertFollowThroughLinks(message = null) {
  if (!message) return [];

  const links = [];
  const seen = new Set();

  const addLink = (route, label, detail) => {
    if (!route || seen.has(route)) return;
    seen.add(route);
    links.push({ route, label, detail });
  };

  addLink(message.targetRoute || '/inventory', message.targetLabel || 'Related View', 'Open the closest live inventory surface for the affected object.');

  const workflow = resolveAlertWorkflowRoute(message);
  if (workflow.route) {
    addLink(workflow.route, workflow.label, 'Continue directly into the recommended remediation workspace for this alert.');
  }

  const cls = String(message.cls || '').toLowerCase();
  if (cls === 'host') {
    addLink('/capacity', 'Capacity Review', 'Check host pressure, imbalance, and noisy-neighbor impact before maintenance.');
    addLink('/resilience', 'Resilience Review', 'Review failover posture and evacuation readiness for the affected host.');
  } else if (cls === 'sr' || cls === 'vdi' || cls === 'vbd') {
    addLink('/storage', 'Storage View', 'Inspect the affected repository, VDI, or attachment topology.');
    addLink('/resilience', 'Resilience Review', 'Confirm restore-point safety if storage degradation could impact protection posture.');
  } else if (cls === 'vm') {
    addLink('/vms', 'VM View', 'Open the VM detail workspace to inspect config, devices, and lifecycle state.');
    addLink('/resilience', 'Resilience Review', 'Check protection coverage and recovery posture for the affected workload.');
  } else if (cls === 'network' || cls === 'pif' || cls === 'vif' || cls === 'bond' || cls === 'vlan') {
    addLink('/networking', 'Network View', 'Inspect the affected bridge, uplink, or workload interface path in the relationship pane.');
  } else if (cls === 'pool') {
    addLink('/pools', 'Pool View', 'Inspect pool membership and control-plane settings for the affected cluster.');
    addLink('/governance', 'Governance Review', 'Review quota and approval posture if the alert signals policy pressure.');
  }

  return links;
}

function buildAlertFocusLocation(message = {}) {
  const cls = String(message.cls || '').toLowerCase();
  const objectRef = String(message.object_ref || '').trim();
  const objectUuid = String(message.obj_uuid || '').trim();
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
    task: 'task',
    alert: 'alert',
  };

  return buildFocusedRoute(message.targetRoute || '/inventory', {
    kind: kindMap[cls] || '',
    ref: objectRef || (objectUuid.startsWith('OpaqueRef:') ? objectUuid : ''),
    uuid: objectUuid && !objectUuid.startsWith('OpaqueRef:') ? objectUuid : '',
    name: message.summary || message.name || '',
    cls,
    source: 'alert',
  });
}

function describeAlertPolicy(policy = {}) {
  const parts = [];
  parts.push(policy.matchClass ? formatAlertClassLabel(policy.matchClass) : 'Any Class');
  if (policy.matchTargetRoute) parts.push(formatAlertTargetRouteLabel(policy.matchTargetRoute));
  parts.push(policy.matchSeverity ? `${policy.matchSeverity} only` : 'Any Severity');
  if (policy.matchObject) parts.push(`object "${policy.matchObject}"`);
  if (policy.matchText) parts.push(`${policy.textMatchMode === 'all' ? 'all terms' : 'contains'} "${policy.matchText}"`);
  if (policy.suppressionHours) parts.push(`${policy.suppressionHours}h suppression`);
  if (policy.healthAction && policy.healthAction !== 'none') parts.push(formatAlertActionLabel(policy.healthAction));
  return parts.join(' · ');
}

function formatAlertTemplateRecurrence(template = {}) {
  const mode = String(template?.recurrenceMode || 'manual').toLowerCase();
  const scope = String(template?.recurrenceScope || 'object').toLowerCase();
  const scopeLabel = scope === 'alert' ? 'alert' : scope === 'class' ? 'class signature' : 'object';
  if (mode === 'once') return `once per ${scopeLabel}`;
  if (mode === 'daily') return `daily per ${scopeLabel}`;
  if (mode === 'weekly') return `weekly per ${scopeLabel}`;
  if (mode === 'cooldown') return `${Number(template?.cooldownDays || 1)}d cooldown per ${scopeLabel}`;
  return 'no duplicate guard';
}

function describeAlertTemplateAutomation(template = {}) {
  const launchModeMap = {
    queue: 'queue immediately',
    'lifecycle-plan': 'launch lifecycle draft',
    'lifecycle-maintenance': 'launch maintenance handoff',
    'resilience-runbook': 'launch recovery runbook draft',
    'resilience-drill': 'launch recovery drill handoff',
    'vm-migration': 'launch VM migration handoff',
  };
  const launchMode = launchModeMap[String(template?.launchMode || 'draft').toLowerCase()] || 'open draft first';
  return `Launch: ${launchMode} · Guard: ${formatAlertTemplateRecurrence(template)}`;
}

function describeAlertRemediationTemplate(template = {}) {
  const parts = [];
  parts.push(template.matchClass ? formatAlertClassLabel(template.matchClass) : 'Any Class');
  if (template.matchTargetRoute) parts.push(formatAlertTargetRouteLabel(template.matchTargetRoute));
  parts.push(template.matchSeverity ? `${template.matchSeverity} only` : 'Any Severity');
  if (template.matchObject) parts.push(`object "${template.matchObject}"`);
  if (template.matchText) parts.push(`${template.textMatchMode === 'all' ? 'all terms' : 'contains'} "${template.matchText}"`);
  parts.push(formatAlertActionLabel(template.actionType || 'review'));
  if (template.defaultDueDays) parts.push(`due in ${template.defaultDueDays}d`);
  return parts.join(' · ');
}

function matchesAlertRemediationTemplate(template = null, message = null) {
  if (!template?.enabled || !template?.name || !message) return false;

  const messageClass = String(message.cls || '').toLowerCase();
  const targetRoute = message.targetRoute || '';
  const severity = String(message.effectiveSeverity || message.baseSeverity || '').toLowerCase();
  const identityHaystack = `${message?.ref || ''} ${message?.summary || ''} ${message?.uuid || ''} ${message?.obj_uuid || ''}`.toLowerCase();
  const textHaystack = `${message?.summary || ''} ${message?.body || ''} ${message?.uuid || ''} ${message?.obj_uuid || ''}`.toLowerCase();

  if (template.matchClass && template.matchClass !== messageClass) return false;
  if (template.matchTargetRoute && template.matchTargetRoute !== targetRoute) return false;
  if (template.matchSeverity && template.matchSeverity !== severity) return false;
  if (template.matchObject && !identityHaystack.includes(String(template.matchObject).toLowerCase())) return false;

  if (template.matchText) {
    const query = String(template.matchText || '').toLowerCase();
    if (template.textMatchMode === 'all') {
      const terms = query.split(/[\s,]+/).map((term) => term.trim()).filter(Boolean);
      if (!terms.length || !terms.every((term) => textHaystack.includes(term))) return false;
    } else if (!textHaystack.includes(query)) {
      return false;
    }
  }

  return true;
}

function getAlertMatchingRemediationTemplates(templates = [], message = null) {
  return (Array.isArray(templates) ? templates : [])
    .filter((template) => matchesAlertRemediationTemplate(template, message))
    .sort((left, right) => {
      const leftScore = (left.matchClass ? 2 : 0) + (left.matchTargetRoute ? 2 : 0) + (left.matchSeverity ? 2 : 0) + (left.matchObject ? 3 : 0) + (left.matchText ? 3 : 0);
      const rightScore = (right.matchClass ? 2 : 0) + (right.matchTargetRoute ? 2 : 0) + (right.matchSeverity ? 2 : 0) + (right.matchObject ? 3 : 0) + (right.matchText ? 3 : 0);
      return rightScore - leftScore;
    });
}

function applyAlertTemplateTokens(templateText, message = {}) {
  const source = String(templateText || '').trim();
  if (!source) return '';

  const summary = getMessageHeadline(message);
  const workflow = resolveAlertWorkflowRoute(message);
  const severity = String(message.effectiveSeverity || message.baseSeverity || 'notice').toLowerCase();
  return source
    .replace(/\{summary\}/gi, summary)
    .replace(/\{class\}/gi, String(message.cls || '').toLowerCase() || 'alert')
    .replace(/\{object\}/gi, message.obj_uuid || message.ref || '')
    .replace(/\{severity\}/gi, severity)
    .replace(/\{workspace\}/gi, workflow.label || formatAlertTargetRouteLabel(message.targetRoute || '') || 'workspace');
}

function applyAlertTemplateTokenList(entries = [], message = {}) {
  return (Array.isArray(entries) ? entries : [])
    .map((entry) => applyAlertTemplateTokens(entry, message))
    .map((entry) => String(entry || '').trim())
    .filter(Boolean);
}

function buildAlertRemediationTaskFocus(task = null, fallbackName = '') {
  return {
    kind: 'task',
    ref: task?.ref || '',
    uuid: task?.uuid || '',
    name: task?.name_label || fallbackName || '',
    cls: 'task',
    source: 'alert',
  };
}

function resolveAlertRemediationLaunchLocation(task = null, payload = {}) {
  const focus = buildAlertRemediationTaskFocus(task, payload.nameLabel || payload.templateName || '');
  const launchMode = String(task?.template_launch_mode || payload.templateLaunchMode || 'draft').trim().toLowerCase();

  if (launchMode === 'lifecycle-plan' && task?.lifecycle_plan_seed?.enabled) {
    return buildFocusedRoute('/lifecycle', focus, { seedAction: 'lifecycle-plan' });
  }
  if (launchMode === 'lifecycle-maintenance' && task?.lifecycle_plan_seed?.enabled) {
    return buildFocusedRoute('/lifecycle', focus, { seedAction: 'lifecycle-maintenance' });
  }
  if (launchMode === 'resilience-runbook' && task?.resilience_runbook_seed?.enabled) {
    return buildFocusedRoute('/resilience', focus, { seedAction: 'resilience-runbook' });
  }
  if (launchMode === 'resilience-drill' && task?.resilience_runbook_seed?.enabled) {
    return buildFocusedRoute('/resilience', focus, { seedAction: 'resilience-drill' });
  }
  if (launchMode === 'vm-migration' && task?.vm_migration_seed?.enabled) {
    return buildFocusedRoute('/vms', focus, { seedAction: 'vm-migration' });
  }

  return buildFocusedRoute('/activity', focus);
}

function getAlertRemediationTemplatePrimaryActionLabel(template = {}) {
  const launchMode = String(template?.launchMode || 'draft').trim().toLowerCase();
  if (launchMode === 'queue') return 'Queue Now';
  if (launchMode === 'lifecycle-plan') return 'Launch Lifecycle Draft';
  if (launchMode === 'lifecycle-maintenance') return 'Launch Maintenance Handoff';
  if (launchMode === 'resilience-runbook') return 'Launch Runbook Draft';
  if (launchMode === 'resilience-drill') return 'Launch Recovery Drill';
  if (launchMode === 'vm-migration') return 'Launch VM Migration';
  return 'Use Template';
}

function getAlertRemediationTemplatePrimaryActionIcon(template = {}) {
  const launchMode = String(template?.launchMode || 'draft').trim().toLowerCase();
  if (launchMode === 'queue') return 'mdi-rocket-launch-outline';
  if (launchMode === 'lifecycle-plan') return 'mdi-calendar-edit-outline';
  if (launchMode === 'lifecycle-maintenance') return 'mdi-wrench-clock';
  if (launchMode === 'resilience-runbook') return 'mdi-book-edit-outline';
  if (launchMode === 'resilience-drill') return 'mdi-clipboard-pulse-outline';
  if (launchMode === 'vm-migration') return 'mdi-swap-horizontal-bold';
  return 'mdi-creation-outline';
}

function formatAlertDueDateFromDays(days) {
  const count = Number(days || 0);
  if (!count) return '';
  const next = new Date();
  next.setDate(next.getDate() + count);
  const offsetDate = new Date(next.getTime() - next.getTimezoneOffset() * 60000);
  return offsetDate.toISOString().slice(0, 10);
}

function applyAlertLifecyclePlanSeed(seed = null, message = {}) {
  if (!seed || seed.enabled === false) return null;

  const nextSeed = {
    ...seed,
    enabled: true,
    maintenanceWindow: applyAlertTemplateTokens(seed.maintenanceWindow || '', message),
    patchGroup: applyAlertTemplateTokens(seed.patchGroup || '', message),
    owner: applyAlertTemplateTokens(seed.owner || '', message),
    notes: applyAlertTemplateTokens(seed.notes || '', message),
  };

  if (Number(seed.dueDays || 0) > 0) {
    nextSeed.dueDate = formatAlertDueDateFromDays(seed.dueDays);
  }

  return nextSeed;
}

function applyAlertResilienceRunbookSeed(seed = null, message = {}) {
  if (!seed || seed.enabled === false) return null;
  return {
    ...seed,
    enabled: true,
    owner: applyAlertTemplateTokens(seed.owner || '', message),
    notes: applyAlertTemplateTokens(seed.notes || '', message),
    runbookSteps: applyAlertTemplateTokenList(seed.runbookSteps || [], message),
  };
}

function applyAlertVmMigrationSeed(seed = null, message = {}) {
  if (!seed || seed.enabled === false) return null;
  return {
    ...seed,
    enabled: true,
    notes: applyAlertTemplateTokens(seed.notes || '', message),
    vifNetworkMap: Array.isArray(seed.vifNetworkMap)
      ? seed.vifNetworkMap.map((entry) => ({ ...entry }))
      : [],
  };
}

function buildAlertRemediationDraftFromAlert(message = {}, username = '') {
  const workflow = resolveAlertWorkflowRoute(message);
  const cls = String(message?.cls || '').toLowerCase();
  const actionType = message?.healthAction && message.healthAction !== 'none'
    ? message.healthAction
    : (workflow.route === '/capacity'
      ? 'capacity'
      : workflow.route === '/resilience'
        ? 'resilience'
        : workflow.route === '/governance'
          ? 'governance'
          : workflow.route === '/lifecycle'
            ? 'lifecycle'
            : 'review');
  const targetRoute = workflow.route || message?.targetRoute || '/activity';
  const summary = getMessageHeadline(message);
  const relatedLabel = formatAlertClassLabel(cls).toLowerCase();

  return buildRemediationTaskDraft({
    nameLabel: `${formatAlertActionLabel(actionType)}: ${summary}`,
    nameDescription: `${message?.body || 'Continue operator review for this alert.'}\n\nValidate the affected ${relatedLabel} and capture the outcome in Activity before closing the follow-through work.`,
    actionType,
    assignee: username || '',
    dueDate: '',
    alertRef: message?.ref || '',
    alertUuid: message?.uuid || '',
    alertSummary: summary,
    targetRoute,
    relatedObject: message?.object_ref || message?.obj_uuid || message?.ref || '',
    relatedClass: cls,
  });
}

function buildAlertRemediationDraftFromTemplate(message = {}, template = {}, username = '') {
  const base = buildAlertRemediationDraftFromAlert(message, username);
  const lifecyclePlanSeed = applyAlertLifecyclePlanSeed(template.lifecyclePlanSeed, message);
  const resilienceRunbookSeed = applyAlertResilienceRunbookSeed(template.resilienceRunbookSeed, message);
  const vmMigrationSeed = applyAlertVmMigrationSeed(template.vmMigrationSeed, message);

  if (lifecyclePlanSeed) {
    lifecyclePlanSeed.sourceTemplateId = template.id || '';
    lifecyclePlanSeed.sourceTemplateName = template.name || '';
  }

  if (resilienceRunbookSeed) {
    resilienceRunbookSeed.sourceTemplateId = template.id || '';
    resilienceRunbookSeed.sourceTemplateName = template.name || '';
  }

  if (vmMigrationSeed) {
    vmMigrationSeed.sourceTemplateId = template.id || '';
    vmMigrationSeed.sourceTemplateName = template.name || '';
  }

  return buildRemediationTaskDraft({
    ...base,
    nameLabel: applyAlertTemplateTokens(template.taskNameTemplate || base.nameLabel, message) || base.nameLabel,
    nameDescription: applyAlertTemplateTokens(template.defaultNotes || base.nameDescription, message) || base.nameDescription,
    actionType: template.actionType || base.actionType,
    assignee: template.defaultAssignee || base.assignee,
    dueDate: formatAlertDueDateFromDays(template.defaultDueDays),
    targetRoute: template.defaultTargetRoute || base.targetRoute,
    workspaceSummary: applyAlertTemplateTokens(template.workspaceSummaryTemplate || '', message),
    evidenceChecklist: applyAlertTemplateTokenList(template.evidenceChecklist, message),
    completionCriteria: applyAlertTemplateTokenList(template.completionCriteria, message),
    templateId: template.id || '',
    templateName: template.name || '',
    templateLaunchMode: template.launchMode || 'draft',
    recurrenceMode: template.recurrenceMode || 'manual',
    recurrenceScope: template.recurrenceScope || 'object',
    cooldownDays: Number(template.cooldownDays || 0),
    lifecyclePlanSeed,
    resilienceRunbookSeed,
    vmMigrationSeed,
  });
}

function findAlertMessageByFocus(messages = [], focus = null) {
  return (Array.isArray(messages) ? messages : []).find((message) =>
    recordMatchesRouteFocus(message, focus, ['ref', 'uuid', 'summary', 'name'])
  ) || null;
}
