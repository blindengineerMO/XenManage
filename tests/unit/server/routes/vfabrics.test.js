const http = require('http');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const TEST_DB = path.join(__dirname, '..', '..', '..', 'data', 'vfabrics-routes.db');
const TEST_SECURITY_DB = path.join(__dirname, '..', '..', '..', 'data', 'vfabrics-security.db');

process.env.DB_PATH = TEST_DB;
process.env.SECURITY_DB_PATH = TEST_SECURITY_DB;

jest.mock('../../../../server/services/xenapi', () => {
  const actual = jest.requireActual('../../../../server/services/xenapi');
  actual.XenAPI.prototype.login = jest.fn(async function () {
    this.sessionRef = 'OpaqueRef:mock-session';
    return this.sessionRef;
  });
  actual.XenAPI.prototype.logout = jest.fn(async function () {
    this.sessionRef = null;
  });
  actual.XenAPI.prototype.rpc = jest.fn(async function () {
    return {};
  });
  return actual;
});

const { getDb } = require('../../../../server/models/connection');
const { getSecurityDb } = require('../../../../server/models/security-db');
const { XenAPI } = require('../../../../server/services/xenapi');
const app = require('../../../../server/index');

describe('vFabric Routes', () => {
  let server;
  let port;

  beforeAll((done) => {
    [TEST_DB, TEST_SECURITY_DB].forEach((file) => {
      if (fs.existsSync(file)) fs.unlinkSync(file);
    });

    server = app.listen(0, () => {
      port = server.address().port;
      done();
    });
  });

  beforeEach(() => {
    const database = getDb();
    database.prepare('DELETE FROM vfabric_members').run();
    database.prepare('DELETE FROM vfabrics').run();
    database.prepare('DELETE FROM host_targets').run();
    database.prepare('DELETE FROM connections').run();
    database.prepare(`DELETE FROM settings WHERE key = 'governance.vfabricQuotas'`).run();

    const securityDb = getSecurityDb();
    securityDb.prepare(`DELETE FROM users WHERE username != 'admin'`).run();
    securityDb.prepare(`UPDATE users SET password_hash = ?, role = 'admin', active = 1 WHERE username = 'admin'`).run(bcrypt.hashSync('admin123!', 10));
    securityDb.prepare(`INSERT INTO users (username, password_hash, display_name, role, active) VALUES ('operator-a', ?, 'Operator A', 'operator', 1)`).run(bcrypt.hashSync('password123!', 10));
    securityDb.prepare(`INSERT INTO users (username, password_hash, display_name, role, active) VALUES ('operator-b', ?, 'Operator B', 'operator', 1)`).run(bcrypt.hashSync('password123!', 10));

    database.prepare(`INSERT INTO connections (name, host, username, owner_user_id, visibility) VALUES ('Production Pool', '10.42.0.11', 'root', NULL, 'shared')`).run();
    database.prepare(`INSERT INTO host_targets (name, host, username, owner_user_id, visibility, mode) VALUES ('Edge Host', '10.43.0.22', 'root', NULL, 'shared', 'standalone')`).run();
  });

  afterAll((done) => {
    server.close(() => {
      [TEST_DB, TEST_SECURITY_DB].forEach((file) => {
        if (fs.existsSync(file)) fs.unlinkSync(file);
      });
      done();
    });
  });

  function request(method, pathName, body, cookie) {
    return new Promise((resolve, reject) => {
      const data = body ? JSON.stringify(body) : null;
      const options = { hostname: 'localhost', port, path: pathName, method, headers: { 'Content-Type': 'application/json' } };
      if (data) options.headers['Content-Length'] = Buffer.byteLength(data);
      if (cookie) options.headers.Cookie = cookie;
      const req = http.request(options, (res) => {
        let responseBody = '';
        res.on('data', (chunk) => responseBody += chunk);
        res.on('end', () => {
          const setCookie = res.headers['set-cookie'];
          const sessionCookie = setCookie?.find((entry) => entry.startsWith('xenmange.sid='))?.split(';')[0] || cookie;
          try {
            resolve({ status: res.statusCode, body: JSON.parse(responseBody), cookie: sessionCookie });
          } catch {
            resolve({ status: res.statusCode, body: responseBody, cookie: sessionCookie });
          }
        });
      });
      req.on('error', reject);
      if (data) req.write(data);
      req.end();
    });
  }

  function login(username, password = 'password123!') {
    return request('POST', '/api/auth/login', { username, password: username === 'admin' ? 'admin123!' : password });
  }

  it('requires a control-plane session', async () => {
    const response = await request('GET', '/api/vfabrics');
    expect(response.status).toBe(401);
    expect(response.body.error).toBe('NOT_AUTHENTICATED');
  });

  it('creates, lists, updates, and deletes a vFabric without changing registered targets', async () => {
    const auth = await login('admin');
    const database = getDb();
    const connection = database.prepare('SELECT id FROM connections').get();
    const hostTarget = database.prepare('SELECT id FROM host_targets').get();
    const created = await request('POST', '/api/vfabrics', {
      name: 'West Region Production',
      description: 'Operator grouping for production infrastructure.',
      colorTag: 'cyan',
      visibility: 'private',
      connectionIds: [connection.id],
      hostTargetIds: [hostTarget.id],
    }, auth.cookie);

    expect(created.status).toBe(201);
    expect(created.body).toEqual(expect.objectContaining({ name: 'West Region Production', color_tag: 'cyan', visibility: 'private', can_manage: true }));
    expect(created.body.members).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'pool', target_id: connection.id, name: 'Production Pool' }),
      expect.objectContaining({ kind: 'host', target_id: hostTarget.id, name: 'Edge Host' }),
    ]));

    const listed = await request('GET', '/api/vfabrics', null, auth.cookie);
    expect(listed.status).toBe(200);
    expect(listed.body).toEqual(expect.objectContaining({ total: 1 }));

    const updated = await request('PUT', `/api/vfabrics/${created.body.id}`, {
      name: 'West Region Tier One',
      description: 'Updated operator grouping.',
      colorTag: 'green',
      visibility: 'shared',
      connectionIds: [connection.id],
      hostTargetIds: [],
    }, auth.cookie);
    expect(updated.status).toBe(200);
    expect(updated.body).toEqual(expect.objectContaining({ name: 'West Region Tier One', visibility: 'shared' }));
    expect(updated.body.members).toHaveLength(1);

    const deleted = await request('DELETE', `/api/vfabrics/${created.body.id}`, null, auth.cookie);
    expect(deleted.status).toBe(200);
    expect(deleted.body.success).toBe(true);
    expect(database.prepare('SELECT COUNT(*) AS count FROM connections').get().count).toBe(1);
    expect(database.prepare('SELECT COUNT(*) AS count FROM host_targets').get().count).toBe(1);
  });

  it('enforces target visibility and vFabric ownership', async () => {
    const database = getDb();
    const securityDb = getSecurityDb();
    const owner = securityDb.prepare(`SELECT id FROM users WHERE username = 'operator-a'`).get();
    const privateConnection = database.prepare(`INSERT INTO connections (name, host, username, owner_user_id, visibility) VALUES ('Private Pool', '10.50.0.11', 'root', ?, 'private')`).run(owner.id);
    const operatorB = await login('operator-b');

    const forbiddenMember = await request('POST', '/api/vfabrics', {
      name: 'Unauthorized Scope', colorTag: 'green', visibility: 'private', connectionIds: [privateConnection.lastInsertRowid], hostTargetIds: [],
    }, operatorB.cookie);
    expect(forbiddenMember.status).toBe(403);
    expect(forbiddenMember.body.error).toBe('VFABRIC_MEMBER_FORBIDDEN');

    const operatorA = await login('operator-a');
    const ownFabric = await request('POST', '/api/vfabrics', {
      name: 'Private Scope', colorTag: 'green', visibility: 'private', connectionIds: [privateConnection.lastInsertRowid], hostTargetIds: [],
    }, operatorA.cookie);
    expect(ownFabric.status).toBe(201);

    const hidden = await request('GET', `/api/vfabrics/${ownFabric.body.id}`, null, operatorB.cookie);
    expect(hidden.status).toBe(404);
    const forbiddenUpdate = await request('PUT', `/api/vfabrics/${ownFabric.body.id}`, {
      name: 'Takeover', colorTag: 'red', visibility: 'private', connectionIds: [], hostTargetIds: [],
    }, operatorB.cookie);
    expect(forbiddenUpdate.status).toBe(403);
    expect(forbiddenUpdate.body.error).toBe('VFABRIC_FORBIDDEN');
  });

  it('removes membership when a registered target is deleted', async () => {
    const auth = await login('operator-a');
    const database = getDb();
    const connection = database.prepare('SELECT id FROM connections').get();
    const created = await request('POST', '/api/vfabrics', {
      name: 'Pool Membership', colorTag: 'green', visibility: 'private', connectionIds: [connection.id], hostTargetIds: [],
    }, auth.cookie);
    expect(created.status).toBe(201);

    database.prepare('DELETE FROM connections WHERE id = ?').run(connection.id);
    const loaded = await request('GET', `/api/vfabrics/${created.body.id}`, null, auth.cookie);
    expect(loaded.status).toBe(200);
    expect(loaded.body.members).toHaveLength(0);
  });

  it('resolves only attached visible members for a vFabric read scope', async () => {
    const auth = await login('admin');
    const database = getDb();
    const connection = database.prepare('SELECT id FROM connections').get();
    const hostTarget = database.prepare('SELECT id FROM host_targets').get();
    const created = await request('POST', '/api/vfabrics', {
      name: 'Attached Scope', colorTag: 'cyan', visibility: 'private', connectionIds: [connection.id], hostTargetIds: [hostTarget.id],
    }, auth.cookie);
    expect(created.status).toBe(201);

    const attached = await request('POST', '/api/auth/xen-login', {
      host: '10.42.0.11', username: 'root', password: 'password123!', connectionId: connection.id,
    }, auth.cookie);
    expect(attached.status).toBe(200);

    const scope = await request('GET', `/api/vfabrics/${created.body.id}/scope`, null, attached.cookie);
    expect(scope.status).toBe(200);
    expect(scope.body.scope).toEqual(expect.objectContaining({ id: created.body.id, memberCount: 2, attachedTargetCount: 1, unavailableMemberCount: 1 }));
    expect(scope.body.attachedTargets).toEqual([
      expect.objectContaining({ connectionId: connection.id, targetKey: `connection:${connection.id}`, kind: 'pool', connected: true }),
    ]);
    expect(scope.body.unavailableMembers).toEqual([
      expect.objectContaining({ targetId: hostTarget.id, kind: 'host', name: 'Edge Host' }),
    ]);
  });

  it('persists aggregate quotas and blocks a deployment that breaches the vFabric limit', async () => {
    const auth = await login('admin');
    const database = getDb();
    const connection = database.prepare('SELECT id FROM connections').get();
    const created = await request('POST', '/api/vfabrics', {
      name: 'Quota Protected Pool', colorTag: 'green', visibility: 'private', connectionIds: [connection.id], hostTargetIds: [],
    }, auth.cookie);
    expect(created.status).toBe(201);

    XenAPI.prototype.getHosts = jest.fn().mockResolvedValue({
      records: { 'OpaqueRef:host1': { pool: 'OpaqueRef:pool1', name_label: 'host-one' } },
    });
    XenAPI.prototype.getVMs = jest.fn().mockResolvedValue({
      records: {
        'OpaqueRef:vm1': {
          is_a_template: false,
          resident_on: 'OpaqueRef:host1',
          affinity: 'OpaqueRef:host1',
          power_state: 'Running',
          memory_static_max: 4294967296,
        },
      },
    });

    const attached = await request('POST', '/api/auth/xen-login', {
      host: '10.42.0.11', username: 'root', password: 'password123!', connectionId: connection.id,
    }, auth.cookie);
    expect(attached.status).toBe(200);

    const saved = await request('PUT', `/api/vfabrics/${created.body.id}/quota`, {
      enabled: true,
      owner: 'Platform Ops',
      maxVmCount: 1,
      maxRunningVmCount: 0,
      maxTotalMemoryGiB: 0,
      notes: 'Protect aggregate capacity.',
    }, attached.cookie);
    expect(saved.status).toBe(200);
    expect(saved.body).toEqual(expect.objectContaining({ vFabricId: created.body.id, maxVmCount: 1 }));

    const evaluation = await request('GET', `/api/vfabrics/${created.body.id}/quota`, null, attached.cookie);
    expect(evaluation.status).toBe(200);
    expect(evaluation.body).toEqual(expect.objectContaining({ coverageComplete: true, usage: expect.objectContaining({ vmCount: 1 }) }));

    const deploy = await request('POST', '/api/vms/templates/OpaqueRef%3Atemplate1/deploy', {
      nameLabel: 'blocked-vm',
      hostRef: 'OpaqueRef:host1',
      storageRef: 'OpaqueRef:sr1',
      networkRef: 'OpaqueRef:net1',
      vcpus: 2,
      memoryStaticMax: 4294967296,
      startAfter: true,
    }, attached.cookie);
    expect(deploy.status).toBe(409);
    expect(deploy.body.error).toBe('VFABRIC_QUOTA_EXCEEDED');
  });
});
