const http = require('http');
const path = require('path');
const fs = require('fs');

const TEST_DB = path.join(__dirname, '..', '..', '..', 'data', 'metrics-routes.db');
const TEST_SECURITY_DB = path.join(__dirname, '..', '..', '..', 'data', 'metrics-security.db');
const TEST_PERF_DB = path.join(__dirname, '..', '..', '..', 'data', 'metrics-perf.db');

process.env.DB_PATH = TEST_DB;
process.env.SECURITY_DB_PATH = TEST_SECURITY_DB;
process.env.PERF_DB_PATH = TEST_PERF_DB;

jest.mock('../../../../server/services/xenapi', () => {
  const actual = jest.requireActual('../../../../server/services/xenapi');

  actual.XenAPI.prototype.login = jest.fn(async function () {
    this.sessionRef = 'OpaqueRef:mock-session';
    return this.sessionRef;
  });

  actual.XenAPI.prototype.logout = jest.fn(async function () {
    this.sessionRef = null;
  });

  actual.XenAPI.prototype.getHosts = jest.fn(async function () {
    return {
      records: {
        'OpaqueRef:host1': {
          name_label: 'alpha-xen',
          uuid: 'host-uuid-1',
          enabled: true,
        },
      },
    };
  });

  actual.XenAPI.prototype.getVMs = jest.fn(async function () {
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
        'OpaqueRef:template1': {
          name_label: 'ubuntu-template',
          uuid: 'template-uuid-1',
          memory_static_max: 4294967296,
          VCPUs_at_startup: 2,
          is_a_template: true,
        },
      },
    };
  });

  actual.XenAPI.prototype.getSRs = jest.fn(async function () {
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
  });

  actual.XenAPI.prototype.getHostMetrics = jest.fn(async function () {
    return {
      live: true,
      memory_total: 68719476736,
      memory_free: 17179869184,
    };
  });

  actual.XenAPI.prototype.getVMMetrics = jest.fn(async function () {
    return {
      memory_actual: 6442450944,
    };
  });

  actual.XenAPI.prototype.rpc = jest.fn(async function () {
    return {};
  });

  actual.XenAPI.prototype.getRrdUpdates = jest.fn(async function ({ start = 0, cf = 'AVERAGE', interval = 60, host = false } = {}) {
    return {
      meta: {
        start,
        end: start + interval,
        step: interval,
        cf,
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
        host,
      },
      data: [
        { t: start, values: [0.42, 180, 132, 0.1, 0.2, 0.3, 0.4, 96, 72, 54, 32] },
        { t: start + interval, values: [0.55, 240, 168, 0.2, 0.3, 0.4, 0.5, 128, 92, 68, 40] },
      ],
    };
  });

  return actual;
});

const app = require('../../../../server/index');
const { getPerfDb, metricSampleModel, toHourlyBucket } = require('../../../../server/models/perf-db');
const metricsHistoryService = require('../../../../server/services/metrics-history');

describe('Metrics Routes', () => {
  let server;
  let port;

  beforeAll((done) => {
    [TEST_DB, TEST_SECURITY_DB, TEST_PERF_DB].forEach((file) => {
      if (fs.existsSync(file)) fs.unlinkSync(file);
    });

    server = app.listen(0, () => {
      port = server.address().port;
      done();
    });
  });

  afterAll((done) => {
    server.close(() => {
      [TEST_DB, TEST_SECURITY_DB, TEST_PERF_DB].forEach((file) => {
        if (fs.existsSync(file)) fs.unlinkSync(file);
      });
      done();
    });
  });

  function request(method, pathName, body, cookie) {
    return new Promise((resolve, reject) => {
      const data = body ? JSON.stringify(body) : null;
      const options = {
        hostname: 'localhost',
        port,
        path: pathName,
        method,
        headers: { 'Content-Type': 'application/json' },
      };

      if (data) options.headers['Content-Length'] = Buffer.byteLength(data);
      if (cookie) options.headers.Cookie = cookie;

      const req = http.request(options, (res) => {
        let responseText = '';
        res.on('data', (chunk) => { responseText += chunk; });
        res.on('end', () => {
          const setCookie = res.headers['set-cookie'];
          let sessionCookie = cookie;
          if (setCookie) {
            const match = setCookie.find((entry) => entry.startsWith('xenmange.sid='));
            if (match) sessionCookie = match.split(';')[0];
          }

          try {
            resolve({
              status: res.statusCode,
              body: JSON.parse(responseText),
              headers: res.headers,
              cookie: sessionCookie,
            });
          } catch {
            resolve({
              status: res.statusCode,
              body: responseText,
              headers: res.headers,
              cookie: sessionCookie,
            });
          }
        });
      });

      req.on('error', reject);
      if (data) req.write(data);
      req.end();
    });
  }

  async function login() {
    const auth = await request('POST', '/api/auth/login', {
      username: 'admin',
      password: 'admin123!',
    });

    return request('POST', '/api/auth/xen-login', {
      host: '192.168.1.100',
      username: 'root',
      password: 'pass',
    }, auth.cookie);
  }

  it('captures and returns cluster telemetry history', async () => {
    const auth = await login();
    const res = await request('GET', '/api/metrics/cluster?range=24h', null, auth.cookie);

    expect(res.status).toBe(200);
    expect(res.body.range).toBe('24h');
    expect(res.body.metrics).toEqual(expect.arrayContaining([
      expect.objectContaining({ metricName: 'cluster_cpu_usage_percent' }),
      expect.objectContaining({ metricName: 'cluster_memory_used_percent' }),
      expect.objectContaining({ metricName: 'cluster_storage_utilization_percent' }),
      expect.objectContaining({ metricName: 'cluster_vm_memory_actual_bytes' }),
      expect.objectContaining({ metricName: 'cluster_vm_network_rx_kib_per_s' }),
      expect.objectContaining({ metricName: 'cluster_vm_network_tx_kib_per_s' }),
      expect.objectContaining({ metricName: 'cluster_vm_disk_read_kib_per_s' }),
      expect.objectContaining({ metricName: 'cluster_vm_disk_write_kib_per_s' }),
    ]));
    expect(res.body.metrics.every((entry) => Array.isArray(entry.points) && entry.points.length >= 1)).toBe(true);
  });

  it('returns the latest persisted capacity baseline across hosts, vms, and storage', async () => {
    const auth = await login();
    const res = await request('GET', '/api/metrics/capacity-baseline', null, auth.cookie);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({
      generatedAt: expect.any(String),
      hosts: expect.arrayContaining([
        expect.objectContaining({
          entityRef: 'OpaqueRef:host1',
          cpu_usage_percent: expect.any(Number),
          memory_used_percent: expect.any(Number),
          network_rx_kib_per_s: expect.any(Number),
          network_tx_kib_per_s: expect.any(Number),
        }),
      ]),
      vms: expect.arrayContaining([
        expect.objectContaining({
          entityRef: 'OpaqueRef:vm1',
          memory_actual_bytes: expect.any(Number),
          cpu_usage_percent: expect.any(Number),
          network_rx_kib_per_s: expect.any(Number),
          network_tx_kib_per_s: expect.any(Number),
          disk_read_kib_per_s: expect.any(Number),
          disk_write_kib_per_s: expect.any(Number),
        }),
      ]),
      storage: expect.arrayContaining([
        expect.objectContaining({
          entityRef: 'OpaqueRef:sr1',
          utilization_percent: expect.any(Number),
        }),
      ]),
    }));
  });

  it('returns entity telemetry history for hosts, vms, and storage', async () => {
    const auth = await login();

    const hostRes = await request('GET', '/api/metrics/hosts/OpaqueRef:host1?range=24h', null, auth.cookie);
    expect(hostRes.status).toBe(200);
    expect(hostRes.body.entityType).toBe('host');
    expect(hostRes.body.metrics.some((entry) => entry.metricName === 'cpu_usage_percent')).toBe(true);
    expect(hostRes.body.metrics.some((entry) => entry.metricName === 'memory_used_percent')).toBe(true);
    expect(hostRes.body.metrics.some((entry) => entry.metricName === 'network_rx_kib_per_s')).toBe(true);
    expect(hostRes.body.metrics.some((entry) => entry.metricName === 'network_tx_kib_per_s')).toBe(true);

    const vmRes = await request('GET', '/api/metrics/vms/OpaqueRef:vm1?range=24h', null, auth.cookie);
    expect(vmRes.status).toBe(200);
    expect(vmRes.body.entityType).toBe('vm');
    expect(vmRes.body.metrics.some((entry) => entry.metricName === 'cpu_usage_percent')).toBe(true);
    expect(vmRes.body.metrics.some((entry) => entry.metricName === 'memory_usage_percent')).toBe(true);
    expect(vmRes.body.metrics.some((entry) => entry.metricName === 'network_rx_kib_per_s')).toBe(true);
    expect(vmRes.body.metrics.some((entry) => entry.metricName === 'network_tx_kib_per_s')).toBe(true);
    expect(vmRes.body.metrics.some((entry) => entry.metricName === 'disk_read_kib_per_s')).toBe(true);
    expect(vmRes.body.metrics.some((entry) => entry.metricName === 'disk_write_kib_per_s')).toBe(true);

    const srRes = await request('GET', '/api/metrics/storage/OpaqueRef:sr1?range=24h', null, auth.cookie);
    expect(srRes.status).toBe(200);
    expect(srRes.body.entityType).toBe('sr');
    expect(srRes.body.metrics.some((entry) => entry.metricName === 'utilization_percent')).toBe(true);
  });

  it('keeps telemetry isolated when two targets expose the same Xen reference', () => {
    const timestamp = Date.now();
    const sharedRef = 'OpaqueRef:shared-host';
    metricSampleModel.insertMany([
      { targetKey: 'target-alpha', entityType: 'host', entityRef: sharedRef, metricName: 'memory_used_percent', ts: timestamp, value: 25 },
      { targetKey: 'target-beta', entityType: 'host', entityRef: sharedRef, metricName: 'memory_used_percent', ts: timestamp, value: 75 },
    ]);

    const alpha = metricsHistoryService.listEntitySeries('host', sharedRef, '24h', 'target-alpha');
    const beta = metricsHistoryService.listEntitySeries('host', sharedRef, '24h', 'target-beta');
    const latestAlpha = alpha.metrics.find((metric) => metric.metricName === 'memory_used_percent').points.at(-1);
    const latestBeta = beta.metrics.find((metric) => metric.metricName === 'memory_used_percent').points.at(-1);

    expect(latestAlpha.value).toBe(25);
    expect(latestBeta.value).toBe(75);
  });

  it('supports manual collection runs with collector metadata', async () => {
    const auth = await login();
    const res = await request('POST', '/api/metrics/collect', {}, auth.cookie);

    expect(res.status).toBe(201);
    expect(res.body).toEqual(expect.objectContaining({
      source: 'manual',
      host: '192.168.1.100',
      captured: true,
    }));
    expect(res.body.sampleCount).toBeGreaterThan(0);
  });

  it('proxies raw xen rrd updates for deeper telemetry ingestion', async () => {
    const auth = await login();
    const res = await request('GET', '/api/metrics/rrd-updates?start=1724670000&cf=MAX&interval=300&host=true', null, auth.cookie);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({
      meta: expect.objectContaining({
        start: 1724670000,
        step: 300,
        cf: 'MAX',
        host: true,
      }),
      data: expect.any(Array),
    }));
  });

  it('serves longer ranges from hourly rollups even after raw samples age out', async () => {
    const auth = await login();
    const targetKey = getPerfDb().prepare('SELECT target_key FROM metric_samples WHERE target_key != ? LIMIT 1').get('')?.target_key || '';
    const now = Date.now();
    const oldTs = now - (29 * 24 * 60 * 60 * 1000);
    const newTs = now - (2 * 60 * 60 * 1000);
    const currentRawTs = now;

    metricSampleModel.insertMany([
      {
        targetKey,
        entityType: 'host',
        entityRef: 'OpaqueRef:host1',
        metricName: 'memory_total_bytes',
        ts: oldTs,
        value: 68719476736,
      },
      {
        targetKey,
        entityType: 'host',
        entityRef: 'OpaqueRef:host1',
        metricName: 'memory_used_bytes',
        ts: oldTs,
        value: 51539607552,
      },
      {
        targetKey,
        entityType: 'host',
        entityRef: 'OpaqueRef:host1',
        metricName: 'memory_total_bytes',
        ts: newTs,
        value: 68719476736,
      },
      {
        targetKey,
        entityType: 'host',
        entityRef: 'OpaqueRef:host1',
        metricName: 'memory_used_bytes',
        ts: newTs,
        value: 42949672960,
      },
      {
        targetKey,
        entityType: 'host',
        entityRef: 'OpaqueRef:host1',
        metricName: 'memory_free_bytes',
        ts: currentRawTs,
        value: 17179869184,
      },
    ]);

    getPerfDb().prepare('DELETE FROM metric_samples WHERE ts IN (?, ?)').run(oldTs, newTs);

    const hostRes = await request('GET', '/api/metrics/hosts/OpaqueRef:host1?range=30d', null, auth.cookie);
    expect(hostRes.status).toBe(200);
    expect(hostRes.body.range).toBe('30d');
    expect(hostRes.body.resolution).toBe('hourly');
    const usedMetric = hostRes.body.metrics.find((entry) => entry.metricName === 'memory_used_bytes');
    expect(usedMetric.points).toEqual(expect.arrayContaining([
      expect.objectContaining({ ts: toHourlyBucket(oldTs), value: 51539607552 }),
      expect.objectContaining({ ts: toHourlyBucket(newTs), value: 42949672960 }),
    ]));

    const clusterRes = await request('GET', '/api/metrics/cluster?range=30d', null, auth.cookie);
    expect(clusterRes.status).toBe(200);
    expect(clusterRes.body.resolution).toBe('hourly');
    expect(clusterRes.body.metrics.some((entry) => entry.metricName === 'cluster_memory_used_percent')).toBe(true);
  });
});
