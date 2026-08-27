const express = require('express');
const router = express.Router();
const { validate, schemas } = require('../middleware/validate');
const auditLogService = require('../services/audit-log');
const { ensureMutationAllowed } = require('../middleware/governance');

async function safeGetSrRecord(xenApi, ref) {
  try {
    return await xenApi.getRecord('SR', ref);
  } catch (error) {
    return null;
  }
}

async function safeGetVdiRecord(xenApi, ref) {
  try {
    return await xenApi.getRecord('VDI', ref);
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

async function safeGetSrVdiRefs(xenApi, ref) {
  try {
    return await xenApi.getField('SR', ref, 'VDIs');
  } catch (error) {
    return [];
  }
}

function createRouteError(code, message = code, status = 400) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

router.get('/', async (req, res) => {
  try {
    const result = await req.xenApi.getSRs();
    const srs = Object.entries(result.records)
      .map(([ref, r]) => ({ ref, ...r }));
    res.json({ total: srs.length, data: srs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/',
  validate(schemas.storageSrCreate),
  async (req, res) => {
    try {
      if (!ensureMutationAllowed(req, res, { actionKey: 'sr_create', entityType: 'host', entityRef: req.body.hostRef })) return;
      const hostRecord = await safeGetHostRecord(req.xenApi, req.body.hostRef);
      const record = await req.xenApi.createStorageRepository(req.body);
      auditLogService.record({
        category: 'storage',
        action: 'sr_created',
        actionLabel: 'Created storage repository',
        entityType: 'sr',
        entityRef: record.ref,
        entityName: record.name_label || req.body.nameLabel || record.ref,
        operator: req.session?.xenUser || 'system',
        route: '/storage',
        status: 'success',
        before: hostRecord,
        after: record,
        detail: `${record.name_label || req.body.nameLabel || record.ref} (${req.body.type}) was created on ${hostRecord?.name_label || req.body.hostRef}.`,
      });
      res.status(201).json(record);
    } catch (err) {
      res.status(err.status || 500).json({ error: err.code || err.message, message: err.message });
    }
  });

router.post('/probe',
  validate(schemas.storageSrProbe),
  async (req, res) => {
    try {
      const result = await req.xenApi.probeStorageRepository(req.body);
      res.json(result);
    } catch (err) {
      res.status(err.status || 500).json({ error: err.code || err.message, message: err.message });
    }
  });

router.post('/import',
  validate(schemas.storageSrImport),
  async (req, res) => {
    try {
      if (!ensureMutationAllowed(req, res, { actionKey: 'sr_import', entityType: 'host', entityRef: req.body.hostRef })) return;
      const hostRecord = await safeGetHostRecord(req.xenApi, req.body.hostRef);
      const record = await req.xenApi.importStorageRepository(req.body);
      auditLogService.record({
        category: 'storage',
        action: record.introduced ? 'sr_introduced' : 'sr_attached',
        actionLabel: record.introduced ? 'Introduced storage repository' : 'Attached storage repository',
        entityType: 'sr',
        entityRef: record.ref,
        entityName: record.name_label || req.body.nameLabel || req.body.uuid,
        operator: req.session?.xenUser || 'system',
        route: '/storage',
        status: 'success',
        before: hostRecord,
        after: record,
        detail: record.alreadyAttached
          ? `${record.name_label || req.body.nameLabel || req.body.uuid} was already attached on ${hostRecord?.name_label || req.body.hostRef}; SR.scan refreshed the inventory.`
          : record.introduced
            ? `${record.name_label || req.body.nameLabel || req.body.uuid} was introduced by UUID ${req.body.uuid} and attached to ${hostRecord?.name_label || req.body.hostRef}.`
            : `${record.name_label || req.body.nameLabel || req.body.uuid} was attached to ${hostRecord?.name_label || req.body.hostRef} through a host-specific PBD path.`,
      });
      res.status(record.introduced ? 201 : 200).json(record);
    } catch (err) {
      res.status(err.status || 500).json({ error: err.code || err.message, message: err.message });
    }
  });

router.get('/:ref', validate(schemas.opaqueRefParam, 'params'), async (req, res) => {
  try {
    const record = await req.xenApi.getRecord('SR', req.params.ref);
    res.json({ ref: req.params.ref, ...record });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:ref/config',
  validate(schemas.opaqueRefParam, 'params'),
  validate(schemas.storageSrConfigUpdate),
  async (req, res) => {
    try {
      if (!ensureMutationAllowed(req, res, { actionKey: 'sr_config_update', entityType: 'sr', entityRef: req.params.ref })) return;
      const previousRecord = await safeGetSrRecord(req.xenApi, req.params.ref);
      const record = await req.xenApi.updateStorageConfig(req.params.ref, req.body);
      auditLogService.record({
        category: 'storage',
        action: 'sr_config_updated',
        actionLabel: 'Updated storage repository configuration',
        entityType: 'sr',
        entityRef: req.params.ref,
        entityName: record.name_label || previousRecord?.name_label || req.params.ref,
        operator: req.session?.xenUser || 'system',
        route: '/storage',
        status: 'success',
        before: previousRecord,
        after: { ref: req.params.ref, ...record },
        detail: `Repository metadata saved as ${record.name_label || req.body.nameLabel || req.params.ref}.`,
      });
      res.json({ ref: req.params.ref, ...record });
    } catch (err) {
      res.status(err.status || 500).json({ error: err.code || err.message, message: err.message });
    }
  });

router.get('/:ref/vdis', validate(schemas.opaqueRefParam, 'params'), async (req, res) => {
  try {
    const vdiRefs = await req.xenApi.getField('SR', req.params.ref, 'VDIs');
    const vdis = await Promise.all((vdiRefs || []).map(async (ref) => {
      const record = await req.xenApi.getRecord('VDI', ref);
      return { ref, ...record };
    }));
    res.json({ total: vdis.length, data: vdis });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:ref/rescan', validate(schemas.opaqueRefParam, 'params'), async (req, res) => {
  try {
    if (!ensureMutationAllowed(req, res, { actionKey: 'sr_rescan', entityType: 'sr', entityRef: req.params.ref })) return;
    const previousRecord = await safeGetSrRecord(req.xenApi, req.params.ref);
    const record = await req.xenApi.rescanSR(req.params.ref);
    auditLogService.record({
      category: 'storage',
      action: 'sr_rescanned',
      actionLabel: 'Rescanned storage repository',
      entityType: 'sr',
      entityRef: req.params.ref,
      entityName: record.name_label || previousRecord?.name_label || req.params.ref,
      operator: req.session?.xenUser || 'system',
      route: '/storage',
      status: 'success',
      before: previousRecord,
      after: record,
      detail: 'SR.scan completed and the repository inventory was refreshed.',
    });
    res.json(record);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:ref/repair', validate(schemas.opaqueRefParam, 'params'), async (req, res) => {
  try {
    if (!ensureMutationAllowed(req, res, { actionKey: 'sr_repair', entityType: 'sr', entityRef: req.params.ref })) return;
    const previousRecord = await safeGetSrRecord(req.xenApi, req.params.ref);
    const record = await req.xenApi.repairSR(req.params.ref);
    const reattachedCount = Number(record?.reattachedCount || 0);
    auditLogService.record({
      category: 'storage',
      action: 'sr_repaired',
      actionLabel: 'Repaired storage repository',
      entityType: 'sr',
      entityRef: req.params.ref,
      entityName: record.name_label || previousRecord?.name_label || req.params.ref,
      operator: req.session?.xenUser || 'system',
      route: '/storage',
      status: 'success',
      before: previousRecord,
      after: record,
      detail: reattachedCount
        ? `SR.update refreshed the repository metadata and replugged ${reattachedCount} detached PBD${reattachedCount === 1 ? '' : 's'}.`
        : 'SR.update refreshed the repository metadata and no detached PBDs required replugging.',
    });
    res.json(record);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.code || err.message, message: err.message });
  }
});

router.post('/:ref/local-cache',
  validate(schemas.opaqueRefParam, 'params'),
  validate(schemas.storageSrLocalCache),
  async (req, res) => {
    try {
      if (!ensureMutationAllowed(req, res, { actionKey: 'sr_local_cache_update', entityType: 'sr', entityRef: req.params.ref })) return;
      const previousRecord = await safeGetSrRecord(req.xenApi, req.params.ref);
      const hostRecord = await safeGetHostRecord(req.xenApi, req.body.hostRef);
      const record = await req.xenApi.setStorageLocalCache(req.params.ref, req.body);
      auditLogService.record({
        category: 'storage',
        action: req.body.enabled ? 'sr_local_cache_enabled' : 'sr_local_cache_disabled',
        actionLabel: req.body.enabled ? 'Enabled storage local cache' : 'Disabled storage local cache',
        entityType: 'sr',
        entityRef: req.params.ref,
        entityName: record.name_label || previousRecord?.name_label || req.params.ref,
        operator: req.session?.xenUser || 'system',
        route: '/storage',
        status: 'success',
        before: previousRecord,
        after: record,
        detail: req.body.enabled
          ? `${record.name_label || previousRecord?.name_label || req.params.ref} was assigned as a local cache SR on ${hostRecord?.name_label || req.body.hostRef}.`
          : `${record.name_label || previousRecord?.name_label || req.params.ref} local cache assignment was cleared on ${hostRecord?.name_label || req.body.hostRef}.`,
      });
      res.json(record);
    } catch (err) {
      res.status(err.status || 500).json({ error: err.code || err.message, message: err.message });
    }
  });

router.post('/:ref/forget',
  validate(schemas.opaqueRefParam, 'params'),
  validate(schemas.storageMutation),
  async (req, res) => {
    try {
      if (!ensureMutationAllowed(req, res, { actionKey: 'sr_forget', entityType: 'sr', entityRef: req.params.ref, destructive: true })) return;
      const previousRecord = await safeGetSrRecord(req.xenApi, req.params.ref);
      await req.xenApi.forgetSR(req.params.ref);
      auditLogService.record({
        category: 'storage',
        action: 'sr_forgotten',
        actionLabel: 'Forgot storage repository',
        entityType: 'sr',
        entityRef: req.params.ref,
        entityName: previousRecord?.name_label || req.params.ref,
        operator: req.session?.xenUser || 'system',
        route: '/storage',
        status: 'success',
        before: previousRecord,
        after: { ref: req.params.ref, forgotten: true },
        detail: `${previousRecord?.name_label || req.params.ref} was removed from the XenManage storage inventory without deleting the backing storage.`,
      });
      res.json({
        success: true,
        ref: req.params.ref,
      });
    } catch (err) {
      res.status(err.status || 500).json({ error: err.code || err.message, message: err.message });
    }
  });

router.post('/:ref/destroy',
  validate(schemas.opaqueRefParam, 'params'),
  validate(schemas.storageMutation),
  async (req, res) => {
    try {
      const previousRecord = await safeGetSrRecord(req.xenApi, req.params.ref);
      const vdiRefs = await safeGetSrVdiRefs(req.xenApi, req.params.ref);

      if (Array.isArray(vdiRefs) && vdiRefs.length) {
        throw createRouteError(
          'SR_DESTROY_REQUIRES_EMPTY_REPOSITORY',
          `Destroy requires an empty repository. ${vdiRefs.length} VDI${vdiRefs.length === 1 ? '' : 's'} still map to this storage repository.`,
          409
        );
      }

      if (!ensureMutationAllowed(req, res, { actionKey: 'sr_destroy', entityType: 'sr', entityRef: req.params.ref, destructive: true })) return;
      await req.xenApi.destroySR(req.params.ref);
      auditLogService.record({
        category: 'storage',
        action: 'sr_destroyed',
        actionLabel: 'Destroyed storage repository',
        entityType: 'sr',
        entityRef: req.params.ref,
        entityName: previousRecord?.name_label || req.params.ref,
        operator: req.session?.xenUser || 'system',
        route: '/storage',
        status: 'success',
        before: previousRecord,
        after: { ref: req.params.ref, destroyed: true },
        detail: `${previousRecord?.name_label || req.params.ref} was removed from inventory and its backing storage was destroyed.`,
      });
      res.json({
        success: true,
        ref: req.params.ref,
      });
    } catch (err) {
      res.status(err.status || 500).json({ error: err.code || err.message, message: err.message });
    }
  });

router.post('/:ref/vdis',
  validate(schemas.opaqueRefParam, 'params'),
  validate(schemas.storageVdiCreate),
  async (req, res) => {
    try {
      if (!ensureMutationAllowed(req, res, { actionKey: 'sr_vdi_create', entityType: 'sr', entityRef: req.params.ref })) return;
      const previousRecord = await safeGetSrRecord(req.xenApi, req.params.ref);
      const record = await req.xenApi.createStorageVdi(req.params.ref, req.body);
      const nextRecord = await safeGetSrRecord(req.xenApi, req.params.ref);
      auditLogService.record({
        category: 'storage',
        action: 'sr_vdi_created',
        actionLabel: 'Created detached VDI on',
        entityType: 'sr',
        entityRef: req.params.ref,
        entityName: nextRecord?.name_label || previousRecord?.name_label || req.params.ref,
        operator: req.session?.xenUser || 'system',
        route: '/storage',
        status: 'success',
        before: previousRecord,
        after: nextRecord || record,
        detail: `${req.body.nameLabel} (${req.body.type || 'user'}) with ${req.body.sizeBytes} bytes.`,
      });
      res.status(201).json(record);
    } catch (err) {
      res.status(err.status || 500).json({ error: err.code || err.message, message: err.message });
    }
  });

router.post('/:ref/vdis/:vdiRef/resize',
  validate(schemas.storageVdiResizeParams, 'params'),
  validate(schemas.storageVdiResize),
  async (req, res) => {
    try {
      if (!ensureMutationAllowed(req, res, { actionKey: 'vdi_resize', entityType: 'vdi', entityRef: req.params.vdiRef })) return;
      const previousRecord = await safeGetVdiRecord(req.xenApi, req.params.vdiRef);
      const srRecord = await safeGetSrRecord(req.xenApi, req.params.ref);
      const record = await req.xenApi.resizeStorageVdi(req.params.vdiRef, req.body.sizeBytes);
      auditLogService.record({
        category: 'storage',
        action: 'vdi_resized',
        actionLabel: 'Resized VDI',
        entityType: 'vdi',
        entityRef: req.params.vdiRef,
        entityName: record.name_label || previousRecord?.name_label || req.params.vdiRef,
        operator: req.session?.xenUser || 'system',
        route: '/storage',
        status: 'success',
        before: previousRecord,
        after: record,
        detail: `${record.name_label || req.params.vdiRef} resized to ${req.body.sizeBytes} bytes on ${srRecord?.name_label || req.params.ref}.`,
      });
      res.json(record);
    } catch (err) {
      res.status(err.status || 500).json({ error: err.code || err.message, message: err.message });
    }
  });

router.delete('/:ref/vdis/:vdiRef',
  validate(schemas.storageVdiResizeParams, 'params'),
  validate(schemas.storageMutation),
  async (req, res) => {
    try {
      const previousRecord = await safeGetVdiRecord(req.xenApi, req.params.vdiRef);
      const attachedVbdRefs = Array.isArray(previousRecord?.VBDs) ? previousRecord.VBDs : [];
      if (attachedVbdRefs.length) {
        throw createRouteError(
          'VDI_DELETE_REQUIRES_DETACHED_DISK',
          `Delete only supports detached VDIs. ${attachedVbdRefs.length} attachment path${attachedVbdRefs.length === 1 ? '' : 's'} still map to this disk.`,
          409
        );
      }

      if (!ensureMutationAllowed(req, res, { actionKey: 'vdi_delete', entityType: 'vdi', entityRef: req.params.vdiRef, destructive: true })) return;
      const srRecord = await safeGetSrRecord(req.xenApi, req.params.ref);
      await req.xenApi.deleteStorageVdi(req.params.vdiRef);
      auditLogService.record({
        category: 'storage',
        action: 'vdi_deleted',
        actionLabel: 'Deleted VDI',
        entityType: 'vdi',
        entityRef: req.params.vdiRef,
        entityName: previousRecord?.name_label || req.params.vdiRef,
        operator: req.session?.xenUser || 'system',
        route: '/storage',
        status: 'success',
        before: previousRecord,
        after: { ref: req.params.vdiRef, deleted: true },
        detail: `${previousRecord?.name_label || req.params.vdiRef} was removed from ${srRecord?.name_label || req.params.ref}.`,
      });
      res.json({
        success: true,
        vdiRef: req.params.vdiRef,
      });
    } catch (err) {
      res.status(err.status || 500).json({ error: err.code || err.message, message: err.message });
    }
  });

module.exports = router;
