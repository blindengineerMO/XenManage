const express = require('express');
const { getDb, managedTargetModel } = require('../models/connection');
const { getSecurityDb } = require('../models/security-db');
const { getVaultDb } = require('../models/vault-db');
const { getPerfDb } = require('../models/perf-db');

const router = express.Router();

function checkDatabase(name, getDatabase) {
  try {
    getDatabase().prepare('SELECT 1').get();
    return { name, ok: true };
  } catch (error) {
    return { name, ok: false, error: error.message };
  }
}

router.get('/healthz', (_req, res) => {
  res.json({ status: 'ok' });
});

router.get('/readyz', (_req, res) => {
  const databases = [
    checkDatabase('controlPlane', getDb),
    checkDatabase('security', getSecurityDb),
    checkDatabase('vault', getVaultDb),
    checkDatabase('performance', getPerfDb),
  ];
  const targets = managedTargetModel.list();
  const enabledTargets = targets.filter((target) => target.enabled);
  const healthyTargets = enabledTargets.filter((target) => target.state === 'Healthy');
  const ready = databases.every((database) => database.ok);

  res.status(ready ? 200 : 503).json({
    status: ready ? 'ready' : 'not_ready',
    databases,
    managedTargets: {
      enabled: enabledTargets.length,
      healthy: healthyTargets.length,
      unhealthy: enabledTargets.length - healthyTargets.length,
    },
  });
});

module.exports = router;
