const config = require('../config');
const { settingsModel } = require('../models/connection');
const credentialVaultService = require('./credential-vault');

const SECTION_KEYS = {
  general: {
    appName: 'system.appName',
    timezone: 'system.timezone',
  },
  network: {
    publicBaseUrl: 'net.publicBaseUrl',
    trustProxy: 'net.trustProxy',
  },
  security: {
    sessionMaxAgeMs: 'security.sessionMaxAgeMs',
    failedLoginWindowMinutes: 'security.failedLoginWindowMinutes',
    failedLoginMaxAttempts: 'security.failedLoginMaxAttempts',
  },
  logging: {
    level: 'logging.level',
    structuredJson: 'logging.structuredJson',
  },
  retention: {
    sweepIntervalHours: 'retention.sweepIntervalHours',
    vacuumAfterSweep: 'retention.vacuumAfterSweep',
  },
};

const DEFAULTS = {
  general: {
    appName: 'XenMange',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  },
  network: {
    publicBaseUrl: '',
    trustProxy: false,
  },
  security: {
    sessionMaxAgeMs: config.session.maxAge,
    failedLoginWindowMinutes: 15,
    failedLoginMaxAttempts: 20,
  },
  logging: {
    level: config.env === 'production' ? 'info' : 'debug',
    structuredJson: false,
  },
  retention: {
    sweepIntervalHours: 24,
    vacuumAfterSweep: true,
  },
};

function readStoredValue(key, fallback) {
  const raw = settingsModel.get(key);
  if (raw === null || raw === undefined || raw === '') return fallback;

  if (typeof fallback === 'boolean') {
    return raw === 'true';
  }

  if (typeof fallback === 'number') {
    const value = Number(raw);
    return Number.isFinite(value) ? value : fallback;
  }

  return String(raw);
}

function writeStoredValue(key, value) {
  if (typeof value === 'boolean') {
    settingsModel.set(key, value ? 'true' : 'false');
    return;
  }

  settingsModel.set(key, String(value ?? ''));
}

function getSection(section) {
  const keys = SECTION_KEYS[section];
  const defaults = DEFAULTS[section];

  if (!keys || !defaults) {
    throw new Error(`UNKNOWN_SETTINGS_SECTION:${section}`);
  }

  return Object.fromEntries(
    Object.entries(keys).map(([field, key]) => [field, readStoredValue(key, defaults[field])])
  );
}

const systemConfigService = {
  getAll() {
    return {
      general: getSection('general'),
      network: getSection('network'),
      security: getSection('security'),
      logging: getSection('logging'),
      retention: getSection('retention'),
      vault: credentialVaultService.getRuntimeStatus(),
      runtime: {
        env: config.env,
        port: config.port,
        restartRequiredSettings: [
          'server.port',
          'security.failedLoginWindowMinutes',
          'security.failedLoginMaxAttempts',
        ],
        liveAppliedSettings: [
          'net.trustProxy',
          'security.sessionMaxAgeMs',
          'logging.level',
          'logging.structuredJson',
          'retention.sweepIntervalHours',
          'retention.vacuumAfterSweep',
        ],
      },
    };
  },

  getSection(section) {
    return getSection(section);
  },

  updateSection(section, payload = {}) {
    const keys = SECTION_KEYS[section];
    const defaults = DEFAULTS[section];

    if (!keys || !defaults) {
      throw new Error(`UNKNOWN_SETTINGS_SECTION:${section}`);
    }

    const next = { ...defaults, ...payload };
    for (const [field, key] of Object.entries(keys)) {
      writeStoredValue(key, next[field]);
    }

    return getSection(section);
  },

  getSessionMaxAgeMs() {
    return Number(this.getSection('security').sessionMaxAgeMs || config.session.maxAge);
  },

  applyExpressSettings(app) {
    if (!app || typeof app.set !== 'function') return;
    const network = this.getSection('network');
    app.set('trust proxy', Boolean(network.trustProxy));
    app.locals.runtimeSettings = this.getAll();
  },
};

module.exports = systemConfigService;
