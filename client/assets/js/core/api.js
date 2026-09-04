/* ============================================
   API Client
   ============================================ */

function appendTargetKey(path, targetKey = '') {
  const normalizedTargetKey = String(targetKey || '').trim();
  if (!normalizedTargetKey) return path;

  const url = new URL(path, window.location.origin);
  url.searchParams.set('targetKey', normalizedTargetKey);
  return `${url.pathname}${url.search}`;
}

let csrfToken = '';

function rememberCsrfToken(response, data) {
  csrfToken = response.headers.get('X-CSRF-Token') || data?.csrfToken || csrfToken;
}

function seedCsrfToken(token) {
  if (token) csrfToken = token;
}

function csrfHeaders() {
  return csrfToken ? { 'X-CSRF-Token': csrfToken } : {};
}

const api = {
  async request(method, url, body) {
    if (store.demoMode) {
      return demoRequest(method, url, body);
    }

    const options = {
      method,
      headers: { 'Content-Type': 'application/json', ...(method === 'GET' ? {} : csrfHeaders()) },
      credentials: 'same-origin',
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    const data = await response.json();
    rememberCsrfToken(response, data);

    if (!response.ok) {
      const error = new Error(data.message || data.error || 'REQUEST_FAILED');
      error.code = data.error || 'REQUEST_FAILED';
      error.payload = data;
      throw error;
    }

    return data;
  },
  csrfHeaders,
  login: (username, password) => api.request('POST', '/api/auth/login', { username, password }),
  xenLogin: (host, username, password, options = {}) => api.request('POST', '/api/auth/xen-login', {
    host,
    username,
    password,
    vaultCredentialId: options.vaultCredentialId || null,
    connectionId: options.connectionId || null,
    hostTargetId: options.hostTargetId || null,
    connectionName: options.connectionName || '',
    port: options.port || 443,
  }),
  logout: () => api.request('POST', '/api/auth/logout'),
  status: () => api.request('GET', '/api/auth/status'),
  getLiveTargets: () => api.request('GET', '/api/auth/targets'),
  activateLiveTarget: (payload = {}) => api.request('POST', '/api/auth/targets/activate', payload),
  detachLiveTarget: (targetKey) => api.request('DELETE', `/api/auth/targets/${encodeURIComponent(targetKey)}`),
  dashboard: (targetKey = '') => api.request('GET', appendTargetKey('/api/dashboard', targetKey)),
  dashboardMessages: (targetKey = '') => api.request('GET', appendTargetKey('/api/dashboard/messages', targetKey)),
  getAlerts: (targetKey = '') => api.request('GET', appendTargetKey('/api/alerts', targetKey)),
  updateAlertState: (ref, payload) => api.request('PUT', `/api/alerts/${encodeURIComponent(ref)}/state`, payload),
  bulkUpdateAlertState: (refs, state) => api.request('PUT', '/api/alerts/bulk-state', { refs, state }),
  getAlertPolicies: () => api.request('GET', '/api/alerts/policies'),
  createAlertPolicy: (payload) => api.request('POST', '/api/alerts/policies', payload),
  updateAlertPolicy: (id, payload) => api.request('PUT', `/api/alerts/policies/${encodeURIComponent(id)}`, payload),
  deleteAlertPolicy: (id, payload = null) => api.request('DELETE', `/api/alerts/policies/${encodeURIComponent(id)}`, payload),
  getTasks: (targetKey = '') => api.request('GET', appendTargetKey('/api/tasks', targetKey)),
  createRemediationTask: (payload) => api.request('POST', '/api/tasks/remediation', payload),
  queueRemediationTemplate: (payload) => api.request('POST', '/api/tasks/remediation', payload),
  updateRemediationTask: (ref, payload) => api.request('PUT', `/api/tasks/remediation/${encodeURIComponent(ref)}`, payload),
  getRemediationTemplates: () => api.request('GET', '/api/tasks/remediation/templates'),
  createRemediationTemplate: (payload) => api.request('POST', '/api/tasks/remediation/templates', payload),
  updateRemediationTemplate: (id, payload) => api.request('PUT', `/api/tasks/remediation/templates/${encodeURIComponent(id)}`, payload),
  deleteRemediationTemplate: (id, payload = null) => api.request('DELETE', `/api/tasks/remediation/templates/${encodeURIComponent(id)}`, payload),
  getAuditLog: () => api.request('GET', '/api/audit'),
  getLogs: (targetKey = '') => api.request('GET', appendTargetKey('/api/logs', targetKey)),
  getClusterMetrics: (range = '24h', targetKey = '') => api.request('GET', appendTargetKey(`/api/metrics/cluster?range=${encodeURIComponent(range)}`, targetKey)),
  getCapacityBaseline: (targetKey = '') => api.request('GET', appendTargetKey('/api/metrics/capacity-baseline', targetKey)),
  collectMetricsSnapshot: () => api.request('POST', '/api/metrics/collect'),
  getRrdUpdates: (options = {}) => {
    const params = new URLSearchParams();
    if (options.start !== undefined && options.start !== null && options.start !== '') params.set('start', String(options.start));
    if (options.cf) params.set('cf', String(options.cf));
    if (options.interval) params.set('interval', String(options.interval));
    if (options.host !== undefined && options.host !== null) params.set('host', String(Boolean(options.host)));
    return api.request('GET', `/api/metrics/rrd-updates${params.toString() ? `?${params.toString()}` : ''}`);
  },
  getHostMetricHistory: (ref, range = '24h', targetKey = '') => api.request('GET', appendTargetKey(`/api/metrics/hosts/${encodeURIComponent(ref)}?range=${encodeURIComponent(range)}`, targetKey)),
  getVmMetricHistory: (ref, range = '24h', targetKey = '') => api.request('GET', appendTargetKey(`/api/metrics/vms/${encodeURIComponent(ref)}?range=${encodeURIComponent(range)}`, targetKey)),
  getStorageMetricHistory: (ref, range = '24h', targetKey = '') => api.request('GET', appendTargetKey(`/api/metrics/storage/${encodeURIComponent(ref)}?range=${encodeURIComponent(range)}`, targetKey)),
  getGovernance: (targetKey = '') => api.request('GET', appendTargetKey('/api/governance', targetKey)),
  getUsers: () => api.request('GET', '/api/users'),
  createUser: (payload) => api.request('POST', '/api/users', payload),
  updateUser: (id, payload) => api.request('PUT', `/api/users/${encodeURIComponent(id)}`, payload),
  resetUserPassword: (id, payload) => api.request('POST', `/api/users/${encodeURIComponent(id)}/password`, payload),
  getApiTokens: (userId) => api.request('GET', `/api/governance/api-tokens/${encodeURIComponent(userId)}`),
  createApiToken: (userId, payload) => api.request('POST', `/api/governance/api-tokens/${encodeURIComponent(userId)}`, payload),
  revokeApiToken: (tokenId) => api.request('DELETE', `/api/governance/api-tokens/${encodeURIComponent(tokenId)}`),
  getGroups: () => api.request('GET', '/api/groups'),
  createGroup: (payload) => api.request('POST', '/api/groups', payload),
  updateGroup: (id, payload) => api.request('PUT', `/api/groups/${encodeURIComponent(id)}`, payload),
  deleteGroup: (id, payload = null) => api.request('DELETE', `/api/groups/${encodeURIComponent(id)}`, payload),
  getSystemConfig: () => api.request('GET', '/api/settings'),
  rewrapVaultCredentials: () => api.request('POST', '/api/settings/vault/rewrap', {}),
  saveSystemConfigSection: (section, payload) => api.request('PUT', `/api/settings/${encodeURIComponent(section)}`, payload),
  previewRetentionSweep: (domain = '') => api.request('GET', `/api/settings/retention/preview${domain ? `?domain=${encodeURIComponent(domain)}` : ''}`),
  runRetentionSweep: (payload = {}) => api.request('POST', '/api/settings/retention/run', payload),
  saveRetentionPolicy: (domain, payload) => api.request('PUT', `/api/settings/retention/policies/${encodeURIComponent(domain)}`, payload),
  saveGovernancePolicy: (payload) => api.request('PUT', '/api/governance/policy', payload),
  setGovernanceRole: (role) => api.request('PUT', '/api/governance/role', { role }),
  activateBreakGlass: (payload) => api.request('POST', '/api/governance/break-glass/activate', payload),
  deactivateBreakGlass: () => api.request('POST', '/api/governance/break-glass/deactivate', {}),
  saveGovernanceQuota: (ref, payload) => api.request('PUT', `/api/governance/quotas/${encodeURIComponent(ref)}`, payload),
  deleteGovernanceQuota: (ref, payload = null) => api.request('DELETE', `/api/governance/quotas/${encodeURIComponent(ref)}`, payload),
  requestGovernanceApproval: (payload) => api.request('POST', '/api/governance/approvals', payload),
  decideGovernanceApproval: (id, payload) => api.request('POST', `/api/governance/approvals/${encodeURIComponent(id)}/decision`, payload),
  getResilience: () => api.request('GET', '/api/resilience'),
  getResilienceRunbooks: () => api.request('GET', '/api/resilience/plans'),
  getResilienceDrills: () => api.request('GET', '/api/resilience/drills'),
  saveResilienceRunbook: (ref, payload) => api.request('PUT', `/api/resilience/plans/${encodeURIComponent(ref)}`, payload),
  deleteResilienceRunbook: (ref, payload = null) => api.request('DELETE', `/api/resilience/plans/${encodeURIComponent(ref)}`, payload),
  logResilienceDrill: (ref, payload) => api.request('POST', `/api/resilience/drills/${encodeURIComponent(ref)}`, payload),
  getLifecyclePlans: () => api.request('GET', '/api/lifecycle/plans'),
  saveLifecyclePlan: (ref, payload) => api.request('PUT', `/api/lifecycle/plans/${encodeURIComponent(ref)}`, payload),
  deleteLifecyclePlan: (ref, payload = null) => api.request('DELETE', `/api/lifecycle/plans/${encodeURIComponent(ref)}`, payload),
  getVMs: (search = '', targetKey = '') => api.request('GET', appendTargetKey(`/api/vms${search ? `?search=${encodeURIComponent(search)}` : ''}`, targetKey)),
  createVM: (payload) => api.request('POST', '/api/vms', payload),
  getVMGroups: () => api.request('GET', '/api/vms/groups'),
  getVmCreationSources: () => api.request('GET', '/api/vms/creation-sources'),
  getVmGpuProfiles: () => api.request('GET', '/api/vms/gpu-profiles'),
  getVMAppliances: () => api.request('GET', '/api/vms/appliances'),
  getVMSnapshotSchedules: () => api.request('GET', '/api/vms/snapshot-schedules'),
  getTemplates: () => api.request('GET', '/api/vms/templates'),
  createVmTemplate: (payload) => api.request('POST', '/api/vms/templates', payload),
  getTemplateGovernance: () => api.request('GET', '/api/vms/templates/governance'),
  saveTemplateGovernance: (ref, payload) => api.request('PUT', `/api/vms/templates/${encodeURIComponent(ref)}/governance`, payload),
  getTemplateGovernanceHistory: (ref) => api.request('GET', `/api/vms/templates/${encodeURIComponent(ref)}/history`),
  restoreTemplateGovernanceHistory: (ref, id) => api.request('POST', `/api/vms/templates/${encodeURIComponent(ref)}/history/${encodeURIComponent(id)}/restore`, {}),
  promoteTemplateGovernance: (ref, payload) => api.request('POST', `/api/vms/templates/${encodeURIComponent(ref)}/promote`, payload),
  getTemplateDeployments: () => api.request('GET', '/api/vms/templates/deployments'),
  updateTemplateDeploymentValidation: (id, payload) => api.request('PUT', `/api/vms/templates/deployments/${encodeURIComponent(id)}/validation`, payload),
  deployTemplate: (ref, payload) => api.request('POST', `/api/vms/templates/${encodeURIComponent(ref)}/deploy`, payload),
  dryRunCompose: (spec) => api.request('POST', '/api/vms/compose/dry-run', spec),
  deployCompose: (spec) => api.request('POST', '/api/vms/compose/deploy', spec),
  getCatalog: () => api.request('GET', '/api/catalog'),
  getCatalogEntry: (slug) => api.request('GET', `/api/catalog/${encodeURIComponent(slug)}`),
  submitCatalogRequest: (slug, parameters) => api.request('POST', `/api/catalog/${encodeURIComponent(slug)}/requests`, { parameters }),
  getMyCatalogRequests: () => api.request('GET', '/api/catalog/requests/mine'),
  runCatalogDay2Action: (id, payload) => api.request('POST', `/api/catalog/requests/${encodeURIComponent(id)}/actions`, payload),
  getCatalogAdminEntries: () => api.request('GET', '/api/catalog/admin/entries'),
  getCatalogEntryVersions: (id) => api.request('GET', `/api/catalog/admin/entries/${encodeURIComponent(id)}/versions`),
  validateCatalogEntryVersion: (entryId, versionId, payload) => api.request('PUT', `/api/catalog/admin/entries/${encodeURIComponent(entryId)}/versions/${encodeURIComponent(versionId)}/validation`, payload),
  publishCatalogEntry: (id) => api.request('POST', `/api/catalog/admin/entries/${encodeURIComponent(id)}/publish`),
  getCatalogAdminRequests: () => api.request('GET', '/api/catalog/admin/requests'),
  getCatalogAnalytics: () => api.request('GET', '/api/catalog/admin/analytics'),
  getCatalogHookAttempts: (id) => api.request('GET', `/api/catalog/admin/requests/${encodeURIComponent(id)}/hook-attempts`),
  createCatalogEntry: (payload) => api.request('POST', '/api/catalog', payload),
  updateCatalogEntry: (id, payload) => api.request('PUT', `/api/catalog/${encodeURIComponent(id)}`, payload),
  deleteCatalogEntry: (id) => api.request('DELETE', `/api/catalog/${encodeURIComponent(id)}`),
  reviewCatalogRequest: (id, status) => api.request('PUT', `/api/catalog/admin/requests/${encodeURIComponent(id)}`, { status }),
  deployCatalogRequest: (id) => api.request('POST', `/api/catalog/admin/requests/${encodeURIComponent(id)}/deploy`, {}),
  getTemplateLibraryTree: () => api.request('GET', '/api/template-library/tree'),
  createTemplateLibraryFolder: (payload) => api.request('POST', '/api/template-library/folders', payload),
  renameTemplateLibraryFolder: (id, name) => api.request('PUT', `/api/template-library/folders/${encodeURIComponent(id)}`, { name }),
  moveTemplateLibraryFolder: (id, parentId) => api.request('POST', `/api/template-library/folders/${encodeURIComponent(id)}/move`, { parentId }),
  deleteTemplateLibraryFolder: (id) => api.request('DELETE', `/api/template-library/folders/${encodeURIComponent(id)}`),
  createTemplateLibraryItem: (payload) => api.request('POST', '/api/template-library/items', payload),
  getTemplateLibraryItem: (id) => api.request('GET', `/api/template-library/items/${encodeURIComponent(id)}`),
  getTemplateLibraryItemVersions: (id) => api.request('GET', `/api/template-library/items/${encodeURIComponent(id)}/versions`),
  renameTemplateLibraryItem: (id, name) => api.request('PUT', `/api/template-library/items/${encodeURIComponent(id)}/rename`, { name }),
  moveTemplateLibraryItem: (id, folderId) => api.request('POST', `/api/template-library/items/${encodeURIComponent(id)}/move`, { folderId }),
  saveTemplateLibraryItem: (id, content) => api.request('PUT', `/api/template-library/items/${encodeURIComponent(id)}`, { content }),
  deleteTemplateLibraryItem: (id) => api.request('DELETE', `/api/template-library/items/${encodeURIComponent(id)}`),
  exportVM: async (ref, options = {}) => {
    const metadataOnly = options.metadataOnly ? 'true' : 'false';
    const url = `/api/vms/${encodeURIComponent(ref)}/export?metadataOnly=${encodeURIComponent(metadataOnly)}`;

    if (store.demoMode) {
      const payload = await demoRequest('GET', url);
      const blob = new Blob([payload.content || ''], { type: payload.contentType || 'application/octet-stream' });
      return {
        blob,
        filename: payload.filename || 'vm-export.xva',
        contentType: payload.contentType || 'application/octet-stream',
      };
    }

    const response = await fetch(url, {
      method: 'GET',
      credentials: 'same-origin',
    });

    if (!response.ok) {
      let errorPayload = {};
      try {
        errorPayload = await response.json();
      } catch (error) {
        errorPayload = {};
      }
      const requestError = new Error(errorPayload.error || 'VM_EXPORT_FAILED');
      requestError.code = errorPayload.error || 'VM_EXPORT_FAILED';
      throw requestError;
    }

    const blob = await response.blob();
    const disposition = response.headers.get('content-disposition') || '';
    const match = disposition.match(/filename=\"?([^\";]+)\"?/i);
    return {
      blob,
      filename: match?.[1] || 'vm-export.xva',
      contentType: blob.type || 'application/octet-stream',
    };
  },
  importVM: async (payload = {}) => {
    const query = new URLSearchParams();
    if (payload.srRef) query.set('srRef', payload.srRef);
    if (payload.restore) query.set('restore', 'true');
    if (payload.force) query.set('force', 'true');
    if (payload.metadataOnly) query.set('metadataOnly', 'true');
    const url = `/api/vms/import${query.toString() ? `?${query.toString()}` : ''}`;

    if (store.demoMode) {
      return demoRequest('PUT', url, payload);
    }

    const response = await fetch(url, {
      method: 'PUT',
      body: payload.file,
      headers: {
        'Content-Type': 'application/octet-stream',
        'X-Xenmange-Filename': payload.fileName || payload.file?.name || 'package.xva',
        ...csrfHeaders(),
      },
      credentials: 'same-origin',
    });

    const data = await response.json();
    if (!response.ok) {
      const requestError = new Error(data.error || 'VM_IMPORT_FAILED');
      requestError.code = data.error || 'VM_IMPORT_FAILED';
      requestError.payload = data;
      throw requestError;
    }
    return data;
  },
  getVM: (ref) => api.request('GET', `/api/vms/${encodeURIComponent(ref)}`),
  getVMCompatibility: (ref) => api.request('GET', `/api/vms/${encodeURIComponent(ref)}/compatibility`),
  getVMConsoles: (ref) => api.request('GET', `/api/vms/${encodeURIComponent(ref)}/consoles`),
  duplicateVM: (ref, payload) => api.request('POST', `/api/vms/${encodeURIComponent(ref)}/duplicate`, payload),
  migrateVM: (ref, payload) => api.request('POST', `/api/vms/${encodeURIComponent(ref)}/migrate`, payload),
  getVMSnapshots: (ref) => api.request('GET', `/api/vms/${encodeURIComponent(ref)}/snapshots`),
  vmAction: (action, ref, options = {}) => api.request('POST', `/api/vms/${action}`, { ref, ...options }),
  updateVMConfig: (ref, payload) => api.request('PUT', `/api/vms/${encodeURIComponent(ref)}/config`, payload),
  addVMDisk: (ref, payload) => api.request('POST', `/api/vms/${encodeURIComponent(ref)}/disks`, payload),
  addVMNic: (ref, payload) => api.request('POST', `/api/vms/${encodeURIComponent(ref)}/nics`, payload),
  disconnectVMNic: (ref, vifRef, payload = {}) => api.request('POST', `/api/vms/${encodeURIComponent(ref)}/nics/${encodeURIComponent(vifRef)}/disconnect`, payload),
  removeVMNic: (ref, vifRef, payload = {}) => api.request('DELETE', `/api/vms/${encodeURIComponent(ref)}/nics/${encodeURIComponent(vifRef)}`, payload),
  createVMSnapshot: (ref, payload) => api.request('POST', `/api/vms/${encodeURIComponent(ref)}/snapshots`, payload),
  revertVMSnapshot: (ref, snapshotRef, payload = {}) => api.request('POST', `/api/vms/${encodeURIComponent(ref)}/snapshots/${encodeURIComponent(snapshotRef)}/revert`, payload),
  deleteVMSnapshot: (ref, snapshotRef, payload = {}) => api.request('DELETE', `/api/vms/${encodeURIComponent(ref)}/snapshots/${encodeURIComponent(snapshotRef)}`, payload),
  getHosts: (targetKey = '') => api.request('GET', appendTargetKey('/api/hosts', targetKey)),
  getHostMetrics: (ref, targetKey = '') => api.request('GET', appendTargetKey(`/api/hosts/${encodeURIComponent(ref)}/metrics`, targetKey)),
  updateHostConfig: (ref, payload) => api.request('PUT', `/api/hosts/${encodeURIComponent(ref)}/config`, payload),
  enterHostMaintenance: (ref, payload) => api.request('POST', `/api/hosts/${encodeURIComponent(ref)}/maintenance/enter`, payload),
  exitHostMaintenance: (ref, payload = {}) => api.request('POST', `/api/hosts/${encodeURIComponent(ref)}/maintenance/exit`, payload),
  setHostMultipathing: (ref, payload) => api.request('POST', `/api/hosts/${encodeURIComponent(ref)}/multipathing`, payload),
  rebootHost: (ref, payload = {}) => api.request('POST', `/api/hosts/${encodeURIComponent(ref)}/reboot`, payload),
  shutdownHost: (ref, payload = {}) => api.request('POST', `/api/hosts/${encodeURIComponent(ref)}/shutdown`, payload),
  getSRs: (targetKey = '') => api.request('GET', appendTargetKey('/api/storage', targetKey)),
  createSR: (payload) => api.request('POST', '/api/storage', payload),
  probeSR: (payload) => api.request('POST', '/api/storage/probe', payload),
  importSR: (payload) => api.request('POST', '/api/storage/import', payload),
  updateSRConfig: (ref, payload) => api.request('PUT', `/api/storage/${encodeURIComponent(ref)}/config`, payload),
  setSRLocalCache: (ref, payload) => api.request('POST', `/api/storage/${encodeURIComponent(ref)}/local-cache`, payload),
  getSRVDIs: (ref) => api.request('GET', `/api/storage/${encodeURIComponent(ref)}/vdis`),
  repairSR: (ref, payload = {}) => api.request('POST', `/api/storage/${encodeURIComponent(ref)}/repair`, payload),
  rescanSR: (ref, payload = {}) => api.request('POST', `/api/storage/${encodeURIComponent(ref)}/rescan`, payload),
  forgetSR: (ref, payload = {}) => api.request('POST', `/api/storage/${encodeURIComponent(ref)}/forget`, payload),
  destroySR: (ref, payload = {}) => api.request('POST', `/api/storage/${encodeURIComponent(ref)}/destroy`, payload),
  createStorageVdi: (ref, payload) => api.request('POST', `/api/storage/${encodeURIComponent(ref)}/vdis`, payload),
  resizeStorageVdi: (ref, vdiRef, payload) => api.request('POST', `/api/storage/${encodeURIComponent(ref)}/vdis/${encodeURIComponent(vdiRef)}/resize`, payload),
  deleteStorageVdi: (ref, vdiRef, payload = null) => api.request('DELETE', `/api/storage/${encodeURIComponent(ref)}/vdis/${encodeURIComponent(vdiRef)}`, payload),
  cloneStorageVdi: (ref, vdiRef, payload = {}) => api.request('POST', `/api/storage/${encodeURIComponent(ref)}/vdis/${encodeURIComponent(vdiRef)}/clone`, payload),
  attachStorageVdiAsCd: (ref, vdiRef, payload) => api.request('POST', `/api/storage/${encodeURIComponent(ref)}/vdis/${encodeURIComponent(vdiRef)}/attach-cd`, payload),
  listStorageFiles: (ref, path = '') => api.request('GET', `/api/storage/${encodeURIComponent(ref)}/files?path=${encodeURIComponent(path)}`),
  mkdirStorageFile: (ref, payload) => api.request('POST', `/api/storage/${encodeURIComponent(ref)}/files/mkdir`, payload),
  moveStorageFile: (ref, payload) => api.request('POST', `/api/storage/${encodeURIComponent(ref)}/files/move`, payload),
  deleteStorageFile: (ref, path, approvalId = '') => api.request('DELETE', `/api/storage/${encodeURIComponent(ref)}/files?path=${encodeURIComponent(path)}${approvalId ? `&approvalId=${encodeURIComponent(approvalId)}` : ''}`),
  downloadStorageFileUrl: (ref, path) => `/api/storage/${encodeURIComponent(ref)}/files/download?path=${encodeURIComponent(path)}`,
  uploadStorageFile: async (ref, path, file) => {
    if (store.demoMode) {
      return demoRequest('POST', `/api/storage/${encodeURIComponent(ref)}/files/upload`, { path, fileName: file.name, sizeBytes: file.size });
    }
    const formData = new FormData();
    formData.append('path', path || '');
    formData.append('file', file);
    const response = await fetch(`/api/storage/${encodeURIComponent(ref)}/files/upload`, {
      method: 'POST',
      body: formData,
      headers: csrfHeaders(),
      credentials: 'same-origin',
    });
    const data = await response.json();
    if (!response.ok) {
      const error = new Error(data.message || data.error || 'UPLOAD_FAILED');
      error.code = data.error || 'UPLOAD_FAILED';
      throw error;
    }
    return data;
  },
  getNetworks: (targetKey = '') => api.request('GET', appendTargetKey('/api/networks', targetKey)),
  getNetworkInterfaces: () => api.request('GET', '/api/networks/interfaces'),
  updateNetworkInterfaceConfig: (vifRef, payload) => api.request('PUT', `/api/networks/interfaces/${encodeURIComponent(vifRef)}/config`, payload),
  createNetwork: (payload) => api.request('POST', '/api/networks', payload),
  createNetworkVlan: (payload) => api.request('POST', '/api/networks/vlans', payload),
  createNetworkBond: (payload) => api.request('POST', '/api/networks/bonds', payload),
  updateNetworkConfig: (ref, payload) => api.request('PUT', `/api/networks/${encodeURIComponent(ref)}/config`, payload),
  destroyNetwork: (ref, payload = {}) => api.request('POST', `/api/networks/${encodeURIComponent(ref)}/destroy`, payload),
  getPools: (targetKey = '') => api.request('GET', appendTargetKey('/api/pools', targetKey)),
  getPool: (ref, targetKey = '') => api.request('GET', appendTargetKey(`/api/pools/${encodeURIComponent(ref)}`, targetKey)),
  updatePoolConfig: (ref, payload) => api.request('PUT', `/api/pools/${encodeURIComponent(ref)}/config`, payload),
  updatePoolHaState: (ref, payload) => api.request('POST', `/api/pools/${encodeURIComponent(ref)}/ha`, payload),
  joinPool: (payload) => api.request('POST', '/api/pools/join', payload),
  ejectPoolHost: (ref, payload) => api.request('POST', `/api/pools/${encodeURIComponent(ref)}/eject`, payload),
  getPoolUpdates: (ref, targetKey = '') => api.request('GET', appendTargetKey(`/api/pools/${encodeURIComponent(ref)}/updates`, targetKey)),
  getCredentials: () => api.request('GET', '/api/credentials'),
  createCredential: (payload) => api.request('POST', '/api/credentials', payload),
  updateCredential: (id, payload) => api.request('PUT', `/api/credentials/${encodeURIComponent(id)}`, payload),
  deleteCredential: (id, payload = null) => api.request('DELETE', `/api/credentials/${encodeURIComponent(id)}`, payload),
  getConnections: () => api.request('GET', '/api/connections'),
  saveConnection: (payload) => api.request('POST', '/api/connections', payload),
  updateConnection: (id, payload) => api.request('PUT', `/api/connections/${id}`, payload),
  deleteConnection: (id, payload = null) => api.request('DELETE', `/api/connections/${id}`, payload),
  setDefaultConnection: (id) => api.request('POST', `/api/connections/${id}/default`),
  getInventoryWorkspaces: () => api.request('GET', '/api/workspaces/inventory'),
  createInventoryWorkspace: (payload) => api.request('POST', '/api/workspaces/inventory', payload),
  updateInventoryWorkspace: (id, payload) => api.request('PUT', `/api/workspaces/inventory/${encodeURIComponent(id)}`, payload),
  deleteInventoryWorkspace: (id, payload = null) => api.request('DELETE', `/api/workspaces/inventory/${encodeURIComponent(id)}`, payload),
  getHostTargets: () => api.request('GET', '/api/host-targets'),
  saveHostTarget: (payload) => api.request('POST', '/api/host-targets', payload),
  updateHostTarget: (id, payload) => api.request('PUT', `/api/host-targets/${id}`, payload),
  deleteHostTarget: (id, payload = null) => api.request('DELETE', `/api/host-targets/${id}`, payload),
  getVFabrics: () => api.request('GET', '/api/vfabrics'),
  getVFabricScope: (id) => api.request('GET', `/api/vfabrics/${encodeURIComponent(id)}/scope`),
  getVFabricQuota: (id) => api.request('GET', `/api/vfabrics/${encodeURIComponent(id)}/quota`),
  createVFabric: (payload) => api.request('POST', '/api/vfabrics', payload),
  updateVFabric: (id, payload) => api.request('PUT', `/api/vfabrics/${id}`, payload),
  deleteVFabric: (id, payload = null) => api.request('DELETE', `/api/vfabrics/${id}`, payload),
  saveVFabricQuota: (id, payload) => api.request('PUT', `/api/vfabrics/${encodeURIComponent(id)}/quota`, payload),
  deleteVFabricQuota: (id, payload = null) => api.request('DELETE', `/api/vfabrics/${encodeURIComponent(id)}/quota`, payload),
  getProfile: () => api.request('GET', '/api/profile'),
  updateProfile: (payload) => api.request('PUT', '/api/profile', payload),
  changeProfilePassword: (payload) => api.request('POST', '/api/profile/password', payload),
  setProfileTheme: (theme) => api.request('PUT', '/api/profile/theme', { theme }),
  removeProfileAvatar: () => api.request('DELETE', '/api/profile/avatar'),
  uploadProfileAvatar: async (file) => {
    if (store.demoMode) {
      demoProfileState.avatar_path = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"%3E%3Crect width="64" height="64" fill="%23091a12"/%3E%3Ccircle cx="32" cy="24" r="12" fill="%2300ff41"/%3E%3Cpath d="M10 60c2-16 12-24 22-24s20 8 22 24" fill="%2300ff41"/%3E%3C/svg%3E';
      return { data: clone(demoProfileState) };
    }
    const formData = new FormData();
    formData.append('avatar', file);
    const response = await fetch('/api/profile/avatar', {
      method: 'POST',
      body: formData,
      headers: csrfHeaders(),
      credentials: 'same-origin',
    });
    const data = await response.json();
    if (!response.ok) {
      const error = new Error(data.message || data.error || 'UPLOAD_FAILED');
      error.code = data.error || 'UPLOAD_FAILED';
      throw error;
    }
    return data;
  },
  mfaBeginEnrollment: () => api.request('POST', '/api/profile/mfa/enroll'),
  mfaConfirmEnrollment: (token) => api.request('POST', '/api/profile/mfa/verify', { token }),
  mfaDisable: (currentPassword) => api.request('POST', '/api/profile/mfa/disable', { currentPassword }),
  loginMfaVerify: (token) => api.request('POST', '/api/auth/mfa/verify', { token }),
  getPushVapidPublicKey: () => api.request('GET', '/api/profile/push/vapid-public-key'),
  getPushSubscriptions: () => api.request('GET', '/api/profile/push'),
  subscribePush: (payload) => api.request('POST', '/api/profile/push/subscribe', payload),
  unsubscribePush: (endpoint) => api.request('DELETE', '/api/profile/push/subscribe', { endpoint }),
  sendTestPushNotification: () => api.request('POST', '/api/profile/push/test'),
};

if (typeof module !== 'undefined') {
  module.exports = { api, appendTargetKey };
}
