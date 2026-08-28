function buildInventoryVisibilityLabel(visibility = '') {
  return visibility === 'shared' ? 'Shared' : 'Private';
}

function buildInventoryOwnershipLabel(record = null) {
  if (record?.is_owner) return 'Owned by you';
  return `Owner ${record?.owner_display_name || record?.owner_username}`;
}

function getInventoryFirstTag(tags = '') {
  return String(tags || '').split(',').map((value) => value.trim()).find(Boolean) || '';
}

function buildInventorySafeConnections(connections = []) {
  return (Array.isArray(connections) ? connections : [])
    .filter((connection) => connection && typeof connection === 'object')
    .map((connection, index) => ({
      id: connection.id ?? `saved-target-${index}`,
      name: connection.name || '',
      host: connection.host || '',
      username: connection.username || '',
      port: connection.port || 443,
      is_default: Boolean(connection.is_default),
      last_connected_at: connection.last_connected_at || '',
      visibility: connection.visibility || 'shared',
      owner_display_name: connection.owner_display_name || '',
      owner_username: connection.owner_username || '',
      is_owner: Boolean(connection.is_owner),
      can_manage: connection.can_manage !== false,
    }));
}

function findInventoryAttachedTarget(connectedTargets = [], connection = null) {
  const connectionId = Number(connection?.id || 0);
  return (Array.isArray(connectedTargets) ? connectedTargets : []).find((target) =>
    (connectionId && Number(target.connectionId || 0) === connectionId)
    || (
      String(target.host || '').toLowerCase() === String(connection?.host || '').toLowerCase()
      && String(target.username || '').toLowerCase() === String(connection?.username || '').toLowerCase()
    )
  ) || null;
}

function isInventoryConnectionActive(connectedTargets = [], connection = null) {
  return Boolean(findInventoryAttachedTarget(connectedTargets, connection)?.active);
}

function resolveInventoryWorkspaceTargetLabel(workspace = null, safeConnections = []) {
  const targetId = Number(workspace?.targetConnectionId || 0);
  if (!targetId) return 'No saved target binding';
  const connection = (Array.isArray(safeConnections) ? safeConnections : []).find((entry) => Number(entry.id) === targetId) || null;
  return connection ? `Target ${connection.name || connection.host}` : `Target #${targetId}`;
}

function buildInventoryResultNavigation(result = null) {
  return buildFocusedRoute(result?.route || '/', {
    kind: result?.focusKind || result?.kind || '',
    ref: result?.ref || '',
    uuid: result?.uuid || '',
    name: result?.name || '',
    cls: result?.focusClass || result?.kind || '',
    source: 'inventory',
  });
}

function buildInventoryWorkspacePayload({
  name = '',
  activeScope = 'all',
  searchQuery = '',
  workspaceTargetConnectionId = '',
  workspaceVisibility = 'shared',
  hasUser = false,
} = {}) {
  return {
    name: String(name || '').trim(),
    scope: activeScope || 'all',
    query: String(searchQuery || '').trim(),
    targetConnectionId: workspaceTargetConnectionId ? Number(workspaceTargetConnectionId) : null,
    notes: '',
    visibility: workspaceVisibility || (hasUser ? 'private' : 'shared'),
  };
}

function buildInventoryEmptyResources() {
  return {
    pools: [],
    templates: [],
    vms: [],
    hosts: [],
    srs: [],
    vdis: [],
    networks: [],
    alerts: [],
    tasks: [],
  };
}

function buildInventoryAllResults(resources = {}) {
  const storageMap = new Map((resources.srs || []).map((sr) => [sr.ref, sr]));
  const hostMap = new Map((resources.hosts || []).map((host) => [host.ref, host]));
  const vmsByVbdRef = new Map();
  const vmsByVifRef = new Map();

  for (const vm of resources.vms || []) {
    for (const ref of vm.VBDs || []) {
      vmsByVbdRef.set(ref, vm);
    }
    for (const ref of vm.VIFs || []) {
      vmsByVifRef.set(ref, vm);
    }
  }

  const vmResults = (resources.vms || []).map((vm) => ({
    kind: 'vm',
    name: vm.name_label || 'Virtual Machine',
    context: `${vm.power_state || 'Unknown'} · ${vm.uuid || vm.ref}`,
    status: vm.power_state || 'info',
    tags: truncateList(vm.tags),
    summary: vm.name_description || 'Virtual machine inventory entry',
    route: '/vms',
    ref: vm.ref,
    uuid: vm.uuid,
  }));

  const hostResults = (resources.hosts || []).map((host) => ({
    kind: 'host',
    name: host.name_label || host.hostname || 'Host',
    context: `${host.address || host.uuid || host.ref} · ${(host.resident_VMs || []).length} VMs`,
    status: host.enabled ? 'enabled' : 'disabled',
    tags: truncateList(host.tags),
    summary: host.hostname || 'Host inventory entry',
    route: '/hosts',
    ref: host.ref,
    uuid: host.uuid,
  }));

  const poolResults = (resources.pools || []).map((pool) => ({
    kind: 'pool',
    name: pool.name_label || 'Pool',
    context: `${pool.uuid || pool.ref} · default SR ${pool.default_SR || '-'}`,
    status: 'info',
    tags: truncateList(pool.tags),
    summary: pool.name_description || 'Pool inventory entry',
    route: '/pools',
    ref: pool.ref,
    uuid: pool.uuid,
  }));

  const templateResults = (resources.templates || []).map((template) => ({
    kind: 'template',
    name: template.name_label || 'Template',
    context: `${template.VCPUs_at_startup || 0} vCPU · ${formatBytes(template.memory_static_max)}`,
    status: 'info',
    tags: truncateList(template.tags),
    summary: template.name_description || 'Template inventory entry',
    route: '/templates',
    ref: template.ref,
    uuid: template.uuid,
  }));

  const storageResults = (resources.srs || []).map((sr) => ({
    kind: 'storage',
    name: sr.name_label || 'Storage Repository',
    context: `${formatBytes(sr.virtual_allocation)} / ${formatBytes(sr.physical_size)} · ${sr.type || 'unknown'}`,
    status: getUtilizationStatus(percentValue(sr.virtual_allocation, sr.physical_size), { warning: 75, critical: 90 }),
    tags: truncateList(sr.tags),
    summary: 'Storage repository inventory entry',
    route: '/storage',
    ref: sr.ref,
    uuid: sr.uuid,
  }));

  const vdiResults = (resources.vdis || []).map((vdi) => {
    const sr = storageMap.get(vdi.SR) || null;
    const attachmentCount = Array.isArray(vdi.VBDs) ? vdi.VBDs.length : 0;
    return {
      kind: 'vdi',
      name: vdi.name_label || vdi.ref || 'Virtual Disk Image',
      context: `${sr?.name_label || vdi.SR || 'Unknown SR'} · ${formatBytes(vdi.virtual_size)} · ${attachmentCount} attachment${attachmentCount === 1 ? '' : 's'}`,
      status: vdi.managed ? 'info' : 'warning',
      tags: `${vdi.type || 'disk'}${vdi.managed ? ', managed' : ', unmanaged'}`,
      summary: `${vdi.uuid || vdi.ref || 'VDI'} stored in ${sr?.name_label || 'the selected repository'}.`,
      route: '/storage',
      ref: vdi.ref,
      uuid: vdi.uuid,
      focusKind: 'storage',
      focusClass: 'vdi',
      parentName: sr?.name_label || '',
    };
  });

  const vbdResults = (resources.vdis || []).flatMap((vdi) => {
    const sr = storageMap.get(vdi.SR) || null;
    return (vdi.VBDs || []).map((vbdRef, index) => {
      const vm = vmsByVbdRef.get(vbdRef) || null;
      const host = hostMap.get(vm?.resident_on) || null;
      return {
        kind: 'vbd',
        name: `VBD ${vm?.name_label || index + 1}`,
        context: `${vdi.name_label || vdi.ref || 'VDI'} · ${vm?.name_label || 'No mapped VM'} · ${host?.name_label || host?.address || 'Host not mapped'}`,
        status: vm?.power_state || (vm ? 'info' : 'warning'),
        tags: sr?.name_label || vdi.SR || '-',
        summary: `${vbdRef} backs ${vdi.name_label || 'a storage object'}${vm ? ` for ${vm.name_label || vm.ref}` : ''}.`,
        route: '/storage',
        ref: vbdRef,
        uuid: '',
        focusKind: 'storage',
        focusClass: 'vbd',
        parentName: sr?.name_label || '',
      };
    });
  });

  const networkResults = (resources.networks || []).map((network) => ({
    kind: 'network',
    name: network.name_label || network.bridge || 'Network',
    context: `${network.bridge || '-'} · ${network.uuid || network.ref}`,
    status: network.managed ? 'enabled' : 'disabled',
    tags: truncateList(network.tags),
    summary: network.name_description || 'Network inventory entry',
    route: '/networking',
    ref: network.ref,
    uuid: network.uuid,
  }));

  const vifResults = (resources.networks || []).flatMap((network) =>
    (network.VIFs || []).map((vifRef, index) => {
      const vm = vmsByVifRef.get(vifRef) || null;
      return {
        kind: 'vif',
        name: `VIF ${vm?.name_label || index + 1}`,
        context: `${network.name_label || network.bridge || 'Network'} · ${vm?.name_label || 'No mapped VM'} · VLAN ${(network.other_config || {}).vlan || '-'}`,
        status: vm?.power_state || 'info',
        tags: network.bridge || '-',
        summary: `${vifRef} attaches ${vm?.name_label || 'a workload'} to ${network.name_label || network.bridge || 'the selected network'}.`,
        route: '/networking',
        ref: vifRef,
        uuid: '',
        focusKind: 'network',
        focusClass: 'vif',
        parentName: network.name_label || network.bridge || '',
      };
    })
  );

  const pifResults = (resources.networks || []).flatMap((network) =>
    (network.PIFs || []).map((pifRef, index) => {
      const host = (resources.hosts || []).find((candidate) => Array.isArray(candidate.PIFs) && candidate.PIFs.includes(pifRef)) || null;
      return {
        kind: 'pif',
        name: `PIF ${host?.name_label || index + 1}`,
        context: `${network.name_label || network.bridge || 'Network'} · ${host?.name_label || 'No mapped host'} · ${host?.address || host?.uuid || 'address unavailable'}`,
        status: host?.enabled ? 'enabled' : (host ? 'warning' : 'info'),
        tags: network.bridge || '-',
        summary: `${pifRef} uplinks ${host?.name_label || 'a host'} into ${network.name_label || network.bridge || 'the selected bridge'}.`,
        route: '/networking',
        ref: pifRef,
        uuid: '',
        focusKind: 'network',
        focusClass: 'pif',
        parentName: network.name_label || network.bridge || '',
      };
    })
  );

  const alertResults = sortMessages(resources.alerts || []).map((message) => ({
    kind: 'alert',
    name: getMessageHeadline(message),
    context: formatDateTime(message.timestamp),
    status: getMessageSeverity(message),
    tags: message.cls || '-',
    summary: message.body || 'Alert event',
    route: '/alerts',
    ref: message.ref,
    uuid: message.uuid,
  }));

  const taskResults = sortTasks(resources.tasks || []).map((task) => ({
    kind: 'task',
    name: task.name_label || 'Task',
    context: `${formatTaskProgress(task.progress)} · ${formatDateTime(task.finished || task.created)}`,
    status: task.status || 'info',
    tags: task.resident_on || '-',
    summary: task.name_description || 'Operational task',
    route: '/activity',
    ref: task.ref,
    uuid: task.uuid,
  }));

  return [
    ...poolResults,
    ...templateResults,
    ...vmResults,
    ...hostResults,
    ...storageResults,
    ...vdiResults,
    ...vbdResults,
    ...networkResults,
    ...vifResults,
    ...pifResults,
    ...alertResults,
    ...taskResults,
  ];
}

function buildFilteredInventoryResults(allResults = [], activeScope = 'all', searchQuery = '') {
  const query = String(searchQuery || '').trim().toLowerCase();

  return (Array.isArray(allResults) ? allResults : []).filter((item) => {
    const scopeMatch = activeScope === 'all' || item.kind === activeScope;
    if (!scopeMatch) return false;
    if (!query) return true;

    const haystack = [
      item.kind,
      item.name,
      item.context,
      item.status,
      item.tags,
      item.summary,
      item.uuid,
      item.ref,
    ].join(' ').toLowerCase();

    return haystack.includes(query);
  });
}

function countInventoryObjects(allResults = []) {
  return (Array.isArray(allResults) ? allResults : []).filter((item) => item.kind !== 'alert' && item.kind !== 'task').length;
}

function buildInventoryTopTags(allResults = []) {
  const counts = new Map();
  for (const item of Array.isArray(allResults) ? allResults : []) {
    for (const tag of String(item.tags || '')
      .split(',')
      .map((value) => value.trim())
      .filter((value) => value && value !== '-')) {
      counts.set(tag, (counts.get(tag) || 0) + 1);
    }
  }

  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((left, right) => right.count - left.count)
    .slice(0, 10);
}

function buildInventorySummaryCards({
  totalObjectCount = 0,
  resources = {},
  filteredResults = [],
  safeConnections = [],
  savedWorkspaces = [],
  activeScope = 'all',
} = {}) {
  const resourceState = resources || {};
  const resultList = Array.isArray(filteredResults) ? filteredResults : [];
  const connections = Array.isArray(safeConnections) ? safeConnections : [];
  const workspaces = Array.isArray(savedWorkspaces) ? savedWorkspaces : [];

  return [
    {
      key: 'objects',
      label: 'Indexed Objects',
      value: String(totalObjectCount),
      detail: `${resourceState.vdis?.length || 0} VDIs plus ${resultList.filter((item) => ['vbd', 'vif', 'pif'].includes(item.kind)).length} attachment records indexed alongside ${resourceState.alerts?.length || 0} alerts and ${resourceState.tasks?.length || 0} tasks`,
      icon: 'mdi-database-search-outline',
      valueClass: totalObjectCount ? 'text-cyan' : '',
    },
    {
      key: 'connections',
      label: 'Saved Targets',
      value: String(connections.length),
      detail: connections.length ? `${connections.filter((connection) => connection.is_default).length} defaults pinned` : 'No saved targets yet',
      icon: 'mdi-server-network-outline',
      valueClass: connections.length ? 'text-green' : '',
    },
    {
      key: 'workspaces',
      label: 'Saved Workspaces',
      value: String(workspaces.length),
      detail: workspaces.length ? 'Reusable search presets for common operator flows' : 'Save common search scopes for repeatable navigation',
      icon: 'mdi-folder-star-outline',
      valueClass: workspaces.length ? 'text-amber' : '',
    },
    {
      key: 'scope',
      label: 'Current Scope',
      value: activeScope === 'all' ? 'All' : activeScope,
      detail: `${resultList.length} results match the active query`,
      icon: 'mdi-filter-outline',
      valueClass: 'text-green',
    },
  ];
}
