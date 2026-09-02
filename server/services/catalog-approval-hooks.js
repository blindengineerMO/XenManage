const config = require('../config');
const { catalogModel } = require('../models/connection');
const credentialVaultService = require('./credential-vault');
const auditLogService = require('./audit-log');
const logger = require('./logger');
const { renderGeneratedName } = require('./catalog');

let schedulerTimer = null;
let processing = false;

function allowedHookUrl(value) {
  try {
    const url = new URL(String(value || ''));
    const host = url.hostname.toLowerCase();
    const allowed = config.catalog.approvalHookAllowlist.some((entry) => (
      entry.startsWith('*.') ? host.endsWith(entry.slice(1)) : host === entry
    ));
    return url.protocol === 'https:' && !url.username && !url.password && allowed ? url : null;
  } catch (_error) { return null; }
}

function retryDelay(attempt) { return Math.min(3600, 30 * (2 ** Math.max(0, attempt - 1))); }

async function deliverHook({ url, token, payload }) {
  const target = allowedHookUrl(url);
  if (!target) return { error: 'CATALOG_APPROVAL_HOOK_URL_DENIED' };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.catalog.approvalHookTimeoutMs);
  try {
    const response = await fetch(target, { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, 'x-xenmange-idempotency-key': `catalog-request-${payload.requestId}` }, body: JSON.stringify(payload), signal: controller.signal });
    const text = (await response.text()).slice(0, 2000);
    let decision = 'pending';
    try { decision = String(JSON.parse(text).decision || 'pending').toLowerCase(); } catch (_error) { /* fail closed */ }
    return { code: response.status, body: text, decision: response.ok && ['approved', 'rejected'].includes(decision) ? decision : 'pending' };
  } catch (error) { return { error: error.name === 'AbortError' ? 'CATALOG_APPROVAL_HOOK_TIMEOUT' : 'CATALOG_APPROVAL_HOOK_FAILED' }; } finally { clearTimeout(timer); }
}

function recordAttempt(attempt, status, detail) {
  auditLogService.record({
    category: 'catalog', action: 'catalog_approval_hook_processed', actionLabel: 'Processed catalog approval hook',
    entityType: 'catalog_request', entityRef: attempt.catalog_request_id, entityName: attempt.title,
    operator: 'system', route: '/catalog', status, detail,
  });
}

async function processAttempt(attempt, dependencies = {}) {
  const claimed = catalogModel.claimHookAttempt(attempt.id);
  if (!claimed) return null;
  if (attempt.request_status !== 'pending') {
    return catalogModel.finishHookAttempt(attempt.id, { status: 'cancelled', error: 'CATALOG_REQUEST_NOT_PENDING' });
  }
  let policy;
  try { policy = JSON.parse(attempt.approval_policy_json || '{}'); } catch (_error) { policy = {}; }
  if (policy.mode !== 'webhook' || !allowedHookUrl(policy.url)) {
    recordAttempt(attempt, 'failure', 'Approval hook policy or destination was denied.');
    return catalogModel.finishHookAttempt(attempt.id, { status: 'failed', error: 'CATALOG_APPROVAL_HOOK_POLICY_INVALID' });
  }
  let result;
  try {
    const token = (dependencies.getSecret || credentialVaultService.getSharedIntegrationSecret.bind(credentialVaultService))(policy.credentialId, 'webhook');
    result = await (dependencies.deliver || deliverHook)({
      url: policy.url, token,
      payload: { requestId: attempt.catalog_request_id, catalogEntryId: attempt.catalog_entry_id, slug: attempt.slug, title: attempt.title, requestedBy: attempt.requested_by_name, parameters: JSON.parse(attempt.parameters_json || '{}') },
    });
  } catch (error) { result = { error: error.code || error.message || 'CATALOG_APPROVAL_HOOK_FAILED' }; }

  const decided = result.decision === 'approved'
    ? catalogModel.approveRequestWithNextName(attempt.catalog_request_id, renderGeneratedName)
    : result.decision === 'rejected'
      ? catalogModel.decideRequest(attempt.catalog_request_id, 'rejected', null)
      : null;
  if (['approved', 'rejected'].includes(result.decision)) {
    if (!decided) return catalogModel.finishHookAttempt(attempt.id, { status: 'cancelled', responseCode: result.code, responseBody: result.body, error: 'CATALOG_REQUEST_NOT_PENDING' });
    recordAttempt(attempt, 'success', `Approval hook decided ${result.decision}.`);
    return catalogModel.finishHookAttempt(attempt.id, { status: 'complete', responseCode: result.code, responseBody: result.body });
  }

  const exhausted = claimed.attempt_count >= config.catalog.approvalHookMaxAttempts;
  const status = exhausted ? 'failed' : 'pending';
  const error = result.error || 'CATALOG_APPROVAL_HOOK_DECISION_PENDING';
  recordAttempt(attempt, exhausted ? 'failure' : 'warning', exhausted ? `${error}; retries exhausted.` : `${error}; retry scheduled.`);
  return catalogModel.finishHookAttempt(attempt.id, {
    status, responseCode: result.code, responseBody: result.body, error,
    retryDelaySeconds: exhausted ? 0 : retryDelay(claimed.attempt_count),
  });
}

async function processDueAttempts(dependencies = {}) {
  if (processing) return [];
  processing = true;
  try {
    const results = [];
    for (const attempt of catalogModel.listDueHookAttempts()) results.push(await processAttempt(attempt, dependencies));
    return results;
  } finally { processing = false; }
}

function start() {
  stop();
  catalogModel.recoverProcessingHookAttempts();
  setImmediate(() => processDueAttempts().catch((error) => logger.error('catalog_approval_hook_worker_failed', { error })));
  schedulerTimer = setInterval(() => processDueAttempts().catch((error) => logger.error('catalog_approval_hook_worker_failed', { error })), 15000);
  if (typeof schedulerTimer.unref === 'function') schedulerTimer.unref();
}
function stop() { if (schedulerTimer) clearInterval(schedulerTimer); schedulerTimer = null; }
function wake() {
  setImmediate(() => processDueAttempts().catch((error) => logger.error('catalog_approval_hook_worker_failed', { error })));
}

module.exports = { allowedHookUrl, retryDelay, deliverHook, processAttempt, processDueAttempts, start, stop, wake };
