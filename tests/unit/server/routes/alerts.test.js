const http = require('http');
const path = require('path');
const fs = require('fs');

const TEST_DB = path.join(__dirname, '..', '..', '..', 'data', 'alerts-routes.db');
const TEST_PERF_DB = path.join(__dirname, '..', '..', '..', 'data', 'alerts-routes-perf.db');

process.env.DB_PATH = TEST_DB;
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

  actual.XenAPI.prototype.getMessages = jest.fn(async function () {
    return {
      'OpaqueRef:msg1': {
        name: 'Storage nearing threshold',
        cls: 'SR',
        body: 'Primary SR crossed the warning threshold.',
        timestamp: '2026-08-19T12:00:00.000Z',
        uuid: 'msg-uuid-1',
        obj_uuid: 'sr-uuid-1',
      },
      'OpaqueRef:msg2': {
        name: 'Host maintenance scheduled',
        cls: 'host',
        body: 'alpha-xen entered a maintenance preparation window.',
        timestamp: '2026-08-19T11:40:00.000Z',
        uuid: 'msg-uuid-2',
        obj_uuid: 'host-uuid-1',
      },
      'OpaqueRef:msg3': {
        name: 'VM interface flapping',
        cls: 'VIF',
        body: 'The primary workload interface is reporting intermittent connectivity.',
        timestamp: '2026-08-19T11:35:00.000Z',
        uuid: 'msg-uuid-3',
        obj_uuid: 'vif-uuid-1',
      },
      'OpaqueRef:msg4': {
        name: 'Recovery VLAN drift detected',
        cls: 'VLAN',
        body: 'The recovery uplink is reporting VLAN tag drift on the standby path.',
        timestamp: '2026-08-19T11:30:00.000Z',
        uuid: 'msg-uuid-4',
        obj_uuid: 'vlan-uuid-1',
      },
    };
  });

  actual.XenAPI.prototype.getAllRecords = jest.fn(async function (className) {
    if (className === 'VIF') {
      return {
        'OpaqueRef:vif1': {
          uuid: 'vif-uuid-1',
        },
      };
    }
    if (className === 'VLAN') {
      return {
        'OpaqueRef:vlan1': {
          uuid: 'vlan-uuid-1',
          tagged_PIF: 'OpaqueRef:pif2',
        },
      };
    }
    return {};
  });

  actual.XenAPI.prototype.getHosts = jest.fn(async function () {
    return {
      records: {
        'OpaqueRef:host1': {
          name_label: 'alpha-xen',
          uuid: 'host-uuid-1',
        },
      },
    };
  });

  actual.XenAPI.prototype.getSRs = jest.fn(async function () {
    return {
      records: {
        'OpaqueRef:sr1': {
          name_label: 'Primary SR',
          uuid: 'sr-uuid-1',
        },
      },
    };
  });

  actual.XenAPI.prototype.rpc = jest.fn(async function () {
    return {};
  });

  return actual;
});

const app = require('../../../../server/index');
const { settingsModel } = require('../../../../server/models/connection');
const { getPerfDb, metricSampleModel } = require('../../../../server/models/perf-db');
const { buildSyntheticRef } = require('../../../../server/services/telemetry-alerts');

describe('Alerts Routes', () => {
  let server;
  let port;

  beforeAll((done) => {
    if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
    if (fs.existsSync(TEST_PERF_DB)) fs.unlinkSync(TEST_PERF_DB);
    server = app.listen(0, () => {
      port = server.address().port;
      done();
    });
  });

  beforeEach(() => {
    settingsModel.set('alerts.state', '{}');
    settingsModel.set('alerts.policies', '[]');
    getPerfDb().prepare('DELETE FROM metric_samples').run();
    getPerfDb().prepare('DELETE FROM metric_hourly_rollups').run();
    metricSampleModel.insertMany([
      {
        entityType: 'host',
        entityRef: 'OpaqueRef:host1',
        metricName: 'memory_used_percent',
        ts: Date.now() - 5 * 60 * 1000,
        value: 91.4,
      },
      {
        entityType: 'sr',
        entityRef: 'OpaqueRef:sr1',
        metricName: 'utilization_percent',
        ts: Date.now() - 5 * 60 * 1000,
        value: 95.2,
      },
    ]);
  });

  afterAll((done) => {
    server.close(() => {
      if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
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

  it('should list enriched alerts', async () => {
    const auth = await login();
    const res = await request('GET', '/api/alerts', null, auth.cookie);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(6);
    const xenAlert = res.body.data.find((entry) => entry.ref === 'OpaqueRef:msg1');
    expect(xenAlert).toEqual(expect.objectContaining({
      ref: 'OpaqueRef:msg1',
      summary: 'Storage nearing threshold',
      targetRoute: '/storage',
      stateLabel: 'open',
    }));
    const vifAlert = res.body.data.find((entry) => entry.ref === 'OpaqueRef:msg3');
    expect(vifAlert).toEqual(expect.objectContaining({
      ref: 'OpaqueRef:msg3',
      targetRoute: '/networking',
      object_ref: 'OpaqueRef:vif1',
      summary: 'VM interface flapping',
    }));
    const vlanAlert = res.body.data.find((entry) => entry.ref === 'OpaqueRef:msg4');
    expect(vlanAlert).toEqual(expect.objectContaining({
      ref: 'OpaqueRef:msg4',
      targetRoute: '/networking',
      object_ref: 'OpaqueRef:pif2',
      summary: 'Recovery VLAN drift detected',
    }));
    const telemetryAlert = res.body.data.find((entry) => entry.ref === buildSyntheticRef('host', 'memory_used_percent', 'OpaqueRef:host1'));
    expect(telemetryAlert).toEqual(expect.objectContaining({
      targetRoute: '/hosts',
      effectiveSeverity: 'warning',
      summary: 'alpha-xen memory pressure elevated',
    }));
  });

  it('should persist operator alert state', async () => {
    const auth = await login();
    const payload = {
      acknowledged: true,
      suppressionUntil: '2026-08-20T14:00:00.000Z',
      severityOverride: 'info',
      healthAction: 'review',
      notes: 'Handled during the current maintenance window.',
    };

    const res = await request('PUT', '/api/alerts/OpaqueRef%3Amsg1/state', payload, auth.cookie);
    expect(res.status).toBe(200);
    expect(res.body.acknowledged).toBe(true);
    expect(res.body.severityOverride).toBe('info');
    expect(res.body.healthAction).toBe('review');
    expect(res.body.acknowledgedBy).toBe('admin');

    const list = await request('GET', '/api/alerts', null, auth.cookie);
    const alert = list.body.data.find((entry) => entry.ref === 'OpaqueRef:msg1');
    expect(alert).toEqual(expect.objectContaining({
      acknowledged: true,
      severityOverride: 'info',
      healthAction: 'review',
    }));

    const audit = await request('GET', '/api/audit', null, auth.cookie);
    expect(audit.status).toBe(200);
    expect(audit.body.data[0]).toEqual(expect.objectContaining({
      category: 'alerts',
      action: 'alert_state_updated',
      operator: 'admin',
    }));
  });

  it('should persist operator alert state for telemetry-derived alerts', async () => {
    const auth = await login();
    const telemetryRef = buildSyntheticRef('sr', 'utilization_percent', 'OpaqueRef:sr1');
    const res = await request('PUT', `/api/alerts/${encodeURIComponent(telemetryRef)}/state`, {
      acknowledged: true,
      severityOverride: 'warning',
      healthAction: 'capacity',
      notes: 'Reviewed during Tuesday, August 25, 2026 telemetry alert validation.',
    }, auth.cookie);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({
      ref: telemetryRef,
      acknowledged: true,
      healthAction: 'capacity',
      summary: 'Primary SR storage utilization critical',
    }));

    const list = await request('GET', '/api/alerts', null, auth.cookie);
    const alert = list.body.data.find((entry) => entry.ref === telemetryRef);
    expect(alert).toEqual(expect.objectContaining({
      acknowledged: true,
      healthAction: 'capacity',
    }));
  });

  it('should bulk update alert state', async () => {
    const auth = await login();
    const res = await request('PUT', '/api/alerts/bulk-state', {
      refs: ['OpaqueRef:msg1', 'OpaqueRef:msg2'],
      state: {
        acknowledged: true,
        suppressionUntil: '2026-08-22T18:00:00.000Z',
        severityOverride: '',
        healthAction: 'capacity',
        notes: 'Bulk triage applied on Saturday, August 22, 2026.',
      },
    }, auth.cookie);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.data[0]).toEqual(expect.objectContaining({
      acknowledged: true,
      healthAction: 'capacity',
    }));

    const audit = await request('GET', '/api/audit', null, auth.cookie);
    expect(audit.body.data[0]).toEqual(expect.objectContaining({
      category: 'alerts',
      action: 'alert_bulk_state_updated',
    }));
  });

  it('should persist alert policies and surface policy-driven alert context', async () => {
    const auth = await login();
    const create = await request('POST', '/api/alerts/policies', {
      enabled: true,
      name: 'Storage Warning Review',
      matchClass: 'sr',
      matchTargetRoute: '/storage',
      matchObject: 'msg-uuid-1',
      matchSeverity: 'warning',
      matchText: 'storage threshold',
      textMatchMode: 'all',
      autoAcknowledge: false,
      suppressionHours: 12,
      severityOverride: '',
      healthAction: 'capacity',
      notes: 'Storage alerts should route into capacity review on Saturday, August 22, 2026.',
    }, auth.cookie);

    expect(create.status).toBe(201);
    expect(create.body).toEqual(expect.objectContaining({
      name: 'Storage Warning Review',
      healthAction: 'capacity',
      matchTargetRoute: '/storage',
      textMatchMode: 'all',
    }));

    const policies = await request('GET', '/api/alerts/policies', null, auth.cookie);
    expect(policies.status).toBe(200);
    expect(policies.body.total).toBeGreaterThanOrEqual(1);

    const list = await request('GET', '/api/alerts', null, auth.cookie);
    const alert = list.body.data.find((entry) => entry.ref === 'OpaqueRef:msg1');
    expect(alert).toEqual(expect.objectContaining({
      policyName: 'Storage Warning Review',
      healthAction: 'capacity',
    }));
  });

  it('should require approved destructive tokens before operators delete alert policies', async () => {
    const auth = await login();

    const create = await request('POST', '/api/alerts/policies', {
      enabled: true,
      name: 'Delete-Me Policy',
      matchClass: 'host',
      matchTargetRoute: '/hosts',
      matchObject: '',
      matchSeverity: 'warning',
      matchText: 'maintenance',
      textMatchMode: 'phrase',
      autoAcknowledge: false,
      suppressionHours: 0,
      severityOverride: '',
      healthAction: 'lifecycle',
      notes: 'Used for Monday, August 24, 2026 destructive approval validation.',
    }, auth.cookie);
    expect(create.status).toBe(201);

    const lower = await request('PUT', '/api/governance/role', { role: 'operator' }, auth.cookie);
    expect(lower.status).toBe(200);

    const blocked = await request('DELETE', `/api/alerts/policies/${encodeURIComponent(create.body.id)}`, null, auth.cookie);
    expect(blocked.status).toBe(403);
    expect(blocked.body.error).toBe('APPROVAL_REQUIRED');

    const approval = await request('POST', '/api/governance/approvals', {
      actionKey: 'alert_policy_delete',
      entityType: 'alert-policy',
      entityRef: String(create.body.id),
      entityName: create.body.name,
      justification: 'Delete a suppression policy during Monday, August 24, 2026 approval validation.',
      route: '/alerts',
    }, auth.cookie);
    expect(approval.status).toBe(201);

    const elevate = await request('PUT', '/api/governance/role', { role: 'admin' }, auth.cookie);
    expect(elevate.status).toBe(200);

    const decision = await request('POST', `/api/governance/approvals/${encodeURIComponent(approval.body.id)}/decision`, {
      decision: 'approved',
      notes: 'Approved during Monday, August 24, 2026 alert-policy validation.',
    }, auth.cookie);
    expect(decision.status).toBe(200);

    const lowerAgain = await request('PUT', '/api/governance/role', { role: 'operator' }, auth.cookie);
    expect(lowerAgain.status).toBe(200);

    const removed = await request('DELETE', `/api/alerts/policies/${encodeURIComponent(create.body.id)}`, {
      approvalId: approval.body.id,
    }, auth.cookie);
    expect(removed.status).toBe(200);
    expect(removed.body.success).toBe(true);
  });

  it('should reject invalid alert refs', async () => {
    const auth = await login();
    const res = await request('PUT', '/api/alerts/msg1/state', { acknowledged: true }, auth.cookie);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
  });
});
