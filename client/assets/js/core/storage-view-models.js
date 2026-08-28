function buildStorageSelectionProfile(srs = [], selectedSrRefs = []) {
  const srList = Array.isArray(srs) ? srs : [];
  const selected = new Set(Array.isArray(selectedSrRefs) ? selectedSrRefs : []);
  const rows = srList.filter((sr) => selected.has(sr.ref));

  if (!rows.length) {
    return {
      rows,
      summary: 'No storage repositories selected.',
    };
  }

  const totalCapacity = rows.reduce((sum, sr) => sum + Number(sr.physical_size || 0), 0);
  const totalAllocation = rows.reduce((sum, sr) => sum + Number(sr.virtual_allocation || 0), 0);

  return {
    rows,
    summary: `${formatBytes(totalAllocation)} allocated of ${formatBytes(totalCapacity)} across ${rows.length} ${rows.length === 1 ? 'repository' : 'repositories'}`,
  };
}

function buildStorageAttachmentRows(vdis = [], relatedVMs = [], relatedHosts = []) {
  const diskList = Array.isArray(vdis) ? vdis : [];
  const vmList = Array.isArray(relatedVMs) ? relatedVMs : [];
  const hostList = Array.isArray(relatedHosts) ? relatedHosts : [];

  return diskList.flatMap((vdi) => {
    const vbdRefs = Array.isArray(vdi.VBDs) ? vdi.VBDs : [];
    const attachedVms = vmList.filter((vm) =>
      Array.isArray(vm.VBDs) && vm.VBDs.some((ref) => vbdRefs.includes(ref))
    );

    if (!attachedVms.length) {
      return [{
        id: `${vdi.ref || vdi.uuid || 'vdi'}-unattached`,
        vdiRef: vdi.ref || '',
        vdiUuid: vdi.uuid || '',
        vdiName: vdi.name_label || vdi.ref || 'Unnamed VDI',
        vbdRef: vbdRefs[0] || '',
        vmRef: '',
        vmUuid: '',
        vmName: 'No mapped workload',
        hostRef: '',
        hostUuid: '',
        hostName: 'Unplaced / not discovered',
        detail: `${formatBytes(vdi.virtual_size)} · ${vdi.type || 'disk'} · no VM attachment match`,
        status: 'warning',
      }];
    }

    return attachedVms.map((vm) => {
      const matchedVbdRef = (vm.VBDs || []).find((ref) => vbdRefs.includes(ref)) || '';
      const host = hostList.find((candidate) =>
        candidate.ref === vm.resident_on || candidate.uuid === vm.resident_on
      ) || null;

      return {
        id: `${vdi.ref || vdi.uuid || 'vdi'}-${vm.ref || vm.uuid || 'vm'}-${matchedVbdRef || 'vbd'}`,
        vdiRef: vdi.ref || '',
        vdiUuid: vdi.uuid || '',
        vdiName: vdi.name_label || vdi.ref || 'Unnamed VDI',
        vbdRef: matchedVbdRef,
        vmRef: vm.ref || '',
        vmUuid: vm.uuid || '',
        vmName: vm.name_label || vm.ref || 'Virtual Machine',
        hostRef: host?.ref || '',
        hostUuid: host?.uuid || '',
        hostName: host ? (host.name_label || host.address || host.ref || 'Host') : 'Host not mapped',
        detail: `${formatBytes(vdi.virtual_size)} · ${vm.power_state || 'Unknown'} · ${host?.address || host?.uuid || vm.resident_on || 'no host ref'}`,
        status: vm.power_state || 'info',
      };
    });
  });
}

function buildStorageVdiAttachmentCounts(vdis = [], attachmentRows = []) {
  const rows = Array.isArray(attachmentRows) ? attachmentRows : [];
  return Object.fromEntries(
    (Array.isArray(vdis) ? vdis : []).map((vdi) => [
      vdi.ref,
      rows.filter((row) => row.vdiRef === vdi.ref && row.vmRef).length,
    ])
  );
}

function buildSelectedSrAccessHosts(selectedSR = null, relatedHosts = []) {
  if (!selectedSR?.PBDs?.length || !Array.isArray(relatedHosts) || !relatedHosts.length) return [];
  const pbdRefs = new Set(selectedSR.PBDs || []);
  return relatedHosts.filter((host) =>
    Array.isArray(host.PBDs) && host.PBDs.some((pbdRef) => pbdRefs.has(pbdRef))
  );
}

function buildSelectedSrLocalCacheBlockedReason(selectedSR = null, detailLoading = false, accessHosts = [], localCacheHostRef = '') {
  if (!selectedSR) return 'No storage repository is selected.';
  if (detailLoading) return 'Storage and host relationship data are still loading before cache controls can be applied.';
  if (selectedSR.shared) return 'Local storage caching only applies to non-shared storage repositories.';
  if (!accessHosts.length) return 'No attached host paths were discovered for this repository.';
  if (!localCacheHostRef) return 'Select a host path before changing the local cache assignment.';
  return '';
}

function buildSelectedSrLocalCacheSummary(selectedSR = null, accessHosts = [], localCacheHostRef = '') {
  if (!selectedSR) return 'No storage repository is selected.';
  if (selectedSR.shared) return 'Shared repositories are not eligible for host-local caching.';
  if (!accessHosts.length) return 'No attached host paths were discovered for this repository.';

  const host = accessHosts.find((entry) => entry.ref === localCacheHostRef) || accessHosts[0];
  if (selectedSR.local_cache_enabled) {
    return `Enabled for ${host?.name_label || host?.address || host?.ref || 'the selected host path'}.`;
  }
  return `Available on ${host?.name_label || host?.address || host?.ref || 'the selected host path'} but not currently enabled.`;
}

function buildSelectedSrOtherConfigSummary(selectedSR = null) {
  if (!selectedSR) return '-';

  const entries = Object.entries(selectedSR.other_config || {})
    .filter(([key, value]) =>
      !['last_rescan_at', 'last_repair_at'].includes(String(key || '').trim())
      && String(key || '').trim()
      && String(value || '').trim()
    );

  if (!entries.length) return '-';

  const summary = entries.slice(0, 2).map(([key, value]) => `${key}=${value}`).join(' · ');
  return entries.length <= 2 ? summary : `${summary} +${entries.length - 2} more`;
}

function buildSelectedSrTopologyProfile(selectedSR = null, vdis = [], attachmentRows = []) {
  if (!selectedSR) {
    return {
      workloadCount: 0,
      attachmentPathCount: 0,
      topologyLabel: '-',
      destroyBlockedReason: 'No storage repository is selected.',
    };
  }

  const rows = Array.isArray(attachmentRows) ? attachmentRows : [];
  const diskCount = Array.isArray(vdis) ? vdis.length : 0;
  const workloadCount = new Set(rows.filter((row) => row.vmRef).map((row) => row.vmRef)).size;
  const attachmentPathCount = new Set(rows.map((row) => row.vbdRef).filter(Boolean)).size;
  const hostCount = new Set(
    rows
      .map((row) => row.hostRef || row.hostUuid || (row.hostName !== 'Host not mapped' ? row.hostName : ''))
      .filter(Boolean)
  ).size;

  const parts = [
    `${diskCount} disk${diskCount === 1 ? '' : 's'}`,
    `${attachmentPathCount} attachment path${attachmentPathCount === 1 ? '' : 's'}`,
    `${workloadCount} workload${workloadCount === 1 ? '' : 's'}`,
  ];

  if (hostCount) {
    parts.push(`${hostCount} host${hostCount === 1 ? '' : 's'}`);
  }

  return {
    workloadCount,
    attachmentPathCount,
    topologyLabel: parts.join(' · '),
    destroyBlockedReason: diskCount
      ? `Destroy requires an empty repository. ${diskCount} ${diskCount === 1 ? 'disk' : 'disks'} still map to this storage repository.`
      : '',
  };
}

function buildFocusedStorageContext(focusedStorageClass = '', focusedVdiRef = '', focusedVdiUuid = '', focusedVbdRef = '', topologyLabel = '-') {
  if (!focusedStorageClass) return null;

  if (focusedStorageClass === 'vdi') {
    return {
      title: 'Focused VDI Handoff',
      summary: 'This repository was opened from a specific virtual disk path.',
      detail: `${focusedVdiRef || focusedVdiUuid || 'Virtual disk ref unavailable'} · ${topologyLabel}`,
    };
  }

  if (focusedStorageClass === 'vbd') {
    return {
      title: 'Focused VBD Handoff',
      summary: 'This repository was opened from a specific attachment path.',
      detail: `${focusedVbdRef || 'Attachment ref unavailable'} · ${topologyLabel}`,
    };
  }

  return null;
}

function buildStorageDetailProfile({
  selectedSR = null,
  vdis = [],
  relatedVMs = [],
  relatedHosts = [],
  detailLoading = false,
  localCacheHostRef = '',
  focusedVdiRef = '',
  focusedVdiUuid = '',
  focusedVbdRef = '',
  focusedStorageClass = '',
} = {}) {
  const attachmentRows = buildStorageAttachmentRows(vdis, relatedVMs, relatedHosts);
  const attachmentCounts = buildStorageVdiAttachmentCounts(vdis, attachmentRows);
  const accessHosts = buildSelectedSrAccessHosts(selectedSR, relatedHosts);
  const topologyProfile = buildSelectedSrTopologyProfile(selectedSR, vdis, attachmentRows);

  return {
    attachmentRows,
    attachmentCounts,
    accessHosts,
    localCacheBlockedReason: buildSelectedSrLocalCacheBlockedReason(
      selectedSR,
      detailLoading,
      accessHosts,
      localCacheHostRef
    ),
    localCacheSummary: buildSelectedSrLocalCacheSummary(selectedSR, accessHosts, localCacheHostRef),
    otherConfigSummary: buildSelectedSrOtherConfigSummary(selectedSR),
    workloadCount: topologyProfile.workloadCount,
    attachmentPathCount: topologyProfile.attachmentPathCount,
    topologyLabel: topologyProfile.topologyLabel,
    focusedContext: buildFocusedStorageContext(
      focusedStorageClass,
      focusedVdiRef,
      focusedVdiUuid,
      focusedVbdRef,
      topologyProfile.topologyLabel
    ),
    destroyBlockedReason: !selectedSR
      ? 'No storage repository is selected.'
      : detailLoading
        ? 'Storage relationships are still loading before destroy safety checks can finish.'
        : topologyProfile.destroyBlockedReason,
  };
}
