const ActivityView = {
  components: {
    DataTable,
    StatusBadge,
    ActivityWorkspaceDialogs,
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

      <activity-workspace-dialogs
        :show-props="showProps"
        :detail-title="detailTitle"
        :selected-item-type="selectedItemType"
        :selected-task="selectedTask"
        :selected-audit="selectedAudit"
        :remediation-saving="remediationSaving"
        :remediation-error="remediationError"
        :log-sources="logSources"
        @close="showProps = false"
        @save-remediation-task="saveRemediationTask"
        @open-task-alert="openTaskAlert"
        @open-task-target-workspace="openTaskTargetWorkspace"
        @open-task-lifecycle-maintenance="openTaskLifecycleMaintenance"
        @open-task-lifecycle-draft="openTaskLifecycleDraft"
        @open-task-resilience-drill="openTaskResilienceDrill"
        @open-task-resilience-draft="openTaskResilienceDraft"
        @open-task-vm-migration-draft="openTaskVmMigrationDraft"
        @open-deployment-vm="openDeploymentVm"
        @open-deployment-template="openDeploymentTemplate"
        @open-audit-record="openAuditRecord"
        @open-audit-workspace="openAuditWorkspace">
      </activity-workspace-dialogs>
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
      return sortActivityAuditEntries(this.auditEntries);
    },
    filteredTasks() {
      return filterActivityTasks(this.tasks, this.activeFilter);
    },
    filteredAuditEntries() {
      return filterActivityAuditEntries(this.auditEntries, this.activeFilter);
    },
    filteredLogs() {
      return filterActivityLogs(this.logs, this.logSource, this.activeFilter);
    },
    recentChanges() {
      return this.filteredAuditEntries;
    },
    summaryCards() {
      return buildActivitySummaryCards(this.tasks, this.auditEntries, this.logs);
    },
    operatorRows() {
      return buildActivityOperatorRows(this.auditEntries);
    },
    logSourceRows() {
      return buildActivityLogSourceRows(this.logSources, this.logs);
    },
    detailTitle() {
      return getActivityDetailTitle(this.selectedItemType);
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
    isRemediationTask: isRemediationActivityTask,
    isTemplateDeploymentTask: isTemplateDeploymentActivityTask,
    formatTemplateLaunchMode: formatActivityTemplateLaunchMode,
    formatTaskRecurrence: formatActivityTaskRecurrence,
    taskEvidenceChecklist: getActivityTaskEvidenceChecklist,
    taskCompletionCriteria: getActivityTaskCompletionCriteria,
    taskResult: getActivityTaskResult,
    taskSourceLabel: getActivityTaskSourceLabel,
    taskSourceTitle: getActivityTaskSourceTitle,
    formatActionTypeLabel: formatActivityActionTypeLabel,
    formatAuditActionLabel: formatActivityAuditActionLabel,
    summarizeChangedFields: summarizeActivityChangedFields,
    buildTaskFocus: buildActivityTaskFocus,
    findTaskByFocus(focus) {
      return findActivityTaskByFocus(this.tasks, focus);
    },
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
      return formatActivityLogSourceLabel(value, this.logSources);
    },
    resolveAuditRecordLocation(entry) {
      return resolveActivityAuditRecordLocation(entry);
    },
    canOpenAuditRecord(entry) {
      return Boolean(resolveActivityAuditRecordLocation(entry));
    },
    openAuditRecord(entry) {
      const location = resolveActivityAuditRecordLocation(entry);
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
      return resolveActivityTaskAlertLocation(task);
    },
    canOpenTaskAlert(task) {
      return Boolean(resolveActivityTaskAlertLocation(task));
    },
    openTaskAlert(task) {
      const location = resolveActivityTaskAlertLocation(task);
      if (!location) return;
      this.showProps = false;
      this.$router.push(location);
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
    openTaskLifecycleDraft(task) {
      const location = buildActivityTaskLifecycleDraftLocation(task);
      if (!location) return;
      this.showProps = false;
      this.$router.push(location);
    },
    openTaskLifecycleMaintenance(task) {
      const location = buildActivityTaskLifecycleMaintenanceLocation(task);
      if (!location) return;
      this.showProps = false;
      this.$router.push(location);
    },
    openTaskResilienceDraft(task) {
      const location = buildActivityTaskResilienceDraftLocation(task);
      if (!location) return;
      this.showProps = false;
      this.$router.push(location);
    },
    openTaskResilienceDrill(task) {
      const location = buildActivityTaskResilienceDrillLocation(task);
      if (!location) return;
      this.showProps = false;
      this.$router.push(location);
    },
    openTaskVmMigrationDraft(task) {
      const location = buildActivityTaskVmMigrationLocation(task);
      if (!location) return;
      this.showProps = false;
      this.$router.push(location);
    },
    openTaskTargetWorkspace(task) {
      const location = buildActivityTaskWorkspaceLocation(task);
      if (!location) return;
      this.showProps = false;
      this.$router.push(location);
    },
    openDeploymentVm(task) {
      const location = buildActivityDeploymentVmLocation(task);
      if (!location) return;
      this.showProps = false;
      this.$router.push(location);
    },
    openDeploymentTemplate(task) {
      const location = buildActivityDeploymentTemplateLocation(task);
      if (!location) return;
      this.showProps = false;
      this.$router.push(location);
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
