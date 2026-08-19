const express = require('express');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const result = await req.xenApi.getSRs();
    const srs = Object.entries(result.records)
      .map(([ref, r]) => ({ ref, ...r }));
    res.json({ total: srs.length, data: srs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:ref', async (req, res) => {
  try {
    const record = await req.xenApi.getRecord('SR', req.params.ref);
    res.json({ ref: req.params.ref, ...record });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:ref/vdis', async (req, res) => {
  try {
    const vdiRefs = await req.xenApi.getField('SR', req.params.ref, 'VDIs');
    const vdis = await Promise.all((vdiRefs || []).map(async (ref) => {
      const record = await req.xenApi.getRecord('VDI', ref);
      return { ref, ...record };
    }));
    res.json({ total: vdis.length, data: vdis });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
