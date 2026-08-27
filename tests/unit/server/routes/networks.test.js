const http = require('http');
const path = require('path');
const fs = require('fs');

const TEST_DB = path.join(__dirname, '..', '..', '..', 'data', 'networks-routes.db');

process.env.DB_PATH = TEST_DB;

const mockState = {
  networks: [],
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

  actual.XenAPI.prototype.getNetworks = jest.fn(async function () {
    return {
      refs: mockState.networks.map((network) => network.ref),
      records: Object.fromEntries(mockState.networks.map((network) => [network.ref, { ...network }])),
    };
  });

  actual.XenAPI.prototype.getRecord = jest.fn(async function (_className, ref) {
    const network = mockState.networks.find((entry) => entry.ref === ref);
    return network ? { ...network } : { name_label: 'fallback-network', bridge: 'xenbr-fallback', managed: true };
  });

  actual.XenAPI.prototype.createNetwork = jest.fn(async function (payload) {
    const record = {
      ref: 'OpaqueRef:net3',
      name_label: payload.nameLabel,
      name_description: payload.nameDescription || '',
      bridge: payload.bridge,
      MTU: Number(payload.mtu || 1500),
      managed: true,
      uuid: 'net-uuid-3',
      VIFs: [],
      PIFs: [],
      tags: payload.tags || [],
      other_config: { ...(payload.otherConfig || {}) },
      default_locking_mode: 'unlocked',
      purpose: [],
    };

    mockState.networks.push(record);
    return { ...record };
  });

  actual.XenAPI.prototype.createVlan = jest.fn(async function (payload) {
    const network = mockState.networks.find((entry) => entry.ref === payload.networkRef);
    if (!network) {
      throw new Error('NETWORK_NOT_FOUND');
    }

    network.other_config = {
      ...(network.other_config || {}),
      vlan: String(payload.tag),
    };

    return {
      ref: 'OpaqueRef:vlan1',
      uuid: 'vlan-uuid-1',
      tagged_PIF: payload.pifRef,
      untagged_PIF: 'OpaqueRef:pif9',
      tag: Number(payload.tag || 0),
      networkRef: payload.networkRef,
      taggedPifRef: payload.pifRef,
      network: { ...network },
    };
  });

  actual.XenAPI.prototype.createBond = jest.fn(async function (payload) {
    const network = mockState.networks.find((entry) => entry.ref === payload.networkRef);
    if (!network) {
      throw new Error('NETWORK_NOT_FOUND');
    }

    const members = Array.isArray(payload.pifRefs) ? [...payload.pifRefs] : [];
    network.PIFs = Array.from(new Set([...(network.PIFs || []), ...members]));
    network.other_config = {
      ...(network.other_config || {}),
      bond_mode: payload.mode || 'balance-slb',
    };

    return {
      ref: 'OpaqueRef:bond1',
      uuid: 'bond-uuid-1',
      master: members[0] || '',
      slaves: members,
      primary_slave: members[0] || '',
      links_up: members.length,
      mode: payload.mode || 'balance-slb',
      other_config: {},
      properties: {},
      networkRef: payload.networkRef,
      memberPifRefs: members,
      network: { ...network },
    };
  });

  actual.XenAPI.prototype.updateNetworkConfig = jest.fn(async function (ref, payload) {
    const network = mockState.networks.find((entry) => entry.ref === ref);
    if (!network) {
      throw new Error('NETWORK_NOT_FOUND');
    }

    network.name_label = payload.nameLabel;
    network.name_description = payload.nameDescription || '';
    network.MTU = Number(payload.mtu || 1500);
    network.default_locking_mode = payload.defaultLockingMode || 'unlocked';
    network.purpose = payload.purpose || [];
    network.tags = payload.tags || [];
    network.other_config = { ...(payload.otherConfig || {}) };
    return { ...network };
  });

  actual.XenAPI.prototype.destroyNetwork = jest.fn(async function (ref) {
    const index = mockState.networks.findIndex((entry) => entry.ref === ref);
    if (index === -1) {
      throw new Error('NETWORK_NOT_FOUND');
    }

    mockState.networks.splice(index, 1);
    return { success: true, ref };
  });

  actual.XenAPI.prototype.rpc = jest.fn(async function () {
    return {};
  });

  return actual;
});

const app = require('../../../../server/index');

describe('Network Routes', () => {
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
    mockState.networks = [
      {
        ref: 'OpaqueRef:net1',
        name_label: 'VM Network',
        name_description: 'Primary workload network.',
        bridge: 'xenbr0',
        MTU: 1500,
        managed: true,
        uuid: 'net-uuid-1',
        VIFs: ['OpaqueRef:vif1'],
        PIFs: ['OpaqueRef:pif1'],
        tags: ['prod'],
        other_config: { vlan: '120' },
        default_locking_mode: 'unlocked',
        purpose: [],
      },
      {
        ref: 'OpaqueRef:net2',
        name_label: 'Backup Network',
        name_description: 'Backup-only traffic.',
        bridge: 'xenbr1',
        MTU: 9000,
        managed: true,
        uuid: 'net-uuid-2',
        VIFs: [],
        PIFs: [],
        tags: ['backup'],
        other_config: { vlan: '220' },
        default_locking_mode: 'unlocked',
        purpose: [],
      },
    ];
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
    return request('POST', '/api/auth/xen-login', {
      host: '192.168.1.100',
      username: 'root',
      password: 'pass',
    });
  }

  it('lists networks and reads a network record', async () => {
    const auth = await login();

    const list = await request('GET', '/api/networks', null, auth.cookie);
    expect(list.status).toBe(200);
    expect(list.body.total).toBe(2);
    expect(list.body.data[0]).toEqual(expect.objectContaining({
      ref: 'OpaqueRef:net1',
      name_label: 'VM Network',
    }));

    const record = await request('GET', '/api/networks/OpaqueRef%3Anet1', null, auth.cookie);
    expect(record.status).toBe(200);
    expect(record.body).toEqual(expect.objectContaining({
      ref: 'OpaqueRef:net1',
      bridge: 'xenbr0',
      MTU: 1500,
    }));
  });

  it('creates a managed network through the dedicated endpoint', async () => {
    const auth = await login();

    const created = await request('POST', '/api/networks', {
      nameLabel: 'Replication Transit',
      nameDescription: 'Dedicated replication bridge for backup copy traffic.',
      mtu: 1600,
      bridge: 'xenbr10',
      tags: ['replication', 'backup'],
      otherConfig: {
        vlan: '330',
        domain: 'replication',
      },
    }, auth.cookie);

    expect(created.status).toBe(201);
    expect(created.body).toEqual(expect.objectContaining({
      ref: 'OpaqueRef:net3',
      name_label: 'Replication Transit',
      name_description: 'Dedicated replication bridge for backup copy traffic.',
      bridge: 'xenbr10',
      MTU: 1600,
      tags: ['replication', 'backup'],
      other_config: expect.objectContaining({
        vlan: '330',
        domain: 'replication',
      }),
    }));

    const list = await request('GET', '/api/networks', null, auth.cookie);
    expect(list.status).toBe(200);
    expect(list.body.total).toBe(3);
  });

  it('updates network metadata through the dedicated config endpoint', async () => {
    const auth = await login();

    const updated = await request('PUT', '/api/networks/OpaqueRef%3Anet1/config', {
      nameLabel: 'Production VM Network',
      nameDescription: 'Updated east-west traffic segment.',
      mtu: 1600,
      defaultLockingMode: 'disabled',
      purpose: ['nbd'],
      tags: ['prod', 'east-west'],
      otherConfig: {
        vlan: '130',
        owner: 'platform-ops',
      },
    }, auth.cookie);

    expect(updated.status).toBe(200);
    expect(updated.body).toEqual(expect.objectContaining({
      ref: 'OpaqueRef:net1',
      name_label: 'Production VM Network',
      name_description: 'Updated east-west traffic segment.',
      MTU: 1600,
      default_locking_mode: 'disabled',
      purpose: ['nbd'],
      tags: ['prod', 'east-west'],
      other_config: expect.objectContaining({
        vlan: '130',
        owner: 'platform-ops',
      }),
    }));
  });

  it('creates a vlan mapping through the dedicated endpoint', async () => {
    const auth = await login();

    const created = await request('POST', '/api/networks/vlans', {
      networkRef: 'OpaqueRef:net2',
      pifRef: 'OpaqueRef:pif2',
      tag: 330,
    }, auth.cookie);

    expect(created.status).toBe(201);
    expect(created.body).toEqual(expect.objectContaining({
      ref: 'OpaqueRef:vlan1',
      tag: 330,
      tagged_PIF: 'OpaqueRef:pif2',
      networkRef: 'OpaqueRef:net2',
      network: expect.objectContaining({
        ref: 'OpaqueRef:net2',
        other_config: expect.objectContaining({
          vlan: '330',
        }),
      }),
    }));
  });

  it('creates a bond mapping through the dedicated endpoint', async () => {
    const auth = await login();

    const created = await request('POST', '/api/networks/bonds', {
      networkRef: 'OpaqueRef:net2',
      pifRefs: ['OpaqueRef:pif2', 'OpaqueRef:pif4'],
      mode: 'lacp',
    }, auth.cookie);

    expect(created.status).toBe(201);
    expect(created.body).toEqual(expect.objectContaining({
      ref: 'OpaqueRef:bond1',
      mode: 'lacp',
      memberPifRefs: ['OpaqueRef:pif2', 'OpaqueRef:pif4'],
      networkRef: 'OpaqueRef:net2',
      network: expect.objectContaining({
        ref: 'OpaqueRef:net2',
        other_config: expect.objectContaining({
          bond_mode: 'lacp',
        }),
      }),
    }));
  });

  it('blocks destroying attached networks before the XenAPI call is attempted', async () => {
    const auth = await login();

    const blocked = await request('POST', '/api/networks/OpaqueRef%3Anet1/destroy', {}, auth.cookie);
    expect(blocked.status).toBe(409);
    expect(blocked.body.error).toBe('NETWORK_DESTROY_REQUIRES_DETACHED_ATTACHMENTS');
  });

  it('requires approved destructive tokens before operators destroy detached networks', async () => {
    const auth = await login();

    const lower = await request('PUT', '/api/governance/role', { role: 'operator' }, auth.cookie);
    expect(lower.status).toBe(200);

    const blocked = await request('POST', '/api/networks/OpaqueRef%3Anet2/destroy', {}, auth.cookie);
    expect(blocked.status).toBe(403);
    expect(blocked.body.error).toBe('APPROVAL_REQUIRED');

    const approval = await request('POST', '/api/governance/approvals', {
      actionKey: 'network_destroy',
      entityType: 'network',
      entityRef: 'OpaqueRef:net2',
      entityName: 'Backup Network',
      justification: 'Destroy a detached network during Wednesday, August 26, 2026 approval validation.',
      route: '/networking',
    }, auth.cookie);
    expect(approval.status).toBe(201);

    const elevate = await request('PUT', '/api/governance/role', { role: 'admin' }, auth.cookie);
    expect(elevate.status).toBe(200);

    const decision = await request('POST', `/api/governance/approvals/${encodeURIComponent(approval.body.id)}/decision`, {
      decision: 'approved',
      notes: 'Approved during Wednesday, August 26, 2026 network destroy lifecycle validation.',
    }, auth.cookie);
    expect(decision.status).toBe(200);

    const lowerAgain = await request('PUT', '/api/governance/role', { role: 'operator' }, auth.cookie);
    expect(lowerAgain.status).toBe(200);

    const destroyed = await request('POST', '/api/networks/OpaqueRef%3Anet2/destroy', {
      approvalId: approval.body.id,
    }, auth.cookie);
    expect(destroyed.status).toBe(200);
    expect(destroyed.body.success).toBe(true);
  });
});
