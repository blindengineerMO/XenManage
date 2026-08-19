const express = require('express');
const router = express.Router();
const { XenAPI, setConnection, getConnection, removeConnection } = require('../services/xenapi');
const { connectionModel } = require('../models/connection');
const { validate, schemas } = require('../middleware/validate');

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

    connectionModel.touchByFingerprint(host, username, 443);

    res.json({ success: true, host, username });
  } catch (err) {
    const message = err.code || err.message || 'CONNECTION_FAILED';
    res.status(401).json({ error: message });
  }
});

// POST /api/auth/logout
router.post('/logout', async (req, res) => {
  removeConnection(req.session.id);
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ error: 'LOGOUT_FAILED' });
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
