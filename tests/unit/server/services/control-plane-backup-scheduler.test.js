const path = require('path');
const fs = require('fs');

const TEST_DB = path.join(__dirname, '..', '..', '..', 'data', 'control-plane-backup-scheduler.db');
const TEST_SECURITY_DB = path.join(__dirname, '..', '..', '..', 'data', 'control-plane-backup-scheduler-security.db');
const TEST_VAULT_DB = path.join(__dirname, '..', '..', '..', 'data', 'control-plane-backup-scheduler-vault.db');
const TEST_PERF_DB = path.join(__dirname, '..', '..', '..', 'data', 'control-plane-backup-scheduler-perf.db');
const TEST_BACKUP_PATH = path.join(__dirname, '..', '..', '..', 'data', 'control-plane-backup-scheduler-snapshots');

Object.assign(process.env, {
  DB_PATH: TEST_DB,
  SECURITY_DB_PATH: TEST_SECURITY_DB,
  VAULT_DB_PATH: TEST_VAULT_DB,
  PERF_DB_PATH: TEST_PERF_DB,
  CONTROL_PLANE_BACKUP_PATH: TEST_BACKUP_PATH,
});

function cleanup() {
  [TEST_DB, TEST_SECURITY_DB, TEST_VAULT_DB, TEST_PERF_DB].forEach((file) => {
    if (fs.existsSync(file)) fs.unlinkSync(file);
  });
  if (fs.existsSync(TEST_BACKUP_PATH)) fs.rmSync(TEST_BACKUP_PATH, { recursive: true, force: true });
}

cleanup();

const systemConfigService = require('../../../../server/services/system-config');
const backupService = require('../../../../server/services/control-plane-backup');

describe('Control-plane backup scheduler', () => {
  beforeEach(() => {
    if (fs.existsSync(TEST_BACKUP_PATH)) fs.rmSync(TEST_BACKUP_PATH, { recursive: true, force: true });
  });

  afterEach(() => {
    backupService.stopScheduler();
    jest.restoreAllMocks();
  });

  afterAll(() => {
    cleanup();
  });

  it('does not arm a timer when disabled', () => {
    systemConfigService.updateSection('controlPlaneBackup', { enabled: false, intervalHours: 6 });
    const spy = jest.spyOn(global, 'setInterval');

    backupService.startScheduler();

    expect(spy).not.toHaveBeenCalled();
  });

  it('arms an unref-ed timer at the configured interval when enabled, clamped to at least 1 hour', () => {
    systemConfigService.updateSection('controlPlaneBackup', { enabled: true, intervalHours: 6 });
    const spy = jest.spyOn(global, 'setInterval');

    backupService.startScheduler();

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][1]).toBe(6 * 3600000);

    systemConfigService.updateSection('controlPlaneBackup', { enabled: true, intervalHours: 0.001 });
    backupService.refreshScheduler();

    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy.mock.calls[1][1]).toBe(3600000);
  });

  it('replaces the previous timer on refresh instead of stacking a second one', () => {
    systemConfigService.updateSection('controlPlaneBackup', { enabled: true, intervalHours: 6 });
    const clearSpy = jest.spyOn(global, 'clearInterval');

    backupService.startScheduler();
    backupService.refreshScheduler();

    expect(clearSpy).toHaveBeenCalledTimes(1);
  });

  it('clears the timer on stop', () => {
    systemConfigService.updateSection('controlPlaneBackup', { enabled: true, intervalHours: 6 });
    const clearSpy = jest.spyOn(global, 'clearInterval');

    backupService.startScheduler();
    backupService.stopScheduler();

    expect(clearSpy).toHaveBeenCalledTimes(1);
  });

  it('creates and audit-logs a snapshot when the scheduled tick runs', async () => {
    expect(backupService.listSnapshots()).toHaveLength(0);

    const snapshot = await backupService.runScheduledSnapshot();

    expect(snapshot.databases).toEqual(['xenmange.db', 'security.db', 'vault.db', 'perf.db']);
    expect(backupService.listSnapshots()).toHaveLength(1);
    expect(backupService.listSnapshots()[0].id).toBe(snapshot.id);
  });
});
