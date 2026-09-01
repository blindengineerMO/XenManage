const crypto = require('crypto');
const { apiTokenModel, permissionGrantModel, userModel } = require('../models/security-db');

const ROLE_TEMPLATES = {
  'read-only': ['*.read', '*.list'],
  operator: [
    '*.read', '*.list', 'vm.*', 'host.*', 'pool.*', 'network.*', 'storage.*', 'connection.*',
    'host.target.*', 'managed.target.*', 'workflow.*', 'compose.*', 'credential.*', 'lifecycle.*',
    'alert.*', 'template.*', 'vfabric.*', 'resilience.*', 'remediation.*', 'snapshot.*', 'migration.*',
    // Preserve the existing operator contract during migration; scoped deny/allow grants narrow it safely.
    '*',
  ],
  admin: ['*'],
};

function matches(pattern, permission) {
  const source = String(pattern || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\*/g, '.*');
  return new RegExp(`^${source}$`).test(String(permission || ''));
}

function scopeMatches(grant, scope = {}) {
  if (grant.scope_type === 'global') return true;
  const expected = String(grant.scope_ref || '*');
  const actual = String(scope[grant.scope_type] || scope.ref || '');
  return expected === '*' || expected === actual;
}

function actionPermission(actionKey = '') {
  return String(actionKey || '')
    .trim()
    .replace(/_/g, '.')
    .replace(/-/g, '.');
}

function resolvePrincipal(input = {}) {
  if (input.principal) return input.principal;
  const session = input.session || input;
  return {
    type: 'user',
    userId: Number(session.userId || 0) || null,
    username: session.appUsername || session.xenUser || 'system',
    role: session.governanceRole || 'read-only',
    tokenPermissions: [],
  };
}

function hasPermission(input, permission, scope = {}) {
  const principal = resolvePrincipal(input);
  if (!principal.userId) return false;
  const account = userModel.getById(principal.userId);
  if (!account?.active) return false;
  const grants = permissionGrantModel.listForUser(principal.userId)
    .filter((grant) => scopeMatches(grant, scope) && matches(grant.permission, permission));
  if (grants.some((grant) => grant.effect === 'deny')) return false;
  if (grants.some((grant) => grant.effect === 'allow')) return true;

  const template = ROLE_TEMPLATES[principal.role || account.role] || [];
  const roleAllows = template.some((pattern) => matches(pattern, permission));
  if (!roleAllows) return false;
  return !principal.tokenPermissions?.length || principal.tokenPermissions.some((pattern) => matches(pattern, permission));
}

function createApiToken({ userId, name, permissions = [], expiresAt = '' }) {
  const raw = `xm_${crypto.randomBytes(32).toString('base64url')}`;
  const record = apiTokenModel.create({
    id: crypto.randomUUID(), userId, name: String(name || '').trim(), tokenPrefix: raw.slice(0, 10),
    tokenHash: crypto.createHash('sha256').update(raw).digest('hex'), permissions, expiresAt: expiresAt || null,
  });
  return { ...record, token: raw };
}

function authenticateApiToken(rawToken) {
  const raw = String(rawToken || '').trim();
  if (!raw.startsWith('xm_')) return null;
  const record = apiTokenModel.findActiveByHash(crypto.createHash('sha256').update(raw).digest('hex'));
  if (!record) return null;
  const account = userModel.getById(record.user_id);
  if (!account?.active) return null;
  apiTokenModel.touch(record.id);
  return {
    type: 'api-token', tokenId: record.id, userId: account.id, username: account.username,
    role: account.role, tokenPermissions: record.permissions || [], name: record.name,
  };
}

module.exports = { ROLE_TEMPLATES, actionPermission, hasPermission, createApiToken, authenticateApiToken, permissionGrantModel, apiTokenModel };
