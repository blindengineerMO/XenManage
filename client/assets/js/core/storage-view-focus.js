/* ============================================
   Storage View Focus Helpers
   ============================================ */

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
} = {}) {
  const direct = findStorageByFocus(srs, focus);
  if (direct) {
    return { sr: direct, vdis: null, focusedVdi: null };
  }

  for (const sr of Array.isArray(srs) ? srs : []) {
    try {
      const result = await loadSrVdis(sr.ref);
      const vdis = result.data || [];
      const match = vdis.find((vdi) =>
        recordMatchesRouteFocus(
          vdi,
          focus,
          ['ref', 'uuid', 'name_label'],
          focus.ref && focus.cls === 'vbd' ? (vdi.VBDs || []) : []
        )
      );

      if (match) {
        return { sr, vdis, focusedVdi: match };
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
  });
  if (!target?.sr) {
    return { lastAppliedFocusKey };
  }

  await openProperties(target.sr, {
    vdis: target.vdis,
    focusedVdiRef: target.focusedVdi?.ref || '',
    focusedVdiUuid: target.focusedVdi?.uuid || focus.uuid || '',
    focusedVbdRef: focus.cls === 'vbd' ? (focus.ref || '') : '',
    focusedStorageClass: ['vdi', 'vbd'].includes(focus.cls) ? focus.cls : '',
  });

  return { lastAppliedFocusKey: syncState.key };
}
