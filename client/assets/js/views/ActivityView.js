const ActivityView = {
  components: {
    DataTable,
    FloatingWindow,
    StatusBadge,
    'remediation-task-update-form': RemediationTaskUpdateForm,
  },
  template: `
    <div class="animate-fade-in">
      <div class="section-head">
        <div>
          <h2 class="section-title">
            <span class="mdi mdi-timeline-clock-outline"></span>
            Activity
          </h2>
          <p class="section-subtitle">Task history, centralized logs, operator audit entries, exportable records, and recent-change drill-downs across the XenMange control plane.</p>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button
            v-for="mode in viewModes"
            :key="mode.key"
            class="btn btn-sm"
            :class="{ 'btn-primary': viewMode === mode.key }"
            @click="viewMode = mode.key">
            {{ mode.label }}
          </button>
          <button
            v-for="filter in filters"
            :key="filter"
            class="btn btn-sm"
            :class="{ 'btn-primary': activeFilter === filter }"
            @click="activeFilter = filter">
            {{ filter }}
          </button>
          <button v-if="viewMode === 'logs'"
                  class="btn btn-sm"
                  @click="exportLogs('json')"
                  :disabled="exportingFormat === 'json'">
            <span class="mdi mdi-code-json"></span>
            {{ exportingFormat === 'json' ? 'Exporting...' : 'Export JSON' }}
          </button>
          <button v-if="viewMode === 'logs'"
                  class="btn btn-sm"
                  @click="exportLogs('html')"
                  :disabled="exportingFormat === 'html'">
            <span class="mdi mdi-language-html5"></span>
            {{ exportingFormat === 'html' ? 'Exporting...' : 'Export HTML' }}
          </button>
          <button v-if="viewMode === 'logs' && !store.demoMode"
                  class="btn btn-sm"
                  @click="exportLogs('pdf')"
                  :disabled="exportingFormat === 'pdf'">
            <span class="mdi mdi-file-pdf-box"></span>
            {{ exportingFormat === 'pdf' ? 'Exporting...' : 'Export PDF' }}
          </button>
          <button class="btn btn-sm" v-else-if="viewMode !== 'tasks'" @click="downloadAuditLog">
            <span class="mdi mdi-download"></span>
            Export Audit
          </button>
          <button class="btn btn-primary" @click="loadActivity">
            <span class="mdi mdi-refresh"></span>
            Refresh
          </button>
        </div>
      </div>

      <div class="dash-grid">
        <div class="dash-card" v-for="card in summaryCards" :key="card.key">
          <div class="dash-card-label">{{ card.label }}</div>
          <div class="dash-card-value" :class="card.valueClass || ''">{{ card.value }}</div>
          <div class="dash-card-icon mdi" :class="card.icon"></div>
          <div class="text-muted mono" style="margin-top:8px;font-size:11px">{{ card.detail }}</div>
        </div>
      </div>

      <div class="dashboard-panels" v-if="viewMode === 'changes'">
        <div class="dash-card">
          <div class="dash-card-label">Recent Changes</div>
          <div class="stack-list" v-if="recentChanges.length">
            <button class="stack-item stack-item-button"
                    v-for="entry in recentChanges.slice(0, 10)"
                    :key="entry.id"
                    @click="openAuditProperties(entry)">
              <div class="capacity-item-main">
                <strong>{{ entry.summary }}</strong>
                <div class="text-muted mono" style="font-size:11px">{{ formatAuditActionLabel(entry) }} · {{ entry.operator || 'system' }} · {{ formatDateTime(entry.happenedAt) }}</div>
                <div class="text-muted" style="font-size:12px;margin-top:6px">{{ entry.detail || summarizeChangedFields(entry) }}</div>
              </div>
              <status-badge :status="entry.status || 'info'"></status-badge>
            </button>
          </div>
          <div v-else class="empty-state" style="padding:20px 12px">No audit changes have been captured yet.</div>
        </div>

        <div class="dash-card">
          <div class="dash-card-label">Operator Pulse</div>
          <div class="stack-list" v-if="operatorRows.length">
            <div class="stack-item" v-for="row in operatorRows" :key="row.operator">
              <div>
                <strong>{{ row.operator }}</strong>
                <div class="text-muted mono" style="font-size:11px">{{ row.count }} audit entries · latest {{ formatDateTime(row.latestAt) }}</div>
              </div>
              <span class="badge badge-info">{{ row.categories }}</span>
            </div>
          </div>
          <div v-else class="empty-state" style="padding:20px 12px">No operator activity is available yet.</div>
        </div>
      </div>

      <div class="dashboard-panels" v-if="viewMode === 'logs'">
        <div class="dash-card">
          <div class="dash-card-label">Log Sources</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button v-for="source in logSources"
                    :key="source.value"
                    class="btn btn-sm"
                    :class="{ 'btn-primary': logSource === source.value }"
                    @click="logSource = source.value">
              {{ source.label }}
            </button>
          </div>
          <div class="text-muted mono" style="font-size:11px;margin-top:10px">
            {{ selectedLogIds.length ? `${selectedLogIds.length} selected for export` : 'Select rows to export specific records, or export the current filtered source view.' }}
          </div>
        </div>

        <div class="dash-card">
          <div class="dash-card-label">Source Coverage</div>
          <div class="stack-list">
            <div class="stack-item" v-for="row in logSourceRows" :key="row.source">
              <div>
                <strong>{{ row.label }}</strong>
                <div class="text-muted mono" style="font-size:11px">{{ row.count }} record{{ row.count === 1 ? '' : 's' }}</div>
              </div>
              <span class="badge badge-info">{{ row.tone }}</span>
            </div>
          </div>
        </div>
      </div>

      <data-table v-if="viewMode === 'tasks'"
                  :columns="taskColumns"
                  :data="filteredTasks"
                  :loading="loading"
                  :searchable="true"
                  @row-click="openTaskProperties">
        <template #cell-status="{ row }">
          <status-badge :status="row.status || 'info'"></status-badge>
        </template>
        <template #cell-name_label="{ row }">
          <div>
            <span style="color:var(--text-primary);font-weight:500">{{ row.name_label || 'Unnamed Task' }}</span>
            <div class="text-muted mono" style="font-size:11px">
              {{ taskSourceLabel(row) }} · {{ row.assignee || row.submitted_by || 'unassigned' }}
            </div>
          </div>
        </template>
        <template #cell-sla="{ row }">
          <div>
            <span class="badge" :class="taskSlaBadgeClass(row)">{{ taskSlaMeta(row).label }}</span>
            <div class="text-muted mono" style="font-size:11px;margin-top:4px">{{ taskSlaMeta(row).ageLabel }}</div>
          </div>
        </template>
        <template #cell-progress="{ row }">
          <span class="mono">{{ formatTaskProgress(row.progress) }}</span>
        </template>
        <template #cell-finished="{ row }">
          <span class="mono">{{ formatDateTime(row.finished || row.created) }}</span>
        </template>
      </data-table>

      <data-table v-else-if="viewMode === 'audit'"
                  :columns="auditColumns"
                  :data="filteredAuditEntries"
                  :loading="loading"
                  :searchable="true"
                  @row-click="openAuditProperties">
        <template #cell-status="{ row }">
          <status-badge :status="row.status || 'info'"></status-badge>
        </template>
        <template #cell-summary="{ row }">
          <span style="color:var(--text-primary);font-weight:500">{{ row.summary || row.entityName || 'Audit Entry' }}</span>
        </template>
        <template #cell-happenedAt="{ row }">
          <span class="mono">{{ formatDateTime(row.happenedAt) }}</span>
        </template>
        <template #cell-operator="{ row }">
          <span class="mono">{{ row.operator || 'system' }}</span>
        </template>
      </data-table>

      <data-table v-else-if="viewMode === 'logs'"
                  :columns="logColumns"
                  :data="filteredLogs"
                  :loading="loading"
                  :searchable="true"
                  :selectable="true"
                  :selected-keys="selectedLogIds"
                  row-key="id"
                  @row-click="openLogProperties"
                  @selection-change="handleLogSelection">
        <template #cell-severity="{ row }">
          <status-badge :status="row.severity || row.status || 'info'"></status-badge>
        </template>
        <template #cell-source="{ row }">
          <span class="badge badge-info">{{ formatLogSourceLabel(row.source) }}</span>
        </template>
        <template #cell-message="{ row }">
          <div>
            <span style="color:var(--text-primary);font-weight:500">{{ row.message || row.entityName || 'Log Entry' }}</span>
            <div class="text-muted mono" style="font-size:11px">{{ row.category || 'operations' }} · {{ row.actor || 'system' }}</div>
          </div>
        </template>
        <template #cell-timestamp="{ row }">
          <span class="mono">{{ formatDateTime(row.timestamp) }}</span>
        </template>
      </data-table>

      <floating-window :show="showProps"
                       :title="detailTitle"
                       :width="760"
                       :height="560"
                       @close="showProps = false">
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
              @submit="saveRemediationTask">
            </remediation-task-update-form>
            <div class="form-error" v-if="remediationError" style="text-align:left;margin-top:12px">{{ remediationError }}</div>
          </div>

          <div class="detail-section" v-if="isRemediationTask(selectedTask) && (canOpenTaskAlert(selectedTask) || selectedTask.target_route || canLaunchLifecycleMaintenance(selectedTask) || canDraftLifecyclePlan(selectedTask) || canLaunchResilienceDrill(selectedTask) || canDraftResilienceRunbook(selectedTask) || canDraftVmMigration(selectedTask))">
            <div class="detail-section-title">Follow-through</div>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              <button class="btn btn-primary btn-sm"
                      v-if="canOpenTaskAlert(selectedTask)"
                      @click="openTaskAlert(selectedTask)">
                <span class="mdi mdi-bell-alert-outline"></span>
                Open Source Alert
              </button>
              <button class="btn btn-sm"
                      v-if="selectedTask.target_route"
                      @click="openTaskTargetWorkspace(selectedTask)">
                <span class="mdi mdi-arrow-top-right"></span>
                Open Target Workspace
              </button>
              <button class="btn btn-sm"
                      v-if="canLaunchLifecycleMaintenance(selectedTask)"
                      @click="openTaskLifecycleMaintenance(selectedTask)">
                <span class="mdi mdi-wrench-clock"></span>
                Launch Maintenance Handoff
              </button>
              <button class="btn btn-sm"
                      v-if="canDraftLifecyclePlan(selectedTask)"
                      @click="openTaskLifecycleDraft(selectedTask)">
                <span class="mdi mdi-calendar-edit-outline"></span>
                Draft Lifecycle Plan
              </button>
              <button class="btn btn-sm"
                      v-if="canLaunchResilienceDrill(selectedTask)"
                      @click="openTaskResilienceDrill(selectedTask)">
                <span class="mdi mdi-clipboard-pulse-outline"></span>
                Launch Recovery Drill Handoff
              </button>
              <button class="btn btn-sm"
                      v-if="canDraftResilienceRunbook(selectedTask)"
                      @click="openTaskResilienceDraft(selectedTask)">
                <span class="mdi mdi-book-edit-outline"></span>
                Draft Recovery Runbook
              </button>
              <button class="btn btn-sm"
                      v-if="canDraftVmMigration(selectedTask)"
                      @click="openTaskVmMigrationDraft(selectedTask)">
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
                      @click="openDeploymentVm(selectedTask)">
                <span class="mdi mdi-monitor-cellphone"></span>
                Open Deployed VM
              </button>
              <button class="btn btn-sm"
                      v-if="selectedTask.template_ref"
                      @click="openDeploymentTemplate(selectedTask)">
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
                      @click="openAuditRecord(selectedAudit)">
                <span class="mdi mdi-open-in-app"></span>
                Open Affected Record
              </button>
              <button class="btn btn-sm"
                      v-if="selectedAudit.route"
                      @click="openAuditWorkspace(selectedAudit)">
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
    </div>
  `,
  data() {
    return {
      loading: true,
      viewMode: 'changes',
      activeFilter: 'all',
      filters: ['all', 'success', 'pending', 'warning', 'failure'],
      viewModes: [
        { key: 'changes', label: 'Recent Changes' },
        { key: 'logs', label: 'Log Center' },
        { key: 'tasks', label: 'Tasks' },
        { key: 'audit', label: 'Audit Trail' },
      ],
      tasks: [],
      auditEntries: [],
      logs: [],
      selectedTask: null,
      selectedAudit: null,
      selectedItemType: '',
      showProps: false,
      lastAppliedFocusKey: '',
      remediationSaving: false,
      remediationError: null,
      exportingFormat: '',
      selectedLogIds: [],
      logSource: 'all',
      taskColumns: [
        { key: 'status', label: 'Status' },
        { key: 'name_label', label: 'Task' },
        { key: 'sla', label: 'SLA' },
        { key: 'progress', label: 'Progress' },
        { key: 'finished', label: 'Finished' },
      ],
      auditColumns: [
        { key: 'status', label: 'Status' },
        { key: 'summary', label: 'Change' },
        { key: 'operator', label: 'Operator' },
        { key: 'happenedAt', label: 'Time' },
      ],
      logColumns: [
        { key: 'severity', label: 'Severity' },
        { key: 'source', label: 'Source' },
        { key: 'message', label: 'Message' },
        { key: 'timestamp', label: 'Time' },
      ],
      logSources: [
        { value: 'all', label: 'All Sources' },
        { value: 'audit', label: 'Audit' },
        { value: 'auth', label: 'Auth Events' },
        { value: 'alert', label: 'Alerts' },
        { value: 'remediation-task', label: 'Remediation' },
        { value: 'xen-task', label: 'Xen Tasks' },
      ],
    };
  },
  setup() {
    return { store };
  },
  computed: {
    sortedTasks() {
      return sortTasks(this.tasks);
    },
    sortedAuditEntries() {
      return [...this.auditEntries].sort((left, right) =>
        new Date(right.happenedAt || 0) - new Date(left.happenedAt || 0)
      );
    },
    filteredTasks() {
      if (this.activeFilter === 'all') {
        return this.sortedTasks;
      }
      return this.sortedTasks.filter((task) => (task.status || '').toLowerCase() === this.activeFilter);
    },
    filteredAuditEntries() {
      if (this.activeFilter === 'all') {
        return this.sortedAuditEntries;
      }
      return this.sortedAuditEntries.filter((entry) => {
        const status = String(entry.status || '').toLowerCase();
        if (this.activeFilter === 'failure') {
          return status === 'failure' || status === 'critical' || status === 'error';
        }
        return status === this.activeFilter;
      });
    },
    filteredLogs() {
      let entries = [...this.logs];

      if (this.logSource !== 'all') {
        entries = entries.filter((entry) => entry.source === this.logSource);
      }

      if (this.activeFilter !== 'all') {
        entries = entries.filter((entry) => {
          const severity = String(entry.severity || '').toLowerCase();
          const status = String(entry.status || '').toLowerCase();
          if (this.activeFilter === 'failure') {
            return ['failure', 'critical', 'error'].includes(severity) || ['failure', 'critical', 'error'].includes(status);
          }
          return severity === this.activeFilter || status === this.activeFilter;
        });
      }

      return entries;
    },
    recentChanges() {
      return this.filteredAuditEntries;
    },
    summaryCards() {
      const pendingTasks = this.tasks.filter((task) => ['pending', 'queued'].includes(String(task.status || '').toLowerCase())).length;
      const remediationTasks = this.tasks.filter((task) => this.isRemediationTask(task)).length;
      const operators = new Set(this.auditEntries.map((entry) => entry.operator || 'system'));
      const openRemediation = this.tasks.filter((task) => this.isRemediationTask(task) && !this.taskSlaMeta(task).isClosed);
      const overdueRemediation = openRemediation.filter((task) => this.taskSlaMeta(task).isOverdue).length;
      const dueSoonRemediation = openRemediation.filter((task) => this.taskSlaMeta(task).isDueSoon).length;
      const agingRemediation = openRemediation.filter((task) => this.taskSlaMeta(task).isAging && !this.taskSlaMeta(task).isOverdue).length;

      return [
        {
          key: 'changes',
          label: 'Central Logs',
          value: String(this.logs.length),
          detail: this.logs.length ? `${this.logs[0].message || 'Recent log entry'} is the latest federated event` : 'No centralized log entries captured yet',
          icon: 'mdi-clipboard-text-clock-outline',
          valueClass: this.logs.length ? 'text-cyan' : '',
        },
        {
          key: 'operators',
          label: 'Operators',
          value: String(operators.size),
          detail: operators.size ? `${[...operators][0]} is present in the current audit window` : 'No named operators have generated activity yet',
          icon: 'mdi-account-group-outline',
          valueClass: operators.size ? 'text-green' : '',
        },
        {
          key: 'tasks',
          label: 'Tasks',
          value: String(this.tasks.length),
          detail: pendingTasks
            ? `${pendingTasks} active task${pendingTasks === 1 ? '' : 's'} still running, including ${remediationTasks} remediation follow-through item${remediationTasks === 1 ? '' : 's'}`
            : `${remediationTasks} remediation follow-through item${remediationTasks === 1 ? '' : 's'} recorded in the queue`,
          icon: 'mdi-progress-clock',
          valueClass: pendingTasks ? 'text-amber' : 'text-green',
        },
        {
          key: 'sla',
          label: 'Queue Watch',
          value: String(overdueRemediation),
          detail: overdueRemediation
            ? `${overdueRemediation} overdue · ${dueSoonRemediation} due soon · ${agingRemediation} aging without due dates`
            : `${dueSoonRemediation} due soon · ${agingRemediation} aging without due dates`,
          icon: 'mdi-timer-alert-outline',
          valueClass: overdueRemediation ? 'text-red' : (dueSoonRemediation || agingRemediation ? 'text-amber' : 'text-green'),
        },
      ];
    },
    operatorRows() {
      const map = new Map();

      for (const entry of this.sortedAuditEntries) {
        const operator = entry.operator || 'system';
        const current = map.get(operator) || { operator, count: 0, latestAt: '', categories: new Set() };
        current.count += 1;
        if (!current.latestAt || new Date(entry.happenedAt || 0) > new Date(current.latestAt || 0)) {
          current.latestAt = entry.happenedAt;
        }
        current.categories.add(entry.category || 'operations');
        map.set(operator, current);
      }

      return [...map.values()]
        .map((row) => ({
          ...row,
          categories: `${row.categories.size} categor${row.categories.size === 1 ? 'y' : 'ies'}`,
        }))
        .sort((left, right) => right.count - left.count)
        .slice(0, 8);
    },
    logSourceRows() {
      return this.logSources
        .filter((source) => source.value !== 'all')
        .map((source) => {
          const count = this.logs.filter((entry) => entry.source === source.value).length;
          return {
            source: source.value,
            label: source.label,
            count,
            tone: count ? 'active' : 'idle',
          };
        });
    },
    detailTitle() {
      if (this.selectedItemType === 'audit') return 'Audit Detail';
      if (this.selectedItemType === 'log') return 'Log Detail';
      return 'Task Detail';
    },
  },
  async mounted() {
    if (!store.authenticated) {
      this.$router.push('/login');
      return;
    }
    await this.loadActivity();
    await this.syncRouteFocus();
  },
  watch: {
    '$route.query': {
      deep: true,
      async handler() {
        await this.syncRouteFocus();
      },
    },
  },
  methods: {
    formatDateTime,
    formatTaskProgress,
    taskSlaMeta(task) {
      const meta = getTaskDueMeta(task);
      if (this.isRemediationTask(task)) return meta;
      if (this.isTemplateDeploymentTask(task)) {
        const status = String(task.status || '').toLowerCase();
        if (status === 'success') {
          return {
            ...meta,
            tone: 'success',
            label: 'Validated',
            detail: task.validation_notes || task.result || 'Deployment validation completed successfully.',
          };
        }
        if (status === 'failure') {
          return {
            ...meta,
            tone: 'critical',
            label: 'Validation Failed',
            detail: task.validation_notes || task.result || 'Deployment validation failed and needs operator follow-through.',
          };
        }
        if (status === 'warning') {
          return {
            ...meta,
            tone: 'warning',
            label: 'Needs Review',
            detail: task.validation_notes || task.result || 'Deployment is waiting for operator review.',
          };
        }
        return {
          ...meta,
          tone: 'info',
          label: 'Awaiting Validation',
          detail: task.validation_notes || task.result || 'Deployment provisioning finished and validation is still pending.',
        };
      }
      return {
        ...meta,
        label: 'Background',
        tone: 'info',
        detail: 'Xen background tasks are tracked by status and progress rather than operator due dates.',
      };
    },
    taskSlaBadgeClass(task) {
      return getTaskSlaBadgeClass(this.taskSlaMeta(task));
    },
    formatTemplateLaunchMode(value) {
      const map = {
        queue: 'Queue Immediately',
        'lifecycle-plan': 'Launch Lifecycle Draft',
        'lifecycle-maintenance': 'Launch Maintenance Handoff',
        'resilience-runbook': 'Launch Recovery Runbook Draft',
        'resilience-drill': 'Launch Recovery Drill Handoff',
        'vm-migration': 'Launch VM Migration Handoff',
      };
      return map[String(value || 'draft').toLowerCase()] || 'Open Draft First';
    },
    formatTaskRecurrence(task) {
      const mode = String(task?.recurrence_mode || 'manual').toLowerCase();
      const scope = String(task?.recurrence_scope || 'object').toLowerCase();
      const scopeLabel = scope === 'alert' ? 'alert' : scope === 'class' ? 'class signature' : 'object';
      if (mode === 'once') return `Once per ${scopeLabel}`;
      if (mode === 'daily') return `Daily per ${scopeLabel}`;
      if (mode === 'weekly') return `Weekly per ${scopeLabel}`;
      if (mode === 'cooldown') return `${Number(task?.recurrence_cooldown_days || 1)}d cooldown per ${scopeLabel}`;
      return 'None';
    },
    taskEvidenceChecklist(task) {
      return Array.isArray(task?.evidence_checklist) ? task.evidence_checklist : [];
    },
    taskCompletionCriteria(task) {
      return Array.isArray(task?.completion_criteria) ? task.completion_criteria : [];
    },
    taskResult(task) {
      if (task.result) return String(task.result);
      if (this.isTemplateDeploymentTask(task) && task.validation_notes) return String(task.validation_notes);
      if (task.error_info && task.error_info.length) return task.error_info.map(String).join(' | ');
      return '-';
    },
    isRemediationTask(task) {
      return String(task?.task_kind || task?.source || '').toLowerCase() === 'remediation';
    },
    isTemplateDeploymentTask(task) {
      return String(task?.task_kind || task?.source || '').toLowerCase() === 'template_deployment';
    },
    taskSourceLabel(task) {
      if (this.isRemediationTask(task)) return 'remediation';
      if (this.isTemplateDeploymentTask(task)) return 'template deployment';
      return 'background task';
    },
    taskSourceTitle(task) {
      if (this.isRemediationTask(task)) return 'Remediation Task';
      if (this.isTemplateDeploymentTask(task)) return 'Template Deployment Run';
      return 'Xen Background Task';
    },
    formatActionTypeLabel(value) {
      const map = {
        inspect: 'Inspect Related Object',
        monitor: 'Monitor Trend',
        review: 'Schedule Review',
        evacuate: 'Prepare Evacuation',
        snapshot: 'Create Protection Point',
        lifecycle: 'Lifecycle Review',
        capacity: 'Capacity Review',
        resilience: 'Resilience Review',
        governance: 'Governance Review',
      };
      return map[String(value || '').toLowerCase()] || 'Review';
    },
    formatAuditActionLabel(entry) {
      if (entry.actionLabel) return entry.actionLabel;
      return String(entry.action || 'activity').replace(/_/g, ' ');
    },
    summarizeChangedFields(entry) {
      if (!entry.changedFields || !entry.changedFields.length) {
        return 'No field-level diff summary was captured for this entry.';
      }
      return entry.changedFields.map((change) => change.field).join(', ');
    },
    toPrettyJson(value) {
      if (!value) return '-';
      try {
        return JSON.stringify(value, null, 2);
      } catch (error) {
        return String(value);
      }
    },
    async loadActivity() {
      this.loading = true;
      try {
        const [tasksResult, auditResult, logsResult] = await Promise.all([
          api.getTasks().catch(() => ({ data: [] })),
          api.getAuditLog().catch(() => ({ data: [] })),
          api.getLogs().catch(() => ({ data: [] })),
        ]);
        this.tasks = tasksResult.data || [];
        this.auditEntries = auditResult.data || [];
        this.logs = logsResult.data || [];
      } catch (error) {
        console.error(error);
        this.tasks = [];
        this.auditEntries = [];
        this.logs = [];
      } finally {
        this.loading = false;
      }
      await this.syncRouteFocus();
    },
    openTaskProperties(row) {
      this.selectedTask = row;
      this.selectedAudit = null;
      this.selectedItemType = 'task';
      this.remediationError = null;
      this.showProps = true;
    },
    openAuditProperties(row) {
      this.selectedAudit = row;
      this.selectedTask = null;
      this.selectedItemType = 'audit';
      this.showProps = true;
    },
    openLogProperties(row) {
      this.selectedAudit = row;
      this.selectedTask = null;
      this.selectedItemType = 'log';
      this.showProps = true;
    },
    handleLogSelection(keys) {
      this.selectedLogIds = Array.isArray(keys) ? keys : [];
    },
    formatLogSourceLabel(value) {
      const source = this.logSources.find((entry) => entry.value === value);
      return source?.label || value || 'Source';
    },
    resolveAuditRecordLocation(entry) {
      if (!entry) return null;

      const entityType = String(entry.entityType || '').toLowerCase();
      const routeMap = {
        vm: { path: '/vms', kind: 'vm', cls: 'vm' },
        host: { path: '/hosts', kind: 'host', cls: 'host' },
        pool: { path: '/pools', kind: 'pool', cls: 'pool' },
        network: { path: '/networking', kind: 'network', cls: 'network' },
        sr: { path: '/storage', kind: 'storage', cls: 'sr' },
        vdi: { path: '/storage', kind: 'storage', cls: 'vdi' },
        vbd: { path: '/storage', kind: 'storage', cls: 'vbd' },
        alert: { path: '/alerts', kind: 'alert', cls: 'alert' },
        task: { path: '/activity', kind: 'task', cls: 'task' },
        template: { path: '/templates', kind: 'template', cls: 'template' },
      };

      const target = routeMap[entityType];
      if (!target) return null;

      return buildFocusedRoute(target.path, {
        kind: target.kind,
        ref: entry.entityRef || '',
        name: entry.entityName || entry.summary || '',
        cls: target.cls,
        source: 'activity',
      });
    },
    canOpenAuditRecord(entry) {
      return Boolean(this.resolveAuditRecordLocation(entry));
    },
    openAuditRecord(entry) {
      const location = this.resolveAuditRecordLocation(entry);
      if (!location) return;
      this.showProps = false;
      this.$router.push(location);
    },
    openAuditWorkspace(entry) {
      if (!entry?.route) return;
      this.showProps = false;
      this.$router.push(entry.route);
    },
    resolveTaskAlertLocation(task) {
      if (!task?.related_alert_ref && !task?.related_alert_uuid && !task?.related_alert_summary) return null;
      return buildFocusedRoute('/alerts', {
        kind: 'alert',
        ref: task.related_alert_ref || '',
        uuid: task.related_alert_uuid || '',
        name: task.related_alert_summary || task.name_label || '',
        cls: 'alert',
        source: 'activity',
      });
    },
    canOpenTaskAlert(task) {
      return Boolean(this.resolveTaskAlertLocation(task));
    },
    openTaskAlert(task) {
      const location = this.resolveTaskAlertLocation(task);
      if (!location) return;
      this.showProps = false;
      this.$router.push(location);
    },
    canDraftLifecyclePlan(task) {
      return Boolean(task?.lifecycle_plan_seed?.enabled);
    },
    canLaunchLifecycleMaintenance(task) {
      return this.canDraftLifecyclePlan(task);
    },
    canDraftResilienceRunbook(task) {
      return Boolean(task?.resilience_runbook_seed?.enabled);
    },
    canLaunchResilienceDrill(task) {
      return this.canDraftResilienceRunbook(task);
    },
    canDraftVmMigration(task) {
      return Boolean(task?.vm_migration_seed?.enabled);
    },
    buildTaskFocus(task) {
      return {
        kind: 'task',
        ref: task?.ref || '',
        uuid: task?.uuid || '',
        name: task?.name_label || '',
        cls: 'task',
        source: 'activity',
      };
    },
    openTaskLifecycleDraft(task) {
      if (!this.canDraftLifecyclePlan(task)) return;
      this.showProps = false;
      this.$router.push(buildFocusedRoute('/lifecycle', this.buildTaskFocus(task), {
        seedAction: 'lifecycle-plan',
      }));
    },
    openTaskLifecycleMaintenance(task) {
      if (!this.canLaunchLifecycleMaintenance(task)) return;
      this.showProps = false;
      this.$router.push(buildFocusedRoute('/lifecycle', this.buildTaskFocus(task), {
        seedAction: 'lifecycle-maintenance',
      }));
    },
    openTaskResilienceDraft(task) {
      if (!this.canDraftResilienceRunbook(task)) return;
      this.showProps = false;
      this.$router.push(buildFocusedRoute('/resilience', this.buildTaskFocus(task), {
        seedAction: 'resilience-runbook',
      }));
    },
    openTaskResilienceDrill(task) {
      if (!this.canLaunchResilienceDrill(task)) return;
      this.showProps = false;
      this.$router.push(buildFocusedRoute('/resilience', this.buildTaskFocus(task), {
        seedAction: 'resilience-drill',
      }));
    },
    openTaskVmMigrationDraft(task) {
      if (!this.canDraftVmMigration(task)) return;
      this.showProps = false;
      this.$router.push(buildFocusedRoute('/vms', this.buildTaskFocus(task), {
        seedAction: 'vm-migration',
      }));
    },
    openTaskTargetWorkspace(task) {
      if (!task?.target_route) return;

      const cls = String(task.related_class || '').toLowerCase();
      const relatedObject = String(task.related_object || '').trim();
      const relatedObjectRef = relatedObject.startsWith('OpaqueRef:') ? relatedObject : '';
      const relatedObjectUuid = relatedObjectRef ? '' : relatedObject;
      const kindMap = {
        host: 'host',
        sr: 'storage',
        vdi: 'storage',
        vbd: 'storage',
        vm: 'vm',
        pool: 'pool',
        network: 'network',
        vif: 'network',
        pif: 'network',
        bond: 'network',
        vlan: 'network',
      };

      this.showProps = false;
      this.$router.push(buildFocusedRoute(task.target_route, {
        kind: kindMap[cls] || '',
        ref: relatedObjectRef,
        uuid: relatedObjectUuid,
        name: task.related_alert_summary || task.name_label || '',
        cls,
        source: 'activity',
      }));
    },
    openDeploymentVm(task) {
      if (!task?.vm_ref) return;
      this.showProps = false;
      this.$router.push(buildFocusedRoute('/vms', {
        kind: 'vm',
        ref: task.vm_ref,
        name: task.vm_name || task.name_label || '',
        cls: 'vm',
        source: 'activity',
      }));
    },
    openDeploymentTemplate(task) {
      if (!task?.template_ref) return;
      this.showProps = false;
      this.$router.push(buildFocusedRoute('/templates', {
        kind: 'template',
        ref: task.template_ref,
        name: task.template_name || '',
        cls: 'template',
        source: 'activity',
      }));
    },
    async saveRemediationTask(payload) {
      if (!this.selectedTask?.ref || !this.isRemediationTask(this.selectedTask)) return;

      this.remediationSaving = true;
      this.remediationError = null;

      try {
        const [task, auditResult] = await Promise.all([
          api.updateRemediationTask(this.selectedTask.ref, payload),
          api.getAuditLog().catch(() => ({ data: this.auditEntries })),
        ]);

        this.tasks = this.tasks.map((entry) => entry.ref === task.ref ? task : entry);
        this.selectedTask = task;
        this.auditEntries = auditResult.data || this.auditEntries;
      } catch (error) {
        this.remediationError = error.message || 'Unable to update the remediation task';
      } finally {
        this.remediationSaving = false;
      }
    },
    findTaskByFocus(focus) {
      return this.tasks.find((task) =>
        recordMatchesRouteFocus(task, focus, ['ref', 'uuid', 'name_label'])
      ) || null;
    },
    async syncRouteFocus() {
      const focus = getRouteFocus(this.$route.query);
      if (!focus || (focus.kind && focus.kind !== 'task')) {
        this.lastAppliedFocusKey = '';
        return;
      }

      if (this.loading || !this.tasks.length) return;

      const key = getRouteFocusKey(focus);
      if (this.lastAppliedFocusKey === key) return;

      const match = this.findTaskByFocus(focus);
      if (!match) return;

      this.viewMode = 'tasks';
      this.openTaskProperties(match);
      this.lastAppliedFocusKey = key;
    },
    downloadAuditLog() {
      const payload = JSON.stringify(this.sortedAuditEntries, null, 2);
      const blob = new Blob([payload], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'xenmange-audit-log.json';
      anchor.click();
      window.URL.revokeObjectURL(url);
    },
    downloadBlob(content, type, filename) {
      const blob = content instanceof Blob ? content : new Blob([content], { type });
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      window.URL.revokeObjectURL(url);
    },
    buildHtmlLogExport(entries) {
      const rows = entries.map((entry) => `
        <tr>
          <td>${entry.timestamp || '-'}</td>
          <td>${this.formatLogSourceLabel(entry.source)}</td>
          <td>${entry.severity || '-'}</td>
          <td>${entry.actor || '-'}</td>
          <td>${entry.message || '-'}</td>
          <td>${entry.detail || '-'}</td>
        </tr>
      `).join('');

      return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>XenMange Log Export</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 32px; color: #101820; background: #f7fafc; }
    table { width: 100%; border-collapse: collapse; background: #fff; }
    th, td { border: 1px solid #d7dee8; padding: 10px 12px; text-align: left; vertical-align: top; font-size: 12px; }
    th { background: #edf2f7; font-size: 11px; text-transform: uppercase; }
  </style>
</head>
<body>
  <h1>XenMange Log Export</h1>
  <p>Generated at ${new Date().toISOString()} with ${entries.length} log record${entries.length === 1 ? '' : 's'}.</p>
  <table>
    <thead>
      <tr><th>Time</th><th>Source</th><th>Severity</th><th>Actor</th><th>Message</th><th>Detail</th></tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`;
    },
    async exportLogs(format) {
      const selectedEntries = this.selectedLogIds.length
        ? this.filteredLogs.filter((entry) => this.selectedLogIds.includes(entry.id))
        : this.filteredLogs;

      this.exportingFormat = format;

      try {
        if (store.demoMode) {
          if (format === 'pdf') {
            throw new Error('PDF export is unavailable in demo mode.');
          }

          if (format === 'json') {
            this.downloadBlob(
              JSON.stringify(selectedEntries, null, 2),
              'application/json',
              'xenmange-log-export.json'
            );
            return;
          }

          this.downloadBlob(
            this.buildHtmlLogExport(selectedEntries),
            'text/html',
            'xenmange-log-export.html'
          );
          return;
        }

        const response = await fetch('/api/logs/export', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({
            ids: this.selectedLogIds,
            format,
            source: this.logSource,
            severity: this.activeFilter,
          }),
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.message || payload.error || 'LOG_EXPORT_FAILED');
        }

        const blob = await response.blob();
        const disposition = response.headers.get('content-disposition') || '';
        const match = disposition.match(/filename="([^"]+)"/);
        this.downloadBlob(blob, blob.type || 'application/octet-stream', match?.[1] || `xenmange-log-export.${format}`);
      } catch (error) {
        console.error(error);
      } finally {
        this.exportingFormat = '';
      }
    },
  },
};
