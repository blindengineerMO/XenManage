const http = require('http');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const TEST_DB = path.join(__dirname, '..', '..', '..', 'data', 'users-routes.db');
const TEST_SECURITY_DB = path.join(__dirname, '..', '..', '..', 'data', 'users-security.db');

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

const { getSecurityDb } = require('../../../../server/models/security-db');
const app = require('../../../../server/index');

describe('Local User Routes', () => {
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
    getSecurityDb().prepare(`DELETE FROM users WHERE username != 'admin'`).run();
    getSecurityDb().prepare(`
      UPDATE users
      SET password_hash = ?, display_name = 'Platform Administrator', email = '', role = 'admin', active = 1
      WHERE username = 'admin'
    `).run(bcrypt.hashSync('admin123!', 10));
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

  function appLogin(username = 'admin', password = 'admin123!') {
    return request('POST', '/api/auth/login', { username, password });
  }

  function createLocalUser(username, role = 'operator') {
    getSecurityDb().prepare(`
      INSERT INTO users (username, password_hash, display_name, role, active)
      VALUES (?, ?, ?, ?, 1)
    `).run(username, bcrypt.hashSync('password123!', 10), username, role);
  }

  it('should list, create, update, and rotate local users for an admin session', async () => {
    const auth = await appLogin();

    const listed = await request('GET', '/api/users', null, auth.cookie);
    expect(listed.status).toBe(200);
    expect(listed.body.summary.activeAdmins).toBeGreaterThanOrEqual(1);

    const created = await request('POST', '/api/users', {
      username: 'ops-admin',
      password: 'TempPassword123!',
      displayName: 'Operations Admin',
      email: 'ops-admin@example.com',
      role: 'operator',
      active: true,
    }, auth.cookie);

    expect(created.status).toBe(201);
    expect(created.body).toEqual(expect.objectContaining({
      username: 'ops-admin',
      role: 'operator',
      active: true,
    }));

    const updated = await request('PUT', `/api/users/${created.body.id}`, {
      username: 'ops-admin',
      displayName: 'Operations Admin Updated',
      email: 'ops-admin+updated@example.com',
      role: 'admin',
      active: true,
    }, auth.cookie);

    expect(updated.status).toBe(200);
    expect(updated.body).toEqual(expect.objectContaining({
      display_name: 'Operations Admin Updated',
      role: 'admin',
    }));

    const passwordReset = await request('POST', `/api/users/${created.body.id}/password`, {
      password: 'EvenBetterPassword123!',
    }, auth.cookie);

    expect(passwordReset.status).toBe(200);
    expect(passwordReset.body.success).toBe(true);

    const login = await appLogin('ops-admin', 'EvenBetterPassword123!');
    expect(login.status).toBe(200);
    expect(login.body.user.username).toBe('ops-admin');
  });

  it('should restrict user administration to admin local sessions', async () => {
    createLocalUser('operator-a', 'operator');
    const operator = await appLogin('operator-a', 'password123!');

    const listed = await request('GET', '/api/users', null, operator.cookie);
    expect(listed.status).toBe(403);
    expect(listed.body.error).toBe('ADMIN_ROLE_REQUIRED');
  });

  it('should prevent deactivating or demoting the last active admin', async () => {
    const auth = await appLogin();
    const adminUser = getSecurityDb().prepare(`SELECT id FROM users WHERE username = 'admin'`).get();

    const demote = await request('PUT', `/api/users/${adminUser.id}`, {
      username: 'admin',
      displayName: 'Platform Administrator',
      email: '',
      role: 'operator',
      active: true,
    }, auth.cookie);

    expect(demote.status).toBe(409);
    expect(demote.body.error).toBe('LAST_ACTIVE_ADMIN_REQUIRED');

    const disable = await request('PUT', `/api/users/${adminUser.id}`, {
      username: 'admin',
      displayName: 'Platform Administrator',
      email: '',
      role: 'admin',
      active: false,
    }, auth.cookie);

    expect(disable.status).toBe(409);
    expect(disable.body.error).toBe('LAST_ACTIVE_ADMIN_REQUIRED');
  });
});
