const AlertsView = {
  components: {
    DataTable,
    FloatingWindow,
    StatusBadge,
    'alert-state-form': AlertStateForm,
    'alert-policy-form': AlertPolicyForm,
    'remediation-task-form': RemediationTaskForm,
    'remediation-template-form': RemediationTaskTemplateForm,
  },
  template: `
    <div class="animate-fade-in">
      <div class="section-head">
        <div>
          <h2 class="section-title">
            <span class="mdi mdi-bell-alert-outline"></span>
            Alerts
          </h2>
          <p class="section-subtitle">Severity-first event triage with bulk state changes, persisted suppression policy, and workflow-aware follow-through.</p>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button
            v-for="filter in filters"
            :key="filter.value"
            class="btn btn-sm"
            :class="{ 'btn-primary': activeFilter === filter.value }"
            @click="activeFilter = filter.value">
            {{ filter.label }}
          </button>
          <button class="btn" @click="openPolicyEditor(null)">
            <span class="mdi mdi-shield-sun-outline"></span>
            New Policy
          </button>
          <button class="btn btn-primary" @click="loadWorkspace">
            <span class="mdi mdi-refresh"></span>
            Refresh
          </button>
        </div>
      </div>

      <div class="dash-grid">
        <div class="dash-card" v-for="card in alertCards" :key="card.key">
          <div class="dash-card-label">{{ card.label }}</div>
          <div class="dash-card-value" :class="card.valueClass || ''">{{ card.value }}</div>
          <div class="dash-card-icon mdi" :class="card.icon"></div>
          <div class="text-muted mono" style="margin-top:8px;font-size:11px">{{ card.detail }}</div>
        </div>
      </div>

      <div class="dash-card" v-if="selectedAlerts.length" style="margin-bottom:16px">
        <div class="dash-card-label">Bulk Triage</div>
        <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap">
          <div>
            <strong>{{ selectedAlerts.length }} alerts selected</strong>
            <div class="text-muted mono" style="font-size:11px;margin-top:4px">
              {{ selectedAlerts.slice(0, 3).map((message) => message.summary).join(' · ') }}<span v-if="selectedAlerts.length > 3"> · +{{ selectedAlerts.length - 3 }} more</span>
            </div>
          </div>
          <div class="dashboard-hero-rail" style="gap:8px">
            <button class="btn btn-sm btn-primary" @click="applyBulkState({ acknowledged: true })">
              <span class="mdi mdi-check-decagram-outline"></span>
              Acknowledge
            </button>
            <button class="btn btn-sm" @click="applyBulkState({ acknowledged: false })">Clear Ack</button>
            <button class="btn btn-sm" @click="applyBulkSuppression(4)">Suppress 4h</button>
            <button class="btn btn-sm" @click="applyBulkSuppression(24)">Suppress 24h</button>
            <button class="btn btn-sm" @click="applyBulkState({ suppressionUntil: '' })">Clear Suppression</button>
            <button class="btn btn-sm" @click="clearSelection">Clear Selection</button>
          </div>
        </div>
        <div class="form-error" v-if="bulkError" style="text-align:left;margin-top:12px">{{ bulkError }}</div>
      </div>

      <data-table
        :columns="columns"
        :data="filteredMessages"
        :loading="loading"
        :searchable="true"
        :selectable="true"
        :selected-keys="selectedRefs"
        row-key="ref"
        @selection-change="handleSelectionChange"
        @row-click="openProperties">
        <template #cell-effectiveSeverity="{ row }">
          <status-badge :status="row.effectiveSeverity"></status-badge>
        </template>
        <template #cell-summary="{ row }">
          <div>
            <span style="color:var(--text-primary);font-weight:500">{{ row.summary }}</span>
            <div class="text-muted mono" style="font-size:11px">
              {{ row.stateLabel }} · {{ formatActionLabel(row.healthAction) }}
              <span v-if="row.policyName"> · policy {{ row.policyName }}</span>
            </div>
          </div>
        </template>
        <template #cell-stateLabel="{ row }">
          <span class="badge"
                :class="row.stateLabel === 'suppressed' ? 'badge-info' : (row.stateLabel === 'acknowledged' ? 'badge-running' : 'badge-error')">
            {{ row.stateLabel }}
          </span>
        </template>
        <template #cell-policyName="{ row }">
          <span class="badge" :class="row.policyName ? 'badge-info' : 'badge-warning'">
            {{ row.policyName || '-' }}
          </span>
        </template>
        <template #cell-suppressionUntil="{ row }">
          <span class="mono">{{ row.suppressionUntil ? formatDateTime(row.suppressionUntil) : '-' }}</span>
        </template>
        <template #cell-timestamp="{ row }">
          <span class="mono">{{ formatDateTime(row.timestamp) }}</span>
        </template>
      </data-table>

      <div class="dashboard-panels">
        <div class="dash-card">
          <div class="dash-card-label">Suppression Policies</div>
          <div class="stack-list" v-if="policies.length">
            <button class="stack-item stack-item-button"
                    v-for="policy in policies"
                    :key="policy.id"
                    @click="openPolicyEditor(policy)">
              <div>
                <strong>{{ policy.name }}</strong>
                <div class="text-muted mono" style="font-size:11px">{{ describePolicy(policy) }}</div>
                <div class="text-muted" style="font-size:12px;margin-top:6px">{{ policy.notes || 'No policy notes supplied.' }}</div>
              </div>
              <span class="badge" :class="policy.enabled ? 'badge-success' : 'badge-warning'">
                {{ policy.enabled ? 'Enabled' : 'Disabled' }}
              </span>
            </button>
          </div>
          <div v-else class="empty-state" style="padding:20px 12px">
            No alert policies have been defined yet.
          </div>
        </div>

        <div class="dash-card">
          <div class="dash-card-label">Workflow Guidance</div>
          <div class="stack-list" v-if="workflowGuidance.length">
            <button class="stack-item stack-item-button"
                    v-for="link in workflowGuidance"
                    :key="link.label + link.route"
                    @click="$router.push(link.route)">
              <div>
                <strong>{{ link.label }}</strong>
                <div class="text-muted" style="font-size:12px">{{ link.detail }}</div>
              </div>
              <span class="badge badge-info">{{ link.route.replace('/', '') || 'root' }}</span>
            </button>
          </div>
          <div v-else class="empty-state" style="padding:20px 12px">
            Choose an alert to see targeted follow-through workspaces.
          </div>
        </div>

        <div class="dash-card">
          <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:12px">
            <div class="dash-card-label">Remediation Templates</div>
            <button class="btn btn-sm" @click="openTemplateEditor(null)">
              <span class="mdi mdi-file-document-plus-outline"></span>
              New Template
            </button>
          </div>
          <div class="stack-list" v-if="remediationTemplates.length">
            <button class="stack-item stack-item-button"
                    v-for="template in remediationTemplates"
                    :key="template.id"
                    @click="openTemplateEditor(template)">
              <div>
                <strong>{{ template.name }}</strong>
                <div class="text-muted mono" style="font-size:11px">{{ describeRemediationTemplate(template) }}</div>
                <div class="text-muted mono" style="font-size:11px;margin-top:4px">{{ describeTemplateAutomation(template) }}</div>
                <div class="text-muted" style="font-size:12px;margin-top:6px">{{ template.defaultNotes || 'No default task notes supplied.' }}</div>
              </div>
              <span class="badge" :class="template.enabled ? 'badge-success' : 'badge-warning'">
                {{ template.enabled ? 'Enabled' : 'Disabled' }}
              </span>
            </button>
          </div>
          <div v-else class="empty-state" style="padding:20px 12px">
            Save reusable follow-through templates for recurring alert patterns.
          </div>
        </div>
      </div>

      <floating-window :show="showProps" title="Alert Detail" :width="780" :height="660" @close="closeProperties">
        <div v-if="selectedMessage">
          <div class="dashboard-hero" style="margin-bottom:12px;padding:18px">
            <div>
              <div class="dash-card-label">Alert Record</div>
              <h3>{{ selectedMessage.summary }}</h3>
              <p>{{ selectedMessage.body || 'No additional message body supplied for this alert.' }}</p>
            </div>
            <div class="dashboard-hero-rail">
              <button class="btn btn-primary" @click="quickAcknowledge(selectedMessage, !selectedMessage.acknowledged)">
                <span class="mdi mdi-check-decagram-outline"></span>
                {{ selectedMessage.acknowledged ? 'Clear Ack' : 'Acknowledge' }}
              </button>
              <button class="btn" @click="quickSuppress(selectedMessage, 24)">
                <span class="mdi mdi-bell-off-outline"></span>
                Suppress 24h
              </button>
              <button class="btn" @click="openRelated(selectedMessage)">
                <span class="mdi mdi-open-in-new"></span>
                Open {{ selectedMessage.targetLabel }}
              </button>
              <button class="btn" v-if="resolveWorkflowRoute(selectedMessage).route" @click="openWorkflowForMessage(selectedMessage)">
                <span class="mdi mdi-rocket-launch-outline"></span>
                {{ resolveWorkflowRoute(selectedMessage).label }}
              </button>
              <button class="btn" @click="openRemediationComposer(selectedMessage)">
                <span class="mdi mdi-clipboard-plus-outline"></span>
                Create Follow-Through Task
              </button>
            </div>
          </div>

          <div class="property-grid">
            <span class="text-muted">Effective Severity</span><status-badge :status="selectedMessage.effectiveSeverity"></status-badge>
            <span class="text-muted">Detected Severity</span><span>{{ selectedMessage.baseSeverity }}</span>
            <span class="text-muted">State</span><span>{{ selectedMessage.stateLabel }}</span>
            <span class="text-muted">Class</span><span>{{ selectedMessage.cls || '-' }}</span>
            <span class="text-muted">Object</span><span class="mono property-wrap">{{ selectedMessage.obj_uuid || selectedMessage.ref }}</span>
            <span class="text-muted">Timestamp</span><span class="mono">{{ formatDateTime(selectedMessage.timestamp) }}</span>
            <span class="text-muted">Acknowledged</span><span>{{ selectedMessage.acknowledged ? 'Yes' : 'No' }}</span>
            <span class="text-muted">Acknowledged By</span><span>{{ selectedMessage.acknowledgedBy || '-' }}</span>
            <span class="text-muted">Suppressed Until</span><span class="mono">{{ selectedMessage.suppressionUntil ? formatDateTime(selectedMessage.suppressionUntil) : '-' }}</span>
            <span class="text-muted">Health Action</span><span>{{ formatActionLabel(selectedMessage.healthAction) }}</span>
            <span class="text-muted">Policy Match</span><span>{{ selectedMessage.policyName || '-' }}</span>
            <span class="text-muted">UUID</span><span class="mono property-wrap">{{ selectedMessage.uuid || '-' }}</span>
          </div>

          <div class="detail-section" v-if="selectedMessage.policyName">
            <div class="detail-section-title">Policy Context</div>
            <div class="capacity-callout">
              <p>
                {{ selectedMessage.managedByPolicy ? 'This alert is currently being shaped by an active suppression policy.' : 'A policy matched this alert, but the current manual state now overrides it.' }}
              </p>
              <div class="text-muted mono" style="font-size:11px">{{ selectedMessage.policyName }}</div>
            </div>
          </div>

          <div class="detail-section" v-if="selectedMessage.notes">
            <div class="detail-section-title">Operator Notes</div>
            <div class="capacity-callout">
              <p>{{ selectedMessage.notes }}</p>
            </div>
          </div>

          <div class="detail-section" v-if="workflowGuidance.length">
            <div class="detail-section-title">Follow-Through Workspaces</div>
            <div class="dashboard-hero-rail" style="justify-content:flex-start">
              <button class="btn"
                      v-for="link in workflowGuidance"
                      :key="link.route + link.label"
                      @click="$router.push(link.route)">
                <span class="mdi mdi-arrow-top-right"></span>
                {{ link.label }}
              </button>
            </div>
          </div>

          <div class="detail-section">
            <div class="detail-section-title">Remediation Queue</div>
            <div class="capacity-callout">
              <p>Create a tracked follow-through task when this alert should stay visible in Activity with an assignee, due date, and direct return links into the right workspace.</p>
              <div style="display:flex;gap:8px;flex-wrap:wrap">
                <button class="btn btn-primary btn-sm" @click="openRemediationComposer(selectedMessage)">
                  <span class="mdi mdi-clipboard-plus-outline"></span>
                  Create Remediation Task
                </button>
                <button class="btn btn-sm" v-if="resolveWorkflowRoute(selectedMessage).route" @click="openWorkflowForMessage(selectedMessage)">
                  <span class="mdi mdi-arrow-top-right"></span>
                  Open {{ resolveWorkflowRoute(selectedMessage).label }}
                </button>
              </div>
            </div>
          </div>

          <div class="detail-section">
            <div class="detail-section-title">Recommended Templates</div>
            <div class="stack-list" v-if="recommendedTemplates.length">
              <div class="stack-item" v-for="template in recommendedTemplates" :key="template.id">
                <div>
                  <strong>{{ template.name }}</strong>
                  <div class="text-muted mono" style="font-size:11px">{{ describeRemediationTemplate(template) }}</div>
                  <div class="text-muted mono" style="font-size:11px;margin-top:4px">{{ describeTemplateAutomation(template) }}</div>
                  <div class="text-muted" style="font-size:12px;margin-top:6px">{{ template.defaultNotes || 'This template uses the standard alert guidance defaults.' }}</div>
                </div>
                <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
                  <button class="btn btn-sm"
                          :class="template.launchMode !== 'draft' ? 'btn-primary' : ''"
                          @click="queueRemediationTemplate(template, selectedMessage)">
                    <span class="mdi" :class="remediationTemplatePrimaryActionIcon(template)"></span>
                    {{ remediationTemplatePrimaryActionLabel(template) }}
                  </button>
                  <button class="btn btn-sm" :class="template.launchMode === 'draft' ? 'btn-primary' : ''" @click="applyRemediationTemplate(template, selectedMessage)">
                    <span class="mdi mdi-creation-outline"></span>
                    Use Template
                  </button>
                  <button class="btn btn-sm" @click="openTemplateEditor(template)">
                    <span class="mdi mdi-pencil-outline"></span>
                    Edit
                  </button>
                </div>
              </div>
            </div>
            <div v-else class="empty-state" style="padding:18px 12px">
              No remediation templates currently match this alert. Create one to standardize recurring follow-through work.
            </div>
            <div class="form-error" v-if="remediationError" style="text-align:left;margin-top:12px">{{ remediationError }}</div>
          </div>

          <div class="detail-section">
            <div class="detail-section-title">Alert State</div>
            <alert-state-form
              :initial-value="selectedMessage"
              :saving="saving"
              @submit="saveSelectedAlertState">
            </alert-state-form>
          </div>

          <div class="form-error" v-if="saveError" style="text-align:left">{{ saveError }}</div>
        </div>
      </floating-window>

      <floating-window :show="showPolicyEditor"
                       title="Alert Policy"
                       :width="740"
                       :height="660"
                       @close="closePolicyEditor">
        <div class="detail-section" v-if="policyError">
          <div class="capacity-callout">
            <strong>{{ policyError }}</strong>
          </div>
        </div>
        <alert-policy-form
          :initial-value="editingPolicy"
          :saving="policySaving"
          :submit-label="editingPolicy && editingPolicy.id ? 'Save Alert Policy' : 'Create Alert Policy'"
          @submit="savePolicy">
        </alert-policy-form>
        <div class="form-actions" style="margin-top:12px" v-if="editingPolicy?.id">
          <button class="btn" @click="removePolicy(editingPolicy)" :disabled="policySaving">Delete Policy</button>
        </div>
      </floating-window>

      <floating-window :show="showRemediationComposer"
                       title="Create Remediation Task"
                       :width="720"
                       :height="650"
                       @close="closeRemediationComposer">
        <div class="detail-section" v-if="remediationError">
          <div class="capacity-callout">
            <strong>{{ remediationError }}</strong>
          </div>
        </div>
        <remediation-task-form
          v-if="remediationDraft"
          :initial-value="remediationDraft"
          :saving="remediationSaving"
          submit-label="Create Remediation Task"
          @submit="submitRemediationTask">
        </remediation-task-form>
      </floating-window>

      <floating-window :show="showTemplateEditor"
                       title="Remediation Template"
                       :width="760"
                       :height="720"
                       @close="closeTemplateEditor">
        <div class="detail-section" v-if="templateError">
          <div class="capacity-callout">
            <strong>{{ templateError }}</strong>
          </div>
        </div>
        <remediation-template-form
          :initial-value="editingTemplate"
          :saving="templateSaving"
          :submit-label="editingTemplate && editingTemplate.id ? 'Save Remediation Template' : 'Create Remediation Template'"
          @submit="saveTemplate">
        </remediation-template-form>
        <div class="form-actions" style="margin-top:12px" v-if="editingTemplate?.id">
          <button class="btn" @click="removeTemplate(editingTemplate)" :disabled="templateSaving">Delete Template</button>
        </div>
      </floating-window>
    </div>
  `,
  data() {
    return {
      loading: true,
      activeFilter: 'all',
      filters: [
        { value: 'all', label: 'all' },
        { value: 'open', label: 'open' },
        { value: 'critical', label: 'critical' },
        { value: 'warning', label: 'warning' },
        { value: 'acknowledged', label: 'acknowledged' },
        { value: 'suppressed', label: 'suppressed' },
        { value: 'policy', label: 'policy' },
      ],
      messages: [],
      policies: [],
      remediationTemplates: [],
      selectedRef: null,
      selectedRefs: [],
      showProps: false,
      showPolicyEditor: false,
      showRemediationComposer: false,
      showTemplateEditor: false,
      editingPolicy: null,
      editingTemplate: null,
      remediationDraft: null,
      lastAppliedFocusKey: '',
      saving: false,
      policySaving: false,
      remediationSaving: false,
      templateSaving: false,
      saveError: null,
      policyError: null,
      remediationError: null,
      templateError: null,
      bulkError: null,
      columns: [
        { key: 'effectiveSeverity', label: 'Severity' },
        { key: 'summary', label: 'Summary' },
        { key: 'cls', label: 'Class' },
        { key: 'policyName', label: 'Policy' },
        { key: 'stateLabel', label: 'State' },
        { key: 'suppressionUntil', label: 'Suppressed Until' },
        { key: 'timestamp', label: 'Timestamp' },
      ],
    };
  },
  computed: {
    decoratedMessages() {
      return decorateAlertMessages(this.messages);
    },
    filteredMessages() {
      return filterAlertMessages(this.decoratedMessages, this.activeFilter);
    },
    selectedMessage() {
      return findSelectedAlertMessage(this.decoratedMessages, this.selectedRef);
    },
    selectedAlerts() {
      return buildSelectedAlertRows(this.decoratedMessages, this.selectedRefs);
    },
    alertCards() {
      return buildAlertCards(this.decoratedMessages, this.policies);
    },
    workflowGuidance() {
      return buildAlertFollowThroughLinks(this.selectedMessage);
    },
    recommendedTemplates() {
      return getAlertMatchingRemediationTemplates(this.remediationTemplates, this.selectedMessage);
    },
  },
  async mounted() {
    if (!store.authenticated) {
      this.$router.push('/login');
      return;
    }
    await this.loadWorkspace();
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
    formatActionLabel: formatAlertActionLabel,
    formatClassLabel: formatAlertClassLabel,
    formatTargetRouteLabel: formatAlertTargetRouteLabel,
    describePolicy: describeAlertPolicy,
    describeTemplateAutomation: describeAlertTemplateAutomation,
    describeRemediationTemplate: describeAlertRemediationTemplate,
    formatTemplateRecurrence: formatAlertTemplateRecurrence,
    matchesRemediationTemplate: matchesAlertRemediationTemplate,
    resolveWorkflowRoute: resolveAlertWorkflowRoute,
    getFollowThroughLinks: buildAlertFollowThroughLinks,
    buildAlertFocusLocation: buildAlertFocusLocation,
    applyTemplateTokens: applyAlertTemplateTokens,
    applyTemplateTokenList: applyAlertTemplateTokenList,
    buildRemediationTaskFocus: buildAlertRemediationTaskFocus,
    resolveRemediationLaunchLocation: resolveAlertRemediationLaunchLocation,
    remediationTemplatePrimaryActionLabel: getAlertRemediationTemplatePrimaryActionLabel,
    remediationTemplatePrimaryActionIcon: getAlertRemediationTemplatePrimaryActionIcon,
    applyLifecyclePlanSeed: applyAlertLifecyclePlanSeed,
    applyResilienceRunbookSeed: applyAlertResilienceRunbookSeed,
    applyVmMigrationSeed: applyAlertVmMigrationSeed,
    formatDueDateFromDays: formatAlertDueDateFromDays,
    async loadWorkspace() {
      this.loading = true;
      this.bulkError = null;
      try {
        const [alerts, policies, templates] = await Promise.all([
          api.getAlerts(),
          api.getAlertPolicies().catch(() => ({ data: [] })),
          api.getRemediationTemplates().catch(() => ({ data: [] })),
        ]);
        this.messages = alerts.data || [];
        this.policies = policies.data || [];
        this.remediationTemplates = templates.data || [];
        const visibleRefs = new Set(this.messages.map((message) => message.ref));
        this.selectedRefs = this.selectedRefs.filter((ref) => visibleRefs.has(ref));
      } catch (error) {
        console.error(error);
        this.messages = [];
        this.policies = [];
        this.remediationTemplates = [];
      } finally {
        this.loading = false;
      }
      await this.syncRouteFocus();
    },
    openProperties(row) {
      this.selectedRef = row.ref;
      this.saveError = null;
      this.remediationError = null;
      this.showProps = true;
    },
    closeProperties() {
      this.showProps = false;
      this.selectedRef = null;
      this.saveError = null;
      this.remediationError = null;
    },
    handleSelectionChange(nextSelection) {
      this.selectedRefs = nextSelection;
      this.bulkError = null;
    },
    clearSelection() {
      this.selectedRefs = [];
      this.bulkError = null;
    },
    openRelated(message) {
      this.showProps = false;
      this.$router.push(buildAlertFocusLocation(message));
    },
    openWorkflowForMessage(message) {
      const workflow = resolveAlertWorkflowRoute(message);
      if (!workflow.route) return;
      this.showProps = false;
      this.$router.push(workflow.route);
    },
    buildRemediationDraftFromAlert(message) {
      return buildAlertRemediationDraftFromAlert(message, store.username || '');
    },
    buildRemediationDraftFromTemplate(message, template) {
      return buildAlertRemediationDraftFromTemplate(message, template, store.username || '');
    },
    openRemediationComposer(message) {
      this.remediationDraft = this.buildRemediationDraftFromAlert(message);
      this.remediationError = null;
      this.showRemediationComposer = true;
    },
    applyRemediationTemplate(template, message) {
      this.remediationDraft = this.buildRemediationDraftFromTemplate(message, template);
      this.remediationError = null;
      this.showRemediationComposer = true;
    },
    async queueRemediationTemplate(template, message) {
      this.remediationSaving = true;
      this.remediationError = null;
      try {
        const task = await api.queueRemediationTemplate(this.buildRemediationDraftFromTemplate(message, template));
        this.showProps = false;
        this.$router.push(this.resolveRemediationLaunchLocation(task, {
          nameLabel: task.name_label || template.name || '',
          templateLaunchMode: template.launchMode || 'draft',
        }));
      } catch (error) {
        if (error.code === 'REMEDIATION_TASK_RECURRENCE_BLOCKED') {
          const nextEligibleAt = error.payload?.nextEligibleAt ? this.formatDateTime(error.payload.nextEligibleAt) : 'manual clearance';
          this.remediationError = `${template.name} already has queued follow-through for this scope until ${nextEligibleAt}.`;
        } else if (error.code === 'REMEDIATION_TEMPLATE_DISABLED') {
          this.remediationError = `${template.name} is currently disabled.`;
        } else {
          this.remediationError = error.message || 'Unable to queue the remediation task';
        }
      } finally {
        this.remediationSaving = false;
      }
    },
    closeRemediationComposer() {
      this.showRemediationComposer = false;
      this.remediationDraft = null;
      this.remediationError = null;
      this.remediationSaving = false;
    },
    async submitRemediationTask(payload) {
      this.remediationSaving = true;
      this.remediationError = null;
      try {
        const task = await api.createRemediationTask(payload);
        this.closeRemediationComposer();
        this.showProps = false;
        this.$router.push(this.resolveRemediationLaunchLocation(task, payload));
      } catch (error) {
        if (error.code === 'REMEDIATION_TASK_RECURRENCE_BLOCKED') {
          const nextEligibleAt = error.payload?.nextEligibleAt ? this.formatDateTime(error.payload.nextEligibleAt) : 'manual clearance';
          this.remediationError = `${payload.templateName || 'This remediation template'} already has queued follow-through for this scope until ${nextEligibleAt}.`;
        } else {
          this.remediationError = error.message || 'Unable to create the remediation task';
        }
      } finally {
        this.remediationSaving = false;
      }
    },
    openTemplateEditor(template) {
      this.editingTemplate = template ? { ...template } : {
        enabled: true,
        name: '',
        matchClass: '',
        matchTargetRoute: '',
        matchObject: '',
        matchSeverity: '',
        matchText: '',
        textMatchMode: 'phrase',
        actionType: 'review',
        taskNameTemplate: 'Review: {summary}',
        defaultAssignee: store.username || '',
        defaultDueDays: 0,
        defaultTargetRoute: '',
        defaultNotes: '',
        workspaceSummaryTemplate: '',
        evidenceChecklist: [],
        completionCriteria: [],
        launchMode: 'draft',
        recurrenceMode: 'manual',
        recurrenceScope: 'object',
        cooldownDays: 0,
        lifecyclePlanSeed: null,
        resilienceRunbookSeed: null,
      };
      this.templateError = null;
      this.showTemplateEditor = true;
    },
    closeTemplateEditor() {
      this.showTemplateEditor = false;
      this.editingTemplate = null;
      this.templateError = null;
      this.templateSaving = false;
    },
    async saveTemplate(payload) {
      this.templateSaving = true;
      this.templateError = null;
      try {
        if (this.editingTemplate?.id) {
          await api.updateRemediationTemplate(this.editingTemplate.id, payload);
        } else {
          await api.createRemediationTemplate(payload);
        }
        await this.loadWorkspace();
        this.closeTemplateEditor();
      } catch (error) {
        this.templateError = error.message || 'Unable to save the remediation template';
      } finally {
        this.templateSaving = false;
      }
    },
    async removeTemplate(template) {
      if (!template?.id) return;
      this.templateSaving = true;
      this.templateError = null;
      try {
        const approvalId = await resolveGovernanceApproval({
          actionKey: 'remediation_template_delete',
          entityType: 'task-template',
          entityRef: String(template.id),
          entityName: template.name || template.title || `Template ${template.id}`,
          route: '/alerts',
        });
        await api.deleteRemediationTemplate(template.id, approvalId ? { approvalId } : null);
        await this.loadWorkspace();
        this.closeTemplateEditor();
      } catch (error) {
        if (error.code === 'APPROVAL_REQUIRED') {
          this.templateError = 'Governance approval is required before deleting this remediation template.';
          await handoffToGovernanceApproval(
            this.$router,
            error.approvalDraft,
            'Approval required before deleting this remediation template.'
          );
          return;
        }
        this.templateError = error.message || 'Unable to remove the remediation template';
      } finally {
        this.templateSaving = false;
      }
    },
    async persistAlertState(ref, payload) {
      this.saving = true;
      this.saveError = null;
      try {
        const updated = await api.updateAlertState(ref, payload);
        this.messages = this.messages.map((message) => message.ref === ref ? updated : message);
        this.selectedRef = ref;
      } catch (error) {
        this.saveError = error.message || 'Unable to save alert state';
      } finally {
        this.saving = false;
      }
    },
    async applyBulkState(partialState = {}) {
      if (!this.selectedRefs.length) return;

      const first = this.selectedAlerts[0] || {};
      const state = {
        acknowledged: partialState.acknowledged !== undefined ? partialState.acknowledged : Boolean(first.acknowledged),
        suppressionUntil: partialState.suppressionUntil !== undefined ? partialState.suppressionUntil : (first.suppressionUntil || ''),
        severityOverride: partialState.severityOverride !== undefined ? partialState.severityOverride : (first.severityOverride || ''),
        healthAction: partialState.healthAction !== undefined ? partialState.healthAction : (first.healthAction || 'none'),
        notes: partialState.notes !== undefined ? partialState.notes : (first.notes || ''),
      };

      this.bulkError = null;

      try {
        const result = await api.bulkUpdateAlertState(this.selectedRefs, state);
        const nextMap = Object.fromEntries((result.data || []).map((message) => [message.ref, message]));
        this.messages = this.messages.map((message) => nextMap[message.ref] || message);
        if (this.selectedRef && nextMap[this.selectedRef]) {
          this.selectedRef = nextMap[this.selectedRef].ref;
        }
      } catch (error) {
        this.bulkError = error.message || 'Unable to apply the bulk alert update';
      }
    },
    async applyBulkSuppression(hours) {
      const suppressionUntil = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
      await this.applyBulkState({ suppressionUntil, healthAction: 'review' });
    },
    async saveSelectedAlertState(payload) {
      if (!this.selectedMessage) return;
      await this.persistAlertState(this.selectedMessage.ref, payload);
    },
    async quickAcknowledge(message, acknowledged) {
      await this.persistAlertState(message.ref, {
        acknowledged,
        suppressionUntil: message.suppressionUntil || '',
        severityOverride: message.severityOverride || '',
        healthAction: message.healthAction || 'none',
        notes: message.notes || '',
      });
    },
    async quickSuppress(message, hours) {
      const suppressionUntil = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
      await this.persistAlertState(message.ref, {
        acknowledged: message.acknowledged || false,
        suppressionUntil,
        severityOverride: message.severityOverride || '',
        healthAction: message.healthAction || 'review',
        notes: message.notes || '',
      });
    },
    openPolicyEditor(policy) {
      this.editingPolicy = policy ? { ...policy } : null;
      this.policyError = null;
      this.showPolicyEditor = true;
    },
    closePolicyEditor() {
      this.showPolicyEditor = false;
      this.editingPolicy = null;
      this.policyError = null;
    },
    async savePolicy(payload) {
      this.policySaving = true;
      this.policyError = null;
      try {
        if (this.editingPolicy?.id) {
          await api.updateAlertPolicy(this.editingPolicy.id, payload);
        } else {
          await api.createAlertPolicy(payload);
        }
        await this.loadWorkspace();
        this.closePolicyEditor();
      } catch (error) {
        this.policyError = error.message || 'Unable to save alert policy';
      } finally {
        this.policySaving = false;
      }
    },
    async removePolicy(policy) {
      if (!policy?.id) return;
      this.policySaving = true;
      this.policyError = null;
      try {
        const approvalId = await resolveGovernanceApproval({
          actionKey: 'alert_policy_delete',
          entityType: 'alert-policy',
          entityRef: String(policy.id),
          entityName: policy.name || policy.title || `Policy ${policy.id}`,
          route: '/alerts',
        });
        await api.deleteAlertPolicy(policy.id, approvalId ? { approvalId } : null);
        await this.loadWorkspace();
        this.closePolicyEditor();
      } catch (error) {
        if (error.code === 'APPROVAL_REQUIRED') {
          this.policyError = 'Governance approval is required before deleting this alert policy.';
          await handoffToGovernanceApproval(
            this.$router,
            error.approvalDraft,
            'Approval required before deleting this alert policy.'
          );
          return;
        }
        this.policyError = error.message || 'Unable to remove alert policy';
      } finally {
        this.policySaving = false;
      }
    },
    findAlertByFocus(focus) {
      return findAlertMessageByFocus(this.decoratedMessages, focus);
    },
    async syncRouteFocus() {
      const focus = getRouteFocus(this.$route.query);
      if (!focus || (focus.kind && focus.kind !== 'alert')) {
        this.lastAppliedFocusKey = '';
        return;
      }

      if (this.loading || !this.messages.length) return;

      const key = getRouteFocusKey(focus);
      if (this.lastAppliedFocusKey === key) return;

      const match = this.findAlertByFocus(focus);
      if (!match) return;

      this.openProperties(match);
      this.lastAppliedFocusKey = key;
    },
  },
};
