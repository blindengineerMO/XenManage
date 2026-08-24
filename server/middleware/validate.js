const Joi = require('joi');

const lifecyclePlanSeedSchema = Joi.object({
  enabled: Joi.boolean().default(false),
  baselineStatus: Joi.string().valid('compliant', 'drifted', 'unknown').default('unknown'),
  targetStage: Joi.string().valid('aligned', 'review', 'maintenance', 'remediate').default('review'),
  maintenanceWindow: Joi.string().allow('').max(80).default(''),
  patchGroup: Joi.string().allow('').max(120).default(''),
  owner: Joi.string().allow('').max(120).default(''),
  nextAction: Joi.string().valid('none', 'scan', 'patch', 'reboot', 'validate').default('scan'),
  rebootRequired: Joi.boolean().default(false),
  evacuationRequired: Joi.boolean().default(false),
  dueDays: Joi.number().integer().min(0).max(365).default(0),
  dueDate: Joi.string().allow('').pattern(/^\d{4}-\d{2}-\d{2}$/).default(''),
  notes: Joi.string().allow('').max(800).default(''),
  sourceTaskRef: Joi.string().allow('').max(160).default(''),
  sourceTemplateId: Joi.string().allow('').max(160).default(''),
  sourceTemplateName: Joi.string().allow('').max(160).default(''),
});

const resilienceRunbookSeedSchema = Joi.object({
  enabled: Joi.boolean().default(false),
  recoveryTier: Joi.string().valid('tier-1', 'tier-2', 'standard', 'edge').default('standard'),
  haPolicy: Joi.string().valid('auto-failover', 'priority-restart', 'manual', 'disabled').default('manual'),
  restartPriority: Joi.string().valid('highest', 'high', 'medium', 'low', 'best-effort').default('medium'),
  backupWindowHours: Joi.number().integer().min(1).max(720).default(24),
  rpoMinutes: Joi.number().integer().min(5).max(10080).default(60),
  rtoMinutes: Joi.number().integer().min(5).max(10080).default(120),
  restorePointStatus: Joi.string().valid('current', 'review', 'stale', 'missing').default('review'),
  owner: Joi.string().allow('').max(120).default(''),
  standbyHostRef: Joi.string().allow('').pattern(/^OpaqueRef:/).default(''),
  failoverNetworkRef: Joi.string().allow('').pattern(/^OpaqueRef:/).default(''),
  runbookSteps: Joi.array().items(Joi.string().trim().min(1).max(240)).max(8).default([]),
  notes: Joi.string().allow('').max(1000).default(''),
  sourceTaskRef: Joi.string().allow('').max(160).default(''),
  sourceTemplateId: Joi.string().allow('').max(160).default(''),
  sourceTemplateName: Joi.string().allow('').max(160).default(''),
});

function validate(schema, source = 'body') {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[source], { abortEarly: false, stripUnknown: true });
    if (error) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        details: error.details.map(d => ({ field: d.path.join('.'), message: d.message })),
      });
    }
    req[source] = value;
    next();
  };
}

const schemas = {
  appLogin: Joi.object({
    username: Joi.string().required().min(1).max(100),
    password: Joi.string().required().min(1).max(255),
  }),
  xenLogin: Joi.object({
    host: Joi.string().required().min(1).max(255),
    username: Joi.string().required().min(1).max(100),
    password: Joi.string().allow('').max(255).default(''),
    vaultCredentialId: Joi.alternatives().try(
      Joi.number().integer().min(1),
      Joi.allow(null)
    ).default(null),
  }).custom((value, helpers) => {
    if (!String(value.password || '').trim() && !value.vaultCredentialId) {
      return helpers.error('any.invalid');
    }
    return value;
  }, 'xen auth source validation'),
  connectionId: Joi.object({
    id: Joi.number().integer().min(1).required(),
  }),
  inventoryWorkspaceIdParam: Joi.object({
    id: Joi.string().trim().required().min(1).max(160),
  }),
  opaqueRefParam: Joi.object({
    ref: Joi.string().required().pattern(/^OpaqueRef:/),
  }),
  connectionCreate: Joi.object({
    name: Joi.string().trim().required().min(1).max(120),
    host: Joi.string().trim().required().min(1).max(255),
    username: Joi.string().trim().required().min(1).max(100),
    vaultCredentialId: Joi.alternatives().try(
      Joi.number().integer().min(1),
      Joi.allow(null)
    ).default(null),
    port: Joi.number().integer().min(1).max(65535).default(443),
    visibility: Joi.string().valid('private', 'shared').default('private'),
    isDefault: Joi.boolean().default(false),
  }),
  connectionUpdate: Joi.object({
    name: Joi.string().trim().required().min(1).max(120),
    host: Joi.string().trim().required().min(1).max(255),
    username: Joi.string().trim().required().min(1).max(100),
    vaultCredentialId: Joi.alternatives().try(
      Joi.number().integer().min(1),
      Joi.allow(null)
    ).default(null),
    port: Joi.number().integer().min(1).max(65535).default(443),
    visibility: Joi.string().valid('private', 'shared').default('private'),
    isDefault: Joi.boolean().default(false),
  }),
  credentialCreate: Joi.object({
    name: Joi.string().trim().required().min(1).max(120),
    scope: Joi.string().valid('private', 'shared').default('private'),
    targetType: Joi.string().valid('pool', 'host').required(),
    targetHint: Joi.string().allow('').max(180).default(''),
    username: Joi.string().trim().required().min(1).max(100),
    password: Joi.string().required().min(1).max(255),
  }),
  credentialUpdate: Joi.object({
    name: Joi.string().trim().required().min(1).max(120),
    scope: Joi.string().valid('private', 'shared').default('private'),
    targetType: Joi.string().valid('pool', 'host').required(),
    targetHint: Joi.string().allow('').max(180).default(''),
    username: Joi.string().trim().required().min(1).max(100),
    password: Joi.string().allow('').max(255).default(''),
  }),
  hostTargetCreate: Joi.object({
    name: Joi.string().trim().required().min(1).max(120),
    host: Joi.string().trim().required().min(1).max(255),
    username: Joi.string().trim().required().min(1).max(100),
    vaultCredentialId: Joi.alternatives().try(
      Joi.number().integer().min(1),
      Joi.allow(null)
    ).default(null),
    port: Joi.number().integer().min(1).max(65535).default(443),
    mode: Joi.string().valid('standalone', 'pool-member').default('standalone'),
    poolConnectionId: Joi.alternatives().conditional('mode', {
      is: 'pool-member',
      then: Joi.number().integer().min(1).required(),
      otherwise: Joi.allow(null).default(null),
    }),
    notes: Joi.string().allow('').max(500).default(''),
    visibility: Joi.string().valid('private', 'shared').default('private'),
  }),
  hostTargetUpdate: Joi.object({
    name: Joi.string().trim().required().min(1).max(120),
    host: Joi.string().trim().required().min(1).max(255),
    username: Joi.string().trim().required().min(1).max(100),
    vaultCredentialId: Joi.alternatives().try(
      Joi.number().integer().min(1),
      Joi.allow(null)
    ).default(null),
    port: Joi.number().integer().min(1).max(65535).default(443),
    mode: Joi.string().valid('standalone', 'pool-member').default('standalone'),
    poolConnectionId: Joi.alternatives().conditional('mode', {
      is: 'pool-member',
      then: Joi.number().integer().min(1).required(),
      otherwise: Joi.allow(null).default(null),
    }),
    notes: Joi.string().allow('').max(500).default(''),
    visibility: Joi.string().valid('private', 'shared').default('private'),
  }),
  vmAction: Joi.object({
    ref: Joi.string().required().pattern(/^OpaqueRef:/),
    approvalId: Joi.string().allow('').max(120).default(''),
  }),
  vmLifecycle: Joi.object({
    ref: Joi.string().required().pattern(/^OpaqueRef:/),
    paused: Joi.boolean().default(false),
    force: Joi.boolean().default(false),
    approvalId: Joi.string().allow('').max(120).default(''),
  }),
  vmConfigUpdate: Joi.object({
    nameLabel: Joi.string().trim().required().min(1).max(120),
    nameDescription: Joi.string().allow('').max(500).default(''),
    vcpus: Joi.number().integer().min(1).max(128).required(),
    memoryStaticMax: Joi.number().integer().min(1073741824).max(Number.MAX_SAFE_INTEGER).required(),
    tags: Joi.array().items(Joi.string().trim().min(1).max(64)).max(24).default([]),
  }),
  vmDiskCreate: Joi.object({
    srRef: Joi.string().required().pattern(/^OpaqueRef:/),
    nameLabel: Joi.string().trim().required().min(1).max(120),
    sizeBytes: Joi.number().integer().min(1073741824).max(Number.MAX_SAFE_INTEGER).required(),
  }),
  vmNicCreate: Joi.object({
    networkRef: Joi.string().required().pattern(/^OpaqueRef:/),
    deviceLabel: Joi.string().allow('').max(12).default(''),
    mac: Joi.string().allow('').max(64).default(''),
  }),
  templateDeploy: Joi.object({
    nameLabel: Joi.string().trim().required().min(1).max(120),
    nameDescription: Joi.string().allow('').max(500).default(''),
    hostRef: Joi.string().allow(null, '').pattern(/^OpaqueRef:/).default(null),
    storageRef: Joi.string().allow(null, '').pattern(/^OpaqueRef:/).default(null),
    networkRef: Joi.string().allow(null, '').pattern(/^OpaqueRef:/).default(null),
    vcpus: Joi.number().integer().min(1).max(128).required(),
    memoryStaticMax: Joi.number().integer().min(1073741824).max(Number.MAX_SAFE_INTEGER).required(),
    tags: Joi.array().items(Joi.string().trim().min(1).max(64)).max(24).default([]),
    startAfter: Joi.boolean().default(false),
  }),
  templateGovernanceUpdate: Joi.object({
    versionLabel: Joi.string().allow('').max(80).default(''),
    profileLabel: Joi.string().allow('').max(80).default(''),
    lifecycleStage: Joi.string().valid('draft', 'staged', 'stable', 'deprecated').default('draft'),
    goldenImage: Joi.boolean().default(false),
    guestCustomization: Joi.string().allow('').max(120).default(''),
    validationStatus: Joi.string().valid('untested', 'review', 'validated', 'failed').default('untested'),
    lastValidatedAt: Joi.string().allow('').isoDate().default(''),
    owner: Joi.string().allow('').max(120).default(''),
    notes: Joi.string().allow('').max(800).default(''),
  }),
  templateDeploymentValidationUpdate: Joi.object({
    validationStatus: Joi.string().valid('pending', 'validated', 'warning', 'failed').default('pending'),
    validationNotes: Joi.string().allow('').max(800).default(''),
    guestCustomization: Joi.string().allow('').max(120).default(''),
    bootVerified: Joi.boolean().default(false),
    networkVerified: Joi.boolean().default(false),
    storageVerified: Joi.boolean().default(false),
    policyTagged: Joi.boolean().default(false),
  }),
  templatePromotion: Joi.object({
    baselineTemplateRef: Joi.string().allow('').pattern(/^OpaqueRef:/).default(''),
    retireExistingStable: Joi.boolean().default(true),
    promotionNotes: Joi.string().allow('').max(800).default(''),
  }),
  lifecyclePlanUpdate: Joi.object({
    baselineStatus: Joi.string().valid('compliant', 'drifted', 'unknown').default('unknown'),
    targetStage: Joi.string().valid('aligned', 'review', 'maintenance', 'remediate').default('review'),
    maintenanceWindow: Joi.string().allow('').max(80).default(''),
    patchGroup: Joi.string().allow('').max(120).default(''),
    owner: Joi.string().allow('').max(120).default(''),
    nextAction: Joi.string().valid('none', 'scan', 'patch', 'reboot', 'validate').default('scan'),
    rebootRequired: Joi.boolean().default(false),
    evacuationRequired: Joi.boolean().default(false),
    dueDate: Joi.string().allow('').pattern(/^\d{4}-\d{2}-\d{2}$/).default(''),
    notes: Joi.string().allow('').max(800).default(''),
    sourceTaskRef: Joi.string().allow('').max(160).default(''),
    sourceTemplateId: Joi.string().allow('').max(160).default(''),
    sourceTemplateName: Joi.string().allow('').max(160).default(''),
  }),
  alertStateUpdate: Joi.object({
    acknowledged: Joi.boolean().default(false),
    suppressionUntil: Joi.string().allow('').isoDate().default(''),
    severityOverride: Joi.string().allow('').valid('', 'critical', 'warning', 'info', 'notice').default(''),
    healthAction: Joi.string().valid('none', 'inspect', 'monitor', 'review', 'evacuate', 'snapshot', 'lifecycle', 'capacity', 'resilience', 'governance').default('none'),
    notes: Joi.string().allow('').max(600).default(''),
  }),
  alertBulkStateUpdate: Joi.object({
    refs: Joi.array().items(Joi.string().pattern(/^OpaqueRef:/)).min(1).max(100).required(),
    state: Joi.object({
      acknowledged: Joi.boolean().default(false),
      suppressionUntil: Joi.string().allow('').isoDate().default(''),
      severityOverride: Joi.string().allow('').valid('', 'critical', 'warning', 'info', 'notice').default(''),
      healthAction: Joi.string().valid('none', 'inspect', 'monitor', 'review', 'evacuate', 'snapshot', 'lifecycle', 'capacity', 'resilience', 'governance').default('none'),
      notes: Joi.string().allow('').max(600).default(''),
    }).required(),
  }),
  alertPolicyIdParam: Joi.object({
    id: Joi.string().trim().required().min(1).max(120),
  }),
  alertPolicyUpdate: Joi.object({
    enabled: Joi.boolean().default(true),
    name: Joi.string().trim().required().min(1).max(120),
    matchClass: Joi.string().allow('').valid('', 'host', 'sr', 'vdi', 'vbd', 'vm', 'pool', 'network', 'vif', 'pif', 'task').default(''),
    matchTargetRoute: Joi.string().allow('').valid('', '/hosts', '/storage', '/vms', '/pools', '/networking', '/activity', '/inventory', '/capacity', '/resilience', '/lifecycle', '/governance').default(''),
    matchObject: Joi.string().allow('').max(120).default(''),
    matchSeverity: Joi.string().allow('').valid('', 'critical', 'warning', 'info', 'notice').default(''),
    matchText: Joi.string().allow('').max(120).default(''),
    textMatchMode: Joi.string().valid('phrase', 'all').default('phrase'),
    autoAcknowledge: Joi.boolean().default(false),
    suppressionHours: Joi.number().integer().min(0).max(720).default(0),
    severityOverride: Joi.string().allow('').valid('', 'critical', 'warning', 'info', 'notice').default(''),
    healthAction: Joi.string().valid('none', 'inspect', 'monitor', 'review', 'evacuate', 'snapshot', 'lifecycle', 'capacity', 'resilience', 'governance').default('none'),
    notes: Joi.string().allow('').max(600).default(''),
  }),
  remediationTaskCreate: Joi.object({
    nameLabel: Joi.string().trim().required().min(1).max(120),
    nameDescription: Joi.string().allow('').max(800).default(''),
    actionType: Joi.string().valid('inspect', 'monitor', 'review', 'evacuate', 'snapshot', 'lifecycle', 'capacity', 'resilience', 'governance').default('review'),
    assignee: Joi.string().allow('').max(120).default(''),
    dueDate: Joi.string().allow('').max(40).default(''),
    alertRef: Joi.string().required().pattern(/^OpaqueRef:/),
    alertUuid: Joi.string().allow('').max(120).default(''),
    alertSummary: Joi.string().trim().required().min(1).max(180),
    targetRoute: Joi.string().allow('').valid('', '/hosts', '/storage', '/vms', '/pools', '/networking', '/activity', '/inventory', '/capacity', '/resilience', '/lifecycle', '/governance').default(''),
    relatedObject: Joi.string().allow('').max(180).default(''),
    relatedClass: Joi.string().allow('').valid('', 'host', 'sr', 'vdi', 'vbd', 'vm', 'pool', 'network', 'vif', 'pif', 'task', 'alert').default(''),
    workspaceSummary: Joi.string().allow('').max(240).default(''),
    evidenceChecklist: Joi.array().items(Joi.string().trim().min(1).max(200)).max(8).default([]),
    completionCriteria: Joi.array().items(Joi.string().trim().min(1).max(200)).max(8).default([]),
    lifecyclePlanSeed: lifecyclePlanSeedSchema.allow(null).default(null),
    resilienceRunbookSeed: resilienceRunbookSeedSchema.allow(null).default(null),
    templateId: Joi.string().allow('').max(120).default(''),
    templateName: Joi.string().allow('').max(120).default(''),
    templateLaunchMode: Joi.string().valid('draft', 'queue').default('draft'),
    recurrenceMode: Joi.string().valid('manual', 'once', 'daily', 'weekly', 'cooldown').default('manual'),
    recurrenceScope: Joi.string().valid('alert', 'object', 'class').default('object'),
    cooldownDays: Joi.number().integer().min(0).max(365).default(0),
  }),
  remediationTaskUpdate: Joi.object({
    status: Joi.string().valid('pending', 'queued', 'in_progress', 'success', 'warning', 'failure', 'cancelled').default('pending'),
    assignee: Joi.string().allow('').max(120).default(''),
    dueDate: Joi.string().allow('').max(40).default(''),
    result: Joi.string().allow('').max(500).default(''),
    nameDescription: Joi.string().allow('').max(800).default(''),
  }),
  remediationTemplateIdParam: Joi.object({
    id: Joi.string().trim().required().min(1).max(120),
  }),
  remediationTaskTemplateUpdate: Joi.object({
    enabled: Joi.boolean().default(true),
    name: Joi.string().trim().required().min(1).max(120),
    matchClass: Joi.string().allow('').valid('', 'host', 'sr', 'vdi', 'vbd', 'vm', 'pool', 'network', 'vif', 'pif', 'task', 'alert').default(''),
    matchTargetRoute: Joi.string().allow('').valid('', '/hosts', '/storage', '/vms', '/pools', '/networking', '/activity', '/inventory', '/capacity', '/resilience', '/lifecycle', '/governance').default(''),
    matchObject: Joi.string().allow('').max(120).default(''),
    matchSeverity: Joi.string().allow('').valid('', 'critical', 'warning', 'info', 'notice').default(''),
    matchText: Joi.string().allow('').max(120).default(''),
    textMatchMode: Joi.string().valid('phrase', 'all').default('phrase'),
    actionType: Joi.string().valid('inspect', 'monitor', 'review', 'evacuate', 'snapshot', 'lifecycle', 'capacity', 'resilience', 'governance').default('review'),
    taskNameTemplate: Joi.string().trim().required().min(1).max(160),
    defaultAssignee: Joi.string().allow('').max(120).default(''),
    defaultDueDays: Joi.number().integer().min(0).max(365).default(0),
    defaultTargetRoute: Joi.string().allow('').valid('', '/hosts', '/storage', '/vms', '/pools', '/networking', '/activity', '/inventory', '/capacity', '/resilience', '/lifecycle', '/governance').default(''),
    defaultNotes: Joi.string().allow('').max(1000).default(''),
    workspaceSummaryTemplate: Joi.string().allow('').max(240).default(''),
    evidenceChecklist: Joi.array().items(Joi.string().trim().min(1).max(200)).max(8).default([]),
    completionCriteria: Joi.array().items(Joi.string().trim().min(1).max(200)).max(8).default([]),
    lifecyclePlanSeed: lifecyclePlanSeedSchema.allow(null).default(null),
    resilienceRunbookSeed: resilienceRunbookSeedSchema.allow(null).default(null),
    launchMode: Joi.string().valid('draft', 'queue').default('draft'),
    recurrenceMode: Joi.string().valid('manual', 'once', 'daily', 'weekly', 'cooldown').default('manual'),
    recurrenceScope: Joi.string().valid('alert', 'object', 'class').default('object'),
    cooldownDays: Joi.alternatives().conditional('recurrenceMode', {
      is: 'cooldown',
      then: Joi.number().integer().min(1).max(365).required(),
      otherwise: Joi.number().integer().min(0).max(365).default(0),
    }),
  }),
  resilienceRunbookUpdate: Joi.object({
    recoveryTier: Joi.string().valid('tier-1', 'tier-2', 'standard', 'edge').default('standard'),
    haPolicy: Joi.string().valid('auto-failover', 'priority-restart', 'manual', 'disabled').default('manual'),
    restartPriority: Joi.string().valid('highest', 'high', 'medium', 'low', 'best-effort').default('medium'),
    backupWindowHours: Joi.number().integer().min(1).max(720).default(24),
    rpoMinutes: Joi.number().integer().min(5).max(10080).default(60),
    rtoMinutes: Joi.number().integer().min(5).max(10080).default(120),
    restorePointStatus: Joi.string().valid('current', 'review', 'stale', 'missing').default('review'),
    owner: Joi.string().allow('').max(120).default(''),
    standbyHostRef: Joi.string().allow('').pattern(/^OpaqueRef:/).default(''),
    failoverNetworkRef: Joi.string().allow('').pattern(/^OpaqueRef:/).default(''),
    lastVerifiedAt: Joi.string().allow('').isoDate().default(''),
    runbookSteps: Joi.array().items(Joi.string().trim().min(1).max(240)).max(8).default([]),
    notes: Joi.string().allow('').max(1000).default(''),
    sourceTaskRef: Joi.string().allow('').max(160).default(''),
    sourceTemplateId: Joi.string().allow('').max(160).default(''),
    sourceTemplateName: Joi.string().allow('').max(160).default(''),
  }),
  resilienceDrillCreate: Joi.object({
    drillType: Joi.string().valid('restore', 'failover', 'evacuation', 'backup-verify').default('restore'),
    status: Joi.string().valid('success', 'warning', 'critical', 'pending').default('success'),
    scope: Joi.string().allow('').max(120).default(''),
    executedAt: Joi.string().allow('').isoDate().default(''),
    durationMinutes: Joi.number().integer().min(0).max(10080).default(0),
    summary: Joi.string().trim().required().min(1).max(240),
    findings: Joi.string().allow('').max(1000).default(''),
    nextStep: Joi.string().allow('').max(240).default(''),
  }),
  governancePolicyUpdate: Joi.object({
    defaultRole: Joi.string().valid('read-only', 'operator', 'admin').default('admin'),
    requireDestructiveApproval: Joi.boolean().default(true),
    approvalTtlMinutes: Joi.number().integer().min(5).max(10080).default(240),
  }),
  governanceRoleUpdate: Joi.object({
    role: Joi.string().valid('read-only', 'operator', 'admin').required(),
  }),
  governanceQuotaUpdate: Joi.object({
    enabled: Joi.boolean().default(true),
    owner: Joi.string().allow('').max(120).default(''),
    maxVmCount: Joi.number().integer().min(0).max(100000).default(0),
    maxRunningVmCount: Joi.number().integer().min(0).max(100000).default(0),
    maxTotalMemoryGiB: Joi.number().integer().min(0).max(1048576).default(0),
    notes: Joi.string().allow('').max(1000).default(''),
  }),
  governanceApprovalRequest: Joi.object({
    actionKey: Joi.string().trim().required().min(1).max(120),
    entityType: Joi.string().trim().required().min(1).max(60),
    entityRef: Joi.string().trim().required().min(1).max(255),
    entityName: Joi.string().allow('').max(160).default(''),
    justification: Joi.string().trim().required().min(1).max(500),
    route: Joi.string().allow('').max(120).default(''),
    expiresAt: Joi.string().allow('').isoDate().default(''),
  }),
  governanceApprovalDecision: Joi.object({
    decision: Joi.string().valid('approved', 'rejected').required(),
    notes: Joi.string().allow('').max(500).default(''),
  }),
  userIdParam: Joi.object({
    id: Joi.number().integer().min(1).required(),
  }),
  userCreate: Joi.object({
    username: Joi.string().trim().required().min(3).max(80).pattern(/^[a-zA-Z0-9._-]+$/),
    password: Joi.string().required().min(10).max(256),
    displayName: Joi.string().allow('').max(120).default(''),
    email: Joi.string().allow('').email({ tlds: { allow: false } }).max(160).default(''),
    role: Joi.string().valid('read-only', 'operator', 'admin').default('operator'),
    active: Joi.boolean().default(true),
    groupIds: Joi.array().items(Joi.number().integer().min(1)).max(50).default([]),
  }),
  userUpdate: Joi.object({
    username: Joi.string().trim().required().min(3).max(80).pattern(/^[a-zA-Z0-9._-]+$/),
    displayName: Joi.string().allow('').max(120).default(''),
    email: Joi.string().allow('').email({ tlds: { allow: false } }).max(160).default(''),
    role: Joi.string().valid('read-only', 'operator', 'admin').default('operator'),
    active: Joi.boolean().default(true),
    groupIds: Joi.array().items(Joi.number().integer().min(1)).max(50).default([]),
  }),
  userPasswordReset: Joi.object({
    password: Joi.string().required().min(10).max(256),
  }),
  groupIdParam: Joi.object({
    id: Joi.number().integer().min(1).required(),
  }),
  groupCreate: Joi.object({
    name: Joi.string().trim().required().min(1).max(120),
    memberUserIds: Joi.array().items(Joi.number().integer().min(1)).max(200).default([]),
  }),
  groupUpdate: Joi.object({
    name: Joi.string().trim().required().min(1).max(120),
    memberUserIds: Joi.array().items(Joi.number().integer().min(1)).max(200).default([]),
  }),
  systemConfigSectionParam: Joi.object({
    section: Joi.string().valid('general', 'network', 'security', 'logging', 'retention').required(),
  }),
  systemConfigGeneralUpdate: Joi.object({
    appName: Joi.string().trim().required().min(1).max(120),
    timezone: Joi.string().trim().required().min(1).max(120),
  }),
  systemConfigNetworkUpdate: Joi.object({
    publicBaseUrl: Joi.string().allow('').uri({ scheme: ['http', 'https'] }).max(240).default(''),
    trustProxy: Joi.boolean().default(false),
  }),
  systemConfigSecurityUpdate: Joi.object({
    sessionMaxAgeMs: Joi.number().integer().min(60000).max(2592000000).default(86400000),
    failedLoginWindowMinutes: Joi.number().integer().min(1).max(1440).default(15),
    failedLoginMaxAttempts: Joi.number().integer().min(1).max(100).default(20),
  }),
  systemConfigLoggingUpdate: Joi.object({
    level: Joi.string().valid('trace', 'debug', 'info', 'warn', 'error').default('info'),
    structuredJson: Joi.boolean().default(false),
  }),
  systemConfigRetentionUpdate: Joi.object({
    sweepIntervalHours: Joi.number().integer().min(1).max(168).default(24),
    vacuumAfterSweep: Joi.boolean().default(true),
  }),
  retentionDomainParam: Joi.object({
    domain: Joi.string().valid('audit-log', 'remediation-tasks', 'auth-events').required(),
  }),
  retentionPolicyUpdate: Joi.object({
    retentionDays: Joi.number().integer().min(1).max(3650).required(),
    enabled: Joi.boolean().default(true),
  }),
  retentionRun: Joi.object({
    domain: Joi.string().allow('').valid('', 'audit-log', 'remediation-tasks', 'auth-events').default(''),
    dryRun: Joi.boolean().default(false),
  }),
  logsListQuery: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    pageSize: Joi.number().integer().min(1).max(500).default(50),
    search: Joi.string().allow('').max(200).default(''),
    source: Joi.string().valid('all', 'audit', 'auth', 'alert', 'remediation-task', 'xen-task').default('all'),
    severity: Joi.string().valid('all', 'success', 'pending', 'warning', 'failure', 'critical', 'info', 'notice').default('all'),
  }),
  logsExport: Joi.object({
    ids: Joi.array().items(Joi.string().trim().min(1).max(160)).max(500).default([]),
    format: Joi.string().valid('json', 'html', 'pdf').required(),
    search: Joi.string().allow('').max(200).default(''),
    source: Joi.string().valid('all', 'audit', 'auth', 'alert', 'remediation-task', 'xen-task').default('all'),
    severity: Joi.string().valid('all', 'success', 'pending', 'warning', 'failure', 'critical', 'info', 'notice').default('all'),
  }),
  metricRangeQuery: Joi.object({
    range: Joi.string().valid('1h', '6h', '24h', '7d', '30d').default('24h'),
  }),
  inventoryWorkspaceUpdate: Joi.object({
    name: Joi.string().trim().required().min(1).max(120),
    scope: Joi.string().valid('all', 'pool', 'template', 'vm', 'host', 'storage', 'vdi', 'vbd', 'network', 'vif', 'pif', 'alert', 'task').default('all'),
    query: Joi.string().allow('').max(200).default(''),
    targetConnectionId: Joi.alternatives().try(
      Joi.number().integer().min(1),
      Joi.allow(null)
    ).default(null),
    notes: Joi.string().allow('').max(400).default(''),
    visibility: Joi.string().valid('private', 'shared').default('private'),
  }),
  paginate: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    pageSize: Joi.number().integer().min(1).max(500).default(50),
    search: Joi.string().allow('').default(''),
    sort: Joi.string().allow('').default(''),
    sortDir: Joi.string().valid('asc', 'desc').default('asc'),
  }),
};

module.exports = { validate, schemas };
