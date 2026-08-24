const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const config = require('../config');

let db;

const VALID_ROLES = new Set(['read-only', 'operator', 'admin']);

function normalizeRole(role) {
  return VALID_ROLES.has(role) ? role : 'operator';
}

function normalizeUserRecord(record, { includePasswordHash = false } = {}) {
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
  initializeSchema();
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

    CREATE TABLE IF NOT EXISTS vault_key_material (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      wrapped_dek BLOB,
      wrap_iv BLOB,
      wrap_auth_tag BLOB,
      key_version INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  ensureBootstrapUser();
}

function ensureBootstrapUser() {
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(config.auth.bootstrapUsername);
  if (existing) return;

  const passwordHash = bcrypt.hashSync(config.auth.bootstrapPassword, 10);
  db.prepare(`
    INSERT INTO users (username, password_hash, display_name, email, role, active, last_login_at)
    VALUES (?, ?, ?, ?, 'admin', 1, NULL)
  `).run(
    config.auth.bootstrapUsername,
    passwordHash,
    config.auth.bootstrapDisplayName,
    ''
  );
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
      SELECT id, username, password_hash, display_name, email, role, active, created_at, last_login_at
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
        SUM(CASE WHEN role = 'admin' AND active = 1 THEN 1 ELSE 0 END) AS activeAdmins
      FROM users
    `).get();

    return {
      totalUsers: Number(row?.totalUsers || 0),
      activeUsers: Number(row?.activeUsers || 0),
      activeAdmins: Number(row?.activeAdmins || 0),
    };
  },

  getByUsernameById(id) {
    const record = getSecurityDb().prepare(`
      SELECT id, username, password_hash, display_name, email, role, active, created_at, last_login_at
      FROM users
      WHERE id = ?
    `).get(Number(id));

    return normalizeUserRecord(record, { includePasswordHash: true });
  },
};

module.exports = { getSecurityDb, sessionStoreModel, authEventModel, userModel };
