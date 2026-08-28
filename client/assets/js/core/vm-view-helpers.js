function collectVmRecordEntries(record = {}) {
  return Object.entries(record || {})
    .filter(([key, value]) => String(key || '').trim() && String(value || '').trim());
}

function summarizeVmRecordEntries(entries = [], emptyLabel = '-') {
  const normalizedEntries = Array.isArray(entries) ? entries : [];
  if (!normalizedEntries.length) return emptyLabel;

  const summary = normalizedEntries
    .slice(0, 2)
    .map(([key, value]) => `${key}=${value}`)
    .join(' · ');

  if (normalizedEntries.length <= 2) return summary;
  return `${summary} +${normalizedEntries.length - 2} more`;
}

function summarizeVmRecordMap(record, emptyLabel = '-') {
  const entries = collectVmRecordEntries(record)
    .map(([key, value]) => `${String(key).trim()}=${String(value).trim()}`);

  return entries.length ? entries.join(' · ') : emptyLabel;
}

function normalizeVmAffinityRef(value = '') {
  const normalized = String(value || '').trim();
  return normalized === 'OpaqueRef:NULL' ? '' : normalized;
}

function normalizeVmLookupValues(values = []) {
  return (Array.isArray(values) ? values : [])
    .filter(Boolean)
    .map((value) => String(value).trim().toLowerCase());
}

function normalizeVmPowerState(value = '') {
  return String(value || '').trim().toLowerCase();
}

function normalizeSelectedVmRefs(values = []) {
  return Array.isArray(values) ? values.filter(Boolean) : [];
}

function filterSelectedVmRows(vms = [], selectedRefs = []) {
  const selected = new Set(normalizeSelectedVmRefs(selectedRefs));
  return (Array.isArray(vms) ? vms : []).filter((vm) => selected.has(vm.ref));
}

function countSelectedVmStates(vms = []) {
  return (Array.isArray(vms) ? vms : []).reduce((counts, vm) => {
    const state = normalizeVmPowerState(vm?.power_state);
    if (state === 'running') counts.running += 1;
    else if (state === 'halted') counts.halted += 1;
    else if (state === 'suspended') counts.suspended += 1;
    else counts.other += 1;
    return counts;
  }, { running: 0, halted: 0, suspended: 0, other: 0 });
}

function summarizeSelectedVmStates(counts = {}) {
  const parts = [];
  if (counts.running) parts.push(`${counts.running} running`);
  if (counts.halted) parts.push(`${counts.halted} halted`);
  if (counts.suspended) parts.push(`${counts.suspended} suspended`);
  if (counts.other) parts.push(`${counts.other} other`);
  return parts.length ? parts.join(' · ') : 'No selected VM power states were recognized.';
}

function getEligibleVmBatchActionTargets(action = '', selectedVmRows = []) {
  const rows = Array.isArray(selectedVmRows) ? selectedVmRows : [];
  if (action === 'start') {
    return rows.filter((vm) => normalizeVmPowerState(vm?.power_state) === 'halted');
  }
  if (action === 'resume') {
    return rows.filter((vm) => normalizeVmPowerState(vm?.power_state) === 'suspended');
  }
  if (['shutdown', 'reboot', 'suspend'].includes(String(action || '').trim().toLowerCase())) {
    return rows.filter((vm) => normalizeVmPowerState(vm?.power_state) === 'running');
  }
  return [];
}

function filterValidSelectedVmRefs(selectedRefs = [], vms = []) {
  const validRefs = new Set((Array.isArray(vms) ? vms : []).map((vm) => vm.ref));
  return normalizeSelectedVmRefs(selectedRefs).filter((ref) => validRefs.has(ref));
}

function buildVmActionBusyKey(action = '', options = {}) {
  return `${String(action || '').trim()}${options?.force ? '-force' : ''}`;
}

function buildVmSnapshotBusyKey(action = '', snapshotRef = '') {
  return `${String(action || '').trim()}:${String(snapshotRef || '').trim()}`;
}

function getVmGovernanceActionKey(action = '') {
  return {
    shutdown: 'vm_shutdown',
    reboot: 'vm_reboot',
    suspend: 'vm_suspend',
    revert: 'vm_snapshot_revert',
    delete: 'vm_snapshot_delete',
  }[String(action || '').trim()] || '';
}

function buildVmGovernanceApprovalRequest(action = '', ref = '', vm = null, target = null) {
  const actionKey = getVmGovernanceActionKey(action);
  if (!actionKey) return null;

  return {
    actionKey,
    entityType: target ? 'vm-snapshot' : 'vm',
    entityRef: target?.ref || ref,
    entityName: target?.name_label || vm?.name_label || vm?.uuid || 'Virtual machine',
    route: '/vms',
  };
}

function buildVmActionApprovalErrorMessage() {
  return 'Governance approval is required before continuing this VM power operation.';
}

function buildVmBulkActionApprovalErrorMessage() {
  return 'Governance approval is required before continuing this bulk VM power operation.';
}

function buildVmSnapshotApprovalErrorMessage() {
  return 'Governance approval is required before continuing this snapshot action.';
}

function buildVmBatchIneligibleMessage() {
  return 'No selected VMs are currently eligible for that power action.';
}

function buildVmBatchActionFailureMessage(completed = 0, errorMessage = '') {
  const normalizedError = String(errorMessage || '').trim() || 'Unable to continue the batch action.';
  return completed
    ? `Processed ${completed} VM(s) before stopping: ${normalizedError}`
    : normalizedError;
}

function shouldRefreshSelectedVmAfterBulk(selectedVmRef = '', targets = []) {
  const normalizedRef = String(selectedVmRef || '').trim();
  if (!normalizedRef) return false;
  return (Array.isArray(targets) ? targets : []).some((vm) => String(vm?.ref || '').trim() === normalizedRef);
}

function recordMatchesVmLookupValues(record = {}, keys = [], values = []) {
  const lookupValues = new Set(normalizeVmLookupValues(values));
  if (!lookupValues.size) return false;

  return (Array.isArray(keys) ? keys : [])
    .map((key) => record?.[key])
    .filter(Boolean)
    .map((value) => String(value).trim().toLowerCase())
    .some((value) => lookupValues.has(value));
}

function findVmByFocus(vms = [], focus = null) {
  return (Array.isArray(vms) ? vms : []).find((vm) =>
    recordMatchesRouteFocus(vm, focus, ['ref', 'uuid', 'name_label'])
  ) || null;
}

function findTaskByFocus(tasks = [], focus = null) {
  return (Array.isArray(tasks) ? tasks : []).find((task) =>
    recordMatchesRouteFocus(task, focus, ['ref', 'uuid', 'name_label'])
  ) || null;
}

function findVmByTask(vms = [], task = null) {
  if (!task) return null;

  const relatedObject = String(task.related_object || '').trim();
  const relatedObjectLower = relatedObject.toLowerCase();
  const relatedClass = String(task.related_class || '').trim().toLowerCase();

  if (relatedObject && (!relatedClass || relatedClass === 'vm')) {
    const directMatch = (Array.isArray(vms) ? vms : []).find((vm) =>
      [vm.ref, vm.uuid, vm.name_label]
        .filter(Boolean)
        .map((value) => String(value).trim().toLowerCase())
        .includes(relatedObjectLower)
    );
    if (directMatch) return directMatch;
  }

  const haystack = `${task.name_label || ''} ${task.name_description || ''} ${task.workspace_summary || ''} ${task.related_alert_summary || ''}`.toLowerCase();
  return (Array.isArray(vms) ? vms : []).find((vm) => {
    const label = String(vm.name_label || '').trim().toLowerCase();
    return Boolean(label) && haystack.includes(label);
  }) || null;
}

function isRemediationTask(task = null) {
  return String(task?.task_kind || '').toLowerCase() === 'remediation'
    || String(task?.source || '').toLowerCase() === 'remediation';
}

function isVmPlatformFlagEnabled(value = '') {
  return ['1', 'true', 'enabled', 'on', 'yes', 'required'].includes(String(value || '').trim().toLowerCase());
}

function toVmRoundedGiB(value = 0) {
  return Math.max(0, Math.round(Number(value || 0) / (1024 ** 3)) || 0);
}

function normalizeVmSnapshotRecord(entry = {}) {
  return {
    ...entry,
    snapshot_mode: entry.snapshot_mode === 'checkpoint' ? 'checkpoint' : 'snapshot',
    snapshot_time: entry.snapshot_time || entry.snapshotTime || '',
  };
}

function normalizeVmConsoleRecord(entry = {}) {
  const protocol = String(entry.protocol || '').trim().toLowerCase();
  return {
    ...entry,
    protocol,
    protocolLabel: protocol === 'rfb'
      ? 'Remote Frame Buffer Console'
      : protocol === 'rdp'
        ? 'Remote Desktop Console'
        : 'Remote Console',
    launchUrl: entry.launchUrl || entry.launchPath || '',
  };
}

function findSelectedVmHost(vm, hosts = []) {
  if (!vm) return null;

  const refs = [vm.resident_on, normalizeVmAffinityRef(vm.affinity)];
  return (Array.isArray(hosts) ? hosts : []).find((host) =>
    recordMatchesVmLookupValues(host, ['ref', 'uuid', 'name_label', 'hostname'], refs)
  ) || null;
}

function findSelectedVmAffinityHost(vm, hosts = []) {
  const affinityRef = normalizeVmAffinityRef(vm?.affinity);
  if (!affinityRef) return null;

  return (Array.isArray(hosts) ? hosts : []).find((host) => String(host?.ref || '').trim() === affinityRef) || null;
}

function formatSelectedVmAffinityLabel(vm, affinityHost) {
  const affinityRef = normalizeVmAffinityRef(vm?.affinity);
  if (!affinityRef) return 'Automatic / no preference';
  return affinityHost
    ? `${affinityHost.name_label || affinityHost.address || affinityHost.ref} (${affinityRef})`
    : affinityRef;
}

function resolveSelectedVmLinkedRecord(referenceValue, records = []) {
  const normalizedRef = String(referenceValue || '').trim();
  if (!normalizedRef || normalizedRef === 'OpaqueRef:NULL') return null;

  return (Array.isArray(records) ? records : []).find((record) => String(record?.ref || '').trim() === normalizedRef) || {
    ref: normalizedRef,
    name_label: normalizedRef,
    VMs: [],
  };
}

function countVmLinkedRecordMembers(record) {
  return Array.isArray(record?.VMs) ? record.VMs.length : 0;
}

function summarizeVmLinkedRecord(record, emptyLabel = 'None') {
  return record?.name_label || record?.uuid || record?.ref || emptyLabel;
}

function formatSelectedVmApplianceDetail(record) {
  if (!record) {
    return 'No VM appliance grouping is pinned for this workload.';
  }

  const label = summarizeVmLinkedRecord(record, 'None');
  const count = countVmLinkedRecordMembers(record);
  return `${label} coordinates grouped startup and shutdown sequencing across ${count} VM${count === 1 ? '' : 's'} in this appliance.`;
}

function isVmLinkedRecordEnabled(record) {
  return Boolean(record?.enabled);
}

function formatSelectedVmSnapshotScheduleDetail(record) {
  if (!record) {
    return 'No automatic snapshot schedule is pinned for this workload.';
  }

  const summary = summarizeVmLinkedRecord(record, 'None');
  const enabled = isVmLinkedRecordEnabled(record);
  const vmCount = countVmLinkedRecordMembers(record);
  const cadence = String(record.frequency || 'custom').replace(/_/g, ' ');
  const retainedSnapshots = Math.max(0, Number(record.retained_snapshots || 0) || 0);
  const timeWindowParts = [];
  if (record.schedule?.hour !== undefined || record.schedule?.min !== undefined) {
    const hour = String(record.schedule?.hour ?? '00').padStart(2, '0');
    const minute = String(record.schedule?.min ?? '00').padStart(2, '0');
    timeWindowParts.push(`${hour}:${minute} local`);
  }
  if (String(record.schedule?.days || '').trim()) {
    timeWindowParts.push(`days ${record.schedule.days}`);
  }
  const timeWindow = timeWindowParts.length ? ` Window ${timeWindowParts.join(' · ')}.` : '';
  return `${summary} is ${enabled ? 'enabled' : 'disabled'} on a ${cadence} cadence, retains ${retainedSnapshots} snapshot${retainedSnapshots === 1 ? '' : 's'}, and currently covers ${vmCount} VM${vmCount === 1 ? '' : 's'}.${timeWindow}`;
}

function resolveSelectedVmProtectionPolicy(vm) {
  const protectionPolicyRef = String(vm?.protection_policy || '').trim();
  if (!protectionPolicyRef || protectionPolicyRef === 'OpaqueRef:NULL') return '';
  return protectionPolicyRef;
}

function formatSelectedVmProtectionPolicyDetail(policyRef) {
  if (!policyRef) {
    return 'No legacy VMPP protection policy reference is reported for this workload.';
  }
  return `${policyRef} is a legacy VMPP reference. Upstream XAPI deprecated VMPP in XenServer 6.2 and marked the class removed in XenServer 6.2, so XenMange surfaces this field as read-only guidance instead of an editable policy assignment.`;
}

function poolContainsHostRecord(pool, host) {
  if (!pool || !host) return false;

  const poolRefs = new Set(
    [
      pool.master,
      ...(Array.isArray(pool.hosts) ? pool.hosts : []),
      ...(Array.isArray(pool.resident_hosts) ? pool.resident_hosts : []),
      ...(Array.isArray(pool.slaves) ? pool.slaves : []),
    ].filter(Boolean)
  );

  return poolRefs.has(host.ref) || poolRefs.has(host.uuid);
}

function findSelectedVmPool(host, pools = []) {
  const normalizedPools = Array.isArray(pools) ? pools : [];

  if (host) {
    const hostPoolKeys = normalizeVmLookupValues([host.pool, host.pool_ref, host.pool_uuid, host.pool_name]);

    if (hostPoolKeys.length) {
      const directPool = normalizedPools.find((pool) =>
        recordMatchesVmLookupValues(pool, ['ref', 'uuid', 'name_label'], hostPoolKeys)
      );
      if (directPool) return directPool;
    }

    const relatedPool = normalizedPools.find((pool) => poolContainsHostRecord(pool, host));
    if (relatedPool) return relatedPool;
  }

  if (normalizedPools.length === 1) return normalizedPools[0];
  return null;
}

function buildAttachedVmDisks(vm, relatedVdis = [], relatedStorage = []) {
  if (!vm) return [];

  const vbdRefs = new Set(Array.isArray(vm.VBDs) ? vm.VBDs : []);
  return (Array.isArray(relatedVdis) ? relatedVdis : [])
    .filter((vdi) => Array.isArray(vdi.VBDs) && vdi.VBDs.some((ref) => vbdRefs.has(ref)))
    .map((vdi) => ({
      ...vdi,
      storageName: (Array.isArray(relatedStorage) ? relatedStorage : []).find((sr) => sr.ref === vdi.SR)?.name_label || vdi.SR || '-',
    }));
}

function buildAttachedVmNetworks(vm, relatedNetworks = []) {
  if (!vm) return [];

  const vifRefs = new Set(Array.isArray(vm.VIFs) ? vm.VIFs : []);
  return (Array.isArray(relatedNetworks) ? relatedNetworks : [])
    .filter((network) => Array.isArray(network.VIFs) && network.VIFs.some((ref) => vifRefs.has(ref)))
    .map((network) => ({
      ...network,
      vlan: (network.other_config || {}).vlan || '-',
    }));
}

function hostBelongsToVmPool(host, pool) {
  if (!host) return false;
  if (!pool) return true;

  const directMatches = normalizeVmLookupValues([
    host.pool,
    host.pool_ref,
    host.pool_uuid,
    host.pool_name,
  ]);
  const poolKeys = normalizeVmLookupValues([pool.ref, pool.uuid, pool.name_label]);

  if (directMatches.some((value) => poolKeys.includes(value))) {
    return true;
  }

  return poolContainsHostRecord(pool, host);
}

function compareVmHostOptions(left = {}, right = {}, preferredRef = '') {
  const normalizedPreferredRef = String(preferredRef || '').trim();
  const leftPreferred = normalizedPreferredRef && left.ref === normalizedPreferredRef;
  const rightPreferred = normalizedPreferredRef && right.ref === normalizedPreferredRef;

  if (leftPreferred !== rightPreferred) {
    return leftPreferred ? -1 : 1;
  }
  if (Boolean(left.enabled) !== Boolean(right.enabled)) {
    return left.enabled ? -1 : 1;
  }
  return String(left.name_label || left.address || left.ref).localeCompare(String(right.name_label || right.address || right.ref));
}

function buildSelectedVmMigrationHostOptions({ vm, selectedVmHost = null, selectedVmPool = null, hosts = [] }) {
  const currentHostRef = selectedVmHost?.ref || vm?.resident_on || normalizeVmAffinityRef(vm?.affinity) || '';
  return (Array.isArray(hosts) ? hosts : [])
    .filter((host) => host.ref !== currentHostRef)
    .filter((host) => hostBelongsToVmPool(host, selectedVmPool))
    .sort((left, right) => compareVmHostOptions(left, right));
}

function buildSelectedVmConfigHostOptions({ vm, selectedVmPool = null, hosts = [] }) {
  const affinityRef = normalizeVmAffinityRef(vm?.affinity);
  return (Array.isArray(hosts) ? hosts : [])
    .filter((host) => hostBelongsToVmPool(host, selectedVmPool))
    .sort((left, right) => compareVmHostOptions(left, right, affinityRef));
}

function resolveVmPoolMigrationCompressionEnabled(pool) {
  if (typeof pool?.migration_compression === 'boolean') {
    return pool.migration_compression;
  }
  return true;
}

function normalizeVmCompatibilityHosts(compatibility = null) {
  return Array.isArray(compatibility?.hosts) ? compatibility.hosts : [];
}

function countCompatibleVmHosts(hosts = []) {
  return (Array.isArray(hosts) ? hosts : []).filter((host) => host.compatible).length;
}

function buildVmCompatibilityFlagRows(compatibility = null, limit = 18) {
  return Object.entries(compatibility?.lastBootCpuFlags || {})
    .map(([key, value]) => ({ key, value: String(value) }))
    .slice(0, limit);
}

function findPrimaryVmConsole(consoles = []) {
  return (Array.isArray(consoles) ? consoles : [])[0] || null;
}

function resolveSelectedVmGuestMetricsRecord(vm) {
  return vm?.guest_metrics_record && typeof vm.guest_metrics_record === 'object'
    ? vm.guest_metrics_record
    : null;
}

function buildSelectedVmGuestMetricsProfile(vm, formatDateTime) {
  const record = resolveSelectedVmGuestMetricsRecord(vm);
  const live = record?.live === true;
  const heartbeatSummary = !record
    ? 'No guest heartbeat details were reported'
    : (live ? 'Guest heartbeat detected' : 'Guest heartbeat not reported as live');
  const updatedSummary = record?.last_updated
    ? `updated ${formatDateTime(record.last_updated)}`
    : 'last update unavailable';
  const osSummary = summarizeVmRecordMap(record?.os_version, 'No guest OS identity was reported.');
  const versionSummary = summarizeVmRecordMap(record?.PV_drivers_version, '');
  const detected = record?.PV_drivers_detected === true ? 'Detected' : 'Not detected';
  const pvDriversSummary = versionSummary
    ? `${detected} · ${versionSummary}`
    : (record ? detected : 'No guest PV driver details were reported.');
  const networksSummary = summarizeVmRecordMap(record?.networks, 'No guest network addresses were reported.');

  return {
    record,
    live,
    heartbeatSummary,
    updatedSummary,
    osSummary,
    pvDriversSummary,
    networksSummary,
    summary: record
      ? `${heartbeatSummary} · ${osSummary}`
      : 'No guest runtime metrics were reported.',
  };
}

function buildSelectedVmRecommendationsProfile(vm) {
  const body = String(vm?.recommendations || '').trim();
  return {
    body: body || 'No VM recommendations XML was reported for this workload.',
    summary: body ? 'XML recommendations available' : 'No VM recommendations XML was reported.',
  };
}

function buildSelectedVmComputeProfile(vm) {
  const vcpusParamsEntries = collectVmRecordEntries(vm?.VCPUs_params || {});
  const vcpuAtStartup = Math.max(0, Number(vm?.VCPUs_at_startup || 0) || 0);
  const vcpuMax = Math.max(vcpuAtStartup, Number(vm?.VCPUs_max || vm?.VCPUs_at_startup || 0) || 0);
  const memoryStaticMinGiB = toVmRoundedGiB(vm?.memory_static_min || vm?.memory_static_max || 0);
  const memoryDynamicMinGiB = toVmRoundedGiB(
    vm?.memory_dynamic_min
    || vm?.memory_static_min
    || vm?.memory_dynamic_max
    || vm?.memory_static_max
    || 0
  );
  const memoryDynamicMaxGiB = toVmRoundedGiB(vm?.memory_dynamic_max || vm?.memory_static_max || 0);
  const memoryStaticMaxGiB = toVmRoundedGiB(vm?.memory_static_max || vm?.memory_dynamic_max || 0);

  return {
    vcpusParamsEntries,
    vcpusParamsCount: vcpusParamsEntries.length,
    vcpuAtStartup,
    vcpuMax,
    vcpuSummary: !vcpuMax
      ? '0 vCPU'
      : (vcpuAtStartup === vcpuMax ? `${vcpuAtStartup} vCPU` : `${vcpuAtStartup}/${vcpuMax} vCPU`),
    vcpuDetail: !vcpuMax
      ? '0 startup vCPU'
      : (vcpuAtStartup === vcpuMax ? `${vcpuAtStartup} startup vCPU` : `${vcpuAtStartup} startup vCPU · ${vcpuMax} max vCPU`),
    vcpusParamsSummary: vcpusParamsEntries.length ? summarizeVmRecordEntries(vcpusParamsEntries) : '-',
    memoryStaticMinGiB,
    memoryDynamicMinGiB,
    memoryDynamicMaxGiB,
    memoryStaticMaxGiB,
  };
}

function resolveSelectedVmDomainTypeValue(vm) {
  const explicit = String(vm?.domain_type || '').trim().toLowerCase();
  if (explicit) return explicit;
  if (String(vm?.HVM_boot_policy || '').trim()) return 'hvm';
  if (String(vm?.PV_bootloader || vm?.PV_kernel || '').trim()) return 'pv';
  return 'unspecified';
}

function buildSelectedVmPlatformProfile(vm) {
  const hardwarePlatformVersion = Math.max(0, Number(vm?.hardware_platform_version || 0) || 0);
  const domainTypeValue = resolveSelectedVmDomainTypeValue(vm);
  const domainTypeSummary = {
    unspecified: 'Automatic / Unspecified',
    hvm: 'HVM',
    pv: 'PV',
    pvh: 'PVH',
    pv_in_pvh: 'PV in PVH',
  }[domainTypeValue] || 'Automatic / Unspecified';
  const secureBootEnabled = isVmPlatformFlagEnabled(vm?.platform?.secureboot || '');
  const videoRamMiB = (() => {
    const normalized = Number(vm?.platform?.videoram || 0);
    if (!Number.isFinite(normalized)) return 0;
    return Math.max(0, Math.round(normalized));
  })();
  const igdPassthroughEnabled = isVmPlatformFlagEnabled(vm?.platform?.igd_passthrough || '');
  const vendorDeviceEnabled = Boolean(vm?.has_vendor_device);

  return {
    hardwarePlatformVersion,
    hardwarePlatformSummary: hardwarePlatformVersion ? `v${hardwarePlatformVersion}` : 'Auto / default',
    hardwarePlatformDetail: hardwarePlatformVersion
      ? `Pinned to virtual hardware platform version ${hardwarePlatformVersion} for host compatibility checks.`
      : 'No explicit virtual hardware platform override is pinned for this workload.',
    hardwarePlatformBadge: hardwarePlatformVersion ? `v${hardwarePlatformVersion}` : 'auto',
    domainTypeValue,
    domainTypeSummary,
    domainTypeDetail: `${domainTypeSummary} takes effect on the next VM boot and supersedes legacy HVM boot-policy tuning.`,
    domainTypeBadge: domainTypeValue === 'unspecified' ? 'auto' : domainTypeSummary,
    secureBootEnabled,
    secureBootSummary: secureBootEnabled ? 'Enabled' : 'Disabled',
    secureBootDetail: secureBootEnabled
      ? 'Secure Boot is enabled for platform-mediated guest boot validation.'
      : 'Secure Boot is disabled for this workload platform profile.',
    videoRamMiB,
    videoRamSummary: videoRamMiB ? `${videoRamMiB} MiB` : 'Auto / default',
    videoRamDetail: videoRamMiB
      ? `Pinned to ${videoRamMiB} MiB of virtual display memory for the guest graphics adapter on the next VM boot.`
      : 'No explicit virtual display memory override is pinned for this workload.',
    videoRamBadge: videoRamMiB ? `${videoRamMiB} MiB` : 'auto',
    igdPassthroughEnabled,
    igdPassthroughSummary: igdPassthroughEnabled ? 'Enabled' : 'Disabled',
    igdPassthroughDetail: igdPassthroughEnabled
      ? 'The Intel integrated graphics passthrough hint is enabled for the next VM boot and requires compatible host GPU support.'
      : 'The Intel integrated graphics passthrough hint is disabled for this workload platform profile.',
    vendorDeviceEnabled,
    vendorDeviceSummary: vendorDeviceEnabled ? 'Enabled' : 'Disabled',
    vendorDeviceDetail: vendorDeviceEnabled
      ? 'The HVM vendor-device PCI hint is enabled for Windows PV-driver discovery on next boot.'
      : 'The HVM vendor-device PCI hint is disabled for this workload profile.',
  };
}

function buildSelectedVmRecordSummaryProfile(vm) {
  const blockedOperationsEntries = collectVmRecordEntries(vm?.blocked_operations || {});
  const otherConfigEntries = collectVmRecordEntries(vm?.other_config || {});
  const xenstoreDataEntries = collectVmRecordEntries(vm?.xenstore_data || {});
  const nvramEntries = collectVmRecordEntries(vm?.NVRAM || {});
  const platformEntries = collectVmRecordEntries(vm?.platform || {});

  const nvramSummary = nvramEntries.length ? summarizeVmRecordEntries(nvramEntries) : '-';

  return {
    blockedOperationsEntries,
    blockedOperationsCount: blockedOperationsEntries.length,
    blockedOperationsSummary: blockedOperationsEntries.length ? summarizeVmRecordEntries(blockedOperationsEntries) : '-',
    otherConfigEntries,
    otherConfigCount: otherConfigEntries.length,
    otherConfigSummary: otherConfigEntries.length ? summarizeVmRecordEntries(otherConfigEntries) : '-',
    xenstoreDataEntries,
    xenstoreDataCount: xenstoreDataEntries.length,
    xenstoreDataSummary: xenstoreDataEntries.length ? summarizeVmRecordEntries(xenstoreDataEntries) : '-',
    nvramEntries,
    nvramCount: nvramEntries.length,
    nvramSummary,
    nvramDetail: nvramEntries.length
      ? `${nvramSummary} Xen only applies NVRAM updates while the VM is halted.`
      : 'No explicit guest NVRAM overrides are pinned for this workload.',
    platformEntries,
    platformCount: platformEntries.length,
    platformSummary: platformEntries.length ? summarizeVmRecordEntries(platformEntries) : '-',
  };
}

function buildVmOverviewCards({
  host,
  pool,
  attachedDisks = [],
  attachedNetworks = [],
  domainTypeSummary = '',
  secureBootSummary = '',
  vendorDeviceSummary = '',
  formatBytes,
}) {
  const disks = Array.isArray(attachedDisks) ? attachedDisks : [];
  const networks = Array.isArray(attachedNetworks) ? attachedNetworks : [];
  return [
    {
      key: 'placement',
      label: 'Placement',
      value: host ? (host.name_label || 'Host') : 'Pending',
      detail: pool ? `Pool ${pool.name_label || pool.uuid || pool.ref}` : 'No pool relationship mapped',
      valueClass: host ? 'text-green' : 'text-amber',
    },
    {
      key: 'storage',
      label: 'Attached Disks',
      value: String(disks.length),
      detail: disks.length ? `${formatBytes(disks.reduce((sum, disk) => sum + Number(disk.virtual_size || 0), 0))} total capacity mapped` : 'No disk mappings discovered',
      valueClass: disks.length ? 'text-cyan' : '',
    },
    {
      key: 'networks',
      label: 'Network Paths',
      value: String(networks.length),
      detail: networks.length ? networks.map((network) => network.name_label || network.bridge).join(', ') : 'No NIC mappings discovered',
      valueClass: networks.length ? 'text-green' : '',
    },
    {
      key: 'boot',
      label: 'Boot Profile',
      value: domainTypeSummary,
      detail: `${secureBootSummary} secure boot · ${vendorDeviceSummary} vendor device`,
      valueClass: 'text-amber',
    },
  ];
}

function buildVmConsoleModel({ vm, consoles = [], primaryConsole = null }) {
  if (!vm) return null;

  return {
    consoles,
    preferredSessionSummary: primaryConsole
      ? `${primaryConsole.protocolLabel} via ${primaryConsole.protocol || 'unknown'} transport`
      : 'No preferred console session is currently available.',
  };
}

function buildVmOverviewModel({
  vm,
  host,
  pool,
  hardwarePlatformSummary,
  domainTypeSummary,
  secureBootSummary,
  videoRamSummary,
  igdPassthroughSummary,
  vendorDeviceSummary,
  memoryStaticMinFormatted,
  memoryDynamicMinFormatted,
  memoryDynamicMaxFormatted,
  memoryStaticMaxFormatted,
  affinityLabel,
  applianceSummary,
  snapshotScheduleSummary,
  protectionPolicySummary,
  guestMetricsSummary,
  recommendationsSummary,
  tagsSummary,
  blockedOperationsSummary,
  vcpusParamsSummary,
  otherConfigSummary,
  xenstoreDataSummary,
  nvramSummary,
  platformSummary,
  overviewCards,
  guestMetricsHeartbeatSummary,
  guestMetricsUpdatedSummary,
  guestMetricsLive,
  guestOsSummary,
  guestPvDriversSummary,
  guestNetworksSummary,
  recommendationsBody,
  memoryUsageSeries,
  memoryUsageStatus,
  cpuUsageSeries,
  cpuUsageStatus,
  networkThroughputSeries,
  diskThroughputSeries,
}) {
  if (!vm) return null;

  return {
    vm,
    host,
    pool,
    hardwarePlatformSummary,
    domainTypeSummary,
    secureBootSummary,
    videoRamSummary,
    igdPassthroughSummary,
    vendorDeviceSummary,
    memoryStaticMinFormatted,
    memoryDynamicMinFormatted,
    memoryDynamicMaxFormatted,
    memoryStaticMaxFormatted,
    affinityLabel,
    applianceSummary,
    snapshotScheduleSummary,
    protectionPolicySummary,
    guestMetricsSummary,
    recommendationsSummary,
    tagsSummary,
    blockedOperationsSummary,
    vcpusParamsSummary,
    otherConfigSummary,
    xenstoreDataSummary,
    nvramSummary,
    platformSummary,
    overviewCards,
    guestMetricsHeartbeatSummary,
    guestMetricsUpdatedSummary,
    guestMetricsLive,
    guestOsSummary,
    guestPvDriversSummary,
    guestNetworksSummary,
    recommendationsBody,
    memoryUsageSeries,
    memoryUsageStatus,
    cpuUsageSeries,
    cpuUsageStatus,
    networkThroughputSeries,
    diskThroughputSeries,
  };
}

function buildVmResourcesModel({ vm, host, pool, attachedDisks = [], attachedNetworks = [], diskColumns = [], networkColumns = [] }) {
  if (!vm) return null;

  return {
    host,
    pool,
    attachedDisks,
    attachedNetworks,
    diskColumns,
    networkColumns,
  };
}

function buildVmCompatibilityModel({ vm, hosts = [], compatibleHostCount = 0, hardwarePlatformVersion = 0, flagRows = [], flagCount = 0, currentHostCpuModel = '', columns = [] }) {
  if (!vm) return null;

  return {
    hosts,
    compatibleHostCount,
    hardwarePlatformVersion,
    flagRows,
    flagCount,
    currentHostCpuModel,
    columns,
  };
}

function buildVmConfigModel({
  vm,
  hostOptions = [],
  applianceOptions = [],
  snapshotScheduleOptions = [],
  saving = false,
  vcpuDetail = '',
  memoryStaticMinGiB = 0,
  memoryDynamicMinGiB = 0,
  memoryDynamicMaxGiB = 0,
  memoryStaticMaxGiB = 0,
  hardwarePlatformDetail = '',
  hardwarePlatformBadge = '',
  domainTypeDetail = '',
  domainTypeBadge = '',
  secureBootDetail = '',
  secureBootEnabled = false,
  videoRamDetail = '',
  videoRamBadge = '',
  igdPassthroughDetail = '',
  igdPassthroughEnabled = false,
  vendorDeviceDetail = '',
  vendorDeviceEnabled = false,
  affinityLabel = '',
  affinityPinned = false,
  hasAppliance = false,
  applianceDetail = '',
  applianceVmCount = 0,
  hasSnapshotSchedule = false,
  snapshotScheduleDetail = '',
  snapshotScheduleEnabled = false,
  hasProtectionPolicy = false,
  protectionPolicyDetail = '',
  tagsSummary = '',
  tagsCount = 0,
  blockedOperationsSummary = '',
  blockedOperationsCount = 0,
  vcpusParamsSummary = '',
  vcpusParamsCount = 0,
  otherConfigSummary = '',
  otherConfigCount = 0,
  xenstoreDataSummary = '',
  xenstoreDataCount = 0,
  nvramDetail = '',
  nvramCount = 0,
  platformSummary = '',
  platformCount = 0,
}) {
  if (!vm) return null;

  return {
    vm,
    hostOptions,
    applianceOptions,
    snapshotScheduleOptions,
    saving,
    vcpuDetail,
    memoryStaticMinGiB,
    memoryDynamicMinGiB,
    memoryDynamicMaxGiB,
    memoryStaticMaxGiB,
    hardwarePlatformDetail,
    hardwarePlatformBadge,
    domainTypeDetail,
    domainTypeBadge,
    secureBootDetail,
    secureBootEnabled,
    videoRamDetail,
    videoRamBadge,
    igdPassthroughDetail,
    igdPassthroughEnabled,
    vendorDeviceDetail,
    vendorDeviceEnabled,
    affinityLabel,
    affinityPinned,
    hasAppliance,
    applianceDetail,
    applianceVmCount,
    hasSnapshotSchedule,
    snapshotScheduleDetail,
    snapshotScheduleEnabled,
    hasProtectionPolicy,
    protectionPolicyDetail,
    tagsSummary,
    tagsCount,
    blockedOperationsSummary,
    blockedOperationsCount,
    vcpusParamsSummary,
    vcpusParamsCount,
    otherConfigSummary,
    otherConfigCount,
    xenstoreDataSummary,
    xenstoreDataCount,
    nvramDetail,
    nvramCount,
    platformSummary,
    platformCount,
  };
}

function buildVmProtectionModel({ vm, saving = false, snapshotBusy = '', snapshots = [], latestSnapshot = null, formatDateTime }) {
  if (!vm) return null;

  const normalizedSnapshots = Array.isArray(snapshots) ? snapshots : [];
  return {
    saving,
    snapshotBusy: Boolean(snapshotBusy),
    snapshotCount: normalizedSnapshots.length,
    hasLatestSnapshot: Boolean(latestSnapshot),
    latestSnapshotSummary: latestSnapshot
      ? `Latest ${formatDateTime(latestSnapshot.snapshot_time)}`
      : 'No VM snapshots or checkpoints have been captured yet.',
    latestSnapshotMode: latestSnapshot ? (latestSnapshot.snapshot_mode || 'snapshot') : 'empty',
    snapshotRows: normalizedSnapshots.map((snapshot) => ({
      raw: snapshot,
      ref: snapshot.ref,
      nameLabel: snapshot.name_label || snapshot.ref,
      timestampLabel: formatDateTime(snapshot.snapshot_time),
      description: snapshot.name_description || 'No operator note was recorded for this restore point.',
      modeLabel: snapshot.snapshot_mode === 'checkpoint' ? 'checkpoint' : 'snapshot',
      modeClass: snapshot.snapshot_mode === 'checkpoint' ? 'badge-warning' : 'badge-info',
      revertLabel: snapshotBusy === `revert:${snapshot.ref}` ? 'Reverting...' : 'Revert',
      deleteLabel: snapshotBusy === `delete:${snapshot.ref}` ? 'Deleting...' : 'Delete',
    })),
  };
}

function buildVmMigrationModel({
  vm,
  initialDraft = null,
  hostOptions = [],
  destinationTargets = [],
  destinationHosts = [],
  destinationStorageOptions = [],
  destinationNetworkOptions = [],
  sourceNetworkOptions = [],
  destinationLoading = false,
  destinationError = null,
  poolMigrationCompressionEnabled = true,
  activeTargetKey = '',
  saving = false,
  currentHostSummary = '',
  currentHostReady = false,
  eligibleDestinationsSummary = '',
  targetFabricsSummary = '',
  runtimeModeSummary = '',
  runtimeModeBadge = '',
  destinationFabricSummary = '',
}) {
  if (!vm) return null;

  return {
    vm,
    initialDraft,
    hostOptions,
    destinationTargets,
    destinationHosts,
    destinationStorageOptions,
    destinationNetworkOptions,
    sourceNetworkOptions,
    destinationLoading,
    destinationError,
    poolMigrationCompressionEnabled,
    activeTargetKey,
    saving,
    currentHostSummary,
    currentHostReady,
    eligibleDestinationsSummary,
    targetFabricsSummary,
    runtimeModeSummary,
    runtimeModeBadge,
    destinationFabricSummary,
  };
}

function buildVmPortabilityModel({ vm, exportBusy = '', attachedDisks = [], attachedNetworks = [] }) {
  if (!vm) return null;

  const disks = Array.isArray(attachedDisks) ? attachedDisks : [];
  const networks = Array.isArray(attachedNetworks) ? attachedNetworks : [];
  return {
    exportBusy: Boolean(exportBusy),
    fullExportLabel: exportBusy === 'full' ? 'Exporting...' : 'Export Full XVA',
    metadataExportLabel: exportBusy === 'metadata' ? 'Exporting...' : 'Export Metadata',
    attachedResourcesSummary: `${disks.length} disk${disks.length === 1 ? '' : 's'} · ${networks.length} network path${networks.length === 1 ? '' : 's'} mapped for this workload.`,
  };
}

function buildVmDuplicateModel({ vm, storageOptions = [], saving = false }) {
  if (!vm) return null;

  const sourceReady = vm.power_state === 'Halted';
  return {
    vm,
    storageOptions,
    saving,
    sourceReady,
    sourceReadyBadge: sourceReady ? 'ready' : (vm.power_state || 'state'),
  };
}

function buildVmAddDevicesModel({ vm, storageOptions = [], networkOptions = [], diskSaving = false, nicSaving = false }) {
  if (!vm) return null;

  return {
    storageOptions,
    networkOptions,
    diskSaving,
    nicSaving,
  };
}
