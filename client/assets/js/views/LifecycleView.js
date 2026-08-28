const LifecycleView = {
  components: {
    DataTable,
    StatusBadge,
    LifecycleWorkspaceDialogs,
  },
  template: `
    <div class="animate-fade-in">
      <div v-if="loading" class="empty-state">
        <span class="loading-spinner"></span>
        <p style="margin-top:12px">Loading lifecycle state, compliance hints, maintenance plans, and remediation tasks...</p>
      </div>

      <template v-else>
        <div class="section-head">
          <div>
            <h2 class="section-title">
              <span class="mdi mdi-shield-sync-outline"></span>
              Lifecycle
            </h2>
            <p class="section-subtitle">A lifecycle and compliance cockpit inspired by vCenter and SCVMM, now expanded with desired-state planning, maintenance orchestration, and host remediation queues.</p>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn" @click="openPlanner(actionHosts[0] || hostLifecycleRows[0])" :disabled="!hostLifecycleRows.length">
              <span class="mdi mdi-calendar-edit-outline"></span>
              Plan Maintenance
            </button>
            <button class="btn btn-primary" @click="loadLifecycle">
              <span class="mdi mdi-refresh"></span>
              Refresh
            </button>
          </div>
        </div>

        <div class="stack-item" v-if="workspaceMessage" style="margin-bottom:16px">
          <div>
            <strong>Workspace updated</strong>
            <div class="text-muted mono" style="font-size:11px">{{ workspaceMessage }}</div>
          </div>
          <span class="badge badge-running">ready</span>
        </div>

        <div class="dashboard-hero lifecycle-hero">
          <div>
            <div class="dash-card-label">Lifecycle Manager</div>
            <h3>Compliance posture, maintenance prep, and drift review in one queue.</h3>
            <p>XenMange now turns hosts, background tasks, alert context, and operator-authored lifecycle plans into a true lifecycle workspace so teams can schedule remediation, track reboots, and keep desired state visible.</p>
          </div>
          <div class="dashboard-hero-rail">
            <button class="btn btn-primary" @click="$router.push('/hosts')">
              <span class="mdi mdi-server"></span>
              Host Inventory
            </button>
            <button class="btn" @click="$router.push('/activity')">
              <span class="mdi mdi-timeline-clock-outline"></span>
              Lifecycle Tasks
            </button>
            <button class="btn" @click="$router.push('/alerts')">
              <span class="mdi mdi-bell-alert-outline"></span>
              Related Alerts
            </button>
          </div>
        </div>

        <div class="dash-grid">
          <div class="dash-card" v-for="card in lifecycleCards" :key="card.key">
            <div class="dash-card-label">{{ card.label }}</div>
            <div class="dash-card-value" :class="card.valueClass || ''">{{ card.value }}</div>
            <div class="dash-card-icon mdi" :class="card.icon"></div>
            <div class="text-muted mono" style="margin-top:8px;font-size:11px">{{ card.detail }}</div>
          </div>
        </div>

        <div class="dash-card" v-if="selectedLifecycleProfile.rows.length" style="margin-bottom:16px">
          <div class="dash-card-label">Batch Lifecycle Actions</div>
          <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap">
            <div>
              <strong>{{ selectedLifecycleProfile.rows.length }} lifecycle targets selected</strong>
              <div class="text-muted mono" style="font-size:11px;margin-top:4px">{{ selectedLifecycleProfile.summary }}</div>
            </div>
            <div class="dashboard-hero-rail" style="gap:8px">
              <button class="btn btn-sm btn-primary"
                      v-if="selectedLifecycleProfile.maintenanceReadyRows.length"
                      :disabled="Boolean(bulkActionBusy)"
                      @click="applyBulkLifecycleAction('maintenance-enter')">
                <span class="mdi mdi-wrench-clock"></span>
                {{ bulkActionBusy === 'maintenance-enter' ? 'Applying...' : `Enter Maintenance Selected (${selectedLifecycleProfile.maintenanceReadyRows.length})` }}
              </button>
              <button class="btn btn-sm"
                      v-if="selectedLifecycleProfile.maintenanceActiveRows.length"
                      :disabled="Boolean(bulkActionBusy)"
                      @click="applyBulkLifecycleAction('maintenance-exit')">
                <span class="mdi mdi-playlist-check"></span>
                {{ bulkActionBusy === 'maintenance-exit' ? 'Applying...' : `Exit Maintenance Selected (${selectedLifecycleProfile.maintenanceActiveRows.length})` }}
              </button>
              <button class="btn btn-sm"
                      v-if="selectedLifecycleProfile.plannedRows.length"
                      :disabled="Boolean(bulkActionBusy)"
                      @click="applyBulkLifecycleAction('clear-plans')">
                <span class="mdi mdi-delete-outline"></span>
                {{ bulkActionBusy === 'clear-plans' ? 'Clearing...' : `Clear Selected Plans (${selectedLifecycleProfile.plannedRows.length})` }}
              </button>
              <button class="btn btn-sm" :disabled="Boolean(bulkActionBusy)" @click="clearLifecycleSelection">Clear Selection</button>
            </div>
          </div>
          <div class="form-error" v-if="bulkError" style="text-align:left;margin-top:12px">{{ bulkError }}</div>
        </div>

        <div class="dashboard-panels">
          <div class="dash-card">
            <div class="dash-card-label">Compliance Queue</div>
            <data-table v-if="hostLifecycleRows.length"
                        :columns="columns"
                        :data="hostLifecycleRows"
                        :loading="false"
                        :searchable="true"
                        :selectable="true"
                        :selected-keys="selectedLifecycleRefs"
                        row-key="ref"
                        @selection-change="handleLifecycleSelectionChange"
                        @row-click="openInspector">
              <template #cell-name_label="{ row }">
                <div>
                  <strong style="color:var(--text-primary)">{{ row.name_label || row.hostname || 'Host' }}</strong>
                  <div class="text-muted mono" style="font-size:11px">{{ row.address || row.uuid || row.ref }}</div>
                </div>
              </template>
              <template #cell-lifecycleStatus="{ row }">
                <status-badge :status="row.lifecycleStatus"></status-badge>
              </template>
              <template #cell-maintenanceWindow="{ row }">
                <span class="mono">{{ row.maintenanceWindow }}</span>
              </template>
              <template #cell-planLabel="{ row }">
                <div>
                  <div class="mono" style="font-size:11px">{{ row.planLabel }}</div>
                  <div class="text-muted" style="font-size:12px;margin-top:4px">{{ row.summary }}</div>
                </div>
              </template>
              <template #cell-nextAction="{ row }">
                <span>{{ formatActionLabel(row.nextAction) }}</span>
              </template>
            </data-table>
            <div v-else class="empty-state" style="padding:20px 12px">No hosts reported.</div>
          </div>

          <div class="dash-card">
            <div class="dash-card-label">Maintenance Planner</div>
            <div class="stack-list" v-if="upcomingPlanRows.length">
              <button class="stack-item stack-item-button"
                      v-for="row in upcomingPlanRows.slice(0, 8)"
                      :key="row.ref"
                      @click="openPlanner(row)">
                <div>
                  <strong>{{ row.name_label || row.hostname || 'Host' }}</strong>
                  <div class="text-muted mono" style="font-size:11px">
                    {{ formatStageLabel(row.lifecyclePlan.targetStage) }} · {{ formatBaselineLabel(row.lifecyclePlan.baselineStatus) }} · {{ row.lifecyclePlan.owner || 'Unassigned' }}
                  </div>
                  <div class="text-muted mono" style="font-size:11px">
                    {{ row.lifecyclePlan.dueDate || 'No due date' }} · {{ row.lifecyclePlan.patchGroup || 'No patch group' }}
                  </div>
                </div>
                <status-badge :status="plannerStatus(row)"></status-badge>
              </button>
            </div>
            <div v-else class="empty-state" style="padding:20px 12px">No maintenance plans have been saved yet.</div>
          </div>
        </div>

        <div class="dashboard-panels">
          <div class="dash-card">
            <div class="dash-card-label">Lifecycle Tasks</div>
            <div class="stack-list" v-if="lifecycleTasks.length">
              <div class="stack-item" v-for="task in lifecycleTasks.slice(0, 8)" :key="task.ref">
                <div>
                  <strong>{{ task.name_label || 'Task' }}</strong>
                  <div class="text-muted mono" style="font-size:11px">{{ formatTaskProgress(task.progress) }} · {{ formatDateTime(task.finished || task.created) }}</div>
                </div>
                <status-badge :status="task.status || 'info'"></status-badge>
              </div>
            </div>
            <div v-else class="empty-state" style="padding:20px 12px">No lifecycle-oriented tasks in the current activity window.</div>
          </div>

          <div class="dash-card">
            <div class="dash-card-label">Staged Automation Queue</div>
            <div class="stack-list" v-if="lifecycleAutomationTasks.length">
              <button class="stack-item stack-item-button"
                      v-for="task in lifecycleAutomationTasks.slice(0, 6)"
                      :key="task.ref"
                      @click="openAutomationTask(task)">
                <div>
                  <strong>{{ task.name_label || 'Remediation Task' }}</strong>
                  <div class="text-muted mono" style="font-size:11px">{{ task.assignee || 'Unassigned' }} · {{ task.related_alert_summary || task.related_object || task.ref }}</div>
                  <div class="text-muted" style="font-size:12px;margin-top:6px">{{ task.workspace_summary || task.name_description || 'No workbench brief captured.' }}</div>
                  <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:6px">
                    <span class="badge" :class="taskSlaBadgeClass(task)">{{ taskSlaMeta(task).label }}</span>
                    <span class="text-muted mono" style="font-size:11px">{{ taskSlaMeta(task).ageLabel }}</span>
                  </div>
                  <div class="text-muted mono" style="font-size:11px;margin-top:6px">{{ taskEvidenceChecklist(task).length }} evidence · {{ taskCompletionCriteria(task).length }} completion</div>
                </div>
                <status-badge :status="task.status || 'pending'"></status-badge>
              </button>
            </div>
            <div v-else class="empty-state" style="padding:20px 12px">No lifecycle-specific remediation staging is queued yet.</div>
          </div>

          <div class="dash-card">
            <div class="dash-card-label">Desired State Summary</div>
            <div class="metric-row">
              <span>Planned Hosts</span>
              <strong class="text-cyan">{{ plannedHosts.length }}</strong>
            </div>
            <div class="metric-row">
              <span>Drifted Baselines</span>
              <strong class="text-amber">{{ driftedPlanHosts.length }}</strong>
            </div>
            <div class="metric-row">
              <span>Reboot Queue</span>
              <strong class="text-red">{{ rebootQueue.length }}</strong>
            </div>
            <div class="metric-row">
              <span>Evacuation Queue</span>
              <strong class="text-cyan">{{ evacuationQueue.length }}</strong>
            </div>
          </div>
        </div>

        <div class="dashboard-panels">
          <div class="dash-card">
            <div class="dash-card-label">Remediation Guidance</div>
            <div class="stack-list">
              <div class="stack-item" v-for="item in recommendations" :key="item.title">
                <div>
                  <strong>{{ item.title }}</strong>
                  <div class="text-muted" style="font-size:12px">{{ item.detail }}</div>
                </div>
                <status-badge :status="item.status"></status-badge>
              </div>
            </div>
          </div>

          <div class="dash-card">
            <div class="dash-card-label">Planner Coverage</div>
            <div class="stack-list">
              <div class="stack-item" v-for="item in coverageItems" :key="item.label">
                <div>
                  <strong>{{ item.label }}</strong>
                  <div class="text-muted mono" style="font-size:11px">{{ item.detail }}</div>
                </div>
                <span class="badge" :class="item.badgeClass">{{ item.value }}</span>
              </div>
            </div>
          </div>
        </div>

        <lifecycle-workspace-dialogs
          :show-inspector="showInspector"
          :selected-host="selectedHost"
          :selected-host-readiness-checklist="selectedHostReadinessChecklist"
          :selected-host-related-automation-tasks="selectedHostRelatedAutomationTasks"
          :show-planner="showPlanner"
          :planner-window-title="plannerWindowTitle"
          :planner-target-title="plannerTargetTitle"
          :planner-host="plannerHost"
          :planner-launch-mode="plannerLaunchMode"
          :planner-initial-value="plannerInitialValue"
          :planner-submit-label="plannerSubmitLabel"
          :plan-saving="planSaving"
          :plan-error="planError"
          :planner-source-task="plannerSourceTask"
          :planner-can-execute-maintenance="plannerCanExecuteMaintenance"
          :planner-host-maintenance-mode="plannerHostMaintenanceMode"
          :planner-maintenance-draft="plannerMaintenanceDraft"
          :planner-maintenance-network-options="plannerMaintenanceNetworkOptions"
          :planner-action-busy="plannerActionBusy"
          :planner-action-error="plannerActionError"
          @close-inspector="closeInspector"
          @open-planner="openPlanner"
          @delete-plan="deletePlan"
          @open-automation-task="openAutomationTask"
          @close-planner="closePlanner"
          @save-plan="savePlan"
          @enter-maintenance="enterPlannerMaintenanceMode"
          @exit-maintenance="exitPlannerMaintenanceMode">
        </lifecycle-workspace-dialogs>
      </template>
    </div>
  `,
  data() {
    return {
      loading: true,
      hosts: [],
      tasks: [],
      messages: [],
      lifecyclePlans: [],
      relatedPools: [],
      relatedVMs: [],
      relatedStorage: [],
      relatedNetworks: [],
      selectedHostRef: null,
      plannerHostRef: null,
      showInspector: false,
      showPlanner: false,
      planSaving: false,
      planError: null,
      plannerActionBusy: '',
      plannerActionError: null,
      plannerSeed: null,
      plannerLaunchMode: 'plan',
      plannerSourceTask: null,
      workspaceMessage: '',
      selectedLifecycleRefs: [],
      bulkActionBusy: '',
      bulkError: null,
      lastAppliedFocusKey: '',
      columns: [
        { key: 'name_label', label: 'Host' },
        { key: 'lifecycleStatus', label: 'Status' },
        { key: 'maintenanceWindow', label: 'Maintenance Window' },
        { key: 'planLabel', label: 'Lifecycle Plan' },
        { key: 'nextAction', label: 'Next Action' },
      ],
    };
  },
  computed: {
    lifecycleTasks() {
      return sortTasks(this.tasks.filter((task) => this.isLifecycleTask(task)));
    },
    lifecycleAutomationTasks() {
      return sortTasks(this.tasks.filter((task) => this.isLifecycleAutomationTask(task)));
    },
    lifecycleAlerts() {
      return sortMessages(this.messages.filter((message) => this.isLifecycleAlert(message)));
    },
    lifecycleWorkspaceModel() {
      return buildLifecycleWorkspaceModel({
        hosts: this.hosts,
        lifecycleTasks: this.lifecycleTasks,
        lifecycleAutomationTasks: this.lifecycleAutomationTasks,
        lifecycleAlerts: this.lifecycleAlerts,
        lifecyclePlans: this.lifecyclePlans,
        taskSlaMeta: (task) => this.taskSlaMeta(task),
        taskEvidenceChecklist: (task) => this.taskEvidenceChecklist(task),
        taskCompletionCriteria: (task) => this.taskCompletionCriteria(task),
        hostMatchesTask: (host, task) => this.hostMatchesTask(host, task),
        hostMatchesMessage: (host, message) => this.hostMatchesMessage(host, message),
        formatStageLabel: (value) => this.formatStageLabel(value),
      });
    },
    lifecyclePlannerModel() {
      return buildLifecyclePlannerModel({
        plannerHost: this.plannerHost,
        plannerSeed: this.plannerSeed,
        plannerLaunchMode: this.plannerLaunchMode,
        plannerSourceTask: this.plannerSourceTask,
        relatedPools: this.relatedPools,
        relatedNetworks: this.relatedNetworks,
      });
    },
    planMap() {
      return this.lifecycleWorkspaceModel.planMap;
    },
    hostLifecycleRows() {
      return this.lifecycleWorkspaceModel.hostLifecycleRows;
    },
    selectedLifecycleRows() {
      return filterSelectedLifecycleRows(this.hostLifecycleRows, this.selectedLifecycleRefs);
    },
    selectedLifecycleProfile() {
      return buildLifecycleSelectionProfile(this.hostLifecycleRows, this.selectedLifecycleRefs);
    },
    selectedHost() {
      if (!this.selectedHostRef) return null;
      return this.hostLifecycleRows.find((row) => row.ref === this.selectedHostRef) || null;
    },
    selectedHostReadinessChecklist() {
      return this.selectedHost ? this.buildReadinessChecklist(this.selectedHost) : [];
    },
    selectedHostRelatedAutomationTasks() {
      return this.selectedHost ? this.relatedAutomationTasks(this.selectedHost) : [];
    },
    plannerHost() {
      if (!this.plannerHostRef) return null;
      return this.hostLifecycleRows.find((row) => row.ref === this.plannerHostRef) || null;
    },
    plannerInitialValue() {
      return this.lifecyclePlannerModel.initialValue;
    },
    plannerWindowTitle() {
      return this.lifecyclePlannerModel.windowTitle;
    },
    plannerTargetTitle() {
      return this.lifecyclePlannerModel.targetTitle;
    },
    plannerSubmitLabel() {
      return this.lifecyclePlannerModel.submitLabel;
    },
    plannerHostPool() {
      return this.lifecyclePlannerModel.hostPool;
    },
    plannerHostMaintenanceMode() {
      return this.lifecyclePlannerModel.hostMaintenanceMode;
    },
    plannerMaintenanceNetworkOptions() {
      return this.lifecyclePlannerModel.maintenanceNetworkOptions;
    },
    plannerMaintenanceDraft() {
      return this.lifecyclePlannerModel.maintenanceDraft;
    },
    plannerCanExecuteMaintenance() {
      return this.lifecyclePlannerModel.canExecuteMaintenance;
    },
    compliantHosts() {
      return this.lifecycleWorkspaceModel.compliantHosts;
    },
    maintenanceHosts() {
      return this.lifecycleWorkspaceModel.maintenanceHosts;
    },
    actionHosts() {
      return this.lifecycleWorkspaceModel.actionHosts;
    },
    plannedHosts() {
      return this.lifecycleWorkspaceModel.plannedHosts;
    },
    driftedPlanHosts() {
      return this.lifecycleWorkspaceModel.driftedPlanHosts;
    },
    rebootQueue() {
      return this.lifecycleWorkspaceModel.rebootQueue;
    },
    evacuationQueue() {
      return this.lifecycleWorkspaceModel.evacuationQueue;
    },
    upcomingPlanRows() {
      return this.lifecycleWorkspaceModel.upcomingPlanRows;
    },
    lifecycleCards() {
      return this.lifecycleWorkspaceModel.lifecycleCards;
    },
    recommendations() {
      return this.lifecycleWorkspaceModel.recommendations;
    },
    coverageItems() {
      return this.lifecycleWorkspaceModel.coverageItems;
    },
  },
  async mounted() {
    if (!store.authenticated) {
      this.$router.push('/login');
      return;
    }

    await this.loadLifecycle();
    await this.syncRouteFocus();
  },
  watch: {
    '$route.query': {
      deep: true,
      async handler() {
        await this.syncRouteFocus();
      },
    },
    hostLifecycleRows() {
      const validRefs = new Set(this.hostLifecycleRows.map((row) => row.ref).filter(Boolean));
      this.selectedLifecycleRefs = this.selectedLifecycleRefs.filter((ref) => validRefs.has(ref));
    },
  },
  methods: {
    formatDateTime,
    formatTaskProgress,
    taskSlaMeta: getTaskDueMeta,
    taskSlaBadgeClass(task) {
      return getTaskSlaBadgeClass(this.taskSlaMeta(task));
    },
    formatStageLabel(value) {
      const map = {
        aligned: 'Aligned',
        review: 'Review',
        maintenance: 'Maintenance',
        remediate: 'Remediate',
      };
      return map[value] || 'Review';
    },
    formatBaselineLabel(value) {
      const map = {
        compliant: 'Compliant',
        drifted: 'Drifted',
        unknown: 'Unknown',
      };
      return map[value] || 'Unknown';
    },
    formatActionLabel(value) {
      const map = {
        none: 'No Action',
        scan: 'Run Scan',
        patch: 'Apply Patch',
        reboot: 'Schedule Reboot',
        validate: 'Validate Outcome',
      };
      return map[value] || 'Run Scan';
    },
    plannerStatus(row) {
      if (!row.lifecyclePlan) return 'info';
      if (row.lifecyclePlan.targetStage === 'remediate') return 'warning';
      if (row.lifecyclePlan.targetStage === 'maintenance') return 'pending';
      if (row.lifecyclePlan.targetStage === 'aligned' && row.lifecyclePlan.baselineStatus === 'compliant') return 'success';
      return 'info';
    },
    isLifecycleTask(task) {
      const haystack = `${task?.name_label || ''} ${task?.name_description || ''}`.toLowerCase();
      return /(patch|compliance|scan|baseline|maintenance|update|drift|reboot|remediat|firmware|lifecycle)/.test(haystack);
    },
    isLifecycleAutomationTask(task) {
      if (!this.isRemediationTask(task)) return false;
      return task.target_route === '/lifecycle' || String(task.action_type || '').toLowerCase() === 'lifecycle';
    },
    isRemediationTask(task) {
      return String(task?.task_kind || '').toLowerCase() === 'remediation' || String(task?.source || '').toLowerCase() === 'remediation';
    },
    isLifecycleAlert(message) {
      const haystack = `${message?.name || ''} ${message?.body || ''} ${message?.cls || ''}`.toLowerCase();
      return /(maintenance|patch|compliance|drift|host|baseline|update|firmware)/.test(haystack);
    },
    hostMatchesTask(host, task) {
      const haystack = `${task?.name_label || ''} ${task?.name_description || ''} ${task?.resident_on || ''} ${task?.related_object || ''} ${task?.workspace_summary || ''} ${task?.related_alert_summary || ''}`.toLowerCase();
      return haystack.includes((host.ref || '').toLowerCase())
        || haystack.includes((host.uuid || '').toLowerCase())
        || haystack.includes((host.name_label || '').toLowerCase())
        || haystack.includes((host.hostname || '').toLowerCase());
    },
    recordMatchesValue(record, value, fields = [], extraValues = []) {
      const needle = String(value || '').trim().toLowerCase();
      if (!record || !needle) return false;

      return [
        ...fields.map((field) => record?.[field]),
        ...extraValues,
      ]
        .filter(Boolean)
        .map((entry) => String(entry).trim().toLowerCase())
        .includes(needle);
    },
    hostRecordMatchesValue(host, value) {
      return this.recordMatchesValue(host, value, ['ref', 'uuid', 'name_label', 'hostname', 'address'], [
        ...(Array.isArray(host?.PBDs) ? host.PBDs : []),
        ...(Array.isArray(host?.PIFs) ? host.PIFs : []),
        ...(Array.isArray(host?.resident_VMs) ? host.resident_VMs : []),
      ]);
    },
    findVmRecord(value) {
      return this.relatedVMs.find((vm) => this.recordMatchesValue(vm, value, ['ref', 'uuid', 'name_label'], [
        ...(Array.isArray(vm?.VBDs) ? vm.VBDs : []),
        ...(Array.isArray(vm?.VIFs) ? vm.VIFs : []),
      ])) || null;
    },
    findStorageRecord(value) {
      return this.relatedStorage.find((sr) => this.recordMatchesValue(sr, value, ['ref', 'uuid', 'name_label'], [
        ...(Array.isArray(sr?.VDIs) ? sr.VDIs : []),
        ...(Array.isArray(sr?.PBDs) ? sr.PBDs : []),
      ])) || null;
    },
    findPoolRecord(value) {
      return this.relatedPools.find((pool) => this.recordMatchesValue(pool, value, ['ref', 'uuid', 'name_label'])) || null;
    },
    findNetworkRecord(value) {
      return this.relatedNetworks.find((network) =>
        this.recordMatchesValue(network, value, ['ref', 'uuid', 'name_label', 'bridge'], [
          ...(Array.isArray(network?.PIFs) ? network.PIFs : []),
          ...(Array.isArray(network?.VIFs) ? network.VIFs : []),
        ])
      ) || null;
    },
    findPreferredHostForPool(pool) {
      if (!pool) return null;

      const master = this.hostLifecycleRows.find((host) => this.hostRecordMatchesValue(host, pool.master));
      if (master) return master;

      return this.hostLifecycleRows.find((host) => poolContainsHost(pool, host) && host.enabled)
        || this.hostLifecycleRows.find((host) => poolContainsHost(pool, host))
        || this.hostLifecycleRows.find((host) => resolveHostPool(host, this.relatedPools)?.ref === pool.ref)
        || null;
    },
    findHostByVm(vm) {
      if (!vm) return null;

      const direct = this.hostLifecycleRows.find((host) =>
        [vm.resident_on, vm.affinity].some((value) => this.hostRecordMatchesValue(host, value))
      );
      if (direct) return direct;

      const pool = this.findPoolRecord(vm.pool);
      return this.findPreferredHostForPool(pool);
    },
    findHostByStorage(sr) {
      if (!sr) return null;

      const hostPbdRefs = new Set(Array.isArray(sr.PBDs) ? sr.PBDs : []);
      if (hostPbdRefs.size) {
        const direct = this.hostLifecycleRows.find((host) =>
          Array.isArray(host.PBDs) && host.PBDs.some((ref) => hostPbdRefs.has(ref))
        );
        if (direct) return direct;
      }

      const defaultSrPool = this.relatedPools.find((pool) => pool.default_SR === sr.ref);
      return this.findPreferredHostForPool(defaultSrPool);
    },
    findHostByNetwork(network) {
      if (!network) return null;

      const pifRefs = new Set(Array.isArray(network.PIFs) ? network.PIFs : []);
      if (pifRefs.size) {
        const direct = this.hostLifecycleRows.find((host) =>
          Array.isArray(host.PIFs) && host.PIFs.some((ref) => pifRefs.has(ref))
        );
        if (direct) return direct;
      }

      const migrationPool = this.relatedPools.find((pool) => pool.migration_network === network.ref);
      return this.findPreferredHostForPool(migrationPool);
    },
    taskEvidenceChecklist(task) {
      return Array.isArray(task?.evidence_checklist) ? task.evidence_checklist : [];
    },
    taskCompletionCriteria(task) {
      return Array.isArray(task?.completion_criteria) ? task.completion_criteria : [];
    },
    handleLifecycleSelectionChange(keys) {
      this.selectedLifecycleRefs = Array.isArray(keys) ? keys : [];
      this.bulkError = null;
    },
    clearLifecycleSelection() {
      this.selectedLifecycleRefs = [];
      this.bulkError = null;
    },
    buildBulkLifecycleMaintenancePayload(host) {
      const hostPool = resolveHostPool(host, this.relatedPools);
      const hostNetworkRecords = buildSelectedHostNetworkRecords(host, this.relatedNetworks, hostPool);
      const maintenanceNetworkOptions = buildHostMaintenanceNetworkOptions(hostPool, hostNetworkRecords, this.relatedNetworks);
      const draft = buildHostMaintenanceActionDraft(hostPool, maintenanceNetworkOptions);
      return {
        ...draft,
        evacuateRunningVms: host.lifecyclePlan?.evacuationRequired !== false,
      };
    },
    async resolveLifecyclePlanDeleteApproval(target) {
      return resolveGovernanceApproval({
        actionKey: 'lifecycle_plan_delete',
        entityType: 'host',
        entityRef: target.ref,
        entityName: target.name_label || target.hostname || target.address || 'Host lifecycle plan',
        route: '/lifecycle',
      });
    },
    relatedAutomationTasks(host) {
      return this.lifecycleAutomationTasks.filter((task) => this.hostMatchesTask(host, task)).slice(0, 4);
    },
    findTaskByFocus(focus) {
      return this.tasks.find((task) =>
        recordMatchesRouteFocus(task, focus, ['ref', 'uuid', 'name_label'])
      ) || null;
    },
    findHostByTask(task) {
      if (!task) return null;

      const relatedObject = String(task.related_object || task.resident_on || '').trim();
      const relatedObjectLower = relatedObject.toLowerCase();
      const relatedClass = String(task.related_class || '').trim().toLowerCase();
      const directMatch = this.hostLifecycleRows.find((host) =>
        [host.ref, host.uuid, host.name_label, host.hostname, host.address]
          .filter(Boolean)
          .map((value) => String(value).trim().toLowerCase())
          .includes(relatedObjectLower)
      );

      if (directMatch) return directMatch;

      if (relatedObject) {
        if (!relatedClass || ['vm', 'vbd', 'vif'].includes(relatedClass)) {
          const vm = this.findVmRecord(relatedObject);
          const vmHost = this.findHostByVm(vm);
          if (vmHost) return vmHost;
        }

        if (!relatedClass || ['sr', 'vdi'].includes(relatedClass)) {
          const sr = this.findStorageRecord(relatedObject);
          const storageHost = this.findHostByStorage(sr);
          if (storageHost) return storageHost;
        }

        if (!relatedClass || relatedClass === 'pool') {
          const pool = this.findPoolRecord(relatedObject);
          const poolHost = this.findPreferredHostForPool(pool);
          if (poolHost) return poolHost;
        }

        if (!relatedClass || ['network', 'pif', 'vif'].includes(relatedClass)) {
          const network = this.findNetworkRecord(relatedObject);
          const networkHost = this.findHostByNetwork(network);
          if (networkHost) return networkHost;
        }
      }

      return this.hostLifecycleRows.find((host) => this.hostMatchesTask(host, task)) || null;
    },
    async syncRouteFocus() {
      const focus = getRouteFocus(this.$route.query);
      const seedAction = String(this.$route.query.seedAction || '').trim().toLowerCase();

      if (!focus || (focus.kind && focus.kind !== 'task')) {
        this.lastAppliedFocusKey = '';
        return;
      }

      if (this.loading || !this.tasks.length || !this.hosts.length) return;

      const key = `${getRouteFocusKey(focus)}|${seedAction}`;
      if (this.lastAppliedFocusKey === key) return;

      const task = this.findTaskByFocus(focus);
      if (!task) return;

      if (['lifecycle-plan', 'lifecycle-maintenance'].includes(seedAction) && task.lifecycle_plan_seed?.enabled) {
        const host = this.findHostByTask(task);
        if (!host) return;
        this.openPlanner(host, task.lifecycle_plan_seed, task, seedAction === 'lifecycle-maintenance' ? 'maintenance' : 'plan');
        this.lastAppliedFocusKey = key;
      }
    },
    openAutomationTask(task) {
      if (!task?.ref) return;
      this.showInspector = false;
      this.$router.push(buildFocusedRoute('/activity', {
        kind: 'task',
        ref: task.ref || '',
        uuid: task.uuid || '',
        name: task.name_label || '',
        cls: 'task',
        source: 'lifecycle',
      }));
    },
    hostMatchesMessage(host, message) {
      const haystack = `${message?.name || ''} ${message?.body || ''} ${message?.obj_uuid || ''}`.toLowerCase();
      return haystack.includes((host.uuid || '').toLowerCase())
        || haystack.includes((host.name_label || '').toLowerCase())
        || haystack.includes((host.hostname || '').toLowerCase());
    },
    buildReadinessChecklist(row) {
      const plan = row.lifecyclePlan;
      return [
        {
          label: 'Planner coverage',
          detail: plan ? `Lifecycle plan updated ${formatDateTime(plan.updatedAt)}.` : 'No saved lifecycle plan exists for this host yet.',
          status: plan ? 'success' : 'warning',
        },
        {
          label: 'Evacuation readiness',
          detail: plan?.evacuationRequired
            ? 'Workloads must be drained or migrated before maintenance begins.'
            : 'No evacuation requirement has been marked for this host.',
          status: plan?.evacuationRequired ? 'pending' : 'info',
        },
        {
          label: 'Reboot coordination',
          detail: plan?.rebootRequired
            ? 'A reboot is part of this lifecycle plan and should be coordinated with the maintenance window.'
            : 'No reboot is currently required in the saved plan.',
          status: plan?.rebootRequired ? 'warning' : 'success',
        },
        {
          label: 'Alert posture',
          detail: row.lastAlertLabel,
          status: row.relatedMessages.length ? getMessageSeverity(row.relatedMessages[0]) : 'success',
        },
      ];
    },
    openInspector(row) {
      this.selectedHostRef = row.ref;
      this.showInspector = true;
    },
    closeInspector() {
      this.showInspector = false;
      this.selectedHostRef = null;
    },
    openPlanner(row, seed = null, sourceTask = null, launchMode = 'plan') {
      if (!row) return;
      this.plannerHostRef = row.ref;
      this.plannerSeed = seed ? { ...seed } : null;
      this.plannerLaunchMode = launchMode === 'maintenance' ? 'maintenance' : 'plan';
      this.plannerSourceTask = sourceTask || null;
      this.planError = null;
      this.plannerActionError = null;
      this.showPlanner = true;
    },
    closePlanner() {
      this.showPlanner = false;
      this.plannerHostRef = null;
      this.plannerSeed = null;
      this.plannerLaunchMode = 'plan';
      this.plannerSourceTask = null;
      this.planError = null;
      this.plannerActionBusy = '';
      this.plannerActionError = null;
    },
    async syncPlannerSourceTaskStatus(status, result) {
      if (!this.plannerSourceTask?.ref || !this.isRemediationTask(this.plannerSourceTask)) return;

      const currentStatus = String(this.plannerSourceTask.status || '').trim().toLowerCase();
      if (['success', 'warning', 'failure', 'cancelled'].includes(currentStatus)) return;

      const updatedTask = await api.updateRemediationTask(this.plannerSourceTask.ref, {
        status,
        assignee: this.plannerSourceTask.assignee || store.username || '',
        dueDate: this.plannerSourceTask.due_date || this.plannerSourceTask.dueDate || '',
        result,
        nameDescription: this.plannerSourceTask.name_description || this.plannerSourceTask.nameDescription || '',
      });

      this.tasks = this.tasks.map((task) => task.ref === updatedTask.ref ? updatedTask : task);
      this.plannerSourceTask = updatedTask;
    },
    async savePlan(payload) {
      if (!this.plannerHost) return;

      this.planSaving = true;
      this.planError = null;
      try {
        await api.saveLifecyclePlan(this.plannerHost.ref, {
          ...payload,
          sourceTaskRef: this.plannerSourceTask?.ref || this.plannerSeed?.sourceTaskRef || '',
          sourceTemplateId: this.plannerSeed?.sourceTemplateId || '',
          sourceTemplateName: this.plannerSeed?.sourceTemplateName || '',
        });
        await this.loadLifecycle();
        this.plannerSeed = null;
      } catch (error) {
        this.planError = error.message || 'Unable to save lifecycle plan';
      } finally {
        this.planSaving = false;
      }
    },
    async enterPlannerMaintenanceMode(payload) {
      if (!this.plannerHost?.ref) return;

      this.plannerActionBusy = 'maintenance-enter';
      this.plannerActionError = null;

      let taskSyncError = null;
      try {
        await api.enterHostMaintenance(this.plannerHost.ref, payload);

        const hostLabel = this.plannerHost.name_label || this.plannerHost.hostname || this.plannerHost.ref || 'Host';
        const evacuationLabel = payload.evacuateRunningVms
          ? 'Workload evacuation is in progress.'
          : 'No workload evacuation was requested.';

        try {
          await this.syncPlannerSourceTaskStatus(
            'in_progress',
            `Maintenance mode entered for ${hostLabel}. ${evacuationLabel}`
          );
        } catch (error) {
          taskSyncError = error;
        }

        await this.loadLifecycle();
        this.plannerSeed = null;

        if (taskSyncError) {
          this.plannerActionError = 'Maintenance mode was entered, but the source remediation task could not be advanced automatically.';
        }
      } catch (error) {
        this.plannerActionError = error.message || 'Unable to enter maintenance mode from the lifecycle planner.';
      } finally {
        this.plannerActionBusy = '';
      }
    },
    async exitPlannerMaintenanceMode() {
      if (!this.plannerHost?.ref) return;

      this.plannerActionBusy = 'maintenance-exit';
      this.plannerActionError = null;
      try {
        await api.exitHostMaintenance(this.plannerHost.ref);
        await this.loadLifecycle();
      } catch (error) {
        this.plannerActionError = error.message || 'Unable to exit maintenance mode from the lifecycle planner.';
      } finally {
        this.plannerActionBusy = '';
      }
    },
    async applyBulkLifecycleAction(action) {
      const isEnter = action === 'maintenance-enter';
      const isExit = action === 'maintenance-exit';
      const isClearPlans = action === 'clear-plans';
      if (!isEnter && !isExit && !isClearPlans) return;

      const targets = isEnter
        ? this.selectedLifecycleProfile.maintenanceReadyRows
        : isExit
          ? this.selectedLifecycleProfile.maintenanceActiveRows
          : this.selectedLifecycleProfile.plannedRows;

      if (!targets.length) {
        this.bulkError = isEnter
          ? 'No selected lifecycle targets are currently ready to enter maintenance mode.'
          : isExit
            ? 'No selected lifecycle targets are currently in maintenance mode.'
            : 'No selected lifecycle plans are available to clear.';
        return;
      }

      const confirmed = typeof window === 'undefined'
        ? true
        : window.confirm(
          isEnter
            ? `Enter maintenance mode for ${targets.length} selected host${targets.length === 1 ? '' : 's'} from the lifecycle queue?`
            : isExit
              ? `Exit maintenance mode for ${targets.length} selected host${targets.length === 1 ? '' : 's'} from the lifecycle queue?`
              : `Clear ${targets.length} selected lifecycle plan${targets.length === 1 ? '' : 's'}?`
        );
      if (!confirmed) return;

      this.workspaceMessage = '';
      this.bulkError = null;
      this.bulkActionBusy = action;
      let completed = 0;
      let approvalDraft = null;

      try {
        for (const target of targets) {
          try {
            if (isEnter) {
              await api.enterHostMaintenance(target.ref, this.buildBulkLifecycleMaintenancePayload(target));
            } else if (isExit) {
              await api.exitHostMaintenance(target.ref);
            } else {
              const approvalId = await this.resolveLifecyclePlanDeleteApproval(target);
              await api.deleteLifecyclePlan(target.ref, approvalId ? { approvalId } : null);
            }
            completed += 1;
          } catch (error) {
            approvalDraft = error.code === 'APPROVAL_REQUIRED' ? error.approvalDraft : null;
            this.bulkError = completed
              ? `Processed ${completed} lifecycle target(s) before stopping: ${error.message || 'Unable to continue the selected lifecycle action.'}`
              : (error.message || 'Unable to continue the selected lifecycle action.');
            break;
          }
        }
      } finally {
        this.bulkActionBusy = '';
      }

      if (completed) {
        await this.loadLifecycle();
        if (isEnter) {
          this.workspaceMessage = `${completed} selected host${completed === 1 ? '' : 's'} entered maintenance mode from the lifecycle queue.`;
        } else if (isExit) {
          this.workspaceMessage = `${completed} selected host${completed === 1 ? '' : 's'} exited maintenance mode from the lifecycle queue.`;
        } else {
          this.workspaceMessage = completed === 1
            ? '1 selected lifecycle plan was cleared from the maintenance planner queue.'
            : `${completed} selected lifecycle plans were cleared from the maintenance planner queue.`;
        }
      }

      if (approvalDraft) {
        await handoffToGovernanceApproval(
          this.$router,
          approvalDraft,
          'Approval required before clearing one or more selected lifecycle plans.'
        );
      }
    },
    async deletePlan(row) {
      const target = row?.ref ? row : this.selectedHost;
      if (!target?.ref) return;

      this.planSaving = true;
      this.planError = null;
      try {
        const approvalId = await this.resolveLifecyclePlanDeleteApproval(target);
        await api.deleteLifecyclePlan(target.ref, approvalId ? { approvalId } : null);
        await this.loadLifecycle();
      } catch (error) {
        if (error.code === 'APPROVAL_REQUIRED') {
          this.planError = 'Governance approval is required before clearing this lifecycle plan.';
          await handoffToGovernanceApproval(
            this.$router,
            error.approvalDraft,
            'Approval required before deleting this lifecycle plan.'
          );
          return;
        }
        this.planError = error.message || 'Unable to clear lifecycle plan';
      } finally {
        this.planSaving = false;
      }
    },
    async loadLifecycle() {
      this.loading = true;
      try {
        const [hostsResult, tasksResult, messagesResult, plansResult, poolsResult, vmsResult, storageResult, networksResult] = await Promise.all([
          api.getHosts(),
          api.getTasks(),
          api.dashboardMessages(),
          api.getLifecyclePlans().catch(() => ({ data: [] })),
          api.getPools().catch(() => ({ data: [] })),
          api.getVMs().catch(() => ({ data: [] })),
          api.getSRs().catch(() => ({ data: [] })),
          api.getNetworks().catch(() => ({ data: [] })),
        ]);

        this.hosts = hostsResult.data || [];
        this.tasks = tasksResult.data || [];
        this.messages = messagesResult || [];
        this.lifecyclePlans = plansResult.data || [];
        this.relatedPools = poolsResult.data || [];
        this.relatedVMs = vmsResult.data || [];
        this.relatedStorage = storageResult.data || [];
        this.relatedNetworks = networksResult.data || [];
      } catch (error) {
        console.error(error);
        this.hosts = [];
        this.tasks = [];
        this.messages = [];
        this.lifecyclePlans = [];
        this.relatedPools = [];
        this.relatedVMs = [];
        this.relatedStorage = [];
        this.relatedNetworks = [];
      } finally {
        this.loading = false;
      }
    },
  },
};
