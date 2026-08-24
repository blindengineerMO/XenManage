const http = require('http');
const path = require('path');
const fs = require('fs');

const TEST_DB = path.join(__dirname, '..', '..', '..', 'data', 'system-config-routes.db');
const TEST_SECURITY_DB = path.join(__dirname, '..', '..', '..', 'data', 'system-config-security.db');

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

const { settingsModel } = require('../../../../server/models/connection');
const { authEventModel, getSecurityDb } = require('../../../../server/models/security-db');
const app = require('../../../../server/index');

describe('System Config Routes', () => {
  let server;
  let port;

  beforeAll((done) => {
    if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
    if (fs.existsSync(TEST_SECURITY_DB)) fs.unlinkSync(TEST_SECURITY_DB);
    server = app.listen(0, () => {
      port = server.address().port;
      done();
    });
  });

  afterAll((done) => {
    server.close(() => {
      if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
      if (fs.existsSync(TEST_SECURITY_DB)) fs.unlinkSync(TEST_SECURITY_DB);
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
      username: 'admin',
      password: 'admin123!',
    });
  }

  it('should return default system settings and seeded retention policies', async () => {
    const auth = await login();
    const res = await request('GET', '/api/settings', null, auth.cookie);

    expect(res.status).toBe(200);
    expect(res.body.general).toEqual(expect.objectContaining({
      appName: 'XenMange',
    }));
    expect(Array.isArray(res.body.retentionPolicies)).toBe(true);
    expect(res.body.retentionPolicies.map((entry) => entry.domain)).toEqual(
      expect.arrayContaining(['audit-log', 'remediation-tasks', 'auth-events'])
    );
    expect(res.body.vault).toEqual(expect.objectContaining({
      usingDevelopmentFallback: true,
      hasConfiguredMasterKey: false,
      keySource: 'derived-development',
    }));
  });

  it('should persist settings updates and run retention previews and sweeps', async () => {
    const auth = await login();

    const network = await request('PUT', '/api/settings/network', {
      publicBaseUrl: 'https://xenmange.example.com',
      trustProxy: true,
    }, auth.cookie);
    expect(network.status).toBe(200);
    expect(network.body.section).toEqual(expect.objectContaining({
      publicBaseUrl: 'https://xenmange.example.com',
      trustProxy: true,
    }));

    const retentionRuntime = await request('PUT', '/api/settings/retention', {
      sweepIntervalHours: 12,
      vacuumAfterSweep: true,
    }, auth.cookie);
    expect(retentionRuntime.status).toBe(200);
    expect(retentionRuntime.body.section.sweepIntervalHours).toBe(12);

    const policy = await request('PUT', '/api/settings/retention/policies/audit-log', {
      retentionDays: 30,
      enabled: true,
    }, auth.cookie);
    expect(policy.status).toBe(200);
    expect(policy.body.retentionDays).toBe(30);

    settingsModel.set('activity.audit', JSON.stringify([
      {
        id: 'audit-old',
        category: 'alerts',
        summary: 'Old audit entry',
        happenedAt: '2026-06-01T12:00:00.000Z',
      },
      {
        id: 'audit-new',
        category: 'alerts',
        summary: 'Fresh audit entry',
        happenedAt: '2026-08-23T12:00:00.000Z',
      },
    ]));

    settingsModel.set('activity.remediationTasks', JSON.stringify([
      {
        ref: 'OpaqueRef:task-old',
        name_label: 'Old closed task',
        status: 'success',
        finished: '2026-05-15T12:00:00.000Z',
      },
      {
        ref: 'OpaqueRef:task-open',
        name_label: 'Old open task',
        status: 'in_progress',
        updated_at: '2026-05-15T12:00:00.000Z',
      },
      {
        ref: 'OpaqueRef:task-new',
        name_label: 'Fresh closed task',
        status: 'warning',
        finished: '2026-08-23T12:00:00.000Z',
      },
    ]));

    const event = authEventModel.create({
      username: 'root',
      event: 'xen_login',
      ip: '127.0.0.1',
      detail: 'Old auth event',
    });

    getSecurityDb().prepare('UPDATE auth_events SET created_at = ? WHERE id = ?')
      .run('2026-05-01T12:00:00.000Z', event.id);

    const preview = await request('GET', '/api/settings/retention/preview', null, auth.cookie);
    expect(preview.status).toBe(200);
    expect(preview.body.results).toEqual(expect.arrayContaining([
      expect.objectContaining({ domain: 'audit-log', candidateCount: 1 }),
      expect.objectContaining({ domain: 'remediation-tasks', candidateCount: 1 }),
      expect.objectContaining({ domain: 'auth-events', candidateCount: 1 }),
    ]));

    const run = await request('POST', '/api/settings/retention/run', {
      dryRun: false,
    }, auth.cookie);
    expect(run.status).toBe(200);
    expect(run.body.totalPurged).toBe(3);

    const auditEntries = JSON.parse(settingsModel.get('activity.audit'));
    expect(auditEntries.some((entry) => entry.id === 'audit-old')).toBe(false);
    expect(auditEntries.some((entry) => entry.id === 'audit-new')).toBe(true);
    expect(auditEntries.some((entry) => entry.action === 'retention_sweep_completed')).toBe(true);

    const remediationTasks = JSON.parse(settingsModel.get('activity.remediationTasks'));
    expect(remediationTasks.some((entry) => entry.ref === 'OpaqueRef:task-old')).toBe(false);
    expect(remediationTasks.some((entry) => entry.ref === 'OpaqueRef:task-open')).toBe(true);
    expect(remediationTasks.some((entry) => entry.ref === 'OpaqueRef:task-new')).toBe(true);

    const removedAuthEvent = getSecurityDb().prepare('SELECT * FROM auth_events WHERE id = ?').get(event.id);
    expect(removedAuthEvent).toBeUndefined();
  });
});
