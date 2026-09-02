/* ============================================
   Shared Store And Session Routing
   ============================================ */

const store = reactive({
  authenticated: false,
  connected: false,
  demoMode: false,
  host: '',
  username: '',
  authMode: 'local',
  currentTargetKey: '',
  connectedTargets: [],
  vFabricScope: null,
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
const globalConfirmState = reactive({
  show: false,
  title: 'Confirm',
  message: '',
  confirmLabel: 'Confirm',
  danger: false,
});
let globalConfirmResolver = null;

const GOVERNANCE_APPROVAL_STORAGE_KEY = 'xenmange.pendingGovernanceApproval';

function getActiveLiveTarget(targets = store.connectedTargets) {
  const list = Array.isArray(targets) ? targets : [];
  return list.find((target) => target?.active) || list[0] || null;
}

function getVFabricScopeTargets() {
  const targets = store.vFabricScope?.attachedTargets;
  return Array.isArray(targets) && targets.length ? targets : [];
}

function hasVFabricScope() {
  return Boolean(store.vFabricScope?.scope?.id && getVFabricScopeTargets().length);
}

function clearVFabricScope() {
  store.vFabricScope = null;
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
  if (store.vFabricScope?.attachedTargets?.some((target) => !store.connectedTargets.some((entry) => entry.targetKey === target.targetKey))) {
    clearVFabricScope();
  }
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
  clearVFabricScope();
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

function settleGlobalConfirm(confirmed = false) {
  const resolver = globalConfirmResolver;
  globalConfirmResolver = null;
  globalConfirmState.show = false;
  globalConfirmState.title = 'Confirm';
  globalConfirmState.message = '';
  globalConfirmState.confirmLabel = 'Confirm';
  globalConfirmState.danger = false;
  if (typeof resolver === 'function') {
    resolver(Boolean(confirmed));
  }
}

function requestGlobalConfirm(options = {}) {
  if (typeof window === 'undefined') return Promise.resolve(true);
  if (globalConfirmResolver) settleGlobalConfirm(false);

  globalConfirmState.title = String(options.title || 'Confirm').trim() || 'Confirm';
  globalConfirmState.message = String(options.message || '').trim();
  globalConfirmState.confirmLabel = String(options.confirmLabel || 'Confirm').trim() || 'Confirm';
  globalConfirmState.danger = Boolean(options.danger);
  globalConfirmState.show = true;

  return new Promise((resolve) => {
    globalConfirmResolver = resolve;
  });
}

const ROUTE_FOCUS_KEYS = ['focusKind', 'focusRef', 'focusUuid', 'focusName', 'focusClass', 'focusSource'];
const APP_ROUTE_LABELS = {
  '/': 'Dashboard',
  '/login': 'Connection',
  '/pools': 'Pools',
  '/templates': 'Templates',
  '/template-library': 'Template Library',
  '/vfabrics': 'vFabrics',
  '/vms': 'Virtual Machines',
  '/hosts': 'Hosts',
  '/storage': 'Storage',
  '/networking': 'Networking',
  '/inventory': 'Inventory',
  '/governance': 'Governance',
  '/settings': 'Settings',
  '/lifecycle': 'Lifecycle',
  '/capacity': 'Capacity',
  '/resilience': 'Resilience',
  '/alerts': 'Alerts',
  '/activity': 'Activity',
};

function cleanRouteQuery(query = {}) {
  return Object.fromEntries(
    Object.entries(query || {})
      .filter(([, value]) => value !== undefined && value !== null && value !== '')
      .map(([key, value]) => [key, String(value)])
  );
}

function resolveAppRouteLabel(path = '') {
  return APP_ROUTE_LABELS[String(path || '').trim()] || String(path || '').trim() || 'Workspace';
}

function clearRouteFocusQuery(query = {}) {
  const nextQuery = { ...(query || {}) };
  ROUTE_FOCUS_KEYS.forEach((key) => {
    delete nextQuery[key];
  });
  delete nextQuery.focusSearch;
  return cleanRouteQuery(nextQuery);
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

function humanizeFocusKind(value = '') {
  const normalized = String(value || '').trim().toLowerCase();
  const labels = {
    vm: 'VM',
    host: 'Host',
    pool: 'Pool',
    sr: 'Storage Repository',
    storage: 'Storage',
    vdi: 'VDI',
    vbd: 'VBD',
    network: 'Network',
    vif: 'VIF',
    pif: 'PIF',
    bond: 'Bond',
    vlan: 'VLAN',
    alert: 'Alert',
    task: 'Task',
    template: 'Template',
    workspace: 'Workspace',
  };
  return labels[normalized] || normalized.toUpperCase() || 'Resource';
}

function buildTopNavBreadcrumbs(route = {}) {
  const path = String(route?.path || '/').trim() || '/';
  const focus = getRouteFocus(route?.query || {});
  const breadcrumbs = [
    {
      key: 'home',
      label: 'Home',
      to: store.authenticated ? '/' : '/login',
      icon: 'mdi-home-outline',
    },
  ];

  if (path !== '/login' && path !== '/') {
    breadcrumbs.push({
      key: `route:${path}`,
      label: resolveAppRouteLabel(path),
      to: focus ? { path, query: clearRouteFocusQuery(route?.query || {}) } : null,
    });
  } else if (path === '/login') {
    breadcrumbs.push({
      key: 'route:/login',
      label: resolveAppRouteLabel(path),
      to: null,
    });
  }

  if (focus) {
    const subject = focus.name || focus.ref || focus.uuid || '';
    const label = subject
      ? `${humanizeFocusKind(focus.kind || focus.cls)} ${subject}`
      : humanizeFocusKind(focus.kind || focus.cls);
    breadcrumbs.push({
      key: `focus:${getRouteFocusKey(focus)}`,
      label,
      to: null,
    });
  }

  return breadcrumbs.map((entry, index) => ({
    ...entry,
    current: index === breadcrumbs.length - 1,
  }));
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
