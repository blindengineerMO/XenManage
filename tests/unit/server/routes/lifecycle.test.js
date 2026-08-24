const http = require('http');
const path = require('path');
const fs = require('fs');

const TEST_DB = path.join(__dirname, '..', '..', '..', 'data', 'lifecycle-routes.db');

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

const app = require('../../../../server/index');

describe('Lifecycle Routes', () => {
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

  it('should return an empty lifecycle plan collection by default', async () => {
    const auth = await login();
    const res = await request('GET', '/api/lifecycle/plans', null, auth.cookie);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(0);
    expect(res.body.data).toEqual([]);
  });

  it('should save and list lifecycle plans', async () => {
    const auth = await login();
    const payload = {
      baselineStatus: 'drifted',
      targetStage: 'remediate',
      maintenanceWindow: 'Sat 01:00',
      patchGroup: 'Production Ring A',
      owner: 'Platform Ops',
      nextAction: 'patch',
      rebootRequired: true,
      evacuationRequired: true,
      dueDate: '2026-08-22',
      notes: 'Apply the August host baseline.',
      sourceTaskRef: 'OpaqueRef:remediation-1',
      sourceTemplateId: 'template-1',
      sourceTemplateName: 'Host Maintenance Review',
    };

    const save = await request('PUT', '/api/lifecycle/plans/OpaqueRef%3Ahost1', payload, auth.cookie);
    expect(save.status).toBe(200);
    expect(save.body.hostRef).toBe('OpaqueRef:host1');
    expect(save.body.owner).toBe('Platform Ops');
    expect(save.body.sourceTaskRef).toBe('OpaqueRef:remediation-1');

    const list = await request('GET', '/api/lifecycle/plans', null, auth.cookie);
    expect(list.status).toBe(200);
    expect(list.body.total).toBe(1);
    expect(list.body.data[0]).toEqual(expect.objectContaining({
      hostRef: 'OpaqueRef:host1',
      targetStage: 'remediate',
      rebootRequired: true,
      sourceTemplateId: 'template-1',
    }));

    const audit = await request('GET', '/api/audit', null, auth.cookie);
    expect(audit.status).toBe(200);
    expect(audit.body.data[0]).toEqual(expect.objectContaining({
      category: 'lifecycle',
      action: 'lifecycle_plan_saved',
      operator: 'root',
    }));
  });

  it('should delete lifecycle plans', async () => {
    const auth = await login();
    const remove = await request('DELETE', '/api/lifecycle/plans/OpaqueRef%3Ahost1', null, auth.cookie);
    expect(remove.status).toBe(200);
    expect(remove.body.success).toBe(true);

    const list = await request('GET', '/api/lifecycle/plans', null, auth.cookie);
    expect(list.body.total).toBe(0);
  });

  it('should reject invalid lifecycle plan refs', async () => {
    const auth = await login();
    const res = await request('PUT', '/api/lifecycle/plans/host1', { targetStage: 'review' }, auth.cookie);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
  });
});
