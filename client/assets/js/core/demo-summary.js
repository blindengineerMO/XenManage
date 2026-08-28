function buildDemoDashboard() {
  const vms = demoDb.vms.filter((vm) => !vm.is_a_template);
  const templates = demoDb.vms.filter((vm) => vm.is_a_template);
  const vmStates = { running: 0, halted: 0, suspended: 0, paused: 0, other: 0 };

  for (const vm of vms) {
    const state = (vm.power_state || 'other').toLowerCase();
    if (vmStates[state] !== undefined) {
      vmStates[state] += 1;
    } else {
      vmStates.other += 1;
    }
  }

  const hostStates = {
    enabled: demoDb.hosts.filter((host) => host.enabled).length,
    disabled: demoDb.hosts.filter((host) => !host.enabled).length,
    offline: 0,
  };

  return {
    poolCount: demoDb.pools.length,
    hostCount: demoDb.hosts.length,
    vmCount: vms.length,
    templateCount: templates.length,
    srCount: demoDb.srs.length,
    networkCount: demoDb.networks.length,
    vmStates,
    hostStates,
    pools: clone(demoDb.pools),
    hosts: clone(demoDb.hosts.map((host) => ({ ref: host.ref, name: host.name_label, ...host }))),
  };
}

function buildDemoResilience() {
  const hostsByRef = Object.fromEntries(demoDb.hosts.map((host) => [host.ref, host]));
  const poolsByRef = Object.fromEntries(demoDb.pools.map((pool) => [pool.ref, pool]));
  const networksByRef = Object.fromEntries(demoDb.networks.map((network) => [network.ref, network]));
  const drillsByPool = demoDb.resilienceDrills.reduce((acc, drill) => {
    if (!acc[drill.poolRef]) acc[drill.poolRef] = [];
    acc[drill.poolRef].push(drill);
    return acc;
  }, {});
  const runbookByPool = Object.fromEntries(demoDb.resilienceRunbooks.map((runbook) => [runbook.poolRef, runbook]));

  const policies = demoDb.vms
    .filter((vm) => !vm.is_a_template)
    .map((vm) => {
      const host = hostsByRef[vm.resident_on] || hostsByRef[vm.affinity] || null;
      const poolRef = host?.pool || '';
      const pool = poolsByRef[poolRef] || null;
      const runbook = runbookByPool[poolRef] || null;
      const latestDrill = [...(drillsByPool[poolRef] || [])].sort((left, right) => new Date(right.executedAt || 0) - new Date(left.executedAt || 0))[0] || null;
      const relatedTasks = sortTasks(demoDb.tasks.filter((task) => {
        const haystack = `${task.name_label || ''} ${task.name_description || ''}`.toLowerCase();
        return haystack.includes((vm.name_label || '').toLowerCase()) || haystack.includes((vm.uuid || '').toLowerCase());
      }));
      const relatedMessages = sortMessages(demoDb.messages.filter((message) => {
        const haystack = `${message.name || ''} ${message.body || ''} ${message.obj_uuid || ''}`.toLowerCase();
        return haystack.includes((vm.name_label || '').toLowerCase()) || haystack.includes((vm.uuid || '').toLowerCase());
      }));
      const lastSuccessTask = relatedTasks.find((task) => (task.status || '').toLowerCase() === 'success');
      const tier = (vm.tags || []).some((tag) => ['prod', 'production', 'critical'].includes(String(tag).toLowerCase()))
        ? 'Tier-1'
        : (vm.tags || []).some((tag) => ['edge', 'branch'].includes(String(tag).toLowerCase()))
          ? 'Edge'
          : (vm.tags || []).some((tag) => ['staging', 'dev', 'test'].includes(String(tag).toLowerCase()))
            ? 'Non-Prod'
            : 'Standard';
      const backupWindowHours = Number(runbook?.backupWindowHours || (tier === 'Tier-1' ? 12 : 24));
      const lastProtectedAt = lastSuccessTask?.finished || lastSuccessTask?.created || '';
      const backupAgeHours = lastProtectedAt
        ? Math.round(((Date.now() - new Date(lastProtectedAt).getTime()) / 3600000) * 10) / 10
        : null;
      const restorePointStatus = runbook?.restorePointStatus || (backupAgeHours === null ? 'missing' : backupAgeHours <= backupWindowHours ? 'current' : backupAgeHours <= backupWindowHours * 1.5 ? 'review' : 'stale');

      let status = 'info';
      let recommendation = 'Review protection coverage for this workload.';

      if (relatedMessages.some((message) => getMessageSeverity(message) === 'critical') || ['missing', 'stale'].includes(restorePointStatus)) {
        status = 'critical';
        recommendation = 'Protection drift or restore-point staleness is present. Investigate before relying on this VM for recovery.';
      } else if (restorePointStatus === 'review') {
        status = 'warning';
        recommendation = 'Backup coverage exists but the restore point needs validation before the next change window.';
      } else if (lastSuccessTask) {
        status = 'success';
        recommendation = 'Recent protection work completed successfully. Schedule routine restore verification.';
      } else if (tier === 'Tier-1' && (vm.power_state || '').toLowerCase() === 'running') {
        status = 'warning';
        recommendation = 'This production VM should be checked for a fresh backup or snapshot before the next change window.';
      }

      return {
        ref: vm.ref,
        poolRef,
        poolName: pool?.name_label || 'Unassigned Pool',
        name_label: vm.name_label,
        power_state: vm.power_state,
        policy: tier,
        recoveryTier: runbook?.recoveryTier || tier,
        status,
        hasRecentProtection: Boolean(lastSuccessTask),
        lastProtectedAt,
        backupAgeHours,
        backupWindowHours,
        restorePointStatus,
        restorePointLabel: restorePointStatus === 'current'
          ? `Within ${backupWindowHours}h target`
          : restorePointStatus === 'review'
            ? `Aged ${backupAgeHours ?? '-'}h`
            : restorePointStatus === 'stale'
              ? `Stale at ${backupAgeHours ?? '-'}h`
              : 'Missing restore point',
        haRestartPriority: runbook?.restartPriority || (tier === 'Tier-1' ? 'high' : tier === 'Edge' ? 'medium' : 'low'),
        lastTaskLabel: lastSuccessTask?.name_label || relatedTasks[0]?.name_label || 'No recent protection task',
        lastAlertLabel: relatedMessages[0]?.name || 'No resilience alerts',
        recommendation,
        tags: vm.tags || [],
        uuid: vm.uuid,
        lastDrillAt: latestDrill?.executedAt || '',
        lastDrillStatus: latestDrill?.status || '',
        runbookOwner: runbook?.owner || '',
      };
    });

  const hostPlans = demoDb.hosts.map((host) => {
    const runbook = runbookByPool[host.pool] || null;
    const latestDrill = [...(drillsByPool[host.pool] || [])].sort((left, right) => new Date(right.executedAt || 0) - new Date(left.executedAt || 0))[0] || null;
    const evacuationTarget = demoDb.hosts.find((candidate) => candidate.ref !== host.ref && candidate.enabled && candidate.pool === host.pool)
      || demoDb.hosts.find((candidate) => candidate.ref !== host.ref && candidate.enabled);
    const taskText = sortTasks(demoDb.tasks.filter((task) => {
      const haystack = `${task.name_label || ''} ${task.name_description || ''} ${task.resident_on || ''}`.toLowerCase();
      return haystack.includes((host.ref || '').toLowerCase()) || haystack.includes((host.name_label || '').toLowerCase());
    }));
    const relatedMessages = sortMessages(demoDb.messages.filter((message) => {
      const haystack = `${message.name || ''} ${message.body || ''} ${message.obj_uuid || ''}`.toLowerCase();
      return haystack.includes((host.uuid || '').toLowerCase()) || haystack.includes((host.name_label || '').toLowerCase());
    }));

    let status = 'success';
    let summary = 'Failover posture looks healthy.';
    if (!host.enabled) {
      status = 'disabled';
      summary = 'Host is currently disabled or parked for maintenance.';
    } else if (relatedMessages.some((message) => getMessageSeverity(message) === 'critical')) {
      status = 'critical';
      summary = 'Resilience-affecting alerts are active on this host.';
    } else if (taskText.some((task) => ['pending', 'queued'].includes((task.status || '').toLowerCase()))) {
      status = 'pending';
      summary = 'A resilience-related action is still in progress.';
    } else if (!runbook || !latestDrill) {
      status = 'warning';
      summary = 'Runbook coverage or recent drill evidence is missing for this host pool.';
    }

    return {
      ref: host.ref,
      poolRef: host.pool || '',
      poolName: poolsByRef[host.pool]?.name_label || 'Standalone Host',
      name_label: host.name_label,
      address: host.address,
      status,
      evacuationTarget: evacuationTarget?.name_label || 'No alternate host available',
      standbyHostRef: runbook?.standbyHostRef || '',
      residentVmCount: (host.resident_VMs || []).length,
      recentTask: taskText[0]?.name_label || 'No recent host resilience task',
      recentAlert: relatedMessages[0]?.name || 'No recent host alert',
      summary,
      haPolicy: runbook?.haPolicy || 'manual',
      restartPriority: runbook?.restartPriority || 'medium',
      lastDrillAt: latestDrill?.executedAt || '',
      lastDrillStatus: latestDrill?.status || '',
      maintenanceWindow: host?.other_config?.maintenance_window || 'No maintenance window',
      other_config: host.other_config || {},
      uuid: host.uuid,
    };
  });

  const recoveryPlans = demoDb.pools.map((pool) => {
    const runbook = runbookByPool[pool.ref] || null;
    const drills = [...(drillsByPool[pool.ref] || [])].sort((left, right) => new Date(right.executedAt || 0) - new Date(left.executedAt || 0));
    const latestDrill = drills[0] || null;
    const poolHosts = demoDb.hosts.filter((host) => host.pool === pool.ref);
    const poolPolicies = policies.filter((policy) => policy.poolRef === pool.ref);
    const enabledHostCount = poolHosts.filter((host) => host.enabled).length;
    const protectedVmCount = poolPolicies.filter((policy) => policy.hasRecentProtection).length;
    const atRiskVmCount = poolPolicies.filter((policy) => ['critical', 'warning'].includes(policy.status)).length;
    const staleRestorePointCount = poolPolicies.filter((policy) => ['stale', 'missing'].includes(policy.restorePointStatus)).length;
    const reviewRestorePointCount = poolPolicies.filter((policy) => policy.restorePointStatus === 'review').length;
    let status = 'success';
    let nextAction = 'Continue periodic recovery drills and evacuation target validation.';

    if (!runbook) {
      status = 'warning';
      nextAction = 'Author a recovery runbook before relying on this pool for failover.';
    }
    if (enabledHostCount < 2) {
      status = 'warning';
      nextAction = 'Add more failover capacity or re-enable a standby host before relying on this pool for recovery.';
    }
    if (staleRestorePointCount > 0 || atRiskVmCount > protectedVmCount) {
      status = 'critical';
      nextAction = 'Prioritize backup verification and restore testing.';
    } else if (reviewRestorePointCount > 0 || !latestDrill) {
      status = 'warning';
      nextAction = latestDrill
        ? 'Recent restore evidence needs review. Schedule another drill and update the runbook.'
        : 'Log a restore or failover drill so recovery readiness is visible.';
    }

    return {
      ref: pool.ref,
      name_label: pool.name_label,
      status,
      enabledHostCount,
      protectedVmCount,
      atRiskVmCount,
      staleRestorePointCount,
      reviewRestorePointCount,
      nextAction,
      hasRunbook: Boolean(runbook),
      recoveryTier: runbook?.recoveryTier || 'standard',
      haPolicy: runbook?.haPolicy || 'manual',
      restartPriority: runbook?.restartPriority || 'medium',
      backupWindowHours: Number(runbook?.backupWindowHours || 24),
      rpoMinutes: Number(runbook?.rpoMinutes || 60),
      rtoMinutes: Number(runbook?.rtoMinutes || 120),
      restorePointStatus: staleRestorePointCount > 0 ? 'stale' : reviewRestorePointCount > 0 ? 'review' : 'current',
      owner: runbook?.owner || '',
      standbyHostRef: runbook?.standbyHostRef || '',
      standbyHostLabel: hostsByRef[runbook?.standbyHostRef]?.name_label || '',
      failoverNetworkRef: runbook?.failoverNetworkRef || '',
      failoverNetworkLabel: networksByRef[runbook?.failoverNetworkRef]?.name_label || '',
      lastVerifiedAt: runbook?.lastVerifiedAt || '',
      lastDrillAt: latestDrill?.executedAt || '',
      lastDrillStatus: latestDrill?.status || '',
      drillCount: drills.length,
      runbookSteps: runbook?.runbookSteps?.length ? runbook.runbookSteps : [
        `Confirm ${pool.name_label} backup currency and replication health.`,
        'Evacuate impacted workloads before maintenance or failover begins.',
        'Validate storage paths and failover network reachability.',
        'Execute a restore drill and capture operator notes.',
      ],
      notes: runbook?.notes || '',
      drills: drills.slice(0, 5),
      uuid: pool.uuid,
    };
  });

  const recentEvents = [...demoDb.tasks
    .filter((task) => /(snapshot|backup|recover|drill|migrat|protect)/i.test(`${task.name_label} ${task.name_description}`))
    .map((task) => ({
      type: 'task',
      ref: task.ref,
      label: task.name_label,
      status: task.status,
      timestamp: task.finished || task.created,
      detail: task.name_description,
    })), ...demoDb.messages
    .filter((message) => /(replicat|protect|storage|backup|recovery|failover)/i.test(`${message.name} ${message.body}`))
    .map((message) => ({
      type: 'alert',
      ref: message.ref,
      label: message.name,
      status: getMessageSeverity(message),
      timestamp: message.timestamp,
      detail: message.body,
    })), ...demoDb.resilienceDrills.map((drill) => ({
      type: 'drill',
      ref: drill.id,
      label: `${drill.drillType} drill`,
      status: drill.status,
      timestamp: drill.executedAt,
      detail: drill.summary,
    }))].sort((left, right) => new Date(right.timestamp || 0) - new Date(left.timestamp || 0)).slice(0, 14);

  return {
    generatedAt: '2026-08-21T15:12:00.000Z',
    summary: {
      protectedVmCount: policies.filter((policy) => policy.hasRecentProtection).length,
      atRiskVmCount: policies.filter((policy) => ['critical', 'warning'].includes(policy.status)).length,
      maintenanceHostCount: hostPlans.filter((plan) => plan.status === 'disabled').length,
      recoveryPlanCount: recoveryPlans.length,
      recentEventCount: recentEvents.length,
      runbookCoverageCount: recoveryPlans.filter((plan) => plan.hasRunbook).length,
      staleRestorePointCount: policies.filter((policy) => ['stale', 'missing'].includes(policy.restorePointStatus)).length,
      overdueDrillCount: recoveryPlans.filter((plan) => !plan.lastDrillAt).length,
    },
    protectionPolicies: policies,
    hostPlans,
    recoveryPlans,
    recentEvents,
    runbooks: clone(demoDb.resilienceRunbooks),
    drills: clone([...demoDb.resilienceDrills].sort((left, right) => new Date(right.executedAt || 0) - new Date(left.executedAt || 0))),
  };
}
