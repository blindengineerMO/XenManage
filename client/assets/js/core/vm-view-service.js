function createEmptyVmMetricHistory() {
  return { metrics: [] };
}

function createEmptyVmCompatibility() {
  return {
    hosts: [],
    lastBootCpuFlags: {},
    possibleHostRefs: [],
    hardwarePlatformVersion: 0,
    maskingApiAvailable: false,
  };
}

function createEmptyVmInventoryContext() {
  return {
    relatedHosts: [],
    relatedPools: [],
    relatedStorage: [],
    relatedNetworks: [],
  };
}

function createEmptyVmDetailContext() {
  return {
    selectedVM: null,
    ...createEmptyVmInventoryContext(),
    relatedAppliances: [],
    relatedSnapshotSchedules: [],
    relatedVdis: [],
    vmMetricHistory: createEmptyVmMetricHistory(),
    vmSnapshots: [],
    vmCompatibility: createEmptyVmCompatibility(),
    vmConsoles: [],
  };
}

async function loadVmInventoryContext(api, targetKey = '') {
  const normalizedTargetKey = String(targetKey || '').trim();
  const [hosts, pools, storage, networks] = await Promise.all([
    api.getHosts(normalizedTargetKey).catch(() => ({ data: [] })),
    api.getPools(normalizedTargetKey).catch(() => ({ data: [] })),
    api.getSRs(normalizedTargetKey).catch(() => ({ data: [] })),
    api.getNetworks(normalizedTargetKey).catch(() => ({ data: [] })),
  ]);

  return {
    relatedHosts: hosts.data || [],
    relatedPools: pools.data || [],
    relatedStorage: storage.data || [],
    relatedNetworks: networks.data || [],
  };
}

async function loadVmDetailContext(api, ref) {
  const inventoryPromise = loadVmInventoryContext(api);
  const [vm, appliances, snapshotSchedules, metricHistory, snapshots, compatibility, consoles, inventory] = await Promise.all([
    api.getVM(ref),
    api.getVMAppliances().catch(() => ({ data: [] })),
    api.getVMSnapshotSchedules().catch(() => ({ data: [] })),
    api.getVmMetricHistory(ref).catch(() => createEmptyVmMetricHistory()),
    api.getVMSnapshots(ref).catch(() => ({ data: [] })),
    api.getVMCompatibility(ref).catch(() => createEmptyVmCompatibility()),
    api.getVMConsoles(ref).catch(() => ({ data: [] })),
    inventoryPromise,
  ]);

  const relatedStorage = inventory.relatedStorage || [];
  const vdiResults = await Promise.all(
    relatedStorage.map((sr) =>
      api.getSRVDIs(sr.ref)
        .then((result) => result.data || [])
        .catch(() => [])
    )
  );

  return {
    selectedVM: vm || null,
    ...inventory,
    relatedAppliances: appliances.data || [],
    relatedSnapshotSchedules: snapshotSchedules.data || [],
    relatedVdis: vdiResults.flat(),
    vmMetricHistory: metricHistory || createEmptyVmMetricHistory(),
    vmSnapshots: (snapshots.data || [])
      .map((entry) => normalizeVmSnapshotRecord(entry))
      .sort((left, right) => new Date(right.snapshot_time || 0) - new Date(left.snapshot_time || 0)),
    vmCompatibility: compatibility || createEmptyVmCompatibility(),
    vmConsoles: (consoles.data || []).map((entry) => normalizeVmConsoleRecord(entry)),
  };
}
