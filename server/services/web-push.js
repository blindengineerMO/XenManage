const webpush = require('web-push');
const config = require('../config');
const { pushSubscriptionModel } = require('../models/security-db');

let configured = false;

function ensureConfigured() {
  if (configured) return true;
  if (!config.webPush.publicKey || !config.webPush.privateKey) return false;

  webpush.setVapidDetails(config.webPush.subject, config.webPush.publicKey, config.webPush.privateKey);
  configured = true;
  return true;
}

function isConfigured() {
  return Boolean(config.webPush.publicKey && config.webPush.privateKey);
}

async function sendToSubscription(subscription, payload) {
  if (!ensureConfigured()) {
    const error = new Error('WEB_PUSH_NOT_CONFIGURED');
    error.code = 'WEB_PUSH_NOT_CONFIGURED';
    throw error;
  }

  try {
    await webpush.sendNotification(
      { endpoint: subscription.endpoint, keys: subscription.keys },
      JSON.stringify(payload)
    );
    return true;
  } catch (error) {
    if (error.statusCode === 404 || error.statusCode === 410) {
      pushSubscriptionModel.removeForUser(subscription.user_id, subscription.endpoint);
    }
    throw error;
  }
}

async function notifyUser(userId, payload, category = 'alerts') {
  if (!ensureConfigured()) return { sent: 0, failed: 0 };

  const columnByCategory = {
    alerts: 'notify_alerts',
    approvals: 'notify_approvals',
    catalog: 'notify_catalog',
  };
  const column = columnByCategory[category] || 'notify_alerts';

  const subscriptions = pushSubscriptionModel.listForUser(userId).filter((sub) => sub[column]);
  let sent = 0;
  let failed = 0;

  for (const subscription of subscriptions) {
    try {
      await sendToSubscription(subscription, payload);
      sent += 1;
    } catch (_) {
      failed += 1;
    }
  }

  return { sent, failed };
}

async function notifyAll(payload, category = 'alerts') {
  if (!ensureConfigured()) return { sent: 0, failed: 0 };
  const column = { alerts: 'notify_alerts', approvals: 'notify_approvals', catalog: 'notify_catalog' }[category] || 'notify_alerts';
  const subscriptions = pushSubscriptionModel.listAll().filter((subscription) => subscription[column]);
  const results = await Promise.allSettled(subscriptions.map((subscription) => sendToSubscription(subscription, payload)));
  return { sent: results.filter((result) => result.status === 'fulfilled').length, failed: results.filter((result) => result.status === 'rejected').length };
}

module.exports = { isConfigured, notifyUser, notifyAll, sendToSubscription };
