/**
 * Double-submit CSRF for the session-authenticated `/api` surface.
 *
 * Token is stored on `req.session.csrfToken` and echoed as `X-CSRF-Token`.
 * The SPA client (`client/assets/js/core/api.js`) must send that header on
 * every mutating request. Safe methods and the token-authenticated public
 * surfaces (`/api/v1`, `/api/terraform`) skip the check. The SAML ACS
 * endpoint is also exempt: it's a cross-site POST from the IdP (not the
 * SPA), so it can never carry our CSRF header — node-saml's own signature
 * verification on the assertion is what stands in for CSRF protection there.
 * Comparison is timing-safe; missing/mismatched tokens return `CSRF_TOKEN_INVALID`.
 */
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
    if (skip(req) || req.originalUrl.startsWith('/api/v1/') || req.originalUrl.startsWith('/api/terraform/') || req.originalUrl.startsWith('/api/auth/saml/callback') || SAFE_METHODS.has(req.method)) {
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
