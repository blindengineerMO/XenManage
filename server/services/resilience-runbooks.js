const workflowEngine = require('./workflow-engine');

const RUNBOOK_TYPE = 'resilience.runbook';
const DRILL_TYPE = 'resilience.drill';
const MAX_DRILLS = 200;

// Runbooks are per-pool DR policy records and drills are an append-only execution log -
// neither runs through workflowEngine.execute(), so these handlers only exist to satisfy
// workflowEngine.create()'s requirement that every workflow type have a registered handler.
workflowEngine.register(RUNBOOK_TYPE, async () => ({}));
workflowEngine.register(DRILL_TYPE, async () => ({}));

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

function workflowToRunbook(workflow) {
  if (!workflow || workflow.type !== RUNBOOK_TYPE) return null;
  return workflow.result && Object.keys(workflow.result).length ? workflow.result : null;
}

function workflowToDrill(workflow) {
  if (!workflow || workflow.type !== DRILL_TYPE) return null;
  return workflow.result && Object.keys(workflow.result).length ? workflow.result : null;
}

const resilienceRunbookService = {
  getRunbooks() {
    return sortByRecent(
      workflowEngine.list({ type: RUNBOOK_TYPE, limit: 500 })
        .map(workflowToRunbook)
        .filter(Boolean)
    );
  },

  getRunbook(poolRef) {
    return this.getRunbooks().find((record) => record.poolRef === poolRef) || null;
  },

  upsertRunbook(poolRef, payload) {
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
      drillCadenceDays: Number(payload.drillCadenceDays || 45),
      runbookSteps: normalizeSteps(payload.runbookSteps),
      notes: payload.notes || '',
      sourceTaskRef: payload.sourceTaskRef || '',
      sourceTemplateId: payload.sourceTemplateId || '',
      sourceTemplateName: payload.sourceTemplateName || '',
      updatedAt: new Date().toISOString(),
    };

    const existing = workflowEngine.getByIdempotencyKey(RUNBOOK_TYPE, poolRef);
    const workflow = existing || workflowEngine.create({
      type: RUNBOOK_TYPE,
      idempotencyKey: poolRef,
      requestedBy: payload.owner || 'system',
    }).workflow;

    workflowEngine.setState(workflow.id, {
      status: 'completed',
      progress: 100,
      result: nextRecord,
      message: `Resilience runbook saved for ${poolRef}.`,
    });
    return nextRecord;
  },

  removeRunbook(poolRef) {
    const existing = workflowEngine.getByIdempotencyKey(RUNBOOK_TYPE, poolRef);
    if (existing) workflowEngine.remove(existing.id);
    return { success: true };
  },

  getDrills() {
    return sortByRecent(
      workflowEngine.list({ type: DRILL_TYPE, limit: MAX_DRILLS })
        .map(workflowToDrill)
        .filter(Boolean),
      'executedAt'
    );
  },

  logDrill(poolRef, payload, operator = 'system') {
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

    const { workflow } = workflowEngine.create({ type: DRILL_TYPE, requestedBy: operator });
    workflowEngine.setState(workflow.id, {
      status: 'completed',
      progress: 100,
      result: record,
      message: `Resilience drill logged for ${poolRef}.`,
    });

    const overflow = workflowEngine.list({ type: DRILL_TYPE, limit: 10000 })
      .sort((left, right) => new Date(left.created_at || 0) - new Date(right.created_at || 0));
    if (overflow.length > MAX_DRILLS) {
      overflow.slice(0, overflow.length - MAX_DRILLS).forEach((stale) => workflowEngine.remove(stale.id));
    }

    return record;
  },
};

module.exports = resilienceRunbookService;
