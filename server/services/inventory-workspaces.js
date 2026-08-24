const crypto = require('crypto');
const { settingsModel } = require('../models/connection');

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
  return {
    id: current?.id || workspace.id || `workspace-${crypto.randomUUID()}`,
    name: String(workspace.name || current?.name || '').trim(),
    scope: normalizeScope(workspace.scope || current?.scope || 'all'),
    query: String(workspace.query || current?.query || '').trim(),
    targetConnectionId: workspace.targetConnectionId === null || workspace.targetConnectionId === ''
      ? null
      : Number(workspace.targetConnectionId ?? current?.targetConnectionId ?? 0) || null,
    notes: String(workspace.notes || current?.notes || '').trim(),
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
  list() {
    return sortWorkspaces(readWorkspaces().map((workspace) => normalizeWorkspace(workspace, workspace)));
  },

  get(id) {
    return this.list().find((workspace) => workspace.id === id) || null;
  },

  create(payload = {}, operator = 'system') {
    const workspaces = readWorkspaces();
    const workspace = normalizeWorkspace({
      ...payload,
      createdBy: operator,
      createdAt: new Date().toISOString(),
    });
    workspaces.unshift(workspace);
    writeWorkspaces(workspaces);
    return workspace;
  },

  update(id, payload = {}) {
    const workspaces = readWorkspaces();
    const index = workspaces.findIndex((workspace) => workspace.id === id);
    if (index === -1) {
      const error = new Error('INVENTORY_WORKSPACE_NOT_FOUND');
      error.code = 'INVENTORY_WORKSPACE_NOT_FOUND';
      throw error;
    }

    const current = normalizeWorkspace(workspaces[index], workspaces[index]);
    const next = normalizeWorkspace({
      ...current,
      ...payload,
    }, current);
    workspaces[index] = next;
    writeWorkspaces(workspaces);
    return next;
  },

  delete(id) {
    const workspaces = readWorkspaces();
    const index = workspaces.findIndex((workspace) => workspace.id === id);
    if (index === -1) {
      const error = new Error('INVENTORY_WORKSPACE_NOT_FOUND');
      error.code = 'INVENTORY_WORKSPACE_NOT_FOUND';
      throw error;
    }

    const [removed] = workspaces.splice(index, 1);
    writeWorkspaces(workspaces);
    return normalizeWorkspace(removed, removed);
  },
};

module.exports = inventoryWorkspaceService;
