const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const config = require('../config');
const { runMigrations } = require('../migrations/runner');

let db;

const VALID_ROLES = new Set(['read-only', 'operator', 'admin']);

function normalizeRole(role) {
  return VALID_ROLES.has(role) ? role : 'operator';
}

function normalizeGroupRecord(record) {
  if (!record) return null;

  return {
    id: Number(record.id),
    name: record.name || '',
    created_at: record.created_at || '',
    member_count: Number(record.member_count || 0),
    member_ids: String(record.member_ids || '')
      .split('|')
      .map((value) => Number(value || 0))
      .filter(Boolean),
    members: String(record.member_names || '')
      .split('|')
      .map((value) => value.trim())
      .filter(Boolean),
  };
}

function normalizeGroupIds(groupIds = []) {
  return [...new Set(
    (Array.isArray(groupIds) ? groupIds : [])
      .map((value) => Number(value || 0))
      .filter((value) => value > 0)
  )];
}

function syncUserGroupMembership(userId, groupIds = []) {
  const db = getSecurityDb();
  const normalizedUserId = Number(userId);
  const normalizedGroupIds = normalizeGroupIds(groupIds);

  const groupRows = normalizedGroupIds.length
    ? db.prepare(`
      SELECT id
      FROM groups
      WHERE id IN (${normalizedGroupIds.map(() => '?').join(', ')})
    `).all(...normalizedGroupIds)
    : [];

  const validGroupIds = groupRows.map((row) => Number(row.id));

  if (normalizedGroupIds.length !== validGroupIds.length) {
    const error = new Error('GROUP_NOT_FOUND');
    error.code = 'GROUP_NOT_FOUND';
    throw error;
  }

  const transaction = db.transaction(() => {
    db.prepare('DELETE FROM group_members WHERE user_id = ?').run(normalizedUserId);
    const insert = db.prepare('INSERT INTO group_members (group_id, user_id) VALUES (?, ?)');
    validGroupIds.forEach((groupId) => insert.run(groupId, normalizedUserId));
  });

  transaction();
}

function syncGroupMembers(groupId, memberUserIds = []) {
  const db = getSecurityDb();
  const normalizedGroupId = Number(groupId);
  const normalizedUserIds = [...new Set(
    (Array.isArray(memberUserIds) ? memberUserIds : [])
      .map((value) => Number(value || 0))
      .filter((value) => value > 0)
  )];

  const userRows = normalizedUserIds.length
    ? db.prepare(`
      SELECT id
      FROM users
      WHERE id IN (${normalizedUserIds.map(() => '?').join(', ')})
    `).all(...normalizedUserIds)
    : [];

  const validUserIds = userRows.map((row) => Number(row.id));
  if (normalizedUserIds.length !== validUserIds.length) {
    const error = new Error('USER_NOT_FOUND');
    error.code = 'USER_NOT_FOUND';
    throw error;
  }

  const transaction = db.transaction(() => {
    db.prepare('DELETE FROM group_members WHERE group_id = ?').run(normalizedGroupId);
    const insert = db.prepare('INSERT INTO group_members (group_id, user_id) VALUES (?, ?)');
    validUserIds.forEach((userId) => insert.run(normalizedGroupId, userId));
  });

  transaction();
}

function normalizeUserRecord(record, { includePasswordHash = false, includeMfaSecret = false } = {}) {
  if (!record) return null;

  const user = {
    id: Number(record.id),
    username: record.username,
    display_name: record.display_name || '',
    email: record.email || '',
    role: normalizeRole(record.role),
    active: Boolean(record.active),
    created_at: record.created_at || '',
    last_login_at: record.last_login_at || '',
    avatar_path: record.avatar_path || '',
    theme: record.theme === 'light' ? 'light' : 'dark',
    mfa_enabled: Boolean(record.mfa_enabled),
    group_count: Number(record.group_count || 0),
    groups: Array.isArray(record.groups)
      ? record.groups
      : String(record.group_names || '')
        .split('|')
        .map((value) => value.trim())
        .filter(Boolean),
  };

  if (includePasswordHash) {
    user.password_hash = record.password_hash || '';
  }

  if (includeMfaSecret) {
    user.mfa_secret_encrypted = record.mfa_secret_encrypted || '';
  }

  return user;
}

function getActiveAdminCountExcluding(userId = null) {
  if (userId === null || userId === undefined) {
    const row = getSecurityDb().prepare(`
      SELECT COUNT(*) AS count
      FROM users
      WHERE role = 'admin' AND active = 1
    `).get();
    return Number(row?.count || 0);
  }

  const row = getSecurityDb().prepare(`
    SELECT COUNT(*) AS count
    FROM users
    WHERE role = 'admin'
      AND active = 1
      AND id != ?
  `).get(Number(userId));

  return Number(row?.count || 0);
}

function ensureUserWriteAllowed(existingUser, nextRole, nextActive) {
  if (!existingUser) {
    const error = new Error('USER_NOT_FOUND');
    error.code = 'USER_NOT_FOUND';
    throw error;
  }

  const roleChange = normalizeRole(existingUser.role) !== normalizeRole(nextRole);
  const activeChange = Boolean(existingUser.active) !== Boolean(nextActive);

  if (!roleChange && !activeChange) {
    return;
  }

  if (normalizeRole(existingUser.role) !== 'admin' || !existingUser.active) {
    return;
  }

  if (normalizeRole(nextRole) === 'admin' && nextActive) {
    return;
  }

  if (getActiveAdminCountExcluding(existingUser.id) === 0) {
    const error = new Error('LAST_ACTIVE_ADMIN_REQUIRED');
    error.code = 'LAST_ACTIVE_ADMIN_REQUIRED';
    throw error;
  }
}

function getSecurityDb() {
  if (db) return db;

  const dbDir = path.dirname(config.db.securityPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  db = new Database(config.db.securityPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  runMigrations(db, [{
    version: 1,
    name: 'security-baseline',
    checksum: 'security-baseline-2026-09-02',
    adoptLegacySchema: true,
    up: initializeSchema,
  }]);
  ensureBootstrapUser();
  return db;
}

function initializeSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      display_name TEXT,
      email TEXT,
      role TEXT NOT NULL DEFAULT 'operator',
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login_at DATETIME
    );

    CREATE TABLE IF NOT EXISTS groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS group_members (
      group_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      PRIMARY KEY (group_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS sessions (
      sid TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      expires_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions (expires_at);

    CREATE TABLE IF NOT EXISTS auth_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      username TEXT,
      event TEXT NOT NULL,
      ip TEXT,
      detail TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS permission_grants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      permission TEXT NOT NULL,
      scope_type TEXT NOT NULL DEFAULT 'global',
      scope_ref TEXT NOT NULL DEFAULT '*',
      effect TEXT NOT NULL DEFAULT 'allow',
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, permission, scope_type, scope_ref)
    );
    CREATE INDEX IF NOT EXISTS idx_permission_grants_user ON permission_grants(user_id);

    CREATE TABLE IF NOT EXISTS catalog_roles (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK (role IN ('viewer', 'subscriber', 'admin')),
      granted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      granted_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS api_tokens (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      token_prefix TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      permissions_json TEXT NOT NULL DEFAULT '[]',
      expires_at DATETIME,
      last_used_at DATETIME,
      revoked_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_api_tokens_user ON api_tokens(user_id, revoked_at);

    CREATE TABLE IF NOT EXISTS vault_key_material (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      wrapped_dek BLOB,
      wrap_iv BLOB,
      wrap_auth_tag BLOB,
      key_version INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      endpoint TEXT NOT NULL UNIQUE,
      keys_json TEXT NOT NULL,
      notify_alerts INTEGER NOT NULL DEFAULT 1,
      notify_approvals INTEGER NOT NULL DEFAULT 1,
      notify_catalog INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions(user_id);
  `);

  const userColumns = new Set(
    db.prepare('PRAGMA table_info(users)').all().map((column) => column.name)
  );
  if (!userColumns.has('avatar_path')) {
    db.exec('ALTER TABLE users ADD COLUMN avatar_path TEXT');
  }
  if (!userColumns.has('theme')) {
    db.exec(`ALTER TABLE users ADD COLUMN theme TEXT NOT NULL DEFAULT 'dark'`);
  }
  if (!userColumns.has('mfa_enabled')) {
    db.exec('ALTER TABLE users ADD COLUMN mfa_enabled INTEGER NOT NULL DEFAULT 0');
  }
  if (!userColumns.has('mfa_secret_encrypted')) {
    db.exec('ALTER TABLE users ADD COLUMN mfa_secret_encrypted TEXT');
  }

}

function ensureBootstrapUser() {
  let bootstrap = db.prepare('SELECT id FROM users WHERE username = ?').get(config.auth.bootstrapUsername);
  if (!bootstrap) {
    const passwordHash = bcrypt.hashSync(config.auth.bootstrapPassword, 10);
    const result = db.prepare(`
      INSERT INTO users (username, password_hash, display_name, email, role, active, last_login_at)
      VALUES (?, ?, ?, ?, 'admin', 1, NULL)
    `).run(
      config.auth.bootstrapUsername,
      passwordHash,
      config.auth.bootstrapDisplayName,
      ''
    );
    bootstrap = { id: result.lastInsertRowid };
  }

  db.prepare(`INSERT OR IGNORE INTO catalog_roles (user_id, role, granted_by_user_id)
    VALUES (?, 'admin', ?)`).run(bootstrap.id, bootstrap.id);
}

const sessionStoreModel = {
  get(sid) {
    return getSecurityDb().prepare('SELECT sid, data, expires_at FROM sessions WHERE sid = ?').get(sid) || null;
  },

  set(sid, data, expiresAt) {
    getSecurityDb().prepare(`
      INSERT INTO sessions (sid, data, expires_at)
      VALUES (?, ?, ?)
      ON CONFLICT(sid) DO UPDATE SET data = excluded.data, expires_at = excluded.expires_at
    `).run(sid, data, expiresAt);
  },

  destroy(sid) {
    getSecurityDb().prepare('DELETE FROM sessions WHERE sid = ?').run(sid);
  },

  touch(sid, expiresAt) {
    getSecurityDb().prepare('UPDATE sessions SET expires_at = ? WHERE sid = ?').run(expiresAt, sid);
  },

  purgeExpired(now = Date.now()) {
    return getSecurityDb().prepare('DELETE FROM sessions WHERE expires_at <= ?').run(now).changes;
  },

  destroyForUserExcept(userId, exceptSid = '') {
    const rows = getSecurityDb().prepare('SELECT sid, data FROM sessions').all();
    const targetUserId = Number(userId);
    const del = getSecurityDb().prepare('DELETE FROM sessions WHERE sid = ?');
    let removed = 0;

    for (const row of rows) {
      if (row.sid === exceptSid) continue;
      try {
        const parsed = JSON.parse(row.data);
        if (Number(parsed?.userId) === targetUserId) {
          del.run(row.sid);
          removed += 1;
        }
      } catch (_) {
        // Ignore unparsable session rows.
      }
    }

    return removed;
  },
};

const authEventModel = {
  create({ userId = null, username = '', event = '', ip = '', detail = '' }) {
    const result = getSecurityDb().prepare(`
      INSERT INTO auth_events (user_id, username, event, ip, detail)
      VALUES (?, ?, ?, ?, ?)
    `).run(userId, username, event, ip, detail);

    return getSecurityDb().prepare('SELECT * FROM auth_events WHERE id = ?').get(result.lastInsertRowid);
  },

  list() {
    return getSecurityDb().prepare(`
      SELECT id, user_id, username, event, ip, detail, created_at
      FROM auth_events
      ORDER BY datetime(created_at) DESC, id DESC
    `).all();
  },
};

const permissionGrantModel = {
  listForUser(userId) {
    return getSecurityDb().prepare(`
      SELECT id, user_id, permission, scope_type, scope_ref, effect, created_by, created_at
      FROM permission_grants WHERE user_id = ? ORDER BY scope_type, scope_ref, permission
    `).all(Number(userId));
  },

  upsert({ userId, permission, scopeType = 'global', scopeRef = '*', effect = 'allow', createdBy = null }) {
    getSecurityDb().prepare(`
      INSERT INTO permission_grants (user_id, permission, scope_type, scope_ref, effect, created_by)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, permission, scope_type, scope_ref)
      DO UPDATE SET effect = excluded.effect, created_by = excluded.created_by
    `).run(Number(userId), permission, scopeType, scopeRef, effect, createdBy || null);
    return getSecurityDb().prepare(`
      SELECT id, user_id, permission, scope_type, scope_ref, effect, created_by, created_at
      FROM permission_grants WHERE user_id = ? AND permission = ? AND scope_type = ? AND scope_ref = ?
    `).get(Number(userId), permission, scopeType, scopeRef);
  },

  remove(id) {
    return getSecurityDb().prepare('DELETE FROM permission_grants WHERE id = ?').run(Number(id)).changes > 0;
  },
};

const apiTokenModel = {
  create({ id, userId, name, tokenPrefix, tokenHash, permissions = [], expiresAt = null }) {
    getSecurityDb().prepare(`
      INSERT INTO api_tokens (id, user_id, name, token_prefix, token_hash, permissions_json, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, Number(userId), name, tokenPrefix, tokenHash, JSON.stringify(permissions), expiresAt || null);
    return this.getById(id);
  },

  getById(id) {
    const record = getSecurityDb().prepare(`
      SELECT id, user_id, name, token_prefix, token_hash, permissions_json, expires_at, last_used_at, revoked_at, created_at
      FROM api_tokens WHERE id = ?
    `).get(id);
    return record ? { ...record, permissions: (() => { try { return JSON.parse(record.permissions_json || '[]'); } catch (_) { return []; } })() } : null;
  },

  listForUser(userId) {
    return getSecurityDb().prepare(`
      SELECT id, user_id, name, token_prefix, permissions_json, expires_at, last_used_at, revoked_at, created_at
      FROM api_tokens WHERE user_id = ? ORDER BY created_at DESC
    `).all(Number(userId)).map((record) => ({ ...record, permissions: (() => { try { return JSON.parse(record.permissions_json || '[]'); } catch (_) { return []; } })() }));
  },

  findActiveByHash(tokenHash) {
    const record = getSecurityDb().prepare(`
      SELECT id, user_id, name, token_prefix, token_hash, permissions_json, expires_at, last_used_at, revoked_at, created_at
      FROM api_tokens
      WHERE token_hash = ? AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at = '' OR expires_at > CURRENT_TIMESTAMP)
    `).get(tokenHash);
    return record ? { ...record, permissions: (() => { try { return JSON.parse(record.permissions_json || '[]'); } catch (_) { return []; } })() } : null;
  },

  touch(id) {
    getSecurityDb().prepare('UPDATE api_tokens SET last_used_at = CURRENT_TIMESTAMP WHERE id = ?').run(id);
  },

  revoke(id) {
    return getSecurityDb().prepare('UPDATE api_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE id = ? AND revoked_at IS NULL').run(id).changes > 0;
  },
};

const userModel = {
  list() {
    return getSecurityDb().prepare(`
      SELECT
        u.id,
        u.username,
        u.display_name,
        u.email,
        u.role,
        u.active,
        u.created_at,
        u.last_login_at,
        u.avatar_path,
        u.theme,
        u.mfa_enabled,
        COUNT(gm.group_id) AS group_count,
        GROUP_CONCAT(g.name, '|') AS group_names
      FROM users u
      LEFT JOIN group_members gm ON gm.user_id = u.id
      LEFT JOIN groups g ON g.id = gm.group_id
      GROUP BY u.id
      ORDER BY lower(u.username)
    `).all().map((record) => normalizeUserRecord(record));
  },

  getById(id) {
    const record = getSecurityDb().prepare(`
      SELECT
        u.id,
        u.username,
        u.display_name,
        u.email,
        u.role,
        u.active,
        u.created_at,
        u.last_login_at,
        u.avatar_path,
        u.theme,
        u.mfa_enabled,
        COUNT(gm.group_id) AS group_count,
        GROUP_CONCAT(g.name, '|') AS group_names
      FROM users u
      LEFT JOIN group_members gm ON gm.user_id = u.id
      LEFT JOIN groups g ON g.id = gm.group_id
      WHERE u.id = ?
      GROUP BY u.id
    `).get(Number(id));

    return normalizeUserRecord(record);
  },

  getByUsername(username) {
    const record = getSecurityDb().prepare(`
      SELECT id, username, password_hash, display_name, email, role, active, created_at, last_login_at, avatar_path, theme, mfa_enabled
      FROM users
      WHERE lower(username) = lower(?)
    `).get(String(username || '').trim());

    return normalizeUserRecord(record, { includePasswordHash: true });
  },

  verifyPassword(username, password) {
    const user = this.getByUsername(username);
    if (!user || !user.active) return null;
    if (!bcrypt.compareSync(String(password || ''), user.password_hash)) return null;
    return user;
  },

  touchLastLogin(id) {
    getSecurityDb().prepare(`
      UPDATE users
      SET last_login_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(id);
    return this.getById(id);
  },

  create(payload = {}) {
    const username = String(payload.username || '').trim();
    const displayName = String(payload.displayName || '').trim();
    const email = String(payload.email || '').trim();
    const role = normalizeRole(payload.role);
    const active = payload.active !== false ? 1 : 0;
    const passwordHash = bcrypt.hashSync(String(payload.password || ''), 10);

    if (this.getByUsername(username)) {
      const error = new Error('USERNAME_ALREADY_EXISTS');
      error.code = 'USERNAME_ALREADY_EXISTS';
      throw error;
    }

    const result = getSecurityDb().prepare(`
      INSERT INTO users (username, password_hash, display_name, email, role, active)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(username, passwordHash, displayName, email, role, active);

    if (Array.isArray(payload.groupIds)) {
      syncUserGroupMembership(result.lastInsertRowid, payload.groupIds);
    }

    return this.getById(result.lastInsertRowid);
  },

  update(id, payload = {}) {
    const existing = this.getByUsernameById(id);
    if (!existing) {
      const error = new Error('USER_NOT_FOUND');
      error.code = 'USER_NOT_FOUND';
      throw error;
    }

    const username = String(payload.username || existing.username || '').trim();
    const displayName = String(payload.displayName ?? existing.display_name ?? '').trim();
    const email = String(payload.email ?? existing.email ?? '').trim();
    const role = normalizeRole(payload.role ?? existing.role);
    const active = payload.active === undefined ? Boolean(existing.active) : Boolean(payload.active);

    const duplicate = this.getByUsername(username);
    if (duplicate && Number(duplicate.id) !== Number(id)) {
      const error = new Error('USERNAME_ALREADY_EXISTS');
      error.code = 'USERNAME_ALREADY_EXISTS';
      throw error;
    }

    ensureUserWriteAllowed(existing, role, active);

    getSecurityDb().prepare(`
      UPDATE users
      SET username = ?, display_name = ?, email = ?, role = ?, active = ?
      WHERE id = ?
    `).run(username, displayName, email, role, active ? 1 : 0, Number(id));

    if (Array.isArray(payload.groupIds)) {
      syncUserGroupMembership(id, payload.groupIds);
    }

    return this.getById(id);
  },

  setPassword(id, password) {
    const existing = this.getByUsernameById(id);
    if (!existing) {
      const error = new Error('USER_NOT_FOUND');
      error.code = 'USER_NOT_FOUND';
      throw error;
    }

    const passwordHash = bcrypt.hashSync(String(password || ''), 10);
    getSecurityDb().prepare(`
      UPDATE users
      SET password_hash = ?
      WHERE id = ?
    `).run(passwordHash, Number(id));

    return this.getById(id);
  },

  getSummary() {
    const row = getSecurityDb().prepare(`
      SELECT
        COUNT(*) AS totalUsers,
        SUM(CASE WHEN active = 1 THEN 1 ELSE 0 END) AS activeUsers,
        SUM(CASE WHEN role = 'admin' AND active = 1 THEN 1 ELSE 0 END) AS activeAdmins,
        (SELECT COUNT(*) FROM groups) AS totalGroups
      FROM users
    `).get();

    return {
      totalUsers: Number(row?.totalUsers || 0),
      activeUsers: Number(row?.activeUsers || 0),
      activeAdmins: Number(row?.activeAdmins || 0),
      totalGroups: Number(row?.totalGroups || 0),
    };
  },

  getByUsernameById(id) {
    const record = getSecurityDb().prepare(`
      SELECT id, username, password_hash, display_name, email, role, active, created_at, last_login_at, avatar_path, theme, mfa_enabled, mfa_secret_encrypted
      FROM users
      WHERE id = ?
    `).get(Number(id));

    return normalizeUserRecord(record, { includePasswordHash: true, includeMfaSecret: true });
  },

  updateProfile(id, { displayName, email } = {}) {
    const existing = this.getById(id);
    if (!existing) {
      const error = new Error('USER_NOT_FOUND');
      error.code = 'USER_NOT_FOUND';
      throw error;
    }

    getSecurityDb().prepare(`
      UPDATE users
      SET display_name = ?, email = ?
      WHERE id = ?
    `).run(String(displayName ?? existing.display_name).trim(), String(email ?? existing.email).trim(), Number(id));

    return this.getById(id);
  },

  setTheme(id, theme) {
    const normalizedTheme = theme === 'light' ? 'light' : 'dark';
    getSecurityDb().prepare(`
      UPDATE users
      SET theme = ?
      WHERE id = ?
    `).run(normalizedTheme, Number(id));

    return this.getById(id);
  },

  setAvatarPath(id, avatarPath) {
    getSecurityDb().prepare(`
      UPDATE users
      SET avatar_path = ?
      WHERE id = ?
    `).run(avatarPath || null, Number(id));

    return this.getById(id);
  },

  setMfaSecret(id, secretEncrypted) {
    getSecurityDb().prepare(`
      UPDATE users
      SET mfa_secret_encrypted = ?, mfa_enabled = 0
      WHERE id = ?
    `).run(secretEncrypted || null, Number(id));

    return this.getByUsernameById(id);
  },

  setMfaEnabled(id, enabled) {
    getSecurityDb().prepare(`
      UPDATE users
      SET mfa_enabled = ?
      WHERE id = ?
    `).run(enabled ? 1 : 0, Number(id));

    if (!enabled) {
      getSecurityDb().prepare('UPDATE users SET mfa_secret_encrypted = NULL WHERE id = ?').run(Number(id));
    }

    return this.getById(id);
  },
};

const pushSubscriptionModel = {
  listForUser(userId) {
    return getSecurityDb().prepare(`
      SELECT id, user_id, endpoint, keys_json, notify_alerts, notify_approvals, notify_catalog, created_at
      FROM push_subscriptions WHERE user_id = ? ORDER BY created_at DESC
    `).all(Number(userId)).map((record) => ({
      ...record,
      keys: (() => { try { return JSON.parse(record.keys_json || '{}'); } catch (_) { return {}; } })(),
    }));
  },

  upsert({ userId, endpoint, keys, notifyAlerts = true, notifyApprovals = true, notifyCatalog = true }) {
    getSecurityDb().prepare(`
      INSERT INTO push_subscriptions (user_id, endpoint, keys_json, notify_alerts, notify_approvals, notify_catalog)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(endpoint) DO UPDATE SET
        user_id = excluded.user_id,
        keys_json = excluded.keys_json,
        notify_alerts = excluded.notify_alerts,
        notify_approvals = excluded.notify_approvals,
        notify_catalog = excluded.notify_catalog
    `).run(
      Number(userId),
      String(endpoint || ''),
      JSON.stringify(keys || {}),
      notifyAlerts ? 1 : 0,
      notifyApprovals ? 1 : 0,
      notifyCatalog ? 1 : 0
    );

    return getSecurityDb().prepare('SELECT * FROM push_subscriptions WHERE endpoint = ?').get(String(endpoint || ''));
  },

  removeForUser(userId, endpoint) {
    return getSecurityDb().prepare(`
      DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?
    `).run(Number(userId), String(endpoint || '')).changes > 0;
  },

  listAll() {
    return getSecurityDb().prepare(`
      SELECT id, user_id, endpoint, keys_json, notify_alerts, notify_approvals, notify_catalog, created_at
      FROM push_subscriptions
    `).all().map((record) => ({
      ...record,
      keys: (() => { try { return JSON.parse(record.keys_json || '{}'); } catch (_) { return {}; } })(),
    }));
  },
};

const CATALOG_ROLES = new Set(['viewer', 'subscriber', 'admin']);

const catalogRoleModel = {
  getByUserId(userId) {
    return getSecurityDb().prepare(`SELECT user_id, role, granted_at, granted_by_user_id
      FROM catalog_roles WHERE user_id = ?`).get(Number(userId)) || null;
  },

  list() {
    return getSecurityDb().prepare(`SELECT catalog_roles.user_id, catalog_roles.role, catalog_roles.granted_at,
      catalog_roles.granted_by_user_id, users.username, users.display_name, users.active
      FROM catalog_roles JOIN users ON users.id = catalog_roles.user_id
      ORDER BY lower(users.username)`).all();
  },

  set(userId, role, grantedByUserId = null) {
    const normalizedUserId = Number(userId);
    const normalizedRole = String(role || '').trim().toLowerCase();
    if (!CATALOG_ROLES.has(normalizedRole)) {
      const error = new Error('CATALOG_ROLE_INVALID');
      error.code = 'CATALOG_ROLE_INVALID';
      throw error;
    }
    if (!userModel.getById(normalizedUserId)) {
      const error = new Error('USER_NOT_FOUND');
      error.code = 'USER_NOT_FOUND';
      throw error;
    }
    getSecurityDb().prepare(`INSERT INTO catalog_roles (user_id, role, granted_by_user_id)
      VALUES (?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET role = excluded.role, granted_at = CURRENT_TIMESTAMP,
        granted_by_user_id = excluded.granted_by_user_id`).run(normalizedUserId, normalizedRole, grantedByUserId || null);
    return this.getByUserId(normalizedUserId);
  },
};

const groupModel = {
  list() {
    return getSecurityDb().prepare(`
      SELECT
        g.id,
        g.name,
        g.created_at,
        COUNT(gm.user_id) AS member_count,
        GROUP_CONCAT(u.id, '|') AS member_ids,
        GROUP_CONCAT(COALESCE(u.display_name, u.username), '|') AS member_names
      FROM groups g
      LEFT JOIN group_members gm ON gm.group_id = g.id
      LEFT JOIN users u ON u.id = gm.user_id
      GROUP BY g.id
      ORDER BY lower(g.name)
    `).all().map((record) => normalizeGroupRecord(record));
  },

  getById(id) {
    const record = getSecurityDb().prepare(`
      SELECT
        g.id,
        g.name,
        g.created_at,
        COUNT(gm.user_id) AS member_count,
        GROUP_CONCAT(u.id, '|') AS member_ids,
        GROUP_CONCAT(COALESCE(u.display_name, u.username), '|') AS member_names
      FROM groups g
      LEFT JOIN group_members gm ON gm.group_id = g.id
      LEFT JOIN users u ON u.id = gm.user_id
      WHERE g.id = ?
      GROUP BY g.id
    `).get(Number(id));

    return normalizeGroupRecord(record);
  },

  create(payload = {}) {
    const name = String(payload.name || '').trim();
    const existing = getSecurityDb().prepare(`
      SELECT id
      FROM groups
      WHERE lower(name) = lower(?)
    `).get(name);

    if (existing) {
      const error = new Error('GROUP_NAME_ALREADY_EXISTS');
      error.code = 'GROUP_NAME_ALREADY_EXISTS';
      throw error;
    }

    const result = getSecurityDb().prepare(`
      INSERT INTO groups (name)
      VALUES (?)
    `).run(name);

    if (Array.isArray(payload.memberUserIds)) {
      syncGroupMembers(result.lastInsertRowid, payload.memberUserIds);
    }

    return this.getById(result.lastInsertRowid);
  },

  update(id, payload = {}) {
    const existing = this.getById(id);
    if (!existing) {
      const error = new Error('GROUP_NOT_FOUND');
      error.code = 'GROUP_NOT_FOUND';
      throw error;
    }

    const name = String(payload.name || existing.name || '').trim();
    const duplicate = getSecurityDb().prepare(`
      SELECT id
      FROM groups
      WHERE lower(name) = lower(?)
    `).get(name);

    if (duplicate && Number(duplicate.id) !== Number(id)) {
      const error = new Error('GROUP_NAME_ALREADY_EXISTS');
      error.code = 'GROUP_NAME_ALREADY_EXISTS';
      throw error;
    }

    getSecurityDb().prepare(`
      UPDATE groups
      SET name = ?
      WHERE id = ?
    `).run(name, Number(id));

    if (Array.isArray(payload.memberUserIds)) {
      syncGroupMembers(id, payload.memberUserIds);
    }

    return this.getById(id);
  },

  delete(id) {
    const existing = this.getById(id);
    if (!existing) {
      const error = new Error('GROUP_NOT_FOUND');
      error.code = 'GROUP_NOT_FOUND';
      throw error;
    }

    const transaction = getSecurityDb().transaction(() => {
      getSecurityDb().prepare('DELETE FROM group_members WHERE group_id = ?').run(Number(id));
      getSecurityDb().prepare('DELETE FROM groups WHERE id = ?').run(Number(id));
    });

    transaction();
    return existing;
  },
};

module.exports = { getSecurityDb, sessionStoreModel, authEventModel, userModel, groupModel, permissionGrantModel, apiTokenModel, catalogRoleModel, pushSubscriptionModel };
