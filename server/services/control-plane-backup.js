const fs = require('fs');
const path = require('path');
const config = require('../config');
const { getDb } = require('../models/connection');
const { getSecurityDb } = require('../models/security-db');
const { getVaultDb } = require('../models/vault-db');
const { getPerfDb } = require('../models/perf-db');

function snapshotId() {
  return new Date().toISOString().replace(/[:.]/g, '-');
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

  const manifest = {
    id,
    createdAt: new Date().toISOString(),
    databases: databases.map(([name]) => name),
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

module.exports = { createSnapshot, listSnapshots };
