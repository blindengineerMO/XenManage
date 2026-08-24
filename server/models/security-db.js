const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const config = require('../config');

let db;

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
      SELECT id, username, display_name, email, role, active, created_at, last_login_at
      FROM users
      ORDER BY username
    `).all();
  },

  getById(id) {
    return getSecurityDb().prepare(`
      SELECT id, username, display_name, email, role, active, created_at, last_login_at
      FROM users
      WHERE id = ?
    `).get(id) || null;
  },

  getByUsername(username) {
    return getSecurityDb().prepare(`
      SELECT id, username, password_hash, display_name, email, role, active, created_at, last_login_at
      FROM users
      WHERE lower(username) = lower(?)
    `).get(username) || null;
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
};

module.exports = { getSecurityDb, sessionStoreModel, authEventModel, userModel };
