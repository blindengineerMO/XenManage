function appendTargetKey(path, targetKey = '') {
  const normalizedTargetKey = String(targetKey || '').trim();
  if (!normalizedTargetKey) return path;

  const url = new URL(path, window.location.origin);
  url.searchParams.set('targetKey', normalizedTargetKey);
  return `${url.pathname}${url.search}`;
}

const api = {
  async request(method, url, body) {
    if (store.demoMode) {
      return demoRequest(method, url, body);
    }

    const options = {
      method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    const data = await response.json();

    if (!response.ok) {
      const error = new Error(data.message || data.error || 'REQUEST_FAILED');
      error.code = data.error || 'REQUEST_FAILED';
      error.payload = data;
      throw error;
    }

    return data;
  },
  login: (username, password) => api.request('POST', '/api/auth/login', { username, password }),
  xenLogin: (host, username, password, options = {}) => api.request('POST', '/api/auth/xen-login', {
    host,
    username,
    password,
    vaultCredentialId: options.vaultCredentialId || null,
    connectionId: options.connectionId || null,
    connectionName: options.connectionName || '',
    port: options.port || 443,
  }),
  logout: () => api.request('POST', '/api/auth/logout'),
  status: () => api.request('GET', '/api/auth/status'),
  getLiveTargets: () => api.request('GET', '/api/auth/targets'),
  activateLiveTarget: (payload = {}) => api.request('POST', '/api/auth/targets/activate', payload),
  detachLiveTarget: (targetKey) => api.request('DELETE', `/api/auth/targets/${encodeURIComponent(targetKey)}`),
  dashboard: () => api.request('GET', '/api/dashboard'),
  dashboardMessages: () => api.request('GET', '/api/dashboard/messages'),
  getAlerts: () => api.request('GET', '/api/alerts'),
  updateAlertState: (ref, payload) => api.request('PUT', `/api/alerts/${encodeURIComponent(ref)}/state`, payload),
  bulkUpdateAlertState: (refs, state) => api.request('PUT', '/api/alerts/bulk-state', { refs, state }),
  getAlertPolicies: () => api.request('GET', '/api/alerts/policies'),
  createAlertPolicy: (payload) => api.request('POST', '/api/alerts/policies', payload),
  updateAlertPolicy: (id, payload) => api.request('PUT', `/api/alerts/policies/${encodeURIComponent(id)}`, payload),
  deleteAlertPolicy: (id, payload = null) => api.request('DELETE', `/api/alerts/policies/${encodeURIComponent(id)}`, payload),
  getTasks: () => api.request('GET', '/api/tasks'),
  createRemediationTask: (payload) => api.request('POST', '/api/tasks/remediation', payload),
  queueRemediationTemplate: (payload) => api.request('POST', '/api/tasks/remediation', payload),
  updateRemediationTask: (ref, payload) => api.request('PUT', `/api/tasks/remediation/${encodeURIComponent(ref)}`, payload),
  getRemediationTemplates: () => api.request('GET', '/api/tasks/remediation/templates'),
  createRemediationTemplate: (payload) => api.request('POST', '/api/tasks/remediation/templates', payload),
  updateRemediationTemplate: (id, payload) => api.request('PUT', `/api/tasks/remediation/templates/${encodeURIComponent(id)}`, payload),
  deleteRemediationTemplate: (id, payload = null) => api.request('DELETE', `/api/tasks/remediation/templates/${encodeURIComponent(id)}`, payload),
  getAuditLog: () => api.request('GET', '/api/audit'),
  getLogs: () => api.request('GET', '/api/logs'),
  getClusterMetrics: (range = '24h') => api.request('GET', `/api/metrics/cluster?range=${encodeURIComponent(range)}`),
  getCapacityBaseline: () => api.request('GET', '/api/metrics/capacity-baseline'),
  collectMetricsSnapshot: () => api.request('POST', '/api/metrics/collect'),
  getRrdUpdates: (options = {}) => {
    const params = new URLSearchParams();
    if (options.start !== undefined && options.start !== null && options.start !== '') params.set('start', String(options.start));
    if (options.cf) params.set('cf', String(options.cf));
    if (options.interval) params.set('interval', String(options.interval));
    if (options.host !== undefined && options.host !== null) params.set('host', String(Boolean(options.host)));
    return api.request('GET', `/api/metrics/rrd-updates${params.toString() ? `?${params.toString()}` : ''}`);
  },
  getHostMetricHistory: (ref, range = '24h') => api.request('GET', `/api/metrics/hosts/${encodeURIComponent(ref)}?range=${encodeURIComponent(range)}`),
  getVmMetricHistory: (ref, range = '24h') => api.request('GET', `/api/metrics/vms/${encodeURIComponent(ref)}?range=${encodeURIComponent(range)}`),
  getStorageMetricHistory: (ref, range = '24h') => api.request('GET', `/api/metrics/storage/${encodeURIComponent(ref)}?range=${encodeURIComponent(range)}`),
  getGovernance: () => api.request('GET', '/api/governance'),
  getUsers: () => api.request('GET', '/api/users'),
  createUser: (payload) => api.request('POST', '/api/users', payload),
  updateUser: (id, payload) => api.request('PUT', `/api/users/${encodeURIComponent(id)}`, payload),
  resetUserPassword: (id, payload) => api.request('POST', `/api/users/${encodeURIComponent(id)}/password`, payload),
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
  getVMs: (search) => api.request('GET', `/api/vms${search ? `?search=${encodeURIComponent(search)}` : ''}`),
  getTemplates: () => api.request('GET', '/api/vms/templates'),
  getTemplateGovernance: () => api.request('GET', '/api/vms/templates/governance'),
  saveTemplateGovernance: (ref, payload) => api.request('PUT', `/api/vms/templates/${encodeURIComponent(ref)}/governance`, payload),
  getTemplateGovernanceHistory: (ref) => api.request('GET', `/api/vms/templates/${encodeURIComponent(ref)}/history`),
  restoreTemplateGovernanceHistory: (ref, id) => api.request('POST', `/api/vms/templates/${encodeURIComponent(ref)}/history/${encodeURIComponent(id)}/restore`, {}),
  promoteTemplateGovernance: (ref, payload) => api.request('POST', `/api/vms/templates/${encodeURIComponent(ref)}/promote`, payload),
  getTemplateDeployments: () => api.request('GET', '/api/vms/templates/deployments'),
  updateTemplateDeploymentValidation: (id, payload) => api.request('PUT', `/api/vms/templates/deployments/${encodeURIComponent(id)}/validation`, payload),
  deployTemplate: (ref, payload) => api.request('POST', `/api/vms/templates/${encodeURIComponent(ref)}/deploy`, payload),
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
  createVMSnapshot: (ref, payload) => api.request('POST', `/api/vms/${encodeURIComponent(ref)}/snapshots`, payload),
  revertVMSnapshot: (ref, snapshotRef, payload = {}) => api.request('POST', `/api/vms/${encodeURIComponent(ref)}/snapshots/${encodeURIComponent(snapshotRef)}/revert`, payload),
  deleteVMSnapshot: (ref, snapshotRef, payload = {}) => api.request('DELETE', `/api/vms/${encodeURIComponent(ref)}/snapshots/${encodeURIComponent(snapshotRef)}`, payload),
  getHosts: (targetKey = '') => api.request('GET', appendTargetKey('/api/hosts', targetKey)),
  getHostMetrics: (ref) => api.request('GET', `/api/hosts/${encodeURIComponent(ref)}/metrics`),
  enterHostMaintenance: (ref, payload) => api.request('POST', `/api/hosts/${encodeURIComponent(ref)}/maintenance/enter`, payload),
  exitHostMaintenance: (ref, payload = {}) => api.request('POST', `/api/hosts/${encodeURIComponent(ref)}/maintenance/exit`, payload),
  rebootHost: (ref, payload = {}) => api.request('POST', `/api/hosts/${encodeURIComponent(ref)}/reboot`, payload),
  shutdownHost: (ref, payload = {}) => api.request('POST', `/api/hosts/${encodeURIComponent(ref)}/shutdown`, payload),
  getSRs: (targetKey = '') => api.request('GET', appendTargetKey('/api/storage', targetKey)),
  createSR: (payload) => api.request('POST', '/api/storage', payload),
  getSRVDIs: (ref) => api.request('GET', `/api/storage/${encodeURIComponent(ref)}/vdis`),
  repairSR: (ref, payload = {}) => api.request('POST', `/api/storage/${encodeURIComponent(ref)}/repair`, payload),
  rescanSR: (ref, payload = {}) => api.request('POST', `/api/storage/${encodeURIComponent(ref)}/rescan`, payload),
  forgetSR: (ref, payload = {}) => api.request('POST', `/api/storage/${encodeURIComponent(ref)}/forget`, payload),
  destroySR: (ref, payload = {}) => api.request('POST', `/api/storage/${encodeURIComponent(ref)}/destroy`, payload),
  createStorageVdi: (ref, payload) => api.request('POST', `/api/storage/${encodeURIComponent(ref)}/vdis`, payload),
  resizeStorageVdi: (ref, vdiRef, payload) => api.request('POST', `/api/storage/${encodeURIComponent(ref)}/vdis/${encodeURIComponent(vdiRef)}/resize`, payload),
  deleteStorageVdi: (ref, vdiRef, payload = null) => api.request('DELETE', `/api/storage/${encodeURIComponent(ref)}/vdis/${encodeURIComponent(vdiRef)}`, payload),
  getNetworks: (targetKey = '') => api.request('GET', appendTargetKey('/api/networks', targetKey)),
  getPools: (targetKey = '') => api.request('GET', appendTargetKey('/api/pools', targetKey)),
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
};

const store = reactive({
  authenticated: false,
  connected: false,
  demoMode: false,
  host: '',
  username: '',
  authMode: 'local',
  currentTargetKey: '',
  connectedTargets: [],
  user: null,
  governance: {
    currentRole: 'admin',
    policy: {
      defaultRole: 'admin',
      requireDestructiveApproval: true,
      approvalTtlMinutes: 240,
    },
  },
  sidebarOpen: true,
  ready: false,
  bootMessage: 'Verifying session state',
});

const GOVERNANCE_APPROVAL_STORAGE_KEY = 'xenmange.pendingGovernanceApproval';

function getActiveLiveTarget(targets = store.connectedTargets) {
  const list = Array.isArray(targets) ? targets : [];
  return list.find((target) => target?.active) || list[0] || null;
}

function formatLiveTargetLabel(target) {
  if (!target) return '';
  return String(target.connectionName || target.host || target.targetKey || '').trim();
}

function formatLiveTargetMeta(target) {
  if (!target) return 'No live session metadata';

  const user = String(target.username || '').trim();
  const host = String(target.host || '').trim();
  const port = Number(target.port || 443) || 443;

  if (user && host) return `${user}@${host}:${port}`;
  if (host) return `${host}:${port}`;
  return target.targetKey || 'Unknown target';
}

function normalizeGovernanceApprovalDraft(draft = {}) {
  return {
    actionKey: String(draft.actionKey || '').trim(),
    entityType: String(draft.entityType || 'resource').trim(),
    entityRef: String(draft.entityRef || '').trim(),
    entityName: String(draft.entityName || '').trim(),
    route: String(draft.route || '').trim(),
    justification: String(draft.justification || '').trim(),
  };
}

function readPendingGovernanceApprovalDraft() {
  try {
    const raw = window.sessionStorage.getItem(GOVERNANCE_APPROVAL_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return normalizeGovernanceApprovalDraft(parsed);
  } catch (error) {
    return null;
  }
}

function writePendingGovernanceApprovalDraft(draft = {}) {
  try {
    window.sessionStorage.setItem(
      GOVERNANCE_APPROVAL_STORAGE_KEY,
      JSON.stringify(normalizeGovernanceApprovalDraft(draft))
    );
  } catch (error) {
    // Ignore session storage failures in restricted contexts.
  }
}

function clearPendingGovernanceApprovalDraft() {
  try {
    window.sessionStorage.removeItem(GOVERNANCE_APPROVAL_STORAGE_KEY);
  } catch (error) {
    // Ignore session storage failures in restricted contexts.
  }
}

function findApprovedGovernanceApproval(approvals = [], draft = {}) {
  const normalized = normalizeGovernanceApprovalDraft(draft);
  return (Array.isArray(approvals) ? approvals : []).find((entry) =>
    entry.status === 'approved'
    && entry.actionKey === normalized.actionKey
    && entry.entityType === normalized.entityType
    && entry.entityRef === normalized.entityRef
  ) || null;
}

async function resolveGovernanceApproval(draft = {}) {
  const normalized = normalizeGovernanceApprovalDraft(draft);
  if (!normalized.actionKey || !normalized.entityRef) return '';
  if ((store.governance?.currentRole || 'admin') === 'admin') return '';
  if (!store.governance?.policy?.requireDestructiveApproval) return '';

  const governance = await api.getGovernance();
  if (governance?.policy || governance?.currentRole) {
    store.governance = {
      currentRole: governance.currentRole || store.governance.currentRole,
      policy: governance.policy || store.governance.policy,
    };
  }

  const approval = findApprovedGovernanceApproval(governance?.approvals || [], normalized);
  if (approval?.id) return approval.id;

  const error = new Error('A governance approval is required before this destructive action can continue.');
  error.code = 'APPROVAL_REQUIRED';
  error.approvalDraft = normalized;
  throw error;
}

function handoffToGovernanceApproval(router, draft = {}, message = '') {
  const normalized = normalizeGovernanceApprovalDraft(draft);
  writePendingGovernanceApprovalDraft(normalized);
  const route = { path: '/governance', query: { composeApproval: '1' } };
  if (message) route.query.message = message;
  return router.push(route);
}

function applySessionStatus(status = {}) {
  store.authenticated = Boolean(status.authenticated);
  store.connected = Boolean(status.connected);
  store.demoMode = Boolean(status.demoMode);
  store.host = status.host || '';
  store.username = status.username || '';
  store.authMode = status.authMode || 'local';
  store.currentTargetKey = status.currentTargetKey || '';
  store.connectedTargets = Array.isArray(status.connectedTargets) ? status.connectedTargets : [];
  store.user = status.user || null;
  store.governance = status.governance || {
    currentRole: 'admin',
    policy: {
      defaultRole: 'admin',
      requireDestructiveApproval: true,
      approvalTtlMinutes: 240,
    },
  };
}

function resetSessionState() {
  applySessionStatus({
    authenticated: false,
    connected: false,
    demoMode: false,
    host: '',
    username: '',
    authMode: 'local',
    currentTargetKey: '',
    connectedTargets: [],
    user: null,
    governance: {
      currentRole: 'admin',
      policy: {
        defaultRole: 'admin',
        requireDestructiveApproval: true,
        approvalTtlMinutes: 240,
      },
    },
  });
}

const ROUTE_FOCUS_KEYS = ['focusKind', 'focusRef', 'focusUuid', 'focusName', 'focusClass', 'focusSource'];

function cleanRouteQuery(query = {}) {
  return Object.fromEntries(
    Object.entries(query || {})
      .filter(([, value]) => value !== undefined && value !== null && value !== '')
      .map(([key, value]) => [key, String(value)])
  );
}

function getRouteFocus(query = {}) {
  const focus = {
    kind: String(query.focusKind || '').trim().toLowerCase(),
    ref: String(query.focusRef || '').trim(),
    uuid: String(query.focusUuid || '').trim(),
    name: String(query.focusName || '').trim(),
    cls: String(query.focusClass || '').trim().toLowerCase(),
    source: String(query.focusSource || '').trim().toLowerCase(),
  };

  if (!focus.kind && !focus.ref && !focus.uuid && !focus.name && !focus.cls) {
    return null;
  }

  return focus;
}

function getRouteFocusKey(focus) {
  if (!focus) return '';
  return [focus.kind, focus.ref, focus.uuid, focus.name, focus.cls, focus.source].join('|').toLowerCase();
}

function buildFocusedRoute(path, focus = {}, extraQuery = {}) {
  const query = cleanRouteQuery({
    ...extraQuery,
    focusKind: focus.kind || '',
    focusRef: focus.ref || '',
    focusUuid: focus.uuid || '',
    focusName: focus.name || '',
    focusClass: focus.cls || focus.class || '',
    focusSource: focus.source || '',
  });

  if (!Object.keys(query).length) {
    return { path };
  }

  return { path, query };
}

function normalizeFocusValue(value) {
  return String(value || '').trim().toLowerCase();
}

function recordMatchesRouteFocus(record, focus, fields = [], extraValues = []) {
  if (!record || !focus) return false;

  const values = [
    ...fields.map((field) => record?.[field]),
    ...extraValues,
  ]
    .map(normalizeFocusValue)
    .filter(Boolean);

  if (focus.ref && values.includes(normalizeFocusValue(focus.ref))) return true;
  if (focus.uuid && values.includes(normalizeFocusValue(focus.uuid))) return true;
  if (focus.name && values.includes(normalizeFocusValue(focus.name))) return true;

  return false;
}

const windowManager = {
  zIndex: 550,
  next() {
    this.zIndex += 1;
    return this.zIndex;
  },
};

function formatBytes(bytes) {
  const value = Number(bytes || 0);
  if (!value) return '0 B';

  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
  let size = value;
  let index = 0;

  while (size >= 1024 && index < units.length - 1) {
    size /= 1024;
    index += 1;
  }

  return `${size >= 10 || index === 0 ? size.toFixed(0) : size.toFixed(1)} ${units[index]}`;
}

function formatThroughput(kibPerSecond) {
  const value = Number(kibPerSecond || 0);
  if (!value) return '0 KiB/s';

  const units = ['KiB/s', 'MiB/s', 'GiB/s', 'TiB/s'];
  let size = value;
  let index = 0;

  while (size >= 1024 && index < units.length - 1) {
    size /= 1024;
    index += 1;
  }

  return `${size >= 10 || index === 0 ? size.toFixed(0) : size.toFixed(1)} ${units[index]}`;
}

function formatDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString();
}

function parseCalendarDate(value) {
  const source = String(value || '').trim();
  if (!source) return null;

  const match = source.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    const [, year, month, day] = match;
    return new Date(Number(year), Number(month) - 1, Number(day), 12, 0, 0, 0);
  }

  const date = new Date(source);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function startOfLocalDay(value = new Date()) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function diffCalendarDays(from, to) {
  const left = startOfLocalDay(from).getTime();
  const right = startOfLocalDay(to).getTime();
  return Math.round((right - left) / 86400000);
}

function isTaskTerminal(task = {}) {
  const status = String(task.status || '').trim().toLowerCase();
  return ['success', 'warning', 'failure', 'cancelled', 'canceled', 'completed'].includes(status) || Boolean(task.finished);
}

function getTaskDueMeta(task = {}, options = {}) {
  const dueSoonDays = Number(options.dueSoonDays ?? 2);
  const agingWarningDays = Number(options.agingWarningDays ?? 3);
  const agingCriticalDays = Number(options.agingCriticalDays ?? 7);
  const createdAt = parseCalendarDate(task.created || task.updated_at || task.updatedAt || '');
  const dueAt = parseCalendarDate(task.due_date || task.dueDate || '');
  const today = startOfLocalDay(new Date());
  const ageDays = createdAt ? Math.max(0, diffCalendarDays(createdAt, today)) : null;
  const ageLabel = ageDays === null
    ? 'Unknown age'
    : ageDays === 0
      ? 'New today'
      : `${ageDays}d in queue`;

  if (isTaskTerminal(task)) {
    return {
      bucket: 'closed',
      tone: 'success',
      label: 'Closed',
      detail: task.finished ? `Finished ${formatDateTime(task.finished)}` : 'Task is in a terminal state.',
      ageDays,
      ageLabel,
      dueDate: dueAt ? formatDateTime(dueAt) : '',
      isClosed: true,
      isOverdue: false,
      isDueSoon: false,
      isAging: false,
    };
  }

  if (dueAt) {
    const daysUntilDue = diffCalendarDays(today, dueAt);

    if (daysUntilDue < 0) {
      return {
        bucket: 'overdue',
        tone: 'critical',
        label: `Overdue ${Math.abs(daysUntilDue)}d`,
        detail: `Target was ${String(task.due_date || task.dueDate || '').trim()}.`,
        ageDays,
        ageLabel,
        dueDate: String(task.due_date || task.dueDate || '').trim(),
        isClosed: false,
        isOverdue: true,
        isDueSoon: false,
        isAging: true,
      };
    }

    if (daysUntilDue === 0) {
      return {
        bucket: 'today',
        tone: 'warning',
        label: 'Due today',
        detail: `Target date is ${String(task.due_date || task.dueDate || '').trim()}.`,
        ageDays,
        ageLabel,
        dueDate: String(task.due_date || task.dueDate || '').trim(),
        isClosed: false,
        isOverdue: false,
        isDueSoon: true,
        isAging: ageDays !== null && ageDays >= agingWarningDays,
      };
    }

    if (daysUntilDue <= dueSoonDays) {
      return {
        bucket: 'soon',
        tone: 'warning',
        label: `Due in ${daysUntilDue}d`,
        detail: `Target date is ${String(task.due_date || task.dueDate || '').trim()}.`,
        ageDays,
        ageLabel,
        dueDate: String(task.due_date || task.dueDate || '').trim(),
        isClosed: false,
        isOverdue: false,
        isDueSoon: true,
        isAging: ageDays !== null && ageDays >= agingWarningDays,
      };
    }

    return {
      bucket: 'scheduled',
      tone: 'info',
      label: `Due in ${daysUntilDue}d`,
      detail: `Target date is ${String(task.due_date || task.dueDate || '').trim()}.`,
      ageDays,
      ageLabel,
      dueDate: String(task.due_date || task.dueDate || '').trim(),
      isClosed: false,
      isOverdue: false,
      isDueSoon: false,
      isAging: false,
    };
  }

  if (ageDays !== null && ageDays >= agingCriticalDays) {
    return {
      bucket: 'aging-critical',
      tone: 'critical',
      label: `Aging ${ageDays}d`,
      detail: 'No due date is assigned and this remediation is now stale.',
      ageDays,
      ageLabel,
      dueDate: '',
      isClosed: false,
      isOverdue: false,
      isDueSoon: false,
      isAging: true,
    };
  }

  if (ageDays !== null && ageDays >= agingWarningDays) {
    return {
      bucket: 'aging-warning',
      tone: 'warning',
      label: `Aging ${ageDays}d`,
      detail: 'No due date is assigned, so ownership and closure timing should be reviewed.',
      ageDays,
      ageLabel,
      dueDate: '',
      isClosed: false,
      isOverdue: false,
      isDueSoon: false,
      isAging: true,
    };
  }

  return {
    bucket: 'fresh',
    tone: 'info',
    label: ageDays === 0 ? 'New today' : (ageDays === null ? 'No due date' : `${ageDays}d old`),
    detail: dueAt ? `Target date is ${String(task.due_date || task.dueDate || '').trim()}.` : 'No due date assigned yet.',
    ageDays,
    ageLabel,
    dueDate: '',
    isClosed: false,
    isOverdue: false,
    isDueSoon: false,
    isAging: false,
  };
}

function getTaskSlaBadgeClass(meta = {}) {
  if (meta.tone === 'critical') return 'badge-error';
  if (meta.tone === 'warning') return 'badge-warning';
  if (meta.tone === 'success') return 'badge-success';
  return 'badge-info';
}

function truncateList(value) {
  if (!Array.isArray(value) || value.length === 0) return '-';
  return value.slice(0, 4).join(', ');
}

function summarizeCount(label, value) {
  return `${value || 0} ${label}`;
}

function getMessageHeadline(message) {
  return message?.summary || message?.name || message?.body || message?.cls || 'Alert';
}

function getMessageSeverity(message) {
  const explicit = String(message?.effectiveSeverity || message?.severity || '').toLowerCase();
  if (['critical', 'warning', 'info', 'notice'].includes(explicit)) {
    return explicit;
  }

  const haystack = `${message?.name || ''} ${message?.body || ''} ${message?.cls || ''}`.toLowerCase();

  if (/(critical|fatal|failed|failure|panic|error|offline|down|corrupt|exhausted|unavailable)/.test(haystack)) {
    return 'critical';
  }

  if (/(warn|warning|degraded|threshold|latency|retry|paused|stopped|maintenance|high)/.test(haystack)) {
    return 'warning';
  }

  if (/(resolved|healthy|restored|recovered|success|info|notice)/.test(haystack)) {
    return 'info';
  }

  return 'notice';
}

function sortMessages(messages) {
  const severityOrder = { critical: 0, warning: 1, info: 2, notice: 3 };

  return [...(messages || [])].sort((left, right) => {
    const severityDelta = (severityOrder[getMessageSeverity(left)] ?? 99) - (severityOrder[getMessageSeverity(right)] ?? 99);
    if (severityDelta !== 0) return severityDelta;
    return new Date(right.timestamp || 0) - new Date(left.timestamp || 0);
  });
}

function formatPercent(part, total) {
  const numerator = Number(part);
  const denominator = Number(total);

  if (!denominator || Number.isNaN(numerator) || Number.isNaN(denominator)) {
    return '-';
  }

  return `${Math.max(0, Math.min(100, (numerator / denominator) * 100)).toFixed(0)}%`;
}

function formatTaskProgress(value) {
  const progress = Number(value);
  if (Number.isNaN(progress)) return '-';
  return `${Math.max(0, Math.min(100, progress * 100)).toFixed(0)}%`;
}

function clampPercentage(value) {
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return 0;
  return Math.max(0, Math.min(100, numeric));
}

function percentValue(part, total) {
  const numerator = Number(part);
  const denominator = Number(total);

  if (!denominator || Number.isNaN(numerator) || Number.isNaN(denominator)) {
    return 0;
  }

  return clampPercentage((numerator / denominator) * 100);
}

function formatPercentValue(value) {
  return `${clampPercentage(value).toFixed(0)}%`;
}

function getUtilizationStatus(value, thresholds = {}) {
  const percent = clampPercentage(value);
  const warning = thresholds.warning ?? 75;
  const critical = thresholds.critical ?? 90;

  if (percent >= critical) return 'critical';
  if (percent >= warning) return 'warning';
  return 'info';
}

function normalizeVmMemory(vm = {}) {
  return Math.max(0, Number(
    vm.memoryActualBytesLatest
    ?? vm.memory_actual_bytes
    ?? vm.memory_dynamic_max
    ?? vm.memory_static_max
    ?? vm.memory_target
    ?? 0
  ));
}

function normalizeVmConfiguredMemory(vm = {}) {
  return Math.max(0, Number(vm.memory_static_max || vm.memory_dynamic_max || vm.memory_target || 0));
}

function normalizeVmVcpus(vm = {}) {
  return Math.max(0, Number(vm.vcpuCountLatest ?? vm.VCPUs_at_startup ?? vm.VCPUs_max ?? 0));
}

function normalizeVmCpuUsage(vm = {}) {
  const numeric = Number(vm.cpuUsagePercentLatest ?? vm.cpu_usage_percent ?? 0);
  if (Number.isNaN(numeric)) return 0;
  return clampPercentage(numeric);
}

function getHistoryMetricSeries(history = {}, metricName = '') {
  return (history?.metrics || []).find((entry) => entry.metricName === metricName)?.points || [];
}

function normalizeTrendPoints(series = []) {
  return (Array.isArray(series) ? series : [])
    .map((point) => ({
      ts: Number(point?.ts || 0),
      value: Number(point?.value || 0),
    }))
    .filter((point) => Number.isFinite(point.ts) && Number.isFinite(point.value) && point.ts > 0)
    .sort((left, right) => left.ts - right.ts);
}

function formatForecastHorizon(hours) {
  const numeric = Number(hours);
  if (!Number.isFinite(numeric) || numeric < 0) return '';
  if (numeric < 24) return `~${Math.max(1, Math.round(numeric))}h`;
  const days = numeric / 24;
  if (days < 7) return `~${(Math.round(days * 10) / 10).toFixed(days < 3 ? 1 : 0)}d`;
  return `~${(Math.round((days / 7) * 10) / 10).toFixed(1)}w`;
}

function buildTrendSignal(series = [], {
  label = 'metric',
  warning = 75,
  critical = 90,
  valueKind = 'percent',
} = {}) {
  const points = normalizeTrendPoints(series);
  const recentPoints = points.slice(-Math.min(points.length, 6));
  const first = recentPoints[0];
  const last = recentPoints[recentPoints.length - 1];

  if (!first || !last || recentPoints.length < 3 || last.ts <= first.ts) {
    return {
      label,
      valueKind,
      hasHistory: false,
      pointCount: points.length,
      latest: Number(last?.value || 0),
      delta: 0,
      slopePerHour: 0,
      slopePerDay: 0,
      warningHours: null,
      criticalHours: null,
      status: 'insufficient',
    };
  }

  const durationMs = last.ts - first.ts;
  const slopePerHour = ((last.value - first.value) / durationMs) * 3600000;
  const slopePerDay = slopePerHour * 24;
  const projectHours = (threshold) => {
    if (last.value >= threshold) return 0;
    if (slopePerHour <= 0) return null;
    return (threshold - last.value) / slopePerHour;
  };

  const warningHours = projectHours(warning);
  const criticalHours = projectHours(critical);
  let status = 'stable';
  if (last.value >= critical) status = 'critical';
  else if (last.value >= warning) status = 'warning';
  else if (criticalHours !== null && criticalHours <= 24) status = 'critical';
  else if ((warningHours !== null && warningHours <= 48) || slopePerDay >= 8) status = 'warning';
  else if (slopePerDay > 1) status = 'rising';

  return {
    label,
    valueKind,
    hasHistory: true,
    pointCount: points.length,
    latest: Number(last.value || 0),
    delta: Number((last.value - first.value) || 0),
    slopePerHour,
    slopePerDay,
    warningHours,
    criticalHours,
    status,
  };
}

function buildCapacityAttribution(summary = {}, context = {}) {
  const hottestHost = context.hottestHost || null;
  const busiestStorage = context.busiestStorage || null;
  const dominantWorkload = context.dominantWorkload || null;
  const candidates = [];

  if (hottestHost) {
    candidates.push({
      label: `${hottestHost.name_label || hottestHost.hostname || 'Host'} is the current pressure leader at ${formatPercentValue(hottestHost.pressurePercent || hottestHost.memoryUsagePercent || 0)}`,
      nextAction: `Validate placement options for ${hottestHost.name_label || hottestHost.hostname || 'that host'} before the next maintenance or provisioning window.`,
      score: Math.max(
        Number(hottestHost.pressurePercent || 0),
        Number(hottestHost.memoryUsagePercent || 0),
        Number(hottestHost.cpuUsagePercentLatest || 0)
      ),
      entityType: 'host',
      entityRef: hottestHost.ref || '',
      entityUuid: hottestHost.uuid || '',
      entityName: hottestHost.name_label || hottestHost.hostname || hottestHost.address || hottestHost.ref || 'Host',
    });
  }

  if (busiestStorage) {
    candidates.push({
      label: `${busiestStorage.name_label || 'Storage repo'} is carrying the highest allocation pressure at ${formatPercentValue(busiestStorage.utilizationPercent || 0)}`,
      nextAction: `Review reclamation, snapshot churn, or expansion options on ${busiestStorage.name_label || 'that repository'}.`,
      score: Number(busiestStorage.utilizationPercent || 0),
      entityType: 'sr',
      entityRef: busiestStorage.ref || '',
      entityUuid: busiestStorage.uuid || '',
      entityName: busiestStorage.name_label || busiestStorage.ref || 'Storage Repo',
    });
  }

  if (dominantWorkload) {
    candidates.push({
      label: `${dominantWorkload.name_label || 'A workload'} is the dominant footprint on ${dominantWorkload.hostName || 'its host'}, consuming ${formatPercentValue(dominantWorkload.riskPercentOfHost || dominantWorkload.hostMemorySharePercent || 0)} of local memory headroom`,
      nextAction: `Inspect ${dominantWorkload.name_label || 'that workload'} for rebalance or rightsizing before projected drift hardens.`,
      score: Math.max(
        Number(dominantWorkload.riskPercentOfHost || 0),
        Number(dominantWorkload.hostMemorySharePercent || 0),
        Number(dominantWorkload.cpuUsagePercent || 0)
      ),
      entityType: 'vm',
      entityRef: dominantWorkload.ref || '',
      entityUuid: dominantWorkload.uuid || '',
      entityName: dominantWorkload.name_label || dominantWorkload.ref || 'Workload',
    });
  }

  return candidates.sort((left, right) => right.score - left.score)[0] || null;
}

function summarizeCapacityRisk(summary = {}, history = {}, historyRange = '24h', context = {}) {
  const memoryUsedPercent = Number(summary.memoryUsedPercent || 0);
  const storageUsedPercent = Number(summary.storageUsedPercent || 0);
  const memoryCommitPercent = Number(summary.memoryCommitPercent || 0);
  const imbalancePercent = Number(summary.imbalancePercent || 0);
  const noisyNeighborCount = Number(summary.noisyNeighborCount || 0);
  const hotHostCount = Number(summary.hotHostCount || 0);
  const attribution = buildCapacityAttribution(summary, context);
  const memorySignal = buildTrendSignal(getHistoryMetricSeries(history, 'cluster_memory_used_percent'), {
    label: 'memory',
    warning: 70,
    critical: 85,
  });
  const storageSignal = buildTrendSignal(getHistoryMetricSeries(history, 'cluster_storage_utilization_percent'), {
    label: 'storage',
    warning: 75,
    critical: 90,
  });
  const cpuSignal = buildTrendSignal(getHistoryMetricSeries(history, 'cluster_cpu_usage_percent'), {
    label: 'cpu',
    warning: 70,
    critical: 90,
  });
  const historySignals = [memorySignal, storageSignal, cpuSignal].filter((signal) => signal.hasHistory);
  const forecastBasis = historySignals.length
    ? `Derived from persisted ${historyRange} telemetry across memory, storage, and CPU trends.`
    : 'Inferred from current inventory, host telemetry, and active task state.';
  const criticalSignal = historySignals
    .filter((signal) => signal.criticalHours !== null)
    .sort((left, right) => left.criticalHours - right.criticalHours)[0] || null;
  const warningSignal = historySignals
    .filter((signal) => signal.warningHours !== null)
    .sort((left, right) => left.warningHours - right.warningHours)[0] || null;
  const risingSignals = historySignals.filter((signal) => signal.slopePerDay > 1);

  let status = 'success';
  let title = 'Capacity outlook stable';
  let detail = 'Live inventory suggests enough headroom for standard workload churn.';
  let nextAction = 'Keep telemetry under review during patching, template rollout, and recovery drills.';
  let confidence = forecastBasis;
  let attributionText = attribution?.label || '';

  if (memoryUsedPercent >= 90 || storageUsedPercent >= 92 || memoryCommitPercent >= 110 || hotHostCount >= 2) {
    status = 'critical';
    title = 'Immediate rebalancing recommended';
    detail = 'One or more headroom indicators crossed the critical envelope, raising the chance of provisioning or evacuation pressure.';
    nextAction = 'Migrate heavy workloads, reclaim storage, or add capacity before the next maintenance or failover event.';
    confidence = historySignals.length
      ? `${forecastBasis} Persisted telemetry confirms the environment is already operating beyond its normal buffer.`
      : forecastBasis;
  } else if (criticalSignal && criticalSignal.criticalHours !== null && criticalSignal.criticalHours <= 24) {
    status = 'critical';
    title = 'Critical threshold approaching';
    detail = `Persisted ${criticalSignal.label} telemetry is trending toward its critical band within ${formatForecastHorizon(criticalSignal.criticalHours)} if the current slope holds.`;
    nextAction = 'Schedule workload movement, cleanup, or capacity expansion before the projected threshold window closes.';
    confidence = `${forecastBasis} Latest ${criticalSignal.label} slope is rising by ${criticalSignal.slopePerDay.toFixed(1)} percentage points per day.`;
  } else if (warningSignal && warningSignal.warningHours !== null && warningSignal.warningHours <= 72) {
    status = 'warning';
    title = 'Capacity threshold approaching';
    detail = `Persisted ${warningSignal.label} telemetry projects the warning band within ${formatForecastHorizon(warningSignal.warningHours)} if recent utilization keeps climbing.`;
    nextAction = 'Review the hottest hosts and busiest repositories now so remediation can land before the projected threshold.';
    confidence = `${forecastBasis} Recent ${warningSignal.label} slope is ${warningSignal.slopePerDay.toFixed(1)} percentage points per day.`;
  } else if (memoryUsedPercent >= 78 || storageUsedPercent >= 85 || memoryCommitPercent >= 95 || noisyNeighborCount > 0 || imbalancePercent >= 35) {
    status = 'warning';
    title = 'Capacity drift detected';
    detail = 'The environment remains operable, but placement skew or commit pressure suggests rebalancing should be scheduled soon.';
    nextAction = 'Review the hottest host, busiest storage repository, and largest workloads before the next deployment wave.';
    confidence = historySignals.length
      ? `${forecastBasis} Recent telemetry is elevated even without an immediate projected threshold crossing.`
      : forecastBasis;
  } else if (risingSignals.length) {
    const fastestSignal = [...risingSignals].sort((left, right) => right.slopePerDay - left.slopePerDay)[0];
    status = 'info';
    title = 'Capacity trend rising';
    detail = `Persisted ${fastestSignal.label} telemetry is climbing at ${fastestSignal.slopePerDay.toFixed(1)} percentage points per day, even though current headroom remains acceptable.`;
    nextAction = 'Keep routine telemetry collection active and watch the next capacity window before scheduling large provisioning changes.';
    confidence = `${forecastBasis} Forecast confidence is moderate because thresholds are not yet near-term.`;
  } else if (historySignals.length) {
    const strongestDecline = [...historySignals].sort((left, right) => left.slopePerDay - right.slopePerDay)[0];
    detail = strongestDecline.slopePerDay < -0.5
      ? `Persisted telemetry shows utilization easing, with ${strongestDecline.label} pressure falling by ${Math.abs(strongestDecline.slopePerDay).toFixed(1)} percentage points per day across the current window.`
      : 'Persisted telemetry shows no near-term threshold crossings across the current capacity window.';
    confidence = `${forecastBasis} Forecast confidence is higher because the current trend line is flat-to-improving.`;
  }

  if (attribution && (status === 'critical' || status === 'warning' || status === 'info')) {
    nextAction = `${nextAction} ${attribution.nextAction}`;
  } else if (!attributionText && status === 'success' && context.hottestHost) {
    attributionText = `${context.hottestHost.name_label || context.hottestHost.hostname || 'The busiest host'} still retains acceptable headroom for routine churn.`;
  }

  return {
    status,
    title,
    detail,
    nextAction,
    confidence,
    attribution: attributionText,
    driver: attribution
      ? {
          entityType: attribution.entityType || '',
          entityRef: attribution.entityRef || '',
          entityUuid: attribution.entityUuid || '',
          entityName: attribution.entityName || '',
        }
      : null,
  };
}

function buildCapacityAnalytics({
  hosts = [],
  srs = [],
  vms = [],
  tasks = [],
  messages = [],
  clusterHistory = { metrics: [] },
  historyRange = '24h',
} = {}) {
  const hostList = Array.isArray(hosts) ? hosts : [];
  const srList = Array.isArray(srs) ? srs : [];
  const vmList = Array.isArray(vms) ? vms.filter((vm) => !vm.is_a_template) : [];
  const taskList = Array.isArray(tasks) ? tasks : [];
  const messageList = Array.isArray(messages) ? messages : [];

  const hostsByRef = Object.fromEntries(hostList.map((host) => [host.ref, host]));
  const clusterMemoryTotal = hostList.reduce((sum, host) => sum + Number(host.memoryTotal || 0), 0);
  const clusterMemoryUsed = hostList.reduce((sum, host) => sum + Number(host.memoryUsed || 0), 0);
  const clusterStorageTotal = srList.reduce((sum, sr) => sum + Number(sr.physical_size || 0), 0);
  const clusterStorageAllocated = srList.reduce((sum, sr) => sum + Number(sr.virtual_allocation || 0), 0);

  const normalizedVms = vmList.map((vm) => {
    const hostRef = vm.resident_on || vm.affinity || '';
    const host = hostsByRef[hostRef];
    const memoryDemand = normalizeVmMemory(vm);
    const configuredMemoryDemand = normalizeVmConfiguredMemory(vm);
    const vcpuDemand = normalizeVmVcpus(vm);
    const cpuUsagePercent = normalizeVmCpuUsage(vm);
    const powerState = String(vm.power_state || '').toLowerCase();
    const telemetryBacked = Number(vm.memoryActualBytesLatest || 0) > 0 || Number(vm.cpuUsagePercentLatest || 0) > 0;

    return {
      ...vm,
      hostRef,
      hostName: host?.name_label || host?.hostname || host?.address || hostRef || 'Unplaced',
      memoryDemand,
      configuredMemoryDemand,
      vcpuDemand,
      cpuUsagePercent,
      telemetryBacked,
      powerState,
      riskPercentOfHost: percentValue(memoryDemand, Number(host?.memoryTotal || 0)),
      hostMemorySharePercent: percentValue(memoryDemand, Number(host?.memoryUsed || host?.memoryTotal || 0)),
    };
  });

  const totalVmMemoryDemand = normalizedVms.reduce((sum, vm) => sum + vm.configuredMemoryDemand, 0);
  const totalVmObservedMemoryDemand = normalizedVms.reduce((sum, vm) => sum + vm.memoryDemand, 0);
  const totalVmVcpuDemand = normalizedVms.reduce((sum, vm) => sum + vm.vcpuDemand, 0);
  const averageHostVmMemory = hostList.length ? totalVmObservedMemoryDemand / hostList.length : 0;

  const hostBalanceRows = hostList.map((host) => {
    const assignedVms = normalizedVms.filter((vm) => vm.hostRef === host.ref);
    const vmMemoryDemand = assignedVms.reduce((sum, vm) => sum + vm.memoryDemand, 0);
    const vmConfiguredMemoryDemand = assignedVms.reduce((sum, vm) => sum + vm.configuredMemoryDemand, 0);
    const vmVcpuDemand = assignedVms.reduce((sum, vm) => sum + vm.vcpuDemand, 0);
    const vmCpuUsagePercent = assignedVms.length
      ? assignedVms.reduce((sum, vm) => sum + vm.cpuUsagePercent, 0) / assignedVms.length
      : 0;
    const dominantVm = [...assignedVms].sort((left, right) => right.memoryDemand - left.memoryDemand)[0] || null;
    const pressurePercent = Math.max(
      Number(host.memoryUsagePercent || 0),
      Number(host.cpuUsagePercentLatest || 0),
      percentValue(vmMemoryDemand, Number(host.memoryTotal || 0))
    );
    const imbalancePercent = averageHostVmMemory
      ? Math.abs(vmMemoryDemand - averageHostVmMemory) / averageHostVmMemory * 100
      : 0;
    const relatedAlerts = messageList.filter((message) => {
      const haystack = `${message?.name || ''} ${message?.body || ''} ${message?.obj_uuid || ''}`.toLowerCase();
      return haystack.includes(String(host.uuid || '').toLowerCase()) || haystack.includes(String(host.name_label || '').toLowerCase());
    });
    const noisyNeighbors = assignedVms
      .filter((vm) => pressurePercent >= 70
        && (
          vm.riskPercentOfHost >= 18
          || percentValue(vm.memoryDemand, vmMemoryDemand) >= 45
          || vm.cpuUsagePercent >= 60
        ))
      .sort((left, right) => right.memoryDemand - left.memoryDemand);

    return {
      ...host,
      assignedVms,
      vmMemoryDemand,
      vmConfiguredMemoryDemand,
      vmVcpuDemand,
      vmCpuUsagePercent,
      dominantVm,
      pressurePercent,
      imbalancePercent,
      alertCount: relatedAlerts.length,
      noisyNeighbors,
      workloadSharePercent: percentValue(vmMemoryDemand, totalVmObservedMemoryDemand),
      status: !host.enabled
        ? 'disabled'
        : host.live === false
          ? 'offline'
          : getUtilizationStatus(pressurePercent, { warning: 70, critical: 85 }),
    };
  }).sort((left, right) => {
    const priority = { critical: 0, warning: 1, offline: 2, info: 3, disabled: 4 };
    const statusDelta = (priority[left.status] ?? 99) - (priority[right.status] ?? 99);
    if (statusDelta !== 0) return statusDelta;
    return right.pressurePercent - left.pressurePercent;
  });

  const topVmConsumers = [...normalizedVms]
    .sort((left, right) => {
      const memoryDelta = right.memoryDemand - left.memoryDemand;
      if (memoryDelta !== 0) return memoryDelta;
      return right.vcpuDemand - left.vcpuDemand;
    })
    .slice(0, 8);

  const noisyNeighborCandidates = hostBalanceRows
    .flatMap((host) => host.noisyNeighbors.map((vm) => ({
      ...vm,
      hostRef: host.ref,
      hostName: host.name_label || host.hostname || host.address || host.ref,
      hostStatus: host.status,
      hostPressurePercent: host.pressurePercent,
      recommendation: `Review ${vm.name_label || 'this VM'} on ${host.name_label || 'the host'} before the next placement, maintenance, or failover event.`,
    })))
    .slice(0, 8);

  const summary = {
    hostCount: hostList.length,
    vmCount: normalizedVms.length,
    storageCount: srList.length,
    activeTaskCount: taskList.filter((task) => ['pending', 'queued'].includes(String(task.status || '').toLowerCase())).length,
    hotHostCount: hostBalanceRows.filter((host) => ['critical', 'warning'].includes(host.status)).length,
    noisyNeighborCount: noisyNeighborCandidates.length,
    memoryUsedPercent: percentValue(clusterMemoryUsed, clusterMemoryTotal),
    memoryCommitPercent: percentValue(totalVmMemoryDemand, clusterMemoryTotal),
    storageUsedPercent: percentValue(clusterStorageAllocated, clusterStorageTotal),
    imbalancePercent: hostBalanceRows.length
      ? Math.max(...hostBalanceRows.map((host) => Number(host.imbalancePercent || 0)))
      : 0,
    totalVmMemoryDemand,
    totalVmObservedMemoryDemand,
    totalVmVcpuDemand,
    clusterMemoryTotal,
    clusterMemoryUsed,
    clusterStorageTotal,
    clusterStorageAllocated,
  };

  const hottestHost = hostBalanceRows[0] || null;
  const busiestStorage = [...srList]
    .sort((left, right) => percentValue(right.virtual_allocation, right.physical_size) - percentValue(left.virtual_allocation, left.physical_size))[0] || null;
  const dominantWorkload = noisyNeighborCandidates[0] || topVmConsumers[0] || null;

  return {
    summary,
    hostBalanceRows,
    topVmConsumers,
    noisyNeighborCandidates,
    forecast: summarizeCapacityRisk(summary, clusterHistory, historyRange, {
      hottestHost,
      busiestStorage,
      dominantWorkload,
    }),
  };
}
