const {
  buildNetworkSelectionProfile,
  buildSelectedNetworkDestroyBlockedReason,
  buildBulkNetworkDestroyMessage,
} = require('../../../../client/assets/js/core/networking-view-models');

describe('networking-view-models', () => {
  it('marks detached selected networks as destroy-ready and attached networks as blocked', () => {
    const profile = buildNetworkSelectionProfile([
      {
        ref: 'OpaqueRef:net1',
        name_label: 'VM Network',
        PIFs: ['OpaqueRef:pif1'],
        VIFs: ['OpaqueRef:vif1'],
      },
      {
        ref: 'OpaqueRef:net2',
        name_label: 'Archive Transit',
        PIFs: [],
        VIFs: [],
      },
      {
        ref: 'OpaqueRef:net3',
        name_label: 'Replication Transit',
        PIFs: [],
        VIFs: [],
      },
    ], ['OpaqueRef:net1', 'OpaqueRef:net2', 'OpaqueRef:net3']);

    expect(profile.rows).toHaveLength(3);
    expect(profile.destroyReady.map((network) => network.ref)).toEqual(['OpaqueRef:net2', 'OpaqueRef:net3']);
    expect(profile.blocked.map((network) => network.ref)).toEqual(['OpaqueRef:net1']);
    expect(profile.summary).toBe('2 destroy-ready · 1 still attached and blocked');
  });

  it('explains why a selected network cannot be destroyed while attachments remain', () => {
    expect(buildSelectedNetworkDestroyBlockedReason({
      ref: 'OpaqueRef:net1',
      PIFs: ['OpaqueRef:pif1', 'OpaqueRef:pif2'],
      VIFs: ['OpaqueRef:vif1'],
    })).toBe('Destroy requires a detached managed network. 2 host uplinks and 1 workload interface still map to this network.');

    expect(buildSelectedNetworkDestroyBlockedReason({
      ref: 'OpaqueRef:net2',
      PIFs: [],
      VIFs: [],
    })).toBe('');
  });

  it('builds singular and plural batch destroy completion messages', () => {
    expect(buildBulkNetworkDestroyMessage([
      { ref: 'OpaqueRef:net1', name_label: 'Archive Transit' },
    ])).toBe('Archive Transit was destroyed and removed from the current network inventory view.');

    expect(buildBulkNetworkDestroyMessage([
      { ref: 'OpaqueRef:net1', name_label: 'Archive Transit' },
      { ref: 'OpaqueRef:net2', name_label: 'Replication Transit' },
    ])).toBe('2 selected networks were destroyed and removed from the current network inventory view.');
  });
});
