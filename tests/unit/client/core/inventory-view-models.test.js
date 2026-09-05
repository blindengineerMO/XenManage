const {
  formatConnectionHealthSummary,
  buildManagedTargetsByConnectionId,
  formatManagedTargetStatus,
} = require('../../../../client/assets/js/core/inventory-view-models');

describe('inventory-view-models', () => {
  it('summarizes a connection health rollup as pool/host/VM counts plus alert count', () => {
    expect(formatConnectionHealthSummary(null)).toBe('');
    expect(formatConnectionHealthSummary({
      poolCount: 1,
      hostCount: 3,
      vmCount: 12,
      vmStates: { running: 8 },
      alertCount: 0,
    })).toBe('1 pool · 3 hosts · 12 VMs (8 running)');

    expect(formatConnectionHealthSummary({
      poolCount: 2,
      hostCount: 1,
      vmCount: 1,
      vmStates: { running: 1 },
      alertCount: 4,
    })).toBe('2 pools · 1 host · 1 VM (1 running) · 4 alerts');
  });

  it('indexes managed targets by their linked connection id', () => {
    expect(buildManagedTargetsByConnectionId(null)).toEqual({});
    expect(buildManagedTargetsByConnectionId([
      { connectionId: 3, state: 'Healthy' },
      { connectionId: 7, state: 'Offline' },
      { connectionId: 0, state: 'Healthy' },
    ])).toEqual({
      3: { connectionId: 3, state: 'Healthy' },
      7: { connectionId: 7, state: 'Offline' },
    });
  });

  it('formats a managed target background-poller status for saved-but-not-connected targets', () => {
    expect(formatManagedTargetStatus(null)).toBe('');
    expect(formatManagedTargetStatus({ state: 'Healthy' })).toBe('Managed target online');
    expect(formatManagedTargetStatus({ state: 'Offline' })).toBe('Managed target Offline');
    expect(formatManagedTargetStatus({ state: 'Authentication Failed', lastError: 'SESSION_INVALID' }))
      .toBe('Managed target Authentication Failed: SESSION_INVALID');
  });
});
