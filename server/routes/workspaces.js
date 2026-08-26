const express = require('express');
const { validate, schemas } = require('../middleware/validate');
const { ensureMutationAllowed } = require('../middleware/governance');
const auditLogService = require('../services/audit-log');
const inventoryWorkspaceService = require('../services/inventory-workspaces');
const {
  enrichOwnedRecord,
  enrichOwnedRecords,
  resolveActor,
  resolveCreateOwnership,
} = require('../services/resource-ownership');

const router = express.Router();

router.get('/inventory', (req, res) => {
  try {
    const actor = resolveActor(req);
    const workspaces = inventoryWorkspaceService.list(actor);
    res.json({ total: workspaces.length, data: enrichOwnedRecords(workspaces.map((workspace) => ({
      ...workspace,
      owner_user_id: workspace.ownerUserId,
    })), actor).map((workspace) => ({
      ...workspace,
      ownerUserId: workspace.owner_user_id,
    })) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/inventory', validate(schemas.inventoryWorkspaceUpdate), (req, res) => {
  try {
    if (!ensureMutationAllowed(req, res, { actionKey: 'inventory_workspace_save', entityType: 'workspace', entityRef: 'new' })) return;
    const actor = resolveActor(req);
    const ownership = resolveCreateOwnership(req.body, actor);
    const workspace = inventoryWorkspaceService.create(req.body, {
      operator: actor.username,
      userId: ownership.ownerUserId,
      ownerUserId: ownership.ownerUserId,
      role: actor.role,
    });
    const responseRecord = {
      ...enrichOwnedRecord({ ...workspace, owner_user_id: workspace.ownerUserId }, actor),
      ownerUserId: workspace.ownerUserId,
    };
    auditLogService.record({
      category: 'inventory',
      action: 'inventory_workspace_created',
      actionLabel: 'Saved inventory workspace',
      entityType: 'workspace',
      entityRef: workspace.id,
      entityName: workspace.name,
      operator: actor.username,
      route: '/inventory',
      status: 'success',
      before: null,
      after: responseRecord,
      detail: `${workspace.name} now captures the ${workspace.scope} scope${workspace.targetConnectionId ? ` with target ${workspace.targetConnectionId}` : ''}.`,
    });
    res.status(201).json(responseRecord);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/inventory/:id', validate(schemas.inventoryWorkspaceIdParam, 'params'), validate(schemas.inventoryWorkspaceUpdate), (req, res) => {
  try {
    if (!ensureMutationAllowed(req, res, { actionKey: 'inventory_workspace_save', entityType: 'workspace', entityRef: req.params.id })) return;
    const actor = resolveActor(req);
    const previous = inventoryWorkspaceService.get(req.params.id, actor);
    if (!previous) {
      res.status(404).json({ error: 'INVENTORY_WORKSPACE_NOT_FOUND' });
      return;
    }
    const workspace = inventoryWorkspaceService.update(req.params.id, req.body, actor);
    const responseRecord = {
      ...enrichOwnedRecord({ ...workspace, owner_user_id: workspace.ownerUserId }, actor),
      ownerUserId: workspace.ownerUserId,
    };
    auditLogService.record({
      category: 'inventory',
      action: 'inventory_workspace_updated',
      actionLabel: 'Updated inventory workspace',
      entityType: 'workspace',
      entityRef: workspace.id,
      entityName: workspace.name,
      operator: actor.username,
      route: '/inventory',
      status: 'success',
      before: {
        ...enrichOwnedRecord({ ...previous, owner_user_id: previous.ownerUserId }, actor),
        ownerUserId: previous.ownerUserId,
      },
      after: responseRecord,
      detail: `${workspace.name} workspace filters or target orchestration were updated.`,
    });
    res.json(responseRecord);
  } catch (err) {
    if (err.code === 'INVENTORY_WORKSPACE_NOT_FOUND') {
      res.status(404).json({ error: err.code });
      return;
    }
    if (err.code === 'INVENTORY_WORKSPACE_FORBIDDEN') {
      res.status(403).json({ error: err.code });
      return;
    }
    res.status(500).json({ error: err.message });
  }
});

router.delete('/inventory/:id', validate(schemas.inventoryWorkspaceIdParam, 'params'), (req, res) => {
  try {
    if (!ensureMutationAllowed(req, res, { actionKey: 'inventory_workspace_delete', entityType: 'workspace', entityRef: req.params.id, destructive: true })) return;
    const actor = resolveActor(req);
    const existing = inventoryWorkspaceService.get(req.params.id, actor);
    if (!existing) {
      res.status(404).json({ error: 'INVENTORY_WORKSPACE_NOT_FOUND' });
      return;
    }
    const workspace = inventoryWorkspaceService.delete(req.params.id, actor);
    auditLogService.record({
      category: 'inventory',
      action: 'inventory_workspace_deleted',
      actionLabel: 'Removed inventory workspace',
      entityType: 'workspace',
      entityRef: workspace.id,
      entityName: workspace.name,
      operator: actor.username,
      route: '/inventory',
      status: 'success',
      before: {
        ...enrichOwnedRecord({ ...existing, owner_user_id: existing.ownerUserId }, actor),
        ownerUserId: existing.ownerUserId,
      },
      after: { success: true },
      detail: `${workspace.name} workspace was removed from the shared inventory catalog.`,
    });
    res.json({ success: true });
  } catch (err) {
    if (err.code === 'INVENTORY_WORKSPACE_NOT_FOUND') {
      res.status(404).json({ error: err.code });
      return;
    }
    if (err.code === 'INVENTORY_WORKSPACE_FORBIDDEN') {
      res.status(403).json({ error: err.code });
      return;
    }
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
