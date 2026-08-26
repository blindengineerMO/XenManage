const { settingsModel } = require('../models/connection');
const metricsHistoryService = require('./metrics-history');
const { listAllConnections } = require('./xenapi');

const SETTINGS_KEYS = {
  collectionEnabled: 'performance.collectionEnabled',
  collectionIntervalSeconds: 'performance.collectionIntervalSeconds',
};

const DEFAULTS = {
  collectionEnabled: true,
  collectionIntervalSeconds: 60,
};

let timer = null;
let bootstrapped = false;

const state = {
  enabled: DEFAULTS.collectionEnabled,
  intervalSeconds: DEFAULTS.collectionIntervalSeconds,
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

function readBooleanSetting(key, fallback) {
  const raw = settingsModel.get(key);
  if (raw === null || raw === undefined || raw === '') return fallback;
  return raw === 'true';
}

function readNumberSetting(key, fallback) {
  const raw = Number(settingsModel.get(key) || fallback);
  return Number.isFinite(raw) ? raw : fallback;
}

function readSettings() {
  return {
    collectionEnabled: readBooleanSetting(SETTINGS_KEYS.collectionEnabled, DEFAULTS.collectionEnabled),
    collectionIntervalSeconds: Math.max(
      30,
      Math.min(3600, readNumberSetting(SETTINGS_KEYS.collectionIntervalSeconds, DEFAULTS.collectionIntervalSeconds))
    ),
  };
}

function syncStateFromSettings() {
  const settings = readSettings();
  state.enabled = settings.collectionEnabled;
  state.intervalSeconds = settings.collectionIntervalSeconds;
  return settings;
}

function scheduleNextRun() {
  if (!bootstrapped || !state.enabled) {
    state.active = false;
    state.nextRunAt = '';
    return;
  }

  if (timer) clearTimeout(timer);

  const nextRunAt = new Date(Date.now() + state.intervalSeconds * 1000).toISOString();
  state.active = true;
  state.nextRunAt = nextRunAt;
  timer = setTimeout(async () => {
    await metricsCollector.collectAllLiveTargets({ force: true, source: 'scheduler' });
    scheduleNextRun();
  }, state.intervalSeconds * 1000);
}

function clearSchedule() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  state.active = false;
  state.nextRunAt = '';
}

function listUniqueLiveTargets() {
  const dedupe = new Map();

  for (const entry of listAllConnections()) {
    const host = String(entry.api?.host || '').trim();
    const sessionRef = String(entry.api?.sessionRef || '').trim();
    if (!host || !sessionRef) continue;

    const dedupeKey = `${host}|${sessionRef}`;
    if (!dedupe.has(dedupeKey)) {
      dedupe.set(dedupeKey, {
        sessionId: entry.sessionId,
        targetKey: entry.targetKey,
        host,
        api: entry.api,
      });
    }
  }

  return [...dedupe.values()];
}

function normalizeResult(result = {}, meta = {}, source = 'manual') {
  return {
    source,
    host: meta.host || '',
    targetKey: meta.targetKey || '',
    sessionId: meta.sessionId || '',
    captured: Boolean(result.captured),
    ts: result.ts || 0,
    sampleCount: Number(result.sampleCount || 0),
    hostCount: Number(result.hostCount || 0),
    vmCount: Number(result.vmCount || 0),
    srCount: Number(result.srCount || 0),
    skipped: result.skipped || '',
  };
}

const metricsCollector = {
  start() {
    bootstrapped = true;
    syncStateFromSettings();
    scheduleNextRun();
    return this.getStatus();
  },

  stop() {
    bootstrapped = false;
    clearSchedule();
    return this.getStatus();
  },

  refreshScheduler() {
    syncStateFromSettings();
    if (!bootstrapped) return this.getStatus();

    if (!state.enabled) {
      clearSchedule();
      return this.getStatus();
    }

    scheduleNextRun();
    return this.getStatus();
  },

  async collectTarget(xenApi, meta = {}, options = {}) {
    if (!xenApi) {
      return normalizeResult({ captured: false, skipped: 'NO_XEN_CONNECTION' }, meta, options.source || 'manual');
    }

    const result = await metricsHistoryService.captureSnapshot(xenApi, {
      force: Boolean(options.force),
    });

    const normalized = normalizeResult(result, {
      ...meta,
      host: meta.host || xenApi.host || '',
    }, options.source || 'manual');

    state.targetCount = normalized.host ? 1 : 0;
    state.runCount += 1;
    state.lastRunAt = new Date().toISOString();
    state.lastDurationMs = Number(options.durationMs || 0);
    state.lastError = '';
    state.lastResult = normalized;

    return normalized;
  },

  async collectAllLiveTargets(options = {}) {
    if (state.inFlight) {
      return {
        busy: true,
        source: options.source || 'scheduler',
        targetCount: state.targetCount,
      };
    }

    const startedAt = Date.now();
    state.inFlight = true;
    state.lastError = '';

    try {
      const targets = listUniqueLiveTargets();
      state.targetCount = targets.length;

      if (!targets.length) {
        const result = {
          source: options.source || 'scheduler',
          captured: false,
          skipped: 'NO_LIVE_TARGETS',
          targetCount: 0,
          sampleCount: 0,
          results: [],
          errors: [],
        };
        state.runCount += 1;
        state.lastRunAt = new Date().toISOString();
        state.lastDurationMs = Date.now() - startedAt;
        state.lastResult = result;
        return result;
      }

      const results = [];
      const errors = [];

      for (const target of targets) {
        try {
          const capture = await metricsHistoryService.captureSnapshot(target.api, {
            force: options.force !== false,
          });
          results.push(normalizeResult(capture, target, options.source || 'scheduler'));
        } catch (error) {
          errors.push({
            host: target.host,
            targetKey: target.targetKey,
            error: error.message || 'METRIC_CAPTURE_FAILED',
          });
        }
      }

      const summary = {
        source: options.source || 'scheduler',
        captured: results.some((entry) => entry.captured),
        targetCount: targets.length,
        capturedTargetCount: results.filter((entry) => entry.captured).length,
        sampleCount: results.reduce((sum, entry) => sum + Number(entry.sampleCount || 0), 0),
        results,
        errors,
      };

      state.runCount += 1;
      state.lastRunAt = new Date().toISOString();
      state.lastDurationMs = Date.now() - startedAt;
      state.lastError = errors[0]?.error || '';
      state.lastResult = summary;

      return summary;
    } finally {
      state.inFlight = false;
    }
  },

  getStatus() {
    syncStateFromSettings();
    return {
      enabled: state.enabled,
      intervalSeconds: state.intervalSeconds,
      active: state.active,
      inFlight: state.inFlight,
      targetCount: state.targetCount,
      runCount: state.runCount,
      lastRunAt: state.lastRunAt,
      lastDurationMs: state.lastDurationMs,
      nextRunAt: state.nextRunAt,
      lastError: state.lastError,
      lastResult: state.lastResult,
    };
  },

  __resetForTests() {
    clearSchedule();
    bootstrapped = false;
    state.enabled = DEFAULTS.collectionEnabled;
    state.intervalSeconds = DEFAULTS.collectionIntervalSeconds;
    state.active = false;
    state.inFlight = false;
    state.targetCount = 0;
    state.runCount = 0;
    state.lastRunAt = '';
    state.lastDurationMs = 0;
    state.nextRunAt = '';
    state.lastError = '';
    state.lastResult = null;
  },
};

module.exports = metricsCollector;
