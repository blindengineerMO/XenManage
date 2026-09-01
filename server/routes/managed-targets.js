const express = require('express');
const { validate, schemas } = require('../middleware/validate');
const { connectionModel } = require('../models/connection');
const managedTargetService = require('../services/managed-targets');
const auditLogService = require('../services/audit-log');
const { ensureMutationAllowed } = require('../middleware/governance');
const { resolveActor, canManageRecord } = require('../services/resource-ownership');

const router = express.Router();

router.get('/', (req, res) => {
  res.json(managedTargetService.list(resolveActor(req)));
});

router.post('/', validate(schemas.managedTargetCreate), async (req, res) => {
  if (!ensureMutationAllowed(req, res, { actionKey: 'managed_target_register', entityType: 'managed-target', entityRef: String(req.body.connectionId) })) return;
  const actor = resolveActor(req);
  const connection = connectionModel.getById(req.body.connectionId);
  if (!connection) return res.status(404).json({ error: 'CONNECTION_NOT_FOUND' });
  if (!canManageRecord(connection, actor)) return res.status(403).json({ error: 'CONNECTION_FORBIDDEN' });
  try {
    const target = managedTargetService.register(connection.id, { enabled: req.body.enabled });
    const checked = await managedTargetService.check(target.id);
    auditLogService.record({
      category: 'targets', action: 'managed_target_registered', actionLabel: 'Registered managed target',
      entityType: 'managed-target', entityRef: String(target.id), entityName: target.name,
      operator: actor.username, route: '/managed-targets', status: 'success', before: null, after: checked,
      detail: `Registered ${target.name} for control-plane managed connectivity.`,
    });
    res.status(201).json(checked);
  } catch (error) {
    res.status(400).json({ error: error.code || error.message });
  }
});

router.post('/:id/check', validate(schemas.managedTargetId, 'params'), async (req, res) => {
  const target = managedTargetService.get(req.params.id);
  if (!target) return res.status(404).json({ error: 'MANAGED_TARGET_NOT_FOUND' });
  const visible = managedTargetService.list(resolveActor(req)).some((entry) => entry.id === target.id);
  if (!visible) return res.status(403).json({ error: 'MANAGED_TARGET_FORBIDDEN' });
  res.json(await managedTargetService.check(target.id));
});

router.put('/:id', validate(schemas.managedTargetId, 'params'), validate(schemas.managedTargetUpdate), async (req, res) => {
  if (!ensureMutationAllowed(req, res, { actionKey: 'managed_target_update', entityType: 'managed-target', entityRef: String(req.params.id) })) return;
  const target = managedTargetService.get(req.params.id);
  if (!target) return res.status(404).json({ error: 'MANAGED_TARGET_NOT_FOUND' });
  const visible = managedTargetService.list(resolveActor(req)).some((entry) => entry.id === target.id);
  if (!visible) return res.status(403).json({ error: 'MANAGED_TARGET_FORBIDDEN' });
  const updated = await managedTargetService.setEnabled(target.id, req.body.enabled);
  res.json(updated);
});

module.exports = router;
