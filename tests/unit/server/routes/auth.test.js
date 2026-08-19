const http = require('http');
const app = require('../../../../server/index');

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

  beforeAll((done) => {
    server = app.listen(0, () => {
      port = server.address().port;
      done();
    });
  });

  afterAll((done) => {
    server.close(done);
  });

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
        host: '192.168.1.100',
        username: 'root',
        password: 'fail',
      });
      expect(res.status).toBe(401);
    });

    it('should return success with valid credentials', async () => {
      const res = await request('POST', '/api/auth/login', {
        host: '192.168.1.100',
        username: 'root',
        password: 'pass',
      });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.cookie).toBeDefined();
    });

    it('should show authenticated status after login', async () => {
      // Login first
      const login = await request('POST', '/api/auth/login', {
        host: '192.168.1.100',
        username: 'root',
        password: 'pass',
      });
      const status = await request('GET', '/api/auth/status', null, login.cookie);
      expect(status.status).toBe(200);
      expect(status.body.authenticated).toBe(true);
      expect(status.body.host).toBe('192.168.1.100');
    });

    it('should access protected routes after login', async () => {
      const login = await request('POST', '/api/auth/login', {
        host: '192.168.1.100',
        username: 'root',
        password: 'pass',
      });
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
