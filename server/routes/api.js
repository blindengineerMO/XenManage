const express = require('express');
const router = express.Router();
const { connectionModel } = require('../models/connection');
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

function findConnectionOrRespond(id, actor, res) {
  const record = connectionModel.getById(id);
  if (!record) {
    res.status(404).json({ error: 'CONNECTION_NOT_FOUND' });
    return null;
  }
  if (!canManageRecord(record, actor)) {
    res.status(403).json({ error: 'CONNECTION_FORBIDDEN' });
    return null;
  }
  return record;
}

router.get('/', (req, res) => {
  const actor = resolveActor(req);
  const connections = enrichOwnedRecords(connectionModel.listVisible(actor), actor);
  res.json(connections);
});

router.post('/', validate(schemas.connectionCreate), (req, res) => {
  try {
    if (!ensureMutationAllowed(req, res, { actionKey: 'connection_create', entityType: 'connection', entityRef: 'new' })) return;
    const actor = resolveActor(req);
    const ownership = resolveCreateOwnership(req.body, actor);
    const conn = connectionModel.create({
      ...req.body,
      ownerUserId: ownership.ownerUserId,
      visibility: ownership.visibility,
    });
    const responseRecord = enrichOwnedRecord(conn, actor);
    auditLogService.record({
      category: 'connections',
      action: 'connection_created',
      actionLabel: 'Registered pool target',
      entityType: 'connection',
      entityRef: String(conn.id),
      entityName: conn.name || conn.host,
      operator: actor.username,
      route: '/pools',
      status: 'success',
      before: null,
      after: responseRecord,
      detail: `${conn.host}:${conn.port} saved as a ${responseRecord.visibility} pool target.`,
    });
    res.status(201).json(responseRecord);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', validate(schemas.connectionId, 'params'), validate(schemas.connectionUpdate), (req, res) => {
  try {
    if (!ensureMutationAllowed(req, res, { actionKey: 'connection_update', entityType: 'connection', entityRef: String(req.params.id) })) return;
    const actor = resolveActor(req);
    const previous = findConnectionOrRespond(req.params.id, actor, res);
    if (!previous) return;
    const ownership = resolveUpdateOwnership(previous, req.body, actor);
    const conn = connectionModel.update(req.params.id, {
      ...req.body,
      ownerUserId: ownership.ownerUserId,
      visibility: ownership.visibility,
    });
    const responseRecord = enrichOwnedRecord(conn, actor);
    auditLogService.record({
      category: 'connections',
      action: 'connection_updated',
      actionLabel: 'Updated pool target',
      entityType: 'connection',
      entityRef: String(conn.id),
      entityName: conn.name || conn.host,
      operator: actor.username,
      route: '/pools',
      status: 'success',
      before: enrichOwnedRecord(previous, actor),
      after: responseRecord,
      detail: `${conn.host}:${conn.port} connection metadata updated.`,
    });
    res.json(responseRecord);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/default', validate(schemas.connectionId, 'params'), (req, res) => {
  try {
    if (!ensureMutationAllowed(req, res, { actionKey: 'connection_default', entityType: 'connection', entityRef: String(req.params.id) })) return;
    const actor = resolveActor(req);
    const existing = findConnectionOrRespond(req.params.id, actor, res);
    if (!existing) return;
    const previous = connectionModel.listVisible(actor);
    const conn = connectionModel.setDefault(req.params.id);
    const responseRecord = enrichOwnedRecord(conn, actor);
    auditLogService.record({
      category: 'connections',
      action: 'connection_default_set',
      actionLabel: 'Set default pool target',
      entityType: 'connection',
      entityRef: String(conn.id),
      entityName: conn.name || conn.host,
      operator: actor.username,
      route: '/pools',
      status: 'success',
      before: enrichOwnedRecords(previous, actor),
      after: responseRecord,
      detail: 'Default connection target updated for the login workspace.',
    });
    res.json(responseRecord);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', validate(schemas.connectionId, 'params'), (req, res) => {
  try {
    if (!ensureMutationAllowed(req, res, { actionKey: 'connection_delete', entityType: 'connection', entityRef: String(req.params.id), destructive: true })) return;
    const actor = resolveActor(req);
    const previous = findConnectionOrRespond(req.params.id, actor, res);
    if (!previous) return;
    connectionModel.delete(req.params.id);
    auditLogService.record({
      category: 'connections',
      action: 'connection_deleted',
      actionLabel: 'Removed pool target',
      entityType: 'connection',
      entityRef: String(req.params.id),
      entityName: previous?.name || previous?.host || String(req.params.id),
      operator: actor.username,
      route: '/pools',
      status: 'success',
      before: enrichOwnedRecord(previous, actor),
      after: { success: true },
      detail: 'Saved connection removed from the management target catalog.',
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
