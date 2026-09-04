const express = require('express');
const { validate, schemas } = require('../middleware/validate');
const workflowEngine = require('../services/workflow-engine');
const managedTargetService = require('../services/managed-targets');
const { ensureMutationAllowed } = require('../middleware/governance');

const router = express.Router();

router.get('/', (req, res) => {
  res.json(workflowEngine.list({
    status: String(req.query.status || ''),
    targetId: req.query.targetId || null,
    limit: req.query.limit || 100,
  }));
});

router.get('/:id', validate(schemas.workflowId, 'params'), (req, res) => {
  const workflow = workflowEngine.get(req.params.id);
  if (!workflow) return res.status(404).json({ error: 'WORKFLOW_NOT_FOUND' });
  res.json(workflow);
});

router.post('/', validate(schemas.workflowCreate), async (req, res) => {
  if (!ensureMutationAllowed(req, res, { actionKey: 'workflow_create', entityType: 'workflow', entityRef: req.body.type })) return;
  try {
    const { workflow, created } = workflowEngine.create({
      ...req.body,
      requestedBy: req.session?.appUsername || 'system',
    });
    if (created && req.body.runNow !== false) await workflowEngine.execute(workflow.id);
    res.status(created ? 201 : 200).json({ ...workflowEngine.get(workflow.id), idempotent: !created });
  } catch (error) {
    res.status(400).json({ error: error.code || error.message });
  }
});

router.post('/:id/approve', validate(schemas.workflowId, 'params'), validate(schemas.workflowApproval), async (req, res) => {
  if (!ensureMutationAllowed(req, res, { actionKey: 'workflow_approve', entityType: 'workflow', entityRef: req.params.id })) return;
  const workflow = workflowEngine.approve(req.params.id, req.body.approvalId);
  if (!workflow) return res.status(404).json({ error: 'WORKFLOW_NOT_FOUND' });
  await workflowEngine.execute(workflow.id);
  res.json(workflowEngine.get(workflow.id));
});

router.post('/:id/cancel', validate(schemas.workflowId, 'params'), async (req, res) => {
  if (!ensureMutationAllowed(req, res, { actionKey: 'workflow_cancel', entityType: 'workflow', entityRef: req.params.id })) return;
  const workflow = await workflowEngine.cancel(req.params.id);
  if (!workflow) return res.status(404).json({ error: 'WORKFLOW_NOT_FOUND' });
  res.json(workflow);
});

workflowEngine.register('managed-target.check', async ({ workflow, log, setProgress }) => {
  setProgress(25, 'Validating control-plane target connectivity.');
  const target = await managedTargetService.check(workflow.target_id);
  if (!target) {
    const error = new Error('MANAGED_TARGET_NOT_FOUND');
    error.code = 'MANAGED_TARGET_NOT_FOUND';
    throw error;
  }
  log(target.state === 'Healthy' ? 'info' : 'warning', 'Managed target health check completed.', target);
  setProgress(90, 'Managed target health state persisted.');
  return { target };
});

module.exports = router;
