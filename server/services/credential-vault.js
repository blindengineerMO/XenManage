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

function getWrappedDekRecord(id) {
  return getSecurityDb().prepare(`
    SELECT id, wrapped_dek, wrap_iv, wrap_auth_tag, key_version, created_at
    FROM vault_key_material
    WHERE id = ?
  `).get(id) || null;
}

function updateWrappedDek(id, payload = {}) {
  getSecurityDb().prepare(`
    UPDATE vault_key_material
    SET wrapped_dek = ?,
        wrap_iv = ?,
        wrap_auth_tag = ?,
        key_version = COALESCE(key_version, 0) + 1
    WHERE id = ?
  `).run(payload.encrypted, payload.iv, payload.authTag, id);

  return getWrappedDekRecord(id);
}

function listScopedCredentials(userId = null) {
  if (userId) return credentialModel.listVisible(userId);
  return credentialModel.listAll();
}

function canManageRecord(record, userId = null, role = 'operator') {
  if (!record) return false;
  if (!userId) return role === 'admin';
  return ensureMutable(record, userId, role);
}

function unwrapDekRecord(wrapped, keys) {
  try {
    return {
      dek: decryptBuffer(wrapped.wrapped_dek, wrapped.wrap_iv, wrapped.wrap_auth_tag, keys.current),
      source: 'current',
    };
  } catch (error) {
    if (!keys.previous) throw error;
    return {
      dek: decryptBuffer(wrapped.wrapped_dek, wrapped.wrap_iv, wrapped.wrap_auth_tag, keys.previous),
      source: 'previous',
    };
  }
}

function inspectRewrapCandidates(records = []) {
  const summary = {
    totalCredentialCount: records.length,
    staleCredentialCount: 0,
    rewrapAvailable: false,
    scanAvailable: false,
    scanError: '',
  };

  if (!records.length) {
    summary.scanAvailable = true;
    return summary;
  }

  let keys;
  try {
    keys = getMasterKeys();
  } catch (error) {
    summary.scanError = error.message || 'VAULT_KEY_SCAN_FAILED';
    return summary;
  }

  summary.rewrapAvailable = Boolean(keys.previous);
  summary.scanAvailable = true;

  records.forEach((record) => {
    const wrapped = getWrappedDekRecord(record.dek_key_id);
    if (!wrapped) {
      summary.scanError = summary.scanError || 'VAULT_KEY_NOT_FOUND';
      return;
    }

    try {
      const unwrap = unwrapDekRecord(wrapped, keys);
      if (unwrap.source === 'previous') {
        summary.staleCredentialCount += 1;
      }
    } catch (error) {
      summary.scanError = summary.scanError || (error.message || 'VAULT_KEY_SCAN_FAILED');
    }
  });

  return summary;
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
  sealSecret(value) {
    const dek = crypto.randomBytes(32);
    const wrappedDek = createWrappedDek(dek);
    try {
      const cipher = encryptBuffer(Buffer.from(String(value || ''), 'utf8'), dek);
      return JSON.stringify({ version: 1, dekKeyId: Number(wrappedDek.id), encrypted: cipher.encrypted.toString('base64'), iv: cipher.iv.toString('base64'), authTag: cipher.authTag.toString('base64') });
    } catch (error) {
      deleteWrappedDek(wrappedDek.id);
      throw error;
    }
  },

  openSealedSecret(payload) {
    const sealed = typeof payload === 'string' ? JSON.parse(payload) : payload;
    if (!sealed?.dekKeyId) throw new Error('VAULT_KEY_NOT_FOUND');
    const wrapped = getWrappedDekRecord(sealed.dekKeyId);
    if (!wrapped) throw new Error('VAULT_KEY_NOT_FOUND');
    const unwrap = unwrapDekRecord(wrapped, getMasterKeys());
    return decryptBuffer(Buffer.from(sealed.encrypted, 'base64'), Buffer.from(sealed.iv, 'base64'), Buffer.from(sealed.authTag, 'base64'), unwrap.dek).toString('utf8');
  },

  deleteSealedSecret(payload) {
    try {
      const sealed = typeof payload === 'string' ? JSON.parse(payload) : payload;
      if (sealed?.dekKeyId) deleteWrappedDek(sealed.dekKeyId);
    } catch (_error) { /* Legacy secrets have no wrapped key material. */ }
  },

  listVisible(userId) {
    return credentialModel.listVisible(userId).map(toPublicRecord);
  },

  getRuntimeStatus() {
    const configuredCurrentKey = Boolean(String(config.vault.encryptionKey || '').trim());
    const configuredPreviousKey = Boolean(String(config.vault.previousEncryptionKey || '').trim());
    const rotationSummary = inspectRewrapCandidates(credentialModel.listAll());

    return {
      hasConfiguredMasterKey: configuredCurrentKey,
      usingDevelopmentFallback: !configuredCurrentKey && config.env !== 'production',
      hasPreviousMasterKey: configuredPreviousKey,
      rotationRecommended: configuredCurrentKey && !configuredPreviousKey,
      keySource: configuredCurrentKey ? 'environment' : (config.env === 'production' ? 'missing' : 'derived-development'),
      vaultDatabasePath: config.db.vaultPath,
      totalCredentialCount: rotationSummary.totalCredentialCount,
      staleCredentialCount: rotationSummary.staleCredentialCount,
      rewrapAvailable: rotationSummary.rewrapAvailable,
      scanAvailable: rotationSummary.scanAvailable,
      scanError: rotationSummary.scanError,
    };
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

    const wrapped = getWrappedDekRecord(existing.dek_key_id);

    if (!wrapped) {
      throw new Error('VAULT_KEY_NOT_FOUND');
    }

    const unwrap = unwrapDekRecord(wrapped, getMasterKeys());

    const password = decryptBuffer(existing.encrypted_password, existing.enc_iv, existing.enc_auth_tag, unwrap.dek).toString('utf8');
    credentialModel.markUsed(id, userId);
    return password;
  },

  getSharedIntegrationSecret(id, targetType) {
    const existing = credentialModel.getById(id);
    if (!existing || existing.scope !== 'shared' || existing.target_type !== targetType) {
      const error = new Error('INTEGRATION_CREDENTIAL_INVALID');
      error.code = 'INTEGRATION_CREDENTIAL_INVALID';
      throw error;
    }
    return this.getPassword(id, null, 'admin');
  },

  validateSharedIntegrationCredential(id, targetType) {
    const existing = credentialModel.getById(id);
    return Boolean(existing && existing.scope === 'shared' && existing.target_type === targetType);
  },

  rewrapAll(userId = null, role = 'operator') {
    const records = listScopedCredentials(userId)
      .filter((record) => canManageRecord(record, userId, role));

    let keys;
    try {
      keys = getMasterKeys();
    } catch (error) {
      const wrappedError = new Error(error.message || 'VAULT_KEY_SCAN_FAILED');
      wrappedError.code = error.message || 'VAULT_KEY_SCAN_FAILED';
      throw wrappedError;
    }

    if (!keys.previous) {
      const error = new Error('VAULT_PREVIOUS_KEY_NOT_CONFIGURED');
      error.code = 'VAULT_PREVIOUS_KEY_NOT_CONFIGURED';
      throw error;
    }

    const result = {
      scanned: records.length,
      rewrapped: 0,
      alreadyCurrent: 0,
      failed: 0,
      staleRemaining: 0,
      rewrapAvailable: true,
      scanError: '',
    };

    records.forEach((record) => {
      const wrapped = getWrappedDekRecord(record.dek_key_id);
      if (!wrapped) {
        result.failed += 1;
        result.scanError = result.scanError || 'VAULT_KEY_NOT_FOUND';
        return;
      }

      try {
        const unwrap = unwrapDekRecord(wrapped, keys);
        if (unwrap.source === 'current') {
          result.alreadyCurrent += 1;
          return;
        }

        const nextWrapped = encryptBuffer(unwrap.dek, keys.current);
        updateWrappedDek(record.dek_key_id, nextWrapped);
        result.rewrapped += 1;
      } catch (error) {
        result.failed += 1;
        result.scanError = result.scanError || (error.message || 'VAULT_REWRAP_FAILED');
      }
    });

    result.staleRemaining = inspectRewrapCandidates(records).staleCredentialCount;
    return result;
  },
};

module.exports = credentialVaultService;
