const workflowEngine = require('./workflow-engine');

const WORKFLOW_TYPE = 'lifecycle.plan';

// Lifecycle plans are per-host desired-state policy records, not automated retry-driven
// work, so they are never run through workflowEngine.execute() - this handler only exists
// to satisfy workflowEngine.create()'s requirement that every workflow type have a handler.
workflowEngine.register(WORKFLOW_TYPE, async () => ({}));

function sortPlans(plans) {
  return [...plans].sort((left, right) =>
    new Date(right.updatedAt || 0) - new Date(left.updatedAt || 0)
  );
}

function workflowToPlan(workflow) {
  if (!workflow || workflow.type !== WORKFLOW_TYPE) return null;
  return workflow.result && Object.keys(workflow.result).length ? workflow.result : null;
}

const lifecyclePlanService = {
  getAll() {
    return sortPlans(
      workflowEngine.list({ type: WORKFLOW_TYPE, limit: 500 })
        .map(workflowToPlan)
        .filter(Boolean)
    );
  },

  upsert(hostRef, payload) {
    const nextRecord = {
      hostRef,
      ...payload,
      updatedAt: new Date().toISOString(),
    };

    const existing = workflowEngine.getByIdempotencyKey(WORKFLOW_TYPE, hostRef);
    const workflow = existing || workflowEngine.create({
      type: WORKFLOW_TYPE,
      idempotencyKey: hostRef,
      requestedBy: payload.owner || 'system',
    }).workflow;

    workflowEngine.setState(workflow.id, {
      status: 'completed',
      progress: 100,
      result: nextRecord,
      message: `Lifecycle plan saved for ${hostRef}.`,
    });
    return nextRecord;
  },

  remove(hostRef) {
    const existing = workflowEngine.getByIdempotencyKey(WORKFLOW_TYPE, hostRef);
    if (existing) workflowEngine.remove(existing.id);
    return { success: true };
  },
};

module.exports = lifecyclePlanService;
