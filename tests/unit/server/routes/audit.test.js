const http = require('http');
const path = require('path');
const fs = require('fs');

const TEST_DB = path.join(__dirname, '..', '..', '..', 'data', 'audit-routes.db');

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

  actual.XenAPI.prototype.rpc = jest.fn(async function () {
    return {};
  });

  return actual;
});

const auditLogService = require('../../../../server/services/audit-log');
const app = require('../../../../server/index');

describe('Audit Routes', () => {
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
    return request('POST', '/api/auth/login', {
      host: '192.168.1.100',
      username: 'root',
      password: 'pass',
    });
  }

  it('should list audit entries in reverse chronological order', async () => {
    const auth = await login();

    auditLogService.record({
      id: 'audit-entry-1',
      category: 'alerts',
      action: 'alert_state_updated',
      actionLabel: 'Updated alert state for',
      entityType: 'alert',
      entityRef: 'OpaqueRef:msg1',
      entityName: 'Storage nearing threshold',
      operator: 'root',
      route: '/alerts',
      status: 'success',
      before: { acknowledged: false },
      after: { acknowledged: true },
      detail: 'review action with warning severity.',
    });

    auditLogService.record({
      id: 'audit-entry-2',
      category: 'templates',
      action: 'template_governance_saved',
      actionLabel: 'Saved template governance for',
      entityType: 'template',
      entityRef: 'OpaqueRef:template1',
      entityName: '2026.08-lts',
      operator: 'root',
      route: '/templates',
      status: 'success',
      before: { lifecycleStage: 'draft' },
      after: { lifecycleStage: 'stable' },
      detail: 'stable stage with validated status.',
    });

    const res = await request('GET', '/api/audit', null, auth.cookie);
    expect(res.status).toBe(200);
    expect(res.body.total).toBeGreaterThanOrEqual(2);
    expect(res.body.data[0]).toEqual(expect.objectContaining({
      id: 'audit-entry-2',
      category: 'templates',
      operator: 'root',
    }));
    expect(res.body.data[1]).toEqual(expect.objectContaining({
      id: 'audit-entry-1',
      category: 'alerts',
      changedFields: [
        expect.objectContaining({ field: 'acknowledged' }),
      ],
    }));
  });
});
