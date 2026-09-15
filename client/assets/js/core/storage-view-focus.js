/**
 * XenMange client — StorageView focus (detail pane / route query).
 *
 * Concatenated global script (scripts/build-client.js). Not an ES module.
 *
 * Workspace split: focus = open an SR (and optionally a VDI/VBD) from
 * `?focusKind=storage` deep links.
 *
 * Purpose: skip or apply route-focus; resolve focused VDI inside the SR.
 * Consumers: StorageView (`sync` via shouldSkipStorageRouteFocusSync).
 * Gotchas: kind must be empty or `storage`. Missing inventory resets focus
 * state via `createStorageRouteFocusResetState`.
 */
function isSupportedStorageRouteFocus(focus = null) {
  return Boolean(focus) && (!focus.kind || focus.kind === 'storage');
}

function shouldSkipStorageRouteFocusSync({
  focus = null,
  loading = false,
  srs = [],
  lastAppliedFocusKey = '',
} = {}) {
  if (!isSupportedStorageRouteFocus(focus)) {
    return { skip: true, resetState: createStorageRouteFocusResetState() };
  }

  if (loading || !(Array.isArray(srs) ? srs : []).length) {
    return { skip: true, resetState: null };
  }

  const nextKey = getRouteFocusKey(focus);
  if (lastAppliedFocusKey === nextKey) {
    return { skip: true, resetState: null, key: nextKey };
  }

  return { skip: false, resetState: null, key: nextKey };
}

function findStorageByFocus(srs = [], focus = null) {
  return (Array.isArray(srs) ? srs : []).find((sr) =>
    recordMatchesRouteFocus(sr, focus, ['ref', 'uuid', 'name_label'])
  ) || null;
}

async function resolveFocusedStorageTarget({
  srs = [],
  focus = null,
  loadSrVdis,
  loadVbds,
} = {}) {
  const direct = findStorageByFocus(srs, focus);
  if (direct) {
    return { sr: direct, vdis: null, focusedVdi: null, focusedVbd: null, vbds: null };
  }

  let targetVdiRef = '';
  let focusedVbdRecord = null;
  let vbds = null;
  if (focus?.cls === 'vbd' && typeof loadVbds === 'function') {
    try {
      const vbdResult = await loadVbds();
      vbds = vbdResult.data || [];
      focusedVbdRecord = vbds.find((vbd) => recordMatchesRouteFocus(vbd, focus, ['ref', 'uuid'])) || null;
      if (focusedVbdRecord?.VDI) targetVdiRef = focusedVbdRecord.VDI;
    } catch (_error) {
      // Fall back to ref-only VDI-list matching below when the batched VBD fetch fails.
    }
  }

  for (const sr of Array.isArray(srs) ? srs : []) {
    try {
      const result = await loadSrVdis(sr.ref);
      const vdis = result.data || [];
      const match = targetVdiRef
        ? vdis.find((vdi) => vdi.ref === targetVdiRef)
        : vdis.find((vdi) =>
            recordMatchesRouteFocus(
              vdi,
              focus,
              ['ref', 'uuid', 'name_label'],
              focus.ref && focus.cls === 'vbd' ? (vdi.VBDs || []) : []
            )
          );

      if (match) {
        return { sr, vdis, focusedVdi: match, focusedVbd: focusedVbdRecord, vbds };
      }
    } catch (_error) {
      // Keep searching other repositories when one VDI inventory call fails.
    }
  }

  return null;
}

async function syncStorageRouteFocusWorkflow({
  routeQuery = {},
  loading = false,
  srs = [],
  lastAppliedFocusKey = '',
  loadSrVdis,
  loadVbds,
  openProperties,
} = {}) {
  const focus = getRouteFocus(routeQuery);
  const syncState = shouldSkipStorageRouteFocusSync({
    focus,
    loading,
    srs,
    lastAppliedFocusKey,
  });

  if (syncState.skip) {
    return syncState.resetState || { lastAppliedFocusKey };
  }

  const target = await resolveFocusedStorageTarget({
    srs,
    focus,
    loadSrVdis,
    loadVbds,
  });
  if (!target?.sr) {
    return { lastAppliedFocusKey };
  }

  await openProperties(target.sr, {
    vdis: target.vdis,
    vbds: target.vbds || undefined,
    focusedVdiRef: target.focusedVdi?.ref || '',
    focusedVdiUuid: target.focusedVdi?.uuid || focus.uuid || '',
    focusedVbdRef: focus.cls === 'vbd' ? (target.focusedVbd?.ref || focus.ref || '') : '',
    focusedStorageClass: ['vdi', 'vbd'].includes(focus.cls) ? focus.cls : '',
  });

  return { lastAppliedFocusKey: syncState.key };
}

if (typeof module !== 'undefined') {
  module.exports = {
    findStorageByFocus,
    resolveFocusedStorageTarget,
    syncStorageRouteFocusWorkflow,
  };
}
