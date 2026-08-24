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
  }),
  logout: () => api.request('POST', '/api/auth/logout'),
  status: () => api.request('GET', '/api/auth/status'),
  dashboard: () => api.request('GET', '/api/dashboard'),
  dashboardMessages: () => api.request('GET', '/api/dashboard/messages'),
  getAlerts: () => api.request('GET', '/api/alerts'),
  updateAlertState: (ref, payload) => api.request('PUT', `/api/alerts/${encodeURIComponent(ref)}/state`, payload),
  bulkUpdateAlertState: (refs, state) => api.request('PUT', '/api/alerts/bulk-state', { refs, state }),
  getAlertPolicies: () => api.request('GET', '/api/alerts/policies'),
  createAlertPolicy: (payload) => api.request('POST', '/api/alerts/policies', payload),
  updateAlertPolicy: (id, payload) => api.request('PUT', `/api/alerts/policies/${encodeURIComponent(id)}`, payload),
  deleteAlertPolicy: (id) => api.request('DELETE', `/api/alerts/policies/${encodeURIComponent(id)}`),
  getTasks: () => api.request('GET', '/api/tasks'),
  createRemediationTask: (payload) => api.request('POST', '/api/tasks/remediation', payload),
  queueRemediationTemplate: (payload) => api.request('POST', '/api/tasks/remediation', payload),
  updateRemediationTask: (ref, payload) => api.request('PUT', `/api/tasks/remediation/${encodeURIComponent(ref)}`, payload),
  getRemediationTemplates: () => api.request('GET', '/api/tasks/remediation/templates'),
  createRemediationTemplate: (payload) => api.request('POST', '/api/tasks/remediation/templates', payload),
  updateRemediationTemplate: (id, payload) => api.request('PUT', `/api/tasks/remediation/templates/${encodeURIComponent(id)}`, payload),
  deleteRemediationTemplate: (id) => api.request('DELETE', `/api/tasks/remediation/templates/${encodeURIComponent(id)}`),
  getAuditLog: () => api.request('GET', '/api/audit'),
  getLogs: () => api.request('GET', '/api/logs'),
  getClusterMetrics: (range = '24h') => api.request('GET', `/api/metrics/cluster?range=${encodeURIComponent(range)}`),
  collectMetricsSnapshot: () => api.request('POST', '/api/metrics/collect'),
  getHostMetricHistory: (ref, range = '24h') => api.request('GET', `/api/metrics/hosts/${encodeURIComponent(ref)}?range=${encodeURIComponent(range)}`),
  getVmMetricHistory: (ref, range = '24h') => api.request('GET', `/api/metrics/vms/${encodeURIComponent(ref)}?range=${encodeURIComponent(range)}`),
  getStorageMetricHistory: (ref, range = '24h') => api.request('GET', `/api/metrics/storage/${encodeURIComponent(ref)}?range=${encodeURIComponent(range)}`),
  getGovernance: () => api.request('GET', '/api/governance'),
  getUsers: () => api.request('GET', '/api/users'),
  createUser: (payload) => api.request('POST', '/api/users', payload),
  updateUser: (id, payload) => api.request('PUT', `/api/users/${encodeURIComponent(id)}`, payload),
  resetUserPassword: (id, payload) => api.request('POST', `/api/users/${encodeURIComponent(id)}/password`, payload),
  getSystemConfig: () => api.request('GET', '/api/settings'),
  saveSystemConfigSection: (section, payload) => api.request('PUT', `/api/settings/${encodeURIComponent(section)}`, payload),
  previewRetentionSweep: (domain = '') => api.request('GET', `/api/settings/retention/preview${domain ? `?domain=${encodeURIComponent(domain)}` : ''}`),
  runRetentionSweep: (payload = {}) => api.request('POST', '/api/settings/retention/run', payload),
  saveRetentionPolicy: (domain, payload) => api.request('PUT', `/api/settings/retention/policies/${encodeURIComponent(domain)}`, payload),
  saveGovernancePolicy: (payload) => api.request('PUT', '/api/governance/policy', payload),
  setGovernanceRole: (role) => api.request('PUT', '/api/governance/role', { role }),
  saveGovernanceQuota: (ref, payload) => api.request('PUT', `/api/governance/quotas/${encodeURIComponent(ref)}`, payload),
  deleteGovernanceQuota: (ref) => api.request('DELETE', `/api/governance/quotas/${encodeURIComponent(ref)}`),
  requestGovernanceApproval: (payload) => api.request('POST', '/api/governance/approvals', payload),
  decideGovernanceApproval: (id, payload) => api.request('POST', `/api/governance/approvals/${encodeURIComponent(id)}/decision`, payload),
  getResilience: () => api.request('GET', '/api/resilience'),
  getResilienceRunbooks: () => api.request('GET', '/api/resilience/plans'),
  getResilienceDrills: () => api.request('GET', '/api/resilience/drills'),
  saveResilienceRunbook: (ref, payload) => api.request('PUT', `/api/resilience/plans/${encodeURIComponent(ref)}`, payload),
  deleteResilienceRunbook: (ref) => api.request('DELETE', `/api/resilience/plans/${encodeURIComponent(ref)}`),
  logResilienceDrill: (ref, payload) => api.request('POST', `/api/resilience/drills/${encodeURIComponent(ref)}`, payload),
  getLifecyclePlans: () => api.request('GET', '/api/lifecycle/plans'),
  saveLifecyclePlan: (ref, payload) => api.request('PUT', `/api/lifecycle/plans/${encodeURIComponent(ref)}`, payload),
  deleteLifecyclePlan: (ref) => api.request('DELETE', `/api/lifecycle/plans/${encodeURIComponent(ref)}`),
  getVMs: (search) => api.request('GET', `/api/vms${search ? `?search=${encodeURIComponent(search)}` : ''}`),
  getTemplates: () => api.request('GET', '/api/vms/templates'),
  getTemplateGovernance: () => api.request('GET', '/api/vms/templates/governance'),
  saveTemplateGovernance: (ref, payload) => api.request('PUT', `/api/vms/templates/${encodeURIComponent(ref)}/governance`, payload),
  getTemplateGovernanceHistory: (ref) => api.request('GET', `/api/vms/templates/${encodeURIComponent(ref)}/history`),
  promoteTemplateGovernance: (ref, payload) => api.request('POST', `/api/vms/templates/${encodeURIComponent(ref)}/promote`, payload),
  getTemplateDeployments: () => api.request('GET', '/api/vms/templates/deployments'),
  updateTemplateDeploymentValidation: (id, payload) => api.request('PUT', `/api/vms/templates/deployments/${encodeURIComponent(id)}/validation`, payload),
  deployTemplate: (ref, payload) => api.request('POST', `/api/vms/templates/${encodeURIComponent(ref)}/deploy`, payload),
  getVM: (ref) => api.request('GET', `/api/vms/${encodeURIComponent(ref)}`),
  vmAction: (action, ref, options = {}) => api.request('POST', `/api/vms/${action}`, { ref, ...options }),
  updateVMConfig: (ref, payload) => api.request('PUT', `/api/vms/${encodeURIComponent(ref)}/config`, payload),
  addVMDisk: (ref, payload) => api.request('POST', `/api/vms/${encodeURIComponent(ref)}/disks`, payload),
  addVMNic: (ref, payload) => api.request('POST', `/api/vms/${encodeURIComponent(ref)}/nics`, payload),
  getHosts: () => api.request('GET', '/api/hosts'),
  getHostMetrics: (ref) => api.request('GET', `/api/hosts/${encodeURIComponent(ref)}/metrics`),
  getSRs: () => api.request('GET', '/api/storage'),
  getSRVDIs: (ref) => api.request('GET', `/api/storage/${encodeURIComponent(ref)}/vdis`),
  getNetworks: () => api.request('GET', '/api/networks'),
  getPools: () => api.request('GET', '/api/pools'),
  getCredentials: () => api.request('GET', '/api/credentials'),
  createCredential: (payload) => api.request('POST', '/api/credentials', payload),
  updateCredential: (id, payload) => api.request('PUT', `/api/credentials/${encodeURIComponent(id)}`, payload),
  deleteCredential: (id) => api.request('DELETE', `/api/credentials/${encodeURIComponent(id)}`),
  getConnections: () => api.request('GET', '/api/connections'),
  saveConnection: (payload) => api.request('POST', '/api/connections', payload),
  updateConnection: (id, payload) => api.request('PUT', `/api/connections/${id}`, payload),
  deleteConnection: (id) => api.request('DELETE', `/api/connections/${id}`),
  setDefaultConnection: (id) => api.request('POST', `/api/connections/${id}/default`),
  getInventoryWorkspaces: () => api.request('GET', '/api/workspaces/inventory'),
  createInventoryWorkspace: (payload) => api.request('POST', '/api/workspaces/inventory', payload),
  updateInventoryWorkspace: (id, payload) => api.request('PUT', `/api/workspaces/inventory/${encodeURIComponent(id)}`, payload),
  deleteInventoryWorkspace: (id) => api.request('DELETE', `/api/workspaces/inventory/${encodeURIComponent(id)}`),
  getHostTargets: () => api.request('GET', '/api/host-targets'),
  saveHostTarget: (payload) => api.request('POST', '/api/host-targets', payload),
  updateHostTarget: (id, payload) => api.request('PUT', `/api/host-targets/${id}`, payload),
  deleteHostTarget: (id) => api.request('DELETE', `/api/host-targets/${id}`),
};

const store = reactive({
  authenticated: false,
  connected: false,
  demoMode: false,
  host: '',
  username: '',
  authMode: 'local',
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
  return Math.max(0, Number(vm.memory_dynamic_max || vm.memory_static_max || vm.memory_target || 0));
}

function normalizeVmVcpus(vm = {}) {
  return Math.max(0, Number(vm.VCPUs_at_startup || vm.VCPUs_max || 0));
}

function summarizeCapacityRisk(summary = {}) {
  const memoryUsedPercent = Number(summary.memoryUsedPercent || 0);
  const storageUsedPercent = Number(summary.storageUsedPercent || 0);
  const memoryCommitPercent = Number(summary.memoryCommitPercent || 0);
  const imbalancePercent = Number(summary.imbalancePercent || 0);
  const noisyNeighborCount = Number(summary.noisyNeighborCount || 0);
  const hotHostCount = Number(summary.hotHostCount || 0);

  let status = 'success';
  let title = 'Capacity outlook stable';
  let detail = 'Live inventory suggests enough headroom for standard workload churn.';
  let nextAction = 'Keep telemetry under review during patching, template rollout, and recovery drills.';

  if (memoryUsedPercent >= 90 || storageUsedPercent >= 92 || memoryCommitPercent >= 110 || hotHostCount >= 2) {
    status = 'critical';
    title = 'Immediate rebalancing recommended';
    detail = 'One or more headroom indicators crossed the critical envelope, raising the chance of provisioning or evacuation pressure.';
    nextAction = 'Migrate heavy workloads, reclaim storage, or add capacity before the next maintenance or failover event.';
  } else if (memoryUsedPercent >= 78 || storageUsedPercent >= 85 || memoryCommitPercent >= 95 || noisyNeighborCount > 0 || imbalancePercent >= 35) {
    status = 'warning';
    title = 'Capacity drift detected';
    detail = 'The environment remains operable, but placement skew or commit pressure suggests rebalancing should be scheduled soon.';
    nextAction = 'Review the hottest host, busiest storage repository, and largest workloads before the next deployment wave.';
  }

  return {
    status,
    title,
    detail,
    nextAction,
    confidence: 'Inferred from current inventory, host telemetry, and active task state.',
  };
}

function buildCapacityAnalytics({
  hosts = [],
  srs = [],
  vms = [],
  tasks = [],
  messages = [],
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
    const vcpuDemand = normalizeVmVcpus(vm);
    const powerState = String(vm.power_state || '').toLowerCase();

    return {
      ...vm,
      hostRef,
      hostName: host?.name_label || host?.hostname || host?.address || hostRef || 'Unplaced',
      memoryDemand,
      vcpuDemand,
      powerState,
      riskPercentOfHost: percentValue(memoryDemand, Number(host?.memoryTotal || 0)),
    };
  });

  const totalVmMemoryDemand = normalizedVms.reduce((sum, vm) => sum + vm.memoryDemand, 0);
  const totalVmVcpuDemand = normalizedVms.reduce((sum, vm) => sum + vm.vcpuDemand, 0);
  const averageHostVmMemory = hostList.length ? totalVmMemoryDemand / hostList.length : 0;

  const hostBalanceRows = hostList.map((host) => {
    const assignedVms = normalizedVms.filter((vm) => vm.hostRef === host.ref);
    const vmMemoryDemand = assignedVms.reduce((sum, vm) => sum + vm.memoryDemand, 0);
    const vmVcpuDemand = assignedVms.reduce((sum, vm) => sum + vm.vcpuDemand, 0);
    const dominantVm = [...assignedVms].sort((left, right) => right.memoryDemand - left.memoryDemand)[0] || null;
    const pressurePercent = Math.max(Number(host.memoryUsagePercent || 0), percentValue(vmMemoryDemand, Number(host.memoryTotal || 0)));
    const imbalancePercent = averageHostVmMemory
      ? Math.abs(vmMemoryDemand - averageHostVmMemory) / averageHostVmMemory * 100
      : 0;
    const relatedAlerts = messageList.filter((message) => {
      const haystack = `${message?.name || ''} ${message?.body || ''} ${message?.obj_uuid || ''}`.toLowerCase();
      return haystack.includes(String(host.uuid || '').toLowerCase()) || haystack.includes(String(host.name_label || '').toLowerCase());
    });
    const noisyNeighbors = assignedVms
      .filter((vm) => pressurePercent >= 70 && (vm.riskPercentOfHost >= 18 || percentValue(vm.memoryDemand, vmMemoryDemand) >= 45))
      .sort((left, right) => right.memoryDemand - left.memoryDemand);

    return {
      ...host,
      assignedVms,
      vmMemoryDemand,
      vmVcpuDemand,
      dominantVm,
      pressurePercent,
      imbalancePercent,
      alertCount: relatedAlerts.length,
      noisyNeighbors,
      workloadSharePercent: percentValue(vmMemoryDemand, totalVmMemoryDemand),
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
    totalVmVcpuDemand,
    clusterMemoryTotal,
    clusterMemoryUsed,
    clusterStorageTotal,
    clusterStorageAllocated,
  };

  return {
    summary,
    hostBalanceRows,
    topVmConsumers,
    noisyNeighborCandidates,
    forecast: summarizeCapacityRisk(summary),
  };
}
