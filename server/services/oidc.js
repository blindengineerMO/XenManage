/**
 * OIDC (OpenID Connect) SSO login — Authorization Code flow with PKCE.
 *
 * Discovery happens once and the resulting Configuration is cached for the life of
 * the process; a fresh login/callback pair never re-discovers. `state`/`nonce`/
 * `code_verifier` are generated per login attempt and stashed on `req.session` (never
 * in the redirect URL beyond `state` itself) so the callback can validate them against
 * the same session that initiated the flow — this is the CSRF protection for a flow
 * that is otherwise just a cross-site GET redirect.
 *
 * A successful callback resolves to a local `users` row: an existing row is matched by
 * `oidc_subject`, otherwise one is auto-provisioned (see userModel.getByOidcSubject /
 * createOidcUser in security-db.js). XenMange's session/role/permission machinery is
 * entirely local-user based, so OIDC only needs to answer "which local user is this?"
 * and everything downstream (governance, quotas, project membership) works unchanged.
 */
const config = require('../config');

let discoveryPromise = null;

function isEnabled() {
  return Boolean(config.oidc.enabled && config.oidc.issuer && config.oidc.clientId && config.oidc.clientSecret && config.oidc.redirectUri);
}

async function getClientConfig() {
  if (!isEnabled()) {
    const error = new Error('OIDC_NOT_CONFIGURED');
    error.code = 'OIDC_NOT_CONFIGURED';
    throw error;
  }

  if (!discoveryPromise) {
    const client = require('openid-client');
    discoveryPromise = client.discovery(new URL(config.oidc.issuer), config.oidc.clientId, config.oidc.clientSecret)
      .catch((error) => {
        discoveryPromise = null;
        throw error;
      });
  }

  return discoveryPromise;
}

async function buildAuthorizationRedirect(req, { returnTo = '/' } = {}) {
  const client = require('openid-client');
  const clientConfig = await getClientConfig();

  const codeVerifier = client.randomPKCECodeVerifier();
  const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier);
  const state = client.randomState();
  const nonce = client.randomNonce();

  req.session.oidc = {
    state,
    nonce,
    codeVerifier,
    returnTo: String(returnTo || '/').startsWith('/') ? returnTo : '/',
  };

  const redirectUrl = client.buildAuthorizationUrl(clientConfig, {
    redirect_uri: config.oidc.redirectUri,
    scope: config.oidc.scope,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    state,
    nonce,
  });

  return redirectUrl.href;
}

async function handleCallback(req) {
  const client = require('openid-client');
  const clientConfig = await getClientConfig();
  const pending = req.session.oidc;
  if (!pending || !pending.state || !pending.codeVerifier) {
    const error = new Error('OIDC_NO_PENDING_LOGIN');
    error.code = 'OIDC_NO_PENDING_LOGIN';
    throw error;
  }

  const currentUrl = new URL(req.originalUrl, config.oidc.redirectUri);
  const tokens = await client.authorizationCodeGrant(clientConfig, currentUrl, {
    pkceCodeVerifier: pending.codeVerifier,
    expectedState: pending.state,
    expectedNonce: pending.nonce,
  });

  const claims = tokens.claims();
  const returnTo = pending.returnTo || '/';
  delete req.session.oidc;

  if (!claims || !claims.sub) {
    const error = new Error('OIDC_MISSING_SUBJECT');
    error.code = 'OIDC_MISSING_SUBJECT';
    throw error;
  }

  const email = String(claims.email || '').trim();
  if (config.oidc.allowedEmailDomains.length) {
    const domain = email.split('@')[1]?.toLowerCase() || '';
    if (!config.oidc.allowedEmailDomains.includes(domain)) {
      const error = new Error('OIDC_EMAIL_DOMAIN_NOT_ALLOWED');
      error.code = 'OIDC_EMAIL_DOMAIN_NOT_ALLOWED';
      throw error;
    }
  }

  return {
    subject: String(claims.sub),
    email,
    displayName: String(claims.name || claims.preferred_username || email || claims.sub),
    returnTo,
  };
}

module.exports = {
  isEnabled,
  buildAuthorizationRedirect,
  handleCallback,
};
