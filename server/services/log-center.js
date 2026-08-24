const path = require('path');
const ejs = require('ejs');
const PDFDocument = require('pdfkit');

const auditLogService = require('./audit-log');
const remediationTaskService = require('./remediation-tasks');
const { authEventModel } = require('../models/security-db');
const { listAlerts } = require('./alerts');

const SOURCE_ORDER = ['audit', 'auth', 'alert', 'remediation-task', 'xen-task'];
const VALID_SOURCES = new Set(SOURCE_ORDER);

function normalizeSeverity(value, fallback = 'info') {
  const severity = String(value || fallback).trim().toLowerCase();
  if (!severity) return fallback;
  return severity;
}

function getSortableTimestamp(entry = {}) {
  return new Date(entry.timestamp || 0).getTime();
}

function getStatusTone(status = '') {
  const value = String(status || '').trim().toLowerCase();
  if (['critical', 'failure', 'error'].includes(value)) return 'critical';
  if (['warning', 'warn'].includes(value)) return 'warning';
  if (['pending', 'queued', 'in_progress'].includes(value)) return 'pending';
  if (['success', 'resolved', 'approved', 'used'].includes(value)) return 'success';
  return 'info';
}

function sortEntries(entries = []) {
  return [...entries].sort((left, right) => {
    const tsDelta = getSortableTimestamp(right) - getSortableTimestamp(left);
    if (tsDelta !== 0) return tsDelta;
    return String(left.id || '').localeCompare(String(right.id || ''));
  });
}

function normalizeAuditEntry(entry = {}) {
  return {
    id: `audit:${entry.id}`,
    source: 'audit',
    category: entry.category || 'operations',
    timestamp: entry.happenedAt || '',
    actor: entry.operator || 'system',
    operator: entry.operator || 'system',
    entityType: entry.entityType || 'record',
    entityRef: entry.entityRef || '',
    entityName: entry.entityName || '',
    message: entry.summary || entry.detail || entry.actionLabel || entry.action || 'Audit entry',
    detail: entry.detail || '',
    severity: getStatusTone(entry.status),
    route: entry.route || '',
    status: entry.status || 'success',
    action: entry.action || '',
    raw: entry,
  };
}

function normalizeAuthEvent(entry = {}) {
  const event = String(entry.event || '').trim().toLowerCase();
  const labelMap = {
    xen_login: 'Xen session login',
    xen_logout: 'Xen session logout',
  };

  return {
    id: `auth:${entry.id}`,
    source: 'auth',
    category: 'authentication',
    timestamp: entry.created_at || '',
    actor: entry.username || 'system',
    operator: entry.username || 'system',
    entityType: 'session',
    entityRef: String(entry.user_id || entry.username || entry.id || ''),
    entityName: entry.username || 'session',
    message: labelMap[event] || event || 'Authentication event',
    detail: entry.detail || '',
    severity: event.includes('logout') ? 'info' : 'success',
    route: '/activity',
    status: event.includes('logout') ? 'info' : 'success',
    action: event,
    raw: entry,
  };
}

function normalizeAlertEntry(entry = {}) {
  return {
    id: `alert:${entry.ref || entry.uuid || Math.random().toString(36).slice(2, 8)}`,
    source: 'alert',
    category: 'alerts',
    timestamp: entry.timestamp || '',
    actor: entry.acknowledgedBy || entry.policyName || 'system',
    operator: entry.acknowledgedBy || entry.policyName || 'system',
    entityType: 'alert',
    entityRef: entry.ref || '',
    entityName: entry.summary || entry.name || entry.ref || 'Alert',
    message: entry.summary || entry.name || entry.body || 'Alert',
    detail: entry.body || entry.notes || '',
    severity: normalizeSeverity(entry.effectiveSeverity || entry.baseSeverity || 'notice'),
    route: entry.targetRoute || '/alerts',
    status: entry.stateLabel || 'open',
    action: entry.healthAction || '',
    raw: entry,
  };
}

function normalizeRemediationTaskEntry(entry = {}) {
  return {
    id: `remediation-task:${entry.ref || entry.uuid || Math.random().toString(36).slice(2, 8)}`,
    source: 'remediation-task',
    category: 'tasks',
    timestamp: entry.finished || entry.updated_at || entry.created || '',
    actor: entry.created_by || entry.assignee || 'system',
    operator: entry.created_by || entry.assignee || 'system',
    entityType: 'task',
    entityRef: entry.ref || '',
    entityName: entry.name_label || entry.related_alert_summary || entry.ref || 'Remediation task',
    message: entry.name_label || 'Remediation task',
    detail: entry.result || entry.name_description || '',
    severity: getStatusTone(entry.status),
    route: '/activity',
    status: entry.status || 'pending',
    action: entry.action_type || '',
    raw: entry,
  };
}

function normalizeXenTaskEntry(ref, entry = {}) {
  return {
    id: `xen-task:${ref}`,
    source: 'xen-task',
    category: 'tasks',
    timestamp: entry.finished || entry.created || '',
    actor: 'xenserver',
    operator: 'xenserver',
    entityType: 'task',
    entityRef: ref,
    entityName: entry.name_label || entry.uuid || ref,
    message: entry.name_label || 'Xen task',
    detail: entry.result || (Array.isArray(entry.error_info) ? entry.error_info.join(' | ') : ''),
    severity: getStatusTone(entry.status),
    route: '/activity',
    status: entry.status || 'pending',
    action: entry.name_label || '',
    raw: { ref, ...entry },
  };
}

function matchesQuery(entry, query = {}) {
  const search = String(query.search || '').trim().toLowerCase();
  if (search) {
    const haystack = [
      entry.id,
      entry.source,
      entry.category,
      entry.actor,
      entry.entityType,
      entry.entityRef,
      entry.entityName,
      entry.message,
      entry.detail,
      entry.status,
      entry.action,
    ]
      .join(' ')
      .toLowerCase();

    if (!haystack.includes(search)) return false;
  }

  if (query.source && query.source !== 'all' && entry.source !== query.source) {
    return false;
  }

  if (query.severity && query.severity !== 'all') {
    const compare = String(query.severity || '').trim().toLowerCase();
    const values = [entry.severity, entry.status].map((value) => String(value || '').trim().toLowerCase());
    if (!values.includes(compare)) return false;
  }

  return true;
}

async function listEntries({ xenApi, source = 'all', search = '', severity = 'all' } = {}) {
  const [auditEntries, authEntries, remediationTasks, xenTasksResult, xenMessages] = await Promise.all([
    Promise.resolve(auditLogService.list()),
    Promise.resolve(authEventModel.list()),
    Promise.resolve(remediationTaskService.list()),
    xenApi?.getTasks ? xenApi.getTasks().catch(() => ({})) : Promise.resolve({}),
    xenApi?.getMessages ? xenApi.getMessages().catch(() => ({})) : Promise.resolve({}),
  ]);

  const entries = [
    ...auditEntries.map(normalizeAuditEntry),
    ...authEntries.map(normalizeAuthEvent),
    ...listAlerts(xenMessages || {}).map(normalizeAlertEntry),
    ...remediationTasks.map(normalizeRemediationTaskEntry),
    ...Object.entries(xenTasksResult || {}).map(([ref, record]) => normalizeXenTaskEntry(ref, record)),
  ];

  return sortEntries(entries.filter((entry) => matchesQuery(entry, { source, search, severity })));
}

async function renderHtmlReport(entries = [], options = {}) {
  const templatePath = path.join(__dirname, '..', 'views', 'log-export.ejs');
  return ejs.renderFile(templatePath, {
    entries,
    title: options.title || 'XenMange Log Export',
    generatedAt: options.generatedAt || new Date().toISOString(),
  });
}

function buildPdf(entries = [], options = {}) {
  const doc = new PDFDocument({
    margin: 36,
    size: 'A4',
    info: {
      Title: options.title || 'XenMange Log Export',
      Author: 'XenMange',
    },
  });

  doc.fontSize(18).text(options.title || 'XenMange Log Export');
  doc.moveDown(0.25);
  doc.fontSize(10).fillColor('#444').text(`Generated at ${options.generatedAt || new Date().toISOString()}`);
  doc.moveDown(1);
  doc.fillColor('#111');

  entries.forEach((entry, index) => {
    if (index > 0) doc.moveDown(0.5);
    doc.fontSize(11).text(`${entry.timestamp || '-'}  [${entry.source}]  ${entry.message || entry.entityName || entry.id}`);
    doc.fontSize(9).fillColor('#444').text(
      `${entry.severity || 'info'} · ${entry.actor || 'system'} · ${entry.entityType || 'record'} · ${entry.entityRef || '-'}`
    );
    if (entry.detail) {
      doc.fillColor('#111').text(entry.detail);
    }
    doc.fillColor('#111');

    if (doc.y > 720) {
      doc.addPage();
    }
  });

  return doc;
}

const logCenterService = {
  VALID_SOURCES,
  async list(options = {}) {
    return listEntries(options);
  },

  async listPage(options = {}) {
    const page = Math.max(1, Number(options.page || 1));
    const pageSize = Math.max(1, Math.min(500, Number(options.pageSize || 50)));
    const entries = await listEntries(options);
    const start = (page - 1) * pageSize;
    const data = entries.slice(start, start + pageSize);

    return {
      total: entries.length,
      page,
      pageSize,
      data,
      summary: {
        sourceCounts: SOURCE_ORDER.reduce((acc, source) => {
          acc[source] = entries.filter((entry) => entry.source === source).length;
          return acc;
        }, {}),
      },
    };
  },

  async getEntriesForExport(options = {}) {
    const ids = Array.isArray(options.ids) ? options.ids.filter(Boolean) : [];
    const entries = await listEntries(options);
    if (!ids.length) return entries;

    const selected = new Set(ids);
    return entries.filter((entry) => selected.has(entry.id));
  },

  renderHtmlReport,
  buildPdf,
};

module.exports = logCenterService;
