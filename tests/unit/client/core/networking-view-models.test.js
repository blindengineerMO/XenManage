const {
  buildNetworkSelectionProfile,
  buildSelectedNetworkDestroyBlockedReason,
  buildBulkNetworkDestroyMessage,
  formatPifIpSummary,
  formatPifLinkSummary,
  buildSelectedNetworkHostUplinks,
  resolveFocusedNetworkTarget,
} = require('../../../../client/assets/js/core/networking-view-models');

function normalizeFocusValue(value) {
  return String(value || '').trim().toLowerCase();
}

function recordMatchesRouteFocus(record, focus, fields = [], extraValues = []) {
  if (!record || !focus) return false;
  const values = [...fields.map((field) => record?.[field]), ...extraValues]
    .map(normalizeFocusValue)
    .filter(Boolean);
  if (focus.ref && values.includes(normalizeFocusValue(focus.ref))) return true;
  if (focus.uuid && values.includes(normalizeFocusValue(focus.uuid))) return true;
  if (focus.name && values.includes(normalizeFocusValue(focus.name))) return true;
  return false;
}

describe('networking-view-models', () => {
  beforeAll(() => {
    global.recordMatchesRouteFocus = recordMatchesRouteFocus;
  });

  afterAll(() => {
    delete global.recordMatchesRouteFocus;
  });

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

  it('summarizes a PIF\'s IP configuration by mode', () => {
    expect(formatPifIpSummary({ ip_configuration_mode: 'None' })).toBe('No IP configured');
    expect(formatPifIpSummary({})).toBe('No IP configured');
    expect(formatPifIpSummary({ ip_configuration_mode: 'DHCP', IP: '10.0.0.5' })).toBe('DHCP · 10.0.0.5');
    expect(formatPifIpSummary({ ip_configuration_mode: 'DHCP' })).toBe('DHCP');
    expect(formatPifIpSummary({ ip_configuration_mode: 'Static', IP: '10.0.0.5', netmask: '255.255.255.0' })).toBe('10.0.0.5/255.255.255.0');
    expect(formatPifIpSummary({ ip_configuration_mode: 'Static', IP: '10.0.0.5' })).toBe('10.0.0.5');
  });

  it('surfaces device, MAC, and IP truth for each host uplink from the related PIF records', () => {
    const network = { ref: 'OpaqueRef:net1', PIFs: ['OpaqueRef:pif1'] };
    const relatedHosts = [
      { ref: 'OpaqueRef:host1', uuid: 'host-uuid-1', name_label: 'Host One', enabled: true, PIFs: ['OpaqueRef:pif1'] },
    ];
    const relatedPifs = [
      { ref: 'OpaqueRef:pif1', uuid: 'pif-uuid-1', device: 'eth0', MAC: 'aa:bb:cc:dd:ee:ff', ip_configuration_mode: 'Static', IP: '10.0.0.5', netmask: '255.255.255.0' },
    ];

    const uplinks = buildSelectedNetworkHostUplinks(network, relatedHosts, 'VLAN 10', relatedPifs);

    expect(uplinks).toHaveLength(1);
    expect(uplinks[0]).toMatchObject({
      interfaceUuid: 'pif-uuid-1',
      device: 'eth0',
      mac: 'aa:bb:cc:dd:ee:ff',
      ipSummary: '10.0.0.5/255.255.255.0',
    });
    expect(uplinks[0].detail).toBe('VLAN 10 · device eth0 · aa:bb:cc:dd:ee:ff · 10.0.0.5/255.255.255.0 · Link state unknown · enabled host · host-uuid-1');
  });

  it('falls back to placeholder uplink detail when no matching PIF record is available', () => {
    const network = { ref: 'OpaqueRef:net1', PIFs: ['OpaqueRef:pif1'] };
    const relatedHosts = [
      { ref: 'OpaqueRef:host1', uuid: 'host-uuid-1', name_label: 'Host One', enabled: false, PIFs: ['OpaqueRef:pif1'] },
    ];

    const uplinks = buildSelectedNetworkHostUplinks(network, relatedHosts, '-', []);

    expect(uplinks[0].device).toBe('');
    expect(uplinks[0].mac).toBe('');
    expect(uplinks[0].ipSummary).toBe('No IP configured');
    expect(uplinks[0].detail).toBe('- · device auto · no MAC · No IP configured · Link state unknown · disabled host · host-uuid-1');
  });

  it('resolves a focused PIF by UUID against the related PIF records, not just by ref', () => {
    const networks = [
      { ref: 'OpaqueRef:net1', uuid: 'net-uuid-1', name_label: 'VM Network', PIFs: ['OpaqueRef:pif1'], VIFs: [] },
    ];
    const relatedPifs = [
      { ref: 'OpaqueRef:pif1', uuid: 'pif-uuid-1', network: 'OpaqueRef:net1' },
    ];

    const target = resolveFocusedNetworkTarget(networks, { cls: 'pif', uuid: 'pif-uuid-1' }, relatedPifs, []);

    expect(target.network.ref).toBe('OpaqueRef:net1');
    expect(target.focusedPifRef).toBe('OpaqueRef:pif1');
  });

  it('resolves a focused VIF by UUID against the related VIF records', () => {
    const networks = [
      { ref: 'OpaqueRef:net1', uuid: 'net-uuid-1', name_label: 'VM Network', PIFs: [], VIFs: ['OpaqueRef:vif1'] },
    ];
    const relatedVifs = [
      { ref: 'OpaqueRef:vif1', uuid: 'vif-uuid-1', network: 'OpaqueRef:net1' },
    ];

    const target = resolveFocusedNetworkTarget(networks, { cls: 'vif', uuid: 'vif-uuid-1' }, [], relatedVifs);

    expect(target.network.ref).toBe('OpaqueRef:net1');
    expect(target.focusedVifRef).toBe('OpaqueRef:vif1');
  });

  it('summarizes a PIF\'s live link state from its PIF_metrics fields', () => {
    expect(formatPifLinkSummary({})).toBe('Link state unknown');
    expect(formatPifLinkSummary({ carrier: false })).toBe('Link down');
    expect(formatPifLinkSummary({ carrier: true })).toBe('Link up');
    expect(formatPifLinkSummary({ carrier: true, speed: 10000, duplex: true })).toBe('Link up · 10000Mb/s full-duplex');
    expect(formatPifLinkSummary({ carrier: true, speed: 100, duplex: false })).toBe('Link up · 100Mb/s half-duplex');
  });

  it('surfaces live link state and throughput telemetry on each host uplink row', () => {
    const network = { ref: 'OpaqueRef:net1', PIFs: ['OpaqueRef:pif1'] };
    const relatedHosts = [
      { ref: 'OpaqueRef:host1', uuid: 'host-uuid-1', name_label: 'Host One', enabled: true, PIFs: ['OpaqueRef:pif1'] },
    ];
    const relatedPifs = [
      {
        ref: 'OpaqueRef:pif1', uuid: 'pif-uuid-1', device: 'eth0', MAC: 'aa:bb:cc:dd:ee:ff',
        ip_configuration_mode: 'DHCP', IP: '10.0.0.5',
        carrier: true, speed: 10000, duplex: true, ioReadKbs: 512.5, ioWriteKbs: 128.25,
      },
    ];

    const uplinks = buildSelectedNetworkHostUplinks(network, relatedHosts, '-', relatedPifs);

    expect(uplinks[0].linkSummary).toBe('Link up · 10000Mb/s full-duplex');
    expect(uplinks[0].linkUp).toBe(true);
    expect(uplinks[0].ioReadKbs).toBe(512.5);
    expect(uplinks[0].ioWriteKbs).toBe(128.25);
    expect(uplinks[0].detail).toBe('- · device eth0 · aa:bb:cc:dd:ee:ff · DHCP · 10.0.0.5 · Link up · 10000Mb/s full-duplex · enabled host · host-uuid-1');
  });

  it('annotates a host uplink with bond mode and member count when the PIF is a bond master', () => {
    const network = { ref: 'OpaqueRef:net1', PIFs: ['OpaqueRef:pif1'] };
    const relatedHosts = [
      { ref: 'OpaqueRef:host1', uuid: 'host-uuid-1', name_label: 'Host One', enabled: true, PIFs: ['OpaqueRef:pif1'] },
    ];
    const relatedPifs = [
      { ref: 'OpaqueRef:pif1', uuid: 'pif-uuid-1', device: 'bond0', MAC: 'aa:bb:cc:dd:ee:ff', ip_configuration_mode: 'DHCP', IP: '10.0.0.5' },
    ];
    const relatedBonds = [
      { ref: 'OpaqueRef:bond1', master: 'OpaqueRef:pif1', slaves: ['OpaqueRef:pif2', 'OpaqueRef:pif3'], mode: 'balance-slb' },
    ];

    const uplinks = buildSelectedNetworkHostUplinks(network, relatedHosts, 'VLAN 10', relatedPifs, relatedBonds, []);

    expect(uplinks[0].bondMode).toBe('balance-slb');
    expect(uplinks[0].bondMemberCount).toBe(2);
    expect(uplinks[0].detail).toBe('VLAN 10 · device bond0 · bond balance-slb (2 members) · aa:bb:cc:dd:ee:ff · DHCP · 10.0.0.5 · Link state unknown · enabled host · host-uuid-1');
  });

  it('annotates a host uplink with its VLAN tag when the PIF is a tagged VLAN sub-interface', () => {
    const network = { ref: 'OpaqueRef:net1', PIFs: ['OpaqueRef:pif1'] };
    const relatedHosts = [
      { ref: 'OpaqueRef:host1', uuid: 'host-uuid-1', name_label: 'Host One', enabled: true, PIFs: ['OpaqueRef:pif1'] },
    ];
    const relatedPifs = [
      { ref: 'OpaqueRef:pif1', uuid: 'pif-uuid-1', device: 'eth0.42', MAC: 'aa:bb:cc:dd:ee:ff', ip_configuration_mode: 'None' },
    ];
    const relatedVlans = [
      { ref: 'OpaqueRef:vlan1', tagged_PIF: 'OpaqueRef:pif1', untagged_PIF: 'OpaqueRef:pif4', tag: 42 },
    ];

    const uplinks = buildSelectedNetworkHostUplinks(network, relatedHosts, '-', relatedPifs, [], relatedVlans);

    expect(uplinks[0].vlanTag).toBe(42);
    expect(uplinks[0].detail).toBe('- · device eth0.42 · VLAN 42 · aa:bb:cc:dd:ee:ff · No IP configured · Link state unknown · enabled host · host-uuid-1');
  });

  it('still resolves a focused PIF by ref alone when related PIF records are not loaded', () => {
    const networks = [
      { ref: 'OpaqueRef:net1', uuid: 'net-uuid-1', name_label: 'VM Network', PIFs: ['OpaqueRef:pif1'], VIFs: [] },
    ];

    const target = resolveFocusedNetworkTarget(networks, { cls: 'pif', ref: 'OpaqueRef:pif1' }, [], []);

    expect(target.network.ref).toBe('OpaqueRef:net1');
    expect(target.focusedPifRef).toBe('OpaqueRef:pif1');
  });
});
