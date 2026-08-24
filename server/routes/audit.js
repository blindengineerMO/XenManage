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
