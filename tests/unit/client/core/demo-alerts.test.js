describe('demo telemetry alerts', () => {
  let demoDb;

  beforeAll(() => {
    global.getMessageSeverity = (message) => String(message?.severity || 'notice').toLowerCase();
    global.getMessageHeadline = (message) => message?.name || message?.body || message?.cls || 'Alert';
    global.demoMetricPercent = (numerator, denominator) => {
      const denom = Number(denominator || 0);
      if (denom <= 0) return 0;
      return (Number(numerator || 0) / denom) * 100;
    };
  });

  afterAll(() => {
    delete global.getMessageSeverity;
    delete global.getMessageHeadline;
    delete global.demoMetricPercent;
    delete global.demoDb;
  });

  beforeEach(() => {
    jest.resetModules();
    demoDb = {
      messages: [
        { ref: 'OpaqueRef:msg-1', name: 'Existing alert', cls: 'VM', body: 'Something happened.', timestamp: '2026-01-01T00:00:00.000Z' },
      ],
      hosts: [
        { ref: 'OpaqueRef:host-1', uuid: 'host-uuid-1', name_label: 'host-a' },
        { ref: 'OpaqueRef:host-2', uuid: 'host-uuid-2', name_label: 'host-b' },
      ],
      hostMetrics: {
        'OpaqueRef:host-1': { memory_total: 100, memory_free: 3 },
        'OpaqueRef:host-2': { memory_total: 100, memory_free: 50 },
      },
      srs: [
        { ref: 'OpaqueRef:sr-1', uuid: 'sr-uuid-1', name_label: 'sr-a', physical_size: 100, virtual_allocation: 96 },
        { ref: 'OpaqueRef:sr-2', uuid: 'sr-uuid-2', name_label: 'sr-b', physical_size: 100, virtual_allocation: 10 },
      ],
    };
    global.demoDb = demoDb;
  });

  function loadModule() {
    return require('../../../../client/assets/js/core/demo-alerts.js');
  }

  it('emits no telemetry alert for an entity below the warning threshold', () => {
    const { buildDemoTelemetryAlerts } = loadModule();
    const alerts = buildDemoTelemetryAlerts();
    expect(alerts.find((entry) => entry.entityRef === 'OpaqueRef:host-2')).toBeUndefined();
    expect(alerts.find((entry) => entry.entityRef === 'OpaqueRef:sr-2')).toBeUndefined();
  });

  it('emits a critical host memory alert once usage crosses the critical threshold', () => {
    const { buildDemoTelemetryAlerts } = loadModule();
    const alerts = buildDemoTelemetryAlerts();
    const hostAlert = alerts.find((entry) => entry.entityRef === 'OpaqueRef:host-1');
    expect(hostAlert).toBeDefined();
    expect(hostAlert.severity).toBe('critical');
    expect(hostAlert.cls).toBe('host');
    expect(hostAlert.metricName).toBe('memory_used_percent');
    expect(hostAlert.ref).toBe('OpaqueRef:telemetry:host:memory_used_percent:OpaqueRef:host-1');
    expect(hostAlert.obj_uuid).toBe('host-uuid-1');
  });

  it('emits a warning SR utilization alert once allocation crosses the warning threshold', () => {
    const { buildDemoTelemetryAlerts } = loadModule();
    const alerts = buildDemoTelemetryAlerts();
    const srAlert = alerts.find((entry) => entry.entityRef === 'OpaqueRef:sr-1');
    expect(srAlert).toBeDefined();
    expect(srAlert.severity).toBe('critical');
    expect(srAlert.cls).toBe('sr');
    expect(srAlert.metricName).toBe('utilization_percent');
  });

  it('merges telemetry alerts alongside native demo messages in listDemoAlertMessages', () => {
    const { listDemoAlertMessages } = loadModule();
    const merged = listDemoAlertMessages();
    expect(merged.some((entry) => entry.ref === 'OpaqueRef:msg-1')).toBe(true);
    expect(merged.some((entry) => entry.entityRef === 'OpaqueRef:host-1')).toBe(true);
    expect(merged.length).toBe(demoDb.messages.length + 2);
  });
});
