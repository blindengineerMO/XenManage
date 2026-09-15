/**
 * Process-wide configuration loaded from environment variables.
 *
 * Consumed by the Express boot path, SQLite model layers, the credential vault,
 * and background schedulers. Defaults are safe for local `npm run dev` only —
 * production (`NODE_ENV=production`) refuses to boot without `SESSION_SECRET`
 * and `XENMANGE_BOOTSTRAP_PASSWORD`. Vault and backup recovery keys are
 * deliberately separate: a control-plane snapshot must remain restorable even
 * if the live vault key is gone. See `.env.example` for the full variable list.
 */
require('dotenv').config();
const path = require('path');

const env = process.env.NODE_ENV || 'development';
const catalogSlug = String(process.env.CATALOG_SLUG || 'catalog')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9-]+/g, '-')
  .replace(/^-+|-+$/g, '') || 'catalog';

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
    backupPath: process.env.CONTROL_PLANE_BACKUP_PATH || path.join(__dirname, '..', 'data', 'backups'),
  },
  vault: {
    encryptionKey: process.env.VAULT_ENCRYPTION_KEY || '',
    previousEncryptionKey: process.env.VAULT_ENCRYPTION_KEY_PREVIOUS || '',
  },
  backup: {
    // Deliberately separate from VAULT_ENCRYPTION_KEY: a control-plane snapshot is meant to
    // be restorable even in a disaster scenario where the primary deployment (and its vault
    // key) is gone, so it is wrapped with its own recovery key instead of reusing the vault's.
    recoveryKey: process.env.CONTROL_PLANE_BACKUP_RECOVERY_KEY || '',
    previousRecoveryKey: process.env.CONTROL_PLANE_BACKUP_RECOVERY_KEY_PREVIOUS || '',
  },
  xen: {
    defaultVersion: '2.0',
    defaultOriginator: 'xenmange',
    requestTimeout: 30000,
  },
  catalog: {
    slug: catalogSlug,
    approvalHookAllowlist: String(process.env.CATALOG_APPROVAL_HOOK_ALLOWLIST || '')
      .split(',').map((host) => host.trim().toLowerCase()).filter(Boolean),
    approvalHookTimeoutMs: Math.min(Math.max(parseInt(process.env.CATALOG_APPROVAL_HOOK_TIMEOUT_MS, 10) || 5000, 1000), 30000),
    approvalHookMaxAttempts: Math.min(Math.max(parseInt(process.env.CATALOG_APPROVAL_HOOK_MAX_ATTEMPTS, 10) || 3, 1), 10),
  },
  storage: {
    // Root directory under which operators mount each ISO/file SR's network export
    // (e.g. an NFS mount at `${browserRoot}/<sr-uuid>/`). XenManage reads/writes files
    // there directly rather than shelling out to `mount` itself or proxying through the
    // XenServer host, so the actual mount is an ops/deployment concern.
    browserRoot: process.env.STORAGE_BROWSER_ROOT || path.join(__dirname, '..', 'data', 'storage-browser'),
    maxUploadBytes: parseInt(process.env.STORAGE_BROWSER_MAX_UPLOAD_BYTES, 10) || 4 * 1024 * 1024 * 1024,
  },
  profile: {
    avatarRoot: process.env.PROFILE_AVATAR_ROOT || path.join(__dirname, '..', 'data', 'avatars'),
    maxAvatarBytes: parseInt(process.env.PROFILE_AVATAR_MAX_BYTES, 10) || 2 * 1024 * 1024,
  },
  webPush: {
    publicKey: process.env.VAPID_PUBLIC_KEY || '',
    privateKey: process.env.VAPID_PRIVATE_KEY || '',
    subject: process.env.VAPID_SUBJECT || 'mailto:admin@xenmange.local',
  },
  oidc: {
    enabled: String(process.env.OIDC_ENABLED || '').toLowerCase() === 'true',
    issuer: process.env.OIDC_ISSUER || '',
    clientId: process.env.OIDC_CLIENT_ID || '',
    clientSecret: process.env.OIDC_CLIENT_SECRET || '',
    redirectUri: process.env.OIDC_REDIRECT_URI || '',
    scope: process.env.OIDC_SCOPE || 'openid profile email',
    buttonLabel: process.env.OIDC_BUTTON_LABEL || 'Sign in with SSO',
    defaultRole: process.env.OIDC_DEFAULT_ROLE || 'operator',
    allowedEmailDomains: String(process.env.OIDC_ALLOWED_EMAIL_DOMAINS || '')
      .split(',').map((domain) => domain.trim().toLowerCase()).filter(Boolean),
  },
  ldap: {
    // Search + bind: a service account (bindDn/bindPassword) finds the user's DN under
    // searchBase via searchFilter (with {{username}} substituted), then a second bind as
    // that DN with the supplied password verifies the credential. Works for both OpenLDAP
    // (e.g. filter "(uid={{username}})") and Active Directory (e.g. "(sAMAccountName={{username}})").
    enabled: String(process.env.LDAP_ENABLED || '').toLowerCase() === 'true',
    url: process.env.LDAP_URL || '',
    bindDn: process.env.LDAP_BIND_DN || '',
    bindPassword: process.env.LDAP_BIND_PASSWORD || '',
    searchBase: process.env.LDAP_SEARCH_BASE || '',
    searchFilter: process.env.LDAP_SEARCH_FILTER || '(uid={{username}})',
    usernameAttribute: process.env.LDAP_USERNAME_ATTRIBUTE || 'uid',
    emailAttribute: process.env.LDAP_EMAIL_ATTRIBUTE || 'mail',
    displayNameAttribute: process.env.LDAP_DISPLAY_NAME_ATTRIBUTE || 'cn',
    tlsRejectUnauthorized: String(process.env.LDAP_TLS_REJECT_UNAUTHORIZED || 'true').toLowerCase() !== 'false',
    defaultRole: process.env.LDAP_DEFAULT_ROLE || 'operator',
    allowedEmailDomains: String(process.env.LDAP_ALLOWED_EMAIL_DOMAINS || '')
      .split(',').map((domain) => domain.trim().toLowerCase()).filter(Boolean),
  },
  webauthn: {
    // rpID/origin are the strict security anchor for every WebAuthn ceremony — a
    // credential minted for one origin will never verify against another. Left
    // unset, services/webauthn.js derives both from the inbound request (hostname /
    // scheme+host) so a self-hosted install with an arbitrary domain works with zero
    // configuration; set these to pin XenMange behind a reverse proxy that changes
    // the Host header, or to a single canonical origin when serving multiple hostnames.
    rpName: process.env.WEBAUTHN_RP_NAME || 'XenMange',
    rpId: process.env.WEBAUTHN_RP_ID || '',
    origin: process.env.WEBAUTHN_ORIGIN || '',
  },
  saml: {
    enabled: String(process.env.SAML_ENABLED || '').toLowerCase() === 'true',
    entryPoint: process.env.SAML_ENTRY_POINT || '',
    issuer: process.env.SAML_ISSUER || 'xenmange',
    cert: process.env.SAML_CERT || '',
    callbackUrl: process.env.SAML_CALLBACK_URL || '',
    buttonLabel: process.env.SAML_BUTTON_LABEL || 'Sign in with SAML',
    defaultRole: process.env.SAML_DEFAULT_ROLE || 'operator',
    allowedEmailDomains: String(process.env.SAML_ALLOWED_EMAIL_DOMAINS || '')
      .split(',').map((domain) => domain.trim().toLowerCase()).filter(Boolean),
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
  if (config.oidc.enabled && (!config.oidc.issuer || !config.oidc.clientId || !config.oidc.clientSecret || !config.oidc.redirectUri)) {
    problems.push('OIDC_ENABLED=true requires OIDC_ISSUER, OIDC_CLIENT_ID, OIDC_CLIENT_SECRET, and OIDC_REDIRECT_URI to all be set.');
  }
  if (config.ldap.enabled && (!config.ldap.url || !config.ldap.bindDn || !config.ldap.bindPassword || !config.ldap.searchBase)) {
    problems.push('LDAP_ENABLED=true requires LDAP_URL, LDAP_BIND_DN, LDAP_BIND_PASSWORD, and LDAP_SEARCH_BASE to all be set.');
  }
  if (config.saml.enabled && (!config.saml.entryPoint || !config.saml.cert || !config.saml.callbackUrl)) {
    problems.push('SAML_ENABLED=true requires SAML_ENTRY_POINT, SAML_CERT, and SAML_CALLBACK_URL to all be set.');
  }
  if (problems.length) {
    throw new Error(`Insecure production configuration:\n- ${problems.join('\n- ')}`);
  }
}

module.exports = config;
