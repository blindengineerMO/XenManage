const http = require('http');
const path = require('path');
const fs = require('fs');

const TEST_DB = path.join(__dirname, '..', '..', '..', 'data', 'resilience-routes.db');

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

  actual.XenAPI.prototype.getPools = jest.fn(async function () {
    return { records: {} };
  });

  actual.XenAPI.prototype.getHosts = jest.fn(async function () {
    return { records: {} };
  });

  actual.XenAPI.prototype.getVMs = jest.fn(async function () {
    return { records: {} };
  });

  actual.XenAPI.prototype.getTasks = jest.fn(async function () {
    return {};
  });

  actual.XenAPI.prototype.getMessages = jest.fn(async function () {
    return {};
  });

  actual.XenAPI.prototype.rpc = jest.fn(async function () {
    return {};
  });

  return actual;
});

const app = require('../../../../server/index');

describe('Resilience Routes', () => {
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

  it('should require approved destructive tokens before operators delete resilience runbooks', async () => {
    const auth = await login();

    const save = await request('PUT', '/api/resilience/plans/OpaqueRef%3Apool1', {
      recoveryTier: 'tier-1',
      haPolicy: 'priority-restart',
      restartPriority: 'high',
      backupWindowHours: 12,
      rpoMinutes: 30,
      rtoMinutes: 90,
      restorePointStatus: 'review',
      owner: 'Platform Ops',
      standbyHostRef: '',
      failoverNetworkRef: '',
      lastVerifiedAt: '2026-08-24T12:00:00.000Z',
      runbookSteps: ['Verify backup currency', 'Validate standby host capacity'],
      notes: 'Runbook used for Monday, August 24, 2026 destructive approval validation.',
    }, auth.cookie);
    expect(save.status).toBe(200);

    const lower = await request('PUT', '/api/governance/role', { role: 'operator' }, auth.cookie);
    expect(lower.status).toBe(200);

    const blocked = await request('DELETE', '/api/resilience/plans/OpaqueRef%3Apool1', null, auth.cookie);
    expect(blocked.status).toBe(403);
    expect(blocked.body.error).toBe('APPROVAL_REQUIRED');

    const approval = await request('POST', '/api/governance/approvals', {
      actionKey: 'resilience_runbook_delete',
      entityType: 'pool',
      entityRef: 'OpaqueRef:pool1',
      entityName: 'Production Pool',
      justification: 'Delete a resilience runbook during Monday, August 24, 2026 approval validation.',
      route: '/resilience',
    }, auth.cookie);
    expect(approval.status).toBe(201);

    const elevate = await request('PUT', '/api/governance/role', { role: 'admin' }, auth.cookie);
    expect(elevate.status).toBe(200);

    const decision = await request('POST', `/api/governance/approvals/${encodeURIComponent(approval.body.id)}/decision`, {
      decision: 'approved',
      notes: 'Approved during Monday, August 24, 2026 resilience validation.',
    }, auth.cookie);
    expect(decision.status).toBe(200);

    const lowerAgain = await request('PUT', '/api/governance/role', { role: 'operator' }, auth.cookie);
    expect(lowerAgain.status).toBe(200);

    const removed = await request('DELETE', '/api/resilience/plans/OpaqueRef%3Apool1', {
      approvalId: approval.body.id,
    }, auth.cookie);
    expect(removed.status).toBe(200);
    expect(removed.body.success).toBe(true);
  });
});
