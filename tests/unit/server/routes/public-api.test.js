const http = require('http');
const path = require('path');
const fs = require('fs');

const TEST_DB = path.join(__dirname, '..', '..', '..', 'data', 'public-api-routes.db');
const TEST_SECURITY_DB = path.join(__dirname, '..', '..', '..', 'data', 'public-api-routes-security.db');
const TEST_VAULT_DB = path.join(__dirname, '..', '..', '..', 'data', 'public-api-routes-vault.db');
const TEST_PERF_DB = path.join(__dirname, '..', '..', '..', 'data', 'public-api-routes-perf.db');

Object.assign(process.env, {
  DB_PATH: TEST_DB,
  SECURITY_DB_PATH: TEST_SECURITY_DB,
  VAULT_DB_PATH: TEST_VAULT_DB,
  PERF_DB_PATH: TEST_PERF_DB,
});

[TEST_DB, TEST_SECURITY_DB, TEST_VAULT_DB, TEST_PERF_DB].forEach((file) => {
  if (fs.existsSync(file)) fs.unlinkSync(file);
});

const app = require('../../../../server/index');
const identityService = require('../../../../server/services/identity');
const { userModel } = require('../../../../server/models/security-db');

describe('Public API v1 routes', () => {
  let server;
  let port;

  beforeAll((done) => {
    server = app.listen(0, () => {
      port = server.address().port;
      done();
    });
  });

  afterAll((done) => {
    server.close(() => {
      [TEST_DB, TEST_SECURITY_DB, TEST_VAULT_DB, TEST_PERF_DB].forEach((file) => {
        if (fs.existsSync(file)) fs.unlinkSync(file);
      });
      done();
    });
  });

  function request(pathname, headers = {}) {
    return new Promise((resolve, reject) => {
      http.get({ hostname: 'localhost', port, path: pathname, headers }, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(body) });
          } catch {
            resolve({ status: res.statusCode, body });
          }
        });
      }).on('error', reject);
    });
  }

  it('serves the OpenAPI document without requiring an API token', async () => {
    const res = await request('/api/v1/openapi.json');
    expect(res.status).toBe(200);
    expect(res.body.openapi).toBe('3.0.3');
    expect(res.body.paths['/workflows'].post.operationId).toBe('createWorkflow');
  });

  it('still requires a token for the rest of the v1 surface', async () => {
    const res = await request('/api/v1/');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('API_TOKEN_INVALID');
  });

  it('rejects an invalid bearer token the same way', async () => {
    const res = await request('/api/v1/managed-targets', { Authorization: 'Bearer not-a-real-token' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('API_TOKEN_INVALID');
  });

  describe('token IP restrictions', () => {
    let userId;

    beforeAll(() => {
      const admin = userModel.list().find((user) => user.username === 'admin');
      userId = admin.id;
    });

    it('accepts a token whose allowlist covers the loopback address the test client connects from', async () => {
      const token = identityService.createApiToken({
        userId, name: 'loopback-allowed', permissions: ['*'], allowedIps: ['127.0.0.1/32', '::1'],
      });
      const res = await request('/api/v1/managed-targets', { Authorization: `Bearer ${token.token}` });
      expect(res.status).toBe(200);
    });

    it('rejects a token whose allowlist excludes the connecting address', async () => {
      const token = identityService.createApiToken({
        userId, name: 'loopback-blocked', permissions: ['*'], allowedIps: ['10.0.0.0/8'],
      });
      const res = await request('/api/v1/managed-targets', { Authorization: `Bearer ${token.token}` });
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('API_TOKEN_INVALID');
    });

    it('allows any address when no allowlist is set', async () => {
      const token = identityService.createApiToken({ userId, name: 'unrestricted', permissions: ['*'] });
      const res = await request('/api/v1/managed-targets', { Authorization: `Bearer ${token.token}` });
      expect(res.status).toBe(200);
    });
  });
});
