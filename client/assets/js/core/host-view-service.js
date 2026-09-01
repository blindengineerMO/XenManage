/* ============================================
   Host View Service Helpers
   ============================================ */

async function loadHostRecords(apiClient) {
  const result = await apiClient.getHosts();
  return result.data || [];
}

async function loadHostTargetRecords(apiClient) {
  return apiClient.getHostTargets();
}

async function loadHostConnectionRecords(apiClient) {
  return apiClient.getConnections();
}

async function loadHostCredentialRecords(apiClient) {
  const result = await apiClient.getCredentials();
  return result.data || [];
}

async function loadHostDetailContext(apiClient, row = null) {
  const [metricsResult, metricHistoryResult, poolsResult, vmsResult, storageResult, networksResult] = await Promise.allSettled([
    apiClient.getHostMetrics(row?.ref),
    apiClient.getHostMetricHistory(row?.ref),
    apiClient.getPools(),
    apiClient.getVMs(),
    apiClient.getSRs(),
    apiClient.getNetworks(),
  ]);

  return {
    hostMetrics: metricsResult.status === 'fulfilled' ? (metricsResult.value || {}) : {},
    hostMetricHistory: metricHistoryResult.status === 'fulfilled' ? (metricHistoryResult.value || { metrics: [] }) : { metrics: [] },
    relatedPools: poolsResult.status === 'fulfilled' ? (poolsResult.value.data || []) : [],
    relatedVMs: vmsResult.status === 'fulfilled' ? (vmsResult.value.data || []) : [],
    relatedStorage: storageResult.status === 'fulfilled' ? (storageResult.value.data || []) : [],
    relatedNetworks: networksResult.status === 'fulfilled' ? (networksResult.value.data || []) : [],
    metricsError: metricsResult.status === 'rejected'
      ? (metricsResult.reason?.message || 'Unable to load metrics')
      : null,
    inventoryError: (
      poolsResult.status === 'rejected'
      && vmsResult.status === 'rejected'
      && storageResult.status === 'rejected'
      && networksResult.status === 'rejected'
    )
      ? 'Unable to map related pool and host inventory.'
      : null,
  };
}

function buildHostLoggingUpdatePayload(selectedHost = null, payload = {}) {
  return {
    nameLabel: selectedHost?.name_label || selectedHost?.hostname || selectedHost?.ref,
    nameDescription: selectedHost?.name_description || '',
    logging: payload.logging || {},
  };
}

function buildHostGuestVcpusUpdatePayload(selectedHost = null, payload = {}) {
  return {
    nameLabel: selectedHost?.name_label || selectedHost?.hostname || selectedHost?.ref,
    nameDescription: selectedHost?.name_description || '',
    tags: Array.isArray(selectedHost?.tags) ? selectedHost.tags : [],
    guestVcpusParams: payload.guestVcpusParams || {},
  };
}

function buildHostSchedulerUpdatePayload(selectedHost = null, payload = {}) {
  return {
    nameLabel: selectedHost?.name_label || selectedHost?.hostname || selectedHost?.ref,
    nameDescription: selectedHost?.name_description || '',
    tags: Array.isArray(selectedHost?.tags) ? selectedHost.tags : [],
    schedGran: payload.schedGran || 'cpu',
  };
}

if (typeof module !== 'undefined') {
  module.exports = {
    buildHostGuestVcpusUpdatePayload,
    buildHostLoggingUpdatePayload,
    buildHostSchedulerUpdatePayload,
    loadHostConnectionRecords,
    loadHostCredentialRecords,
    loadHostDetailContext,
    loadHostRecords,
    loadHostTargetRecords,
  };
}
