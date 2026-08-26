const ResilienceView = {
  components: {
    FloatingWindow,
    StatusBadge,
    'resilience-runbook-form': ResilienceRunbookForm,
    'resilience-drill-form': ResilienceDrillForm,
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

        <floating-window :show="showInspector"
                         :title="inspectorTitle"
                         :width="820"
                         :height="580"
                         @close="closeInspector">
          <div v-if="selectedItemType === 'policy' && selectedItem">
            <div class="property-grid">
              <span class="text-muted">Workload</span><span>{{ selectedItem.name_label }}</span>
              <span class="text-muted">Pool</span><span>{{ selectedItem.poolName }}</span>
              <span class="text-muted">Policy</span><span>{{ selectedItem.policy }}</span>
              <span class="text-muted">Recovery Tier</span><span>{{ selectedItem.recoveryTier }}</span>
              <span class="text-muted">Status</span><status-badge :status="selectedItem.status"></status-badge>
              <span class="text-muted">Power State</span><span>{{ selectedItem.power_state }}</span>
              <span class="text-muted">Last Protected</span><span class="mono">{{ formatDateTime(selectedItem.lastProtectedAt) }}</span>
              <span class="text-muted">Backup Age</span><span>{{ formatHours(selectedItem.backupAgeHours) }}</span>
              <span class="text-muted">Backup Target</span><span>{{ selectedItem.backupWindowHours }}h</span>
              <span class="text-muted">Restore Point</span><span>{{ selectedItem.restorePointLabel }}</span>
              <span class="text-muted">HA Restart</span><span>{{ selectedItem.haRestartPriority }}</span>
              <span class="text-muted">Recent Task</span><span class="property-wrap">{{ selectedItem.lastTaskLabel }}</span>
              <span class="text-muted">Recent Alert</span><span class="property-wrap">{{ selectedItem.lastAlertLabel }}</span>
              <span class="text-muted">Last Drill</span><span>{{ selectedItem.lastDrillAt ? formatDateTime(selectedItem.lastDrillAt) : 'No drill logged' }}</span>
              <span class="text-muted">UUID</span><span class="mono property-wrap">{{ selectedItem.uuid || '-' }}</span>
            </div>

            <div class="detail-section">
              <div class="detail-section-title">Protection Guidance</div>
              <div class="capacity-callout">
                <strong>{{ selectedItem.recommendation }}</strong>
                <p>Use this record to decide whether the workload needs a fresh backup, a restore test, or a change to restart priority before the next maintenance or failover event.</p>
              </div>
            </div>

            <div class="detail-section">
              <div class="detail-section-title">Protection Checklist</div>
              <div class="stack-list">
                <div class="stack-item" v-for="item in buildPolicyChecklist(selectedItem)" :key="item.label">
                  <div>
                    <strong>{{ item.label }}</strong>
                    <div class="text-muted" style="font-size:12px">{{ item.detail }}</div>
                  </div>
                  <status-badge :status="item.status"></status-badge>
                </div>
              </div>
            </div>
          </div>

          <div v-if="selectedItemType === 'host' && selectedItem">
            <div class="property-grid">
              <span class="text-muted">Host</span><span>{{ selectedItem.name_label }}</span>
              <span class="text-muted">Pool</span><span>{{ selectedItem.poolName }}</span>
              <span class="text-muted">Address</span><span class="mono">{{ selectedItem.address || '-' }}</span>
              <span class="text-muted">Status</span><status-badge :status="selectedItem.status"></status-badge>
              <span class="text-muted">HA Policy</span><span>{{ selectedItem.haPolicy }}</span>
              <span class="text-muted">Restart Priority</span><span>{{ selectedItem.restartPriority }}</span>
              <span class="text-muted">Evacuation Target</span><span>{{ selectedItem.evacuationTarget }}</span>
              <span class="text-muted">Resident VMs</span><span>{{ selectedItem.residentVmCount }}</span>
              <span class="text-muted">Maintenance Window</span><span>{{ selectedItem.maintenanceWindow }}</span>
              <span class="text-muted">Recent Task</span><span class="property-wrap">{{ selectedItem.recentTask }}</span>
              <span class="text-muted">Recent Alert</span><span class="property-wrap">{{ selectedItem.recentAlert }}</span>
              <span class="text-muted">Last Drill</span><span>{{ selectedItem.lastDrillAt ? formatDateTime(selectedItem.lastDrillAt) : 'No drill logged' }}</span>
              <span class="text-muted">UUID</span><span class="mono property-wrap">{{ selectedItem.uuid || '-' }}</span>
            </div>

            <div class="detail-section">
              <div class="detail-section-title">Failover Guidance</div>
              <div class="capacity-callout">
                <strong>{{ selectedItem.summary }}</strong>
                <p>Validate target capacity, evacuation sequencing, and the host’s place in the pool runbook before using it as a failover source or maintenance candidate.</p>
              </div>
            </div>

            <div class="detail-section">
              <div class="detail-section-title">Host Checklist</div>
              <div class="stack-list">
                <div class="stack-item" v-for="item in buildHostChecklist(selectedItem)" :key="item.label">
                  <div>
                    <strong>{{ item.label }}</strong>
                    <div class="text-muted" style="font-size:12px">{{ item.detail }}</div>
                  </div>
                  <status-badge :status="item.status"></status-badge>
                </div>
              </div>
            </div>
          </div>

          <div v-if="selectedItemType === 'plan' && selectedItem">
            <div class="dashboard-hero" style="margin-bottom:12px;padding:18px">
              <div>
                <div class="dash-card-label">Recovery Plan</div>
                <h3>{{ selectedItem.name_label }}</h3>
                <p>{{ selectedItem.nextAction }}</p>
              </div>
              <div class="dashboard-hero-rail">
                <button class="btn btn-primary" @click="openRunbookEditor(selectedItem)">
                  <span class="mdi mdi-book-edit-outline"></span>
                  Edit Runbook
                </button>
                <button class="btn" @click="openDrillLogger(selectedItem)">
                  <span class="mdi mdi-clipboard-check-outline"></span>
                  Log Drill
                </button>
                <button class="btn" v-if="selectedItem.hasRunbook" @click="deleteRunbook(selectedItem)">
                  <span class="mdi mdi-delete-outline"></span>
                  Clear Runbook
                </button>
              </div>
            </div>

            <div class="property-grid">
              <span class="text-muted">Recovery Plan</span><span>{{ selectedItem.name_label }}</span>
              <span class="text-muted">Status</span><status-badge :status="selectedItem.status"></status-badge>
              <span class="text-muted">Enabled Hosts</span><span>{{ selectedItem.enabledHostCount }}</span>
              <span class="text-muted">Protected Workloads</span><span>{{ selectedItem.protectedVmCount }}</span>
              <span class="text-muted">At-Risk Workloads</span><span>{{ selectedItem.atRiskVmCount }}</span>
              <span class="text-muted">Restore Drift</span><span>{{ selectedItem.staleRestorePointCount }} stale · {{ selectedItem.reviewRestorePointCount }} review</span>
              <span class="text-muted">Runbook Owner</span><span>{{ selectedItem.owner || 'Unassigned' }}</span>
              <span class="text-muted">HA Policy</span><span>{{ selectedItem.haPolicy }}</span>
              <span class="text-muted">Restart Priority</span><span>{{ selectedItem.restartPriority }}</span>
              <span class="text-muted">RPO / RTO</span><span>{{ selectedItem.rpoMinutes }}m / {{ selectedItem.rtoMinutes }}m</span>
              <span class="text-muted">Backup Window</span><span>{{ selectedItem.backupWindowHours }}h</span>
              <span class="text-muted">Standby Host</span><span>{{ selectedItem.standbyHostLabel || 'Not pinned' }}</span>
              <span class="text-muted">Failover Network</span><span>{{ selectedItem.failoverNetworkLabel || 'Not pinned' }}</span>
              <span class="text-muted">Last Verified</span><span>{{ selectedItem.lastVerifiedAt ? formatDateTime(selectedItem.lastVerifiedAt) : 'Not recorded' }}</span>
              <span class="text-muted">Last Drill</span><span>{{ selectedItem.lastDrillAt ? formatDateTime(selectedItem.lastDrillAt) : 'No drill logged' }}</span>
              <span class="text-muted">UUID</span><span class="mono property-wrap">{{ selectedItem.uuid || '-' }}</span>
            </div>

            <div class="detail-section">
              <div class="detail-section-title">Runbook Steps</div>
              <div class="stack-list">
                <div class="stack-item" v-for="(step, index) in selectedItem.runbookSteps" :key="step + index">
                  <div>
                    <strong>Step {{ index + 1 }}</strong>
                    <div class="text-muted" style="font-size:12px">{{ step }}</div>
                  </div>
                  <status-badge status="info"></status-badge>
                </div>
              </div>
            </div>

            <div class="detail-section">
              <div class="detail-section-title">Plan Checklist</div>
              <div class="stack-list">
                <div class="stack-item" v-for="item in buildPlanChecklist(selectedItem)" :key="item.label">
                  <div>
                    <strong>{{ item.label }}</strong>
                    <div class="text-muted" style="font-size:12px">{{ item.detail }}</div>
                  </div>
                  <status-badge :status="item.status"></status-badge>
                </div>
              </div>
            </div>

            <div class="detail-section" v-if="selectedItem.drills && selectedItem.drills.length">
              <div class="detail-section-title">Recent Drill History</div>
              <div class="stack-list">
                <div class="stack-item" v-for="drill in selectedItem.drills" :key="drill.id">
                  <div>
                    <strong>{{ formatDrillType(drill.drillType) }}</strong>
                    <div class="text-muted mono" style="font-size:11px">{{ formatDateTime(drill.executedAt) }} · {{ drill.durationMinutes || 0 }} minutes</div>
                    <div class="text-muted" style="font-size:12px;margin-top:6px">{{ drill.summary }}</div>
                    <div class="text-muted" style="font-size:12px;margin-top:4px" v-if="drill.nextStep">{{ drill.nextStep }}</div>
                  </div>
                  <status-badge :status="drill.status"></status-badge>
                </div>
              </div>
            </div>

            <div class="detail-section" v-if="selectedItem.notes">
              <div class="detail-section-title">Runbook Notes</div>
              <div class="capacity-callout">
                <p>{{ selectedItem.notes }}</p>
              </div>
            </div>
          </div>
        </floating-window>

        <floating-window :show="showRunbookEditor"
                         :title="runbookWindowTitle"
                         :width="760"
                         :height="680"
                         @close="closeRunbookEditor">
          <div v-if="activePlan">
            <div class="detail-section" v-if="runbookError">
              <div class="capacity-callout">
                <strong>{{ runbookError }}</strong>
              </div>
            </div>
            <resilience-runbook-form
              :initial-value="activePlanDraft"
              :pool-record="activePlan"
              :hosts="hostsForPlan(activePlan)"
              :networks="networks"
              :saving="savingRunbook"
              :submit-label="runbookSubmitLabel"
              @submit="saveRunbook"
            ></resilience-runbook-form>
            <div class="capacity-callout" v-if="runbookSourceTask" style="margin-top:12px">
              <strong>Seeded from remediation task</strong>
              <p>{{ runbookSourceTask.name_label || runbookSourceTask.related_alert_summary || runbookSourceTask.ref }}</p>
              <div class="text-muted mono" style="font-size:11px">
                {{ runbookSourceTask.template_name || 'manual template' }} · {{ runbookSourceTask.ref || '-' }}
              </div>
            </div>
            <div class="capacity-callout" v-if="runbookLaunchMode === 'drill'" style="margin-top:12px">
              <strong>Execution-first handoff active</strong>
              <p>This seeded flow drops directly into drill execution while leaving the recovery runbook editable in the same window.</p>
            </div>
            <div class="detail-section" v-if="runbookCanExecuteDrill">
              <div class="detail-section-title">Execution Handoff</div>
              <div class="dash-card">
                <div class="dash-card-label">Recovery Drill</div>
                <p class="text-muted" style="margin-bottom:12px">
                  Capture recovery-drill execution evidence without leaving the seeded runbook workflow.
                </p>
                <resilience-drill-form
                  :pool-record="activePlan"
                  :saving="runbookDrillSaving"
                  submit-label="Log Recovery Drill"
                  @submit="executeRunbookDrill">
                </resilience-drill-form>
                <div class="form-error" v-if="runbookDrillError" style="text-align:left;margin-top:12px">{{ runbookDrillError }}</div>
              </div>
            </div>
          </div>
        </floating-window>

        <floating-window :show="showDrillLogger"
                         title="Recovery Drill"
                         :width="720"
                         :height="600"
                         @close="closeDrillLogger">
          <div v-if="activePlan">
            <div class="detail-section" v-if="drillError">
              <div class="capacity-callout">
                <strong>{{ drillError }}</strong>
              </div>
            </div>
            <resilience-drill-form
              :pool-record="activePlan"
              :saving="loggingDrill"
              submit-label="Log Drill"
              @submit="saveDrill"
            ></resilience-drill-form>
          </div>
        </floating-window>
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
      activePlanDraft: null,
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
      return [
        {
          key: 'protected',
          label: 'Protected Workloads',
          value: String(this.summary.protectedVmCount || 0),
          detail: 'Workloads with recent successful protection activity',
          icon: 'mdi-shield-check-outline',
          valueClass: (this.summary.protectedVmCount || 0) ? 'text-green' : '',
        },
        {
          key: 'risk',
          label: 'At-Risk Workloads',
          value: String(this.summary.atRiskVmCount || 0),
          detail: 'Workloads requiring protection review or follow-up',
          icon: 'mdi-alert-decagram-outline',
          valueClass: (this.summary.atRiskVmCount || 0) ? 'text-red' : 'text-green',
        },
        {
          key: 'runbooks',
          label: 'Runbook Coverage',
          value: `${this.summary.runbookCoverageCount || 0}/${this.summary.recoveryPlanCount || 0}`,
          detail: 'Pools with persisted recovery guidance and ownership',
          icon: 'mdi-book-open-page-variant-outline',
          valueClass: (this.summary.runbookCoverageCount || 0) < (this.summary.recoveryPlanCount || 0) ? 'text-amber' : 'text-green',
        },
        {
          key: 'restore',
          label: 'Restore Drift',
          value: String(this.summary.staleRestorePointCount || 0),
          detail: 'Workloads with stale or missing restore evidence',
          icon: 'mdi-database-alert-outline',
          valueClass: (this.summary.staleRestorePointCount || 0) ? 'text-red' : 'text-green',
        },
        {
          key: 'drills',
          label: 'Drill Gaps',
          value: String(this.summary.overdueDrillCount || 0),
          detail: `${this.summary.recentEventCount || 0} total resilience events in the current view`,
          icon: 'mdi-clipboard-pulse-outline',
          valueClass: (this.summary.overdueDrillCount || 0) ? 'text-amber' : 'text-green',
        },
      ];
    },
    prioritizedPolicies() {
      const priority = { critical: 0, warning: 1, pending: 2, success: 3, info: 4, notice: 5 };
      return [...this.protectionPolicies].sort((left, right) => {
        const statusDelta = (priority[left.status] ?? 99) - (priority[right.status] ?? 99);
        if (statusDelta !== 0) return statusDelta;
        return new Date(right.lastProtectedAt || 0) - new Date(left.lastProtectedAt || 0);
      });
    },
    prioritizedHosts() {
      const priority = { critical: 0, pending: 1, warning: 2, disabled: 3, success: 4, info: 5 };
      return [...this.hostPlans].sort((left, right) => (priority[left.status] ?? 99) - (priority[right.status] ?? 99));
    },
    prioritizedRecoveryPlans() {
      const priority = { critical: 0, warning: 1, pending: 2, success: 3, info: 4 };
      return [...this.recoveryPlans].sort((left, right) => (priority[left.status] ?? 99) - (priority[right.status] ?? 99));
    },
    runbookCanExecuteDrill() {
      return Boolean(this.activePlan);
    },
    runbookWindowTitle() {
      return this.runbookLaunchMode === 'drill' ? 'Recovery Drill Handoff' : 'Recovery Runbook';
    },
    runbookSubmitLabel() {
      return this.runbookLaunchMode === 'drill' ? 'Save Recovery Runbook Before Drill' : 'Save Recovery Runbook';
    },
    resilienceAutomationTasks() {
      return sortTasks((this.automationTasks || []).filter((task) => this.isResilienceAutomationTask(task)));
    },
    runbookDraft() {
      if (!this.activePlan) return null;
      if (!this.runbookSeed) return this.activePlan;
      return {
        ...this.activePlan,
        ...this.runbookSeed,
      };
    },
    inspectorTitle() {
      if (this.selectedItemType === 'policy') return 'Protection Policy Detail';
      if (this.selectedItemType === 'host') return 'Failover Host Detail';
      if (this.selectedItemType === 'plan') return 'Recovery Plan Detail';
      return 'Resilience Detail';
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
        await this.syncRouteFocus();
      },
    },
  },
  methods: {
    formatDateTime,
    truncateList,
    taskSlaMeta: getTaskDueMeta,
    taskSlaBadgeClass(task) {
      return getTaskSlaBadgeClass(this.taskSlaMeta(task));
    },
    isRemediationTask(task) {
      return String(task?.task_kind || '').toLowerCase() === 'remediation' || String(task?.source || '').toLowerCase() === 'remediation';
    },
    isResilienceAutomationTask(task) {
      if (!this.isRemediationTask(task)) return false;
      return task.target_route === '/resilience' || String(task.action_type || '').toLowerCase() === 'resilience';
    },
    taskEvidenceChecklist(task) {
      return Array.isArray(task?.evidence_checklist) ? task.evidence_checklist : [];
    },
    taskCompletionCriteria(task) {
      return Array.isArray(task?.completion_criteria) ? task.completion_criteria : [];
    },
    findTaskByFocus(focus) {
      return (this.automationTasks || []).find((task) =>
        recordMatchesRouteFocus(task, focus, ['ref', 'uuid', 'name_label'])
      ) || null;
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
    findHostRecord(value) {
      return this.relatedHosts.find((host) =>
        this.recordMatchesValue(host, value, ['ref', 'uuid', 'name_label', 'hostname', 'address'], [
          ...(Array.isArray(host?.PBDs) ? host.PBDs : []),
          ...(Array.isArray(host?.PIFs) ? host.PIFs : []),
          ...(Array.isArray(host?.resident_VMs) ? host.resident_VMs : []),
        ])
      ) || this.hostPlans.find((host) =>
        this.recordMatchesValue(host, value, ['ref', 'uuid', 'name_label', 'address'])
      ) || null;
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
      return this.networks.find((network) =>
        this.recordMatchesValue(network, value, ['ref', 'uuid', 'name_label', 'bridge'], [
          ...(Array.isArray(network?.PIFs) ? network.PIFs : []),
          ...(Array.isArray(network?.VIFs) ? network.VIFs : []),
        ])
      ) || null;
    },
    resolvePoolForHost(host) {
      if (!host) return null;

      const hostKeys = [host.pool, host.pool_ref, host.pool_uuid, host.pool_name, host.poolRef]
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
    findPoolByVm(vm) {
      if (!vm) return null;
      return this.findPoolRecord(vm.pool)
        || this.resolvePoolForHost(this.findHostRecord(vm.resident_on || vm.affinity))
        || null;
    },
    findPoolByStorage(sr) {
      if (!sr) return null;

      const hostPbdRefs = new Set(Array.isArray(sr.PBDs) ? sr.PBDs : []);
      if (hostPbdRefs.size) {
        const host = this.relatedHosts.find((entry) =>
          Array.isArray(entry.PBDs) && entry.PBDs.some((ref) => hostPbdRefs.has(ref))
        );
        const hostPool = this.resolvePoolForHost(host);
        if (hostPool) return hostPool;
      }

      return this.relatedPools.find((pool) => pool.default_SR === sr.ref) || null;
    },
    findPoolByNetwork(network) {
      if (!network) return null;

      const pifRefs = new Set(Array.isArray(network.PIFs) ? network.PIFs : []);
      if (pifRefs.size) {
        const host = this.relatedHosts.find((entry) =>
          Array.isArray(entry.PIFs) && entry.PIFs.some((ref) => pifRefs.has(ref))
        );
        const hostPool = this.resolvePoolForHost(host);
        if (hostPool) return hostPool;
      }

      return this.relatedPools.find((pool) => pool.migration_network === network.ref) || null;
    },
    resolveRecoveryPlanForPool(pool) {
      if (!pool) return null;
      return this.recoveryPlans.find((plan) => plan.ref === pool.ref)
        || this.recoveryPlans.find((plan) => this.recordMatchesValue(plan, pool.uuid, ['ref', 'uuid', 'name_label']))
        || this.recoveryPlans.find((plan) => this.recordMatchesValue(plan, pool.name_label, ['ref', 'uuid', 'name_label']))
        || null;
    },
    findRecoveryPlanByTask(task) {
      if (!task) return null;

      const relatedObject = String(task.related_object || '').trim().toLowerCase();
      const relatedClass = String(task.related_class || '').trim().toLowerCase();
      if (relatedObject) {
        const directPlan = this.recoveryPlans.find((plan) =>
          [plan.ref, plan.uuid, plan.name_label]
            .filter(Boolean)
            .map((value) => String(value).trim().toLowerCase())
            .includes(relatedObject)
        );
        if (directPlan) return directPlan;
      }

      if (relatedObject) {
        if (!relatedClass || relatedClass === 'host') {
          const relatedHost = this.findHostRecord(relatedObject);
          const hostPool = this.resolvePoolForHost(relatedHost);
          const hostPlan = this.resolveRecoveryPlanForPool(hostPool);
          if (hostPlan) return hostPlan;
        }

        if (!relatedClass || ['vm', 'vbd', 'vif'].includes(relatedClass)) {
          const relatedVm = this.findVmRecord(relatedObject);
          const vmPlan = this.resolveRecoveryPlanForPool(this.findPoolByVm(relatedVm));
          if (vmPlan) return vmPlan;
        }

        if (!relatedClass || ['sr', 'vdi'].includes(relatedClass)) {
          const relatedStorage = this.findStorageRecord(relatedObject);
          const storagePlan = this.resolveRecoveryPlanForPool(this.findPoolByStorage(relatedStorage));
          if (storagePlan) return storagePlan;
        }

        if (!relatedClass || relatedClass === 'pool') {
          const relatedPool = this.findPoolRecord(relatedObject);
          const poolPlan = this.resolveRecoveryPlanForPool(relatedPool);
          if (poolPlan) return poolPlan;
        }

        if (!relatedClass || ['network', 'pif', 'vif'].includes(relatedClass)) {
          const relatedNetwork = this.findNetworkRecord(relatedObject);
          const networkPlan = this.resolveRecoveryPlanForPool(this.findPoolByNetwork(relatedNetwork));
          if (networkPlan) return networkPlan;
        }
      }

      return this.recoveryPlans.find((plan) => {
        const haystack = `${task?.name_label || ''} ${task?.name_description || ''} ${task?.workspace_summary || ''} ${task?.related_alert_summary || ''}`.toLowerCase();
        return haystack.includes(String(plan.name_label || '').toLowerCase());
      }) || null;
    },
    async syncRouteFocus() {
      const focus = getRouteFocus(this.$route.query);
      const seedAction = String(this.$route.query.seedAction || '').trim().toLowerCase();

      if (!focus || (focus.kind && focus.kind !== 'task')) {
        this.lastAppliedFocusKey = '';
        return;
      }

      if (this.loading || !this.recoveryPlans.length) return;

      const key = `${getRouteFocusKey(focus)}|${seedAction}`;
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
      if (!task?.ref) return;
      this.showInspector = false;
      this.$router.push(buildFocusedRoute('/activity', {
        kind: 'task',
        ref: task.ref || '',
        uuid: task.uuid || '',
        name: task.name_label || '',
        cls: 'task',
        source: 'resilience',
      }));
    },
    formatHours(value) {
      if (value === null || value === undefined || value === '') return 'Unknown';
      return `${value}h`;
    },
    formatDrillType(value) {
      return String(value || 'restore')
        .replace(/-/g, ' ')
        .replace(/\b\w/g, (char) => char.toUpperCase());
    },
    resolvePoolLabel(poolRef) {
      return this.recoveryPlans.find((plan) => plan.ref === poolRef)?.name_label || poolRef || 'Pool';
    },
    hostsForPlan(plan) {
      return this.hostPlans.filter((host) => host.poolRef === plan?.ref);
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
      this.activePlanDraft = seed ? { ...plan, ...seed } : plan;
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
      this.activePlanDraft = null;
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
      return [
        {
          label: 'Restore Point Freshness',
          detail: policy.restorePointLabel,
          status: ['missing', 'stale'].includes(policy.restorePointStatus) ? 'critical' : policy.restorePointStatus === 'review' ? 'warning' : 'success',
        },
        {
          label: 'HA Restart Intent',
          detail: `VM restart priority is ${policy.haRestartPriority}.`,
          status: policy.haRestartPriority === 'best-effort' ? 'warning' : 'info',
        },
        {
          label: 'Drill Evidence',
          detail: policy.lastDrillAt ? `Last drill logged ${formatDateTime(policy.lastDrillAt)}.` : 'No drill evidence recorded for this workload pool yet.',
          status: policy.lastDrillAt ? (policy.lastDrillStatus || 'success') : 'warning',
        },
      ];
    },
    buildHostChecklist(host) {
      return [
        {
          label: 'Alternate Capacity',
          detail: host.evacuationTarget || 'No evacuation target recorded.',
          status: /no alternate/i.test(host.evacuationTarget || '') ? 'critical' : 'success',
        },
        {
          label: 'HA Policy Coverage',
          detail: `Pool policy currently resolves to ${host.haPolicy}.`,
          status: host.haPolicy === 'disabled' ? 'warning' : 'info',
        },
        {
          label: 'Recent Drill',
          detail: host.lastDrillAt ? `Last drill logged ${formatDateTime(host.lastDrillAt)}.` : 'No drill logged for this host pool.',
          status: host.lastDrillAt ? (host.lastDrillStatus || 'success') : 'warning',
        },
      ];
    },
    buildPlanChecklist(plan) {
      return [
        {
          label: 'Runbook Presence',
          detail: plan.hasRunbook ? 'Recovery runbook is persisted for this pool.' : 'No persisted runbook yet.',
          status: plan.hasRunbook ? 'success' : 'warning',
        },
        {
          label: 'Restore Coverage',
          detail: `${plan.staleRestorePointCount} stale and ${plan.reviewRestorePointCount} review-state workloads are tracked.`,
          status: plan.staleRestorePointCount ? 'critical' : plan.reviewRestorePointCount ? 'warning' : 'success',
        },
        {
          label: 'Drill Recency',
          detail: plan.lastDrillAt ? `Last drill logged ${formatDateTime(plan.lastDrillAt)}.` : 'No drill logged for this pool.',
          status: plan.lastDrillAt ? (plan.lastDrillStatus || 'success') : 'warning',
        },
      ];
    },
    mapDrillStatusToTaskStatus(status) {
      const normalized = String(status || '').trim().toLowerCase();
      if (normalized === 'success') return 'success';
      if (normalized === 'warning') return 'warning';
      if (normalized === 'critical') return 'failure';
      return 'in_progress';
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
