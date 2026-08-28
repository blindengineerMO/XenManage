async function loadVmRecords(api) {
  const result = await api.getVMs();
  return result.data || [];
}

async function loadVmAutomationTasks(api) {
  const result = await api.getTasks().catch(() => ({ data: [] }));
  return result.data || [];
}

function buildVmPropertiesWorkspaceState(row, options = {}) {
  const nextActiveTab = String(options.activeTab || '').trim() || 'overview';
  const nextMigrationSeed = options.migrationSeed && typeof options.migrationSeed === 'object'
    ? { ...options.migrationSeed }
    : null;

  return {
    selectedVM: row || null,
    showProps: true,
    activeTab: nextActiveTab,
    actionError: null,
    exportBusy: '',
    migrationSeed: nextMigrationSeed,
    migrationSourceTask: options.migrationSourceTask || null,
  };
}

function buildVmImportWindowOpenState() {
  return {
    importError: null,
    importStatusMessage: '',
    showImportWindow: true,
  };
}

function buildVmImportWindowClosedState() {
  return {
    showImportWindow: false,
    importSaving: false,
    importError: null,
  };
}

function createEmptyVmMigrationDestinationState() {
  const emptyInventory = createEmptyVmInventoryContext();
  return {
    migrationDestinationLoading: false,
    migrationDestinationError: null,
    migrationDestinationTargetKey: '',
    migrationDestinationHosts: emptyInventory.relatedHosts,
    migrationDestinationPools: emptyInventory.relatedPools,
    migrationDestinationStorage: emptyInventory.relatedStorage,
    migrationDestinationNetworks: emptyInventory.relatedNetworks,
  };
}

function buildVmMigrationDestinationLoadingState(targetKey = '') {
  return {
    migrationDestinationLoading: true,
    migrationDestinationError: null,
    migrationDestinationTargetKey: String(targetKey || '').trim(),
  };
}

function buildVmMigrationDestinationInventoryState(targetKey = '', inventory = {}) {
  return {
    migrationDestinationHosts: inventory.relatedHosts || [],
    migrationDestinationPools: inventory.relatedPools || [],
    migrationDestinationStorage: inventory.relatedStorage || [],
    migrationDestinationNetworks: inventory.relatedNetworks || [],
    migrationDestinationTargetKey: String(targetKey || '').trim(),
  };
}

function buildVmMigrationDestinationErrorState(message = '') {
  return {
    migrationDestinationError: String(message || '').trim() || 'Unable to load destination migration inventory',
  };
}

function resolveVmMigrationDestinationTargetKey(preferredTargetKey = '', currentTargetKey = '', migrationTargetOptions = []) {
  return String(preferredTargetKey || currentTargetKey || migrationTargetOptions[0]?.targetKey || '').trim();
}

function hasVmMigrationDestinationInventory(state = {}) {
  return Boolean(
    (state.migrationDestinationHosts || []).length
    || (state.migrationDestinationStorage || []).length
    || (state.migrationDestinationNetworks || []).length
  );
}

function createVmDetailLoadingState() {
  const emptyDetail = createEmptyVmDetailContext();
  return {
    detailLoading: true,
    detailError: null,
    vmMetricHistory: emptyDetail.vmMetricHistory,
    vmSnapshots: emptyDetail.vmSnapshots,
    vmCompatibility: emptyDetail.vmCompatibility,
    vmConsoles: emptyDetail.vmConsoles,
  };
}

function buildVmDetailWorkspaceState(detailContext = {}, selectedVM = null) {
  return {
    selectedVM: { ...(selectedVM || {}), ...(detailContext.selectedVM || {}) },
    relatedHosts: detailContext.relatedHosts || [],
    relatedPools: detailContext.relatedPools || [],
    relatedAppliances: detailContext.relatedAppliances || [],
    relatedSnapshotSchedules: detailContext.relatedSnapshotSchedules || [],
    relatedStorage: detailContext.relatedStorage || [],
    relatedNetworks: detailContext.relatedNetworks || [],
    relatedVdis: detailContext.relatedVdis || [],
    vmMetricHistory: detailContext.vmMetricHistory || createEmptyVmMetricHistory(),
    vmSnapshots: detailContext.vmSnapshots || [],
    vmCompatibility: detailContext.vmCompatibility || createEmptyVmCompatibility(),
    vmConsoles: detailContext.vmConsoles || [],
  };
}

function buildVmDetailErrorState(message = '') {
  return {
    detailError: String(message || '').trim() || 'Unable to load VM detail',
  };
}

function buildVmDetailLoadingCompleteState() {
  return { detailLoading: false };
}

function findRefreshedVmRecord(vms = [], ref = '', fallback = null) {
  const normalizedRef = String(ref || '').trim();
  if (!normalizedRef) return fallback;
  return (Array.isArray(vms) ? vms : []).find((vm) => vm.ref === normalizedRef) || fallback;
}
