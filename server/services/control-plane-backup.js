const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Database = require('better-sqlite3');
const config = require('../config');
const { getDb } = require('../models/connection');
const { getSecurityDb } = require('../models/security-db');
const { getVaultDb } = require('../models/vault-db');
const { getPerfDb } = require('../models/perf-db');
const auditLogService = require('./audit-log');
const logger = require('./logger');

let schedulerTimer = null;

function snapshotId() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function sha256Buffer(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function deriveDevelopmentRecoveryKey() {
  return crypto.createHash('sha256')
    .update(`${config.session.secret}:xenmange-backup-recovery-dev-key`)
    .digest();
}

function parseRecoveryKey(base64Value) {
  const value = String(base64Value || '').trim();
  if (!value) return null;
  const buffer = Buffer.from(value, 'base64');
  if (buffer.length !== 32) {
    throw new Error('CONTROL_PLANE_BACKUP_RECOVERY_KEY_INVALID');
  }
  return buffer;
}

function getRecoveryKeys() {
  const current = parseRecoveryKey(config.backup.recoveryKey)
    || (config.env === 'production' ? null : deriveDevelopmentRecoveryKey());

  if (!current) {
    throw new Error('CONTROL_PLANE_BACKUP_RECOVERY_KEY_REQUIRED');
  }

  return {
    current,
    previous: parseRecoveryKey(config.backup.previousRecoveryKey),
  };
}

function encryptBuffer(plainBuffer, key) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plainBuffer), cipher.final()]);
  return { encrypted, iv, authTag: cipher.getAuthTag() };
}

function decryptBuffer(encrypted, iv, authTag, key) {
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}

// Snapshots are encrypted at rest with a recovery key kept deliberately separate from the
// vault's own encryption key (see server/config.js), so on-disk .db.enc files are useless
// without it even to someone with full filesystem access to the backup directory.
function decryptSnapshotFile(directory, name, manifest) {
  const encryption = manifest.encryption?.files?.[name];
  if (!encryption) {
    // Pre-encryption-era snapshot: the plaintext .db file is still on disk as-is.
    return fs.readFileSync(path.join(directory, name));
  }

  const encrypted = fs.readFileSync(path.join(directory, `${name}.enc`));
  const iv = Buffer.from(encryption.iv, 'base64');
  const authTag = Buffer.from(encryption.authTag, 'base64');
  const { current, previous } = getRecoveryKeys();
  try {
    return decryptBuffer(encrypted, iv, authTag, current);
  } catch (error) {
    if (previous) return decryptBuffer(encrypted, iv, authTag, previous);
    throw error;
  }
}

async function createSnapshot() {
  const id = snapshotId();
  const directory = path.join(config.db.backupPath, id);
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const databases = [
    ['xenmange.db', getDb()],
    ['security.db', getSecurityDb()],
    ['vault.db', getVaultDb()],
    ['perf.db', getPerfDb()],
  ];

  await Promise.all(databases.map(async ([name, database]) => {
    await database.backup(path.join(directory, name));
  }));

  const { current: recoveryKey } = getRecoveryKeys();
  const checksums = {};
  const encryptionFiles = {};
  databases.forEach(([name]) => {
    const plainPath = path.join(directory, name);
    const plainBuffer = fs.readFileSync(plainPath);
    checksums[name] = sha256Buffer(plainBuffer);

    const { encrypted, iv, authTag } = encryptBuffer(plainBuffer, recoveryKey);
    fs.writeFileSync(`${plainPath}.enc`, encrypted, { mode: 0o600 });
    fs.unlinkSync(plainPath);
    encryptionFiles[name] = { iv: iv.toString('base64'), authTag: authTag.toString('base64') };
  });

  const manifest = {
    id,
    createdAt: new Date().toISOString(),
    databases: databases.map(([name]) => name),
    checksums,
    encryption: { algorithm: 'aes-256-gcm', files: encryptionFiles },
  };
  fs.writeFileSync(path.join(directory, 'manifest.json'), JSON.stringify(manifest, null, 2), { mode: 0o600 });
  return manifest;
}

function listSnapshots() {
  if (!fs.existsSync(config.db.backupPath)) return [];
  return fs.readdirSync(config.db.backupPath, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      try {
        return JSON.parse(fs.readFileSync(path.join(config.db.backupPath, entry.name, 'manifest.json'), 'utf8'));
      } catch (_error) {
        return null;
      }
    })
    .filter(Boolean)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

function getSnapshotDirectory(id) {
  if (!/^[0-9A-Za-z-]+$/.test(String(id || ''))) return null;
  return path.join(config.db.backupPath, id);
}

// better-sqlite3 needs a real file on disk to run PRAGMA integrity_check against, so a
// decrypted snapshot is briefly materialized here (0600, deleted in `finally`) rather than
// checked purely in memory.
function withDecryptedTempFile(directory, name, manifest, fn) {
  const plainBuffer = decryptSnapshotFile(directory, name, manifest);
  const tempPath = path.join(directory, `.decrypted-${name}-${crypto.randomBytes(8).toString('hex')}`);
  fs.writeFileSync(tempPath, plainBuffer, { mode: 0o600 });
  try {
    return fn(tempPath, plainBuffer);
  } finally {
    fs.unlinkSync(tempPath);
  }
}

function verifySnapshot(id) {
  const directory = getSnapshotDirectory(id);
  const manifestPath = directory && path.join(directory, 'manifest.json');
  if (!directory || !fs.existsSync(manifestPath)) {
    const error = new Error('SNAPSHOT_NOT_FOUND');
    error.code = 'SNAPSHOT_NOT_FOUND';
    throw error;
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const databases = manifest.databases.map((name) => {
    const isEncrypted = Boolean(manifest.encryption?.files?.[name]);
    const onDiskPath = path.join(directory, isEncrypted ? `${name}.enc` : name);
    if (!fs.existsSync(onDiskPath)) {
      return { name, status: 'missing' };
    }

    let plainBuffer;
    try {
      plainBuffer = decryptSnapshotFile(directory, name, manifest);
    } catch (error) {
      const code = error.message === 'CONTROL_PLANE_BACKUP_RECOVERY_KEY_REQUIRED' ? 'recovery_key_unavailable' : 'decryption_failed';
      return { name, status: code, detail: error.message };
    }

    const expectedChecksum = manifest.checksums?.[name];
    const actualChecksum = sha256Buffer(plainBuffer);
    if (!expectedChecksum) {
      return { name, status: 'unverified_no_checksum', checksum: actualChecksum };
    }
    if (actualChecksum !== expectedChecksum) {
      return { name, status: 'checksum_mismatch', expectedChecksum, actualChecksum };
    }

    try {
      return withDecryptedTempFile(directory, name, manifest, (tempPath) => {
        const database = new Database(tempPath, { readonly: true, fileMustExist: true });
        const result = database.pragma('integrity_check', { simple: true });
        database.close();
        if (result !== 'ok') {
          return { name, status: 'integrity_check_failed', detail: result, checksum: actualChecksum };
        }
        return { name, status: 'ok', checksum: actualChecksum };
      });
    } catch (error) {
      return { name, status: 'open_failed', detail: error.message, checksum: actualChecksum };
    }
  });

  const overallStatus = databases.every((entry) => entry.status === 'ok') ? 'ok' : 'issues_found';
  return {
    id,
    checkedAt: new Date().toISOString(),
    overallStatus,
    databases,
  };
}

function liveDbPath(name) {
  return {
    'xenmange.db': config.db.path,
    'security.db': config.db.securityPath,
    'vault.db': config.db.vaultPath,
    'perf.db': config.db.perfPath,
  }[name];
}

function listTableNames(database) {
  return database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
    .all()
    .map((row) => row.name);
}

function tableRowCount(database, tableName) {
  return database.prepare(`SELECT COUNT(*) AS count FROM "${tableName}"`).get().count;
}

function previewDatabaseRestore(name, snapshotFilePath) {
  const currentPath = liveDbPath(name);
  if (!currentPath || !fs.existsSync(currentPath)) {
    return { name, status: 'live_database_missing' };
  }
  if (!fs.existsSync(snapshotFilePath)) {
    return { name, status: 'snapshot_file_missing' };
  }

  let current;
  let snapshot;
  try {
    current = new Database(currentPath, { readonly: true, fileMustExist: true });
    snapshot = new Database(snapshotFilePath, { readonly: true, fileMustExist: true });

    return comparePreviewDatabases(name, current, snapshot);
  } catch (error) {
    return { name, status: 'preview_failed', detail: error.message };
  } finally {
    if (current) current.close();
    if (snapshot) snapshot.close();
  }
}

function comparePreviewDatabases(name, current, snapshot) {
  const currentTables = new Set(listTableNames(current));
  const snapshotTables = new Set(listTableNames(snapshot));
  const tablesAddedSinceSnapshot = [...currentTables].filter((table) => !snapshotTables.has(table));
  const tablesRemovedSinceSnapshot = [...snapshotTables].filter((table) => !currentTables.has(table));

  const rowCountChanges = [...currentTables].filter((table) => snapshotTables.has(table))
    .map((table) => {
      const currentCount = tableRowCount(current, table);
      const snapshotCount = tableRowCount(snapshot, table);
      return { table, currentCount, snapshotCount, delta: currentCount - snapshotCount };
    })
    .filter((entry) => entry.delta !== 0);

  const wouldChange = tablesAddedSinceSnapshot.length > 0
    || tablesRemovedSinceSnapshot.length > 0
    || rowCountChanges.length > 0;

  return {
    name,
    status: wouldChange ? 'would_change' : 'no_changes_detected',
    tablesAddedSinceSnapshot,
    tablesRemovedSinceSnapshot,
    rowCountChanges,
  };
}

function restorePreview(id) {
  const directory = getSnapshotDirectory(id);
  const manifestPath = directory && path.join(directory, 'manifest.json');
  if (!directory || !fs.existsSync(manifestPath)) {
    const error = new Error('SNAPSHOT_NOT_FOUND');
    error.code = 'SNAPSHOT_NOT_FOUND';
    throw error;
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const databases = manifest.databases.map((name) => {
    const isEncrypted = Boolean(manifest.encryption?.files?.[name]);
    const onDiskPath = path.join(directory, isEncrypted ? `${name}.enc` : name);
    if (!fs.existsSync(onDiskPath)) {
      return { name, status: 'snapshot_file_missing' };
    }
    if (!isEncrypted) {
      return previewDatabaseRestore(name, onDiskPath);
    }

    try {
      return withDecryptedTempFile(directory, name, manifest, (tempPath) => previewDatabaseRestore(name, tempPath));
    } catch (error) {
      const status = error.message === 'CONTROL_PLANE_BACKUP_RECOVERY_KEY_REQUIRED' ? 'recovery_key_unavailable' : 'decryption_failed';
      return { name, status, detail: error.message };
    }
  });

  return {
    id,
    generatedAt: new Date().toISOString(),
    note: 'Read-only comparison against the currently live databases. No data was modified; restoring is not yet implemented.',
    databases,
  };
}

async function runScheduledSnapshot() {
  const snapshot = await createSnapshot();
  auditLogService.record({
    category: 'control-plane', action: 'control_plane_backup_created', actionLabel: 'Created control-plane backup',
    entityType: 'control-plane-backup', entityRef: snapshot.id, entityName: snapshot.id,
    operator: 'system', route: '/settings', status: 'success', before: null, after: snapshot,
    detail: 'Automatically created a scheduled SQLite-consistent snapshot of xenmange.db, security.db, vault.db, and perf.db.',
  });
  return snapshot;
}

function startScheduler() {
  stopScheduler();

  const systemConfigService = require('./system-config');
  const { enabled, intervalHours } = systemConfigService.getSection('controlPlaneBackup');
  if (!enabled) return;

  const intervalMs = Math.max(1, Number(intervalHours || 24)) * 3600000;
  schedulerTimer = setInterval(() => {
    runScheduledSnapshot().catch((error) => {
      logger.error('control_plane_backup_scheduled_snapshot_failed', { error });
    });
  }, intervalMs);

  if (typeof schedulerTimer.unref === 'function') {
    schedulerTimer.unref();
  }
}

function stopScheduler() {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
  }
}

function refreshScheduler() {
  startScheduler();
}

module.exports = {
  createSnapshot, listSnapshots, verifySnapshot, restorePreview,
  startScheduler, stopScheduler, refreshScheduler, runScheduledSnapshot,
};
