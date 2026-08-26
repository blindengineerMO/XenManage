const express = require('express');
const router = express.Router();
const { hostTargetModel } = require('../models/connection');
const { validate, schemas } = require('../middleware/validate');
const auditLogService = require('../services/audit-log');
const { ensureMutationAllowed } = require('../middleware/governance');
const {
  canManageRecord,
  enrichOwnedRecord,
  enrichOwnedRecords,
  resolveActor,
  resolveCreateOwnership,
  resolveUpdateOwnership,
} = require('../services/resource-ownership');

function findTargetOrRespond(id, actor, res) {
  const record = hostTargetModel.getById(id);
  if (!record) {
    res.status(404).json({ error: 'HOST_TARGET_NOT_FOUND' });
    return null;
  }
  if (!canManageRecord(record, actor)) {
    res.status(403).json({ error: 'HOST_TARGET_FORBIDDEN' });
    return null;
  }
  return record;
}

router.get('/', (req, res) => {
  const actor = resolveActor(req);
  res.json(enrichOwnedRecords(hostTargetModel.listVisible(actor), actor));
});

router.post('/', validate(schemas.hostTargetCreate), (req, res) => {
  try {
    if (!ensureMutationAllowed(req, res, { actionKey: 'host_target_create', entityType: 'host-target', entityRef: 'new' })) return;
    const actor = resolveActor(req);
    const ownership = resolveCreateOwnership(req.body, actor);
    const target = hostTargetModel.create({
      ...req.body,
      ownerUserId: ownership.ownerUserId,
      visibility: ownership.visibility,
    });
    const responseRecord = enrichOwnedRecord(target, actor);
    auditLogService.record({
      category: 'hosts',
      action: 'host_target_created',
      actionLabel: 'Registered host target',
      entityType: 'host-target',
      entityRef: String(target.id),
      entityName: target.name || target.host,
      operator: actor.username,
      route: '/hosts',
      status: 'success',
      before: null,
      after: responseRecord,
      detail: `${target.host}:${target.port} saved in ${target.mode} mode as a ${responseRecord.visibility} host target.`,
    });
    res.status(201).json(responseRecord);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', validate(schemas.connectionId, 'params'), validate(schemas.hostTargetUpdate), (req, res) => {
  try {
    if (!ensureMutationAllowed(req, res, { actionKey: 'host_target_update', entityType: 'host-target', entityRef: String(req.params.id) })) return;
    const actor = resolveActor(req);
    const previous = findTargetOrRespond(req.params.id, actor, res);
    if (!previous) return;
    const ownership = resolveUpdateOwnership(previous, req.body, actor);
    const target = hostTargetModel.update(req.params.id, {
      ...req.body,
      ownerUserId: ownership.ownerUserId,
      visibility: ownership.visibility,
    });
    const responseRecord = enrichOwnedRecord(target, actor);
    auditLogService.record({
      category: 'hosts',
      action: 'host_target_updated',
      actionLabel: 'Updated host target',
      entityType: 'host-target',
      entityRef: String(target.id),
      entityName: target.name || target.host,
      operator: actor.username,
      route: '/hosts',
      status: 'success',
      before: enrichOwnedRecord(previous, actor),
      after: responseRecord,
      detail: `${target.host}:${target.port} registration metadata updated.`,
    });
    res.json(responseRecord);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', validate(schemas.connectionId, 'params'), (req, res) => {
  try {
    if (!ensureMutationAllowed(req, res, { actionKey: 'host_target_delete', entityType: 'host-target', entityRef: String(req.params.id), destructive: true })) return;
    const actor = resolveActor(req);
    const previous = findTargetOrRespond(req.params.id, actor, res);
    if (!previous) return;
    hostTargetModel.delete(req.params.id);
    auditLogService.record({
      category: 'hosts',
      action: 'host_target_deleted',
      actionLabel: 'Removed host target',
      entityType: 'host-target',
      entityRef: String(req.params.id),
      entityName: previous?.name || previous?.host || String(req.params.id),
      operator: actor.username,
      route: '/hosts',
      status: 'success',
      before: enrichOwnedRecord(previous, actor),
      after: { success: true },
      detail: 'Saved host target removed from the registration catalog.',
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
