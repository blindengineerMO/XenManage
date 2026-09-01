const express = require('express');
const router = express.Router();
const { templateLibraryModel } = require('../models/connection');
const { validate, schemas } = require('../middleware/validate');
const auditLogService = require('../services/audit-log');
const { ensureMutationAllowed } = require('../middleware/governance');
const templateLibraryService = require('../services/template-library');
const {
  canManageRecord,
  resolveActor,
  resolveCreateOwnership,
} = require('../services/resource-ownership');

function findFolderOrRespond(id, actor, res) {
  const record = templateLibraryModel.getFolderById(id);
  if (!record) {
    res.status(404).json({ error: 'TEMPLATE_LIBRARY_FOLDER_NOT_FOUND' });
    return null;
  }
  if (!canManageRecord(record, actor)) {
    res.status(403).json({ error: 'TEMPLATE_LIBRARY_FOLDER_FORBIDDEN' });
    return null;
  }
  return record;
}

function findItemOrRespond(id, actor, res) {
  const record = templateLibraryModel.getItemById(id);
  if (!record) {
    res.status(404).json({ error: 'TEMPLATE_LIBRARY_ITEM_NOT_FOUND' });
    return null;
  }
  if (!canManageRecord(record, actor)) {
    res.status(403).json({ error: 'TEMPLATE_LIBRARY_ITEM_FORBIDDEN' });
    return null;
  }
  return record;
}

router.get('/tree', (req, res) => {
  try {
    const actor = resolveActor(req);
    res.json({ data: templateLibraryService.buildTree(actor) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Folders

router.post('/folders', validate(schemas.templateLibraryFolderCreate), (req, res) => {
  try {
    if (!ensureMutationAllowed(req, res, { actionKey: 'template_library_folder_create', entityType: 'template-library-folder', entityRef: 'new' })) return;
    const actor = resolveActor(req);
    const ownership = resolveCreateOwnership(req.body, actor);
    const folder = templateLibraryModel.createFolder({
      name: req.body.name,
      parentId: req.body.parentId,
      ownerUserId: ownership.ownerUserId,
      visibility: ownership.visibility,
    });
    auditLogService.record({
      category: 'template-library',
      action: 'template_library_folder_created',
      actionLabel: 'Created template library folder',
      entityType: 'template-library-folder',
      entityRef: String(folder.id),
      entityName: folder.name,
      operator: actor.username,
      route: '/templates',
      status: 'success',
      after: folder,
      detail: `Folder "${folder.name}" created in the template library.`,
    });
    res.json(folder);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/folders/:id', validate(schemas.templateLibraryNumericId, 'params'), validate(schemas.templateLibraryFolderRename), (req, res) => {
  try {
    if (!ensureMutationAllowed(req, res, { actionKey: 'template_library_folder_rename', entityType: 'template-library-folder', entityRef: String(req.params.id) })) return;
    const actor = resolveActor(req);
    const previous = findFolderOrRespond(req.params.id, actor, res);
    if (!previous) return;
    const folder = templateLibraryModel.renameFolder(req.params.id, req.body.name);
    auditLogService.record({
      category: 'template-library',
      action: 'template_library_folder_renamed',
      actionLabel: 'Renamed template library folder',
      entityType: 'template-library-folder',
      entityRef: String(folder.id),
      entityName: folder.name,
      operator: actor.username,
      route: '/templates',
      status: 'success',
      before: previous,
      after: folder,
      detail: `Folder renamed from "${previous.name}" to "${folder.name}".`,
    });
    res.json(folder);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/folders/:id/move', validate(schemas.templateLibraryNumericId, 'params'), validate(schemas.templateLibraryFolderMove), (req, res) => {
  try {
    if (!ensureMutationAllowed(req, res, { actionKey: 'template_library_folder_move', entityType: 'template-library-folder', entityRef: String(req.params.id) })) return;
    const actor = resolveActor(req);
    const previous = findFolderOrRespond(req.params.id, actor, res);
    if (!previous) return;
    if (Number(req.body.parentId) === Number(req.params.id)) {
      res.status(400).json({ error: 'TEMPLATE_LIBRARY_FOLDER_CANNOT_PARENT_ITSELF' });
      return;
    }
    const folder = templateLibraryModel.moveFolder(req.params.id, req.body.parentId);
    auditLogService.record({
      category: 'template-library',
      action: 'template_library_folder_moved',
      actionLabel: 'Moved template library folder',
      entityType: 'template-library-folder',
      entityRef: String(folder.id),
      entityName: folder.name,
      operator: actor.username,
      route: '/templates',
      status: 'success',
      before: previous,
      after: folder,
      detail: `Folder "${folder.name}" moved.`,
    });
    res.json(folder);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/folders/:id', validate(schemas.templateLibraryNumericId, 'params'), (req, res) => {
  try {
    if (!ensureMutationAllowed(req, res, { actionKey: 'template_library_folder_delete', entityType: 'template-library-folder', entityRef: String(req.params.id), destructive: true })) return;
    const actor = resolveActor(req);
    const previous = findFolderOrRespond(req.params.id, actor, res);
    if (!previous) return;
    templateLibraryModel.deleteFolder(req.params.id);
    auditLogService.record({
      category: 'template-library',
      action: 'template_library_folder_deleted',
      actionLabel: 'Deleted template library folder',
      entityType: 'template-library-folder',
      entityRef: String(req.params.id),
      entityName: previous.name,
      operator: actor.username,
      route: '/templates',
      status: 'success',
      before: previous,
      after: { success: true },
      detail: `Folder "${previous.name}" and its contents removed from the template library.`,
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Items

router.post('/items', validate(schemas.templateLibraryItemCreate), (req, res) => {
  try {
    if (!ensureMutationAllowed(req, res, { actionKey: 'template_library_item_create', entityType: 'template-library-item', entityRef: 'new' })) return;
    const actor = resolveActor(req);
    const ownership = resolveCreateOwnership(req.body, actor);
    const item = templateLibraryModel.createItem({
      folderId: req.body.folderId,
      kind: templateLibraryService.normalizeKind(req.body.kind),
      name: req.body.name,
      language: req.body.language,
      content: req.body.content,
      ownerUserId: ownership.ownerUserId,
      visibility: ownership.visibility,
    });
    auditLogService.record({
      category: 'template-library',
      action: 'template_library_item_created',
      actionLabel: 'Created template library item',
      entityType: 'template-library-item',
      entityRef: String(item.id),
      entityName: item.name,
      operator: actor.username,
      route: '/templates',
      status: 'success',
      after: item,
      detail: `${item.kind} "${item.name}" created in the template library.`,
    });
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/items/:id', validate(schemas.templateLibraryNumericId, 'params'), (req, res) => {
  const actor = resolveActor(req);
  const item = findItemOrRespond(req.params.id, actor, res);
  if (!item) return;
  res.json(item);
});

router.get('/items/:id/versions', validate(schemas.templateLibraryNumericId, 'params'), (req, res) => {
  const actor = resolveActor(req);
  const item = findItemOrRespond(req.params.id, actor, res);
  if (!item) return;
  res.json({ data: templateLibraryModel.listItemVersions(req.params.id) });
});

router.put('/items/:id/rename', validate(schemas.templateLibraryNumericId, 'params'), validate(schemas.templateLibraryItemRename), (req, res) => {
  try {
    if (!ensureMutationAllowed(req, res, { actionKey: 'template_library_item_rename', entityType: 'template-library-item', entityRef: String(req.params.id) })) return;
    const actor = resolveActor(req);
    const previous = findItemOrRespond(req.params.id, actor, res);
    if (!previous) return;
    const item = templateLibraryModel.renameItem(req.params.id, req.body.name);
    auditLogService.record({
      category: 'template-library',
      action: 'template_library_item_renamed',
      actionLabel: 'Renamed template library item',
      entityType: 'template-library-item',
      entityRef: String(item.id),
      entityName: item.name,
      operator: actor.username,
      route: '/templates',
      status: 'success',
      before: previous,
      after: item,
      detail: `Item renamed from "${previous.name}" to "${item.name}".`,
    });
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/items/:id/move', validate(schemas.templateLibraryNumericId, 'params'), validate(schemas.templateLibraryItemMove), (req, res) => {
  try {
    if (!ensureMutationAllowed(req, res, { actionKey: 'template_library_item_move', entityType: 'template-library-item', entityRef: String(req.params.id) })) return;
    const actor = resolveActor(req);
    const previous = findItemOrRespond(req.params.id, actor, res);
    if (!previous) return;
    const item = templateLibraryModel.moveItem(req.params.id, req.body.folderId);
    auditLogService.record({
      category: 'template-library',
      action: 'template_library_item_moved',
      actionLabel: 'Moved template library item',
      entityType: 'template-library-item',
      entityRef: String(item.id),
      entityName: item.name,
      operator: actor.username,
      route: '/templates',
      status: 'success',
      before: previous,
      after: item,
      detail: `Item "${item.name}" moved.`,
    });
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/items/:id', validate(schemas.templateLibraryNumericId, 'params'), validate(schemas.templateLibraryItemSave), (req, res) => {
  try {
    if (!ensureMutationAllowed(req, res, { actionKey: 'template_library_item_save', entityType: 'template-library-item', entityRef: String(req.params.id) })) return;
    const actor = resolveActor(req);
    const previous = findItemOrRespond(req.params.id, actor, res);
    if (!previous) return;
    const item = templateLibraryModel.saveItemContent(req.params.id, req.body.content, actor.userId);
    auditLogService.record({
      category: 'template-library',
      action: 'template_library_item_saved',
      actionLabel: 'Saved template library item',
      entityType: 'template-library-item',
      entityRef: String(item.id),
      entityName: item.name,
      operator: actor.username,
      route: '/templates',
      status: 'success',
      before: { version: previous.version },
      after: { version: item.version },
      detail: `Item "${item.name}" saved as version ${item.version}.`,
    });
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/items/:id', validate(schemas.templateLibraryNumericId, 'params'), (req, res) => {
  try {
    if (!ensureMutationAllowed(req, res, { actionKey: 'template_library_item_delete', entityType: 'template-library-item', entityRef: String(req.params.id), destructive: true })) return;
    const actor = resolveActor(req);
    const previous = findItemOrRespond(req.params.id, actor, res);
    if (!previous) return;
    templateLibraryModel.deleteItem(req.params.id);
    auditLogService.record({
      category: 'template-library',
      action: 'template_library_item_deleted',
      actionLabel: 'Deleted template library item',
      entityType: 'template-library-item',
      entityRef: String(req.params.id),
      entityName: previous.name,
      operator: actor.username,
      route: '/templates',
      status: 'success',
      before: previous,
      after: { success: true },
      detail: `Item "${previous.name}" removed from the template library.`,
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
