/**
 * Assigns `req.requestId`, emits structured `request_completed` logs, and
 * feeds latency/status into `runtime-metrics` for `/metrics` scrape.
 * Attach this before routers so 4xx/5xx still get a duration sample.
 */
const crypto = require('crypto');
const logger = require('../services/logger');
const { recordRequest } = require('../services/runtime-metrics');

function requestLogging(req, res, next) {
  const requestId = crypto.randomUUID();
  const startedAt = process.hrtime.bigint();
  req.requestId = requestId;
  res.setHeader('X-Request-ID', requestId);

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    recordRequest({ method: req.method, statusCode: res.statusCode, durationMs });
    logger.info('request_completed', {
      requestId,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: Math.round(durationMs * 100) / 100,
    });
  });

  next();
}

module.exports = requestLogging;
