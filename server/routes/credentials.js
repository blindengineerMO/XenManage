const express = require('express');
const { validate, schemas } = require('../middleware/validate');
const { ensureMutationAllowed } = require('../middleware/governance');
const credentialVaultService = require('../services/credential-vault');
const auditLogService = require('../services/audit-log');

const router = express.Router();

function requireLocalUser(req, res, next) {
  if (!req.session?.userId) {
    return res.status(403).json({ error: 'LOCAL_USER_REQUIRED' });
  }
  next();
}

router.use(requireLocalUser);

router.get('/', (req, res) => {
  try {
    const data = credentialVaultService.listVisible(req.session.userId);
    res.json({ total: data.length, data });
  } catch (error) {
    res.status(500).json({ error: error.message || 'CREDENTIAL_LIST_FAILED' });
  }
});

router.post('/', validate(schemas.credentialCreate), (req, res) => {
  try {
    if (!ensureMutationAllowed(req, res, { actionKey: 'credential_create', entityType: 'credential', entityRef: 'new' })) return;
    const credential = credentialVaultService.create(req.session.userId, req.body);
    auditLogService.record({
      category: 'credentials',
      action: 'credential_created',
      actionLabel: 'Saved vault credential',
      entityType: 'credential',
      entityRef: String(credential.id),
      entityName: credential.name,
      operator: req.session?.appUsername || req.session?.xenUser || 'local',
      route: '/settings',
      status: 'success',
      before: null,
      after: { ...credential, password: 'redacted' },
      detail: `${credential.scope} ${credential.targetType} credential saved to the XenMange vault.`,
    });
    res.status(201).json(credential);
  } catch (error) {
    res.status(500).json({ error: error.message || 'CREDENTIAL_CREATE_FAILED' });
  }
});

router.put('/:id', validate(schemas.connectionId, 'params'), validate(schemas.credentialUpdate), (req, res) => {
  try {
    if (!ensureMutationAllowed(req, res, { actionKey: 'credential_update', entityType: 'credential', entityRef: String(req.params.id) })) return;
    const before = credentialVaultService.listVisible(req.session.userId)
      .find((entry) => Number(entry.id) === Number(req.params.id)) || null;
    const credential = credentialVaultService.update(
      req.params.id,
      req.session.userId,
      req.session?.governanceRole || req.session?.user?.role || 'admin',
      req.body
    );
    auditLogService.record({
      category: 'credentials',
      action: 'credential_updated',
      actionLabel: 'Updated vault credential',
      entityType: 'credential',
      entityRef: String(credential.id),
      entityName: credential.name,
      operator: req.session?.appUsername || req.session?.xenUser || 'local',
      route: '/settings',
      status: 'success',
      before,
      after: { ...credential, password: req.body.password ? 'rotated' : 'unchanged' },
      detail: `${credential.scope} ${credential.targetType} credential metadata updated in the XenMange vault.`,
    });
    res.json(credential);
  } catch (error) {
    const code = error.code || error.message;
    const status = code === 'CREDENTIAL_NOT_FOUND' ? 404 : code === 'CREDENTIAL_FORBIDDEN' ? 403 : 500;
    res.status(status).json({ error: code || 'CREDENTIAL_UPDATE_FAILED' });
  }
});

router.delete('/:id', validate(schemas.connectionId, 'params'), (req, res) => {
  try {
    if (!ensureMutationAllowed(req, res, { actionKey: 'credential_delete', entityType: 'credential', entityRef: String(req.params.id) })) return;
    const before = credentialVaultService.listVisible(req.session.userId)
      .find((entry) => Number(entry.id) === Number(req.params.id)) || null;
    const result = credentialVaultService.delete(
      req.params.id,
      req.session.userId,
      req.session?.governanceRole || 'admin'
    );
    auditLogService.record({
      category: 'credentials',
      action: 'credential_deleted',
      actionLabel: 'Removed vault credential',
      entityType: 'credential',
      entityRef: String(req.params.id),
      entityName: before?.name || String(req.params.id),
      operator: req.session?.appUsername || req.session?.xenUser || 'local',
      route: '/settings',
      status: 'success',
      before,
      after: result,
      detail: 'Credential removed from the XenMange vault.',
    });
    res.json(result);
  } catch (error) {
    const code = error.code || error.message;
    const status = code === 'CREDENTIAL_NOT_FOUND' ? 404 : code === 'CREDENTIAL_FORBIDDEN' ? 403 : 500;
    res.status(status).json({ error: code || 'CREDENTIAL_DELETE_FAILED' });
  }
});

module.exports = router;
