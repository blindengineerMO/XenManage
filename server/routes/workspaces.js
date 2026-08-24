const express = require('express');
const { validate, schemas } = require('../middleware/validate');
const { ensureMutationAllowed } = require('../middleware/governance');
const auditLogService = require('../services/audit-log');
const inventoryWorkspaceService = require('../services/inventory-workspaces');

const router = express.Router();

router.get('/inventory', (_req, res) => {
  try {
    const workspaces = inventoryWorkspaceService.list();
    res.json({ total: workspaces.length, data: workspaces });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/inventory', validate(schemas.inventoryWorkspaceUpdate), (req, res) => {
  try {
    if (!ensureMutationAllowed(req, res, { actionKey: 'inventory_workspace_save', entityType: 'workspace', entityRef: 'new' })) return;
    const workspace = inventoryWorkspaceService.create(req.body, req.session?.xenUser || 'system');
    auditLogService.record({
      category: 'inventory',
      action: 'inventory_workspace_created',
      actionLabel: 'Saved inventory workspace',
      entityType: 'workspace',
      entityRef: workspace.id,
      entityName: workspace.name,
      operator: req.session?.xenUser || 'system',
      route: '/inventory',
      status: 'success',
      before: null,
      after: workspace,
      detail: `${workspace.name} now captures the ${workspace.scope} scope${workspace.targetConnectionId ? ` with target ${workspace.targetConnectionId}` : ''}.`,
    });
    res.status(201).json(workspace);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/inventory/:id', validate(schemas.inventoryWorkspaceIdParam, 'params'), validate(schemas.inventoryWorkspaceUpdate), (req, res) => {
  try {
    if (!ensureMutationAllowed(req, res, { actionKey: 'inventory_workspace_save', entityType: 'workspace', entityRef: req.params.id })) return;
    const previous = inventoryWorkspaceService.get(req.params.id);
    const workspace = inventoryWorkspaceService.update(req.params.id, req.body);
    auditLogService.record({
      category: 'inventory',
      action: 'inventory_workspace_updated',
      actionLabel: 'Updated inventory workspace',
      entityType: 'workspace',
      entityRef: workspace.id,
      entityName: workspace.name,
      operator: req.session?.xenUser || 'system',
      route: '/inventory',
      status: 'success',
      before: previous,
      after: workspace,
      detail: `${workspace.name} workspace filters or target orchestration were updated.`,
    });
    res.json(workspace);
  } catch (err) {
    if (err.code === 'INVENTORY_WORKSPACE_NOT_FOUND') {
      res.status(404).json({ error: err.code });
      return;
    }
    res.status(500).json({ error: err.message });
  }
});

router.delete('/inventory/:id', validate(schemas.inventoryWorkspaceIdParam, 'params'), (req, res) => {
  try {
    if (!ensureMutationAllowed(req, res, { actionKey: 'inventory_workspace_delete', entityType: 'workspace', entityRef: req.params.id })) return;
    const workspace = inventoryWorkspaceService.delete(req.params.id);
    auditLogService.record({
      category: 'inventory',
      action: 'inventory_workspace_deleted',
      actionLabel: 'Removed inventory workspace',
      entityType: 'workspace',
      entityRef: workspace.id,
      entityName: workspace.name,
      operator: req.session?.xenUser || 'system',
      route: '/inventory',
      status: 'success',
      before: workspace,
      after: { success: true },
      detail: `${workspace.name} workspace was removed from the shared inventory catalog.`,
    });
    res.json({ success: true });
  } catch (err) {
    if (err.code === 'INVENTORY_WORKSPACE_NOT_FOUND') {
      res.status(404).json({ error: err.code });
      return;
    }
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
