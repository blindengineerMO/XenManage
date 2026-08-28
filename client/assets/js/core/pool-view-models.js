function buildPoolVisibilityLabel(visibility = '') {
  return visibility === 'shared' ? 'Shared' : 'Private';
}

function buildPoolOwnershipLabel(connection = null) {
  if (connection?.is_owner) return 'Owned by you';
  return `Owner ${connection?.owner_display_name || connection?.owner_username}`;
}

function findPoolAttachedTarget(attachedTargets = [], connection = null) {
  const connectionId = Number(connection?.id || 0);
  return (Array.isArray(attachedTargets) ? attachedTargets : []).find((target) =>
    (connectionId && Number(target.connectionId || 0) === connectionId)
    || (
      String(target.host || '').toLowerCase() === String(connection?.host || '').toLowerCase()
      && String(target.username || '').toLowerCase() === String(connection?.username || '').toLowerCase()
    )
  ) || null;
}

function isPoolConnectionAttached(attachedTargets = [], connection = null) {
  return Boolean(findPoolAttachedTarget(attachedTargets, connection));
}

function isPoolCurrentConnection(attachedTargets = [], connection = null) {
  return Boolean(findPoolAttachedTarget(attachedTargets, connection)?.active);
}

function buildPreferredPoolConnection(connections = []) {
  const list = Array.isArray(connections) ? connections : [];
  return list.find((connection) => connection.is_default) || list[0] || null;
}

function isPoolMasterHost(host = null, pool = null) {
  return Boolean(host && pool && pool.master && host.ref === pool.master);
}

function resolvePoolHosts(pool = null, hosts = [], pools = []) {
  if (!pool) return [];

  const poolRefs = new Set(
    [
      pool.master,
      ...(Array.isArray(pool.hosts) ? pool.hosts : []),
      ...(Array.isArray(pool.resident_hosts) ? pool.resident_hosts : []),
      ...(Array.isArray(pool.slaves) ? pool.slaves : []),
    ].filter(Boolean)
  );

  let matches = (Array.isArray(hosts) ? hosts : []).filter((host) =>
    poolRefs.has(host.ref) || poolRefs.has(host.uuid)
  );

  if (!matches.length) {
    const poolKeys = [pool.ref, pool.uuid, pool.name_label]
      .filter(Boolean)
      .map((value) => String(value).toLowerCase());

    matches = (Array.isArray(hosts) ? hosts : []).filter((host) => {
      const hostKeys = [host.pool, host.pool_ref, host.pool_uuid, host.pool_name]
        .filter(Boolean)
        .map((value) => String(value).toLowerCase());

      return hostKeys.some((value) => poolKeys.includes(value));
    });
  }

  if (!matches.length && Array.isArray(pools) && pools.length === 1 && pools[0].ref === pool.ref) {
    return Array.isArray(hosts) ? hosts : [];
  }

  return matches;
}

function buildSelectedPoolHosts(selectedPool = null, hosts = [], pools = []) {
  if (!selectedPool) return [];

  return resolvePoolHosts(selectedPool, hosts, pools).map((host) => ({
    ...host,
    role: isPoolMasterHost(host, selectedPool) ? 'Master' : 'Member',
    residentVmCount: Array.isArray(host.resident_VMs) ? host.resident_VMs.length : 0,
  }));
}

function resolvePoolStorageLabel(storage = [], ref = '') {
  const normalizedRef = String(ref || '').trim();
  if (!normalizedRef) return 'not configured';

  const match = (Array.isArray(storage) ? storage : []).find((entry) => entry.ref === normalizedRef) || null;
  if (!match) return normalizedRef;
  return match.name_label || match.uuid || match.ref;
}

function buildSelectedPoolStorageOptions(selectedPool = null, selectedPoolHosts = [], storage = []) {
  if (!selectedPool) return [];

  const poolPbdRefs = new Set(
    (Array.isArray(selectedPoolHosts) ? selectedPoolHosts : [])
      .flatMap((host) => (Array.isArray(host.PBDs) ? host.PBDs : []))
      .filter(Boolean)
  );
  const options = (Array.isArray(storage) ? storage : [])
    .filter((sr) => {
      if (!poolPbdRefs.size) return sr.ref === selectedPool.default_SR;
      return (Array.isArray(sr.PBDs) ? sr.PBDs : []).some((ref) => poolPbdRefs.has(ref));
    })
    .map((sr) => ({
      value: sr.ref,
      label: `${sr.name_label || sr.uuid || sr.ref}${sr.shared ? ' · shared' : ''}`,
    }))
    .sort((left, right) => left.label.localeCompare(right.label));

  if (selectedPool.default_SR && !options.some((entry) => entry.value === selectedPool.default_SR)) {
    options.unshift({
      value: selectedPool.default_SR,
      label: `${resolvePoolStorageLabel(storage, selectedPool.default_SR)} · current`,
    });
  }

  return options;
}

function buildSelectedPoolMigrationCompressionLabel(selectedPool = null) {
  return selectedPool?.migration_compression ? 'Enabled' : 'Disabled';
}

function buildSelectedPoolMigrationCompressionDetail(selectedPool = null) {
  return selectedPool?.migration_compression
    ? 'Same-pool migration workflows default to a compressed transfer stream for this pool.'
    : 'Same-pool migration workflows default to an uncompressed transfer stream for this pool.';
}

function buildSelectedPoolWlbEnabledLabel(selectedPool = null) {
  return selectedPool?.wlb_enabled ? 'Enabled' : 'Disabled';
}

function buildSelectedPoolWlbUrlLabel(selectedPool = null) {
  return String(selectedPool?.wlb_url || '').trim() || 'not configured';
}

function buildSelectedPoolWlbDetail(selectedPool = null) {
  const endpoint = buildSelectedPoolWlbUrlLabel(selectedPool);
  return selectedPool?.wlb_enabled
    ? `Workload balancing is enabled${endpoint !== 'not configured' ? ` via ${endpoint}` : ', but no endpoint URL was reported in the current pool record.'}`
    : `Workload balancing is disabled${endpoint !== 'not configured' ? `; current endpoint ${endpoint}` : ' and no WLB endpoint URL is currently reported.'}`;
}

function buildSelectedPoolVswitchControllerLabel(selectedPool = null) {
  return String(selectedPool?.vswitch_controller || '').trim() || 'not configured';
}

function isSelectedPoolVswitchControllerConfigured(selectedPool = null) {
  return buildSelectedPoolVswitchControllerLabel(selectedPool) !== 'not configured';
}

function buildSelectedPoolVswitchControllerDetail(selectedPool = null) {
  const endpoint = buildSelectedPoolVswitchControllerLabel(selectedPool);
  if (endpoint === 'not configured') {
    return 'No legacy pool-level Open vSwitch controller endpoint is currently pinned.';
  }
  return `Legacy pool-level controller ${endpoint} is still configured here. Upstream deprecated this field in XenServer 7.2 in favor of SDN_controller workflows.`;
}

function buildSelectedPoolIgmpSnoopingLabel(selectedPool = null) {
  return selectedPool?.IGMP_snooping_enabled ? 'Enabled' : 'Disabled';
}

function buildSelectedPoolIgmpSnoopingDetail(selectedPool = null) {
  return selectedPool?.IGMP_snooping_enabled
    ? 'Multicast membership tracking is enforced for pool networking.'
    : 'Pool networking is not currently filtering multicast membership through IGMP snooping.';
}

function buildSelectedPoolHaEnabledLabel(selectedPool = null) {
  return selectedPool?.ha_enabled ? 'Enabled' : 'Disabled';
}

function buildSelectedPoolHaToleranceLabel(selectedPool = null) {
  if (!selectedPool?.ha_enabled) return 'Not active';
  return `${Number(selectedPool?.ha_host_failures_to_tolerate || 0)} host failure(s)`;
}

function buildSelectedPoolHaStatusDetail(selectedPool = null) {
  if (!selectedPool?.ha_enabled) {
    return 'Automatic failover is currently disabled for this pool.';
  }

  const status = selectedPool?.ha_overcommitted
    ? 'Enabled but currently overcommitted.'
    : 'Enabled and currently within failover capacity.';
  const clusterStack = String(selectedPool?.ha_cluster_stack || '').trim();
  return clusterStack ? `${status} Stack: ${clusterStack}.` : status;
}

function buildSelectedPoolHaPlannerDetail(selectedPool = null) {
  if (!selectedPool?.ha_enabled) {
    return 'HA planner coverage will appear here after the pool is enabled.';
  }
  return `Plan exists for ${Number(selectedPool?.ha_plan_exists_for || 0)} additional host failure(s); tolerance is ${Number(selectedPool?.ha_host_failures_to_tolerate || 0)}.`;
}

function buildSelectedPoolOtherConfigEntries(selectedPool = null) {
  return Object.entries(selectedPool?.other_config || {})
    .filter(([key, value]) => String(key || '').trim() && String(value || '').trim());
}

function buildSelectedPoolOtherConfigSummary(otherConfigEntries = []) {
  const entries = Array.isArray(otherConfigEntries) ? otherConfigEntries : [];
  if (!entries.length) return '-';
  const summary = entries
    .slice(0, 2)
    .map(([key, value]) => `${key}=${value}`)
    .join(' · ');
  if (entries.length <= 2) return summary;
  return `${summary} +${entries.length - 2} more`;
}

function findPoolByFocus(pools = [], focus = null) {
  return (Array.isArray(pools) ? pools : []).find((pool) =>
    recordMatchesRouteFocus(pool, focus, ['ref', 'uuid', 'name_label'])
  ) || null;
}

function buildPoolConnectionDraft(connection = null, hasUser = false) {
  return connection ? { ...connection } : {
    name: '',
    host: '',
    username: 'root',
    vault_credential_id: null,
    port: 443,
    visibility: hasUser ? 'private' : 'shared',
    is_default: false,
  };
}

function buildPoolConfigSavedMessage(record = {}, payload = {}, selectedPool = null) {
  return `${record?.name_label || payload.nameLabel || selectedPool?.ref} metadata was updated.`;
}

function buildPoolHaSavedMessage(record = {}, payload = {}, selectedPool = null, wasEnabled = false) {
  if (!payload.enabled) {
    return `${record?.name_label || selectedPool?.ref} high availability is now disabled.`;
  }
  if (!wasEnabled) {
    return `${record?.name_label || selectedPool?.ref} high availability is now enabled with a ${record?.ha_host_failures_to_tolerate || payload.haHostFailuresToTolerate || 0} host-failure target.`;
  }
  return `${record?.name_label || selectedPool?.ref} HA tolerance is now set to ${record?.ha_host_failures_to_tolerate || payload.haHostFailuresToTolerate || 0} host failure(s).`;
}
