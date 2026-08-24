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
          <p class="section-subtitle">Task history, operator audit entries, exportable change records, and recent-change drill-downs across the XenMange control plane.</p>
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
          <button class="btn btn-sm" v-if="viewMode !== 'tasks'" @click="downloadAuditLog">
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
              {{ isRemediationTask(row) ? 'remediation' : 'background task' }} · {{ row.assignee || 'unassigned' }}
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
            <span class="text-muted">Source</span><span>{{ isRemediationTask(selectedTask) ? 'Remediation Task' : 'Xen Background Task' }}</span>
            <span class="text-muted">Progress</span><span class="mono">{{ formatTaskProgress(selectedTask.progress) }}</span>
            <span class="text-muted">Created</span><span class="mono">{{ formatDateTime(selectedTask.created) }}</span>
            <span class="text-muted">Finished</span><span class="mono">{{ formatDateTime(selectedTask.finished) }}</span>
            <span class="text-muted">Resident On</span><span class="mono property-wrap">{{ selectedTask.resident_on || '-' }}</span>
            <span class="text-muted">UUID</span><span class="mono property-wrap">{{ selectedTask.uuid || '-' }}</span>
            <span class="text-muted">Result</span><span class="property-wrap">{{ taskResult(selectedTask) }}</span>
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

          <div class="detail-section" v-if="isRemediationTask(selectedTask) && (canOpenTaskAlert(selectedTask) || selectedTask.target_route || canDraftLifecyclePlan(selectedTask) || canDraftResilienceRunbook(selectedTask))">
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
                      v-if="canDraftLifecyclePlan(selectedTask)"
                      @click="openTaskLifecycleDraft(selectedTask)">
                <span class="mdi mdi-calendar-edit-outline"></span>
                Draft Lifecycle Plan
              </button>
              <button class="btn btn-sm"
                      v-if="canDraftResilienceRunbook(selectedTask)"
                      @click="openTaskResilienceDraft(selectedTask)">
                <span class="mdi mdi-book-edit-outline"></span>
                Draft Recovery Runbook
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

        <div v-if="selectedItemType === 'audit' && selectedAudit">
          <div class="property-grid">
            <span class="text-muted">Status</span><status-badge :status="selectedAudit.status || 'info'"></status-badge>
            <span class="text-muted">Summary</span><span>{{ selectedAudit.summary || '-' }}</span>
            <span class="text-muted">Action</span><span>{{ formatAuditActionLabel(selectedAudit) }}</span>
            <span class="text-muted">Operator</span><span class="mono">{{ selectedAudit.operator || 'system' }}</span>
            <span class="text-muted">Entity</span><span>{{ selectedAudit.entityType || 'record' }} · {{ selectedAudit.entityName || selectedAudit.entityRef || '-' }}</span>
            <span class="text-muted">Route</span><span>{{ selectedAudit.route || '-' }}</span>
            <span class="text-muted">Happened At</span><span class="mono">{{ formatDateTime(selectedAudit.happenedAt) }}</span>
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
        { key: 'tasks', label: 'Tasks' },
        { key: 'audit', label: 'Audit Trail' },
      ],
      tasks: [],
      auditEntries: [],
      selectedTask: null,
      selectedAudit: null,
      selectedItemType: '',
      showProps: false,
      lastAppliedFocusKey: '',
      remediationSaving: false,
      remediationError: null,
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
    };
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
          label: 'Audit Entries',
          value: String(this.auditEntries.length),
          detail: this.auditEntries.length ? `${this.auditEntries[0].summary || 'Recent audit entry'} is the latest recorded change` : 'No operator audit entries captured yet',
          icon: 'mdi-clipboard-text-clock-outline',
          valueClass: this.auditEntries.length ? 'text-cyan' : '',
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
    detailTitle() {
      if (this.selectedItemType === 'audit') return 'Audit Detail';
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
      return value === 'queue' ? 'Queue Immediately' : 'Open Draft First';
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
      if (task.error_info && task.error_info.length) return task.error_info.map(String).join(' | ');
      return '-';
    },
    isRemediationTask(task) {
      return String(task?.task_kind || task?.source || '').toLowerCase() === 'remediation';
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
        const [tasksResult, auditResult] = await Promise.all([
          api.getTasks().catch(() => ({ data: [] })),
          api.getAuditLog().catch(() => ({ data: [] })),
        ]);
        this.tasks = tasksResult.data || [];
        this.auditEntries = auditResult.data || [];
      } catch (error) {
        console.error(error);
        this.tasks = [];
        this.auditEntries = [];
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
    canDraftResilienceRunbook(task) {
      return Boolean(task?.resilience_runbook_seed?.enabled);
    },
    openTaskLifecycleDraft(task) {
      if (!this.canDraftLifecyclePlan(task)) return;
      this.showProps = false;
      this.$router.push(buildFocusedRoute('/lifecycle', {
        kind: 'task',
        ref: task.ref || '',
        uuid: task.uuid || '',
        name: task.name_label || '',
        cls: 'task',
        source: 'activity',
      }, {
        seedAction: 'lifecycle-plan',
      }));
    },
    openTaskResilienceDraft(task) {
      if (!this.canDraftResilienceRunbook(task)) return;
      this.showProps = false;
      this.$router.push(buildFocusedRoute('/resilience', {
        kind: 'task',
        ref: task.ref || '',
        uuid: task.uuid || '',
        name: task.name_label || '',
        cls: 'task',
        source: 'activity',
      }, {
        seedAction: 'resilience-runbook',
      }));
    },
    openTaskTargetWorkspace(task) {
      if (!task?.target_route) return;

      const cls = String(task.related_class || '').toLowerCase();
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
      };

      this.showProps = false;
      this.$router.push(buildFocusedRoute(task.target_route, {
        kind: kindMap[cls] || '',
        uuid: task.related_object || '',
        name: task.related_alert_summary || task.name_label || '',
        cls,
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
  },
};
