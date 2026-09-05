const {
  buildTaskLineage,
  formatTaskLineage,
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
