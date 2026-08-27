const http = require('http');
const path = require('path');
const fs = require('fs');

const TEST_DB = path.join(__dirname, '..', '..', '..', 'data', 'pools-routes.db');

process.env.DB_PATH = TEST_DB;

const mockState = {
  pools: [],
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

  actual.XenAPI.prototype.getPools = jest.fn(async function () {
    return {
      refs: mockState.pools.map((pool) => pool.ref),
      records: Object.fromEntries(mockState.pools.map((pool) => [pool.ref, { ...pool }])),
    };
  });

  actual.XenAPI.prototype.getRecord = jest.fn(async function (_className, ref) {
    const pool = mockState.pools.find((entry) => entry.ref === ref);
    return pool ? { ...pool } : { name_label: 'fallback-pool', uuid: 'pool-fallback' };
  });

  actual.XenAPI.prototype.updatePoolConfig = jest.fn(async function (ref, payload) {
    const pool = mockState.pools.find((entry) => entry.ref === ref);
    if (!pool) {
      throw new Error('POOL_NOT_FOUND');
    }

    pool.name_label = payload.nameLabel;
    pool.name_description = payload.nameDescription || '';
    return { ...pool };
  });

  actual.XenAPI.prototype.rpc = jest.fn(async function () {
    return {};
  });

  return actual;
});

const app = require('../../../../server/index');

describe('Pool Routes', () => {
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
    mockState.pools = [
      {
        ref: 'OpaqueRef:pool1',
        name_label: 'Production Pool',
        name_description: 'Primary shared virtualization pool.',
        uuid: 'pool-uuid-1',
        master: 'OpaqueRef:host1',
        slaves: ['OpaqueRef:host2'],
        default_SR: 'OpaqueRef:sr1',
        migration_network: 'OpaqueRef:net1',
        tags: ['prod'],
        other_config: { lifecycle: 'managed' },
      },
    ];
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

  it('lists pools and reads a pool record', async () => {
    const auth = await login();

    const list = await request('GET', '/api/pools', null, auth.cookie);
    expect(list.status).toBe(200);
    expect(list.body.total).toBe(1);
    expect(list.body.data[0]).toEqual(expect.objectContaining({
      ref: 'OpaqueRef:pool1',
      name_label: 'Production Pool',
    }));

    const record = await request('GET', '/api/pools/OpaqueRef%3Apool1', null, auth.cookie);
    expect(record.status).toBe(200);
    expect(record.body).toEqual(expect.objectContaining({
      ref: 'OpaqueRef:pool1',
      name_description: 'Primary shared virtualization pool.',
      default_SR: 'OpaqueRef:sr1',
    }));
  });

  it('updates pool metadata through the dedicated config endpoint', async () => {
    const auth = await login();

    const updated = await request('PUT', '/api/pools/OpaqueRef%3Apool1/config', {
      nameLabel: 'Production Pool West',
      nameDescription: 'Updated operator-facing pool summary for the west cluster.',
    }, auth.cookie);

    expect(updated.status).toBe(200);
    expect(updated.body).toEqual(expect.objectContaining({
      ref: 'OpaqueRef:pool1',
      name_label: 'Production Pool West',
      name_description: 'Updated operator-facing pool summary for the west cluster.',
    }));
  });
});
