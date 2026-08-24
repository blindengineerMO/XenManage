const { buildResilienceOverview } = require('../../../server/services/resilience');

describe('buildResilienceOverview', () => {
  it('derives protection, host, and recovery summaries from Xen records', () => {
    const payload = buildResilienceOverview({
      pools: [
        { ref: 'OpaqueRef:pool1', name_label: 'Production Pool', uuid: 'pool-uuid-1' },
      ],
      hosts: [
        {
          ref: 'OpaqueRef:host1',
          name_label: 'alpha-xen',
          address: '10.0.0.11',
          uuid: 'host-uuid-1',
          enabled: true,
          resident_VMs: ['OpaqueRef:vm1'],
          other_config: {},
        },
        {
          ref: 'OpaqueRef:host2',
          name_label: 'beta-xen',
          address: '10.0.0.12',
          uuid: 'host-uuid-2',
          enabled: false,
          resident_VMs: [],
          other_config: { maintenance_window: 'Sun 02:00' },
        },
      ],
      vms: [
        {
          ref: 'OpaqueRef:vm1',
          name_label: 'billing-api-01',
          power_state: 'Running',
          uuid: 'vm-uuid-1',
          tags: ['prod'],
          is_a_template: false,
        },
        {
          ref: 'OpaqueRef:vm2',
          name_label: 'analytics-web-01',
          power_state: 'Halted',
          uuid: 'vm-uuid-2',
          tags: ['staging'],
          is_a_template: false,
        },
      ],
      tasks: [
        {
          ref: 'OpaqueRef:task1',
          name_label: 'Backup verify billing-api-01',
          name_description: 'Validating the latest restore point',
          status: 'success',
          created: '2026-08-19T10:00:00.000Z',
          finished: '2026-08-19T10:15:00.000Z',
          resident_on: 'OpaqueRef:host1',
        },
        {
          ref: 'OpaqueRef:task2',
          name_label: 'Recovery drill Production Pool',
          name_description: 'Pool evacuation rehearsal',
          status: 'pending',
          created: '2026-08-19T11:00:00.000Z',
          finished: '',
          resident_on: 'OpaqueRef:host1',
        },
      ],
      messages: [
        {
          ref: 'OpaqueRef:msg1',
          name: 'Replication lag warning',
          body: 'billing-api-01 missed its last protection target.',
          cls: 'VM',
          timestamp: '2026-08-19T11:30:00.000Z',
          obj_uuid: 'vm-uuid-1',
        },
      ],
      runbooks: [
        {
          poolRef: 'OpaqueRef:pool1',
          recoveryTier: 'tier-1',
          haPolicy: 'auto-failover',
          restartPriority: 'high',
          backupWindowHours: 12,
          rpoMinutes: 30,
          rtoMinutes: 90,
          restorePointStatus: 'review',
          owner: 'Platform Ops',
          standbyHostRef: 'OpaqueRef:host2',
          failoverNetworkRef: 'OpaqueRef:net1',
          lastVerifiedAt: '2026-08-20T18:30:00.000Z',
          runbookSteps: ['Confirm backup chain', 'Run restore verification'],
          notes: 'Primary production recovery workflow.',
          updatedAt: '2026-08-20T18:30:00.000Z',
        },
      ],
      drills: [
        {
          id: 'drill-1',
          poolRef: 'OpaqueRef:pool1',
          drillType: 'restore',
          status: 'warning',
          scope: 'Billing restore test',
          executedAt: '2026-08-20T09:15:00.000Z',
          durationMinutes: 48,
          summary: 'Recovery worked but boot ordering needs refinement.',
          findings: 'Dependency ordering added delay.',
          nextStep: 'Update runbook order.',
          operator: 'root',
          createdAt: '2026-08-20T09:20:00.000Z',
        },
      ],
    });

    expect(payload.summary.protectedVmCount).toBe(1);
    expect(payload.summary.maintenanceHostCount).toBe(1);
    expect(payload.summary.runbookCoverageCount).toBe(1);
    expect(payload.recoveryPlans[0].status).toBe('warning');
    expect(payload.recoveryPlans[0].hasRunbook).toBe(true);
    expect(payload.recoveryPlans[0].lastDrillStatus).toBe('warning');
    expect(payload.protectionPolicies.find((policy) => policy.name_label === 'billing-api-01').status).toBe('critical');
    expect(payload.protectionPolicies.find((policy) => policy.name_label === 'billing-api-01').restorePointStatus).toBe('stale');
    expect(payload.hostPlans.find((host) => host.name_label === 'beta-xen').status).toBe('disabled');
    expect(payload.recentEvents.some((event) => event.type === 'drill')).toBe(true);
  });
});
