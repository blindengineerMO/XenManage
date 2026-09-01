const { deploymentRunModel } = require('../models/connection');

function buildRunStatus(validationStatus = 'pending', notes = '', vmName = 'VM') {
  const status = String(validationStatus || 'pending').trim().toLowerCase();
  const normalizedNotes = String(notes || '').trim();

  if (status === 'validated') {
    return {
      runStatus: 'success',
      progress: 1,
      finishedAt: new Date().toISOString(),
      result: normalizedNotes || `${vmName} provisioning and post-deploy validation completed successfully.`,
      validationStepStatus: 'success',
    };
  }

  if (status === 'failed') {
    return {
      runStatus: 'failure',
      progress: 1,
      finishedAt: new Date().toISOString(),
      result: normalizedNotes || `${vmName} was provisioned, but post-deploy validation failed and needs operator follow-through.`,
      validationStepStatus: 'failure',
    };
  }

  if (status === 'warning') {
    return {
      runStatus: 'warning',
      progress: 0.9,
      finishedAt: null,
      result: normalizedNotes || `${vmName} was provisioned and is waiting for operator review before it can be treated as a validated baseline deployment.`,
      validationStepStatus: 'warning',
    };
  }

  return {
    runStatus: 'pending',
    progress: 0.8,
    finishedAt: null,
    result: normalizedNotes || `${vmName} was provisioned and is waiting for post-deploy validation checks.`,
    validationStepStatus: 'pending',
  };
}

function buildDeploymentSteps({ templateName, vmName, hostRef, networkRef, startAfter, validationStatus, validationNotes }) {
  const status = buildRunStatus(validationStatus, validationNotes, vmName);

  return [
    {
      key: 'clone',
      label: 'Clone Template',
      status: 'success',
      detail: `${templateName || 'Template'} was cloned into ${vmName || 'the target VM'}.`,
    },
    {
      key: 'config',
      label: 'Apply VM Configuration',
      status: 'success',
      detail: 'Compute, naming, and metadata settings were applied to the deployed VM.',
    },
    {
      key: 'affinity',
      label: 'Place on Target Host',
      status: hostRef ? 'success' : 'info',
      detail: hostRef
        ? `Initial placement was directed to ${hostRef}.`
        : 'No explicit host placement was requested for this deployment.',
    },
    {
      key: 'network',
      label: 'Attach Primary Network',
      status: networkRef ? 'success' : 'info',
      detail: networkRef
        ? `Primary network attachment was requested for ${networkRef}.`
        : 'No explicit primary network attachment was requested at deploy time.',
    },
    {
      key: 'power',
      label: 'Initial Power Action',
      status: startAfter ? 'success' : 'info',
      detail: startAfter
        ? 'The deployed VM was started after provisioning completed.'
        : 'The deployed VM was left halted for operator-led validation.',
    },
    {
      key: 'validation',
      label: 'Post-Deploy Validation',
      status: status.validationStepStatus,
      detail: String(validationNotes || '').trim() || status.result,
    },
  ];
}

function normalizeTask(run = {}) {
  const isCompose = String(run.run_kind || 'template').trim().toLowerCase() === 'compose';
  return {
    ref: run.id,
    uuid: `${isCompose ? 'compose-deployment' : 'template-deployment'}-${run.id}`,
    name_label: run.vm_name || (isCompose ? 'Compose Deployment' : 'Template Deployment'),
    name_description: run.result || run.validation_notes || `${isCompose ? 'Compose deployment' : 'Deployment'} run for ${run.template_name || run.template_ref || 'template'}.`,
    status: run.status || 'pending',
    progress: Number(run.progress || 0),
    created: run.submitted_at || '',
    finished: run.finished_at || '',
    result: run.result || '',
    error_info: (run.steps || [])
      .filter((step) => String(step.status || '').toLowerCase() === 'failure' && step.detail)
      .map((step) => String(step.detail)),
    resident_on: run.host_ref || '',
    task_kind: isCompose ? 'compose_deployment' : 'template_deployment',
    source: isCompose ? 'compose_deployment' : 'template_deployment',
    run_kind: isCompose ? 'compose' : 'template',
    template_ref: run.template_ref || '',
    template_name: run.template_name || '',
    template_version: run.template_version || '',
    vm_ref: run.vm_ref || '',
    vm_name: run.vm_name || '',
    host_ref: run.host_ref || '',
    host_label: run.host_label || '',
    storage_ref: run.storage_ref || '',
    storage_label: run.storage_label || '',
    network_ref: run.network_ref || '',
    network_label: run.network_label || '',
    submitted_by: run.submitted_by || '',
    validation_status: run.validation_status || 'pending',
    validation_notes: run.validation_notes || '',
    guest_customization: run.guest_customization || '',
    boot_verified: Boolean(run.boot_verified),
    network_verified: Boolean(run.network_verified),
    storage_verified: Boolean(run.storage_verified),
    policy_tagged: Boolean(run.policy_tagged),
    start_after: Boolean(run.start_after),
    target_route: run.target_route || '/vms',
    related_class: 'vm',
    related_object: run.vm_ref || '',
    steps: Array.isArray(run.steps) ? run.steps.map((step) => ({
      key: step.step_key || step.key || '',
      label: step.step_label || step.label || '',
      status: step.status || 'pending',
      detail: step.detail || '',
      started_at: step.started_at || '',
      finished_at: step.finished_at || '',
      error_text: step.error_text || '',
    })) : [],
  };
}

const templateDeploymentRunService = {
  listTasks() {
    return deploymentRunModel.list().map(normalizeTask);
  },

  recordDeployment({
    deploymentAudit,
    templateRef,
    templateName,
    vmRef,
    vmName,
    hostRef = '',
    hostLabel = '',
    storageRef = '',
    storageLabel = '',
    networkRef = '',
    networkLabel = '',
  }) {
    const runStatus = buildRunStatus(deploymentAudit.validationStatus, deploymentAudit.validationNotes, vmName);
    const steps = buildDeploymentSteps({
      templateName,
      vmName,
      hostRef,
      networkRef,
      startAfter: Boolean(deploymentAudit.startAfter),
      validationStatus: deploymentAudit.validationStatus,
      validationNotes: deploymentAudit.validationNotes,
    });

    return normalizeTask(deploymentRunModel.create({
      deploymentAuditId: deploymentAudit.id,
      templateRef,
      templateName,
      templateVersion: deploymentAudit.templateVersion || '',
      vmRef,
      vmName,
      hostRef,
      hostLabel,
      storageRef,
      storageLabel,
      networkRef,
      networkLabel,
      submittedBy: deploymentAudit.submittedBy || '',
      submittedAt: deploymentAudit.submittedAt || new Date().toISOString(),
      finishedAt: runStatus.finishedAt,
      status: runStatus.runStatus,
      progress: runStatus.progress,
      startAfter: Boolean(deploymentAudit.startAfter),
      validationStatus: deploymentAudit.validationStatus,
      validationNotes: deploymentAudit.validationNotes,
      guestCustomization: deploymentAudit.guestCustomization || '',
      bootVerified: Boolean(deploymentAudit.bootVerified),
      networkVerified: Boolean(deploymentAudit.networkVerified),
      storageVerified: Boolean(deploymentAudit.storageVerified),
      policyTagged: Boolean(deploymentAudit.policyTagged),
      result: runStatus.result,
      targetRoute: '/vms',
    }, steps));
  },

  syncValidationByDeploymentAudit(record = {}) {
    const existing = deploymentRunModel.getByDeploymentAuditId(record.id);
    if (!existing) return null;

    const runStatus = buildRunStatus(record.validationStatus, record.validationNotes, record.vmName || existing.vm_name || 'VM');
    const steps = Array.isArray(existing.steps) ? existing.steps.map((step) => {
      if (String(step.step_key || '').toLowerCase() !== 'validation') {
        return step;
      }

      return {
        ...step,
        status: runStatus.validationStepStatus,
        detail: String(record.validationNotes || '').trim() || runStatus.result,
        finished_at: runStatus.finishedAt,
      };
    }) : [];

    return normalizeTask(deploymentRunModel.update(existing.id, {
      validation_status: record.validationStatus || existing.validation_status,
      validation_notes: record.validationNotes || '',
      guest_customization: record.guestCustomization || '',
      boot_verified: Boolean(record.bootVerified),
      network_verified: Boolean(record.networkVerified),
      storage_verified: Boolean(record.storageVerified),
      policy_tagged: Boolean(record.policyTagged),
      status: runStatus.runStatus,
      progress: runStatus.progress,
      finished_at: runStatus.finishedAt,
      result: runStatus.result,
    }, steps.length ? steps : undefined));
  },
};

module.exports = templateDeploymentRunService;
