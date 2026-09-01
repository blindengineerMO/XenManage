const { settingsModel } = require('../models/connection');

const POLICY_KEY = 'governance.policy';
const QUOTAS_KEY = 'governance.quotas';
const VFABRIC_QUOTAS_KEY = 'governance.vfabricQuotas';
const APPROVALS_KEY = 'governance.approvals';
const MAX_APPROVALS = 250;

const ROLE_ORDER = {
  'read-only': 0,
  operator: 1,
  admin: 2,
};

function readCollection(key, fallback) {
  try {
    const stored = JSON.parse(settingsModel.get(key) || JSON.stringify(fallback));
    return stored && typeof stored === 'object' ? stored : fallback;
  } catch (error) {
    return fallback;
  }
}

function writeCollection(key, value) {
  settingsModel.set(key, JSON.stringify(value));
}

function normalizeRole(role) {
  return ROLE_ORDER[role] !== undefined ? role : 'admin';
}

function isExpired(timestamp) {
  const value = new Date(timestamp || 0).getTime();
  return Boolean(value) && value < Date.now();
}

function sortByRecent(records, field) {
  return [...records].sort((left, right) =>
    new Date(right?.[field] || 0) - new Date(left?.[field] || 0)
  );
}

function normalizeApproval(record = {}) {
  const expired = ['pending', 'approved'].includes(record.status) && isExpired(record.expiresAt);
  return {
    id: record.id || `approval-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    actionKey: record.actionKey || '',
    entityType: record.entityType || 'resource',
    entityRef: record.entityRef || '',
    entityName: record.entityName || '',
    requestedBy: record.requestedBy || 'system',
    justification: record.justification || '',
    route: record.route || '',
    status: expired ? 'expired' : (record.status || 'pending'),
    requestedAt: record.requestedAt || new Date().toISOString(),
    expiresAt: record.expiresAt || '',
    decidedBy: record.decidedBy || '',
    decidedAt: record.decidedAt || '',
    decisionNotes: record.decisionNotes || '',
    usedBy: record.usedBy || '',
    usedAt: record.usedAt || '',
  };
}

function normalizeQuota(poolRef, payload = {}) {
  return {
    poolRef,
    enabled: payload.enabled !== false,
    owner: payload.owner || '',
    maxVmCount: Number(payload.maxVmCount || 0),
    maxRunningVmCount: Number(payload.maxRunningVmCount || 0),
    maxTotalMemoryGiB: Number(payload.maxTotalMemoryGiB || 0),
    notes: payload.notes || '',
    updatedAt: new Date().toISOString(),
  };
}

function normalizeVFabricQuota(vFabricId, payload = {}) {
  const quota = normalizeQuota('', payload);
  delete quota.poolRef;
  return { ...quota, vFabricId: Number(vFabricId) };
}

const governanceService = {
  getPolicy() {
    const stored = readCollection(POLICY_KEY, {
      defaultRole: 'admin',
      requireDestructiveApproval: true,
      approvalTtlMinutes: 240,
    });

    return {
      defaultRole: normalizeRole(stored.defaultRole),
      requireDestructiveApproval: Boolean(stored.requireDestructiveApproval),
      approvalTtlMinutes: Math.max(5, Math.min(10080, Number(stored.approvalTtlMinutes || 240))),
    };
  },

  updatePolicy(payload = {}) {
    const nextPolicy = {
      defaultRole: normalizeRole(payload.defaultRole),
      requireDestructiveApproval: Boolean(payload.requireDestructiveApproval),
      approvalTtlMinutes: Math.max(5, Math.min(10080, Number(payload.approvalTtlMinutes || 240))),
    };
    writeCollection(POLICY_KEY, nextPolicy);
    return nextPolicy;
  },

  getSessionRole(session = {}) {
    return normalizeRole(session.governanceRole || this.getPolicy().defaultRole);
  },

  setSessionRole(session, role) {
    if (!session) return normalizeRole(role);
    session.governanceRole = normalizeRole(role);
    return session.governanceRole;
  },

  listQuotas() {
    const records = readCollection(QUOTAS_KEY, []);
    return sortByRecent(
      Array.isArray(records) ? records.map((record) => normalizeQuota(record.poolRef, record)) : [],
      'updatedAt'
    );
  },

  getQuota(poolRef) {
    return this.listQuotas().find((record) => record.poolRef === poolRef) || null;
  },

  upsertQuota(poolRef, payload = {}) {
    const records = readCollection(QUOTAS_KEY, []);
    const nextRecord = normalizeQuota(poolRef, payload);
    const index = records.findIndex((record) => record.poolRef === poolRef);

    if (index === -1) {
      records.push(nextRecord);
    } else {
      records[index] = nextRecord;
    }

    writeCollection(QUOTAS_KEY, records);
    return nextRecord;
  },

  removeQuota(poolRef) {
    const records = readCollection(QUOTAS_KEY, []);
    writeCollection(QUOTAS_KEY, records.filter((record) => record.poolRef !== poolRef));
    return { success: true };
  },

  listVFabricQuotas() {
    const records = readCollection(VFABRIC_QUOTAS_KEY, []);
    return sortByRecent(
      Array.isArray(records)
        ? records.filter((record) => Number(record?.vFabricId || 0) > 0)
          .map((record) => normalizeVFabricQuota(record.vFabricId, record))
        : [],
      'updatedAt'
    );
  },

  getVFabricQuota(vFabricId) {
    return this.listVFabricQuotas().find((record) => Number(record.vFabricId) === Number(vFabricId)) || null;
  },

  upsertVFabricQuota(vFabricId, payload = {}) {
    const records = readCollection(VFABRIC_QUOTAS_KEY, []);
    const nextRecord = normalizeVFabricQuota(vFabricId, payload);
    const index = records.findIndex((record) => Number(record?.vFabricId) === Number(vFabricId));
    if (index === -1) records.push(nextRecord);
    else records[index] = nextRecord;
    writeCollection(VFABRIC_QUOTAS_KEY, records);
    return nextRecord;
  },

  removeVFabricQuota(vFabricId) {
    const records = readCollection(VFABRIC_QUOTAS_KEY, []);
    writeCollection(VFABRIC_QUOTAS_KEY, records.filter((record) => Number(record?.vFabricId) !== Number(vFabricId)));
    return { success: true };
  },

  listApprovals() {
    const records = readCollection(APPROVALS_KEY, []);
    const normalized = Array.isArray(records) ? records.map((record) => normalizeApproval(record)) : [];
    writeCollection(APPROVALS_KEY, normalized.slice(0, MAX_APPROVALS));
    return sortByRecent(normalized, 'requestedAt');
  },

  requestApproval(payload = {}, requestedBy = 'system') {
    const approvals = this.listApprovals();
    const policy = this.getPolicy();
    const requestedAt = new Date().toISOString();
    const expiresAt = payload.expiresAt || new Date(Date.now() + policy.approvalTtlMinutes * 60000).toISOString();
    const record = normalizeApproval({
      actionKey: payload.actionKey,
      entityType: payload.entityType,
      entityRef: payload.entityRef,
      entityName: payload.entityName,
      justification: payload.justification,
      route: payload.route,
      requestedBy,
      status: 'pending',
      requestedAt,
      expiresAt,
    });

    approvals.unshift(record);
    writeCollection(APPROVALS_KEY, approvals.slice(0, MAX_APPROVALS));
    return record;
  },

  decideApproval(id, payload = {}, decidedBy = 'system') {
    const approvals = this.listApprovals();
    const index = approvals.findIndex((record) => record.id === id);
    if (index === -1) return null;

    approvals[index] = normalizeApproval({
      ...approvals[index],
      status: payload.decision === 'rejected' ? 'rejected' : 'approved',
      decidedBy,
      decidedAt: new Date().toISOString(),
      decisionNotes: payload.notes || '',
    });

    writeCollection(APPROVALS_KEY, approvals.slice(0, MAX_APPROVALS));
    return approvals[index];
  },

  consumeApproval({ id, actionKey, entityRef, entityType, usedBy = 'system' }) {
    const approvals = this.listApprovals();
    const index = approvals.findIndex((record) => record.id === id);
    if (index === -1) return { ok: false, error: 'APPROVAL_NOT_FOUND' };

    const approval = approvals[index];

    if (approval.status !== 'approved') {
      return { ok: false, error: approval.status === 'expired' ? 'APPROVAL_EXPIRED' : 'APPROVAL_NOT_ACTIVE' };
    }

    if (approval.actionKey !== actionKey || approval.entityRef !== entityRef || approval.entityType !== entityType) {
      return { ok: false, error: 'APPROVAL_SCOPE_MISMATCH' };
    }

    approvals[index] = normalizeApproval({
      ...approval,
      status: 'used',
      usedBy,
      usedAt: new Date().toISOString(),
    });
    writeCollection(APPROVALS_KEY, approvals.slice(0, MAX_APPROVALS));

    return { ok: true, approval: approvals[index] };
  },

  hasRole(currentRole, requiredRole) {
    return (ROLE_ORDER[normalizeRole(currentRole)] ?? -1) >= (ROLE_ORDER[normalizeRole(requiredRole)] ?? 99);
  },
};

module.exports = governanceService;
