const crypto = require('crypto');
const { settingsModel } = require('../models/connection');

const SETTINGS_KEY = 'activity.remediationTasks';
const MAX_TASKS = 250;
const TERMINAL_STATUSES = new Set(['success', 'warning', 'failure', 'cancelled']);
const RECURRENCE_BLOCKING_STATUSES = new Set(['pending', 'queued', 'in_progress', 'success', 'warning']);

function normalizeRecurrenceMode(value) {
  return String(value || 'manual').trim().toLowerCase();
}

function normalizeRecurrenceScope(value) {
  return String(value || 'object').trim().toLowerCase();
}

function buildRecurrenceWindowKey(task = {}) {
  const scope = normalizeRecurrenceScope(task.recurrence_scope || task.recurrenceScope || 'object');
  const alertRef = String(task.related_alert_ref || task.alertRef || '').trim().toLowerCase();
  const alertUuid = String(task.related_alert_uuid || task.alertUuid || '').trim().toLowerCase();
  const relatedObject = String(task.related_object || task.relatedObject || '').trim().toLowerCase();
  const relatedClass = String(task.related_class || task.relatedClass || '').trim().toLowerCase();
  const targetRoute = String(task.target_route || task.targetRoute || '').trim().toLowerCase();
  const summary = String(task.related_alert_summary || task.alertSummary || '').trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 160);
  const classSummaryKey = [relatedClass, targetRoute, summary].filter(Boolean).join('|');

  if (scope === 'alert') {
    return alertRef || alertUuid || relatedObject || classSummaryKey;
  }

  if (scope === 'class') {
    return classSummaryKey || relatedObject || alertUuid || alertRef;
  }

  return relatedObject || alertUuid || alertRef || classSummaryKey;
}

function calculateNextEligibleAt(task = {}, recurrenceMode, cooldownDays) {
  const mode = normalizeRecurrenceMode(recurrenceMode);
  if (mode === 'manual' || mode === 'once') return '';

  const createdAt = new Date(task.created || task.updated_at || 0);
  if (Number.isNaN(createdAt.getTime())) return '';

  const next = new Date(createdAt);
  if (mode === 'daily') {
    next.setDate(next.getDate() + 1);
    return next.toISOString();
  }
  if (mode === 'weekly') {
    next.setDate(next.getDate() + 7);
    return next.toISOString();
  }

  const days = Math.max(1, Number(cooldownDays || task.recurrence_cooldown_days || 0));
  if (mode === 'cooldown' && days) {
    next.setDate(next.getDate() + days);
    return next.toISOString();
  }

  return '';
}

function normalizeStringList(value, fallback = []) {
  const source = Array.isArray(value) ? value : Array.isArray(fallback) ? fallback : [];
  return source
    .map((entry) => String(entry || '').trim())
    .filter(Boolean)
    .slice(0, 8);
}

function normalizeLifecyclePlanSeed(value = {}, fallback = null) {
  const source = value && typeof value === 'object' ? value : {};
  const current = fallback && typeof fallback === 'object' ? fallback : null;
  const enabled = source.enabled !== undefined ? Boolean(source.enabled) : Boolean(current?.enabled);

  if (!enabled && !current && !Object.keys(source).length) return null;

  return {
    enabled,
    baselineStatus: String(source.baselineStatus || current?.baselineStatus || 'unknown').trim().toLowerCase(),
    targetStage: String(source.targetStage || current?.targetStage || 'review').trim().toLowerCase(),
    maintenanceWindow: String(source.maintenanceWindow || current?.maintenanceWindow || '').trim(),
    patchGroup: String(source.patchGroup || current?.patchGroup || '').trim(),
    owner: String(source.owner || current?.owner || '').trim(),
    nextAction: String(source.nextAction || current?.nextAction || 'scan').trim().toLowerCase(),
    rebootRequired: source.rebootRequired !== undefined ? Boolean(source.rebootRequired) : Boolean(current?.rebootRequired),
    evacuationRequired: source.evacuationRequired !== undefined ? Boolean(source.evacuationRequired) : Boolean(current?.evacuationRequired),
    dueDate: String(source.dueDate || current?.dueDate || '').trim(),
    notes: String(source.notes || current?.notes || '').trim(),
    sourceTaskRef: String(source.sourceTaskRef || current?.sourceTaskRef || '').trim(),
    sourceTemplateId: String(source.sourceTemplateId || current?.sourceTemplateId || '').trim(),
    sourceTemplateName: String(source.sourceTemplateName || current?.sourceTemplateName || '').trim(),
  };
}

function normalizeResilienceRunbookSeed(value = {}, fallback = null) {
  const source = value && typeof value === 'object' ? value : {};
  const current = fallback && typeof fallback === 'object' ? fallback : null;
  const enabled = source.enabled !== undefined ? Boolean(source.enabled) : Boolean(current?.enabled);

  if (!enabled && !current && !Object.keys(source).length) return null;

  return {
    enabled,
    recoveryTier: String(source.recoveryTier || current?.recoveryTier || 'standard').trim().toLowerCase(),
    haPolicy: String(source.haPolicy || current?.haPolicy || 'manual').trim().toLowerCase(),
    restartPriority: String(source.restartPriority || current?.restartPriority || 'medium').trim().toLowerCase(),
    backupWindowHours: Number(source.backupWindowHours ?? current?.backupWindowHours ?? 24),
    rpoMinutes: Number(source.rpoMinutes ?? current?.rpoMinutes ?? 60),
    rtoMinutes: Number(source.rtoMinutes ?? current?.rtoMinutes ?? 120),
    restorePointStatus: String(source.restorePointStatus || current?.restorePointStatus || 'review').trim().toLowerCase(),
    owner: String(source.owner || current?.owner || '').trim(),
    standbyHostRef: String(source.standbyHostRef || current?.standbyHostRef || '').trim(),
    failoverNetworkRef: String(source.failoverNetworkRef || current?.failoverNetworkRef || '').trim(),
    runbookSteps: normalizeStringList(source.runbookSteps, current?.runbookSteps),
    notes: String(source.notes || current?.notes || '').trim(),
    sourceTaskRef: String(source.sourceTaskRef || current?.sourceTaskRef || '').trim(),
    sourceTemplateId: String(source.sourceTemplateId || current?.sourceTemplateId || '').trim(),
    sourceTemplateName: String(source.sourceTemplateName || current?.sourceTemplateName || '').trim(),
  };
}

function readTasks() {
  try {
    const stored = JSON.parse(settingsModel.get(SETTINGS_KEY) || '[]');
    return Array.isArray(stored) ? stored : [];
  } catch (error) {
    return [];
  }
}

function writeTasks(tasks) {
  settingsModel.set(SETTINGS_KEY, JSON.stringify(tasks.slice(0, MAX_TASKS)));
}

function normalizeTask(task = {}, current = {}) {
  const status = String(task.status || current.status || 'pending').trim().toLowerCase();
  const created = task.created || current.created || new Date().toISOString();
  const finished = TERMINAL_STATUSES.has(status) ? (task.finished || current.finished || '') : '';
  const recurrenceMode = normalizeRecurrenceMode(task.recurrence_mode || task.recurrenceMode || current.recurrence_mode || 'manual');
  const recurrenceScope = normalizeRecurrenceScope(task.recurrence_scope || task.recurrenceScope || current.recurrence_scope || 'object');

  return {
    ref: current.ref || task.ref || `OpaqueRef:remediation-${crypto.randomUUID()}`,
    uuid: current.uuid || task.uuid || crypto.randomUUID(),
    name_label: String(task.name_label || task.nameLabel || current.name_label || '').trim(),
    name_description: String(task.name_description || task.nameDescription || current.name_description || '').trim(),
    status,
    progress: Number(task.progress ?? current.progress ?? 0),
    created,
    finished,
    resident_on: String(task.resident_on || task.relatedObject || current.resident_on || '').trim(),
    result: String(task.result || current.result || '').trim(),
    error_info: Array.isArray(task.error_info || current.error_info) ? [...(task.error_info || current.error_info || [])] : [],
    task_kind: 'remediation',
    source: 'remediation',
    action_type: String(task.action_type || task.actionType || current.action_type || 'review').trim().toLowerCase(),
    assignee: String(task.assignee || current.assignee || '').trim(),
    due_date: String(task.due_date || task.dueDate || current.due_date || '').trim(),
    related_alert_ref: String(task.related_alert_ref || task.alertRef || current.related_alert_ref || '').trim(),
    related_alert_uuid: String(task.related_alert_uuid || task.alertUuid || current.related_alert_uuid || '').trim(),
    related_alert_summary: String(task.related_alert_summary || task.alertSummary || current.related_alert_summary || '').trim(),
    related_class: String(task.related_class || task.relatedClass || current.related_class || '').trim().toLowerCase(),
    related_object: String(task.related_object || task.relatedObject || current.related_object || '').trim(),
    target_route: String(task.target_route || task.targetRoute || current.target_route || '').trim(),
    workspace_summary: String(task.workspace_summary || task.workspaceSummary || current.workspace_summary || '').trim(),
    evidence_checklist: normalizeStringList(task.evidence_checklist || task.evidenceChecklist, current.evidence_checklist || current.evidenceChecklist),
    completion_criteria: normalizeStringList(task.completion_criteria || task.completionCriteria, current.completion_criteria || current.completionCriteria),
    lifecycle_plan_seed: normalizeLifecyclePlanSeed(task.lifecycle_plan_seed || task.lifecyclePlanSeed, current.lifecycle_plan_seed || current.lifecyclePlanSeed),
    resilience_runbook_seed: normalizeResilienceRunbookSeed(task.resilience_runbook_seed || task.resilienceRunbookSeed, current.resilience_runbook_seed || current.resilienceRunbookSeed),
    template_id: String(task.template_id || task.templateId || current.template_id || '').trim(),
    template_name: String(task.template_name || task.templateName || current.template_name || '').trim(),
    template_launch_mode: String(task.template_launch_mode || task.templateLaunchMode || current.template_launch_mode || 'draft').trim().toLowerCase(),
    recurrence_mode: recurrenceMode,
    recurrence_scope: recurrenceScope,
    recurrence_cooldown_days: Number(task.recurrence_cooldown_days ?? task.cooldownDays ?? current.recurrence_cooldown_days ?? 0),
    recurrence_window_key: String(task.recurrence_window_key || task.recurrenceWindowKey || current.recurrence_window_key || buildRecurrenceWindowKey({
      ...current,
      ...task,
      recurrenceMode,
      recurrenceScope,
    }) || '').trim().toLowerCase(),
    created_by: String(task.created_by || task.createdBy || current.created_by || '').trim(),
    updated_at: task.updated_at || current.updated_at || new Date().toISOString(),
  };
}

function sortTasks(tasks = []) {
  return [...tasks].sort((left, right) =>
    new Date(right.finished || right.created || 0) - new Date(left.finished || left.created || 0)
  );
}

const remediationTaskService = {
  list() {
    return sortTasks(readTasks().map((task) => normalizeTask(task, task)));
  },

  findRecurringConflict(payload = {}) {
    const templateId = String(payload.template_id || payload.templateId || '').trim();
    const recurrenceMode = normalizeRecurrenceMode(payload.recurrence_mode || payload.recurrenceMode || 'manual');
    if (!templateId || recurrenceMode === 'manual') return null;

    const recurrenceWindowKey = String(payload.recurrence_window_key || payload.recurrenceWindowKey || buildRecurrenceWindowKey(payload) || '').trim().toLowerCase();
    if (!recurrenceWindowKey) return null;

    const latest = this.list()
      .filter((task) =>
        task.template_id === templateId
        && task.recurrence_window_key === recurrenceWindowKey
        && RECURRENCE_BLOCKING_STATUSES.has(String(task.status || '').trim().toLowerCase())
      )
      .sort((left, right) => new Date(right.created || right.updated_at || 0) - new Date(left.created || left.updated_at || 0))[0];

    if (!latest) return null;
    if (recurrenceMode === 'once') {
      return { task: latest, nextEligibleAt: '' };
    }

    const nextEligibleAt = calculateNextEligibleAt(latest, recurrenceMode, payload.cooldownDays || payload.recurrence_cooldown_days);
    if (!nextEligibleAt) return null;
    if (new Date(nextEligibleAt).getTime() > Date.now()) {
      return { task: latest, nextEligibleAt };
    }

    return null;
  },

  create(payload = {}, operator = 'system') {
    const tasks = readTasks();
    const task = normalizeTask({
      ...payload,
      status: 'pending',
      progress: 0,
      result: payload.result || 'Queued for operator follow-through.',
      created_by: operator,
      created: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      recurrence_window_key: buildRecurrenceWindowKey(payload),
    });

    tasks.unshift(task);
    writeTasks(tasks);
    return task;
  },

  update(ref, payload = {}, operator = 'system') {
    const tasks = readTasks();
    const index = tasks.findIndex((task) => task.ref === ref);
    if (index === -1) {
      const error = new Error('REMEDIATION_TASK_NOT_FOUND');
      error.code = 'REMEDIATION_TASK_NOT_FOUND';
      throw error;
    }

    const current = normalizeTask(tasks[index], tasks[index]);
    const status = String(payload.status || current.status || 'pending').trim().toLowerCase();
    const next = normalizeTask({
      ...current,
      ...payload,
      status,
      name_description: payload.nameDescription !== undefined ? payload.nameDescription : current.name_description,
      assignee: payload.assignee !== undefined ? payload.assignee : current.assignee,
      due_date: payload.dueDate !== undefined ? payload.dueDate : current.due_date,
      result: payload.result !== undefined ? payload.result : current.result,
      updated_at: new Date().toISOString(),
      finished: TERMINAL_STATUSES.has(status) ? new Date().toISOString() : '',
      created_by: current.created_by || operator,
    }, current);

    tasks[index] = next;
    writeTasks(sortTasks(tasks));
    return next;
  },
};

module.exports = remediationTaskService;
