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
});
