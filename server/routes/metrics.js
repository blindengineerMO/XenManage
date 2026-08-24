const express = require('express');
const router = express.Router();
const { validate, schemas } = require('../middleware/validate');
const metricsHistoryService = require('../services/metrics-history');

async function ensureRecentSnapshot(req, force = false) {
  return metricsHistoryService.captureSnapshot(req.xenApi, { force });
}

router.get('/cluster', validate(schemas.metricRangeQuery, 'query'), async (req, res) => {
  try {
    await ensureRecentSnapshot(req);
    res.json(metricsHistoryService.listClusterSeries(req.query.range));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/collect', async (req, res) => {
  try {
    const result = await ensureRecentSnapshot(req, true);
    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/hosts/:ref', validate(schemas.opaqueRefParam, 'params'), validate(schemas.metricRangeQuery, 'query'), async (req, res) => {
  try {
    await ensureRecentSnapshot(req);
    res.json(metricsHistoryService.listEntitySeries('host', req.params.ref, req.query.range));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/vms/:ref', validate(schemas.opaqueRefParam, 'params'), validate(schemas.metricRangeQuery, 'query'), async (req, res) => {
  try {
    await ensureRecentSnapshot(req);
    res.json(metricsHistoryService.listEntitySeries('vm', req.params.ref, req.query.range));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/storage/:ref', validate(schemas.opaqueRefParam, 'params'), validate(schemas.metricRangeQuery, 'query'), async (req, res) => {
  try {
    await ensureRecentSnapshot(req);
    res.json(metricsHistoryService.listEntitySeries('sr', req.params.ref, req.query.range));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
