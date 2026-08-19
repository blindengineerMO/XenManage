const session = require('express-session');
const config = require('../config');

function sessionMiddleware(app) {
  app.use(session({
    name: 'xenmange.sid',
    secret: require('../config').session.secret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: config.env === 'production',
      httpOnly: true,
      maxAge: require('../config').session.maxAge,
      sameSite: 'lax',
    },
  }));
}

module.exports = sessionMiddleware;
