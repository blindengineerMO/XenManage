function summarizeNetworkVifQos(vif, options = {}) {
  const emptyLabel = options.emptyLabel || 'QoS not configured';
  const type = String(vif?.qos_algorithm_type || '').trim();
  if (!type) return emptyLabel;

  const params = Object.entries(vif?.qos_algorithm_params || {})
    .filter(([key]) => String(key || '').trim())
    .map(([key, value]) => `${key}=${value}`)
    .join(', ');

  return params ? `${type} · ${params}` : `${type} · no parameters`;
}

function formatNetworkVlanLabel(network) {
  const value = String(network?.other_config?.vlan || '').trim();
  return value ? `VLAN ${value}` : 'untagged';
}

function buildNetworkVlanOptions(networks = []) {
  return (Array.isArray(networks) ? networks : []).map((network) => ({
    value: network.ref,
    label: `${network.name_label || network.bridge || network.ref} · ${network.bridge || '-'} · ${formatNetworkVlanLabel(network)}`,
  }));
}

function buildNetworkVlanPifOptions(availableHosts = []) {
  return (Array.isArray(availableHosts) ? availableHosts : []).flatMap((host) =>
    (Array.isArray(host.PIFs) ? host.PIFs : []).map((ref, index) => ({
      value: ref,
      label: `${host.name_label || host.hostname || host.address || host.ref || 'Host'} · uplink ${index + 1} · ${ref}`,
    }))
  );
}

function buildNetworkVifVmOptions(relatedVMs = []) {
  return (Array.isArray(relatedVMs) ? relatedVMs : []).map((vm) => ({
    value: vm.ref,
    label: `${vm.name_label || vm.ref} · ${vm.power_state || 'Unknown'} · ${vm.uuid || vm.ref}`,
  }));
}

function buildNetworkVifQosOptions(attachments = []) {
  return (Array.isArray(attachments) ? attachments : []).map((attachment) => ({
    value: attachment.interfaceRef,
    label: `${attachment.vmName} · ${attachment.interfaceRef} · ${attachment.device ? `device ${attachment.device}` : 'device auto'}`,
  }));
}

function normalizeNetworkSelectionRefs(values = []) {
  return Array.isArray(values) ? values.filter(Boolean) : [];
}

function buildNetworkSelectionProfile(networks = [], selectedNetworkRefs = []) {
  const networkList = Array.isArray(networks) ? networks : [];
  const selected = new Set(normalizeNetworkSelectionRefs(selectedNetworkRefs));
  const rows = networkList.filter((network) => selected.has(network.ref));

  if (!rows.length) {
    return {
      rows,
      destroyReady: [],
      blocked: [],
      summary: 'No networks selected.',
    };
  }

  const destroyReady = [];
  const blocked = [];

  rows.forEach((network) => {
    if (buildSelectedNetworkDestroyBlockedReason(network)) blocked.push(network);
    else destroyReady.push(network);
  });

  const parts = [];
  if (destroyReady.length) {
    parts.push(`${destroyReady.length} destroy-ready`);
  }
  if (blocked.length) {
    parts.push(`${blocked.length} still attached and blocked`);
  }

  return {
    rows,
    destroyReady,
    blocked,
    summary: parts.join(' · ') || 'Selected networks are ready for review.',
  };
}

function buildSelectedNetworkTopologyLabel(selectedNetwork = null, hostUplinks = [], vlanLabel = '-') {
  if (!selectedNetwork) return '-';

  const uplinkCount = Array.isArray(selectedNetwork.PIFs) ? selectedNetwork.PIFs.length : 0;
  const attachmentCount = Array.isArray(selectedNetwork.VIFs) ? selectedNetwork.VIFs.length : 0;
  const hostCount = new Set(
    (Array.isArray(hostUplinks) ? hostUplinks : []).map((uplink) => uplink.hostRef || uplink.hostUuid || uplink.hostName)
  ).size;
  const parts = [
    vlanLabel,
    `${uplinkCount} uplink${uplinkCount === 1 ? '' : 's'}`,
    `${attachmentCount} interface${attachmentCount === 1 ? '' : 's'}`,
  ];

  if (hostCount) {
    parts.push(`${hostCount} host${hostCount === 1 ? '' : 's'}`);
  }

  return parts.join(' · ');
}

function buildFocusedNetworkContext(focusedNetworkClass = '', focusedPifRef = '', focusedVifRef = '', vlanLabel = '-', selectedNetwork = null) {
  if (!focusedNetworkClass) return null;

  if (focusedNetworkClass === 'vif') {
    return {
      title: 'Focused Interface Handoff',
      summary: 'This network was opened from a specific VM interface path.',
      detail: `${focusedVifRef || 'Interface ref unavailable'} · ${vlanLabel} · ${selectedNetwork?.bridge || 'no bridge label'}`,
    };
  }

  if (focusedNetworkClass === 'pif') {
    return {
      title: 'Focused Uplink Handoff',
      summary: 'This network was opened from a specific host uplink path.',
      detail: `${focusedPifRef || 'Uplink ref unavailable'} · ${vlanLabel} · ${selectedNetwork?.bridge || 'no bridge label'}`,
    };
  }

  if (focusedNetworkClass === 'vlan') {
    return {
      title: 'Focused VLAN Handoff',
      summary: 'This network was opened from a VLAN-targeted alert or follow-through route.',
      detail: `${focusedPifRef || 'Representative uplink unavailable'} · ${vlanLabel} · ${selectedNetwork?.bridge || 'no bridge label'}`,
    };
  }

  if (focusedNetworkClass === 'bond') {
    return {
      title: 'Focused Bond Handoff',
      summary: 'This network was opened from a bond-targeted alert or follow-through route.',
      detail: `${focusedPifRef || 'Representative uplink unavailable'} · ${vlanLabel} · ${selectedNetwork?.bridge || 'no bridge label'}`,
    };
  }

  return null;
}

function buildSelectedNetworkHostUplinks(selectedNetwork = null, relatedHosts = [], vlanLabel = '-') {
  if (!selectedNetwork) return [];

  const uplinks = new Set(Array.isArray(selectedNetwork.PIFs) ? selectedNetwork.PIFs : []);
  return (Array.isArray(relatedHosts) ? relatedHosts : []).flatMap((host) =>
    (Array.isArray(host.PIFs) ? host.PIFs : [])
      .filter((ref) => uplinks.has(ref))
      .map((ref, index) => ({
        id: `${host.ref || host.uuid || host.address || 'host'}-${ref}-${index}`,
        hostRef: host.ref || '',
        hostUuid: host.uuid || '',
        hostName: host.name_label || host.hostname || host.address || host.ref || 'Host',
        hostAddress: host.address || host.hostname || host.uuid || '-',
        interfaceRef: ref,
        detail: `${vlanLabel} · ${host.enabled ? 'enabled host' : 'disabled host'} · ${host.hostname || 'no hostname'} · ${host.uuid || host.ref || '-'}`,
        status: host.enabled ? 'enabled' : 'warning',
      }))
  );
}

function buildSelectedNetworkVmAttachments(selectedNetwork = null, relatedVMs = [], relatedVifs = []) {
  if (!selectedNetwork) return [];

  const attachments = new Set(Array.isArray(selectedNetwork.VIFs) ? selectedNetwork.VIFs : []);
  const vifMap = new Map((Array.isArray(relatedVifs) ? relatedVifs : []).map((vif) => [vif.ref, vif]));
  return (Array.isArray(relatedVMs) ? relatedVMs : []).flatMap((vm) =>
    (Array.isArray(vm.VIFs) ? vm.VIFs : [])
      .filter((ref) => attachments.has(ref))
      .map((ref, index) => {
        const vif = vifMap.get(ref) || {};
        const currentlyAttached = Boolean(vif.currently_attached);
        const qosSummary = summarizeNetworkVifQos(vif);
        return {
          id: `${vm.ref || vm.uuid || vm.name_label || 'vm'}-${ref}-${index}`,
          vmRef: vm.ref || '',
          vmUuid: vm.uuid || '',
          vmName: vm.name_label || vm.ref || 'Virtual Machine',
          interfaceRef: ref,
          powerState: vm.power_state || 'Unknown',
          device: String(vif.device || ''),
          mac: String(vif.MAC || ''),
          currentlyAttached,
          qosConfigured: Boolean(String(vif.qos_algorithm_type || '').trim()),
          detail: `${vif.device ? `device ${vif.device}` : 'device auto'} · ${vif.MAC || 'auto MAC'} · ${formatBytes(vm.memory_static_max)} · ${qosSummary} · ${vm.uuid || vm.ref || '-'}`,
          status: currentlyAttached ? (vm.power_state || 'info') : 'disconnected',
        };
      })
  );
}

function resolveSelectedNetworkAttachmentVifRef(attachments = [], focusedVifRef = '', selectedAttachmentVifRef = '') {
  const list = Array.isArray(attachments) ? attachments : [];
  if (!list.length) return '';

  if (focusedVifRef && list.some((attachment) => attachment.interfaceRef === focusedVifRef)) {
    return focusedVifRef;
  }

  if (selectedAttachmentVifRef && list.some((attachment) => attachment.interfaceRef === selectedAttachmentVifRef)) {
    return selectedAttachmentVifRef;
  }

  return list[0].interfaceRef;
}

function buildSelectedNetworkDestroyBlockedReason(selectedNetwork = null) {
  if (!selectedNetwork) return '';

  const pifCount = Array.isArray(selectedNetwork.PIFs) ? selectedNetwork.PIFs.length : 0;
  const vifCount = Array.isArray(selectedNetwork.VIFs) ? selectedNetwork.VIFs.length : 0;
  if (!pifCount && !vifCount) return '';

  const segments = [];
  if (pifCount) segments.push(`${pifCount} host uplink${pifCount === 1 ? '' : 's'}`);
  if (vifCount) segments.push(`${vifCount} workload interface${vifCount === 1 ? '' : 's'}`);
  return `Destroy requires a detached managed network. ${segments.join(' and ')} still map to this network.`;
}

function buildCurrentNetworkDetailFocusOptions(focusState = {}, options = {}) {
  const includeRelationships = options.includeRelationships !== false;
  return {
    focusedPifRef: focusState.focusedPifRef || '',
    focusedVifRef: focusState.focusedVifRef || '',
    focusedNetworkClass: focusState.focusedNetworkClass || '',
    hosts: includeRelationships ? (focusState.relatedHosts || []) : undefined,
    vms: includeRelationships ? (focusState.relatedVMs || []) : undefined,
    vifs: includeRelationships ? (focusState.relatedVifs || []) : undefined,
  };
}

function buildNetworkCreateMessage(record = {}, payload = {}) {
  return `${record.name_label || payload.nameLabel} was created on ${record.bridge || payload.bridge}.`;
}

function buildNetworkVlanCreateMessage(record = {}, payload = {}, targetNetwork = null, targetPif = null) {
  return `VLAN ${record.tag || payload.tag} was created on ${targetPif?.label || payload.pifRef} for ${targetNetwork?.name_label || record.network?.name_label || payload.networkRef}.`;
}

function buildNetworkBondCreateMessage(record = {}, payload = {}, targetNetwork = null) {
  return `Bond ${record.mode || payload.mode} was created across ${(record.memberPifRefs || payload.pifRefs || []).length} uplinks for ${targetNetwork?.name_label || record.network?.name_label || payload.networkRef}.`;
}

function buildNetworkVifAttachMessage(targetVm = null, payload = {}, selectedNetwork = null) {
  return `${targetVm?.name_label || payload.vmRef} was connected to ${selectedNetwork?.name_label || selectedNetwork?.ref}.`;
}

function buildNetworkVifRemoveMessage(attachment = null, selectedNetwork = null) {
  return `${attachment?.vmName || attachment?.vmRef} interface ${attachment?.interfaceRef} was removed from ${selectedNetwork?.name_label || selectedNetwork?.ref}.`;
}

function buildNetworkVifQosMessage(attachment = null, vifRef = '', selectedNetwork = null) {
  return `${attachment?.vmName || vifRef} interface ${vifRef} QoS policy was updated on ${selectedNetwork?.name_label || selectedNetwork?.ref}.`;
}

function buildNetworkConfigMessage(record = {}, payload = {}, selectedNetwork = null) {
  return `${record.name_label || payload.nameLabel || selectedNetwork?.ref} network metadata was updated.`;
}

function buildNetworkDestroyMessage(network = null) {
  return `${network?.name_label || network?.ref} was destroyed and removed from the current network inventory view.`;
}

function buildBulkNetworkDestroyMessage(networks = []) {
  const rows = Array.isArray(networks) ? networks.filter(Boolean) : [];
  if (!rows.length) return 'Selected networks were destroyed and removed from the current network inventory view.';
  if (rows.length === 1) return buildNetworkDestroyMessage(rows[0]);
  return `${rows.length} selected networks were destroyed and removed from the current network inventory view.`;
}

function buildNetworkVifDisconnectMessage(result = {}, attachment = null, selectedNetwork = null) {
  if (result?.alreadyDisconnected) {
    return `${attachment?.vmName || attachment?.vmRef} interface ${attachment?.interfaceRef} was already disconnected from live traffic on ${selectedNetwork?.name_label || selectedNetwork?.ref}.`;
  }

  return `${attachment?.vmName || attachment?.vmRef} interface ${attachment?.interfaceRef} was hot-unplugged from ${selectedNetwork?.name_label || selectedNetwork?.ref}.`;
}

function buildNetworkHostWorkspaceLocation(uplink = null) {
  if (!uplink?.hostRef) return null;
  return buildFocusedRoute('/hosts', {
    kind: 'host',
    ref: uplink.hostRef,
    uuid: uplink.hostUuid || '',
    name: uplink.hostName || '',
    cls: 'host',
    source: 'network',
  });
}

function buildNetworkVmWorkspaceLocation(attachment = null) {
  if (!attachment?.vmRef) return null;
  return buildFocusedRoute('/vms', {
    kind: 'vm',
    ref: attachment.vmRef,
    uuid: attachment.vmUuid || '',
    name: attachment.vmName || '',
    cls: 'vm',
    source: 'network',
  });
}

function findNetworkByFocus(networks = [], focus = null) {
  return (Array.isArray(networks) ? networks : []).find((network) =>
    recordMatchesRouteFocus(network, focus, ['ref', 'uuid', 'name_label', 'bridge'])
  ) || null;
}

function resolveFocusedNetworkTarget(networks = [], focus = null) {
  const direct = findNetworkByFocus(networks, focus);
  if (direct) {
    return { network: direct, focusedPifRef: '', focusedVifRef: '', focusedNetworkClass: '' };
  }

  for (const network of Array.isArray(networks) ? networks : []) {
    if (['pif', 'bond', 'vlan'].includes(focus?.cls) && recordMatchesRouteFocus(network, focus, [], network.PIFs || [])) {
      return {
        network,
        focusedPifRef: focus?.ref || '',
        focusedVifRef: '',
        focusedNetworkClass: focus?.cls || '',
      };
    }

    if (focus?.cls === 'vif' && recordMatchesRouteFocus(network, focus, [], network.VIFs || [])) {
      return {
        network,
        focusedPifRef: '',
        focusedVifRef: focus?.ref || '',
        focusedNetworkClass: focus?.cls || '',
      };
    }
  }

  return null;
}
