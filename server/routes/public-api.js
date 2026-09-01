const express = require('express');
const { validate, schemas } = require('../middleware/validate');
const { requireApiToken, requireApiPermission } = require('../middleware/api-token');
const managedTargetService = require('../services/managed-targets');
const workflowEngine = require('../services/workflow-engine');

const router = express.Router();
router.use(requireApiToken);

router.get('/', (_req, res) => {
  res.json({
    version: 'v1',
    resources: ['managed-targets', 'workflows'],
    authentication: 'Bearer API token',
  });
});

router.get('/managed-targets', requireApiPermission('managed.target.read'), (req, res) => {
  res.json({ data: managedTargetService.list({ userId: req.principal.userId, role: req.principal.role }) });
});

router.post('/managed-targets/:id/check', validate(schemas.managedTargetId, 'params'), requireApiPermission('managed.target.check'), async (req, res) => {
  const target = managedTargetService.list({ userId: req.principal.userId, role: req.principal.role })
    .find((entry) => entry.id === Number(req.params.id));
  if (!target) return res.status(404).json({ error: 'MANAGED_TARGET_NOT_FOUND' });
  res.json(await managedTargetService.check(target.id));
});

router.get('/workflows', requireApiPermission('workflow.read'), (req, res) => {
  res.json({ data: workflowEngine.list({ status: String(req.query.status || ''), limit: req.query.limit || 100 }) });
});

router.post('/workflows', validate(schemas.workflowCreate), requireApiPermission('workflow.create'), async (req, res) => {
  try {
    const { workflow, created } = workflowEngine.create({ ...req.body, requestedBy: req.principal.username });
    if (created && req.body.runNow !== false) await workflowEngine.execute(workflow.id);
    res.status(created ? 201 : 200).json({ ...workflowEngine.get(workflow.id), idempotent: !created });
  } catch (error) {
    res.status(400).json({ error: error.code || error.message });
  }
});

module.exports = router;
