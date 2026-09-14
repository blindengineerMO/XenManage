jest.mock('../../../../server/services/metrics-history', () => ({
  listCapacityBaseline: jest.fn(() => ({
    hosts: [
      {
        entityRef: 'OpaqueRef:host2',
        memory_total_bytes: 137438953472,
        memory_free_bytes: 68719476736,
        cpu_usage_percent: 20,
        network_rx_kib_per_s: 100,
        network_tx_kib_per_s: 100,
      },
      {
        entityRef: 'OpaqueRef:host4',
        memory_total_bytes: 68719476736,
        memory_free_bytes: 1073741824,
        cpu_usage_percent: 90,
        network_rx_kib_per_s: 500,
        network_tx_kib_per_s: 500,
      },
    ],
  })),
}));

const placementEngine = require('../../../../server/services/placement-engine');

function buildFakeXenApi() {
  return {
    getVMCompatibility: jest.fn(async (ref) => ({
      ref,
      hosts: [
        {
          ref: 'OpaqueRef:host1', name_label: 'host1', enabled: true, maintenance_mode: false,
          currentResident: true, compatible: true, readiness: 'compatible',
        },
        {
          ref: 'OpaqueRef:host2', name_label: 'host2', enabled: true, maintenance_mode: false,
          currentResident: false, compatible: true, readiness: 'compatible',
        },
        {
          ref: 'OpaqueRef:host3', name_label: 'host3', enabled: false, maintenance_mode: true,
          currentResident: false, compatible: false, readiness: 'maintenance',
        },
        {
          ref: 'OpaqueRef:host4', name_label: 'host4', enabled: true, maintenance_mode: false,
          currentResident: false, compatible: true, readiness: 'compatible',
        },
      ],
    })),
    getRecord: jest.fn(async (className) => {
      if (className === 'VM') {
        return { memory_dynamic_max: '4294967296', memory_static_max: '4294967296' };
      }
      return {};
    }),
    getVBDs: jest.fn(async () => ({
      records: {
        'OpaqueRef:vbd1': { VM: 'OpaqueRef:vm1', VDI: 'OpaqueRef:vdi1', type: 'Disk' },
      },
    })),
    getClassRecords: jest.fn(async (className) => {
      if (className === 'VDI') {
        return { records: { 'OpaqueRef:vdi1': { ref: 'OpaqueRef:vdi1', SR: 'OpaqueRef:sr1' } } };
      }
      return { records: {} };
    }),
    getPBDs: jest.fn(async () => ({
      records: {
        'OpaqueRef:pbd-h2-sr1': { host: 'OpaqueRef:host2', SR: 'OpaqueRef:sr1', currently_attached: true },
      },
    })),
    getSRs: jest.fn(async () => ({
      records: { 'OpaqueRef:sr1': { shared: false } },
    })),
  };
}

describe('placement-engine', () => {
  it('excludes the current-resident host and maintenance hosts, and ranks eligible hosts by score', async () => {
    const xenApi = buildFakeXenApi();
    const report = await placementEngine.getRecommendations(xenApi, 'OpaqueRef:vm1', { targetKey: 'test-target' });

    const hostRefs = report.recommendations.map((entry) => entry.hostRef);
    expect(hostRefs).not.toContain('OpaqueRef:host1');
    expect(hostRefs).not.toContain('OpaqueRef:host3');
    expect(hostRefs).toEqual(expect.arrayContaining(['OpaqueRef:host2', 'OpaqueRef:host4']));

    const host2 = report.recommendations.find((entry) => entry.hostRef === 'OpaqueRef:host2');
    const host4 = report.recommendations.find((entry) => entry.hostRef === 'OpaqueRef:host4');
    expect(host2.eligible).toBe(true);
    expect(host4.eligible).toBe(false);
    expect(host2.score).toBeGreaterThan(host4.score);
    expect(report.recommendations[0].hostRef).toBe('OpaqueRef:host2');

    const storageFactor = host2.factors.find((entry) => entry.key === 'storage');
    expect(storageFactor.score).toBe(100);
  });

  it('marks storage locality reduced when the VM has no attachment to the candidate host', async () => {
    const xenApi = buildFakeXenApi();
    xenApi.getPBDs = jest.fn(async () => ({ records: {} }));
    const report = await placementEngine.getRecommendations(xenApi, 'OpaqueRef:vm1', { targetKey: 'test-target' });
    const host2 = report.recommendations.find((entry) => entry.hostRef === 'OpaqueRef:host2');
    const storageFactor = host2.factors.find((entry) => entry.key === 'storage');
    expect(storageFactor.score).toBeLessThan(100);
  });
});
