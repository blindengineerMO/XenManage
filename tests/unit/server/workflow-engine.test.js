const path = require('path');
const fs = require('fs');

const TEST_DB = path.join(__dirname, '..', '..', '..', 'data', 'workflow-engine.db');
process.env.DB_PATH = TEST_DB;

const { getDb } = require('../../../server/models/connection');
const workflowEngine = require('../../../server/services/workflow-engine');

describe('workflow engine', () => {
  beforeAll(() => {
    if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
    getDb();
  });

  beforeEach(() => {
    workflowEngine.__resetForTests();
    getDb().prepare('DELETE FROM workflows').run();
  });

  afterAll(() => {
    workflowEngine.__resetForTests();
    if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
  });

  it('persists an idempotent execution with structured events', async () => {
    workflowEngine.register('test.success', async ({ setProgress, log }) => {
      setProgress(50, 'Halfway through the durable workflow.');
      log('info', 'Completed test handler.');
      return { ok: true };
    });
    const first = workflowEngine.create({ type: 'test.success', idempotencyKey: 'same-request', lockKey: 'pool-a' });
    const second = workflowEngine.create({ type: 'test.success', idempotencyKey: 'same-request', lockKey: 'pool-a' });

    expect(second.created).toBe(false);
    expect(second.workflow.id).toBe(first.workflow.id);
    await workflowEngine.execute(first.workflow.id);

    const workflow = workflowEngine.get(first.workflow.id);
    expect(workflow).toEqual(expect.objectContaining({ status: 'completed', progress: 100, result: { ok: true } }));
    expect(workflow.events.map((event) => event.message)).toEqual(expect.arrayContaining([
      'Workflow created.', 'Workflow execution started.', 'Completed test handler.', 'Workflow completed.',
    ]));
  });

  it('returns failed work to retrying until the configured attempt limit is reached', async () => {
    workflowEngine.register('test.failure', async () => {
      const error = new Error('UPSTREAM_UNAVAILABLE');
      error.code = 'UPSTREAM_UNAVAILABLE';
      throw error;
    });
    const { workflow } = workflowEngine.create({ type: 'test.failure', maxAttempts: 2 });

    await workflowEngine.execute(workflow.id);
    expect(workflowEngine.get(workflow.id)).toEqual(expect.objectContaining({ status: 'retrying', attempt_count: 1 }));

    getDb().prepare('UPDATE workflows SET scheduled_for = ? WHERE id = ?').run(new Date(0).toISOString(), workflow.id);
    await workflowEngine.execute(workflow.id);
    expect(workflowEngine.get(workflow.id)).toEqual(expect.objectContaining({ status: 'failed', attempt_count: 2, error_text: 'UPSTREAM_UNAVAILABLE' }));
  });

  it('tracks per-step status and fails a step that exceeds its own timeout', async () => {
    workflowEngine.register('test.steps', async ({ step }) => {
      await step('scan', 'Scan hosts', async () => 'scanned');
      await step('apply', 'Apply patch', () => new Promise((resolve) => setTimeout(resolve, 50)), { timeoutMs: 5 });
      return { ok: true };
    });
    const { workflow } = workflowEngine.create({ type: 'test.steps', maxAttempts: 1 });
    await workflowEngine.execute(workflow.id);

    const finished = workflowEngine.get(workflow.id);
    expect(finished.status).toBe('failed');
    expect(finished.error_text).toBe('STEP_TIMEOUT');
    const stepStatuses = Object.fromEntries(finished.steps.map((s) => [s.step_key, s.status]));
    expect(stepStatuses).toEqual({ scan: 'completed', apply: 'failed' });
  });

  it('fails the whole workflow once its overall timeout elapses', async () => {
    workflowEngine.register('test.slow', () => new Promise((resolve) => setTimeout(() => resolve({ ok: true }), 50)));
    const { workflow } = workflowEngine.create({ type: 'test.slow', maxAttempts: 1, timeoutMs: 5 });
    await workflowEngine.execute(workflow.id);
    expect(workflowEngine.get(workflow.id)).toEqual(expect.objectContaining({ status: 'failed', error_text: 'WORKFLOW_TIMEOUT' }));
  });

  it('rolls back via a registered compensation handler once retries are exhausted', async () => {
    let compensated = false;
    workflowEngine.register('test.compensated', async () => {
      const error = new Error('PATCH_APPLY_FAILED');
      error.code = 'PATCH_APPLY_FAILED';
      throw error;
    });
    workflowEngine.registerCompensation('test.compensated', async () => {
      compensated = true;
    });
    const { workflow } = workflowEngine.create({ type: 'test.compensated', maxAttempts: 1 });
    await workflowEngine.execute(workflow.id);

    expect(compensated).toBe(true);
    const finished = workflowEngine.get(workflow.id);
    expect(finished.status).toBe('rolled-back');
    expect(finished.error_text).toBe('PATCH_APPLY_FAILED');
  });

  it('lets a non-executed workflow type manage its own status through setState', () => {
    workflowEngine.register('test.manual', async () => ({}));
    const { workflow } = workflowEngine.create({ type: 'test.manual', input: { note: 'ticket' } });

    const updated = workflowEngine.setState(workflow.id, { status: 'running', progress: 40, result: { note: 'in progress' } });
    expect(updated).toEqual(expect.objectContaining({ status: 'running', progress: 40 }));

    const completed = workflowEngine.setState(workflow.id, { status: 'completed', progress: 100, result: { note: 'done' } });
    expect(completed.finished_at).toBeTruthy();

    const detail = workflowEngine.get(workflow.id);
    expect(detail.events.map((event) => event.message)).toEqual(expect.arrayContaining([
      'Workflow status set to running.', 'Workflow status set to completed.',
    ]));
  });

  it('filters workflow listings by type', () => {
    workflowEngine.register('test.type-a', async () => ({}));
    workflowEngine.register('test.type-b', async () => ({}));
    workflowEngine.create({ type: 'test.type-a' });
    workflowEngine.create({ type: 'test.type-b' });

    expect(workflowEngine.list({ type: 'test.type-a' }).every((w) => w.type === 'test.type-a')).toBe(true);
    expect(workflowEngine.list({ type: 'test.type-a' })).toHaveLength(1);
  });
});
