const {
  filterSelectedLifecycleRows,
  buildLifecycleSelectionProfile,
  resolveLifecycleSelectionMaintenanceState,
} = require('../../../../client/assets/js/core/lifecycle-view-models');

describe('lifecycle-view-models selection helpers', () => {
  it('filters selected lifecycle rows by host ref', () => {
    const rows = filterSelectedLifecycleRows([
      { ref: 'OpaqueRef:host1', name_label: 'alpha-xen' },
      { ref: 'OpaqueRef:host2', name_label: 'beta-xen' },
    ], ['OpaqueRef:host2']);

    expect(rows).toHaveLength(1);
    expect(rows[0].ref).toBe('OpaqueRef:host2');
  });

  it('builds a mixed lifecycle selection profile for planned and maintenance hosts', () => {
    const profile = buildLifecycleSelectionProfile([
      {
        ref: 'OpaqueRef:host1',
        lifecyclePlan: { targetStage: 'maintenance' },
        maintenance_mode: false,
        other_config: { maintenance_mode: 'false' },
      },
      {
        ref: 'OpaqueRef:host2',
        lifecyclePlan: { targetStage: 'remediate' },
        maintenance_mode: true,
        other_config: { maintenance_mode: 'true' },
      },
      {
        ref: 'OpaqueRef:host3',
        lifecyclePlan: null,
        maintenance_mode: false,
        other_config: {},
      },
    ], ['OpaqueRef:host1', 'OpaqueRef:host2', 'OpaqueRef:host3']);

    expect(profile.rows).toHaveLength(3);
    expect(profile.plannedRows.map((row) => row.ref)).toEqual(['OpaqueRef:host1', 'OpaqueRef:host2']);
    expect(profile.maintenanceReadyRows.map((row) => row.ref)).toEqual(['OpaqueRef:host1']);
    expect(profile.maintenanceActiveRows.map((row) => row.ref)).toEqual(['OpaqueRef:host2']);
    expect(profile.summary).toBe('2 saved plans · 1 ready for maintenance · 1 already in maintenance');
  });

  it('detects maintenance state from either the boolean flag or other_config', () => {
    expect(resolveLifecycleSelectionMaintenanceState({ maintenance_mode: true, other_config: {} })).toBe(true);
    expect(resolveLifecycleSelectionMaintenanceState({ maintenance_mode: false, other_config: { maintenance_mode: 'true' } })).toBe(true);
    expect(resolveLifecycleSelectionMaintenanceState({ maintenance_mode: false, other_config: { maintenance_mode: 'false' } })).toBe(false);
  });
});
