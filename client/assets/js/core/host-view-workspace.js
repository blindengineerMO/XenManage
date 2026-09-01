/* ============================================
   Host View Workspace Helpers
   ============================================ */

function createHostsViewState() {
  return {
    loading: true,
    hosts: [],
    hostTargets: [],
    connections: [],
    credentials: [],
    selectedHost: null,
    showProps: false,
    showHostIdentityWindow: false,
    showHostContextWindow: false,
    showHostLoggingWindow: false,
    showHostGuestCpuWindow: false,
    showHostSchedulerWindow: false,
    showHostPlatformWindow: false,
    showRegisteredTargetsWindow: false,
    showRegistration: false,
    showHostConnectDialogWindow: false,
    editingTargetId: null,
    hostTargetDraft: null,
    metricsLoading: false,
    metricsError: null,
    inventoryLoading: false,
    inventoryError: null,
    targetError: null,
    targetActionBusyId: null,
    targetActionBusyKind: '',
    connectTarget: null,
    connectPassword: '',
    connectLoading: false,
    connectError: null,
    useSavedCredential: false,
    actionError: null,
    hostActionMessage: '',
    hostActionBusy: '',
    hostConfigSaving: false,
    selectedHostRefs: [],
    bulkHostActionBusy: '',
    bulkError: null,
    hostMetrics: {},
    hostMetricHistory: { metrics: [] },
    lastAppliedFocusKey: '',
    relatedPools: [],
    relatedVMs: [],
    relatedStorage: [],
    relatedNetworks: [],
    columns: [
      { key: 'name_label', label: 'Name' },
      { key: 'enabled', label: 'Status' },
      { key: 'address', label: 'Address' },
      { key: 'uuid', label: 'UUID' },
    ],
    inventoryColumns: [
      { key: 'kind', label: 'Kind' },
      { key: 'name', label: 'Name' },
      { key: 'detail', label: 'Detail' },
      { key: 'status', label: 'Status' },
      { key: 'ref', label: 'Reference' },
    ],
  };
}

function buildHostWorkspaceWindowResetState() {
  return {
    showHostIdentityWindow: false,
    showHostContextWindow: false,
    showHostLoggingWindow: false,
    showHostGuestCpuWindow: false,
    showHostSchedulerWindow: false,
    showHostPlatformWindow: false,
  };
}

function buildHostPropertiesClosedState() {
  return {
    showProps: false,
    ...buildHostWorkspaceWindowResetState(),
  };
}

function buildHostPropertiesWorkspaceState(row = null) {
  return {
    ...buildHostWorkspaceWindowResetState(),
    selectedHost: row || null,
    showProps: Boolean(row),
    actionError: null,
    hostActionMessage: '',
    hostActionBusy: '',
    metricsLoading: Boolean(row),
    metricsError: null,
    hostMetrics: {},
    hostMetricHistory: { metrics: [] },
    inventoryLoading: Boolean(row),
    inventoryError: null,
    relatedPools: [],
    relatedVMs: [],
    relatedStorage: [],
    relatedNetworks: [],
  };
}

function buildHostDetailWorkspaceState(detailContext = {}) {
  return {
    hostMetrics: detailContext.hostMetrics || {},
    hostMetricHistory: detailContext.hostMetricHistory || { metrics: [] },
    relatedPools: detailContext.relatedPools || [],
    relatedVMs: detailContext.relatedVMs || [],
    relatedStorage: detailContext.relatedStorage || [],
    relatedNetworks: detailContext.relatedNetworks || [],
    metricsError: detailContext.metricsError || null,
    inventoryError: detailContext.inventoryError || null,
  };
}

function buildHostDetailLoadingCompleteState() {
  return {
    metricsLoading: false,
    inventoryLoading: false,
  };
}

function buildHostTargetDraft(target = null, connections = [], currentUser = null) {
  if (target) return { ...target };

  return {
    name: '',
    host: '',
    username: 'root',
    vault_credential_id: null,
    port: 443,
    mode: 'standalone',
    pool_connection_id: connections[0]?.id || null,
    notes: '',
    visibility: currentUser ? 'private' : 'shared',
  };
}

function buildHostRegistrationOpenState(target = null, connections = [], currentUser = null) {
  return {
    targetError: null,
    editingTargetId: target?.id || null,
    hostTargetDraft: buildHostTargetDraft(target, connections, currentUser),
    showRegistration: true,
  };
}

function buildHostConnectDialogOpenState(target = null) {
  return {
    connectTarget: target ? { ...target } : null,
    connectPassword: '',
    connectError: null,
    connectLoading: false,
    useSavedCredential: Boolean(target?.vault_credential_id),
    showHostConnectDialogWindow: Boolean(target),
  };
}

function buildHostConnectDialogClosedState() {
  return {
    showHostConnectDialogWindow: false,
    connectTarget: null,
    connectPassword: '',
    connectLoading: false,
    connectError: null,
    useSavedCredential: false,
  };
}

function findRefreshedHostRecord(hosts = [], ref = '', fallback = null) {
  const normalizedRef = String(ref || '').trim();
  if (!normalizedRef) return fallback;
  return (Array.isArray(hosts) ? hosts : []).find((host) => host.ref === normalizedRef) || fallback;
}

if (typeof module !== 'undefined') {
  module.exports = {
    buildHostConnectDialogClosedState,
    buildHostConnectDialogOpenState,
    buildHostDetailLoadingCompleteState,
    buildHostDetailWorkspaceState,
    buildHostPropertiesClosedState,
    buildHostPropertiesWorkspaceState,
    buildHostRegistrationOpenState,
    createHostsViewState,
    findRefreshedHostRecord,
  };
}
