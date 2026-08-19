const express = require('express');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const result = await req.xenApi.getHosts();
    const hosts = Object.entries(result.records)
      .map(([ref, r]) => ({ ref, ...r }));
    res.json({ total: hosts.length, data: hosts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:ref', async (req, res) => {
  try {
    const record = await req.xenApi.getRecord('host', req.params.ref);
    res.json({ ref: req.params.ref, ...record });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:ref/metrics', async (req, res) => {
  try {
    const metrics = await req.xenApi.getHostMetrics(req.params.ref);
    res.json(metrics);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
