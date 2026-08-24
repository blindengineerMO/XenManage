const express = require('express');
const router = express.Router();
const { validate, schemas } = require('../middleware/validate');
const templateGovernanceService = require('../services/template-governance');
const auditLogService = require('../services/audit-log');
const governanceService = require('../services/governance');
const { ensureMutationAllowed } = require('../middleware/governance');

async function safeGetVmRecord(xenApi, ref) {
  try {
    return await xenApi.getRecord('VM', ref);
  } catch (error) {
    return null;
  }
}

function buildQuotaUsageForPool(poolRef, hosts = [], vms = []) {
  const hostPoolMap = Object.fromEntries(hosts.map((host) => [host.ref, host.pool || '']));
  const poolVms = vms.filter((vm) => {
    if (vm.is_a_template) return false;
    const pool = vm.pool || hostPoolMap[vm.resident_on] || hostPoolMap[vm.affinity] || '';
    return pool === poolRef;
  });

  return {
    vmCount: poolVms.length,
    runningVmCount: poolVms.filter((vm) => String(vm.power_state || '').toLowerCase() === 'running').length,
    totalMemoryGiB: poolVms.reduce((sum, vm) => sum + Number(vm.memory_static_max || vm.memory_dynamic_max || 0), 0) / (1024 ** 3),
  };
}

function evaluateQuotaBreach(quota, usage, requestedVm) {
  const nextVmCount = usage.vmCount + 1;
  const nextRunningVmCount = usage.runningVmCount + (requestedVm.startAfter ? 1 : 0);
  const nextTotalMemoryGiB = usage.totalMemoryGiB + (Number(requestedVm.memoryStaticMax || 0) / (1024 ** 3));
  const breaches = [];

  if (quota.maxVmCount > 0 && nextVmCount > quota.maxVmCount) breaches.push('VM count');
  if (quota.maxRunningVmCount > 0 && nextRunningVmCount > quota.maxRunningVmCount) breaches.push('running VM count');
  if (quota.maxTotalMemoryGiB > 0 && nextTotalMemoryGiB > quota.maxTotalMemoryGiB) breaches.push('memory allocation');

  return {
    breaches,
    nextVmCount,
    nextRunningVmCount,
    nextTotalMemoryGiB: Math.round(nextTotalMemoryGiB * 10) / 10,
  };
}

router.get('/', validate(schemas.paginate, 'query'), async (req, res) => {
  try {
    const { search } = req.query;
    const result = await req.xenApi.getVMs();
    let vms = Object.entries(result.records)
      .map(([ref, r]) => ({ ref, ...r }));

    // Filter out templates by default
    vms = vms.filter(vm => !vm.is_a_template);

    if (search) {
      const q = search.toLowerCase();
      vms = vms.filter(vm =>
        (vm.name_label || '').toLowerCase().includes(q) ||
        (vm.name_description || '').toLowerCase().includes(q)
      );
    }

    res.json({
      total: vms.length,
      data: vms,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/templates', async (req, res) => {
  try {
    const result = await req.xenApi.getVMs();
    const templates = Object.entries(result.records)
      .map(([ref, r]) => ({ ref, ...r }))
      .filter(vm => vm.is_a_template);
    res.json({ total: templates.length, data: templates });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/templates/governance', async (_req, res) => {
  try {
    const records = templateGovernanceService.listGovernance();
    res.json({ total: records.length, data: records });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/templates/:ref/governance', validate(schemas.opaqueRefParam, 'params'), validate(schemas.templateGovernanceUpdate), async (req, res) => {
  try {
    if (!ensureMutationAllowed(req, res, { actionKey: 'template_governance_save', entityType: 'template', entityRef: req.params.ref })) return;
    const previousRecord = templateGovernanceService.getGovernance(req.params.ref);
    const templateRecord = await safeGetVmRecord(req.xenApi, req.params.ref);
    const record = templateGovernanceService.upsertGovernance(req.params.ref, req.body);
    auditLogService.record({
      category: 'templates',
      action: 'template_governance_saved',
      actionLabel: 'Saved template governance for',
      entityType: 'template',
      entityRef: req.params.ref,
      entityName: record.versionLabel || req.params.ref,
      operator: req.session?.xenUser || 'system',
      route: '/templates',
      status: 'success',
      before: previousRecord,
      after: record,
      detail: `${record.lifecycleStage} stage with ${record.validationStatus} validation status.`,
    });
    res.json(record);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/templates/:ref/history', validate(schemas.opaqueRefParam, 'params'), async (req, res) => {
  try {
    const history = templateGovernanceService.listHistory(req.params.ref);
    res.json({ total: history.length, data: history });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/templates/:ref/promote',
  validate(schemas.opaqueRefParam, 'params'),
  validate(schemas.templatePromotion),
  async (req, res) => {
    try {
      if (!ensureMutationAllowed(req, res, { actionKey: 'template_promote', entityType: 'template', entityRef: req.params.ref })) return;
      const templateRecord = await safeGetVmRecord(req.xenApi, req.params.ref);
      const templateNames = Object.fromEntries((await req.xenApi.getVMs()
        .then((result) => Object.entries(result.records || {}).map(([ref, record]) => [ref, record?.name_label || ref]))
        .catch(() => [])));
      const previousRecord = templateGovernanceService.getGovernance(req.params.ref);
      const result = templateGovernanceService.promoteTemplate(req.params.ref, req.body, {
        actor: req.session?.appUsername || req.session?.xenUser || 'system',
        templateNames,
      });

      auditLogService.record({
        category: 'templates',
        action: 'template_promoted',
        actionLabel: 'Promoted template',
        entityType: 'template',
        entityRef: req.params.ref,
        entityName: templateRecord?.name_label || templateNames[req.params.ref] || req.params.ref,
        operator: req.session?.appUsername || req.session?.xenUser || 'system',
        route: '/templates',
        status: 'success',
        before: previousRecord,
        after: result.promoted,
        detail: `${result.promoted.versionLabel || req.params.ref} promoted to stable${result.deprecated.length ? ` and retired ${result.deprecated.length} previous baseline(s)` : ''}.`,
      });

      res.json({
        promoted: result.promoted,
        deprecated: result.deprecated,
        history: result.history,
      });
    } catch (err) {
      const code = err.code || err.message;
      if (code === 'TEMPLATE_GOVERNANCE_NOT_FOUND') {
        return res.status(404).json({ error: code });
      }
      if (code === 'PROMOTION_REQUIRES_VALIDATED_TEMPLATE') {
        return res.status(409).json({ error: code });
      }
      return res.status(500).json({ error: code || 'TEMPLATE_PROMOTION_FAILED' });
    }
  });

router.get('/templates/deployments', async (_req, res) => {
  try {
    const records = templateGovernanceService.listDeployments();
    res.json({ total: records.length, data: records });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/templates/deployments/:id/validation', validate(schemas.templateDeploymentValidationUpdate), async (req, res) => {
  try {
    if (!ensureMutationAllowed(req, res, { actionKey: 'template_deployment_validate', entityType: 'vm', entityRef: req.params.id })) return;
    const previousRecord = templateGovernanceService.listDeployments().find((entry) => entry.id === req.params.id) || null;
    const record = templateGovernanceService.updateDeploymentValidation(req.params.id, req.body);
    if (!record) {
      return res.status(404).json({ error: 'TEMPLATE_DEPLOYMENT_NOT_FOUND' });
    }
    auditLogService.record({
      category: 'templates',
      action: 'template_deployment_validated',
      actionLabel: 'Updated deployment validation for',
      entityType: 'vm',
      entityRef: record.vmRef || record.id,
      entityName: record.vmName || record.id,
      operator: req.session?.xenUser || 'system',
      route: '/templates',
      status: 'success',
      before: previousRecord,
      after: record,
      detail: `${record.validationStatus} validation with guest customization ${record.guestCustomization || 'unset'}.`,
    });
    res.json(record);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/templates/:ref/deploy', validate(schemas.templateDeploy), async (req, res) => {
  try {
    if (!ensureMutationAllowed(req, res, { actionKey: 'template_deploy', entityType: 'template', entityRef: req.params.ref })) return;
    if (req.body.hostRef) {
      const [hostsResult, vmsResult] = await Promise.all([
        req.xenApi.getHosts(),
        req.xenApi.getVMs(),
      ]);
      const hosts = Object.entries(hostsResult.records || {}).map(([ref, record]) => ({ ref, ...record }));
      const vms = Object.entries(vmsResult.records || {}).map(([ref, record]) => ({ ref, ...record }));
      const host = hosts.find((entry) => entry.ref === req.body.hostRef);
      const poolRef = host?.pool || '';
      const quota = poolRef ? governanceService.getQuota(poolRef) : null;

      if (quota?.enabled) {
        const usage = buildQuotaUsageForPool(poolRef, hosts, vms);
        const evaluation = evaluateQuotaBreach(quota, usage, req.body);
        if (evaluation.breaches.length) {
          return res.status(409).json({
            error: 'QUOTA_EXCEEDED',
            message: `The deployment would exceed the configured pool quota for ${evaluation.breaches.join(', ')}.`,
            quota,
            usage,
            evaluation,
          });
        }
      }
    }
    const templateRecord = await req.xenApi.getRecord('VM', req.params.ref);
    const record = await req.xenApi.deployTemplate(req.params.ref, req.body);
    const governance = templateGovernanceService.getGovernance(req.params.ref);
    const deploymentAudit = templateGovernanceService.recordDeployment({
      templateRef: req.params.ref,
      templateName: templateRecord?.name_label || req.params.ref,
      templateVersion: governance?.versionLabel || '',
      vmRef: record.ref,
      vmName: record.name_label || req.body.nameLabel,
      hostRef: req.body.hostRef || record.affinity || '',
      storageRef: req.body.storageRef || record.storageRef || '',
      networkRef: req.body.networkRef || '',
      startAfter: Boolean(req.body.startAfter),
      submittedBy: req.session?.xenUser || '',
      validationStatus: governance?.validationStatus === 'validated' ? 'pending' : 'warning',
      guestCustomization: governance?.guestCustomization || '',
      validationNotes: governance?.validationStatus === 'validated'
        ? 'Validate guest boot, networking, storage mapping, and policy tags after first start.'
        : 'Template governance is not fully validated yet. Review this deployment before promoting it.',
      bootVerified: false,
      networkVerified: false,
      storageVerified: false,
      policyTagged: Array.isArray(req.body.tags) && req.body.tags.length > 0,
    });
    auditLogService.record({
      category: 'templates',
      action: 'template_deployed',
      actionLabel: 'Deployed template to',
      entityType: 'vm',
      entityRef: record.ref,
      entityName: record.name_label || req.body.nameLabel,
      operator: req.session?.xenUser || 'system',
      route: '/templates',
      status: 'success',
      before: templateRecord,
      after: { ...record, deploymentAudit },
      detail: `${templateRecord?.name_label || req.params.ref} deployed with ${deploymentAudit.validationStatus} validation status.`,
    });
    res.status(201).json({ ...record, deploymentAudit });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:ref', async (req, res) => {
  try {
    const record = await req.xenApi.getRecord('VM', req.params.ref);
    res.json({ ref: req.params.ref, ...record });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:ref/config', validate(schemas.vmConfigUpdate), async (req, res) => {
  try {
    if (!ensureMutationAllowed(req, res, { actionKey: 'vm_config_update', entityType: 'vm', entityRef: req.params.ref })) return;
    const previousRecord = await safeGetVmRecord(req.xenApi, req.params.ref);
    const record = await req.xenApi.updateVMConfig(req.params.ref, req.body);
    auditLogService.record({
      category: 'vms',
      action: 'vm_config_updated',
      actionLabel: 'Updated VM configuration for',
      entityType: 'vm',
      entityRef: req.params.ref,
      entityName: record.name_label || previousRecord?.name_label || req.params.ref,
      operator: req.session?.xenUser || 'system',
      route: '/vms',
      status: 'success',
      before: previousRecord,
      after: { ref: req.params.ref, ...record },
      detail: `${req.body.vcpus} vCPU and ${req.body.memoryStaticMax} bytes configured.`,
    });
    res.json({ ref: req.params.ref, ...record });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:ref/disks', validate(schemas.vmDiskCreate), async (req, res) => {
  try {
    if (!ensureMutationAllowed(req, res, { actionKey: 'vm_disk_add', entityType: 'vm', entityRef: req.params.ref })) return;
    const previousRecord = await safeGetVmRecord(req.xenApi, req.params.ref);
    const result = await req.xenApi.addVMDisk(req.params.ref, req.body);
    const nextRecord = await safeGetVmRecord(req.xenApi, req.params.ref);
    auditLogService.record({
      category: 'vms',
      action: 'vm_disk_added',
      actionLabel: 'Added VM disk to',
      entityType: 'vm',
      entityRef: req.params.ref,
      entityName: nextRecord?.name_label || previousRecord?.name_label || req.params.ref,
      operator: req.session?.xenUser || 'system',
      route: '/vms',
      status: 'success',
      before: previousRecord,
      after: nextRecord || result,
      detail: `${req.body.nameLabel} on ${req.body.srRef} with ${req.body.sizeBytes} bytes.`,
    });
    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:ref/nics', validate(schemas.vmNicCreate), async (req, res) => {
  try {
    if (!ensureMutationAllowed(req, res, { actionKey: 'vm_nic_add', entityType: 'vm', entityRef: req.params.ref })) return;
    const previousRecord = await safeGetVmRecord(req.xenApi, req.params.ref);
    const result = await req.xenApi.addVMNic(req.params.ref, req.body);
    const nextRecord = await safeGetVmRecord(req.xenApi, req.params.ref);
    auditLogService.record({
      category: 'vms',
      action: 'vm_nic_added',
      actionLabel: 'Added VM network interface to',
      entityType: 'vm',
      entityRef: req.params.ref,
      entityName: nextRecord?.name_label || previousRecord?.name_label || req.params.ref,
      operator: req.session?.xenUser || 'system',
      route: '/vms',
      status: 'success',
      before: previousRecord,
      after: nextRecord || result,
      detail: `${req.body.networkRef} attached as device ${req.body.deviceLabel || 'auto'}.`,
    });
    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/start', validate(schemas.vmLifecycle), async (req, res) => {
  try {
    if (!ensureMutationAllowed(req, res, { actionKey: 'vm_start', entityType: 'vm', entityRef: req.body.ref })) return;
    const previousRecord = await safeGetVmRecord(req.xenApi, req.body.ref);
    await req.xenApi.startVM(req.body.ref, req.body.paused, req.body.force);
    const nextRecord = await safeGetVmRecord(req.xenApi, req.body.ref);
    auditLogService.record({
      category: 'vms',
      action: 'vm_started',
      actionLabel: 'Started VM',
      entityType: 'vm',
      entityRef: req.body.ref,
      entityName: nextRecord?.name_label || previousRecord?.name_label || req.body.ref,
      operator: req.session?.xenUser || 'system',
      route: '/vms',
      status: 'success',
      before: previousRecord,
      after: nextRecord || { ref: req.body.ref, power_state: 'Running' },
      detail: req.body.force ? 'Force start requested.' : 'Standard start requested.',
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/shutdown', validate(schemas.vmLifecycle), async (req, res) => {
  try {
    if (!ensureMutationAllowed(req, res, { actionKey: 'vm_shutdown', entityType: 'vm', entityRef: req.body.ref, destructive: true })) return;
    const previousRecord = await safeGetVmRecord(req.xenApi, req.body.ref);
    await req.xenApi.shutdownVM(req.body.ref, req.body.force);
    const nextRecord = await safeGetVmRecord(req.xenApi, req.body.ref);
    auditLogService.record({
      category: 'vms',
      action: 'vm_shutdown',
      actionLabel: req.body.force ? 'Forced off VM' : 'Shut down VM',
      entityType: 'vm',
      entityRef: req.body.ref,
      entityName: nextRecord?.name_label || previousRecord?.name_label || req.body.ref,
      operator: req.session?.xenUser || 'system',
      route: '/vms',
      status: 'success',
      before: previousRecord,
      after: nextRecord || { ref: req.body.ref, power_state: 'Halted' },
      detail: req.body.force ? 'Hard shutdown executed.' : 'Clean shutdown executed.',
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/reboot', validate(schemas.vmLifecycle), async (req, res) => {
  try {
    if (!ensureMutationAllowed(req, res, { actionKey: 'vm_reboot', entityType: 'vm', entityRef: req.body.ref, destructive: true })) return;
    const previousRecord = await safeGetVmRecord(req.xenApi, req.body.ref);
    await req.xenApi.rebootVM(req.body.ref, req.body.force);
    const nextRecord = await safeGetVmRecord(req.xenApi, req.body.ref);
    auditLogService.record({
      category: 'vms',
      action: 'vm_rebooted',
      actionLabel: req.body.force ? 'Force rebooted VM' : 'Rebooted VM',
      entityType: 'vm',
      entityRef: req.body.ref,
      entityName: nextRecord?.name_label || previousRecord?.name_label || req.body.ref,
      operator: req.session?.xenUser || 'system',
      route: '/vms',
      status: 'success',
      before: previousRecord,
      after: nextRecord || previousRecord || { ref: req.body.ref },
      detail: req.body.force ? 'Hard reboot executed.' : 'Clean reboot executed.',
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/suspend', validate(schemas.vmAction), async (req, res) => {
  try {
    if (!ensureMutationAllowed(req, res, { actionKey: 'vm_suspend', entityType: 'vm', entityRef: req.body.ref, destructive: true })) return;
    const previousRecord = await safeGetVmRecord(req.xenApi, req.body.ref);
    await req.xenApi.suspendVM(req.body.ref);
    const nextRecord = await safeGetVmRecord(req.xenApi, req.body.ref);
    auditLogService.record({
      category: 'vms',
      action: 'vm_suspended',
      actionLabel: 'Suspended VM',
      entityType: 'vm',
      entityRef: req.body.ref,
      entityName: nextRecord?.name_label || previousRecord?.name_label || req.body.ref,
      operator: req.session?.xenUser || 'system',
      route: '/vms',
      status: 'success',
      before: previousRecord,
      after: nextRecord || { ref: req.body.ref, power_state: 'Suspended' },
      detail: 'Suspend requested from operator workspace.',
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/resume', validate(schemas.vmLifecycle), async (req, res) => {
  try {
    if (!ensureMutationAllowed(req, res, { actionKey: 'vm_resume', entityType: 'vm', entityRef: req.body.ref })) return;
    const previousRecord = await safeGetVmRecord(req.xenApi, req.body.ref);
    await req.xenApi.resumeVM(req.body.ref, req.body.paused);
    const nextRecord = await safeGetVmRecord(req.xenApi, req.body.ref);
    auditLogService.record({
      category: 'vms',
      action: 'vm_resumed',
      actionLabel: 'Resumed VM',
      entityType: 'vm',
      entityRef: req.body.ref,
      entityName: nextRecord?.name_label || previousRecord?.name_label || req.body.ref,
      operator: req.session?.xenUser || 'system',
      route: '/vms',
      status: 'success',
      before: previousRecord,
      after: nextRecord || { ref: req.body.ref, power_state: 'Running' },
      detail: req.body.paused ? 'Resumed into paused state.' : 'Resumed into running state.',
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
