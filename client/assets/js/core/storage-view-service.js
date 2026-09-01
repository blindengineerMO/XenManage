/* ============================================
   Storage View Service Helpers
   ============================================ */

async function loadStorageHosts(apiClient) {
  const result = await apiClient.getHosts();
  return result.data || [];
}

async function loadStorageRecords(apiClient) {
  const result = await apiClient.getSRs();
  return result.data || [];
}

async function loadStorageDetailContext(apiClient, row = {}, options = {}) {
  const [vdisResult, vmsResult, hostsResult] = await Promise.allSettled([
    options.vdis ? Promise.resolve({ data: options.vdis }) : apiClient.getSRVDIs(row.ref),
    options.vms ? Promise.resolve({ data: options.vms }) : apiClient.getVMs(),
    options.hosts ? Promise.resolve({ data: options.hosts }) : apiClient.getHosts(),
  ]);

  return {
    vdis: vdisResult.status === 'fulfilled' ? (vdisResult.value.data || []) : [],
    relatedVMs: vmsResult.status === 'fulfilled' ? (vmsResult.value.data || []) : [],
    relatedHosts: hostsResult.status === 'fulfilled' ? (hostsResult.value.data || []) : [],
    detailError: vdisResult.status === 'rejected' && vmsResult.status === 'rejected' && hostsResult.status === 'rejected'
      ? 'Unable to load VDI, VM, and host relationship data.'
      : '',
  };
}

function buildStorageProbeResultKey(result, index) {
  return result?.sr?.uuid || result?.sr?.name_label || `probe-${index}`;
}

function isSharedStorageType(type) {
  return ['nfs', 'lvmoiscsi'].includes(String(type || '').trim());
}

function canIntroduceStorageProbeResult(probeRequest = {}, result = null) {
  return Boolean(probeRequest?.hostRef && result?.complete && result?.sr?.uuid);
}

function buildStorageProbeImportPayload(probeRequest = {}, result = null) {
  if (!canIntroduceStorageProbeResult(probeRequest, result)) return null;

  return {
    hostRef: probeRequest.hostRef,
    uuid: result.sr.uuid,
    nameLabel: result.sr.name_label || `Imported ${String(probeRequest.type || 'storage').toUpperCase()} SR`,
    nameDescription: result.sr.name_description || '',
    type: probeRequest.type,
    contentType: 'user',
    shared: isSharedStorageType(probeRequest.type),
    deviceConfig: Object.keys(result.configuration || {}).length ? result.configuration : (probeRequest.deviceConfig || {}),
    smConfig: probeRequest.smConfig || {},
  };
}

function findStorageHostLabel(availableHosts = [], hostRef = '') {
  const host = (Array.isArray(availableHosts) ? availableHosts : []).find((entry) => entry.ref === hostRef) || null;
  return host?.name_label || hostRef;
}

function buildStorageRepositoryCreateMessage(record = {}, payload = {}, availableHosts = []) {
  return `${record.name_label || payload.nameLabel} was created on ${findStorageHostLabel(availableHosts, payload.hostRef)}.`;
}

function buildStorageRepositoryImportMessage(record = {}, payload = {}, availableHosts = []) {
  const hostLabel = findStorageHostLabel(availableHosts, payload.hostRef);
  if (record.alreadyAttached) {
    return `${record.name_label || payload.nameLabel} was already attached on ${hostLabel}; the SR inventory was refreshed.`;
  }
  if (record.introduced) {
    return `${record.name_label || payload.nameLabel} was introduced from ${payload.uuid} and attached to ${hostLabel}.`;
  }
  return `${record.name_label || payload.nameLabel} was attached to ${hostLabel}.`;
}

function describeStorageProbeSummary(result) {
  if (!result) return '';

  if (result.mode === 'probe') {
    return result.rawXml
      ? 'The host returned backend-specific XML output rather than structured probe records.'
      : 'The host did not return structured probe records for this request.';
  }

  const summary = result.summary || {};
  const total = Number(summary.totalResults || 0);
  const existing = Number(summary.existingSrs || 0);
  const complete = Number(summary.completeResults || 0);
  return `${total} candidate${total === 1 ? '' : 's'} · ${existing} existing SR${existing === 1 ? '' : 's'} · ${complete} complete configuration${complete === 1 ? '' : 's'}`;
}

function formatStorageProbeMap(record) {
  const entries = Object.entries(record || {}).filter(([key, value]) =>
    String(key || '').trim() && String(value || '').trim()
  );
  if (!entries.length) return '';
  return entries.map(([key, value]) => `${key}=${value}`).join(' · ');
}

function formatStorageProbeStat(record) {
  if (!record) return '';

  const parts = [];
  if (record.uuid) {
    parts.push(record.uuid);
  }
  if (record.health) {
    parts.push(record.health);
  }
  if (Number(record.total_space || 0) > 0) {
    parts.push(`${formatBytes(record.free_space || 0)} free of ${formatBytes(record.total_space || 0)}`);
  }
  if (record.clustered) {
    parts.push('clustered');
  }

  return parts.join(' · ');
}

if (typeof module !== 'undefined') {
  module.exports = {
    buildStorageProbeImportPayload,
    buildStorageProbeResultKey,
    buildStorageRepositoryCreateMessage,
    buildStorageRepositoryImportMessage,
    canIntroduceStorageProbeResult,
    loadStorageDetailContext,
  };
}
