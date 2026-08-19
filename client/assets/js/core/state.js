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
      throw new Error(data.error || 'REQUEST_FAILED');
    }

    return data;
  },
  login: (host, username, password) => api.request('POST', '/api/auth/login', { host, username, password }),
  logout: () => api.request('POST', '/api/auth/logout'),
  status: () => api.request('GET', '/api/auth/status'),
  dashboard: () => api.request('GET', '/api/dashboard'),
  dashboardMessages: () => api.request('GET', '/api/dashboard/messages'),
  getTasks: () => api.request('GET', '/api/tasks'),
  getResilience: () => api.request('GET', '/api/resilience'),
  getVMs: (search) => api.request('GET', `/api/vms${search ? `?search=${encodeURIComponent(search)}` : ''}`),
  getTemplates: () => api.request('GET', '/api/vms/templates'),
  getVM: (ref) => api.request('GET', `/api/vms/${encodeURIComponent(ref)}`),
  vmAction: (action, ref, options = {}) => api.request('POST', `/api/vms/${action}`, { ref, ...options }),
  getHosts: () => api.request('GET', '/api/hosts'),
  getHostMetrics: (ref) => api.request('GET', `/api/hosts/${encodeURIComponent(ref)}/metrics`),
  getSRs: () => api.request('GET', '/api/storage'),
  getSRVDIs: (ref) => api.request('GET', `/api/storage/${encodeURIComponent(ref)}/vdis`),
  getNetworks: () => api.request('GET', '/api/networks'),
  getPools: () => api.request('GET', '/api/pools'),
  getConnections: () => api.request('GET', '/api/connections'),
  saveConnection: (payload) => api.request('POST', '/api/connections', payload),
};

const store = reactive({
  authenticated: false,
  demoMode: false,
  host: '',
  username: '',
  sidebarOpen: true,
  ready: false,
  bootMessage: 'Verifying session state',
});

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

function truncateList(value) {
  if (!Array.isArray(value) || value.length === 0) return '-';
  return value.slice(0, 4).join(', ');
}

function summarizeCount(label, value) {
  return `${value || 0} ${label}`;
}

function getMessageHeadline(message) {
  return message?.name || message?.body || message?.cls || 'Alert';
}

function getMessageSeverity(message) {
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

