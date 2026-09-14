// Durable workflow queue in xenmange.db (workflows / workflow_steps / workflow_events).
// Types must register() a handler before create(); execute() runs pending/retrying/
// scheduled rows with retries, timeouts, and optional compensation. Started from
// server/index.js. Consumed by routes/workflows.js, public-api.js, and by services
// that persist records as workflow rows (lifecycle-plans, resilience-runbooks,
// remediation-tasks). Those record-only types register a no-op handler and MUST
// use setState() — never execute() — so they are not retried as jobs. Idempotency
// is (type, idempotency_key). On process start, rows left 'running' are marked
// retrying with CONTROL_PLANE_RESTART. To add a real job type: register(handler),
// optionally registerCompensation(), then create({ type, input, steps }).
const crypto = require('crypto');
const { getDb } = require('../models/connection');

const TERMINAL_STATUSES = new Set(['completed', 'failed', 'rolled-back', 'cancelled']);
const RUNNABLE_STATUSES = new Set(['pending', 'retrying', 'scheduled']);
const handlers = new Map();
const compensations = new Map();
let timer = null;
let started = false;
let inFlight = false;

function now() {
  return new Date().toISOString();
}

function parseJson(value, fallback = {}) {
  try {
    return JSON.parse(value || JSON.stringify(fallback));
  } catch (_) {
    return fallback;
  }
}

function normalize(record, includeDetail = false) {
  if (!record) return null;
  const workflow = {
    ...record,
    target_id: record.target_id ? Number(record.target_id) : null,
    progress: Number(record.progress || 0),
    attempt_count: Number(record.attempt_count || 0),
    max_attempts: Number(record.max_attempts || 0),
    input: parseJson(record.input_json),
    result: parseJson(record.result_json),
  };
  delete workflow.input_json;
  delete workflow.result_json;
  if (includeDetail) {
    workflow.steps = getDb().prepare('SELECT * FROM workflow_steps WHERE workflow_id = ? ORDER BY sort_order, id').all(record.id);
    workflow.events = getDb().prepare('SELECT * FROM workflow_events WHERE workflow_id = ? ORDER BY created_at, id').all(record.id)
      .map((event) => ({ ...event, detail: parseJson(event.detail_json) }));
  }
  return workflow;
}

function get(id, includeDetail = true) {
  return normalize(getDb().prepare('SELECT * FROM workflows WHERE id = ?').get(id), includeDetail);
}

function appendEvent(workflowId, level, message, detail = {}) {
  getDb().prepare(`
    INSERT INTO workflow_events (id, workflow_id, level, message, detail_json)
    VALUES (?, ?, ?, ?, ?)
  `).run(crypto.randomUUID(), workflowId, level, message, JSON.stringify(detail || {}));
}

function update(id, changes = {}) {
  const current = get(id, false);
  if (!current) return null;
  const next = {
    status: changes.status ?? current.status,
    progress: changes.progress ?? current.progress,
    attemptCount: changes.attemptCount ?? current.attempt_count,
    result: changes.result ?? current.result,
    errorText: changes.errorText ?? current.error_text,
    approvalId: changes.approvalId ?? current.approval_id,
    startedAt: changes.startedAt ?? current.started_at,
    finishedAt: changes.finishedAt ?? current.finished_at,
    scheduledFor: changes.scheduledFor ?? current.scheduled_for,
  };
  getDb().prepare(`
    UPDATE workflows
    SET status = ?, progress = ?, attempt_count = ?, result_json = ?, error_text = ?, approval_id = ?,
      started_at = ?, finished_at = ?, scheduled_for = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    next.status,
    Math.max(0, Math.min(100, Number(next.progress || 0))),
    Math.max(0, Number(next.attemptCount || 0)),
    JSON.stringify(next.result || {}),
    String(next.errorText || ''),
    String(next.approvalId || ''),
    next.startedAt || null,
    next.finishedAt || null,
    next.scheduledFor || null,
    id
  );
  return get(id);
}

function lockAvailable(workflow) {
  if (!workflow.lock_key) return true;
  const row = getDb().prepare(`
    SELECT id FROM workflows WHERE lock_key = ? AND status IN ('running', 'waiting-approval') AND id != ? LIMIT 1
  `).get(workflow.lock_key, workflow.id);
  return !row;
}

function upsertStep(workflowId, stepKey, label) {
  const existing = getDb().prepare('SELECT id FROM workflow_steps WHERE workflow_id = ? AND step_key = ?').get(workflowId, stepKey);
  if (existing) return existing.id;
  const nextOrder = getDb().prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM workflow_steps WHERE workflow_id = ?').get(workflowId).n;
  const id = crypto.randomUUID();
  getDb().prepare(`
    INSERT INTO workflow_steps (id, workflow_id, step_key, label, sort_order)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, workflowId, stepKey, label || stepKey, nextOrder);
  return id;
}

function setStepStatus(workflowId, stepKey, status, errorText = '') {
  const timestampColumn = status === 'running' ? 'started_at' : (status === 'completed' || status === 'failed') ? 'finished_at' : null;
  getDb().prepare(`
    UPDATE workflow_steps
    SET status = ?, error_text = ?${timestampColumn ? `, ${timestampColumn} = CURRENT_TIMESTAMP` : ''}
    WHERE workflow_id = ? AND step_key = ?
  `).run(status, String(errorText || ''), workflowId, stepKey);
}

function withTimeout(promise, timeoutMs, onTimeoutError) {
  if (!timeoutMs || !Number.isFinite(timeoutMs) || timeoutMs <= 0) return promise;
  let timer2;
  const timeout = new Promise((_, reject) => {
    timer2 = setTimeout(() => reject(onTimeoutError()), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer2));
}

async function execute(id) {
  let workflow = get(id);
  if (!workflow) return null;
  if (!RUNNABLE_STATUSES.has(workflow.status)) return workflow;
  if (workflow.scheduled_for && Date.parse(workflow.scheduled_for) > Date.now()) return workflow;
  if (!lockAvailable(workflow)) return workflow;

  if (workflow.timeout_at && Date.parse(workflow.timeout_at) <= Date.now()) {
    appendEvent(id, 'error', 'Workflow exceeded its overall timeout before it could run.', { timeoutAt: workflow.timeout_at });
    return update(id, { status: 'failed', errorText: 'WORKFLOW_TIMEOUT', finishedAt: now() });
  }

  const handler = handlers.get(workflow.type);
  if (!handler) {
    appendEvent(id, 'error', 'No registered handler is available for this workflow type.', { type: workflow.type });
    return update(id, { status: 'failed', errorText: 'WORKFLOW_HANDLER_NOT_FOUND', finishedAt: now() });
  }

  workflow = update(id, {
    status: 'running',
    attemptCount: workflow.attempt_count + 1,
    startedAt: workflow.started_at || now(),
    errorText: '',
  });
  appendEvent(id, 'info', 'Workflow execution started.', { attempt: workflow.attempt_count });

  const context = {
    workflow,
    log(level, message, detail = {}) {
      appendEvent(id, level, message, detail);
    },
    setProgress(progress, detail = '') {
      const current = get(id, false);
      update(id, { progress, status: current.status });
      if (detail) appendEvent(id, 'info', detail, { progress });
    },
    waitForApproval(reason = '') {
      appendEvent(id, 'info', 'Workflow paused for approval.', { reason });
      return update(id, { status: 'waiting-approval' });
    },
    async step(stepKey, label, fn, { timeoutMs = 0 } = {}) {
      upsertStep(id, stepKey, label);
      setStepStatus(id, stepKey, 'running');
      appendEvent(id, 'info', `Step "${label || stepKey}" started.`, { step: stepKey });
      try {
        const result = await withTimeout(
          Promise.resolve().then(() => fn(context)),
          timeoutMs,
          () => Object.assign(new Error('STEP_TIMEOUT'), { code: 'STEP_TIMEOUT', step: stepKey })
        );
        setStepStatus(id, stepKey, 'completed');
        appendEvent(id, 'info', `Step "${label || stepKey}" completed.`, { step: stepKey });
        return result;
      } catch (error) {
        const errorText = error?.code || error?.message || 'STEP_FAILED';
        setStepStatus(id, stepKey, 'failed', errorText);
        appendEvent(id, 'error', `Step "${label || stepKey}" failed.`, { step: stepKey, error: errorText });
        throw error;
      }
    },
  };

  const remainingMs = workflow.timeout_at ? Date.parse(workflow.timeout_at) - Date.now() : 0;

  try {
    const result = await withTimeout(
      Promise.resolve().then(() => handler(context)),
      remainingMs > 0 ? remainingMs : 0,
      () => Object.assign(new Error('WORKFLOW_TIMEOUT'), { code: 'WORKFLOW_TIMEOUT' })
    );
    const current = get(id, false);
    if (current.status === 'waiting-approval') return get(id);
    appendEvent(id, 'info', 'Workflow completed.', { result: result || {} });
    return update(id, { status: 'completed', progress: 100, result: result || {}, finishedAt: now() });
  } catch (error) {
    const current = get(id, false);
    const errorText = error?.code || error?.message || 'WORKFLOW_EXECUTION_FAILED';
    const shouldRetry = current.attempt_count < current.max_attempts;

    if (shouldRetry) {
      appendEvent(id, 'error', 'Workflow execution failed.', { error: errorText, retrying: true });
      return update(id, {
        status: 'retrying',
        errorText,
        scheduledFor: new Date(Date.now() + Math.min(300000, 1000 * (2 ** current.attempt_count))).toISOString(),
        finishedAt: null,
      });
    }

    appendEvent(id, 'error', 'Workflow execution failed.', { error: errorText, retrying: false });

    const compensate = compensations.get(workflow.type);
    if (compensate) {
      try {
        appendEvent(id, 'warning', 'Running compensation to roll back partial work.', { error: errorText });
        await compensate({ ...context, workflow: get(id, false), error });
        appendEvent(id, 'info', 'Compensation completed; workflow rolled back.', {});
        return update(id, { status: 'rolled-back', errorText, finishedAt: now() });
      } catch (compensationError) {
        const compensationErrorText = compensationError?.code || compensationError?.message || 'COMPENSATION_FAILED';
        appendEvent(id, 'error', 'Compensation failed; workflow left in a failed state for manual cleanup.', { error: compensationErrorText });
        return update(id, { status: 'failed', errorText, finishedAt: now() });
      }
    }

    return update(id, { status: 'failed', errorText, finishedAt: now() });
  }
}

async function processDue() {
  if (inFlight) return [];
  inFlight = true;
  try {
    const due = getDb().prepare(`
      SELECT id FROM workflows
      WHERE status IN ('pending', 'retrying', 'scheduled')
        AND (scheduled_for IS NULL OR scheduled_for = '' OR scheduled_for <= ?)
      ORDER BY created_at
      LIMIT 20
    `).all(now());
    return Promise.all(due.map((entry) => execute(entry.id)));
  } finally {
    inFlight = false;
  }
}

function schedule() {
  if (!started) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(async () => {
    await processDue();
    schedule();
  }, 1000);
}

const workflowEngine = {
  register(type, handler) {
    handlers.set(String(type), handler);
  },

  registerCompensation(type, compensationHandler) {
    compensations.set(String(type), compensationHandler);
  },

  create({
    type, targetId = null, input = {}, idempotencyKey = '', maxAttempts = 3, scheduledFor = '',
    lockKey = '', requestedBy = 'system', steps = [], timeoutMs = 0,
  } = {}) {
    if (!handlers.has(String(type))) {
      const error = new Error('WORKFLOW_TYPE_UNSUPPORTED');
      error.code = 'WORKFLOW_TYPE_UNSUPPORTED';
      throw error;
    }
    if (idempotencyKey) {
      const existing = getDb().prepare('SELECT * FROM workflows WHERE type = ? AND idempotency_key = ?').get(type, idempotencyKey);
      if (existing) return { workflow: normalize(existing, true), created: false };
    }

    const id = crypto.randomUUID();
    const status = scheduledFor && Date.parse(scheduledFor) > Date.now() ? 'scheduled' : 'pending';
    const timeoutAt = timeoutMs > 0 ? new Date(Date.now() + Number(timeoutMs)).toISOString() : null;
    const transaction = getDb().transaction(() => {
      getDb().prepare(`
        INSERT INTO workflows (id, type, target_id, status, idempotency_key, input_json, max_attempts, scheduled_for, timeout_at, lock_key, requested_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, type, targetId || null, status, idempotencyKey || null, JSON.stringify(input || {}), Math.max(1, Number(maxAttempts || 3)), scheduledFor || null, timeoutAt, lockKey || '', requestedBy || 'system');
      const insertStep = getDb().prepare(`
        INSERT INTO workflow_steps (id, workflow_id, step_key, label, sort_order)
        VALUES (?, ?, ?, ?, ?)
      `);
      steps.forEach((step, index) => insertStep.run(crypto.randomUUID(), id, step.key || `step-${index + 1}`, step.label || step.key || `Step ${index + 1}`, index));
      appendEvent(id, 'info', 'Workflow created.', { type, targetId: targetId || null });
    });
    transaction();
    return { workflow: get(id), created: true };
  },

  get,

  getByIdempotencyKey(type, idempotencyKey) {
    if (!idempotencyKey) return null;
    return normalize(getDb().prepare('SELECT * FROM workflows WHERE type = ? AND idempotency_key = ?').get(type, idempotencyKey), false);
  },

  remove(id) {
    return getDb().prepare('DELETE FROM workflows WHERE id = ?').run(id).changes > 0;
  },

  list({ status = '', targetId = null, type = '', limit = 100 } = {}) {
    const clauses = [];
    const params = [];
    if (status) { clauses.push('status = ?'); params.push(status); }
    if (targetId) { clauses.push('target_id = ?'); params.push(Number(targetId)); }
    if (type) { clauses.push('type = ?'); params.push(String(type)); }
    params.push(Math.max(1, Math.min(500, Number(limit || 100))));
    return getDb().prepare(`
      SELECT * FROM workflows ${clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''}
      ORDER BY created_at DESC LIMIT ?
    `).all(...params).map((record) => normalize(record, false));
  },

  execute,

  approve(id, approvalId = '') {
    const workflow = get(id, false);
    if (!workflow) return null;
    if (workflow.status !== 'waiting-approval') return workflow;
    appendEvent(id, 'info', 'Workflow approval received.', { approvalId });
    return update(id, { status: 'pending', approvalId, scheduledFor: now() });
  },

  async cancel(id) {
    const workflow = get(id, false);
    if (!workflow || TERMINAL_STATUSES.has(workflow.status)) return workflow;
    appendEvent(id, 'warning', 'Workflow cancelled.', {});
    return update(id, { status: 'cancelled', finishedAt: now() });
  },

  // Low-level status setter for workflow types that are not driven by execute()'s
  // automatic retry loop (e.g. human-worked tickets) but still want durable storage,
  // structured events, and a single source of truth alongside engine-executed workflows.
  setState(id, { status, progress, result, errorText = '', message = '' } = {}) {
    const current = get(id, false);
    if (!current) return null;
    const finishedAt = TERMINAL_STATUSES.has(status) ? now() : null;
    const startedAt = current.started_at || (status && status !== 'pending' ? now() : null);
    const next = update(id, { status, progress, result, errorText, startedAt, finishedAt });
    appendEvent(id, errorText ? 'warning' : 'info', message || `Workflow status set to ${status}.`, { status });
    return next;
  },

  start() {
    started = true;
    const recovered = getDb().prepare(`
      UPDATE workflows SET status = 'retrying', error_text = 'CONTROL_PLANE_RESTART', scheduled_for = ?, updated_at = CURRENT_TIMESTAMP
      WHERE status = 'running'
    `).run(now()).changes;
    if (recovered) {
      getDb().prepare(`
        INSERT INTO workflow_events (id, workflow_id, level, message, detail_json)
        SELECT lower(hex(randomblob(16))), id, 'warning', 'Workflow recovered after control-plane restart.', '{}'
        FROM workflows WHERE status = 'retrying' AND error_text = 'CONTROL_PLANE_RESTART'
      `).run();
    }
    processDue().catch(() => {});
    schedule();
  },

  stop() {
    started = false;
    if (timer) clearTimeout(timer);
    timer = null;
  },

  __resetForTests() {
    this.stop();
    handlers.clear();
    compensations.clear();
    inFlight = false;
  },
};

module.exports = workflowEngine;
