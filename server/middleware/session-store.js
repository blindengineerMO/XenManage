const session = require('express-session');
const { sessionStoreModel } = require('../models/security-db');

function getExpiryFromSession(sess = {}, fallbackMaxAge = 86400000) {
  const explicitExpiry = new Date(sess?.cookie?.expires || 0).getTime();
  if (Number.isFinite(explicitExpiry) && explicitExpiry > Date.now()) {
    return explicitExpiry;
  }

  const maxAge = Number(sess?.cookie?.originalMaxAge ?? sess?.cookie?.maxAge ?? fallbackMaxAge);
  return Date.now() + (Number.isFinite(maxAge) && maxAge > 0 ? maxAge : fallbackMaxAge);
}

class SqliteSessionStore extends session.Store {
  constructor(options = {}) {
    super();
    this.fallbackMaxAge = Number(options.fallbackMaxAge || 86400000);
  }

  get(sid, callback) {
    try {
      sessionStoreModel.purgeExpired();
      const row = sessionStoreModel.get(sid);
      if (!row || Number(row.expires_at || 0) <= Date.now()) {
        if (row) {
          sessionStoreModel.destroy(sid);
        }
        callback(null, null);
        return;
      }

      callback(null, JSON.parse(row.data));
    } catch (error) {
      callback(error);
    }
  }

  set(sid, sess, callback) {
    try {
      sessionStoreModel.set(sid, JSON.stringify(sess), getExpiryFromSession(sess, this.fallbackMaxAge));
      callback?.(null);
    } catch (error) {
      callback?.(error);
    }
  }

  destroy(sid, callback) {
    try {
      sessionStoreModel.destroy(sid);
      callback?.(null);
    } catch (error) {
      callback?.(error);
    }
  }

  touch(sid, sess, callback) {
    try {
      sessionStoreModel.touch(sid, getExpiryFromSession(sess, this.fallbackMaxAge));
      callback?.(null);
    } catch (error) {
      callback?.(error);
    }
  }
}

module.exports = { SqliteSessionStore, getExpiryFromSession };
