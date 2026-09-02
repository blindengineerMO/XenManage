const http = require('http');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const TEST_DB = path.join(__dirname, '..', '..', '..', 'data', 'catalog-routes.db');
const TEST_SECURITY_DB = path.join(__dirname, '..', '..', '..', 'data', 'catalog-routes-security.db');

Object.assign(process.env, {
  DB_PATH: TEST_DB,
  SECURITY_DB_PATH: TEST_SECURITY_DB,
  NODE_ENV: 'test',
});

function removeDatabaseFiles(file) {
  [file, `${file}-wal`, `${file}-shm`].forEach((candidate) => {
    if (fs.existsSync(candidate)) fs.unlinkSync(candidate);
  });
}

[TEST_DB, TEST_SECURITY_DB].forEach(removeDatabaseFiles);

jest.mock('../../../../server/services/xenapi', () => {
  const actual = jest.requireActual('../../../../server/services/xenapi');
  actual.XenAPI.prototype.login = jest.fn(async function () {
    this.sessionRef = 'OpaqueRef:catalog-session';
    return this.sessionRef;
  });
  actual.XenAPI.prototype.getRecord = jest.fn(async () => ({ name_label: 'Ubuntu golden' }));
  actual.XenAPI.prototype.getPools = jest.fn(async () => ({ records: { 'OpaqueRef:pool1': { name_label: 'Catalog pool' } } }));
  actual.XenAPI.prototype.getHosts = jest.fn(async () => ({ records: { 'OpaqueRef:host1': { name_label: 'Catalog host', pool: 'OpaqueRef:pool1' } } }));
  actual.XenAPI.prototype.getVMs = jest.fn(async () => ({ records: {} }));
  actual.XenAPI.prototype.deployTemplate = jest.fn(async (_ref, payload) => ({
    ref: 'OpaqueRef:catalog-vm', name_label: payload.nameLabel, affinity: payload.hostRef, storageRef: payload.storageRef,
  }));
  actual.XenAPI.prototype.startVM = jest.fn(async () => true);
  actual.XenAPI.prototype.destroy = jest.fn(async () => true);
  return actual;
});

const { getDb, catalogModel, templateLibraryModel } = require('../../../../server/models/connection');
const { getSecurityDb, catalogRoleModel } = require('../../../../server/models/security-db');
const config = require('../../../../server/config');
const catalogApprovalHooks = require('../../../../server/services/catalog-approval-hooks');
const catalogLeases = require('../../../../server/services/catalog-leases');
const app = require('../../../../server/index');

describe('Catalog Routes', () => {
  let server;
  let port;
  let entry;

  beforeAll((done) => {
    server = app.listen(0, () => {
      port = server.address().port;
      done();
    });
  });

  beforeEach(() => {
    config.catalog.approvalHookAllowlist = [];
    config.catalog.approvalHookMaxAttempts = 3;
    getDb().prepare('DELETE FROM catalog_requests').run();
    getDb().prepare('DELETE FROM catalog_entries').run();
    getDb().prepare('DELETE FROM template_library_items').run();
    getSecurityDb().prepare("DELETE FROM users WHERE username != 'admin'").run();
    getSecurityDb().prepare(`UPDATE users SET password_hash = ?, role = 'admin', active = 1 WHERE username = 'admin'`)
      .run(bcrypt.hashSync('admin123!', 10));

    const source = templateLibraryModel.createItem({
      kind: 'deployment-template',
      name: 'Ubuntu baseline',
      content: JSON.stringify({
        templateRef: 'OpaqueRef:template1',
        options: { vcpus: 2, memoryStaticMax: 4294967296, startAfter: true },
      }),
      ownerUserId: 1,
    });
    entry = catalogModel.create({
      slug: 'ubuntu-server',
      title: 'Ubuntu Server',
      sourceItemId: source.id,
      sourceKind: source.kind,
      visibility: 'published',
      fixedVariables: { storageRef: 'OpaqueRef:private-sr', vcpus: 2, memoryStaticMax: 4294967296, diskSizeGb: 40 },
      costRates: { perVcpu: 12, perGiBRam: 4, perGiBDisk: 0.15 },
      subscriberFields: [{ key: 'hostname', label: 'Hostname', type: 'string', default: 'web-default' }],
      maxActivePerSubscriber: 1,
      leaseDurationHours: 24,
      ownerUserId: 1,
    });
  });

  afterAll((done) => {
    server.close(() => {
      [TEST_DB, TEST_SECURITY_DB].forEach(removeDatabaseFiles);
      done();
    });
  });

  function request(method, pathName, body, cookie) {
    return new Promise((resolve, reject) => {
      const data = body ? JSON.stringify(body) : null;
      const req = http.request({
        hostname: 'localhost',
        port,
        path: pathName,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
          ...(cookie ? { Cookie: cookie } : {}),
        },
      }, (res) => {
        let responseBody = '';
        res.on('data', (chunk) => responseBody += chunk);
        res.on('end', () => {
          const sessionCookie = res.headers['set-cookie']
            ?.find((value) => value.startsWith('xenmange.sid='))?.split(';')[0] || cookie;
          resolve({ status: res.statusCode, body: JSON.parse(responseBody), cookie: sessionCookie });
        });
      });
      req.on('error', reject);
      if (data) req.write(data);
      req.end();
    });
  }

  async function login(username, password) {
    return request('POST', '/api/auth/login', { username, password });
  }

  async function loginWithXen(username = 'admin', password = 'admin123!') {
    const auth = await login(username, password);
    return request('POST', '/api/auth/xen-login', { host: '192.168.1.100', username: 'root', password: 'pass' }, auth.cookie);
  }

  function createUser(username, catalogRole = 'subscriber') {
    const result = getSecurityDb().prepare(`INSERT INTO users (username, password_hash, display_name, role, active)
      VALUES (?, ?, ?, 'read-only', 1)`).run(username, bcrypt.hashSync('password123!', 10), username);
    if (catalogRole) catalogRoleModel.set(result.lastInsertRowid, catalogRole, 1);
    return Number(result.lastInsertRowid);
  }

  it('publishes only public entries and returns their detail', async () => {
    const source = templateLibraryModel.createItem({ kind: 'snippet', name: 'Draft source', content: '', ownerUserId: 1 });
    catalogModel.create({ slug: 'draft-entry', title: 'Draft', sourceItemId: source.id, sourceKind: source.kind, ownerUserId: 1 });

    const listed = await request('GET', '/api/catalog');
    const detail = await request('GET', '/api/catalog/ubuntu-server');
    const draft = await request('GET', '/api/catalog/draft-entry');

    expect(listed.body.entries).toEqual([expect.objectContaining({ slug: 'ubuntu-server' })]);
    expect(detail.status).toBe(200);
    expect(detail.body.entry.fixedVariables).toBeUndefined();
    expect(detail.body.entry.fixed_variables_json).toBeUndefined();
    expect(detail.body.entry.subscriberFields).toEqual([expect.objectContaining({ key: 'hostname' })]);
    expect(detail.body.entry.approvalPolicy).toBeUndefined();
    expect(draft).toEqual(expect.objectContaining({ status: 404, body: { error: 'CATALOG_ENTRY_NOT_FOUND' } }));
  });

  it('lets a signed-in requester submit, inspect, and cancel only their own pending request', async () => {
    createUser('subscriber-a');
    createUser('subscriber-b');
    const subscriberA = await login('subscriber-a', 'password123!');
    const subscriberB = await login('subscriber-b', 'password123!');

    const created = await request('POST', '/api/catalog/ubuntu-server/requests', { parameters: { hostname: 'web-01' } }, subscriberA.cookie);
    const mine = await request('GET', '/api/catalog/requests/mine', null, subscriberA.cookie);
    const otherUser = await request('POST', `/api/catalog/requests/${created.body.request.id}/cancel`, null, subscriberB.cookie);
    const cancelled = await request('POST', `/api/catalog/requests/${created.body.request.id}/cancel`, null, subscriberA.cookie);
    const nextRequest = await request('POST', '/api/catalog/ubuntu-server/requests', {}, subscriberA.cookie);
    const admin = await login('admin', 'admin123!');
    const approved = await request('PUT', `/api/catalog/admin/requests/${nextRequest.body.request.id}`, { status: 'approved' }, admin.cookie);

    expect(created.status).toBe(201);
    expect(mine.body.requests).toEqual([expect.objectContaining({ id: created.body.request.id, parameters: { hostname: 'web-01' } })]);
    expect(otherUser).toEqual(expect.objectContaining({ status: 404, body: { error: 'CATALOG_REQUEST_NOT_FOUND' } }));
    expect(cancelled.body.request.status).toBe('cancelled');
    expect(approved.body.request.generated_name).toBe('NODE-0001');
  });

  it('allows an administrator to review a pending request once', async () => {
    createUser('subscriber-a');
    const subscriber = await login('subscriber-a', 'password123!');
    const admin = await login('admin', 'admin123!');
    const created = await request('POST', '/api/catalog/ubuntu-server/requests', {}, subscriber.cookie);

    const approved = await request('PUT', `/api/catalog/admin/requests/${created.body.request.id}`, { status: 'approved' }, admin.cookie);
    const repeated = await request('PUT', `/api/catalog/admin/requests/${created.body.request.id}`, { status: 'rejected' }, admin.cookie);

    expect(approved.body.request.status).toBe('approved');
    expect(approved.body.request.generated_name).toBe('NODE-0001');
    expect(approved.body.request.decided_by_user_id).toBe(1);
    expect(approved.body.request.decided_at).toEqual(expect.any(String));
    expect(repeated).toEqual(expect.objectContaining({ status: 409, body: { error: 'CATALOG_REQUEST_NOT_PENDING' } }));
  });

  it('requires distinct administrators to complete an ordered multi-step approval chain', async () => {
    catalogModel.update(entry.id, {
      ...entry,
      sourceItemId: entry.source_item_id,
      sourceKind: entry.source_kind,
      approvalPolicy: { mode: 'multi-step', steps: ['Infrastructure review', 'Security review'] },
    });
    createUser('subscriber-a');
    createUser('catalog-admin-b', 'admin');
    const subscriber = await login('subscriber-a', 'password123!');
    const firstAdmin = await login('admin', 'admin123!');
    const secondAdmin = await login('catalog-admin-b', 'password123!');
    const created = await request('POST', '/api/catalog/ubuntu-server/requests', {}, subscriber.cookie);

    const firstApproval = await request('PUT', `/api/catalog/admin/requests/${created.body.request.id}`, { status: 'approved' }, firstAdmin.cookie);
    const repeatedApprover = await request('PUT', `/api/catalog/admin/requests/${created.body.request.id}`, { status: 'approved' }, firstAdmin.cookie);
    const finalApproval = await request('PUT', `/api/catalog/admin/requests/${created.body.request.id}`, { status: 'approved' }, secondAdmin.cookie);

    expect(firstApproval.body.request).toEqual(expect.objectContaining({ status: 'pending', generated_name: '' }));
    expect(firstApproval.body.request.approvalSteps).toEqual([
      expect.objectContaining({ step_order: 1, status: 'approved', decided_by_user_id: 1 }),
      expect.objectContaining({ step_order: 2, status: 'pending' }),
    ]);
    expect(repeatedApprover).toEqual(expect.objectContaining({ status: 409, body: { error: 'CATALOG_APPROVER_SEPARATION_REQUIRED' } }));
    expect(finalApproval.body.request).toEqual(expect.objectContaining({ status: 'approved', generated_name: 'NODE-0001' }));
    expect(finalApproval.body.request.approvalSteps[1]).toEqual(expect.objectContaining({ status: 'approved' }));
    expect(finalApproval.body.request.approvalSteps[1].decided_by_user_id).not.toBe(1);
  });

  it('rejects a multi-step request immediately from its active stage', async () => {
    catalogModel.update(entry.id, {
      ...entry,
      sourceItemId: entry.source_item_id,
      sourceKind: entry.source_kind,
      approvalPolicy: { mode: 'multi-step', steps: ['Capacity review', 'Owner review'] },
    });
    createUser('subscriber-a');
    const subscriber = await login('subscriber-a', 'password123!');
    const admin = await login('admin', 'admin123!');
    const created = await request('POST', '/api/catalog/ubuntu-server/requests', {}, subscriber.cookie);

    const rejected = await request('PUT', `/api/catalog/admin/requests/${created.body.request.id}`, { status: 'rejected' }, admin.cookie);

    expect(rejected.body.request.status).toBe('rejected');
    expect(rejected.body.request.approvalSteps).toEqual([
      expect.objectContaining({ status: 'rejected', label: 'Capacity review' }),
      expect.objectContaining({ status: 'pending', label: 'Owner review' }),
    ]);
  });

  it('immediately approves and reserves a name when an entry does not require approval', async () => {
    catalogModel.update(entry.id, {
      ...entry,
      sourceItemId: entry.source_item_id,
      sourceKind: entry.source_kind,
      namingPattern: 'FAST-XX',
      requiresApproval: false,
      approvalPolicy: { mode: 'auto' },
    });
    createUser('subscriber-a');
    const subscriber = await login('subscriber-a', 'password123!');

    const created = await request('POST', '/api/catalog/ubuntu-server/requests', {}, subscriber.cookie);

    expect(created.status).toBe(201);
    expect(created.body.request).toEqual(expect.objectContaining({
      status: 'approved',
      generated_name: 'FAST-01',
    }));
  });

  it('processes an explicit webhook approval from the durable attempt ledger', async () => {
    config.catalog.approvalHookAllowlist = ['approvals.example.test'];
    catalogModel.update(entry.id, {
      ...entry, sourceItemId: entry.source_item_id, sourceKind: entry.source_kind,
      approvalPolicy: { mode: 'webhook', url: 'https://approvals.example.test/decision', credentialId: 42 },
    });
    const submitted = catalogModel.createRequest(entry.id, 7, 'subscriber-a', { hostname: 'web-01' });
    const attempt = catalogModel.createHookAttempt(submitted.id);
    const due = catalogModel.listDueHookAttempts().find((candidate) => candidate.id === attempt.id);

    const result = await catalogApprovalHooks.processAttempt(due, {
      getSecret: () => 'encrypted-token',
      deliver: async () => ({ code: 200, body: '{"decision":"approved"}', decision: 'approved' }),
    });

    expect(result.status).toBe('complete');
    expect(catalogModel.listRequests().find((request) => request.id === submitted.id)).toEqual(expect.objectContaining({
      status: 'approved', generated_name: 'NODE-0001',
    }));
  });

  it('retries failed webhook attempts and leaves the request pending after exhaustion', async () => {
    config.catalog.approvalHookAllowlist = ['approvals.example.test'];
    config.catalog.approvalHookMaxAttempts = 2;
    catalogModel.update(entry.id, {
      ...entry, sourceItemId: entry.source_item_id, sourceKind: entry.source_kind,
      approvalPolicy: { mode: 'webhook', url: 'https://approvals.example.test/decision', credentialId: 42 },
    });
    const submitted = catalogModel.createRequest(entry.id, 7, 'subscriber-a', {});
    const attempt = catalogModel.createHookAttempt(submitted.id);
    const dependencies = { getSecret: () => 'token', deliver: async () => ({ error: 'CATALOG_APPROVAL_HOOK_TIMEOUT' }) };

    const first = await catalogApprovalHooks.processAttempt(catalogModel.listDueHookAttempts()[0], dependencies);
    getDb().prepare("UPDATE catalog_approval_hook_attempts SET next_attempt_at = CURRENT_TIMESTAMP WHERE id = ?").run(attempt.id);
    const second = await catalogApprovalHooks.processAttempt(catalogModel.listDueHookAttempts()[0], dependencies);

    expect(first.status).toBe('pending');
    expect(second).toEqual(expect.objectContaining({ status: 'failed', attempt_count: 2, last_error: 'CATALOG_APPROVAL_HOOK_TIMEOUT' }));
    expect(catalogModel.listRequests().find((request) => request.id === submitted.id).status).toBe('pending');
    config.catalog.approvalHookMaxAttempts = 3;
  });

  it('recovers an interrupted webhook attempt for processing after restart', () => {
    const submitted = catalogModel.createRequest(entry.id, 7, 'subscriber-a', {});
    const attempt = catalogModel.createHookAttempt(submitted.id);

    expect(catalogModel.claimHookAttempt(attempt.id)).toEqual(expect.objectContaining({
      status: 'processing', attempt_count: 1,
    }));
    expect(catalogModel.recoverProcessingHookAttempts()).toBe(1);
    expect(catalogModel.listDueHookAttempts()).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: attempt.id,
        status: 'pending',
        attempt_count: 1,
        last_error: 'CATALOG_APPROVAL_HOOK_PROCESS_RESTARTED',
      }),
    ]));
  });

  it('matches only exact or explicitly wildcarded approval-hook hosts', () => {
    config.catalog.approvalHookAllowlist = ['approvals.example.test'];
    expect(catalogApprovalHooks.allowedHookUrl('https://approvals.example.test/review')).toBeTruthy();
    expect(catalogApprovalHooks.allowedHookUrl('https://child.approvals.example.test/review')).toBeNull();
    config.catalog.approvalHookAllowlist = ['*.approvals.example.test'];
    expect(catalogApprovalHooks.allowedHookUrl('https://child.approvals.example.test/review')).toBeTruthy();
    expect(catalogApprovalHooks.allowedHookUrl('https://approvals.example.test.evil.test/review')).toBeNull();
  });

  it('fails closed on non-success hook responses and disables redirects', async () => {
    config.catalog.approvalHookAllowlist = ['approvals.example.test'];
    const originalFetch = global.fetch;
    global.fetch = jest.fn(async () => ({
      ok: false,
      status: 500,
      text: async () => '{"decision":"approved"}',
    }));

    try {
      const result = await catalogApprovalHooks.deliverHook({
        url: 'https://approvals.example.test/decision',
        token: 'secret-token',
        payload: { requestId: 27 },
      });

      expect(result).toEqual({ code: 500, body: '{"decision":"approved"}', decision: 'pending' });
      expect(global.fetch).toHaveBeenCalledWith(expect.any(URL), expect.objectContaining({
        redirect: 'manual',
        headers: expect.objectContaining({ 'x-xenmange-idempotency-key': 'catalog-request-27' }),
      }));
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('rejects invalid naming patterns when an administrator curates an entry', async () => {
    const source = templateLibraryModel.createItem({ kind: 'snippet', name: 'Application source', content: '', ownerUserId: 1 });
    const admin = await login('admin', 'admin123!');

    const response = await request('POST', '/api/catalog', {
      slug: 'invalid-name-pattern',
      title: 'Invalid naming pattern',
      sourceItemId: source.id,
      namingPattern: 'NODE-XX-WEB-XX',
    }, admin.cookie);

    expect(response).toEqual(expect.objectContaining({ status: 400, body: { error: 'CATALOG_NAMING_PATTERN_INVALID' } }));
  });

  it('accepts only HTTPS external image URLs for catalog cards', async () => {
    const source = templateLibraryModel.createItem({ kind: 'snippet', name: 'Image source', content: '', ownerUserId: 1 });
    const admin = await login('admin', 'admin123!');
    const response = await request('POST', '/api/catalog', {
      slug: 'unsafe-image', title: 'Unsafe image', sourceItemId: source.id, imageUrl: 'http://example.test/image.png',
    }, admin.cookie);

    expect(response).toEqual(expect.objectContaining({ status: 400, body: { error: 'CATALOG_IMAGE_URL_INVALID' } }));
  });

  it('versions catalog edits and requires current-version validation before publication', async () => {
    const source = templateLibraryModel.createItem({ kind: 'snippet', name: 'Versioned source', content: '{}', ownerUserId: 1 });
    const admin = await login('admin', 'admin123!');
    const created = await request('POST', '/api/catalog', {
      slug: 'versioned-app', title: 'Versioned App', sourceItemId: source.id, visibility: 'draft',
    }, admin.cookie);
    const premature = await request('POST', `/api/catalog/admin/entries/${created.body.entry.id}/publish`, {}, admin.cookie);
    const current = created.body.entry.currentVersion;
    const validated = await request('PUT', `/api/catalog/admin/entries/${created.body.entry.id}/versions/${current.id}/validation`, {
      validationStatus: 'validated', notes: 'Smoke deployment passed.',
    }, admin.cookie);
    const published = await request('POST', `/api/catalog/admin/entries/${created.body.entry.id}/publish`, {}, admin.cookie);
    const edited = await request('PUT', `/api/catalog/${created.body.entry.id}`, {
      slug: 'versioned-app', title: 'Versioned App v2', sourceItemId: source.id, visibility: 'draft',
    }, admin.cookie);
    const history = await request('GET', `/api/catalog/admin/entries/${created.body.entry.id}/versions`, null, admin.cookie);

    expect(created.body.entry).toEqual(expect.objectContaining({ visibility: 'draft', currentVersion: expect.objectContaining({ version_number: 1, validation_status: 'untested' }) }));
    expect(premature).toEqual(expect.objectContaining({ status: 409, body: { error: 'CATALOG_VERSION_VALIDATION_REQUIRED' } }));
    expect(validated.body.version).toEqual(expect.objectContaining({ lifecycle_stage: 'staged', validation_status: 'validated', validation_notes: 'Smoke deployment passed.' }));
    expect(published.body.entry).toEqual(expect.objectContaining({ visibility: 'published', currentVersion: expect.objectContaining({ lifecycle_stage: 'stable' }) }));
    expect(edited.body.entry).toEqual(expect.objectContaining({ visibility: 'draft', currentVersion: expect.objectContaining({ version_number: 2, validation_status: 'untested' }) }));
    expect(history.body.versions).toEqual([
      expect.objectContaining({ version_number: 2, validation_status: 'untested' }),
      expect.objectContaining({ version_number: 1, validation_status: 'validated' }),
    ]);
  });

  it('requires scoped catalog access and lets a catalog administrator grant it', async () => {
    const userId = createUser('viewer-a', 'viewer');
    const viewer = await login('viewer-a', 'password123!');
    const admin = await login('admin', 'admin123!');

    const denied = await request('POST', '/api/catalog/ubuntu-server/requests', {}, viewer.cookie);
    const granted = await request('PUT', `/api/catalog/admin/roles/${userId}`, { role: 'subscriber' }, admin.cookie);
    const submitted = await request('POST', '/api/catalog/ubuntu-server/requests', {}, viewer.cookie);

    expect(denied).toEqual(expect.objectContaining({ status: 403, body: { error: 'CATALOG_ROLE_REQUIRED' } }));
    expect(granted.body.role).toEqual(expect.objectContaining({ user_id: userId, role: 'subscriber' }));
    expect(submitted.status).toBe(201);
  });

  it('accepts declared subscriber fields and rejects undeclared parameters', async () => {
    createUser('subscriber-a');
    const subscriber = await login('subscriber-a', 'password123!');

    const accepted = await request('POST', '/api/catalog/ubuntu-server/requests', { parameters: { hostname: 'api-01' } }, subscriber.cookie);
    const rejected = await request('POST', '/api/catalog/ubuntu-server/requests', { parameters: { hostRef: 'OpaqueRef:override' } }, subscriber.cookie);

    expect(accepted.body.request.parameters_json).toBe(JSON.stringify({ hostname: 'api-01' }));
    expect(rejected).toEqual(expect.objectContaining({ status: 400, body: { error: 'CATALOG_PARAMETERS_INVALID' } }));
  });

  it('enforces each entry active-request quota per subscriber', async () => {
    createUser('subscriber-a');
    const subscriber = await login('subscriber-a', 'password123!');

    const first = await request('POST', '/api/catalog/ubuntu-server/requests', {}, subscriber.cookie);
    const second = await request('POST', '/api/catalog/ubuntu-server/requests', {}, subscriber.cookie);

    expect(first.status).toBe(201);
    expect(second).toEqual(expect.objectContaining({ status: 409, body: { error: 'CATALOG_REQUEST_QUOTA_EXCEEDED' } }));
  });

  it('deploys an approved request through the shared template deployment path', async () => {
    createUser('subscriber-a');
    const subscriber = await login('subscriber-a', 'password123!');
    const admin = await loginWithXen();
    const submitted = await request('POST', '/api/catalog/ubuntu-server/requests', {}, subscriber.cookie);
    const approved = await request('PUT', `/api/catalog/admin/requests/${submitted.body.request.id}`, { status: 'approved' }, admin.cookie);
    const deployed = await request('POST', `/api/catalog/admin/requests/${approved.body.request.id}/deploy`, {}, admin.cookie);

    expect(deployed.status).toBe(201);
    expect(deployed.body.request).toEqual(expect.objectContaining({
      status: 'complete', generated_name: 'NODE-0001', deployment_run_id: expect.any(String),
      lease_duration_hours: 24, lease_expires_at: expect.any(String),
      estimated_monthly_cost: 46, actual_monthly_cost: 46, cost_currency: 'USD',
    }));
    expect(deployed.body.deployment).toEqual(expect.objectContaining({
      ref: 'OpaqueRef:catalog-vm', deploymentRun: expect.objectContaining({ task_kind: 'template_deployment' }),
    }));
    expect(getDb().prepare('SELECT catalog_request_id FROM deployment_runs WHERE id = ?').get(deployed.body.request.deployment_run_id))
      .toEqual({ catalog_request_id: submitted.body.request.id });

    const subscriberWithXen = await loginWithXen('subscriber-a', 'password123!');
    createUser('subscriber-b');
    const otherSubscriber = await loginWithXen('subscriber-b', 'password123!');
    const denied = await request('POST', `/api/catalog/requests/${submitted.body.request.id}/actions`, { action: 'start' }, otherSubscriber.cookie);
    const started = await request('POST', `/api/catalog/requests/${submitted.body.request.id}/actions`, { action: 'start' }, subscriberWithXen.cookie);
    const analytics = await request('GET', '/api/catalog/admin/analytics', null, admin.cookie);
    const analyticsDenied = await request('GET', '/api/catalog/admin/analytics', null, subscriber.cookie);

    expect(denied).toEqual(expect.objectContaining({ status: 404, body: { error: 'CATALOG_REQUEST_NOT_FOUND' } }));
    expect(started.body).toEqual(expect.objectContaining({ action: 'start', vmRef: 'OpaqueRef:catalog-vm' }));
    expect(analytics.body).toEqual(expect.objectContaining({
      totals: expect.objectContaining({ requestVolume: 1, activeCount: 1 }),
      entries: expect.arrayContaining([expect.objectContaining({ title: 'Ubuntu Server', request_volume: 1, active_count: 1 })]),
    }));
    expect(analyticsDenied.status).toBe(403);

    getDb().prepare("UPDATE catalog_requests SET lease_expires_at = datetime('now', '-1 minute') WHERE id = ?").run(submitted.body.request.id);
    expect(catalogLeases.processDueLeases()).toEqual([
      expect.objectContaining({ id: submitted.body.request.id, generated_name: 'NODE-0001' }),
    ]);
    expect(catalogLeases.processDueLeases()).toEqual([]);
    expect(catalogModel.listRequestsForUser(getDb().prepare("SELECT requested_by FROM catalog_requests WHERE id = ?").get(submitted.body.request.id).requested_by)[0])
      .toEqual(expect.objectContaining({ status: 'expired', expired_at: expect.any(String) }));

    const reclaimed = await request('POST', `/api/catalog/requests/${submitted.body.request.id}/actions`, { action: 'decommission' }, subscriberWithXen.cookie);
    expect(reclaimed.body.request).toEqual(expect.objectContaining({ status: 'reclaimed' }));
  });
});
