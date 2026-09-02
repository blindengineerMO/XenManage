const express = require('express');
const { terraformStateModel } = require('../models/connection');
const { requireApiToken, requireApiPermission } = require('../middleware/api-token');
const auditLogService = require('../services/audit-log');

const router = express.Router();
router.use(requireApiToken);

function stateName(req) {
  const name = String(req.params.name || 'default').trim();
  return /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,119}$/.test(name) ? name : '';
}

router.get('/:name', requireApiPermission('terraform.state.read'), (req, res) => {
  const state = terraformStateModel.get(stateName(req));
  if (!state) return res.status(404).end();
  res.type('application/json').send(state.state_json);
});

router.post('/:name', requireApiPermission('terraform.state.write'), (req, res) => {
  const name = stateName(req);
  if (!name || !req.body || typeof req.body !== 'object') return res.status(400).json({ error: 'TERRAFORM_STATE_INVALID' });
  const state = terraformStateModel.save(name, JSON.stringify(req.body), req.principal.userId);
  auditLogService.record({ category: 'terraform', action: 'terraform_state_saved', actionLabel: 'Saved Terraform state', entityType: 'terraform_state', entityRef: name, operator: req.principal.username, route: '/api/terraform', after: { updatedAt: state.updated_at } });
  res.status(200).end();
});

router.post('/:name/lock', requireApiPermission('terraform.state.write'), (req, res) => {
  const name = stateName(req);
  const lockId = String(req.body?.ID || '').trim();
  if (!name || !lockId) return res.status(400).json({ error: 'TERRAFORM_LOCK_INVALID' });
  const state = terraformStateModel.lock(name, lockId, JSON.stringify(req.body), req.principal.userId);
  if (!state) {
    const existing = terraformStateModel.get(name);
    return res.status(423).type('application/json').send(existing?.lock_json || '{}');
  }
  res.status(200).end();
});

router.post('/:name/unlock', requireApiPermission('terraform.state.write'), (req, res) => {
  const name = stateName(req);
  if (!name || !terraformStateModel.unlock(name, String(req.body?.ID || '').trim())) return res.status(409).json({ error: 'TERRAFORM_LOCK_NOT_OWNED' });
  res.status(200).end();
});

module.exports = router;
