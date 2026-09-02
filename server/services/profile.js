const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const sharp = require('sharp');
const config = require('../config');
const { userModel, sessionStoreModel, pushSubscriptionModel } = require('../models/security-db');
const totp = require('./totp');
const credentialVaultService = require('./credential-vault');

const AVATAR_MIME_EXTENSIONS = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
};

function deriveMfaKey() {
  return crypto.createHash('sha256')
    .update(`${config.session.secret}:xenmange-mfa-secret-key`)
    .digest();
}

function decryptMfaSecret(payload) {
  if (String(payload || '').trim().startsWith('{')) return credentialVaultService.openSealedSecret(payload);
  const buffer = Buffer.from(String(payload || ''), 'base64');
  const iv = buffer.subarray(0, 12);
  const authTag = buffer.subarray(12, 28);
  const encrypted = buffer.subarray(28);
  const key = deriveMfaKey();
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

function throwUserNotFound() {
  const error = new Error('USER_NOT_FOUND');
  error.code = 'USER_NOT_FOUND';
  throw error;
}

function ensureAvatarRoot() {
  if (!fs.existsSync(config.profile.avatarRoot)) {
    fs.mkdirSync(config.profile.avatarRoot, { recursive: true });
  }
}

function avatarPathForUser(userId, filename) {
  ensureAvatarRoot();
  const root = path.resolve(config.profile.avatarRoot);
  const filePath = path.resolve(root, filename);
  if (path.relative(root, filePath).startsWith('..')) {
    const error = new Error('INVALID_AVATAR_PATH');
    error.code = 'INVALID_AVATAR_PATH';
    throw error;
  }
  return filePath;
}

function removeExistingAvatarFiles(userId, exceptFilename = '') {
  ensureAvatarRoot();
  const root = path.resolve(config.profile.avatarRoot);
  const prefix = `${Number(userId)}-`;
  fs.readdirSync(root).filter((filename) => filename.startsWith(prefix) && filename !== exceptFilename).forEach((filename) => {
    const filePath = path.resolve(root, filename);
    if (!path.relative(root, filePath).startsWith('..') && fs.statSync(filePath).isFile()) fs.unlinkSync(filePath);
  });
}

const profileService = {
  getProfile(userId) {
    const user = userModel.getById(userId);
    if (!user) throwUserNotFound();
    return user;
  },

  updateProfile(userId, { displayName, email } = {}) {
    return userModel.updateProfile(userId, { displayName, email });
  },

  changePassword(userId, sessionId, { currentPassword, newPassword } = {}) {
    const existing = userModel.getByUsernameById(userId);
    if (!existing) throwUserNotFound();

    if (!bcrypt.compareSync(String(currentPassword || ''), existing.password_hash)) {
      const error = new Error('CURRENT_PASSWORD_INCORRECT');
      error.code = 'CURRENT_PASSWORD_INCORRECT';
      throw error;
    }

    const password = String(newPassword || '');
    if (password.length < 8) {
      const error = new Error('PASSWORD_TOO_SHORT');
      error.code = 'PASSWORD_TOO_SHORT';
      throw error;
    }

    userModel.setPassword(userId, password);
    const revokedSessions = sessionStoreModel.destroyForUserExcept(userId, sessionId);
    return { user: userModel.getById(userId), revokedSessions };
  },

  setTheme(userId, theme) {
    return userModel.setTheme(userId, theme);
  },

  async setAvatar(userId, { mimetype, buffer } = {}) {
    if (!AVATAR_MIME_EXTENSIONS[mimetype]) {
      const error = new Error('UNSUPPORTED_AVATAR_TYPE');
      error.code = 'UNSUPPORTED_AVATAR_TYPE';
      throw error;
    }
    if (!buffer || buffer.length > config.profile.maxAvatarBytes) {
      const error = new Error('AVATAR_TOO_LARGE');
      error.code = 'AVATAR_TOO_LARGE';
      throw error;
    }

    let encoded;
    try {
      encoded = await sharp(buffer, { limitInputPixels: 16777216, failOn: 'warning' })
        .rotate()
        .resize(512, 512, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 82, effort: 4 })
        .toBuffer();
    } catch (_error) {
      const error = new Error('AVATAR_IMAGE_INVALID');
      error.code = 'AVATAR_IMAGE_INVALID';
      throw error;
    }
    const digest = crypto.createHash('sha256').update(encoded).digest('hex').slice(0, 24);
    const filename = `${Number(userId)}-${digest}.webp`;
    const filePath = avatarPathForUser(userId, filename);
    removeExistingAvatarFiles(userId, filename);
    if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, encoded, { flag: 'wx' });
    userModel.setAvatarPath(userId, filename);
    return userModel.getById(userId);
  },

  removeAvatar(userId) {
    removeExistingAvatarFiles(userId);
    return userModel.setAvatarPath(userId, null);
  },

  resolveAvatarFile(userId) {
    const user = userModel.getById(userId);
    if (!user?.avatar_path) return null;
    const root = path.resolve(config.profile.avatarRoot);
    const filePath = path.resolve(root, path.basename(user.avatar_path));
    if (path.relative(root, filePath).startsWith('..') || !fs.existsSync(filePath)) return null;
    return filePath;
  },

  mfaBeginEnrollment(userId) {
    const user = userModel.getByUsernameById(userId);
    if (!user) throwUserNotFound();

    const secret = totp.generateSecret();
    const encrypted = credentialVaultService.sealSecret(secret);
    credentialVaultService.deleteSealedSecret(user.mfa_secret_encrypted);
    userModel.setMfaSecret(userId, encrypted);

    return {
      secret,
      otpAuthUri: totp.buildOtpAuthUri({ secret, accountName: user.username }),
    };
  },

  mfaConfirmEnrollment(userId, token) {
    const user = userModel.getByUsernameById(userId);
    if (!user?.mfa_secret_encrypted) {
      const error = new Error('MFA_ENROLLMENT_NOT_STARTED');
      error.code = 'MFA_ENROLLMENT_NOT_STARTED';
      throw error;
    }

    const secret = decryptMfaSecret(user.mfa_secret_encrypted);
    if (!totp.verifyToken(secret, token)) {
      const error = new Error('MFA_TOKEN_INVALID');
      error.code = 'MFA_TOKEN_INVALID';
      throw error;
    }

    return userModel.setMfaEnabled(userId, true);
  },

  mfaDisable(userId, currentPassword) {
    const existing = userModel.getByUsernameById(userId);
    if (!existing) throwUserNotFound();
    if (!bcrypt.compareSync(String(currentPassword || ''), existing.password_hash)) {
      const error = new Error('CURRENT_PASSWORD_INCORRECT');
      error.code = 'CURRENT_PASSWORD_INCORRECT';
      throw error;
    }
    credentialVaultService.deleteSealedSecret(existing.mfa_secret_encrypted);
    return userModel.setMfaEnabled(userId, false);
  },

  verifyMfaToken(userId, token) {
    const user = userModel.getByUsernameById(userId);
    if (!user?.mfa_enabled || !user.mfa_secret_encrypted) return false;
    const secret = decryptMfaSecret(user.mfa_secret_encrypted);
    return totp.verifyToken(secret, token);
  },

  listPushSubscriptions(userId) {
    return pushSubscriptionModel.listForUser(userId);
  },

  subscribePush(userId, { endpoint, keys, notifyAlerts, notifyApprovals, notifyCatalog } = {}) {
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      const error = new Error('INVALID_PUSH_SUBSCRIPTION');
      error.code = 'INVALID_PUSH_SUBSCRIPTION';
      throw error;
    }
    return pushSubscriptionModel.upsert({ userId, endpoint, keys, notifyAlerts, notifyApprovals, notifyCatalog });
  },

  unsubscribePush(userId, endpoint) {
    return pushSubscriptionModel.removeForUser(userId, endpoint);
  },
};

module.exports = profileService;
