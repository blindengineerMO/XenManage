const config = require('../config');
const logger = require('../services/logger');
const errorTracking = require('../services/error-tracking');

function normalizeStatus(error) {
  const status = Number(error?.status || error?.statusCode);
  return Number.isInteger(status) && status >= 400 && status < 500 ? status : 500;
}

function apiErrorCode(error, status) {
  if (status === 400 && error?.type === 'entity.parse.failed') return 'INVALID_JSON';
  if (status === 413) return 'PAYLOAD_TOO_LARGE';
  return status === 500 ? 'INTERNAL_SERVER_ERROR' : 'BAD_REQUEST';
}

function createErrorHandler(dependencies = {}) {
  const log = dependencies.logger || logger;
  const tracker = dependencies.errorTracking || errorTracking;
  const environment = dependencies.environment || config.env;

  return (error, req, res, next) => {
    if (res.headersSent) return next(error);

    const status = normalizeStatus(error);
    log.error('request_failed', {
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl,
      status,
      error,
    });
    if (status >= 500) {
      tracker.captureException(error, { requestId: req.requestId, path: req.originalUrl });
    }

    if (req.path.startsWith('/api/')) {
      return res.status(status).json({ error: apiErrorCode(error, status) });
    }
    return res.status(status).render('500', {
      error: environment === 'development' ? error.message : '',
    }, (renderError, html) => {
      if (renderError) return next(error);
      return res.send(html);
    });
  };
}

module.exports = { createErrorHandler, normalizeStatus, apiErrorCode };
