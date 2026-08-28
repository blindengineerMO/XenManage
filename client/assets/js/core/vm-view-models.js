function formatVmMigrationCurrentHostSummary(host = null) {
  return host
    ? `${host.name_label || host.ref} · ${host.address || host.uuid || '-'}`
    : 'No resident host is currently mapped for this VM.';
}

function findVmMetricSeries(metricHistory = null, metricName = '') {
  const metrics = Array.isArray(metricHistory?.metrics) ? metricHistory.metrics : [];
  return metrics.find((entry) => entry.metricName === metricName)?.points || [];
}

function buildVmMetricSeriesDescriptor(metricName = '', index = 0) {
  const normalized = String(metricName || '').trim().toLowerCase();
  if (normalized.includes('network_rx')) return { label: 'RX', color: 'rgba(95, 235, 185, 0.95)' };
  if (normalized.includes('network_tx')) return { label: 'TX', color: 'rgba(91, 192, 255, 0.95)' };
  if (normalized.includes('disk_read')) return { label: 'Read', color: 'rgba(255, 186, 73, 0.95)' };
  if (normalized.includes('disk_write')) return { label: 'Write', color: 'rgba(255, 111, 145, 0.95)' };

  const palette = [
    'rgba(95, 235, 185, 0.95)',
    'rgba(91, 192, 255, 0.95)',
    'rgba(255, 186, 73, 0.95)',
    'rgba(255, 111, 145, 0.95)',
  ];
  return {
    label: normalized || `series-${index + 1}`,
    color: palette[index % palette.length],
  };
}

function combineVmMetricSeries(metricHistory = null, metricNames = []) {
  return (Array.isArray(metricNames) ? metricNames : [])
    .map((metricName, index) => {
      const points = findVmMetricSeries(metricHistory, metricName);
      if (!points.length) return null;
      const descriptor = buildVmMetricSeriesDescriptor(metricName, index);
      return {
        key: metricName,
        label: descriptor.label,
        color: descriptor.color,
        points,
      };
    })
    .filter(Boolean);
}

function getVmHistoryStatus(series = [], thresholds = {}) {
  const points = Array.isArray(series) ? series : [];
  const latest = Number(points[points.length - 1]?.value || 0);
  if (thresholds.critical !== undefined && latest >= thresholds.critical) return 'critical';
  if (thresholds.warning !== undefined && latest >= thresholds.warning) return 'warning';
  return 'success';
}

function formatVmMigrationEligibleDestinationsSummary(hostOptions = []) {
  const normalizedHostOptions = Array.isArray(hostOptions) ? hostOptions : [];
  return normalizedHostOptions.length
    ? `${normalizedHostOptions.length} pool host${normalizedHostOptions.length === 1 ? '' : 's'} available for same-pool placement`
    : 'No alternate enabled hosts were found in the current pool.';
}

function formatVmMigrationTargetFabricsSummary(destinationTargets = []) {
  const normalizedTargets = Array.isArray(destinationTargets) ? destinationTargets : [];
  return normalizedTargets.length
    ? `${normalizedTargets.length} additional live target${normalizedTargets.length === 1 ? '' : 's'} available for cross-pool placement`
    : 'Attach another live target to unlock cross-pool migration and storage remapping.';
}

function buildVmMigrationRuntimeProfile(vm = null) {
  const isLiveEligible = vm?.power_state === 'Running' || vm?.power_state === 'Suspended';
  return {
    runtimeModeSummary: isLiveEligible
      ? 'This VM can stay online during a live migration if the target host is compatible.'
      : 'This VM is not running, so XenMange will submit a relocate-style move instead of a live migration.',
    runtimeModeBadge: isLiveEligible ? 'live' : 'relocate',
  };
}

function formatVmMigrationDestinationFabricSummary(label = '', pools = [], storageOptions = []) {
  const normalizedLabel = String(label || '').trim();
  if (!normalizedLabel) return '';

  const poolCount = Array.isArray(pools) ? pools.length : 0;
  const storageCount = Array.isArray(storageOptions) ? storageOptions.length : 0;
  return `${normalizedLabel}${poolCount ? ` · ${poolCount} pool${poolCount === 1 ? '' : 's'}` : ''}${storageCount ? ` · ${storageCount} SR option${storageCount === 1 ? '' : 's'}` : ''}`;
}

function buildVmTabModels(view) {
  const vm = view?.selectedVM || null;
  const host = view?.selectedVmHost || null;
  const pool = view?.selectedVmPool || null;
  const platform = view?.selectedVmPlatformProfile || {};
  const compute = view?.selectedVmComputeProfile || {};
  const guestMetrics = view?.selectedVmGuestMetricsProfile || {};
  const recommendations = view?.selectedVmRecommendationsProfile || {};
  const recordSummary = view?.selectedVmRecordSummaryProfile || {};
  const attachedDisks = Array.isArray(view?.attachedVmDisks) ? view.attachedVmDisks : [];
  const attachedNetworks = Array.isArray(view?.attachedVmNetworks) ? view.attachedVmNetworks : [];
  const compatibilityHosts = normalizeVmCompatibilityHosts(view?.vmCompatibility);
  const compatibilityFlagRows = buildVmCompatibilityFlagRows(view?.vmCompatibility);
  const latestSnapshot = (Array.isArray(view?.vmSnapshots) ? view.vmSnapshots : [])[0] || null;
  const primaryConsole = findPrimaryVmConsole(view?.vmConsoles);
  const memoryUsageSeries = findVmMetricSeries(view?.vmMetricHistory, 'memory_usage_percent');
  const cpuUsageSeries = findVmMetricSeries(view?.vmMetricHistory, 'cpu_usage_percent');
  const networkThroughputSeries = combineVmMetricSeries(view?.vmMetricHistory, ['network_rx_kib_per_s', 'network_tx_kib_per_s']);
  const diskThroughputSeries = combineVmMetricSeries(view?.vmMetricHistory, ['disk_read_kib_per_s', 'disk_write_kib_per_s']);
  const migrationRuntimeProfile = buildVmMigrationRuntimeProfile(vm);

  return {
    console: buildVmConsoleModel({
      vm,
      consoles: view?.vmConsoles || [],
      primaryConsole,
    }),
    overview: buildVmOverviewModel({
      vm,
      host,
      pool,
      hardwarePlatformSummary: platform.hardwarePlatformSummary,
      domainTypeSummary: platform.domainTypeSummary,
      secureBootSummary: platform.secureBootSummary,
      videoRamSummary: platform.videoRamSummary,
      igdPassthroughSummary: platform.igdPassthroughSummary,
      vendorDeviceSummary: platform.vendorDeviceSummary,
      memoryStaticMinFormatted: formatBytes(vm?.memory_static_min || vm?.memory_static_max),
      memoryDynamicMinFormatted: formatBytes(vm?.memory_dynamic_min || vm?.memory_static_min || vm?.memory_dynamic_max || vm?.memory_static_max),
      memoryDynamicMaxFormatted: formatBytes(vm?.memory_dynamic_max || vm?.memory_static_max),
      memoryStaticMaxFormatted: formatBytes(vm?.memory_static_max),
      affinityLabel: view?.selectedVmAffinityLabel || '',
      applianceSummary: view?.selectedVmApplianceSummary || '',
      snapshotScheduleSummary: view?.selectedVmSnapshotScheduleSummary || '',
      protectionPolicySummary: view?.selectedVmProtectionPolicySummary || '',
      guestMetricsSummary: guestMetrics.summary,
      recommendationsSummary: recommendations.summary,
      tagsSummary: typeof view?.truncateList === 'function' ? view.truncateList(vm?.tags) : '',
      blockedOperationsSummary: recordSummary.blockedOperationsSummary,
      vcpusParamsSummary: compute.vcpusParamsSummary,
      otherConfigSummary: recordSummary.otherConfigSummary,
      xenstoreDataSummary: recordSummary.xenstoreDataSummary,
      nvramSummary: recordSummary.nvramSummary,
      platformSummary: recordSummary.platformSummary,
      overviewCards: buildVmOverviewCards({
        host,
        pool,
        attachedDisks,
        attachedNetworks,
        domainTypeSummary: platform.domainTypeSummary,
        secureBootSummary: platform.secureBootSummary,
        vendorDeviceSummary: platform.vendorDeviceSummary,
        formatBytes,
      }),
      guestMetricsHeartbeatSummary: guestMetrics.heartbeatSummary,
      guestMetricsUpdatedSummary: guestMetrics.updatedSummary,
      guestMetricsLive: guestMetrics.live,
      guestOsSummary: guestMetrics.osSummary,
      guestPvDriversSummary: guestMetrics.pvDriversSummary,
      guestNetworksSummary: guestMetrics.networksSummary,
      recommendationsBody: recommendations.body,
      memoryUsageSeries,
      memoryUsageStatus: getVmHistoryStatus(memoryUsageSeries, { warning: 75, critical: 90 }),
      cpuUsageSeries,
      cpuUsageStatus: getVmHistoryStatus(cpuUsageSeries, { warning: 70, critical: 90 }),
      networkThroughputSeries,
      diskThroughputSeries,
    }),
    resources: buildVmResourcesModel({
      vm,
      host,
      pool,
      attachedDisks,
      attachedNetworks,
      diskColumns: view?.diskColumns || [],
      networkColumns: view?.networkColumns || [],
    }),
    compatibility: buildVmCompatibilityModel({
      vm,
      hosts: compatibilityHosts,
      compatibleHostCount: countCompatibleVmHosts(compatibilityHosts),
      hardwarePlatformVersion: view?.vmCompatibility?.hardwarePlatformVersion || 0,
      flagRows: compatibilityFlagRows,
      flagCount: compatibilityFlagRows.length,
      currentHostCpuModel: host?.cpu_info?.modelname || '',
      columns: view?.compatibilityColumns || [],
    }),
    config: buildVmConfigModel({
      vm,
      hostOptions: view?.vmConfigHostOptions || [],
      applianceOptions: view?.relatedAppliances || [],
      snapshotScheduleOptions: view?.relatedSnapshotSchedules || [],
      saving: Boolean(view?.configSaving),
      vcpuDetail: compute.vcpuDetail,
      memoryStaticMinGiB: compute.memoryStaticMinGiB,
      memoryDynamicMinGiB: compute.memoryDynamicMinGiB,
      memoryDynamicMaxGiB: compute.memoryDynamicMaxGiB,
      memoryStaticMaxGiB: compute.memoryStaticMaxGiB,
      hardwarePlatformDetail: platform.hardwarePlatformDetail,
      hardwarePlatformBadge: platform.hardwarePlatformBadge,
      domainTypeDetail: platform.domainTypeDetail,
      domainTypeBadge: platform.domainTypeBadge,
      secureBootDetail: platform.secureBootDetail,
      secureBootEnabled: platform.secureBootEnabled,
      videoRamDetail: platform.videoRamDetail,
      videoRamBadge: platform.videoRamBadge,
      igdPassthroughDetail: platform.igdPassthroughDetail,
      igdPassthroughEnabled: platform.igdPassthroughEnabled,
      vendorDeviceDetail: platform.vendorDeviceDetail,
      vendorDeviceEnabled: platform.vendorDeviceEnabled,
      affinityLabel: view?.selectedVmAffinityLabel || '',
      affinityPinned: Boolean(normalizeVmAffinityRef(vm?.affinity)),
      hasAppliance: Boolean(view?.selectedVmAppliance),
      applianceDetail: view?.selectedVmApplianceDetail || '',
      applianceVmCount: view?.selectedVmApplianceVmCount || 0,
      hasSnapshotSchedule: Boolean(view?.selectedVmSnapshotSchedule),
      snapshotScheduleDetail: view?.selectedVmSnapshotScheduleDetail || '',
      snapshotScheduleEnabled: Boolean(view?.selectedVmSnapshotScheduleEnabled),
      hasProtectionPolicy: Boolean(view?.selectedVmProtectionPolicy),
      protectionPolicyDetail: view?.selectedVmProtectionPolicyDetail || '',
      tagsSummary: typeof view?.truncateList === 'function' ? view.truncateList(vm?.tags) : '',
      tagsCount: (vm?.tags || []).length || 0,
      blockedOperationsSummary: recordSummary.blockedOperationsSummary,
      blockedOperationsCount: recordSummary.blockedOperationsCount,
      vcpusParamsSummary: compute.vcpusParamsSummary,
      vcpusParamsCount: compute.vcpusParamsCount,
      otherConfigSummary: recordSummary.otherConfigSummary,
      otherConfigCount: recordSummary.otherConfigCount,
      xenstoreDataSummary: recordSummary.xenstoreDataSummary,
      xenstoreDataCount: recordSummary.xenstoreDataCount,
      nvramDetail: recordSummary.nvramDetail,
      nvramCount: recordSummary.nvramCount,
      platformSummary: recordSummary.platformSummary,
      platformCount: recordSummary.platformCount,
    }),
    protection: buildVmProtectionModel({
      vm,
      saving: Boolean(view?.snapshotSaving),
      snapshotBusy: view?.snapshotBusy || '',
      snapshots: view?.vmSnapshots || [],
      latestSnapshot,
      formatDateTime,
    }),
    migration: buildVmMigrationModel({
      vm,
      initialDraft: view?.migrationInitialDraft || null,
      hostOptions: view?.migrationHostOptions || [],
      destinationTargets: view?.migrationTargetOptions || [],
      destinationHosts: view?.migrationDestinationHosts || [],
      destinationStorageOptions: view?.migrationDestinationStorage || [],
      destinationNetworkOptions: view?.migrationDestinationNetworks || [],
      sourceNetworkOptions: attachedNetworks,
      destinationLoading: Boolean(view?.migrationDestinationLoading),
      destinationError: view?.migrationDestinationError,
      poolMigrationCompressionEnabled: Boolean(view?.selectedVmPoolMigrationCompressionEnabled),
      activeTargetKey: view?.currentTargetKey || '',
      saving: Boolean(view?.migrationSaving),
      currentHostSummary: formatVmMigrationCurrentHostSummary(host),
      currentHostReady: Boolean(host && host.enabled),
      eligibleDestinationsSummary: formatVmMigrationEligibleDestinationsSummary(view?.migrationHostOptions),
      targetFabricsSummary: formatVmMigrationTargetFabricsSummary(view?.migrationTargetOptions),
      runtimeModeSummary: migrationRuntimeProfile.runtimeModeSummary,
      runtimeModeBadge: migrationRuntimeProfile.runtimeModeBadge,
      destinationFabricSummary: formatVmMigrationDestinationFabricSummary(
        view?.migrationDestinationTargetLabel,
        view?.migrationDestinationPools,
        view?.migrationDestinationStorage
      ),
    }),
    portability: buildVmPortabilityModel({
      vm,
      exportBusy: view?.exportBusy || '',
      attachedDisks,
      attachedNetworks,
    }),
    duplicate: buildVmDuplicateModel({
      vm,
      storageOptions: view?.relatedStorage || [],
      saving: Boolean(view?.duplicateSaving),
    }),
    devices: buildVmAddDevicesModel({
      vm,
      storageOptions: view?.relatedStorage || [],
      networkOptions: view?.relatedNetworks || [],
      diskSaving: Boolean(view?.diskSaving),
      nicSaving: Boolean(view?.nicSaving),
    }),
  };
}
