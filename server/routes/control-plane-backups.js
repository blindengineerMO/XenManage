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

module.exports = router;
