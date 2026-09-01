const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '..', '..', '..', 'data');
const TEST_DB = path.join(DATA_DIR, 'managed-targets.db');
const TEST_SECURITY_DB = path.join(DATA_DIR, 'managed-targets-security.db');
const TEST_VAULT_DB = path.join(DATA_DIR, 'managed-targets-vault.db');

process.env.DB_PATH = TEST_DB;
process.env.SECURITY_DB_PATH = TEST_SECURITY_DB;
process.env.VAULT_DB_PATH = TEST_VAULT_DB;

const { connectionModel, getDb } = require('../../../server/models/connection');
const credentialVaultService = require('../../../server/services/credential-vault');
const managedTargetService = require('../../../server/services/managed-targets');

describe('managed target service', () => {
  beforeAll(() => {
    [TEST_DB, TEST_SECURITY_DB, TEST_VAULT_DB].forEach((file) => {
      if (fs.existsSync(file)) fs.unlinkSync(file);
    });
    getDb();
  });

  beforeEach(() => {
    managedTargetService.__resetForTests();
    getDb().prepare('DELETE FROM managed_targets').run();
    getDb().prepare('DELETE FROM connections').run();
  });

  afterAll(() => {
    managedTargetService.__resetForTests();
    [TEST_DB, TEST_SECURITY_DB, TEST_VAULT_DB].forEach((file) => {
      if (fs.existsSync(file)) fs.unlinkSync(file);
    });
  });

  it('maintains a shared vault-backed XenAPI session without an application session', async () => {
    const credential = credentialVaultService.create(1, {
      name: 'shared pool credential',
      scope: 'shared',
      targetType: 'pool',
      targetHint: 'pool-a',
      username: 'root',
      password: 'secret',
    });
    const connection = connectionModel.create({
      name: 'Pool A', host: '10.20.30.40', username: 'root', vaultCredentialId: credential.id,
      port: 443, visibility: 'shared', ownerUserId: null,
    });
    const instances = [];
    managedTargetService.__setXenApiFactory(class FakeXenApi {
      constructor(host) { this.host = host; instances.push(this); }
      async login(username, password) { this.username = username; this.password = password; this.sessionRef = 'OpaqueRef:managed'; }
      async call() { return []; }
      async logout() { this.sessionRef = null; }
    });

    const registered = managedTargetService.register(connection.id);
    const checked = await managedTargetService.check(registered.id);

    expect(checked).toEqual(expect.objectContaining({ state: 'Healthy', enabled: true, connectionId: connection.id }));
    expect(instances[0]).toEqual(expect.objectContaining({ host: '10.20.30.40', username: 'root', password: 'secret' }));
    expect(managedTargetService.getApi(registered.id).sessionRef).toBe('OpaqueRef:managed');
    expect(managedTargetService.listLiveTargets()).toEqual([
      expect.objectContaining({ targetKey: `managed:${registered.id}`, host: '10.20.30.40' }),
    ]);
  });

  it('does not accept a private connection as a control-plane managed target', async () => {
    const connection = connectionModel.create({
      name: 'Private pool', host: '10.20.30.41', username: 'root', visibility: 'private', ownerUserId: 1,
    });
    const target = managedTargetService.register(connection.id);
    const checked = await managedTargetService.check(target.id);

    expect(checked).toEqual(expect.objectContaining({
      state: 'Maintenance',
      lastError: 'MANAGED_TARGET_REQUIRES_SHARED_CONNECTION',
    }));
  });
});
