const { settingsModel } = require('../models/connection');

const SETTINGS_KEY = 'activity.audit';
const MAX_ENTRIES = 500;

function readEntries() {
  try {
    const stored = JSON.parse(settingsModel.get(SETTINGS_KEY) || '[]');
    return Array.isArray(stored) ? stored : [];
  } catch (error) {
    return [];
  }
}

function writeEntries(entries) {
  settingsModel.set(SETTINGS_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
}

function normalizeObject(value) {
  if (!value || typeof value !== 'object') return null;
  return JSON.parse(JSON.stringify(value));
}

function summarizeValue(value) {
  if (Array.isArray(value)) {
    return `${value.length} item${value.length === 1 ? '' : 's'}`;
  }
  if (value && typeof value === 'object') {
    return `${Object.keys(value).length} field${Object.keys(value).length === 1 ? '' : 's'}`;
  }
  if (value === null || value === undefined || value === '') {
    return '-';
  }
  return String(value);
}

function getChangedFields(before = null, after = null) {
  const left = before && typeof before === 'object' ? before : {};
  const right = after && typeof after === 'object' ? after : {};
  const fields = new Set([...Object.keys(left), ...Object.keys(right)]);

  return [...fields]
    .filter((field) => JSON.stringify(left[field]) !== JSON.stringify(right[field]))
    .slice(0, 12)
    .map((field) => ({
      field,
      before: summarizeValue(left[field]),
      after: summarizeValue(right[field]),
    }));
}

function buildSummary(entry, changedFields) {
  if (entry.summary) return String(entry.summary);

  if (entry.entityName && entry.actionLabel) {
    return `${entry.actionLabel} ${entry.entityName}`;
  }

  if (entry.entityName && entry.action) {
    return `${entry.action.replace(/_/g, ' ')} ${entry.entityName}`;
  }

  if (changedFields.length) {
    return `Updated ${changedFields.map((item) => item.field).join(', ')}`;
  }

  return `${entry.entityType || 'record'} updated`;
}

function sortEntries(entries) {
  return [...entries].sort((left, right) =>
    new Date(right.happenedAt || 0) - new Date(left.happenedAt || 0)
  );
}

const auditLogService = {
  list() {
    return sortEntries(readEntries());
  },

  record(entry = {}) {
    const entries = readEntries();
    const before = normalizeObject(entry.before);
    const after = normalizeObject(entry.after);
    const changedFields = getChangedFields(before, after);
    const happenedAt = new Date().toISOString();

    const record = {
      id: entry.id || `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      category: entry.category || 'operations',
      action: entry.action || 'update',
      actionLabel: entry.actionLabel || '',
      entityType: entry.entityType || 'record',
      entityRef: entry.entityRef || '',
      entityName: entry.entityName || '',
      operator: entry.operator || 'system',
      route: entry.route || '',
      status: entry.status || 'success',
      breakGlassElevated: Boolean(entry.breakGlassElevated),
      before,
      after,
      changedFields,
      summary: buildSummary(entry, changedFields),
      detail: entry.detail || '',
      happenedAt,
    };

    entries.unshift(record);
    writeEntries(entries);
    return record;
  },
};

module.exports = auditLogService;
