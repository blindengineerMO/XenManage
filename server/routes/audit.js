/**
 * Mount: /api/audit via requireAuth (XAPI session not required).
 * Auth: local login only.
 * Workflow: read the control-plane audit trail written by other routers.
 * Invariants: read-only; mutations elsewhere call auditLogService.record.
 * Client: ActivityView (audit tab).
 */
const express = require('express');
const auditLogService = require('../services/audit-log');

const router = express.Router();

router.get('/', (_req, res) => {
  try {
    const entries = auditLogService.list();
    res.json({ total: entries.length, data: entries });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
