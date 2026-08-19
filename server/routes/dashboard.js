const express = require('express');
const router = express.Router();

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
    const list = Object.entries(messages)
      .map(([ref, r]) => ({ ref, ...r }))
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 50);
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
