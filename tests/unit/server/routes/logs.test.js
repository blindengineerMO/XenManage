const http = require('http');
const path = require('path');
const fs = require('fs');

const TEST_DB = path.join(__dirname, '..', '..', '..', 'data', 'logs-routes.db');
const TEST_SECURITY_DB = path.join(__dirname, '..', '..', '..', 'data', 'logs-security.db');

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

  actual.XenAPI.prototype.getTasks = jest.fn(async function () {
    return {
      'OpaqueRef:task1': {
        name_label: 'Live migrate app-01',
        status: 'success',
        created: '2026-08-23T10:00:00.000Z',
        finished: '2026-08-23T10:05:00.000Z',
        result: 'Migration completed',
        error_info: [],
      },
    };
  });

  actual.XenAPI.prototype.getMessages = jest.fn(async function () {
    return {
      'OpaqueRef:msg1': {
        name: 'Storage nearing threshold',
        cls: 'SR',
        body: 'Primary SR crossed the warning threshold.',
        timestamp: '2026-08-23T12:00:00.000Z',
        uuid: 'msg-uuid-1',
        obj_uuid: 'sr-uuid-1',
      },
    };
  });

  actual.XenAPI.prototype.rpc = jest.fn(async function () {
    return {};
  });

  return actual;
});

const auditLogService = require('../../../../server/services/audit-log');
const remediationTaskService = require('../../../../server/services/remediation-tasks');
const { authEventModel } = require('../../../../server/models/security-db');
const app = require('../../../../server/index');

describe('Log Center Routes', () => {
  let server;
  let port;

  beforeAll((done) => {
    if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
    if (fs.existsSync(TEST_SECURITY_DB)) fs.unlinkSync(TEST_SECURITY_DB);
    server = app.listen(0, () => {
      port = server.address().port;
      done();
    });
  });

  afterAll((done) => {
    server.close(() => {
      if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
      if (fs.existsSync(TEST_SECURITY_DB)) fs.unlinkSync(TEST_SECURITY_DB);
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
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const bodyBuffer = Buffer.concat(chunks);
          const responseText = bodyBuffer.toString('utf8');
          const setCookie = res.headers['set-cookie'];
          let sessionCookie = cookie;
          if (setCookie) {
            const match = setCookie.find((entry) => entry.startsWith('xenmange.sid='));
            if (match) sessionCookie = match.split(';')[0];
          }

          try {
            resolve({
              status: res.statusCode,
              body: JSON.parse(responseText),
              rawBody: bodyBuffer,
              headers: res.headers,
              cookie: sessionCookie,
            });
          } catch {
            resolve({
              status: res.statusCode,
              body: responseText,
              rawBody: bodyBuffer,
              headers: res.headers,
              cookie: sessionCookie,
            });
          }
        });
      });

      req.on('error', reject);
      if (data) req.write(data);
      req.end();
    });
  }

  async function login() {
    return request('POST', '/api/auth/xen-login', {
      host: '192.168.1.100',
      username: 'root',
      password: 'pass',
    });
  }

  it('should return federated centralized log entries', async () => {
    const auth = await login();

    auditLogService.record({
      id: 'audit-entry-1',
      category: 'alerts',
      action: 'alert_state_updated',
      actionLabel: 'Updated alert state for',
      entityType: 'alert',
      entityRef: 'OpaqueRef:msg1',
      entityName: 'Storage nearing threshold',
      operator: 'root',
      route: '/alerts',
      status: 'success',
      before: { acknowledged: false },
      after: { acknowledged: true },
      detail: 'Handled on Sunday, August 23, 2026.',
    });

    authEventModel.create({
      username: 'root',
      event: 'xen_login',
      ip: '127.0.0.1',
      detail: 'Authenticated to 192.168.1.100.',
    });

    remediationTaskService.create({
      nameLabel: 'Capacity review',
      nameDescription: 'Review datastore pressure',
      actionType: 'capacity',
      assignee: 'Platform Ops',
      dueDate: '2026-08-24',
      alertRef: 'OpaqueRef:msg1',
      alertUuid: 'msg-uuid-1',
      alertSummary: 'Storage nearing threshold',
      targetRoute: '/capacity',
      relatedObject: 'sr-uuid-1',
      relatedClass: 'sr',
      workspaceSummary: 'Validate storage pressure.',
    }, 'root');

    const res = await request('GET', '/api/logs', null, auth.cookie);
    expect(res.status).toBe(200);
    expect(res.body.total).toBeGreaterThanOrEqual(4);
    expect(res.body.data.some((entry) => entry.source === 'audit')).toBe(true);
    expect(res.body.data.some((entry) => entry.source === 'auth')).toBe(true);
    expect(res.body.data.some((entry) => entry.source === 'alert')).toBe(true);
    expect(res.body.data.some((entry) => entry.source === 'remediation-task')).toBe(true);
    expect(res.body.data.some((entry) => entry.source === 'xen-task')).toBe(true);
  });

  it('should export centralized logs as json, html, and pdf', async () => {
    const auth = await login();
    const list = await request('GET', '/api/logs', null, auth.cookie);
    const ids = list.body.data.slice(0, 2).map((entry) => entry.id);

    const jsonExport = await request('POST', '/api/logs/export', {
      ids,
      format: 'json',
      source: 'all',
      severity: 'all',
    }, auth.cookie);
    expect(jsonExport.status).toBe(200);
    expect(jsonExport.headers['content-type']).toContain('application/json');
    expect(jsonExport.body.data).toHaveLength(2);

    const htmlExport = await request('POST', '/api/logs/export', {
      ids,
      format: 'html',
      source: 'all',
      severity: 'all',
    }, auth.cookie);
    expect(htmlExport.status).toBe(200);
    expect(htmlExport.headers['content-type']).toContain('text/html');
    expect(String(htmlExport.body)).toContain('XenMange Log Export');

    const pdfExport = await request('POST', '/api/logs/export', {
      ids,
      format: 'pdf',
      source: 'all',
      severity: 'all',
    }, auth.cookie);
    expect(pdfExport.status).toBe(200);
    expect(pdfExport.headers['content-type']).toContain('application/pdf');
    expect(pdfExport.rawBody.slice(0, 4).toString('utf8')).toBe('%PDF');
  });
});
