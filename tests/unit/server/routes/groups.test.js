const http = require('http');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const TEST_DB = path.join(__dirname, '..', '..', '..', 'data', 'groups-routes.db');
const TEST_SECURITY_DB = path.join(__dirname, '..', '..', '..', 'data', 'groups-security.db');

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

describe('Local Group Routes', () => {
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
    const db = getSecurityDb();
    db.prepare('DELETE FROM group_members').run();
    db.prepare('DELETE FROM groups').run();
    db.prepare(`DELETE FROM users WHERE username != 'admin'`).run();
    db.prepare(`
      UPDATE users
      SET password_hash = ?, display_name = 'Platform Administrator', email = '', role = 'admin', active = 1
      WHERE username = 'admin'
    `).run(bcrypt.hashSync('admin123!', 10));

    db.prepare(`
      INSERT INTO users (username, password_hash, display_name, role, active)
      VALUES ('operator-a', ?, 'Operator A', 'operator', 1)
    `).run(bcrypt.hashSync('password123!', 10));
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

  it('should list, create, update, and delete local groups for an admin session', async () => {
    const auth = await appLogin();
    const operatorUser = getSecurityDb().prepare(`SELECT id FROM users WHERE username = 'operator-a'`).get();

    const created = await request('POST', '/api/groups', {
      name: 'Platform Operations',
      memberUserIds: [operatorUser.id],
    }, auth.cookie);

    expect(created.status).toBe(201);
    expect(created.body).toEqual(expect.objectContaining({
      name: 'Platform Operations',
      member_count: 1,
      members: ['Operator A'],
    }));

    const listed = await request('GET', '/api/groups', null, auth.cookie);
    expect(listed.status).toBe(200);
    expect(listed.body.total).toBe(1);

    const updated = await request('PUT', `/api/groups/${created.body.id}`, {
      name: 'Platform Operations Updated',
      memberUserIds: [],
    }, auth.cookie);

    expect(updated.status).toBe(200);
    expect(updated.body).toEqual(expect.objectContaining({
      name: 'Platform Operations Updated',
      member_count: 0,
    }));

    const removed = await request('DELETE', `/api/groups/${created.body.id}`, null, auth.cookie);
    expect(removed.status).toBe(200);
    expect(removed.body.success).toBe(true);
  });

  it('should restrict group administration to admin local sessions', async () => {
    const operator = await appLogin('operator-a', 'password123!');
    const listed = await request('GET', '/api/groups', null, operator.cookie);
    expect(listed.status).toBe(403);
    expect(listed.body.error).toBe('ADMIN_ROLE_REQUIRED');
  });
});
