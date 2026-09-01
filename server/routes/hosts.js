const express = require('express');
const router = express.Router();
const { validate, schemas } = require('../middleware/validate');
const auditLogService = require('../services/audit-log');
const { ensureMutationAllowed } = require('../middleware/governance');

async function safeGetHostRecord(xenApi, ref) {
  try {
    return await xenApi.getRecord('host', ref);
  } catch (error) {
    return null;
  }
}

router.get('/', async (req, res) => {
  try {
    const result = await req.xenApi.getHosts();
    const hosts = Object.entries(result.records)
      .map(([ref, r]) => ({ ref, ...r }));
    res.json({ total: hosts.length, data: hosts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:ref', validate(schemas.opaqueRefParam, 'params'), async (req, res) => {
  try {
    const record = await req.xenApi.getRecord('host', req.params.ref);
    res.json({ ref: req.params.ref, ...record });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:ref/metrics', validate(schemas.opaqueRefParam, 'params'), async (req, res) => {
  try {
    const metrics = await req.xenApi.getHostMetrics(req.params.ref);
    res.json(metrics);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put(
  '/:ref/config',
  validate(schemas.opaqueRefParam, 'params'),
  validate(schemas.hostConfigUpdate),
  async (req, res) => {
    try {
      if (!ensureMutationAllowed(req, res, { actionKey: 'host_config_update', entityType: 'host', entityRef: req.params.ref })) return;
      const previousRecord = await safeGetHostRecord(req.xenApi, req.params.ref);
      const record = await req.xenApi.updateHostConfig(req.params.ref, req.body);

      auditLogService.record({
        category: 'hosts',
        action: 'host_config_updated',
        actionLabel: 'Updated host configuration',
        entityType: 'host',
        entityRef: req.params.ref,
        entityName: record.name_label || previousRecord?.name_label || req.params.ref,
        operator: req.session?.appUsername || req.session?.xenUser || 'system',
        route: '/hosts',
        status: 'success',
        before: previousRecord,
        after: { ref: req.params.ref, ...record },
        detail: `Host configuration saved as ${record.name_label || req.body.nameLabel || req.params.ref}.`,
      });

      res.json({ ref: req.params.ref, ...record });
    } catch (err) {
      res.status(err.status || 500).json({ error: err.code || err.message, message: err.message });
    }
  }
);

router.post(
  '/:ref/maintenance/enter',
  validate(schemas.opaqueRefParam, 'params'),
  validate(schemas.hostMaintenanceEnter),
  async (req, res) => {
    try {
      if (!ensureMutationAllowed(req, res, { actionKey: 'host_maintenance_enter', entityType: 'host', entityRef: req.params.ref })) return;
      const previousRecord = await safeGetHostRecord(req.xenApi, req.params.ref);
      const record = await req.xenApi.enterHostMaintenance(req.params.ref, req.body);

      auditLogService.record({
        category: 'hosts',
        action: 'host_maintenance_entered',
        actionLabel: 'Entered maintenance mode for',
        entityType: 'host',
        entityRef: req.params.ref,
        entityName: record.name_label || previousRecord?.name_label || req.params.ref,
        operator: req.session?.appUsername || req.session?.xenUser || 'system',
        route: '/hosts',
        status: 'success',
        before: previousRecord,
        after: record,
        detail: req.body.evacuateRunningVms
          ? `${record.name_label || req.params.ref} entered maintenance mode after evacuation planning on network ${req.body.networkRef}.`
          : `${record.name_label || req.params.ref} entered maintenance mode without workload evacuation.`,
      });

      res.json(record);
    } catch (err) {
      const status = err.code === 'HOST_STILL_HAS_RUNNING_VMS' ? 409 : 500;
      res.status(status).json({ error: err.code || err.message, message: err.message });
    }
  }
);

router.post(
  '/:ref/maintenance/exit',
  validate(schemas.opaqueRefParam, 'params'),
  validate(schemas.hostMaintenanceExit),
  async (req, res) => {
    try {
      if (!ensureMutationAllowed(req, res, { actionKey: 'host_maintenance_exit', entityType: 'host', entityRef: req.params.ref })) return;
      const previousRecord = await safeGetHostRecord(req.xenApi, req.params.ref);
      const record = await req.xenApi.exitHostMaintenance(req.params.ref);

      auditLogService.record({
        category: 'hosts',
        action: 'host_maintenance_exited',
        actionLabel: 'Exited maintenance mode for',
        entityType: 'host',
        entityRef: req.params.ref,
        entityName: record.name_label || previousRecord?.name_label || req.params.ref,
        operator: req.session?.appUsername || req.session?.xenUser || 'system',
        route: '/hosts',
        status: 'success',
        before: previousRecord,
        after: record,
        detail: `${record.name_label || req.params.ref} was re-enabled for workload placement.`,
      });

      res.json(record);
    } catch (err) {
      res.status(500).json({ error: err.code || err.message, message: err.message });
    }
  }
);

router.post(
  '/:ref/reboot',
  validate(schemas.opaqueRefParam, 'params'),
  validate(schemas.hostPowerMutation),
  async (req, res) => {
    try {
      if (!ensureMutationAllowed(req, res, { actionKey: 'host_reboot', entityType: 'host', entityRef: req.params.ref, destructive: true })) return;
      const previousRecord = await safeGetHostRecord(req.xenApi, req.params.ref);
      await req.xenApi.rebootHost(req.params.ref);
      const record = await safeGetHostRecord(req.xenApi, req.params.ref);

      auditLogService.record({
        category: 'hosts',
        action: 'host_reboot_requested',
        actionLabel: 'Requested host reboot for',
        entityType: 'host',
        entityRef: req.params.ref,
        entityName: record?.name_label || previousRecord?.name_label || req.params.ref,
        operator: req.session?.appUsername || req.session?.xenUser || 'system',
        route: '/hosts',
        status: 'success',
        before: previousRecord,
        after: record || { ref: req.params.ref, rebootRequested: true },
        detail: `${record?.name_label || previousRecord?.name_label || req.params.ref} received a reboot request after evacuation and disablement checks.`,
      });

      res.json({ success: true, ref: req.params.ref });
    } catch (err) {
      res.status(500).json({ error: err.code || err.message, message: err.message });
    }
  }
);

router.post(
  '/:ref/shutdown',
  validate(schemas.opaqueRefParam, 'params'),
  validate(schemas.hostPowerMutation),
  async (req, res) => {
    try {
      if (!ensureMutationAllowed(req, res, { actionKey: 'host_shutdown', entityType: 'host', entityRef: req.params.ref, destructive: true })) return;
      const previousRecord = await safeGetHostRecord(req.xenApi, req.params.ref);
      await req.xenApi.shutdownHost(req.params.ref);
      const record = await safeGetHostRecord(req.xenApi, req.params.ref);

      auditLogService.record({
        category: 'hosts',
        action: 'host_shutdown_requested',
        actionLabel: 'Requested host shutdown for',
        entityType: 'host',
        entityRef: req.params.ref,
        entityName: record?.name_label || previousRecord?.name_label || req.params.ref,
        operator: req.session?.appUsername || req.session?.xenUser || 'system',
        route: '/hosts',
        status: 'success',
        before: previousRecord,
        after: record || { ref: req.params.ref, shutdownRequested: true },
        detail: `${record?.name_label || previousRecord?.name_label || req.params.ref} received a shutdown request after disablement and evacuation checks.`,
      });

      res.json({ success: true, ref: req.params.ref });
    } catch (err) {
      res.status(500).json({ error: err.code || err.message, message: err.message });
    }
  }
);

router.post(
  '/:ref/multipathing',
  validate(schemas.opaqueRefParam, 'params'),
  validate(schemas.hostMultipathingUpdate),
  async (req, res) => {
    try {
      if (!ensureMutationAllowed(req, res, { actionKey: 'host_multipathing_update', entityType: 'host', entityRef: req.params.ref, destructive: true })) return;
      const previousRecord = await safeGetHostRecord(req.xenApi, req.params.ref);
      const record = await req.xenApi.setHostMultipathing(req.params.ref, req.body);

      auditLogService.record({
        category: 'hosts',
        action: req.body.enabled ? 'host_multipathing_enabled' : 'host_multipathing_disabled',
        actionLabel: req.body.enabled ? 'Enabled storage multipathing for' : 'Disabled storage multipathing for',
        entityType: 'host',
        entityRef: req.params.ref,
        entityName: record.name_label || previousRecord?.name_label || req.params.ref,
        operator: req.session?.appUsername || req.session?.xenUser || 'system',
        route: '/hosts',
        status: 'success',
        before: previousRecord,
        after: record,
        detail: req.body.enabled
          ? `${record.name_label || req.params.ref} had its storage paths unplugged, multipathing enabled, and paths replugged.`
          : `${record.name_label || req.params.ref} had its storage paths unplugged, multipathing disabled, and paths replugged.`,
      });

      res.json(record);
    } catch (err) {
      res.status(err.status || 500).json({ error: err.code || err.message, message: err.message });
    }
  }
);

module.exports = router;
