const express = require('express');
const router = express.Router();
const { validate, schemas } = require('../middleware/validate');
const { getConnection, rehydrateConnection } = require('../services/xenapi');
const templateGovernanceService = require('../services/template-governance');
const templateDeploymentRunService = require('../services/template-deployment-runs');
const auditLogService = require('../services/audit-log');
const governanceService = require('../services/governance');
const { enforceVFabricQuotas } = require('../services/vfabric-quota');
const { enforceProjectQuota } = require('../services/projects');
const { projectModel } = require('../models/connection');
const { resolveActor } = require('../services/resource-ownership');
const { ensureMutationAllowed } = require('../middleware/governance');
const { planCompose, executeCompose } = require('../services/deployment-engine');
const { buildBundledOsProfiles } = require('../services/os-profiles');
const { deployTemplate } = require('../services/template-deployment');
const { enforcePoolQuota } = require('../services/pool-quota');

async function safeGetVmRecord(xenApi, ref) {
  try {
    return await xenApi.getRecord('VM', ref);
  } catch (error) {
    return null;
  }
}

async function safeGetVmSnapshot(xenApi, vmRef, snapshotRef) {
  try {
    const snapshots = await xenApi.getVMSnapshots(vmRef);
    return snapshots.find((entry) => entry.ref === snapshotRef) || null;
  } catch (error) {
    return null;
  }
}

async function safeGetHostRecord(xenApi, ref) {
  try {
    return await xenApi.getRecord('host', ref);
  } catch (error) {
    return null;
  }
}

async function safeGetSrRecord(xenApi, ref) {
  try {
    return await xenApi.getRecord('SR', ref);
  } catch (error) {
    return null;
  }
}

async function safeGetVmGuestMetricsRecord(xenApi, ref) {
  try {
    return await xenApi.getRecord('VM_guest_metrics', ref);
  } catch (error) {
    return null;
  }
}

function createRouteError(code, message = code, status = 400) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

function escapeHtml(value = '') {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function findSessionTarget(session = {}, targetKey = '') {
  const normalizedTargetKey = String(targetKey || '').trim();
  if (!normalizedTargetKey) return null;

  return (Array.isArray(session?.xenTargets) ? session.xenTargets : []).find((target) =>
    String(target?.targetKey || '').trim() === normalizedTargetKey
  ) || null;
}

function sanitizeArchiveName(value, fallback = 'vm') {
  return String(value || fallback)
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    || fallback;
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

router.get('/creation-sources', async (req, res) => {
  try {
    const sources = await req.xenApi.getVmCreationSources();
    const bundledOperatingSystems = buildBundledOsProfiles(sources.operatingSystems);
    const bundledById = new Map(bundledOperatingSystems.map((profile) => [profile.profileId, profile]));
    const operatingSystems = sources.operatingSystems.map((source) => {
      const baseProfile = bundledById.get(source.other_config?.['xenmange:base-os-profile']);
      return baseProfile ? { ...source, defaults: baseProfile.defaults } : source;
    });
    res.json({
      operatingSystems,
      bundledOperatingSystems,
      deployableTemplates: sources.deployableTemplates,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/templates', validate(schemas.templateCreate), async (req, res) => {
  try {
    if (!ensureMutationAllowed(req, res, { actionKey: 'template_create', entityType: 'template', entityRef: 'new' })) return;
    const template = await req.xenApi.createVmTemplate(req.body);
    auditLogService.record({
      category: 'templates', action: 'template_created', actionLabel: 'Created template',
      entityType: 'template', entityRef: template.ref, entityName: template.name_label || req.body.nameLabel,
      operator: req.session?.appUsername || req.session?.xenUser || 'system', route: '/templates', status: 'success', after: template,
      detail: req.body.kind === 'operating-system' ? 'Created an operating-system installation profile.' : 'Created a deployable golden template from a VM copy.',
    });
    res.status(201).json(template);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.get('/groups', async (req, res) => {
  try {
    const result = await req.xenApi.getVMGroups();
    const groups = Object.entries(result.records || {}).map(([ref, record]) => ({ ref, ...record }));
    res.json({ total: groups.length, data: groups });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/gpu-profiles', async (req, res) => {
  try {
    const result = await req.xenApi.getVmGpuProfiles();
    const profiles = Object.entries(result.records || {}).map(([ref, record]) => ({ ref, ...record }));
    res.json({ total: profiles.length, data: profiles });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', validate(schemas.vmCreate), async (req, res) => {
  try {
    const nameLabel = String(req.body?.nameLabel || '').trim();
    if (!nameLabel) return res.status(400).json({ error: 'nameLabel is required' });
    if (!ensureMutationAllowed(req, res, { actionKey: 'vm_create', entityType: 'vm', entityRef: 'new' })) return;
    if (req.body.projectId) {
      await enforceProjectQuota({
        projectId: req.body.projectId,
        actor: resolveActor(req),
        xenApi: req.xenApi,
        targetKey: req.xenTarget?.targetKey || '',
        requestedVm: req.body,
      });
    }
    const vm = await req.xenApi.provisionVM({ ...req.body, nameLabel });
    if (req.body.projectId) {
      projectModel.assignResource({
        projectId: req.body.projectId,
        managedTargetId: require('../services/managed-targets').parseManagedTargetKey(req.xenTarget?.targetKey),
        resourceType: 'vm',
        resourceRef: vm.ref,
      });
    }
    auditLogService.record({ category: 'vms', action: 'vm_created', actionLabel: 'Created VM', entityType: 'vm', entityRef: vm.ref, entityName: vm.name_label || nameLabel, operator: req.session?.appUsername || req.session?.xenUser || 'system', route: '/vms', status: 'success', after: vm });
    res.status(201).json(vm);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.get('/appliances', async (req, res) => {
  try {
    const result = await req.xenApi.getVMAppliances();
    const appliances = Object.entries(result.records || {})
      .map(([ref, record]) => ({ ref, ...record }));
    res.json({ total: appliances.length, data: appliances });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/snapshot-schedules', async (req, res) => {
  try {
    const result = await req.xenApi.getVMSnapshotSchedules();
    const snapshotSchedules = Object.entries(result.records || {})
      .map(([ref, record]) => ({ ref, ...record }));
    res.json({ total: snapshotSchedules.length, data: snapshotSchedules });
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

router.post('/templates/:ref/history/:id/restore',
  validate(schemas.templateHistoryRestoreParams, 'params'),
  async (req, res) => {
    try {
      if (!ensureMutationAllowed(req, res, { actionKey: 'template_governance_restore', entityType: 'template', entityRef: req.params.ref })) return;
      const previousRecord = templateGovernanceService.getGovernance(req.params.ref);
      const templateRecord = await safeGetVmRecord(req.xenApi, req.params.ref);
      const result = templateGovernanceService.restoreHistoryEntry(req.params.ref, req.params.id, {
        actor: req.session?.appUsername || req.session?.xenUser || 'system',
        templateName: templateRecord?.name_label || req.params.ref,
      });

      auditLogService.record({
        category: 'templates',
        action: 'template_governance_restored',
        actionLabel: 'Restored template governance for',
        entityType: 'template',
        entityRef: req.params.ref,
        entityName: templateRecord?.name_label || req.params.ref,
        operator: req.session?.appUsername || req.session?.xenUser || 'system',
        route: '/templates',
        status: 'success',
        before: previousRecord,
        after: result.record,
        detail: `Restored governance from ${result.sourceEntry.eventType || 'history'} snapshot ${result.sourceEntry.id}.`,
      });

      res.json(result);
    } catch (err) {
      const code = err.code || err.message;
      if (code === 'TEMPLATE_GOVERNANCE_HISTORY_NOT_FOUND') {
        return res.status(404).json({ error: code });
      }
      return res.status(500).json({ error: code || 'TEMPLATE_GOVERNANCE_RESTORE_FAILED' });
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
    const deploymentRun = templateDeploymentRunService.syncValidationByDeploymentAudit(record);
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
    res.json({ ...record, deploymentRun });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/templates/:ref/deploy', validate(schemas.templateDeploy), async (req, res) => {
  try {
    if (!ensureMutationAllowed(req, res, { actionKey: 'template_deploy', entityType: 'template', entityRef: req.params.ref })) return;
    await enforceVFabricQuotas(req, req.body);
    await enforcePoolQuota(req.xenApi, req.body);
    const deployment = await deployTemplate({
      xenApi: req.xenApi,
      templateRef: req.params.ref,
      payload: req.body,
      submittedBy: req.session?.xenUser || '',
      auditOperator: req.session?.xenUser || 'system',
    });
    res.status(201).json(deployment);
  } catch (err) {
    if (['VFABRIC_QUOTA_EXCEEDED', 'VFABRIC_QUOTA_SCOPE_INCOMPLETE', 'QUOTA_EXCEEDED'].includes(err.code)) {
      return res.status(err.status || 409).json({
        error: err.code,
        message: err.message,
        quota: err.quota,
        usage: err.usage,
        evaluation: err.evaluation,
      });
    }
    res.status(500).json({ error: err.message });
  }
});

router.post('/compose/dry-run', validate(schemas.composeDeploy), async (req, res) => {
  try {
    const plan = await planCompose(req.xenApi, req.body);
    res.json(plan);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.code || 'COMPOSE_PLAN_FAILED', message: err.message });
  }
});

router.post('/compose/deploy', validate(schemas.composeDeploy), async (req, res) => {
  try {
    if (!ensureMutationAllowed(req, res, { actionKey: 'compose_deploy', entityType: 'compose', entityRef: req.body.name })) return;
    const { run, failed } = await executeCompose(req.xenApi, req.body, {
      submittedBy: req.session?.xenUser || '',
      beforeDeploy: async (plan) => {
        await enforceVFabricQuotas(req, {
          startAfter: plan.startAfter,
          memoryStaticMax: plan.memoryStaticMax,
        });
        if (req.body.projectId) {
          await enforceProjectQuota({
            projectId: req.body.projectId,
            actor: resolveActor(req),
            xenApi: req.xenApi,
            targetKey: req.xenTarget?.targetKey || '',
            requestedVm: plan,
          });
        }
      },
      afterDeploy: async (plan, vm) => {
        if (!req.body.projectId) return;
        projectModel.assignResource({
          projectId: req.body.projectId,
          managedTargetId: require('../services/managed-targets').parseManagedTargetKey(req.xenTarget?.targetKey),
          resourceType: 'vm',
          resourceRef: vm.ref,
        });
      },
    });
    auditLogService.record({
      category: 'templates',
      action: 'compose_deployed',
      actionLabel: 'Deployed compose spec',
      entityType: 'compose',
      entityRef: req.body.name,
      entityName: req.body.name,
      operator: req.session?.xenUser || 'system',
      route: '/vms',
      status: failed ? 'warning' : 'success',
      before: null,
      after: run,
      detail: run.result,
    });
    res.status(failed ? 207 : 201).json(run);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.code || 'COMPOSE_DEPLOY_FAILED', message: err.message });
  }
});

router.get('/:ref/snapshots', validate(schemas.opaqueRefParam, 'params'), async (req, res) => {
  try {
    const snapshots = await req.xenApi.getVMSnapshots(req.params.ref);
    res.json({ total: snapshots.length, data: snapshots });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:ref/snapshots', validate(schemas.opaqueRefParam, 'params'), validate(schemas.vmSnapshotCreate), async (req, res) => {
  try {
    if (!ensureMutationAllowed(req, res, { actionKey: 'vm_snapshot_create', entityType: 'vm', entityRef: req.params.ref })) return;
    const previousRecord = await safeGetVmRecord(req.xenApi, req.params.ref);
    const snapshot = await req.xenApi.createVMSnapshot(req.params.ref, req.body);
    auditLogService.record({
      category: 'vms',
      action: 'vm_snapshot_created',
      actionLabel: req.body.mode === 'checkpoint' ? 'Created VM checkpoint for' : 'Created VM snapshot for',
      entityType: 'vm-snapshot',
      entityRef: snapshot.ref,
      entityName: snapshot.name_label || req.body.nameLabel,
      operator: req.session?.appUsername || req.session?.xenUser || 'system',
      route: '/vms',
      status: 'success',
      before: previousRecord,
      after: snapshot,
      detail: `${req.body.mode === 'checkpoint' ? 'Checkpoint' : 'Snapshot'} ${snapshot.name_label || req.body.nameLabel} captured from ${previousRecord?.name_label || req.params.ref}.`,
    });
    res.status(201).json(snapshot);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post(
  '/:ref/snapshots/:snapshotRef/revert',
  validate(schemas.vmSnapshotParams, 'params'),
  validate(schemas.vmSnapshotMutation),
  async (req, res) => {
    try {
      if (!ensureMutationAllowed(req, res, {
        actionKey: 'vm_snapshot_revert',
        entityType: 'vm-snapshot',
        entityRef: req.params.snapshotRef,
        destructive: true,
      })) return;
      const previousRecord = await safeGetVmRecord(req.xenApi, req.params.ref);
      const snapshot = await safeGetVmSnapshot(req.xenApi, req.params.ref, req.params.snapshotRef);
      await req.xenApi.revertVMSnapshot(req.params.snapshotRef);
      const nextRecord = await safeGetVmRecord(req.xenApi, req.params.ref);
      auditLogService.record({
        category: 'vms',
        action: 'vm_snapshot_reverted',
        actionLabel: 'Reverted VM to snapshot',
        entityType: 'vm',
        entityRef: req.params.ref,
        entityName: nextRecord?.name_label || previousRecord?.name_label || req.params.ref,
        operator: req.session?.appUsername || req.session?.xenUser || 'system',
        route: '/vms',
        status: 'success',
        before: previousRecord,
        after: nextRecord || previousRecord || { ref: req.params.ref },
        detail: `${previousRecord?.name_label || req.params.ref} reverted to ${snapshot?.name_label || req.params.snapshotRef}.`,
      });
      res.json({
        success: true,
        snapshotRef: req.params.snapshotRef,
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

router.delete(
  '/:ref/snapshots/:snapshotRef',
  validate(schemas.vmSnapshotParams, 'params'),
  validate(schemas.vmSnapshotMutation),
  async (req, res) => {
    try {
      if (!ensureMutationAllowed(req, res, {
        actionKey: 'vm_snapshot_delete',
        entityType: 'vm-snapshot',
        entityRef: req.params.snapshotRef,
        destructive: true,
      })) return;
      const snapshot = await safeGetVmSnapshot(req.xenApi, req.params.ref, req.params.snapshotRef);
      await req.xenApi.deleteVMSnapshot(req.params.snapshotRef);
      auditLogService.record({
        category: 'vms',
        action: 'vm_snapshot_deleted',
        actionLabel: 'Deleted VM snapshot',
        entityType: 'vm-snapshot',
        entityRef: req.params.snapshotRef,
        entityName: snapshot?.name_label || req.params.snapshotRef,
        operator: req.session?.appUsername || req.session?.xenUser || 'system',
        route: '/vms',
        status: 'success',
        before: snapshot,
        after: { ref: req.params.snapshotRef, deleted: true },
        detail: `${snapshot?.name_label || req.params.snapshotRef} was removed from the restore-point inventory for ${req.params.ref}.`,
      });
      res.json({
        success: true,
        snapshotRef: req.params.snapshotRef,
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

router.post('/:ref/duplicate', validate(schemas.opaqueRefParam, 'params'), validate(schemas.vmDuplicateCreate), async (req, res) => {
  try {
    if (!ensureMutationAllowed(req, res, { actionKey: 'vm_duplicate_create', entityType: 'vm', entityRef: req.params.ref })) return;
    const previousRecord = await safeGetVmRecord(req.xenApi, req.params.ref);
    const record = await req.xenApi.duplicateVM(req.params.ref, req.body);
    auditLogService.record({
      category: 'vms',
      action: req.body.mode === 'copy' ? 'vm_full_copy_created' : 'vm_clone_created',
      actionLabel: req.body.mode === 'copy' ? 'Created full VM copy from' : 'Created fast VM clone from',
      entityType: 'vm',
      entityRef: record.ref,
      entityName: record.name_label || req.body.nameLabel,
      operator: req.session?.appUsername || req.session?.xenUser || 'system',
      route: '/vms',
      status: 'success',
      before: previousRecord,
      after: record,
      detail: req.body.mode === 'copy'
        ? `${record.name_label || req.body.nameLabel} was full-copied from ${previousRecord?.name_label || req.params.ref} onto ${req.body.srRef}.`
        : `${record.name_label || req.body.nameLabel} was fast-cloned from ${previousRecord?.name_label || req.params.ref}.`,
    });
    res.status(201).json(record);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:ref/export', validate(schemas.opaqueRefParam, 'params'), validate(schemas.vmExportQuery, 'query'), async (req, res) => {
  try {
    const record = await safeGetVmRecord(req.xenApi, req.params.ref);
    const response = await req.xenApi.exportVM(req.params.ref, req.query);
    const archiveName = sanitizeArchiveName(record?.name_label || record?.uuid || req.params.ref, 'vm');
    const suffix = req.query.metadataOnly ? '-metadata' : '';

    auditLogService.record({
      category: 'vms',
      action: req.query.metadataOnly ? 'vm_metadata_exported' : 'vm_xva_exported',
      actionLabel: req.query.metadataOnly ? 'Exported VM metadata for' : 'Exported VM package for',
      entityType: 'vm',
      entityRef: req.params.ref,
      entityName: record?.name_label || req.params.ref,
      operator: req.session?.appUsername || req.session?.xenUser || 'system',
      route: '/vms',
      status: 'success',
      before: record,
      after: {
        ref: req.params.ref,
        metadataOnly: Boolean(req.query.metadataOnly),
      },
      detail: `${record?.name_label || req.params.ref} was exported as ${req.query.metadataOnly ? 'metadata-only' : 'a full XVA package'}.`,
    });

    res.status(response.status);
    res.setHeader('Content-Type', response.headers['content-type'] || 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      response.headers['content-disposition'] || `attachment; filename="${archiveName}${suffix}.xva"`
    );
    response.data.pipe(res);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.code || err.message });
  }
});

router.put('/import', validate(schemas.vmImportQuery, 'query'), async (req, res) => {
  try {
    const contentLength = req.headers['content-length'] || '';
    const fileName = String(req.headers['x-xenmange-filename'] || 'package.xva').trim() || 'package.xva';
    if (!contentLength && !req.headers['transfer-encoding']) {
      return res.status(400).json({ error: 'VM_IMPORT_BODY_REQUIRED' });
    }

    const beforeResult = await req.xenApi.getVMs();
    await req.xenApi.importVM(req, {
      srRef: req.query.srRef,
      restore: req.query.restore,
      force: req.query.force,
      metadataOnly: req.query.metadataOnly,
      contentLength,
    });
    const afterResult = await req.xenApi.getVMs();

    const beforeRefs = new Set(
      Object.entries(beforeResult.records || {})
        .filter(([, vm]) => !vm?.is_a_template)
        .map(([ref]) => ref)
    );
    const importedCandidates = Object.entries(afterResult.records || {})
      .filter(([ref, vm]) => !vm?.is_a_template && !beforeRefs.has(ref))
      .map(([ref, vm]) => ({ ref, ...vm }));
    const importedVm = importedCandidates[0] || null;

    auditLogService.record({
      category: 'vms',
      action: req.query.metadataOnly ? 'vm_metadata_imported' : 'vm_xva_imported',
      actionLabel: req.query.metadataOnly ? 'Imported VM metadata from' : 'Imported VM package from',
      entityType: 'vm',
      entityRef: importedVm?.ref || fileName,
      entityName: importedVm?.name_label || fileName,
      operator: req.session?.appUsername || req.session?.xenUser || 'system',
      route: '/vms',
      status: 'success',
      before: null,
      after: importedVm || { fileName, metadataOnly: Boolean(req.query.metadataOnly) },
      detail: `${fileName} was imported${importedVm?.name_label ? ` as ${importedVm.name_label}` : ''}${req.query.metadataOnly ? ' using metadata-only mode.' : '.'}`,
    });

    res.status(201).json({
      success: true,
      fileName,
      metadataOnly: Boolean(req.query.metadataOnly),
      importedVm,
    });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.code || err.message });
  }
});

router.post('/:ref/migrate', validate(schemas.opaqueRefParam, 'params'), validate(schemas.vmMigrationCreate), async (req, res) => {
  try {
    if (!ensureMutationAllowed(req, res, { actionKey: 'vm_migrate', entityType: 'vm', entityRef: req.params.ref })) return;
    const previousRecord = await safeGetVmRecord(req.xenApi, req.params.ref);
    let record;
    let auditAction = '';
    let auditLabel = '';
    let detail = '';

    if (req.body.mode === 'cross-pool') {
      const destinationTargetKey = String(req.body.destinationTargetKey || '').trim();
      const sourceTargetKey = String(req.xenTarget?.targetKey || '').trim();

      if (!destinationTargetKey) {
        throw createRouteError('DESTINATION_TARGET_REQUIRED', 'Choose a destination live target before submitting the migration.');
      }
      if (destinationTargetKey === sourceTargetKey) {
        throw createRouteError('DESTINATION_TARGET_MUST_DIFFER', 'Cross-pool migrations must use a different live target than the current source session.');
      }

      const destinationTarget = findSessionTarget(req.session, destinationTargetKey);
      if (!destinationTarget) {
        throw createRouteError('DESTINATION_TARGET_NOT_FOUND', 'The selected destination live target is no longer attached to this session.', 404);
      }

      const destinationApi = getConnection(req.session.id, destinationTargetKey)
        || rehydrateConnection(req.session.id, destinationTarget);
      if (!destinationApi) {
        throw createRouteError('DESTINATION_TARGET_NOT_CONNECTED', 'The selected destination live target could not be rehydrated.', 409);
      }

      const destinationStorage = await safeGetSrRecord(destinationApi, req.body.srRef);

      record = await req.xenApi.migrateVMToTarget(req.params.ref, destinationApi, req.body);
      auditAction = req.body.copy ? 'vm_cross_pool_copied' : 'vm_cross_pool_migrated';
      auditLabel = req.body.copy ? 'Copied VM to target fabric' : 'Migrated VM to target fabric';
      detail = `${previousRecord?.name_label || req.params.ref} moved to ${destinationTarget.connectionName || destinationTarget.host || destinationTargetKey} using ${record.migration_mode}${destinationStorage ? ` with disks landing on ${destinationStorage.name_label || req.body.srRef}` : ''}.`;
    } else {
      const targetHost = await safeGetHostRecord(req.xenApi, req.body.hostRef);
      record = await req.xenApi.migrateVM(req.params.ref, req.body);
      auditAction = record.migration_mode === 'live' ? 'vm_live_migrated' : 'vm_relocated';
      auditLabel = record.migration_mode === 'live' ? 'Live migrated VM' : 'Relocated VM';
      detail = `${previousRecord?.name_label || req.params.ref} moved to ${targetHost?.name_label || req.body.hostRef} via ${record.migration_mode === 'live' ? 'live migration' : 'relocation'}${req.body.setAsHomeServer ? (record.homeServerUpdated ? ', with home server affinity updated.' : ', but the home server affinity update still needs follow-up.') : '.'}`;
    }

    auditLogService.record({
      category: 'vms',
      action: auditAction,
      actionLabel: auditLabel,
      entityType: 'vm',
      entityRef: record.destinationVmRef || req.params.ref,
      entityName: record.name_label || previousRecord?.name_label || req.params.ref,
      operator: req.session?.appUsername || req.session?.xenUser || 'system',
      route: '/vms',
      status: 'success',
      before: previousRecord,
      after: record,
      detail,
    });
    res.json(record);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.code || err.message });
  }
});

router.get('/:ref/compatibility', validate(schemas.opaqueRefParam, 'params'), async (req, res) => {
  try {
    const report = await req.xenApi.getVMCompatibility(req.params.ref);
    res.json(report);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.code || err.message });
  }
});

router.get('/:ref/consoles', validate(schemas.opaqueRefParam, 'params'), async (req, res) => {
  try {
    const consoles = await req.xenApi.getVMConsoles(req.params.ref);
    res.json({
      total: consoles.length,
      data: consoles.map((consoleRecord) => ({
        ...consoleRecord,
        launchPath: `/api/vms/${encodeURIComponent(req.params.ref)}/consoles/${encodeURIComponent(consoleRecord.ref)}/launch`,
      })),
    });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.code || err.message });
  }
});

router.get('/:ref/consoles/:consoleRef/launch', validate(schemas.vmConsoleParams, 'params'), async (req, res) => {
  try {
    const consoles = await req.xenApi.getVMConsoles(req.params.ref);
    const consoleRecord = consoles.find((entry) => entry.ref === req.params.consoleRef) || null;
    if (!consoleRecord) {
      throw createRouteError('VM_CONSOLE_NOT_FOUND', 'The requested VM console record could not be found.', 404);
    }

    const consoleUrl = req.xenApi.buildConsoleLocationUrl(consoleRecord.location).toString();
    const vmRecord = await safeGetVmRecord(req.xenApi, req.params.ref);
    const title = `${vmRecord?.name_label || req.params.ref} Console`;
    const consolePath = `${req.baseUrl}/${encodeURIComponent(req.params.ref)}/consoles/${encodeURIComponent(req.params.consoleRef)}/launch`;

    res.status(200).type('html').send(`<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(title)}</title>
    <style>
      body { margin: 0; font-family: Arial, sans-serif; background: #07111f; color: #f4fbff; }
      .shell { min-height: 100vh; display: grid; place-items: center; padding: 24px; box-sizing: border-box; }
      .panel { width: min(780px, 100%); background: rgba(10, 22, 38, 0.94); border: 1px solid rgba(128, 212, 255, 0.24); border-radius: 20px; padding: 24px; box-shadow: 0 24px 60px rgba(0, 0, 0, 0.45); }
      h1 { margin: 0 0 10px; font-size: 28px; }
      p { margin: 0 0 14px; line-height: 1.6; color: #c9dfef; }
      .meta { font-family: "Courier New", monospace; font-size: 12px; color: #8ab8d0; word-break: break-all; margin: 14px 0 20px; }
      .actions { display: flex; gap: 12px; flex-wrap: wrap; }
      a, button { appearance: none; border: 0; border-radius: 999px; padding: 12px 18px; font-size: 14px; cursor: pointer; text-decoration: none; }
      .primary { background: linear-gradient(135deg, #3cc6ff, #0f89ff); color: #041320; font-weight: 700; }
      .secondary { background: rgba(255,255,255,0.08); color: #f4fbff; }
      iframe { width: 100%; min-height: 70vh; border: 0; border-radius: 16px; background: #03070c; margin-top: 20px; }
    </style>
  </head>
  <body>
    <div class="shell">
      <div class="panel">
        <h1>${escapeHtml(title)}</h1>
        <p>XenMange resolved the current session-authenticated console endpoint for this workload. If the remote console page allows framing it should appear below; if not, use the direct launch button.</p>
        <div class="meta">${escapeHtml(consoleUrl)}</div>
        <div class="actions">
          <a class="primary" href="${escapeHtml(consoleUrl)}" target="_self" rel="noreferrer">Open Console Directly</a>
          <a class="secondary" href="${escapeHtml(consolePath)}" target="_self" rel="noreferrer">Reload Launch View</a>
        </div>
        <iframe src="${escapeHtml(consoleUrl)}" title="${escapeHtml(title)}"></iframe>
      </div>
    </div>
  </body>
</html>`);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.code || err.message });
  }
});

router.get('/:ref', validate(schemas.opaqueRefParam, 'params'), async (req, res) => {
  try {
    const record = await req.xenApi.getRecord('VM', req.params.ref);
    const guestMetricsRef = String(record?.guest_metrics || '').trim();
    const guestMetricsRecord = guestMetricsRef && guestMetricsRef !== 'OpaqueRef:NULL'
      ? await safeGetVmGuestMetricsRecord(req.xenApi, guestMetricsRef)
      : null;
    res.json({
      ref: req.params.ref,
      ...record,
      guest_metrics_record: guestMetricsRecord
        ? { ref: guestMetricsRef, ...guestMetricsRecord }
        : null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:ref/config', validate(schemas.opaqueRefParam, 'params'), validate(schemas.vmConfigUpdate), async (req, res) => {
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
      detail: `startup ${req.body.vcpusAtStartup} vCPU, max ${req.body.vcpusMax} vCPU, static ${req.body.memoryStaticMin}-${req.body.memoryStaticMax} bytes, dynamic ${req.body.memoryDynamicMin}-${req.body.memoryDynamicMax} bytes configured.`,
    });
    res.json({ ref: req.params.ref, ...record });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:ref/disks', validate(schemas.opaqueRefParam, 'params'), validate(schemas.vmDiskCreate), async (req, res) => {
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

router.post('/:ref/nics', validate(schemas.opaqueRefParam, 'params'), validate(schemas.vmNicCreate), async (req, res) => {
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

router.post(
  '/:ref/nics/:vifRef/disconnect',
  validate(schemas.vmNicParams, 'params'),
  validate(schemas.vmNicDisconnect),
  async (req, res) => {
    try {
      if (!ensureMutationAllowed(req, res, { actionKey: 'vm_nic_disconnect', entityType: 'vm', entityRef: req.params.ref })) return;
      const previousRecord = await safeGetVmRecord(req.xenApi, req.params.ref);
      const result = await req.xenApi.disconnectVMNic(req.params.ref, req.params.vifRef, req.body);
      const nextRecord = await safeGetVmRecord(req.xenApi, req.params.ref);
      auditLogService.record({
        category: 'vms',
        action: 'vm_nic_disconnected',
        actionLabel: 'Disconnected VM network interface from',
        entityType: 'vm',
        entityRef: req.params.ref,
        entityName: nextRecord?.name_label || previousRecord?.name_label || req.params.ref,
        operator: req.session?.xenUser || 'system',
        route: '/vms',
        status: 'success',
        before: previousRecord,
        after: nextRecord || result,
        detail: result.alreadyDisconnected
          ? `${req.params.vifRef} was already detached from live traffic on ${result.networkRef || 'the selected network fabric'}.`
          : `${req.params.vifRef} was hot-unplugged from ${result.networkRef || 'the selected network fabric'}.`,
      });
      res.json(result);
    } catch (err) {
      res.status(err.status || 500).json({ error: err.code || err.message });
    }
  }
);

router.delete(
  '/:ref/nics/:vifRef',
  validate(schemas.vmNicParams, 'params'),
  validate(schemas.vmNicDelete),
  async (req, res) => {
    try {
      if (!ensureMutationAllowed(req, res, { actionKey: 'vm_nic_remove', entityType: 'vm', entityRef: req.params.ref })) return;
      const previousRecord = await safeGetVmRecord(req.xenApi, req.params.ref);
      const result = await req.xenApi.removeVMNic(req.params.ref, req.params.vifRef, req.body);
      const nextRecord = await safeGetVmRecord(req.xenApi, req.params.ref);
      auditLogService.record({
        category: 'vms',
        action: 'vm_nic_removed',
        actionLabel: 'Removed VM network interface from',
        entityType: 'vm',
        entityRef: req.params.ref,
        entityName: nextRecord?.name_label || previousRecord?.name_label || req.params.ref,
        operator: req.session?.xenUser || 'system',
        route: '/vms',
        status: 'success',
        before: previousRecord,
        after: nextRecord || result,
        detail: `${req.params.vifRef} was removed from ${result.networkRef || 'the selected network fabric'}.`,
      });
      res.json(result);
    } catch (err) {
      res.status(err.status || 500).json({ error: err.code || err.message });
    }
  }
);

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
