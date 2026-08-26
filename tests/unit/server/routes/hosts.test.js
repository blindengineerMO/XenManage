const http = require('http');
const path = require('path');
const fs = require('fs');

const TEST_DB = path.join(__dirname, '..', '..', '..', 'data', 'hosts-routes.db');

process.env.DB_PATH = TEST_DB;

const mockState = {
  hosts: [],
  metrics: {},
  powerOps: [],
};

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
      refs: mockState.hosts.map((host) => host.ref),
      records: Object.fromEntries(mockState.hosts.map((host) => [host.ref, { ...host }])),
    };
  });

  actual.XenAPI.prototype.getRecord = jest.fn(async function (_className, ref) {
    const host = mockState.hosts.find((entry) => entry.ref === ref);
    return host ? { ...host } : { name_label: 'fallback-host', enabled: true };
  });

  actual.XenAPI.prototype.getHostMetrics = jest.fn(async function (ref) {
    return { ...(mockState.metrics[ref] || { live: false, memory_total: 0, memory_free: 0 }) };
  });

  actual.XenAPI.prototype.enterHostMaintenance = jest.fn(async function (ref, payload) {
    const host = mockState.hosts.find((entry) => entry.ref === ref);
    if (!host) throw new Error('HOST_NOT_FOUND');

    host.enabled = false;
    host.maintenance_mode = true;
    host.other_config = {
      ...(host.other_config || {}),
      maintenance_mode: 'true',
      maintenance_network: payload.networkRef || '',
    };

    if (payload.evacuateRunningVms) {
      const destination = mockState.hosts.find((entry) => entry.pool === host.pool && entry.ref !== host.ref);
      if (destination) {
        destination.resident_VMs = [...new Set([...(destination.resident_VMs || []), ...(host.resident_VMs || [])])];
        host.resident_VMs = [];
      }
    }

    return {
      ref,
      maintenance_mode: true,
      maintenanceNetworkRef: payload.networkRef,
      ...host,
    };
  });

  actual.XenAPI.prototype.exitHostMaintenance = jest.fn(async function (ref) {
    const host = mockState.hosts.find((entry) => entry.ref === ref);
    if (!host) throw new Error('HOST_NOT_FOUND');

    host.enabled = true;
    host.maintenance_mode = false;
    host.other_config = {
      ...(host.other_config || {}),
      maintenance_mode: 'false',
    };

    return {
      ref,
      maintenance_mode: false,
      ...host,
    };
  });

  actual.XenAPI.prototype.rebootHost = jest.fn(async function (ref) {
    mockState.powerOps.push({ action: 'reboot', ref });
    return { success: true };
  });

  actual.XenAPI.prototype.shutdownHost = jest.fn(async function (ref) {
    mockState.powerOps.push({ action: 'shutdown', ref });
    return { success: true };
  });

  actual.XenAPI.prototype.rpc = jest.fn(async function () {
    return {};
  });

  return actual;
});

const app = require('../../../../server/index');

describe('Host Routes', () => {
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

  beforeEach(() => {
    mockState.hosts = [
      {
        ref: 'OpaqueRef:host1',
        name_label: 'alpha-xen',
        address: '10.0.0.11',
        uuid: 'host-uuid-1',
        pool: 'OpaqueRef:pool1',
        enabled: true,
        maintenance_mode: false,
        resident_VMs: ['OpaqueRef:vm1'],
        other_config: {},
      },
      {
        ref: 'OpaqueRef:host2',
        name_label: 'beta-xen',
        address: '10.0.0.12',
        uuid: 'host-uuid-2',
        pool: 'OpaqueRef:pool1',
        enabled: true,
        maintenance_mode: false,
        resident_VMs: [],
        other_config: {},
      },
    ];
    mockState.metrics = {
      'OpaqueRef:host1': { live: true, memory_total: 68719476736, memory_free: 17179869184 },
    };
    mockState.powerOps = [];
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

  it('lists hosts and reads host metrics', async () => {
    const auth = await login();

    const list = await request('GET', '/api/hosts', null, auth.cookie);
    expect(list.status).toBe(200);
    expect(list.body.total).toBe(2);

    const metrics = await request('GET', '/api/hosts/OpaqueRef%3Ahost1/metrics', null, auth.cookie);
    expect(metrics.status).toBe(200);
    expect(metrics.body).toEqual(expect.objectContaining({
      live: true,
      memory_total: 68719476736,
    }));
  });

  it('enters and exits maintenance mode', async () => {
    const auth = await login();

    const enter = await request('POST', '/api/hosts/OpaqueRef%3Ahost1/maintenance/enter', {
      networkRef: 'OpaqueRef:net1',
      evacuateBatchSize: 2,
      evacuateRunningVms: true,
    }, auth.cookie);

    expect(enter.status).toBe(200);
    expect(enter.body).toEqual(expect.objectContaining({
      ref: 'OpaqueRef:host1',
      maintenance_mode: true,
      enabled: false,
    }));
    expect(mockState.hosts[0].resident_VMs).toEqual([]);

    const exit = await request('POST', '/api/hosts/OpaqueRef%3Ahost1/maintenance/exit', {}, auth.cookie);
    expect(exit.status).toBe(200);
    expect(exit.body).toEqual(expect.objectContaining({
      ref: 'OpaqueRef:host1',
      maintenance_mode: false,
      enabled: true,
    }));
  });

  it('reboots and shuts down a host through dedicated endpoints', async () => {
    const auth = await login();

    const reboot = await request('POST', '/api/hosts/OpaqueRef%3Ahost1/reboot', {}, auth.cookie);
    expect(reboot.status).toBe(200);
    expect(reboot.body).toEqual({ success: true, ref: 'OpaqueRef:host1' });

    const shutdown = await request('POST', '/api/hosts/OpaqueRef%3Ahost1/shutdown', {}, auth.cookie);
    expect(shutdown.status).toBe(200);
    expect(shutdown.body).toEqual({ success: true, ref: 'OpaqueRef:host1' });

    expect(mockState.powerOps).toEqual([
      { action: 'reboot', ref: 'OpaqueRef:host1' },
      { action: 'shutdown', ref: 'OpaqueRef:host1' },
    ]);
  });
});
