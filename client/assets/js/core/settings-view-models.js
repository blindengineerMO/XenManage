function getSettingsGeneralFields() {
  return [
    { key: 'appName', label: 'Application Name', type: 'text', placeholder: 'XenMange' },
    { key: 'timezone', label: 'Timezone', type: 'text', placeholder: 'America/Chicago', help: 'Used for consistent timestamp rendering throughout the control plane.' },
  ];
}

function getSettingsNetworkFields() {
  return [
    { key: 'publicBaseUrl', label: 'Public Base URL', type: 'text', placeholder: 'https://xenmange.example.com', help: 'Set this when the app is served behind Traefik, Nginx, or another reverse proxy.' },
    { key: 'trustProxy', label: 'Trust reverse-proxy headers', type: 'checkbox', help: 'Applies live to Express so forwarded host and protocol headers are honored immediately.' },
  ];
}

function getSettingsSecurityFields() {
  return [
    { key: 'sessionMaxAgeMs', label: 'Session Timeout (ms)', type: 'number', min: 60000, max: 2592000000, help: 'Applies live to the session cookie lifetime for active and new sessions.' },
    { key: 'failedLoginWindowMinutes', label: 'Failed Login Window (minutes)', type: 'number', min: 1, max: 1440, help: 'Captured for lockout policy planning; current login throttling consumes this after a process restart.' },
    { key: 'failedLoginMaxAttempts', label: 'Max Failed Logins', type: 'number', min: 1, max: 100, help: 'Captured for auth policy enforcement and reported in runtime guidance.' },
  ];
}

function getSettingsLoggingFields() {
  return [
    {
      key: 'level',
      label: 'Log Level',
      type: 'select',
      options: [
        { value: 'trace', label: 'Trace' },
        { value: 'debug', label: 'Debug' },
        { value: 'info', label: 'Info' },
        { value: 'warn', label: 'Warn' },
        { value: 'error', label: 'Error' },
      ],
      help: 'Stored centrally for logger wiring and operator reference.',
    },
    { key: 'structuredJson', label: 'Prefer structured JSON logs', type: 'checkbox', help: 'Useful when shipping logs into external aggregation later.' },
  ];
}

function getSettingsPerformanceFields() {
  return [
    {
      key: 'collectionEnabled',
      label: 'Enable background telemetry collection',
      type: 'checkbox',
      help: 'When enabled, XenMange captures persisted capacity history from currently attached Xen targets on an in-process schedule.',
    },
    {
      key: 'collectionIntervalSeconds',
      label: 'Collection Interval (seconds)',
      type: 'number',
      min: 30,
      max: 3600,
      help: 'Applies live to the in-process collector without restarting the server.',
    },
  ];
}

function getSettingsRetentionRuntimeFields() {
  return [
    { key: 'sweepIntervalHours', label: 'Scheduled Sweep Interval (hours)', type: 'number', min: 1, max: 168, help: 'Changing this restarts the in-process retention scheduler immediately.' },
    { key: 'vacuumAfterSweep', label: 'Vacuum databases after retention runs', type: 'checkbox', help: 'Helps reclaim SQLite disk space after purge operations.' },
  ];
}

function buildSettingsTelemetryCollector(runtime = {}) {
  return runtime?.metricsCollector || {
    enabled: true,
    intervalSeconds: 60,
    active: false,
    inFlight: false,
    targetCount: 0,
    runCount: 0,
    lastRunAt: '',
    lastDurationMs: 0,
    nextRunAt: '',
    lastError: '',
    lastResult: null,
  };
}

function getSettingsCollectorModeLabel(telemetryCollector = {}) {
  if (!telemetryCollector.enabled) return 'Collector Disabled';
  if (telemetryCollector.inFlight) return 'Collector Running';
  if (telemetryCollector.active) return 'Collector Scheduled';
  return 'Collector Idle';
}

function getSettingsCollectorBadgeLabel(telemetryCollector = {}) {
  if (!telemetryCollector.enabled) return 'Disabled';
  if (telemetryCollector.inFlight) return 'Collecting';
  if (telemetryCollector.active) return 'Scheduled';
  return 'Idle';
}

function getSettingsCollectorBadgeClass(telemetryCollector = {}) {
  if (!telemetryCollector.enabled) return 'badge-warning';
  if (telemetryCollector.inFlight) return 'badge-running';
  if (telemetryCollector.active) return 'badge-success';
  return 'badge-info';
}

function getSettingsCollectorResultSummary(telemetryCollector = {}) {
  if (telemetryCollector.lastError) return `Last collector error: ${telemetryCollector.lastError}`;

  const result = telemetryCollector.lastResult || null;
  if (!result) return 'No collector summary has been recorded yet.';
  if (result.skipped === 'NO_LIVE_TARGETS') return 'No live Xen targets were attached when the collector last ran.';

  const targetCount = Number(result.capturedTargetCount || result.targetCount || 0);
  const sampleCount = Number(result.sampleCount || 0);
  return `${sampleCount} sample(s) captured across ${targetCount} target(s).`;
}

function buildSettingsSummaryCards({
  config = {},
  retentionPolicies = [],
  retentionPreview = {},
  credentials = [],
  vaultStatus = {},
  telemetryCollector = {},
  formatSecondsLabel,
} = {}) {
  const policies = Array.isArray(retentionPolicies) ? retentionPolicies : [];
  const previewResults = Array.isArray(retentionPreview?.results) ? retentionPreview.results : [];
  const credentialList = Array.isArray(credentials) ? credentials : [];
  const enabledPolicies = policies.filter((policy) => policy.enabled).length;
  const liveAppliedCount = (config.runtime?.liveAppliedSettings || config.liveAppliedSettings || []).length;
  const restartRequiredCount = (config.runtime?.restartRequiredSettings || config.restartRequiredSettings || []).length;
  const totalPreview = previewResults.reduce((sum, result) => sum + Number(result.candidateCount || 0), 0);
  const sharedCredentials = credentialList.filter((credential) => credential.scope === 'shared').length;
  const hostCredentials = credentialList.filter((credential) => credential.targetType === 'host').length;
  const staleWrapCount = Number(vaultStatus.staleCredentialCount || 0);
  const telemetryState = telemetryCollector.enabled
    ? (telemetryCollector.active ? 'Scheduled' : 'Idle')
    : 'Disabled';

  return [
    {
      key: 'app',
      label: 'App Identity',
      value: config.general?.appName || 'XenMange',
      icon: 'mdi-application-cog-outline',
      detail: `Timezone ${config.general?.timezone || 'UTC'}`,
    },
    {
      key: 'session',
      label: 'Session Timeout',
      value: `${Math.round(Number(config.security?.sessionMaxAgeMs || 0) / 60000)}m`,
      icon: 'mdi-timer-sand',
      detail: `${config.security?.failedLoginMaxAttempts || 0} failed attempts within ${config.security?.failedLoginWindowMinutes || 0} minutes`,
    },
    {
      key: 'vault',
      label: 'Vault Inventory',
      value: `${credentialList.length}`,
      icon: 'mdi-key-wireless',
      detail: `${sharedCredentials} shared · ${hostCredentials} host · ${staleWrapCount} stale wrap(s)`,
    },
    {
      key: 'telemetry',
      label: 'Telemetry Collector',
      value: telemetryState,
      icon: 'mdi-chart-timeline-variant',
      detail: `${formatSecondsLabel(config.performance?.collectionIntervalSeconds || 60)} · ${telemetryCollector.targetCount || 0} target(s)`,
    },
    {
      key: 'retention',
      label: 'Active Policies',
      value: `${enabledPolicies}/${policies.length || 0}`,
      icon: 'mdi-broom',
      detail: `${totalPreview} record(s) currently eligible in the latest preview`,
    },
    {
      key: 'runtime',
      label: 'Live vs Restart',
      value: `${liveAppliedCount}/${liveAppliedCount + restartRequiredCount || 1}`,
      icon: 'mdi-lightning-bolt-outline',
      detail: `${restartRequiredCount} setting(s) still require a restart-sensitive path`,
    },
  ];
}

function buildSettingsRuntimeGuidance(runtime = {}, telemetryCollector = {}, collectorBadgeLabel = '', collectorBadgeClass = '', formatSecondsLabel) {
  return [
    {
      title: 'Live-Applied Settings',
      detail: (runtime.liveAppliedSettings || []).join(', ') || 'No live-applied settings reported.',
      badge: 'Live',
      badgeClass: 'badge-success',
    },
    {
      title: 'Restart-Sensitive Settings',
      detail: (runtime.restartRequiredSettings || []).join(', ') || 'No restart-sensitive settings reported.',
      badge: 'Restart',
      badgeClass: 'badge-warning',
    },
    {
      title: 'Telemetry Collection',
      detail: telemetryCollector.enabled
        ? `The background collector is ${telemetryCollector.active ? 'scheduled' : 'idle'} and polls every ${formatSecondsLabel(telemetryCollector.intervalSeconds)}.`
        : 'Background telemetry polling is disabled, so history only refreshes through explicit metrics requests.',
      badge: collectorBadgeLabel,
      badgeClass: collectorBadgeClass,
    },
    {
      title: 'Proxy Guidance',
      detail: 'Use Public Base URL plus Trust Proxy together when XenMange sits behind Traefik, Nginx, or a cloud load balancer.',
      badge: 'Guide',
      badgeClass: 'badge-info',
    },
  ];
}

function buildSettingsVaultGuidance(vaultStatus = {}) {
  return [
    {
      title: 'Master Key Source',
      detail: vaultStatus.usingDevelopmentFallback
        ? 'Vault secrets currently rely on a development-only derived key because VAULT_ENCRYPTION_KEY is not configured.'
        : (vaultStatus.hasConfiguredMasterKey
          ? 'VAULT_ENCRYPTION_KEY is loaded from the environment, so vault secret wrapping is explicitly configured.'
          : 'No vault master key is configured. Production deployments should fail fast until one is supplied.'),
      badge: vaultStatus.usingDevelopmentFallback ? 'Dev Only' : (vaultStatus.hasConfiguredMasterKey ? 'Ready' : 'Missing'),
      badgeClass: vaultStatus.usingDevelopmentFallback ? 'badge-warning' : (vaultStatus.hasConfiguredMasterKey ? 'badge-success' : 'badge-error'),
    },
    {
      title: 'Rotation Posture',
      detail: vaultStatus.hasPreviousMasterKey
        ? `A previous vault master key is loaded, so legacy wrapped DEKs can still be decrypted during rotation. ${Number(vaultStatus.staleCredentialCount || 0)} credential wrap(s) still need refresh.`
        : 'No previous vault master key is loaded. Set VAULT_ENCRYPTION_KEY_PREVIOUS during a staged key rotation window.',
      badge: vaultStatus.hasPreviousMasterKey
        ? (Number(vaultStatus.staleCredentialCount || 0) ? 'Pending Rewrap' : 'Rotation Window')
        : 'Single Key',
      badgeClass: vaultStatus.hasPreviousMasterKey
        ? (Number(vaultStatus.staleCredentialCount || 0) ? 'badge-warning' : 'badge-info')
        : 'badge-warning',
    },
    {
      title: 'Secret Handling',
      detail: 'Passwords remain encrypted in vault.db and are only decrypted server-side when opening a live Xen pool or host target.',
      badge: 'Server Only',
      badgeClass: 'badge-success',
    },
  ];
}

function buildSettingsCredentialDraft(credential = null) {
  if (credential) return { ...credential };
  return {
    name: '',
    scope: 'private',
    targetType: 'pool',
    targetHint: '',
    username: 'root',
  };
}

function resolveSettingsDomainLabel(domain = '', retentionPolicies = []) {
  const policy = (Array.isArray(retentionPolicies) ? retentionPolicies : []).find((entry) => entry.domain === domain);
  return policy?.label || domain;
}

function formatSettingsVaultKeySource(value) {
  if (value === 'environment') return 'Environment Variable';
  if (value === 'derived-development') return 'Derived Development Key';
  if (value === 'missing') return 'Missing';
  return value || '-';
}
