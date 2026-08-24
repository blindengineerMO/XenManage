const express = require('express');
const router = express.Router();
const { XenAPI, setConnection, getConnection, removeConnection } = require('../services/xenapi');
const { connectionModel } = require('../models/connection');
const { validate, schemas } = require('../middleware/validate');
const auditLogService = require('../services/audit-log');
const governanceService = require('../services/governance');

// POST /api/auth/login - Connect to XenServer
router.post('/login', validate(schemas.login), async (req, res) => {
  try {
    const { host, username, password } = req.body;
    const xenApi = new XenAPI(host);
    await xenApi.login(username, password);
    await new Promise((resolve, reject) => {
      req.session.regenerate((err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    setConnection(req.session.id, xenApi);

    req.session.xenHost = host;
    req.session.xenUser = username;
    req.session.authenticated = true;
    req.session.governanceRole = governanceService.getPolicy().defaultRole;

    connectionModel.touchByFingerprint(host, username, 443);
    auditLogService.record({
      category: 'session',
      action: 'session_login',
      actionLabel: 'Logged into Xen host',
      entityType: 'session',
      entityRef: host,
      entityName: host,
      operator: username,
      route: '/login',
      status: 'success',
      before: null,
      after: { host, username },
      detail: `Authenticated to ${host} as ${username}.`,
    });

    res.json({
      success: true,
      host,
      username,
      governance: {
        currentRole: governanceService.getSessionRole(req.session),
        policy: governanceService.getPolicy(),
      },
    });
  } catch (err) {
    const message = err.code || err.message || 'CONNECTION_FAILED';
    res.status(401).json({ error: message });
  }
});

// POST /api/auth/logout
router.post('/logout', async (req, res) => {
  const host = req.session?.xenHost || '';
  const username = req.session?.xenUser || 'system';
  removeConnection(req.session.id);
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ error: 'LOGOUT_FAILED' });
    auditLogService.record({
      category: 'session',
      action: 'session_logout',
      actionLabel: 'Logged out of Xen host',
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
  if (req.session.authenticated) {
    res.json({
      authenticated: true,
      host: req.session.xenHost,
      username: req.session.xenUser,
      governance: {
        currentRole: governanceService.getSessionRole(req.session),
        policy: governanceService.getPolicy(),
      },
    });
  } else {
    res.json({ authenticated: false });
  }
});

// Middleware: require authentication for all /api routes below
function requireAuth(req, res, next) {
  if (!req.session.authenticated) {
    return res.status(401).json({ error: 'NOT_AUTHENTICATED' });
  }
  const xenApi = getConnection(req.session.id);
  if (!xenApi) {
    return res.status(401).json({ error: 'SESSION_EXPIRED' });
  }
  req.xenApi = xenApi;
  next();
}

module.exports = { router, requireAuth };
