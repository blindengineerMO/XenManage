const crypto = require('crypto');
const { settingsModel } = require('../models/connection');

const SETTINGS_KEY = 'alerts.remediationTaskTemplates';
const MAX_TEMPLATES = 100;

function readTemplates() {
  try {
    const stored = JSON.parse(settingsModel.get(SETTINGS_KEY) || '[]');
    return Array.isArray(stored) ? stored : [];
  } catch (error) {
    return [];
  }
}

function writeTemplates(templates) {
  settingsModel.set(SETTINGS_KEY, JSON.stringify(templates.slice(0, MAX_TEMPLATES)));
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
    dueDays: Number(source.dueDays ?? current?.dueDays ?? 0),
    notes: String(source.notes || current?.notes || '').trim(),
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
  };
}

function normalizeTemplate(template = {}, current = {}) {
  return {
    id: current.id || template.id || `remediation-template-${crypto.randomUUID()}`,
    enabled: template.enabled !== undefined ? Boolean(template.enabled) : Boolean(current.enabled ?? true),
    name: String(template.name || current.name || '').trim(),
    matchClass: String(template.matchClass || current.matchClass || '').trim().toLowerCase(),
    matchTargetRoute: String(template.matchTargetRoute || current.matchTargetRoute || '').trim(),
    matchObject: String(template.matchObject || current.matchObject || '').trim(),
    matchSeverity: String(template.matchSeverity || current.matchSeverity || '').trim().toLowerCase(),
    matchText: String(template.matchText || current.matchText || '').trim().toLowerCase(),
    textMatchMode: String(template.textMatchMode || current.textMatchMode || 'phrase').trim().toLowerCase(),
    actionType: String(template.actionType || current.actionType || 'review').trim().toLowerCase(),
    taskNameTemplate: String(template.taskNameTemplate || current.taskNameTemplate || 'Review: {summary}').trim(),
    defaultAssignee: String(template.defaultAssignee || current.defaultAssignee || '').trim(),
    defaultDueDays: Number(template.defaultDueDays ?? current.defaultDueDays ?? 0),
    defaultTargetRoute: String(template.defaultTargetRoute || current.defaultTargetRoute || '').trim(),
    defaultNotes: String(template.defaultNotes || current.defaultNotes || '').trim(),
    workspaceSummaryTemplate: String(template.workspaceSummaryTemplate || current.workspaceSummaryTemplate || '').trim(),
    evidenceChecklist: normalizeStringList(template.evidenceChecklist, current.evidenceChecklist),
    completionCriteria: normalizeStringList(template.completionCriteria, current.completionCriteria),
    lifecyclePlanSeed: normalizeLifecyclePlanSeed(template.lifecyclePlanSeed, current.lifecyclePlanSeed),
    resilienceRunbookSeed: normalizeResilienceRunbookSeed(template.resilienceRunbookSeed, current.resilienceRunbookSeed),
    launchMode: String(template.launchMode || current.launchMode || 'draft').trim().toLowerCase(),
    recurrenceMode: String(template.recurrenceMode || current.recurrenceMode || 'manual').trim().toLowerCase(),
    recurrenceScope: String(template.recurrenceScope || current.recurrenceScope || 'object').trim().toLowerCase(),
    cooldownDays: Number(template.cooldownDays ?? current.cooldownDays ?? 0),
    updatedAt: template.updatedAt || current.updatedAt || new Date().toISOString(),
  };
}

function sortTemplates(templates = []) {
  return [...templates].sort((left, right) =>
    new Date(right.updatedAt || 0) - new Date(left.updatedAt || 0)
  );
}

const remediationTaskTemplateService = {
  list() {
    return sortTemplates(readTemplates().map((template) => normalizeTemplate(template, template)));
  },

  get(id) {
    const template = readTemplates().find((entry) => entry.id === id);
    if (!template) {
      const error = new Error('REMEDIATION_TEMPLATE_NOT_FOUND');
      error.code = 'REMEDIATION_TEMPLATE_NOT_FOUND';
      throw error;
    }

    return normalizeTemplate(template, template);
  },

  create(payload = {}) {
    const templates = readTemplates();
    const template = normalizeTemplate({
      ...payload,
      updatedAt: new Date().toISOString(),
    });

    templates.unshift(template);
    writeTemplates(sortTemplates(templates));
    return template;
  },

  update(id, payload = {}) {
    const templates = readTemplates();
    const index = templates.findIndex((template) => template.id === id);
    if (index === -1) {
      const error = new Error('REMEDIATION_TEMPLATE_NOT_FOUND');
      error.code = 'REMEDIATION_TEMPLATE_NOT_FOUND';
      throw error;
    }

    const current = normalizeTemplate(templates[index], templates[index]);
    const next = normalizeTemplate({
      ...current,
      ...payload,
      updatedAt: new Date().toISOString(),
    }, current);

    templates[index] = next;
    writeTemplates(sortTemplates(templates));
    return next;
  },

  delete(id) {
    const templates = readTemplates();
    const index = templates.findIndex((template) => template.id === id);
    if (index === -1) {
      const error = new Error('REMEDIATION_TEMPLATE_NOT_FOUND');
      error.code = 'REMEDIATION_TEMPLATE_NOT_FOUND';
      throw error;
    }

    const [removed] = templates.splice(index, 1);
    writeTemplates(sortTemplates(templates));
    return normalizeTemplate(removed, removed);
  },
};

module.exports = remediationTaskTemplateService;
