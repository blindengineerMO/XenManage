const { connectionModel, settingsModel, getDb } = require('../../../../server/models/connection');
const path = require('path');
const fs = require('fs');

const TEST_DB = path.join(__dirname, '..', '..', '..', 'data', 'test.db');

// Override DB path for tests
process.env.DB_PATH = TEST_DB;

describe('Connection Model', () => {
  beforeAll(() => {
    // Clean up
    if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
  });

  afterAll(() => {
    if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
  });

  describe('create', () => {
    it('should create a new connection', () => {
      const conn = connectionModel.create({
        name: 'Test Pool',
        host: '192.168.1.100',
        username: 'root',
        port: 443,
        isDefault: true,
      });
      expect(conn).toBeDefined();
      expect(conn.id).toBeDefined();
      expect(conn.name).toBe('Test Pool');
      expect(conn.host).toBe('192.168.1.100');
      expect(conn.is_default).toBe(1);
    });

    it('should create a second connection', () => {
      const conn = connectionModel.create({
        name: 'Dev Pool',
        host: '192.168.1.200',
        username: 'admin',
      });
      expect(conn).toBeDefined();
      expect(conn.name).toBe('Dev Pool');
    });
  });

  describe('getAll', () => {
    it('should return all connections', () => {
      const conns = connectionModel.getAll();
      expect(conns.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('getById', () => {
    it('should return a connection by id', () => {
      const all = connectionModel.getAll();
      const conn = connectionModel.getById(all[0].id);
      expect(conn).toBeDefined();
      expect(conn.name).toBeDefined();
    });
  });

  describe('update', () => {
    it('should update a connection', () => {
      const all = connectionModel.getAll();
      const updated = connectionModel.update(all[0].id, {
        name: 'Updated Pool',
        host: '10.0.0.1',
        username: 'root',
        port: 443,
        isDefault: false,
      });
      expect(updated.name).toBe('Updated Pool');
      expect(updated.host).toBe('10.0.0.1');
    });
  });

  describe('dedupe and defaults', () => {
    it('should reuse an existing connection fingerprint instead of creating duplicates', () => {
      const before = connectionModel.getAll().length;
      const conn = connectionModel.create({
        name: 'Duplicate Fingerprint',
        host: '10.0.0.1',
        username: 'root',
        port: 443,
      });
      const after = connectionModel.getAll().length;
      expect(after).toBe(before);
      expect(conn.name).toBe('Duplicate Fingerprint');
    });

    it('should set a connection as default', () => {
      const all = connectionModel.getAll();
      const updated = connectionModel.setDefault(all[0].id);
      expect(updated.is_default).toBe(1);
    });
  });

  describe('delete', () => {
    it('should delete a connection', () => {
      const before = connectionModel.getAll().length;
      const all = connectionModel.getAll();
      connectionModel.delete(all[0].id);
      const after = connectionModel.getAll().length;
      expect(after).toBe(before - 1);
    });
  });
});

describe('Settings Model', () => {
  afterAll(() => {
    if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
  });

  it('should set and get a setting', () => {
    settingsModel.set('theme', 'dark');
    expect(settingsModel.get('theme')).toBe('dark');
  });

  it('should return null for missing keys', () => {
    expect(settingsModel.get('nonexistent')).toBeNull();
  });

  it('should overwrite existing settings', () => {
    settingsModel.set('theme', 'matrix');
    expect(settingsModel.get('theme')).toBe('matrix');
  });

  it('should return all settings', () => {
    settingsModel.set('key1', 'val1');
    settingsModel.set('key2', 'val2');
    const all = settingsModel.getAll();
    expect(all.key1).toBe('val1');
    expect(all.key2).toBe('val2');
  });
});
