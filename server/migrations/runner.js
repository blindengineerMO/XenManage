const crypto = require('crypto');

const MIGRATION_TABLE = '_schema_migrations';

function migrationChecksum(migration) {
  return crypto.createHash('sha256').update(String(migration.checksum || migration.up)).digest('hex');
}

function validateMigrations(migrations) {
  const versions = new Set();
  return [...migrations].sort((left, right) => left.version - right.version).map((migration) => {
    if (!Number.isInteger(migration.version) || migration.version < 1) {
      throw new Error('Migration versions must be positive integers');
    }
    if (versions.has(migration.version)) {
      throw new Error(`Duplicate migration version: ${migration.version}`);
    }
    if (!migration.name || typeof migration.up !== 'function') {
      throw new Error(`Migration ${migration.version} requires a name and up function`);
    }
    versions.add(migration.version);
    return migration;
  });
}

function ensureMigrationTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS ${MIGRATION_TABLE} (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      checksum TEXT NOT NULL,
      applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

function listAppliedMigrations(db) {
  ensureMigrationTable(db);
  return db.prepare(`SELECT version, name, checksum, applied_at FROM ${MIGRATION_TABLE} ORDER BY version`).all();
}

function runMigrations(db, migrations) {
  const ordered = validateMigrations(migrations);
  const applied = new Map(listAppliedMigrations(db).map((migration) => [migration.version, migration]));
  const knownVersions = new Set(ordered.map((migration) => migration.version));
  const unknown = [...applied.keys()].find((version) => !knownVersions.has(version));
  if (unknown) throw new Error(`Database contains unknown migration version: ${unknown}`);

  for (const migration of ordered) {
    const checksum = migrationChecksum(migration);
    const previous = applied.get(migration.version);
    if (previous) {
      if (previous.name !== migration.name || previous.checksum !== checksum) {
        if (previous.name === migration.name && migration.adoptLegacySchema) {
          db.prepare(`UPDATE ${MIGRATION_TABLE} SET checksum = ? WHERE version = ?`)
            .run(checksum, migration.version);
          continue;
        }
        throw new Error(`Applied migration ${migration.version} has changed`);
      }
      continue;
    }

    db.transaction(() => {
      migration.up(db);
      db.prepare(`INSERT INTO ${MIGRATION_TABLE} (version, name, checksum) VALUES (?, ?, ?)`)
        .run(migration.version, migration.name, checksum);
    })();
  }

  return listAppliedMigrations(db);
}

function rollbackLastMigration(db, migrations) {
  const ordered = validateMigrations(migrations);
  const applied = listAppliedMigrations(db);
  const last = applied.at(-1);
  if (!last) return null;

  const migration = ordered.find((candidate) => candidate.version === last.version);
  if (!migration || typeof migration.down !== 'function') {
    throw new Error(`Migration ${last.version} is not reversible`);
  }

  db.transaction(() => {
    migration.down(db);
    db.prepare(`DELETE FROM ${MIGRATION_TABLE} WHERE version = ?`).run(last.version);
  })();
  return last;
}

module.exports = {
  MIGRATION_TABLE,
  listAppliedMigrations,
  migrationChecksum,
  rollbackLastMigration,
  runMigrations,
  validateMigrations,
};
