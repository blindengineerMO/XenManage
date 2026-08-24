const express = require('express');
const { validate, schemas } = require('../middleware/validate');
const governanceService = require('../services/governance');
const auditLogService = require('../services/audit-log');

const router = express.Router();

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
    const [poolsResult, hostsResult, vmsResult] = await Promise.all([
      req.xenApi.getPools(),
      req.xenApi.getHosts(),
      req.xenApi.getVMs(),
    ]);

    const pools = mapPools(poolsResult.records || {});
    const hosts = mapHosts(hostsResult.records || {});
    const vms = mapVms(vmsResult.records || {});
    const quotas = governanceService.listQuotas();
    const approvals = governanceService.listApprovals();
    const policy = governanceService.getPolicy();
    const currentRole = governanceService.getSessionRole(req.session);
    const quotaRows = buildQuotaRows(pools, hosts, vms, quotas);

    res.json({
      generatedAt: new Date().toISOString(),
      policy,
      currentRole,
      quotas,
      approvals,
      quotaRows,
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

router.put('/policy', validate(schemas.governancePolicyUpdate), (req, res) => {
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
      operator: req.session?.xenUser || 'system',
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
    const previousRole = governanceService.getSessionRole(req.session);
    const nextRole = governanceService.setSessionRole(req.session, req.body.role);
    auditLogService.record({
      category: 'governance',
      action: 'governance_role_switched',
      actionLabel: 'Switched governance role for',
      entityType: 'session',
      entityRef: req.session?.id || 'session',
      entityName: req.session?.xenUser || 'session',
      operator: req.session?.xenUser || 'system',
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

router.put('/quotas/:ref', validate(schemas.opaqueRefParam, 'params'), validate(schemas.governanceQuotaUpdate), (req, res) => {
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
      operator: req.session?.xenUser || 'system',
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

router.delete('/quotas/:ref', validate(schemas.opaqueRefParam, 'params'), (req, res) => {
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
      operator: req.session?.xenUser || 'system',
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

router.post('/approvals', validate(schemas.governanceApprovalRequest), (req, res) => {
  try {
    const approval = governanceService.requestApproval(req.body, req.session?.xenUser || 'system');
    auditLogService.record({
      category: 'governance',
      action: 'governance_approval_requested',
      actionLabel: 'Requested governance approval for',
      entityType: req.body.entityType,
      entityRef: req.body.entityRef,
      entityName: req.body.entityName || req.body.entityRef,
      operator: req.session?.xenUser || 'system',
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

router.post('/approvals/:id/decision', validate(schemas.governanceApprovalDecision), (req, res) => {
  try {
    const previous = governanceService.listApprovals().find((record) => record.id === req.params.id) || null;
    const approval = governanceService.decideApproval(req.params.id, req.body, req.session?.xenUser || 'system');
    if (!approval) {
      return res.status(404).json({ error: 'APPROVAL_NOT_FOUND' });
    }
    auditLogService.record({
      category: 'governance',
      action: req.body.decision === 'rejected' ? 'governance_approval_rejected' : 'governance_approval_approved',
      actionLabel: req.body.decision === 'rejected' ? 'Rejected governance approval for' : 'Approved governance approval for',
      entityType: approval.entityType,
      entityRef: approval.entityRef,
      entityName: approval.entityName || approval.entityRef,
      operator: req.session?.xenUser || 'system',
      route: '/governance',
      status: req.body.decision === 'rejected' ? 'warning' : 'success',
      before: previous,
      after: approval,
      detail: `${approval.actionKey} request is now ${approval.status}.`,
    });
    res.json(approval);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
