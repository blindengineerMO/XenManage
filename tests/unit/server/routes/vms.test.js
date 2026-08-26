const http = require('http');
const path = require('path');
const fs = require('fs');
const TEST_DB = path.join(__dirname, '..', '..', '..', 'data', 'vms-routes.db');

process.env.DB_PATH = TEST_DB;

const mockState = {
  vmRecord: {},
  vmRecords: [],
  snapshots: [],
  duplicates: [],
  consoles: [],
};

jest.mock('../../../../server/services/xenapi', () => {
  const actual = jest.requireActual('../../../../server/services/xenapi');
  const { Readable } = require('stream');

  actual.XenAPI.prototype.login = jest.fn(async function () {
    this.sessionRef = 'OpaqueRef:mock-session';
    return this.sessionRef;
  });

  actual.XenAPI.prototype.logout = jest.fn(async function () {
    this.sessionRef = null;
  });

  actual.XenAPI.prototype.getRecord = jest.fn(async function (_className, ref) {
    const vm = mockState.vmRecords.find((entry) => entry.ref === ref);
    if (vm) {
      return { ...vm };
    }

    if (ref === mockState.vmRecord.ref) {
      return { ...mockState.vmRecord };
    }

    const snapshot = mockState.snapshots.find((entry) => entry.ref === ref);
    if (snapshot) {
      return { ...snapshot };
    }

    return {
      name_label: 'fallback-record',
      power_state: 'Running',
    };
  });

  actual.XenAPI.prototype.getVMs = jest.fn(async function () {
    return {
      records: Object.fromEntries(
        mockState.vmRecords.map((entry) => {
          const { ref, ...record } = entry;
          return [ref, { ...record }];
        })
      ),
    };
  });

  actual.XenAPI.prototype.getVMSnapshots = jest.fn(async function (ref) {
    if (ref !== mockState.vmRecord.ref) return [];
    return mockState.snapshots.map((entry) => ({ ...entry }));
  });

  actual.XenAPI.prototype.createVMSnapshot = jest.fn(async function (ref, payload) {
    const snapshot = {
      ref: `OpaqueRef:snap${mockState.snapshots.length + 1}`,
      uuid: `snap-uuid-${mockState.snapshots.length + 1}`,
      name_label: payload.nameLabel,
      name_description: payload.nameDescription || '',
      snapshot_time: '2026-08-24T12:30:00.000Z',
      snapshot_of: ref,
      snapshot_mode: payload.mode,
      is_a_snapshot: true,
      power_state: mockState.vmRecord.power_state,
    };
    mockState.snapshots.unshift(snapshot);
    return { ...snapshot };
  });

  actual.XenAPI.prototype.revertVMSnapshot = jest.fn(async function (snapshotRef) {
    mockState.vmRecord.last_reverted_snapshot = snapshotRef;
    return { success: true };
  });

  actual.XenAPI.prototype.deleteVMSnapshot = jest.fn(async function (snapshotRef) {
    mockState.snapshots = mockState.snapshots.filter((entry) => entry.ref !== snapshotRef);
    return { success: true };
  });

  actual.XenAPI.prototype.duplicateVM = jest.fn(async function (_ref, payload) {
    const record = {
      ref: `OpaqueRef:vm${mockState.duplicates.length + 2}`,
      uuid: `vm-uuid-${mockState.duplicates.length + 2}`,
      name_label: payload.nameLabel,
      name_description: payload.nameDescription || '',
      power_state: payload.startAfter ? 'Running' : 'Halted',
      duplication_mode: payload.mode,
      targetSrRef: payload.srRef || '',
    };
    mockState.duplicates.push(record);
    mockState.vmRecords.push({ ...record });
    return { ...record };
  });

  actual.XenAPI.prototype.migrateVM = jest.fn(async function (_ref, payload) {
    mockState.vmRecord.resident_on = payload.hostRef;
    if (payload.setAsHomeServer) {
      mockState.vmRecord.affinity = payload.hostRef;
    }
    mockState.vmRecord.last_migration_mode = payload.live ? 'live' : 'relocate';
    return {
      ...mockState.vmRecord,
      migration_mode: payload.live ? 'live' : 'relocate',
      migrated_to: payload.hostRef,
      homeServerUpdated: Boolean(payload.setAsHomeServer),
      homeServerUpdateError: '',
    };
  });

  actual.XenAPI.prototype.migrateVMToTarget = jest.fn(async function (_ref, _destinationApi, payload) {
    const destinationRef = 'OpaqueRef:vm99';
    const destinationRecord = {
      ...mockState.vmRecord,
      ref: destinationRef,
      uuid: 'vm-uuid-99',
      resident_on: 'OpaqueRef:host9',
      affinity: 'OpaqueRef:host9',
      power_state: payload.copy ? 'Halted' : mockState.vmRecord.power_state,
    };
    mockState.vmRecords.push(destinationRecord);
    return {
      ...destinationRecord,
      migration_mode: payload.copy ? 'cross-pool-copy' : 'cross-pool-live',
      destinationTargetKey: payload.destinationTargetKey,
      destinationVmRef: destinationRef,
      destinationVmUuid: destinationRecord.uuid,
      targetSrRef: payload.srRef,
      transferNetworkRef: payload.transferNetworkRef,
      homeServerUpdated: false,
      homeServerUpdateError: '',
    };
  });

  actual.XenAPI.prototype.exportVM = jest.fn(async function (ref, query = {}) {
    return {
      status: 200,
      headers: {
        'content-type': 'application/octet-stream',
        'content-disposition': `attachment; filename="${query.metadataOnly ? 'app-01-metadata.xva' : 'app-01.xva'}"`,
      },
      data: Readable.from([`xva:${ref}:${query.metadataOnly ? 'metadata' : 'full'}`]),
    };
  });

  actual.XenAPI.prototype.importVM = jest.fn(async function () {
    const imported = {
      ref: `OpaqueRef:vm${mockState.vmRecords.length + 1}`,
      uuid: `vm-uuid-${mockState.vmRecords.length + 1}`,
      name_label: 'imported-app-01',
      name_description: 'Imported from XVA on Monday, August 24, 2026.',
      power_state: 'Halted',
      resident_on: 'OpaqueRef:host1',
      affinity: 'OpaqueRef:host1',
      VCPUs_at_startup: 2,
      memory_static_max: 4294967296,
      VBDs: [],
      VIFs: [],
    };
    mockState.vmRecords.push(imported);
    return { status: 200, data: 'ok', imported };
  });

  actual.XenAPI.prototype.rpc = jest.fn(async function () {
    return {};
  });

  actual.XenAPI.prototype.getVMCompatibility = jest.fn(async function (ref) {
    return {
      ref,
      uuid: mockState.vmRecord.uuid,
      name_label: mockState.vmRecord.name_label,
      power_state: mockState.vmRecord.power_state,
      resident_on: mockState.vmRecord.resident_on,
      affinity: mockState.vmRecord.affinity,
      hardwarePlatformVersion: 3,
      lastBootCpuFlags: { aes: 'true', avx: 'true', sse4_2: 'true' },
      possibleHostRefs: ['OpaqueRef:host1', 'OpaqueRef:host2'],
      hosts: [
        {
          ref: 'OpaqueRef:host1',
          name_label: 'alpha-xen',
          address: '10.0.0.11',
          enabled: true,
          maintenance_mode: false,
          currentResident: true,
          possiblePlacement: true,
          compatible: true,
          readiness: 'compatible',
          compatibilityError: '',
          sameCpuFamily: true,
          cpuModel: 'AMD EPYC 7543P',
          cpuCount: 32,
          socketCount: 2,
        },
        {
          ref: 'OpaqueRef:host2',
          name_label: 'beta-xen',
          address: '10.0.0.12',
          enabled: true,
          maintenance_mode: false,
          currentResident: false,
          possiblePlacement: true,
          compatible: true,
          readiness: 'compatible',
          compatibilityError: '',
          sameCpuFamily: true,
          cpuModel: 'AMD EPYC 7543P',
          cpuCount: 32,
          socketCount: 2,
        },
      ],
      maskingApiAvailable: false,
    };
  });

  actual.XenAPI.prototype.getVMConsoles = jest.fn(async function (ref) {
    return mockState.consoles
      .filter((entry) => entry.VM === ref)
      .map((entry) => ({ ...entry }));
  });

  actual.XenAPI.prototype.buildConsoleLocationUrl = jest.fn(function (location) {
    return new URL(String(location || '').startsWith('http')
      ? String(location)
      : `https://${this.host}${location}`);
  });

  return actual;
});

const app = require('../../../../server/index');

describe('VM Routes', () => {
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

  beforeEach(() => {
    mockState.vmRecord = {
      ref: 'OpaqueRef:vm1',
      name_label: 'app-01',
      power_state: 'Running',
      uuid: 'vm-uuid-1',
      resident_on: 'OpaqueRef:host1',
      affinity: 'OpaqueRef:host1',
    };
    mockState.vmRecords = [{ ...mockState.vmRecord }];
    mockState.duplicates = [];
    mockState.snapshots = [
      {
        ref: 'OpaqueRef:snap1',
        uuid: 'snap-uuid-1',
        name_label: 'pre-maintenance',
        name_description: 'Created before the Monday, August 24, 2026 maintenance window.',
        snapshot_time: '2026-08-24T08:00:00.000Z',
        snapshot_of: 'OpaqueRef:vm1',
        snapshot_mode: 'snapshot',
        is_a_snapshot: true,
        power_state: 'Running',
      },
    ];
    mockState.consoles = [
      {
        ref: 'OpaqueRef:console1',
        VM: 'OpaqueRef:vm1',
        protocol: 'rfb',
        location: '/console?ref=OpaqueRef:vm1',
        uuid: 'console-uuid-1',
        other_config: { display: 'main' },
        absoluteLocation: 'https://192.168.1.100/console?ref=OpaqueRef:vm1&session_id=OpaqueRef:mock-session',
      },
    ];
  });

  function request(method, pathName, body, cookie, headers = {}) {
    return new Promise((resolve, reject) => {
      const isBuffer = Buffer.isBuffer(body);
      const isString = typeof body === 'string';
      const data = body == null
        ? null
        : isBuffer || isString
          ? body
          : JSON.stringify(body);
      const options = {
        hostname: 'localhost',
        port,
        path: pathName,
        method,
        headers: {
          'Content-Type': isBuffer ? 'application/octet-stream' : 'application/json',
          ...headers,
        },
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

  async function login(host = '192.168.1.100') {
    return request('POST', '/api/auth/xen-login', {
      host,
      username: 'root',
      password: 'pass',
    });
  }

  it('lists VM snapshots for a workload', async () => {
    const auth = await login();
    const res = await request('GET', '/api/vms/OpaqueRef%3Avm1/snapshots', null, auth.cookie);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.data[0]).toEqual(expect.objectContaining({
      ref: 'OpaqueRef:snap1',
      name_label: 'pre-maintenance',
      snapshot_mode: 'snapshot',
    }));
  });

  it('creates a VM checkpoint', async () => {
    const auth = await login();
    const res = await request('POST', '/api/vms/OpaqueRef%3Avm1/snapshots', {
      nameLabel: 'pre-upgrade-checkpoint',
      nameDescription: 'Captured before the in-place middleware upgrade on Monday, August 24, 2026.',
      mode: 'checkpoint',
    }, auth.cookie);

    expect(res.status).toBe(201);
    expect(res.body).toEqual(expect.objectContaining({
      name_label: 'pre-upgrade-checkpoint',
      snapshot_mode: 'checkpoint',
    }));
    expect(mockState.snapshots).toHaveLength(2);
  });

  it('reverts and deletes VM snapshots', async () => {
    const auth = await login();

    const revert = await request(
      'POST',
      '/api/vms/OpaqueRef%3Avm1/snapshots/OpaqueRef%3Asnap1/revert',
      {},
      auth.cookie
    );
    expect(revert.status).toBe(200);
    expect(revert.body).toEqual({ success: true, snapshotRef: 'OpaqueRef:snap1' });
    expect(mockState.vmRecord.last_reverted_snapshot).toBe('OpaqueRef:snap1');

    const remove = await request(
      'DELETE',
      '/api/vms/OpaqueRef%3Avm1/snapshots/OpaqueRef%3Asnap1',
      {},
      auth.cookie
    );
    expect(remove.status).toBe(200);
    expect(remove.body).toEqual({ success: true, snapshotRef: 'OpaqueRef:snap1' });
    expect(mockState.snapshots).toHaveLength(0);
  });

  it('creates fast clones and full copies', async () => {
    const auth = await login();

    const clone = await request('POST', '/api/vms/OpaqueRef%3Avm1/duplicate', {
      nameLabel: 'app-01-clone',
      nameDescription: 'Fast clone created on Monday, August 24, 2026.',
      mode: 'clone',
      startAfter: false,
    }, auth.cookie);
    expect(clone.status).toBe(201);
    expect(clone.body).toEqual(expect.objectContaining({
      name_label: 'app-01-clone',
      duplication_mode: 'clone',
    }));

    const copy = await request('POST', '/api/vms/OpaqueRef%3Avm1/duplicate', {
      nameLabel: 'app-01-copy',
      nameDescription: 'Full copy created on Monday, August 24, 2026.',
      mode: 'copy',
      srRef: 'OpaqueRef:sr1',
      startAfter: true,
    }, auth.cookie);
    expect(copy.status).toBe(201);
    expect(copy.body).toEqual(expect.objectContaining({
      name_label: 'app-01-copy',
      duplication_mode: 'copy',
      targetSrRef: 'OpaqueRef:sr1',
      power_state: 'Running',
    }));
    expect(mockState.duplicates).toHaveLength(2);
  });

  it('migrates a VM and updates its placement metadata', async () => {
    const auth = await login();

    const res = await request('POST', '/api/vms/OpaqueRef%3Avm1/migrate', {
      mode: 'same-pool',
      hostRef: 'OpaqueRef:host2',
      live: true,
      force: false,
      compress: true,
      setAsHomeServer: true,
    }, auth.cookie);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({
      resident_on: 'OpaqueRef:host2',
      affinity: 'OpaqueRef:host2',
      migration_mode: 'live',
      migrated_to: 'OpaqueRef:host2',
      homeServerUpdated: true,
    }));
  });

  it('returns VM compatibility details for operator preflight review', async () => {
    const auth = await login();
    const res = await request('GET', '/api/vms/OpaqueRef%3Avm1/compatibility', null, auth.cookie);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({
      ref: 'OpaqueRef:vm1',
      maskingApiAvailable: false,
    }));
    expect(res.body.hosts).toEqual(expect.arrayContaining([
      expect.objectContaining({
        ref: 'OpaqueRef:host2',
        compatible: true,
        readiness: 'compatible',
      }),
    ]));
  });

  it('lists console records and serves the launch view', async () => {
    const auth = await login();
    const consoles = await request('GET', '/api/vms/OpaqueRef%3Avm1/consoles', null, auth.cookie);

    expect(consoles.status).toBe(200);
    expect(consoles.body.total).toBe(1);
    expect(consoles.body.data[0]).toEqual(expect.objectContaining({
      ref: 'OpaqueRef:console1',
      protocol: 'rfb',
    }));

    const launch = await request(
      'GET',
      '/api/vms/OpaqueRef%3Avm1/consoles/OpaqueRef%3Aconsole1/launch',
      null,
      auth.cookie
    );
    expect(launch.status).toBe(200);
    expect(launch.body).toContain('app-01 Console');
    expect(launch.body).toContain('https://192.168.1.100/console?ref=OpaqueRef:vm1');
  });

  it('migrates a VM across attached live targets', async () => {
    const auth = await login();
    await request('POST', '/api/auth/xen-login', {
      host: '192.168.1.101',
      username: 'root',
      password: 'pass',
    }, auth.cookie);
    await request('POST', '/api/auth/targets/activate', {
      targetKey: 'host:192.168.1.100|user:root|port:443',
    }, auth.cookie);

    const res = await request('POST', '/api/vms/OpaqueRef%3Avm1/migrate', {
      mode: 'cross-pool',
      destinationTargetKey: 'host:192.168.1.101|user:root|port:443',
      transferNetworkRef: 'OpaqueRef:net2',
      srRef: 'OpaqueRef:sr2',
      vifNetworkMap: [
        { vifRef: 'OpaqueRef:vif1', networkRef: 'OpaqueRef:net2' },
      ],
      live: true,
      copy: false,
    }, auth.cookie);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({
      migration_mode: 'cross-pool-live',
      destinationTargetKey: 'host:192.168.1.101|user:root|port:443',
      destinationVmRef: 'OpaqueRef:vm99',
      targetSrRef: 'OpaqueRef:sr2',
      transferNetworkRef: 'OpaqueRef:net2',
    }));
  });

  it('exports a VM as an XVA archive', async () => {
    const auth = await login();
    const res = await request('GET', '/api/vms/OpaqueRef%3Avm1/export', null, auth.cookie);

    expect(res.status).toBe(200);
    expect(res.body).toContain('xva:OpaqueRef:vm1:full');
  });

  it('imports a VM archive and returns the discovered workload record', async () => {
    const auth = await login();
    const res = await request(
      'PUT',
      '/api/vms/import?srRef=OpaqueRef%3Asr1&restore=true&force=true',
      Buffer.from('demo-xva-package'),
      auth.cookie,
      { 'X-Xenmange-Filename': 'imported-app-01.xva' }
    );

    expect(res.status).toBe(201);
    expect(res.body).toEqual(expect.objectContaining({
      success: true,
      fileName: 'imported-app-01.xva',
      metadataOnly: false,
      importedVm: expect.objectContaining({
        ref: expect.stringMatching(/^OpaqueRef:/),
        name_label: 'imported-app-01',
      }),
    }));
    expect(mockState.vmRecords.some((entry) => entry.name_label === 'imported-app-01')).toBe(true);
  });
});
