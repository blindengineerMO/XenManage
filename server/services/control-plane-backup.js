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

function sha256File(filePath) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
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

  const checksums = {};
  databases.forEach(([name]) => {
    checksums[name] = sha256File(path.join(directory, name));
  });

  const manifest = {
    id,
    createdAt: new Date().toISOString(),
    databases: databases.map(([name]) => name),
    checksums,
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
    const filePath = path.join(directory, name);
    if (!fs.existsSync(filePath)) {
      return { name, status: 'missing' };
    }

    const expectedChecksum = manifest.checksums?.[name];
    const actualChecksum = sha256File(filePath);
    if (!expectedChecksum) {
      return { name, status: 'unverified_no_checksum', checksum: actualChecksum };
    }
    if (actualChecksum !== expectedChecksum) {
      return { name, status: 'checksum_mismatch', expectedChecksum, actualChecksum };
    }

    try {
      const database = new Database(filePath, { readonly: true, fileMustExist: true });
      const result = database.pragma('integrity_check', { simple: true });
      database.close();
      if (result !== 'ok') {
        return { name, status: 'integrity_check_failed', detail: result, checksum: actualChecksum };
      }
      return { name, status: 'ok', checksum: actualChecksum };
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
  } catch (error) {
    return { name, status: 'preview_failed', detail: error.message };
  } finally {
    if (current) current.close();
    if (snapshot) snapshot.close();
  }
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
  const databases = manifest.databases.map((name) => previewDatabaseRestore(name, path.join(directory, name)));

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
