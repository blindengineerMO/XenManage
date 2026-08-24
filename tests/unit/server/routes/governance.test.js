const http = require('http');
const path = require('path');
const fs = require('fs');

const TEST_DB = path.join(__dirname, '..', '..', '..', 'data', 'governance-routes.db');

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
    return {
      records: {
        'OpaqueRef:pool1': {
          name_label: 'Production Pool',
          uuid: 'pool-uuid-1',
        },
      },
    };
  });

  actual.XenAPI.prototype.getHosts = jest.fn(async function () {
    return {
      records: {
        'OpaqueRef:host1': {
          name_label: 'alpha-xen',
          pool: 'OpaqueRef:pool1',
          resident_VMs: ['OpaqueRef:vm1'],
        },
      },
    };
  });

  actual.XenAPI.prototype.getVMs = jest.fn(async function () {
    return {
      records: {
        'OpaqueRef:vm1': {
          name_label: 'app-01',
          is_a_template: false,
          power_state: 'Running',
          resident_on: 'OpaqueRef:host1',
          memory_static_max: 8589934592,
        },
      },
    };
  });

  actual.XenAPI.prototype.rpc = jest.fn(async function () {
    return {};
  });

  return actual;
});

const app = require('../../../../server/index');

describe('Governance Routes', () => {
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

  it('should return governance overview data', async () => {
    const auth = await login();
    const res = await request('GET', '/api/governance', null, auth.cookie);
    expect(res.status).toBe(200);
    expect(res.body.currentRole).toBeDefined();
    expect(res.body.summary.poolCount).toBe(1);
    expect(res.body.quotaRows[0]).toEqual(expect.objectContaining({
      poolRef: 'OpaqueRef:pool1',
      currentVmCount: 1,
      currentRunningVmCount: 1,
    }));
  });

  it('should persist governance policy, quotas, and approvals', async () => {
    const auth = await login();

    const policy = await request('PUT', '/api/governance/policy', {
      defaultRole: 'operator',
      requireDestructiveApproval: true,
      approvalTtlMinutes: 180,
    }, auth.cookie);
    expect(policy.status).toBe(200);
    expect(policy.body.defaultRole).toBe('operator');

    const role = await request('PUT', '/api/governance/role', { role: 'operator' }, auth.cookie);
    expect(role.status).toBe(200);
    expect(role.body.role).toBe('operator');

    const quota = await request('PUT', '/api/governance/quotas/OpaqueRef%3Apool1', {
      enabled: true,
      owner: 'Platform Ops',
      maxVmCount: 5,
      maxRunningVmCount: 4,
      maxTotalMemoryGiB: 64,
      notes: 'Production cap for Friday, August 21, 2026 operations.',
    }, auth.cookie);
    expect(quota.status).toBe(200);
    expect(quota.body.maxVmCount).toBe(5);

    const approval = await request('POST', '/api/governance/approvals', {
      actionKey: 'vm_shutdown',
      entityType: 'vm',
      entityRef: 'OpaqueRef:vm1',
      entityName: 'app-01',
      justification: 'Controlled shutdown for the Friday, August 21, 2026 maintenance window.',
      route: '/vms',
    }, auth.cookie);
    expect(approval.status).toBe(201);
    expect(approval.body.status).toBe('pending');

    const promote = await request('PUT', '/api/governance/role', { role: 'admin' }, auth.cookie);
    expect(promote.status).toBe(200);
    expect(promote.body.role).toBe('admin');

    const decision = await request('POST', `/api/governance/approvals/${encodeURIComponent(approval.body.id)}/decision`, {
      decision: 'approved',
      notes: 'Approved for the maintenance window on Friday, August 21, 2026.',
    }, auth.cookie);
    expect(decision.status).toBe(200);
    expect(decision.body.status).toBe('approved');

    const audit = await request('GET', '/api/audit', null, auth.cookie);
    expect(audit.status).toBe(200);
    expect(audit.body.data.some((entry) => entry.category === 'governance')).toBe(true);
  });
});
