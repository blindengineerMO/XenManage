const express = require('express');
const multer = require('multer');
const { validate, schemas } = require('../middleware/validate');
const { userModel } = require('../models/security-db');
const profileService = require('../services/profile');
const webPushService = require('../services/web-push');
const auditLogService = require('../services/audit-log');
const config = require('../config');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: config.profile.maxAvatarBytes } });

function currentOperator(req) {
  return req.session?.appUsername || req.session?.xenUser || 'system';
}

function requireLocalUser(req, res, next) {
  if (!req.session?.userId) {
    return res.status(403).json({ error: 'LOCAL_USER_REQUIRED' });
  }

  const account = userModel.getById(req.session.userId);
  if (!account || !account.active) {
    return res.status(403).json({ error: 'LOCAL_USER_REQUIRED' });
  }

  req.localAccount = account;
  next();
}

function mapProfileError(error) {
  const code = error?.code || error?.message || 'PROFILE_ACTION_FAILED';
  if (code === 'USER_NOT_FOUND') return { status: 404, error: code };
  if ([
    'CURRENT_PASSWORD_INCORRECT',
    'PASSWORD_TOO_SHORT',
    'UNSUPPORTED_AVATAR_TYPE',
    'AVATAR_TOO_LARGE',
    'AVATAR_IMAGE_INVALID',
    'MFA_TOKEN_INVALID',
    'MFA_ENROLLMENT_NOT_STARTED',
    'INVALID_PUSH_SUBSCRIPTION',
  ].includes(code)) {
    return { status: 400, error: code };
  }
  return { status: 500, error: code };
}

router.use(requireLocalUser);

router.get('/', (req, res) => {
  res.json({ data: profileService.getProfile(req.session.userId) });
});

router.put('/', validate(schemas.profileUpdate), (req, res) => {
  try {
    const before = profileService.getProfile(req.session.userId);
    const data = profileService.updateProfile(req.session.userId, req.body);
    auditLogService.record({
      category: 'account',
      action: 'profile_update',
      actionLabel: 'Updated profile',
      entityType: 'user',
      entityRef: String(req.session.userId),
      entityName: data.username,
      operator: currentOperator(req),
      route: '/api/profile',
      status: 'success',
      before: { displayName: before.display_name, email: before.email },
      after: { displayName: data.display_name, email: data.email },
      detail: `${data.username} updated their profile.`,
    });
    res.json({ data });
  } catch (error) {
    const mapped = mapProfileError(error);
    res.status(mapped.status).json({ error: mapped.error });
  }
});

router.post('/password', validate(schemas.profilePasswordChange), (req, res) => {
  try {
    const { user, revokedSessions } = profileService.changePassword(
      req.session.userId,
      req.session.id,
      req.body
    );
    auditLogService.record({
      category: 'account',
      action: 'profile_password_change',
      actionLabel: 'Changed password for',
      entityType: 'user',
      entityRef: String(req.session.userId),
      entityName: user.username,
      operator: currentOperator(req),
      route: '/api/profile/password',
      status: 'success',
      before: null,
      after: { revokedSessions },
      detail: `${user.username} changed their own password; ${revokedSessions} other session(s) were signed out.`,
    });
    res.json({ data: user, revokedSessions });
  } catch (error) {
    const mapped = mapProfileError(error);
    res.status(mapped.status).json({ error: mapped.error });
  }
});

router.put('/theme', validate(schemas.profileTheme), (req, res) => {
  const before = req.localAccount.theme;
  const data = profileService.setTheme(req.session.userId, req.body.theme);
  auditLogService.record({
    category: 'account', action: 'profile_theme_update', actionLabel: 'Updated profile theme',
    entityType: 'user', entityRef: String(req.session.userId), entityName: data.username,
    operator: currentOperator(req), route: '/api/profile/theme', before: { theme: before }, after: { theme: data.theme },
  });
  res.json({ data });
});

router.post('/avatar', upload.single('avatar'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'AVATAR_FILE_REQUIRED' });
  }

  try {
    const data = await profileService.setAvatar(req.session.userId, {
      mimetype: req.file.mimetype,
      buffer: req.file.buffer,
    });
    auditLogService.record({
      category: 'account',
      action: 'profile_avatar_update',
      actionLabel: 'Updated avatar for',
      entityType: 'user',
      entityRef: String(req.session.userId),
      entityName: data.username,
      operator: currentOperator(req),
      route: '/api/profile/avatar',
      status: 'success',
      before: null,
      after: { avatarPath: data.avatar_path },
      detail: `${data.username} updated their avatar.`,
    });
    res.json({ data });
  } catch (error) {
    const mapped = mapProfileError(error);
    res.status(mapped.status).json({ error: mapped.error });
  }
});

router.delete('/avatar', (req, res) => {
  const data = profileService.removeAvatar(req.session.userId);
  auditLogService.record({
    category: 'account', action: 'profile_avatar_remove', actionLabel: 'Removed profile avatar',
    entityType: 'user', entityRef: String(req.session.userId), entityName: data.username,
    operator: currentOperator(req), route: '/api/profile/avatar', before: { avatarPath: req.localAccount.avatar_path }, after: { avatarPath: '' },
  });
  res.json({ data });
});

router.get('/avatar/:userId', (req, res) => {
  const filePath = profileService.resolveAvatarFile(req.params.userId);
  if (!filePath) return res.status(404).end();
  res.sendFile(filePath);
});

router.post('/mfa/enroll', (req, res) => {
  try {
    const data = profileService.mfaBeginEnrollment(req.session.userId);
    auditLogService.record({
      category: 'account', action: 'profile_mfa_enrollment_started', actionLabel: 'Started MFA enrollment',
      entityType: 'user', entityRef: String(req.session.userId), entityName: req.localAccount.username,
      operator: currentOperator(req), route: '/api/profile/mfa/enroll', after: { pendingVerification: true },
    });
    res.json({ data });
  } catch (error) {
    const mapped = mapProfileError(error);
    res.status(mapped.status).json({ error: mapped.error });
  }
});

router.post('/mfa/verify', validate(schemas.profileMfaVerify), (req, res) => {
  try {
    const data = profileService.mfaConfirmEnrollment(req.session.userId, req.body.token);
    auditLogService.record({
      category: 'account',
      action: 'profile_mfa_enabled',
      actionLabel: 'Enabled MFA for',
      entityType: 'user',
      entityRef: String(req.session.userId),
      entityName: data.username,
      operator: currentOperator(req),
      route: '/api/profile/mfa/verify',
      status: 'success',
      before: { mfaEnabled: false },
      after: { mfaEnabled: true },
      detail: `${data.username} enrolled a TOTP authenticator.`,
    });
    res.json({ data });
  } catch (error) {
    const mapped = mapProfileError(error);
    res.status(mapped.status).json({ error: mapped.error });
  }
});

router.post('/mfa/disable', validate(schemas.profileMfaDisable), (req, res) => {
  try {
    const data = profileService.mfaDisable(req.session.userId, req.body.currentPassword);
    auditLogService.record({
      category: 'account',
      action: 'profile_mfa_disabled',
      actionLabel: 'Disabled MFA for',
      entityType: 'user',
      entityRef: String(req.session.userId),
      entityName: data.username,
      operator: currentOperator(req),
      route: '/api/profile/mfa/disable',
      status: 'success',
      before: { mfaEnabled: true },
      after: { mfaEnabled: false },
      detail: `${data.username} disabled TOTP MFA.`,
    });
    res.json({ data });
  } catch (error) {
    const mapped = mapProfileError(error);
    res.status(mapped.status).json({ error: mapped.error });
  }
});

router.get('/push/vapid-public-key', (_req, res) => {
  res.json({ publicKey: config.webPush.publicKey || '', configured: webPushService.isConfigured() });
});

router.get('/push', (req, res) => {
  res.json({ data: profileService.listPushSubscriptions(req.session.userId) });
});

router.post('/push/subscribe', validate(schemas.profilePushSubscribe), (req, res) => {
  try {
    const data = profileService.subscribePush(req.session.userId, req.body);
    auditLogService.record({
      category: 'account', action: 'profile_push_subscribe', actionLabel: 'Subscribed to profile notifications',
      entityType: 'user', entityRef: String(req.session.userId), entityName: req.localAccount.username,
      operator: currentOperator(req), route: '/api/profile/push/subscribe', after: { endpoint: data.endpoint, notifyAlerts: data.notify_alerts, notifyApprovals: data.notify_approvals, notifyCatalog: data.notify_catalog },
    });
    res.json({ data });
  } catch (error) {
    const mapped = mapProfileError(error);
    res.status(mapped.status).json({ error: mapped.error });
  }
});

router.delete('/push/subscribe', validate(schemas.profilePushUnsubscribe), (req, res) => {
  const removed = profileService.unsubscribePush(req.session.userId, req.body.endpoint);
  auditLogService.record({
    category: 'account', action: 'profile_push_unsubscribe', actionLabel: 'Unsubscribed from profile notifications',
    entityType: 'user', entityRef: String(req.session.userId), entityName: req.localAccount.username,
    operator: currentOperator(req), route: '/api/profile/push/subscribe', before: { endpoint: req.body.endpoint }, after: { removed },
  });
  res.json({ removed });
});

router.post('/push/test', async (req, res) => {
  try {
    const result = await webPushService.notifyUser(req.session.userId, {
      title: 'XenMange test notification',
      body: 'Web push notifications are working for your account.',
    }, 'alerts');
    res.json(result);
  } catch (error) {
    const mapped = mapProfileError(error);
    res.status(mapped.status).json({ error: error.code || error.message || 'PUSH_SEND_FAILED' });
  }
});

module.exports = router;
