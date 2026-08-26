const http = require('http');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const TEST_DB = path.join(__dirname, '..', '..', '..', 'data', 'resource-ownership.db');
const TEST_SECURITY_DB = path.join(__dirname, '..', '..', '..', 'data', 'resource-ownership-security.db');

process.env.DB_PATH = TEST_DB;
process.env.SECURITY_DB_PATH = TEST_SECURITY_DB;

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

const { getDb } = require('../../../../server/models/connection');
const { getSecurityDb } = require('../../../../server/models/security-db');
const governanceService = require('../../../../server/services/governance');
const app = require('../../../../server/index');

describe('Owned Resource Routes', () => {
  let server;
  let port;

  beforeAll((done) => {
    [TEST_DB, TEST_SECURITY_DB].forEach((file) => {
      if (fs.existsSync(file)) fs.unlinkSync(file);
    });

    server = app.listen(0, () => {
      port = server.address().port;
      done();
    });
  });

  beforeEach(() => {
    const db = getDb();
    db.prepare('DELETE FROM host_targets').run();
    db.prepare('DELETE FROM connections').run();
    db.prepare('DELETE FROM settings').run();

    const securityDb = getSecurityDb();
    securityDb.prepare(`DELETE FROM users WHERE username != 'admin'`).run();
    securityDb.prepare(`
      UPDATE users
      SET password_hash = ?, display_name = 'Platform Administrator', email = '', role = 'admin', active = 1
      WHERE username = 'admin'
    `).run(bcrypt.hashSync('admin123!', 10));

    createLocalUser('operator-a');
    createLocalUser('operator-b');
  });

  afterAll((done) => {
    server.close(() => {
      [TEST_DB, TEST_SECURITY_DB].forEach((file) => {
        if (fs.existsSync(file)) fs.unlinkSync(file);
      });
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

  function appLogin(username, password = 'password123!') {
    return request('POST', '/api/auth/login', { username, password });
  }

  function createLocalUser(username, role = 'operator') {
    getSecurityDb().prepare(`
      INSERT INTO users (username, password_hash, display_name, role, active)
      VALUES (?, ?, ?, ?, 1)
    `).run(username, bcrypt.hashSync('password123!', 10), username, role);
  }

  it('should scope saved pool targets by owner and visibility', async () => {
    const owner = await appLogin('operator-a');
    const admin = await appLogin('admin', 'admin123!');

    const privateTarget = await request('POST', '/api/connections', {
      name: 'Operator Private Pool',
      host: '10.0.0.10',
      username: 'root',
      port: 443,
      visibility: 'private',
      isDefault: true,
    }, owner.cookie);
    expect(privateTarget.status).toBe(201);

    const sharedTarget = await request('POST', '/api/connections', {
      name: 'Shared Ops Pool',
      host: '10.0.0.11',
      username: 'root',
      port: 443,
      visibility: 'shared',
      isDefault: false,
    }, owner.cookie);
    expect(sharedTarget.status).toBe(201);

    const other = await appLogin('operator-b');
    const listed = await request('GET', '/api/connections', null, other.cookie);
    expect(listed.status).toBe(200);
    expect(listed.body.map((entry) => entry.name)).toEqual(['Shared Ops Pool']);
    expect(listed.body[0].visibility).toBe('shared');
    expect(listed.body[0].can_manage).toBe(false);

    const forbidden = await request('PUT', `/api/connections/${sharedTarget.body.id}`, {
      name: 'Shared Ops Pool Updated',
      host: '10.0.0.11',
      username: 'root',
      port: 443,
      visibility: 'shared',
      isDefault: false,
    }, other.cookie);
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.error).toBe('CONNECTION_FORBIDDEN');

    const adminList = await request('GET', '/api/connections', null, admin.cookie);
    expect(adminList.status).toBe(200);
    expect(adminList.body.map((entry) => entry.name).sort()).toEqual(['Operator Private Pool', 'Shared Ops Pool']);
  });

  it('should scope host targets by owner and visibility', async () => {
    const owner = await appLogin('operator-a');

    const privateTarget = await request('POST', '/api/host-targets', {
      name: 'Private Host',
      host: '10.0.1.10',
      username: 'root',
      port: 443,
      mode: 'standalone',
      notes: '',
      visibility: 'private',
    }, owner.cookie);
    expect(privateTarget.status).toBe(201);

    const sharedTarget = await request('POST', '/api/host-targets', {
      name: 'Shared Host',
      host: '10.0.1.11',
      username: 'root',
      port: 443,
      mode: 'standalone',
      notes: '',
      visibility: 'shared',
    }, owner.cookie);
    expect(sharedTarget.status).toBe(201);

    const other = await appLogin('operator-b');
    const listed = await request('GET', '/api/host-targets', null, other.cookie);
    expect(listed.status).toBe(200);
    expect(listed.body.map((entry) => entry.name)).toEqual(['Shared Host']);

    const blocked = await request('DELETE', `/api/host-targets/${sharedTarget.body.id}`, null, other.cookie);
    expect(blocked.status).toBe(403);
    expect(blocked.body.error).toBe('APPROVAL_REQUIRED');

    const approval = await request('POST', '/api/governance/approvals', {
      actionKey: 'host_target_delete',
      entityType: 'host-target',
      entityRef: String(sharedTarget.body.id),
      entityName: sharedTarget.body.name,
      justification: 'Validate that approved destructive deletes still honor ownership boundaries.',
      route: '/hosts',
    }, other.cookie);
    expect(approval.status).toBe(201);

    const admin = await appLogin('admin', 'admin123!');
    const decision = await request('POST', `/api/governance/approvals/${encodeURIComponent(approval.body.id)}/decision`, {
      decision: 'approved',
      notes: 'Approved to validate host-target ownership enforcement.',
    }, admin.cookie);
    expect(decision.status).toBe(200);

    const forbidden = await request('DELETE', `/api/host-targets/${sharedTarget.body.id}`, {
      approvalId: approval.body.id,
    }, other.cookie);
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.error).toBe('HOST_TARGET_FORBIDDEN');
  });

  it('should scope inventory workspaces by owner and allow admin override', async () => {
    const owner = await appLogin('operator-a');

    const privateWorkspace = await request('POST', '/api/workspaces/inventory', {
      name: 'Private Search',
      scope: 'host',
      query: 'prod',
      targetConnectionId: null,
      notes: '',
      visibility: 'private',
    }, owner.cookie);
    expect(privateWorkspace.status).toBe(201);

    const sharedWorkspace = await request('POST', '/api/workspaces/inventory', {
      name: 'Shared Search',
      scope: 'alert',
      query: 'warning',
      targetConnectionId: null,
      notes: '',
      visibility: 'shared',
    }, owner.cookie);
    expect(sharedWorkspace.status).toBe(201);

    const other = await appLogin('operator-b');
    const listed = await request('GET', '/api/workspaces/inventory', null, other.cookie);
    expect(listed.status).toBe(200);
    expect(listed.body.data.map((entry) => entry.name)).toEqual(['Shared Search']);

    const blocked = await request('DELETE', `/api/workspaces/inventory/${encodeURIComponent(sharedWorkspace.body.id)}`, null, other.cookie);
    expect(blocked.status).toBe(403);
    expect(blocked.body.error).toBe('APPROVAL_REQUIRED');

    const approval = await request('POST', '/api/governance/approvals', {
      actionKey: 'inventory_workspace_delete',
      entityType: 'workspace',
      entityRef: String(sharedWorkspace.body.id),
      entityName: sharedWorkspace.body.name,
      justification: 'Validate that approved destructive deletes still honor workspace ownership boundaries.',
      route: '/inventory',
    }, other.cookie);
    expect(approval.status).toBe(201);

    const admin = await appLogin('admin', 'admin123!');
    const decision = await request('POST', `/api/governance/approvals/${encodeURIComponent(approval.body.id)}/decision`, {
      decision: 'approved',
      notes: 'Approved to validate workspace ownership enforcement.',
    }, admin.cookie);
    expect(decision.status).toBe(200);

    const forbidden = await request('DELETE', `/api/workspaces/inventory/${encodeURIComponent(sharedWorkspace.body.id)}`, {
      approvalId: approval.body.id,
    }, other.cookie);
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.error).toBe('INVENTORY_WORKSPACE_FORBIDDEN');

    const removed = await request('DELETE', `/api/workspaces/inventory/${encodeURIComponent(privateWorkspace.body.id)}`, null, admin.cookie);
    expect(removed.status).toBe(200);
    expect(removed.body.success).toBe(true);
  });

  it('should require approved destructive tokens before operators delete owned targets and workspaces', async () => {
    governanceService.updatePolicy({
      defaultRole: 'operator',
      requireDestructiveApproval: true,
      approvalTtlMinutes: 180,
    });

    const owner = await appLogin('operator-a');
    const admin = await appLogin('admin', 'admin123!');

    const connection = await request('POST', '/api/connections', {
      name: 'Operator Approved Pool',
      host: '10.0.0.21',
      username: 'root',
      port: 443,
      visibility: 'private',
      isDefault: false,
    }, owner.cookie);
    expect(connection.status).toBe(201);

    const hostTarget = await request('POST', '/api/host-targets', {
      name: 'Operator Approved Host',
      host: '10.0.1.21',
      username: 'root',
      port: 443,
      mode: 'standalone',
      notes: '',
      visibility: 'private',
    }, owner.cookie);
    expect(hostTarget.status).toBe(201);

    const workspace = await request('POST', '/api/workspaces/inventory', {
      name: 'Approved Workspace',
      scope: 'vm',
      query: 'production',
      targetConnectionId: null,
      notes: '',
      visibility: 'private',
    }, owner.cookie);
    expect(workspace.status).toBe(201);

    const blockedConnection = await request('DELETE', `/api/connections/${connection.body.id}`, null, owner.cookie);
    expect(blockedConnection.status).toBe(403);
    expect(blockedConnection.body.error).toBe('APPROVAL_REQUIRED');

    const blockedHost = await request('DELETE', `/api/host-targets/${hostTarget.body.id}`, null, owner.cookie);
    expect(blockedHost.status).toBe(403);
    expect(blockedHost.body.error).toBe('APPROVAL_REQUIRED');

    const blockedWorkspace = await request('DELETE', `/api/workspaces/inventory/${encodeURIComponent(workspace.body.id)}`, null, owner.cookie);
    expect(blockedWorkspace.status).toBe(403);
    expect(blockedWorkspace.body.error).toBe('APPROVAL_REQUIRED');

    const connectionApproval = await request('POST', '/api/governance/approvals', {
      actionKey: 'connection_delete',
      entityType: 'connection',
      entityRef: String(connection.body.id),
      entityName: connection.body.name,
      justification: 'Remove an owned pool target during Monday, August 24, 2026 approval testing.',
      route: '/pools',
    }, owner.cookie);
    expect(connectionApproval.status).toBe(201);

    const hostApproval = await request('POST', '/api/governance/approvals', {
      actionKey: 'host_target_delete',
      entityType: 'host-target',
      entityRef: String(hostTarget.body.id),
      entityName: hostTarget.body.name,
      justification: 'Remove an owned host target during Monday, August 24, 2026 approval testing.',
      route: '/hosts',
    }, owner.cookie);
    expect(hostApproval.status).toBe(201);

    const workspaceApproval = await request('POST', '/api/governance/approvals', {
      actionKey: 'inventory_workspace_delete',
      entityType: 'workspace',
      entityRef: String(workspace.body.id),
      entityName: workspace.body.name,
      justification: 'Remove an owned workspace during Monday, August 24, 2026 approval testing.',
      route: '/inventory',
    }, owner.cookie);
    expect(workspaceApproval.status).toBe(201);

    for (const approvalId of [connectionApproval.body.id, hostApproval.body.id, workspaceApproval.body.id]) {
      const decision = await request('POST', `/api/governance/approvals/${encodeURIComponent(approvalId)}/decision`, {
        decision: 'approved',
        notes: 'Approved during Monday, August 24, 2026 ownership-route validation.',
      }, admin.cookie);
      expect(decision.status).toBe(200);
      expect(decision.body.status).toBe('approved');
    }

    const removedConnection = await request('DELETE', `/api/connections/${connection.body.id}`, {
      approvalId: connectionApproval.body.id,
    }, owner.cookie);
    expect(removedConnection.status).toBe(200);
    expect(removedConnection.body.success).toBe(true);

    const removedHost = await request('DELETE', `/api/host-targets/${hostTarget.body.id}`, {
      approvalId: hostApproval.body.id,
    }, owner.cookie);
    expect(removedHost.status).toBe(200);
    expect(removedHost.body.success).toBe(true);

    const removedWorkspace = await request('DELETE', `/api/workspaces/inventory/${encodeURIComponent(workspace.body.id)}`, {
      approvalId: workspaceApproval.body.id,
    }, owner.cookie);
    expect(removedWorkspace.status).toBe(200);
    expect(removedWorkspace.body.success).toBe(true);
  });
});
