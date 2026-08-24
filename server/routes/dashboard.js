const express = require('express');
const router = express.Router();
const { listAlerts } = require('../services/alerts');

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
    const messages = await req.xenApi.getMessages();
    const list = listAlerts(messages).slice(0, 50);
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
