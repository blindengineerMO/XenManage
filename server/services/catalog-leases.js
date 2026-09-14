// Background worker that expires due catalog deployment leases. Started from
// server/index.js (60s interval, unref'd). Marks due rows expired, writes an
// audit entry, and web-pushes the requester (category 'catalog'). Does not
// destroy VMs — operators decommission from the catalog UI. processDueLeases()
// is re-entrancy guarded; call start() once at boot.
const { catalogModel } = require('../models/connection');
const auditLogService = require('./audit-log');
const logger = require('./logger');
const webPushService = require('./web-push');

let schedulerTimer = null;
let processing = false;

function processDueLeases() {
  if (processing) return [];
  processing = true;
  try {
    const expired = catalogModel.expireDueLeases();
    expired.forEach((request) => auditLogService.record({
      category: 'catalog', action: 'catalog_lease_expired', actionLabel: 'Expired catalog deployment lease',
      entityType: 'catalog_request', entityRef: request.id, entityName: request.generated_name || request.title,
      operator: 'system', route: '/catalog', before: { status: 'complete' }, after: { status: 'expired' },
    }));
    expired.forEach((request) => {
      if (request.requested_by) webPushService.notifyUser(request.requested_by, { title: 'Catalog lease expired', body: `${request.generated_name || request.title} is ready for decommissioning.`, url: '/catalog' }, 'catalog').catch(() => {});
    });
    return expired;
  } finally {
    processing = false;
  }
}

function start() {
  stop();
  setImmediate(() => {
    try { processDueLeases(); } catch (error) { logger.error('catalog_lease_worker_failed', { error }); }
  });
  schedulerTimer = setInterval(() => {
    try { processDueLeases(); } catch (error) { logger.error('catalog_lease_worker_failed', { error }); }
  }, 60000);
  if (typeof schedulerTimer.unref === 'function') schedulerTimer.unref();
}

function stop() {
  if (schedulerTimer) clearInterval(schedulerTimer);
  schedulerTimer = null;
}

module.exports = { processDueLeases, start, stop };
