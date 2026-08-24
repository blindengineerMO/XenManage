const { settingsModel } = require('../models/connection');

const GOVERNANCE_KEY = 'templates.governance';
const DEPLOYMENTS_KEY = 'templates.deployments';
const GOVERNANCE_STAGES = new Set(['draft', 'staged', 'stable', 'deprecated']);
const GOVERNANCE_VALIDATION = new Set(['untested', 'review', 'validated', 'failed']);
const DEPLOYMENT_VALIDATION = new Set(['pending', 'validated', 'warning', 'failed']);

function readCollection(key, fallback) {
  try {
    const stored = JSON.parse(settingsModel.get(key) || JSON.stringify(fallback));
    if (Array.isArray(fallback)) {
      return Array.isArray(stored) ? stored : fallback;
    }
    return stored && typeof stored === 'object' ? stored : fallback;
  } catch (error) {
    return fallback;
  }
}

function writeCollection(key, value) {
  settingsModel.set(key, JSON.stringify(value));
}

function normalizeGovernanceRecord(templateRef, payload = {}) {
  const lifecycleStage = String(payload.lifecycleStage || 'draft').toLowerCase();
  const validationStatus = String(payload.validationStatus || 'untested').toLowerCase();

  return {
    templateRef,
    versionLabel: String(payload.versionLabel || '').trim(),
    profileLabel: String(payload.profileLabel || '').trim(),
    lifecycleStage: GOVERNANCE_STAGES.has(lifecycleStage) ? lifecycleStage : 'draft',
    goldenImage: Boolean(payload.goldenImage),
    guestCustomization: String(payload.guestCustomization || '').trim(),
    validationStatus: GOVERNANCE_VALIDATION.has(validationStatus) ? validationStatus : 'untested',
    lastValidatedAt: payload.lastValidatedAt || '',
    owner: String(payload.owner || '').trim(),
    notes: String(payload.notes || '').trim(),
    updatedAt: payload.updatedAt || new Date().toISOString(),
  };
}

function sortGovernance(records) {
  return [...records].sort((left, right) => {
    const leftName = String(left.templateRef || '').toLowerCase();
    const rightName = String(right.templateRef || '').toLowerCase();
    return leftName.localeCompare(rightName);
  });
}

function normalizeDeploymentRecord(record = {}) {
  const validationStatus = String(record.validationStatus || 'pending').toLowerCase();
  return {
    id: String(record.id || `tmpldep-${Date.now()}`),
    templateRef: String(record.templateRef || ''),
    templateName: String(record.templateName || '').trim(),
    templateVersion: String(record.templateVersion || '').trim(),
    vmRef: String(record.vmRef || ''),
    vmName: String(record.vmName || '').trim(),
    hostRef: String(record.hostRef || ''),
    hostLabel: String(record.hostLabel || '').trim(),
    storageRef: String(record.storageRef || ''),
    storageLabel: String(record.storageLabel || '').trim(),
    networkRef: String(record.networkRef || ''),
    networkLabel: String(record.networkLabel || '').trim(),
    startAfter: Boolean(record.startAfter),
    submittedBy: String(record.submittedBy || '').trim(),
    submittedAt: record.submittedAt || new Date().toISOString(),
    validationStatus: DEPLOYMENT_VALIDATION.has(validationStatus) ? validationStatus : 'pending',
    validationNotes: String(record.validationNotes || '').trim(),
    guestCustomization: String(record.guestCustomization || '').trim(),
    bootVerified: Boolean(record.bootVerified),
    networkVerified: Boolean(record.networkVerified),
    storageVerified: Boolean(record.storageVerified),
    policyTagged: Boolean(record.policyTagged),
    updatedAt: record.updatedAt || new Date().toISOString(),
  };
}

function sortDeployments(records) {
  return [...records].sort((left, right) =>
    new Date(right.updatedAt || right.submittedAt || 0) - new Date(left.updatedAt || left.submittedAt || 0)
  );
}

const templateGovernanceService = {
  listGovernance() {
    return sortGovernance(readCollection(GOVERNANCE_KEY, []));
  },

  getGovernance(templateRef) {
    return this.listGovernance().find((entry) => entry.templateRef === templateRef) || null;
  },

  upsertGovernance(templateRef, payload) {
    const records = readCollection(GOVERNANCE_KEY, []);
    const nextRecord = normalizeGovernanceRecord(templateRef, {
      ...payload,
      updatedAt: new Date().toISOString(),
    });
    const index = records.findIndex((entry) => entry.templateRef === templateRef);

    if (index === -1) {
      records.push(nextRecord);
    } else {
      records[index] = nextRecord;
    }

    writeCollection(GOVERNANCE_KEY, records);
    return nextRecord;
  },

  listDeployments() {
    return sortDeployments(readCollection(DEPLOYMENTS_KEY, []));
  },

  recordDeployment(record) {
    const deployments = readCollection(DEPLOYMENTS_KEY, []);
    const normalized = normalizeDeploymentRecord({
      ...record,
      id: record.id || `tmpldep-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      updatedAt: new Date().toISOString(),
    });
    deployments.push(normalized);
    writeCollection(DEPLOYMENTS_KEY, deployments);
    return normalized;
  },

  updateDeploymentValidation(id, payload = {}) {
    const deployments = readCollection(DEPLOYMENTS_KEY, []);
    const index = deployments.findIndex((entry) => entry.id === id);
    if (index === -1) {
      return null;
    }

    const nextRecord = normalizeDeploymentRecord({
      ...deployments[index],
      ...payload,
      id,
      updatedAt: new Date().toISOString(),
    });
    deployments[index] = nextRecord;
    writeCollection(DEPLOYMENTS_KEY, deployments);
    return nextRecord;
  },
};

module.exports = templateGovernanceService;
