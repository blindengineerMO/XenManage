const express = require('express');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const result = await req.xenApi.getNetworks();
    const networks = Object.entries(result.records)
      .map(([ref, r]) => ({ ref, ...r }));
    res.json({ total: networks.length, data: networks });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:ref', async (req, res) => {
  try {
    const record = await req.xenApi.getRecord('network', req.params.ref);
    res.json({ ref: req.params.ref, ...record });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
