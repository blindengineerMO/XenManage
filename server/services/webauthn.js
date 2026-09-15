/**
 * WebAuthn/FIDO2 as an alternative second factor to TOTP.
 *
 * rpID/origin are derived per-request (not from a fixed env var) unless
 * config.webauthn.rpId/origin override it, since XenMange is typically
 * self-hosted at an arbitrary domain and WebAuthn ceremonies fail hard on
 * any origin mismatch. A credential's public key/counter are the only
 * secrets kept server-side (never a private key); `counter` must be
 * persisted after every successful assertion to detect cloned authenticators.
 *
 * Registration/authentication challenges are stashed on req.session (mirrors
 * the OIDC state/nonce pattern) so the verify step can confirm the response
 * corresponds to a challenge this same session actually issued.
 */
const {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} = require('@simplewebauthn/server');
const config = require('../config');
const { webauthnCredentialModel } = require('../models/security-db');

function resolveRpId(req) {
  return config.webauthn.rpId || req.hostname;
}

function resolveOrigin(req) {
  return config.webauthn.origin || `${req.protocol}://${req.get('host')}`;
}

async function beginRegistration(req, user) {
  const existingCredentials = webauthnCredentialModel.listForUser(user.id);

  const options = await generateRegistrationOptions({
    rpName: config.webauthn.rpName,
    rpID: resolveRpId(req),
    userName: user.username,
    userDisplayName: user.display_name || user.username,
    attestationType: 'none',
    excludeCredentials: existingCredentials.map((credential) => ({
      id: credential.credential_id,
      transports: credential.transports,
    })),
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred',
    },
  });

  req.session.webauthnChallenge = {
    challenge: options.challenge,
    userId: user.id,
    purpose: 'register',
  };

  return options;
}

async function finishRegistration(req, user, response, name) {
  const pending = req.session.webauthnChallenge;
  if (!pending || pending.purpose !== 'register' || pending.userId !== user.id) {
    const error = new Error('WEBAUTHN_NO_PENDING_CHALLENGE');
    error.code = 'WEBAUTHN_NO_PENDING_CHALLENGE';
    throw error;
  }

  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge: pending.challenge,
    expectedOrigin: resolveOrigin(req),
    expectedRPID: resolveRpId(req),
  });

  delete req.session.webauthnChallenge;

  if (!verification.verified || !verification.registrationInfo) {
    const error = new Error('WEBAUTHN_REGISTRATION_FAILED');
    error.code = 'WEBAUTHN_REGISTRATION_FAILED';
    throw error;
  }

  const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;

  return webauthnCredentialModel.create({
    userId: user.id,
    credentialId: credential.id,
    publicKey: Buffer.from(credential.publicKey).toString('base64url'),
    counter: credential.counter,
    transports: credential.transports || [],
    deviceType: credentialDeviceType,
    backedUp: credentialBackedUp,
    name: name || 'Security key',
  });
}

async function beginAuthentication(req, user) {
  const credentials = webauthnCredentialModel.listForUser(user.id);
  if (!credentials.length) {
    const error = new Error('WEBAUTHN_NO_CREDENTIALS');
    error.code = 'WEBAUTHN_NO_CREDENTIALS';
    throw error;
  }

  const options = await generateAuthenticationOptions({
    rpID: resolveRpId(req),
    userVerification: 'preferred',
    allowCredentials: credentials.map((credential) => ({
      id: credential.credential_id,
      transports: credential.transports,
    })),
  });

  req.session.webauthnChallenge = {
    challenge: options.challenge,
    userId: user.id,
    purpose: 'authenticate',
  };

  return options;
}

async function finishAuthentication(req, user, response) {
  const pending = req.session.webauthnChallenge;
  if (!pending || pending.purpose !== 'authenticate' || pending.userId !== user.id) {
    const error = new Error('WEBAUTHN_NO_PENDING_CHALLENGE');
    error.code = 'WEBAUTHN_NO_PENDING_CHALLENGE';
    throw error;
  }

  const storedCredential = webauthnCredentialModel.getByCredentialId(response.id);
  if (!storedCredential || storedCredential.user_id !== user.id) {
    const error = new Error('WEBAUTHN_CREDENTIAL_NOT_FOUND');
    error.code = 'WEBAUTHN_CREDENTIAL_NOT_FOUND';
    throw error;
  }

  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge: pending.challenge,
    expectedOrigin: resolveOrigin(req),
    expectedRPID: resolveRpId(req),
    credential: {
      id: storedCredential.credential_id,
      publicKey: Buffer.from(storedCredential.public_key, 'base64url'),
      counter: storedCredential.counter,
      transports: storedCredential.transports,
    },
  });

  delete req.session.webauthnChallenge;

  if (!verification.verified) {
    const error = new Error('WEBAUTHN_AUTHENTICATION_FAILED');
    error.code = 'WEBAUTHN_AUTHENTICATION_FAILED';
    throw error;
  }

  webauthnCredentialModel.updateCounter(storedCredential.id, verification.authenticationInfo.newCounter);
  return true;
}

module.exports = {
  beginRegistration,
  finishRegistration,
  beginAuthentication,
  finishAuthentication,
};
