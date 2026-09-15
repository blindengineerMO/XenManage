/**
 * SAML SP-initiated SSO login, parallel to services/oidc.js.
 *
 * The SAML client (`@node-saml/node-saml`) is stateless per call — every
 * function below builds a fresh `SAML` instance from config rather than
 * caching one, since node-saml has no async discovery step to amortize
 * (unlike OIDC's issuer discovery). `RelayState` carries the post-login
 * `returnTo` path across the IdP redirect, mirroring OIDC's `state`.
 *
 * A successful callback resolves to a local `users` row: an existing row is
 * matched by `saml_subject` (the assertion's NameID), otherwise one is
 * auto-provisioned (userModel.getBySamlSubject / createSamlUser).
 */
const config = require('../config');

function isEnabled() {
  return Boolean(config.saml.enabled && config.saml.entryPoint && config.saml.cert && config.saml.callbackUrl);
}

function buildClient() {
  if (!isEnabled()) {
    const error = new Error('SAML_NOT_CONFIGURED');
    error.code = 'SAML_NOT_CONFIGURED';
    throw error;
  }

  const { SAML } = require('@node-saml/node-saml');
  return new SAML({
    entryPoint: config.saml.entryPoint,
    issuer: config.saml.issuer,
    callbackUrl: config.saml.callbackUrl,
    idpCert: config.saml.cert,
    wantAssertionsSigned: true,
  });
}

async function buildAuthorizationRedirect({ returnTo = '/' } = {}) {
  const client = buildClient();
  const relayState = String(returnTo || '/').startsWith('/') ? returnTo : '/';
  return client.getAuthorizeUrlAsync(relayState, undefined, {});
}

async function handleCallback(req) {
  const client = buildClient();
  const { profile } = await client.validatePostResponseAsync(req.body || {});

  if (!profile || !profile.nameID) {
    const error = new Error('SAML_MISSING_SUBJECT');
    error.code = 'SAML_MISSING_SUBJECT';
    throw error;
  }

  const email = String(profile.email || profile.mail || '').trim();
  if (config.saml.allowedEmailDomains.length) {
    const domain = email.split('@')[1]?.toLowerCase() || '';
    if (!config.saml.allowedEmailDomains.includes(domain)) {
      const error = new Error('SAML_EMAIL_DOMAIN_NOT_ALLOWED');
      error.code = 'SAML_EMAIL_DOMAIN_NOT_ALLOWED';
      throw error;
    }
  }

  const returnTo = String(req.body?.RelayState || '/').startsWith('/') ? req.body.RelayState : '/';

  return {
    subject: String(profile.nameID),
    email,
    displayName: String(profile.displayName || profile.cn || email || profile.nameID),
    returnTo,
  };
}

function getServiceProviderMetadata() {
  const client = buildClient();
  return client.generateServiceProviderMetadata(null, null);
}

module.exports = {
  isEnabled,
  buildAuthorizationRedirect,
  handleCallback,
  getServiceProviderMetadata,
};
