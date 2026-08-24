const session = require('express-session');
const config = require('../config');
const { SqliteSessionStore } = require('./session-store');
const systemConfigService = require('../services/system-config');

function sessionMiddleware(app) {
  app.use(session({
    name: 'xenmange.sid',
    secret: require('../config').session.secret,
    store: new SqliteSessionStore({ fallbackMaxAge: systemConfigService.getSessionMaxAgeMs() }),
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: config.env === 'production',
      httpOnly: true,
      maxAge: systemConfigService.getSessionMaxAgeMs(),
      sameSite: 'lax',
    },
  }));

  app.use((req, _res, next) => {
    if (req.session?.cookie) {
      req.session.cookie.maxAge = systemConfigService.getSessionMaxAgeMs();
    }
    next();
  });
}

module.exports = sessionMiddleware;
