const { settingsModel } = require('../models/connection');

const GOVERNANCE_KEY = 'templates.governance';
const GOVERNANCE_HISTORY_KEY = 'templates.governanceHistory';
const DEPLOYMENTS_KEY = 'templates.deployments';
const GOVERNANCE_STAGES = new Set(['draft', 'staged', 'stable', 'deprecated']);
const GOVERNANCE_VALIDATION = new Set(['untested', 'review', 'validated', 'failed']);
const DEPLOYMENT_VALIDATION = new Set(['pending', 'validated', 'warning', 'failed']);
const MAX_HISTORY = 400;

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

function normalizeHistoryRecord(record = {}) {
  return {
    id: String(record.id || `tmplhist-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
    templateRef: String(record.templateRef || ''),
    templateName: String(record.templateName || '').trim(),
    eventType: String(record.eventType || 'saved').trim(),
    actor: String(record.actor || '').trim(),
    happenedAt: record.happenedAt || new Date().toISOString(),
    baselineTemplateRef: String(record.baselineTemplateRef || '').trim(),
    baselineTemplateName: String(record.baselineTemplateName || '').trim(),
    baselineVersionLabel: String(record.baselineVersionLabel || '').trim(),
    promotionNotes: String(record.promotionNotes || '').trim(),
    detail: String(record.detail || '').trim(),
    snapshot: normalizeGovernanceRecord(record.templateRef, record.snapshot || {}),
  };
}

function sortHistory(records) {
  return [...records].sort((left, right) =>
    new Date(right.happenedAt || 0) - new Date(left.happenedAt || 0)
  );
}

const templateGovernanceService = {
  listGovernance() {
    return sortGovernance(readCollection(GOVERNANCE_KEY, []));
  },

  getGovernance(templateRef) {
    return this.listGovernance().find((entry) => entry.templateRef === templateRef) || null;
  },

  listHistory(templateRef = '') {
    const history = sortHistory(readCollection(GOVERNANCE_HISTORY_KEY, []));
    if (!templateRef) return history;
    return history.filter((entry) => entry.templateRef === templateRef);
  },

  getHistoryEntry(templateRef, historyId) {
    return this.listHistory(templateRef).find((entry) => entry.id === historyId) || null;
  },

  recordGovernanceHistory(templateRef, snapshot, options = {}) {
    const history = readCollection(GOVERNANCE_HISTORY_KEY, []);
    history.unshift(normalizeHistoryRecord({
      templateRef,
      templateName: options.templateName,
      eventType: options.eventType || 'saved',
      actor: options.actor || '',
      happenedAt: options.happenedAt || new Date().toISOString(),
      baselineTemplateRef: options.baselineTemplateRef || '',
      baselineTemplateName: options.baselineTemplateName || '',
      baselineVersionLabel: options.baselineVersionLabel || '',
      promotionNotes: options.promotionNotes || '',
      detail: options.detail || '',
      snapshot,
    }));
    writeCollection(GOVERNANCE_HISTORY_KEY, history.slice(0, MAX_HISTORY));
    return history[0];
  },

  upsertGovernance(templateRef, payload, options = {}) {
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
    this.recordGovernanceHistory(templateRef, nextRecord, {
      templateName: options.templateName || '',
      actor: options.actor || '',
      eventType: options.eventType || 'saved',
      detail: options.detail || '',
      happenedAt: nextRecord.updatedAt,
    });
    return nextRecord;
  },

  promoteTemplate(templateRef, payload = {}, options = {}) {
    const records = readCollection(GOVERNANCE_KEY, []);
    const index = records.findIndex((entry) => entry.templateRef === templateRef);
    if (index === -1) {
      const notFound = new Error('TEMPLATE_GOVERNANCE_NOT_FOUND');
      notFound.code = 'TEMPLATE_GOVERNANCE_NOT_FOUND';
      throw notFound;
    }

    const current = normalizeGovernanceRecord(templateRef, records[index]);
    if (current.validationStatus !== 'validated') {
      const invalid = new Error('PROMOTION_REQUIRES_VALIDATED_TEMPLATE');
      invalid.code = 'PROMOTION_REQUIRES_VALIDATED_TEMPLATE';
      throw invalid;
    }

    const profileLabel = String(current.profileLabel || '').trim().toLowerCase();
    const explicitBaselineRef = String(payload.baselineTemplateRef || '').trim();
    const retireExistingStable = payload.retireExistingStable !== false;
    const now = new Date().toISOString();
    const deprecated = [];

    for (let cursor = 0; cursor < records.length; cursor += 1) {
      if (cursor === index) continue;
      const record = normalizeGovernanceRecord(records[cursor].templateRef, records[cursor]);
      const sameProfile = profileLabel && String(record.profileLabel || '').trim().toLowerCase() === profileLabel;
      const explicitlySelected = explicitBaselineRef && record.templateRef === explicitBaselineRef;
      if (record.lifecycleStage !== 'stable' || (!sameProfile && !explicitlySelected)) continue;

      if (retireExistingStable) {
        const updated = normalizeGovernanceRecord(record.templateRef, {
          ...record,
          lifecycleStage: 'deprecated',
          goldenImage: false,
          updatedAt: now,
          notes: [record.notes, `Deprecated on ${now} after promotion of ${current.versionLabel || current.templateRef}.`]
            .filter(Boolean)
            .join(' '),
        });
        records[cursor] = updated;
        deprecated.push(updated);
        this.recordGovernanceHistory(record.templateRef, updated, {
          templateName: options.templateNames?.[record.templateRef] || '',
          actor: options.actor || '',
          eventType: 'retired',
          baselineTemplateRef: templateRef,
          baselineTemplateName: options.templateNames?.[templateRef] || '',
          baselineVersionLabel: current.versionLabel || '',
          promotionNotes: String(payload.promotionNotes || '').trim(),
          detail: `${current.versionLabel || current.templateRef} replaced this stable baseline during promotion.`,
          happenedAt: now,
        });
      }
    }

    const promoted = normalizeGovernanceRecord(templateRef, {
      ...current,
      lifecycleStage: 'stable',
      goldenImage: true,
      updatedAt: now,
      notes: [current.notes, String(payload.promotionNotes || '').trim()].filter(Boolean).join(' '),
    });
    records[index] = promoted;
    writeCollection(GOVERNANCE_KEY, records);

    this.recordGovernanceHistory(templateRef, promoted, {
      templateName: options.templateNames?.[templateRef] || '',
      actor: options.actor || '',
      eventType: 'promoted',
      baselineTemplateRef: explicitBaselineRef || deprecated[0]?.templateRef || '',
      baselineTemplateName: explicitBaselineRef ? (options.templateNames?.[explicitBaselineRef] || '') : (options.templateNames?.[deprecated[0]?.templateRef] || ''),
      baselineVersionLabel: deprecated[0]?.versionLabel || '',
      promotionNotes: String(payload.promotionNotes || '').trim(),
      detail: `${promoted.versionLabel || promoted.templateRef} promoted to stable lifecycle stage.`,
      happenedAt: now,
    });

    return {
      promoted,
      deprecated,
      history: this.listHistory(templateRef),
    };
  },

  restoreHistoryEntry(templateRef, historyId, options = {}) {
    const sourceEntry = this.getHistoryEntry(templateRef, historyId);
    if (!sourceEntry) {
      const notFound = new Error('TEMPLATE_GOVERNANCE_HISTORY_NOT_FOUND');
      notFound.code = 'TEMPLATE_GOVERNANCE_HISTORY_NOT_FOUND';
      throw notFound;
    }

    const records = readCollection(GOVERNANCE_KEY, []);
    const index = records.findIndex((entry) => entry.templateRef === templateRef);
    const now = new Date().toISOString();
    const restored = normalizeGovernanceRecord(templateRef, {
      ...sourceEntry.snapshot,
      updatedAt: now,
    });

    if (index === -1) {
      records.push(restored);
    } else {
      records[index] = restored;
    }

    writeCollection(GOVERNANCE_KEY, records);
    this.recordGovernanceHistory(templateRef, restored, {
      templateName: options.templateName || '',
      actor: options.actor || '',
      eventType: 'restored',
      detail: `Restored governance snapshot from ${sourceEntry.eventType || 'history'} recorded on ${sourceEntry.happenedAt || 'an earlier revision'}.`,
      happenedAt: now,
    });

    return {
      record: restored,
      sourceEntry,
      history: this.listHistory(templateRef),
    };
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
