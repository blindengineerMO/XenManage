const express = require('express');
const router = express.Router();
const {
  XenAPI,
  buildConnectionTargetKey,
  setConnection,
  getConnection,
  rehydrateConnection,
  rehydrateConnections,
  removeConnection,
} = require('../services/xenapi');
const { connectionModel } = require('../models/connection');
const { authEventModel, userModel } = require('../models/security-db');
const { validate, schemas } = require('../middleware/validate');
const auditLogService = require('../services/audit-log');
const governanceService = require('../services/governance');
const credentialVaultService = require('../services/credential-vault');

function normalizeConnectionId(value) {
  const normalized = Number(value || 0);
  return normalized > 0 ? normalized : null;
}

function normalizePort(value) {
  const normalized = Number(value || 443);
  return normalized > 0 ? normalized : 443;
}

function normalizeSessionTargetRecord(target = {}) {
  const connectionId = normalizeConnectionId(target.connectionId);
  const host = String(target.host || '').trim();
  const username = String(target.username || '').trim();
  const port = normalizePort(target.port);
  const sessionRef = String(target.sessionRef || '').trim();
  const targetKey = String(target.targetKey || '').trim()
    || buildConnectionTargetKey({ connectionId, host, username, port });

  if (!host || !sessionRef) return null;

  return {
    targetKey,
    connectionId,
    connectionName: String(target.connectionName || '').trim(),
    host,
    username,
    port,
    sessionRef,
    connectedAt: String(target.connectedAt || new Date().toISOString()),
    lastActivatedAt: String(target.lastActivatedAt || target.connectedAt || new Date().toISOString()),
  };
}

function listSessionTargets(session = {}) {
  const targets = [];
  const seen = new Set();

  (Array.isArray(session?.xenTargets) ? session.xenTargets : []).forEach((target) => {
    const record = normalizeSessionTargetRecord(target);
    if (!record || seen.has(record.targetKey)) return;
    seen.add(record.targetKey);
    targets.push(record);
  });

  if (!targets.length && session?.xenHost && session?.xenSessionRef) {
    const fallback = normalizeSessionTargetRecord({
      connectionId: session?.xenConnectionId || null,
      connectionName: session?.xenConnectionName || '',
      host: session.xenHost,
      username: session.xenTargetUsername || session.xenUser || '',
      port: session.xenPort || 443,
      sessionRef: session.xenSessionRef,
      connectedAt: session.xenConnectedAt || new Date().toISOString(),
      lastActivatedAt: session.xenLastActivatedAt || session.xenConnectedAt || new Date().toISOString(),
    });
    if (fallback) {
      seen.add(fallback.targetKey);
      targets.push(fallback);
    }
  }

  return targets;
}

function persistSessionTargets(session, targets = [], activeTargetKey = '') {
  const normalizedTargets = (Array.isArray(targets) ? targets : [])
    .map((target) => normalizeSessionTargetRecord(target))
    .filter(Boolean);
  const resolvedActiveTarget = normalizedTargets.find((target) => target.targetKey === String(activeTargetKey || '').trim())
    || normalizedTargets[0]
    || null;

  session.xenTargets = normalizedTargets;
  session.activeXenTargetKey = resolvedActiveTarget?.targetKey || '';
  session.xenConnectionId = resolvedActiveTarget?.connectionId || null;
  session.xenConnectionName = resolvedActiveTarget?.connectionName || '';
  session.xenHost = resolvedActiveTarget?.host || '';
  session.xenTargetUsername = resolvedActiveTarget?.username || '';
  session.xenPort = resolvedActiveTarget?.port || 443;
  session.xenSessionRef = resolvedActiveTarget?.sessionRef || '';
  session.xenConnectedAt = resolvedActiveTarget?.connectedAt || '';
  session.xenLastActivatedAt = resolvedActiveTarget?.lastActivatedAt || '';

  return resolvedActiveTarget;
}

function upsertSessionTarget(session, target = {}) {
  const nextTarget = normalizeSessionTargetRecord(target);
  if (!nextTarget) return null;

  const targets = listSessionTargets(session).filter((entry) => entry.targetKey !== nextTarget.targetKey);
  targets.push(nextTarget);
  persistSessionTargets(session, targets, nextTarget.targetKey);
  return nextTarget;
}

function activateSessionTarget(session, selector = {}) {
  const requestedTargetKey = String(selector.targetKey || '').trim();
  const requestedConnectionId = normalizeConnectionId(selector.connectionId);
  const targets = listSessionTargets(session);
  const activeTarget = targets.find((target) =>
    (requestedTargetKey && target.targetKey === requestedTargetKey)
    || (requestedConnectionId && target.connectionId === requestedConnectionId)
  );
  if (!activeTarget) return null;

  const nextTarget = {
    ...activeTarget,
    lastActivatedAt: new Date().toISOString(),
  };
  persistSessionTargets(session, targets.map((target) => (
    target.targetKey === nextTarget.targetKey ? nextTarget : target
  )), nextTarget.targetKey);
  return nextTarget;
}

function removeSessionTarget(session, targetKey = '') {
  const normalizedTargetKey = String(targetKey || '').trim();
  const targets = listSessionTargets(session);
  const removedTarget = targets.find((target) => target.targetKey === normalizedTargetKey) || null;
  const nextTargets = targets.filter((target) => target.targetKey !== normalizedTargetKey);
  persistSessionTargets(session, nextTargets, session.activeXenTargetKey === normalizedTargetKey ? '' : session.activeXenTargetKey);
  return removedTarget;
}

function ensureSessionTargetsRehydrated(sessionId, session = {}) {
  const targets = listSessionTargets(session);
  rehydrateConnections(sessionId, targets);
  return targets;
}

function buildConnectedTargetPayload(session = {}) {
  const targets = listSessionTargets(session);
  const activeTargetKey = String(session?.activeXenTargetKey || '').trim();

  return targets.map((target) => ({
    targetKey: target.targetKey,
    connectionId: target.connectionId,
    connectionName: target.connectionName || '',
    host: target.host,
    username: target.username,
    port: target.port,
    connectedAt: target.connectedAt,
    lastActivatedAt: target.lastActivatedAt,
    active: target.targetKey === activeTargetKey,
  }));
}

function restoreAuthenticatedSessionState(session = {}) {
  if (session?.authenticated) return;

  if ((session?.userId && session?.appUsername) || listSessionTargets(session).length) {
    session.authenticated = true;
  }
}

function buildStatusPayload(req) {
  restoreAuthenticatedSessionState(req.session);
  ensureSessionTargetsRehydrated(req.session?.id, req.session);
  const connectedTargets = buildConnectedTargetPayload(req.session);
  const activeTarget = connectedTargets.find((target) => target.active) || connectedTargets[0] || null;
  const connected = connectedTargets.length > 0;
  const authMode = req.session?.authMode
    || (req.session?.userId ? 'local' : (connected ? 'legacy-xen' : 'local'));

  return {
    authenticated: Boolean(req.session?.authenticated),
    connected,
    authMode,
    host: activeTarget?.connectionName || activeTarget?.host || '',
    username: req.session?.appUsername || req.session?.xenUser || '',
    currentTargetKey: activeTarget?.targetKey || '',
    connectedTargets,
    user: req.session?.userId ? {
      id: req.session.userId,
      username: req.session.appUsername || '',
      displayName: req.session.displayName || '',
      role: governanceService.getSessionRole(req.session),
    } : null,
    governance: {
      currentRole: governanceService.getSessionRole(req.session),
      policy: governanceService.getPolicy(),
    },
  };
}

// POST /api/auth/login - Sign into XenMange
router.post('/login', validate(schemas.appLogin), async (req, res) => {
  try {
    const user = userModel.verifyPassword(req.body.username, req.body.password);
    if (!user) {
      return res.status(401).json({ error: 'INVALID_CREDENTIALS' });
    }

    await new Promise((resolve, reject) => {
      req.session.regenerate((err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    req.session.userId = user.id;
    req.session.appUsername = user.username;
    req.session.displayName = user.display_name || user.username;
    req.session.authenticated = true;
    req.session.authMode = 'local';
    req.session.governanceRole = governanceService.getPolicy().defaultRole;
    req.session.governanceRole = user.role || req.session.governanceRole;
    req.session.xenUser = user.username;
    persistSessionTargets(req.session, [], '');

    userModel.touchLastLogin(user.id);
    authEventModel.create({
      userId: user.id,
      username: user.username,
      event: 'app_login',
      ip: req.ip,
      detail: 'Authenticated to the XenMange control plane.',
    });
    auditLogService.record({
      category: 'session',
      action: 'app_session_login',
      actionLabel: 'Signed into XenMange as',
      entityType: 'user',
      entityRef: String(user.id),
      entityName: user.username,
      operator: user.username,
      route: '/login',
      status: 'success',
      before: null,
      after: { id: user.id, username: user.username, role: user.role || 'operator' },
      detail: `Signed into the XenMange control plane as ${user.username}.`,
    });

    res.json({
      success: true,
      connected: false,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.display_name || user.username,
        role: user.role || 'operator',
      },
      ...buildStatusPayload(req),
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'AUTH_FAILED' });
  }
});

// POST /api/auth/xen-login - Connect to XenServer
router.post('/xen-login', validate(schemas.xenLogin), async (req, res) => {
  try {
    const hasLocalSession = Boolean(req.session?.authenticated && req.session?.userId && req.session?.authMode === 'local');
    if (!hasLocalSession) {
      return res.status(403).json({ error: 'LOCAL_USER_REQUIRED' });
    }

    const { host, username, password, vaultCredentialId, connectionId, connectionName, port } = req.body;
    const operatorName = req.session?.appUsername || username;
    let resolvedPassword = password;

    if (!String(resolvedPassword || '').trim() && vaultCredentialId) {
      if (!req.session?.userId) {
        return res.status(403).json({ error: 'LOCAL_USER_REQUIRED_FOR_VAULT_CREDENTIAL' });
      }

      resolvedPassword = credentialVaultService.getPassword(
        vaultCredentialId,
        req.session.userId,
        governanceService.getSessionRole(req.session)
      );
    }

    const xenApi = new XenAPI(host);
    await xenApi.login(username, resolvedPassword);

    const actor = {
      userId: req.session?.userId || null,
      role: governanceService.getSessionRole(req.session),
    };
    const normalizedConnectionId = normalizeConnectionId(connectionId);
    const savedConnection = normalizedConnectionId
      ? connectionModel.getVisibleById(normalizedConnectionId, actor)
      : null;
    const targetRecord = upsertSessionTarget(req.session, {
      connectionId: savedConnection?.id || normalizedConnectionId,
      connectionName: savedConnection?.name || connectionName || '',
      host,
      username,
      port,
      sessionRef: xenApi.sessionRef,
      connectedAt: new Date().toISOString(),
      lastActivatedAt: new Date().toISOString(),
    });
    setConnection(req.session.id, targetRecord.targetKey, xenApi);
    req.session.xenUser = operatorName;

    if (savedConnection) {
      connectionModel.updateLastConnected(savedConnection.id);
    } else {
      connectionModel.touchByFingerprint(host, username, normalizePort(port), actor);
    }

    authEventModel.create({
      userId: req.session?.userId || null,
      username: operatorName,
      event: 'xen_login',
      ip: req.ip,
      detail: `Authenticated to ${host} using Xen credential ${username}${vaultCredentialId ? ` from vault credential ${vaultCredentialId}` : ''}.`,
    });
    auditLogService.record({
      category: 'session',
      action: 'session_login',
      actionLabel: 'Logged into Xen host',
      entityType: 'session',
      entityRef: targetRecord.targetKey,
      entityName: targetRecord.connectionName || host,
      operator: operatorName,
      route: '/login',
      status: 'success',
      before: null,
      after: {
        targetKey: targetRecord.targetKey,
        connectionId: targetRecord.connectionId,
        connectionName: targetRecord.connectionName,
        host,
        username: operatorName,
        xenCredentialUsername: username,
        vaultCredentialId: vaultCredentialId || null,
      },
      detail: `Authenticated to ${host} as ${username}${vaultCredentialId ? ` using saved credential #${vaultCredentialId}` : ''} and attached it to the current XenMange session.`,
    });

    res.json({
      success: true,
      connected: true,
      host: targetRecord.connectionName || host,
      username,
      ...buildStatusPayload(req),
    });
  } catch (err) {
    const message = err.code || err.message || 'CONNECTION_FAILED';
    const status = ['CREDENTIAL_NOT_FOUND', 'CREDENTIAL_FORBIDDEN'].includes(message) ? 403 : 401;
    res.status(status).json({ error: message });
  }
});

// POST /api/auth/logout
router.post('/logout', async (req, res) => {
  const activeTarget = buildConnectedTargetPayload(req.session).find((target) => target.active) || null;
  const host = activeTarget?.host || req.session?.xenHost || '';
  const username = req.session?.appUsername || req.session?.xenUser || 'system';
  removeConnection(req.session.id);

  req.session.destroy((err) => {
    if (err) return res.status(500).json({ error: 'LOGOUT_FAILED' });
    authEventModel.create({
      userId: null,
      username,
      event: host ? 'xen_logout' : 'app_logout',
      ip: req.ip,
      detail: host ? `Closed session for ${host || 'current host'}.` : 'Closed XenMange control-plane session.',
    });
    auditLogService.record({
      category: 'session',
      action: host ? 'session_logout' : 'app_session_logout',
      actionLabel: host ? 'Logged out of Xen host' : 'Signed out of XenMange',
      entityType: 'session',
      entityRef: host,
      entityName: host || 'session',
      operator: username,
      route: '/login',
      status: 'success',
      before: { host, username },
      after: { success: true },
      detail: `Session for ${username} on ${host || 'current host'} was closed.`,
    });
    res.json({ success: true });
  });
});

// GET /api/auth/status
router.get('/status', (req, res) => {
  if (!req.session.authenticated) return res.json({ authenticated: false, connected: false });
  res.json(buildStatusPayload(req));
});

router.get('/targets', requireAuth, (req, res) => {
  res.json(buildStatusPayload(req));
});

router.post('/targets/activate', requireAuth, (req, res) => {
  const target = activateSessionTarget(req.session, req.body || {});
  if (!target) {
    return res.status(404).json({ error: 'XEN_TARGET_NOT_FOUND' });
  }

  ensureSessionTargetsRehydrated(req.session.id, req.session);
  res.json(buildStatusPayload(req));
});

router.delete('/targets/:targetKey', requireAuth, (req, res) => {
  const targetKey = decodeURIComponent(req.params.targetKey || '');
  const removedTarget = removeSessionTarget(req.session, targetKey);
  if (!removedTarget) {
    return res.status(404).json({ error: 'XEN_TARGET_NOT_FOUND' });
  }

  removeConnection(req.session.id, targetKey);
  res.json(buildStatusPayload(req));
});

// A session bound to a local account (req.session.userId set) must keep pointing at an
// active account on every request; otherwise a deactivated user's already-live session
// would keep working (and could even self-escalate its governance role) until it expired.
function isLocalAccountRevoked(req) {
  if (!req.session?.userId) return false;
  const account = userModel.getById(req.session.userId);
  return !account || !account.active;
}

function rejectRevokedSession(req, res) {
  req.session.destroy(() => {});
  res.status(401).json({ error: 'NOT_AUTHENTICATED' });
}

// Middleware: require authentication for all /api routes below
function requireAuth(req, res, next) {
  restoreAuthenticatedSessionState(req.session);
  if (!req.session.authenticated) {
    return res.status(401).json({ error: 'NOT_AUTHENTICATED' });
  }
  if (isLocalAccountRevoked(req)) {
    return rejectRevokedSession(req, res);
  }

  const sessionTargets = ensureSessionTargetsRehydrated(req.session.id, req.session);
  const requestedTargetKey = resolveRequestedTargetKey(req);
  const target = sessionTargets.find((entry) => entry.targetKey === requestedTargetKey) || sessionTargets[0] || null;
  req.xenTarget = target;
  req.xenApi = target
    ? getConnection(req.session.id, target.targetKey) || rehydrateConnection(req.session.id, target)
    : null;
  next();
}

function resolveRequestedTargetKey(req) {
  const explicitTargetKey = String(
    req.body?.targetKey
    || req.query?.targetKey
    || req.headers['x-xenmange-target-key']
    || ''
  ).trim();
  if (explicitTargetKey) return explicitTargetKey;

  const explicitConnectionId = normalizeConnectionId(
    req.body?.targetConnectionId
    || req.query?.targetConnectionId
    || req.headers['x-xenmange-target-connection-id']
  );
  if (explicitConnectionId) {
    return buildConnectionTargetKey({ connectionId: explicitConnectionId });
  }

  return String(req.session?.activeXenTargetKey || '').trim();
}

function requireXenConnection(req, res, next) {
  restoreAuthenticatedSessionState(req.session);
  if (!req.session.authenticated) {
    return res.status(401).json({ error: 'NOT_AUTHENTICATED' });
  }
  if (isLocalAccountRevoked(req)) {
    return rejectRevokedSession(req, res);
  }

  const sessionTargets = ensureSessionTargetsRehydrated(req.session.id, req.session);
  const requestedTargetKey = resolveRequestedTargetKey(req);
  const target = sessionTargets.find((entry) => entry.targetKey === requestedTargetKey) || sessionTargets[0] || null;
  const xenApi = target
    ? getConnection(req.session.id, target.targetKey) || rehydrateConnection(req.session.id, target)
    : null;

  if (!xenApi) {
    return res.status(409).json({ error: 'XEN_TARGET_NOT_CONNECTED' });
  }

  req.xenApi = xenApi;
  req.xenTarget = target;
  next();
}

module.exports = { router, requireAuth, requireXenConnection, buildStatusPayload };
