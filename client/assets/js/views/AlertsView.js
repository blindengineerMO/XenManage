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
                  <button class="btn btn-sm" :class="template.launchMode === 'queue' ? 'btn-primary' : ''" @click="queueRemediationTemplate(template, selectedMessage)">
                    <span class="mdi mdi-rocket-launch-outline"></span>
                    Queue Now
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
      return sortMessages(this.messages).map((message) => ({
        ...message,
        effectiveSeverity: getMessageSeverity(message),
        summary: getMessageHeadline(message),
        stateLabel: message.stateLabel || (message.suppressed ? 'suppressed' : message.acknowledged ? 'acknowledged' : 'open'),
      }));
    },
    filteredMessages() {
      if (this.activeFilter === 'all') {
        return this.decoratedMessages;
      }

      if (this.activeFilter === 'open') {
        return this.decoratedMessages.filter((message) => !message.acknowledged && !message.suppressed);
      }

      if (this.activeFilter === 'acknowledged') {
        return this.decoratedMessages.filter((message) => message.acknowledged);
      }

      if (this.activeFilter === 'suppressed') {
        return this.decoratedMessages.filter((message) => message.suppressed);
      }

      if (this.activeFilter === 'policy') {
        return this.decoratedMessages.filter((message) => Boolean(message.policyName));
      }

      return this.decoratedMessages.filter((message) => message.effectiveSeverity === this.activeFilter);
    },
    selectedMessage() {
      if (!this.selectedRef) return null;
      return this.decoratedMessages.find((message) => message.ref === this.selectedRef) || null;
    },
    selectedAlerts() {
      const selected = new Set(this.selectedRefs);
      return this.decoratedMessages.filter((message) => selected.has(message.ref));
    },
    alertCards() {
      const counts = this.decoratedMessages.reduce((acc, message) => {
        acc[message.effectiveSeverity] = (acc[message.effectiveSeverity] || 0) + 1;
        if (message.acknowledged) acc.acknowledged += 1;
        if (message.suppressed) acc.suppressed += 1;
        if (message.policyName) acc.policy += 1;
        if (!message.acknowledged && !message.suppressed) acc.open += 1;
        return acc;
      }, { critical: 0, warning: 0, info: 0, notice: 0, open: 0, acknowledged: 0, suppressed: 0, policy: 0 });

      return [
        {
          key: 'open',
          label: 'Open Alerts',
          value: String(counts.open),
          detail: counts.open ? `${counts.critical} critical and ${counts.warning} warning alerts still need attention` : 'No unacknowledged active alerts',
          icon: 'mdi-bell-ring-outline',
          valueClass: counts.open ? 'text-amber' : 'text-green',
        },
        {
          key: 'critical',
          label: 'Critical',
          value: String(counts.critical),
          detail: counts.critical ? 'Production-impacting signals should stay at the top of the queue' : 'No critical alerts detected',
          icon: 'mdi-alert-octagon-outline',
          valueClass: counts.critical ? 'text-red' : 'text-green',
        },
        {
          key: 'policy',
          label: 'Policy Managed',
          value: String(counts.policy),
          detail: counts.policy ? `${this.policies.length} suppression policies are influencing part of the queue` : 'No active policy matches in the current queue',
          icon: 'mdi-shield-sun-outline',
          valueClass: counts.policy ? 'text-cyan' : 'text-green',
        },
        {
          key: 'suppressed',
          label: 'Suppressed',
          value: String(counts.suppressed),
          detail: counts.suppressed ? 'Temporarily silenced alerts remain visible with expiration timestamps' : 'No alerts are currently suppressed',
          icon: 'mdi-bell-off-outline',
          valueClass: counts.suppressed ? 'text-cyan' : 'text-green',
        },
      ];
    },
    workflowGuidance() {
      if (!this.selectedMessage) return [];
      return this.getFollowThroughLinks(this.selectedMessage);
    },
    recommendedTemplates() {
      if (!this.selectedMessage) return [];
      return this.getMatchingRemediationTemplates(this.selectedMessage);
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
    formatActionLabel(value) {
      const map = {
        none: 'No Action',
        inspect: 'Inspect Related Object',
        monitor: 'Monitor Trend',
        review: 'Schedule Review',
        evacuate: 'Prepare Evacuation',
        snapshot: 'Create Protection Point',
        lifecycle: 'Open Lifecycle Review',
        capacity: 'Open Capacity Review',
        resilience: 'Open Resilience Review',
        governance: 'Open Governance Review',
      };
      return map[value] || 'No Action';
    },
    formatClassLabel(value) {
      const map = {
        host: 'Host',
        sr: 'Storage Repository',
        vdi: 'VDI',
        vbd: 'VBD',
        vm: 'VM',
        pool: 'Pool',
        network: 'Network',
        vif: 'VIF',
        pif: 'PIF',
        task: 'Task',
      };
      return map[value] || 'Any Class';
    },
    formatTargetRouteLabel(route) {
      const map = {
        '/hosts': 'Hosts',
        '/storage': 'Storage',
        '/vms': 'Virtual Machines',
        '/pools': 'Pools',
        '/networking': 'Networking',
        '/activity': 'Activity',
        '/inventory': 'Inventory',
        '/capacity': 'Capacity',
        '/resilience': 'Resilience',
        '/lifecycle': 'Lifecycle',
        '/governance': 'Governance',
      };
      return map[route] || 'Any Workspace';
    },
    describePolicy(policy) {
      const parts = [];
      parts.push(policy.matchClass ? this.formatClassLabel(policy.matchClass) : 'Any Class');
      if (policy.matchTargetRoute) parts.push(this.formatTargetRouteLabel(policy.matchTargetRoute));
      parts.push(policy.matchSeverity ? `${policy.matchSeverity} only` : 'Any Severity');
      if (policy.matchObject) parts.push(`object "${policy.matchObject}"`);
      if (policy.matchText) parts.push(`${policy.textMatchMode === 'all' ? 'all terms' : 'contains'} "${policy.matchText}"`);
      if (policy.suppressionHours) parts.push(`${policy.suppressionHours}h suppression`);
      if (policy.healthAction && policy.healthAction !== 'none') parts.push(this.formatActionLabel(policy.healthAction));
      return parts.join(' · ');
    },
    describeTemplateAutomation(template) {
      const launchMode = template?.launchMode === 'queue' ? 'queue immediately' : 'open draft first';
      return `Launch: ${launchMode} · Guard: ${this.formatTemplateRecurrence(template)}`;
    },
    describeRemediationTemplate(template) {
      const parts = [];
      parts.push(template.matchClass ? this.formatClassLabel(template.matchClass) : 'Any Class');
      if (template.matchTargetRoute) parts.push(this.formatTargetRouteLabel(template.matchTargetRoute));
      parts.push(template.matchSeverity ? `${template.matchSeverity} only` : 'Any Severity');
      if (template.matchObject) parts.push(`object "${template.matchObject}"`);
      if (template.matchText) parts.push(`${template.textMatchMode === 'all' ? 'all terms' : 'contains'} "${template.matchText}"`);
      parts.push(this.formatActionLabel(template.actionType || 'review'));
      if (template.defaultDueDays) parts.push(`due in ${template.defaultDueDays}d`);
      return parts.join(' · ');
    },
    formatTemplateRecurrence(template) {
      const mode = String(template?.recurrenceMode || 'manual').toLowerCase();
      const scope = String(template?.recurrenceScope || 'object').toLowerCase();
      const scopeLabel = scope === 'alert' ? 'alert' : scope === 'class' ? 'class signature' : 'object';
      if (mode === 'once') return `once per ${scopeLabel}`;
      if (mode === 'daily') return `daily per ${scopeLabel}`;
      if (mode === 'weekly') return `weekly per ${scopeLabel}`;
      if (mode === 'cooldown') return `${Number(template?.cooldownDays || 1)}d cooldown per ${scopeLabel}`;
      return 'no duplicate guard';
    },
    matchesRemediationTemplate(template, message) {
      if (!template?.enabled || !template?.name || !message) return false;

      const messageClass = String(message.cls || '').toLowerCase();
      const targetRoute = message.targetRoute || '';
      const severity = String(message.effectiveSeverity || message.baseSeverity || '').toLowerCase();
      const identityHaystack = `${message?.ref || ''} ${message?.summary || ''} ${message?.uuid || ''} ${message?.obj_uuid || ''}`.toLowerCase();
      const textHaystack = `${message?.summary || ''} ${message?.body || ''} ${message?.uuid || ''} ${message?.obj_uuid || ''}`.toLowerCase();

      if (template.matchClass && template.matchClass !== messageClass) return false;
      if (template.matchTargetRoute && template.matchTargetRoute !== targetRoute) return false;
      if (template.matchSeverity && template.matchSeverity !== severity) return false;
      if (template.matchObject && !identityHaystack.includes(String(template.matchObject).toLowerCase())) return false;

      if (template.matchText) {
        const query = String(template.matchText || '').toLowerCase();
        if (template.textMatchMode === 'all') {
          const terms = query.split(/[\s,]+/).map((term) => term.trim()).filter(Boolean);
          if (!terms.length || !terms.every((term) => textHaystack.includes(term))) return false;
        } else if (!textHaystack.includes(query)) {
          return false;
        }
      }

      return true;
    },
    getMatchingRemediationTemplates(message) {
      return (this.remediationTemplates || [])
        .filter((template) => this.matchesRemediationTemplate(template, message))
        .sort((left, right) => {
          const leftScore = (left.matchClass ? 2 : 0) + (left.matchTargetRoute ? 2 : 0) + (left.matchSeverity ? 2 : 0) + (left.matchObject ? 3 : 0) + (left.matchText ? 3 : 0);
          const rightScore = (right.matchClass ? 2 : 0) + (right.matchTargetRoute ? 2 : 0) + (right.matchSeverity ? 2 : 0) + (right.matchObject ? 3 : 0) + (right.matchText ? 3 : 0);
          return rightScore - leftScore;
        });
    },
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
      this.$router.push(this.buildAlertFocusLocation(message));
    },
    buildAlertFocusLocation(message) {
      const cls = String(message.cls || '').toLowerCase();
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
        task: 'task',
        alert: 'alert',
      };

      return buildFocusedRoute(message.targetRoute || '/inventory', {
        kind: kindMap[cls] || '',
        uuid: message.obj_uuid || '',
        name: message.summary || message.name || '',
        cls,
        source: 'alert',
      });
    },
    resolveWorkflowRoute(message) {
      const actionMap = {
        lifecycle: { route: '/lifecycle', label: 'Lifecycle Review' },
        capacity: { route: '/capacity', label: 'Capacity Review' },
        resilience: { route: '/resilience', label: 'Resilience Review' },
        governance: { route: '/governance', label: 'Governance Review' },
      };

      if (actionMap[message.healthAction]) {
        return actionMap[message.healthAction];
      }

      const cls = String(message.cls || '').toLowerCase();
      if (cls === 'host') return { route: '/lifecycle', label: 'Lifecycle Review' };
      if (cls === 'sr' || cls === 'vdi' || cls === 'vbd') return { route: '/capacity', label: 'Capacity Review' };
      if (cls === 'vm') return { route: '/governance', label: 'Governance Review' };
      if (cls === 'pool') return { route: '/resilience', label: 'Resilience Review' };
      return { route: '', label: '' };
    },
    getFollowThroughLinks(message) {
      const links = [];
      const seen = new Set();

      const addLink = (route, label, detail) => {
        if (!route || seen.has(route)) return;
        seen.add(route);
        links.push({ route, label, detail });
      };

      addLink(message.targetRoute || '/inventory', message.targetLabel || 'Related View', 'Open the closest live inventory surface for the affected object.');

      const workflow = this.resolveWorkflowRoute(message);
      if (workflow.route) {
        addLink(workflow.route, workflow.label, 'Continue directly into the recommended remediation workspace for this alert.');
      }

      const cls = String(message.cls || '').toLowerCase();
      if (cls === 'host') {
        addLink('/capacity', 'Capacity Review', 'Check host pressure, imbalance, and noisy-neighbor impact before maintenance.');
        addLink('/resilience', 'Resilience Review', 'Review failover posture and evacuation readiness for the affected host.');
      } else if (cls === 'sr' || cls === 'vdi' || cls === 'vbd') {
        addLink('/storage', 'Storage View', 'Inspect the affected repository, VDI, or attachment topology.');
        addLink('/resilience', 'Resilience Review', 'Confirm restore-point safety if storage degradation could impact protection posture.');
      } else if (cls === 'vm') {
        addLink('/vms', 'VM View', 'Open the VM detail workspace to inspect config, devices, and lifecycle state.');
        addLink('/resilience', 'Resilience Review', 'Check protection coverage and recovery posture for the affected workload.');
      } else if (cls === 'pool') {
        addLink('/pools', 'Pool View', 'Inspect pool membership and control-plane settings for the affected cluster.');
        addLink('/governance', 'Governance Review', 'Review quota and approval posture if the alert signals policy pressure.');
      }

      return links;
    },
    openWorkflowForMessage(message) {
      const workflow = this.resolveWorkflowRoute(message);
      if (!workflow.route) return;
      this.showProps = false;
      this.$router.push(workflow.route);
    },
    buildRemediationDraftFromAlert(message) {
      const workflow = this.resolveWorkflowRoute(message);
      const cls = String(message?.cls || '').toLowerCase();
      const actionType = message?.healthAction && message.healthAction !== 'none'
        ? message.healthAction
        : (workflow.route === '/capacity'
          ? 'capacity'
          : workflow.route === '/resilience'
            ? 'resilience'
            : workflow.route === '/governance'
              ? 'governance'
              : workflow.route === '/lifecycle'
                ? 'lifecycle'
                : 'review');
      const targetRoute = workflow.route || message?.targetRoute || '/activity';
      const summary = getMessageHeadline(message);
      const relatedLabel = this.formatClassLabel(cls).toLowerCase();

      return buildRemediationTaskDraft({
        nameLabel: `${this.formatActionLabel(actionType)}: ${summary}`,
        nameDescription: `${message?.body || 'Continue operator review for this alert.'}\n\nValidate the affected ${relatedLabel} and capture the outcome in Activity before closing the follow-through work.`,
        actionType,
        assignee: store.username || '',
        dueDate: '',
        alertRef: message?.ref || '',
        alertUuid: message?.uuid || '',
        alertSummary: summary,
        targetRoute,
        relatedObject: message?.obj_uuid || message?.ref || '',
        relatedClass: cls,
      });
    },
    applyTemplateTokens(templateText, message) {
      const source = String(templateText || '').trim();
      if (!source) return '';

      const summary = getMessageHeadline(message);
      const workflow = this.resolveWorkflowRoute(message);
      const severity = String(message.effectiveSeverity || message.baseSeverity || 'notice').toLowerCase();
      return source
        .replace(/\{summary\}/gi, summary)
        .replace(/\{class\}/gi, String(message.cls || '').toLowerCase() || 'alert')
        .replace(/\{object\}/gi, message.obj_uuid || message.ref || '')
        .replace(/\{severity\}/gi, severity)
        .replace(/\{workspace\}/gi, workflow.label || this.formatTargetRouteLabel(message.targetRoute || '') || 'workspace');
    },
    applyTemplateTokenList(entries, message) {
      return (Array.isArray(entries) ? entries : [])
        .map((entry) => this.applyTemplateTokens(entry, message))
        .map((entry) => String(entry || '').trim())
        .filter(Boolean);
    },
    applyLifecyclePlanSeed(seed, message) {
      if (!seed || seed.enabled === false) return null;

      const nextSeed = {
        ...seed,
        enabled: true,
        maintenanceWindow: this.applyTemplateTokens(seed.maintenanceWindow || '', message),
        patchGroup: this.applyTemplateTokens(seed.patchGroup || '', message),
        owner: this.applyTemplateTokens(seed.owner || '', message),
        notes: this.applyTemplateTokens(seed.notes || '', message),
      };

      if (Number(seed.dueDays || 0) > 0) {
        nextSeed.dueDate = this.formatDueDateFromDays(seed.dueDays);
      }

      return nextSeed;
    },
    applyResilienceRunbookSeed(seed, message) {
      if (!seed || seed.enabled === false) return null;
      return {
        ...seed,
        enabled: true,
        owner: this.applyTemplateTokens(seed.owner || '', message),
        notes: this.applyTemplateTokens(seed.notes || '', message),
        runbookSteps: this.applyTemplateTokenList(seed.runbookSteps || [], message),
      };
    },
    formatDueDateFromDays(days) {
      const count = Number(days || 0);
      if (!count) return '';
      const next = new Date();
      next.setDate(next.getDate() + count);
      return next.toISOString().slice(0, 10);
    },
    buildRemediationDraftFromTemplate(message, template) {
      const base = this.buildRemediationDraftFromAlert(message);
      const lifecyclePlanSeed = this.applyLifecyclePlanSeed(template.lifecyclePlanSeed, message);
      const resilienceRunbookSeed = this.applyResilienceRunbookSeed(template.resilienceRunbookSeed, message);

      if (lifecyclePlanSeed) {
        lifecyclePlanSeed.sourceTemplateId = template.id || '';
        lifecyclePlanSeed.sourceTemplateName = template.name || '';
      }

      if (resilienceRunbookSeed) {
        resilienceRunbookSeed.sourceTemplateId = template.id || '';
        resilienceRunbookSeed.sourceTemplateName = template.name || '';
      }

      return buildRemediationTaskDraft({
        ...base,
        nameLabel: this.applyTemplateTokens(template.taskNameTemplate || base.nameLabel, message) || base.nameLabel,
        nameDescription: this.applyTemplateTokens(template.defaultNotes || base.nameDescription, message) || base.nameDescription,
        actionType: template.actionType || base.actionType,
        assignee: template.defaultAssignee || base.assignee,
        dueDate: this.formatDueDateFromDays(template.defaultDueDays),
        targetRoute: template.defaultTargetRoute || base.targetRoute,
        workspaceSummary: this.applyTemplateTokens(template.workspaceSummaryTemplate || '', message),
        evidenceChecklist: this.applyTemplateTokenList(template.evidenceChecklist, message),
        completionCriteria: this.applyTemplateTokenList(template.completionCriteria, message),
        templateId: template.id || '',
        templateName: template.name || '',
        templateLaunchMode: template.launchMode || 'draft',
        recurrenceMode: template.recurrenceMode || 'manual',
        recurrenceScope: template.recurrenceScope || 'object',
        cooldownDays: Number(template.cooldownDays || 0),
        lifecyclePlanSeed,
        resilienceRunbookSeed,
      });
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
        this.$router.push(buildFocusedRoute('/activity', {
          kind: 'task',
          ref: task.ref || '',
          uuid: task.uuid || '',
          name: task.name_label || template.name || '',
          cls: 'task',
          source: 'alert',
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
        this.$router.push(buildFocusedRoute('/activity', {
          kind: 'task',
          ref: task.ref || '',
          uuid: task.uuid || '',
          name: task.name_label || payload.nameLabel || '',
          cls: 'task',
          source: 'alert',
        }));
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
        await api.deleteRemediationTemplate(template.id);
        await this.loadWorkspace();
        this.closeTemplateEditor();
      } catch (error) {
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
        await api.deleteAlertPolicy(policy.id);
        await this.loadWorkspace();
        this.closePolicyEditor();
      } catch (error) {
        this.policyError = error.message || 'Unable to remove alert policy';
      } finally {
        this.policySaving = false;
      }
    },
    findAlertByFocus(focus) {
      return this.decoratedMessages.find((message) =>
        recordMatchesRouteFocus(message, focus, ['ref', 'uuid', 'summary', 'name'])
      ) || null;
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
