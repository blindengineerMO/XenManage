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

const demoCredentials = [
  {
    id: 1,
    ownerUserId: 1,
    scope: 'shared',
    targetType: 'webhook',
    targetHint: 'approvals.example.test',
    name: 'Catalog Approval Service',
    username: 'catalog-curator',
    createdAt: '2026-08-19T14:00:00.000Z',
    updatedAt: '2026-08-19T14:00:00.000Z',
    lastUsedAt: '',
    lastUsedBy: null,
  },
];

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
  if (method === 'GET' && path === '/api/credentials') {
    return { total: demoCredentials.length, data: clone(demoCredentials) };
  }

  if (method === 'POST' && path === '/api/credentials') {
    const now = new Date().toISOString();
    const credential = {
      id: Math.max(0, ...demoCredentials.map((entry) => Number(entry.id))) + 1,
      ownerUserId: 1,
      scope: body?.scope || 'private',
      targetType: body?.targetType || 'pool',
      targetHint: body?.targetHint || '',
      name: body?.name || 'Demo Credential',
      username: body?.username || '',
      createdAt: now,
      updatedAt: now,
      lastUsedAt: '',
      lastUsedBy: null,
    };
    demoCredentials.unshift(credential);
    return clone(credential);
  }

  const credentialMatch = path.match(/^\/api\/credentials\/(\d+)$/);
  if (credentialMatch && method === 'PUT') {
    const index = demoCredentials.findIndex((entry) => Number(entry.id) === Number(credentialMatch[1]));
    if (index < 0) throw new Error('CREDENTIAL_NOT_FOUND');
    demoCredentials[index] = {
      ...demoCredentials[index],
      ...clone(body || {}),
      id: demoCredentials[index].id,
      updatedAt: new Date().toISOString(),
    };
    delete demoCredentials[index].password;
    return clone(demoCredentials[index]);
  }

  if (credentialMatch && method === 'DELETE') {
    const index = demoCredentials.findIndex((entry) => Number(entry.id) === Number(credentialMatch[1]));
    if (index < 0) throw new Error('CREDENTIAL_NOT_FOUND');
    demoCredentials.splice(index, 1);
    return { deleted: true };
  }

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
