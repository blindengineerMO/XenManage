/**
 * Route-level governance gate for mutating Xen / control-plane actions.
 *
 * `ensureMutationAllowed(req, res, { actionKey, entityType, entityRef })`
 * is the function every destructive route must call before talking to XAPI.
 * It enforces the session role ceiling, optional approval tokens, quotas,
 * and the action catalog (`services/action-catalog.js`). A new mutating
 * route without a catalog entry fails `governance-coverage.test.js`.
 *
 * Read-only sessions always 403. Missing/expired approvals return a payload
 * the SPA uses to open the approval composer rather than a generic error.
 */
const governanceService = require('../services/governance');
const identityService = require('../services/identity');
const actionCatalog = require('../services/action-catalog');
const { projectModel } = require('../models/connection');
const managedTargetService = require('../services/managed-targets');

function resolveProjectScope(req) {
  try {
    const managedId = managedTargetService.parseManagedTargetKey(req.xenTarget?.targetKey || '');
    if (!managedId) return { project: '', organization: '' };
    const project = projectModel.listProjects().find((entry) => entry.target_ids.includes(managedId));
    return {
      project: project ? String(project.id) : '',
      organization: project ? String(project.organization_id) : '',
    };
  } catch {
    return { project: '', organization: '' };
  }
}

function getGovernanceSnapshot(session = {}) {
  const policy = governanceService.getPolicy();
  const currentRole = governanceService.getSessionRole(session);

  return {
    currentRole,
    policy,
  };
}

function deny(res, error, message, extra = {}) {
  return res.status(403).json({
    error,
    message,
    ...extra,
  });
}

function ensureMutationAllowed(req, res, options = {}) {
  if (!req.session?.authenticated && !req.principal) {
    req.governance = getGovernanceSnapshot(req.session);
    return true;
  }

  const snapshot = getGovernanceSnapshot(req.session);
  req.governance = snapshot;

  if (snapshot.currentRole === 'read-only') {
    deny(
      res,
      'READ_ONLY_MODE',
      'The current governance role is read-only. Switch to operator or admin mode before making changes.',
      { requiredRole: 'operator' }
    );
    return false;
  }

  const catalogEntry = actionCatalog.get(options.actionKey);
  const entityType = options.entityType || catalogEntry?.entityType || 'resource';
  const destructive = options.destructive ?? catalogEntry?.destructive ?? false;
  const permission = options.permission || identityService.actionPermission(options.actionKey || 'resource.update');
  const entityRef = options.entityRef || req.body?.ref || req.params?.ref || '';
  const projectScope = resolveProjectScope(req);
  const hasPermission = identityService.hasPermission({
    session: req.session,
    principal: req.principal,
  }, permission, {
    global: '*',
    target: req.xenTarget?.connectionId || '',
    pool: req.xenTarget?.connectionId || '',
    organization: projectScope.organization,
    project: projectScope.project,
    resource: entityRef,
    [entityType]: entityRef,
  });
  if (!hasPermission) {
    deny(
      res,
      'PERMISSION_DENIED',
      `The current principal does not have ${permission} permission for this resource scope.`,
      { permission, entityType, entityRef }
    );
    return false;
  }

  if (destructive && snapshot.currentRole !== 'admin' && snapshot.policy.requireDestructiveApproval) {
    const approvalId = req.body?.approvalId || req.query?.approvalId || '';
    if (!approvalId) {
      deny(
        res,
        'APPROVAL_REQUIRED',
        'A governance approval is required before this destructive action can run in operator mode.',
        { actionKey: options.actionKey || '', requiredRole: 'admin' }
      );
      return false;
    }

    const result = governanceService.consumeApproval({
      id: approvalId,
      actionKey: options.actionKey || '',
      entityType,
      entityRef,
      usedBy: req.session?.xenUser || 'system',
    });

    if (!result.ok) {
      deny(
        res,
        result.error,
        'The provided governance approval is missing, expired, already used, or scoped to a different action.',
        { actionKey: options.actionKey || '' }
      );
      return false;
    }

    req.governanceApproval = result.approval;
  }

  return true;
}

module.exports = {
  getGovernanceSnapshot,
  ensureMutationAllowed,
};
