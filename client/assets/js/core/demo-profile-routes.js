const demoProfileState = {
  id: 1,
  username: 'admin',
  display_name: 'Demo Administrator',
  email: 'admin@demo.local',
  theme: 'dark',
  avatar_path: '',
  mfa_enabled: false,
};

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
  return undefined;
}
