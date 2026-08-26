const { getDb, settingsModel, retentionPolicyModel } = require('../models/connection');
const { getSecurityDb } = require('../models/security-db');
const { getPerfDb } = require('../models/perf-db');
const auditLogService = require('./audit-log');
const systemConfigService = require('./system-config');

const AUDIT_SETTINGS_KEY = 'activity.audit';
const TASK_SETTINGS_KEY = 'activity.remediationTasks';
const TERMINAL_TASK_STATUSES = new Set(['success', 'warning', 'failure', 'cancelled']);
const TERMINAL_DEPLOYMENT_RUN_STATUSES = new Set(['success', 'failure', 'cancelled']);

let schedulerTimer = null;

const DOMAIN_DEFINITIONS = {
  'audit-log': {
    label: 'Audit Log',
    description: 'Historical operator and configuration change entries kept in xenmange.db.',
  },
  'remediation-tasks': {
    label: 'Remediation Tasks',
    description: 'Closed remediation queue items whose follow-through has already completed.',
  },
  'auth-events': {
    label: 'Authentication Events',
    description: 'Login and logout activity persisted in security.db for traceability.',
  },
  'template-deployment-runs': {
    label: 'Template Deployment Runs',
    description: 'Completed template deployment work persisted in xenmange.db for Activity tracking and post-deploy traceability.',
  },
  'metric-samples': {
    label: 'Metric Samples',
    description: 'Raw persisted telemetry snapshots stored in perf.db for capacity and trend views.',
  },
  'metric-hourly-rollups': {
    label: 'Metric Hourly Rollups',
    description: 'Hourly telemetry aggregates stored in perf.db for longer-range capacity and trend history.',
  },
};

const DEFAULT_POLICIES = {
  'audit-log': { retentionDays: 180, enabled: true },
  'remediation-tasks': { retentionDays: 90, enabled: true },
  'auth-events': { retentionDays: 60, enabled: true },
  'template-deployment-runs': { retentionDays: 90, enabled: true },
  'metric-samples': { retentionDays: 7, enabled: true },
  'metric-hourly-rollups': { retentionDays: 90, enabled: true },
};

function readJsonArray(key) {
  try {
    const stored = JSON.parse(settingsModel.get(key) || '[]');
    return Array.isArray(stored) ? stored : [];
  } catch (error) {
    return [];
  }
}

function writeJsonArray(key, entries) {
  settingsModel.set(key, JSON.stringify(entries));
}

function toIsoCutoff(retentionDays) {
  return new Date(Date.now() - Number(retentionDays || 0) * 86400000).toISOString();
}

function coerceTimestamp(value) {
  const ts = new Date(value || 0).getTime();
  return Number.isFinite(ts) ? ts : 0;
}

function normalizePolicy(row = {}, domain) {
  const defaults = DEFAULT_POLICIES[domain];
  const meta = DOMAIN_DEFINITIONS[domain];
  return {
    domain,
    label: meta.label,
    description: meta.description,
    enabled: row.enabled !== undefined ? Boolean(row.enabled) : defaults.enabled,
    retentionDays: Math.max(1, Number(row.retention_days ?? row.retentionDays ?? defaults.retentionDays)),
    lastRunAt: row.last_run_at || row.lastRunAt || '',
    lastPurgedCount: Math.max(0, Number(row.last_purged_count ?? row.lastPurgedCount ?? 0)),
  };
}

function ensurePolicies() {
  for (const [domain, defaults] of Object.entries(DEFAULT_POLICIES)) {
    if (!retentionPolicyModel.get(domain)) {
      retentionPolicyModel.upsert({
        domain,
        retentionDays: defaults.retentionDays,
        enabled: defaults.enabled,
        lastRunAt: null,
        lastPurgedCount: 0,
      });
    }
  }
}

function filterRetainedAuditEntries(entries, cutoffTs) {
  const retained = [];
  let purgedCount = 0;

  for (const entry of entries) {
    const ts = coerceTimestamp(entry?.happenedAt);
    if (ts && ts < cutoffTs) {
      purgedCount += 1;
      continue;
    }
    retained.push(entry);
  }

  return { purgedCount, retained };
}

function filterRetainedTaskEntries(entries, cutoffTs) {
  const retained = [];
  let purgedCount = 0;

  for (const entry of entries) {
    const status = String(entry?.status || '').trim().toLowerCase();
    const ts = coerceTimestamp(entry?.finished || entry?.updated_at || entry?.updatedAt || entry?.created);

    if (TERMINAL_TASK_STATUSES.has(status) && ts && ts < cutoffTs) {
      purgedCount += 1;
      continue;
    }

    retained.push(entry);
  }

  return { purgedCount, retained };
}

function listDeploymentRunIdsForRetention(cutoffDate) {
  return getDb().prepare(`
    SELECT id
    FROM deployment_runs
    WHERE status IN (${Array.from(TERMINAL_DEPLOYMENT_RUN_STATUSES).map(() => '?').join(', ')})
      AND datetime(COALESCE(finished_at, submitted_at)) < datetime(?)
  `).all(...Array.from(TERMINAL_DEPLOYMENT_RUN_STATUSES), cutoffDate)
    .map((row) => String(row.id || '').trim())
    .filter(Boolean);
}

function previewDomain(domain, policy) {
  const cutoffTs = new Date(toIsoCutoff(policy.retentionDays)).getTime();
  const cutoffDate = new Date(cutoffTs).toISOString();

  if (domain === 'audit-log') {
    const entries = readJsonArray(AUDIT_SETTINGS_KEY);
    const { purgedCount } = filterRetainedAuditEntries(entries, cutoffTs);
    return { domain, cutoffDate, candidateCount: purgedCount };
  }

  if (domain === 'remediation-tasks') {
    const entries = readJsonArray(TASK_SETTINGS_KEY);
    const { purgedCount } = filterRetainedTaskEntries(entries, cutoffTs);
    return { domain, cutoffDate, candidateCount: purgedCount };
  }

  if (domain === 'auth-events') {
    const row = getSecurityDb().prepare(`
      SELECT COUNT(*) AS count
      FROM auth_events
      WHERE datetime(created_at) < datetime(?)
    `).get(cutoffDate);

    return { domain, cutoffDate, candidateCount: Number(row?.count || 0) };
  }

  if (domain === 'template-deployment-runs') {
    return {
      domain,
      cutoffDate,
      candidateCount: listDeploymentRunIdsForRetention(cutoffDate).length,
    };
  }

  if (domain === 'metric-samples') {
    const row = getPerfDb().prepare(`
      SELECT COUNT(*) AS count
      FROM metric_samples
      WHERE ts < ?
    `).get(cutoffTs);

    return { domain, cutoffDate, candidateCount: Number(row?.count || 0) };
  }

  if (domain === 'metric-hourly-rollups') {
    const row = getPerfDb().prepare(`
      SELECT COUNT(*) AS count
      FROM metric_hourly_rollups
      WHERE bucket_ts < ?
    `).get(cutoffTs);

    return { domain, cutoffDate, candidateCount: Number(row?.count || 0) };
  }

  throw new Error(`UNKNOWN_RETENTION_DOMAIN:${domain}`);
}

function purgeDomain(domain, policy, actor = 'system') {
  const cutoffTs = new Date(toIsoCutoff(policy.retentionDays)).getTime();
  const cutoffDate = new Date(cutoffTs).toISOString();
  let purgedCount = 0;

  if (domain === 'audit-log') {
    const entries = readJsonArray(AUDIT_SETTINGS_KEY);
    const next = filterRetainedAuditEntries(entries, cutoffTs);
    writeJsonArray(AUDIT_SETTINGS_KEY, next.retained);
    purgedCount = next.purgedCount;
  } else if (domain === 'remediation-tasks') {
    const entries = readJsonArray(TASK_SETTINGS_KEY);
    const next = filterRetainedTaskEntries(entries, cutoffTs);
    writeJsonArray(TASK_SETTINGS_KEY, next.retained);
    purgedCount = next.purgedCount;
  } else if (domain === 'auth-events') {
    purgedCount = getSecurityDb().prepare(`
      DELETE FROM auth_events
      WHERE datetime(created_at) < datetime(?)
    `).run(cutoffDate).changes;
  } else if (domain === 'template-deployment-runs') {
    const runIds = listDeploymentRunIdsForRetention(cutoffDate);
    if (runIds.length) {
      const db = getDb();
      const deleteRunSteps = db.prepare('DELETE FROM deployment_run_steps WHERE run_id = ?');
      const deleteRun = db.prepare('DELETE FROM deployment_runs WHERE id = ?');
      const purgeRuns = db.transaction((ids) => {
        ids.forEach((id) => {
          deleteRunSteps.run(id);
          deleteRun.run(id);
        });
      });
      purgeRuns(runIds);
    }
    purgedCount = runIds.length;
  } else if (domain === 'metric-samples') {
    purgedCount = getPerfDb().prepare(`
      DELETE FROM metric_samples
      WHERE ts < ?
    `).run(cutoffTs).changes;
  } else if (domain === 'metric-hourly-rollups') {
    purgedCount = getPerfDb().prepare(`
      DELETE FROM metric_hourly_rollups
      WHERE bucket_ts < ?
    `).run(cutoffTs).changes;
  } else {
    throw new Error(`UNKNOWN_RETENTION_DOMAIN:${domain}`);
  }

  retentionPolicyModel.upsert({
    domain,
    retentionDays: policy.retentionDays,
    enabled: policy.enabled,
    lastRunAt: new Date().toISOString(),
    lastPurgedCount: purgedCount,
  });

  auditLogService.record({
    category: 'system',
    action: 'retention_sweep_completed',
    actionLabel: 'Ran retention sweep for',
    entityType: 'retention-domain',
    entityRef: domain,
    entityName: DOMAIN_DEFINITIONS[domain].label,
    operator: actor,
    route: '/settings',
    status: purgedCount > 0 ? 'success' : 'info',
    detail: `${DOMAIN_DEFINITIONS[domain].label} retention ran with a cutoff of ${cutoffDate} and purged ${purgedCount} record${purgedCount === 1 ? '' : 's'}.`,
    before: { retentionDays: policy.retentionDays, enabled: policy.enabled },
    after: { retentionDays: policy.retentionDays, enabled: policy.enabled, purgedCount, cutoffDate },
  });

  return { domain, cutoffDate, purgedCount };
}

function maybeVacuum() {
  const retentionSettings = systemConfigService.getSection('retention');
  if (!retentionSettings.vacuumAfterSweep) return;
  getDb().exec('VACUUM');
  getSecurityDb().exec('VACUUM');
  getPerfDb().exec('VACUUM');
}

const retentionService = {
  listPolicies() {
    ensurePolicies();
    return Object.keys(DOMAIN_DEFINITIONS).map((domain) =>
      normalizePolicy(retentionPolicyModel.get(domain), domain)
    );
  },

  getPolicy(domain) {
    ensurePolicies();
    const row = retentionPolicyModel.get(domain);
    return row ? normalizePolicy(row, domain) : null;
  },

  upsertPolicy(domain, payload = {}) {
    if (!DOMAIN_DEFINITIONS[domain]) {
      throw new Error(`UNKNOWN_RETENTION_DOMAIN:${domain}`);
    }

    const current = this.getPolicy(domain) || normalizePolicy({}, domain);
    const next = retentionPolicyModel.upsert({
      domain,
      retentionDays: Math.max(1, Number(payload.retentionDays ?? current.retentionDays)),
      enabled: payload.enabled !== undefined ? Boolean(payload.enabled) : current.enabled,
      lastRunAt: current.lastRunAt || null,
      lastPurgedCount: current.lastPurgedCount || 0,
    });

    return normalizePolicy(next, domain);
  },

  previewSweep(domain = '') {
    const policies = domain ? [this.getPolicy(domain)].filter(Boolean) : this.listPolicies();
    return policies.map((policy) => ({
      ...policy,
      preview: previewDomain(policy.domain, policy),
    }));
  },

  runSweep(options = {}) {
    const { domain = '', dryRun = false } = options;
    const policies = domain ? [this.getPolicy(domain)].filter(Boolean) : this.listPolicies();
    const enabledPolicies = policies.filter((policy) => policy?.enabled);
    const results = enabledPolicies.map((policy) => {
      if (dryRun) {
        return {
          domain: policy.domain,
          label: policy.label,
          ...previewDomain(policy.domain, policy),
        };
      }

      return {
        domain: policy.domain,
        label: policy.label,
        ...purgeDomain(policy.domain, policy, options.actor || 'system'),
      };
    });

    if (!dryRun && results.length) {
      maybeVacuum();
    }

    return {
      dryRun,
      generatedAt: new Date().toISOString(),
      results,
      totalCandidates: results.reduce((sum, result) => sum + Number(result.candidateCount || 0), 0),
      totalPurged: results.reduce((sum, result) => sum + Number(result.purgedCount || 0), 0),
    };
  },

  startScheduler() {
    this.stopScheduler();
    ensurePolicies();

    const { sweepIntervalHours } = systemConfigService.getSection('retention');
    const intervalMs = Math.max(1, Number(sweepIntervalHours || 24)) * 3600000;

    schedulerTimer = setInterval(() => {
      try {
        this.runSweep();
      } catch (error) {
        console.error('Retention sweep failed:', error);
      }
    }, intervalMs);

    if (typeof schedulerTimer.unref === 'function') {
      schedulerTimer.unref();
    }
  },

  stopScheduler() {
    if (schedulerTimer) {
      clearInterval(schedulerTimer);
      schedulerTimer = null;
    }
  },

  refreshScheduler() {
    this.startScheduler();
  },
};

module.exports = retentionService;
