require('dotenv').config();
const path = require('path');

module.exports = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 3000,
  session: {
    secret: process.env.SESSION_SECRET || 'xenmange-dev-secret-change-me',
    maxAge: parseInt(process.env.SESSION_MAX_AGE, 10) || 86400000,
  },
  auth: {
    bootstrapUsername: process.env.XENMANGE_BOOTSTRAP_USERNAME || 'admin',
    bootstrapPassword: process.env.XENMANGE_BOOTSTRAP_PASSWORD || 'admin123!',
    bootstrapDisplayName: process.env.XENMANGE_BOOTSTRAP_DISPLAY_NAME || 'Platform Administrator',
  },
  db: {
    path: process.env.DB_PATH || path.join(__dirname, '..', 'data', 'xenmange.db'),
    securityPath: process.env.SECURITY_DB_PATH || path.join(__dirname, '..', 'data', 'security.db'),
    vaultPath: process.env.VAULT_DB_PATH || path.join(__dirname, '..', 'data', 'vault.db'),
    perfPath: process.env.PERF_DB_PATH || path.join(__dirname, '..', 'data', 'perf.db'),
  },
  vault: {
    encryptionKey: process.env.VAULT_ENCRYPTION_KEY || '',
    previousEncryptionKey: process.env.VAULT_ENCRYPTION_KEY_PREVIOUS || '',
  },
  xen: {
    defaultVersion: '2.0',
    defaultOriginator: 'xenmange',
    requestTimeout: 30000,
  },
};
