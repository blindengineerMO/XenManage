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
    return createLifecycleViewState();
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
        taskEvidenceChecklist: taskEvidenceChecklistForLifecycle,
        taskCompletionCriteria: taskCompletionCriteriaForLifecycle,
        hostMatchesTask: hostMatchesLifecycleTask,
        hostMatchesMessage: hostMatchesLifecycleMessage,
        formatStageLabel: formatLifecycleStageLabel,
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
        await this.loadLifecycle();
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
    formatStageLabel: formatLifecycleStageLabel,
    formatBaselineLabel: formatLifecycleBaselineLabel,
    formatActionLabel: formatLifecycleActionLabel,
    plannerStatus: plannerStatusForLifecycleRow,
    isLifecycleTask: isLifecycleTaskRecord,
    isLifecycleAutomationTask: isLifecycleAutomationTaskRecord,
    isRemediationTask: isRemediationLifecycleTask,
    isLifecycleAlert: isLifecycleAlertRecord,
    hostMatchesTask: hostMatchesLifecycleTask,
    hostMatchesMessage: hostMatchesLifecycleMessage,
    taskEvidenceChecklist: taskEvidenceChecklistForLifecycle,
    taskCompletionCriteria: taskCompletionCriteriaForLifecycle,
    handleLifecycleSelectionChange(keys) {
      this.selectedLifecycleRefs = Array.isArray(keys) ? keys : [];
      this.bulkError = null;
    },
    clearLifecycleSelection() {
      this.selectedLifecycleRefs = [];
      this.bulkError = null;
    },
    buildBulkLifecycleMaintenancePayload(host) {
      return buildBulkLifecycleMaintenancePayload(host, this.relatedPools, this.relatedNetworks);
    },
    async resolveLifecyclePlanDeleteApproval(target) {
      return resolveGovernanceApproval(buildLifecyclePlanDeleteApprovalDraft(target));
    },
    relatedAutomationTasks(host) {
      return this.lifecycleAutomationTasks.filter((task) => hostMatchesLifecycleTask(host, task)).slice(0, 4);
    },
    async syncRouteFocus() {
      const nextState = await syncLifecycleRouteFocusWorkflow({
        routeQuery: this.$route.query,
        loading: this.loading,
        tasks: this.tasks,
        hosts: this.hosts,
        lastAppliedFocusKey: this.lastAppliedFocusKey,
        findTaskByFocus: (focus) => findLifecycleTaskByFocus(this.tasks, focus),
        resolveHostByTask: (task) => findLifecycleHostByTask(task, {
          hostLifecycleRows: this.hostLifecycleRows,
          relatedPools: this.relatedPools,
          relatedVMs: this.relatedVMs,
          relatedStorage: this.relatedStorage,
          relatedNetworks: this.relatedNetworks,
        }),
        openPlanner: (row, seed, sourceTask, launchMode) => this.openPlanner(row, seed, sourceTask, launchMode),
      });
      Object.assign(this, nextState);
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
    buildReadinessChecklist(row) {
      return buildLifecycleReadinessChecklist(row);
    },
    openInspector(row) {
      Object.assign(this, buildLifecycleInspectorOpenState(row));
    },
    closeInspector() {
      Object.assign(this, buildLifecycleInspectorClosedState());
    },
    openPlanner(row, seed = null, sourceTask = null, launchMode = 'plan') {
      if (!row) return;
      Object.assign(this, buildLifecyclePlannerOpenState(row, seed, sourceTask, launchMode));
    },
    closePlanner() {
      Object.assign(this, buildLifecyclePlannerClosedState());
    },
    async syncPlannerSourceTaskStatus(status, result) {
      const nextState = await syncLifecyclePlannerSourceTaskWorkflow({
        api,
        plannerSourceTask: this.plannerSourceTask,
        tasks: this.tasks,
        status,
        result,
        username: store.username || '',
      });
      this.tasks = nextState.tasks;
      this.plannerSourceTask = nextState.plannerSourceTask;
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

      const confirmed = await requestGlobalConfirm({
        title: isEnter
          ? 'Enter Maintenance Mode'
          : isExit
            ? 'Exit Maintenance Mode'
            : 'Clear Lifecycle Plans',
        message: isEnter
          ? `Enter maintenance mode for ${targets.length} selected host${targets.length === 1 ? '' : 's'} from the lifecycle queue?`
          : isExit
            ? `Exit maintenance mode for ${targets.length} selected host${targets.length === 1 ? '' : 's'} from the lifecycle queue?`
            : `Clear ${targets.length} selected lifecycle plan${targets.length === 1 ? '' : 's'}?`,
        confirmLabel: isEnter
          ? 'Enter Maintenance'
          : isExit
            ? 'Exit Maintenance'
            : 'Clear Plans',
        danger: !isExit,
      });
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
        Object.assign(this, await loadLifecycleContext(api));
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
