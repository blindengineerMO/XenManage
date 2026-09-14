const requestContext = require('../services/request-context');
const governanceService = require('../services/governance');

// Makes the current request's break-glass elevation state available to
// auditLogService.record() without threading it through every one of the
// ~150 call sites across server/routes/*.js. Any code running downstream of
// this middleware (in the same request) can read requestContext.get() and
// see { breakGlassElevated }, the same flag requireAdminSession has always
// set as req.breakGlassElevated for its own routes.
module.exports = function requestContextMiddleware(req, res, next) {
  const breakGlassElevated = Boolean(governanceService.getBreakGlassState(req.session).active);
  requestContext.run({ breakGlassElevated }, next);
};
