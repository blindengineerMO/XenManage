function parseDateValue(value) {
  const date = new Date(value || 0);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function sortByRecent(items, getValue) {
  return [...items].sort((left, right) => parseDateValue(getValue(right)) - parseDateValue(getValue(left)));
}

function getTaskName(task) {
  return `${task?.name_label || ''} ${task?.name_description || ''}`.toLowerCase();
}

function getMessageText(message) {
  return `${message?.name || ''} ${message?.body || ''} ${message?.cls || ''}`.toLowerCase();
}

function isResilienceTask(task) {
  return /(snapshot|backup|protect|replicat|failover|recover|restore|drill|migrat|evacuat)/.test(getTaskName(task));
}

function isResilienceMessage(message) {
  return /(failover|backup|recovery|restore|snapshot|replicat|protect|ha|disaster|evacuat|latency|storage)/.test(getMessageText(message));
}

function getSeverity(value) {
  const haystack = String(value || '').toLowerCase();

  if (/(critical|fatal|failed|failure|panic|error|offline|down|corrupt|timeout|lag|missed)/.test(haystack)) {
    return 'critical';
  }

  if (/(warn|warning|degraded|threshold|latency|retry|paused|stopped|maintenance|high|review)/.test(haystack)) {
    return 'warning';
  }

  if (/(resolved|healthy|restored|recovered|success|info|notice|complete)/.test(haystack)) {
    return 'info';
  }

  return 'notice';
}

function taskMatchesEntity(task, entity) {
  const haystack = `${task?.name_label || ''} ${task?.name_description || ''} ${task?.resident_on || ''}`.toLowerCase();
  const needles = [entity.ref, entity.uuid, entity.name_label, entity.name_description]
    .map((value) => String(value || '').toLowerCase().trim())
    .filter(Boolean);

  return needles.some((needle) => haystack.includes(needle));
}

function messageMatchesEntity(message, entity) {
  const haystack = `${message?.name || ''} ${message?.body || ''} ${message?.obj_uuid || ''}`.toLowerCase();
  const needles = [entity.uuid, entity.name_label, entity.name_description]
    .map((value) => String(value || '').toLowerCase().trim())
    .filter(Boolean);

  return needles.some((needle) => haystack.includes(needle));
}

function buildPolicyTier(vm) {
  const tags = (vm.tags || []).map((tag) => String(tag).toLowerCase());
  if (tags.some((tag) => ['prod', 'production', 'critical'].includes(tag))) return 'Tier-1';
  if (tags.some((tag) => ['edge', 'branch'].includes(tag))) return 'Edge';
  if (tags.some((tag) => ['staging', 'dev', 'test'].includes(tag))) return 'Non-Prod';
  return 'Standard';
}

function buildProtectionPolicies(vms, tasks, messages) {
  return vms.map((vm) => {
    const relatedTasks = sortByRecent(tasks.filter((task) => taskMatchesEntity(task, vm)), (task) => task.finished || task.created);
    const relatedMessages = sortByRecent(messages.filter((message) => messageMatchesEntity(message, vm)), (message) => message.timestamp);
    const lastSuccessTask = relatedTasks.find((task) => String(task.status || '').toLowerCase() === 'success');
    const criticalMessage = relatedMessages.find((message) => getSeverity(`${message.name} ${message.body}`) === 'critical');
    const tier = buildPolicyTier(vm);

    let status = 'info';
    let recommendation = 'Baseline protection policy should be reviewed for this workload.';

    if (criticalMessage) {
      status = 'critical';
      recommendation = 'Investigate the latest protection alert before relying on this workload for failover or restore operations.';
    } else if (lastSuccessTask) {
      status = 'success';
      recommendation = 'Recent successful protection activity was detected. Validate restore drills during the next maintenance cycle.';
    } else if (tier === 'Tier-1' && String(vm.power_state || '').toLowerCase() === 'running') {
      status = 'warning';
      recommendation = 'This production workload appears active without a recent resilience task in view. Confirm backup and snapshot coverage.';
    } else if (String(vm.power_state || '').toLowerCase() === 'suspended') {
      status = 'warning';
      recommendation = 'Suspended workloads should still be checked for snapshot and restore currency before planned maintenance.';
    }

    return {
      ref: vm.ref,
      name_label: vm.name_label || 'Virtual Machine',
      power_state: vm.power_state || 'Unknown',
      policy: tier,
      status,
      hasRecentProtection: Boolean(lastSuccessTask),
      lastProtectedAt: lastSuccessTask?.finished || lastSuccessTask?.created || '',
      lastTaskLabel: lastSuccessTask?.name_label || relatedTasks[0]?.name_label || 'No recent protection task',
      lastAlertLabel: criticalMessage?.name || relatedMessages[0]?.name || 'No resilience alerts',
      recommendation,
      tags: vm.tags || [],
      uuid: vm.uuid || '',
    };
  });
}

function buildHostPlans(hosts, tasks, messages) {
  const enabledHosts = hosts.filter((host) => host.enabled);

  return hosts.map((host) => {
    const relatedTasks = sortByRecent(tasks.filter((task) => taskMatchesEntity(task, host)), (task) => task.finished || task.created);
    const relatedMessages = sortByRecent(messages.filter((message) => messageMatchesEntity(message, host)), (message) => message.timestamp);
    const evacuationTarget = enabledHosts.find((candidate) => candidate.ref !== host.ref);
    const pendingTask = relatedTasks.find((task) => ['pending', 'queued'].includes(String(task.status || '').toLowerCase()));
    const criticalMessage = relatedMessages.find((message) => getSeverity(`${message.name} ${message.body}`) === 'critical');

    let status = 'success';
    let summary = 'Failover posture looks healthy.';

    if (!host.enabled) {
      status = 'disabled';
      summary = 'Host is disabled or in maintenance posture.';
    } else if (criticalMessage) {
      status = 'critical';
      summary = 'Recent alerts indicate resilience risk on this host.';
    } else if (pendingTask) {
      status = 'pending';
      summary = 'Lifecycle or evacuation work is currently in progress.';
    } else if (relatedMessages.length) {
      status = 'warning';
      summary = 'Recent resilience-adjacent alerts should be reviewed.';
    }

    return {
      ref: host.ref,
      name_label: host.name_label || host.hostname || 'Host',
      address: host.address || '',
      status,
      evacuationTarget: evacuationTarget ? (evacuationTarget.name_label || evacuationTarget.hostname || evacuationTarget.ref) : 'No alternate host available',
      residentVmCount: Array.isArray(host.resident_VMs) ? host.resident_VMs.length : 0,
      recentTask: relatedTasks[0]?.name_label || 'No recent host resilience task',
      recentAlert: criticalMessage?.name || relatedMessages[0]?.name || 'No recent host alert',
      summary,
      other_config: host.other_config || {},
      uuid: host.uuid || '',
    };
  });
}

function buildRecoveryPlans(pools, hosts, protectionPolicies) {
  return pools.map((pool) => {
    const poolHosts = hosts.filter((host) => String(host.pool || '').toLowerCase() === String(pool.ref || '').toLowerCase());
    const enabledHostCount = poolHosts.filter((host) => host.enabled).length;
    const protectedVmCount = protectionPolicies.filter((policy) => policy.hasRecentProtection).length;
    const atRiskVmCount = protectionPolicies.filter((policy) => ['critical', 'warning'].includes(policy.status)).length;

    let status = 'success';
    let nextAction = 'Validate periodic restore drills and maintain a recent evacuation target list.';

    if (enabledHostCount < 2) {
      status = 'warning';
      nextAction = 'Add or re-enable additional failover capacity before relying on this pool for resilient recovery operations.';
    }

    if (atRiskVmCount > protectedVmCount && atRiskVmCount > 0) {
      status = 'critical';
      nextAction = 'Protection coverage appears thin relative to at-risk workloads. Prioritize backup verification and recovery testing.';
    }

    return {
      ref: pool.ref,
      name_label: pool.name_label || 'Pool',
      status,
      enabledHostCount,
      protectedVmCount,
      atRiskVmCount,
      nextAction,
      uuid: pool.uuid || '',
    };
  });
}

function buildRecentEvents(tasks, messages) {
  const taskEvents = tasks
    .filter(isResilienceTask)
    .map((task) => ({
      type: 'task',
      ref: task.ref,
      label: task.name_label || 'Task',
      status: task.status || 'info',
      timestamp: task.finished || task.created || '',
      detail: task.name_description || '',
    }));

  const messageEvents = messages
    .filter(isResilienceMessage)
    .map((message) => ({
      type: 'alert',
      ref: message.ref,
      label: message.name || 'Alert',
      status: getSeverity(`${message.name} ${message.body}`),
      timestamp: message.timestamp || '',
      detail: message.body || '',
    }));

  return sortByRecent([...taskEvents, ...messageEvents], (event) => event.timestamp).slice(0, 12);
}

function buildResilienceOverview({ pools = [], hosts = [], vms = [], tasks = [], messages = [] }) {
  const activeVms = vms.filter((vm) => !vm.is_a_template);
  const resilienceTasks = tasks.filter(isResilienceTask);
  const resilienceMessages = messages.filter(isResilienceMessage);
  const protectionPolicies = buildProtectionPolicies(activeVms, resilienceTasks, resilienceMessages);
  const hostPlans = buildHostPlans(hosts, resilienceTasks, resilienceMessages);
  const recoveryPlans = buildRecoveryPlans(pools, hosts, protectionPolicies);
  const recentEvents = buildRecentEvents(resilienceTasks, resilienceMessages);

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      protectedVmCount: protectionPolicies.filter((policy) => policy.hasRecentProtection).length,
      atRiskVmCount: protectionPolicies.filter((policy) => ['critical', 'warning'].includes(policy.status)).length,
      maintenanceHostCount: hostPlans.filter((plan) => plan.status === 'disabled').length,
      recoveryPlanCount: recoveryPlans.length,
      recentEventCount: recentEvents.length,
    },
    protectionPolicies,
    hostPlans,
    recoveryPlans,
    recentEvents,
  };
}

module.exports = {
  buildResilienceOverview,
  isResilienceTask,
  isResilienceMessage,
};
