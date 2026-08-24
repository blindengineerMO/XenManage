const express = require('express');
const router = express.Router();
const { hostTargetModel } = require('../models/connection');
const { validate, schemas } = require('../middleware/validate');
const auditLogService = require('../services/audit-log');
const { ensureMutationAllowed } = require('../middleware/governance');

router.get('/', (req, res) => {
  res.json(hostTargetModel.getAll());
});

router.post('/', validate(schemas.hostTargetCreate), (req, res) => {
  try {
    if (!ensureMutationAllowed(req, res, { actionKey: 'host_target_create', entityType: 'host-target', entityRef: 'new' })) return;
    const target = hostTargetModel.create(req.body);
    auditLogService.record({
      category: 'hosts',
      action: 'host_target_created',
      actionLabel: 'Registered host target',
      entityType: 'host-target',
      entityRef: String(target.id),
      entityName: target.name || target.host,
      operator: req.session?.xenUser || 'local',
      route: '/hosts',
      status: 'success',
      before: null,
      after: target,
      detail: `${target.host}:${target.port} saved in ${target.mode} mode.`,
    });
    res.status(201).json(target);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', validate(schemas.connectionId, 'params'), validate(schemas.hostTargetUpdate), (req, res) => {
  try {
    if (!ensureMutationAllowed(req, res, { actionKey: 'host_target_update', entityType: 'host-target', entityRef: String(req.params.id) })) return;
    const previous = hostTargetModel.getAll().find((item) => Number(item.id) === Number(req.params.id)) || null;
    const target = hostTargetModel.update(req.params.id, req.body);
    auditLogService.record({
      category: 'hosts',
      action: 'host_target_updated',
      actionLabel: 'Updated host target',
      entityType: 'host-target',
      entityRef: String(target.id),
      entityName: target.name || target.host,
      operator: req.session?.xenUser || 'local',
      route: '/hosts',
      status: 'success',
      before: previous,
      after: target,
      detail: `${target.host}:${target.port} registration metadata updated.`,
    });
    res.json(target);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', validate(schemas.connectionId, 'params'), (req, res) => {
  try {
    if (!ensureMutationAllowed(req, res, { actionKey: 'host_target_delete', entityType: 'host-target', entityRef: String(req.params.id) })) return;
    const previous = hostTargetModel.getAll().find((item) => Number(item.id) === Number(req.params.id)) || null;
    hostTargetModel.delete(req.params.id);
    auditLogService.record({
      category: 'hosts',
      action: 'host_target_deleted',
      actionLabel: 'Removed host target',
      entityType: 'host-target',
      entityRef: String(req.params.id),
      entityName: previous?.name || previous?.host || String(req.params.id),
      operator: req.session?.xenUser || 'local',
      route: '/hosts',
      status: 'success',
      before: previous,
      after: { success: true },
      detail: 'Saved host target removed from the registration catalog.',
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
