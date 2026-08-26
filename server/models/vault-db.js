const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const config = require('../config');

let db;

function getVaultDb() {
  if (db) return db;

  const dbDir = path.dirname(config.db.vaultPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  db = new Database(config.db.vaultPath);
  db.pragma('journal_mode = WAL');
  initializeSchema();
  return db;
}

function initializeSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS credentials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_user_id INTEGER NOT NULL,
      scope TEXT NOT NULL DEFAULT 'private',
      target_type TEXT NOT NULL,
      target_hint TEXT,
      name TEXT NOT NULL,
      username TEXT NOT NULL,
      encrypted_password BLOB NOT NULL,
      enc_iv BLOB NOT NULL,
      enc_auth_tag BLOB NOT NULL,
      dek_key_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME,
      last_used_at DATETIME,
      last_used_by INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_credentials_owner_scope ON credentials (owner_user_id, scope);
  `);
}

const credentialModel = {
  listAll() {
    return getVaultDb().prepare(`
      SELECT id, owner_user_id, scope, target_type, target_hint, name, username, dek_key_id, created_at, updated_at, last_used_at, last_used_by
      FROM credentials
      ORDER BY name COLLATE NOCASE
    `).all();
  },

  listVisible(userId) {
    return getVaultDb().prepare(`
      SELECT id, owner_user_id, scope, target_type, target_hint, name, username, dek_key_id, created_at, updated_at, last_used_at, last_used_by
      FROM credentials
      WHERE owner_user_id = ? OR scope = 'shared'
      ORDER BY CASE WHEN owner_user_id = ? THEN 0 ELSE 1 END, name COLLATE NOCASE
    `).all(userId, userId);
  },

  getById(id) {
    return getVaultDb().prepare(`
      SELECT *
      FROM credentials
      WHERE id = ?
    `).get(id) || null;
  },

  create(record) {
    const result = getVaultDb().prepare(`
      INSERT INTO credentials (
        owner_user_id, scope, target_type, target_hint, name, username,
        encrypted_password, enc_iv, enc_auth_tag, dek_key_id, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(
      record.ownerUserId,
      record.scope,
      record.targetType,
      record.targetHint || '',
      record.name,
      record.username,
      record.encryptedPassword,
      record.encIv,
      record.encAuthTag,
      record.dekKeyId
    );

    return this.getById(result.lastInsertRowid);
  },

  update(id, record) {
    getVaultDb().prepare(`
      UPDATE credentials
      SET scope = ?, target_type = ?, target_hint = ?, name = ?, username = ?,
          encrypted_password = ?, enc_iv = ?, enc_auth_tag = ?, dek_key_id = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      record.scope,
      record.targetType,
      record.targetHint || '',
      record.name,
      record.username,
      record.encryptedPassword,
      record.encIv,
      record.encAuthTag,
      record.dekKeyId,
      id
    );

    return this.getById(id);
  },

  updateMetadata(id, record) {
    getVaultDb().prepare(`
      UPDATE credentials
      SET scope = ?, target_type = ?, target_hint = ?, name = ?, username = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      record.scope,
      record.targetType,
      record.targetHint || '',
      record.name,
      record.username,
      id
    );

    return this.getById(id);
  },

  markUsed(id, userId) {
    getVaultDb().prepare(`
      UPDATE credentials
      SET last_used_at = CURRENT_TIMESTAMP,
          last_used_by = ?
      WHERE id = ?
    `).run(userId || null, id);

    return this.getById(id);
  },

  delete(id) {
    getVaultDb().prepare('DELETE FROM credentials WHERE id = ?').run(id);
  },
};

module.exports = { getVaultDb, credentialModel };
