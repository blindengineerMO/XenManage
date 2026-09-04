const http = require('http');
const path = require('path');
const fs = require('fs');

const TEST_DB = path.join(__dirname, '..', '..', '..', 'data', 'control-plane-backups-routes.db');
const TEST_SECURITY_DB = path.join(__dirname, '..', '..', '..', 'data', 'control-plane-backups-routes-security.db');
const TEST_VAULT_DB = path.join(__dirname, '..', '..', '..', 'data', 'control-plane-backups-routes-vault.db');
const TEST_PERF_DB = path.join(__dirname, '..', '..', '..', 'data', 'control-plane-backups-routes-perf.db');
const TEST_BACKUP_PATH = path.join(__dirname, '..', '..', '..', 'data', 'control-plane-backups-routes-snapshots');

Object.assign(process.env, {
  DB_PATH: TEST_DB,
  SECURITY_DB_PATH: TEST_SECURITY_DB,
  VAULT_DB_PATH: TEST_VAULT_DB,
  PERF_DB_PATH: TEST_PERF_DB,
  CONTROL_PLANE_BACKUP_PATH: TEST_BACKUP_PATH,
});

function cleanup() {
  [TEST_DB, TEST_SECURITY_DB, TEST_VAULT_DB, TEST_PERF_DB].forEach((file) => {
    if (fs.existsSync(file)) fs.unlinkSync(file);
  });
  if (fs.existsSync(TEST_BACKUP_PATH)) fs.rmSync(TEST_BACKUP_PATH, { recursive: true, force: true });
}

cleanup();

const app = require('../../../../server/index');

describe('Control-plane backup routes', () => {
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
      cleanup();
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
    return request('POST', '/api/auth/login', { username: 'admin', password: 'admin123!' });
  }

  it('creates a snapshot with per-database checksums and lists it', async () => {
    const auth = await login();

    const created = await request('POST', '/api/control-plane-backups', null, auth.cookie);
    expect(created.status).toBe(201);
    expect(created.body.snapshot.databases).toEqual(['xenmange.db', 'security.db', 'vault.db', 'perf.db']);
    expect(Object.keys(created.body.snapshot.checksums)).toEqual(['xenmange.db', 'security.db', 'vault.db', 'perf.db']);

    const list = await request('GET', '/api/control-plane-backups', null, auth.cookie);
    expect(list.status).toBe(200);
    expect(list.body.snapshots.find((entry) => entry.id === created.body.snapshot.id)).toBeTruthy();
  });

  it('verifies a snapshot as ok when the backed-up files are untouched', async () => {
    const auth = await login();

    const created = await request('POST', '/api/control-plane-backups', null, auth.cookie);
    const verified = await request('POST', `/api/control-plane-backups/${created.body.snapshot.id}/verify`, null, auth.cookie);

    expect(verified.status).toBe(200);
    expect(verified.body.overallStatus).toBe('ok');
    expect(verified.body.databases).toHaveLength(4);
    verified.body.databases.forEach((entry) => {
      expect(entry.status).toBe('ok');
    });
  });

  it('flags a snapshot as tampered when a backed-up file no longer matches its recorded checksum', async () => {
    const auth = await login();

    const created = await request('POST', '/api/control-plane-backups', null, auth.cookie);
    const tamperedPath = path.join(TEST_BACKUP_PATH, created.body.snapshot.id, 'perf.db');
    fs.appendFileSync(tamperedPath, 'tampered-bytes');

    const verified = await request('POST', `/api/control-plane-backups/${created.body.snapshot.id}/verify`, null, auth.cookie);
    expect(verified.status).toBe(200);
    expect(verified.body.overallStatus).toBe('issues_found');
    const perfEntry = verified.body.databases.find((entry) => entry.name === 'perf.db');
    expect(perfEntry.status).toBe('checksum_mismatch');
  });

  it('returns 404 for an unknown snapshot id', async () => {
    const auth = await login();
    const verified = await request('POST', '/api/control-plane-backups/does-not-exist/verify', null, auth.cookie);
    expect(verified.status).toBe(404);
    expect(verified.body.error).toBe('SNAPSHOT_NOT_FOUND');
  });

  it('previews a restore with no changes when the live databases are untouched since the snapshot', async () => {
    const auth = await login();

    const created = await request('POST', '/api/control-plane-backups', null, auth.cookie);
    const preview = await request('GET', `/api/control-plane-backups/${created.body.snapshot.id}/restore-preview`, null, auth.cookie);

    expect(preview.status).toBe(200);
    expect(preview.body.databases).toHaveLength(4);
    preview.body.databases.forEach((entry) => {
      expect(entry.status).toBe('no_changes_detected');
    });
  });

  it('previews a restore that would change row counts after the live database is modified', async () => {
    const auth = await login();

    const created = await request('POST', '/api/control-plane-backups', null, auth.cookie);
    const secondUser = await request('POST', '/api/users', {
      username: 'restore-preview-user',
      password: 'RestorePreview123!',
      displayName: 'Restore Preview User',
      role: 'operator',
      active: true,
    }, auth.cookie);
    expect(secondUser.status).toBe(201);

    const preview = await request('GET', `/api/control-plane-backups/${created.body.snapshot.id}/restore-preview`, null, auth.cookie);
    expect(preview.status).toBe(200);
    const securityEntry = preview.body.databases.find((entry) => entry.name === 'security.db');
    expect(securityEntry.status).toBe('would_change');
    const usersChange = securityEntry.rowCountChanges.find((entry) => entry.table === 'users');
    expect(usersChange.delta).toBeGreaterThan(0);
  });

  it('returns 404 for a restore preview of an unknown snapshot id', async () => {
    const auth = await login();
    const preview = await request('GET', '/api/control-plane-backups/does-not-exist/restore-preview', null, auth.cookie);
    expect(preview.status).toBe(404);
    expect(preview.body.error).toBe('SNAPSHOT_NOT_FOUND');
  });

  it('rejects a non-admin session', async () => {
    const auth = await login();
    const created = await request('POST', '/api/users', {
      username: 'backup-operator',
      password: 'BackupOperator123!',
      displayName: 'Backup Operator',
      role: 'operator',
      active: true,
    }, auth.cookie);
    expect(created.status).toBe(201);

    const operatorAuth = await request('POST', '/api/auth/login', {
      username: 'backup-operator',
      password: 'BackupOperator123!',
    });

    const attempt = await request('POST', '/api/control-plane-backups', null, operatorAuth.cookie);
    expect(attempt.status).toBe(403);
    expect(attempt.body.error).toBe('ADMIN_ROLE_REQUIRED');
  });
});
