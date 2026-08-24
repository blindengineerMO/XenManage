const express = require('express');
const router = express.Router();
const { XenAPI, setConnection, getConnection, rehydrateConnection, removeConnection } = require('../services/xenapi');
const { connectionModel } = require('../models/connection');
const { authEventModel, userModel } = require('../models/security-db');
const { validate, schemas } = require('../middleware/validate');
const auditLogService = require('../services/audit-log');
const governanceService = require('../services/governance');
const credentialVaultService = require('../services/credential-vault');

function buildStatusPayload(req) {
  const connected = Boolean(getConnection(req.session?.id) || rehydrateConnection(req.session?.id, req.session?.xenHost || '', req.session?.xenSessionRef || ''));
  return {
    authenticated: Boolean(req.session?.authenticated),
    connected,
    authMode: req.session?.authMode || (connected ? 'legacy-xen' : 'local'),
    host: req.session?.xenHost || '',
    username: req.session?.appUsername || req.session?.xenUser || '',
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
    req.session.xenHost = '';
    req.session.xenSessionRef = '';

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
    const { host, username, password, vaultCredentialId } = req.body;
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

    if (!req.session.authenticated) {
      await new Promise((resolve, reject) => {
        req.session.regenerate((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      req.session.authenticated = true;
      req.session.authMode = 'legacy-xen';
      req.session.appUsername = username;
      req.session.displayName = username;
      req.session.governanceRole = governanceService.getPolicy().defaultRole;
    }

    setConnection(req.session.id, xenApi);

    req.session.xenHost = host;
    req.session.xenUser = operatorName;
    req.session.xenTargetUsername = username;
    req.session.xenSessionRef = xenApi.sessionRef;

    connectionModel.touchByFingerprint(host, username, 443, {
      userId: req.session?.userId || null,
      role: governanceService.getSessionRole(req.session),
    });
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
      entityRef: host,
      entityName: host,
      operator: operatorName,
      route: '/login',
      status: 'success',
      before: null,
      after: { host, username: operatorName, xenCredentialUsername: username, vaultCredentialId: vaultCredentialId || null },
      detail: `Authenticated to ${host} as ${username}${vaultCredentialId ? ` using saved credential #${vaultCredentialId}` : ''}.`,
    });

    res.json({
      success: true,
      connected: true,
      host,
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
  const host = req.session?.xenHost || '';
  const username = req.session?.appUsername || req.session?.xenUser || 'system';
  const connection = getConnection(req.session.id)
    || rehydrateConnection(req.session.id, req.session?.xenHost || '', req.session?.xenSessionRef || '');
  if (connection) {
    removeConnection(req.session.id);
  }
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

// Middleware: require authentication for all /api routes below
function requireAuth(req, res, next) {
  if (!req.session.authenticated) {
    return res.status(401).json({ error: 'NOT_AUTHENTICATED' });
  }
  req.xenApi = getConnection(req.session.id)
    || rehydrateConnection(req.session.id, req.session?.xenHost || '', req.session?.xenSessionRef || '')
    || null;
  next();
}

function requireXenConnection(req, res, next) {
  if (!req.session.authenticated) {
    return res.status(401).json({ error: 'NOT_AUTHENTICATED' });
  }
  const xenApi = getConnection(req.session.id)
    || rehydrateConnection(req.session.id, req.session?.xenHost || '', req.session?.xenSessionRef || '');
  if (!xenApi) {
    return res.status(409).json({ error: 'XEN_TARGET_NOT_CONNECTED' });
  }
  req.xenApi = xenApi;
  next();
}

module.exports = { router, requireAuth, requireXenConnection };
