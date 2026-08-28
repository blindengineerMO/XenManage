const LifecycleWorkspaceDialogs = {
  components: {
    FloatingWindow,
    StatusBadge,
    LifecyclePlanForm,
    HostMaintenanceForm,
  },
  props: {
    showInspector: { type: Boolean, default: false },
    selectedHost: { type: Object, default: null },
    selectedHostReadinessChecklist: { type: Array, default: () => [] },
    selectedHostRelatedAutomationTasks: { type: Array, default: () => [] },
    showPlanner: { type: Boolean, default: false },
    plannerWindowTitle: { type: String, default: 'Lifecycle Planner' },
    plannerTargetTitle: { type: String, default: '' },
    plannerHost: { type: Object, default: null },
    plannerLaunchMode: { type: String, default: 'plan' },
    plannerInitialValue: { type: Object, default: () => ({}) },
    plannerSubmitLabel: { type: String, default: 'Save Lifecycle Plan' },
    planSaving: { type: Boolean, default: false },
    planError: { type: String, default: null },
    plannerSourceTask: { type: Object, default: null },
    plannerCanExecuteMaintenance: { type: Boolean, default: false },
    plannerHostMaintenanceMode: { type: Boolean, default: false },
    plannerMaintenanceDraft: { type: Object, default: () => ({}) },
    plannerMaintenanceNetworkOptions: { type: Array, default: () => [] },
    plannerActionBusy: { type: String, default: '' },
    plannerActionError: { type: String, default: null },
  },
  emits: [
    'close-inspector',
    'open-planner',
    'delete-plan',
    'open-automation-task',
    'close-planner',
    'save-plan',
    'enter-maintenance',
    'exit-maintenance',
  ],
  template: `
    <div>
      <floating-window :show="showInspector"
                       title="Lifecycle Detail"
                       :width="780"
                       :height="560"
                       @close="$emit('close-inspector')">
        <div v-if="selectedHost">
          <div class="dashboard-hero" style="margin-bottom:12px;padding:18px">
            <div>
              <div class="dash-card-label">Lifecycle Record</div>
              <h3>{{ selectedHost.name_label || selectedHost.hostname || 'Host' }}</h3>
              <p>{{ selectedHost.summary }}</p>
            </div>
            <div class="dashboard-hero-rail">
              <button class="btn btn-primary" @click="$emit('open-planner', selectedHost)">
                <span class="mdi mdi-calendar-edit-outline"></span>
                Edit Lifecycle Plan
              </button>
              <button class="btn" v-if="selectedHost.lifecyclePlan" @click="$emit('delete-plan', selectedHost)">
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
              <div class="stack-item" v-for="item in selectedHostReadinessChecklist" :key="item.label">
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

          <div class="detail-section" v-if="selectedHostRelatedAutomationTasks.length">
            <div class="detail-section-title">Staged Follow-Through</div>
            <div class="stack-list">
              <button class="stack-item stack-item-button"
                      v-for="task in selectedHostRelatedAutomationTasks"
                      :key="task.ref"
                      @click="$emit('open-automation-task', task)">
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
                       @close="$emit('close-planner')">
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
            @submit="$emit('save-plan', $event)">
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
                @submit="$emit('enter-maintenance', $event)">
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
                        @click="$emit('exit-maintenance')">
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
            <button class="btn btn-sm" @click="$emit('delete-plan', plannerHost)">
              <span class="mdi mdi-delete-outline"></span>
              Clear Plan
            </button>
          </div>
        </div>
      </floating-window>
    </div>
  `,
  methods: {
    formatDateTime,
    taskSlaMeta: getTaskDueMeta,
    taskSlaBadgeClass(task) {
      return getTaskSlaBadgeClass(this.taskSlaMeta(task));
    },
    taskEvidenceChecklist(task) {
      return Array.isArray(task?.evidence_checklist) ? task.evidence_checklist : [];
    },
    taskCompletionCriteria(task) {
      return Array.isArray(task?.completion_criteria) ? task.completion_criteria : [];
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
  },
};
