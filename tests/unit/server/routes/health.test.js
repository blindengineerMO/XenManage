const http = require('http');
const path = require('path');
const fs = require('fs');

const TEST_DB = path.join(__dirname, '..', '..', '..', 'data', 'health-routes.db');
const TEST_SECURITY_DB = path.join(__dirname, '..', '..', '..', 'data', 'health-routes-security.db');
const TEST_VAULT_DB = path.join(__dirname, '..', '..', '..', 'data', 'health-routes-vault.db');
const TEST_PERF_DB = path.join(__dirname, '..', '..', '..', 'data', 'health-routes-perf.db');

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

describe('Health Routes', () => {
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

  function request(pathname) {
    return new Promise((resolve, reject) => {
      http.get({ hostname: 'localhost', port, path: pathname }, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(body) }));
      }).on('error', reject);
    });
  }

  it('returns a lightweight liveness response', async () => {
    await expect(request('/healthz')).resolves.toEqual({ status: 200, body: { status: 'ok' } });
  });

  it('reports database and managed-target readiness', async () => {
    const response = await request('/readyz');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ready');
    expect(response.body.databases).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'controlPlane', ok: true }),
      expect.objectContaining({ name: 'security', ok: true }),
      expect.objectContaining({ name: 'vault', ok: true }),
      expect.objectContaining({ name: 'performance', ok: true }),
    ]));
    expect(response.body.managedTargets).toEqual({ enabled: 0, healthy: 0, unhealthy: 0 });
  });
});
