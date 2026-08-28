const ActivityWorkspaceDialogs = {
  components: {
    FloatingWindow,
    StatusBadge,
    RemediationTaskUpdateForm,
  },
  props: {
    showProps: { type: Boolean, default: false },
    detailTitle: { type: String, default: 'Activity Detail' },
    selectedItemType: { type: String, default: '' },
    selectedTask: { type: Object, default: null },
    selectedAudit: { type: Object, default: null },
    remediationSaving: { type: Boolean, default: false },
    remediationError: { type: String, default: null },
    logSources: { type: Array, default: () => [] },
  },
  emits: [
    'close',
    'save-remediation-task',
    'open-task-alert',
    'open-task-target-workspace',
    'open-task-lifecycle-maintenance',
    'open-task-lifecycle-draft',
    'open-task-resilience-drill',
    'open-task-resilience-draft',
    'open-task-vm-migration-draft',
    'open-deployment-vm',
    'open-deployment-template',
    'open-audit-record',
    'open-audit-workspace',
  ],
  template: `
    <floating-window :show="showProps"
                     :title="detailTitle"
                     :width="760"
                     :height="560"
                     @close="$emit('close')">
      <div v-if="selectedItemType === 'task' && selectedTask">
        <div class="property-grid">
          <span class="text-muted">Status</span><status-badge :status="selectedTask.status || 'info'"></status-badge>
          <span class="text-muted">Name</span><span>{{ selectedTask.name_label || '-' }}</span>
          <span class="text-muted">Description</span><span>{{ selectedTask.name_description || '-' }}</span>
          <span class="text-muted">Source</span><span>{{ taskSourceTitle(selectedTask) }}</span>
          <span class="text-muted">Progress</span><span class="mono">{{ formatTaskProgress(selectedTask.progress) }}</span>
          <span class="text-muted">Created</span><span class="mono">{{ formatDateTime(selectedTask.created) }}</span>
          <span class="text-muted">Finished</span><span class="mono">{{ formatDateTime(selectedTask.finished) }}</span>
          <span class="text-muted">Resident On</span><span class="mono property-wrap">{{ selectedTask.resident_on || '-' }}</span>
          <span class="text-muted">UUID</span><span class="mono property-wrap">{{ selectedTask.uuid || '-' }}</span>
          <span class="text-muted">Result</span><span class="property-wrap">{{ taskResult(selectedTask) }}</span>
        </div>

        <div class="detail-section" v-if="isTemplateDeploymentTask(selectedTask)">
          <div class="detail-section-title">Deployment Context</div>
          <div class="property-grid">
            <span class="text-muted">Template</span><span>{{ selectedTask.template_name || selectedTask.template_ref || '-' }}</span>
            <span class="text-muted">Template Version</span><span class="mono">{{ selectedTask.template_version || '-' }}</span>
            <span class="text-muted">Deployed VM</span><span>{{ selectedTask.vm_name || selectedTask.vm_ref || '-' }}</span>
            <span class="text-muted">Host</span><span>{{ selectedTask.host_label || selectedTask.host_ref || '-' }}</span>
            <span class="text-muted">Storage</span><span>{{ selectedTask.storage_label || selectedTask.storage_ref || '-' }}</span>
            <span class="text-muted">Network</span><span>{{ selectedTask.network_label || selectedTask.network_ref || '-' }}</span>
            <span class="text-muted">Submitted By</span><span>{{ selectedTask.submitted_by || '-' }}</span>
            <span class="text-muted">Validation Status</span><status-badge :status="selectedTask.validation_status || selectedTask.status || 'pending'"></status-badge>
            <span class="text-muted">Guest Customization</span><span>{{ selectedTask.guest_customization || '-' }}</span>
            <span class="text-muted">Validation Notes</span><span class="property-wrap">{{ selectedTask.validation_notes || '-' }}</span>
          </div>
        </div>

        <div class="detail-section" v-if="isTemplateDeploymentTask(selectedTask) && selectedTask.steps && selectedTask.steps.length">
          <div class="detail-section-title">Deployment Steps</div>
          <div class="stack-list">
            <div class="stack-item" v-for="step in selectedTask.steps" :key="step.key">
              <div class="capacity-item-main">
                <strong>{{ step.label }}</strong>
                <div class="text-muted mono" style="font-size:11px">{{ step.detail || 'No detail recorded for this step.' }}</div>
              </div>
              <status-badge :status="step.status || 'info'"></status-badge>
            </div>
          </div>
        </div>

        <div class="detail-section" v-if="isRemediationTask(selectedTask)">
          <div class="detail-section-title">Remediation Context</div>
          <div class="property-grid">
            <span class="text-muted">Action Type</span><span>{{ formatActionTypeLabel(selectedTask.action_type) }}</span>
            <span class="text-muted">Assignee</span><span>{{ selectedTask.assignee || '-' }}</span>
            <span class="text-muted">Due Date</span><span class="mono">{{ selectedTask.due_date || '-' }}</span>
            <span class="text-muted">SLA Status</span><span>{{ taskSlaMeta(selectedTask).label }}</span>
            <span class="text-muted">Queue Age</span><span>{{ taskSlaMeta(selectedTask).ageLabel }}</span>
            <span class="text-muted">Created By</span><span>{{ selectedTask.created_by || '-' }}</span>
            <span class="text-muted">Template</span><span>{{ selectedTask.template_name || '-' }}</span>
            <span class="text-muted">Launch Mode</span><span>{{ formatTemplateLaunchMode(selectedTask.template_launch_mode) }}</span>
            <span class="text-muted">Recurrence Guard</span><span>{{ formatTaskRecurrence(selectedTask) }}</span>
            <span class="text-muted">Alert Summary</span><span>{{ selectedTask.related_alert_summary || '-' }}</span>
            <span class="text-muted">Alert Ref</span><span class="mono property-wrap">{{ selectedTask.related_alert_ref || '-' }}</span>
            <span class="text-muted">Related Object</span><span class="mono property-wrap">{{ selectedTask.related_object || '-' }}</span>
            <span class="text-muted">Related Class</span><span>{{ selectedTask.related_class || '-' }}</span>
            <span class="text-muted">Target Workspace</span><span>{{ selectedTask.target_route || '-' }}</span>
          </div>
        </div>

        <div class="detail-section" v-if="isRemediationTask(selectedTask) && selectedTask.workspace_summary">
          <div class="detail-section-title">Workbench Brief</div>
          <div class="capacity-callout">
            <strong>{{ selectedTask.workspace_summary }}</strong>
            <div class="text-muted mono" style="font-size:11px;margin-top:8px">{{ taskSlaMeta(selectedTask).detail }}</div>
          </div>
        </div>

        <div class="detail-section" v-if="isRemediationTask(selectedTask) && taskEvidenceChecklist(selectedTask).length">
          <div class="detail-section-title">Evidence Checklist</div>
          <div class="stack-list">
            <div class="stack-item" v-for="item in taskEvidenceChecklist(selectedTask)" :key="'evidence-' + item">
              <div>
                <strong>{{ item }}</strong>
              </div>
              <span class="badge badge-info">evidence</span>
            </div>
          </div>
        </div>

        <div class="detail-section" v-if="isRemediationTask(selectedTask) && taskCompletionCriteria(selectedTask).length">
          <div class="detail-section-title">Completion Criteria</div>
          <div class="stack-list">
            <div class="stack-item" v-for="item in taskCompletionCriteria(selectedTask)" :key="'completion-' + item">
              <div>
                <strong>{{ item }}</strong>
              </div>
              <span class="badge badge-success">completion</span>
            </div>
          </div>
        </div>

        <div class="detail-section" v-if="isRemediationTask(selectedTask)">
          <div class="detail-section-title">Manage Remediation Task</div>
          <remediation-task-update-form
            :initial-value="selectedTask"
            :saving="remediationSaving"
            submit-label="Save Task Update"
            @submit="$emit('save-remediation-task', $event)">
          </remediation-task-update-form>
          <div class="form-error" v-if="remediationError" style="text-align:left;margin-top:12px">{{ remediationError }}</div>
        </div>

        <div class="detail-section" v-if="isRemediationTask(selectedTask) && (canOpenTaskAlert(selectedTask) || selectedTask.target_route || canLaunchLifecycleMaintenance(selectedTask) || canDraftLifecyclePlan(selectedTask) || canLaunchResilienceDrill(selectedTask) || canDraftResilienceRunbook(selectedTask) || canDraftVmMigration(selectedTask))">
          <div class="detail-section-title">Follow-through</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn btn-primary btn-sm"
                    v-if="canOpenTaskAlert(selectedTask)"
                    @click="$emit('open-task-alert', selectedTask)">
              <span class="mdi mdi-bell-alert-outline"></span>
              Open Source Alert
            </button>
            <button class="btn btn-sm"
                    v-if="selectedTask.target_route"
                    @click="$emit('open-task-target-workspace', selectedTask)">
              <span class="mdi mdi-arrow-top-right"></span>
              Open Target Workspace
            </button>
            <button class="btn btn-sm"
                    v-if="canLaunchLifecycleMaintenance(selectedTask)"
                    @click="$emit('open-task-lifecycle-maintenance', selectedTask)">
              <span class="mdi mdi-wrench-clock"></span>
              Launch Maintenance Handoff
            </button>
            <button class="btn btn-sm"
                    v-if="canDraftLifecyclePlan(selectedTask)"
                    @click="$emit('open-task-lifecycle-draft', selectedTask)">
              <span class="mdi mdi-calendar-edit-outline"></span>
              Draft Lifecycle Plan
            </button>
            <button class="btn btn-sm"
                    v-if="canLaunchResilienceDrill(selectedTask)"
                    @click="$emit('open-task-resilience-drill', selectedTask)">
              <span class="mdi mdi-clipboard-pulse-outline"></span>
              Launch Recovery Drill Handoff
            </button>
            <button class="btn btn-sm"
                    v-if="canDraftResilienceRunbook(selectedTask)"
                    @click="$emit('open-task-resilience-draft', selectedTask)">
              <span class="mdi mdi-book-edit-outline"></span>
              Draft Recovery Runbook
            </button>
            <button class="btn btn-sm"
                    v-if="canDraftVmMigration(selectedTask)"
                    @click="$emit('open-task-vm-migration-draft', selectedTask)">
              <span class="mdi mdi-swap-horizontal-bold"></span>
              Draft VM Migration
            </button>
          </div>
        </div>

        <div class="detail-section" v-if="isTemplateDeploymentTask(selectedTask) && (selectedTask.vm_ref || selectedTask.template_ref)">
          <div class="detail-section-title">Follow-through</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn btn-primary btn-sm"
                    v-if="selectedTask.vm_ref"
                    @click="$emit('open-deployment-vm', selectedTask)">
              <span class="mdi mdi-monitor-cellphone"></span>
              Open Deployed VM
            </button>
            <button class="btn btn-sm"
                    v-if="selectedTask.template_ref"
                    @click="$emit('open-deployment-template', selectedTask)">
              <span class="mdi mdi-file-document-multiple-outline"></span>
              Open Template
            </button>
          </div>
        </div>

        <div class="detail-section" v-if="selectedTask.error_info && selectedTask.error_info.length">
          <div class="detail-section-title">Error Info</div>
          <div class="stack-list">
            <div class="stack-item" v-for="(error, index) in selectedTask.error_info" :key="index">
              <div>
                <strong>{{ String(error) }}</strong>
              </div>
              <span class="badge badge-error">error</span>
            </div>
          </div>
        </div>
      </div>

      <div v-if="(selectedItemType === 'audit' || selectedItemType === 'log') && selectedAudit">
        <div class="property-grid">
          <span class="text-muted">Status</span><status-badge :status="selectedAudit.status || 'info'"></status-badge>
          <span class="text-muted" v-if="selectedItemType === 'log'">Source</span><span v-if="selectedItemType === 'log'">{{ formatLogSourceLabel(selectedAudit.source) }}</span>
          <span class="text-muted">Summary</span><span>{{ selectedAudit.summary || selectedAudit.message || '-' }}</span>
          <span class="text-muted">Action</span><span>{{ formatAuditActionLabel(selectedAudit) }}</span>
          <span class="text-muted">Operator</span><span class="mono">{{ selectedAudit.operator || 'system' }}</span>
          <span class="text-muted">Entity</span><span>{{ selectedAudit.entityType || 'record' }} · {{ selectedAudit.entityName || selectedAudit.entityRef || '-' }}</span>
          <span class="text-muted">Route</span><span>{{ selectedAudit.route || '-' }}</span>
          <span class="text-muted">{{ selectedItemType === 'log' ? 'Timestamp' : 'Happened At' }}</span><span class="mono">{{ formatDateTime(selectedAudit.happenedAt || selectedAudit.timestamp) }}</span>
          <span class="text-muted">Reference</span><span class="mono property-wrap">{{ selectedAudit.entityRef || '-' }}</span>
          <span class="text-muted">Detail</span><span class="property-wrap">{{ selectedAudit.detail || summarizeChangedFields(selectedAudit) }}</span>
        </div>

        <div class="detail-section" v-if="canOpenAuditRecord(selectedAudit) || selectedAudit.route">
          <div class="detail-section-title">Follow-through</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn btn-primary btn-sm"
                    v-if="canOpenAuditRecord(selectedAudit)"
                    @click="$emit('open-audit-record', selectedAudit)">
              <span class="mdi mdi-open-in-app"></span>
              Open Affected Record
            </button>
            <button class="btn btn-sm"
                    v-if="selectedAudit.route"
                    @click="$emit('open-audit-workspace', selectedAudit)">
              <span class="mdi mdi-arrow-top-right"></span>
              Open Origin Workspace
            </button>
          </div>
        </div>

        <div class="detail-section" v-if="selectedAudit.changedFields && selectedAudit.changedFields.length">
          <div class="detail-section-title">Changed Fields</div>
          <div class="stack-list">
            <div class="stack-item" v-for="change in selectedAudit.changedFields" :key="change.field">
              <div>
                <strong>{{ change.field }}</strong>
                <div class="text-muted mono" style="font-size:11px">{{ change.before }} → {{ change.after }}</div>
              </div>
              <span class="badge badge-info">delta</span>
            </div>
          </div>
        </div>

        <div class="dashboard-panels" v-if="selectedAudit.before || selectedAudit.after">
          <div class="dash-card" v-if="selectedAudit.before">
            <div class="dash-card-label">Before</div>
            <div class="capacity-callout">
              <p class="mono" style="white-space:pre-wrap">{{ toPrettyJson(selectedAudit.before) }}</p>
            </div>
          </div>
          <div class="dash-card" v-if="selectedAudit.after">
            <div class="dash-card-label">After</div>
            <div class="capacity-callout">
              <p class="mono" style="white-space:pre-wrap">{{ toPrettyJson(selectedAudit.after) }}</p>
            </div>
          </div>
        </div>

        <div class="detail-section" v-if="selectedItemType === 'log' && selectedAudit.raw">
          <div class="detail-section-title">Raw Record</div>
          <div class="capacity-callout">
            <p class="mono" style="white-space:pre-wrap">{{ toPrettyJson(selectedAudit.raw) }}</p>
          </div>
        </div>
      </div>
    </floating-window>
  `,
  methods: {
    formatDateTime,
    formatTaskProgress,
    isRemediationTask: isRemediationActivityTask,
    isTemplateDeploymentTask: isTemplateDeploymentActivityTask,
    formatTemplateLaunchMode: formatActivityTemplateLaunchMode,
    formatTaskRecurrence: formatActivityTaskRecurrence,
    taskEvidenceChecklist: getActivityTaskEvidenceChecklist,
    taskCompletionCriteria: getActivityTaskCompletionCriteria,
    taskResult: getActivityTaskResult,
    taskSourceTitle: getActivityTaskSourceTitle,
    formatActionTypeLabel: formatActivityActionTypeLabel,
    formatAuditActionLabel: formatActivityAuditActionLabel,
    summarizeChangedFields: summarizeActivityChangedFields,
    taskSlaMeta(task) {
      return buildActivityTaskSlaMeta(task);
    },
    taskSlaBadgeClass(task) {
      return getTaskSlaBadgeClass(this.taskSlaMeta(task));
    },
    toPrettyJson(value) {
      if (!value) return '-';
      try {
        return JSON.stringify(value, null, 2);
      } catch (error) {
        return String(value);
      }
    },
    formatLogSourceLabel(value) {
      return formatActivityLogSourceLabel(value, this.logSources);
    },
    canOpenAuditRecord(entry) {
      return Boolean(resolveActivityAuditRecordLocation(entry));
    },
    canOpenTaskAlert(task) {
      return Boolean(resolveActivityTaskAlertLocation(task));
    },
    canDraftLifecyclePlan(task) {
      return canDraftActivityLifecyclePlan(task);
    },
    canLaunchLifecycleMaintenance(task) {
      return canDraftActivityLifecyclePlan(task);
    },
    canDraftResilienceRunbook(task) {
      return canDraftActivityResilienceRunbook(task);
    },
    canLaunchResilienceDrill(task) {
      return canDraftActivityResilienceRunbook(task);
    },
    canDraftVmMigration(task) {
      return canDraftActivityVmMigration(task);
    },
  },
};
