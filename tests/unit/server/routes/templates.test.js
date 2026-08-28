const http = require('http');
const path = require('path');
const fs = require('fs');

const TEST_DB = path.join(__dirname, '..', '..', '..', 'data', 'templates-routes.db');

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

  actual.XenAPI.prototype.getRecord = jest.fn(async function (_className, ref) {
    if (ref === 'OpaqueRef:template1') {
      return {
        name_label: 'ubuntu-golden',
        uuid: 'template-uuid-1',
        is_a_template: true,
        tags: ['golden', 'linux'],
      };
    }

    return {
      name_label: 'ubuntu-prod-01',
      affinity: 'OpaqueRef:host1',
    };
  });

  actual.XenAPI.prototype.deployTemplate = jest.fn(async function (_ref, payload) {
    return {
      ref: 'OpaqueRef:vm9',
      name_label: payload.nameLabel,
      affinity: payload.hostRef,
      storageRef: payload.storageRef,
    };
  });

  actual.XenAPI.prototype.rpc = jest.fn(async function () {
    return {};
  });

  return actual;
});

const app = require('../../../../server/index');

describe('Template Routes', () => {
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
    const auth = await request('POST', '/api/auth/login', {
      username: 'admin',
      password: 'admin123!',
    });

    return request('POST', '/api/auth/xen-login', {
      host: '192.168.1.100',
      username: 'root',
      password: 'pass',
    }, auth.cookie);
  }

  it('should save and list template governance records', async () => {
    const auth = await login();
    const payload = {
      versionLabel: '2026.08-lts',
      profileLabel: 'Secure Linux',
      lifecycleStage: 'stable',
      goldenImage: true,
      guestCustomization: 'cloud-init baseline',
      validationStatus: 'validated',
      lastValidatedAt: '2026-08-19T00:00:00.000Z',
      owner: 'Platform Ops',
      notes: 'Approved for production rollout.',
    };

    const save = await request('PUT', '/api/vms/templates/OpaqueRef%3Atemplate1/governance', payload, auth.cookie);
    expect(save.status).toBe(200);
    expect(save.body.templateRef).toBe('OpaqueRef:template1');
    expect(save.body.versionLabel).toBe('2026.08-lts');

    const list = await request('GET', '/api/vms/templates/governance', null, auth.cookie);
    expect(list.status).toBe(200);
    expect(list.body.total).toBe(1);
    expect(list.body.data[0]).toEqual(expect.objectContaining({
      templateRef: 'OpaqueRef:template1',
      goldenImage: true,
      validationStatus: 'validated',
    }));

    const history = await request('GET', '/api/vms/templates/OpaqueRef%3Atemplate1/history', null, auth.cookie);
    expect(history.status).toBe(200);
    expect(history.body.data[0]).toEqual(expect.objectContaining({
      templateRef: 'OpaqueRef:template1',
      eventType: 'saved',
    }));
  });

  it('should promote a validated staged template and return governance history', async () => {
    const auth = await login();

    await request('PUT', '/api/vms/templates/OpaqueRef%3Atemplate1/governance', {
      versionLabel: '2026.07-lts',
      profileLabel: 'Secure Linux',
      lifecycleStage: 'stable',
      goldenImage: true,
      guestCustomization: 'cloud-init baseline',
      validationStatus: 'validated',
      lastValidatedAt: '2026-08-10T00:00:00.000Z',
      owner: 'Platform Ops',
      notes: 'Current stable baseline.',
    }, auth.cookie);

    await request('PUT', '/api/vms/templates/OpaqueRef%3Atemplate2/governance', {
      versionLabel: '2026.08-lts',
      profileLabel: 'Secure Linux',
      lifecycleStage: 'staged',
      goldenImage: true,
      guestCustomization: 'cloud-init baseline',
      validationStatus: 'validated',
      lastValidatedAt: '2026-08-20T00:00:00.000Z',
      owner: 'Platform Ops',
      notes: 'Candidate baseline.',
    }, auth.cookie);

    const promote = await request('POST', '/api/vms/templates/OpaqueRef%3Atemplate2/promote', {
      baselineTemplateRef: 'OpaqueRef:template1',
      retireExistingStable: true,
      promotionNotes: 'Promoted after the Monday, August 24, 2026 validation review.',
    }, auth.cookie);

    expect(promote.status).toBe(200);
    expect(promote.body.promoted).toEqual(expect.objectContaining({
      templateRef: 'OpaqueRef:template2',
      lifecycleStage: 'stable',
      goldenImage: true,
    }));
    expect(promote.body.deprecated[0]).toEqual(expect.objectContaining({
      templateRef: 'OpaqueRef:template1',
      lifecycleStage: 'deprecated',
      goldenImage: false,
    }));
    expect(Array.isArray(promote.body.history)).toBe(true);
    expect(promote.body.history.some((entry) => entry.eventType === 'promoted')).toBe(true);
  });

  it('should restore template governance from a saved history snapshot', async () => {
    const auth = await login();

    await request('PUT', '/api/vms/templates/OpaqueRef%3Atemplate1/governance', {
      versionLabel: '2026.08-lts',
      profileLabel: 'Secure Linux',
      lifecycleStage: 'stable',
      goldenImage: true,
      guestCustomization: 'cloud-init baseline',
      validationStatus: 'validated',
      lastValidatedAt: '2026-08-19T00:00:00.000Z',
      owner: 'Platform Ops',
      notes: 'Approved for production rollout.',
    }, auth.cookie);

    await request('PUT', '/api/vms/templates/OpaqueRef%3Atemplate1/governance', {
      versionLabel: '2026.08-lts',
      profileLabel: 'Secure Linux',
      lifecycleStage: 'stable',
      goldenImage: true,
      guestCustomization: 'cloud-init baseline',
      validationStatus: 'validated',
      lastValidatedAt: '2026-08-20T00:00:00.000Z',
      owner: 'Cloud Platform',
      notes: 'Candidate owner change.',
    }, auth.cookie);

    const history = await request('GET', '/api/vms/templates/OpaqueRef%3Atemplate1/history', null, auth.cookie);
    expect(history.status).toBe(200);
    const sourceEntry = history.body.data.find((entry) => entry.snapshot?.owner === 'Platform Ops');
    expect(sourceEntry).toBeTruthy();

    const restore = await request('POST', `/api/vms/templates/OpaqueRef%3Atemplate1/history/${encodeURIComponent(sourceEntry.id)}/restore`, {}, auth.cookie);
    expect(restore.status).toBe(200);
    expect(restore.body.record).toEqual(expect.objectContaining({
      templateRef: 'OpaqueRef:template1',
      owner: 'Platform Ops',
      notes: 'Approved for production rollout.',
    }));
    expect(Array.isArray(restore.body.history)).toBe(true);
    expect(restore.body.history[0]).toEqual(expect.objectContaining({
      eventType: 'restored',
    }));
  });

  it('should create deployment audit records and allow validation updates', async () => {
    const auth = await login();

    await request('PUT', '/api/vms/templates/OpaqueRef%3Atemplate1/governance', {
      versionLabel: '2026.08-lts',
      profileLabel: 'Secure Linux',
      lifecycleStage: 'stable',
      goldenImage: true,
      guestCustomization: 'cloud-init baseline',
      validationStatus: 'validated',
      lastValidatedAt: '2026-08-19T00:00:00.000Z',
      owner: 'Platform Ops',
      notes: 'Approved for production rollout.',
    }, auth.cookie);

    const deploy = await request('POST', '/api/vms/templates/OpaqueRef%3Atemplate1/deploy', {
      nameLabel: 'ubuntu-prod-01',
      hostRef: 'OpaqueRef:host1',
      storageRef: 'OpaqueRef:sr1',
      networkRef: 'OpaqueRef:net1',
      vcpus: 4,
      memoryStaticMax: 8589934592,
      tags: ['prod', 'linux'],
      startAfter: true,
    }, auth.cookie);

    expect(deploy.status).toBe(201);
    expect(deploy.body.ref).toBe('OpaqueRef:vm9');
    expect(deploy.body.deploymentAudit).toEqual(expect.objectContaining({
      templateRef: 'OpaqueRef:template1',
      vmName: 'ubuntu-prod-01',
      validationStatus: 'pending',
      policyTagged: true,
    }));
    expect(deploy.body.deploymentRun).toEqual(expect.objectContaining({
      task_kind: 'template_deployment',
      vm_ref: 'OpaqueRef:vm9',
      template_ref: 'OpaqueRef:template1',
      status: 'pending',
    }));

    const list = await request('GET', '/api/vms/templates/deployments', null, auth.cookie);
    expect(list.status).toBe(200);
    expect(list.body.total).toBe(1);
    expect(list.body.data[0].templateVersion).toBe('2026.08-lts');

    const tasks = await request('GET', '/api/tasks', null, auth.cookie);
    expect(tasks.status).toBe(200);
    expect(tasks.body.data.some((entry) =>
      entry.task_kind === 'template_deployment'
      && entry.vm_ref === 'OpaqueRef:vm9'
      && entry.validation_status === 'pending'
    )).toBe(true);

    const deploymentId = list.body.data[0].id;
    const update = await request('PUT', `/api/vms/templates/deployments/${encodeURIComponent(deploymentId)}/validation`, {
      validationStatus: 'validated',
      validationNotes: 'Boot and connectivity checks passed.',
      guestCustomization: 'cloud-init baseline',
      bootVerified: true,
      networkVerified: true,
      storageVerified: true,
      policyTagged: true,
    }, auth.cookie);

    expect(update.status).toBe(200);
    expect(update.body.validationStatus).toBe('validated');
    expect(update.body.bootVerified).toBe(true);
    expect(update.body.deploymentRun).toEqual(expect.objectContaining({
      task_kind: 'template_deployment',
      status: 'success',
      validation_status: 'validated',
      boot_verified: true,
    }));

    const audit = await request('GET', '/api/audit', null, auth.cookie);
    expect(audit.status).toBe(200);
    expect(audit.body.data.some((entry) =>
      entry.category === 'templates'
      && ['template_deployed', 'template_deployment_validated'].includes(entry.action)
    )).toBe(true);
  });
});
