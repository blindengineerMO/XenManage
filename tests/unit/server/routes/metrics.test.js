const http = require('http');
const path = require('path');
const fs = require('fs');

const TEST_DB = path.join(__dirname, '..', '..', '..', 'data', 'metrics-routes.db');
const TEST_SECURITY_DB = path.join(__dirname, '..', '..', '..', 'data', 'metrics-security.db');
const TEST_PERF_DB = path.join(__dirname, '..', '..', '..', 'data', 'metrics-perf.db');

process.env.DB_PATH = TEST_DB;
process.env.SECURITY_DB_PATH = TEST_SECURITY_DB;
process.env.PERF_DB_PATH = TEST_PERF_DB;

jest.mock('../../../../server/services/xenapi', () => {
  const actual = jest.requireActual('../../../../server/services/xenapi');

  actual.XenAPI.prototype.login = jest.fn(async function () {
    this.sessionRef = 'OpaqueRef:mock-session';
    return this.sessionRef;
  });

  actual.XenAPI.prototype.logout = jest.fn(async function () {
    this.sessionRef = null;
  });

  actual.XenAPI.prototype.getHosts = jest.fn(async function () {
    return {
      records: {
        'OpaqueRef:host1': {
          name_label: 'alpha-xen',
          uuid: 'host-uuid-1',
          enabled: true,
        },
      },
    };
  });

  actual.XenAPI.prototype.getVMs = jest.fn(async function () {
    return {
      records: {
        'OpaqueRef:vm1': {
          name_label: 'app-01',
          uuid: 'vm-uuid-1',
          memory_static_max: 8589934592,
          memory_dynamic_max: 8589934592,
          VCPUs_at_startup: 4,
          is_a_template: false,
        },
        'OpaqueRef:template1': {
          name_label: 'ubuntu-template',
          uuid: 'template-uuid-1',
          memory_static_max: 4294967296,
          VCPUs_at_startup: 2,
          is_a_template: true,
        },
      },
    };
  });

  actual.XenAPI.prototype.getSRs = jest.fn(async function () {
    return {
      records: {
        'OpaqueRef:sr1': {
          name_label: 'Primary SR',
          uuid: 'sr-uuid-1',
          physical_size: 32212254720,
          virtual_allocation: 21474836480,
        },
      },
    };
  });

  actual.XenAPI.prototype.getHostMetrics = jest.fn(async function () {
    return {
      live: true,
      memory_total: 68719476736,
      memory_free: 17179869184,
    };
  });

  actual.XenAPI.prototype.getVMMetrics = jest.fn(async function () {
    return {
      memory_actual: 6442450944,
    };
  });

  actual.XenAPI.prototype.rpc = jest.fn(async function () {
    return {};
  });

  return actual;
});

const app = require('../../../../server/index');

describe('Metrics Routes', () => {
  let server;
  let port;

  beforeAll((done) => {
    [TEST_DB, TEST_SECURITY_DB, TEST_PERF_DB].forEach((file) => {
      if (fs.existsSync(file)) fs.unlinkSync(file);
    });

    server = app.listen(0, () => {
      port = server.address().port;
      done();
    });
  });

  afterAll((done) => {
    server.close(() => {
      [TEST_DB, TEST_SECURITY_DB, TEST_PERF_DB].forEach((file) => {
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
        let responseText = '';
        res.on('data', (chunk) => { responseText += chunk; });
        res.on('end', () => {
          const setCookie = res.headers['set-cookie'];
          let sessionCookie = cookie;
          if (setCookie) {
            const match = setCookie.find((entry) => entry.startsWith('xenmange.sid='));
            if (match) sessionCookie = match.split(';')[0];
          }

          try {
            resolve({
              status: res.statusCode,
              body: JSON.parse(responseText),
              headers: res.headers,
              cookie: sessionCookie,
            });
          } catch {
            resolve({
              status: res.statusCode,
              body: responseText,
              headers: res.headers,
              cookie: sessionCookie,
            });
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

  it('captures and returns cluster telemetry history', async () => {
    const auth = await login();
    const res = await request('GET', '/api/metrics/cluster?range=24h', null, auth.cookie);

    expect(res.status).toBe(200);
    expect(res.body.range).toBe('24h');
    expect(res.body.metrics).toEqual(expect.arrayContaining([
      expect.objectContaining({ metricName: 'cluster_memory_used_percent' }),
      expect.objectContaining({ metricName: 'cluster_storage_utilization_percent' }),
      expect.objectContaining({ metricName: 'cluster_vm_memory_actual_bytes' }),
    ]));
    expect(res.body.metrics.every((entry) => Array.isArray(entry.points) && entry.points.length >= 1)).toBe(true);
  });

  it('returns entity telemetry history for hosts, vms, and storage', async () => {
    const auth = await login();

    const hostRes = await request('GET', '/api/metrics/hosts/OpaqueRef:host1?range=24h', null, auth.cookie);
    expect(hostRes.status).toBe(200);
    expect(hostRes.body.entityType).toBe('host');
    expect(hostRes.body.metrics.some((entry) => entry.metricName === 'memory_used_percent')).toBe(true);

    const vmRes = await request('GET', '/api/metrics/vms/OpaqueRef:vm1?range=24h', null, auth.cookie);
    expect(vmRes.status).toBe(200);
    expect(vmRes.body.entityType).toBe('vm');
    expect(vmRes.body.metrics.some((entry) => entry.metricName === 'memory_usage_percent')).toBe(true);

    const srRes = await request('GET', '/api/metrics/storage/OpaqueRef:sr1?range=24h', null, auth.cookie);
    expect(srRes.status).toBe(200);
    expect(srRes.body.entityType).toBe('sr');
    expect(srRes.body.metrics.some((entry) => entry.metricName === 'utilization_percent')).toBe(true);
  });
});
