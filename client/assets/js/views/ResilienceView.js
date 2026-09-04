const ResilienceView = {
  components: {
    StatusBadge,
    ResilienceWorkspaceDialogs,
  },
  template: `
    <div class="animate-fade-in">
      <div v-if="loading" class="empty-state">
        <span class="loading-spinner"></span>
        <p style="margin-top:12px">Loading protection posture, failover readiness, recovery runbooks, and drill evidence...</p>
      </div>

      <template v-else>
        <div class="section-head">
          <div>
            <h2 class="section-title">
              <span class="mdi mdi-shield-lock-outline"></span>
              Resilience
            </h2>
            <p class="section-subtitle">Protection coverage, failover posture, recovery runbooks, and drill evidence in one operator workspace.</p>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn" @click="openRunbookEditor(actionPlan)" :disabled="!actionPlan">
              <span class="mdi mdi-book-edit-outline"></span>
              Edit Runbook
            </button>
            <button class="btn" @click="openDrillLogger(actionPlan)" :disabled="!actionPlan">
              <span class="mdi mdi-clipboard-check-outline"></span>
              Log Drill
            </button>
            <button class="btn btn-primary" @click="loadResilience">
              <span class="mdi mdi-refresh"></span>
              Refresh
            </button>
          </div>
        </div>

        <div class="dashboard-hero resilience-hero">
          <div>
            <div class="dash-card-label">Recovery Control Plane</div>
            <h3>Backup freshness, HA intent, and operator runbooks in one queue.</h3>
            <p>This workspace now combines workload protection status, host failover posture, persisted recovery runbooks, and drill logging so disaster-readiness work is visible and actionable instead of living in notes alone.</p>
          </div>
          <div class="dashboard-hero-rail">
            <button class="btn btn-primary" @click="$router.push('/activity')">
              <span class="mdi mdi-timeline-clock-outline"></span>
              Recovery Events
            </button>
            <button class="btn" @click="$router.push('/hosts')">
              <span class="mdi mdi-server"></span>
              Host Plans
            </button>
            <button class="btn" @click="$router.push('/vms')">
              <span class="mdi mdi-desktop-tower"></span>
              VM Coverage
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

        <div class="dashboard-panels">
          <div class="dash-card">
            <div class="dash-card-label">Protection Policies</div>
            <div class="stack-list" v-if="protectionPolicies.length">
              <button class="stack-item stack-item-button"
                      v-for="policy in prioritizedPolicies.slice(0, 8)"
                      :key="policy.ref"
                      @click="openInspector('policy', policy)">
                <div class="capacity-item-main">
                  <strong>{{ policy.name_label }}</strong>
                  <div class="text-muted mono" style="font-size:11px">{{ policy.poolName }} · {{ policy.policy }} · {{ policy.power_state }}</div>
                  <div class="text-muted mono" style="font-size:11px">{{ policy.restorePointLabel }} · HA {{ policy.haRestartPriority }}</div>
                  <div class="text-muted" style="font-size:12px;margin-top:6px">{{ policy.recommendation }}</div>
                </div>
                <status-badge :status="policy.status"></status-badge>
              </button>
            </div>
            <div v-else class="empty-state" style="padding:20px 12px">No protection policy data available.</div>
          </div>

          <div class="dash-card">
            <div class="dash-card-label">Host Failover Readiness</div>
            <div class="stack-list" v-if="hostPlans.length">
              <button class="stack-item stack-item-button"
                      v-for="host in prioritizedHosts.slice(0, 8)"
                      :key="host.ref"
                      @click="openInspector('host', host)">
                <div class="capacity-item-main">
                  <strong>{{ host.name_label }}</strong>
                  <div class="text-muted mono" style="font-size:11px">{{ host.poolName }} · {{ host.address || host.uuid || host.ref }}</div>
                  <div class="text-muted mono" style="font-size:11px">{{ host.haPolicy }} HA · {{ host.residentVmCount }} VMs · {{ host.evacuationTarget }}</div>
                  <div class="text-muted" style="font-size:12px;margin-top:6px">{{ host.summary }}</div>
                </div>
                <status-badge :status="host.status"></status-badge>
              </button>
            </div>
            <div v-else class="empty-state" style="padding:20px 12px">No host readiness records available.</div>
          </div>
        </div>

        <div class="dashboard-panels">
          <div class="dash-card">
            <div class="dash-card-label">Recovery Plans</div>
            <div class="stack-list" v-if="recoveryPlans.length">
              <button class="stack-item stack-item-button"
                      v-for="plan in prioritizedRecoveryPlans"
                      :key="plan.ref"
                      @click="openInspector('plan', plan)">
                <div class="capacity-item-main">
                  <strong>{{ plan.name_label }}</strong>
                  <div class="text-muted mono" style="font-size:11px">{{ plan.haPolicy }} · RPO {{ plan.rpoMinutes }}m · RTO {{ plan.rtoMinutes }}m</div>
                  <div class="text-muted mono" style="font-size:11px">{{ plan.enabledHostCount }} hosts ready · {{ plan.protectedVmCount }} protected · {{ plan.drillCount }} drills</div>
                  <div class="text-muted" style="font-size:12px;margin-top:6px">{{ plan.nextAction }}</div>
                </div>
                <status-badge :status="plan.status"></status-badge>
              </button>
            </div>
            <div v-else class="empty-state" style="padding:20px 12px">No recovery plans reported.</div>
          </div>

          <div class="dash-card">
            <div class="dash-card-label">Drill Ledger</div>
            <div class="stack-list" v-if="drills.length">
              <button class="stack-item stack-item-button"
                      v-for="drill in drills.slice(0, 8)"
                      :key="drill.id"
                      @click="openDrillFromLedger(drill)">
                <div>
                  <strong>{{ formatDrillType(drill.drillType) }}</strong>
                  <div class="text-muted mono" style="font-size:11px">{{ resolvePoolLabel(drill.poolRef) }} · {{ formatDateTime(drill.executedAt) }}</div>
                  <div class="text-muted" style="font-size:12px;margin-top:6px">{{ drill.summary }}</div>
                </div>
                <status-badge :status="drill.status"></status-badge>
              </button>
            </div>
            <div v-else class="empty-state" style="padding:20px 12px">No drill history has been logged yet.</div>
          </div>
        </div>

        <div class="dashboard-panels">
          <div class="dash-card">
            <div class="dash-card-label">Runbook Coverage</div>
            <div class="stack-list" v-if="recoveryPlans.length">
              <div class="stack-item" v-for="plan in prioritizedRecoveryPlans.slice(0, 6)" :key="plan.ref">
                <div>
                  <strong>{{ plan.name_label }}</strong>
                  <div class="text-muted mono" style="font-size:11px">{{ plan.hasRunbook ? 'Runbook present' : 'Runbook missing' }} · {{ plan.owner || 'Unassigned owner' }}</div>
                  <div class="text-muted" style="font-size:12px;margin-top:6px">{{ plan.runbookSteps[0] || 'No runbook steps captured yet.' }}</div>
                </div>
                <span class="badge" :class="plan.hasRunbook ? 'badge-success' : 'badge-warning'">
                  {{ plan.hasRunbook ? 'Covered' : 'Gap' }}
                </span>
              </div>
            </div>
            <div v-else class="empty-state" style="padding:20px 12px">No pools available for runbook coverage tracking.</div>
          </div>

          <div class="dash-card">
            <div class="dash-card-label">Staged Automation Queue</div>
            <div class="stack-list" v-if="resilienceAutomationTasks.length">
              <button class="stack-item stack-item-button"
                      v-for="task in resilienceAutomationTasks.slice(0, 6)"
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
            <div v-else class="empty-state" style="padding:20px 12px">No resilience-specific remediation staging is queued yet.</div>
          </div>

          <div class="dash-card">
            <div class="dash-card-label">Recent Recovery Events</div>
            <div class="stack-list" v-if="recentEvents.length">
              <div class="stack-item" v-for="event in recentEvents.slice(0, 10)" :key="event.ref">
                <div>
                  <strong>{{ event.label }}</strong>
                  <div class="text-muted mono" style="font-size:11px">{{ event.type }} · {{ formatDateTime(event.timestamp) }}</div>
                  <div class="text-muted" style="font-size:12px;margin-top:6px">{{ event.detail || 'No detail provided' }}</div>
                </div>
                <status-badge :status="event.status"></status-badge>
              </div>
            </div>
            <div v-else class="empty-state" style="padding:20px 12px">No recent resilience events reported.</div>
          </div>
        </div>

        <resilience-workspace-dialogs
          :show-inspector="showInspector"
          :inspector-title="inspectorTitle"
          :selected-item-type="selectedItemType"
          :selected-item="selectedItem"
          :show-runbook-editor="showRunbookEditor"
          :runbook-window-title="runbookWindowTitle"
          :active-plan="activePlan"
          :active-plan-hosts="activePlanHosts"
          :runbook-error="runbookError"
          :runbook-draft="runbookDraft"
          :networks="networks"
          :saving-runbook="savingRunbook"
          :runbook-submit-label="runbookSubmitLabel"
          :runbook-source-task="runbookSourceTask"
          :runbook-launch-mode="runbookLaunchMode"
          :runbook-can-execute-drill="runbookCanExecuteDrill"
          :runbook-drill-saving="runbookDrillSaving"
          :runbook-drill-error="runbookDrillError"
          :show-drill-logger="showDrillLogger"
          :drill-error="drillError"
          :logging-drill="loggingDrill"
          @close-inspector="closeInspector"
          @open-runbook-editor="openRunbookEditor"
          @open-drill-logger="openDrillLogger"
          @delete-runbook="deleteRunbook"
          @close-runbook-editor="closeRunbookEditor"
          @save-runbook="saveRunbook"
          @execute-runbook-drill="executeRunbookDrill"
          @close-drill-logger="closeDrillLogger"
          @save-drill="saveDrill">
        </resilience-workspace-dialogs>
      </template>
    </div>
  `,
  data() {
    return {
      loading: true,
      savingRunbook: false,
      loggingDrill: false,
      summary: {
        protectedVmCount: 0,
        atRiskVmCount: 0,
        maintenanceHostCount: 0,
        recoveryPlanCount: 0,
        recentEventCount: 0,
        runbookCoverageCount: 0,
        staleRestorePointCount: 0,
        overdueDrillCount: 0,
      },
      protectionPolicies: [],
      hostPlans: [],
      recoveryPlans: [],
      recentEvents: [],
      automationTasks: [],
      runbooks: [],
      drills: [],
      selectedItem: null,
      selectedItemType: '',
      showInspector: false,
      showRunbookEditor: false,
      showDrillLogger: false,
      activePlan: null,
      runbookLaunchMode: 'runbook',
      runbookError: '',
      runbookDrillSaving: false,
      runbookDrillError: '',
      drillError: '',
      networks: [],
      relatedHosts: [],
      relatedPools: [],
      relatedVMs: [],
      relatedStorage: [],
      runbookSeed: null,
      runbookSourceTask: null,
      lastAppliedFocusKey: '',
    };
  },
  computed: {
    actionPlan() {
      return this.prioritizedRecoveryPlans[0] || this.recoveryPlans[0] || null;
    },
    summaryCards() {
      return buildResilienceSummaryCards(this.summary);
    },
    prioritizedPolicies() {
      return buildPrioritizedResiliencePolicies(this.protectionPolicies);
    },
    prioritizedHosts() {
      return buildPrioritizedResilienceHosts(this.hostPlans);
    },
    prioritizedRecoveryPlans() {
      return buildPrioritizedRecoveryPlans(this.recoveryPlans);
    },
    runbookCanExecuteDrill() {
      return Boolean(this.activePlan);
    },
    runbookWindowTitle() {
      return getResilienceRunbookWindowTitle(this.runbookLaunchMode);
    },
    runbookSubmitLabel() {
      return getResilienceRunbookSubmitLabel(this.runbookLaunchMode);
    },
    resilienceAutomationTasks() {
      return buildResilienceAutomationTasks(this.automationTasks);
    },
    runbookDraft() {
      return buildResilienceRunbookDraft(this.activePlan, this.runbookSeed);
    },
    activePlanHosts() {
      return this.activePlan ? this.hostsForPlan(this.activePlan) : [];
    },
    inspectorTitle() {
      return getResilienceInspectorTitle(this.selectedItemType);
    },
  },
  async mounted() {
    if (!store.authenticated) {
      this.$router.push('/login');
      return;
    }

    await this.loadResilience();
    await this.syncRouteFocus();
  },
  watch: {
    '$route.query': {
      deep: true,
      async handler() {
        await this.loadResilience();
        await this.syncRouteFocus();
      },
    },
  },
  methods: {
    formatDateTime,
    truncateList,
    taskSlaMeta: getTaskDueMeta,
    formatHours: formatResilienceHours,
    formatDrillType: formatResilienceDrillType,
    isRemediationTask: isResilienceRemediationTask,
    isResilienceAutomationTask: isResilienceAutomationTask,
    taskEvidenceChecklist: getResilienceTaskEvidenceChecklist,
    taskCompletionCriteria: getResilienceTaskCompletionCriteria,
    taskSlaBadgeClass(task) {
      return getTaskSlaBadgeClass(this.taskSlaMeta(task));
    },
    findTaskByFocus(focus) {
      return findResilienceTaskByFocus(this.automationTasks, focus);
    },
    findHostRecord(value) {
      return findResilienceHostRecord(value, this.relatedHosts, this.hostPlans);
    },
    findVmRecord(value) {
      return findResilienceVmRecord(value, this.relatedVMs);
    },
    findStorageRecord(value) {
      return findResilienceStorageRecord(value, this.relatedStorage);
    },
    findPoolRecord(value) {
      return findResiliencePoolRecord(value, this.relatedPools);
    },
    findNetworkRecord(value) {
      return findResilienceNetworkRecord(value, this.networks);
    },
    resolvePoolForHost(host) {
      return resolveResiliencePoolForHost(host, this.relatedPools);
    },
    findPoolByVm(vm) {
      return findResiliencePoolByVm(vm, this.relatedHosts, this.relatedPools);
    },
    findPoolByStorage(sr) {
      return findResiliencePoolByStorage(sr, this.relatedHosts, this.relatedPools);
    },
    findPoolByNetwork(network) {
      return findResiliencePoolByNetwork(network, this.relatedHosts, this.relatedPools);
    },
    resolveRecoveryPlanForPool(pool) {
      return resolveResilienceRecoveryPlanForPool(pool, this.recoveryPlans);
    },
    findRecoveryPlanByTask(task) {
      return findResilienceRecoveryPlanByTask(task, {
        recoveryPlans: this.recoveryPlans,
        relatedHosts: this.relatedHosts,
        hostPlans: this.hostPlans,
        relatedVMs: this.relatedVMs,
        relatedStorage: this.relatedStorage,
        relatedPools: this.relatedPools,
        networks: this.networks,
      });
    },
    async syncRouteFocus() {
      const focus = getRouteFocus(this.$route.query);
      const seedAction = String(this.$route.query.seedAction || '').trim().toLowerCase();

      if (!focus || (focus.kind && focus.kind !== 'task')) {
        this.lastAppliedFocusKey = '';
        return;
      }

      if (this.loading || !this.recoveryPlans.length) return;

      const key = buildResilienceFocusKey(focus, seedAction);
      if (this.lastAppliedFocusKey === key) return;

      const task = this.findTaskByFocus(focus);
      if (!task) return;

      if (['resilience-runbook', 'resilience-drill'].includes(seedAction) && task.resilience_runbook_seed?.enabled) {
        const plan = this.findRecoveryPlanByTask(task);
        if (!plan) return;
        this.openRunbookEditor(plan, task.resilience_runbook_seed, task, seedAction === 'resilience-drill' ? 'drill' : 'runbook');
        this.lastAppliedFocusKey = key;
      }
    },
    openAutomationTask(task) {
      const location = buildResilienceAutomationTaskLocation(task);
      if (!location) return;
      this.showInspector = false;
      this.$router.push(location);
    },
    resolvePoolLabel(poolRef) {
      return resolveResiliencePoolLabel(poolRef, this.recoveryPlans);
    },
    hostsForPlan(plan) {
      return getResilienceHostsForPlan(this.hostPlans, plan);
    },
    openInspector(type, item) {
      this.selectedItemType = type;
      this.selectedItem = item;
      this.showInspector = true;
    },
    openDrillFromLedger(drill) {
      const plan = this.recoveryPlans.find((entry) => entry.ref === drill.poolRef);
      if (!plan) return;
      this.openInspector('plan', plan);
    },
    closeInspector() {
      this.showInspector = false;
      this.selectedItem = null;
      this.selectedItemType = '';
    },
    openRunbookEditor(plan, seed = null, sourceTask = null, launchMode = 'runbook') {
      if (!plan) return;
      this.activePlan = plan;
      this.runbookLaunchMode = launchMode === 'drill' ? 'drill' : 'runbook';
      this.runbookSeed = seed ? { ...seed } : null;
      this.runbookSourceTask = sourceTask || null;
      this.runbookError = '';
      this.runbookDrillError = '';
      this.showRunbookEditor = true;
    },
    closeRunbookEditor() {
      this.showRunbookEditor = false;
      this.activePlan = null;
      this.runbookLaunchMode = 'runbook';
      this.runbookSeed = null;
      this.runbookSourceTask = null;
      this.runbookError = '';
      this.runbookDrillSaving = false;
      this.runbookDrillError = '';
    },
    openDrillLogger(plan) {
      if (!plan) return;
      this.activePlan = plan;
      this.drillError = '';
      this.showDrillLogger = true;
    },
    closeDrillLogger() {
      this.showDrillLogger = false;
      this.activePlan = null;
      this.drillError = '';
    },
    buildPolicyChecklist(policy) {
      return buildResiliencePolicyChecklist(policy);
    },
    buildHostChecklist(host) {
      return buildResilienceHostChecklist(host);
    },
    buildPlanChecklist(plan) {
      return buildResiliencePlanChecklist(plan);
    },
    mapDrillStatusToTaskStatus(status) {
      return mapResilienceDrillStatusToTaskStatus(status);
    },
    async syncRunbookSourceTaskStatus(status, result) {
      if (!this.runbookSourceTask?.ref || !this.isRemediationTask(this.runbookSourceTask)) return;

      const currentStatus = String(this.runbookSourceTask.status || '').trim().toLowerCase();
      if (['success', 'warning', 'failure', 'cancelled'].includes(currentStatus)) return;

      const updatedTask = await api.updateRemediationTask(this.runbookSourceTask.ref, {
        status,
        assignee: this.runbookSourceTask.assignee || store.username || '',
        dueDate: this.runbookSourceTask.due_date || this.runbookSourceTask.dueDate || '',
        result,
        nameDescription: this.runbookSourceTask.name_description || this.runbookSourceTask.nameDescription || '',
      });

      this.automationTasks = this.automationTasks.map((task) => task.ref === updatedTask.ref ? updatedTask : task);
      this.runbookSourceTask = updatedTask;
    },
    async saveRunbook(payload) {
      if (!this.activePlan) return;
      this.savingRunbook = true;
      this.runbookError = '';
      try {
        await api.saveResilienceRunbook(this.activePlan.ref, {
          ...payload,
          sourceTaskRef: this.runbookSourceTask?.ref || this.runbookSeed?.sourceTaskRef || '',
          sourceTemplateId: this.runbookSeed?.sourceTemplateId || '',
          sourceTemplateName: this.runbookSeed?.sourceTemplateName || '',
        });
        await this.loadResilience();
        this.closeRunbookEditor();
      } catch (error) {
        console.error(error);
        this.runbookError = error.message || 'Unable to save recovery runbook';
      } finally {
        this.savingRunbook = false;
      }
    },
    async executeRunbookDrill(payload) {
      if (!this.activePlan) return;

      this.runbookDrillSaving = true;
      this.runbookDrillError = '';

      let taskSyncError = null;
      try {
        const drill = await api.logResilienceDrill(this.activePlan.ref, payload);
        const taskStatus = this.mapDrillStatusToTaskStatus(drill.status || payload.status);
        const poolLabel = this.activePlan.name_label || this.activePlan.poolName || this.activePlan.ref || 'Recovery plan';

        try {
          await this.syncRunbookSourceTaskStatus(
            taskStatus,
            `${this.formatDrillType(drill.drillType || payload.drillType)} drill logged for ${poolLabel} with ${String(drill.status || payload.status || 'pending').toLowerCase()} outcome. ${drill.summary || payload.summary || ''}`.trim()
          );
        } catch (error) {
          taskSyncError = error;
        }

        await this.loadResilience();

        if (taskSyncError) {
          this.runbookDrillError = 'The recovery drill was logged, but the source remediation task could not be updated automatically.';
        }
      } catch (error) {
        console.error(error);
        this.runbookDrillError = error.message || 'Unable to log the recovery drill from the runbook editor.';
      } finally {
        this.runbookDrillSaving = false;
      }
    },
    async deleteRunbook(plan) {
      if (!plan?.ref) return;
      this.savingRunbook = true;
      this.runbookError = '';
      try {
        const approvalId = await resolveGovernanceApproval({
          actionKey: 'resilience_runbook_delete',
          entityType: 'pool',
          entityRef: plan.ref,
          entityName: plan.name_label || plan.poolName || 'Recovery runbook',
          route: '/resilience',
        });
        await api.deleteResilienceRunbook(plan.ref, approvalId ? { approvalId } : null);
        await this.loadResilience();
        this.closeInspector();
      } catch (error) {
        if (error.code === 'APPROVAL_REQUIRED') {
          this.runbookError = 'Governance approval is required before deleting this recovery runbook.';
          await handoffToGovernanceApproval(
            this.$router,
            error.approvalDraft,
            'Approval required before deleting this recovery runbook.'
          );
          return;
        }
        this.runbookError = error.message || 'Unable to clear recovery runbook';
      } finally {
        this.savingRunbook = false;
      }
    },
    async saveDrill(payload) {
      if (!this.activePlan) return;
      this.loggingDrill = true;
      this.drillError = '';
      try {
        await api.logResilienceDrill(this.activePlan.ref, payload);
        await this.loadResilience();
        this.closeDrillLogger();
      } catch (error) {
        console.error(error);
        this.drillError = error.message || 'Unable to log recovery drill';
      } finally {
        this.loggingDrill = false;
      }
    },
    async loadResilience() {
      this.loading = true;
      try {
        const [result, networksResult, tasksResult, hostsResult, vmsResult, storageResult, poolsResult] = await Promise.all([
          api.getResilience(),
          api.getNetworks().catch(() => ({ data: [] })),
          api.getTasks().catch(() => ({ data: [] })),
          api.getHosts().catch(() => ({ data: [] })),
          api.getVMs().catch(() => ({ data: [] })),
          api.getSRs().catch(() => ({ data: [] })),
          api.getPools().catch(() => ({ data: [] })),
        ]);
        this.summary = { ...this.summary, ...(result.summary || {}) };
        this.protectionPolicies = result.protectionPolicies || [];
        this.hostPlans = result.hostPlans || [];
        this.recoveryPlans = result.recoveryPlans || [];
        this.recentEvents = result.recentEvents || [];
        this.runbooks = result.runbooks || [];
        this.drills = result.drills || [];
        this.networks = networksResult.data || [];
        this.automationTasks = tasksResult.data || [];
        this.relatedHosts = hostsResult.data || [];
        this.relatedVMs = vmsResult.data || [];
        this.relatedStorage = storageResult.data || [];
        this.relatedPools = poolsResult.data || [];
      } catch (error) {
        console.error(error);
        this.protectionPolicies = [];
        this.hostPlans = [];
        this.recoveryPlans = [];
        this.recentEvents = [];
        this.runbooks = [];
        this.drills = [];
        this.networks = [];
        this.automationTasks = [];
        this.relatedHosts = [];
        this.relatedVMs = [];
        this.relatedStorage = [];
        this.relatedPools = [];
      } finally {
        this.loading = false;
      }
    },
  },
};
