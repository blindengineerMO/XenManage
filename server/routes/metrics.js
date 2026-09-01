const express = require('express');
const router = express.Router();
const { validate, schemas } = require('../middleware/validate');
const metricsCollector = require('../services/metrics-collector');
const metricsHistoryService = require('../services/metrics-history');

async function ensureRecentSnapshot(req, force = false) {
  return metricsCollector.collectTarget(
    req.xenApi,
    {
      sessionId: req.session?.id || '',
      targetKey: req.xenTarget?.targetKey || req.session?.activeXenTargetKey || '',
      host: req.xenApi?.host || '',
    },
    {
      force,
      source: force ? 'manual' : 'request',
    }
  );
}

router.get('/cluster', validate(schemas.metricRangeQuery, 'query'), async (req, res) => {
  try {
    await ensureRecentSnapshot(req);
    res.json(metricsHistoryService.listClusterSeries(req.query.range, req.xenTarget?.targetKey || ''));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/capacity-baseline', async (req, res) => {
  try {
    await ensureRecentSnapshot(req);
    res.json(metricsHistoryService.listCapacityBaseline(req.xenTarget?.targetKey || ''));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/rrd-updates', validate(schemas.metricRrdQuery, 'query'), async (req, res) => {
  try {
    const start = req.query.start !== undefined
      ? Number(req.query.start)
      : Math.max(0, Math.floor(Date.now() / 1000) - 3600);
    const result = await req.xenApi.getRrdUpdates({
      start,
      cf: req.query.cf,
      interval: Number(req.query.interval),
      host: Boolean(req.query.host),
    });
    res.json(result);
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
    res.json(metricsHistoryService.listEntitySeries('host', req.params.ref, req.query.range, req.xenTarget?.targetKey || ''));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/vms/:ref', validate(schemas.opaqueRefParam, 'params'), validate(schemas.metricRangeQuery, 'query'), async (req, res) => {
  try {
    await ensureRecentSnapshot(req);
    res.json(metricsHistoryService.listEntitySeries('vm', req.params.ref, req.query.range, req.xenTarget?.targetKey || ''));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/storage/:ref', validate(schemas.opaqueRefParam, 'params'), validate(schemas.metricRangeQuery, 'query'), async (req, res) => {
  try {
    await ensureRecentSnapshot(req);
    res.json(metricsHistoryService.listEntitySeries('sr', req.params.ref, req.query.range, req.xenTarget?.targetKey || ''));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
