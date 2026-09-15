/**
 * XenMange client — StorageView workspace (selection / layout state).
 *
 * Concatenated global script (scripts/build-client.js). Not an ES module.
 *
 * Workspace split: workspace = selected SR, open windows, bulk refs, ISO
 * browser path, focused VDI/VBD; service = API; focus = route deep-link.
 *
 * Purpose: factory for StorageView reactive state and window/detail patches.
 * Consumers: StorageView.
 * Gotchas: file-browser fields are workspace state, not a separate module.
 * Add new dialog flags here so they stay reactive.
 */
function createStorageViewState() {
  return {
    loading: true,
    srs: [],
    selectedSR: null,
    showCreateSrWindow: false,
    showProps: false,
    showSrIdentityWindow: false,
    showSrActionsWindow: false,
    showSrCreateVdiWindow: false,
    showSrResizeVdiWindow: false,
    showAttachCdWindow: false,
    attachCdVdi: null,
    attachCdVmRef: '',
    showFileBrowser: false,
    fileBrowserPath: '',
    fileBrowserEntries: [],
    fileBrowserLoading: false,
    fileBrowserError: '',
    fileBrowserActionBusy: '',
    detailLoading: false,
    detailError: '',
    vdis: [],
    relatedVMs: [],
    relatedHosts: [],
    relatedVbds: [],
    relatedPbds: [],
    availableHosts: [],
    focusedVdiRef: '',
    focusedVdiUuid: '',
    focusedVbdRef: '',
    focusedStorageClass: '',
    selectedSrRefs: [],
    bulkActionBusy: '',
    bulkError: null,
    detailActionBusy: '',
    detailActionError: '',
    detailActionMessage: '',
    createSrBusy: false,
    createSrError: '',
    createSrProbeBusy: false,
    createSrProbeError: '',
    createSrProbeResult: null,
    createSrProbeRequest: null,
    createSrImportBusyKey: '',
    createSrImportError: '',
    workspaceMessage: '',
    localCacheHostRef: '',
    lastAppliedFocusKey: '',
    columns: [
      { key: 'name_label', label: 'Name', editable: true, emptyLabel: 'Unnamed Repository' },
      { key: 'name_description', label: 'Description', editable: true, emptyLabel: '—', truncate: true },
      { key: 'type', label: 'Type' },
      { key: 'physical_size', label: 'Physical Size' },
      { key: 'virtual_allocation', label: 'Virtual Allocation' },
      { key: 'uuid', label: 'UUID', truncate: true },
    ],
  };
}

function buildStorageWorkspaceWindowResetState() {
  return {
    showSrIdentityWindow: false,
    showSrActionsWindow: false,
    showSrCreateVdiWindow: false,
    showSrResizeVdiWindow: false,
    showAttachCdWindow: false,
    attachCdVdi: null,
    attachCdVmRef: '',
    showFileBrowser: false,
    fileBrowserPath: '',
    fileBrowserEntries: [],
    fileBrowserError: '',
  };
}

function createStorageRouteFocusResetState() {
  return {
    lastAppliedFocusKey: '',
    focusedVdiRef: '',
    focusedVdiUuid: '',
    focusedVbdRef: '',
    focusedStorageClass: '',
  };
}

function createEmptyStorageDetailState() {
  return {
    ...buildStorageWorkspaceWindowResetState(),
    showProps: false,
    selectedSR: null,
    detailLoading: false,
    detailError: '',
    vdis: [],
    relatedVMs: [],
    relatedHosts: [],
    relatedVbds: [],
    relatedPbds: [],
    focusedVdiRef: '',
    focusedVdiUuid: '',
    focusedVbdRef: '',
    focusedStorageClass: '',
    detailActionBusy: '',
    detailActionError: '',
    detailActionMessage: '',
    localCacheHostRef: '',
    lastAppliedFocusKey: '',
  };
}

function buildStoragePropertiesWorkspaceState(row, options = {}) {
  return {
    selectedSR: row || null,
    showProps: true,
    detailLoading: true,
    detailError: '',
    vdis: options.vdis || [],
    relatedVMs: options.vms || [],
    relatedHosts: options.hosts || [],
    relatedVbds: options.vbds || [],
    relatedPbds: options.pbds || [],
    focusedVdiRef: options.focusedVdiRef || '',
    focusedVdiUuid: options.focusedVdiUuid || '',
    focusedVbdRef: options.focusedVbdRef || '',
    focusedStorageClass: options.focusedStorageClass || '',
    detailActionBusy: '',
    detailActionError: '',
    detailActionMessage: '',
    localCacheHostRef: '',
  };
}

function buildStorageDetailWorkspaceState(detailContext = {}) {
  return {
    vdis: detailContext.vdis || [],
    relatedVMs: detailContext.relatedVMs || [],
    relatedHosts: detailContext.relatedHosts || [],
    relatedVbds: detailContext.relatedVbds || [],
    relatedPbds: detailContext.relatedPbds || [],
    detailError: detailContext.detailError || '',
  };
}

function buildStorageDetailErrorState(message = '') {
  return {
    detailError: String(message || '').trim() || 'Unable to load storage detail.',
  };
}

function buildStorageDetailLoadingCompleteState() {
  return { detailLoading: false };
}

function buildStorageDetailFocusOptions(state = {}) {
  return {
    focusedVdiRef: state.focusedVdiRef || '',
    focusedVdiUuid: state.focusedVdiUuid || '',
    focusedVbdRef: state.focusedVbdRef || '',
    focusedStorageClass: state.focusedStorageClass || '',
  };
}

function findRefreshedStorageRecord(srs = [], ref = '', fallback = null) {
  const normalizedRef = String(ref || '').trim();
  if (!normalizedRef) return fallback;
  return (Array.isArray(srs) ? srs : []).find((sr) => sr.ref === normalizedRef) || fallback;
}

if (typeof module !== 'undefined') {
  module.exports = {
    buildStorageDetailFocusOptions,
    buildStoragePropertiesWorkspaceState,
    createStorageRouteFocusResetState,
    createStorageViewState,
    findRefreshedStorageRecord,
  };
}
