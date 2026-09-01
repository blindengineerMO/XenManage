const { templateLibraryModel } = require('../models/connection');
const { canManageRecord } = require('./resource-ownership');

const VALID_KINDS = new Set(['deployment-template', 'guest-script', 'snippet']);

function normalizeKind(value) {
  return VALID_KINDS.has(value) ? value : 'snippet';
}

function buildTree(actor = {}) {
  const folders = templateLibraryModel.listFolders(actor);
  const items = templateLibraryModel.listItems(actor);

  const folderNodes = new Map(folders.map((folder) => [folder.id, {
    id: folder.id,
    type: 'folder',
    name: folder.name,
    parentId: folder.parent_id,
    ownerUserId: folder.owner_user_id,
    visibility: folder.visibility,
    createdAt: folder.created_at,
    canManage: canManageRecord(folder, actor),
    children: [],
  }]));

  const itemNodes = items.map((item) => ({
    id: item.id,
    type: 'item',
    kind: item.kind,
    name: item.name,
    language: item.language,
    version: item.version,
    folderId: item.folder_id,
    ownerUserId: item.owner_user_id,
    visibility: item.visibility,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
    canManage: canManageRecord(item, actor),
  }));

  const roots = [];
  for (const folder of folderNodes.values()) {
    if (folder.parentId && folderNodes.has(folder.parentId)) {
      folderNodes.get(folder.parentId).children.push(folder);
    } else {
      roots.push(folder);
    }
  }

  for (const item of itemNodes) {
    if (item.folderId && folderNodes.has(item.folderId)) {
      folderNodes.get(item.folderId).children.push(item);
    } else {
      roots.push(item);
    }
  }

  const sortNode = (node) => {
    if (node.type !== 'folder') return;
    node.children.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
      return String(a.name).localeCompare(String(b.name));
    });
    node.children.forEach(sortNode);
  };
  roots.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
    return String(a.name).localeCompare(String(b.name));
  });
  roots.forEach(sortNode);

  return roots;
}

module.exports = { normalizeKind, buildTree };
