const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const TEST_DB = path.join(__dirname, '..', '..', '..', 'data', 'profile.db');
const TEST_SECURITY_DB = path.join(__dirname, '..', '..', '..', 'data', 'profile-security.db');
const TEST_AVATAR_ROOT = path.join(__dirname, '..', '..', '..', 'data', 'profile-avatars');

Object.assign(process.env, {
  DB_PATH: TEST_DB,
  SECURITY_DB_PATH: TEST_SECURITY_DB,
  PROFILE_AVATAR_ROOT: TEST_AVATAR_ROOT,
  NODE_ENV: 'test',
});

function clean() {
  [TEST_DB, `${TEST_DB}-wal`, `${TEST_DB}-shm`, TEST_SECURITY_DB, `${TEST_SECURITY_DB}-wal`, `${TEST_SECURITY_DB}-shm`]
    .forEach((file) => { if (fs.existsSync(file)) fs.unlinkSync(file); });
  fs.rmSync(TEST_AVATAR_ROOT, { recursive: true, force: true });
}

clean();

const { userModel, sessionStoreModel } = require('../../../server/models/security-db');
const profileService = require('../../../server/services/profile');
const totp = require('../../../server/services/totp');

describe('Profile service', () => {
  const user = () => userModel.getByUsername('admin');

  afterAll(clean);

  it('updates only the selected profile and persists appearance', () => {
    expect(profileService.updateProfile(user().id, { displayName: 'Platform Owner', email: 'owner@example.test' }))
      .toEqual(expect.objectContaining({ display_name: 'Platform Owner', email: 'owner@example.test' }));
    expect(profileService.setTheme(user().id, 'light')).toEqual(expect.objectContaining({ theme: 'light' }));
  });

  it('verifies the current password and revokes every other account session', () => {
    sessionStoreModel.set('current', JSON.stringify({ userId: user().id }), Date.now() + 60000);
    sessionStoreModel.set('other', JSON.stringify({ userId: user().id }), Date.now() + 60000);
    expect(() => profileService.changePassword(user().id, 'current', { currentPassword: 'wrong', newPassword: 'new-password!' }))
      .toThrow('CURRENT_PASSWORD_INCORRECT');

    const result = profileService.changePassword(user().id, 'current', { currentPassword: 'admin123!', newPassword: 'new-password!' });

    expect(result.revokedSessions).toBe(1);
    expect(sessionStoreModel.get('current')).toBeTruthy();
    expect(sessionStoreModel.get('other')).toBeNull();
  });

  it('decodes, bounds, re-encodes, and content-addresses uploaded avatars', async () => {
    const input = await sharp({ create: { width: 900, height: 600, channels: 4, background: '#00ff41' } }).png().toBuffer();
    const updated = await profileService.setAvatar(user().id, { mimetype: 'image/png', buffer: input });
    const filePath = profileService.resolveAvatarFile(user().id);
    const metadata = await sharp(filePath).metadata();

    expect(updated.avatar_path).toMatch(/^\d+-[a-f0-9]{24}\.webp$/);
    expect(metadata).toEqual(expect.objectContaining({ format: 'webp', width: 512, height: 341 }));
    expect(path.dirname(filePath)).toBe(path.resolve(TEST_AVATAR_ROOT));
  });

  it('enrolls and verifies TOTP while persisting push preferences', () => {
    const enrollment = profileService.mfaBeginEnrollment(user().id);
    expect(profileService.mfaConfirmEnrollment(user().id, totp.generateToken(enrollment.secret)).mfa_enabled).toBe(true);
    expect(profileService.verifyMfaToken(user().id, totp.generateToken(enrollment.secret))).toBe(true);

    const subscription = profileService.subscribePush(user().id, {
      endpoint: 'https://push.example.test/subscription', keys: { p256dh: 'public-key', auth: 'auth-key' },
      notifyAlerts: true, notifyApprovals: false, notifyCatalog: true,
    });
    expect(subscription).toEqual(expect.objectContaining({ notify_alerts: 1, notify_approvals: 0, notify_catalog: 1 }));
    expect(profileService.unsubscribePush(user().id, subscription.endpoint)).toBe(true);
  });
});
