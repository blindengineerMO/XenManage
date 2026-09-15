/**
 * XenMange client — LifecycleView focus (detail pane / route query).
 *
 * Concatenated global script (scripts/build-client.js). Not an ES module.
 *
 * Workspace split: focus = open planner/inspector from `?focusKind=task`
 * (alert/activity handoff onto a host).
 *
 * Purpose: skip or apply route-focus; map a task onto a host row.
 * Consumers: LifecycleView (`syncLifecycleRouteFocusWorkflow`).
 * Gotchas: supported kind is `task` (not `host`). Needs both tasks and hosts
 * loaded. Focus key includes seedAction.
 */
function isSupportedLifecycleRouteFocus(focus = null) {
  return Boolean(focus) && (!focus.kind || focus.kind === 'task');
}

function buildLifecycleRouteFocusSyncKey(focus = null, seedAction = '') {
  return `${getRouteFocusKey(focus)}|${String(seedAction || '').trim().toLowerCase()}`;
}

function shouldSkipLifecycleRouteFocusSync({
  focus = null,
  loading = false,
  tasks = [],
  hosts = [],
  lastAppliedFocusKey = '',
  seedAction = '',
} = {}) {
  if (!isSupportedLifecycleRouteFocus(focus)) {
    return { skip: true, resetState: buildLifecycleFocusResetState() };
  }

  if (loading || !(Array.isArray(tasks) ? tasks : []).length || !(Array.isArray(hosts) ? hosts : []).length) {
    return { skip: true, resetState: null };
  }

  const nextKey = buildLifecycleRouteFocusSyncKey(focus, seedAction);
  if (lastAppliedFocusKey === nextKey) {
    return { skip: true, resetState: null, key: nextKey };
  }

  return { skip: false, resetState: null, key: nextKey };
}

async function syncLifecycleRouteFocusWorkflow({
  routeQuery = {},
  loading = false,
  tasks = [],
  hosts = [],
  lastAppliedFocusKey = '',
  findTaskByFocus,
  resolveHostByTask,
  openPlanner,
} = {}) {
  const focus = getRouteFocus(routeQuery);
  const seedAction = String(routeQuery.seedAction || '').trim().toLowerCase();
  const syncState = shouldSkipLifecycleRouteFocusSync({
    focus,
    loading,
    tasks,
    hosts,
    lastAppliedFocusKey,
    seedAction,
  });

  if (syncState.skip) {
    return syncState.resetState || { lastAppliedFocusKey };
  }

  const task = typeof findTaskByFocus === 'function' ? findTaskByFocus(focus) : null;
  if (!task) return { lastAppliedFocusKey };

  if (['lifecycle-plan', 'lifecycle-maintenance'].includes(seedAction) && task.lifecycle_plan_seed?.enabled) {
    const host = typeof resolveHostByTask === 'function' ? resolveHostByTask(task) : null;
    if (!host) return { lastAppliedFocusKey };

    openPlanner(host, task.lifecycle_plan_seed, task, seedAction === 'lifecycle-maintenance' ? 'maintenance' : 'plan');
    return { lastAppliedFocusKey: syncState.key };
  }

  return { lastAppliedFocusKey };
}
