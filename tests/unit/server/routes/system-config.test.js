const http = require('http');
const path = require('path');
const fs = require('fs');

const TEST_DB = path.join(__dirname, '..', '..', '..', 'data', 'system-config-routes.db');
const TEST_SECURITY_DB = path.join(__dirname, '..', '..', '..', 'data', 'system-config-security.db');
const TEST_VAULT_DB = path.join(__dirname, '..', '..', '..', 'data', 'system-config-vault.db');
const TEST_PERF_DB = path.join(__dirname, '..', '..', '..', 'data', 'system-config-perf.db');

process.env.DB_PATH = TEST_DB;
process.env.SECURITY_DB_PATH = TEST_SECURITY_DB;
process.env.VAULT_DB_PATH = TEST_VAULT_DB;
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

  actual.XenAPI.prototype.rpc = jest.fn(async function () {
    return {};
  });

  return actual;
});

const { getDb, settingsModel, deploymentRunModel } = require('../../../../server/models/connection');
const { authEventModel, getSecurityDb } = require('../../../../server/models/security-db');
const { getPerfDb, metricSampleModel, toHourlyBucket } = require('../../../../server/models/perf-db');
const config = require('../../../../server/config');
const credentialVaultService = require('../../../../server/services/credential-vault');
const governanceService = require('../../../../server/services/governance');
const app = require('../../../../server/index');

describe('System Config Routes', () => {
  let server;
  let port;

  beforeAll((done) => {
    if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
    if (fs.existsSync(TEST_SECURITY_DB)) fs.unlinkSync(TEST_SECURITY_DB);
    if (fs.existsSync(TEST_VAULT_DB)) fs.unlinkSync(TEST_VAULT_DB);
    if (fs.existsSync(TEST_PERF_DB)) fs.unlinkSync(TEST_PERF_DB);
    server = app.listen(0, () => {
      port = server.address().port;
      done();
    });
  });

  afterAll((done) => {
    server.close(() => {
      if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
      if (fs.existsSync(TEST_SECURITY_DB)) fs.unlinkSync(TEST_SECURITY_DB);
      if (fs.existsSync(TEST_VAULT_DB)) fs.unlinkSync(TEST_VAULT_DB);
      if (fs.existsSync(TEST_PERF_DB)) fs.unlinkSync(TEST_PERF_DB);
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
    return request('POST', '/api/auth/login', {
      username: 'admin',
      password: 'admin123!',
    });
  }

  async function xenLogin(cookie) {
    return request('POST', '/api/auth/xen-login', {
      host: '192.168.1.100',
      username: 'root',
      password: 'pass',
    }, cookie);
  }

  it('should return default system settings and seeded retention policies', async () => {
    const auth = await login();
    const res = await request('GET', '/api/settings', null, auth.cookie);

    expect(res.status).toBe(200);
    expect(res.body.general).toEqual(expect.objectContaining({
      appName: 'XenMange',
    }));
    expect(res.body.performance).toEqual(expect.objectContaining({
      collectionEnabled: true,
      collectionIntervalSeconds: 60,
    }));
    expect(Array.isArray(res.body.retentionPolicies)).toBe(true);
    expect(res.body.retentionPolicies.map((entry) => entry.domain)).toEqual(
      expect.arrayContaining(['audit-log', 'remediation-tasks', 'auth-events', 'template-deployment-runs', 'metric-samples', 'metric-hourly-rollups'])
    );
    expect(res.body.vault).toEqual(expect.objectContaining({
      usingDevelopmentFallback: true,
      hasConfiguredMasterKey: false,
      keySource: 'derived-development',
      staleCredentialCount: 0,
    }));
    expect(res.body.runtime.metricsCollector).toEqual(expect.objectContaining({
      enabled: true,
      intervalSeconds: 60,
    }));
    expect(res.body.controlPlaneBackup).toEqual(expect.objectContaining({
      enabled: false,
      intervalHours: 24,
    }));
  });

  it('should persist control-plane backup scheduling settings and refresh the scheduler', async () => {
    const auth = await login();

    const updated = await request('PUT', '/api/settings/controlPlaneBackup', {
      enabled: true,
      intervalHours: 6,
    }, auth.cookie);
    expect(updated.status).toBe(200);
    expect(updated.body.section).toEqual(expect.objectContaining({
      enabled: true,
      intervalHours: 6,
    }));

    const refreshed = await request('GET', '/api/settings', null, auth.cookie);
    expect(refreshed.body.controlPlaneBackup).toEqual(expect.objectContaining({
      enabled: true,
      intervalHours: 6,
    }));

    const reverted = await request('PUT', '/api/settings/controlPlaneBackup', {
      enabled: false,
      intervalHours: 24,
    }, auth.cookie);
    expect(reverted.status).toBe(200);
  });

  it('should persist settings updates and run retention previews and sweeps', async () => {
    const auth = await login();
    const freshTimestamp = new Date(Date.now() - 86400000).toISOString();
    const oldTimestamp = new Date(Date.now() - (200 * 86400000)).toISOString();
    const freshMetricTimestamp = new Date(freshTimestamp).getTime();
    const oldMetricTimestamp = new Date(oldTimestamp).getTime();

    const network = await request('PUT', '/api/settings/network', {
      publicBaseUrl: 'https://xenmange.example.com',
      trustProxy: true,
    }, auth.cookie);
    expect(network.status).toBe(200);
    expect(network.body.section).toEqual(expect.objectContaining({
      publicBaseUrl: 'https://xenmange.example.com',
      trustProxy: true,
    }));

    const retentionRuntime = await request('PUT', '/api/settings/retention', {
      sweepIntervalHours: 12,
      vacuumAfterSweep: true,
    }, auth.cookie);
    expect(retentionRuntime.status).toBe(200);
    expect(retentionRuntime.body.section.sweepIntervalHours).toBe(12);

    const performanceRuntime = await request('PUT', '/api/settings/performance', {
      collectionEnabled: false,
      collectionIntervalSeconds: 180,
    }, auth.cookie);
    expect(performanceRuntime.status).toBe(200);
    expect(performanceRuntime.body.section).toEqual(expect.objectContaining({
      collectionEnabled: false,
      collectionIntervalSeconds: 180,
    }));
    expect(performanceRuntime.body.runtime.metricsCollector).toEqual(expect.objectContaining({
      enabled: false,
      intervalSeconds: 180,
    }));

    const policy = await request('PUT', '/api/settings/retention/policies/audit-log', {
      retentionDays: 30,
      enabled: true,
    }, auth.cookie);
    expect(policy.status).toBe(200);
    expect(policy.body.retentionDays).toBe(30);

    settingsModel.set('activity.audit', JSON.stringify([
      {
        id: 'audit-old',
        category: 'alerts',
        summary: 'Old audit entry',
        happenedAt: oldTimestamp,
      },
      {
        id: 'audit-new',
        category: 'alerts',
        summary: 'Fresh audit entry',
        happenedAt: freshTimestamp,
      },
    ]));

    settingsModel.set('activity.remediationTasks', JSON.stringify([
      {
        ref: 'OpaqueRef:task-old',
        name_label: 'Old closed task',
        status: 'success',
        finished: oldTimestamp,
      },
      {
        ref: 'OpaqueRef:task-open',
        name_label: 'Old open task',
        status: 'in_progress',
        updated_at: oldTimestamp,
      },
      {
        ref: 'OpaqueRef:task-new',
        name_label: 'Fresh closed task',
        status: 'warning',
        finished: freshTimestamp,
      },
    ]));

    const event = authEventModel.create({
      username: 'root',
      event: 'xen_login',
      ip: '127.0.0.1',
      detail: 'Old auth event',
    });

    getSecurityDb().prepare('UPDATE auth_events SET created_at = ? WHERE id = ?')
      .run(oldTimestamp, event.id);

    const expiredDeploymentRun = deploymentRunModel.create({
      id: 'tmplrun-expired',
      deploymentAuditId: 'audit-expired',
      templateRef: 'OpaqueRef:template-expired',
      templateName: 'Ubuntu Baseline',
      vmRef: 'OpaqueRef:vm-expired',
      vmName: 'ubuntu-prod-01',
      status: 'success',
      progress: 1,
      submittedAt: oldTimestamp,
      finishedAt: oldTimestamp,
      validationStatus: 'validated',
      result: 'Deployment completed successfully.',
    }, [
      {
        key: 'clone',
        label: 'Clone Template',
        status: 'success',
        detail: 'Cloned successfully.',
      },
    ]);

    deploymentRunModel.create({
      id: 'tmplrun-warning',
      deploymentAuditId: 'audit-warning',
      templateRef: 'OpaqueRef:template-warning',
      templateName: 'Ubuntu Baseline',
      vmRef: 'OpaqueRef:vm-warning',
      vmName: 'ubuntu-prod-02',
      status: 'warning',
      progress: 0.9,
      submittedAt: freshTimestamp,
      validationStatus: 'warning',
      result: 'Deployment is waiting for operator review.',
    }, [
      {
        key: 'validation',
        label: 'Post-Deploy Validation',
        status: 'warning',
        detail: 'Awaiting operator review.',
      },
    ]);

    metricSampleModel.insertMany([
      {
        entityType: 'host',
        entityRef: 'OpaqueRef:host-old',
        metricName: 'memory_used_bytes',
        ts: oldMetricTimestamp,
        value: 2048,
      },
      {
        entityType: 'host',
        entityRef: 'OpaqueRef:host-new',
        metricName: 'memory_used_bytes',
        ts: freshMetricTimestamp,
        value: 1024,
      },
    ]);

    const preview = await request('GET', '/api/settings/retention/preview', null, auth.cookie);
    expect(preview.status).toBe(200);
    expect(preview.body.results).toEqual(expect.arrayContaining([
      expect.objectContaining({ domain: 'audit-log', candidateCount: 1 }),
      expect.objectContaining({ domain: 'remediation-tasks', candidateCount: 1 }),
      expect.objectContaining({ domain: 'auth-events', candidateCount: 1 }),
      expect.objectContaining({ domain: 'template-deployment-runs', candidateCount: 1 }),
      expect.objectContaining({ domain: 'metric-samples', candidateCount: 1 }),
      expect.objectContaining({ domain: 'metric-hourly-rollups', candidateCount: 1 }),
    ]));

    const run = await request('POST', '/api/settings/retention/run', {
      dryRun: false,
    }, auth.cookie);
    expect(run.status).toBe(200);
    expect(run.body.totalPurged).toBe(6);

    const auditEntries = JSON.parse(settingsModel.get('activity.audit'));
    expect(auditEntries.some((entry) => entry.id === 'audit-old')).toBe(false);
    expect(auditEntries.some((entry) => entry.id === 'audit-new')).toBe(true);
    expect(auditEntries.some((entry) => entry.action === 'retention_sweep_completed')).toBe(true);

    const remediationTasks = JSON.parse(settingsModel.get('activity.remediationTasks'));
    expect(remediationTasks.some((entry) => entry.ref === 'OpaqueRef:task-old')).toBe(false);
    expect(remediationTasks.some((entry) => entry.ref === 'OpaqueRef:task-open')).toBe(true);
    expect(remediationTasks.some((entry) => entry.ref === 'OpaqueRef:task-new')).toBe(true);

    const removedAuthEvent = getSecurityDb().prepare('SELECT * FROM auth_events WHERE id = ?').get(event.id);
    expect(removedAuthEvent).toBeUndefined();

    expect(deploymentRunModel.getById(expiredDeploymentRun.id)).toBeNull();
    expect(deploymentRunModel.getById('tmplrun-warning')).toEqual(expect.objectContaining({
      id: 'tmplrun-warning',
      status: 'warning',
    }));
    const removedRunSteps = getDb().prepare('SELECT COUNT(*) AS count FROM deployment_run_steps WHERE run_id = ?')
      .get(expiredDeploymentRun.id);
    expect(Number(removedRunSteps?.count || 0)).toBe(0);
    const remainingSamples = getPerfDb().prepare(`
      SELECT entity_ref, ts
      FROM metric_samples
      ORDER BY ts ASC
    `).all();
    expect(remainingSamples).toEqual([
      expect.objectContaining({
        entity_ref: 'OpaqueRef:host-new',
      }),
    ]);
    const remainingRollups = getPerfDb().prepare(`
      SELECT entity_ref, bucket_ts
      FROM metric_hourly_rollups
      ORDER BY bucket_ts ASC
    `).all();
    expect(remainingRollups).toEqual([
      expect.objectContaining({
        entity_ref: 'OpaqueRef:host-new',
        bucket_ts: toHourlyBucket(freshMetricTimestamp),
      }),
    ]);
  });

  it('should explicitly re-wrap legacy vault credentials during a staged key rotation window', async () => {
    const auth = await login();
    const previousCurrentKey = config.vault.encryptionKey;
    const previousRotationKey = config.vault.previousEncryptionKey;
    const originalEnvKey = process.env.VAULT_ENCRYPTION_KEY;
    const originalEnvPreviousKey = process.env.VAULT_ENCRYPTION_KEY_PREVIOUS;
    const oldKey = Buffer.alloc(32, 7).toString('base64');
    const newKey = Buffer.alloc(32, 9).toString('base64');

    try {
      config.vault.encryptionKey = oldKey;
      config.vault.previousEncryptionKey = '';
      process.env.VAULT_ENCRYPTION_KEY = oldKey;
      process.env.VAULT_ENCRYPTION_KEY_PREVIOUS = '';

      const created = await request('POST', '/api/credentials', {
        name: 'Legacy Rotation Credential',
        scope: 'private',
        targetType: 'pool',
        targetHint: '10.0.0.9',
        username: 'root',
        password: 'legacy-secret',
      }, auth.cookie);
      expect(created.status).toBe(201);

      config.vault.encryptionKey = newKey;
      config.vault.previousEncryptionKey = oldKey;
      process.env.VAULT_ENCRYPTION_KEY = newKey;
      process.env.VAULT_ENCRYPTION_KEY_PREVIOUS = oldKey;

      const before = await request('GET', '/api/settings', null, auth.cookie);
      expect(before.status).toBe(200);
      expect(before.body.vault).toEqual(expect.objectContaining({
        hasPreviousMasterKey: true,
        staleCredentialCount: 1,
      }));

      const rewrap = await request('POST', '/api/settings/vault/rewrap', {}, auth.cookie);
      expect(rewrap.status).toBe(200);
      expect(rewrap.body.result).toEqual(expect.objectContaining({
        scanned: 1,
        rewrapped: 1,
        alreadyCurrent: 0,
        failed: 0,
        staleRemaining: 0,
      }));
      expect(rewrap.body.vault).toEqual(expect.objectContaining({
        staleCredentialCount: 0,
      }));
      expect(credentialVaultService.getPassword(created.body.id, 1, 'admin')).toBe('legacy-secret');
    } finally {
      config.vault.encryptionKey = previousCurrentKey;
      config.vault.previousEncryptionKey = previousRotationKey;
      process.env.VAULT_ENCRYPTION_KEY = originalEnvKey;
      process.env.VAULT_ENCRYPTION_KEY_PREVIOUS = originalEnvPreviousKey;
    }
  });

  it('should require an approval before operator retention sweeps and accept an approved token', async () => {
    governanceService.updatePolicy({
      defaultRole: 'operator',
      requireDestructiveApproval: true,
      approvalTtlMinutes: 180,
    });

    const local = await login();
    const auth = await xenLogin(local.cookie);
    const lower = await request('PUT', '/api/governance/role', { role: 'operator' }, auth.cookie);
    expect(lower.status).toBe(200);

    const blocked = await request('POST', '/api/settings/retention/run', {
      dryRun: false,
    }, auth.cookie);
    expect(blocked.status).toBe(403);
    expect(blocked.body.error).toBe('APPROVAL_REQUIRED');

    const approval = await request('POST', '/api/governance/approvals', {
      actionKey: 'retention_sweep_run',
      entityType: 'retention-domain',
      entityRef: 'all',
      entityName: 'All Retention Domains',
      justification: 'Approved retention cleanup for Monday, August 24, 2026 validation.',
      route: '/settings',
    }, auth.cookie);
    expect(approval.status).toBe(201);

    const elevate = await request('PUT', '/api/governance/role', { role: 'admin' }, auth.cookie);
    expect(elevate.status).toBe(200);

    const decision = await request('POST', `/api/governance/approvals/${encodeURIComponent(approval.body.id)}/decision`, {
      decision: 'approved',
      notes: 'Approved for the Monday, August 24, 2026 cleanup validation run.',
    }, auth.cookie);
    expect(decision.status).toBe(200);
    expect(decision.body.status).toBe('approved');

    const lowerAgain = await request('PUT', '/api/governance/role', { role: 'operator' }, auth.cookie);
    expect(lowerAgain.status).toBe(200);

    const run = await request('POST', '/api/settings/retention/run', {
      dryRun: false,
      approvalId: approval.body.id,
    }, auth.cookie);
    expect(run.status).toBe(200);

    const governance = await request('GET', '/api/governance', null, auth.cookie);
    const usedApproval = governance.body.approvals.find((entry) => entry.id === approval.body.id);
    expect(usedApproval).toEqual(expect.objectContaining({
      id: approval.body.id,
      status: 'used',
      usedBy: 'admin',
    }));
  });
});
