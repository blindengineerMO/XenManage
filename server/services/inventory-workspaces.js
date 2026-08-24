const crypto = require('crypto');
const { settingsModel } = require('../models/connection');
const {
  canManageRecord,
  isVisibleToActor,
  normalizeOwnerUserId,
  normalizeVisibility,
} = require('./resource-ownership');

const SETTINGS_KEY = 'inventory.workspaces';
const MAX_WORKSPACES = 40;
const VALID_SCOPES = new Set(['all', 'pool', 'template', 'vm', 'host', 'storage', 'vdi', 'vbd', 'network', 'vif', 'pif', 'alert', 'task']);

function readWorkspaces() {
  try {
    const stored = JSON.parse(settingsModel.get(SETTINGS_KEY) || '[]');
    return Array.isArray(stored) ? stored : [];
  } catch (error) {
    return [];
  }
}

function writeWorkspaces(workspaces) {
  settingsModel.set(SETTINGS_KEY, JSON.stringify(workspaces.slice(0, MAX_WORKSPACES)));
}

function normalizeScope(value) {
  const scope = String(value || 'all').trim().toLowerCase();
  return VALID_SCOPES.has(scope) ? scope : 'all';
}

function normalizeWorkspace(workspace = {}, current = null) {
  const now = new Date().toISOString();
  const ownerUserId = normalizeOwnerUserId(workspace.ownerUserId ?? current?.ownerUserId ?? current?.owner_user_id ?? workspace.owner_user_id);
  return {
    id: current?.id || workspace.id || `workspace-${crypto.randomUUID()}`,
    name: String(workspace.name || current?.name || '').trim(),
    scope: normalizeScope(workspace.scope || current?.scope || 'all'),
    query: String(workspace.query || current?.query || '').trim(),
    targetConnectionId: workspace.targetConnectionId === null || workspace.targetConnectionId === ''
      ? null
      : Number(workspace.targetConnectionId ?? current?.targetConnectionId ?? 0) || null,
    notes: String(workspace.notes || current?.notes || '').trim(),
    ownerUserId,
    visibility: normalizeVisibility(workspace.visibility || current?.visibility, ownerUserId ? 'private' : 'shared'),
    createdAt: current?.createdAt || workspace.createdAt || now,
    updatedAt: now,
    createdBy: String(workspace.createdBy || current?.createdBy || '').trim(),
  };
}

function sortWorkspaces(workspaces) {
  return [...workspaces].sort((left, right) =>
    new Date(right.updatedAt || right.createdAt || 0) - new Date(left.updatedAt || left.createdAt || 0)
  );
}

const inventoryWorkspaceService = {
  list(actor = {}) {
    return sortWorkspaces(
      readWorkspaces()
        .map((workspace) => normalizeWorkspace(workspace, workspace))
        .filter((workspace) => isVisibleToActor({ ...workspace, owner_user_id: workspace.ownerUserId }, actor))
    );
  },

  listAll() {
    return sortWorkspaces(readWorkspaces().map((workspace) => normalizeWorkspace(workspace, workspace)));
  },

  get(id, actor = null) {
    const workspace = this.listAll().find((entry) => entry.id === id) || null;
    if (!workspace) return null;
    if (actor && !isVisibleToActor({ ...workspace, owner_user_id: workspace.ownerUserId }, actor)) {
      return null;
    }
    return workspace;
  },

  create(payload = {}, options = {}) {
    const workspaces = readWorkspaces();
    const actor = {
      userId: normalizeOwnerUserId(options.userId),
      role: options.role || 'operator',
    };
    const ownerUserId = normalizeOwnerUserId(options.ownerUserId ?? options.userId);
    const workspace = normalizeWorkspace({
      ...payload,
      ownerUserId,
      visibility: normalizeVisibility(payload.visibility, ownerUserId ? 'private' : 'shared'),
      createdBy: options.operator || 'system',
      createdAt: new Date().toISOString(),
    });
    if (!actor.userId && workspace.visibility === 'private') {
      workspace.visibility = 'shared';
    }
    workspaces.unshift(workspace);
    writeWorkspaces(workspaces);
    return workspace;
  },

  update(id, payload = {}, options = {}) {
    const workspaces = readWorkspaces();
    const index = workspaces.findIndex((workspace) => workspace.id === id);
    if (index === -1) {
      const error = new Error('INVENTORY_WORKSPACE_NOT_FOUND');
      error.code = 'INVENTORY_WORKSPACE_NOT_FOUND';
      throw error;
    }

    const current = normalizeWorkspace(workspaces[index], workspaces[index]);
    const actor = {
      userId: normalizeOwnerUserId(options.userId),
      role: options.role || 'operator',
    };
    if (!canManageRecord({ ...current, owner_user_id: current.ownerUserId }, actor)) {
      const error = new Error('INVENTORY_WORKSPACE_FORBIDDEN');
      error.code = 'INVENTORY_WORKSPACE_FORBIDDEN';
      throw error;
    }

    let ownerUserId = normalizeOwnerUserId(current.ownerUserId);
    if (!ownerUserId && actor.userId) {
      ownerUserId = actor.userId;
    }

    const visibility = !actor.userId
      ? 'shared'
      : normalizeVisibility(payload.visibility, current.visibility || (ownerUserId ? 'private' : 'shared'));

    const next = normalizeWorkspace({
      ...current,
      ...payload,
      ownerUserId,
      visibility,
    }, current);
    workspaces[index] = next;
    writeWorkspaces(workspaces);
    return next;
  },

  delete(id, actor = {}) {
    const workspaces = readWorkspaces();
    const index = workspaces.findIndex((workspace) => workspace.id === id);
    if (index === -1) {
      const error = new Error('INVENTORY_WORKSPACE_NOT_FOUND');
      error.code = 'INVENTORY_WORKSPACE_NOT_FOUND';
      throw error;
    }

    const current = normalizeWorkspace(workspaces[index], workspaces[index]);
    if (!canManageRecord({ ...current, owner_user_id: current.ownerUserId }, actor)) {
      const error = new Error('INVENTORY_WORKSPACE_FORBIDDEN');
      error.code = 'INVENTORY_WORKSPACE_FORBIDDEN';
      throw error;
    }

    const [removed] = workspaces.splice(index, 1);
    writeWorkspaces(workspaces);
    return normalizeWorkspace(removed, removed);
  },
};

module.exports = inventoryWorkspaceService;
