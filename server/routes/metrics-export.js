const express = require('express');
const { getDb, managedTargetModel } = require('../models/connection');
const { renderPrometheusMetrics } = require('../services/runtime-metrics');

const router = express.Router();

router.get('/metrics', (_req, res) => {
  const targets = managedTargetModel.list().filter((target) => target.enabled);
  const workflowDepth = getDb().prepare("SELECT COUNT(*) AS count FROM workflows WHERE status IN ('queued', 'running', 'pending_approval')").get().count;
  res.type('text/plain').send(renderPrometheusMetrics({
    workflowDepth,
    managedTargets: {
      enabled: targets.length,
      healthy: targets.filter((target) => target.state === 'Healthy').length,
      unhealthy: targets.filter((target) => target.state !== 'Healthy').length,
    },
  }));
});

module.exports = router;
