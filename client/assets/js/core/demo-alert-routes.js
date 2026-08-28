function handleDemoAlertActivityRoutes(method, path, body) {
  if (method === 'GET' && path === '/api/dashboard/messages') {
    return clone(demoDb.messages.map((message) => buildDemoAlert(message)));
  }

  if (method === 'GET' && path === '/api/alerts') {
    const alerts = demoDb.messages.map((message) => buildDemoAlert(message))
      .sort((left, right) => new Date(right.timestamp || 0) - new Date(left.timestamp || 0));
    return { total: alerts.length, data: clone(alerts) };
  }

  if (method === 'GET' && path === '/api/alerts/policies') {
    const policies = listDemoAlertPolicies();
    return { total: policies.length, data: clone(policies) };
  }

  if (method === 'PUT' && path.startsWith('/api/alerts/') && path.endsWith('/state')) {
    ensureDemoMutationAllowed({ actionKey: 'alert_state_save', entityType: 'alert', entityRef: decodeURIComponent(path.split('/')[3] || '') });
    const ref = decodeURIComponent(path.split('/')[3] || '');
    const previousAlert = buildDemoAlert(demoDb.messages.find((entry) => entry.ref === ref) || { ref });
    const state = {
      acknowledged: Boolean(body.acknowledged),
      acknowledgedAt: body.acknowledged ? (demoDb.alertStates[ref]?.acknowledgedAt || new Date().toISOString()) : '',
      acknowledgedBy: body.acknowledged ? (store.username || 'demo') : '',
      suppressionUntil: body.suppressionUntil || '',
      severityOverride: body.severityOverride || '',
      healthAction: body.healthAction || 'none',
      notes: body.notes || '',
      updatedAt: new Date().toISOString(),
    };
    demoDb.alertStates[ref] = state;
    const message = demoDb.messages.find((entry) => entry.ref === ref);
    if (!message) throw new Error('ALERT_NOT_FOUND');
    const alert = buildDemoAlert(message);
    recordDemoAudit({
      category: 'alerts',
      action: 'alert_state_updated',
      actionLabel: 'Updated alert state for',
      entityType: 'alert',
      entityRef: ref,
      entityName: alert.summary || ref,
      route: '/alerts',
      before: previousAlert,
      after: alert,
      detail: `${alert.healthAction || 'none'} action with ${alert.effectiveSeverity || alert.baseSeverity || 'notice'} severity.`,
    });
    return clone(alert);
  }

  if (method === 'PUT' && path === '/api/alerts/bulk-state') {
    ensureDemoMutationAllowed({ actionKey: 'alert_bulk_state_save', entityType: 'alert-batch', entityRef: String((body.refs || []).length) });
    const updated = (body.refs || []).map((ref) => {
      const state = {
        acknowledged: Boolean(body.state?.acknowledged),
        acknowledgedAt: body.state?.acknowledged ? (demoDb.alertStates[ref]?.acknowledgedAt || new Date().toISOString()) : '',
        acknowledgedBy: body.state?.acknowledged ? (store.username || 'demo') : '',
        suppressionUntil: body.state?.suppressionUntil || '',
        severityOverride: body.state?.severityOverride || '',
        healthAction: body.state?.healthAction || 'none',
        notes: body.state?.notes || '',
        updatedAt: new Date().toISOString(),
      };
      demoDb.alertStates[ref] = state;
      return buildDemoAlert(demoDb.messages.find((entry) => entry.ref === ref) || { ref });
    });
    recordDemoAudit({
      category: 'alerts',
      action: 'alert_bulk_state_updated',
      actionLabel: 'Bulk-updated alert state for',
      entityType: 'alert-batch',
      entityRef: (body.refs || []).join(','),
      entityName: `${updated.length} alerts`,
      route: '/alerts',
      before: { refs: body.refs || [] },
      after: { refs: body.refs || [], state: body.state || {} },
      detail: `${updated.length} alerts received the same triage state in a single operation.`,
    });
    return { total: updated.length, data: clone(updated) };
  }

  if (method === 'POST' && path === '/api/alerts/policies') {
    ensureDemoMutationAllowed({ actionKey: 'alert_policy_save', entityType: 'alert-policy', entityRef: 'new' });
    const record = normalizeDemoAlertPolicy({
      ...body,
      id: `alert-policy-${demoDb.alertPolicies.length + 1}`,
      updatedAt: new Date().toISOString(),
    });
    demoDb.alertPolicies.unshift(record);
    recordDemoAudit({
      category: 'alerts',
      action: 'alert_policy_created',
      actionLabel: 'Created alert policy for',
      entityType: 'alert-policy',
      entityRef: record.id,
      entityName: record.name,
      route: '/alerts',
      before: null,
      after: record,
      detail: `${record.name} now governs ${record.matchClass || 'all classes'} alerts in ${record.matchTargetRoute || 'any workspace'} with ${record.matchSeverity || 'any'} severity.`,
    });
    return clone(record);
  }

  if (method === 'PUT' && path.startsWith('/api/alerts/policies/')) {
    ensureDemoMutationAllowed({ actionKey: 'alert_policy_save', entityType: 'alert-policy', entityRef: decodeURIComponent(path.split('/')[4] || '') });
    const id = decodeURIComponent(path.split('/')[4] || '');
    const index = demoDb.alertPolicies.findIndex((policy) => policy.id === id);
    if (index === -1) throw new Error('ALERT_POLICY_NOT_FOUND');
    const previous = clone(demoDb.alertPolicies[index]);
    const record = normalizeDemoAlertPolicy({
      ...demoDb.alertPolicies[index],
      ...body,
      id,
      updatedAt: new Date().toISOString(),
    });
    demoDb.alertPolicies[index] = record;
    recordDemoAudit({
      category: 'alerts',
      action: 'alert_policy_updated',
      actionLabel: 'Updated alert policy for',
      entityType: 'alert-policy',
      entityRef: id,
      entityName: record.name,
      route: '/alerts',
      before: previous,
      after: record,
      detail: `${record.name} policy criteria or automation settings were updated.`,
    });
    return clone(record);
  }

  if (method === 'DELETE' && path.startsWith('/api/alerts/policies/')) {
    ensureDemoMutationAllowed({ actionKey: 'alert_policy_delete', entityType: 'alert-policy', entityRef: decodeURIComponent(path.split('/')[4] || '') });
    const id = decodeURIComponent(path.split('/')[4] || '');
    const index = demoDb.alertPolicies.findIndex((policy) => policy.id === id);
    if (index === -1) throw new Error('ALERT_POLICY_NOT_FOUND');
    const previous = clone(demoDb.alertPolicies[index]);
    demoDb.alertPolicies.splice(index, 1);
    recordDemoAudit({
      category: 'alerts',
      action: 'alert_policy_deleted',
      actionLabel: 'Removed alert policy for',
      entityType: 'alert-policy',
      entityRef: id,
      entityName: previous.name,
      route: '/alerts',
      before: previous,
      after: { success: true },
      detail: 'Alert suppression policy removed from persisted automation.',
    });
    return { success: true };
  }

  if (method === 'GET' && path === '/api/tasks') {
    const tasks = sortTasks([...(demoDb.tasks || []), ...(demoDb.remediationTasks || []), ...(demoDb.templateDeploymentRuns || [])]);
    return { total: tasks.length, data: clone(tasks) };
  }

  if (method === 'POST' && path === '/api/tasks/remediation') {
    ensureDemoMutationAllowed({ actionKey: 'remediation_task_create', entityType: 'task', entityRef: body.alertRef || 'remediation' });
    const template = body.templateId
      ? demoDb.remediationTemplates.find((entry) => entry.id === body.templateId) || null
      : null;
    if (body.templateId && !template) {
      const error = new Error('REMEDIATION_TEMPLATE_NOT_FOUND');
      error.code = 'REMEDIATION_TEMPLATE_NOT_FOUND';
      throw error;
    }
    if (template && !template.enabled) {
      const error = new Error('REMEDIATION_TEMPLATE_DISABLED');
      error.code = 'REMEDIATION_TEMPLATE_DISABLED';
      throw error;
    }

    const taskPayload = {
      ...body,
      templateId: template?.id || body.templateId || '',
      templateName: template?.name || body.templateName || '',
      templateLaunchMode: template?.launchMode || body.templateLaunchMode || 'draft',
      recurrenceMode: template?.recurrenceMode || body.recurrenceMode || 'manual',
      recurrenceScope: template?.recurrenceScope || body.recurrenceScope || 'object',
      cooldownDays: template?.cooldownDays ?? body.cooldownDays ?? 0,
    };
    const recurrenceKey = buildDemoRemediationRecurrenceKey(taskPayload);
    const recurrenceMode = String(taskPayload.recurrenceMode || 'manual').trim().toLowerCase();
    const blockingStatuses = new Set(['pending', 'queued', 'in_progress', 'success', 'warning']);
    const existingTask = recurrenceMode === 'manual'
      ? null
      : [...demoDb.remediationTasks]
        .filter((task) =>
          task.template_id === taskPayload.templateId
          && task.recurrence_window_key === recurrenceKey
          && blockingStatuses.has(String(task.status || '').trim().toLowerCase())
        )
        .sort((left, right) => new Date(right.created || right.updated_at || 0) - new Date(left.created || left.updated_at || 0))[0];

    if (existingTask) {
      const nextEligibleAt = recurrenceMode === 'once'
        ? ''
        : demoNextEligibleAt(existingTask, recurrenceMode, taskPayload.cooldownDays);
      if (recurrenceMode === 'once' || (nextEligibleAt && new Date(nextEligibleAt).getTime() > Date.now())) {
        recordDemoAudit({
          category: 'alerts',
          action: 'remediation_task_recurrence_blocked',
          actionLabel: 'Skipped recurring remediation for',
          entityType: 'task-template',
          entityRef: taskPayload.templateId || body.alertRef || 'template',
          entityName: taskPayload.templateName || body.nameLabel || 'Remediation Template',
          route: '/alerts',
          status: 'warning',
          after: existingTask,
          detail: nextEligibleAt
            ? `${taskPayload.templateName || 'This remediation template'} already queued follow-through until ${nextEligibleAt}.`
            : `${taskPayload.templateName || 'This remediation template'} already queued follow-through for this alert scope.`,
        });
        const error = new Error('REMEDIATION_TASK_RECURRENCE_BLOCKED');
        error.code = 'REMEDIATION_TASK_RECURRENCE_BLOCKED';
        error.payload = {
          existingTask: clone(existingTask),
          nextEligibleAt,
        };
        throw error;
      }
    }

    const record = buildDemoRemediationTask(taskPayload);
    demoDb.remediationTasks.unshift(record);
    demoDb.remediationTasks = demoDb.remediationTasks.slice(0, 200);
    recordDemoAudit({
      category: 'alerts',
      action: 'remediation_task_created',
      actionLabel: 'Created remediation task for',
      entityType: 'task',
      entityRef: record.ref,
      entityName: record.name_label,
      route: '/activity',
      before: null,
      after: record,
      detail: record.template_name
        ? `Queued ${record.action_type || 'review'} follow-through from template ${record.template_name} for alert ${record.related_alert_summary || record.related_alert_ref || body.alertRef || 'alert'}.`
        : `Queued ${record.action_type || 'review'} follow-through from alert ${record.related_alert_summary || record.related_alert_ref || body.alertRef || 'alert'}.`,
    });
    return clone(record);
  }

  if (method === 'PUT' && path.startsWith('/api/tasks/remediation/') && !path.startsWith('/api/tasks/remediation/templates/')) {
    ensureDemoMutationAllowed({ actionKey: 'remediation_task_update', entityType: 'task', entityRef: decodeURIComponent(path.split('/')[4] || '') });
    const ref = decodeURIComponent(path.split('/')[4] || '');
    const index = demoDb.remediationTasks.findIndex((task) => task.ref === ref);
    if (index === -1) throw new Error('REMEDIATION_TASK_NOT_FOUND');

    const previous = clone(demoDb.remediationTasks[index]);
    const status = String(body.status || previous.status || 'pending').trim().toLowerCase();
    const record = {
      ...previous,
      status,
      assignee: body.assignee !== undefined ? String(body.assignee || '').trim() : previous.assignee,
      due_date: body.dueDate !== undefined ? String(body.dueDate || '').trim() : previous.due_date,
      result: body.result !== undefined ? String(body.result || '').trim() : previous.result,
      name_description: body.nameDescription !== undefined ? String(body.nameDescription || '').trim() : previous.name_description,
      finished: ['success', 'warning', 'failure', 'cancelled'].includes(status) ? new Date().toISOString() : '',
      updated_at: new Date().toISOString(),
    };

    demoDb.remediationTasks[index] = record;
    recordDemoAudit({
      category: 'activity',
      action: 'remediation_task_updated',
      actionLabel: 'Updated remediation task for',
      entityType: 'task',
      entityRef: record.ref,
      entityName: record.name_label,
      route: '/activity',
      before: previous,
      after: record,
      detail: `Set remediation task ${record.name_label} to ${record.status}.`,
    });
    return clone(record);
  }

  if (method === 'GET' && path === '/api/tasks/remediation/templates') {
    return {
      total: demoDb.remediationTemplates.length,
      data: clone([...demoDb.remediationTemplates].sort((left, right) => new Date(right.updatedAt || 0) - new Date(left.updatedAt || 0))),
    };
  }

  if (method === 'POST' && path === '/api/tasks/remediation/templates') {
    ensureDemoMutationAllowed({ actionKey: 'remediation_template_save', entityType: 'task-template', entityRef: 'new' });
    const record = buildDemoRemediationTemplate({
      ...body,
      updatedAt: new Date().toISOString(),
    });
    demoDb.remediationTemplates.unshift(record);
    demoDb.remediationTemplates = demoDb.remediationTemplates.slice(0, 100);
    recordDemoAudit({
      category: 'alerts',
      action: 'remediation_template_created',
      actionLabel: 'Created remediation template for',
      entityType: 'task-template',
      entityRef: record.id,
      entityName: record.name,
      route: '/alerts',
      before: null,
      after: record,
      detail: `${record.name} now maps ${record.matchClass || 'any class'} alerts into ${record.actionType || 'review'} follow-through work.`,
    });
    return clone(record);
  }

  if (method === 'PUT' && path.startsWith('/api/tasks/remediation/templates/')) {
    ensureDemoMutationAllowed({ actionKey: 'remediation_template_save', entityType: 'task-template', entityRef: decodeURIComponent(path.split('/')[5] || '') });
    const id = decodeURIComponent(path.split('/')[5] || '');
    const index = demoDb.remediationTemplates.findIndex((template) => template.id === id);
    if (index === -1) throw new Error('REMEDIATION_TEMPLATE_NOT_FOUND');

    const previous = clone(demoDb.remediationTemplates[index]);
    const record = buildDemoRemediationTemplate({
      ...previous,
      ...body,
      updatedAt: new Date().toISOString(),
    }, previous);
    demoDb.remediationTemplates[index] = record;
    recordDemoAudit({
      category: 'alerts',
      action: 'remediation_template_updated',
      actionLabel: 'Updated remediation template for',
      entityType: 'task-template',
      entityRef: record.id,
      entityName: record.name,
      route: '/alerts',
      before: previous,
      after: record,
      detail: `${record.name} template criteria or defaults were updated.`,
    });
    return clone(record);
  }

  if (method === 'DELETE' && path.startsWith('/api/tasks/remediation/templates/')) {
    ensureDemoMutationAllowed({ actionKey: 'remediation_template_delete', entityType: 'task-template', entityRef: decodeURIComponent(path.split('/')[5] || '') });
    const id = decodeURIComponent(path.split('/')[5] || '');
    const index = demoDb.remediationTemplates.findIndex((template) => template.id === id);
    if (index === -1) throw new Error('REMEDIATION_TEMPLATE_NOT_FOUND');

    const previous = clone(demoDb.remediationTemplates[index]);
    demoDb.remediationTemplates.splice(index, 1);
    recordDemoAudit({
      category: 'alerts',
      action: 'remediation_template_deleted',
      actionLabel: 'Removed remediation template for',
      entityType: 'task-template',
      entityRef: previous.id,
      entityName: previous.name,
      route: '/alerts',
      before: previous,
      after: { success: true },
      detail: `${previous.name} remediation template was removed from the alerts workflow.`,
    });
    return { success: true };
  }

  if (method === 'GET' && path === '/api/audit') {
    return { total: demoDb.auditLog.length, data: clone(demoDb.auditLog) };
  }

  if (method === 'GET' && path === '/api/logs') {
    const entries = buildDemoLogEntries();
    return {
      total: entries.length,
      page: 1,
      pageSize: 50,
      data: clone(entries),
      summary: {
        sourceCounts: {
          audit: entries.filter((entry) => entry.source === 'audit').length,
          auth: 0,
          alert: entries.filter((entry) => entry.source === 'alert').length,
          'remediation-task': entries.filter((entry) => entry.source === 'remediation-task').length,
          'xen-task': entries.filter((entry) => entry.source === 'xen-task').length,
        },
      },
    };
  }

  return undefined;
}
