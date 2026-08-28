function handleDemoPlanningRoutes(method, path, body) {
  if (method === 'GET' && path === '/api/resilience') {
    return buildDemoResilience();
  }

  if (method === 'GET' && path === '/api/resilience/plans') {
    return { total: demoDb.resilienceRunbooks.length, data: clone(demoDb.resilienceRunbooks) };
  }

  if (method === 'GET' && path === '/api/resilience/drills') {
    return {
      total: demoDb.resilienceDrills.length,
      data: clone([...demoDb.resilienceDrills].sort((left, right) => new Date(right.executedAt || 0) - new Date(left.executedAt || 0))),
    };
  }

  if (method === 'PUT' && path.startsWith('/api/resilience/plans/')) {
    ensureDemoMutationAllowed({ actionKey: 'resilience_runbook_save', entityType: 'pool', entityRef: decodeURIComponent(path.split('/')[4] || '') });
    const poolRef = decodeURIComponent(path.split('/')[4] || '');
    const previous = demoDb.resilienceRunbooks.find((record) => record.poolRef === poolRef) || null;
    const record = {
      poolRef,
      recoveryTier: body.recoveryTier || 'standard',
      haPolicy: body.haPolicy || 'manual',
      restartPriority: body.restartPriority || 'medium',
      backupWindowHours: Number(body.backupWindowHours || 24),
      rpoMinutes: Number(body.rpoMinutes || 60),
      rtoMinutes: Number(body.rtoMinutes || 120),
      restorePointStatus: body.restorePointStatus || 'review',
      owner: body.owner || '',
      standbyHostRef: body.standbyHostRef || '',
      failoverNetworkRef: body.failoverNetworkRef || '',
      lastVerifiedAt: body.lastVerifiedAt || '',
      runbookSteps: Array.isArray(body.runbookSteps) ? body.runbookSteps.filter(Boolean).slice(0, 8) : [],
      notes: body.notes || '',
      sourceTaskRef: body.sourceTaskRef || '',
      sourceTemplateId: body.sourceTemplateId || '',
      sourceTemplateName: body.sourceTemplateName || '',
      updatedAt: new Date().toISOString(),
    };
    const index = demoDb.resilienceRunbooks.findIndex((entry) => entry.poolRef === poolRef);
    if (index === -1) {
      demoDb.resilienceRunbooks.push(record);
    } else {
      demoDb.resilienceRunbooks[index] = record;
    }
    recordDemoAudit({
      category: 'resilience',
      action: 'resilience_runbook_saved',
      actionLabel: 'Saved resilience runbook for',
      entityType: 'pool',
      entityRef: poolRef,
      entityName: poolRef,
      route: '/resilience',
      before: previous,
      after: record,
      detail: `${record.haPolicy} HA policy with ${record.backupWindowHours}h backup window.`,
    });
    return clone(record);
  }

  if (method === 'DELETE' && path.startsWith('/api/resilience/plans/')) {
    ensureDemoMutationAllowed({ actionKey: 'resilience_runbook_delete', entityType: 'pool', entityRef: decodeURIComponent(path.split('/')[4] || '') });
    const poolRef = decodeURIComponent(path.split('/')[4] || '');
    const previous = demoDb.resilienceRunbooks.find((record) => record.poolRef === poolRef) || null;
    const index = demoDb.resilienceRunbooks.findIndex((entry) => entry.poolRef === poolRef);
    if (index === -1) throw new Error('RESILIENCE_RUNBOOK_NOT_FOUND');
    demoDb.resilienceRunbooks.splice(index, 1);
    recordDemoAudit({
      category: 'resilience',
      action: 'resilience_runbook_removed',
      actionLabel: 'Cleared resilience runbook for',
      entityType: 'pool',
      entityRef: poolRef,
      entityName: poolRef,
      route: '/resilience',
      before: previous,
      after: { success: true },
      detail: 'Recovery runbook removed from persisted resilience planning state.',
    });
    return { success: true };
  }

  if (method === 'POST' && path.startsWith('/api/resilience/drills/')) {
    ensureDemoMutationAllowed({ actionKey: 'resilience_drill_log', entityType: 'pool', entityRef: decodeURIComponent(path.split('/')[4] || '') });
    const poolRef = decodeURIComponent(path.split('/')[4] || '');
    const record = {
      id: `drill-${Date.now()}`,
      poolRef,
      drillType: body.drillType || 'restore',
      status: body.status || 'success',
      scope: body.scope || '',
      executedAt: body.executedAt || new Date().toISOString(),
      durationMinutes: Number(body.durationMinutes || 0),
      summary: body.summary || '',
      findings: body.findings || '',
      nextStep: body.nextStep || '',
      operator: store.username || 'demo',
      createdAt: new Date().toISOString(),
    };
    demoDb.resilienceDrills.unshift(record);
    demoDb.resilienceDrills = demoDb.resilienceDrills.slice(0, 80);
    recordDemoAudit({
      category: 'resilience',
      action: 'resilience_drill_logged',
      actionLabel: 'Logged resilience drill for',
      entityType: 'pool',
      entityRef: poolRef,
      entityName: poolRef,
      route: '/resilience',
      before: null,
      after: record,
      detail: `${record.drillType} drill logged with ${record.status} status.`,
    });
    return clone(record);
  }

  if (method === 'GET' && path === '/api/lifecycle/plans') {
    return { total: demoDb.lifecyclePlans.length, data: clone(demoDb.lifecyclePlans) };
  }

  if (method === 'PUT' && path.startsWith('/api/lifecycle/plans/')) {
    ensureDemoMutationAllowed({ actionKey: 'lifecycle_plan_save', entityType: 'host', entityRef: decodeURIComponent(path.split('/')[4] || '') });
    const hostRef = decodeURIComponent(path.split('/')[4] || '');
    const previous = demoDb.lifecyclePlans.find((plan) => plan.hostRef === hostRef) || null;
    const record = {
      hostRef,
      baselineStatus: body.baselineStatus || 'unknown',
      targetStage: body.targetStage || 'review',
      maintenanceWindow: body.maintenanceWindow || '',
      patchGroup: body.patchGroup || '',
      owner: body.owner || '',
      nextAction: body.nextAction || 'scan',
      rebootRequired: Boolean(body.rebootRequired),
      evacuationRequired: Boolean(body.evacuationRequired),
      dueDate: body.dueDate || '',
      notes: body.notes || '',
      sourceTaskRef: body.sourceTaskRef || '',
      sourceTemplateId: body.sourceTemplateId || '',
      sourceTemplateName: body.sourceTemplateName || '',
      updatedAt: new Date().toISOString(),
    };
    const index = demoDb.lifecyclePlans.findIndex((plan) => plan.hostRef === hostRef);
    if (index === -1) {
      demoDb.lifecyclePlans.push(record);
    } else {
      demoDb.lifecyclePlans[index] = record;
    }
    recordDemoAudit({
      category: 'lifecycle',
      action: 'lifecycle_plan_saved',
      actionLabel: 'Saved lifecycle plan for',
      entityType: 'host',
      entityRef: hostRef,
      entityName: hostRef,
      route: '/lifecycle',
      before: previous,
      after: record,
      detail: `${record.targetStage} stage with ${record.baselineStatus} baseline status.`,
    });
    return clone(record);
  }

  if (method === 'DELETE' && path.startsWith('/api/lifecycle/plans/')) {
    ensureDemoMutationAllowed({ actionKey: 'lifecycle_plan_delete', entityType: 'host', entityRef: decodeURIComponent(path.split('/')[4] || '') });
    const hostRef = decodeURIComponent(path.split('/')[4] || '');
    const previous = demoDb.lifecyclePlans.find((plan) => plan.hostRef === hostRef) || null;
    const index = demoDb.lifecyclePlans.findIndex((plan) => plan.hostRef === hostRef);
    if (index === -1) throw new Error('LIFECYCLE_PLAN_NOT_FOUND');
    demoDb.lifecyclePlans.splice(index, 1);
    recordDemoAudit({
      category: 'lifecycle',
      action: 'lifecycle_plan_removed',
      actionLabel: 'Cleared lifecycle plan for',
      entityType: 'host',
      entityRef: hostRef,
      entityName: hostRef,
      route: '/lifecycle',
      before: previous,
      after: { success: true },
      detail: 'Lifecycle planner entry removed from persisted state.',
    });
    return { success: true };
  }

  return undefined;
}
