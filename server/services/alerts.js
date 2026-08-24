const { settingsModel } = require('../models/connection');
const crypto = require('crypto');

const SETTINGS_KEY = 'alerts.state';
const POLICIES_KEY = 'alerts.policies';
const VALID_SEVERITIES = new Set(['critical', 'warning', 'info', 'notice']);
const VALID_ACTIONS = new Set(['none', 'inspect', 'monitor', 'review', 'evacuate', 'snapshot', 'lifecycle', 'capacity', 'resilience', 'governance']);

function getMessageHeadline(message) {
  return message?.name || message?.body || message?.cls || 'Alert';
}

function getMessageSeverity(message) {
  const explicit = String(message?.effectiveSeverity || message?.severity || '').toLowerCase();
  if (VALID_SEVERITIES.has(explicit)) {
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

function getTargetRoute(cls = '') {
  const value = String(cls).toLowerCase();
  if (value === 'host') return '/hosts';
  if (value === 'sr' || value === 'vdi' || value === 'vbd') return '/storage';
  if (value === 'vm') return '/vms';
  if (value === 'pool') return '/pools';
  if (value === 'network' || value === 'vif' || value === 'pif') return '/networking';
  if (value === 'task') return '/activity';
  return '/inventory';
}

function getTargetLabel(cls = '') {
  const route = getTargetRoute(cls);
  if (route === '/hosts') return 'Host View';
  if (route === '/storage') return 'Storage View';
  if (route === '/vms') return 'VM View';
  if (route === '/pools') return 'Pool View';
  if (route === '/networking') return 'Network View';
  if (route === '/activity') return 'Activity View';
  return 'Inventory View';
}

function readAlertStateMap() {
  try {
    const stored = JSON.parse(settingsModel.get(SETTINGS_KEY) || '{}');
    return stored && typeof stored === 'object' ? stored : {};
  } catch (error) {
    return {};
  }
}

function writeAlertStateMap(stateMap) {
  settingsModel.set(SETTINGS_KEY, JSON.stringify(stateMap));
}

function readAlertPolicies() {
  try {
    const stored = JSON.parse(settingsModel.get(POLICIES_KEY) || '[]');
    return Array.isArray(stored) ? stored : [];
  } catch (error) {
    return [];
  }
}

function writeAlertPolicies(policies) {
  settingsModel.set(POLICIES_KEY, JSON.stringify(policies));
}

function normalizeAlertState(state = {}) {
  const severityOverride = String(state.severityOverride || '').toLowerCase();
  const healthAction = String(state.healthAction || 'none').toLowerCase();
  return {
    acknowledged: Boolean(state.acknowledged),
    acknowledgedAt: state.acknowledgedAt || '',
    acknowledgedBy: state.acknowledgedBy || '',
    suppressionUntil: state.suppressionUntil || '',
    severityOverride: VALID_SEVERITIES.has(severityOverride) ? severityOverride : '',
    healthAction: VALID_ACTIONS.has(healthAction) ? healthAction : 'none',
    notes: state.notes || '',
    updatedAt: state.updatedAt || '',
  };
}

function normalizeAlertPolicy(policy = {}, current = {}) {
  const severityOverride = String(policy.severityOverride || '').toLowerCase();
  const healthAction = String(policy.healthAction || 'none').toLowerCase();
  const matchSeverity = String(policy.matchSeverity || '').toLowerCase();
  const textMatchMode = String(policy.textMatchMode || current.textMatchMode || 'phrase').toLowerCase();
  return {
    id: current.id || policy.id || crypto.randomUUID(),
    enabled: policy.enabled !== false,
    name: String(policy.name || current.name || '').trim(),
    matchClass: String(policy.matchClass || '').trim().toLowerCase(),
    matchTargetRoute: String(policy.matchTargetRoute || '').trim(),
    matchObject: String(policy.matchObject || '').trim().toLowerCase(),
    matchSeverity: VALID_SEVERITIES.has(matchSeverity) ? matchSeverity : '',
    matchText: String(policy.matchText || '').trim().toLowerCase(),
    textMatchMode: textMatchMode === 'all' ? 'all' : 'phrase',
    autoAcknowledge: Boolean(policy.autoAcknowledge),
    suppressionHours: Math.max(0, Number(policy.suppressionHours || 0)),
    severityOverride: VALID_SEVERITIES.has(severityOverride) ? severityOverride : '',
    healthAction: VALID_ACTIONS.has(healthAction) ? healthAction : 'none',
    notes: String(policy.notes || '').trim(),
    updatedAt: policy.updatedAt || new Date().toISOString(),
  };
}

function listAlertPolicies() {
  return readAlertPolicies()
    .map((policy) => normalizeAlertPolicy(policy, policy))
    .sort((left, right) => new Date(right.updatedAt || 0) - new Date(left.updatedAt || 0));
}

function getAlertPolicy(id) {
  return listAlertPolicies().find((policy) => policy.id === id) || null;
}

function saveAlertPolicy(payload = {}, id = '') {
  const policies = readAlertPolicies();
  const index = id ? policies.findIndex((policy) => policy.id === id) : -1;
  const current = index >= 0 ? normalizeAlertPolicy(policies[index], policies[index]) : {};
  const next = normalizeAlertPolicy({ ...current, ...payload, id: id || current.id }, current);

  if (index >= 0) {
    policies[index] = next;
  } else {
    policies.unshift(next);
  }

  writeAlertPolicies(policies);
  return next;
}

function deleteAlertPolicy(id) {
  const policies = readAlertPolicies();
  const index = policies.findIndex((policy) => policy.id === id);
  if (index === -1) return { deleted: false, previous: null };
  const previous = normalizeAlertPolicy(policies[index], policies[index]);
  policies.splice(index, 1);
  writeAlertPolicies(policies);
  return { deleted: true, previous };
}

function matchesAlertPolicy(record, policy, baseSeverity) {
  if (!policy?.enabled) return false;
  if (!policy.name) return false;

  const cls = String(record?.cls || '').toLowerCase();
  if (policy.matchClass && policy.matchClass !== cls) return false;
  if (policy.matchTargetRoute && policy.matchTargetRoute !== getTargetRoute(cls)) return false;
  if (policy.matchSeverity && policy.matchSeverity !== baseSeverity) return false;

  if (policy.matchObject) {
    const identityHaystack = `${record?.ref || ''} ${record?.name || ''} ${record?.uuid || ''} ${record?.obj_uuid || ''}`.toLowerCase();
    if (!identityHaystack.includes(policy.matchObject)) return false;
  }

  if (policy.matchText) {
    const haystack = `${record?.name || ''} ${record?.body || ''} ${record?.uuid || ''} ${record?.obj_uuid || ''}`.toLowerCase();
    if (policy.textMatchMode === 'all') {
      const terms = policy.matchText.split(/[\s,]+/).map((term) => term.trim()).filter(Boolean);
      if (!terms.length || !terms.every((term) => haystack.includes(term))) return false;
    } else if (!haystack.includes(policy.matchText)) {
      return false;
    }
  }

  return true;
}

function getBestPolicyMatch(record, policies, baseSeverity) {
  let bestPolicy = null;
  let bestScore = -1;

  for (const policy of policies) {
    if (!matchesAlertPolicy(record, policy, baseSeverity)) continue;

    const score = [
      policy.matchClass ? 2 : 0,
      policy.matchTargetRoute ? 2 : 0,
      policy.matchSeverity ? 2 : 0,
      policy.matchObject ? 3 + policy.matchObject.length / 100 : 0,
      policy.matchText ? 3 + policy.matchText.length / 100 : 0,
    ].reduce((sum, value) => sum + value, 0);

    if (score > bestScore) {
      bestPolicy = policy;
      bestScore = score;
      continue;
    }

    if (score === bestScore && bestPolicy) {
      if (new Date(policy.updatedAt || 0) > new Date(bestPolicy.updatedAt || 0)) {
        bestPolicy = policy;
      }
    }
  }

  return bestPolicy;
}

function derivePolicyState(record, policy) {
  if (!policy) return null;

  let suppressionUntil = '';
  if (policy.suppressionHours > 0) {
    const baseTime = new Date(record?.timestamp || Date.now()).getTime();
    suppressionUntil = new Date(baseTime + policy.suppressionHours * 60 * 60 * 1000).toISOString();
  }

  return {
    acknowledged: Boolean(policy.autoAcknowledge),
    acknowledgedAt: policy.autoAcknowledge ? (record?.timestamp || new Date().toISOString()) : '',
    acknowledgedBy: policy.autoAcknowledge ? `policy:${policy.name}` : '',
    suppressionUntil,
    severityOverride: policy.severityOverride || '',
    healthAction: policy.healthAction || 'none',
    notes: policy.notes || '',
    updatedAt: policy.updatedAt || '',
    policyId: policy.id,
    policyName: policy.name,
  };
}

function sortAlerts(alerts) {
  const severityOrder = { critical: 0, warning: 1, info: 2, notice: 3 };
  return [...alerts].sort((left, right) => {
    const severityDelta = (severityOrder[left.effectiveSeverity] ?? 99) - (severityOrder[right.effectiveSeverity] ?? 99);
    if (severityDelta !== 0) return severityDelta;
    return new Date(right.timestamp || 0) - new Date(left.timestamp || 0);
  });
}

function mergeAlertRecord(record, state = {}) {
  const normalizedState = normalizeAlertState(state);
  const baseSeverity = getMessageSeverity(record);
  const policy = getBestPolicyMatch(record, listAlertPolicies(), baseSeverity);
  const policyState = derivePolicyState(record, policy);
  const hasManualState = Boolean(normalizedState.updatedAt);
  const mergedState = hasManualState
    ? normalizedState
    : normalizeAlertState(policyState || {});
  const suppressionUntil = mergedState.suppressionUntil || '';
  const suppressed = suppressionUntil ? new Date(suppressionUntil).getTime() > Date.now() : false;
  const effectiveSeverity = mergedState.severityOverride || baseSeverity;

  return {
    ...record,
    summary: getMessageHeadline(record),
    baseSeverity,
    effectiveSeverity,
    targetRoute: getTargetRoute(record.cls),
    targetLabel: getTargetLabel(record.cls),
    suppressed,
    stateLabel: suppressed ? 'suppressed' : mergedState.acknowledged ? 'acknowledged' : 'open',
    managedByPolicy: Boolean(policyState && !hasManualState),
    policyId: policyState?.policyId || '',
    policyName: policyState?.policyName || '',
    ...mergedState,
  };
}

function listAlerts(messageRecords = {}) {
  const stateMap = readAlertStateMap();
  const alerts = Object.entries(messageRecords || {}).map(([ref, record]) => mergeAlertRecord({ ref, ...record }, stateMap[ref]));
  return sortAlerts(alerts);
}

function saveAlertState(ref, payload, username = '') {
  const stateMap = readAlertStateMap();
  const nextState = normalizeAlertState({
    ...stateMap[ref],
    ...payload,
    acknowledgedAt: payload.acknowledged ? (stateMap[ref]?.acknowledgedAt || new Date().toISOString()) : '',
    acknowledgedBy: payload.acknowledged ? (username || stateMap[ref]?.acknowledgedBy || '') : '',
    updatedAt: new Date().toISOString(),
  });

  stateMap[ref] = nextState;
  writeAlertStateMap(stateMap);
  return nextState;
}

module.exports = {
  deleteAlertPolicy,
  getAlertPolicy,
  getBestPolicyMatch,
  getMessageHeadline,
  getMessageSeverity,
  getTargetLabel,
  getTargetRoute,
  listAlerts,
  listAlertPolicies,
  mergeAlertRecord,
  normalizeAlertPolicy,
  saveAlertState,
  saveAlertPolicy,
};
