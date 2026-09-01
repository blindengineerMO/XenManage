const governanceService = require('../services/governance');
const identityService = require('../services/identity');

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

  const permission = options.permission || identityService.actionPermission(options.actionKey || 'resource.update');
  const entityRef = options.entityRef || req.body?.ref || req.params?.ref || '';
  const hasPermission = identityService.hasPermission({
    session: req.session,
    principal: req.principal,
  }, permission, {
    global: '*',
    target: req.xenTarget?.connectionId || '',
    pool: req.xenTarget?.connectionId || '',
    resource: entityRef,
    [options.entityType || 'resource']: entityRef,
  });
  if (!hasPermission) {
    deny(
      res,
      'PERMISSION_DENIED',
      `The current principal does not have ${permission} permission for this resource scope.`,
      { permission, entityType: options.entityType || 'resource', entityRef }
    );
    return false;
  }

  if (options.destructive && snapshot.currentRole !== 'admin' && snapshot.policy.requireDestructiveApproval) {
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
      entityType: options.entityType || 'resource',
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
