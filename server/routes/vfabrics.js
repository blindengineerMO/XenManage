const express = require('express');
const { vFabricModel, connectionModel, hostTargetModel } = require('../models/connection');
const { validate, schemas } = require('../middleware/validate');
const { ensureMutationAllowed } = require('../middleware/governance');
const auditLogService = require('../services/audit-log');
const { getVFabricScope } = require('../services/vfabric-scope');
const {
  canManageRecord,
  enrichOwnedRecord,
  enrichOwnedRecords,
  isVisibleToActor,
  resolveActor,
  resolveCreateOwnership,
  resolveUpdateOwnership,
} = require('../services/resource-ownership');

const router = express.Router();

function filterVisibleMembers(record, actor) {
  return {
    ...record,
    members: (record.members || []).filter((member) => isVisibleToActor(member, actor)),
  };
}

function findManageable(id, actor, res) {
  const record = vFabricModel.getById(id);
  if (!record) {
    res.status(404).json({ error: 'VFABRIC_NOT_FOUND' });
    return null;
  }
  if (!canManageRecord(record, actor)) {
    res.status(403).json({ error: 'VFABRIC_FORBIDDEN' });
    return null;
  }
  return record;
}

function validateMemberVisibility(body, actor) {
  for (const id of body.connectionIds || []) {
    if (!connectionModel.getVisibleById(id, actor)) {
      const error = new Error(`Pool target ${id} is not visible to this operator.`);
      error.code = 'VFABRIC_MEMBER_FORBIDDEN';
      throw error;
    }
  }
  for (const id of body.hostTargetIds || []) {
    if (!hostTargetModel.getVisibleById(id, actor)) {
      const error = new Error(`Host target ${id} is not visible to this operator.`);
      error.code = 'VFABRIC_MEMBER_FORBIDDEN';
      throw error;
    }
  }
}

router.get('/', (req, res) => {
  const actor = resolveActor(req);
  const records = vFabricModel.listVisible(actor).map((record) => filterVisibleMembers(record, actor));
  const data = enrichOwnedRecords(records, actor);
  res.json({ total: data.length, data });
});

router.get('/:id/scope', validate(schemas.vFabricIdParam, 'params'), (req, res) => {
  try {
    res.json(getVFabricScope(req, req.params.id));
  } catch (error) {
    res.status(error.status || 500).json({ error: error.code || error.message });
  }
});

router.get('/:id', validate(schemas.vFabricIdParam, 'params'), (req, res) => {
  const actor = resolveActor(req);
  const record = vFabricModel.getById(req.params.id);
  if (!record || !isVisibleToActor(record, actor)) return res.status(404).json({ error: 'VFABRIC_NOT_FOUND' });
  res.json(enrichOwnedRecord(filterVisibleMembers(record, actor), actor));
});

router.post('/', validate(schemas.vFabricCreate), (req, res) => {
  try {
    if (!ensureMutationAllowed(req, res, { actionKey: 'vfabric_create', entityType: 'vfabric', entityRef: 'new' })) return;
    const actor = resolveActor(req);
    validateMemberVisibility(req.body, actor);
    const ownership = resolveCreateOwnership(req.body, actor);
    const record = vFabricModel.create({ ...req.body, ownerUserId: ownership.ownerUserId, visibility: ownership.visibility });
    const response = enrichOwnedRecord(filterVisibleMembers(record, actor), actor);
    auditLogService.record({ category: 'vfabrics', action: 'vfabric_created', actionLabel: 'Created vFabric', entityType: 'vfabric', entityRef: String(record.id), entityName: record.name, operator: actor.username, route: '/vfabrics', status: 'success', before: null, after: response, detail: `${response.members.length} visible target(s) grouped.` });
    res.status(201).json(response);
  } catch (error) {
    res.status(error.code === 'VFABRIC_MEMBER_FORBIDDEN' ? 403 : 500).json({ error: error.code || error.message });
  }
});

router.put('/:id', validate(schemas.vFabricIdParam, 'params'), validate(schemas.vFabricUpdate), (req, res) => {
  try {
    if (!ensureMutationAllowed(req, res, { actionKey: 'vfabric_update', entityType: 'vfabric', entityRef: String(req.params.id) })) return;
    const actor = resolveActor(req);
    const previous = findManageable(req.params.id, actor, res);
    if (!previous) return;
    validateMemberVisibility(req.body, actor);
    const ownership = resolveUpdateOwnership(previous, req.body, actor);
    const record = vFabricModel.update(req.params.id, { ...req.body, ownerUserId: ownership.ownerUserId, visibility: ownership.visibility });
    const response = enrichOwnedRecord(filterVisibleMembers(record, actor), actor);
    auditLogService.record({ category: 'vfabrics', action: 'vfabric_updated', actionLabel: 'Updated vFabric', entityType: 'vfabric', entityRef: String(record.id), entityName: record.name, operator: actor.username, route: '/vfabrics', status: 'success', before: enrichOwnedRecord(previous, actor), after: response, detail: `${response.members.length} visible target(s) grouped.` });
    res.json(response);
  } catch (error) {
    res.status(error.code === 'VFABRIC_MEMBER_FORBIDDEN' ? 403 : 500).json({ error: error.code || error.message });
  }
});

router.delete('/:id', validate(schemas.vFabricIdParam, 'params'), (req, res) => {
  if (!ensureMutationAllowed(req, res, { actionKey: 'vfabric_delete', entityType: 'vfabric', entityRef: String(req.params.id), destructive: true })) return;
  const actor = resolveActor(req);
  const previous = findManageable(req.params.id, actor, res);
  if (!previous) return;
  vFabricModel.delete(req.params.id);
  auditLogService.record({ category: 'vfabrics', action: 'vfabric_deleted', actionLabel: 'Deleted vFabric', entityType: 'vfabric', entityRef: String(req.params.id), entityName: previous.name, operator: actor.username, route: '/vfabrics', status: 'success', before: enrichOwnedRecord(previous, actor), after: { success: true }, detail: 'Logical grouping deleted; member targets were not changed.' });
  res.json({ success: true });
});

module.exports = router;
