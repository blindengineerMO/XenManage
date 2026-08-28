const {
  buildStorageSelectionProfile,
  buildBulkStorageForgetMessage,
  buildBulkStorageDestroyMessage,
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
});
