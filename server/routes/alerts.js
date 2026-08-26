const express = require('express');
const { validate, schemas } = require('../middleware/validate');
const {
  deleteAlertPolicy,
  enrichAlertRecords,
  getAlertPolicy,
  listAlertPolicies,
  listAlerts,
  saveAlertPolicy,
  saveAlertState,
} = require('../services/alerts');
const { listTelemetryAlerts } = require('../services/telemetry-alerts');
const auditLogService = require('../services/audit-log');
const { ensureMutationAllowed } = require('../middleware/governance');

const router = express.Router();

async function getAlertRecordMap(xenApi) {
  const [messages, telemetryAlerts] = await Promise.all([
    xenApi?.getMessages ? xenApi.getMessages() : Promise.resolve({}),
    listTelemetryAlerts(xenApi),
  ]);
  const map = await enrichAlertRecords({ ...(messages || {}) }, xenApi);
  telemetryAlerts.forEach((entry) => {
    map[entry.ref] = entry;
  });
  return map;
}

router.get('/', async (req, res) => {
  try {
    const alertRecords = await getAlertRecordMap(req.xenApi);
    const alerts = listAlerts(alertRecords);
    res.json({ total: alerts.length, data: alerts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/policies', (_req, res) => {
  try {
    const policies = listAlertPolicies();
    res.json({ total: policies.length, data: policies });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:ref/state', validate(schemas.opaqueRefParam, 'params'), validate(schemas.alertStateUpdate), async (req, res) => {
  try {
    if (!ensureMutationAllowed(req, res, { actionKey: 'alert_state_save', entityType: 'alert', entityRef: req.params.ref })) return;
    const alertRecords = await getAlertRecordMap(req.xenApi);
    const previousAlert = listAlerts({ [req.params.ref]: alertRecords?.[req.params.ref] || { ref: req.params.ref } })[0] || null;
    const state = saveAlertState(req.params.ref, req.body, req.session?.xenUser || '');
    const sourceRecord = alertRecords?.[req.params.ref] || { ref: req.params.ref };
    const alert = listAlerts({ [req.params.ref]: sourceRecord })[0] || { ref: req.params.ref, ...state };
    auditLogService.record({
      category: 'alerts',
      action: 'alert_state_updated',
      actionLabel: 'Updated alert state for',
      entityType: 'alert',
      entityRef: req.params.ref,
      entityName: alert.summary || sourceRecord.name || req.params.ref,
      operator: req.session?.xenUser || 'system',
      route: '/alerts',
      status: 'success',
      before: previousAlert,
      after: alert,
      detail: `${alert.healthAction || 'none'} action with ${alert.effectiveSeverity || alert.baseSeverity || 'notice'} severity.`,
    });
    res.json(alert);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/bulk-state', validate(schemas.alertBulkStateUpdate), async (req, res) => {
  try {
    if (!ensureMutationAllowed(req, res, { actionKey: 'alert_bulk_state_save', entityType: 'alert-batch', entityRef: String(req.body.refs.length) })) return;
    const alertRecords = await getAlertRecordMap(req.xenApi);
    const updated = [];

    for (const ref of req.body.refs) {
      const state = saveAlertState(ref, req.body.state, req.session?.xenUser || '');
      const sourceRecord = alertRecords?.[ref] || { ref };
      const alert = listAlerts({ [ref]: sourceRecord })[0] || { ref, ...state };
      updated.push(alert);
    }

    auditLogService.record({
      category: 'alerts',
      action: 'alert_bulk_state_updated',
      actionLabel: 'Bulk-updated alert state for',
      entityType: 'alert-batch',
      entityRef: req.body.refs.join(','),
      entityName: `${updated.length} alerts`,
      operator: req.session?.xenUser || 'system',
      route: '/alerts',
      status: 'success',
      before: { refs: req.body.refs },
      after: { refs: req.body.refs, state: req.body.state },
      detail: `${updated.length} alerts received the same triage state in a single operation.`,
    });

    res.json({ total: updated.length, data: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/policies', validate(schemas.alertPolicyUpdate), (req, res) => {
  try {
    if (!ensureMutationAllowed(req, res, { actionKey: 'alert_policy_save', entityType: 'alert-policy', entityRef: 'new' })) return;
    const policy = saveAlertPolicy(req.body);
    auditLogService.record({
      category: 'alerts',
      action: 'alert_policy_created',
      actionLabel: 'Created alert policy for',
      entityType: 'alert-policy',
      entityRef: policy.id,
      entityName: policy.name,
      operator: req.session?.xenUser || 'system',
      route: '/alerts',
      status: 'success',
      before: null,
      after: policy,
      detail: `${policy.name} now governs ${policy.matchClass || 'all classes'} alerts in ${policy.matchTargetRoute || 'any workspace'} with ${policy.matchSeverity || 'any'} severity.`,
    });
    res.status(201).json(policy);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/policies/:id', validate(schemas.alertPolicyIdParam, 'params'), validate(schemas.alertPolicyUpdate), (req, res) => {
  try {
    if (!ensureMutationAllowed(req, res, { actionKey: 'alert_policy_save', entityType: 'alert-policy', entityRef: req.params.id })) return;
    const previous = getAlertPolicy(req.params.id);
    if (!previous) {
      res.status(404).json({ error: 'ALERT_POLICY_NOT_FOUND' });
      return;
    }
    const policy = saveAlertPolicy(req.body, req.params.id);
    auditLogService.record({
      category: 'alerts',
      action: 'alert_policy_updated',
      actionLabel: 'Updated alert policy for',
      entityType: 'alert-policy',
      entityRef: policy.id,
      entityName: policy.name,
      operator: req.session?.xenUser || 'system',
      route: '/alerts',
      status: 'success',
      before: previous,
      after: policy,
      detail: `${policy.name} policy criteria or automation settings were updated.`,
    });
    res.json(policy);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/policies/:id', validate(schemas.alertPolicyIdParam, 'params'), (req, res) => {
  try {
    if (!ensureMutationAllowed(req, res, { actionKey: 'alert_policy_delete', entityType: 'alert-policy', entityRef: req.params.id, destructive: true })) return;
    const result = deleteAlertPolicy(req.params.id);
    if (!result.deleted) {
      res.status(404).json({ error: 'ALERT_POLICY_NOT_FOUND' });
      return;
    }
    auditLogService.record({
      category: 'alerts',
      action: 'alert_policy_deleted',
      actionLabel: 'Removed alert policy for',
      entityType: 'alert-policy',
      entityRef: req.params.id,
      entityName: result.previous?.name || req.params.id,
      operator: req.session?.xenUser || 'system',
      route: '/alerts',
      status: 'success',
      before: result.previous,
      after: { success: true },
      detail: 'Alert suppression policy removed from persisted automation.',
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
