function mapDemoTargetRoute(cls = '') {
  const value = String(cls).toLowerCase();
  if (value === 'host') return '/hosts';
  if (value === 'sr' || value === 'vdi' || value === 'vbd') return '/storage';
  if (value === 'vm') return '/vms';
  if (value === 'pool') return '/pools';
  if (value === 'network' || value === 'vif' || value === 'pif') return '/networking';
  if (value === 'task') return '/activity';
  return '/inventory';
}

function mapDemoTargetLabel(cls = '') {
  const route = mapDemoTargetRoute(cls);
  if (route === '/hosts') return 'Host View';
  if (route === '/storage') return 'Storage View';
  if (route === '/vms') return 'VM View';
  if (route === '/pools') return 'Pool View';
  if (route === '/networking') return 'Network View';
  if (route === '/activity') return 'Activity View';
  return 'Inventory View';
}

function normalizeDemoAlertPolicy(policy = {}) {
  return {
    id: policy.id || `alert-policy-${Date.now()}`,
    enabled: policy.enabled !== false,
    name: String(policy.name || '').trim(),
    matchClass: String(policy.matchClass || '').trim().toLowerCase(),
    matchTargetRoute: String(policy.matchTargetRoute || '').trim(),
    matchObject: String(policy.matchObject || '').trim().toLowerCase(),
    matchSeverity: String(policy.matchSeverity || '').trim().toLowerCase(),
    matchText: String(policy.matchText || '').trim().toLowerCase(),
    textMatchMode: String(policy.textMatchMode || 'phrase').trim().toLowerCase() === 'all' ? 'all' : 'phrase',
    autoAcknowledge: Boolean(policy.autoAcknowledge),
    suppressionHours: Math.max(0, Number(policy.suppressionHours || 0)),
    severityOverride: String(policy.severityOverride || '').trim().toLowerCase(),
    healthAction: String(policy.healthAction || 'none').trim().toLowerCase(),
    notes: String(policy.notes || '').trim(),
    updatedAt: policy.updatedAt || new Date().toISOString(),
  };
}

function listDemoAlertPolicies() {
  return clone((demoDb.alertPolicies || [])
    .map((policy) => normalizeDemoAlertPolicy(policy))
    .sort((left, right) => new Date(right.updatedAt || 0) - new Date(left.updatedAt || 0)));
}

function matchesDemoAlertPolicy(message, policy, baseSeverity) {
  if (!policy?.enabled || !policy?.name) return false;
  if (policy.matchClass && policy.matchClass !== String(message?.cls || '').toLowerCase()) return false;
  if (policy.matchTargetRoute && policy.matchTargetRoute !== mapDemoTargetRoute(message?.cls)) return false;
  if (policy.matchSeverity && policy.matchSeverity !== baseSeverity) return false;

  if (policy.matchObject) {
    const identityHaystack = `${message?.ref || ''} ${message?.name || ''} ${message?.uuid || ''} ${message?.obj_uuid || ''}`.toLowerCase();
    if (!identityHaystack.includes(policy.matchObject)) return false;
  }

  if (policy.matchText) {
    const haystack = `${message?.name || ''} ${message?.body || ''} ${message?.uuid || ''} ${message?.obj_uuid || ''}`.toLowerCase();
    if (policy.textMatchMode === 'all') {
      const terms = policy.matchText.split(/[\s,]+/).map((term) => term.trim()).filter(Boolean);
      if (!terms.length || !terms.every((term) => haystack.includes(term))) return false;
    } else if (!haystack.includes(policy.matchText)) {
      return false;
    }
  }

  return true;
}

function getBestDemoAlertPolicy(message, baseSeverity) {
  let bestPolicy = null;
  let bestScore = -1;

  for (const policy of listDemoAlertPolicies()) {
    if (!matchesDemoAlertPolicy(message, policy, baseSeverity)) continue;

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

function buildDemoAlert(message) {
  const baseSeverity = getMessageSeverity(message);
  const state = demoDb.alertStates[message.ref] || {};
  const hasManualState = Boolean(state.updatedAt);
  const policy = getBestDemoAlertPolicy(message, baseSeverity);
  const policyState = policy ? {
    acknowledged: Boolean(policy.autoAcknowledge),
    acknowledgedAt: policy.autoAcknowledge ? (message.timestamp || new Date().toISOString()) : '',
    acknowledgedBy: policy.autoAcknowledge ? `policy:${policy.name}` : '',
    suppressionUntil: policy.suppressionHours > 0
      ? new Date(new Date(message.timestamp || Date.now()).getTime() + policy.suppressionHours * 60 * 60 * 1000).toISOString()
      : '',
    severityOverride: policy.severityOverride || '',
    healthAction: policy.healthAction || 'none',
    notes: policy.notes || '',
    updatedAt: policy.updatedAt || '',
    policyId: policy.id,
    policyName: policy.name,
  } : null;
  const mergedState = hasManualState ? state : { ...(policyState || {}), ...state };
  const suppressionUntil = mergedState.suppressionUntil || '';
  const suppressed = suppressionUntil ? new Date(suppressionUntil).getTime() > Date.now() : false;

  return {
    ...clone(message),
    summary: getMessageHeadline(message),
    baseSeverity,
    effectiveSeverity: mergedState.severityOverride || baseSeverity,
    targetRoute: mapDemoTargetRoute(message.cls),
    targetLabel: mapDemoTargetLabel(message.cls),
    acknowledged: Boolean(mergedState.acknowledged),
    acknowledgedAt: mergedState.acknowledgedAt || '',
    acknowledgedBy: mergedState.acknowledgedBy || '',
    suppressionUntil,
    severityOverride: mergedState.severityOverride || '',
    healthAction: mergedState.healthAction || 'none',
    notes: mergedState.notes || '',
    updatedAt: mergedState.updatedAt || '',
    suppressed,
    stateLabel: suppressed ? 'suppressed' : mergedState.acknowledged ? 'acknowledged' : 'open',
    managedByPolicy: Boolean(policyState && !hasManualState),
    policyId: policyState?.policyId || '',
    policyName: policyState?.policyName || '',
  };
}

function resolveDemoInventoryLabel(collection, ref, fallback = '') {
  const record = (collection || []).find((item) => item.ref === ref);
  if (!record) return fallback || ref || '';
  return record.name_label || record.hostname || record.bridge || record.address || record.ref || fallback || '';
}
