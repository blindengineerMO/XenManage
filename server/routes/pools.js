const express = require('express');
const router = express.Router();
const { validate, schemas } = require('../middleware/validate');
const auditLogService = require('../services/audit-log');
const { ensureMutationAllowed } = require('../middleware/governance');

async function safeGetPoolRecord(xenApi, ref) {
  try {
    return await xenApi.getRecord('pool', ref);
  } catch (error) {
    return null;
  }
}

router.get('/', async (req, res) => {
  try {
    const result = await req.xenApi.getPools();
    const pools = Object.entries(result.records)
      .map(([ref, r]) => ({ ref, ...r }));
    res.json({ total: pools.length, data: pools });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:ref', async (req, res) => {
  try {
    const record = await req.xenApi.getRecord('pool', req.params.ref);
    res.json({ ref: req.params.ref, ...record });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:ref/config',
  validate(schemas.opaqueRefParam, 'params'),
  validate(schemas.poolConfigUpdate),
  async (req, res) => {
    try {
      if (!ensureMutationAllowed(req, res, { actionKey: 'pool_config_update', entityType: 'pool', entityRef: req.params.ref })) return;
      const previousRecord = await safeGetPoolRecord(req.xenApi, req.params.ref);
      const record = await req.xenApi.updatePoolConfig(req.params.ref, req.body);
      auditLogService.record({
        category: 'pools',
        action: 'pool_config_updated',
        actionLabel: 'Updated pool configuration',
        entityType: 'pool',
        entityRef: req.params.ref,
        entityName: record.name_label || previousRecord?.name_label || req.params.ref,
        operator: req.session?.xenUser || 'system',
        route: '/pools',
        status: 'success',
        before: previousRecord,
        after: { ref: req.params.ref, ...record },
        detail: `Pool metadata saved as ${record.name_label || req.body.nameLabel || req.params.ref}.`,
      });
      res.json({ ref: req.params.ref, ...record });
    } catch (err) {
      res.status(err.status || 500).json({ error: err.code || err.message, message: err.message });
    }
  });

router.post('/:ref/ha',
  validate(schemas.opaqueRefParam, 'params'),
  validate(schemas.poolHaUpdate),
  async (req, res) => {
    try {
      if (!ensureMutationAllowed(req, res, { actionKey: 'pool_ha_update', entityType: 'pool', entityRef: req.params.ref })) return;
      const previousRecord = await safeGetPoolRecord(req.xenApi, req.params.ref);
      const record = await req.xenApi.updatePoolHaState(req.params.ref, req.body);
      auditLogService.record({
        category: 'pools',
        action: req.body.enabled ? 'pool_ha_enabled' : 'pool_ha_disabled',
        actionLabel: req.body.enabled ? 'Enabled pool HA' : 'Disabled pool HA',
        entityType: 'pool',
        entityRef: req.params.ref,
        entityName: record.name_label || previousRecord?.name_label || req.params.ref,
        operator: req.session?.xenUser || 'system',
        route: '/pools',
        status: 'success',
        before: previousRecord,
        after: { ref: req.params.ref, ...record },
        detail: req.body.enabled
          ? previousRecord?.ha_enabled
            ? `High availability planner target set to ${req.body.haHostFailuresToTolerate} host failure(s).`
            : `High availability enabled using ${(req.body.heartbeatSrRefs || []).length} heartbeat storage repository path(s) with a ${req.body.haHostFailuresToTolerate} host-failure target.`
          : 'High availability disabled for the selected pool.',
      });
      res.json({ ref: req.params.ref, ...record });
    } catch (err) {
      res.status(err.status || 500).json({ error: err.code || err.message, message: err.message });
    }
  });

module.exports = router;
