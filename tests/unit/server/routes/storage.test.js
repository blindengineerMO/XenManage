const http = require('http');
const path = require('path');
const fs = require('fs');
const governanceService = require('../../../../server/services/governance');

const TEST_DB = path.join(__dirname, '..', '..', '..', 'data', 'storage-routes.db');

process.env.DB_PATH = TEST_DB;

const mockState = {
  srs: [],
  hosts: [],
  pbds: [],
  vdisBySr: {},
};

jest.mock('../../../../server/services/xenapi', () => {
  const actual = jest.requireActual('../../../../server/services/xenapi');

  actual.XenAPI.prototype.login = jest.fn(async function () {
    this.sessionRef = 'OpaqueRef:mock-session';
    return this.sessionRef;
  });

  actual.XenAPI.prototype.logout = jest.fn(async function () {
    this.sessionRef = null;
  });

  actual.XenAPI.prototype.getSRs = jest.fn(async function () {
    return {
      refs: mockState.srs.map((sr) => sr.ref),
      records: Object.fromEntries(mockState.srs.map((sr) => [sr.ref, { ...sr }])),
    };
  });

  actual.XenAPI.prototype.getRecord = jest.fn(async function (_className, ref) {
    const sr = mockState.srs.find((entry) => entry.ref === ref);
    if (sr) return { ...sr };

    const host = mockState.hosts.find((entry) => entry.ref === ref);
    if (host) return { ...host };

    const pbd = mockState.pbds.find((entry) => entry.ref === ref);
    if (pbd) return { ...pbd };

    const vdi = Object.values(mockState.vdisBySr).flat().find((entry) => entry.ref === ref);
    if (vdi) return { ...vdi };

    return { name_label: 'fallback-storage' };
  });

  actual.XenAPI.prototype.getField = jest.fn(async function (_className, ref, field) {
    if (field === 'VDIs') {
      return (mockState.vdisBySr[ref] || []).map((entry) => entry.ref);
    }
    return [];
  });

  actual.XenAPI.prototype.rescanSR = jest.fn(async function (ref) {
    const sr = mockState.srs.find((entry) => entry.ref === ref);
    if (!sr) throw new Error('SR_NOT_FOUND');

    sr.other_config = {
      ...(sr.other_config || {}),
      last_rescan_at: '2026-08-26T18:45:00.000Z',
    };

    return { ...sr };
  });

  actual.XenAPI.prototype.repairSR = jest.fn(async function (ref) {
    const sr = mockState.srs.find((entry) => entry.ref === ref);
    if (!sr) throw new Error('SR_NOT_FOUND');

    const repairedPbdRefs = mockState.pbds
      .filter((entry) => entry.SR === ref && entry.currently_attached === false)
      .map((entry) => {
        entry.currently_attached = true;
        return entry.ref;
      });

    sr.other_config = {
      ...(sr.other_config || {}),
      last_repair_at: '2026-08-26T19:10:00.000Z',
    };

    return {
      ...sr,
      checkedPbdRefs: mockState.pbds.filter((entry) => entry.SR === ref).map((entry) => entry.ref),
      repairedPbdRefs,
      reattachedCount: repairedPbdRefs.length,
    };
  });

  actual.XenAPI.prototype.updateStorageConfig = jest.fn(async function (ref, payload) {
    const sr = mockState.srs.find((entry) => entry.ref === ref);
    if (!sr) throw new Error('SR_NOT_FOUND');

    const preservedOtherConfig = Object.fromEntries(
      Object.entries(sr.other_config || {})
        .filter(([key]) => ['last_rescan_at', 'last_repair_at'].includes(String(key || '').trim()))
    );

    sr.name_label = payload.nameLabel;
    sr.name_description = payload.nameDescription || '';
    sr.tags = Array.isArray(payload.tags) ? [...payload.tags] : [];
    sr.other_config = {
      ...preservedOtherConfig,
      ...(payload.otherConfig || {}),
    };
    return { ...sr };
  });

  actual.XenAPI.prototype.setStorageLocalCache = jest.fn(async function (ref, payload) {
    const sr = mockState.srs.find((entry) => entry.ref === ref);
    if (!sr) throw new Error('SR_NOT_FOUND');
    if (payload?.enabled && sr.shared) throw new Error('LOCAL_CACHE_REQUIRES_LOCAL_SR');

    const matchedPbd = mockState.pbds.find((entry) => entry.SR === ref && entry.host === payload?.hostRef);
    if (!matchedPbd) throw new Error('LOCAL_CACHE_REQUIRES_ATTACHED_HOST_PATH');

    sr.local_cache_enabled = Boolean(payload?.enabled);
    return {
      ...sr,
      hostRef: payload?.hostRef || '',
      matchedPbdRef: matchedPbd.ref,
      requestedEnabled: Boolean(payload?.enabled),
      local_cache_enabled: Boolean(sr.local_cache_enabled),
    };
  });

  actual.XenAPI.prototype.forgetSR = jest.fn(async function (ref) {
    const index = mockState.srs.findIndex((entry) => entry.ref === ref);
    if (index === -1) throw new Error('SR_NOT_FOUND');

    mockState.srs.splice(index, 1);
    delete mockState.vdisBySr[ref];

    return { success: true, ref };
  });

  actual.XenAPI.prototype.destroySR = jest.fn(async function (ref) {
    const index = mockState.srs.findIndex((entry) => entry.ref === ref);
    if (index === -1) throw new Error('SR_NOT_FOUND');

    mockState.srs.splice(index, 1);
    delete mockState.vdisBySr[ref];

    return { success: true, ref };
  });

  actual.XenAPI.prototype.createStorageRepository = jest.fn(async function (payload) {
    const host = mockState.hosts.find((entry) => entry.ref === payload.hostRef);
    if (!host) throw new Error('HOST_NOT_FOUND');

    const record = {
      ref: 'OpaqueRef:sr3',
      name_label: payload.nameLabel,
      name_description: payload.nameDescription || '',
      type: payload.type,
      content_type: payload.contentType || 'user',
      shared: Boolean(payload.shared),
      physical_size: 0,
      physical_utilisation: 0,
      virtual_allocation: 0,
      uuid: 'sr-uuid-3',
      PBDs: [],
      VDIs: [],
      other_config: {},
      sm_config: { ...(payload.smConfig || {}) },
      device_config: { ...(payload.deviceConfig || {}) },
    };

    mockState.srs.push(record);
    mockState.vdisBySr[record.ref] = [];
    return { ...record };
  });

  actual.XenAPI.prototype.probeStorageRepository = jest.fn(async function (payload) {
    const requestedConfiguration = { ...(payload.deviceConfig || {}) };
    const requiredByType = {
      nfs: ['server', 'serverpath'],
      lvmoiscsi: ['target', 'targetIQN', 'SCSIid'],
      ext: ['device'],
      lvm: ['device'],
    };
    const missingKeys = (requiredByType[payload.type] || []).filter((key) => !String(requestedConfiguration[key] || '').trim());

    if (missingKeys.length) {
      return {
        mode: 'probe_ext',
        requestedConfiguration,
        rawXml: '',
        results: [
          {
            complete: false,
            configuration: requestedConfiguration,
            extraInfo: {
              hint: `Provide ${missingKeys.join(', ')} to complete discovery.`,
            },
            sr: null,
          },
        ],
        summary: {
          totalResults: 1,
          completeResults: 0,
          incompleteResults: 1,
          existingSrs: 0,
          legacyXmlAvailable: false,
        },
      };
    }

    return {
      mode: 'probe_ext',
      requestedConfiguration,
      rawXml: '',
      results: [
        {
          complete: true,
          configuration: requestedConfiguration,
          extraInfo: {
            discovery: 'existing-sr',
          },
          sr: {
            uuid: 'imported-nfs-uuid',
            name_label: 'Imported Archive SR',
            name_description: 'Existing repository discovered during probe.',
            health: 'healthy',
            total_space: 21474836480,
            free_space: 8589934592,
            clustered: false,
          },
        },
      ],
      summary: {
        totalResults: 1,
        completeResults: 1,
        incompleteResults: 0,
        existingSrs: 1,
        legacyXmlAvailable: false,
      },
    };
  });

  actual.XenAPI.prototype.importStorageRepository = jest.fn(async function (payload) {
    const host = mockState.hosts.find((entry) => entry.ref === payload.hostRef);
    if (!host) throw new Error('HOST_NOT_FOUND');

    let sr = mockState.srs.find((entry) => entry.uuid === payload.uuid) || null;
    let introduced = false;
    if (!sr) {
      sr = {
        ref: 'OpaqueRef:sr3',
        name_label: payload.nameLabel,
        name_description: payload.nameDescription || '',
        type: payload.type,
        content_type: payload.contentType || 'user',
        shared: Boolean(payload.shared),
        physical_size: 21474836480,
        physical_utilisation: 0,
        virtual_allocation: 0,
        uuid: payload.uuid,
        PBDs: [],
        VDIs: [],
        other_config: {},
        sm_config: { ...(payload.smConfig || {}) },
        device_config: { ...(payload.deviceConfig || {}) },
      };
      mockState.srs.push(sr);
      mockState.vdisBySr[sr.ref] = [];
      introduced = true;
    }

    const existingPbd = mockState.pbds.find((entry) => entry.SR === sr.ref && entry.host === payload.hostRef) || null;
    const pbdRef = existingPbd?.ref || `OpaqueRef:pbd${mockState.pbds.length + 1}`;
    if (!existingPbd) {
      mockState.pbds.push({
        ref: pbdRef,
        SR: sr.ref,
        host: payload.hostRef,
        currently_attached: true,
        device_config: { ...(payload.deviceConfig || {}) },
      });
      sr.PBDs = [...(sr.PBDs || []), pbdRef];
    }

    return {
      ...sr,
      pbdRef,
      introduced,
      createdPbd: !existingPbd,
      updatedPbdConfig: false,
      pluggedPbd: !existingPbd,
      alreadyAttached: false,
      attachedHostRef: payload.hostRef,
    };
  });

  actual.XenAPI.prototype.createStorageVdi = jest.fn(async function (ref, payload) {
    const sr = mockState.srs.find((entry) => entry.ref === ref);
    if (!sr) throw new Error('SR_NOT_FOUND');

    const vdi = {
      ref: 'OpaqueRef:vdi2',
      SR: ref,
      name_label: payload.nameLabel,
      virtual_size: Number(payload.sizeBytes || 0),
      type: payload.type || 'user',
      managed: true,
      VBDs: [],
    };

    if (!mockState.vdisBySr[ref]) {
      mockState.vdisBySr[ref] = [];
    }

    mockState.vdisBySr[ref].push(vdi);
    sr.virtual_allocation = Number(sr.virtual_allocation || 0) + Number(payload.sizeBytes || 0);
    return { ...vdi };
  });

  actual.XenAPI.prototype.resizeStorageVdi = jest.fn(async function (ref, sizeBytes) {
    const vdi = Object.values(mockState.vdisBySr).flat().find((entry) => entry.ref === ref);
    if (!vdi) throw new Error('VDI_NOT_FOUND');

    const sr = mockState.srs.find((entry) => entry.ref === vdi.SR);
    const previousSize = Number(vdi.virtual_size || 0);
    const nextSize = Number(sizeBytes || previousSize);
    vdi.virtual_size = nextSize;
    if (sr) {
      sr.virtual_allocation = Number(sr.virtual_allocation || 0) + (nextSize - previousSize);
    }

    return { ...vdi };
  });

  actual.XenAPI.prototype.deleteStorageVdi = jest.fn(async function (ref) {
    for (const [srRef, entries] of Object.entries(mockState.vdisBySr)) {
      const index = entries.findIndex((entry) => entry.ref === ref);
      if (index === -1) continue;

      const [removed] = entries.splice(index, 1);
      const sr = mockState.srs.find((entry) => entry.ref === srRef);
      if (sr) {
        sr.virtual_allocation = Math.max(0, Number(sr.virtual_allocation || 0) - Number(removed?.virtual_size || 0));
      }

      return { success: true, ref };
    }

    throw new Error('VDI_NOT_FOUND');
  });

  actual.XenAPI.prototype.rpc = jest.fn(async function () {
    return {};
  });

  return actual;
});

const app = require('../../../../server/index');

describe('Storage Routes', () => {
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
    governanceService.updatePolicy({
      defaultRole: 'admin',
      requireDestructiveApproval: true,
      approvalTtlMinutes: 240,
    });
    mockState.hosts = [
      {
        ref: 'OpaqueRef:host1',
        name_label: 'alpha-xen',
        address: '10.0.0.11',
        uuid: 'host-uuid-1',
      },
    ];
    mockState.pbds = [
      {
        ref: 'OpaqueRef:pbd1',
        SR: 'OpaqueRef:sr1',
        host: 'OpaqueRef:host1',
        currently_attached: false,
      },
    ];
    mockState.srs = [
      {
        ref: 'OpaqueRef:sr1',
        name_label: 'Primary SR',
        type: 'lvm',
        physical_size: 32212254720,
        virtual_allocation: 21474836480,
        uuid: 'sr-uuid-1',
        PBDs: ['OpaqueRef:pbd1'],
        other_config: {},
      },
      {
        ref: 'OpaqueRef:sr2',
        name_label: 'Archive SR',
        type: 'nfs',
        physical_size: 21474836480,
        virtual_allocation: 0,
        uuid: 'sr-uuid-2',
        PBDs: [],
        other_config: {},
      },
    ];
    mockState.vdisBySr = {
      'OpaqueRef:sr1': [
        {
          ref: 'OpaqueRef:vdi1',
          SR: 'OpaqueRef:sr1',
          name_label: 'disk-01',
          virtual_size: 10737418240,
          type: 'user',
          managed: true,
          VBDs: ['OpaqueRef:vbd1'],
        },
      ],
      'OpaqueRef:sr2': [],
    };
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

  it('lists storage repositories and related VDIs', async () => {
    const auth = await login();

    const list = await request('GET', '/api/storage', null, auth.cookie);
    expect(list.status).toBe(200);
    expect(list.body.total).toBe(2);
    expect(list.body.data[0]).toEqual(expect.objectContaining({
      ref: 'OpaqueRef:sr1',
      name_label: 'Primary SR',
    }));

    const vdis = await request('GET', '/api/storage/OpaqueRef%3Asr1/vdis', null, auth.cookie);
    expect(vdis.status).toBe(200);
    expect(vdis.body.total).toBe(1);
    expect(vdis.body.data[0]).toEqual(expect.objectContaining({
      ref: 'OpaqueRef:vdi1',
      name_label: 'disk-01',
    }));
  });

  it('rescans a storage repository through the dedicated endpoint', async () => {
    const auth = await login();

    const rescan = await request('POST', '/api/storage/OpaqueRef%3Asr1/rescan', {}, auth.cookie);
    expect(rescan.status).toBe(200);
    expect(rescan.body).toEqual(expect.objectContaining({
      ref: 'OpaqueRef:sr1',
      name_label: 'Primary SR',
      other_config: expect.objectContaining({
        last_rescan_at: '2026-08-26T18:45:00.000Z',
      }),
    }));
  });

  it('repairs a storage repository by reattaching detached paths and refreshing metadata', async () => {
    const auth = await login();

    const repaired = await request('POST', '/api/storage/OpaqueRef%3Asr1/repair', {}, auth.cookie);
    expect(repaired.status).toBe(200);
    expect(repaired.body).toEqual(expect.objectContaining({
      ref: 'OpaqueRef:sr1',
      name_label: 'Primary SR',
      reattachedCount: 1,
      repairedPbdRefs: ['OpaqueRef:pbd1'],
      other_config: expect.objectContaining({
        last_repair_at: '2026-08-26T19:10:00.000Z',
      }),
    }));
  });

  it('updates storage repository metadata fields through the config endpoint', async () => {
    const auth = await login();
    mockState.srs[0].other_config = {
      last_rescan_at: '2026-08-26T18:45:00.000Z',
      owner: 'platform-ops',
    };

    const updated = await request('PUT', '/api/storage/OpaqueRef%3Asr1/config', {
      nameLabel: 'Primary SR Renamed',
      nameDescription: 'Updated operator-facing description for the primary repository.',
      tags: ['flash', 'tier-2'],
      otherConfig: {
        tier: 'gold',
        owner: 'storage-team',
      },
    }, auth.cookie);

    expect(updated.status).toBe(200);
    expect(updated.body).toEqual(expect.objectContaining({
      ref: 'OpaqueRef:sr1',
      name_label: 'Primary SR Renamed',
      name_description: 'Updated operator-facing description for the primary repository.',
      tags: ['flash', 'tier-2'],
      other_config: expect.objectContaining({
        last_rescan_at: '2026-08-26T18:45:00.000Z',
        tier: 'gold',
        owner: 'storage-team',
      }),
    }));
  });

  it('enables local cache for a non-shared repository on an attached host path', async () => {
    const auth = await login();

    const toggled = await request('POST', '/api/storage/OpaqueRef%3Asr1/local-cache', {
      hostRef: 'OpaqueRef:host1',
      enabled: true,
    }, auth.cookie);

    expect(toggled.status).toBe(200);
    expect(toggled.body).toEqual(expect.objectContaining({
      ref: 'OpaqueRef:sr1',
      name_label: 'Primary SR',
      hostRef: 'OpaqueRef:host1',
      matchedPbdRef: 'OpaqueRef:pbd1',
      requestedEnabled: true,
      local_cache_enabled: true,
    }));
  });

  it('creates a detached vdi on the selected storage repository', async () => {
    const auth = await login();

    const created = await request('POST', '/api/storage/OpaqueRef%3Asr1/vdis', {
      nameLabel: 'logs-archive-01',
      sizeBytes: 12884901888,
      type: 'metadata',
    }, auth.cookie);

    expect(created.status).toBe(201);
    expect(created.body).toEqual(expect.objectContaining({
      ref: 'OpaqueRef:vdi2',
      name_label: 'logs-archive-01',
      virtual_size: 12884901888,
      type: 'metadata',
    }));

    const vdis = await request('GET', '/api/storage/OpaqueRef%3Asr1/vdis', null, auth.cookie);
    expect(vdis.status).toBe(200);
    expect(vdis.body.total).toBe(2);
    expect(vdis.body.data[1]).toEqual(expect.objectContaining({
      ref: 'OpaqueRef:vdi2',
      name_label: 'logs-archive-01',
    }));
  });

  it('resizes an existing vdi on the selected storage repository', async () => {
    const auth = await login();

    const resized = await request('POST', '/api/storage/OpaqueRef%3Asr1/vdis/OpaqueRef%3Avdi1/resize', {
      sizeBytes: 21474836480,
    }, auth.cookie);

    expect(resized.status).toBe(200);
    expect(resized.body).toEqual(expect.objectContaining({
      ref: 'OpaqueRef:vdi1',
      name_label: 'disk-01',
      virtual_size: 21474836480,
    }));

    const vdis = await request('GET', '/api/storage/OpaqueRef%3Asr1/vdis', null, auth.cookie);
    expect(vdis.status).toBe(200);
    expect(vdis.body.data[0]).toEqual(expect.objectContaining({
      ref: 'OpaqueRef:vdi1',
      virtual_size: 21474836480,
    }));
  });

  it('deletes an existing vdi on the selected storage repository', async () => {
    const auth = await login();

    const created = await request('POST', '/api/storage/OpaqueRef%3Asr1/vdis', {
      nameLabel: 'delete-me',
      sizeBytes: 2147483648,
      type: 'user',
    }, auth.cookie);
    expect(created.status).toBe(201);

    const removed = await request('DELETE', '/api/storage/OpaqueRef%3Asr1/vdis/OpaqueRef%3Avdi2', {}, auth.cookie);
    expect(removed.status).toBe(200);
    expect(removed.body).toEqual(expect.objectContaining({
      success: true,
      vdiRef: 'OpaqueRef:vdi2',
    }));

    const vdis = await request('GET', '/api/storage/OpaqueRef%3Asr1/vdis', null, auth.cookie);
    expect(vdis.status).toBe(200);
    expect(vdis.body.total).toBe(1);
    expect(vdis.body.data[0]).toEqual(expect.objectContaining({
      ref: 'OpaqueRef:vdi1',
      name_label: 'disk-01',
    }));
  });

  it('blocks deletion when the selected vdi is still attached to a workload', async () => {
    const auth = await login();

    const removed = await request('DELETE', '/api/storage/OpaqueRef%3Asr1/vdis/OpaqueRef%3Avdi1', {}, auth.cookie);
    expect(removed.status).toBe(409);
    expect(removed.body).toEqual(expect.objectContaining({
      error: 'VDI_DELETE_REQUIRES_DETACHED_DISK',
    }));
  });

  it('requires approved destructive tokens before operators delete vdis', async () => {
    const auth = await login();

    const created = await request('POST', '/api/storage/OpaqueRef%3Asr1/vdis', {
      nameLabel: 'approval-target',
      sizeBytes: 2147483648,
      type: 'user',
    }, auth.cookie);
    expect(created.status).toBe(201);

    const lower = await request('PUT', '/api/governance/role', { role: 'operator' }, auth.cookie);
    expect(lower.status).toBe(200);

    const blocked = await request('DELETE', '/api/storage/OpaqueRef%3Asr1/vdis/OpaqueRef%3Avdi2', {}, auth.cookie);
    expect(blocked.status).toBe(403);
    expect(blocked.body.error).toBe('APPROVAL_REQUIRED');

    const approval = await request('POST', '/api/governance/approvals', {
      actionKey: 'vdi_delete',
      entityType: 'vdi',
      entityRef: 'OpaqueRef:vdi2',
      entityName: 'approval-target',
      justification: 'Delete a detached VDI during Wednesday, August 26, 2026 approval validation.',
      route: '/storage',
    }, auth.cookie);
    expect(approval.status).toBe(201);

    const elevate = await request('PUT', '/api/governance/role', { role: 'admin' }, auth.cookie);
    expect(elevate.status).toBe(200);

    const decision = await request('POST', `/api/governance/approvals/${encodeURIComponent(approval.body.id)}/decision`, {
      decision: 'approved',
      notes: 'Approved during Wednesday, August 26, 2026 storage validation.',
    }, auth.cookie);
    expect(decision.status).toBe(200);

    const lowerAgain = await request('PUT', '/api/governance/role', { role: 'operator' }, auth.cookie);
    expect(lowerAgain.status).toBe(200);

    const removed = await request('DELETE', '/api/storage/OpaqueRef%3Asr1/vdis/OpaqueRef%3Avdi2', {
      approvalId: approval.body.id,
    }, auth.cookie);
    expect(removed.status).toBe(200);
    expect(removed.body.success).toBe(true);
  });

  it('creates a new storage repository on the selected host', async () => {
    const auth = await login();

    const created = await request('POST', '/api/storage', {
      hostRef: 'OpaqueRef:host1',
      nameLabel: 'Tier 2 NFS',
      nameDescription: 'Archive-capacity NFS storage',
      type: 'nfs',
      contentType: 'user',
      shared: true,
      deviceConfig: {
        server: '10.42.0.25',
        serverpath: '/exports/xen/tier2',
      },
      smConfig: {
        allocation: 'thin',
      },
    }, auth.cookie);

    expect(created.status).toBe(201);
    expect(created.body).toEqual(expect.objectContaining({
      ref: 'OpaqueRef:sr3',
      name_label: 'Tier 2 NFS',
      type: 'nfs',
      shared: true,
    }));

    const list = await request('GET', '/api/storage', null, auth.cookie);
    expect(list.status).toBe(200);
    expect(list.body.total).toBe(3);
  });

  it('probes a storage repository target and returns import discovery details', async () => {
    const auth = await login();

    const probed = await request('POST', '/api/storage/probe', {
      hostRef: 'OpaqueRef:host1',
      type: 'nfs',
      deviceConfig: {
        server: '10.42.0.25',
        serverpath: '/exports/xen/imported',
      },
      smConfig: {},
    }, auth.cookie);

    expect(probed.status).toBe(200);
    expect(probed.body).toEqual(expect.objectContaining({
      mode: 'probe_ext',
      summary: expect.objectContaining({
        totalResults: 1,
        completeResults: 1,
        existingSrs: 1,
      }),
    }));
    expect(probed.body.results[0]).toEqual(expect.objectContaining({
      complete: true,
      configuration: expect.objectContaining({
        server: '10.42.0.25',
        serverpath: '/exports/xen/imported',
      }),
      sr: expect.objectContaining({
        name_label: 'Imported Archive SR',
        health: 'healthy',
      }),
    }));
  });

  it('introduces a probed storage repository and attaches it to the selected host', async () => {
    const auth = await login();

    const imported = await request('POST', '/api/storage/import', {
      hostRef: 'OpaqueRef:host1',
      uuid: 'imported-nfs-uuid',
      nameLabel: 'Imported Archive SR',
      nameDescription: 'Existing repository discovered during probe.',
      type: 'nfs',
      contentType: 'user',
      shared: true,
      deviceConfig: {
        server: '10.42.0.25',
        serverpath: '/exports/xen/imported',
      },
      smConfig: {},
    }, auth.cookie);

    expect(imported.status).toBe(201);
    expect(imported.body).toEqual(expect.objectContaining({
      ref: 'OpaqueRef:sr3',
      uuid: 'imported-nfs-uuid',
      name_label: 'Imported Archive SR',
      introduced: true,
      createdPbd: true,
      attachedHostRef: 'OpaqueRef:host1',
    }));

    const list = await request('GET', '/api/storage', null, auth.cookie);
    expect(list.status).toBe(200);
    expect(list.body.total).toBe(3);
    expect(list.body.data[2]).toEqual(expect.objectContaining({
      ref: 'OpaqueRef:sr3',
      name_label: 'Imported Archive SR',
    }));
  });

  it('forgets an existing storage repository through the dedicated endpoint', async () => {
    const auth = await login();

    const forgotten = await request('POST', '/api/storage/OpaqueRef%3Asr1/forget', {}, auth.cookie);
    expect(forgotten.status).toBe(200);
    expect(forgotten.body).toEqual(expect.objectContaining({
      success: true,
      ref: 'OpaqueRef:sr1',
    }));

    const list = await request('GET', '/api/storage', null, auth.cookie);
    expect(list.status).toBe(200);
    expect(list.body.total).toBe(1);
    expect(list.body.data[0]).toEqual(expect.objectContaining({
      ref: 'OpaqueRef:sr2',
      name_label: 'Archive SR',
    }));
  });

  it('requires approved destructive tokens before operators forget storage repositories', async () => {
    const auth = await login();

    const lower = await request('PUT', '/api/governance/role', { role: 'operator' }, auth.cookie);
    expect(lower.status).toBe(200);

    const blocked = await request('POST', '/api/storage/OpaqueRef%3Asr1/forget', {}, auth.cookie);
    expect(blocked.status).toBe(403);
    expect(blocked.body.error).toBe('APPROVAL_REQUIRED');

    const approval = await request('POST', '/api/governance/approvals', {
      actionKey: 'sr_forget',
      entityType: 'sr',
      entityRef: 'OpaqueRef:sr1',
      entityName: 'Primary SR',
      justification: 'Forget an unused storage repository during Wednesday, August 26, 2026 approval validation.',
      route: '/storage',
    }, auth.cookie);
    expect(approval.status).toBe(201);

    const elevate = await request('PUT', '/api/governance/role', { role: 'admin' }, auth.cookie);
    expect(elevate.status).toBe(200);

    const decision = await request('POST', `/api/governance/approvals/${encodeURIComponent(approval.body.id)}/decision`, {
      decision: 'approved',
      notes: 'Approved during Wednesday, August 26, 2026 storage repository lifecycle validation.',
    }, auth.cookie);
    expect(decision.status).toBe(200);

    const lowerAgain = await request('PUT', '/api/governance/role', { role: 'operator' }, auth.cookie);
    expect(lowerAgain.status).toBe(200);

    const forgotten = await request('POST', '/api/storage/OpaqueRef%3Asr1/forget', {
      approvalId: approval.body.id,
    }, auth.cookie);
    expect(forgotten.status).toBe(200);
    expect(forgotten.body.success).toBe(true);
  });

  it('blocks repository destruction until the selected storage repository is empty', async () => {
    const auth = await login();

    const blocked = await request('POST', '/api/storage/OpaqueRef%3Asr1/destroy', {}, auth.cookie);
    expect(blocked.status).toBe(409);
    expect(blocked.body.error).toBe('SR_DESTROY_REQUIRES_EMPTY_REPOSITORY');
  });

  it('destroys an empty storage repository through the dedicated endpoint', async () => {
    const auth = await login();

    const destroyed = await request('POST', '/api/storage/OpaqueRef%3Asr2/destroy', {}, auth.cookie);
    expect(destroyed.status).toBe(200);
    expect(destroyed.body).toEqual(expect.objectContaining({
      success: true,
      ref: 'OpaqueRef:sr2',
    }));

    const list = await request('GET', '/api/storage', null, auth.cookie);
    expect(list.status).toBe(200);
    expect(list.body.total).toBe(1);
    expect(list.body.data[0]).toEqual(expect.objectContaining({
      ref: 'OpaqueRef:sr1',
      name_label: 'Primary SR',
    }));
  });

  it('requires approved destructive tokens before operators destroy empty storage repositories', async () => {
    const auth = await login();

    const lower = await request('PUT', '/api/governance/role', { role: 'operator' }, auth.cookie);
    expect(lower.status).toBe(200);

    const blocked = await request('POST', '/api/storage/OpaqueRef%3Asr2/destroy', {}, auth.cookie);
    expect(blocked.status).toBe(403);
    expect(blocked.body.error).toBe('APPROVAL_REQUIRED');

    const approval = await request('POST', '/api/governance/approvals', {
      actionKey: 'sr_destroy',
      entityType: 'sr',
      entityRef: 'OpaqueRef:sr2',
      entityName: 'Archive SR',
      justification: 'Destroy an empty storage repository during Wednesday, August 26, 2026 approval validation.',
      route: '/storage',
    }, auth.cookie);
    expect(approval.status).toBe(201);

    const elevate = await request('PUT', '/api/governance/role', { role: 'admin' }, auth.cookie);
    expect(elevate.status).toBe(200);

    const decision = await request('POST', `/api/governance/approvals/${encodeURIComponent(approval.body.id)}/decision`, {
      decision: 'approved',
      notes: 'Approved during Wednesday, August 26, 2026 storage destroy lifecycle validation.',
    }, auth.cookie);
    expect(decision.status).toBe(200);

    const lowerAgain = await request('PUT', '/api/governance/role', { role: 'operator' }, auth.cookie);
    expect(lowerAgain.status).toBe(200);

    const destroyed = await request('POST', '/api/storage/OpaqueRef%3Asr2/destroy', {
      approvalId: approval.body.id,
    }, auth.cookie);
    expect(destroyed.status).toBe(200);
    expect(destroyed.body.success).toBe(true);
  });
});
