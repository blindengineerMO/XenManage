const express = require('express');
const { validate, schemas } = require('../middleware/validate');
const { userModel } = require('../models/security-db');
const governanceService = require('../services/governance');
const auditLogService = require('../services/audit-log');

const router = express.Router();

function currentOperator(req) {
  return req.session?.appUsername || req.session?.xenUser || 'system';
}

function requireLocalAdmin(req, res, next) {
  if (!req.session?.userId) {
    return res.status(403).json({ error: 'LOCAL_USER_REQUIRED' });
  }

  const account = userModel.getById(req.session.userId);
  if (!account || !account.active) {
    return res.status(403).json({ error: 'LOCAL_USER_REQUIRED' });
  }

  if (account.role !== 'admin' || governanceService.getSessionRole(req.session) !== 'admin') {
    return res.status(403).json({ error: 'ADMIN_ROLE_REQUIRED' });
  }

  req.localAccount = account;
  next();
}

function mapWriteError(error) {
  const code = error?.code || error?.message || 'USER_WRITE_FAILED';
  if (code === 'USER_NOT_FOUND') return { status: 404, error: code };
  if (code === 'USERNAME_ALREADY_EXISTS' || code === 'LAST_ACTIVE_ADMIN_REQUIRED') return { status: 409, error: code };
  return { status: 500, error: code };
}

router.use(requireLocalAdmin);

router.get('/', (_req, res) => {
  try {
    const data = userModel.list();
    res.json({
      total: data.length,
      data,
      summary: userModel.getSummary(),
    });
  } catch (error) {
    res.status(500).json({ error: error.message || 'USER_LIST_FAILED' });
  }
});

router.post('/', validate(schemas.userCreate), (req, res) => {
  try {
    const user = userModel.create(req.body);
    auditLogService.record({
      category: 'governance',
      action: 'user_created',
      actionLabel: 'Created local user',
      entityType: 'user',
      entityRef: String(user.id),
      entityName: user.username,
      operator: currentOperator(req),
      route: '/governance',
      status: 'success',
      before: null,
      after: user,
      detail: `Created local ${user.role} account ${user.username}${user.active ? '' : ' in a disabled state'}.`,
    });
    res.status(201).json(user);
  } catch (error) {
    const mapped = mapWriteError(error);
    res.status(mapped.status).json({ error: mapped.error });
  }
});

router.put('/:id', validate(schemas.userIdParam, 'params'), validate(schemas.userUpdate), (req, res) => {
  try {
    const before = userModel.getById(req.params.id);
    const user = userModel.update(req.params.id, req.body);

    if (Number(req.session.userId) === Number(user.id)) {
      req.session.appUsername = user.username;
      req.session.displayName = user.display_name || user.username;
      req.session.governanceRole = governanceService.hasRole(user.role, req.session.governanceRole)
        ? req.session.governanceRole
        : user.role;
    }

    auditLogService.record({
      category: 'governance',
      action: 'user_updated',
      actionLabel: 'Updated local user',
      entityType: 'user',
      entityRef: String(user.id),
      entityName: user.username,
      operator: currentOperator(req),
      route: '/governance',
      status: 'success',
      before,
      after: user,
      detail: `Updated local account ${user.username} (${user.role}, ${user.active ? 'active' : 'disabled'}).`,
    });
    res.json(user);
  } catch (error) {
    const mapped = mapWriteError(error);
    res.status(mapped.status).json({ error: mapped.error });
  }
});

router.post('/:id/password', validate(schemas.userIdParam, 'params'), validate(schemas.userPasswordReset), (req, res) => {
  try {
    const before = userModel.getById(req.params.id);
    const user = userModel.setPassword(req.params.id, req.body.password);
    auditLogService.record({
      category: 'governance',
      action: 'user_password_reset',
      actionLabel: 'Reset password for',
      entityType: 'user',
      entityRef: String(user.id),
      entityName: user.username,
      operator: currentOperator(req),
      route: '/governance',
      status: 'success',
      before,
      after: { ...user, password: 'rotated' },
      detail: `Rotated the local password for ${user.username}.`,
    });
    res.json({ success: true, user });
  } catch (error) {
    const mapped = mapWriteError(error);
    res.status(mapped.status).json({ error: mapped.error });
  }
});

module.exports = router;
