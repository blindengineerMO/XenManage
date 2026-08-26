const LifecycleView = {
  components: {
    FloatingWindow,
    StatusBadge,
    'lifecycle-plan-form': LifecyclePlanForm,
    'host-maintenance-form': HostMaintenanceForm,
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

        <div class="dashboard-panels">
          <div class="dash-card">
            <div class="dash-card-label">Compliance Queue</div>
            <div class="stack-list" v-if="hostLifecycleRows.length">
              <button class="stack-item stack-item-button"
                      v-for="row in hostLifecycleRows"
                      :key="row.ref"
                      @click="openInspector(row)">
                <div class="capacity-item-main">
                  <strong>{{ row.name_label || row.hostname || 'Host' }}</strong>
                  <div class="text-muted mono" style="font-size:11px">{{ row.address || row.uuid || row.ref }} · {{ row.maintenanceWindow }}</div>
                  <div class="text-muted mono" style="font-size:11px">{{ row.planLabel }}</div>
                  <div class="text-muted" style="font-size:12px;margin-top:6px">{{ row.summary }}</div>
                </div>
                <status-badge :status="row.lifecycleStatus"></status-badge>
              </button>
            </div>
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

        <floating-window :show="showInspector"
                         title="Lifecycle Detail"
                         :width="780"
                         :height="560"
                         @close="closeInspector">
          <div v-if="selectedHost">
            <div class="dashboard-hero" style="margin-bottom:12px;padding:18px">
              <div>
                <div class="dash-card-label">Lifecycle Record</div>
                <h3>{{ selectedHost.name_label || selectedHost.hostname || 'Host' }}</h3>
                <p>{{ selectedHost.summary }}</p>
              </div>
              <div class="dashboard-hero-rail">
                <button class="btn btn-primary" @click="openPlanner(selectedHost)">
                  <span class="mdi mdi-calendar-edit-outline"></span>
                  Edit Lifecycle Plan
                </button>
                <button class="btn" v-if="selectedHost.lifecyclePlan" @click="deletePlan(selectedHost)">
                  <span class="mdi mdi-delete-outline"></span>
                  Clear Plan
                </button>
              </div>
            </div>

            <div class="property-grid">
              <span class="text-muted">Host</span><span>{{ selectedHost.name_label || selectedHost.hostname || '-' }}</span>
              <span class="text-muted">Address</span><span class="mono">{{ selectedHost.address || '-' }}</span>
              <span class="text-muted">Lifecycle Status</span><status-badge :status="selectedHost.lifecycleStatus"></status-badge>
              <span class="text-muted">Maintenance Window</span><span>{{ selectedHost.maintenanceWindow }}</span>
              <span class="text-muted">Lifecycle Hint</span><span>{{ selectedHost.lifecycleHint }}</span>
              <span class="text-muted">Baseline Status</span><span>{{ formatBaselineLabel(selectedHost.baselineStatus) }}</span>
              <span class="text-muted">Target Stage</span><span>{{ formatStageLabel(selectedHost.targetStage) }}</span>
              <span class="text-muted">Next Action</span><span>{{ formatActionLabel(selectedHost.nextAction) }}</span>
              <span class="text-muted">Plan Owner</span><span>{{ selectedHost.lifecyclePlan?.owner || 'Unassigned' }}</span>
              <span class="text-muted">Patch Group</span><span>{{ selectedHost.lifecyclePlan?.patchGroup || '-' }}</span>
              <span class="text-muted">Due Date</span><span>{{ selectedHost.lifecyclePlan?.dueDate || '-' }}</span>
              <span class="text-muted">Recent Task</span><span class="property-wrap">{{ selectedHost.lastTaskLabel }}</span>
              <span class="text-muted">Recent Alert</span><span class="property-wrap">{{ selectedHost.lastAlertLabel }}</span>
              <span class="text-muted">UUID</span><span class="mono property-wrap">{{ selectedHost.uuid || '-' }}</span>
              <span class="text-muted">Other Config</span><span class="mono property-wrap">{{ JSON.stringify(selectedHost.other_config || {}) }}</span>
            </div>

            <div class="detail-section">
              <div class="detail-section-title">Recommended Action</div>
              <div class="capacity-callout">
                <strong>{{ selectedHost.summary }}</strong>
                <p>{{ selectedHost.recommendation }}</p>
              </div>
            </div>

            <div class="detail-section">
              <div class="detail-section-title">Readiness Checklist</div>
              <div class="stack-list">
                <div class="stack-item" v-for="item in buildReadinessChecklist(selectedHost)" :key="item.label">
                  <div>
                    <strong>{{ item.label }}</strong>
                    <div class="text-muted" style="font-size:12px">{{ item.detail }}</div>
                  </div>
                  <status-badge :status="item.status"></status-badge>
                </div>
              </div>
            </div>

            <div class="detail-section" v-if="selectedHost.lifecyclePlan?.notes">
              <div class="detail-section-title">Planner Notes</div>
              <div class="capacity-callout">
                <p>{{ selectedHost.lifecyclePlan.notes }}</p>
              </div>
            </div>

            <div class="detail-section" v-if="relatedAutomationTasks(selectedHost).length">
              <div class="detail-section-title">Staged Follow-Through</div>
              <div class="stack-list">
                <button class="stack-item stack-item-button"
                        v-for="task in relatedAutomationTasks(selectedHost)"
                        :key="task.ref"
                        @click="openAutomationTask(task)">
                  <div>
                    <strong>{{ task.name_label || 'Remediation Task' }}</strong>
                    <div class="text-muted mono" style="font-size:11px">{{ task.assignee || 'Unassigned' }} · {{ taskEvidenceChecklist(task).length }} evidence · {{ taskCompletionCriteria(task).length }} completion</div>
                    <div class="text-muted" style="font-size:12px;margin-top:6px">{{ task.workspace_summary || task.name_description || 'No workbench brief captured.' }}</div>
                    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:6px">
                      <span class="badge" :class="taskSlaBadgeClass(task)">{{ taskSlaMeta(task).label }}</span>
                      <span class="text-muted mono" style="font-size:11px">{{ taskSlaMeta(task).ageLabel }}</span>
                    </div>
                  </div>
                  <status-badge :status="task.status || 'pending'"></status-badge>
                </button>
              </div>
            </div>
          </div>
        </floating-window>

        <floating-window :show="showPlanner"
                         :title="plannerWindowTitle"
                         :width="720"
                         :height="640"
                         @close="closePlanner">
          <div v-if="plannerHost">
            <div class="detail-section" style="margin-top:0">
              <div class="detail-section-title">{{ plannerTargetTitle }}</div>
              <div class="stack-item">
                <div>
                  <strong>{{ plannerHost.name_label || plannerHost.hostname || 'Host' }}</strong>
                  <div class="text-muted mono" style="font-size:11px">
                    {{ plannerHost.address || plannerHost.uuid || plannerHost.ref }} · {{ plannerHost.maintenanceWindow }}
                  </div>
                </div>
                <status-badge :status="plannerHost.lifecycleStatus"></status-badge>
              </div>
            </div>

            <div class="capacity-callout" v-if="plannerLaunchMode === 'maintenance'" style="margin-bottom:12px">
              <strong>Execution-first handoff active</strong>
              <p>This seeded flow opens the maintenance execution path immediately while keeping the lifecycle plan editable in the same window.</p>
            </div>

            <lifecycle-plan-form
              :host-record="plannerHost"
              :initial-value="plannerInitialValue"
              :submit-label="plannerSubmitLabel"
              :saving="planSaving"
              @submit="savePlan">
            </lifecycle-plan-form>

            <div class="form-error" v-if="planError" style="text-align:left">{{ planError }}</div>

            <div class="capacity-callout" v-if="plannerSourceTask" style="margin-top:12px">
              <strong>Seeded from remediation task</strong>
              <p>{{ plannerSourceTask.name_label || plannerSourceTask.related_alert_summary || plannerSourceTask.ref }}</p>
              <div class="text-muted mono" style="font-size:11px">
                {{ plannerSourceTask.template_name || 'manual template' }} · {{ plannerSourceTask.ref || '-' }}
              </div>
            </div>

            <div class="detail-section" v-if="plannerCanExecuteMaintenance">
              <div class="detail-section-title">Execution Handoff</div>
              <div class="dash-card">
                <div class="dash-card-label">Host Maintenance</div>
                <p class="text-muted" style="margin-bottom:12px">
                  Promote the lifecycle plan into a concrete host maintenance action without re-entering evacuation settings in another workspace.
                </p>
                <host-maintenance-form
                  v-if="!plannerHostMaintenanceMode"
                  :initial-value="plannerMaintenanceDraft"
                  :network-options="plannerMaintenanceNetworkOptions"
                  :saving="plannerActionBusy === 'maintenance-enter'"
                  submit-label="Enter Maintenance Mode"
                  @submit="enterPlannerMaintenanceMode">
                </host-maintenance-form>
                <div v-else class="stack-list">
                  <div class="stack-item">
                    <div>
                      <strong>Host is already in maintenance mode</strong>
                      <div class="text-muted mono" style="font-size:11px">
                        Re-enable this host after patching, validation, or diagnostics are complete.
                      </div>
                    </div>
                    <span class="badge badge-warning">maintenance</span>
                  </div>
                  <button class="btn btn-primary btn-sm"
                          :disabled="Boolean(plannerActionBusy)"
                          @click="exitPlannerMaintenanceMode">
                    <span class="mdi mdi-playlist-check"></span>
                    {{ plannerActionBusy === 'maintenance-exit' ? 'Re-enabling...' : 'Exit Maintenance Mode' }}
                  </button>
                </div>
                <div class="form-error" v-if="plannerActionError" style="text-align:left;margin-top:12px">{{ plannerActionError }}</div>
              </div>
            </div>

            <div class="stack-item" v-if="plannerHost.lifecyclePlan" style="margin-top:12px">
              <div>
                <strong>Current Planner Record</strong>
                <div class="text-muted mono" style="font-size:11px">
                  {{ formatStageLabel(plannerHost.lifecyclePlan.targetStage) }} · {{ plannerHost.lifecyclePlan.owner || 'Unassigned' }} · {{ formatDateTime(plannerHost.lifecyclePlan.updatedAt) }}
                </div>
              </div>
              <button class="btn btn-sm" @click="deletePlan(plannerHost)">
                <span class="mdi mdi-delete-outline"></span>
                Clear Plan
              </button>
            </div>
          </div>
        </floating-window>
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
      lastAppliedFocusKey: '',
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
    planMap() {
      return this.lifecyclePlans.reduce((acc, plan) => {
        acc[plan.hostRef] = plan;
        return acc;
      }, {});
    },
    hostLifecycleRows() {
      const priority = { critical: 0, pending: 1, warning: 2, disabled: 3, success: 4, notice: 5, info: 6 };

      return [...this.hosts.map((host) => this.buildHostLifecycleRow(host))]
        .sort((left, right) => {
          const statusDelta = (priority[left.lifecycleStatus] ?? 99) - (priority[right.lifecycleStatus] ?? 99);
          if (statusDelta !== 0) return statusDelta;
          return String(left.name_label || '').localeCompare(String(right.name_label || ''));
        });
    },
    selectedHost() {
      if (!this.selectedHostRef) return null;
      return this.hostLifecycleRows.find((row) => row.ref === this.selectedHostRef) || null;
    },
    plannerHost() {
      if (!this.plannerHostRef) return null;
      return this.hostLifecycleRows.find((row) => row.ref === this.plannerHostRef) || null;
    },
    plannerInitialValue() {
      if (!this.plannerHost) return null;
      if (!this.plannerSeed) return this.plannerHost.lifecyclePlan;
      return {
        ...(this.plannerHost.lifecyclePlan || {}),
        ...this.plannerSeed,
      };
    },
    plannerWindowTitle() {
      return this.plannerLaunchMode === 'maintenance' ? 'Maintenance Handoff' : 'Lifecycle Plan';
    },
    plannerTargetTitle() {
      return this.plannerLaunchMode === 'maintenance' ? 'Maintenance Target' : 'Planning Target';
    },
    plannerSubmitLabel() {
      return this.plannerLaunchMode === 'maintenance' ? 'Save Lifecycle Plan Before Maintenance' : 'Save Lifecycle Plan';
    },
    plannerHostPool() {
      return this.resolvePoolForHost(this.plannerHost);
    },
    plannerHostMaintenanceMode() {
      if (!this.plannerHost) return false;
      if (this.plannerHost.maintenance_mode === true) return true;
      return String(this.plannerHost.other_config?.maintenance_mode || '').toLowerCase() === 'true';
    },
    plannerMaintenanceNetworkOptions() {
      if (!this.plannerHost) return [];

      const hostPifRefs = new Set(Array.isArray(this.plannerHost.PIFs) ? this.plannerHost.PIFs : []);
      const records = this.relatedNetworks.filter((network) =>
        Array.isArray(network.PIFs) && network.PIFs.some((ref) => hostPifRefs.has(ref))
      );
      const ordered = [...records];
      const poolMigrationRef = this.plannerHostPool?.migration_network || '';
      if (poolMigrationRef) {
        const poolMigrationNetwork = this.relatedNetworks.find((network) => network.ref === poolMigrationRef);
        if (poolMigrationNetwork && !ordered.some((network) => network.ref === poolMigrationNetwork.ref)) {
          ordered.unshift(poolMigrationNetwork);
        }
      }
      return ordered;
    },
    plannerMaintenanceDraft() {
      return {
        networkRef: this.plannerHostPool?.migration_network || this.plannerMaintenanceNetworkOptions[0]?.ref || '',
        poolMigrationNetworkRef: this.plannerHostPool?.migration_network || '',
        evacuateBatchSize: 0,
        evacuateRunningVms: this.plannerInitialValue?.evacuationRequired !== false,
      };
    },
    plannerCanExecuteMaintenance() {
      return Boolean(this.plannerHost && (this.plannerHost.lifecyclePlan || this.plannerSeed || this.plannerSourceTask));
    },
    compliantHosts() {
      return this.hostLifecycleRows.filter((row) => row.lifecycleStatus === 'success');
    },
    maintenanceHosts() {
      return this.hostLifecycleRows.filter((row) => row.lifecycleStatus === 'disabled' || row.lifecycleHint === 'maintenance');
    },
    actionHosts() {
      return this.hostLifecycleRows.filter((row) => ['critical', 'warning', 'pending'].includes(row.lifecycleStatus));
    },
    plannedHosts() {
      return this.hostLifecycleRows.filter((row) => Boolean(row.lifecyclePlan));
    },
    driftedPlanHosts() {
      return this.plannedHosts.filter((row) => row.baselineStatus === 'drifted');
    },
    rebootQueue() {
      return this.plannedHosts.filter((row) => row.lifecyclePlan?.rebootRequired);
    },
    evacuationQueue() {
      return this.plannedHosts.filter((row) => row.lifecyclePlan?.evacuationRequired);
    },
    upcomingPlanRows() {
      return [...this.plannedHosts].sort((left, right) => {
        const leftDue = left.lifecyclePlan?.dueDate ? new Date(left.lifecyclePlan.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
        const rightDue = right.lifecyclePlan?.dueDate ? new Date(right.lifecyclePlan.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
        if (leftDue !== rightDue) return leftDue - rightDue;
        return new Date(right.lifecyclePlan?.updatedAt || 0) - new Date(left.lifecyclePlan?.updatedAt || 0);
      });
    },
    lifecycleCards() {
      return [
        {
          key: 'aligned',
          label: 'Baseline Aligned',
          value: `${this.compliantHosts.length}/${this.hosts.length}`,
          detail: this.compliantHosts.length ? `${this.compliantHosts[0].name_label || 'Host'} is the leading compliant node` : 'No hosts are currently marked aligned',
          icon: 'mdi-shield-check-outline',
          valueClass: this.compliantHosts.length ? 'text-green' : 'text-amber',
        },
        {
          key: 'review',
          label: 'Needs Review',
          value: String(this.actionHosts.length),
          detail: this.actionHosts.length ? `${this.actionHosts[0].name_label || 'Host'} is highest priority` : 'No lifecycle review backlog detected',
          icon: 'mdi-clipboard-alert-outline',
          valueClass: this.actionHosts.length ? 'text-amber' : 'text-green',
        },
        {
          key: 'planned',
          label: 'Planned Waves',
          value: String(this.plannedHosts.length),
          detail: this.plannedHosts.length ? `${this.plannedHosts[0].name_label || 'Host'} is included in the planner queue` : 'No saved lifecycle plans yet',
          icon: 'mdi-calendar-clock-outline',
          valueClass: this.plannedHosts.length ? 'text-cyan' : 'text-green',
        },
        {
          key: 'jobs',
          label: 'Reboot Queue',
          value: String(this.rebootQueue.length),
          detail: this.rebootQueue.length ? 'One or more hosts are expected to reboot during remediation' : 'No reboots are currently staged',
          icon: 'mdi-restart',
          valueClass: this.rebootQueue.length ? 'text-red' : 'text-green',
        },
      ];
    },
    recommendations() {
      const items = [];
      const overdueAutomationTasks = this.lifecycleAutomationTasks.filter((task) => this.taskSlaMeta(task).isOverdue);

      if (this.driftedPlanHosts.length) {
        const host = this.driftedPlanHosts[0];
        items.push({
          title: 'Prioritize drifted baselines',
          detail: `${host.name_label || 'Host'} is marked drifted and already has a saved remediation plan. Confirm the patch wave is still sequenced correctly.`,
          status: 'warning',
        });
      }

      if (this.rebootQueue.length) {
        const host = this.rebootQueue[0];
        items.push({
          title: 'Validate reboot sequencing',
          detail: `${host.name_label || 'Host'} is marked for reboot. Make sure maintenance communications, drain targets, and rollback notes are ready first.`,
          status: 'pending',
        });
      }

      if (this.evacuationQueue.length) {
        const host = this.evacuationQueue[0];
        items.push({
          title: 'Check evacuation targets',
          detail: `${host.name_label || 'Host'} requires workload evacuation before remediation. Validate host capacity and guest placement before the window starts.`,
          status: 'warning',
        });
      }

      if (this.lifecycleTasks.length) {
        const task = this.lifecycleTasks[0];
        items.push({
          title: 'Watch active lifecycle jobs',
          detail: `${task.name_label || 'Task'} should be monitored through completion so its result can update the compliance queue.`,
          status: task.status || 'pending',
        });
      }

      if (this.lifecycleAutomationTasks.length) {
        const task = this.lifecycleAutomationTasks[0];
        items.push({
          title: 'Staged remediation brief ready',
          detail: `${task.name_label || 'A remediation task'} already carries ${this.taskEvidenceChecklist(task).length} evidence checks and ${this.taskCompletionCriteria(task).length} completion criteria into the lifecycle queue, with ${this.taskSlaMeta(task).label.toLowerCase()} timing.`,
          status: this.taskSlaMeta(task).tone,
        });
      }

      if (overdueAutomationTasks.length) {
        const task = overdueAutomationTasks[0];
        items.push({
          title: 'Escalate overdue lifecycle follow-through',
          detail: `${task.name_label || 'A remediation task'} is ${this.taskSlaMeta(task).label.toLowerCase()} and should be reconciled before the next maintenance wave starts.`,
          status: 'critical',
        });
      }

      if (!items.length) {
        items.push({
          title: 'Lifecycle posture healthy',
          detail: 'No obvious lifecycle drift was inferred from the current hosts, messages, tasks, and planner state.',
          status: 'success',
        });
      }

      return items;
    },
    coverageItems() {
      return [
        {
          label: 'Hosts With Saved Plan',
          detail: `${this.plannedHosts.length} of ${this.hosts.length} hosts are represented in the lifecycle planner.`,
          value: `${this.plannedHosts.length}/${this.hosts.length}`,
          badgeClass: this.plannedHosts.length ? 'badge-info' : 'badge-halted',
        },
        {
          label: 'Maintenance-Staged Hosts',
          detail: this.upcomingPlanRows.length ? `${this.upcomingPlanRows[0].name_label || 'Host'} is the next scheduled lifecycle target.` : 'No maintenance waves are scheduled yet.',
          value: String(this.upcomingPlanRows.filter((row) => row.targetStage === 'maintenance').length),
          badgeClass: this.upcomingPlanRows.filter((row) => row.targetStage === 'maintenance').length ? 'badge-running' : 'badge-info',
        },
        {
          label: 'Planner Owners Assigned',
          detail: `${this.plannedHosts.filter((row) => row.lifecyclePlan?.owner).length} plans have a named owner.`,
          value: String(this.plannedHosts.filter((row) => row.lifecyclePlan?.owner).length),
          badgeClass: this.plannedHosts.filter((row) => row.lifecyclePlan?.owner).length ? 'badge-running' : 'badge-halted',
        },
      ];
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
    poolContainsHost(pool, host) {
      if (!pool || !host) return false;

      const poolRefs = new Set(
        [
          pool.master,
          ...(Array.isArray(pool.hosts) ? pool.hosts : []),
          ...(Array.isArray(pool.resident_hosts) ? pool.resident_hosts : []),
          ...(Array.isArray(pool.slaves) ? pool.slaves : []),
        ].filter(Boolean)
      );

      return poolRefs.has(host.ref) || poolRefs.has(host.uuid);
    },
    resolvePoolForHost(host) {
      if (!host) return null;

      const hostKeys = [host.pool, host.pool_ref, host.pool_uuid, host.pool_name]
        .filter(Boolean)
        .map((value) => String(value).trim().toLowerCase());

      if (hostKeys.length) {
        const direct = this.relatedPools.find((pool) =>
          [pool.ref, pool.uuid, pool.name_label]
            .filter(Boolean)
            .map((value) => String(value).trim().toLowerCase())
            .some((value) => hostKeys.includes(value))
        );
        if (direct) return direct;
      }

      const relationship = this.relatedPools.find((pool) => this.poolContainsHost(pool, host));
      if (relationship) return relationship;

      if (this.relatedPools.length === 1) return this.relatedPools[0];
      return null;
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

      return this.hostLifecycleRows.find((host) => this.poolContainsHost(pool, host) && host.enabled)
        || this.hostLifecycleRows.find((host) => this.poolContainsHost(pool, host))
        || this.hostLifecycleRows.find((host) => this.resolvePoolForHost(host)?.ref === pool.ref)
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
    inferPlanDefaults(host, relatedTasks, relatedMessages) {
      if (!host.enabled) {
        return {
          baselineStatus: 'unknown',
          targetStage: 'maintenance',
          nextAction: 'validate',
        };
      }

      if (relatedMessages.some((message) => getMessageSeverity(message) === 'critical')) {
        return {
          baselineStatus: 'drifted',
          targetStage: 'remediate',
          nextAction: 'patch',
        };
      }

      if (relatedTasks.some((task) => ['pending', 'queued'].includes((task.status || '').toLowerCase()))) {
        return {
          baselineStatus: 'unknown',
          targetStage: 'review',
          nextAction: 'validate',
        };
      }

      const lifecycleText = `${host?.other_config?.lifecycle || ''} ${(host.tags || []).join(' ')}`.toLowerCase();
      if (/(patched|compliant|managed|current)/.test(lifecycleText)) {
        return {
          baselineStatus: 'compliant',
          targetStage: 'aligned',
          nextAction: 'none',
        };
      }

      return {
        baselineStatus: 'unknown',
        targetStage: 'review',
        nextAction: 'scan',
      };
    },
    buildHostLifecycleRow(host) {
      const relatedTasks = this.lifecycleTasks.filter((task) => this.hostMatchesTask(host, task));
      const relatedMessages = this.lifecycleAlerts.filter((message) => this.hostMatchesMessage(host, message));
      const lifecycleText = `${host?.other_config?.lifecycle || ''} ${(host.tags || []).join(' ')}`.toLowerCase();
      const savedPlan = this.planMap[host.ref] || null;
      const inferredPlan = this.inferPlanDefaults(host, relatedTasks, relatedMessages);
      const maintenanceWindow = savedPlan?.maintenanceWindow || host?.other_config?.maintenance_window || 'No window defined';
      let lifecycleStatus = 'warning';
      let lifecycleHint = 'review';
      let summary = 'Baseline review recommended.';
      let recommendation = 'Validate patch level, maintenance readiness, and any desired-state drift before the next maintenance cycle.';

      if (!host.enabled || lifecycleText.includes('maintenance') || (host.tags || []).some((tag) => String(tag).toLowerCase().includes('maintenance'))) {
        lifecycleStatus = 'disabled';
        lifecycleHint = 'maintenance';
        summary = 'Host is in maintenance or pre-maintenance posture.';
        recommendation = 'Confirm evacuation, snapshot coverage, and patch window details before taking further action.';
      } else if (relatedTasks.some((task) => ['pending', 'queued'].includes((task.status || '').toLowerCase()))) {
        lifecycleStatus = 'pending';
        lifecycleHint = 'scanning';
        summary = 'Lifecycle work is currently in progress.';
        recommendation = 'Allow the active compliance or maintenance task to complete, then reassess drift and baseline health.';
      } else if (relatedMessages.some((message) => getMessageSeverity(message) === 'critical')) {
        lifecycleStatus = 'critical';
        lifecycleHint = 'risk';
        summary = 'Critical lifecycle or maintenance signal detected.';
        recommendation = 'Investigate the related alert before scheduling further remediation so lifecycle work does not amplify an existing fault.';
      } else if (/(patched|compliant|managed|current)/.test(lifecycleText)) {
        lifecycleStatus = 'success';
        lifecycleHint = 'aligned';
        summary = 'Host appears aligned with the expected lifecycle posture.';
        recommendation = 'Keep this host in the compliant set and use it as a preferred target when draining or rebalancing adjacent nodes.';
      } else if (relatedMessages.length) {
        lifecycleStatus = 'warning';
        lifecycleHint = 'attention';
        summary = 'Recent lifecycle-adjacent alerts suggest review is needed.';
        recommendation = 'Inspect the alert context and confirm whether a patch, reboot, or maintenance action should be scheduled.';
      }

      const baselineStatus = savedPlan?.baselineStatus || inferredPlan.baselineStatus;
      const targetStage = savedPlan?.targetStage || inferredPlan.targetStage;
      const nextAction = savedPlan?.nextAction || inferredPlan.nextAction;

      if (savedPlan?.targetStage === 'maintenance' && !['critical', 'disabled'].includes(lifecycleStatus)) {
        lifecycleStatus = 'pending';
        lifecycleHint = 'maintenance';
        summary = 'Maintenance work is scheduled for this host.';
        recommendation = savedPlan.notes || 'Verify evacuation, patch bundles, and communication windows before starting maintenance.';
      } else if (savedPlan?.targetStage === 'remediate' && lifecycleStatus === 'success') {
        lifecycleStatus = 'warning';
        lifecycleHint = 'attention';
        summary = 'A remediation plan exists even though the host currently looks healthy.';
        recommendation = savedPlan.notes || 'Reconfirm whether this remediation is still needed before execution.';
      } else if (savedPlan?.targetStage === 'aligned' && savedPlan?.baselineStatus === 'compliant' && !relatedMessages.length && host.enabled) {
        lifecycleStatus = 'success';
        lifecycleHint = 'aligned';
        summary = 'Saved lifecycle plan indicates this host is aligned.';
        recommendation = savedPlan.notes || 'Use this host as an aligned reference point for the rest of the maintenance ring.';
      } else if (savedPlan?.targetStage === 'review' && lifecycleStatus === 'success') {
        lifecycleStatus = 'warning';
        lifecycleHint = 'review';
        summary = 'Lifecycle review is still scheduled for this host.';
        recommendation = savedPlan.notes || 'Validate whether the review can be closed or should progress to remediation.';
      }

      const planLabel = savedPlan
        ? `${this.formatStageLabel(savedPlan.targetStage)} · ${savedPlan.owner || 'Unassigned'} · ${savedPlan.patchGroup || 'No patch group'}`
        : 'No saved lifecycle plan';

      return {
        ...host,
        lifecycleStatus,
        lifecycleHint,
        maintenanceWindow,
        baselineStatus,
        targetStage,
        nextAction,
        summary,
        recommendation,
        relatedTasks,
        relatedMessages,
        lastTaskLabel: relatedTasks[0]?.name_label || 'No recent lifecycle task',
        lastAlertLabel: relatedMessages[0] ? getMessageHeadline(relatedMessages[0]) : 'No recent lifecycle alert',
        lifecyclePlan: savedPlan,
        planLabel,
      };
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
    async deletePlan(row) {
      const target = row?.ref ? row : this.selectedHost;
      if (!target?.ref) return;

      this.planSaving = true;
      this.planError = null;
      try {
        const approvalId = await resolveGovernanceApproval({
          actionKey: 'lifecycle_plan_delete',
          entityType: 'host',
          entityRef: target.ref,
          entityName: target.name_label || target.hostname || target.address || 'Host lifecycle plan',
          route: '/lifecycle',
        });
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
