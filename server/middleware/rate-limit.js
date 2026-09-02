const { ipKeyGenerator, rateLimit } = require('express-rate-limit');

function getApiRateLimitKey(req) {
  const userId = req.session?.user?.id;
  if (userId) return `user:${userId}`;

  const sessionId = req.sessionID;
  if (sessionId) return `session:${sessionId}`;

  return `ip:${ipKeyGenerator(req.ip)}`;
}

function createApiRateLimiter(options = {}) {
  return rateLimit({
    windowMs: options.windowMs || 15 * 60 * 1000,
    max: options.max || 300,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skip: options.skip || (() => false),
    keyGenerator: getApiRateLimitKey,
    message: {
      error: 'RATE_LIMITED',
      message: 'Too many API requests, please try again later.',
    },
  });
}

module.exports = {
  createApiRateLimiter,
  getApiRateLimitKey,
};
