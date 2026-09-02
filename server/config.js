require('dotenv').config();
const path = require('path');

const env = process.env.NODE_ENV || 'development';

const config = {
  env,
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
  rateLimit: {
    apiWindowMs: parseInt(process.env.API_RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,
    apiMax: parseInt(process.env.API_RATE_LIMIT_MAX, 10) || 300,
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
  storage: {
    // Root directory under which operators mount each ISO/file SR's network export
    // (e.g. an NFS mount at `${browserRoot}/<sr-uuid>/`). XenManage reads/writes files
    // there directly rather than shelling out to `mount` itself or proxying through the
    // XenServer host, so the actual mount is an ops/deployment concern.
    browserRoot: process.env.STORAGE_BROWSER_ROOT || path.join(__dirname, '..', 'data', 'storage-browser'),
    maxUploadBytes: parseInt(process.env.STORAGE_BROWSER_MAX_UPLOAD_BYTES, 10) || 4 * 1024 * 1024 * 1024,
  },
};

// Session secrets and bootstrap credentials fall back to well-known, source-visible
// defaults for local development convenience. Refuse to boot with those defaults in
// production, the same way credential-vault.js refuses a missing VAULT_ENCRYPTION_KEY.
if (env === 'production') {
  const problems = [];
  if (!process.env.SESSION_SECRET) {
    problems.push('SESSION_SECRET must be set (refusing to sign session cookies with the built-in development default).');
  }
  if (!process.env.XENMANGE_BOOTSTRAP_PASSWORD) {
    problems.push('XENMANGE_BOOTSTRAP_PASSWORD must be set (refusing to create the bootstrap admin account with a known default password).');
  }
  if (problems.length) {
    throw new Error(`Insecure production configuration:\n- ${problems.join('\n- ')}`);
  }
}

module.exports = config;
