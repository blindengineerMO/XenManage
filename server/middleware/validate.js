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

const vmMigrationSeedSchema = Joi.object({
  enabled: Joi.boolean().default(false),
  mode: Joi.string().valid('same-pool', 'cross-pool').default('same-pool'),
  hostRef: Joi.string().allow('').pattern(/^OpaqueRef:/).default(''),
  destinationTargetKey: Joi.string().allow('').max(200).default(''),
  transferNetworkRef: Joi.string().allow('').pattern(/^OpaqueRef:/).default(''),
  srRef: Joi.string().allow('').pattern(/^OpaqueRef:/).default(''),
  vifNetworkMap: Joi.array().items(
    Joi.object({
      vifRef: Joi.string().required().pattern(/^OpaqueRef:/),
      networkRef: Joi.string().required().pattern(/^OpaqueRef:/),
    })
  ).default([]),
  live: Joi.boolean().default(true),
  copy: Joi.boolean().default(false),
  force: Joi.boolean().default(false),
  compress: Joi.boolean().default(true),
  setAsHomeServer: Joi.boolean().default(false),
  notes: Joi.string().allow('').max(800).default(''),
  sourceTaskRef: Joi.string().allow('').max(160).default(''),
  sourceTemplateId: Joi.string().allow('').max(160).default(''),
  sourceTemplateName: Joi.string().allow('').max(160).default(''),
});

const remediationLaunchModeValues = [
  'draft',
  'queue',
  'lifecycle-plan',
  'lifecycle-maintenance',
  'resilience-runbook',
  'resilience-drill',
  'vm-migration',
];

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
    connectionId: Joi.alternatives().try(
      Joi.number().integer().min(1),
      Joi.allow(null)
    ).default(null),
    hostTargetId: Joi.alternatives().try(
      Joi.number().integer().min(1),
      Joi.allow(null)
    ).default(null),
    connectionName: Joi.string().allow('').max(120).default(''),
    port: Joi.number().integer().min(1).max(65535).default(443),
    vaultCredentialId: Joi.alternatives().try(
      Joi.number().integer().min(1),
      Joi.allow(null)
    ).default(null),
  }).custom((value, helpers) => {
    if (!String(value.password || '').trim() && !value.vaultCredentialId) {
      return helpers.error('any.invalid');
    }
    if (value.connectionId && value.hostTargetId) {
      return helpers.error('any.invalid');
    }
    return value;
  }, 'xen auth source validation'),
  connectionId: Joi.object({
    id: Joi.number().integer().min(1).required(),
  }),
  managedTargetId: Joi.object({
    id: Joi.number().integer().min(1).required(),
  }),
  workflowId: Joi.object({
    id: Joi.string().guid({ version: ['uuidv4'] }).required(),
  }),
  inventoryWorkspaceIdParam: Joi.object({
    id: Joi.string().trim().required().min(1).max(160),
  }),
  opaqueRefParam: Joi.object({
    ref: Joi.string().required().pattern(/^OpaqueRef:/),
  }),
  vmNicParams: Joi.object({
    ref: Joi.string().required().pattern(/^OpaqueRef:/),
    vifRef: Joi.string().required().pattern(/^OpaqueRef:/),
  }),
  vifRefParam: Joi.object({
    vifRef: Joi.string().required().pattern(/^OpaqueRef:/),
  }),
  vmConsoleParams: Joi.object({
    ref: Joi.string().required().pattern(/^OpaqueRef:/),
    consoleRef: Joi.string().required().pattern(/^OpaqueRef:/),
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
  managedTargetCreate: Joi.object({
    connectionId: Joi.number().integer().min(1).required(),
    enabled: Joi.boolean().default(true),
  }),
  managedTargetUpdate: Joi.object({
    enabled: Joi.boolean().required(),
  }),
  workflowCreate: Joi.object({
    type: Joi.string().valid('managed-target.check').required(),
    targetId: Joi.number().integer().min(1).required(),
    input: Joi.object().default({}),
    idempotencyKey: Joi.string().trim().allow('').max(180).default(''),
    maxAttempts: Joi.number().integer().min(1).max(10).default(3),
    scheduledFor: Joi.string().isoDate().allow('').default(''),
    lockKey: Joi.string().trim().allow('').max(180).default(''),
    runNow: Joi.boolean().default(true),
  }),
  workflowApproval: Joi.object({
    approvalId: Joi.string().trim().allow('').max(120).default(''),
  }),
  permissionGrantCreate: Joi.object({
    permission: Joi.string().trim().required().pattern(/^[a-z*][a-z0-9.*-]*$/),
    scopeType: Joi.string().valid('global', 'organization', 'project', 'target', 'pool', 'resource', 'tag').default('global'),
    scopeRef: Joi.string().trim().required().max(255).default('*'),
    effect: Joi.string().valid('allow', 'deny').default('allow'),
  }),
  permissionGrantId: Joi.object({
    id: Joi.number().integer().min(1).required(),
  }),
  apiTokenCreate: Joi.object({
    name: Joi.string().trim().required().min(1).max(120),
    permissions: Joi.array().items(Joi.string().trim().pattern(/^[a-z*][a-z0-9.*-]*$/)).max(100).default([]),
    expiresAt: Joi.string().isoDate().allow('').default(''),
  }),
  organizationCreate: Joi.object({
    name: Joi.string().trim().required().min(1).max(120),
    description: Joi.string().allow('').max(500).default(''),
  }),
  projectId: Joi.object({ id: Joi.number().integer().min(1).required() }),
  projectMemberParams: Joi.object({
    id: Joi.number().integer().min(1).required(),
    userId: Joi.number().integer().min(1).required(),
  }),
  projectCreate: Joi.object({
    organizationId: Joi.number().integer().min(1).required(),
    name: Joi.string().trim().required().min(1).max(120),
    description: Joi.string().allow('').max(500).default(''),
    costCenter: Joi.string().allow('').max(120).default(''),
    defaultRecoveryTier: Joi.string().allow('').max(120).default(''),
    ownerUserId: Joi.number().integer().min(1).allow(null).default(null),
    targetIds: Joi.array().items(Joi.number().integer().min(1)).max(100).default([]),
  }),
  projectUpdate: Joi.object({
    name: Joi.string().trim().required().min(1).max(120),
    description: Joi.string().allow('').max(500).default(''),
    costCenter: Joi.string().allow('').max(120).default(''),
    defaultRecoveryTier: Joi.string().allow('').max(120).default(''),
    ownerUserId: Joi.number().integer().min(1).allow(null).default(null),
    enabled: Joi.boolean().default(true),
    targetIds: Joi.array().items(Joi.number().integer().min(1)).max(100).default([]),
  }),
  projectQuotaUpdate: Joi.object({
    enabled: Joi.boolean().default(true),
    maxVmCount: Joi.number().integer().min(0).default(0),
    maxVcpus: Joi.number().integer().min(0).default(0),
    maxMemoryGiB: Joi.number().min(0).default(0),
    maxStorageGiB: Joi.number().min(0).default(0),
    maxGpuCount: Joi.number().integer().min(0).default(0),
    maxNetworkCount: Joi.number().integer().min(0).default(0),
  }),
  projectMemberUpdate: Joi.object({ role: Joi.string().valid('owner', 'member', 'viewer').default('member') }),
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
    userVersion: Joi.number().integer().min(0).max(2147483647).default(0),
    startDelay: Joi.number().integer().min(0).max(2147483647).default(0),
    shutdownDelay: Joi.number().integer().min(0).max(2147483647).default(0),
    order: Joi.number().integer().min(0).max(2147483647).default(0),
    vcpusAtStartup: Joi.number().integer().min(1).max(128).required(),
    vcpusMax: Joi.number().integer().min(Joi.ref('vcpusAtStartup')).max(128).required(),
    memoryStaticMax: Joi.number().integer().min(1073741824).max(Number.MAX_SAFE_INTEGER).required(),
    memoryDynamicMax: Joi.number().integer().min(1073741824).max(Joi.ref('memoryStaticMax')).default(Joi.ref('memoryStaticMax')),
    memoryStaticMin: Joi.number().integer().min(1073741824).max(Joi.ref('memoryStaticMax')).required(),
    memoryDynamicMin: Joi.number().integer().min(Joi.ref('memoryStaticMin')).max(Joi.ref('memoryDynamicMax')).default(Joi.ref('memoryDynamicMax')),
    hardwarePlatformVersion: Joi.number().integer().min(0).max(2147483647).default(0),
    domainType: Joi.string().valid('unspecified', 'hvm', 'pv', 'pvh', 'pv_in_pvh').default('unspecified'),
    hasVendorDevice: Joi.boolean().default(true),
    affinity: Joi.alternatives().try(
      Joi.string().pattern(/^OpaqueRef:/),
      Joi.string().allow('')
    ).default(''),
    applianceRef: Joi.alternatives().try(
      Joi.string().pattern(/^OpaqueRef:/),
      Joi.string().allow('')
    ).default(''),
    snapshotScheduleRef: Joi.alternatives().try(
      Joi.string().pattern(/^OpaqueRef:/),
      Joi.string().allow('')
    ).default(''),
    tags: Joi.array().items(Joi.string().trim().min(1).max(64)).max(24).default([]),
    blockedOperations: Joi.object()
      .pattern(Joi.string().trim().min(1).max(40), Joi.string().trim().min(1).max(120))
      .default({}),
    vcpusParams: Joi.object()
      .pattern(Joi.string().trim().min(1).max(80), Joi.string().allow('').max(255))
      .default({}),
    otherConfig: Joi.object()
      .pattern(Joi.string().trim().min(1).max(80), Joi.string().allow('').max(255))
      .default({}),
    xenstoreData: Joi.object()
      .pattern(Joi.string().trim().min(1).max(120), Joi.string().allow('').max(1024))
      .default({}),
    nvram: Joi.object()
      .pattern(Joi.string().trim().min(1).max(160), Joi.string().allow('').max(2048))
      .default({}),
    platform: Joi.object()
      .pattern(Joi.string().trim().min(1).max(80), Joi.string().allow('').max(255))
      .default({}),
  }),
  vmDiskCreate: Joi.object({
    srRef: Joi.string().required().pattern(/^OpaqueRef:/),
    nameLabel: Joi.string().trim().required().min(1).max(120),
    sizeBytes: Joi.number().integer().min(1073741824).max(Number.MAX_SAFE_INTEGER).required(),
  }),
  storageVdiCreate: Joi.object({
    nameLabel: Joi.string().trim().required().min(1).max(120),
    sizeBytes: Joi.number().integer().min(1073741824).max(Number.MAX_SAFE_INTEGER).required(),
    type: Joi.string().trim().required().min(1).max(40).default('user'),
  }),
  storageSrCreate: Joi.object({
    hostRef: Joi.string().required().pattern(/^OpaqueRef:/),
    nameLabel: Joi.string().trim().required().min(1).max(120),
    nameDescription: Joi.string().allow('').max(500).default(''),
    type: Joi.string().valid('nfs', 'lvmoiscsi', 'ext', 'lvm').required(),
    contentType: Joi.string().valid('user', 'iso').default('user'),
    shared: Joi.boolean().default(false),
    deviceConfig: Joi.object()
      .pattern(Joi.string().trim().min(1).max(80), Joi.string().allow('').max(255))
      .required(),
    smConfig: Joi.object()
      .pattern(Joi.string().trim().min(1).max(80), Joi.string().allow('').max(255))
      .default({}),
  }).custom((value, helpers) => {
    const requirements = {
      nfs: ['server', 'serverpath'],
      lvmoiscsi: ['target', 'targetIQN', 'SCSIid'],
      ext: ['device'],
      lvm: ['device'],
    };

    const requiredKeys = requirements[value.type] || [];
    const config = value.deviceConfig || {};
    const missing = requiredKeys.filter((key) => !String(config[key] || '').trim());
    if (missing.length) {
      return helpers.message(`deviceConfig.${missing[0]} is required for ${value.type} storage repositories.`);
    }

    return value;
  }),
  storageSrProbe: Joi.object({
    hostRef: Joi.string().required().pattern(/^OpaqueRef:/),
    type: Joi.string().valid('nfs', 'lvmoiscsi', 'ext', 'lvm').required(),
    deviceConfig: Joi.object()
      .pattern(Joi.string().trim().min(1).max(80), Joi.string().allow('').max(255))
      .default({}),
    smConfig: Joi.object()
      .pattern(Joi.string().trim().min(1).max(80), Joi.string().allow('').max(255))
      .default({}),
  }),
  storageSrImport: Joi.object({
    hostRef: Joi.string().required().pattern(/^OpaqueRef:/),
    uuid: Joi.string().trim().required().min(1).max(120),
    nameLabel: Joi.string().trim().required().min(1).max(120),
    nameDescription: Joi.string().allow('').max(500).default(''),
    type: Joi.string().valid('nfs', 'lvmoiscsi', 'ext', 'lvm').required(),
    contentType: Joi.string().valid('user', 'iso').default('user'),
    shared: Joi.boolean().default(false),
    deviceConfig: Joi.object()
      .pattern(Joi.string().trim().min(1).max(80), Joi.string().allow('').max(255))
      .required(),
    smConfig: Joi.object()
      .pattern(Joi.string().trim().min(1).max(80), Joi.string().allow('').max(255))
      .default({}),
  }),
  storageSrLocalCache: Joi.object({
    hostRef: Joi.string().required().pattern(/^OpaqueRef:/),
    enabled: Joi.boolean().required(),
  }),
  storageSrConfigUpdate: Joi.object({
    nameLabel: Joi.string().trim().required().min(1).max(120),
    nameDescription: Joi.string().allow('').max(500).default(''),
    tags: Joi.array().items(Joi.string().trim().min(1).max(64)).max(24).default([]),
    otherConfig: Joi.object()
      .pattern(Joi.string().trim().min(1).max(80), Joi.string().allow('').max(255))
      .default({}),
  }),
  storageVdiResizeParams: Joi.object({
    ref: Joi.string().required().pattern(/^OpaqueRef:/),
    vdiRef: Joi.string().required().pattern(/^OpaqueRef:/),
  }),
  storageVdiResize: Joi.object({
    sizeBytes: Joi.number().integer().min(1073741824).max(Number.MAX_SAFE_INTEGER).required(),
  }),
  storageMutation: Joi.object({
    approvalId: Joi.string().allow('').max(120).default(''),
  }),
  storageVdiClone: Joi.object({
    nameLabel: Joi.string().trim().allow('').max(120).default(''),
    snapshot: Joi.boolean().default(false),
    approvalId: Joi.string().allow('').max(120).default(''),
  }),
  storageVdiAttachCd: Joi.object({
    vmRef: Joi.string().required().pattern(/^OpaqueRef:/),
    approvalId: Joi.string().allow('').max(120).default(''),
  }),
  storageFilePathQuery: Joi.object({
    path: Joi.string().allow('').max(1024).default(''),
  }),
  storageFileMkdir: Joi.object({
    path: Joi.string().allow('').max(1024).default(''),
    name: Joi.string().trim().required().min(1).max(255).pattern(/^[^/\\]+$/),
  }),
  storageFileMove: Joi.object({
    fromPath: Joi.string().trim().required().min(1).max(1024),
    toPath: Joi.string().trim().required().min(1).max(1024),
  }),
  storageFileDeleteQuery: Joi.object({
    path: Joi.string().trim().required().min(1).max(1024),
    approvalId: Joi.string().allow('').max(120).default(''),
  }),
  networkCreate: Joi.object({
    nameLabel: Joi.string().trim().required().min(1).max(120),
    nameDescription: Joi.string().allow('').max(500).default(''),
    mtu: Joi.number().integer().min(576).max(9216).default(1500),
    bridge: Joi.string().trim().required().min(1).max(64),
    tags: Joi.array().items(Joi.string().trim().min(1).max(64)).max(24).default([]),
    otherConfig: Joi.object()
      .pattern(Joi.string().trim().min(1).max(80), Joi.string().allow('').max(255))
      .default({}),
  }),
  networkVlanCreate: Joi.object({
    networkRef: Joi.string().required().pattern(/^OpaqueRef:/),
    pifRef: Joi.string().required().pattern(/^OpaqueRef:/),
    tag: Joi.number().integer().min(1).max(4094).required(),
  }),
  networkBondCreate: Joi.object({
    networkRef: Joi.string().required().pattern(/^OpaqueRef:/),
    pifRefs: Joi.array().items(Joi.string().required().pattern(/^OpaqueRef:/)).min(2).max(8).required(),
    mode: Joi.string().valid('balance-slb', 'active-backup', 'lacp').default('balance-slb'),
  }),
  networkConfigUpdate: Joi.object({
    nameLabel: Joi.string().trim().required().min(1).max(120),
    nameDescription: Joi.string().allow('').max(500).default(''),
    mtu: Joi.number().integer().min(576).max(9216).default(1500),
    defaultLockingMode: Joi.string().valid('unlocked', 'disabled').default('unlocked'),
    purpose: Joi.array().items(Joi.string().valid('nbd', 'insecure_nbd')).max(2).default([]),
    tags: Joi.array().items(Joi.string().trim().min(1).max(64)).max(24).default([]),
    otherConfig: Joi.object()
      .pattern(Joi.string().trim().min(1).max(80), Joi.string().allow('').max(255))
      .default({}),
  }),
  networkVifConfigUpdate: Joi.object({
    qosAlgorithmType: Joi.string().trim().allow('').max(120).default(''),
    qosAlgorithmParams: Joi.object()
      .pattern(Joi.string().trim().min(1).max(80), Joi.string().allow('').max(255))
      .default({}),
  }).custom((value, helpers) => {
    if (!String(value.qosAlgorithmType || '').trim() && Object.keys(value.qosAlgorithmParams || {}).length) {
      return helpers.error('any.invalid');
    }
    return value;
  }, 'VIF QoS configuration validation'),
  networkMutation: Joi.object({
    approvalId: Joi.string().allow('').max(120).default(''),
  }),
  poolConfigUpdate: Joi.object({
    nameLabel: Joi.string().trim().required().min(1).max(120),
    nameDescription: Joi.string().allow('').max(500).default(''),
    defaultSrRef: Joi.alternatives().try(
      Joi.string().pattern(/^OpaqueRef:/),
      Joi.string().allow('')
    ).default(''),
    vswitchController: Joi.string().allow('').ip({ version: ['ipv4', 'ipv6'], cidr: 'forbidden' }).max(120).default(''),
    igmpSnoopingEnabled: Joi.boolean(),
    migrationCompressionEnabled: Joi.boolean(),
    wlbEnabled: Joi.boolean(),
    tags: Joi.array().items(Joi.string().trim().min(1).max(64)).max(24).default([]),
    otherConfig: Joi.object()
      .pattern(Joi.string().trim().min(1).max(80), Joi.string().allow('').max(255))
      .default({}),
  }),
  poolHaUpdate: Joi.object({
    enabled: Joi.boolean().required(),
    heartbeatSrRefs: Joi.array()
      .items(Joi.string().required().pattern(/^OpaqueRef:/))
      .max(8)
      .default([]),
    haHostFailuresToTolerate: Joi.number().integer().min(0).max(32).default(1),
    configuration: Joi.object()
      .pattern(Joi.string().trim().min(1).max(80), Joi.string().allow('').max(255))
      .default({}),
  }),
  poolJoin: Joi.object({
    joiningHostAddress: Joi.string().trim().required().min(1).max(255),
    joiningHostUsername: Joi.string().trim().required().min(1).max(120),
    joiningHostPassword: Joi.string().required().min(1).max(255),
    masterAddress: Joi.string().trim().required().min(1).max(255),
    masterUsername: Joi.string().trim().required().min(1).max(120),
    masterPassword: Joi.string().required().min(1).max(255),
    force: Joi.boolean().default(false),
  }),
  poolEject: Joi.object({
    hostRef: Joi.string().required().pattern(/^OpaqueRef:/),
    approvalId: Joi.string().allow('').optional(),
  }),
  hostConfigUpdate: Joi.object({
    nameLabel: Joi.string().trim().required().min(1).max(120),
    nameDescription: Joi.string().allow('').max(500).default(''),
    tags: Joi.array().items(Joi.string().trim().min(1).max(64)).max(24).optional(),
    guestVcpusParams: Joi.object()
      .pattern(Joi.string().trim().min(1).max(80), Joi.string().allow('').max(255))
      .optional(),
    schedGran: Joi.string().valid('cpu', 'core', 'socket').optional(),
    logging: Joi.object()
      .pattern(Joi.string().trim().min(1).max(80), Joi.string().allow('').max(255))
      .optional(),
  }),
  vmNicCreate: Joi.object({
    networkRef: Joi.string().required().pattern(/^OpaqueRef:/),
    deviceLabel: Joi.string().allow('').max(12).default(''),
    mac: Joi.string().allow('').max(64).default(''),
  }),
  vmNicDelete: Joi.object({
    force: Joi.boolean().default(true),
  }),
  vmNicDisconnect: Joi.object({
    force: Joi.boolean().default(true),
  }),
  vmCreate: Joi.object({
    nameLabel: Joi.string().trim().required().min(1).max(120),
    nameDescription: Joi.string().allow('').max(500).default(''),
    creationMode: Joi.string().valid('operating-system', 'template').required(),
    sourceRef: Joi.string().required().pattern(/^OpaqueRef:/),
    operatingSystemProfileId: Joi.string().allow('').max(80).default(''),
    hostRef: Joi.string().allow('').pattern(/^OpaqueRef:/).default(''),
    vcpus: Joi.number().integer().min(1).max(64).default(2),
    memoryGiB: Joi.number().min(1).max(1024).default(4),
    coresPerSocket: Joi.number().integer().valid(1, 2, 4, 8, 16, 32).default(1),
    installMedia: Joi.string().valid('iso', 'pxe', 'none').default('iso'),
    bootMode: Joi.string().valid('bios', 'uefi', 'uefi-secure').default('bios'),
    addVtpm: Joi.boolean().default(false),
    vmGroupRef: Joi.string().allow('').pattern(/^OpaqueRef:/).default(''),
    vgpuTypeRef: Joi.string().allow('').pattern(/^OpaqueRef:/).default(''),
    gpuGroupRef: Joi.string().allow('').pattern(/^OpaqueRef:/).default(''),
    diskPlan: Joi.array().items(Joi.object({
      sourceDevice: Joi.string().allow('').max(12).default(''),
      srRef: Joi.string().required().pattern(/^OpaqueRef:/),
      sizeGiB: Joi.number().integer().min(1).max(65536).required(),
      nameLabel: Joi.string().allow('').max(120).default(''),
      nameDescription: Joi.string().allow('').max(500).default(''),
      bootable: Joi.boolean().default(false),
    })).min(1).max(16).required(),
    isoVdiRef: Joi.string().allow('').pattern(/^OpaqueRef:/).default(''),
    networkInterfaces: Joi.array().items(Joi.object({
      networkRef: Joi.string().required().pattern(/^OpaqueRef:/),
      mac: Joi.string().allow('').max(64).default(''),
    })).max(16).default([]),
    tags: Joi.array().items(Joi.string().trim().min(1).max(64)).max(24).default([]),
    projectId: Joi.number().integer().min(1).allow(null).default(null),
    startAfter: Joi.boolean().default(false),
  }).custom((value, helpers) => {
    if (value.creationMode === 'operating-system' && !value.diskPlan.some((disk) => disk.bootable)) return helpers.error('any.custom', { message: 'An operating-system installation requires a bootable root disk.' });
    if (value.addVtpm && value.bootMode !== 'uefi-secure') return helpers.error('any.custom', { message: 'A virtual TPM requires UEFI Secure Boot.' });
    if (value.vcpus % value.coresPerSocket !== 0) return helpers.error('any.custom', { message: 'coresPerSocket must divide evenly into vcpus.' });
    if (value.vgpuTypeRef && !value.gpuGroupRef) return helpers.error('any.custom', { message: 'gpuGroupRef is required when selecting a vGPU profile.' });
    if (!value.vgpuTypeRef && value.gpuGroupRef) return helpers.error('any.custom', { message: 'vgpuTypeRef is required when selecting a GPU group.' });
    if (value.installMedia !== 'iso' && value.isoVdiRef) return helpers.error('any.custom', { message: 'isoVdiRef can only be used with ISO installation media.' });
    return value;
  }),
  vmDuplicateCreate: Joi.object({
    nameLabel: Joi.string().trim().required().min(1).max(120),
    nameDescription: Joi.string().allow('').max(500).default(''),
    mode: Joi.string().valid('clone', 'copy').default('clone'),
    srRef: Joi.alternatives().conditional('mode', {
      is: 'copy',
      then: Joi.string().required().pattern(/^OpaqueRef:/),
      otherwise: Joi.string().allow('').default(''),
    }),
    startAfter: Joi.boolean().default(false),
  }),
  vmMigrationCreate: Joi.object({
    mode: Joi.string().valid('same-pool', 'cross-pool').default('same-pool'),
    hostRef: Joi.string().allow('').pattern(/^OpaqueRef:/).default(''),
    destinationTargetKey: Joi.string().allow('').max(200).default(''),
    transferNetworkRef: Joi.string().allow('').pattern(/^OpaqueRef:/).default(''),
    srRef: Joi.string().allow('').pattern(/^OpaqueRef:/).default(''),
    vifNetworkMap: Joi.array().items(
      Joi.object({
        vifRef: Joi.string().required().pattern(/^OpaqueRef:/),
        networkRef: Joi.string().required().pattern(/^OpaqueRef:/),
      })
    ).default([]),
    live: Joi.boolean().default(true),
    copy: Joi.boolean().default(false),
    force: Joi.boolean().default(false),
    compress: Joi.boolean().default(true),
    setAsHomeServer: Joi.boolean().default(false),
  }).custom((value, helpers) => {
    if (value.mode === 'cross-pool') {
      if (!String(value.destinationTargetKey || '').trim()) {
        return helpers.error('any.custom', { message: 'destinationTargetKey is required for cross-pool migrations.' });
      }
      if (!String(value.transferNetworkRef || '').trim()) {
        return helpers.error('any.custom', { message: 'transferNetworkRef is required for cross-pool migrations.' });
      }
      if (!String(value.srRef || '').trim()) {
        return helpers.error('any.custom', { message: 'srRef is required for cross-pool migrations.' });
      }
      if (value.copy && value.live) {
        return helpers.error('any.custom', { message: 'copy and live cannot both be enabled for the same cross-pool migration.' });
      }
      return value;
    }

    if (!String(value.hostRef || '').trim()) {
      return helpers.error('any.custom', { message: 'hostRef is required for same-pool migrations.' });
    }

    return value;
  }, 'vm migration mode validation'),
  vmExportQuery: Joi.object({
    metadataOnly: Joi.boolean().default(false),
  }),
  vmImportQuery: Joi.object({
    srRef: Joi.string().allow('').pattern(/^OpaqueRef:/).default(''),
    restore: Joi.boolean().default(false),
    force: Joi.boolean().default(false),
    metadataOnly: Joi.boolean().default(false),
  }),
  vmSnapshotParams: Joi.object({
    ref: Joi.string().required().pattern(/^OpaqueRef:/),
    snapshotRef: Joi.string().required().pattern(/^OpaqueRef:/),
  }),
  vmSnapshotCreate: Joi.object({
    nameLabel: Joi.string().trim().required().min(1).max(120),
    nameDescription: Joi.string().allow('').max(500).default(''),
    mode: Joi.string().valid('snapshot', 'checkpoint').default('snapshot'),
  }),
  vmSnapshotMutation: Joi.object({
    approvalId: Joi.string().allow('').max(120).default(''),
  }),
  hostMaintenanceEnter: Joi.object({
    networkRef: Joi.alternatives().conditional('evacuateRunningVms', {
      is: true,
      then: Joi.string().required().pattern(/^OpaqueRef:/),
      otherwise: Joi.string().allow('').default(''),
    }),
    evacuateBatchSize: Joi.number().integer().min(0).max(64).default(0),
    evacuateRunningVms: Joi.boolean().default(true),
  }),
  hostMaintenanceExit: Joi.object({}),
  hostPowerMutation: Joi.object({
    approvalId: Joi.string().allow('').max(120).default(''),
  }),
  hostMultipathingUpdate: Joi.object({
    enabled: Joi.boolean().required(),
    approvalId: Joi.string().allow('').max(120).default(''),
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
  templateCreate: Joi.object({
    kind: Joi.string().valid('operating-system', 'deployable').required(),
    sourceRef: Joi.string().required().pattern(/^OpaqueRef:/),
    nameLabel: Joi.string().trim().required().min(1).max(120),
    nameDescription: Joi.string().allow('').max(500).default(''),
    tags: Joi.array().items(Joi.string().trim().min(1).max(64)).max(24).default([]),
  }),
  composeDeploy: Joi.object({
    version: Joi.string().valid('1').default('1'),
    name: Joi.string().trim().required().min(1).max(120),
    variables: Joi.object().pattern(Joi.string(), Joi.alternatives().try(Joi.string(), Joi.number(), Joi.boolean())).default({}),
    networks: Joi.object().pattern(Joi.string(), Joi.object({ ref: Joi.string().trim().required().max(200) })).default({}),
    storageRepositories: Joi.object().pattern(Joi.string(), Joi.object({ ref: Joi.string().trim().required().max(200) })).default({}),
    targetKey: Joi.string().allow('', null).max(200).default(null),
    projectId: Joi.number().integer().min(1).allow(null).default(null),
    startAfter: Joi.boolean().default(true),
    vms: Joi.object().pattern(
      Joi.string().min(1).max(64),
      Joi.object({
        creationMode: Joi.string().valid('template', 'operating-system').default('template'),
        template: Joi.string().trim().min(1).max(200).when('creationMode', { is: 'template', then: Joi.required(), otherwise: Joi.forbidden() }),
        source: Joi.string().trim().min(1).max(200).when('creationMode', { is: 'operating-system', then: Joi.required(), otherwise: Joi.forbidden() }),
        operatingSystemProfileId: Joi.string().trim().max(200).default(''),
        nameLabel: Joi.string().trim().required().min(1).max(120),
        nameDescription: Joi.string().allow('').max(500).default(''),
        memoryStaticMax: Joi.alternatives().try(Joi.number().positive(), Joi.string().trim().min(1)).required(),
        memoryDynamicMin: Joi.alternatives().try(Joi.number().positive(), Joi.string().trim().min(1)).optional(),
        memoryDynamicMax: Joi.alternatives().try(Joi.number().positive(), Joi.string().trim().min(1)).optional(),
        vcpusAtStartup: Joi.alternatives().try(Joi.number().integer().positive(), Joi.string().trim().min(1)).default(1),
        vcpusMax: Joi.alternatives().try(Joi.number().integer().positive(), Joi.string().trim().min(1)).default(1),
        affinity: Joi.string().allow('', null).max(200).default(null),
        disks: Joi.array().items(Joi.object({
          sr: Joi.string().trim().required().max(200),
          sizeGb: Joi.alternatives().try(Joi.number().positive(), Joi.string().trim().min(1)).required(),
          nameLabel: Joi.string().trim().max(120).default(''),
          nameDescription: Joi.string().allow('').max(500).default(''),
          bootable: Joi.forbidden(),
          mode: Joi.forbidden(),
        })).max(16).default([]),
        networkInterfaces: Joi.array().items(Joi.object({
          network: Joi.string().trim().required().max(200),
          mac: Joi.string().allow('').pattern(/^([0-9a-f]{2}:){5}[0-9a-f]{2}$/i).default(''),
          device: Joi.forbidden(),
        })).max(16).default([]),
        otherConfig: Joi.object().pattern(Joi.string(), Joi.string().allow('')).default({}),
        xenstoreData: Joi.object().pattern(Joi.string(), Joi.string().allow('')).default({}),
        tags: Joi.array().items(Joi.string().trim().min(1).max(64)).max(24).default([]),
        dependsOn: Joi.array().items(Joi.string().min(1).max(64)).max(32).default([]),
        startAfter: Joi.boolean().optional(),
      })
    ).min(1).max(32).required(),
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
  templateHistoryRestoreParams: Joi.object({
    ref: Joi.string().required().pattern(/^OpaqueRef:/),
    id: Joi.string().trim().required().min(1).max(160),
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
    matchClass: Joi.string().allow('').valid('', 'host', 'sr', 'vdi', 'vbd', 'vm', 'pool', 'network', 'vif', 'pif', 'bond', 'vlan', 'task').default(''),
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
    relatedClass: Joi.string().allow('').valid('', 'host', 'sr', 'vdi', 'vbd', 'vm', 'pool', 'network', 'vif', 'pif', 'bond', 'vlan', 'task', 'alert').default(''),
    workspaceSummary: Joi.string().allow('').max(240).default(''),
    evidenceChecklist: Joi.array().items(Joi.string().trim().min(1).max(200)).max(8).default([]),
    completionCriteria: Joi.array().items(Joi.string().trim().min(1).max(200)).max(8).default([]),
    lifecyclePlanSeed: lifecyclePlanSeedSchema.allow(null).default(null),
    resilienceRunbookSeed: resilienceRunbookSeedSchema.allow(null).default(null),
    vmMigrationSeed: vmMigrationSeedSchema.allow(null).default(null),
    templateId: Joi.string().allow('').max(120).default(''),
    templateName: Joi.string().allow('').max(120).default(''),
    templateLaunchMode: Joi.string().valid(...remediationLaunchModeValues).default('draft'),
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
    matchClass: Joi.string().allow('').valid('', 'host', 'sr', 'vdi', 'vbd', 'vm', 'pool', 'network', 'vif', 'pif', 'bond', 'vlan', 'task', 'alert').default(''),
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
    vmMigrationSeed: vmMigrationSeedSchema.allow(null).default(null),
    launchMode: Joi.string().valid(...remediationLaunchModeValues).default('draft'),
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
  vFabricQuotaUpdate: Joi.object({
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
    section: Joi.string().valid('general', 'network', 'security', 'logging', 'performance', 'interaction', 'retention').required(),
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
  systemConfigPerformanceUpdate: Joi.object({
    collectionEnabled: Joi.boolean().default(true),
    collectionIntervalSeconds: Joi.number().integer().min(30).max(3600).default(60),
  }),
  systemConfigInteractionUpdate: Joi.object({
    undoDelaySeconds: Joi.number().integer().min(1).max(60).default(5),
  }),
  systemConfigRetentionUpdate: Joi.object({
    sweepIntervalHours: Joi.number().integer().min(1).max(168).default(24),
    vacuumAfterSweep: Joi.boolean().default(true),
  }),
  retentionDomainParam: Joi.object({
    domain: Joi.string().valid('audit-log', 'remediation-tasks', 'auth-events', 'template-deployment-runs', 'metric-samples', 'metric-hourly-rollups').required(),
  }),
  retentionPolicyUpdate: Joi.object({
    retentionDays: Joi.number().integer().min(1).max(3650).required(),
    enabled: Joi.boolean().default(true),
  }),
  retentionRun: Joi.object({
    domain: Joi.string().allow('').valid('', 'audit-log', 'remediation-tasks', 'auth-events', 'template-deployment-runs', 'metric-samples', 'metric-hourly-rollups').default(''),
    dryRun: Joi.boolean().default(false),
    approvalId: Joi.string().allow('').max(120).default(''),
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
  metricRrdQuery: Joi.object({
    start: Joi.number().integer().min(0).optional(),
    cf: Joi.string().valid('AVERAGE', 'MIN', 'MAX').default('AVERAGE'),
    interval: Joi.number().integer().min(1).max(86400).default(60),
    host: Joi.boolean().default(false),
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
  templateLibraryNumericId: Joi.object({
    id: Joi.number().integer().min(1).required(),
  }),
  templateLibraryFolderCreate: Joi.object({
    name: Joi.string().trim().required().min(1).max(120),
    parentId: Joi.alternatives().try(
      Joi.number().integer().min(1),
      Joi.allow(null)
    ).default(null),
    visibility: Joi.string().valid('private', 'shared').default('private'),
  }),
  templateLibraryFolderRename: Joi.object({
    name: Joi.string().trim().required().min(1).max(120),
  }),
  templateLibraryFolderMove: Joi.object({
    parentId: Joi.alternatives().try(
      Joi.number().integer().min(1),
      Joi.allow(null)
    ).default(null),
  }),
  templateLibraryItemCreate: Joi.object({
    folderId: Joi.alternatives().try(
      Joi.number().integer().min(1),
      Joi.allow(null)
    ).default(null),
    kind: Joi.string().valid('deployment-template', 'guest-script', 'snippet').default('snippet'),
    name: Joi.string().trim().required().min(1).max(160),
    language: Joi.string().valid('json', 'shell', 'yaml', 'plaintext', 'powershell').default('json'),
    content: Joi.string().allow('').max(200000).default(''),
    visibility: Joi.string().valid('private', 'shared').default('private'),
  }),
  templateLibraryItemRename: Joi.object({
    name: Joi.string().trim().required().min(1).max(160),
  }),
  templateLibraryItemMove: Joi.object({
    folderId: Joi.alternatives().try(
      Joi.number().integer().min(1),
      Joi.allow(null)
    ).default(null),
  }),
  templateLibraryItemSave: Joi.object({
    content: Joi.string().allow('').max(200000).required(),
  }),
  vFabricIdParam: Joi.object({
    id: Joi.number().integer().min(1).required(),
  }),
  vFabricCreate: Joi.object({
    name: Joi.string().trim().required().min(1).max(120),
    description: Joi.string().allow('').max(500).default(''),
    colorTag: Joi.string().valid('green', 'cyan', 'amber', 'red').default('green'),
    visibility: Joi.string().valid('private', 'shared').default('private'),
    connectionIds: Joi.array().items(Joi.number().integer().min(1)).unique().max(100).default([]),
    hostTargetIds: Joi.array().items(Joi.number().integer().min(1)).unique().max(100).default([]),
  }),
  vFabricUpdate: Joi.object({
    name: Joi.string().trim().required().min(1).max(120),
    description: Joi.string().allow('').max(500).default(''),
    colorTag: Joi.string().valid('green', 'cyan', 'amber', 'red').default('green'),
    visibility: Joi.string().valid('private', 'shared').default('private'),
    connectionIds: Joi.array().items(Joi.number().integer().min(1)).unique().max(100).default([]),
    hostTargetIds: Joi.array().items(Joi.number().integer().min(1)).unique().max(100).default([]),
  }),
};

module.exports = { validate, schemas };
