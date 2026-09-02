const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const config = require('../config');
const { runMigrations } = require('../migrations/runner');

let perfDb;

function getPerfDb() {
  if (perfDb) return perfDb;

  const dbDir = path.dirname(config.db.perfPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  perfDb = new Database(config.db.perfPath);
  perfDb.pragma('journal_mode = WAL');
  perfDb.pragma('synchronous = NORMAL');
  perfDb.pragma('foreign_keys = ON');
  runMigrations(perfDb, [{
    version: 1,
    name: 'performance-baseline',
    checksum: 'performance-baseline-2026-09-02',
    adoptLegacySchema: true,
    up: initializeSchema,
  }]);
  return perfDb;
}

function initializeSchema() {
  getPerfDb().exec(`
    CREATE TABLE IF NOT EXISTS metric_samples (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      target_key TEXT NOT NULL DEFAULT '',
      entity_type TEXT NOT NULL,
      entity_ref TEXT NOT NULL,
      metric_name TEXT NOT NULL,
      ts INTEGER NOT NULL,
      value REAL NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_metric_lookup
    ON metric_samples (entity_type, entity_ref, metric_name, ts);

    CREATE INDEX IF NOT EXISTS idx_metric_rollup
    ON metric_samples (entity_type, metric_name, ts);

    CREATE TABLE IF NOT EXISTS metric_collection_cursors (
      target_key TEXT PRIMARY KEY,
      last_rrd_ts INTEGER NOT NULL DEFAULT 0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS metric_hourly_rollups (
      target_key TEXT NOT NULL DEFAULT '',
      entity_type TEXT NOT NULL,
      entity_ref TEXT NOT NULL,
      metric_name TEXT NOT NULL,
      bucket_ts INTEGER NOT NULL,
      sample_count INTEGER NOT NULL DEFAULT 0,
      min_value REAL NOT NULL DEFAULT 0,
      max_value REAL NOT NULL DEFAULT 0,
      avg_value REAL NOT NULL DEFAULT 0,
      last_value REAL NOT NULL DEFAULT 0,
      PRIMARY KEY (target_key, entity_type, entity_ref, metric_name, bucket_ts)
    );

    CREATE INDEX IF NOT EXISTS idx_metric_hourly_lookup
    ON metric_hourly_rollups (entity_type, entity_ref, metric_name, bucket_ts);

    CREATE INDEX IF NOT EXISTS idx_metric_hourly_rollup
    ON metric_hourly_rollups (entity_type, metric_name, bucket_ts);

  `);

  const sampleColumns = getPerfDb().prepare('PRAGMA table_info(metric_samples)').all();
  if (!sampleColumns.some((column) => column.name === 'target_key')) {
    getPerfDb().exec("ALTER TABLE metric_samples ADD COLUMN target_key TEXT NOT NULL DEFAULT ''");
  }

  const rollupColumns = getPerfDb().prepare('PRAGMA table_info(metric_hourly_rollups)').all();
  if (!rollupColumns.some((column) => column.name === 'target_key')) {
    // Rebuild the rollup table because its primary key must include the target.
    // Existing historical rows are preserved as legacy unscoped telemetry.
    getPerfDb().exec(`
      ALTER TABLE metric_hourly_rollups RENAME TO metric_hourly_rollups_legacy;
      CREATE TABLE metric_hourly_rollups (
        target_key TEXT NOT NULL DEFAULT '',
        entity_type TEXT NOT NULL,
        entity_ref TEXT NOT NULL,
        metric_name TEXT NOT NULL,
        bucket_ts INTEGER NOT NULL,
        sample_count INTEGER NOT NULL DEFAULT 0,
        min_value REAL NOT NULL DEFAULT 0,
        max_value REAL NOT NULL DEFAULT 0,
        avg_value REAL NOT NULL DEFAULT 0,
        last_value REAL NOT NULL DEFAULT 0,
        PRIMARY KEY (target_key, entity_type, entity_ref, metric_name, bucket_ts)
      );
      INSERT INTO metric_hourly_rollups (
        target_key, entity_type, entity_ref, metric_name, bucket_ts,
        sample_count, min_value, max_value, avg_value, last_value
      )
      SELECT '', entity_type, entity_ref, metric_name, bucket_ts,
        sample_count, min_value, max_value, avg_value, last_value
      FROM metric_hourly_rollups_legacy;
      DROP TABLE metric_hourly_rollups_legacy;
      CREATE INDEX IF NOT EXISTS idx_metric_hourly_lookup
      ON metric_hourly_rollups (entity_type, entity_ref, metric_name, bucket_ts);
      CREATE INDEX IF NOT EXISTS idx_metric_hourly_target_lookup
      ON metric_hourly_rollups (target_key, entity_type, entity_ref, metric_name, bucket_ts);
      CREATE INDEX IF NOT EXISTS idx_metric_hourly_rollup
      ON metric_hourly_rollups (entity_type, metric_name, bucket_ts);
      CREATE INDEX IF NOT EXISTS idx_metric_hourly_target_rollup
      ON metric_hourly_rollups (target_key, entity_type, metric_name, bucket_ts);
    `);
  }

  getPerfDb().exec(`
    CREATE INDEX IF NOT EXISTS idx_metric_target_lookup
    ON metric_samples (target_key, entity_type, entity_ref, metric_name, ts);
    CREATE INDEX IF NOT EXISTS idx_metric_target_rollup
    ON metric_samples (target_key, entity_type, metric_name, ts);
    CREATE INDEX IF NOT EXISTS idx_metric_hourly_target_lookup
    ON metric_hourly_rollups (target_key, entity_type, entity_ref, metric_name, bucket_ts);
    CREATE INDEX IF NOT EXISTS idx_metric_hourly_target_rollup
    ON metric_hourly_rollups (target_key, entity_type, metric_name, bucket_ts);
  `);
}

function toHourlyBucket(ts) {
  const numericTs = Number(ts || 0);
  if (!Number.isFinite(numericTs) || numericTs <= 0) return 0;
  return Math.floor(numericTs / 3600000) * 3600000;
}

const metricSampleModel = {
  insertMany(samples = []) {
    if (!Array.isArray(samples) || !samples.length) return 0;

    const db = getPerfDb();
    const insert = db.prepare(`
      INSERT INTO metric_samples (target_key, entity_type, entity_ref, metric_name, ts, value)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const upsertRollup = db.prepare(`
      INSERT INTO metric_hourly_rollups (
        target_key,
        entity_type,
        entity_ref,
        metric_name,
        bucket_ts,
        sample_count,
        min_value,
        max_value,
        avg_value,
        last_value
      ) VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?)
      ON CONFLICT(target_key, entity_type, entity_ref, metric_name, bucket_ts) DO UPDATE SET
        sample_count = metric_hourly_rollups.sample_count + 1,
        min_value = MIN(metric_hourly_rollups.min_value, excluded.min_value),
        max_value = MAX(metric_hourly_rollups.max_value, excluded.max_value),
        avg_value = (
          (metric_hourly_rollups.avg_value * metric_hourly_rollups.sample_count) + excluded.avg_value
        ) / (metric_hourly_rollups.sample_count + 1),
        last_value = excluded.last_value
    `);

    const transaction = db.transaction((rows) => {
      for (const row of rows) {
        const targetKey = String(row.targetKey || '');
        insert.run(targetKey, row.entityType, row.entityRef, row.metricName, row.ts, row.value);
        const bucketTs = toHourlyBucket(row.ts);
        upsertRollup.run(
          targetKey,
          row.entityType,
          row.entityRef,
          row.metricName,
          bucketTs,
          row.value,
          row.value,
          row.value,
          row.value
        );
      }
    });

    transaction(samples);
    return samples.length;
  },

  getLatestTimestamp(targetKey = '') {
    const row = getPerfDb().prepare('SELECT MAX(ts) AS latestTs FROM metric_samples WHERE target_key = ?').get(String(targetKey || ''));
    return Number(row?.latestTs || 0);
  },

  getRrdCursor(targetKey = '') {
    const row = getPerfDb().prepare(
      'SELECT last_rrd_ts FROM metric_collection_cursors WHERE target_key = ?'
    ).get(String(targetKey || ''));
    return Number(row?.last_rrd_ts || 0);
  },

  setRrdCursor(targetKey = '', lastRrdTs = 0) {
    const ts = Number(lastRrdTs || 0);
    if (!Number.isInteger(ts) || ts <= 0) return 0;
    getPerfDb().prepare(`
      INSERT INTO metric_collection_cursors (target_key, last_rrd_ts, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(target_key) DO UPDATE SET
        last_rrd_ts = excluded.last_rrd_ts,
        updated_at = CURRENT_TIMESTAMP
    `).run(String(targetKey || ''), ts);
    return ts;
  },

  listEntityMetric(entityType, entityRef, metricName, sinceTs, targetKey = '') {
    return getPerfDb().prepare(`
      SELECT ts, value
      FROM metric_samples
      WHERE target_key = ?
        AND entity_type = ?
        AND entity_ref = ?
        AND metric_name = ?
        AND ts >= ?
      ORDER BY ts ASC
    `).all(String(targetKey || ''), entityType, entityRef, metricName, sinceTs);
  },

  listMetricAcrossEntities(entityType, metricName, sinceTs, targetKey = '') {
    return getPerfDb().prepare(`
      SELECT entity_ref, ts, value
      FROM metric_samples
      WHERE target_key = ?
        AND entity_type = ?
        AND metric_name = ?
        AND ts >= ?
      ORDER BY ts ASC
    `).all(String(targetKey || ''), entityType, metricName, sinceTs);
  },

  listEntityMetricHourly(entityType, entityRef, metricName, sinceTs, targetKey = '') {
    return getPerfDb().prepare(`
      SELECT bucket_ts AS ts, avg_value AS value, sample_count, min_value, max_value, last_value
      FROM metric_hourly_rollups
      WHERE target_key = ?
        AND entity_type = ?
        AND entity_ref = ?
        AND metric_name = ?
        AND bucket_ts >= ?
      ORDER BY bucket_ts ASC
    `).all(String(targetKey || ''), entityType, entityRef, metricName, sinceTs);
  },

  listMetricAcrossEntitiesHourly(entityType, metricName, sinceTs, targetKey = '') {
    return getPerfDb().prepare(`
      SELECT entity_ref, bucket_ts AS ts, avg_value AS value, sample_count, min_value, max_value, last_value
      FROM metric_hourly_rollups
      WHERE target_key = ?
        AND entity_type = ?
        AND metric_name = ?
        AND bucket_ts >= ?
      ORDER BY bucket_ts ASC
    `).all(String(targetKey || ''), entityType, metricName, sinceTs);
  },

  listLatestMetricByEntity(entityType, metricName, targetKey = '') {
    return getPerfDb().prepare(`
      SELECT samples.entity_ref, samples.ts, samples.value
      FROM metric_samples AS samples
      INNER JOIN (
        SELECT entity_ref, MAX(ts) AS latest_ts
        FROM metric_samples
        WHERE target_key = ?
          AND entity_type = ?
          AND metric_name = ?
        GROUP BY entity_ref
      ) AS latest
        ON latest.entity_ref = samples.entity_ref
       AND latest.latest_ts = samples.ts
      WHERE samples.target_key = ?
        AND samples.entity_type = ?
        AND samples.metric_name = ?
      ORDER BY samples.entity_ref ASC
    `).all(String(targetKey || ''), entityType, metricName, String(targetKey || ''), entityType, metricName);
  },

  listLatestHourlyMetricByEntity(entityType, metricName, targetKey = '') {
    return getPerfDb().prepare(`
      SELECT rollups.entity_ref, rollups.bucket_ts AS ts, rollups.avg_value AS value, rollups.sample_count
      FROM metric_hourly_rollups AS rollups
      INNER JOIN (
        SELECT entity_ref, MAX(bucket_ts) AS latest_bucket_ts
        FROM metric_hourly_rollups
        WHERE target_key = ?
          AND entity_type = ?
          AND metric_name = ?
        GROUP BY entity_ref
      ) AS latest
        ON latest.entity_ref = rollups.entity_ref
       AND latest.latest_bucket_ts = rollups.bucket_ts
      WHERE rollups.target_key = ?
        AND rollups.entity_type = ?
        AND rollups.metric_name = ?
      ORDER BY rollups.entity_ref ASC
    `).all(String(targetKey || ''), entityType, metricName, String(targetKey || ''), entityType, metricName);
  },
};

module.exports = {
  getPerfDb,
  metricSampleModel,
  toHourlyBucket,
};
