require('dotenv').config();
const path = require('path');

module.exports = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 3000,
  session: {
    secret: process.env.SESSION_SECRET || 'xenmange-dev-secret-change-me',
    maxAge: parseInt(process.env.SESSION_MAX_AGE, 10) || 86400000,
  },
  db: {
    path: process.env.DB_PATH || path.join(__dirname, '..', 'data', 'xenmange.db'),
  },
  xen: {
    defaultVersion: '2.0',
    defaultOriginator: 'xenmange',
    requestTimeout: 30000,
  },
};
