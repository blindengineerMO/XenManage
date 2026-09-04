const { settingsModel } = require('../models/connection');
const { groupModel, userModel } = require('../models/security-db');

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

function normalizeWindowDays(days) {
  const fallback = [1, 2, 3, 4, 5];
  if (!Array.isArray(days) || days.length === 0) return fallback;
  const unique = [...new Set(days.map((day) => Number(day)).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))];
  return unique.length ? unique.sort() : fallback;
}

function normalizeWindowMinute(minute, fallback) {
  const value = Number(minute);
  return Number.isInteger(value) && value >= 0 && value <= 1440 ? value : fallback;
}

// Security + Infrastructure approval: entity types are bucketed into one of
// two governance domains so an approval decision can be routed to the local
// group configured for that domain. Entity types outside both sets (alerts,
// tasks, catalog entries, retention domains, etc.) are left ungated - see
// plan.md item 4.
const SECURITY_APPROVAL_ENTITY_TYPES = new Set([
  'user', 'group', 'policy', 'credential', 'vault', 'session',
  'control-plane-backup', 'settings-section', 'catalog_role',
]);
const INFRASTRUCTURE_APPROVAL_ENTITY_TYPES = new Set([
  'vm', 'vm-snapshot', 'host', 'host-target', 'pool', 'network', 'sr', 'vdi',
  'vif', 'vlan', 'bond', 'managed-target', 'connection', 'template',
  'template-library-folder', 'template-library-item', 'workflow', 'compose',
]);

function resolveApprovalDomain(entityType) {
  if (SECURITY_APPROVAL_ENTITY_TYPES.has(entityType)) return 'security';
  if (INFRASTRUCTURE_APPROVAL_ENTITY_TYPES.has(entityType)) return 'infrastructure';
  return null;
}

function normalizeApproverGroupId(value) {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : null;
}

function isWithinApprovalWindow(policy, now = new Date()) {
  const day = now.getUTCDay();
  if (!policy.approvalWindowDays.includes(day)) return false;

  const minuteOfDay = now.getUTCHours() * 60 + now.getUTCMinutes();
  const { approvalWindowStartMinute: start, approvalWindowEndMinute: end } = policy;

  if (start === end) return true; // zero-width window means "all day"
  if (start < end) return minuteOfDay >= start && minuteOfDay < end;
  return minuteOfDay >= start || minuteOfDay < end; // window wraps past midnight UTC
}

function normalizeApproval(record = {}) {
  const expired = ['pending', 'approved', 'awaiting_second_approval'].includes(record.status) && isExpired(record.expiresAt);
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
    firstApprovedBy: record.firstApprovedBy || '',
    firstApprovedAt: record.firstApprovedAt || '',
    firstApprovalNotes: record.firstApprovalNotes || '',
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
      requireApproverDifferentFromRequester: false,
      requireTwoPersonApproval: false,
      requireScheduledApprovalWindow: false,
      approvalWindowDays: [1, 2, 3, 4, 5],
      approvalWindowStartMinute: 0,
      approvalWindowEndMinute: 1440,
      requireDomainApproverGroup: false,
      securityApproverGroupId: null,
      infrastructureApproverGroupId: null,
    });

    return {
      defaultRole: normalizeRole(stored.defaultRole),
      requireDestructiveApproval: Boolean(stored.requireDestructiveApproval),
      approvalTtlMinutes: Math.max(5, Math.min(10080, Number(stored.approvalTtlMinutes || 240))),
      requireApproverDifferentFromRequester: Boolean(stored.requireApproverDifferentFromRequester),
      requireTwoPersonApproval: Boolean(stored.requireTwoPersonApproval),
      requireScheduledApprovalWindow: Boolean(stored.requireScheduledApprovalWindow),
      approvalWindowDays: normalizeWindowDays(stored.approvalWindowDays),
      approvalWindowStartMinute: normalizeWindowMinute(stored.approvalWindowStartMinute, 0),
      approvalWindowEndMinute: normalizeWindowMinute(stored.approvalWindowEndMinute, 1440),
      requireDomainApproverGroup: Boolean(stored.requireDomainApproverGroup),
      securityApproverGroupId: normalizeApproverGroupId(stored.securityApproverGroupId),
      infrastructureApproverGroupId: normalizeApproverGroupId(stored.infrastructureApproverGroupId),
    };
  },

  updatePolicy(payload = {}) {
    const nextPolicy = {
      defaultRole: normalizeRole(payload.defaultRole),
      requireDestructiveApproval: Boolean(payload.requireDestructiveApproval),
      approvalTtlMinutes: Math.max(5, Math.min(10080, Number(payload.approvalTtlMinutes || 240))),
      requireApproverDifferentFromRequester: Boolean(payload.requireApproverDifferentFromRequester),
      requireTwoPersonApproval: Boolean(payload.requireTwoPersonApproval),
      requireScheduledApprovalWindow: Boolean(payload.requireScheduledApprovalWindow),
      approvalWindowDays: normalizeWindowDays(payload.approvalWindowDays),
      approvalWindowStartMinute: normalizeWindowMinute(payload.approvalWindowStartMinute, 0),
      approvalWindowEndMinute: normalizeWindowMinute(payload.approvalWindowEndMinute, 1440),
      requireDomainApproverGroup: Boolean(payload.requireDomainApproverGroup),
      securityApproverGroupId: normalizeApproverGroupId(payload.securityApproverGroupId),
      infrastructureApproverGroupId: normalizeApproverGroupId(payload.infrastructureApproverGroupId),
    };
    writeCollection(POLICY_KEY, nextPolicy);
    return nextPolicy;
  },

  getSessionRole(session = {}) {
    this.getBreakGlassState(session); // auto-reverts an expired elevation as a side effect
    return normalizeRole(session.governanceRole || this.getPolicy().defaultRole);
  },

  setSessionRole(session, role) {
    if (!session) return normalizeRole(role);
    session.governanceRole = normalizeRole(role);
    return session.governanceRole;
  },

  // Break-glass elevation: a time-boxed, justification-required escalation to
  // the admin session role for an account that would not otherwise reach it.
  // See plan.md item 4 - "Elevate to emergency administrator for 30 minutes,
  // justification required, optionally MFA required, all actions highlighted
  // in the audit log."
  getBreakGlassState(session = {}) {
    const state = session.breakGlass;
    if (!state || !state.active) return { active: false };
    if (isExpired(state.expiresAt)) {
      session.governanceRole = state.priorRole || session.governanceRole;
      session.breakGlass = { ...state, active: false, expiredAt: state.expiresAt };
      return session.breakGlass;
    }
    return state;
  },

  activateBreakGlass(session, payload = {}, activatedBy = 'system') {
    const justification = String(payload.justification || '').trim();
    if (justification.length < 10) {
      return { error: 'JUSTIFICATION_REQUIRED' };
    }

    const priorRole = this.getSessionRole(session);
    const activatedAt = new Date();
    const state = {
      active: true,
      activatedBy,
      activatedAt: activatedAt.toISOString(),
      expiresAt: new Date(activatedAt.getTime() + 30 * 60000).toISOString(),
      justification,
      priorRole,
      mfaVerified: Boolean(payload.mfaVerified),
    };

    session.breakGlass = state;
    session.governanceRole = 'admin';
    return state;
  },

  deactivateBreakGlass(session = {}) {
    const state = session.breakGlass;
    if (!state || !state.active) return { active: false };

    session.governanceRole = state.priorRole || session.governanceRole;
    session.breakGlass = { ...state, active: false, deactivatedAt: new Date().toISOString() };
    return session.breakGlass;
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

    // Separation-of-duties: when the policy requires it, the person who
    // requested an approval cannot also be the one who approves it
    // (self-rejection is still allowed - withdrawing your own request isn't
    // a privilege escalation). Opt-in and off by default, because a
    // single-administrator deployment relies on the same account lowering
    // its own session role and then raising it again to approve - see
    // plan.md item 4 ("configurable rather than inherent").
    const policy = this.getPolicy();

    const requestedBy = approvals[index].requestedBy;
    if (
      policy.requireApproverDifferentFromRequester
      && payload.decision !== 'rejected'
      && requestedBy
      && requestedBy !== 'system'
      && requestedBy === decidedBy
    ) {
      return { error: 'SELF_APPROVAL_NOT_ALLOWED' };
    }

    // Scheduled approval window: when the policy requires it, approving
    // decisions are only accepted during a configured recurring UTC window
    // (e.g. business-hours change windows). Rejections are never blocked -
    // withholding approval isn't the privilege the control guards against.
    // Opt-in and off by default - see plan.md item 4.
    if (
      policy.requireScheduledApprovalWindow
      && payload.decision !== 'rejected'
      && !isWithinApprovalWindow(policy)
    ) {
      return { error: 'OUTSIDE_APPROVAL_WINDOW' };
    }

    // Security + Infrastructure approval: when the policy requires it, an
    // approving decision for a request whose entity type falls in the
    // "security" or "infrastructure" domain must come from an operator who
    // is a member of that domain's configured local group. A domain without
    // a configured group is left ungated - the toggle is opt-in per domain,
    // not just per policy switch. Rejections are never blocked, matching the
    // other approval-gating modes above - see plan.md item 4.
    if (policy.requireDomainApproverGroup && payload.decision !== 'rejected') {
      const domain = resolveApprovalDomain(approvals[index].entityType);
      const groupId = domain === 'security'
        ? policy.securityApproverGroupId
        : domain === 'infrastructure'
          ? policy.infrastructureApproverGroupId
          : null;
      if (groupId) {
        const group = groupModel.getById(groupId);
        const approver = decidedBy && decidedBy !== 'system' ? userModel.getByUsername(decidedBy) : null;
        const isMember = Boolean(group && approver && group.member_ids.includes(approver.id));
        if (!isMember) {
          return { error: 'DOMAIN_APPROVER_REQUIRED', domain };
        }
      }
    }

    // Two-person approval: when the policy requires it, a single "approved"
    // decision only stages the request - it takes a second, distinct
    // approver to actually finalize it. Rejection by either the first or
    // second approver is immediate, since withholding approval isn't the
    // privilege the control guards against. Opt-in and off by default for
    // the same single-administrator reason as the check above - see
    // plan.md item 4.
    if (policy.requireTwoPersonApproval && payload.decision !== 'rejected') {
      const current = approvals[index];
      if (current.status === 'pending') {
        approvals[index] = normalizeApproval({
          ...current,
          status: 'awaiting_second_approval',
          firstApprovedBy: decidedBy,
          firstApprovedAt: new Date().toISOString(),
          firstApprovalNotes: payload.notes || '',
        });
        writeCollection(APPROVALS_KEY, approvals.slice(0, MAX_APPROVALS));
        return approvals[index];
      }
      if (current.status === 'awaiting_second_approval' && current.firstApprovedBy === decidedBy) {
        return { error: 'SECOND_APPROVER_MUST_DIFFER' };
      }
    }

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
