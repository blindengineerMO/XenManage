const express = require('express');
const { catalogModel, templateLibraryModel, deploymentRunModel } = require('../models/connection');
const { catalogRoleModel } = require('../models/security-db');
const {
  validateNamingPattern,
  renderGeneratedName,
  normalizeSubscriberFields,
  validateRequestParameters,
  normalizeApprovalPolicy,
  shouldAutoApprove,
  normalizeLeaseDuration,
  normalizeCostRates,
  estimateCatalogCost,
  normalizeTargetPoolRefs,
} = require('../services/catalog');
const { requireCatalogRole } = require('../services/catalog-roles');
const auditLogService = require('../services/audit-log');
const catalogApprovalHooks = require('../services/catalog-approval-hooks');
const credentialVaultService = require('../services/credential-vault');
const webPushService = require('../services/web-push');
const { requireXenConnection } = require('./auth');
const { enforceVFabricQuotas } = require('../services/vfabric-quota');
const { enforcePoolQuota } = require('../services/pool-quota');
const { deployTemplate } = require('../services/template-deployment');
const { executeCompose } = require('../services/deployment-engine');
const {
  buildCatalogTemplateDeployment,
  buildCatalogComposeDeployment,
  buildCatalogGuestScriptDeployment,
} = require('../services/catalog-deployment');

const router = express.Router();
const requireCatalogAdmin = requireCatalogRole('admin');
const requireCatalogSubscriber = requireCatalogRole('subscriber');
const requireCatalogViewer = requireCatalogRole('viewer');
function notifyCatalogOwner(request, title, body) {
  if (!request?.requested_by) return;
  webPushService.notifyUser(request.requested_by, { title, body, url: '/catalog' }, 'catalog').catch(() => {});
}
function validateSource(body) {
  const sourceItemId = Number(body.sourceItemId || 0);
  const source = sourceItemId ? templateLibraryModel.getItemById(sourceItemId) : null;
  if (!source || !['deployment-template', 'guest-script', 'snippet'].includes(source.kind)) return null;
  return source;
}
function validateImageUrl(value) {
  const imageUrl = String(value || '').trim();
  if (!imageUrl) return '';
  try {
    const parsed = new URL(imageUrl);
    return parsed.protocol === 'https:' ? imageUrl : null;
  } catch (_error) {
    return null;
  }
}
function validateApprovalPolicy(policy) {
  if (policy.mode !== 'webhook') return null;
  if (!catalogApprovalHooks.allowedHookUrl(policy.url)) return 'CATALOG_APPROVAL_HOOK_URL_DENIED';
  if (!credentialVaultService.validateSharedIntegrationCredential(policy.credentialId, 'webhook')) return 'CATALOG_APPROVAL_HOOK_CREDENTIAL_INVALID';
  return null;
}
router.get('/', (_req, res) => res.json({ entries: catalogModel.listPublished() }));
router.get('/admin/entries', requireCatalogAdmin, (_req, res) => {
  res.json({ entries: catalogModel.listAll() });
});
router.get('/admin/entries/:id/versions', requireCatalogAdmin, (req, res) => {
  const entry = catalogModel.getById(Number(req.params.id));
  if (!entry) return res.status(404).json({ error: 'CATALOG_ENTRY_NOT_FOUND' });
  res.json({ versions: catalogModel.listVersions(entry.id) });
});
router.put('/admin/entries/:id/versions/:versionId/validation', requireCatalogAdmin, (req, res) => {
  const validationStatus = String(req.body?.validationStatus || '').trim().toLowerCase();
  if (!['untested', 'validated', 'failed'].includes(validationStatus)) return res.status(400).json({ error: 'CATALOG_VERSION_VALIDATION_INVALID' });
  const version = catalogModel.validateVersion(Number(req.params.id), Number(req.params.versionId), validationStatus, String(req.body?.notes || '').slice(0, 2000), req.session.userId);
  if (!version) return res.status(404).json({ error: 'CATALOG_VERSION_NOT_CURRENT' });
  auditLogService.record({
    category: 'catalog', action: 'catalog_version_validated', actionLabel: 'Validated catalog version',
    entityType: 'catalog_entry', entityRef: req.params.id, entityName: `v${version.version_number}`,
    operator: req.session.appUsername || 'system', route: '/applications', after: { validationStatus, notes: version.validation_notes },
    status: validationStatus === 'failed' ? 'failure' : 'success',
  });
  res.json({ version });
});
router.post('/admin/entries/:id/publish', requireCatalogAdmin, (req, res) => {
  try {
    const entry = catalogModel.publishVersion(Number(req.params.id), req.session.userId);
    if (!entry) return res.status(404).json({ error: 'CATALOG_ENTRY_NOT_FOUND' });
    auditLogService.record({
      category: 'catalog', action: 'catalog_version_published', actionLabel: 'Published catalog version',
      entityType: 'catalog_entry', entityRef: entry.id, entityName: entry.title,
      operator: req.session.appUsername || 'system', route: '/applications', after: { version: entry.currentVersion?.version_number, visibility: 'published' },
    });
    res.json({ entry });
  } catch (error) {
    if (error.code === 'CATALOG_VERSION_VALIDATION_REQUIRED') return res.status(409).json({ error: error.code });
    throw error;
  }
});
router.get('/admin/requests', requireCatalogAdmin, (_req, res) => {
  res.json({ requests: catalogModel.listRequests() });
});
router.get('/admin/analytics', requireCatalogAdmin, (_req, res) => {
  res.json(catalogModel.getAnalytics());
});
router.get('/admin/requests/:id/hook-attempts', requireCatalogAdmin, (req, res) => {
  res.json({ attempts: catalogModel.listHookAttempts(Number(req.params.id)) });
});
router.get('/admin/roles', requireCatalogAdmin, (_req, res) => {
  res.json({ roles: catalogRoleModel.list() });
});
router.put('/admin/roles/:userId', requireCatalogAdmin, (req, res) => {
  const userId = Number(req.params.userId);
  if (!Number.isInteger(userId) || userId < 1) return res.status(400).json({ error: 'USER_NOT_FOUND' });
  try {
    const role = catalogRoleModel.set(userId, req.body?.role, req.session.userId);
    auditLogService.record({
      category: 'catalog', action: 'catalog_role_granted', actionLabel: 'Assigned catalog role',
      entityType: 'catalog_role', entityRef: String(userId), entityName: role.role,
      operator: req.session.appUsername || 'system', route: '/applications', after: role,
    });
    res.json({ role });
  } catch (error) {
    res.status(error.code === 'USER_NOT_FOUND' ? 404 : 400).json({ error: error.code || 'CATALOG_ROLE_UPDATE_FAILED' });
  }
});
router.put('/admin/requests/:id', requireCatalogAdmin, (req, res) => {
  const status = String(req.body?.status || '');
  if (!['approved', 'rejected', 'cancelled'].includes(status)) return res.status(400).json({ error: 'CATALOG_REQUEST_STATUS_INVALID' });
  const existing = catalogModel.listRequests().find((request) => request.id === Number(req.params.id));
  if (!existing) return res.status(404).json({ error: 'CATALOG_REQUEST_NOT_FOUND' });
  if (existing.status !== 'pending') return res.status(409).json({ error: 'CATALOG_REQUEST_NOT_PENDING' });
  let review;
  try {
    review = status === 'cancelled'
      ? { request: catalogModel.decideRequest(existing.id, status, req.session.userId), approvalStep: null, chainComplete: true }
      : catalogModel.reviewRequest(existing.id, status, req.session.userId, renderGeneratedName);
  } catch (error) {
    if (error.code === 'CATALOG_APPROVER_SEPARATION_REQUIRED') {
      return res.status(409).json({ error: error.code });
    }
    throw error;
  }
  const request = review?.request;
  if (!request) return res.status(409).json({ error: 'CATALOG_REQUEST_NOT_PENDING' });
  auditLogService.record({
    category: 'catalog', action: 'catalog_request_reviewed', actionLabel: 'Reviewed catalog request',
    entityType: 'catalog_request', entityRef: request.id, entityName: existing.title,
    operator: req.session.appUsername || 'system', route: '/catalog',
    before: { status: existing.status },
    after: {
      status: request.status,
      generatedName: request.generated_name,
      approvalStep: review.approvalStep?.label || null,
      chainComplete: review.chainComplete,
    },
  });
  if (request.status !== 'pending') notifyCatalogOwner(request, 'Catalog request updated', `${existing.title}: ${request.status}`);
  res.json({ request: { ...request, approvalSteps: catalogModel.listApprovalSteps(request.id) } });
});
router.post('/admin/requests/:id/deploy', requireCatalogAdmin, requireXenConnection, async (req, res) => {
  const request = catalogModel.beginDeployment(Number(req.params.id));
  if (!request) return res.status(409).json({ error: 'CATALOG_REQUEST_NOT_APPROVED' });
  try {
    const entry = catalogModel.getById(request.catalog_entry_id);
    const source = entry ? templateLibraryModel.getItemById(entry.source_item_id) : null;
    let deployment;
    if (source?.kind === 'deployment-template') {
      const deploymentInput = buildCatalogTemplateDeployment(entry, request, source);
      await enforceVFabricQuotas(req, deploymentInput.payload);
      await enforcePoolQuota(req.xenApi, deploymentInput.payload, { requireResolvedTarget: true, autoSelect: !deploymentInput.payload.hostRef, eligiblePoolRefs: entry.targetPoolRefs });
      deployment = await deployTemplate({
        xenApi: req.xenApi,
        templateRef: deploymentInput.templateRef,
        payload: deploymentInput.payload,
        submittedBy: request.requested_by_name || '',
        auditOperator: req.session.appUsername || 'system',
        route: '/catalog',
      });
    } else if (source?.kind === 'snippet') {
      const spec = buildCatalogComposeDeployment(entry, request, source);
      const composeResult = await executeCompose(req.xenApi, spec, {
        submittedBy: request.requested_by_name || '',
        beforeDeploy: async (plan) => {
          const requestedVm = { hostRef: plan.affinityRef, startAfter: plan.startAfter, memoryStaticMax: plan.memoryStaticMax };
          await enforceVFabricQuotas(req, requestedVm);
          const quotaResult = await enforcePoolQuota(req.xenApi, requestedVm, { requireResolvedTarget: true, autoSelect: !requestedVm.hostRef, eligiblePoolRefs: entry.targetPoolRefs });
          if (!plan.affinityRef && quotaResult?.selectedHostRef) plan.affinityRef = quotaResult.selectedHostRef;
        },
      });
      deployment = { ...composeResult.run, failed: composeResult.failed };
    } else if (source?.kind === 'guest-script') {
      const deploymentInput = buildCatalogGuestScriptDeployment(entry, request, source);
      await enforceVFabricQuotas(req, deploymentInput.payload);
      await enforcePoolQuota(req.xenApi, deploymentInput.payload, { requireResolvedTarget: true, autoSelect: !deploymentInput.payload.hostRef, eligiblePoolRefs: entry.targetPoolRefs });
      deployment = await deployTemplate({
        xenApi: req.xenApi,
        templateRef: deploymentInput.templateRef,
        payload: deploymentInput.payload,
        submittedBy: request.requested_by_name || '',
        auditOperator: req.session.appUsername || 'system',
        route: '/catalog',
      });
    } else {
      const error = new Error('CATALOG_SOURCE_NOT_DEPLOYABLE');
      error.code = 'CATALOG_SOURCE_NOT_DEPLOYABLE';
      error.status = 400;
      throw error;
    }
    const deploymentRunId = deployment.deploymentRun?.id || deployment.deploymentRun?.ref || deployment.id || deployment.ref || '';
    if (deploymentRunId) deploymentRunModel.linkCatalogRequest(deploymentRunId, request.id);
    const completed = catalogModel.finishDeployment(request.id, deployment.failed ? 'failed' : 'complete', deploymentRunId);
    auditLogService.record({
      category: 'catalog', action: 'catalog_request_deployed', actionLabel: 'Deployed catalog request',
      entityType: 'catalog_request', entityRef: request.id, entityName: entry.title,
      operator: req.session.appUsername || 'system', route: '/catalog',
      before: { status: 'approved' }, after: { status: completed.status, deploymentRunId: completed.deployment_run_id },
    });
    notifyCatalogOwner(completed, 'Catalog deployment updated', `${entry.title}: ${completed.status}`);
    return res.status(deployment.failed ? 207 : 201).json({ request: completed, deployment });
  } catch (error) {
    const failed = catalogModel.finishDeployment(request.id, 'failed');
    auditLogService.record({
      category: 'catalog', action: 'catalog_request_deployment_failed', actionLabel: 'Catalog request deployment failed',
      entityType: 'catalog_request', entityRef: request.id, operator: req.session.appUsername || 'system', route: '/catalog',
      before: { status: 'deploying' }, after: { status: failed.status }, detail: error.message || String(error), status: 'failure',
    });
    notifyCatalogOwner(failed, 'Catalog deployment failed', 'The application could not be deployed.');
    return res.status(error.status || 500).json({ error: error.code || 'CATALOG_DEPLOY_FAILED', message: error.message });
  }
});
router.post('/:slug/requests', requireCatalogSubscriber, (req, res) => {
  const entry = catalogModel.getPublishedBySlug(String(req.params.slug || '').trim());
  if (!entry) return res.status(404).json({ error: 'CATALOG_ENTRY_NOT_FOUND' });
  const parameters = req.body?.parameters;
  if (parameters !== undefined && (!parameters || typeof parameters !== 'object' || Array.isArray(parameters))) {
    return res.status(400).json({ error: 'CATALOG_PARAMETERS_INVALID' });
  }
  let resolvedParameters;
  try { resolvedParameters = validateRequestParameters(entry.subscriberFields || [], parameters || {}); } catch (error) { return res.status(400).json({ error: error.code }); }
  if (entry.maxActivePerSubscriber && catalogModel.countActiveRequestsForUser(entry.id, req.session.userId) >= entry.maxActivePerSubscriber) {
    return res.status(409).json({ error: 'CATALOG_REQUEST_QUOTA_EXCEEDED' });
  }
  let estimate;
  try { estimate = estimateCatalogCost(catalogModel.getById(entry.id), resolvedParameters); } catch (error) { return res.status(400).json({ error: error.code }); }
  const submitted = catalogModel.createRequest(entry.id, req.session.userId, req.session.appUsername, resolvedParameters, entry.approvalPolicy, estimate);
  if (entry.approvalPolicy?.mode === 'webhook') {
    catalogModel.createHookAttempt(submitted.id);
    catalogApprovalHooks.wake();
  }
  const request = shouldAutoApprove(entry.approvalPolicy, resolvedParameters)
    ? catalogModel.approveRequestWithNextName(submitted.id, renderGeneratedName)
    : submitted;
  auditLogService.record({
    category: 'catalog', action: 'catalog_request_submitted', actionLabel: 'Submitted catalog request',
    entityType: 'catalog_request', entityRef: request.id, entityName: entry.title,
    operator: req.session.appUsername || 'system', route: '/catalog', after: { status: request.status, generatedName: request.generated_name },
  });
  res.status(201).json({ request });
});
router.get('/requests/mine', requireCatalogViewer, (req, res) => {
  res.json({ requests: catalogModel.listRequestsForUser(req.session.userId) });
});
router.post('/requests/:id/actions', requireCatalogViewer, requireXenConnection, async (req, res) => {
  const catalogRole = catalogRoleModel.getByUserId(req.session.userId)?.role;
  const requests = catalogRole === 'admin' ? catalogModel.listRequests() : catalogModel.listRequestsForUser(req.session.userId);
  const request = requests.find((entry) => entry.id === Number(req.params.id));
  if (!request) return res.status(404).json({ error: 'CATALOG_REQUEST_NOT_FOUND' });
  const action = String(req.body?.action || '').trim().toLowerCase();
  if (request.status !== 'complete' && !(request.status === 'expired' && action === 'decommission')) {
    return res.status(409).json({ error: 'CATALOG_DEPLOYMENT_NOT_ACTIVE' });
  }
  const run = deploymentRunModel.getByCatalogRequestId(request.id);
  if (!run?.vm_ref) return res.status(409).json({ error: 'CATALOG_DEPLOYMENT_VM_NOT_FOUND' });
  try {
    let result = { success: true };
    if (action === 'start') await req.xenApi.startVM(run.vm_ref, false, false);
    else if (action === 'stop') await req.xenApi.shutdownVM(run.vm_ref, Boolean(req.body?.force));
    else if (action === 'reboot') await req.xenApi.rebootVM(run.vm_ref, Boolean(req.body?.force));
    else if (action === 'snapshot') result = await req.xenApi.createVMSnapshot(run.vm_ref, { nameLabel: String(req.body?.nameLabel || `${request.generated_name}-snapshot`).slice(0, 120), mode: 'snapshot' });
    else if (action === 'resize') {
      const vcpus = Number(req.body?.vcpus);
      const memoryGiB = Number(req.body?.memoryGiB);
      if (!Number.isInteger(vcpus) || vcpus < 1 || vcpus > 256 || !Number.isFinite(memoryGiB) || memoryGiB < 0.25 || memoryGiB > 4096) return res.status(400).json({ error: 'CATALOG_RESIZE_INVALID' });
      const memoryBytes = Math.round(memoryGiB * 1024 * 1024 * 1024);
      await req.xenApi.setField('VM', run.vm_ref, 'VCPUs_max', String(vcpus));
      await req.xenApi.setField('VM', run.vm_ref, 'VCPUs_at_startup', String(vcpus));
      await req.xenApi.call('VM', 'set_memory_limits', [run.vm_ref, String(memoryBytes), String(memoryBytes), String(memoryBytes), String(memoryBytes)]);
      result = { success: true, vcpus, memoryGiB };
    } else if (action === 'decommission') {
      await req.xenApi.destroy('VM', run.vm_ref);
      catalogModel.updateRequestStatus(request.id, 'reclaimed');
    } else return res.status(400).json({ error: 'CATALOG_DAY2_ACTION_INVALID' });
    auditLogService.record({
      category: 'catalog', action: `catalog_vm_${action}`, actionLabel: `Catalog VM ${action}`,
      entityType: 'vm', entityRef: run.vm_ref, entityName: request.generated_name,
      operator: req.session.appUsername || 'system', route: '/catalog', after: result,
    });
    return res.json({ action, vmRef: run.vm_ref, result, request: catalogModel.listRequests().find((entry) => entry.id === request.id) });
  } catch (error) {
    return res.status(500).json({ error: error.code || error.message || 'CATALOG_DAY2_ACTION_FAILED' });
  }
});
router.post('/requests/:id/cancel', requireCatalogSubscriber, (req, res) => {
  const request = catalogModel.listRequestsForUser(req.session.userId).find((entry) => entry.id === Number(req.params.id));
  if (!request) return res.status(404).json({ error: 'CATALOG_REQUEST_NOT_FOUND' });
  if (request.status !== 'pending') return res.status(409).json({ error: 'CATALOG_REQUEST_NOT_PENDING' });
  const cancelled = catalogModel.updateRequestStatus(request.id, 'cancelled');
  auditLogService.record({
    category: 'catalog', action: 'catalog_request_cancelled', actionLabel: 'Cancelled catalog request',
    entityType: 'catalog_request', entityRef: request.id, entityName: request.title,
    operator: req.session.appUsername || 'system', route: '/catalog',
    before: { status: request.status }, after: { status: cancelled.status },
  });
  res.json({ request: cancelled });
});
router.get('/:slug', (req, res) => {
  const entry = catalogModel.getPublishedBySlug(String(req.params.slug || '').trim());
  if (!entry) return res.status(404).json({ error: 'CATALOG_ENTRY_NOT_FOUND' });
  const { approvalPolicy: _approvalPolicy, ...publicEntry } = entry;
  res.json({ entry: publicEntry });
});
router.post('/', requireCatalogAdmin, (req, res) => {
  const body = req.body || {};
  if (body.visibility === 'published') return res.status(409).json({ error: 'CATALOG_VERSION_VALIDATION_REQUIRED' });
  const slug = String(body.slug || '').trim().toLowerCase();
  const title = String(body.title || '').trim();
  if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(slug) || !title) return res.status(400).json({ error: 'CATALOG_ENTRY_INVALID' });
  let namingPattern;
  try { namingPattern = validateNamingPattern(body.namingPattern || 'NODE-XXXX'); } catch (error) { return res.status(400).json({ error: error.code }); }
  let subscriberFields;
  try { subscriberFields = body.subscriberFields === undefined ? [] : normalizeSubscriberFields(body.subscriberFields); } catch (error) { return res.status(400).json({ error: error.code }); }
  const fixedVariables = body.fixedVariables;
  if (fixedVariables !== undefined && (!fixedVariables || typeof fixedVariables !== 'object' || Array.isArray(fixedVariables))) {
    return res.status(400).json({ error: 'CATALOG_FIXED_VARIABLES_INVALID' });
  }
  const imageUrl = body.imageUrl === undefined ? undefined : validateImageUrl(body.imageUrl);
  if (imageUrl === null) return res.status(400).json({ error: 'CATALOG_IMAGE_URL_INVALID' });
  const hasMaxActivePerSubscriber = Object.prototype.hasOwnProperty.call(body, 'maxActivePerSubscriber');
  const maxActivePerSubscriber = !hasMaxActivePerSubscriber || body.maxActivePerSubscriber === null || body.maxActivePerSubscriber === ''
    ? null : Number(body.maxActivePerSubscriber);
  if (maxActivePerSubscriber !== null && (!Number.isInteger(maxActivePerSubscriber) || maxActivePerSubscriber < 1 || maxActivePerSubscriber > 10000)) {
    return res.status(400).json({ error: 'CATALOG_REQUEST_QUOTA_INVALID' });
  }
  let leaseDurationHours;
  try { leaseDurationHours = normalizeLeaseDuration(body.leaseDurationHours); } catch (error) { return res.status(400).json({ error: error.code }); }
  let costRates;
  try { costRates = normalizeCostRates(body.costRates); } catch (error) { return res.status(400).json({ error: error.code }); }
  let targetPoolRefs;
  try { targetPoolRefs = normalizeTargetPoolRefs(body.targetPoolRefs); } catch (error) { return res.status(400).json({ error: error.code }); }
  const source = validateSource(body);
  if (!source) return res.status(400).json({ error: 'CATALOG_SOURCE_INVALID' });
  let approvalPolicy;
  try { approvalPolicy = normalizeApprovalPolicy(body.approvalPolicy, body.requiresApproval !== false); } catch (error) { return res.status(400).json({ error: error.code }); }
  const approvalPolicyError = validateApprovalPolicy(approvalPolicy);
  if (approvalPolicyError) return res.status(400).json({ error: approvalPolicyError });
  try {
    const entry = catalogModel.create({ ...body, visibility: 'draft', slug, title, imageUrl: imageUrl || '', namingPattern, subscriberFields, fixedVariables: fixedVariables || {}, maxActivePerSubscriber, leaseDurationHours, costRates, targetPoolRefs, requiresApproval: approvalPolicy.mode !== 'auto', approvalPolicy, sourceItemId: source.id, sourceKind: source.kind, ownerUserId: req.session.userId });
    auditLogService.record({
      category: 'catalog', action: 'catalog_entry_created', actionLabel: 'Created catalog entry',
      entityType: 'catalog_entry', entityRef: entry.id, entityName: entry.title,
      operator: req.session.appUsername || 'system', route: '/applications', after: entry,
    });
    res.status(201).json({ entry });
  } catch (_error) {
    res.status(409).json({ error: 'CATALOG_ENTRY_CONFLICT' });
  }
});
router.put('/:id', requireCatalogAdmin, (req, res) => {
  const body = req.body || {};
  if (body.visibility === 'published') return res.status(409).json({ error: 'CATALOG_VERSION_VALIDATION_REQUIRED' });
  const slug = String(body.slug || '').trim().toLowerCase();
  const title = String(body.title || '').trim();
  if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(slug) || !title) return res.status(400).json({ error: 'CATALOG_ENTRY_INVALID' });
  let namingPattern;
  try { namingPattern = validateNamingPattern(body.namingPattern || 'NODE-XXXX'); } catch (error) { return res.status(400).json({ error: error.code }); }
  let subscriberFields;
  try { subscriberFields = body.subscriberFields === undefined ? null : normalizeSubscriberFields(body.subscriberFields); } catch (error) { return res.status(400).json({ error: error.code }); }
  const fixedVariables = body.fixedVariables;
  if (fixedVariables !== undefined && (!fixedVariables || typeof fixedVariables !== 'object' || Array.isArray(fixedVariables))) {
    return res.status(400).json({ error: 'CATALOG_FIXED_VARIABLES_INVALID' });
  }
  const imageUrl = body.imageUrl === undefined ? undefined : validateImageUrl(body.imageUrl);
  if (imageUrl === null) return res.status(400).json({ error: 'CATALOG_IMAGE_URL_INVALID' });
  const hasMaxActivePerSubscriber = Object.prototype.hasOwnProperty.call(body, 'maxActivePerSubscriber');
  const maxActivePerSubscriber = !hasMaxActivePerSubscriber || body.maxActivePerSubscriber === null || body.maxActivePerSubscriber === ''
    ? null : Number(body.maxActivePerSubscriber);
  if (maxActivePerSubscriber !== null && (!Number.isInteger(maxActivePerSubscriber) || maxActivePerSubscriber < 1 || maxActivePerSubscriber > 10000)) {
    return res.status(400).json({ error: 'CATALOG_REQUEST_QUOTA_INVALID' });
  }
  let leaseDurationHours;
  try { leaseDurationHours = normalizeLeaseDuration(body.leaseDurationHours); } catch (error) { return res.status(400).json({ error: error.code }); }
  let costRates;
  try { costRates = normalizeCostRates(body.costRates); } catch (error) { return res.status(400).json({ error: error.code }); }
  let targetPoolRefs;
  try { targetPoolRefs = normalizeTargetPoolRefs(body.targetPoolRefs); } catch (error) { return res.status(400).json({ error: error.code }); }
  const source = validateSource(body);
  if (!source) return res.status(400).json({ error: 'CATALOG_SOURCE_INVALID' });
  const previous = catalogModel.listAll().find((entry) => entry.id === Number(req.params.id));
  let approvalPolicy;
  try { approvalPolicy = normalizeApprovalPolicy(body.approvalPolicy === undefined ? previous?.approvalPolicy : body.approvalPolicy, body.requiresApproval === undefined ? previous?.requiresApproval !== false : body.requiresApproval !== false); } catch (error) { return res.status(400).json({ error: error.code }); }
  const approvalPolicyError = validateApprovalPolicy(approvalPolicy);
  if (approvalPolicyError) return res.status(400).json({ error: approvalPolicyError });
  try {
    const entry = catalogModel.update(Number(req.params.id), {
      ...body,
      visibility: 'draft',
      slug,
      title,
      imageUrl: imageUrl === undefined ? previous?.image_url || '' : imageUrl,
      namingPattern,
      subscriberFields: subscriberFields || previous?.subscriberFields || [],
      fixedVariables: fixedVariables === undefined ? previous?.fixedVariables || {} : fixedVariables,
      maxActivePerSubscriber: hasMaxActivePerSubscriber ? maxActivePerSubscriber : previous?.maxActivePerSubscriber || null,
      leaseDurationHours,
      costRates,
      targetPoolRefs,
      requiresApproval: approvalPolicy.mode !== 'auto', approvalPolicy,
      sourceItemId: source.id,
      sourceKind: source.kind,
      ownerUserId: req.session.userId,
    });
    if (!entry) return res.status(404).json({ error: 'CATALOG_ENTRY_NOT_FOUND' });
    auditLogService.record({
      category: 'catalog', action: 'catalog_entry_updated', actionLabel: 'Updated catalog entry',
      entityType: 'catalog_entry', entityRef: entry.id, entityName: entry.title,
      operator: req.session.appUsername || 'system', route: '/applications', before: previous, after: entry,
    });
    res.json({ entry });
  } catch (_error) {
    res.status(409).json({ error: 'CATALOG_ENTRY_CONFLICT' });
  }
});
router.delete('/:id', requireCatalogAdmin, (req, res) => {
  const entry = catalogModel.listAll().find((candidate) => candidate.id === Number(req.params.id));
  if (!entry || !catalogModel.delete(entry.id)) return res.status(404).json({ error: 'CATALOG_ENTRY_NOT_FOUND' });
  auditLogService.record({
    category: 'catalog', action: 'catalog_entry_deleted', actionLabel: 'Deleted catalog entry',
    entityType: 'catalog_entry', entityRef: entry.id, entityName: entry.title,
    operator: req.session.appUsername || 'system', route: '/applications', before: entry,
  });
  res.json({ success: true });
});
module.exports = router;
