const ResilienceWorkspaceDialogs = {
  components: {
    FloatingWindow,
    StatusBadge,
    ResilienceRunbookForm,
    ResilienceDrillForm,
  },
  props: {
    showInspector: { type: Boolean, default: false },
    inspectorTitle: { type: String, default: 'Resilience Detail' },
    selectedItemType: { type: String, default: '' },
    selectedItem: { type: Object, default: null },
    showRunbookEditor: { type: Boolean, default: false },
    runbookWindowTitle: { type: String, default: 'Recovery Runbook' },
    activePlan: { type: Object, default: null },
    activePlanHosts: { type: Array, default: () => [] },
    runbookError: { type: String, default: '' },
    runbookDraft: { type: Object, default: () => ({}) },
    networks: { type: Array, default: () => [] },
    savingRunbook: { type: Boolean, default: false },
    runbookSubmitLabel: { type: String, default: 'Save Runbook' },
    runbookSourceTask: { type: Object, default: null },
    runbookLaunchMode: { type: String, default: 'runbook' },
    runbookCanExecuteDrill: { type: Boolean, default: false },
    runbookDrillSaving: { type: Boolean, default: false },
    runbookDrillError: { type: String, default: '' },
    showDrillLogger: { type: Boolean, default: false },
    drillError: { type: String, default: '' },
    loggingDrill: { type: Boolean, default: false },
  },
  emits: [
    'close-inspector',
    'open-runbook-editor',
    'open-drill-logger',
    'delete-runbook',
    'close-runbook-editor',
    'save-runbook',
    'execute-runbook-drill',
    'close-drill-logger',
    'save-drill',
  ],
  template: `
    <div>
      <floating-window :show="showInspector"
                       :title="inspectorTitle"
                       :width="820"
                       :height="580"
                       @close="$emit('close-inspector')">
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
              <button class="btn btn-primary" @click="$emit('open-runbook-editor', selectedItem)">
                <span class="mdi mdi-book-edit-outline"></span>
                Edit Runbook
              </button>
              <button class="btn" @click="$emit('open-drill-logger', selectedItem)">
                <span class="mdi mdi-clipboard-check-outline"></span>
                Log Drill
              </button>
              <button class="btn" v-if="selectedItem.hasRunbook" @click="$emit('delete-runbook', selectedItem)">
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
                       @close="$emit('close-runbook-editor')">
        <div v-if="activePlan">
          <div class="detail-section" v-if="runbookError">
            <div class="capacity-callout">
              <strong>{{ runbookError }}</strong>
            </div>
          </div>
          <resilience-runbook-form
            :initial-value="runbookDraft"
            :pool-record="activePlan"
            :hosts="activePlanHosts"
            :networks="networks"
            :saving="savingRunbook"
            :submit-label="runbookSubmitLabel"
            @submit="$emit('save-runbook', $event)">
          </resilience-runbook-form>
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
                @submit="$emit('execute-runbook-drill', $event)">
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
                       @close="$emit('close-drill-logger')">
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
            @submit="$emit('save-drill', $event)">
          </resilience-drill-form>
        </div>
      </floating-window>
    </div>
  `,
  methods: {
    formatDateTime,
    formatHours: formatResilienceHours,
    formatDrillType: formatResilienceDrillType,
    buildPolicyChecklist(policy) {
      return buildResiliencePolicyChecklist(policy);
    },
    buildHostChecklist(host) {
      return buildResilienceHostChecklist(host);
    },
    buildPlanChecklist(plan) {
      return buildResiliencePlanChecklist(plan);
    },
  },
};
