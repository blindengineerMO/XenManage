const http = require('http');
const app = require('../../../../server/index');
const { clearConnections } = require('../../../../server/services/xenapi');

jest.mock('../../../../server/services/xenapi', () => {
  const actual = jest.requireActual('../../../../server/services/xenapi');

  // Mock login to fake success/failure
  actual.XenAPI.prototype.login = jest.fn(async function (username, password) {
    if (password === 'fail') {
      throw new Error('SESSION_AUTHENTICATION_FAILED');
    }
    this.sessionRef = 'OpaqueRef:mock-session';
    return this.sessionRef;
  });

  actual.XenAPI.prototype.logout = jest.fn(async function () {
    this.sessionRef = null;
  });

  // Mock rpc so no real HTTP calls are made by protected routes
  actual.XenAPI.prototype.rpc = jest.fn(async function (method) {
    // get_all_records returns records keyed by ref
    if (method.includes('get_all_records')) return {};
    // get_all returns array of refs
    if (method.includes('get_all')) return [];
    // get_record returns a record object
    if (method.includes('get_record')) return {};
    // get_field returns null
    if (method.includes('get_')) return null;
    // session methods handled by mocked login/logout
    return {};
  });

  return actual;
});

describe('Auth Routes', () => {
  let server;
  let port;

  beforeEach(() => {
    clearConnections();
  });

  beforeAll((done) => {
    server = app.listen(0, () => {
      port = server.address().port;
      done();
    });
  });

  afterAll((done) => {
    server.close(done);
  });

  function appLogin(cookie) {
    return request('POST', '/api/auth/login', {
      username: 'admin',
      password: 'admin123!',
    }, cookie);
  }

  function xenLogin(cookie, overrides = {}) {
    return request('POST', '/api/auth/xen-login', {
      host: '192.168.1.100',
      username: 'root',
      password: 'pass',
      ...overrides,
    }, cookie);
  }

  function request(method, path, body, cookie) {
    return new Promise((resolve, reject) => {
      const data = body ? JSON.stringify(body) : null;
      const opts = {
        hostname: 'localhost',
        port,
        path,
        method,
        headers: { 'Content-Type': 'application/json' },
      };
      if (data) opts.headers['Content-Length'] = Buffer.byteLength(data);
      if (cookie) opts.headers['Cookie'] = cookie;

      const req = http.request(opts, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => {
          const setCookie = res.headers['set-cookie'];
          let sessionCookie = cookie;
          if (setCookie) {
            const match = setCookie.find(c => c.startsWith('xenmange.sid='));
            if (match) sessionCookie = match.split(';')[0];
          }
          try {
            resolve({ status: res.statusCode, body: JSON.parse(body), cookie: sessionCookie });
          } catch {
            resolve({ status: res.statusCode, body, cookie: sessionCookie });
          }
        });
      });
      req.on('error', reject);
      if (data) req.write(data);
      req.end();
    });
  }

  describe('GET /api/auth/status', () => {
    it('should return unauthenticated by default', async () => {
      const res = await request('GET', '/api/auth/status');
      expect(res.status).toBe(200);
      expect(res.body.authenticated).toBe(false);
      expect(res.body.connected).toBe(false);
    });
  });

  describe('POST /api/auth/login', () => {
    it('should reject missing fields', async () => {
      const res = await request('POST', '/api/auth/login', {});
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VALIDATION_ERROR');
    });

    it('should reject invalid credentials', async () => {
      const res = await request('POST', '/api/auth/login', {
        username: 'admin',
        password: 'fail',
      });
      expect(res.status).toBe(401);
    });

    it('should return success with valid local credentials', async () => {
      const res = await appLogin();
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.connected).toBe(false);
      expect(res.body.authMode).toBe('local');
      expect(res.body.user).toEqual(expect.objectContaining({
        username: 'admin',
      }));
      expect(res.body.governance).toEqual(expect.objectContaining({
        currentRole: expect.any(String),
        policy: expect.any(Object),
      }));
      expect(res.cookie).toBeDefined();
    });

    it('should show authenticated local status after login', async () => {
      const login = await appLogin();
      const status = await request('GET', '/api/auth/status', null, login.cookie);
      expect(status.status).toBe(200);
      expect(status.body.authenticated).toBe(true);
      expect(status.body.connected).toBe(false);
      expect(status.body.host).toBe('');
      expect(status.body.currentTargetKey).toBe('');
      expect(status.body.connectedTargets).toEqual([]);
      expect(status.body.username).toBe('admin');
      expect(status.body.governance).toEqual(expect.objectContaining({
        currentRole: expect.any(String),
        policy: expect.any(Object),
      }));
    });

    it('should access control-plane routes after local login', async () => {
      const login = await appLogin();
      const audit = await request('GET', '/api/audit', null, login.cookie);
      expect(audit.status).toBe(200);
    });
  });

  describe('POST /api/auth/xen-login', () => {
    it('should reject missing fields', async () => {
      const res = await request('POST', '/api/auth/xen-login', {});
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VALIDATION_ERROR');
    });

    it('should require a local XenMange session before attaching a Xen target', async () => {
      const res = await xenLogin();
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('LOCAL_USER_REQUIRED');
    });

    it('should reject invalid xen credentials', async () => {
      const local = await appLogin();
      const res = await xenLogin(local.cookie, { password: 'fail' });
      expect(res.status).toBe(401);
    });

    it('should return success with valid xen credentials', async () => {
      const local = await appLogin();
      const res = await xenLogin(local.cookie);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.connected).toBe(true);
      expect(res.body.host).toBe('192.168.1.100');
      expect(res.body.username).toBe('admin');
      expect(res.body.authMode).toBe('local');
      expect(res.body.currentTargetKey).toBe('host:192.168.1.100|user:root|port:443');
      expect(res.body.connectedTargets).toEqual([
        expect.objectContaining({
          targetKey: 'host:192.168.1.100|user:root|port:443',
          host: '192.168.1.100',
          username: 'root',
          active: true,
        }),
      ]);
      expect(res.body.governance).toEqual(expect.objectContaining({
        currentRole: expect.any(String),
        policy: expect.any(Object),
      }));
      expect(res.cookie).toBeDefined();
    });

    it('should show authenticated xen status after login', async () => {
      const local = await appLogin();
      const login = await xenLogin(local.cookie);
      const status = await request('GET', '/api/auth/status', null, login.cookie);
      expect(status.status).toBe(200);
      expect(status.body.authenticated).toBe(true);
      expect(status.body.connected).toBe(true);
      expect(status.body.host).toBe('192.168.1.100');
      expect(status.body.username).toBe('admin');
      expect(status.body.authMode).toBe('local');
      expect(status.body.connectedTargets).toHaveLength(1);
    });

    it('should access xen-backed routes after xen login', async () => {
      const local = await appLogin();
      const login = await xenLogin(local.cookie);
      const dash = await request('GET', '/api/dashboard', null, login.cookie);
      expect(dash.status).toBe(200);
    });

    it('should attach a xen target to an existing local app session', async () => {
      const local = await appLogin();
      const xen = await xenLogin(local.cookie);
      expect(xen.status).toBe(200);
      expect(xen.body.connected).toBe(true);
      expect(xen.body.user).toEqual(expect.objectContaining({
        username: 'admin',
      }));
      expect(xen.body.username).toBe('admin');
    });

    it('should activate and detach live xen targets within a control-plane session', async () => {
      const local = await appLogin();
      const first = await xenLogin(local.cookie, { connectionId: 1, connectionName: 'Production Pool' });
      expect(first.status).toBe(200);
      expect(first.body.connectedTargets).toHaveLength(1);

      const second = await request('POST', '/api/auth/xen-login', {
        host: '192.168.1.101',
        username: 'root',
        password: 'pass',
        connectionId: 2,
        connectionName: 'Recovery Pool',
      }, first.cookie);
      expect(second.status).toBe(200);
      expect(second.body.connectedTargets).toHaveLength(2);
      expect(second.body.currentTargetKey).toBe('connection:2');

      const activated = await request('POST', '/api/auth/targets/activate', {
        connectionId: 1,
      }, second.cookie);
      expect(activated.status).toBe(200);
      expect(activated.body.currentTargetKey).toBe('connection:1');
      expect(activated.body.connectedTargets.find((target) => target.targetKey === 'connection:1')?.active).toBe(true);

      const detached = await request('DELETE', '/api/auth/targets/connection%3A1', null, second.cookie);
      expect(detached.status).toBe(200);
      expect(detached.body.currentTargetKey).toBe('connection:2');
      expect(detached.body.connectedTargets).toHaveLength(1);
    });

    it('should rehydrate a Xen connection from session data when in-memory state is lost', async () => {
      const local = await appLogin();
      const login = await xenLogin(local.cookie);

      clearConnections();

      const status = await request('GET', '/api/auth/status', null, login.cookie);
      expect(status.status).toBe(200);
      expect(status.body.connected).toBe(true);

      const dash = await request('GET', '/api/dashboard', null, login.cookie);
      expect(dash.status).toBe(200);
    });
  });

  describe('Protected routes', () => {
    it('should return 401 for unauthenticated API calls', async () => {
      const res = await request('GET', '/api/dashboard');
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('NOT_AUTHENTICATED');
    });

    it('should return 401 for VMs', async () => {
      const res = await request('GET', '/api/vms');
      expect(res.status).toBe(401);
    });

    it('should return 401 for hosts', async () => {
      const res = await request('GET', '/api/hosts');
      expect(res.status).toBe(401);
    });

    it('should return 401 for storage', async () => {
      const res = await request('GET', '/api/storage');
      expect(res.status).toBe(401);
    });

    it('should return 401 for networks', async () => {
      const res = await request('GET', '/api/networks');
      expect(res.status).toBe(401);
    });

    it('should return 401 for tasks', async () => {
      const res = await request('GET', '/api/tasks');
      expect(res.status).toBe(401);
    });

    it('should return 401 for resilience', async () => {
      const res = await request('GET', '/api/resilience');
      expect(res.status).toBe(401);
    });

    it('should return 401 for resilience plans', async () => {
      const res = await request('GET', '/api/resilience/plans');
      expect(res.status).toBe(401);
    });

    it('should return 401 for resilience drills', async () => {
      const res = await request('GET', '/api/resilience/drills');
      expect(res.status).toBe(401);
    });

    it('should return 401 for lifecycle plans', async () => {
      const res = await request('GET', '/api/lifecycle/plans');
      expect(res.status).toBe(401);
    });

    it('should return 401 for alerts', async () => {
      const res = await request('GET', '/api/alerts');
      expect(res.status).toBe(401);
    });

    it('should return 401 for template governance', async () => {
      const res = await request('GET', '/api/vms/templates/governance');
      expect(res.status).toBe(401);
    });

    it('should return 401 for audit log', async () => {
      const res = await request('GET', '/api/audit');
      expect(res.status).toBe(401);
    });

    it('should return 401 for governance', async () => {
      const res = await request('GET', '/api/governance');
      expect(res.status).toBe(401);
    });
  });

  describe('API 404', () => {
    it('should return 404 for unknown API routes', async () => {
      const res = await request('GET', '/api/nonexistent');
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('NOT_FOUND');
    });
  });

  describe('SPA fallback', () => {
    it('should serve index.html for non-API routes', async () => {
      const res = await request('GET', '/vms');
      expect(res.status).toBe(200);
      expect(typeof res.body).toBe('string');
      expect(res.body).toContain('XenMange');
    });
  });
});
