const { settingsModel } = require('../models/connection');

const RUNBOOKS_KEY = 'resilience.runbooks';
const DRILLS_KEY = 'resilience.drills';
const MAX_DRILLS = 200;

function readList(key) {
  try {
    const stored = JSON.parse(settingsModel.get(key) || '[]');
    return Array.isArray(stored) ? stored : [];
  } catch (error) {
    return [];
  }
}

function writeList(key, records) {
  settingsModel.set(key, JSON.stringify(records));
}

function sortByRecent(records, field = 'updatedAt') {
  return [...records].sort((left, right) =>
    new Date(right?.[field] || 0) - new Date(left?.[field] || 0)
  );
}

function normalizeSteps(steps = []) {
  return (Array.isArray(steps) ? steps : [])
    .map((step) => String(step || '').trim())
    .filter(Boolean)
    .slice(0, 8);
}

const resilienceRunbookService = {
  getRunbooks() {
    return sortByRecent(readList(RUNBOOKS_KEY));
  },

  getRunbook(poolRef) {
    return this.getRunbooks().find((record) => record.poolRef === poolRef) || null;
  },

  upsertRunbook(poolRef, payload) {
    const runbooks = readList(RUNBOOKS_KEY);
    const nextRecord = {
      poolRef,
      recoveryTier: payload.recoveryTier || 'standard',
      haPolicy: payload.haPolicy || 'manual',
      restartPriority: payload.restartPriority || 'medium',
      backupWindowHours: Number(payload.backupWindowHours || 24),
      rpoMinutes: Number(payload.rpoMinutes || 60),
      rtoMinutes: Number(payload.rtoMinutes || 120),
      restorePointStatus: payload.restorePointStatus || 'review',
      owner: payload.owner || '',
      standbyHostRef: payload.standbyHostRef || '',
      failoverNetworkRef: payload.failoverNetworkRef || '',
      lastVerifiedAt: payload.lastVerifiedAt || '',
      runbookSteps: normalizeSteps(payload.runbookSteps),
      notes: payload.notes || '',
      sourceTaskRef: payload.sourceTaskRef || '',
      sourceTemplateId: payload.sourceTemplateId || '',
      sourceTemplateName: payload.sourceTemplateName || '',
      updatedAt: new Date().toISOString(),
    };
    const index = runbooks.findIndex((record) => record.poolRef === poolRef);

    if (index === -1) {
      runbooks.push(nextRecord);
    } else {
      runbooks[index] = nextRecord;
    }

    writeList(RUNBOOKS_KEY, runbooks);
    return nextRecord;
  },

  removeRunbook(poolRef) {
    const runbooks = readList(RUNBOOKS_KEY);
    const nextRecords = runbooks.filter((record) => record.poolRef !== poolRef);
    writeList(RUNBOOKS_KEY, nextRecords);
    return { success: true };
  },

  getDrills() {
    return sortByRecent(readList(DRILLS_KEY), 'executedAt');
  },

  logDrill(poolRef, payload, operator = 'system') {
    const drills = readList(DRILLS_KEY);
    const record = {
      id: payload.id || `drill-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      poolRef,
      drillType: payload.drillType || 'restore',
      status: payload.status || 'success',
      scope: payload.scope || '',
      executedAt: payload.executedAt || new Date().toISOString(),
      durationMinutes: Number(payload.durationMinutes || 0),
      summary: payload.summary || '',
      findings: payload.findings || '',
      nextStep: payload.nextStep || '',
      operator,
      createdAt: new Date().toISOString(),
    };

    drills.unshift(record);
    writeList(DRILLS_KEY, drills.slice(0, MAX_DRILLS));
    return record;
  },
};

module.exports = resilienceRunbookService;
