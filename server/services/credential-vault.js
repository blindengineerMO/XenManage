const crypto = require('crypto');
const config = require('../config');
const { getSecurityDb } = require('../models/security-db');
const { credentialModel } = require('../models/vault-db');

function deriveDevelopmentKey() {
  return crypto.createHash('sha256')
    .update(`${config.session.secret}:xenmange-vault-dev-key`)
    .digest();
}

function parseMasterKey(base64Value) {
  const value = String(base64Value || '').trim();
  if (!value) return null;
  const buffer = Buffer.from(value, 'base64');
  if (buffer.length !== 32) {
    throw new Error('VAULT_ENCRYPTION_KEY_INVALID');
  }
  return buffer;
}

function getMasterKeys() {
  const current = parseMasterKey(config.vault.encryptionKey)
    || (config.env === 'production' ? null : deriveDevelopmentKey());

  if (!current) {
    throw new Error('VAULT_ENCRYPTION_KEY_REQUIRED');
  }

  return {
    current,
    previous: parseMasterKey(config.vault.previousEncryptionKey),
  };
}

function encryptBuffer(plainBuffer, key) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plainBuffer), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return { encrypted, iv, authTag };
}

function decryptBuffer(encrypted, iv, authTag, key) {
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}

function createWrappedDek(dek) {
  const { current } = getMasterKeys();
  const wrapped = encryptBuffer(dek, current);
  const result = getSecurityDb().prepare(`
    INSERT INTO vault_key_material (wrapped_dek, wrap_iv, wrap_auth_tag, key_version)
    VALUES (?, ?, ?, 1)
  `).run(wrapped.encrypted, wrapped.iv, wrapped.authTag);

  return {
    id: result.lastInsertRowid,
  };
}

function deleteWrappedDek(id) {
  getSecurityDb().prepare('DELETE FROM vault_key_material WHERE id = ?').run(id);
}

function toPublicRecord(record) {
  if (!record) return null;
  return {
    id: record.id,
    ownerUserId: record.owner_user_id,
    scope: record.scope,
    targetType: record.target_type,
    targetHint: record.target_hint || '',
    name: record.name,
    username: record.username,
    createdAt: record.created_at || '',
    updatedAt: record.updated_at || '',
    lastUsedAt: record.last_used_at || '',
    lastUsedBy: record.last_used_by || null,
  };
}

function ensureVisible(record, userId) {
  return Boolean(record && (record.owner_user_id === userId || record.scope === 'shared'));
}

function ensureMutable(record, userId, role = 'operator') {
  return Boolean(record && (record.owner_user_id === userId || role === 'admin'));
}

const credentialVaultService = {
  listVisible(userId) {
    return credentialModel.listVisible(userId).map(toPublicRecord);
  },

  create(userId, payload) {
    const dek = crypto.randomBytes(32);
    const wrappedDek = createWrappedDek(dek);

    try {
      const passwordCipher = encryptBuffer(Buffer.from(String(payload.password || ''), 'utf8'), dek);
      const record = credentialModel.create({
        ownerUserId: userId,
        scope: payload.scope,
        targetType: payload.targetType,
        targetHint: payload.targetHint,
        name: payload.name,
        username: payload.username,
        encryptedPassword: passwordCipher.encrypted,
        encIv: passwordCipher.iv,
        encAuthTag: passwordCipher.authTag,
        dekKeyId: wrappedDek.id,
      });

      return toPublicRecord(record);
    } catch (error) {
      deleteWrappedDek(wrappedDek.id);
      throw error;
    }
  },

  update(id, userId, role, payload) {
    const existing = credentialModel.getById(id);
    if (!ensureVisible(existing, userId)) {
      const notFound = new Error('CREDENTIAL_NOT_FOUND');
      notFound.code = 'CREDENTIAL_NOT_FOUND';
      throw notFound;
    }
    if (!ensureMutable(existing, userId, role)) {
      const forbidden = new Error('CREDENTIAL_FORBIDDEN');
      forbidden.code = 'CREDENTIAL_FORBIDDEN';
      throw forbidden;
    }

    const baseRecord = {
      scope: payload.scope,
      targetType: payload.targetType,
      targetHint: payload.targetHint,
      name: payload.name,
      username: payload.username,
    };

    if (!payload.password) {
      return toPublicRecord(credentialModel.updateMetadata(id, baseRecord));
    }

    const dek = crypto.randomBytes(32);
    const wrappedDek = createWrappedDek(dek);

    try {
      const passwordCipher = encryptBuffer(Buffer.from(String(payload.password), 'utf8'), dek);
      const updated = credentialModel.update(id, {
        ...baseRecord,
        encryptedPassword: passwordCipher.encrypted,
        encIv: passwordCipher.iv,
        encAuthTag: passwordCipher.authTag,
        dekKeyId: wrappedDek.id,
      });
      deleteWrappedDek(existing.dek_key_id);
      return toPublicRecord(updated);
    } catch (error) {
      deleteWrappedDek(wrappedDek.id);
      throw error;
    }
  },

  delete(id, userId, role) {
    const existing = credentialModel.getById(id);
    if (!ensureVisible(existing, userId)) {
      const notFound = new Error('CREDENTIAL_NOT_FOUND');
      notFound.code = 'CREDENTIAL_NOT_FOUND';
      throw notFound;
    }
    if (!ensureMutable(existing, userId, role)) {
      const forbidden = new Error('CREDENTIAL_FORBIDDEN');
      forbidden.code = 'CREDENTIAL_FORBIDDEN';
      throw forbidden;
    }

    credentialModel.delete(id);
    deleteWrappedDek(existing.dek_key_id);
    return { success: true };
  },

  getPassword(id, userId, role = 'operator') {
    const existing = credentialModel.getById(id);
    if (!ensureVisible(existing, userId)) {
      const notFound = new Error('CREDENTIAL_NOT_FOUND');
      notFound.code = 'CREDENTIAL_NOT_FOUND';
      throw notFound;
    }
    if (!ensureMutable(existing, userId, role) && existing.scope !== 'shared') {
      const forbidden = new Error('CREDENTIAL_FORBIDDEN');
      forbidden.code = 'CREDENTIAL_FORBIDDEN';
      throw forbidden;
    }

    const wrapped = getSecurityDb().prepare(`
      SELECT wrapped_dek, wrap_iv, wrap_auth_tag
      FROM vault_key_material
      WHERE id = ?
    `).get(existing.dek_key_id);

    if (!wrapped) {
      throw new Error('VAULT_KEY_NOT_FOUND');
    }

    const { current, previous } = getMasterKeys();
    let dek;
    try {
      dek = decryptBuffer(wrapped.wrapped_dek, wrapped.wrap_iv, wrapped.wrap_auth_tag, current);
    } catch (error) {
      if (!previous) throw error;
      dek = decryptBuffer(wrapped.wrapped_dek, wrapped.wrap_iv, wrapped.wrap_auth_tag, previous);
    }

    return decryptBuffer(existing.encrypted_password, existing.enc_iv, existing.enc_auth_tag, dek).toString('utf8');
  },
};

module.exports = credentialVaultService;
