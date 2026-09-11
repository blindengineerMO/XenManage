const http = require('http');
const path = require('path');
const fs = require('fs');

const TEST_DB = path.join(__dirname, '..', '..', '..', 'data', 'template-library-routes.db');

process.env.DB_PATH = TEST_DB;

jest.mock('../../../../server/services/xenapi', () => {
  const actual = jest.requireActual('../../../../server/services/xenapi');
  actual.XenAPI.prototype.login = jest.fn(async function () {
    this.sessionRef = 'OpaqueRef:mock-session';
    return this.sessionRef;
  });
  actual.XenAPI.prototype.logout = jest.fn(async function () {
    this.sessionRef = null;
  });
  actual.XenAPI.prototype.rpc = jest.fn(async () => ({}));
  return actual;
});

const app = require('../../../../server/index');

describe('Template Library Routes', () => {
  let server;
  let port;

  beforeAll((done) => {
    if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
    server = app.listen(0, () => {
      port = server.address().port;
      done();
    });
  });

  afterAll((done) => {
    server.close(() => {
      if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
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

  async function login() {
    const auth = await request('POST', '/api/auth/login', {
      username: 'admin',
      password: 'admin123!',
    });

    return request('POST', '/api/auth/xen-login', {
      host: '192.168.1.100',
      username: 'root',
      password: 'pass',
    }, auth.cookie);
  }

  it('tracks per-save version history and exposes single-version content', async () => {
    const auth = await login();

    const created = await request('POST', '/api/template-library/items', {
      name: 'baseline.json',
      language: 'json',
      content: '{"v":1}',
    }, auth.cookie);
    expect(created.status).toBe(200);
    const itemId = created.body.id;

    const savedV2 = await request('PUT', `/api/template-library/items/${itemId}`, { content: '{"v":2}' }, auth.cookie);
    expect(savedV2.status).toBe(200);
    expect(savedV2.body.version).toBe(2);

    const savedV3 = await request('PUT', `/api/template-library/items/${itemId}`, { content: '{"v":3}' }, auth.cookie);
    expect(savedV3.status).toBe(200);
    expect(savedV3.body.version).toBe(3);

    const list = await request('GET', `/api/template-library/items/${itemId}/versions`, null, auth.cookie);
    expect(list.status).toBe(200);
    expect(list.body.data.map((entry) => entry.version)).toEqual([3, 2, 1]);
    expect(list.body.data[0].content).toBeUndefined();

    const v1 = await request('GET', `/api/template-library/items/${itemId}/versions/1`, null, auth.cookie);
    expect(v1.status).toBe(200);
    expect(v1.body.content).toBe('{"v":1}');

    const missing = await request('GET', `/api/template-library/items/${itemId}/versions/99`, null, auth.cookie);
    expect(missing.status).toBe(404);
    expect(missing.body.error).toBe('TEMPLATE_LIBRARY_ITEM_VERSION_NOT_FOUND');
  });

  it('restores a prior version as a new latest version and records an audit entry', async () => {
    const auth = await login();

    const created = await request('POST', '/api/template-library/items', {
      name: 'restore-me.json',
      language: 'json',
      content: '{"stage":"original"}',
    }, auth.cookie);
    const itemId = created.body.id;

    await request('PUT', `/api/template-library/items/${itemId}`, { content: '{"stage":"changed"}' }, auth.cookie);

    const restore = await request('POST', `/api/template-library/items/${itemId}/versions/1/restore`, {}, auth.cookie);
    expect(restore.status).toBe(200);
    expect(restore.body.version).toBe(3);
    expect(restore.body.content).toBe('{"stage":"original"}');

    const item = await request('GET', `/api/template-library/items/${itemId}`, null, auth.cookie);
    expect(item.body.content).toBe('{"stage":"original"}');
    expect(item.body.version).toBe(3);

    const audit = await request('GET', '/api/audit?category=template-library', null, auth.cookie);
    expect(audit.status).toBe(200);
    const restoredEntry = audit.body.data.find((entry) => entry.action === 'template_library_item_version_restored');
    expect(restoredEntry).toBeTruthy();
    expect(restoredEntry.detail).toContain('restored from version 1');
  });
});
