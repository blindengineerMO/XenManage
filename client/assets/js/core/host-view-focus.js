/**
 * XenMange client — HostsView focus (detail pane / route query).
 *
 * Concatenated global script (scripts/build-client.js). Not an ES module.
 *
 * Workspace split: focus = deep-link detail pane from `?focusKind=&focusRef=`.
 *
 * Purpose: skip or apply route-focus so HostsView opens properties for the
 * host named in the URL without looping on every query change.
 * Consumers: HostsView (`syncHostRouteFocusWorkflow`).
 * Gotchas: no-ops until hosts are loaded; `lastAppliedFocusKey` prevents
 * re-opening the same dialog. Kind must be empty or `host`.
 */
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
