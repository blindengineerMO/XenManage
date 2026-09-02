const path = require('path');
const fs = require('fs');

const TEST_DB = path.join(__dirname, '..', '..', '..', 'data', 'metrics-collector.db');
const TEST_PERF_DB = path.join(__dirname, '..', '..', '..', 'data', 'metrics-collector-perf.db');

process.env.DB_PATH = TEST_DB;
process.env.PERF_DB_PATH = TEST_PERF_DB;

const { settingsModel } = require('../../../server/models/connection');
const { getPerfDb } = require('../../../server/models/perf-db');
const metricsCollector = require('../../../server/services/metrics-collector');
const { setConnection, clearConnections } = require('../../../server/services/xenapi');

describe('metricsCollector', () => {
  beforeAll(() => {
    [TEST_DB, TEST_PERF_DB].forEach((file) => {
      if (fs.existsSync(file)) fs.unlinkSync(file);
    });
  });

  beforeEach(() => {
    settingsModel.set('performance.collectionEnabled', 'true');
    settingsModel.set('performance.collectionIntervalSeconds', '60');
    getPerfDb().prepare('DELETE FROM metric_samples').run();
    getPerfDb().prepare('DELETE FROM metric_collection_cursors').run();
    clearConnections();
    metricsCollector.__resetForTests();
  });

  afterAll(() => {
    metricsCollector.stop();
    clearConnections();
    [TEST_DB, TEST_PERF_DB].forEach((file) => {
      if (fs.existsSync(file)) fs.unlinkSync(file);
    });
  });

  function buildFakeApi(host = '10.0.0.1') {
    return {
      host,
      sessionRef: `OpaqueRef:${host.replace(/\./g, '-')}`,
      async getHosts() {
        return {
          records: {
            'OpaqueRef:host1': {
              name_label: 'alpha-xen',
              uuid: 'host-uuid-1',
              enabled: true,
            },
          },
        };
      },
      async getVMs() {
        return {
          records: {
            'OpaqueRef:vm1': {
              name_label: 'app-01',
              uuid: 'vm-uuid-1',
              memory_static_max: 8589934592,
              memory_dynamic_max: 8589934592,
              VCPUs_at_startup: 4,
              is_a_template: false,
            },
          },
        };
      },
      async getSRs() {
        return {
          records: {
            'OpaqueRef:sr1': {
              name_label: 'Primary SR',
              uuid: 'sr-uuid-1',
              physical_size: 32212254720,
              virtual_allocation: 21474836480,
            },
          },
        };
      },
      async getHostMetrics() {
        return {
          live: true,
          memory_total: 68719476736,
          memory_free: 17179869184,
        };
      },
      async getRrdUpdates() {
        return {
          meta: {
            legend: [
              'AVERAGE:host:host-uuid-1:cpu_avg',
              'AVERAGE:host:host-uuid-1:pif_eth0_rx',
              'AVERAGE:host:host-uuid-1:pif_eth0_tx',
              'AVERAGE:vm:vm-uuid-1:cpu0',
              'AVERAGE:vm:vm-uuid-1:cpu1',
              'AVERAGE:vm:vm-uuid-1:cpu2',
              'AVERAGE:vm:vm-uuid-1:cpu3',
              'AVERAGE:vm:vm-uuid-1:vif_0_rx',
              'AVERAGE:vm:vm-uuid-1:vif_0_tx',
              'AVERAGE:vm:vm-uuid-1:vbd_xvda_read',
              'AVERAGE:vm:vm-uuid-1:vbd_xvda_write',
            ],
          },
          data: [
            { t: 1724670000, values: [0.42, 180, 132, 0.1, 0.2, 0.3, 0.4, 96, 72, 54, 32] },
            { t: 1724670060, values: [0.55, 240, 168, 0.2, 0.3, 0.4, 0.5, 128, 92, 68, 40] },
          ],
        };
      },
      async getVMMetrics() {
        return {
          memory_actual: 6442450944,
        };
      },
    };
  }

  it('schedules according to persisted runtime settings', () => {
    settingsModel.set('performance.collectionIntervalSeconds', '180');
    const status = metricsCollector.start();

    expect(status.enabled).toBe(true);
    expect(status.intervalSeconds).toBe(180);
    expect(status.active).toBe(true);
    expect(status.nextRunAt).toEqual(expect.any(String));

    metricsCollector.stop();
    expect(metricsCollector.getStatus().active).toBe(false);
  });

  it('collects across live targets and records runtime status', async () => {
    setConnection('session-a', 'connection:1', buildFakeApi('10.0.0.10'));

    const result = await metricsCollector.collectAllLiveTargets({
      force: true,
      source: 'scheduler',
    });

    expect(result).toEqual(expect.objectContaining({
      source: 'scheduler',
      targetCount: 1,
      captured: true,
    }));
    expect(result.sampleCount).toBeGreaterThan(0);
    const cpuSamples = getPerfDb().prepare(`
      SELECT entity_ref, metric_name, value
      FROM metric_samples
      WHERE metric_name = 'cpu_usage_percent'
      ORDER BY entity_ref ASC
    `).all();
    expect(cpuSamples).toHaveLength(2);
    expect(cpuSamples[0]).toEqual(expect.objectContaining({
      entity_ref: 'OpaqueRef:host1',
      metric_name: 'cpu_usage_percent',
    }));
    expect(cpuSamples[0].value).toBeCloseTo(55, 5);
    expect(cpuSamples[1]).toEqual(expect.objectContaining({
      entity_ref: 'OpaqueRef:vm1',
      metric_name: 'cpu_usage_percent',
    }));
    expect(cpuSamples[1].value).toBeCloseTo(35, 5);

    const throughputSamples = getPerfDb().prepare(`
      SELECT entity_ref, metric_name, value
      FROM metric_samples
      WHERE metric_name IN (
        'network_rx_kib_per_s',
        'network_tx_kib_per_s',
        'disk_read_kib_per_s',
        'disk_write_kib_per_s'
      )
      ORDER BY entity_ref ASC, metric_name ASC
    `).all();
    expect(throughputSamples).toEqual(expect.arrayContaining([
      expect.objectContaining({
        entity_ref: 'OpaqueRef:host1',
        metric_name: 'network_rx_kib_per_s',
        value: 240,
      }),
      expect.objectContaining({
        entity_ref: 'OpaqueRef:host1',
        metric_name: 'network_tx_kib_per_s',
        value: 168,
      }),
      expect.objectContaining({
        entity_ref: 'OpaqueRef:vm1',
        metric_name: 'network_rx_kib_per_s',
        value: 128,
      }),
      expect.objectContaining({
        entity_ref: 'OpaqueRef:vm1',
        metric_name: 'network_tx_kib_per_s',
        value: 92,
      }),
      expect.objectContaining({
        entity_ref: 'OpaqueRef:vm1',
        metric_name: 'disk_read_kib_per_s',
        value: 68,
      }),
      expect.objectContaining({
        entity_ref: 'OpaqueRef:vm1',
        metric_name: 'disk_write_kib_per_s',
        value: 40,
      }),
    ]));

    const status = metricsCollector.getStatus();
    expect(status.targetCount).toBe(1);
    expect(status.runCount).toBe(1);
    expect(status.lastResult).toEqual(expect.objectContaining({
      source: 'scheduler',
      sampleCount: expect.any(Number),
    }));
  });

  it('uses and advances a persisted RRD cursor for each target', async () => {
    const api = buildFakeApi();
    const getRrdUpdates = jest.spyOn(api, 'getRrdUpdates');

    await metricsCollector.collectTarget(api, { targetKey: 'connection:1' }, { force: true });
    await metricsCollector.collectTarget(api, { targetKey: 'connection:1' }, { force: true });

    expect(getRrdUpdates.mock.calls[0][0]).toEqual(expect.objectContaining({ start: expect.any(Number) }));
    expect(getRrdUpdates.mock.calls[1][0]).toEqual(expect.objectContaining({ start: 1724670061 }));
    expect(getPerfDb().prepare('SELECT last_rrd_ts FROM metric_collection_cursors WHERE target_key = ?').get('connection:1'))
      .toEqual({ last_rrd_ts: 1724670060 });
  });
});
