/**
 * LDAP / Active Directory login backend (search + bind).
 *
 * A service account (config.ldap.bindDn/bindPassword) searches searchBase for the
 * entry matching searchFilter (with {{username}} substituted), then a second bind
 * as that entry's DN with the caller-supplied password verifies the credential.
 * Works for OpenLDAP (e.g. filter "(uid={{username}})") and Active Directory
 * (e.g. "(sAMAccountName={{username}})").
 *
 * `authenticate()` never throws and never distinguishes "user not found",
 * "wrong password", or "directory unreachable" to its caller — all resolve to
 * null so routes/auth.js can fall through to local password auth without
 * leaking which backend rejected the attempt, and without a broken/unreachable
 * directory locking out local-only accounts (e.g. the bootstrap admin).
 */
const { Client } = require('ldapts');
const config = require('../config');
const logger = require('./logger');

function isEnabled() {
  return Boolean(config.ldap.enabled);
}

function escapeFilterValue(value) {
  return String(value).replace(/[\\*()\0]/g, (char) => `\\${char.charCodeAt(0).toString(16).padStart(2, '0')}`);
}

function attributeValue(entry, name) {
  const value = entry?.[name];
  if (Array.isArray(value)) return value.length ? String(value[0]) : '';
  return value !== undefined && value !== null ? String(value) : '';
}

function createClient() {
  // ldapts treats a defined `tlsOptions` value as "use a secure connection" even for a
  // plain ldap:// URL (it OR's the scheme check with "has tlsOptions"), so only pass it
  // when the URL actually requests TLS — otherwise a ldap://+rejectUnauthorized combo
  // silently tries (and fails) a secure handshake on the plaintext port.
  const options = { url: config.ldap.url };
  if (config.ldap.url.startsWith('ldaps://')) {
    options.tlsOptions = { rejectUnauthorized: config.ldap.tlsRejectUnauthorized };
  }
  return new Client(options);
}

async function authenticate(username, password) {
  if (!isEnabled() || !username || !password) return null;

  const client = createClient();
  try {
    await client.bind(config.ldap.bindDn, config.ldap.bindPassword);

    const filter = config.ldap.searchFilter.replace(/\{\{username\}\}/g, escapeFilterValue(username));
    const { searchEntries } = await client.search(config.ldap.searchBase, {
      scope: 'sub',
      filter,
      attributes: [config.ldap.usernameAttribute, config.ldap.emailAttribute, config.ldap.displayNameAttribute],
    });

    const entry = searchEntries[0];
    if (!entry) return null;

    const userClient = createClient();
    try {
      await userClient.bind(entry.dn, password);
    } catch {
      return null;
    } finally {
      await userClient.unbind().catch(() => {});
    }

    const email = attributeValue(entry, config.ldap.emailAttribute);
    if (config.ldap.allowedEmailDomains.length) {
      const domain = email.split('@')[1]?.toLowerCase() || '';
      if (!config.ldap.allowedEmailDomains.includes(domain)) return null;
    }

    return {
      dn: entry.dn,
      username: attributeValue(entry, config.ldap.usernameAttribute) || username,
      email,
      displayName: attributeValue(entry, config.ldap.displayNameAttribute) || username,
    };
  } catch (error) {
    logger.warn('ldap_auth_error', { message: error.message });
    return null;
  } finally {
    await client.unbind().catch(() => {});
  }
}

module.exports = { isEnabled, authenticate };
