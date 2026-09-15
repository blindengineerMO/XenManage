/**
 * XenMange client — demo /api/profile routes (offline XAPI shim).
 *
 * Concatenated global script (scripts/build-client.js). Not an ES module.
 *
 * OFFLINE/DEMO ONLY: used when no live Xen target is attached (`store.demoMode`).
 * Do not treat this as production XenServer/XAPI code.
 *
 * Purpose: profile, theme, password, MFA enroll/verify, WebAuthn security-key
 * stub, and empty push subscription responses for the profile window.
 * Consumers: demo-request.js (`handleDemoProfileRoutes`); api.uploadProfileAvatar
 * mutates `demoProfileState` directly.
 * Gotchas: MFA secret is a well-known demo TOTP seed, not a real enrollment.
 * WebAuthn registration is faked (no real ceremony/ArrayBuffer round-trip) -
 * the demo login screen never offers a WebAuthn factor since launchDemo()
 * bypasses /api/auth/login entirely, so this only backs the profile UI list.
 * Push VAPID is always unconfigured.
 */
const demoProfileState = {
  id: 1,
  username: 'admin',
  display_name: 'Demo Administrator',
  email: 'admin@demo.local',
  theme: 'dark',
  avatar_path: '',
  mfa_enabled: false,
};

const demoWebauthnCredentials = [];

function handleDemoProfileRoutes(method, path, body = {}) {
  if (method === 'GET' && path === '/api/profile') return { data: clone(demoProfileState) };
  if (method === 'PUT' && path === '/api/profile') {
    demoProfileState.display_name = String(body.displayName || '');
    demoProfileState.email = String(body.email || '');
    return { data: clone(demoProfileState) };
  }
  if (method === 'POST' && path === '/api/profile/password') return { data: clone(demoProfileState), revokedSessions: 0 };
  if (method === 'PUT' && path === '/api/profile/theme') {
    demoProfileState.theme = body.theme === 'light' ? 'light' : 'dark';
    return { data: clone(demoProfileState) };
  }
  if (method === 'DELETE' && path === '/api/profile/avatar') {
    demoProfileState.avatar_path = '';
    return { data: clone(demoProfileState) };
  }
  if (method === 'GET' && path === '/api/profile/push/vapid-public-key') return { publicKey: '', configured: false };
  if (method === 'GET' && path === '/api/profile/push') return { data: [] };
  if (method === 'POST' && path === '/api/profile/mfa/enroll') return { data: { secret: 'JBSWY3DPEHPK3PXP', otpAuthUri: 'otpauth://totp/XenMange%3Aadmin?secret=JBSWY3DPEHPK3PXP&issuer=XenMange' } };
  if (method === 'POST' && path === '/api/profile/mfa/verify') {
    demoProfileState.mfa_enabled = true;
    return { data: clone(demoProfileState) };
  }
  if (method === 'POST' && path === '/api/profile/mfa/disable') {
    demoProfileState.mfa_enabled = false;
    return { data: clone(demoProfileState) };
  }
  if (method === 'GET' && path === '/api/profile/webauthn/credentials') return { data: clone(demoWebauthnCredentials) };
  if (method === 'POST' && path === '/api/profile/webauthn/register/options') {
    return { data: { challenge: 'demo-challenge', rp: { name: 'XenMange (Demo)' }, user: { id: 'ZGVtbw', name: 'admin', displayName: 'Demo Administrator' }, pubKeyCredParams: [] } };
  }
  if (method === 'POST' && path === '/api/profile/webauthn/register/verify') {
    const credential = {
      id: demoWebauthnCredentials.length + 1,
      name: body.name || 'Security key',
      created_at: new Date().toISOString(),
    };
    demoWebauthnCredentials.push(credential);
    demoProfileState.mfa_enabled = true;
    return { data: clone(credential) };
  }
  const webauthnCredentialMatch = path.match(/^\/api\/profile\/webauthn\/credentials\/(\d+)$/);
  if (method === 'DELETE' && webauthnCredentialMatch) {
    const credentialId = Number(webauthnCredentialMatch[1]);
    const index = demoWebauthnCredentials.findIndex((entry) => entry.id === credentialId);
    if (index !== -1) demoWebauthnCredentials.splice(index, 1);
    if (!demoWebauthnCredentials.length) demoProfileState.mfa_enabled = false;
    return { removed: true };
  }
  return undefined;
}
