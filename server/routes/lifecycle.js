const express = require('express');
const { validate, schemas } = require('../middleware/validate');
const lifecyclePlanService = require('../services/lifecycle-plans');
const auditLogService = require('../services/audit-log');
const { ensureMutationAllowed } = require('../middleware/governance');

const router = express.Router();

router.get('/plans', (req, res) => {
  try {
    const plans = lifecyclePlanService.getAll();
    res.json({ total: plans.length, data: plans });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/plans/:ref', validate(schemas.opaqueRefParam, 'params'), validate(schemas.lifecyclePlanUpdate), (req, res) => {
  try {
    if (!ensureMutationAllowed(req, res, { actionKey: 'lifecycle_plan_save', entityType: 'host', entityRef: req.params.ref })) return;
    const previousPlan = lifecyclePlanService.getAll().find((entry) => entry.hostRef === req.params.ref) || null;
    const plan = lifecyclePlanService.upsert(req.params.ref, req.body);
    auditLogService.record({
      category: 'lifecycle',
      action: 'lifecycle_plan_saved',
      actionLabel: 'Saved lifecycle plan for',
      entityType: 'host',
      entityRef: req.params.ref,
      entityName: req.params.ref,
      operator: req.session?.xenUser || 'system',
      route: '/lifecycle',
      status: 'success',
      before: previousPlan,
      after: plan,
      detail: `${plan.targetStage} stage with ${plan.baselineStatus} baseline status.`,
    });
    res.json(plan);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/plans/:ref', validate(schemas.opaqueRefParam, 'params'), (req, res) => {
  try {
    if (!ensureMutationAllowed(req, res, { actionKey: 'lifecycle_plan_delete', entityType: 'host', entityRef: req.params.ref, destructive: true })) return;
    const previousPlan = lifecyclePlanService.getAll().find((entry) => entry.hostRef === req.params.ref) || null;
    const result = lifecyclePlanService.remove(req.params.ref);
    auditLogService.record({
      category: 'lifecycle',
      action: 'lifecycle_plan_removed',
      actionLabel: 'Cleared lifecycle plan for',
      entityType: 'host',
      entityRef: req.params.ref,
      entityName: req.params.ref,
      operator: req.session?.xenUser || 'system',
      route: '/lifecycle',
      status: 'success',
      before: previousPlan,
      after: { success: true },
      detail: 'Lifecycle planner entry removed from persisted state.',
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
