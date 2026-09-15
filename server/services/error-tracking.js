// Optional Sentry capture. Enabled only when SENTRY_DSN is set; otherwise
// captureException is a no-op. Wired from middleware/error-handler.js with
// requestId + route tags. sendDefaultPii is off. Do not call Sentry APIs
// directly from routes — go through captureException so tests and DSN-less
// installs stay inert.
const Sentry = require('@sentry/node');
const config = require('../config');

const dsn = String(process.env.SENTRY_DSN || '').trim();
const enabled = Boolean(dsn);

if (enabled) {
  Sentry.init({
    dsn,
    environment: config.env,
    sendDefaultPii: false,
  });
}

function captureException(error, context = {}) {
  if (!enabled) return;
  Sentry.withScope((scope) => {
    scope.setTags({ requestId: context.requestId || '', route: context.path || '' });
    Sentry.captureException(error);
  });
}

module.exports = { captureException, enabled };
