function isSupportedVmRouteFocus(focus = null) {
  return Boolean(focus) && (!focus.kind || ['vm', 'task'].includes(focus.kind));
}

function buildVmRouteFocusSyncKey(focus = null, seedAction = '') {
  return `${getRouteFocusKey(focus)}|${String(seedAction || '').trim().toLowerCase()}`;
}

function shouldSkipVmRouteFocusSync({ focus = null, loading = false, vms = [], lastAppliedFocusKey = '', seedAction = '' } = {}) {
  if (!isSupportedVmRouteFocus(focus)) {
    return { skip: true, resetFocusKey: true };
  }

  if (loading || !(Array.isArray(vms) ? vms : []).length) {
    return { skip: true, resetFocusKey: false };
  }

  const nextKey = buildVmRouteFocusSyncKey(focus, seedAction);
  if (lastAppliedFocusKey === nextKey) {
    return { skip: true, resetFocusKey: false, key: nextKey };
  }

  return { skip: false, resetFocusKey: false, key: nextKey };
}

function buildVmFocusedTaskOpenOptions(task = null) {
  return {
    activeTab: 'migration',
    migrationSeed: task?.vm_migration_seed || null,
    migrationSourceTask: task || null,
  };
}

async function syncVmRouteFocusWorkflow({
  routeQuery = {},
  loading = false,
  vms = [],
  lastAppliedFocusKey = '',
  automationTasks = [],
  loadTasks,
  openProperties,
} = {}) {
  const focus = getRouteFocus(routeQuery);
  const seedAction = String(routeQuery.seedAction || '').trim().toLowerCase();
  const syncState = shouldSkipVmRouteFocusSync({
    focus,
    loading,
    vms,
    lastAppliedFocusKey,
    seedAction,
  });

  if (syncState.skip) {
    return {
      lastAppliedFocusKey: syncState.resetFocusKey ? '' : lastAppliedFocusKey,
      automationTasks,
    };
  }

  if (focus.kind === 'task') {
    let nextTasks = Array.isArray(automationTasks) ? automationTasks : [];
    if (typeof loadTasks === 'function') {
      nextTasks = await loadTasks(false, nextTasks);
    }

    let task = findTaskByFocus(nextTasks, focus);
    if (!task && typeof loadTasks === 'function') {
      nextTasks = await loadTasks(true, nextTasks);
      task = findTaskByFocus(nextTasks, focus);
    }
    if (!task) {
      return { lastAppliedFocusKey, automationTasks: nextTasks };
    }

    if (seedAction === 'vm-migration' && task.vm_migration_seed?.enabled) {
      const vm = findVmByTask(vms, task);
      if (!vm) {
        return { lastAppliedFocusKey, automationTasks: nextTasks };
      }

      await openProperties(vm, buildVmFocusedTaskOpenOptions(task));
      return {
        lastAppliedFocusKey: syncState.key,
        automationTasks: nextTasks,
      };
    }

    return { lastAppliedFocusKey, automationTasks: nextTasks };
  }

  const match = findVmByFocus(vms, focus);
  if (!match) {
    return { lastAppliedFocusKey, automationTasks };
  }

  await openProperties(match);
  return {
    lastAppliedFocusKey: syncState.key,
    automationTasks,
  };
}

function shouldSyncVmMigrationSourceTask(task = null) {
  if (!task?.ref || !isRemediationTask(task)) return false;

  const currentStatus = String(task.status || '').trim().toLowerCase();
  return !['success', 'warning', 'failure', 'cancelled'].includes(currentStatus);
}

function buildVmMigrationSourceTaskUpdatePayload(task = null, result = '', username = '') {
  return {
    assignee: task?.assignee || username || '',
    dueDate: task?.due_date || task?.dueDate || '',
    result,
    nameDescription: task?.name_description || task?.nameDescription || '',
  };
}

function applyVmMigrationSourceTaskUpdate(tasks = [], updatedTask = null) {
  if (!updatedTask?.ref) return Array.isArray(tasks) ? tasks : [];
  return (Array.isArray(tasks) ? tasks : []).map((task) => (
    task.ref === updatedTask.ref ? updatedTask : task
  ));
}

async function syncVmMigrationSourceTaskWorkflow({
  api,
  migrationSourceTask = null,
  automationTasks = [],
  status = '',
  result = '',
  username = '',
} = {}) {
  if (!shouldSyncVmMigrationSourceTask(migrationSourceTask)) {
    return {
      automationTasks,
      migrationSourceTask,
      updated: false,
    };
  }

  const updatedTask = await api.updateRemediationTask(
    migrationSourceTask.ref,
    {
      status,
      ...buildVmMigrationSourceTaskUpdatePayload(migrationSourceTask, result, username),
    }
  );

  return {
    automationTasks: applyVmMigrationSourceTaskUpdate(automationTasks, updatedTask),
    migrationSourceTask: updatedTask,
    updated: true,
  };
}
