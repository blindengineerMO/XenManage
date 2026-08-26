const express = require('express');
const router = express.Router();
const { enrichAlertRecords, listAlerts } = require('../services/alerts');
const { listTelemetryAlerts } = require('../services/telemetry-alerts');

router.get('/', async (req, res) => {
  try {
    const summary = await req.xenApi.getDashboardSummary();
    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/messages', async (req, res) => {
  try {
    const [messages, telemetryAlerts] = await Promise.all([
      req.xenApi.getMessages(),
      listTelemetryAlerts(req.xenApi),
    ]);
    const merged = await enrichAlertRecords({ ...(messages || {}) }, req.xenApi);
    telemetryAlerts.forEach((entry) => {
      merged[entry.ref] = entry;
    });
    const list = listAlerts(merged).slice(0, 50);
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
