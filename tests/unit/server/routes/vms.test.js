const http = require('http');
const path = require('path');
const fs = require('fs');
const TEST_DB = path.join(__dirname, '..', '..', '..', 'data', 'vms-routes.db');

process.env.DB_PATH = TEST_DB;

const mockState = {
  vmRecord: {},
  vmRecords: [],
  guestMetricsRecord: null,
  vmAppliances: [],
  vmSnapshotSchedules: [],
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
    if (_className === 'VM_guest_metrics' && mockState.guestMetricsRecord && ref === mockState.guestMetricsRecord.ref) {
      const { ref: _guestMetricsRef, ...record } = mockState.guestMetricsRecord;
      return { ...record };
    }

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

  actual.XenAPI.prototype.getVMAppliances = jest.fn(async function () {
    return {
      records: Object.fromEntries(
        mockState.vmAppliances.map((entry) => {
          const { ref, ...record } = entry;
          return [ref, { ...record }];
        })
      ),
    };
  });

  actual.XenAPI.prototype.getVMSnapshotSchedules = jest.fn(async function () {
    return {
      records: Object.fromEntries(
        mockState.vmSnapshotSchedules.map((entry) => {
          const { ref, ...record } = entry;
          return [ref, { ...record }];
        })
      ),
    };
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

  actual.XenAPI.prototype.updateVMConfig = jest.fn(async function (ref, payload) {
    if (ref !== mockState.vmRecord.ref) {
      const error = new Error('VM_NOT_FOUND');
      error.status = 404;
      throw error;
    }

    mockState.vmRecord = {
      ...mockState.vmRecord,
      name_label: payload.nameLabel,
      name_description: payload.nameDescription || '',
      user_version: Number(payload.userVersion || 0),
      start_delay: Number(payload.startDelay || 0),
      shutdown_delay: Number(payload.shutdownDelay || 0),
      order: Number(payload.order || 0),
      VCPUs_at_startup: payload.vcpusAtStartup,
      VCPUs_max: payload.vcpusMax || payload.vcpusAtStartup,
      memory_static_min: payload.memoryStaticMin,
      memory_dynamic_min: payload.memoryDynamicMin || payload.memoryDynamicMax || payload.memoryStaticMin,
      memory_static_max: payload.memoryStaticMax,
      memory_dynamic_max: payload.memoryDynamicMax || payload.memoryStaticMax,
      hardware_platform_version: Number(payload.hardwarePlatformVersion || 0),
      domain_type: String(payload.domainType || 'unspecified').trim() || 'unspecified',
      has_vendor_device: Boolean(payload.hasVendorDevice),
      affinity: payload.affinity || '',
      appliance: payload.applianceRef || '',
      snapshot_schedule: payload.snapshotScheduleRef || '',
      tags: Array.isArray(payload.tags) ? [...payload.tags] : [],
      blocked_operations: payload.blockedOperations || {},
      VCPUs_params: payload.vcpusParams || {},
      other_config: payload.otherConfig || {},
      xenstore_data: payload.xenstoreData || {},
      NVRAM: payload.nvram || {},
      platform: payload.platform || {},
    };
    mockState.vmRecords = mockState.vmRecords.map((entry) => (entry.ref === ref ? { ...mockState.vmRecord } : entry));
    return { ...mockState.vmRecord };
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

  actual.XenAPI.prototype.removeVMNic = jest.fn(async function (ref, vifRef) {
    if (ref !== mockState.vmRecord.ref) {
      const error = new Error('VM_NOT_FOUND');
      error.status = 404;
      throw error;
    }

    if (!(mockState.vmRecord.VIFs || []).includes(vifRef)) {
      const error = new Error('VM_NIC_NOT_FOUND');
      error.code = 'VM_NIC_NOT_FOUND';
      error.status = 404;
      throw error;
    }

    mockState.vmRecord.VIFs = (mockState.vmRecord.VIFs || []).filter((entry) => entry !== vifRef);
    mockState.vmRecords = mockState.vmRecords.map((entry) => (entry.ref === ref ? { ...entry, VIFs: [...mockState.vmRecord.VIFs] } : entry));
    return {
      success: true,
      vmRef: ref,
      vifRef,
      networkRef: 'OpaqueRef:net1',
    };
  });

  actual.XenAPI.prototype.disconnectVMNic = jest.fn(async function (ref, vifRef) {
    if (ref !== mockState.vmRecord.ref) {
      const error = new Error('VM_NOT_FOUND');
      error.status = 404;
      throw error;
    }

    if (!(mockState.vmRecord.VIFs || []).includes(vifRef)) {
      const error = new Error('VM_NIC_NOT_FOUND');
      error.code = 'VM_NIC_NOT_FOUND';
      error.status = 404;
      throw error;
    }

    return {
      success: true,
      vmRef: ref,
      vifRef,
      networkRef: 'OpaqueRef:net1',
      alreadyDisconnected: false,
      currentlyAttached: false,
      device: '0',
      mac: '02:16:3e:10:00:01',
    };
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
      name_description: 'Primary application workload.',
      power_state: 'Running',
      user_version: 4,
      start_delay: 15,
      shutdown_delay: 20,
      order: 2,
      uuid: 'vm-uuid-1',
      resident_on: 'OpaqueRef:host1',
      affinity: 'OpaqueRef:host1',
      appliance: 'OpaqueRef:appliance1',
      snapshot_schedule: 'OpaqueRef:vmss1',
      guest_metrics: 'OpaqueRef:guestmetrics1',
      recommendations: '<restrictions><vcpus max="4"/></restrictions>',
      VCPUs_at_startup: 2,
      VCPUs_max: 2,
      memory_static_min: 2147483648,
      memory_static_max: 4294967296,
      memory_dynamic_max: 4294967296,
      hardware_platform_version: 3,
      domain_type: 'hvm',
      has_vendor_device: true,
      tags: ['prod'],
      blocked_operations: {
        pool_migrate: 'OPERATION_NOT_ALLOWED',
      },
      VCPUs_params: {
        weight: '256',
        cap: '0',
      },
      other_config: {
        owner: 'platform-ops',
      },
      xenstore_data: {
        'vm-data/cloud-init': 'disabled',
      },
      NVRAM: {
        'EFI/BootOrder': '0001,0002',
      },
      platform: {
        secureboot: 'enabled',
        firmware: 'uefi',
      },
      VIFs: ['OpaqueRef:vif1'],
    };
    mockState.vmRecords = [{ ...mockState.vmRecord }];
    mockState.guestMetricsRecord = {
      ref: 'OpaqueRef:guestmetrics1',
      uuid: 'guestmetrics-uuid-1',
      live: true,
      last_updated: '2026-08-27T11:20:00.000Z',
      os_version: {
        name: 'Ubuntu',
        distro: '24.04 LTS',
      },
      PV_drivers_detected: true,
      PV_drivers_up_to_date: true,
      PV_drivers_version: {
        major: '9',
        minor: '4',
      },
      networks: {
        '0/ip': '10.0.0.101',
      },
    };
    mockState.vmAppliances = [
      {
        ref: 'OpaqueRef:appliance1',
        uuid: 'appliance-uuid-1',
        name_label: 'Billing Stack',
        name_description: 'Coordinates the billing service tier.',
        VMs: ['OpaqueRef:vm1'],
      },
      {
        ref: 'OpaqueRef:appliance2',
        uuid: 'appliance-uuid-2',
        name_label: 'Analytics Tier',
        name_description: 'Coordinates the analytics workloads.',
        VMs: [],
      },
    ];
    mockState.vmSnapshotSchedules = [
      {
        ref: 'OpaqueRef:vmss1',
        uuid: 'vmss-uuid-1',
        name_label: 'Nightly Billing Recovery',
        name_description: 'Nightly recovery snapshots for the billing tier.',
        enabled: true,
        type: 'snapshot',
        frequency: 'daily',
        retained_snapshots: 7,
        schedule: { hour: '02', min: '30', days: '1,2,3,4,5' },
        VMs: ['OpaqueRef:vm1'],
      },
      {
        ref: 'OpaqueRef:vmss2',
        uuid: 'vmss-uuid-2',
        name_label: 'Weekly Analytics Checkpoint',
        name_description: 'Weekly checkpoint coverage for analytics workloads.',
        enabled: true,
        type: 'checkpoint',
        frequency: 'weekly',
        retained_snapshots: 4,
        schedule: { hour: '03', min: '15', days: '0' },
        VMs: [],
      },
    ];
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
    const auth = await request('POST', '/api/auth/login', {
      username: 'admin',
      password: 'admin123!',
    });

    return request('POST', '/api/auth/xen-login', {
      host,
      username: 'root',
      password: 'pass',
    }, auth.cookie);
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

  it('lists VM appliance assignment options', async () => {
    const auth = await login();
    const res = await request('GET', '/api/vms/appliances', null, auth.cookie);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.data[0]).toEqual(expect.objectContaining({
      ref: 'OpaqueRef:appliance1',
      name_label: 'Billing Stack',
    }));
  });

  it('lists VM snapshot schedule assignment options', async () => {
    const auth = await login();
    const res = await request('GET', '/api/vms/snapshot-schedules', null, auth.cookie);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.data[0]).toEqual(expect.objectContaining({
      ref: 'OpaqueRef:vmss1',
      name_label: 'Nightly Billing Recovery',
    }));
  });

  it('returns VM detail with guest metrics enrichment and recommendations guidance', async () => {
    const auth = await login();
    const res = await request('GET', '/api/vms/OpaqueRef%3Avm1', null, auth.cookie);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({
      ref: 'OpaqueRef:vm1',
      name_label: 'app-01',
      guest_metrics: 'OpaqueRef:guestmetrics1',
      recommendations: '<restrictions><vcpus max="4"/></restrictions>',
      guest_metrics_record: expect.objectContaining({
        ref: 'OpaqueRef:guestmetrics1',
        live: true,
        os_version: expect.objectContaining({
          name: 'Ubuntu',
          distro: '24.04 LTS',
        }),
        PV_drivers_version: expect.objectContaining({
          major: '9',
          minor: '4',
        }),
      }),
    }));
  });

  it('updates VM config metadata including the full memory envelope, hardware platform, domain type, and advanced maps through the config endpoint', async () => {
    const auth = await login();
    const res = await request('PUT', '/api/vms/OpaqueRef%3Avm1/config', {
      nameLabel: 'app-01-renamed',
      nameDescription: 'Updated operator-facing VM description.',
      userVersion: 8,
      startDelay: 45,
      shutdownDelay: 90,
      order: 3,
      vcpusAtStartup: 4,
      vcpusMax: 6,
      memoryStaticMin: 4294967296,
      memoryDynamicMin: 6442450944,
      memoryDynamicMax: 7516192768,
      memoryStaticMax: 8589934592,
      hardwarePlatformVersion: 4,
      domainType: 'pvh',
      hasVendorDevice: false,
      affinity: 'OpaqueRef:host2',
      applianceRef: 'OpaqueRef:appliance2',
      snapshotScheduleRef: 'OpaqueRef:vmss2',
      tags: ['prod', 'linux', 'tier-1'],
      blockedOperations: {
        start: 'OPERATION_NOT_ALLOWED',
        pool_migrate: 'OPERATION_NOT_ALLOWED',
      },
      vcpusParams: {
        weight: '512',
        cap: '75',
      },
      otherConfig: {
        owner: 'storage-team',
        patchWindow: 'sun-0200',
      },
      xenstoreData: {
        'vm-data/cloud-init': 'enabled',
        'guest/channel': 'ops',
      },
      nvram: {
        'EFI/BootOrder': '0003,0004',
        'EFI/SecureBootMode': 'user',
      },
      platform: {
        secureboot: 'disabled',
        firmware: 'bios',
      },
    }, auth.cookie);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({
      ref: 'OpaqueRef:vm1',
      name_label: 'app-01-renamed',
      name_description: 'Updated operator-facing VM description.',
      user_version: 8,
      start_delay: 45,
      shutdown_delay: 90,
      order: 3,
      VCPUs_at_startup: 4,
      VCPUs_max: 6,
      memory_static_min: 4294967296,
      memory_dynamic_min: 6442450944,
      memory_static_max: 8589934592,
      memory_dynamic_max: 7516192768,
      hardware_platform_version: 4,
      domain_type: 'pvh',
      has_vendor_device: false,
      affinity: 'OpaqueRef:host2',
      appliance: 'OpaqueRef:appliance2',
      snapshot_schedule: 'OpaqueRef:vmss2',
      tags: ['prod', 'linux', 'tier-1'],
      blocked_operations: {
        start: 'OPERATION_NOT_ALLOWED',
        pool_migrate: 'OPERATION_NOT_ALLOWED',
      },
      VCPUs_params: {
        weight: '512',
        cap: '75',
      },
      other_config: {
        owner: 'storage-team',
        patchWindow: 'sun-0200',
      },
      xenstore_data: {
        'vm-data/cloud-init': 'enabled',
        'guest/channel': 'ops',
      },
      NVRAM: {
        'EFI/BootOrder': '0003,0004',
        'EFI/SecureBootMode': 'user',
      },
      platform: {
        secureboot: 'disabled',
        firmware: 'bios',
      },
    }));
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

  it('removes a VM network interface attachment', async () => {
    const auth = await login();

    const res = await request(
      'DELETE',
      '/api/vms/OpaqueRef%3Avm1/nics/OpaqueRef%3Avif1',
      { force: true },
      auth.cookie
    );

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      vmRef: 'OpaqueRef:vm1',
      vifRef: 'OpaqueRef:vif1',
      networkRef: 'OpaqueRef:net1',
    });
    expect(mockState.vmRecord.VIFs).toEqual([]);
  });

  it('hot-unplugs a VM network interface without deleting it', async () => {
    const auth = await login();

    const res = await request(
      'POST',
      '/api/vms/OpaqueRef%3Avm1/nics/OpaqueRef%3Avif1/disconnect',
      { force: true },
      auth.cookie
    );

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      vmRef: 'OpaqueRef:vm1',
      vifRef: 'OpaqueRef:vif1',
      networkRef: 'OpaqueRef:net1',
      alreadyDisconnected: false,
      currentlyAttached: false,
      device: '0',
      mac: '02:16:3e:10:00:01',
    });
    expect(mockState.vmRecord.VIFs).toEqual(['OpaqueRef:vif1']);
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

  it('blocks VM import in read-only governance mode', async () => {
    const auth = await login();
    await request('PUT', '/api/governance/role', { role: 'read-only' }, auth.cookie);

    const res = await request(
      'PUT',
      '/api/vms/import?srRef=OpaqueRef%3Asr1&restore=true&force=true',
      Buffer.from('demo-xva-package'),
      auth.cookie,
      { 'X-Xenmange-Filename': 'blocked-import.xva' }
    );

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('READ_ONLY_MODE');
  });
});
