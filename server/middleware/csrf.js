const crypto = require('crypto');

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function getCsrfToken(req) {
  if (!req.session) return '';
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('base64url');
  }
  return req.session.csrfToken;
}

function tokensMatch(expected, supplied) {
  if (!expected || !supplied) return false;
  const expectedBuffer = Buffer.from(expected);
  const suppliedBuffer = Buffer.from(supplied);
  return expectedBuffer.length === suppliedBuffer.length
    && crypto.timingSafeEqual(expectedBuffer, suppliedBuffer);
}

function csrfProtection(options = {}) {
  const skip = options.skip || (() => false);

  return (req, res, next) => {
    if (skip(req) || req.originalUrl.startsWith('/api/v1/') || req.originalUrl.startsWith('/api/terraform/') || SAFE_METHODS.has(req.method)) {
      if (req.session) res.setHeader('X-CSRF-Token', getCsrfToken(req));
      return next();
    }

    const expected = getCsrfToken(req);
    const supplied = req.get('X-CSRF-Token');
    if (!tokensMatch(expected, supplied)) {
      return res.status(403).json({ error: 'CSRF_TOKEN_INVALID' });
    }

    res.setHeader('X-CSRF-Token', expected);
    next();
  };
}

module.exports = { csrfProtection, getCsrfToken, tokensMatch };
