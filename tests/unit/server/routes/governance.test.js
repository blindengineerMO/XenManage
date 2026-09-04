const http = require('http');
const path = require('path');
const fs = require('fs');

const TEST_DB = path.join(__dirname, '..', '..', '..', 'data', 'governance-routes.db');

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

  actual.XenAPI.prototype.getPools = jest.fn(async function () {
    return {
      records: {
        'OpaqueRef:pool1': {
          name_label: 'Production Pool',
          uuid: 'pool-uuid-1',
        },
      },
    };
  });

  actual.XenAPI.prototype.getHosts = jest.fn(async function () {
    return {
      records: {
        'OpaqueRef:host1': {
          name_label: 'alpha-xen',
          pool: 'OpaqueRef:pool1',
          resident_VMs: ['OpaqueRef:vm1'],
        },
      },
    };
  });

  actual.XenAPI.prototype.getVMs = jest.fn(async function () {
    return {
      records: {
        'OpaqueRef:vm1': {
          name_label: 'app-01',
          is_a_template: false,
          power_state: 'Running',
          resident_on: 'OpaqueRef:host1',
          memory_static_max: 8589934592,
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

describe('Governance Routes', () => {
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

  it('should return governance overview data', async () => {
    const auth = await login();
    const res = await request('GET', '/api/governance', null, auth.cookie);
    expect(res.status).toBe(200);
    expect(res.body.currentRole).toBeDefined();
    expect(res.body.summary.poolCount).toBe(1);
    expect(res.body.quotaRows[0]).toEqual(expect.objectContaining({
      poolRef: 'OpaqueRef:pool1',
      currentVmCount: 1,
      currentRunningVmCount: 1,
    }));
  });

  it('should persist governance policy, quotas, and approvals', async () => {
    const auth = await login();

    const policy = await request('PUT', '/api/governance/policy', {
      defaultRole: 'operator',
      requireDestructiveApproval: true,
      approvalTtlMinutes: 180,
    }, auth.cookie);
    expect(policy.status).toBe(200);
    expect(policy.body.defaultRole).toBe('operator');

    const role = await request('PUT', '/api/governance/role', { role: 'operator' }, auth.cookie);
    expect(role.status).toBe(200);
    expect(role.body.role).toBe('operator');

    const quota = await request('PUT', '/api/governance/quotas/OpaqueRef%3Apool1', {
      enabled: true,
      owner: 'Platform Ops',
      maxVmCount: 5,
      maxRunningVmCount: 4,
      maxTotalMemoryGiB: 64,
      notes: 'Production cap for Friday, August 21, 2026 operations.',
    }, auth.cookie);
    expect(quota.status).toBe(403);
    expect(quota.body.error).toBe('ADMIN_ROLE_REQUIRED');

    const promote = await request('PUT', '/api/governance/role', { role: 'admin' }, auth.cookie);
    expect(promote.status).toBe(200);
    expect(promote.body.role).toBe('admin');

    const quotaAsAdmin = await request('PUT', '/api/governance/quotas/OpaqueRef%3Apool1', {
      enabled: true,
      owner: 'Platform Ops',
      maxVmCount: 5,
      maxRunningVmCount: 4,
      maxTotalMemoryGiB: 64,
      notes: 'Production cap for Friday, August 21, 2026 operations.',
    }, auth.cookie);
    expect(quotaAsAdmin.status).toBe(200);
    expect(quotaAsAdmin.body.maxVmCount).toBe(5);

    const approval = await request('POST', '/api/governance/approvals', {
      actionKey: 'vm_shutdown',
      entityType: 'vm',
      entityRef: 'OpaqueRef:vm1',
      entityName: 'app-01',
      justification: 'Controlled shutdown for the Friday, August 21, 2026 maintenance window.',
      route: '/vms',
    }, auth.cookie);
    expect(approval.status).toBe(201);
    expect(approval.body.status).toBe('pending');

    const decision = await request('POST', `/api/governance/approvals/${encodeURIComponent(approval.body.id)}/decision`, {
      decision: 'approved',
      notes: 'Approved for the maintenance window on Friday, August 21, 2026.',
    }, auth.cookie);
    expect(decision.status).toBe(200);
    expect(decision.body.status).toBe('approved');

    const audit = await request('GET', '/api/audit', null, auth.cookie);
    expect(audit.status).toBe(200);
    expect(audit.body.data.some((entry) => entry.category === 'governance')).toBe(true);
  });

  it('blocks a requester from approving their own request when separation-of-duties is enabled, but still allows self-rejection', async () => {
    const auth = await login();

    const policy = await request('PUT', '/api/governance/policy', {
      defaultRole: 'admin',
      requireDestructiveApproval: true,
      approvalTtlMinutes: 240,
      requireApproverDifferentFromRequester: true,
    }, auth.cookie);
    expect(policy.status).toBe(200);
    expect(policy.body.requireApproverDifferentFromRequester).toBe(true);

    const approval = await request('POST', '/api/governance/approvals', {
      actionKey: 'vm_shutdown',
      entityType: 'vm',
      entityRef: 'OpaqueRef:vm1',
      entityName: 'app-01',
      justification: 'Separation-of-duties regression coverage.',
      route: '/vms',
    }, auth.cookie);
    expect(approval.status).toBe(201);

    const selfApprove = await request('POST', `/api/governance/approvals/${encodeURIComponent(approval.body.id)}/decision`, {
      decision: 'approved',
      notes: 'Should be blocked - same requester and approver.',
    }, auth.cookie);
    expect(selfApprove.status).toBe(403);
    expect(selfApprove.body.error).toBe('SELF_APPROVAL_NOT_ALLOWED');

    const selfReject = await request('POST', `/api/governance/approvals/${encodeURIComponent(approval.body.id)}/decision`, {
      decision: 'rejected',
      notes: 'Withdrawing my own request is fine.',
    }, auth.cookie);
    expect(selfReject.status).toBe(200);
    expect(selfReject.body.status).toBe('rejected');
  });

  it('requires two distinct approvers when two-person approval is enabled, but allows immediate rejection', async () => {
    const auth = await login();

    const policy = await request('PUT', '/api/governance/policy', {
      defaultRole: 'admin',
      requireDestructiveApproval: true,
      approvalTtlMinutes: 240,
      requireTwoPersonApproval: true,
    }, auth.cookie);
    expect(policy.status).toBe(200);
    expect(policy.body.requireTwoPersonApproval).toBe(true);

    const approval = await request('POST', '/api/governance/approvals', {
      actionKey: 'vm_shutdown',
      entityType: 'vm',
      entityRef: 'OpaqueRef:vm1',
      entityName: 'app-01',
      justification: 'Two-person approval regression coverage.',
      route: '/vms',
    }, auth.cookie);
    expect(approval.status).toBe(201);

    const firstApproval = await request('POST', `/api/governance/approvals/${encodeURIComponent(approval.body.id)}/decision`, {
      decision: 'approved',
      notes: 'First approval.',
    }, auth.cookie);
    expect(firstApproval.status).toBe(200);
    expect(firstApproval.body.status).toBe('awaiting_second_approval');
    expect(firstApproval.body.firstApprovedBy).toBeTruthy();

    const sameApproverAgain = await request('POST', `/api/governance/approvals/${encodeURIComponent(approval.body.id)}/decision`, {
      decision: 'approved',
      notes: 'Trying to approve my own first approval a second time.',
    }, auth.cookie);
    expect(sameApproverAgain.status).toBe(403);
    expect(sameApproverAgain.body.error).toBe('SECOND_APPROVER_MUST_DIFFER');
  });

  it('finalizes a two-person approval once a second, different approver decides it', async () => {
    const auth = await login();

    const policy = await request('PUT', '/api/governance/policy', {
      defaultRole: 'admin',
      requireDestructiveApproval: true,
      approvalTtlMinutes: 240,
      requireTwoPersonApproval: true,
    }, auth.cookie);
    expect(policy.status).toBe(200);

    const secondApproverUsername = `second-approver-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const secondAdmin = await request('POST', '/api/users', {
      username: secondApproverUsername,
      password: 'SecondApprover123!',
      displayName: 'Second Approver',
      role: 'admin',
      active: true,
    }, auth.cookie);
    expect(secondAdmin.status).toBe(201);

    const approval = await request('POST', '/api/governance/approvals', {
      actionKey: 'vm_shutdown',
      entityType: 'vm',
      entityRef: 'OpaqueRef:vm1',
      entityName: 'app-01',
      justification: 'Two-person approval finalization coverage.',
      route: '/vms',
    }, auth.cookie);
    expect(approval.status).toBe(201);

    const firstApproval = await request('POST', `/api/governance/approvals/${encodeURIComponent(approval.body.id)}/decision`, {
      decision: 'approved',
      notes: 'First approval.',
    }, auth.cookie);
    expect(firstApproval.status).toBe(200);
    expect(firstApproval.body.status).toBe('awaiting_second_approval');

    const secondAuth = await request('POST', '/api/auth/login', {
      username: secondApproverUsername,
      password: 'SecondApprover123!',
    });
    const secondApproval = await request('POST', `/api/governance/approvals/${encodeURIComponent(approval.body.id)}/decision`, {
      decision: 'approved',
      notes: 'Second, distinct approval.',
    }, secondAuth.cookie);
    expect(secondApproval.status).toBe(200);
    expect(secondApproval.body.status).toBe('approved');
  });

  it('blocks approval decisions outside the scheduled approval window, but still allows rejection', async () => {
    const auth = await login();
    const now = new Date();
    const todayUtcDay = now.getUTCDay();
    const otherUtcDay = (todayUtcDay + 1) % 7;

    const policy = await request('PUT', '/api/governance/policy', {
      defaultRole: 'admin',
      requireDestructiveApproval: true,
      approvalTtlMinutes: 240,
      requireScheduledApprovalWindow: true,
      approvalWindowDays: [otherUtcDay],
      approvalWindowStartMinute: 0,
      approvalWindowEndMinute: 1440,
    }, auth.cookie);
    expect(policy.status).toBe(200);
    expect(policy.body.requireScheduledApprovalWindow).toBe(true);

    const approval = await request('POST', '/api/governance/approvals', {
      actionKey: 'vm_shutdown',
      entityType: 'vm',
      entityRef: 'OpaqueRef:vm1',
      entityName: 'app-01',
      justification: 'Scheduled approval window regression coverage.',
      route: '/vms',
    }, auth.cookie);
    expect(approval.status).toBe(201);

    const blockedDecision = await request('POST', `/api/governance/approvals/${encodeURIComponent(approval.body.id)}/decision`, {
      decision: 'approved',
      notes: 'Should be blocked - outside the configured window.',
    }, auth.cookie);
    expect(blockedDecision.status).toBe(403);
    expect(blockedDecision.body.error).toBe('OUTSIDE_APPROVAL_WINDOW');

    const rejection = await request('POST', `/api/governance/approvals/${encodeURIComponent(approval.body.id)}/decision`, {
      decision: 'rejected',
      notes: 'Rejection is allowed outside the window.',
    }, auth.cookie);
    expect(rejection.status).toBe(200);
    expect(rejection.body.status).toBe('rejected');
  });

  it('allows approval decisions inside the scheduled approval window', async () => {
    const auth = await login();
    const now = new Date();
    const todayUtcDay = now.getUTCDay();

    const policy = await request('PUT', '/api/governance/policy', {
      defaultRole: 'admin',
      requireDestructiveApproval: true,
      approvalTtlMinutes: 240,
      requireScheduledApprovalWindow: true,
      approvalWindowDays: [todayUtcDay],
      approvalWindowStartMinute: 0,
      approvalWindowEndMinute: 1440,
    }, auth.cookie);
    expect(policy.status).toBe(200);

    const approval = await request('POST', '/api/governance/approvals', {
      actionKey: 'vm_shutdown',
      entityType: 'vm',
      entityRef: 'OpaqueRef:vm1',
      entityName: 'app-01',
      justification: 'Scheduled approval window in-window coverage.',
      route: '/vms',
    }, auth.cookie);
    expect(approval.status).toBe(201);

    const decision = await request('POST', `/api/governance/approvals/${encodeURIComponent(approval.body.id)}/decision`, {
      decision: 'approved',
      notes: 'Should succeed - inside the configured window.',
    }, auth.cookie);
    expect(decision.status).toBe(200);
    expect(decision.body.status).toBe('approved');
  });

  it('blocks an infrastructure-domain approval decision from an approver outside the configured approver group, but still allows rejection', async () => {
    const auth = await login();

    const group = await request('POST', '/api/groups', {
      name: `Infra Approvers ${Date.now()}`,
      memberUserIds: [],
    }, auth.cookie);
    expect(group.status).toBe(201);

    const policy = await request('PUT', '/api/governance/policy', {
      defaultRole: 'admin',
      requireDestructiveApproval: true,
      approvalTtlMinutes: 240,
      requireDomainApproverGroup: true,
      infrastructureApproverGroupId: group.body.id,
    }, auth.cookie);
    expect(policy.status).toBe(200);
    expect(policy.body.requireDomainApproverGroup).toBe(true);

    const approval = await request('POST', '/api/governance/approvals', {
      actionKey: 'vm_shutdown',
      entityType: 'vm',
      entityRef: 'OpaqueRef:vm1',
      entityName: 'app-01',
      justification: 'Domain approver group regression coverage.',
      route: '/vms',
    }, auth.cookie);
    expect(approval.status).toBe(201);

    const blockedDecision = await request('POST', `/api/governance/approvals/${encodeURIComponent(approval.body.id)}/decision`, {
      decision: 'approved',
      notes: 'Should be blocked - not a member of the infrastructure approver group.',
    }, auth.cookie);
    expect(blockedDecision.status).toBe(403);
    expect(blockedDecision.body.error).toBe('DOMAIN_APPROVER_REQUIRED');

    const rejection = await request('POST', `/api/governance/approvals/${encodeURIComponent(approval.body.id)}/decision`, {
      decision: 'rejected',
      notes: 'Rejection is allowed regardless of approver group membership.',
    }, auth.cookie);
    expect(rejection.status).toBe(200);
    expect(rejection.body.status).toBe('rejected');
  });

  it('allows an infrastructure-domain approval decision from a member of the configured approver group', async () => {
    const auth = await login();
    const loginResult = await request('POST', '/api/auth/login', { username: 'admin', password: 'admin123!' });
    const adminUserId = loginResult.body.user?.id;
    expect(adminUserId).toBeTruthy();

    const group = await request('POST', '/api/groups', {
      name: `Infra Approvers ${Date.now()}`,
      memberUserIds: [adminUserId],
    }, auth.cookie);
    expect(group.status).toBe(201);

    const policy = await request('PUT', '/api/governance/policy', {
      defaultRole: 'admin',
      requireDestructiveApproval: true,
      approvalTtlMinutes: 240,
      requireDomainApproverGroup: true,
      infrastructureApproverGroupId: group.body.id,
    }, auth.cookie);
    expect(policy.status).toBe(200);

    const approval = await request('POST', '/api/governance/approvals', {
      actionKey: 'vm_shutdown',
      entityType: 'vm',
      entityRef: 'OpaqueRef:vm1',
      entityName: 'app-01',
      justification: 'Domain approver group membership coverage.',
      route: '/vms',
    }, auth.cookie);
    expect(approval.status).toBe(201);

    const decision = await request('POST', `/api/governance/approvals/${encodeURIComponent(approval.body.id)}/decision`, {
      decision: 'approved',
      notes: 'Should succeed - approver is a member of the configured group.',
    }, auth.cookie);
    expect(decision.status).toBe(200);
    expect(decision.body.status).toBe('approved');
  });

  it('rejects break-glass activation without a justification long enough to explain the emergency', async () => {
    const auth = await login();

    const activation = await request('POST', '/api/governance/break-glass/activate', {
      justification: 'too short',
    }, auth.cookie);
    expect(activation.status).toBe(400);
    expect(activation.body.error).toBe('VALIDATION_ERROR');
  });

  it('lets a non-admin account elevate to admin via break-glass, then reverts on deactivation', async () => {
    const auth = await login();

    const operatorUsername = `break-glass-operator-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const created = await request('POST', '/api/users', {
      username: operatorUsername,
      password: 'BreakGlassOperator123!',
      displayName: 'Break Glass Operator',
      role: 'operator',
      active: true,
    }, auth.cookie);
    expect(created.status).toBe(201);

    const operatorAuth = await request('POST', '/api/auth/login', {
      username: operatorUsername,
      password: 'BreakGlassOperator123!',
    });

    const blockedQuota = await request('PUT', '/api/governance/quotas/OpaqueRef%3Apool1', {
      enabled: true,
      owner: 'Platform Ops',
      maxVmCount: 5,
    }, operatorAuth.cookie);
    expect(blockedQuota.status).toBe(403);
    expect(blockedQuota.body.error).toBe('ADMIN_ROLE_REQUIRED');

    const activation = await request('POST', '/api/governance/break-glass/activate', {
      justification: 'Production incident INC-4821 requires emergency quota changes.',
    }, operatorAuth.cookie);
    expect(activation.status).toBe(201);
    expect(activation.body.active).toBe(true);
    expect(activation.body.priorRole).toBe('operator');

    const overview = await request('GET', '/api/governance', null, operatorAuth.cookie);
    expect(overview.status).toBe(200);
    expect(overview.body.currentRole).toBe('admin');
    expect(overview.body.breakGlass.active).toBe(true);

    const elevatedQuota = await request('PUT', '/api/governance/quotas/OpaqueRef%3Apool1', {
      enabled: true,
      owner: 'Platform Ops',
      maxVmCount: 5,
    }, operatorAuth.cookie);
    expect(elevatedQuota.status).toBe(200);

    const deactivation = await request('POST', '/api/governance/break-glass/deactivate', null, operatorAuth.cookie);
    expect(deactivation.status).toBe(200);
    expect(deactivation.body.active).toBe(false);

    const revertedOverview = await request('GET', '/api/governance', null, operatorAuth.cookie);
    expect(revertedOverview.body.currentRole).toBe('operator');

    const blockedAgain = await request('PUT', '/api/governance/quotas/OpaqueRef%3Apool1', {
      enabled: true,
      owner: 'Platform Ops',
      maxVmCount: 5,
    }, operatorAuth.cookie);
    expect(blockedAgain.status).toBe(403);
    expect(blockedAgain.body.error).toBe('ADMIN_ROLE_REQUIRED');
  });
});
