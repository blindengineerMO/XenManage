const express = require('express');
const { validate, schemas } = require('../middleware/validate');
const { ensureMutationAllowed } = require('../middleware/governance');
const auditLogService = require('../services/audit-log');
const remediationTaskService = require('../services/remediation-tasks');
const remediationTaskTemplateService = require('../services/remediation-task-templates');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const tasks = await req.xenApi.getTasks();
    const xenTasks = Object.entries(tasks)
      .map(([ref, record]) => ({ ref, ...record }))
      .sort((left, right) => {
        const rightDate = new Date(right.finished || right.created || 0).getTime();
        const leftDate = new Date(left.finished || left.created || 0).getTime();
        return rightDate - leftDate;
      });
    const remediationTasks = remediationTaskService.list();
    const list = [...remediationTasks, ...xenTasks]
      .sort((left, right) => {
        const rightDate = new Date(right.finished || right.created || 0).getTime();
        const leftDate = new Date(left.finished || left.created || 0).getTime();
        return rightDate - leftDate;
      })
      .slice(0, 200);

    res.json({ total: list.length, data: list });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/remediation', validate(schemas.remediationTaskCreate), (req, res) => {
  try {
    if (!ensureMutationAllowed(req, res, { actionKey: 'remediation_task_create', entityType: 'task', entityRef: req.body.alertRef })) return;

    let template = null;
    if (req.body.templateId) {
      template = remediationTaskTemplateService.get(req.body.templateId);
      if (!template.enabled) {
        res.status(409).json({ error: 'REMEDIATION_TEMPLATE_DISABLED' });
        return;
      }
    }

    const taskPayload = {
      nameLabel: req.body.nameLabel,
      nameDescription: req.body.nameDescription,
      actionType: req.body.actionType,
      assignee: req.body.assignee,
      dueDate: req.body.dueDate,
      alertRef: req.body.alertRef,
      alertUuid: req.body.alertUuid,
      alertSummary: req.body.alertSummary,
      targetRoute: req.body.targetRoute,
      relatedObject: req.body.relatedObject,
      relatedClass: req.body.relatedClass,
      workspaceSummary: req.body.workspaceSummary,
      evidenceChecklist: req.body.evidenceChecklist,
      completionCriteria: req.body.completionCriteria,
      lifecyclePlanSeed: req.body.lifecyclePlanSeed,
      resilienceRunbookSeed: req.body.resilienceRunbookSeed,
      templateId: template?.id || req.body.templateId,
      templateName: template?.name || req.body.templateName,
      templateLaunchMode: template?.launchMode || req.body.templateLaunchMode,
      recurrenceMode: template?.recurrenceMode || req.body.recurrenceMode,
      recurrenceScope: template?.recurrenceScope || req.body.recurrenceScope,
      cooldownDays: template?.cooldownDays ?? req.body.cooldownDays,
    };

    const recurrenceConflict = remediationTaskService.findRecurringConflict(taskPayload);
    if (recurrenceConflict) {
      auditLogService.record({
        category: 'alerts',
        action: 'remediation_task_recurrence_blocked',
        actionLabel: 'Skipped recurring remediation for',
        entityType: 'task-template',
        entityRef: taskPayload.templateId || req.body.alertRef,
        entityName: taskPayload.templateName || req.body.nameLabel,
        operator: req.session?.xenUser || 'system',
        route: '/alerts',
        status: 'warning',
        before: null,
        after: recurrenceConflict.task,
        detail: recurrenceConflict.nextEligibleAt
          ? `${taskPayload.templateName || 'This remediation template'} already queued follow-through until ${recurrenceConflict.nextEligibleAt}.`
          : `${taskPayload.templateName || 'This remediation template'} already queued follow-through for this alert scope.`,
      });
      res.status(409).json({
        error: 'REMEDIATION_TASK_RECURRENCE_BLOCKED',
        existingTask: recurrenceConflict.task,
        nextEligibleAt: recurrenceConflict.nextEligibleAt,
      });
      return;
    }

    const task = remediationTaskService.create(taskPayload, req.session?.xenUser || 'system');

    auditLogService.record({
      category: 'alerts',
      action: 'remediation_task_created',
      actionLabel: 'Created remediation task for',
      entityType: 'task',
      entityRef: task.ref,
      entityName: task.name_label,
      operator: req.session?.xenUser || 'system',
      route: '/activity',
      status: 'success',
      before: null,
      after: task,
      detail: task.template_name
        ? `Queued ${task.action_type || 'review'} follow-through from template ${task.template_name} for alert ${task.related_alert_summary || task.related_alert_ref || req.body.alertRef}.`
        : `Queued ${task.action_type || 'review'} follow-through from alert ${task.related_alert_summary || task.related_alert_ref || req.body.alertRef}.`,
    });

    res.status(201).json(task);
  } catch (err) {
    if (err.code === 'REMEDIATION_TEMPLATE_NOT_FOUND') {
      res.status(404).json({ error: err.code });
      return;
    }
    res.status(500).json({ error: err.message });
  }
});

router.get('/remediation/templates', (req, res) => {
  try {
    const templates = remediationTaskTemplateService.list();
    res.json({ total: templates.length, data: templates });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/remediation/templates', validate(schemas.remediationTaskTemplateUpdate), (req, res) => {
  try {
    if (!ensureMutationAllowed(req, res, { actionKey: 'remediation_template_save', entityType: 'task-template', entityRef: 'new' })) return;

    const template = remediationTaskTemplateService.create(req.body);
    auditLogService.record({
      category: 'alerts',
      action: 'remediation_template_created',
      actionLabel: 'Created remediation template for',
      entityType: 'task-template',
      entityRef: template.id,
      entityName: template.name,
      operator: req.session?.xenUser || 'system',
      route: '/alerts',
      status: 'success',
      before: null,
      after: template,
      detail: `${template.name} now maps ${template.matchClass || 'any class'} alerts into ${template.actionType || 'review'} follow-through work.`,
    });

    res.status(201).json(template);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/remediation/templates/:id', validate(schemas.remediationTemplateIdParam, 'params'), validate(schemas.remediationTaskTemplateUpdate), (req, res) => {
  try {
    if (!ensureMutationAllowed(req, res, { actionKey: 'remediation_template_save', entityType: 'task-template', entityRef: req.params.id })) return;

    const previous = remediationTaskTemplateService.list().find((template) => template.id === req.params.id) || null;
    const template = remediationTaskTemplateService.update(req.params.id, req.body);
    auditLogService.record({
      category: 'alerts',
      action: 'remediation_template_updated',
      actionLabel: 'Updated remediation template for',
      entityType: 'task-template',
      entityRef: template.id,
      entityName: template.name,
      operator: req.session?.xenUser || 'system',
      route: '/alerts',
      status: 'success',
      before: previous,
      after: template,
      detail: `${template.name} template criteria or defaults were updated.`,
    });

    res.json(template);
  } catch (err) {
    if (err.code === 'REMEDIATION_TEMPLATE_NOT_FOUND') {
      res.status(404).json({ error: err.code });
      return;
    }
    res.status(500).json({ error: err.message });
  }
});

router.delete('/remediation/templates/:id', validate(schemas.remediationTemplateIdParam, 'params'), (req, res) => {
  try {
    if (!ensureMutationAllowed(req, res, { actionKey: 'remediation_template_delete', entityType: 'task-template', entityRef: req.params.id })) return;

    const template = remediationTaskTemplateService.delete(req.params.id);
    auditLogService.record({
      category: 'alerts',
      action: 'remediation_template_deleted',
      actionLabel: 'Removed remediation template for',
      entityType: 'task-template',
      entityRef: template.id,
      entityName: template.name,
      operator: req.session?.xenUser || 'system',
      route: '/alerts',
      status: 'success',
      before: template,
      after: { success: true },
      detail: `${template.name} remediation template was removed from the alerts workflow.`,
    });

    res.json({ success: true });
  } catch (err) {
    if (err.code === 'REMEDIATION_TEMPLATE_NOT_FOUND') {
      res.status(404).json({ error: err.code });
      return;
    }
    res.status(500).json({ error: err.message });
  }
});

router.put('/remediation/:ref', validate(schemas.opaqueRefParam, 'params'), validate(schemas.remediationTaskUpdate), (req, res) => {
  try {
    if (!ensureMutationAllowed(req, res, { actionKey: 'remediation_task_update', entityType: 'task', entityRef: req.params.ref })) return;

    const previous = remediationTaskService.list().find((task) => task.ref === req.params.ref);
    const task = remediationTaskService.update(req.params.ref, {
      status: req.body.status,
      assignee: req.body.assignee,
      dueDate: req.body.dueDate,
      result: req.body.result,
      nameDescription: req.body.nameDescription,
    }, req.session?.xenUser || 'system');

    auditLogService.record({
      category: 'activity',
      action: 'remediation_task_updated',
      actionLabel: 'Updated remediation task for',
      entityType: 'task',
      entityRef: task.ref,
      entityName: task.name_label,
      operator: req.session?.xenUser || 'system',
      route: '/activity',
      status: 'success',
      before: previous || null,
      after: task,
      detail: `Set remediation task ${task.name_label} to ${task.status}.`,
    });

    res.json(task);
  } catch (err) {
    if (err.code === 'REMEDIATION_TASK_NOT_FOUND') {
      res.status(404).json({ error: err.code });
      return;
    }
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
