const Database = require('better-sqlite3');
const {
  listAppliedMigrations,
  rollbackLastMigration,
  runMigrations,
} = require('../../../server/migrations/runner');

describe('schema migration runner', () => {
  let db;

  beforeEach(() => {
    db = new Database(':memory:');
  });

  afterEach(() => db.close());

  it('applies ordered migrations once and records an audit ledger', () => {
    const migrations = [
      { version: 2, name: 'add-name', up: database => database.exec('ALTER TABLE widgets ADD COLUMN name TEXT') },
      { version: 1, name: 'create-widgets', up: database => database.exec('CREATE TABLE widgets (id INTEGER PRIMARY KEY)') },
    ];

    expect(runMigrations(db, migrations).map(({ version, name }) => ({ version, name }))).toEqual([
      { version: 1, name: 'create-widgets' },
      { version: 2, name: 'add-name' },
    ]);
    expect(() => runMigrations(db, migrations)).not.toThrow();
    expect(db.prepare('PRAGMA table_info(widgets)').all().map(column => column.name)).toEqual(['id', 'name']);
  });

  it('rolls back the latest reversible migration transactionally', () => {
    const migrations = [{
      version: 1,
      name: 'create-widgets',
      up: database => database.exec('CREATE TABLE widgets (id INTEGER PRIMARY KEY)'),
      down: database => database.exec('DROP TABLE widgets'),
    }];
    runMigrations(db, migrations);

    expect(rollbackLastMigration(db, migrations)).toEqual(expect.objectContaining({ version: 1 }));
    expect(listAppliedMigrations(db)).toEqual([]);
    expect(db.prepare("SELECT name FROM sqlite_master WHERE name = 'widgets'").get()).toBeUndefined();
  });

  it('rejects edits to an already-applied migration', () => {
    runMigrations(db, [{ version: 1, name: 'baseline', up: database => database.exec('CREATE TABLE widgets (id INTEGER)') }]);

    expect(() => runMigrations(db, [{
      version: 1,
      name: 'baseline',
      up: database => database.exec('CREATE TABLE changed (id INTEGER)'),
    }])).toThrow('Applied migration 1 has changed');
  });

  it('adopts a pre-ledger baseline checksum once using an explicit stable source', () => {
    const original = [{ version: 1, name: 'baseline', up: () => {} }];
    runMigrations(db, original);

    const adopted = [{
      version: 1,
      name: 'baseline',
      checksum: 'stable-baseline-v1',
      adoptLegacySchema: true,
      up: () => {},
    }];
    expect(() => runMigrations(db, adopted)).not.toThrow();
    expect(listAppliedMigrations(db)[0].checksum).toHaveLength(64);
  });

  it('rolls back a failed migration without recording it', () => {
    expect(() => runMigrations(db, [{
      version: 1,
      name: 'broken',
      up(database) {
        database.exec('CREATE TABLE widgets (id INTEGER)');
        throw new Error('stop');
      },
    }])).toThrow('stop');

    expect(listAppliedMigrations(db)).toEqual([]);
    expect(db.prepare("SELECT name FROM sqlite_master WHERE name = 'widgets'").get()).toBeUndefined();
  });
});
