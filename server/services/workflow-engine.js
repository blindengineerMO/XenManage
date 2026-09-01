const crypto = require('crypto');
const { getDb } = require('../models/connection');

const TERMINAL_STATUSES = new Set(['completed', 'failed', 'rolled-back', 'cancelled']);
const RUNNABLE_STATUSES = new Set(['pending', 'retrying', 'scheduled']);
const handlers = new Map();
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

async function execute(id) {
  let workflow = get(id);
  if (!workflow) return null;
  if (!RUNNABLE_STATUSES.has(workflow.status)) return workflow;
  if (workflow.scheduled_for && Date.parse(workflow.scheduled_for) > Date.now()) return workflow;
  if (!lockAvailable(workflow)) return workflow;

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
  };

  try {
    const result = await handler(context);
    const current = get(id, false);
    if (current.status === 'waiting-approval') return get(id);
    appendEvent(id, 'info', 'Workflow completed.', { result: result || {} });
    return update(id, { status: 'completed', progress: 100, result: result || {}, finishedAt: now() });
  } catch (error) {
    const current = get(id, false);
    const errorText = error?.code || error?.message || 'WORKFLOW_EXECUTION_FAILED';
    const shouldRetry = current.attempt_count < current.max_attempts;
    appendEvent(id, 'error', 'Workflow execution failed.', { error: errorText, retrying: shouldRetry });
    return update(id, {
      status: shouldRetry ? 'retrying' : 'failed',
      errorText,
      scheduledFor: shouldRetry ? new Date(Date.now() + Math.min(300000, 1000 * (2 ** current.attempt_count))).toISOString() : null,
      finishedAt: shouldRetry ? null : now(),
    });
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

  create({ type, targetId = null, input = {}, idempotencyKey = '', maxAttempts = 3, scheduledFor = '', lockKey = '', requestedBy = 'system', steps = [] } = {}) {
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
    const transaction = getDb().transaction(() => {
      getDb().prepare(`
        INSERT INTO workflows (id, type, target_id, status, idempotency_key, input_json, max_attempts, scheduled_for, lock_key, requested_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, type, targetId || null, status, idempotencyKey || null, JSON.stringify(input || {}), Math.max(1, Number(maxAttempts || 3)), scheduledFor || null, lockKey || '', requestedBy || 'system');
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

  list({ status = '', targetId = null, limit = 100 } = {}) {
    const clauses = [];
    const params = [];
    if (status) { clauses.push('status = ?'); params.push(status); }
    if (targetId) { clauses.push('target_id = ?'); params.push(Number(targetId)); }
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
    inFlight = false;
  },
};

module.exports = workflowEngine;
