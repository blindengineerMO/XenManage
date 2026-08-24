const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const config = require('../config');

let db;

function getDb() {
  if (db) return db;

  const dbDir = path.dirname(config.db.path);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  db = new Database(config.db.path);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  initializeSchema();
  return db;
}

function initializeSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS connections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      host TEXT NOT NULL,
      username TEXT NOT NULL,
      vault_credential_id INTEGER,
      port INTEGER DEFAULT 443,
      is_default INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_connected_at DATETIME
    );

    CREATE TABLE IF NOT EXISTS host_targets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      host TEXT NOT NULL,
      username TEXT NOT NULL,
      vault_credential_id INTEGER,
      port INTEGER DEFAULT 443,
      mode TEXT NOT NULL DEFAULT 'standalone',
      pool_connection_id INTEGER,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_connected_at DATETIME,
      FOREIGN KEY (pool_connection_id) REFERENCES connections(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS retention_policies (
      domain TEXT PRIMARY KEY,
      retention_days INTEGER NOT NULL,
      enabled INTEGER DEFAULT 1,
      last_run_at DATETIME,
      last_purged_count INTEGER DEFAULT 0
    );
  `);

  const connectionColumns = new Set(
    db.prepare('PRAGMA table_info(connections)').all().map((column) => column.name)
  );
  if (!connectionColumns.has('vault_credential_id')) {
    db.exec('ALTER TABLE connections ADD COLUMN vault_credential_id INTEGER');
  }

  const hostTargetColumns = new Set(
    db.prepare('PRAGMA table_info(host_targets)').all().map((column) => column.name)
  );
  if (!hostTargetColumns.has('vault_credential_id')) {
    db.exec('ALTER TABLE host_targets ADD COLUMN vault_credential_id INTEGER');
  }
}

// Connection CRUD
const connectionModel = {
  getAll() {
    return getDb().prepare('SELECT * FROM connections ORDER BY is_default DESC, name').all();
  },

  getById(id) {
    return getDb().prepare('SELECT * FROM connections WHERE id = ?').get(id);
  },

  findByFingerprint(host, username, port = 443) {
    return getDb().prepare(
      'SELECT * FROM connections WHERE host = ? AND username = ? AND port = ?'
    ).get(host, username, port);
  },

  create({ name, host, username, vaultCredentialId = null, port = 443, isDefault = false }) {
    const db = getDb();
    const existing = this.findByFingerprint(host, username, port);

    if (existing) {
      return this.update(existing.id, {
        name,
        host,
        username,
        vaultCredentialId,
        port,
        isDefault: isDefault || Boolean(existing.is_default),
      });
    }

    if (isDefault) {
      db.prepare('UPDATE connections SET is_default = 0').run();
    }
    const result = db.prepare(
      'INSERT INTO connections (name, host, username, vault_credential_id, port, is_default) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(name, host, username, vaultCredentialId, port, isDefault ? 1 : 0);
    return this.getById(result.lastInsertRowid);
  },

  update(id, { name, host, username, vaultCredentialId = null, port, isDefault }) {
    const db = getDb();
    if (isDefault) {
      db.prepare('UPDATE connections SET is_default = 0').run();
    }
    db.prepare(
      'UPDATE connections SET name = ?, host = ?, username = ?, vault_credential_id = ?, port = ?, is_default = ? WHERE id = ?'
    ).run(name, host, username, vaultCredentialId, port, isDefault ? 1 : 0, id);
    return this.getById(id);
  },

  updateLastConnected(id) {
    getDb().prepare('UPDATE connections SET last_connected_at = CURRENT_TIMESTAMP WHERE id = ?').run(id);
  },

  touchByFingerprint(host, username, port = 443) {
    const existing = this.findByFingerprint(host, username, port);
    if (!existing) return null;
    this.updateLastConnected(existing.id);
    return this.getById(existing.id);
  },

  setDefault(id) {
    const db = getDb();
    db.prepare('UPDATE connections SET is_default = 0').run();
    db.prepare('UPDATE connections SET is_default = 1 WHERE id = ?').run(id);
    return this.getById(id);
  },

  delete(id) {
    getDb().prepare('DELETE FROM connections WHERE id = ?').run(id);
  },
};

const hostTargetModel = {
  getAll() {
    return getDb().prepare(`
      SELECT host_targets.*, connections.name AS pool_name
      FROM host_targets
      LEFT JOIN connections ON connections.id = host_targets.pool_connection_id
      ORDER BY host_targets.name
    `).all();
  },

  getById(id) {
    return getDb().prepare(`
      SELECT host_targets.*, connections.name AS pool_name
      FROM host_targets
      LEFT JOIN connections ON connections.id = host_targets.pool_connection_id
      WHERE host_targets.id = ?
    `).get(id);
  },

  findByFingerprint(host, username, port = 443) {
    return getDb().prepare(
      'SELECT * FROM host_targets WHERE host = ? AND username = ? AND port = ?'
    ).get(host, username, port);
  },

  create({ name, host, username, vaultCredentialId = null, port = 443, mode = 'standalone', poolConnectionId = null, notes = '' }) {
    const db = getDb();
    const existing = this.findByFingerprint(host, username, port);

    if (existing) {
      return this.update(existing.id, {
        name,
        host,
        username,
        vaultCredentialId,
        port,
        mode,
        poolConnectionId,
        notes,
      });
    }

    const result = db.prepare(`
      INSERT INTO host_targets (name, host, username, vault_credential_id, port, mode, pool_connection_id, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      name,
      host,
      username,
      vaultCredentialId,
      port,
      mode,
      mode === 'pool-member' ? poolConnectionId : null,
      notes || ''
    );

    return this.getById(result.lastInsertRowid);
  },

  update(id, { name, host, username, vaultCredentialId = null, port, mode, poolConnectionId = null, notes = '' }) {
    getDb().prepare(`
      UPDATE host_targets
      SET name = ?, host = ?, username = ?, vault_credential_id = ?, port = ?, mode = ?, pool_connection_id = ?, notes = ?
      WHERE id = ?
    `).run(
      name,
      host,
      username,
      vaultCredentialId,
      port,
      mode,
      mode === 'pool-member' ? poolConnectionId : null,
      notes || '',
      id
    );

    return this.getById(id);
  },

  delete(id) {
    getDb().prepare('DELETE FROM host_targets WHERE id = ?').run(id);
  },
};

// Settings CRUD
const settingsModel = {
  get(key) {
    const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key);
    return row ? row.value : null;
  },

  set(key, value) {
    getDb().prepare(
      'INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)'
    ).run(key, value);
  },

  getAll() {
    const rows = getDb().prepare('SELECT * FROM settings').all();
    return rows.reduce((acc, row) => { acc[row.key] = row.value; return acc; }, {});
  },
};

const retentionPolicyModel = {
  getAll() {
    return getDb().prepare(`
      SELECT domain, retention_days, enabled, last_run_at, last_purged_count
      FROM retention_policies
      ORDER BY domain
    `).all();
  },

  get(domain) {
    return getDb().prepare(`
      SELECT domain, retention_days, enabled, last_run_at, last_purged_count
      FROM retention_policies
      WHERE domain = ?
    `).get(domain) || null;
  },

  upsert({ domain, retentionDays, enabled = true, lastRunAt = null, lastPurgedCount = 0 }) {
    getDb().prepare(`
      INSERT INTO retention_policies (domain, retention_days, enabled, last_run_at, last_purged_count)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(domain) DO UPDATE SET
        retention_days = excluded.retention_days,
        enabled = excluded.enabled,
        last_run_at = excluded.last_run_at,
        last_purged_count = excluded.last_purged_count
    `).run(
      domain,
      retentionDays,
      enabled ? 1 : 0,
      lastRunAt,
      lastPurgedCount
    );

    return this.get(domain);
  },
};

module.exports = { getDb, connectionModel, hostTargetModel, settingsModel, retentionPolicyModel };
