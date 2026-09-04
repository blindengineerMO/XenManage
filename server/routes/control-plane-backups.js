const express = require('express');
const governanceService = require('../services/governance');
const { userModel } = require('../models/security-db');
const backupService = require('../services/control-plane-backup');
const auditLogService = require('../services/audit-log');

const router = express.Router();

function requireAdmin(req, res, next) {
  const account = req.session?.userId ? userModel.getById(req.session.userId) : null;
  if (!account?.active || account.role !== 'admin' || governanceService.getSessionRole(req.session) !== 'admin') {
    return res.status(403).json({ error: 'ADMIN_ROLE_REQUIRED' });
  }
  next();
}

router.get('/', requireAdmin, (_req, res) => {
  res.json({ snapshots: backupService.listSnapshots() });
});

router.post('/', requireAdmin, async (req, res) => {
  try {
    const snapshot = await backupService.createSnapshot();
    auditLogService.record({
      category: 'control-plane', action: 'control_plane_backup_created', actionLabel: 'Created control-plane backup',
      entityType: 'control-plane-backup', entityRef: snapshot.id, entityName: snapshot.id,
      operator: req.session.appUsername || 'admin', route: '/settings', status: 'success', before: null, after: snapshot,
      detail: 'Created an SQLite-consistent snapshot of xenmange.db, security.db, vault.db, and perf.db.',
    });
    res.status(201).json({ snapshot });
  } catch (error) {
    res.status(500).json({ error: 'CONTROL_PLANE_BACKUP_FAILED' });
  }
});

router.post('/:id/verify', requireAdmin, (req, res) => {
  try {
    const result = backupService.verifySnapshot(req.params.id);
    auditLogService.record({
      category: 'control-plane', action: 'control_plane_backup_verified', actionLabel: 'Verified control-plane backup',
      entityType: 'control-plane-backup', entityRef: result.id, entityName: result.id,
      operator: req.session.appUsername || 'admin', route: '/settings',
      status: result.overallStatus === 'ok' ? 'success' : 'warning', before: null, after: result,
      detail: `Checksum and integrity check ${result.overallStatus === 'ok' ? 'passed' : 'found issues'} for snapshot ${result.id}.`,
    });
    res.json(result);
  } catch (error) {
    if (error.code === 'SNAPSHOT_NOT_FOUND') {
      return res.status(404).json({ error: 'SNAPSHOT_NOT_FOUND' });
    }
    res.status(500).json({ error: 'CONTROL_PLANE_BACKUP_VERIFY_FAILED' });
  }
});

router.get('/:id/restore-preview', requireAdmin, (req, res) => {
  try {
    const result = backupService.restorePreview(req.params.id);
    auditLogService.record({
      category: 'control-plane', action: 'control_plane_backup_restore_previewed', actionLabel: 'Previewed control-plane backup restore',
      entityType: 'control-plane-backup', entityRef: result.id, entityName: result.id,
      operator: req.session.appUsername || 'admin', route: '/settings', status: 'success', before: null, after: result,
      detail: `Generated a read-only restore preview for snapshot ${result.id}.`,
    });
    res.json(result);
  } catch (error) {
    if (error.code === 'SNAPSHOT_NOT_FOUND') {
      return res.status(404).json({ error: 'SNAPSHOT_NOT_FOUND' });
    }
    res.status(500).json({ error: 'CONTROL_PLANE_BACKUP_RESTORE_PREVIEW_FAILED' });
  }
});

module.exports = router;
