/**
 * `/api` rate limiter keyed by user id, then session id, then IP.
 *
 * Authenticated operators share a per-account bucket so a NAT of many
 * operators is not treated as one noisy IP. Unauthenticated traffic
 * (login) still falls back to IP via `ipKeyGenerator` (IPv6-safe).
 * Login itself uses a tighter dedicated limiter in `server/index.js`.
 */
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
