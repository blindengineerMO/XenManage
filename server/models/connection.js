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
      port INTEGER DEFAULT 443,
      is_default INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_connected_at DATETIME
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
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

  create({ name, host, username, port = 443, isDefault = false }) {
    const db = getDb();
    const existing = this.findByFingerprint(host, username, port);

    if (existing) {
      return this.update(existing.id, {
        name,
        host,
        username,
        port,
        isDefault: isDefault || Boolean(existing.is_default),
      });
    }

    if (isDefault) {
      db.prepare('UPDATE connections SET is_default = 0').run();
    }
    const result = db.prepare(
      'INSERT INTO connections (name, host, username, port, is_default) VALUES (?, ?, ?, ?, ?)'
    ).run(name, host, username, port, isDefault ? 1 : 0);
    return this.getById(result.lastInsertRowid);
  },

  update(id, { name, host, username, port, isDefault }) {
    const db = getDb();
    if (isDefault) {
      db.prepare('UPDATE connections SET is_default = 0').run();
    }
    db.prepare(
      'UPDATE connections SET name = ?, host = ?, username = ?, port = ?, is_default = ? WHERE id = ?'
    ).run(name, host, username, port, isDefault ? 1 : 0, id);
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

module.exports = { getDb, connectionModel, settingsModel };
