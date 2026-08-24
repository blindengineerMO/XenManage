const express = require('express');
const router = express.Router();
const { connectionModel } = require('../models/connection');
const { validate, schemas } = require('../middleware/validate');
const auditLogService = require('../services/audit-log');
const { ensureMutationAllowed } = require('../middleware/governance');

router.get('/', (req, res) => {
  const connections = connectionModel.getAll();
  res.json(connections);
});

router.post('/', validate(schemas.connectionCreate), (req, res) => {
  try {
    if (!ensureMutationAllowed(req, res, { actionKey: 'connection_create', entityType: 'connection', entityRef: 'new' })) return;
    const conn = connectionModel.create(req.body);
    auditLogService.record({
      category: 'connections',
      action: 'connection_created',
      actionLabel: 'Registered pool target',
      entityType: 'connection',
      entityRef: String(conn.id),
      entityName: conn.name || conn.host,
      operator: req.session?.xenUser || 'local',
      route: '/pools',
      status: 'success',
      before: null,
      after: conn,
      detail: `${conn.host}:${conn.port} saved for future logins.`,
    });
    res.status(201).json(conn);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', validate(schemas.connectionId, 'params'), validate(schemas.connectionUpdate), (req, res) => {
  try {
    if (!ensureMutationAllowed(req, res, { actionKey: 'connection_update', entityType: 'connection', entityRef: String(req.params.id) })) return;
    const previous = connectionModel.getAll().find((item) => Number(item.id) === Number(req.params.id)) || null;
    const conn = connectionModel.update(req.params.id, req.body);
    auditLogService.record({
      category: 'connections',
      action: 'connection_updated',
      actionLabel: 'Updated pool target',
      entityType: 'connection',
      entityRef: String(conn.id),
      entityName: conn.name || conn.host,
      operator: req.session?.xenUser || 'local',
      route: '/pools',
      status: 'success',
      before: previous,
      after: conn,
      detail: `${conn.host}:${conn.port} connection metadata updated.`,
    });
    res.json(conn);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/default', validate(schemas.connectionId, 'params'), (req, res) => {
  try {
    if (!ensureMutationAllowed(req, res, { actionKey: 'connection_default', entityType: 'connection', entityRef: String(req.params.id) })) return;
    const previous = connectionModel.getAll();
    const conn = connectionModel.setDefault(req.params.id);
    auditLogService.record({
      category: 'connections',
      action: 'connection_default_set',
      actionLabel: 'Set default pool target',
      entityType: 'connection',
      entityRef: String(conn.id),
      entityName: conn.name || conn.host,
      operator: req.session?.xenUser || 'local',
      route: '/pools',
      status: 'success',
      before: previous,
      after: conn,
      detail: 'Default connection target updated for the login workspace.',
    });
    res.json(conn);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', validate(schemas.connectionId, 'params'), (req, res) => {
  try {
    if (!ensureMutationAllowed(req, res, { actionKey: 'connection_delete', entityType: 'connection', entityRef: String(req.params.id) })) return;
    const previous = connectionModel.getAll().find((item) => Number(item.id) === Number(req.params.id)) || null;
    connectionModel.delete(req.params.id);
    auditLogService.record({
      category: 'connections',
      action: 'connection_deleted',
      actionLabel: 'Removed pool target',
      entityType: 'connection',
      entityRef: String(req.params.id),
      entityName: previous?.name || previous?.host || String(req.params.id),
      operator: req.session?.xenUser || 'local',
      route: '/pools',
      status: 'success',
      before: previous,
      after: { success: true },
      detail: 'Saved connection removed from the management target catalog.',
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
