const {
  buildStorageSelectionProfile,
  buildBulkStorageForgetMessage,
  buildBulkStorageDestroyMessage,
  buildStorageAttachmentRows,
  formatVbdAttachmentSummary,
  buildSrPathHealthRows,
  buildSrPathHealthSummary,
} = require('../../../../client/assets/js/core/storage-view-models');

describe('storage-view-models selection helpers', () => {
  beforeAll(() => {
    global.formatBytes = (value) => `${Math.round(Number(value || 0))}B`;
  });

  afterAll(() => {
    delete global.formatBytes;
  });

  it('categorizes selected repositories by destroy readiness', () => {
    const profile = buildStorageSelectionProfile([
      {
        ref: 'OpaqueRef:sr1',
        name_label: 'Primary SR',
        physical_size: 300,
        virtual_allocation: 200,
        VDIs: ['OpaqueRef:vdi1'],
      },
      {
        ref: 'OpaqueRef:sr2',
        name_label: 'Archive SR',
        physical_size: 200,
        virtual_allocation: 0,
        VDIs: [],
      },
      {
        ref: 'OpaqueRef:sr3',
        name_label: 'Pending Inventory SR',
        physical_size: 100,
        virtual_allocation: 25,
      },
    ], ['OpaqueRef:sr1', 'OpaqueRef:sr2', 'OpaqueRef:sr3']);

    expect(profile.rows).toHaveLength(3);
    expect(profile.forgetReady.map((sr) => sr.ref)).toEqual(['OpaqueRef:sr1', 'OpaqueRef:sr2', 'OpaqueRef:sr3']);
    expect(profile.destroyReady.map((sr) => sr.ref)).toEqual(['OpaqueRef:sr2']);
    expect(profile.destroyBlocked.map((sr) => sr.ref)).toEqual(['OpaqueRef:sr1']);
    expect(profile.destroyUnknown.map((sr) => sr.ref)).toEqual(['OpaqueRef:sr3']);
    expect(profile.summary).toBe('225B allocated of 600B across 3 repositories · 1 destroy-ready · 1 non-empty · 1 pending disk inventory');
  });

  it('builds singular and plural storage batch completion messages', () => {
    expect(buildBulkStorageForgetMessage([
      { ref: 'OpaqueRef:sr1', name_label: 'Primary SR' },
    ])).toBe('Primary SR was forgotten and removed from the current storage inventory view.');

    expect(buildBulkStorageDestroyMessage([
      { ref: 'OpaqueRef:sr2', name_label: 'Archive SR' },
      { ref: 'OpaqueRef:sr3', name_label: 'Scratch SR' },
    ])).toBe('2 selected storage repositories were destroyed and removed from the current storage inventory view.');
  });

  it('formats a VBD attachment summary from live device/mode/bootable/plug-state fields', () => {
    expect(formatVbdAttachmentSummary(null)).toBe('');
    expect(formatVbdAttachmentSummary({
      device: 'xvda', mode: 'RW', bootable: true, currently_attached: true, type: 'Disk',
    })).toBe('xvda · RW · boot disk · plugged in');
    expect(formatVbdAttachmentSummary({
      userdevice: '1', mode: 'RO', bootable: false, currently_attached: false, type: 'CD',
    })).toBe('1 · RO · CD · unplugged');
  });

  it('builds attachment rows from real VBD records instead of inferred ref-list matching', () => {
    const vdis = [{ ref: 'OpaqueRef:vdi1', uuid: 'vdi-uuid-1', name_label: 'Disk 1', virtual_size: 1024, type: 'user', VBDs: ['OpaqueRef:vbd1'] }];
    const relatedVMs = [{ ref: 'OpaqueRef:vm1', uuid: 'vm-uuid-1', name_label: 'Web01', power_state: 'Running', resident_on: 'OpaqueRef:host1' }];
    const relatedHosts = [{ ref: 'OpaqueRef:host1', uuid: 'host-uuid-1', name_label: 'xen01', address: '10.0.0.1' }];
    const relatedVbds = [{
      ref: 'OpaqueRef:vbd1', uuid: 'vbd-uuid-1', VM: 'OpaqueRef:vm1', VDI: 'OpaqueRef:vdi1',
      device: 'xvda', mode: 'RW', bootable: true, currently_attached: true, type: 'Disk',
    }];

    const rows = buildStorageAttachmentRows(vdis, relatedVMs, relatedHosts, relatedVbds);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      vbdRef: 'OpaqueRef:vbd1',
      vbdUuid: 'vbd-uuid-1',
      vmRef: 'OpaqueRef:vm1',
      vmName: 'Web01',
      hostRef: 'OpaqueRef:host1',
      hostName: 'xen01',
      status: 'Running',
    });
    expect(rows[0].detail).toBe('1024B · Running · xvda · RW · boot disk · plugged in');
  });

  it('flags a VDI with no VBD attachment record instead of guessing a VM match', () => {
    const vdis = [{ ref: 'OpaqueRef:vdi2', uuid: 'vdi-uuid-2', name_label: 'Disk 2', virtual_size: 512, type: 'user', VBDs: [] }];

    const rows = buildStorageAttachmentRows(vdis, [], [], []);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      vmName: 'No mapped workload',
      hostName: 'Unplaced / not discovered',
      status: 'warning',
    });
    expect(rows[0].detail).toContain('no VBD attachment record');
  });

  it('marks an attached VBD whose VM record has not loaded yet as an undiscovered workload', () => {
    const vdis = [{ ref: 'OpaqueRef:vdi3', uuid: 'vdi-uuid-3', name_label: 'Disk 3', virtual_size: 2048, VBDs: ['OpaqueRef:vbd3'] }];
    const relatedVbds = [{ ref: 'OpaqueRef:vbd3', uuid: 'vbd-uuid-3', VM: 'OpaqueRef:vm-missing', VDI: 'OpaqueRef:vdi3', currently_attached: false }];

    const rows = buildStorageAttachmentRows(vdis, [], [], relatedVbds);
    expect(rows).toHaveLength(1);
    expect(rows[0].vmName).toBe('Workload not discovered');
    expect(rows[0].status).toBe('notice');
  });

  it('builds per-host path health rows from real PBD records instead of a bare attachment-path count', () => {
    const selectedSR = { ref: 'OpaqueRef:sr1', PBDs: ['OpaqueRef:pbd1', 'OpaqueRef:pbd2'] };
    const relatedHosts = [
      { ref: 'OpaqueRef:host1', name_label: 'xen01' },
      { ref: 'OpaqueRef:host2', name_label: 'xen02' },
    ];
    const relatedPbds = [
      { ref: 'OpaqueRef:pbd1', uuid: 'pbd-uuid-1', host: 'OpaqueRef:host1', SR: 'OpaqueRef:sr1', currently_attached: true },
      { ref: 'OpaqueRef:pbd2', uuid: 'pbd-uuid-2', host: 'OpaqueRef:host2', SR: 'OpaqueRef:sr1', currently_attached: false },
    ];

    const rows = buildSrPathHealthRows(selectedSR, relatedHosts, relatedPbds);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ hostName: 'xen01', currentlyAttached: true });
    expect(rows[1]).toMatchObject({ hostName: 'xen02', currentlyAttached: false });

    expect(buildSrPathHealthSummary(selectedSR, rows)).toBe('1 of 2 attachment paths are degraded (unplugged on xen02).');
    expect(buildSrPathHealthSummary(selectedSR, [])).toBe('No attachment path telemetry was discovered for this repository.');
    expect(buildSrPathHealthRows(null, relatedHosts, relatedPbds)).toEqual([]);
  });

  it('reports every path healthy when no PBD is unplugged', () => {
    const selectedSR = { ref: 'OpaqueRef:sr2', PBDs: ['OpaqueRef:pbd3'] };
    const relatedHosts = [{ ref: 'OpaqueRef:host3', name_label: 'xen03' }];
    const relatedPbds = [
      { ref: 'OpaqueRef:pbd3', uuid: 'pbd-uuid-3', host: 'OpaqueRef:host3', SR: 'OpaqueRef:sr2', currently_attached: true },
    ];

    const rows = buildSrPathHealthRows(selectedSR, relatedHosts, relatedPbds);
    expect(buildSrPathHealthSummary(selectedSR, rows)).toBe('1 of 1 attachment path is healthy.');
  });
});
