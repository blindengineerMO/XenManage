const http = require('http');
const path = require('path');
const fs = require('fs');

const TEST_DB = path.join(__dirname, '..', '..', '..', 'data', 'tasks-routes.db');

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

  actual.XenAPI.prototype.getTasks = jest.fn(async function () {
    return {
      'OpaqueRef:task1': {
        uuid: 'task-uuid-1',
        name_label: 'Patch compliance scan',
        name_description: 'Baseline lifecycle drift check',
        status: 'pending',
        progress: 0.4,
        created: '2026-08-19T12:10:00.000Z',
        finished: '',
        result: '',
        error_info: [],
      },
    };
  });

  actual.XenAPI.prototype.rpc = jest.fn(async function () {
    return {};
  });

  return actual;
});

const app = require('../../../../server/index');

describe('Tasks Routes', () => {
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

  it('should create remediation tasks, merge them into activity, and audit the action', async () => {
    const auth = await login();

    const create = await request('POST', '/api/tasks/remediation', {
      nameLabel: 'Capacity Review: Storage nearing threshold',
      nameDescription: 'Inspect the datastore and queue mitigation work before the Monday, August 24, 2026 review.',
      actionType: 'capacity',
      assignee: 'Platform Ops',
      dueDate: '2026-08-24',
      alertRef: 'OpaqueRef:msg1',
      alertUuid: 'msg-uuid-1',
      alertSummary: 'Storage nearing threshold',
      targetRoute: '/capacity',
      relatedObject: 'sr-uuid-1',
      relatedClass: 'sr',
      templateId: '',
      lifecyclePlanSeed: {
        enabled: true,
        baselineStatus: 'drifted',
        targetStage: 'maintenance',
        maintenanceWindow: 'Sun 02:00',
        patchGroup: 'Production Ring A',
        owner: 'Platform Ops',
        nextAction: 'patch',
        rebootRequired: true,
        evacuationRequired: true,
        dueDays: 2,
        notes: 'Prepare host remediation plan.',
      },
      resilienceRunbookSeed: {
        enabled: true,
        recoveryTier: 'tier-1',
        haPolicy: 'priority-restart',
        restartPriority: 'high',
        backupWindowHours: 12,
        rpoMinutes: 30,
        rtoMinutes: 90,
        restorePointStatus: 'review',
        runbookSteps: ['Validate backup currency', 'Confirm standby host readiness'],
        notes: 'Protect the affected workload pool.',
      },
      vmMigrationSeed: {
        enabled: true,
        mode: 'same-pool',
        hostRef: 'OpaqueRef:host2',
        live: true,
        copy: false,
        force: false,
        compress: true,
        setAsHomeServer: true,
        notes: 'Move the workload onto the alternate production host.',
      },
    }, auth.cookie);

    expect(create.status).toBe(201);
    expect(create.body).toEqual(expect.objectContaining({
      task_kind: 'remediation',
      source: 'remediation',
      action_type: 'capacity',
      related_object: 'sr-uuid-1',
      related_alert_ref: 'OpaqueRef:msg1',
      lifecycle_plan_seed: expect.objectContaining({
        enabled: true,
        targetStage: 'maintenance',
        sourceTaskRef: '',
      }),
      resilience_runbook_seed: expect.objectContaining({
        enabled: true,
        recoveryTier: 'tier-1',
      }),
      vm_migration_seed: expect.objectContaining({
        enabled: true,
        mode: 'same-pool',
        hostRef: 'OpaqueRef:host2',
      }),
    }));

    const list = await request('GET', '/api/tasks', null, auth.cookie);
    expect(list.status).toBe(200);
    expect(list.body.total).toBe(2);
    expect(list.body.data[0]).toEqual(expect.objectContaining({
      ref: create.body.ref,
      name_label: 'Capacity Review: Storage nearing threshold',
      task_kind: 'remediation',
    }));

    const audit = await request('GET', '/api/audit', null, auth.cookie);
    expect(audit.status).toBe(200);
    expect(audit.body.data[0]).toEqual(expect.objectContaining({
      category: 'alerts',
      action: 'remediation_task_created',
      entityType: 'task',
      operator: 'admin',
    }));
  });

  it('should update remediation task status and audit the change', async () => {
    const auth = await login();

    const create = await request('POST', '/api/tasks/remediation', {
      nameLabel: 'Capacity Review: Storage nearing threshold',
      nameDescription: 'Inspect the datastore and queue mitigation work before Sunday, August 23, 2026 follow-through.',
      actionType: 'capacity',
      assignee: 'Platform Ops',
      dueDate: '2026-08-23',
      alertRef: 'OpaqueRef:msg1',
      alertUuid: 'msg-uuid-1',
      alertSummary: 'Storage nearing threshold',
      targetRoute: '/capacity',
      relatedObject: 'sr-uuid-1',
      relatedClass: 'sr',
    }, auth.cookie);

    const update = await request('PUT', `/api/tasks/remediation/${encodeURIComponent(create.body.ref)}`, {
      status: 'success',
      assignee: 'Cloud Operations',
      dueDate: '2026-08-24',
      result: 'Mitigation completed on Saturday, August 22, 2026.',
      nameDescription: 'Datastore latency reviewed and follow-through closed.',
    }, auth.cookie);

    expect(update.status).toBe(200);
    expect(update.body).toEqual(expect.objectContaining({
      ref: create.body.ref,
      status: 'success',
      assignee: 'Cloud Operations',
      due_date: '2026-08-24',
    }));
    expect(update.body.finished).toBeTruthy();

    const audit = await request('GET', '/api/audit', null, auth.cookie);
    expect(audit.body.data[0]).toEqual(expect.objectContaining({
      category: 'activity',
      action: 'remediation_task_updated',
      entityRef: create.body.ref,
    }));
  });

  it('should manage remediation templates and audit the changes', async () => {
    const auth = await login();

    const create = await request('POST', '/api/tasks/remediation/templates', {
      enabled: true,
      name: 'Storage Capacity Review',
      matchClass: 'sr',
      matchTargetRoute: '/storage',
      matchObject: 'sr-uuid-1',
      matchSeverity: 'warning',
      matchText: 'storage threshold',
      textMatchMode: 'all',
      actionType: 'capacity',
      taskNameTemplate: 'Capacity Review: {summary}',
      defaultAssignee: 'Platform Ops',
      defaultDueDays: 2,
      defaultTargetRoute: '/capacity',
      defaultNotes: 'Prepare a mitigation summary before Monday, August 24, 2026.',
      workspaceSummaryTemplate: 'Validate datastore pressure and capture evidence for {summary}.',
      evidenceChecklist: ['Capture current latency evidence.', 'Review affected workloads.'],
      completionCriteria: ['Owner confirmed.', 'Closure note recorded.'],
      launchMode: 'resilience-drill',
      recurrenceMode: 'daily',
      recurrenceScope: 'object',
      cooldownDays: 0,
      lifecyclePlanSeed: {
        enabled: true,
        baselineStatus: 'drifted',
        targetStage: 'maintenance',
        maintenanceWindow: 'Sun 02:00',
        patchGroup: 'Production Ring A',
        owner: 'Platform Ops',
        nextAction: 'patch',
        rebootRequired: true,
        evacuationRequired: true,
        dueDays: 2,
        notes: 'Patch the affected host set.',
      },
      resilienceRunbookSeed: {
        enabled: true,
        recoveryTier: 'tier-1',
        haPolicy: 'priority-restart',
        restartPriority: 'high',
        backupWindowHours: 12,
        rpoMinutes: 30,
        rtoMinutes: 90,
        restorePointStatus: 'review',
        standbyHostRef: 'OpaqueRef:host1',
        failoverNetworkRef: 'OpaqueRef:net1',
        runbookSteps: ['Validate backups', 'Confirm standby host'],
        notes: 'Protect storage-adjacent workloads.',
      },
      vmMigrationSeed: {
        enabled: true,
        mode: 'same-pool',
        hostRef: 'OpaqueRef:host2',
        live: true,
        copy: false,
        force: false,
        compress: true,
        setAsHomeServer: true,
        notes: 'Pre-stage a workload move onto the alternate host.',
      },
    }, auth.cookie);

    expect(create.status).toBe(201);
    expect(create.body).toEqual(expect.objectContaining({
      name: 'Storage Capacity Review',
      actionType: 'capacity',
      defaultDueDays: 2,
      launchMode: 'resilience-drill',
      workspaceSummaryTemplate: 'Validate datastore pressure and capture evidence for {summary}.',
      lifecyclePlanSeed: expect.objectContaining({
        enabled: true,
        targetStage: 'maintenance',
      }),
      resilienceRunbookSeed: expect.objectContaining({
        enabled: true,
        recoveryTier: 'tier-1',
      }),
      vmMigrationSeed: expect.objectContaining({
        enabled: true,
        mode: 'same-pool',
        hostRef: 'OpaqueRef:host2',
      }),
    }));

    const list = await request('GET', '/api/tasks/remediation/templates', null, auth.cookie);
    expect(list.status).toBe(200);
    expect(list.body.total).toBe(1);

    const update = await request('PUT', `/api/tasks/remediation/templates/${encodeURIComponent(create.body.id)}`, {
      enabled: true,
      name: 'Storage Capacity Review',
      matchClass: 'sr',
      matchTargetRoute: '/storage',
      matchObject: 'sr-uuid-1',
      matchSeverity: 'warning',
      matchText: 'storage threshold',
      textMatchMode: 'all',
      actionType: 'capacity',
      taskNameTemplate: 'Capacity Review: {summary}',
      defaultAssignee: 'Cloud Operations',
      defaultDueDays: 3,
      defaultTargetRoute: '/capacity',
      defaultNotes: 'Escalate during the Tuesday, August 25, 2026 review if saturation continues.',
      workspaceSummaryTemplate: 'Escalate datastore pressure review for {summary}.',
      evidenceChecklist: ['Capture current latency evidence.', 'Review affected workloads.', 'Confirm host impact.'],
      completionCriteria: ['Owner confirmed.', 'Closure note recorded.'],
      launchMode: 'queue',
      recurrenceMode: 'cooldown',
      recurrenceScope: 'object',
      cooldownDays: 5,
    }, auth.cookie);

    expect(update.status).toBe(200);
    expect(update.body).toEqual(expect.objectContaining({
      id: create.body.id,
      defaultAssignee: 'Cloud Operations',
      defaultDueDays: 3,
      recurrenceMode: 'cooldown',
      cooldownDays: 5,
    }));

    const remove = await request('DELETE', `/api/tasks/remediation/templates/${encodeURIComponent(create.body.id)}`, null, auth.cookie);
    expect(remove.status).toBe(200);
    expect(remove.body.success).toBe(true);

    const audit = await request('GET', '/api/audit', null, auth.cookie);
    expect(audit.body.data[0]).toEqual(expect.objectContaining({
      category: 'alerts',
      action: 'remediation_template_deleted',
      entityRef: create.body.id,
    }));
  });

  it('should prevent duplicate recurring remediation tasks from the same template scope', async () => {
    const auth = await login();

    const template = await request('POST', '/api/tasks/remediation/templates', {
      enabled: true,
      name: 'Storage Capacity Review',
      matchClass: 'sr',
      matchTargetRoute: '/storage',
      matchSeverity: 'warning',
      matchText: 'storage threshold',
      textMatchMode: 'all',
      actionType: 'capacity',
      taskNameTemplate: 'Capacity Review: {summary}',
      defaultAssignee: 'Platform Ops',
      defaultDueDays: 2,
      defaultTargetRoute: '/capacity',
      defaultNotes: 'Prepare a mitigation summary before Monday, August 24, 2026.',
      workspaceSummaryTemplate: 'Validate datastore pressure and capture evidence for {summary}.',
      evidenceChecklist: ['Capture current latency evidence.', 'Review affected workloads.'],
      completionCriteria: ['Owner confirmed.', 'Closure note recorded.'],
      launchMode: 'queue',
      recurrenceMode: 'daily',
      recurrenceScope: 'object',
      cooldownDays: 0,
    }, auth.cookie);

    const first = await request('POST', '/api/tasks/remediation', {
      nameLabel: 'Capacity Review: Storage nearing threshold',
      nameDescription: 'First recurring follow-through.',
      actionType: 'capacity',
      assignee: 'Platform Ops',
      dueDate: '2026-08-24',
      alertRef: 'OpaqueRef:msg1',
      alertUuid: 'msg-uuid-1',
      alertSummary: 'Storage nearing threshold',
      targetRoute: '/capacity',
      relatedObject: 'sr-uuid-1',
      relatedClass: 'sr',
      workspaceSummary: 'Validate datastore pressure and capture evidence for Storage nearing threshold.',
      evidenceChecklist: ['Capture current latency evidence.', 'Review affected workloads.'],
      completionCriteria: ['Owner confirmed.', 'Closure note recorded.'],
      templateId: template.body.id,
    }, auth.cookie);

    expect(first.status).toBe(201);
    expect(first.body).toEqual(expect.objectContaining({
      template_id: template.body.id,
      template_name: 'Storage Capacity Review',
      recurrence_mode: 'daily',
      workspace_summary: 'Validate datastore pressure and capture evidence for Storage nearing threshold.',
    }));

    const second = await request('POST', '/api/tasks/remediation', {
      nameLabel: 'Capacity Review: Storage nearing threshold',
      nameDescription: 'Second recurring follow-through.',
      actionType: 'capacity',
      assignee: 'Platform Ops',
      dueDate: '2026-08-24',
      alertRef: 'OpaqueRef:msg1',
      alertUuid: 'msg-uuid-1',
      alertSummary: 'Storage nearing threshold',
      targetRoute: '/capacity',
      relatedObject: 'sr-uuid-1',
      relatedClass: 'sr',
      templateId: template.body.id,
    }, auth.cookie);

    expect(second.status).toBe(409);
    expect(second.body).toEqual(expect.objectContaining({
      error: 'REMEDIATION_TASK_RECURRENCE_BLOCKED',
      existingTask: expect.objectContaining({
        ref: first.body.ref,
      }),
    }));
  });

  it('should require approved destructive tokens before operators delete remediation templates', async () => {
    const auth = await login();

    const create = await request('POST', '/api/tasks/remediation/templates', {
      enabled: true,
      name: 'Delete-Me Template',
      matchClass: 'sr',
      matchTargetRoute: '/storage',
      matchObject: 'sr-uuid-1',
      matchSeverity: 'warning',
      matchText: 'storage threshold',
      textMatchMode: 'all',
      actionType: 'capacity',
      taskNameTemplate: 'Capacity Review: {summary}',
      defaultAssignee: 'Platform Ops',
      defaultDueDays: 2,
      defaultTargetRoute: '/capacity',
      defaultNotes: 'Template created for Monday, August 24, 2026 approval validation.',
      workspaceSummaryTemplate: 'Collect datastore evidence for {summary}.',
      evidenceChecklist: ['Capture current latency evidence.'],
      completionCriteria: ['Closure note recorded.'],
      launchMode: 'queue',
      recurrenceMode: 'cooldown',
      recurrenceScope: 'object',
      cooldownDays: 3,
    }, auth.cookie);
    expect(create.status).toBe(201);

    const lower = await request('PUT', '/api/governance/role', { role: 'operator' }, auth.cookie);
    expect(lower.status).toBe(200);

    const blocked = await request('DELETE', `/api/tasks/remediation/templates/${encodeURIComponent(create.body.id)}`, null, auth.cookie);
    expect(blocked.status).toBe(403);
    expect(blocked.body.error).toBe('APPROVAL_REQUIRED');

    const approval = await request('POST', '/api/governance/approvals', {
      actionKey: 'remediation_template_delete',
      entityType: 'task-template',
      entityRef: String(create.body.id),
      entityName: create.body.name,
      justification: 'Delete a remediation template during Monday, August 24, 2026 approval validation.',
      route: '/alerts',
    }, auth.cookie);
    expect(approval.status).toBe(201);

    const elevate = await request('PUT', '/api/governance/role', { role: 'admin' }, auth.cookie);
    expect(elevate.status).toBe(200);

    const decision = await request('POST', `/api/governance/approvals/${encodeURIComponent(approval.body.id)}/decision`, {
      decision: 'approved',
      notes: 'Approved during Monday, August 24, 2026 remediation-template validation.',
    }, auth.cookie);
    expect(decision.status).toBe(200);

    const lowerAgain = await request('PUT', '/api/governance/role', { role: 'operator' }, auth.cookie);
    expect(lowerAgain.status).toBe(200);

    const removed = await request('DELETE', `/api/tasks/remediation/templates/${encodeURIComponent(create.body.id)}`, {
      approvalId: approval.body.id,
    }, auth.cookie);
    expect(removed.status).toBe(200);
    expect(removed.body.success).toBe(true);
  });
});
