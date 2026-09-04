const express = require('express');
const { validate, schemas } = require('../middleware/validate');
const governanceService = require('../services/governance');
const auditLogService = require('../services/audit-log');
const webPushService = require('../services/web-push');
const { userModel } = require('../models/security-db');
const identityService = require('../services/identity');
const profileService = require('../services/profile');

const router = express.Router();

function currentOperator(req) {
  return req.session?.appUsername || req.session?.xenUser || 'system';
}

function getSessionAccount(req) {
  if (!req.session?.userId) return null;
  return userModel.getById(req.session.userId);
}

function requireAdminSession(req, res, next) {
  const account = getSessionAccount(req);
  const sessionRole = governanceService.getSessionRole(req.session);

  // Break-glass elevation deliberately bypasses the account's real role - that's
  // the point of an emergency escalation. See governanceService.activateBreakGlass.
  if (governanceService.getBreakGlassState(req.session).active) {
    req.localAccount = account;
    req.breakGlassElevated = true;
    return next();
  }

  if (account && account.active && account.role !== 'admin') {
    return res.status(403).json({ error: 'ADMIN_ROLE_REQUIRED' });
  }

  if (sessionRole !== 'admin') {
    return res.status(403).json({ error: 'ADMIN_ROLE_REQUIRED' });
  }

  req.localAccount = account;
  next();
}

function mapPools(records = {}) {
  return Object.entries(records).map(([ref, record]) => ({ ref, ...record }));
}

function mapVms(records = {}) {
  return Object.entries(records).map(([ref, record]) => ({ ref, ...record }));
}

function mapHosts(records = {}) {
  return Object.entries(records).map(([ref, record]) => ({ ref, ...record }));
}

function resolveVmPoolRef(vm, hostsByRef) {
  if (vm.pool) return vm.pool;
  const host = hostsByRef[vm.resident_on] || hostsByRef[vm.affinity];
  return host?.pool || '';
}

function buildQuotaRows(pools, hosts, vms, quotas) {
  const hostsByRef = Object.fromEntries(hosts.map((host) => [host.ref, host]));
  const vmsByPool = vms
    .filter((vm) => !vm.is_a_template)
    .reduce((acc, vm) => {
      const poolRef = resolveVmPoolRef(vm, hostsByRef);
      if (!poolRef) return acc;
      if (!acc[poolRef]) acc[poolRef] = [];
      acc[poolRef].push(vm);
      return acc;
    }, {});

  return pools.map((pool) => {
    const quota = quotas.find((record) => record.poolRef === pool.ref) || null;
    const poolVms = vmsByPool[pool.ref] || [];
    const runningVmCount = poolVms.filter((vm) => String(vm.power_state || '').toLowerCase() === 'running').length;
    const totalMemoryGiB = Math.round(
      (poolVms.reduce((sum, vm) => sum + Number(vm.memory_static_max || vm.memory_dynamic_max || 0), 0) / (1024 ** 3)) * 10
    ) / 10;

    let status = 'success';
    let detail = 'No pool quota is currently enforced for this pool.';

    if (quota?.enabled) {
      const breaches = [];
      if (quota.maxVmCount > 0 && poolVms.length > quota.maxVmCount) breaches.push('VM count');
      if (quota.maxRunningVmCount > 0 && runningVmCount > quota.maxRunningVmCount) breaches.push('running VM count');
      if (quota.maxTotalMemoryGiB > 0 && totalMemoryGiB > quota.maxTotalMemoryGiB) breaches.push('memory allocation');

      if (breaches.length) {
        status = 'critical';
        detail = `Quota pressure is present for ${breaches.join(', ')}.`;
      } else {
        status = 'info';
        detail = 'Quota is configured and current usage remains within the allowed envelope.';
      }
    }

    return {
      poolRef: pool.ref,
      poolName: pool.name_label || pool.uuid || pool.ref,
      status,
      currentVmCount: poolVms.length,
      currentRunningVmCount: runningVmCount,
      currentTotalMemoryGiB: totalMemoryGiB,
      quota: quota || null,
      detail,
    };
  });
}

router.get('/', async (req, res) => {
  try {
    const [poolsResult, hostsResult, vmsResult] = req.xenApi
      ? await Promise.all([
        req.xenApi.getPools(),
        req.xenApi.getHosts(),
        req.xenApi.getVMs(),
      ])
      : [{ records: {} }, { records: {} }, { records: {} }];

    const pools = mapPools(poolsResult?.records || {});
    const hosts = mapHosts(hostsResult?.records || {});
    const vms = mapVms(vmsResult?.records || {});
    const quotas = governanceService.listQuotas();
    const approvals = governanceService.listApprovals();
    const policy = governanceService.getPolicy();
    const currentRole = governanceService.getSessionRole(req.session);
    const breakGlass = governanceService.getBreakGlassState(req.session);
    const quotaRows = buildQuotaRows(pools, hosts, vms, quotas);
    const userSummary = userModel.getSummary();

    res.json({
      generatedAt: new Date().toISOString(),
      policy,
      currentRole,
      breakGlass,
      quotas,
      approvals,
      quotaRows,
      userSummary,
      summary: {
        pendingApprovalCount: approvals.filter((entry) => entry.status === 'pending').length,
        approvedApprovalCount: approvals.filter((entry) => entry.status === 'approved').length,
        enforcedQuotaCount: quotas.filter((entry) => entry.enabled).length,
        poolCount: pools.length,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/policy', requireAdminSession, validate(schemas.governancePolicyUpdate), (req, res) => {
  try {
    const previous = governanceService.getPolicy();
    const policy = governanceService.updatePolicy(req.body);
    auditLogService.record({
      category: 'governance',
      action: 'governance_policy_saved',
      actionLabel: 'Saved governance policy for',
      entityType: 'policy',
      entityRef: 'governance.policy',
      entityName: 'Governance Policy',
      operator: currentOperator(req),
      route: '/governance',
      status: 'success',
      before: previous,
      after: policy,
      detail: `${policy.defaultRole} default role with ${policy.requireDestructiveApproval ? 'approval-gated' : 'direct'} destructive actions.`,
    });
    res.json(policy);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/role', validate(schemas.governanceRoleUpdate), (req, res) => {
  try {
    const account = getSessionAccount(req);
    const desiredRole = req.body.role;

    // A session bound to a local user (req.session.userId set) must resolve to an
    // active account to change role at all — fail closed rather than silently skipping
    // the escalation check if the account was deactivated or deleted after login.
    if (req.session?.userId && (!account || !account.active)) {
      return res.status(403).json({ error: 'ROLE_ESCALATION_NOT_ALLOWED' });
    }

    if (account && account.active && !governanceService.hasRole(account.role, desiredRole)) {
      return res.status(403).json({ error: 'ROLE_ESCALATION_NOT_ALLOWED' });
    }

    const previousRole = governanceService.getSessionRole(req.session);
    const nextRole = governanceService.setSessionRole(req.session, desiredRole);
    auditLogService.record({
      category: 'governance',
      action: 'governance_role_switched',
      actionLabel: 'Switched governance role for',
      entityType: 'session',
      entityRef: req.session?.id || 'session',
      entityName: currentOperator(req),
      operator: currentOperator(req),
      route: '/governance',
      status: 'success',
      before: { role: previousRole },
      after: { role: nextRole },
      detail: `Session role changed from ${previousRole} to ${nextRole}.`,
    });
    res.json({ role: nextRole });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/break-glass/activate', validate(schemas.breakGlassActivate), (req, res) => {
  try {
    const account = getSessionAccount(req);

    if (account?.mfa_enabled) {
      if (!req.body.mfaToken || !profileService.verifyMfaToken(account.id, req.body.mfaToken)) {
        return res.status(403).json({ error: 'MFA_REQUIRED', message: 'This account has MFA enabled. A valid MFA token is required to activate break-glass elevation.' });
      }
    }

    const previous = governanceService.getBreakGlassState(req.session);
    const state = governanceService.activateBreakGlass(req.session, { ...req.body, mfaVerified: Boolean(account?.mfa_enabled) }, currentOperator(req));
    if (state.error === 'JUSTIFICATION_REQUIRED') {
      return res.status(400).json({ error: 'JUSTIFICATION_REQUIRED', message: 'A justification of at least 10 characters is required to activate break-glass elevation.' });
    }

    auditLogService.record({
      category: 'governance',
      action: 'break_glass_activated',
      actionLabel: 'Activated break-glass elevation for',
      entityType: 'session',
      entityRef: req.session?.id || 'session',
      entityName: currentOperator(req),
      operator: currentOperator(req),
      route: '/governance',
      status: 'warning',
      before: previous,
      after: state,
      detail: `Emergency admin elevation activated until ${state.expiresAt}. Justification: ${state.justification}`,
    });
    res.status(201).json(state);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/break-glass/deactivate', (req, res) => {
  try {
    const previous = governanceService.getBreakGlassState(req.session);
    const state = governanceService.deactivateBreakGlass(req.session);
    if (previous.active) {
      auditLogService.record({
        category: 'governance',
        action: 'break_glass_deactivated',
        actionLabel: 'Deactivated break-glass elevation for',
        entityType: 'session',
        entityRef: req.session?.id || 'session',
        entityName: currentOperator(req),
        operator: currentOperator(req),
        route: '/governance',
        status: 'warning',
        before: previous,
        after: state,
        detail: 'Emergency admin elevation ended before its 30 minute window expired.',
      });
    }
    res.json(state);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/quotas/:ref', requireAdminSession, validate(schemas.opaqueRefParam, 'params'), validate(schemas.governanceQuotaUpdate), (req, res) => {
  try {
    const previous = governanceService.getQuota(req.params.ref);
    const quota = governanceService.upsertQuota(req.params.ref, req.body);
    auditLogService.record({
      category: 'governance',
      action: 'governance_quota_saved',
      actionLabel: 'Saved governance quota for',
      entityType: 'pool',
      entityRef: req.params.ref,
      entityName: req.params.ref,
      operator: currentOperator(req),
      route: '/governance',
      status: 'success',
      before: previous,
      after: quota,
      detail: `${quota.maxVmCount || 0} VM cap and ${quota.maxTotalMemoryGiB || 0} GiB cap configured.`,
    });
    res.json(quota);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/quotas/:ref', requireAdminSession, validate(schemas.opaqueRefParam, 'params'), (req, res) => {
  try {
    const previous = governanceService.getQuota(req.params.ref);
    const result = governanceService.removeQuota(req.params.ref);
    auditLogService.record({
      category: 'governance',
      action: 'governance_quota_removed',
      actionLabel: 'Removed governance quota for',
      entityType: 'pool',
      entityRef: req.params.ref,
      entityName: req.params.ref,
      operator: currentOperator(req),
      route: '/governance',
      status: 'success',
      before: previous,
      after: result,
      detail: 'Pool quota record removed from the governance policy store.',
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/permissions/:id', requireAdminSession, validate(schemas.userIdParam, 'params'), (req, res) => {
  const user = userModel.getById(req.params.id);
  if (!user) return res.status(404).json({ error: 'USER_NOT_FOUND' });
  res.json({ user, grants: identityService.permissionGrantModel.listForUser(user.id), roleTemplate: identityService.ROLE_TEMPLATES[user.role] || [] });
});

router.put('/permissions/:id', requireAdminSession, validate(schemas.userIdParam, 'params'), validate(schemas.permissionGrantCreate), (req, res) => {
  const user = userModel.getById(req.params.id);
  if (!user) return res.status(404).json({ error: 'USER_NOT_FOUND' });
  const grant = identityService.permissionGrantModel.upsert({
    userId: user.id,
    permission: req.body.permission,
    scopeType: req.body.scopeType,
    scopeRef: req.body.scopeRef,
    effect: req.body.effect,
    createdBy: req.session.userId,
  });
  auditLogService.record({
    category: 'governance', action: 'permission_grant_saved', actionLabel: 'Saved permission grant for',
    entityType: 'user', entityRef: String(user.id), entityName: user.username, operator: currentOperator(req),
    route: '/governance', status: 'success', before: null, after: grant,
    detail: `${grant.effect} ${grant.permission} at ${grant.scope_type}:${grant.scope_ref}.`,
  });
  res.json(grant);
});

router.delete('/permissions/grants/:id', requireAdminSession, validate(schemas.permissionGrantId, 'params'), (req, res) => {
  if (!identityService.permissionGrantModel.remove(req.params.id)) return res.status(404).json({ error: 'PERMISSION_GRANT_NOT_FOUND' });
  res.json({ success: true });
});

router.get('/api-tokens/:id', requireAdminSession, validate(schemas.userIdParam, 'params'), (req, res) => {
  const user = userModel.getById(req.params.id);
  if (!user) return res.status(404).json({ error: 'USER_NOT_FOUND' });
  res.json({ data: identityService.apiTokenModel.listForUser(user.id) });
});

router.post('/api-tokens/:id', requireAdminSession, validate(schemas.userIdParam, 'params'), validate(schemas.apiTokenCreate), (req, res) => {
  const user = userModel.getById(req.params.id);
  if (!user) return res.status(404).json({ error: 'USER_NOT_FOUND' });
  const token = identityService.createApiToken({ userId: user.id, ...req.body });
  auditLogService.record({
    category: 'governance', action: 'api_token_created', actionLabel: 'Created API token for',
    entityType: 'user', entityRef: String(user.id), entityName: user.username, operator: currentOperator(req),
    route: '/governance', status: 'success', before: null, after: { id: token.id, name: token.name, permissions: token.permissions },
    detail: `Created a scoped API token named ${token.name}.`,
  });
  res.status(201).json(token);
});

router.delete('/api-tokens/:id', requireAdminSession, validate(schemas.workflowId, 'params'), (req, res) => {
  if (!identityService.apiTokenModel.revoke(req.params.id)) return res.status(404).json({ error: 'API_TOKEN_NOT_FOUND' });
  res.json({ success: true });
});

router.post('/approvals', validate(schemas.governanceApprovalRequest), (req, res) => {
  try {
    const approval = governanceService.requestApproval(req.body, currentOperator(req));
    auditLogService.record({
      category: 'governance',
      action: 'governance_approval_requested',
      actionLabel: 'Requested governance approval for',
      entityType: req.body.entityType,
      entityRef: req.body.entityRef,
      entityName: req.body.entityName || req.body.entityRef,
      operator: currentOperator(req),
      route: '/governance',
      status: 'pending',
      before: null,
      after: approval,
      detail: `${approval.actionKey} requested with a pending approval window until ${approval.expiresAt}.`,
    });
    res.status(201).json(approval);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/approvals/:id/decision', requireAdminSession, validate(schemas.governanceApprovalDecision), (req, res) => {
  try {
    const previous = governanceService.listApprovals().find((record) => record.id === req.params.id) || null;
    const approval = governanceService.decideApproval(req.params.id, req.body, currentOperator(req));
    if (!approval) {
      return res.status(404).json({ error: 'APPROVAL_NOT_FOUND' });
    }
    if (approval.error === 'SELF_APPROVAL_NOT_ALLOWED') {
      return res.status(403).json({
        error: 'SELF_APPROVAL_NOT_ALLOWED',
        message: 'You requested this approval, so you cannot also approve it. A different administrator must decide it.',
      });
    }
    if (approval.error === 'SECOND_APPROVER_MUST_DIFFER') {
      return res.status(403).json({
        error: 'SECOND_APPROVER_MUST_DIFFER',
        message: 'This request already has a first approval from you. A different administrator must give the second approval.',
      });
    }
    if (approval.error === 'OUTSIDE_APPROVAL_WINDOW') {
      return res.status(403).json({
        error: 'OUTSIDE_APPROVAL_WINDOW',
        message: 'Approvals are only accepted during the configured scheduled approval window. Try again once the window opens, or reject the request.',
      });
    }
    if (approval.error === 'DOMAIN_APPROVER_REQUIRED') {
      return res.status(403).json({
        error: 'DOMAIN_APPROVER_REQUIRED',
        message: `This request falls under the ${approval.domain} domain, which requires an approver from the configured ${approval.domain} approver group.`,
      });
    }
    const staged = approval.status === 'awaiting_second_approval';
    auditLogService.record({
      category: 'governance',
      action: req.body.decision === 'rejected' ? 'governance_approval_rejected' : (staged ? 'governance_approval_first_approved' : 'governance_approval_approved'),
      actionLabel: req.body.decision === 'rejected' ? 'Rejected governance approval for' : (staged ? 'Recorded first approval for' : 'Approved governance approval for'),
      entityType: approval.entityType,
      entityRef: approval.entityRef,
      entityName: approval.entityName || approval.entityRef,
      operator: currentOperator(req),
      route: '/governance',
      status: req.body.decision === 'rejected' ? 'warning' : 'success',
      before: previous,
      after: approval,
      detail: staged
        ? `${approval.actionKey} request has one of two required approvals; awaiting a second, different approver.`
        : `${approval.actionKey} request is now ${approval.status}.`,
    });
    const requester = userModel.getByUsername(approval.requestedBy);
    if (requester) webPushService.notifyUser(requester.id, {
      title: 'Governance approval updated',
      body: `${approval.entityName || approval.entityRef}: ${approval.status}`,
      url: '/governance',
    }, 'approvals').catch(() => {});
    res.json(approval);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
