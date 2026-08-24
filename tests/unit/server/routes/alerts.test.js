const http = require('http');
const path = require('path');
const fs = require('fs');

const TEST_DB = path.join(__dirname, '..', '..', '..', 'data', 'alerts-routes.db');

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

  actual.XenAPI.prototype.getMessages = jest.fn(async function () {
    return {
      'OpaqueRef:msg1': {
        name: 'Storage nearing threshold',
        cls: 'SR',
        body: 'Primary SR crossed the warning threshold.',
        timestamp: '2026-08-19T12:00:00.000Z',
        uuid: 'msg-uuid-1',
        obj_uuid: 'sr-uuid-1',
      },
      'OpaqueRef:msg2': {
        name: 'Host maintenance scheduled',
        cls: 'host',
        body: 'alpha-xen entered a maintenance preparation window.',
        timestamp: '2026-08-19T11:40:00.000Z',
        uuid: 'msg-uuid-2',
        obj_uuid: 'host-uuid-1',
      },
    };
  });

  actual.XenAPI.prototype.rpc = jest.fn(async function () {
    return {};
  });

  return actual;
});

const app = require('../../../../server/index');

describe('Alerts Routes', () => {
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
    return request('POST', '/api/auth/xen-login', {
      host: '192.168.1.100',
      username: 'root',
      password: 'pass',
    });
  }

  it('should list enriched alerts', async () => {
    const auth = await login();
    const res = await request('GET', '/api/alerts', null, auth.cookie);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.data[0]).toEqual(expect.objectContaining({
      ref: 'OpaqueRef:msg1',
      summary: 'Storage nearing threshold',
      targetRoute: '/storage',
      stateLabel: 'open',
    }));
  });

  it('should persist operator alert state', async () => {
    const auth = await login();
    const payload = {
      acknowledged: true,
      suppressionUntil: '2026-08-20T14:00:00.000Z',
      severityOverride: 'info',
      healthAction: 'review',
      notes: 'Handled during the current maintenance window.',
    };

    const res = await request('PUT', '/api/alerts/OpaqueRef%3Amsg1/state', payload, auth.cookie);
    expect(res.status).toBe(200);
    expect(res.body.acknowledged).toBe(true);
    expect(res.body.severityOverride).toBe('info');
    expect(res.body.healthAction).toBe('review');
    expect(res.body.acknowledgedBy).toBe('root');

    const list = await request('GET', '/api/alerts', null, auth.cookie);
    const alert = list.body.data.find((entry) => entry.ref === 'OpaqueRef:msg1');
    expect(alert).toEqual(expect.objectContaining({
      acknowledged: true,
      severityOverride: 'info',
      healthAction: 'review',
    }));

    const audit = await request('GET', '/api/audit', null, auth.cookie);
    expect(audit.status).toBe(200);
    expect(audit.body.data[0]).toEqual(expect.objectContaining({
      category: 'alerts',
      action: 'alert_state_updated',
      operator: 'root',
    }));
  });

  it('should bulk update alert state', async () => {
    const auth = await login();
    const res = await request('PUT', '/api/alerts/bulk-state', {
      refs: ['OpaqueRef:msg1', 'OpaqueRef:msg2'],
      state: {
        acknowledged: true,
        suppressionUntil: '2026-08-22T18:00:00.000Z',
        severityOverride: '',
        healthAction: 'capacity',
        notes: 'Bulk triage applied on Saturday, August 22, 2026.',
      },
    }, auth.cookie);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.data[0]).toEqual(expect.objectContaining({
      acknowledged: true,
      healthAction: 'capacity',
    }));

    const audit = await request('GET', '/api/audit', null, auth.cookie);
    expect(audit.body.data[0]).toEqual(expect.objectContaining({
      category: 'alerts',
      action: 'alert_bulk_state_updated',
    }));
  });

  it('should persist alert policies and surface policy-driven alert context', async () => {
    const auth = await login();
    const create = await request('POST', '/api/alerts/policies', {
      enabled: true,
      name: 'Storage Warning Review',
      matchClass: 'sr',
      matchTargetRoute: '/storage',
      matchObject: 'msg-uuid-1',
      matchSeverity: 'warning',
      matchText: 'storage threshold',
      textMatchMode: 'all',
      autoAcknowledge: false,
      suppressionHours: 12,
      severityOverride: '',
      healthAction: 'capacity',
      notes: 'Storage alerts should route into capacity review on Saturday, August 22, 2026.',
    }, auth.cookie);

    expect(create.status).toBe(201);
    expect(create.body).toEqual(expect.objectContaining({
      name: 'Storage Warning Review',
      healthAction: 'capacity',
      matchTargetRoute: '/storage',
      textMatchMode: 'all',
    }));

    const policies = await request('GET', '/api/alerts/policies', null, auth.cookie);
    expect(policies.status).toBe(200);
    expect(policies.body.total).toBeGreaterThanOrEqual(1);

    const list = await request('GET', '/api/alerts', null, auth.cookie);
    const alert = list.body.data.find((entry) => entry.ref === 'OpaqueRef:msg1');
    expect(alert).toEqual(expect.objectContaining({
      policyName: 'Storage Warning Review',
      healthAction: 'capacity',
    }));
  });

  it('should reject invalid alert refs', async () => {
    const auth = await login();
    const res = await request('PUT', '/api/alerts/msg1/state', { acknowledged: true }, auth.cookie);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
  });
});
