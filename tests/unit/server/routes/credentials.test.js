const http = require('http');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const TEST_DB = path.join(__dirname, '..', '..', '..', 'data', 'credentials-routes.db');
const TEST_SECURITY_DB = path.join(__dirname, '..', '..', '..', 'data', 'credentials-security.db');
const TEST_VAULT_DB = path.join(__dirname, '..', '..', '..', 'data', 'credentials-vault.db');

process.env.DB_PATH = TEST_DB;
process.env.SECURITY_DB_PATH = TEST_SECURITY_DB;
process.env.VAULT_DB_PATH = TEST_VAULT_DB;

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

const { getSecurityDb } = require('../../../../server/models/security-db');
const app = require('../../../../server/index');

describe('Credential Vault Routes', () => {
  let server;
  let port;

  beforeAll((done) => {
    [TEST_DB, TEST_SECURITY_DB, TEST_VAULT_DB].forEach((file) => {
      if (fs.existsSync(file)) fs.unlinkSync(file);
    });

    server = app.listen(0, () => {
      port = server.address().port;
      done();
    });
  });

  afterAll((done) => {
    server.close(() => {
      [TEST_DB, TEST_SECURITY_DB, TEST_VAULT_DB].forEach((file) => {
        if (fs.existsSync(file)) fs.unlinkSync(file);
      });
      done();
    });
  });

  function request(method, pathName, body, cookie) {
    return new Promise((resolve, reject) => {
      const data = body ? JSON.stringify(body) : null;
      const options = {
        hostname: 'localhost',
        port,
        path: pathName,
        method,
        headers: { 'Content-Type': 'application/json' },
      };

      if (data) options.headers['Content-Length'] = Buffer.byteLength(data);
      if (cookie) options.headers.Cookie = cookie;

      const req = http.request(options, (res) => {
        let responseBody = '';
        res.on('data', (chunk) => responseBody += chunk);
        res.on('end', () => {
          const setCookie = res.headers['set-cookie'];
          let sessionCookie = cookie;
          if (setCookie) {
            const match = setCookie.find((entry) => entry.startsWith('xenmange.sid='));
            if (match) sessionCookie = match.split(';')[0];
          }

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

  function appLogin() {
    return request('POST', '/api/auth/login', {
      username: 'admin',
      password: 'admin123!',
    });
  }

  function xenLogin() {
    return request('POST', '/api/auth/xen-login', {
      host: '192.168.1.100',
      username: 'root',
      password: 'pass',
    });
  }

  function createLocalUser(username, role = 'operator') {
    getSecurityDb().prepare(`
      INSERT INTO users (username, password_hash, display_name, role, active)
      VALUES (?, ?, ?, ?, 1)
    `).run(username, bcrypt.hashSync('password123!', 10), username, role);
  }

  it('should require a local XenMange user session', async () => {
    const xen = await xenLogin();
    const res = await request('GET', '/api/credentials', null, xen.cookie);
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('LOCAL_USER_REQUIRED');
  });

  it('should create, list, update, and delete encrypted credentials without exposing passwords', async () => {
    const auth = await appLogin();

    const created = await request('POST', '/api/credentials', {
      name: 'Production Pool Root',
      scope: 'private',
      targetType: 'pool',
      targetHint: '10.0.0.1',
      username: 'root',
      password: 'super-secret',
    }, auth.cookie);

    expect(created.status).toBe(201);
    expect(created.body).toEqual(expect.objectContaining({
      name: 'Production Pool Root',
      scope: 'private',
      targetType: 'pool',
      username: 'root',
    }));
    expect(created.body.password).toBeUndefined();

    const listed = await request('GET', '/api/credentials', null, auth.cookie);
    expect(listed.status).toBe(200);
    expect(listed.body.total).toBe(1);
    expect(listed.body.data[0]).toEqual(expect.objectContaining({
      name: 'Production Pool Root',
      targetHint: '10.0.0.1',
    }));
    expect(listed.body.data[0].password).toBeUndefined();

    const updated = await request('PUT', `/api/credentials/${created.body.id}`, {
      name: 'Production Pool Root Rotated',
      scope: 'shared',
      targetType: 'pool',
      targetHint: 'prod-pool-a',
      username: 'root',
      password: 'rotated-secret',
    }, auth.cookie);

    expect(updated.status).toBe(200);
    expect(updated.body).toEqual(expect.objectContaining({
      name: 'Production Pool Root Rotated',
      scope: 'shared',
      targetHint: 'prod-pool-a',
    }));

    const removed = await request('DELETE', `/api/credentials/${created.body.id}`, null, auth.cookie);
    expect(removed.status).toBe(200);
    expect(removed.body.success).toBe(true);

    const empty = await request('GET', '/api/credentials', null, auth.cookie);
    expect(empty.body.total).toBe(0);
  });

  it('should allow a local control-plane session to attach a xen target using a saved vault credential', async () => {
    const auth = await appLogin();

    const created = await request('POST', '/api/credentials', {
      name: 'Production Pool Root',
      scope: 'private',
      targetType: 'pool',
      targetHint: '10.0.0.1',
      username: 'root',
      password: 'super-secret',
    }, auth.cookie);

    expect(created.status).toBe(201);

    const xen = await request('POST', '/api/auth/xen-login', {
      host: '192.168.1.100',
      username: 'root',
      password: '',
      vaultCredentialId: created.body.id,
    }, auth.cookie);

    expect(xen.status).toBe(200);
    expect(xen.body.connected).toBe(true);
    expect(xen.body.user).toEqual(expect.objectContaining({
      username: 'admin',
    }));
  });

  it('should expose shared credentials to other authenticated local users while keeping private ones hidden', async () => {
    createLocalUser('operator-a');
    createLocalUser('operator-b');

    const owner = await request('POST', '/api/auth/login', {
      username: 'operator-a',
      password: 'password123!',
    });
    const other = await request('POST', '/api/auth/login', {
      username: 'operator-b',
      password: 'password123!',
    });

    const privateCredential = await request('POST', '/api/credentials', {
      name: 'Private Host Root',
      scope: 'private',
      targetType: 'host',
      targetHint: '10.0.0.25',
      username: 'root',
      password: 'private-secret',
    }, owner.cookie);
    expect(privateCredential.status).toBe(201);

    const sharedCredential = await request('POST', '/api/credentials', {
      name: 'Shared Pool Root',
      scope: 'shared',
      targetType: 'pool',
      targetHint: '10.0.0.1',
      username: 'root',
      password: 'shared-secret',
    }, owner.cookie);
    expect(sharedCredential.status).toBe(201);

    const visible = await request('GET', '/api/credentials', null, other.cookie);
    expect(visible.status).toBe(200);
    expect(visible.body.data.some((entry) => entry.name === 'Shared Pool Root')).toBe(true);
    expect(visible.body.data.some((entry) => entry.name === 'Private Host Root')).toBe(false);
  });
});
