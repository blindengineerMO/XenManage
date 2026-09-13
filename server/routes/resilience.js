const express = require('express');
const { validate, schemas } = require('../middleware/validate');
const { buildResilienceOverview } = require('../services/resilience');
const resilienceRunbookService = require('../services/resilience-runbooks');
const auditLogService = require('../services/audit-log');
const { ensureMutationAllowed } = require('../middleware/governance');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const [poolsResult, hostsResult, vmsResult, tasksResult, messagesResult] = await Promise.all([
      req.xenApi.getPools(),
      req.xenApi.getHosts(),
      req.xenApi.getVMs(),
      req.xenApi.getTasks(),
      req.xenApi.getMessages(),
    ]);
    const runbooks = resilienceRunbookService.getRunbooks();
    const drills = resilienceRunbookService.getDrills();

    const payload = buildResilienceOverview({
      pools: Object.entries(poolsResult.records || {}).map(([ref, record]) => ({ ref, ...record })),
      hosts: Object.entries(hostsResult.records || {}).map(([ref, record]) => ({ ref, ...record })),
      vms: Object.entries(vmsResult.records || {}).map(([ref, record]) => ({ ref, ...record })),
      tasks: Object.entries(tasksResult || {}).map(([ref, record]) => ({ ref, ...record })),
      messages: Object.entries(messagesResult || {}).map(([ref, record]) => ({ ref, ...record })),
      runbooks,
      drills,
    });

    res.json(payload);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/plans', (req, res) => {
  try {
    const plans = resilienceRunbookService.getRunbooks();
    res.json({ total: plans.length, data: plans });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/drills', (req, res) => {
  try {
    const drills = resilienceRunbookService.getDrills();
    res.json({ total: drills.length, data: drills });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/plans/:ref', validate(schemas.opaqueRefParam, 'params'), validate(schemas.resilienceRunbookUpdate), (req, res) => {
  try {
    if (!ensureMutationAllowed(req, res, { actionKey: 'resilience_runbook_save', entityType: 'pool', entityRef: req.params.ref })) return;
    const previousRunbook = resilienceRunbookService.getRunbook(req.params.ref);
    const runbook = resilienceRunbookService.upsertRunbook(req.params.ref, req.body);
    auditLogService.record({
      category: 'resilience',
      action: 'resilience_runbook_saved',
      actionLabel: 'Saved resilience runbook for',
      entityType: 'pool',
      entityRef: req.params.ref,
      entityName: req.params.ref,
      operator: req.session?.xenUser || 'system',
      route: '/resilience',
      status: 'success',
      before: previousRunbook,
      after: runbook,
      detail: `${runbook.haPolicy} HA policy with ${runbook.backupWindowHours}h backup window.`,
    });
    res.json(runbook);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/plans/:ref', validate(schemas.opaqueRefParam, 'params'), (req, res) => {
  try {
    if (!ensureMutationAllowed(req, res, { actionKey: 'resilience_runbook_delete', entityType: 'pool', entityRef: req.params.ref })) return;
    const previousRunbook = resilienceRunbookService.getRunbook(req.params.ref);
    const result = resilienceRunbookService.removeRunbook(req.params.ref);
    auditLogService.record({
      category: 'resilience',
      action: 'resilience_runbook_removed',
      actionLabel: 'Cleared resilience runbook for',
      entityType: 'pool',
      entityRef: req.params.ref,
      entityName: req.params.ref,
      operator: req.session?.xenUser || 'system',
      route: '/resilience',
      status: 'success',
      before: previousRunbook,
      after: { success: true },
      detail: 'Recovery runbook removed from persisted resilience planning state.',
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/drills/:ref', validate(schemas.opaqueRefParam, 'params'), validate(schemas.resilienceDrillCreate), (req, res) => {
  try {
    if (!ensureMutationAllowed(req, res, { actionKey: 'resilience_drill_log', entityType: 'pool', entityRef: req.params.ref })) return;
    const drill = resilienceRunbookService.logDrill(req.params.ref, req.body, req.session?.xenUser || 'system');
    auditLogService.record({
      category: 'resilience',
      action: 'resilience_drill_logged',
      actionLabel: 'Logged resilience drill for',
      entityType: 'pool',
      entityRef: req.params.ref,
      entityName: req.params.ref,
      operator: req.session?.xenUser || 'system',
      route: '/resilience',
      status: drill.status === 'critical' ? 'critical' : drill.status,
      before: null,
      after: drill,
      detail: `${drill.drillType} drill logged with ${drill.status} status.`,
    });
    res.json(drill);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
