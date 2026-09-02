/* ============================================
   Demo Settings Routes
   ============================================ */

const demoSystemConfig = {
  general: { appName: 'XenMange', timezone: 'UTC' },
  network: { publicBaseUrl: '', trustProxy: false },
  security: { sessionMaxAgeMs: 86400000, failedLoginWindowMinutes: 15, failedLoginMaxAttempts: 20 },
  logging: { level: 'info', structuredJson: false },
  performance: { collectionEnabled: true, collectionIntervalSeconds: 60 },
  interaction: { undoDelaySeconds: 5 },
  retention: { sweepIntervalHours: 24, vacuumAfterSweep: true },
};

function buildDemoSettingsResponse() {
  return {
    ...clone(demoSystemConfig),
    runtime: {
      env: 'demo',
      port: '3000',
      restartRequiredSettings: ['security.failedLoginWindowMinutes'],
      liveAppliedSettings: ['network.trustProxy', 'logging.level', 'performance.collectionIntervalSeconds'],
      metricsCollector: {
        enabled: Boolean(demoSystemConfig.performance.collectionEnabled),
        intervalSeconds: Number(demoSystemConfig.performance.collectionIntervalSeconds || 60),
        active: false,
        inFlight: false,
        targetCount: demoDb.connections.length,
        runCount: 0,
        lastRunAt: '',
        lastDurationMs: 0,
        nextRunAt: '',
        lastError: '',
        lastResult: null,
      },
    },
    vault: {
      hasConfiguredMasterKey: false,
      usingDevelopmentFallback: false,
      hasPreviousMasterKey: false,
      rotationRecommended: false,
      keySource: '',
      vaultDatabasePath: 'demo-vault.db',
      totalCredentialCount: 0,
      staleCredentialCount: 0,
      rewrapAvailable: false,
      scanAvailable: false,
      scanError: '',
    },
    retentionPolicies: [],
  };
}

function handleDemoSettingsRoutes(method, path, body) {
  if (method === 'GET' && path === '/api/settings') {
    return buildDemoSettingsResponse();
  }

  const sectionMatch = path.match(/^\/api\/settings\/(general|network|security|logging|performance|interaction|retention)$/);
  if (method === 'PUT' && sectionMatch) {
    const section = sectionMatch[1];
    demoSystemConfig[section] = {
      ...demoSystemConfig[section],
      ...clone(body || {}),
    };
    const response = buildDemoSettingsResponse();
    return {
      section: clone(demoSystemConfig[section]),
      retentionPolicies: response.retentionPolicies,
      runtime: response.runtime,
    };
  }

  return undefined;
}
