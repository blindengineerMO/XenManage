/* ============================================
   Host View Focus Helpers
   ============================================ */

function isSupportedHostRouteFocus(focus = null) {
  return Boolean(focus) && (!focus.kind || focus.kind === 'host');
}

function shouldSkipHostRouteFocusSync({
  focus = null,
  loading = false,
  hosts = [],
  lastAppliedFocusKey = '',
} = {}) {
  if (!isSupportedHostRouteFocus(focus)) {
    return { skip: true, lastAppliedFocusKey: '' };
  }

  if (loading || !(Array.isArray(hosts) ? hosts : []).length) {
    return { skip: true, lastAppliedFocusKey };
  }

  const nextKey = getRouteFocusKey(focus);
  if (lastAppliedFocusKey === nextKey) {
    return { skip: true, lastAppliedFocusKey, key: nextKey };
  }

  return { skip: false, lastAppliedFocusKey, key: nextKey };
}

async function syncHostRouteFocusWorkflow({
  routeQuery = {},
  loading = false,
  hosts = [],
  lastAppliedFocusKey = '',
  openProperties,
} = {}) {
  const focus = getRouteFocus(routeQuery);
  const syncState = shouldSkipHostRouteFocusSync({
    focus,
    loading,
    hosts,
    lastAppliedFocusKey,
  });

  if (syncState.skip) {
    return { lastAppliedFocusKey: syncState.lastAppliedFocusKey };
  }

  const match = findHostByFocus(hosts, focus);
  if (!match) {
    return { lastAppliedFocusKey };
  }

  await openProperties(match);
  return { lastAppliedFocusKey: syncState.key };
}

if (typeof module !== 'undefined') {
  module.exports = {
    isSupportedHostRouteFocus,
    shouldSkipHostRouteFocusSync,
    syncHostRouteFocusWorkflow,
  };
}
