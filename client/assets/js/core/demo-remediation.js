function sortTasks(tasks) {
  return [...(tasks || [])].sort((left, right) =>
    new Date(right.finished || right.created || 0) - new Date(left.finished || left.created || 0)
  );
}

function buildDemoRemediationRecurrenceKey(payload = {}) {
  const scope = String(payload.recurrenceScope || payload.recurrence_scope || 'object').trim().toLowerCase();
  const alertRef = String(payload.alertRef || payload.related_alert_ref || '').trim().toLowerCase();
  const alertUuid = String(payload.alertUuid || payload.related_alert_uuid || '').trim().toLowerCase();
  const relatedObject = String(payload.relatedObject || payload.related_object || '').trim().toLowerCase();
  const relatedClass = String(payload.relatedClass || payload.related_class || '').trim().toLowerCase();
  const targetRoute = String(payload.targetRoute || payload.target_route || '').trim().toLowerCase();
  const summary = String(payload.alertSummary || payload.related_alert_summary || '').trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 160);
  const classSummaryKey = [relatedClass, targetRoute, summary].filter(Boolean).join('|');

  if (scope === 'alert') return alertRef || alertUuid || relatedObject || classSummaryKey;
  if (scope === 'class') return classSummaryKey || relatedObject || alertUuid || alertRef;
  return relatedObject || alertUuid || alertRef || classSummaryKey;
}

function demoNextEligibleAt(task = {}, recurrenceMode, cooldownDays) {
  const createdAt = new Date(task.created || task.updated_at || 0);
  if (Number.isNaN(createdAt.getTime())) return '';

  const next = new Date(createdAt);
  const mode = String(recurrenceMode || '').trim().toLowerCase();
  if (mode === 'daily') next.setDate(next.getDate() + 1);
  else if (mode === 'weekly') next.setDate(next.getDate() + 7);
  else if (mode === 'cooldown') next.setDate(next.getDate() + Math.max(1, Number(cooldownDays || 0)));
  else return '';

  return next.toISOString();
}

function normalizeDemoLifecyclePlanSeed(seed = {}, current = null) {
  const source = seed && typeof seed === 'object' ? seed : {};
  const fallback = current && typeof current === 'object' ? current : {};

  if (source.enabled === false && !fallback.enabled) return null;
  if (!source.enabled && !fallback.enabled && !Object.keys(source).length) return null;

  return {
    enabled: source.enabled !== undefined ? Boolean(source.enabled) : Boolean(fallback.enabled),
    baselineStatus: String(source.baselineStatus || fallback.baselineStatus || 'unknown').trim().toLowerCase(),
    targetStage: String(source.targetStage || fallback.targetStage || 'review').trim().toLowerCase(),
    maintenanceWindow: String(source.maintenanceWindow || fallback.maintenanceWindow || '').trim(),
    patchGroup: String(source.patchGroup || fallback.patchGroup || '').trim(),
    owner: String(source.owner || fallback.owner || '').trim(),
    nextAction: String(source.nextAction || fallback.nextAction || 'scan').trim().toLowerCase(),
    rebootRequired: source.rebootRequired !== undefined ? Boolean(source.rebootRequired) : Boolean(fallback.rebootRequired),
    evacuationRequired: source.evacuationRequired !== undefined ? Boolean(source.evacuationRequired) : Boolean(fallback.evacuationRequired),
    dueDays: Number(source.dueDays ?? fallback.dueDays ?? 0),
    dueDate: String(source.dueDate || fallback.dueDate || '').trim(),
    notes: String(source.notes || fallback.notes || '').trim(),
    sourceTaskRef: String(source.sourceTaskRef || fallback.sourceTaskRef || '').trim(),
    sourceTemplateId: String(source.sourceTemplateId || fallback.sourceTemplateId || '').trim(),
    sourceTemplateName: String(source.sourceTemplateName || fallback.sourceTemplateName || '').trim(),
  };
}

function normalizeDemoResilienceRunbookSeed(seed = {}, current = null) {
  const source = seed && typeof seed === 'object' ? seed : {};
  const fallback = current && typeof current === 'object' ? current : {};

  if (source.enabled === false && !fallback.enabled) return null;
  if (!source.enabled && !fallback.enabled && !Object.keys(source).length) return null;

  return {
    enabled: source.enabled !== undefined ? Boolean(source.enabled) : Boolean(fallback.enabled),
    recoveryTier: String(source.recoveryTier || fallback.recoveryTier || 'standard').trim().toLowerCase(),
    haPolicy: String(source.haPolicy || fallback.haPolicy || 'manual').trim().toLowerCase(),
    restartPriority: String(source.restartPriority || fallback.restartPriority || 'medium').trim().toLowerCase(),
    backupWindowHours: Number(source.backupWindowHours ?? fallback.backupWindowHours ?? 24),
    rpoMinutes: Number(source.rpoMinutes ?? fallback.rpoMinutes ?? 60),
    rtoMinutes: Number(source.rtoMinutes ?? fallback.rtoMinutes ?? 120),
    restorePointStatus: String(source.restorePointStatus || fallback.restorePointStatus || 'review').trim().toLowerCase(),
    owner: String(source.owner || fallback.owner || '').trim(),
    standbyHostRef: String(source.standbyHostRef || fallback.standbyHostRef || '').trim(),
    failoverNetworkRef: String(source.failoverNetworkRef || fallback.failoverNetworkRef || '').trim(),
    runbookSteps: Array.isArray(source.runbookSteps || fallback.runbookSteps)
      ? (source.runbookSteps || fallback.runbookSteps).map((entry) => String(entry || '').trim()).filter(Boolean).slice(0, 8)
      : [],
    notes: String(source.notes || fallback.notes || '').trim(),
    sourceTaskRef: String(source.sourceTaskRef || fallback.sourceTaskRef || '').trim(),
    sourceTemplateId: String(source.sourceTemplateId || fallback.sourceTemplateId || '').trim(),
    sourceTemplateName: String(source.sourceTemplateName || fallback.sourceTemplateName || '').trim(),
  };
}

function buildDemoRemediationTask(payload = {}) {
  const now = new Date().toISOString();
  return {
    ref: nextDemoOpaqueRef('remediation'),
    uuid: `remediation-task-${Date.now()}`,
    name_label: String(payload.nameLabel || '').trim(),
    name_description: String(payload.nameDescription || '').trim(),
    status: 'pending',
    progress: 0,
    created: now,
    finished: '',
    result: 'Queued for operator follow-through.',
    error_info: [],
    resident_on: String(payload.relatedObject || '').trim(),
    task_kind: 'remediation',
    source: 'remediation',
    action_type: String(payload.actionType || 'review').trim().toLowerCase(),
    assignee: String(payload.assignee || '').trim(),
    due_date: String(payload.dueDate || '').trim(),
    related_alert_ref: String(payload.alertRef || '').trim(),
    related_alert_uuid: String(payload.alertUuid || '').trim(),
    related_alert_summary: String(payload.alertSummary || '').trim(),
    related_class: String(payload.relatedClass || '').trim().toLowerCase(),
    related_object: String(payload.relatedObject || '').trim(),
    target_route: String(payload.targetRoute || '').trim(),
    workspace_summary: String(payload.workspaceSummary || '').trim(),
    evidence_checklist: Array.isArray(payload.evidenceChecklist)
      ? payload.evidenceChecklist.map((entry) => String(entry || '').trim()).filter(Boolean).slice(0, 8)
      : [],
    completion_criteria: Array.isArray(payload.completionCriteria)
      ? payload.completionCriteria.map((entry) => String(entry || '').trim()).filter(Boolean).slice(0, 8)
      : [],
    template_id: String(payload.templateId || '').trim(),
    template_name: String(payload.templateName || '').trim(),
    template_launch_mode: String(payload.templateLaunchMode || 'draft').trim().toLowerCase(),
    recurrence_mode: String(payload.recurrenceMode || 'manual').trim().toLowerCase(),
    recurrence_scope: String(payload.recurrenceScope || 'object').trim().toLowerCase(),
    recurrence_cooldown_days: Number(payload.cooldownDays || 0),
    recurrence_window_key: buildDemoRemediationRecurrenceKey(payload),
    lifecycle_plan_seed: normalizeDemoLifecyclePlanSeed(payload.lifecyclePlanSeed, payload.lifecycle_plan_seed),
    resilience_runbook_seed: normalizeDemoResilienceRunbookSeed(payload.resilienceRunbookSeed, payload.resilience_runbook_seed),
    created_by: store.username || 'demo',
    updated_at: now,
  };
}

function buildDemoRemediationTemplate(payload = {}, current = {}) {
  return {
    id: current.id || payload.id || `remediation-template-${Date.now()}`,
    enabled: payload.enabled !== undefined ? Boolean(payload.enabled) : Boolean(current.enabled ?? true),
    name: String(payload.name || current.name || '').trim(),
    matchClass: String(payload.matchClass || current.matchClass || '').trim().toLowerCase(),
    matchTargetRoute: String(payload.matchTargetRoute || current.matchTargetRoute || '').trim(),
    matchObject: String(payload.matchObject || current.matchObject || '').trim(),
    matchSeverity: String(payload.matchSeverity || current.matchSeverity || '').trim().toLowerCase(),
    matchText: String(payload.matchText || current.matchText || '').trim().toLowerCase(),
    textMatchMode: String(payload.textMatchMode || current.textMatchMode || 'phrase').trim().toLowerCase(),
    actionType: String(payload.actionType || current.actionType || 'review').trim().toLowerCase(),
    taskNameTemplate: String(payload.taskNameTemplate || current.taskNameTemplate || 'Review: {summary}').trim(),
    defaultAssignee: String(payload.defaultAssignee || current.defaultAssignee || '').trim(),
    defaultDueDays: Number(payload.defaultDueDays ?? current.defaultDueDays ?? 0),
    defaultTargetRoute: String(payload.defaultTargetRoute || current.defaultTargetRoute || '').trim(),
    defaultNotes: String(payload.defaultNotes || current.defaultNotes || '').trim(),
    workspaceSummaryTemplate: String(payload.workspaceSummaryTemplate || current.workspaceSummaryTemplate || '').trim(),
    evidenceChecklist: Array.isArray(payload.evidenceChecklist || current.evidenceChecklist)
      ? (payload.evidenceChecklist || current.evidenceChecklist).map((entry) => String(entry || '').trim()).filter(Boolean).slice(0, 8)
      : [],
    completionCriteria: Array.isArray(payload.completionCriteria || current.completionCriteria)
      ? (payload.completionCriteria || current.completionCriteria).map((entry) => String(entry || '').trim()).filter(Boolean).slice(0, 8)
      : [],
    launchMode: String(payload.launchMode || current.launchMode || 'draft').trim().toLowerCase(),
    recurrenceMode: String(payload.recurrenceMode || current.recurrenceMode || 'manual').trim().toLowerCase(),
    recurrenceScope: String(payload.recurrenceScope || current.recurrenceScope || 'object').trim().toLowerCase(),
    cooldownDays: Number(payload.cooldownDays ?? current.cooldownDays ?? 0),
    lifecyclePlanSeed: normalizeDemoLifecyclePlanSeed(payload.lifecyclePlanSeed, current.lifecyclePlanSeed),
    resilienceRunbookSeed: normalizeDemoResilienceRunbookSeed(payload.resilienceRunbookSeed, current.resilienceRunbookSeed),
    updatedAt: payload.updatedAt || current.updatedAt || new Date().toISOString(),
  };
}
