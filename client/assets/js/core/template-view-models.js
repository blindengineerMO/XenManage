function buildTemplateGovernanceMap(governanceRecords = []) {
  return Object.fromEntries((Array.isArray(governanceRecords) ? governanceRecords : []).map((record) => [record.templateRef, record]));
}

function getTemplateGovernanceRecord(governanceMap = {}, templateRef = '') {
  return governanceMap[templateRef] || null;
}

function getTemplateProfile(template = null, governanceMap = {}) {
  const governance = getTemplateGovernanceRecord(governanceMap, template?.ref || '');
  if (governance?.profileLabel) return governance.profileLabel;

  const tags = (template?.tags || []).map((tag) => String(tag).toLowerCase());
  if (tags.includes('windows')) return 'Windows';
  if (tags.includes('linux')) return 'Linux';
  if ((template?.platform || {}).vtpm) return 'Secure Windows';
  if ((template?.platform || {}).secureboot) return 'Secure Linux';
  return 'Standard';
}

function getTemplateLifecycleStage(template = null, governanceMap = {}) {
  const governance = getTemplateGovernanceRecord(governanceMap, template?.ref || '');
  if (governance?.lifecycleStage) return governance.lifecycleStage;

  const tags = (template?.tags || []).map((tag) => String(tag).toLowerCase());
  if (tags.includes('stable') || tags.includes('baseline')) return 'stable';
  if (tags.includes('staged') || tags.includes('candidate')) return 'staged';
  return 'draft';
}

function getTemplateValidationStatus(template = null, governanceMap = {}) {
  return getTemplateGovernanceRecord(governanceMap, template?.ref || '')?.validationStatus || 'untested';
}

function getTemplateVersionLabel(template = null, governanceMap = {}) {
  return getTemplateGovernanceRecord(governanceMap, template?.ref || '')?.versionLabel || '';
}

function getTemplateGuestCustomizationLabel(template = null, governanceMap = {}) {
  return getTemplateGovernanceRecord(governanceMap, template?.ref || '')?.guestCustomization || '';
}

function isTemplateGoldenImage(template = null, governanceMap = {}) {
  const governance = getTemplateGovernanceRecord(governanceMap, template?.ref || '');
  if (governance) return Boolean(governance.goldenImage);
  const tags = (template?.tags || []).map((tag) => String(tag).toLowerCase());
  return tags.includes('golden') || tags.includes('baseline');
}

function buildNormalizedTemplates(templates = [], governanceMap = {}) {
  return (Array.isArray(templates) ? templates : []).map((template) => ({
    ...template,
    versionLabel: getTemplateVersionLabel(template, governanceMap),
    profileLabel: getTemplateProfile(template, governanceMap),
    lifecycleStage: getTemplateLifecycleStage(template, governanceMap),
    validationStatus: getTemplateValidationStatus(template, governanceMap),
  }));
}

function buildTemplateResourceOptions(records = []) {
  return (Array.isArray(records) ? records : []).filter((record) => record && record.ref);
}

function buildRecentTemplateDeployments(deployments = [], limit = 8) {
  return (Array.isArray(deployments) ? deployments : []).slice(0, limit);
}

function canPromoteTemplateRecord(template = null, governanceMap = {}) {
  if (!template) return false;
  const governance = getTemplateGovernanceRecord(governanceMap, template.ref || '');
  return governance?.lifecycleStage === 'staged' && governance?.validationStatus === 'validated';
}

function resolveTemplatePromotionBaseline(template = null, normalizedTemplates = [], governanceMap = {}) {
  if (!template) return null;
  const governance = getTemplateGovernanceRecord(governanceMap, template.ref || '');
  const profileLabel = String(governance?.profileLabel || '').trim().toLowerCase();
  const candidates = (Array.isArray(normalizedTemplates) ? normalizedTemplates : [])
    .filter((entry) => entry.ref !== template.ref)
    .filter((entry) => {
      const entryGovernance = getTemplateGovernanceRecord(governanceMap, entry.ref || '');
      return entryGovernance?.lifecycleStage === 'stable'
        && profileLabel
        && String(entryGovernance.profileLabel || '').trim().toLowerCase() === profileLabel;
    })
    .sort((left, right) =>
      new Date(getTemplateGovernanceRecord(governanceMap, right.ref || '')?.updatedAt || 0)
      - new Date(getTemplateGovernanceRecord(governanceMap, left.ref || '')?.updatedAt || 0)
    );
  return candidates[0] || null;
}

function buildTemplatePromotionCandidates(normalizedTemplates = [], governanceMap = {}) {
  return (Array.isArray(normalizedTemplates) ? normalizedTemplates : [])
    .filter((template) => canPromoteTemplateRecord(template, governanceMap))
    .sort((left, right) =>
      new Date(getTemplateGovernanceRecord(governanceMap, right.ref || '')?.lastValidatedAt || 0)
      - new Date(getTemplateGovernanceRecord(governanceMap, left.ref || '')?.lastValidatedAt || 0)
    );
}

function buildTemplateGovernanceCoverageSummary(templates = [], governanceMap = {}) {
  const templateList = Array.isArray(templates) ? templates : [];
  const governed = templateList.filter((template) => Boolean(governanceMap[template.ref])).length;
  return `${governed} of ${templateList.length || 0} templates have persisted governance records`;
}

function buildTemplateValidationAttentionSummary(normalizedTemplates = [], recentDeployments = []) {
  const templateAttention = (Array.isArray(normalizedTemplates) ? normalizedTemplates : [])
    .filter((template) => ['untested', 'review', 'failed'].includes(template.validationStatus))
    .length;
  const deploymentAttention = (Array.isArray(recentDeployments) ? recentDeployments : [])
    .filter((deployment) => ['pending', 'warning', 'failed'].includes(deployment.validationStatus))
    .length;
  return `${templateAttention} templates and ${deploymentAttention} recent deployments need review`;
}

function buildSelectedTemplateDeployments(deployments = [], selectedTemplate = null) {
  if (!selectedTemplate?.ref) return [];
  return (Array.isArray(deployments) ? deployments : []).filter((deployment) => deployment.templateRef === selectedTemplate.ref);
}

function getTemplateHistoryEntries(governanceHistoryByTemplate = {}, templateRef = '') {
  return governanceHistoryByTemplate[templateRef] || [];
}

function buildTemplatePromotionDiffRows(promotionTemplateRecord = null, currentPromotionBaseline = null, governanceMap = {}) {
  if (!promotionTemplateRecord) return [];
  const baselineRecord = currentPromotionBaseline
    ? (getTemplateGovernanceRecord(governanceMap, currentPromotionBaseline.ref || '') || {})
    : {};
  const candidateRecord = getTemplateGovernanceRecord(governanceMap, promotionTemplateRecord.ref || '') || {};
  const rows = [
    { label: 'Version', current: baselineRecord.versionLabel || '', next: candidateRecord.versionLabel || '' },
    { label: 'Guest Customization', current: baselineRecord.guestCustomization || '', next: candidateRecord.guestCustomization || '' },
    { label: 'Validation Status', current: baselineRecord.validationStatus || '', next: candidateRecord.validationStatus || '' },
    { label: 'Validated At', current: baselineRecord.lastValidatedAt ? formatDateTime(baselineRecord.lastValidatedAt) : '', next: candidateRecord.lastValidatedAt ? formatDateTime(candidateRecord.lastValidatedAt) : '' },
    { label: 'Catalog Owner', current: baselineRecord.owner || '', next: candidateRecord.owner || '' },
    { label: 'Notes', current: baselineRecord.notes || '', next: candidateRecord.notes || '' },
  ];

  return rows.map((row) => ({
    ...row,
    current: row.current || '-',
    next: row.next || '-',
    changed: row.current !== row.next,
  }));
}

function buildTemplatePromotionDraft(template = null, baseline = null) {
  return {
    baselineTemplateRef: baseline?.ref || '',
    retireExistingStable: Boolean(baseline),
    promotionNotes: '',
  };
}

function mapTemplateValidationStatusBadge(status = '') {
  if (status === 'validated') return 'success';
  if (status === 'failed') return 'critical';
  if (status === 'review') return 'warning';
  return 'info';
}

function mapTemplateDeploymentStatusBadge(status = '') {
  if (status === 'validated') return 'success';
  if (status === 'failed') return 'critical';
  if (status === 'warning') return 'warning';
  return 'pending';
}

function buildTemplateStageBadgeClass(stage = '') {
  if (stage === 'stable') return 'badge-running';
  if (stage === 'staged') return 'badge-halted';
  if (stage === 'deprecated') return 'badge-error';
  return 'badge-info';
}

function countTemplatesByStage(normalizedTemplates = [], stage = '') {
  return (Array.isArray(normalizedTemplates) ? normalizedTemplates : []).filter((template) => template.lifecycleStage === stage).length;
}

function resolveTemplateDeploymentLabel(collection = [], ref = '', fallback = '') {
  const record = (Array.isArray(collection) ? collection : []).find((item) => item.ref === ref) || null;
  if (!record) return fallback || ref || '-';
  return record.name_label || record.hostname || record.bridge || record.address || record.ref || fallback || '-';
}

function findTemplateByFocus(normalizedTemplates = [], focus = null) {
  return (Array.isArray(normalizedTemplates) ? normalizedTemplates : []).find((template) =>
    recordMatchesRouteFocus(template, focus, ['ref', 'uuid', 'name_label', 'versionLabel'])
  ) || null;
}

function buildTemplateDeploymentSummary(deployments = [], templateRef = '') {
  const matching = (Array.isArray(deployments) ? deployments : []).filter((deployment) => deployment.templateRef === templateRef);
  const validated = matching.filter((deployment) => deployment.validationStatus === 'validated').length;
  return `${matching.length} deployment(s) · ${validated} validated`;
}

function formatTemplateHistoryEvent(eventType = '') {
  if (eventType === 'promoted') return 'Promoted to Stable';
  if (eventType === 'retired') return 'Retired Stable Baseline';
  if (eventType === 'restored') return 'Governance Restored';
  return 'Governance Saved';
}

function buildTemplateDeploymentMessage(record = {}, payload = {}, hostOptions = []) {
  const deploymentAudit = record.deploymentAudit || {};
  const hostLabel = resolveTemplateDeploymentLabel(hostOptions, deploymentAudit.hostRef || payload.hostRef, payload.hostRef || 'selected host');
  return `${record.name_label || payload.nameLabel} prepared on ${hostLabel}${payload.startAfter ? ' and started.' : '.'}`;
}

function buildTemplateHistoryRestoreMessage(record = {}, templateRef = '', entry = null) {
  return `${record.versionLabel || templateRef} reverted to the ${formatTemplateHistoryEvent(entry?.eventType || '').toLowerCase()} snapshot from ${formatDateTime(entry?.happenedAt)}.`;
}
