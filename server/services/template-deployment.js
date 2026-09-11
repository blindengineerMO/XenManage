const templateGovernanceService = require('./template-governance');
const templateDeploymentRunService = require('./template-deployment-runs');
const auditLogService = require('./audit-log');

async function deployTemplate({
  xenApi,
  templateRef,
  payload,
  submittedBy = '',
  auditOperator = 'system',
  route = '/templates',
  beforeDeploy,
} = {}) {
  if (!xenApi || !templateRef || !payload) {
    const error = new Error('TEMPLATE_DEPLOYMENT_INPUT_INVALID');
    error.code = 'TEMPLATE_DEPLOYMENT_INPUT_INVALID';
    throw error;
  }

  if (typeof beforeDeploy === 'function') await beforeDeploy(payload);

  const templateRecord = await xenApi.getRecord('VM', templateRef);
  const record = await xenApi.deployTemplate(templateRef, payload);
  const governance = templateGovernanceService.getGovernance(templateRef);

  const resolvedHostRef = payload.hostRef || record.affinity || '';
  const resolvedStorageRef = payload.storageRef || record.storageRef || '';
  const resolvedNetworkRef = payload.networkRef || '';
  const [hostRecord, storageRecord, networkRecord] = await Promise.all([
    resolvedHostRef ? xenApi.getRecord('host', resolvedHostRef).catch(() => null) : Promise.resolve(null),
    resolvedStorageRef ? xenApi.getRecord('SR', resolvedStorageRef).catch(() => null) : Promise.resolve(null),
    resolvedNetworkRef ? xenApi.getRecord('network', resolvedNetworkRef).catch(() => null) : Promise.resolve(null),
  ]);
  const hostLabel = hostRecord?.name_label || resolvedHostRef;
  const storageLabel = storageRecord?.name_label || resolvedStorageRef;
  const networkLabel = networkRecord?.name_label || resolvedNetworkRef;
  const deploymentAudit = templateGovernanceService.recordDeployment({
    templateRef,
    templateName: templateRecord?.name_label || templateRef,
    templateVersion: governance?.versionLabel || '',
    vmRef: record.ref,
    vmName: record.name_label || payload.nameLabel,
    hostRef: resolvedHostRef,
    hostLabel,
    storageRef: resolvedStorageRef,
    storageLabel,
    networkRef: resolvedNetworkRef,
    networkLabel,
    startAfter: Boolean(payload.startAfter),
    submittedBy,
    validationStatus: governance?.validationStatus === 'validated' ? 'pending' : 'warning',
    guestCustomization: governance?.guestCustomization || '',
    validationNotes: governance?.validationStatus === 'validated'
      ? 'Validate guest boot, networking, storage mapping, and policy tags after first start.'
      : 'Template governance is not fully validated yet. Review this deployment before promoting it.',
    bootVerified: false,
    networkVerified: false,
    storageVerified: false,
    policyTagged: Array.isArray(payload.tags) && payload.tags.length > 0,
  });
  const deploymentRun = templateDeploymentRunService.recordDeployment({
    deploymentAudit,
    templateRef,
    templateName: templateRecord?.name_label || templateRef,
    vmRef: record.ref,
    vmName: record.name_label || payload.nameLabel,
    hostRef: resolvedHostRef,
    hostLabel,
    storageRef: resolvedStorageRef,
    storageLabel,
    networkRef: resolvedNetworkRef,
    networkLabel,
  });
  auditLogService.record({
    category: 'templates', action: 'template_deployed', actionLabel: 'Deployed template to',
    entityType: 'vm', entityRef: record.ref, entityName: record.name_label || payload.nameLabel,
    operator: auditOperator, route, status: 'success', before: templateRecord,
    after: { ...record, deploymentAudit, deploymentRun },
    detail: `${templateRecord?.name_label || templateRef} deployed with ${deploymentAudit.validationStatus} validation status.`,
  });
  return { ...record, deploymentAudit, deploymentRun };
}

module.exports = { deployTemplate };
