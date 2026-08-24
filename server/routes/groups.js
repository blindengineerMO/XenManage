const express = require('express');
const { validate, schemas } = require('../middleware/validate');
const { groupModel, userModel } = require('../models/security-db');
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
  const code = error?.code || error?.message || 'GROUP_WRITE_FAILED';
  if (code === 'GROUP_NOT_FOUND' || code === 'USER_NOT_FOUND') return { status: 404, error: code };
  if (code === 'GROUP_NAME_ALREADY_EXISTS') return { status: 409, error: code };
  return { status: 500, error: code };
}

router.use(requireLocalAdmin);

router.get('/', (_req, res) => {
  try {
    const data = groupModel.list();
    res.json({
      total: data.length,
      data,
    });
  } catch (error) {
    res.status(500).json({ error: error.message || 'GROUP_LIST_FAILED' });
  }
});

router.post('/', validate(schemas.groupCreate), (req, res) => {
  try {
    const group = groupModel.create(req.body);
    auditLogService.record({
      category: 'governance',
      action: 'group_created',
      actionLabel: 'Created local group',
      entityType: 'group',
      entityRef: String(group.id),
      entityName: group.name,
      operator: currentOperator(req),
      route: '/governance',
      status: 'success',
      before: null,
      after: group,
      detail: `Created local group ${group.name} with ${group.member_count || 0} assigned member${(group.member_count || 0) === 1 ? '' : 's'}.`,
    });
    res.status(201).json(group);
  } catch (error) {
    const mapped = mapWriteError(error);
    res.status(mapped.status).json({ error: mapped.error });
  }
});

router.put('/:id', validate(schemas.groupIdParam, 'params'), validate(schemas.groupUpdate), (req, res) => {
  try {
    const before = groupModel.getById(req.params.id);
    const group = groupModel.update(req.params.id, req.body);
    auditLogService.record({
      category: 'governance',
      action: 'group_updated',
      actionLabel: 'Updated local group',
      entityType: 'group',
      entityRef: String(group.id),
      entityName: group.name,
      operator: currentOperator(req),
      route: '/governance',
      status: 'success',
      before,
      after: group,
      detail: `Updated local group ${group.name} and synchronized ${group.member_count || 0} member assignment${(group.member_count || 0) === 1 ? '' : 's'}.`,
    });
    res.json(group);
  } catch (error) {
    const mapped = mapWriteError(error);
    res.status(mapped.status).json({ error: mapped.error });
  }
});

router.delete('/:id', validate(schemas.groupIdParam, 'params'), (req, res) => {
  try {
    const group = groupModel.delete(req.params.id);
    auditLogService.record({
      category: 'governance',
      action: 'group_deleted',
      actionLabel: 'Removed local group',
      entityType: 'group',
      entityRef: String(group.id),
      entityName: group.name,
      operator: currentOperator(req),
      route: '/governance',
      status: 'success',
      before: group,
      after: { success: true },
      detail: `Removed local group ${group.name} from the control-plane access catalog.`,
    });
    res.json({ success: true });
  } catch (error) {
    const mapped = mapWriteError(error);
    res.status(mapped.status).json({ error: mapped.error });
  }
});

module.exports = router;
