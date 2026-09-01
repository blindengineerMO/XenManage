/* ============================================
   Storage View Workspace Helpers
   ============================================ */

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
      { key: 'type', label: 'Type' },
      { key: 'physical_size', label: 'Physical Size' },
      { key: 'virtual_allocation', label: 'Virtual Allocation' },
      { key: 'uuid', label: 'UUID' },
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
