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

function createApiToken({ userId, name, permissions = [], expiresAt = '', allowedIps = [] }) {
  const raw = `xm_${crypto.randomBytes(32).toString('base64url')}`;
  const record = apiTokenModel.create({
    id: crypto.randomUUID(), userId, name: String(name || '').trim(), tokenPrefix: raw.slice(0, 10),
    tokenHash: crypto.createHash('sha256').update(raw).digest('hex'), permissions, expiresAt: expiresAt || null, allowedIps,
  });
  return { ...record, token: raw };
}

// Normalizes the IPv6-mapped-IPv4 form Node reports for IPv4 connections
// (e.g. "::ffff:127.0.0.1"), matching the precedent in middleware/rate-limit.js.
function normalizeIp(ip) {
  const value = String(ip || '').trim();
  return value.startsWith('::ffff:') ? value.slice(7) : value;
}

function ipv4ToInt(ip) {
  const parts = String(ip).split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part) || part < 0 || part > 255)) return null;
  return parts.reduce((acc, part) => (acc << 8) + part, 0) >>> 0;
}

function ipMatchesEntry(clientIp, entry) {
  const value = String(entry || '').trim();
  if (!value) return false;

  if (value.includes('/')) {
    const [rangeIp, prefixRaw] = value.split('/');
    const prefix = Number(prefixRaw);
    const rangeInt = ipv4ToInt(rangeIp);
    const clientInt = ipv4ToInt(clientIp);
    if (rangeInt === null || clientInt === null || !Number.isInteger(prefix) || prefix < 0 || prefix > 32) return false;
    const mask = prefix === 0 ? 0 : (0xFFFFFFFF << (32 - prefix)) >>> 0;
    return (rangeInt & mask) === (clientInt & mask);
  }

  return value === clientIp;
}

function isIpAllowed(allowedIps, clientIp) {
  if (!Array.isArray(allowedIps) || allowedIps.length === 0) return true;
  const normalized = normalizeIp(clientIp);
  return allowedIps.some((entry) => ipMatchesEntry(normalized, entry));
}

function authenticateApiToken(rawToken, clientIp = '') {
  const raw = String(rawToken || '').trim();
  if (!raw.startsWith('xm_')) return null;
  const record = apiTokenModel.findActiveByHash(crypto.createHash('sha256').update(raw).digest('hex'));
  if (!record) return null;
  if (!isIpAllowed(record.allowedIps, clientIp)) return null;
  const account = userModel.getById(record.user_id);
  if (!account?.active) return null;
  apiTokenModel.touch(record.id);
  return {
    type: 'api-token', tokenId: record.id, userId: account.id, username: account.username,
    role: account.role, tokenPermissions: record.permissions || [], name: record.name,
  };
}

module.exports = { ROLE_TEMPLATES, actionPermission, hasPermission, createApiToken, authenticateApiToken, isIpAllowed, permissionGrantModel, apiTokenModel };
