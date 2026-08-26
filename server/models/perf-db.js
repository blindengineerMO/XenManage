const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const config = require('../config');

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
  initializeSchema();
  return perfDb;
}

function initializeSchema() {
  getPerfDb().exec(`
    CREATE TABLE IF NOT EXISTS metric_samples (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
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

    CREATE TABLE IF NOT EXISTS metric_hourly_rollups (
      entity_type TEXT NOT NULL,
      entity_ref TEXT NOT NULL,
      metric_name TEXT NOT NULL,
      bucket_ts INTEGER NOT NULL,
      sample_count INTEGER NOT NULL DEFAULT 0,
      min_value REAL NOT NULL DEFAULT 0,
      max_value REAL NOT NULL DEFAULT 0,
      avg_value REAL NOT NULL DEFAULT 0,
      last_value REAL NOT NULL DEFAULT 0,
      PRIMARY KEY (entity_type, entity_ref, metric_name, bucket_ts)
    );

    CREATE INDEX IF NOT EXISTS idx_metric_hourly_lookup
    ON metric_hourly_rollups (entity_type, entity_ref, metric_name, bucket_ts);

    CREATE INDEX IF NOT EXISTS idx_metric_hourly_rollup
    ON metric_hourly_rollups (entity_type, metric_name, bucket_ts);
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
      INSERT INTO metric_samples (entity_type, entity_ref, metric_name, ts, value)
      VALUES (?, ?, ?, ?, ?)
    `);
    const upsertRollup = db.prepare(`
      INSERT INTO metric_hourly_rollups (
        entity_type,
        entity_ref,
        metric_name,
        bucket_ts,
        sample_count,
        min_value,
        max_value,
        avg_value,
        last_value
      ) VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?)
      ON CONFLICT(entity_type, entity_ref, metric_name, bucket_ts) DO UPDATE SET
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
        insert.run(row.entityType, row.entityRef, row.metricName, row.ts, row.value);
        const bucketTs = toHourlyBucket(row.ts);
        upsertRollup.run(
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

  getLatestTimestamp() {
    const row = getPerfDb().prepare('SELECT MAX(ts) AS latestTs FROM metric_samples').get();
    return Number(row?.latestTs || 0);
  },

  listEntityMetric(entityType, entityRef, metricName, sinceTs) {
    return getPerfDb().prepare(`
      SELECT ts, value
      FROM metric_samples
      WHERE entity_type = ?
        AND entity_ref = ?
        AND metric_name = ?
        AND ts >= ?
      ORDER BY ts ASC
    `).all(entityType, entityRef, metricName, sinceTs);
  },

  listMetricAcrossEntities(entityType, metricName, sinceTs) {
    return getPerfDb().prepare(`
      SELECT entity_ref, ts, value
      FROM metric_samples
      WHERE entity_type = ?
        AND metric_name = ?
        AND ts >= ?
      ORDER BY ts ASC
    `).all(entityType, metricName, sinceTs);
  },

  listEntityMetricHourly(entityType, entityRef, metricName, sinceTs) {
    return getPerfDb().prepare(`
      SELECT bucket_ts AS ts, avg_value AS value, sample_count, min_value, max_value, last_value
      FROM metric_hourly_rollups
      WHERE entity_type = ?
        AND entity_ref = ?
        AND metric_name = ?
        AND bucket_ts >= ?
      ORDER BY bucket_ts ASC
    `).all(entityType, entityRef, metricName, sinceTs);
  },

  listMetricAcrossEntitiesHourly(entityType, metricName, sinceTs) {
    return getPerfDb().prepare(`
      SELECT entity_ref, bucket_ts AS ts, avg_value AS value, sample_count, min_value, max_value, last_value
      FROM metric_hourly_rollups
      WHERE entity_type = ?
        AND metric_name = ?
        AND bucket_ts >= ?
      ORDER BY bucket_ts ASC
    `).all(entityType, metricName, sinceTs);
  },

  listLatestMetricByEntity(entityType, metricName) {
    return getPerfDb().prepare(`
      SELECT samples.entity_ref, samples.ts, samples.value
      FROM metric_samples AS samples
      INNER JOIN (
        SELECT entity_ref, MAX(ts) AS latest_ts
        FROM metric_samples
        WHERE entity_type = ?
          AND metric_name = ?
        GROUP BY entity_ref
      ) AS latest
        ON latest.entity_ref = samples.entity_ref
       AND latest.latest_ts = samples.ts
      WHERE samples.entity_type = ?
        AND samples.metric_name = ?
      ORDER BY samples.entity_ref ASC
    `).all(entityType, metricName, entityType, metricName);
  },

  listLatestHourlyMetricByEntity(entityType, metricName) {
    return getPerfDb().prepare(`
      SELECT rollups.entity_ref, rollups.bucket_ts AS ts, rollups.avg_value AS value, rollups.sample_count
      FROM metric_hourly_rollups AS rollups
      INNER JOIN (
        SELECT entity_ref, MAX(bucket_ts) AS latest_bucket_ts
        FROM metric_hourly_rollups
        WHERE entity_type = ?
          AND metric_name = ?
        GROUP BY entity_ref
      ) AS latest
        ON latest.entity_ref = rollups.entity_ref
       AND latest.latest_bucket_ts = rollups.bucket_ts
      WHERE rollups.entity_type = ?
        AND rollups.metric_name = ?
      ORDER BY rollups.entity_ref ASC
    `).all(entityType, metricName, entityType, metricName);
  },
};

module.exports = {
  getPerfDb,
  metricSampleModel,
  toHourlyBucket,
};
