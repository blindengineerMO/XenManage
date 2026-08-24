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
  `);
}

const metricSampleModel = {
  insertMany(samples = []) {
    if (!Array.isArray(samples) || !samples.length) return 0;

    const insert = getPerfDb().prepare(`
      INSERT INTO metric_samples (entity_type, entity_ref, metric_name, ts, value)
      VALUES (?, ?, ?, ?, ?)
    `);

    const transaction = getPerfDb().transaction((rows) => {
      for (const row of rows) {
        insert.run(row.entityType, row.entityRef, row.metricName, row.ts, row.value);
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
};

module.exports = {
  getPerfDb,
  metricSampleModel,
};
