const {
  buildTaskLineage,
  formatTaskLineage,
  resolveActivityAuditRecordLocation,
} = require('../../../../client/assets/js/core/activity-view-models');

describe('activity-view-models task lineage helpers', () => {
  const tasks = [
    { ref: 'OpaqueRef:task-1', name_label: 'Live migrate billing-api-01', subtasks: ['OpaqueRef:task-1-sub1'] },
    { ref: 'OpaqueRef:task-1-sub1', name_label: 'Pre-migration compatibility check', subtask_of: 'OpaqueRef:task-1' },
  ];

  it('resolves the parent task name for a subtask', () => {
    const lineage = buildTaskLineage(tasks[1], tasks);
    expect(lineage.parentLabel).toBe('Live migrate billing-api-01');
    expect(lineage.subtaskCount).toBe(0);
  });

  it('counts subtasks for a parent task', () => {
    const lineage = buildTaskLineage(tasks[0], tasks);
    expect(lineage.subtaskCount).toBe(1);
  });

  it('falls back to the raw ref when the parent task is not loaded', () => {
    const orphan = { ref: 'OpaqueRef:task-2', subtask_of: 'OpaqueRef:task-missing' };
    const lineage = buildTaskLineage(orphan, tasks);
    expect(lineage.parentLabel).toBe('OpaqueRef:task-missing');
  });

  it('formats subtask-of and subtask-count messages', () => {
    expect(formatTaskLineage(tasks[1], tasks)).toBe('Subtask of Live migrate billing-api-01');
    expect(formatTaskLineage(tasks[0], tasks)).toBe('1 subtask exists under this task');
  });

  it('returns an empty string when there is no lineage to report', () => {
    expect(formatTaskLineage({ ref: 'OpaqueRef:task-3' }, tasks)).toBe('');
    expect(formatTaskLineage(null, tasks)).toBe('');
  });
});

describe('activity-view-models governance/settings audit follow-through', () => {
  beforeAll(() => {
    global.buildFocusedRoute = (path, focus = {}) => ({ path, query: { focusKind: focus.kind, focusRef: focus.ref } });
  });

  afterAll(() => {
    delete global.buildFocusedRoute;
  });

  it('resolves a follow-through location for governance audit entries', () => {
    expect(resolveActivityAuditRecordLocation({ entityType: 'policy', entityRef: 'policy-1' }).path).toBe('/governance');
    expect(resolveActivityAuditRecordLocation({ entityType: 'session', entityRef: 'session-1' }).path).toBe('/governance');
    expect(resolveActivityAuditRecordLocation({ entityType: 'user', entityRef: '5' }).path).toBe('/governance');
    expect(resolveActivityAuditRecordLocation({ entityType: 'group', entityRef: '2' }).path).toBe('/governance');
  });

  it('resolves a follow-through location for settings-owned audit entries', () => {
    expect(resolveActivityAuditRecordLocation({ entityType: 'credential', entityRef: 'cred-1' }).path).toBe('/settings');
    expect(resolveActivityAuditRecordLocation({ entityType: 'vault', entityRef: 'vault-1' }).path).toBe('/settings');
    expect(resolveActivityAuditRecordLocation({ entityType: 'retention-domain', entityRef: 'rd-1' }).path).toBe('/settings');
    expect(resolveActivityAuditRecordLocation({ entityType: 'settings-section', entityRef: 'logging' }).path).toBe('/settings');
    expect(resolveActivityAuditRecordLocation({ entityType: 'log-export', entityRef: 'export-1' }).path).toBe('/settings');
    expect(resolveActivityAuditRecordLocation({ entityType: 'control-plane-backup', entityRef: 'backup-1' }).path).toBe('/settings');
  });

  it('returns null for an unmapped entity type', () => {
    expect(resolveActivityAuditRecordLocation({ entityType: 'catalog_role', entityRef: 'x' })).toBeNull();
  });

  it('resolves a follow-through location for connection, catalog, and compose audit entries', () => {
    expect(resolveActivityAuditRecordLocation({ entityType: 'connection', entityRef: 'conn-1' }).path).toBe('/pools');
    expect(resolveActivityAuditRecordLocation({ entityType: 'catalog_entry', entityRef: 'entry-1' }).path).toBe('/applications');
    expect(resolveActivityAuditRecordLocation({ entityType: 'catalog_request', entityRef: 'req-1' }).path).toBe('/applications');
    expect(resolveActivityAuditRecordLocation({ entityType: 'compose', entityRef: 'web-tier' }).path).toBe('/vms');
  });

  it('resolves a follow-through location for network subobject audit entries', () => {
    expect(resolveActivityAuditRecordLocation({ entityType: 'vif', entityRef: 'vif-1' }).path).toBe('/networking');
    expect(resolveActivityAuditRecordLocation({ entityType: 'bond', entityRef: 'bond-1' }).path).toBe('/networking');
    expect(resolveActivityAuditRecordLocation({ entityType: 'vlan', entityRef: 'vlan-1' }).path).toBe('/networking');
  });

  it('resolves a follow-through location for alert-policy, host-target, and managed-target audit entries', () => {
    expect(resolveActivityAuditRecordLocation({ entityType: 'alert-policy', entityRef: 'policy-1' }).path).toBe('/alerts');
    expect(resolveActivityAuditRecordLocation({ entityType: 'host-target', entityRef: 'target-1' }).path).toBe('/hosts');
    expect(resolveActivityAuditRecordLocation({ entityType: 'managed-target', entityRef: '1' }).path).toBe('/inventory');
  });
});
