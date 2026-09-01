const crypto = require('crypto');
const { connectionModel, managedTargetModel } = require('../models/connection');
const { credentialModel } = require('../models/vault-db');
const credentialVaultService = require('./credential-vault');
const { XenAPI } = require('./xenapi');

const HEALTHY = 'Healthy';
const DEFAULT_INTERVAL_MS = 60 * 1000;
const MAX_RETRY_MS = 15 * 60 * 1000;

let timer = null;
let started = false;
let XenApiFactory = XenAPI;
const liveConnections = new Map();

function managedTargetKey(id) {
  return `managed:${Number(id)}`;
}

function parseManagedTargetKey(value) {
  const match = /^managed:(\d+)$/.exec(String(value || '').trim());
  return match ? Number(match[1]) : null;
}

function nextRetryAt(retryCount) {
  const delay = Math.min(MAX_RETRY_MS, 1000 * (2 ** Math.max(0, Number(retryCount || 0))));
  return new Date(Date.now() + delay).toISOString();
}

function stateFromError(error) {
  const message = String(error?.code || error?.message || 'TARGET_UNAVAILABLE').toUpperCase();
  if (message.includes('AUTH') || message.includes('CREDENTIAL') || message.includes('SESSION')) {
    return 'Authentication Failed';
  }
  if (message.includes('CERT') || message.includes('TLS') || message.includes('SELF_SIGNED')) {
    return 'Certificate Changed';
  }
  if (message.includes('UNSUPPORTED') || message.includes('METHOD_UNKNOWN')) {
    return 'Unsupported';
  }
  return 'Offline';
}

function toPublicTarget(record) {
  if (!record) return null;
  return {
    id: record.id,
    targetKey: managedTargetKey(record.id),
    connectionId: record.connection_id,
    name: record.connection_name || record.host,
    host: record.host,
    username: record.username,
    port: Number(record.port || 443),
    enabled: record.enabled,
    state: record.state,
    lastError: record.last_error || '',
    lastCheckedAt: record.last_checked_at || '',
    lastConnectedAt: record.last_connected_at || '',
    nextRetryAt: record.next_retry_at || '',
    retryCount: record.retry_count,
    certificateFingerprint: record.certificate_fingerprint || '',
  };
}

function canUseTarget(record) {
  if (!record?.enabled) return { ok: false, code: 'TARGET_DISABLED' };
  if (record.visibility !== 'shared' || Number(record.owner_user_id || 0) > 0) {
    return { ok: false, code: 'MANAGED_TARGET_REQUIRES_SHARED_CONNECTION' };
  }
  if (!record.vault_credential_id) return { ok: false, code: 'MANAGED_TARGET_CREDENTIAL_REQUIRED' };
  const credential = credentialModel.getById(record.vault_credential_id);
  if (!credential || credential.scope !== 'shared') {
    return { ok: false, code: 'MANAGED_TARGET_REQUIRES_SHARED_CREDENTIAL' };
  }
  return { ok: true, credential };
}

async function disconnect(id) {
  const api = liveConnections.get(Number(id));
  liveConnections.delete(Number(id));
  if (api) await api.logout?.();
}

async function connect(id, { force = false } = {}) {
  const target = managedTargetModel.getById(id);
  if (!target) {
    const error = new Error('MANAGED_TARGET_NOT_FOUND');
    error.code = 'MANAGED_TARGET_NOT_FOUND';
    throw error;
  }
  if (!target.enabled) {
    await disconnect(target.id);
    return managedTargetModel.updateStatus(target.id, { state: 'Maintenance', lastError: '', retryCount: 0 });
  }

  const existing = liveConnections.get(target.id);
  if (existing && !force) {
    return managedTargetModel.updateStatus(target.id, { state: HEALTHY, lastError: '', retryCount: 0 });
  }
  if (existing) await disconnect(target.id);

  const eligibility = canUseTarget(target);
  if (!eligibility.ok) {
    return managedTargetModel.updateStatus(target.id, {
      state: eligibility.code === 'MANAGED_TARGET_REQUIRES_SHARED_CONNECTION' ? 'Maintenance' : 'Authentication Failed',
      lastError: eligibility.code,
      retryCount: Number(target.retry_count || 0) + 1,
      nextRetryAt: nextRetryAt(Number(target.retry_count || 0) + 1),
    });
  }

  try {
    const password = credentialVaultService.getPassword(target.vault_credential_id, null, 'admin');
    const api = new XenApiFactory(target.host);
    await api.login(eligibility.credential.username || target.username, password);
    liveConnections.set(target.id, api);
    connectionModel.updateLastConnected(target.connection_id);
    return managedTargetModel.updateStatus(target.id, {
      state: HEALTHY,
      lastError: '',
      retryCount: 0,
      nextRetryAt: '',
      lastConnectedAt: new Date().toISOString(),
    });
  } catch (error) {
    const retryCount = Number(target.retry_count || 0) + 1;
    return managedTargetModel.updateStatus(target.id, {
      state: stateFromError(error),
      lastError: error?.code || error?.message || 'TARGET_UNAVAILABLE',
      retryCount,
      nextRetryAt: nextRetryAt(retryCount),
    });
  }
}

async function check(id) {
  const target = managedTargetModel.getById(id);
  if (!target) return null;
  if (!target.enabled) return connect(target.id);

  const api = liveConnections.get(target.id);
  if (!api) return connect(target.id);

  try {
    // This inexpensive pool query detects expired or dropped XenAPI sessions.
    await api.call('pool', 'get_all', []);
    return managedTargetModel.updateStatus(target.id, { state: HEALTHY, lastError: '', retryCount: 0, nextRetryAt: '' });
  } catch (error) {
    await disconnect(target.id);
    return connect(target.id, { force: true });
  }
}

function schedule() {
  if (!started) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(async () => {
    await refreshAll();
    schedule();
  }, DEFAULT_INTERVAL_MS);
}

async function refreshAll() {
  const targets = managedTargetModel.list().filter((target) => target.enabled);
  return Promise.all(targets.map((target) => check(target.id)));
}

const managedTargetService = {
  managedTargetKey,
  parseManagedTargetKey,

  list(actor = {}) {
    const visibleConnectionIds = new Set(connectionModel.listVisible(actor).map((connection) => Number(connection.id)));
    return managedTargetModel.list()
      .filter((target) => visibleConnectionIds.has(Number(target.connection_id)))
      .map(toPublicTarget);
  },

  get(id) {
    return toPublicTarget(managedTargetModel.getById(id));
  },

  register(connectionId, options = {}) {
    const connection = connectionModel.getById(connectionId);
    if (!connection) {
      const error = new Error('CONNECTION_NOT_FOUND');
      error.code = 'CONNECTION_NOT_FOUND';
      throw error;
    }
    return toPublicTarget(managedTargetModel.upsert(connection.id, options));
  },

  async setEnabled(id, enabled) {
    const target = managedTargetModel.setEnabled(id, enabled);
    if (!target) return null;
    if (!enabled) await disconnect(target.id);
    if (enabled) return toPublicTarget(await connect(target.id, { force: true }));
    return toPublicTarget(managedTargetModel.updateStatus(target.id, { state: 'Maintenance', lastError: '', retryCount: 0, nextRetryAt: '' }));
  },

  async check(id) {
    return toPublicTarget(await check(id));
  },

  getApi(id) {
    return liveConnections.get(Number(id)) || null;
  },

  getApiForTargetKey(targetKey, actor = {}) {
    const id = parseManagedTargetKey(targetKey);
    if (!id) return null;
    const visible = this.list(actor).some((target) => target.id === id);
    return visible ? this.getApi(id) : null;
  },

  listLiveTargets() {
    return managedTargetModel.list()
      .filter((target) => target.enabled && target.state === HEALTHY)
      .map((target) => ({
        targetId: target.id,
        targetKey: managedTargetKey(target.id),
        host: target.host,
        api: liveConnections.get(target.id),
      }))
      .filter((target) => target.api?.sessionRef);
  },

  start() {
    started = true;
    refreshAll().catch(() => {});
    schedule();
  },

  async stop() {
    started = false;
    if (timer) clearTimeout(timer);
    timer = null;
    await Promise.all([...liveConnections.keys()].map((id) => disconnect(id).catch(() => {})));
  },

  __setXenApiFactory(factory) {
    XenApiFactory = factory || XenAPI;
  },

  __resetForTests() {
    if (timer) clearTimeout(timer);
    timer = null;
    started = false;
    liveConnections.clear();
    XenApiFactory = XenAPI;
  },
};

module.exports = managedTargetService;
