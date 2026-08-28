function buildSelectedHostSummaryProfile(host = null) {
  return {
    editionLabel: String(host?.edition || '').trim() || 'No host edition was reported.',
    cpuSummary: buildSelectedHostCpuSummary(host),
    softwareVersionSummary: summarizeHostStringMap(
      host?.software_version,
      'No host software version metadata was reported.'
    ),
    licenseServerSummary: summarizeHostStringMap(
      host?.license_server,
      'No external license server was reported for this host.'
    ),
    hardwarePlatformSummary: buildSelectedHostHardwarePlatformSummary(host),
    externalAuthTypeLabel: String(host?.external_auth_type || '').trim() || 'No external authentication type was reported.',
    externalAuthServiceLabel: String(host?.external_auth_service_name || '').trim() || 'No external authentication service was configured.',
    externalAuthConfigSummary: summarizeHostStringMap(
      host?.external_auth_configuration,
      'No external authentication configuration details were reported.'
    ),
    guestVcpusParamsSummary: summarizeHostStringMap(
      host?.guest_VCPUs_params,
      'No host-wide guest VCPU defaults were reported.'
    ),
    schedGranLabel: buildSelectedHostSchedGranLabel(host),
    sslLegacyLabel: buildSelectedHostSslLegacyLabel(host),
    biosStringsSummary: summarizeHostStringMap(
      host?.bios_strings,
      'No host BIOS identity strings were reported.'
    ),
    loggingSummary: buildSelectedHostLoggingSummary(host),
  };
}

function buildSelectedHostVmRecords(host = null, relatedVMs = []) {
  if (!host) return [];

  const residentRefs = new Set(Array.isArray(host.resident_VMs) ? host.resident_VMs : []);
  return (Array.isArray(relatedVMs) ? relatedVMs : []).filter((vm) =>
    residentRefs.has(vm.ref) || residentRefs.has(vm.uuid)
  );
}

function buildSelectedHostStorageRecords(host = null, relatedStorage = [], selectedHostPool = null) {
  if (!host) return [];

  const hostPbdRefs = new Set(Array.isArray(host.PBDs) ? host.PBDs : []);
  let records = (Array.isArray(relatedStorage) ? relatedStorage : []).filter((sr) =>
    Array.isArray(sr.PBDs) && sr.PBDs.some((ref) => hostPbdRefs.has(ref))
  );

  if (!records.length && selectedHostPool?.default_SR) {
    records = (Array.isArray(relatedStorage) ? relatedStorage : []).filter((sr) => sr.ref === selectedHostPool.default_SR);
  }

  return records;
}

function buildSelectedHostNetworkRecords(host = null, relatedNetworks = [], selectedHostPool = null) {
  if (!host) return [];

  const hostPifRefs = new Set(Array.isArray(host.PIFs) ? host.PIFs : []);
  let records = (Array.isArray(relatedNetworks) ? relatedNetworks : []).filter((network) =>
    Array.isArray(network.PIFs) && network.PIFs.some((ref) => hostPifRefs.has(ref))
  );

  if (!records.length && selectedHostPool?.migration_network) {
    records = (Array.isArray(relatedNetworks) ? relatedNetworks : []).filter(
      (network) => network.ref === selectedHostPool.migration_network
    );
  }

  return records;
}

function buildHostMaintenanceNetworkOptions(selectedHostPool = null, selectedHostNetworkRecords = [], relatedNetworks = []) {
  const poolMigrationRef = selectedHostPool?.migration_network || '';
  const ordered = [...(Array.isArray(selectedHostNetworkRecords) ? selectedHostNetworkRecords : [])];

  if (poolMigrationRef) {
    const poolMigrationNetwork = (Array.isArray(relatedNetworks) ? relatedNetworks : []).find(
      (network) => network.ref === poolMigrationRef
    );
    if (poolMigrationNetwork && !ordered.some((network) => network.ref === poolMigrationNetwork.ref)) {
      ordered.unshift(poolMigrationNetwork);
    }
  }

  return ordered;
}

function buildHostMaintenanceActionDraft(selectedHostPool = null, maintenanceNetworkOptions = []) {
  return {
    networkRef: selectedHostPool?.migration_network || maintenanceNetworkOptions[0]?.ref || '',
    poolMigrationNetworkRef: selectedHostPool?.migration_network || '',
    evacuateBatchSize: 0,
    evacuateRunningVms: true,
  };
}

function buildHostShutdownReady(selectedHost = null, selectedHostVmRecords = []) {
  if (!selectedHost) return false;
  return !selectedHost.enabled && (Array.isArray(selectedHostVmRecords) ? selectedHostVmRecords : []).length === 0;
}

function buildSelectedHostInventoryRows({
  selectedHost = null,
  selectedHostPool = null,
  selectedHostVmRecords = [],
  selectedHostStorageRecords = [],
  selectedHostNetworkRecords = [],
  metricsLoading = false,
  hostMetrics = {},
} = {}) {
  if (!selectedHost) return [];

  const cpuInfo = selectedHost.cpu_info || selectedHost.CPU_info || {};
  const cpuCount = cpuInfo.cpu_count || cpuInfo.CPU_count || selectedHost.host_CPUs?.length || 0;
  const cpuModel = cpuInfo.modelname || cpuInfo.vendor || 'Host compute plane';
  const memorySummary = metricsLoading
    ? 'Memory telemetry loading'
    : `${formatBytes(hostMetrics.memory_total)} total · ${formatBytes(hostMetrics.memory_free)} free`;

  const rows = [
    {
      kind: 'compute',
      name: selectedHost.name_label || selectedHost.hostname || 'Host',
      detail: `${cpuCount || 0} CPUs · ${cpuModel} · ${memorySummary}`,
      status: hostMetrics.live === false ? 'warning' : (selectedHost.enabled ? 'enabled' : 'disabled'),
      ref: selectedHost.ref || selectedHost.uuid || '',
    },
  ];

  if (selectedHostPool) {
    rows.push({
      kind: 'pool',
      name: selectedHostPool.name_label || 'Pool Membership',
      detail: `${selectedHostPool.uuid || selectedHostPool.ref || '-'} · default SR ${selectedHostPool.default_SR || '-'}`,
      status: 'info',
      ref: selectedHostPool.ref || selectedHostPool.uuid || '',
    });
  }

  rows.push(...(Array.isArray(selectedHostVmRecords) ? selectedHostVmRecords : []).map((vm) => ({
    kind: 'vm',
    name: vm.name_label || vm.ref || 'Virtual Machine',
    detail: `${vm.power_state || 'Unknown'} · ${vm.VCPUs_at_startup || 0} vCPU · ${formatBytes(vm.memory_static_max)}`,
    status: vm.power_state || 'info',
    ref: vm.ref || vm.uuid || '',
  })));

  rows.push(...(Array.isArray(selectedHostStorageRecords) ? selectedHostStorageRecords : []).map((sr) => ({
    kind: 'storage',
    name: sr.name_label || sr.ref || 'Storage Repository',
    detail: `${sr.type || 'unknown'} · ${formatBytes(sr.virtual_allocation)} / ${formatBytes(sr.physical_size)}`,
    status: getUtilizationStatus(percentValue(sr.virtual_allocation, sr.physical_size), { warning: 75, critical: 90 }),
    ref: sr.ref || sr.uuid || '',
  })));

  rows.push(...(Array.isArray(selectedHostNetworkRecords) ? selectedHostNetworkRecords : []).map((network) => ({
    kind: 'network',
    name: network.name_label || network.bridge || 'Network',
    detail: `${network.bridge || '-'} · VLAN ${(network.other_config || {}).vlan || '-'} · ${network.managed ? 'managed' : 'unmanaged'}`,
    status: network.managed ? 'enabled' : 'disabled',
    ref: network.ref || network.uuid || '',
  })));

  return rows;
}

function buildSelectedHostRelationshipProfile({
  selectedHost = null,
  selectedHostPool = null,
  relatedVMs = [],
  relatedStorage = [],
  relatedNetworks = [],
  metricsLoading = false,
  hostMetrics = {},
} = {}) {
  const vmRecords = buildSelectedHostVmRecords(selectedHost, relatedVMs);
  const storageRecords = buildSelectedHostStorageRecords(selectedHost, relatedStorage, selectedHostPool);
  const networkRecords = buildSelectedHostNetworkRecords(selectedHost, relatedNetworks, selectedHostPool);
  const maintenanceNetworkOptions = buildHostMaintenanceNetworkOptions(
    selectedHostPool,
    networkRecords,
    relatedNetworks
  );

  return {
    vmRecords,
    storageRecords,
    networkRecords,
    maintenanceNetworkOptions,
    maintenanceDraft: buildHostMaintenanceActionDraft(selectedHostPool, maintenanceNetworkOptions),
    shutdownReady: buildHostShutdownReady(selectedHost, vmRecords),
    inventoryRows: buildSelectedHostInventoryRows({
      selectedHost,
      selectedHostPool,
      selectedHostVmRecords: vmRecords,
      selectedHostStorageRecords: storageRecords,
      selectedHostNetworkRecords: networkRecords,
      metricsLoading,
      hostMetrics,
    }),
  };
}
