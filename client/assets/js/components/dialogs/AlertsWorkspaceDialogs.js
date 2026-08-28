const AlertsWorkspaceDialogs = {
  components: {
    FloatingWindow,
    StatusBadge,
    AlertStateForm,
    AlertPolicyForm,
    RemediationTaskForm,
    RemediationTaskTemplateForm,
  },
  props: {
    showProps: { type: Boolean, default: false },
    selectedMessage: { type: Object, default: null },
    workflowGuidance: { type: Array, default: () => [] },
    recommendedTemplates: { type: Array, default: () => [] },
    remediationError: { type: String, default: null },
    saving: { type: Boolean, default: false },
    saveError: { type: String, default: null },
    showPolicyEditor: { type: Boolean, default: false },
    policyError: { type: String, default: null },
    editingPolicy: { type: Object, default: null },
    policySaving: { type: Boolean, default: false },
    showRemediationComposer: { type: Boolean, default: false },
    remediationDraft: { type: Object, default: null },
    remediationSaving: { type: Boolean, default: false },
    showTemplateEditor: { type: Boolean, default: false },
    templateError: { type: String, default: null },
    editingTemplate: { type: Object, default: null },
    templateSaving: { type: Boolean, default: false },
  },
  emits: [
    'close-properties',
    'quick-acknowledge',
    'quick-suppress',
    'open-related',
    'open-workflow-for-message',
    'open-remediation-composer',
    'queue-remediation-template',
    'apply-remediation-template',
    'open-template-editor',
    'save-selected-alert-state',
    'close-policy-editor',
    'save-policy',
    'remove-policy',
    'close-remediation-composer',
    'submit-remediation-task',
    'close-template-editor',
    'save-template',
    'remove-template',
  ],
  template: `
    <div>
      <floating-window :show="showProps"
                       title="Alert Detail"
                       :width="780"
                       :height="660"
                       @close="$emit('close-properties')">
        <div v-if="selectedMessage">
          <div class="dashboard-hero" style="margin-bottom:12px;padding:18px">
            <div>
              <div class="dash-card-label">Alert Record</div>
              <h3>{{ selectedMessage.summary }}</h3>
              <p>{{ selectedMessage.body || 'No additional message body supplied for this alert.' }}</p>
            </div>
            <div class="dashboard-hero-rail">
              <button class="btn btn-primary" @click="$emit('quick-acknowledge', { message: selectedMessage, acknowledged: !selectedMessage.acknowledged })">
                <span class="mdi mdi-check-decagram-outline"></span>
                {{ selectedMessage.acknowledged ? 'Clear Ack' : 'Acknowledge' }}
              </button>
              <button class="btn" @click="$emit('quick-suppress', { message: selectedMessage, hours: 24 })">
                <span class="mdi mdi-bell-off-outline"></span>
                Suppress 24h
              </button>
              <button class="btn" @click="$emit('open-related', selectedMessage)">
                <span class="mdi mdi-open-in-new"></span>
                Open {{ selectedMessage.targetLabel }}
              </button>
              <button class="btn" v-if="resolveWorkflowRoute(selectedMessage).route" @click="$emit('open-workflow-for-message', selectedMessage)">
                <span class="mdi mdi-rocket-launch-outline"></span>
                {{ resolveWorkflowRoute(selectedMessage).label }}
              </button>
              <button class="btn" @click="$emit('open-remediation-composer', selectedMessage)">
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
                      @click="openWorkflowLink(link.route)">
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
                <button class="btn btn-primary btn-sm" @click="$emit('open-remediation-composer', selectedMessage)">
                  <span class="mdi mdi-clipboard-plus-outline"></span>
                  Create Remediation Task
                </button>
                <button class="btn btn-sm" v-if="resolveWorkflowRoute(selectedMessage).route" @click="$emit('open-workflow-for-message', selectedMessage)">
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
                          @click="$emit('queue-remediation-template', { template, message: selectedMessage })">
                    <span class="mdi" :class="remediationTemplatePrimaryActionIcon(template)"></span>
                    {{ remediationTemplatePrimaryActionLabel(template) }}
                  </button>
                  <button class="btn btn-sm" :class="template.launchMode === 'draft' ? 'btn-primary' : ''" @click="$emit('apply-remediation-template', { template, message: selectedMessage })">
                    <span class="mdi mdi-creation-outline"></span>
                    Use Template
                  </button>
                  <button class="btn btn-sm" @click="$emit('open-template-editor', template)">
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
              @submit="$emit('save-selected-alert-state', $event)">
            </alert-state-form>
          </div>

          <div class="form-error" v-if="saveError" style="text-align:left">{{ saveError }}</div>
        </div>
      </floating-window>

      <floating-window :show="showPolicyEditor"
                       title="Alert Policy"
                       :width="740"
                       :height="660"
                       @close="$emit('close-policy-editor')">
        <div class="detail-section" v-if="policyError">
          <div class="capacity-callout">
            <strong>{{ policyError }}</strong>
          </div>
        </div>
        <alert-policy-form
          :initial-value="editingPolicy"
          :saving="policySaving"
          :submit-label="editingPolicy && editingPolicy.id ? 'Save Alert Policy' : 'Create Alert Policy'"
          @submit="$emit('save-policy', $event)">
        </alert-policy-form>
        <div class="form-actions" style="margin-top:12px" v-if="editingPolicy?.id">
          <button class="btn" @click="$emit('remove-policy', editingPolicy)" :disabled="policySaving">Delete Policy</button>
        </div>
      </floating-window>

      <floating-window :show="showRemediationComposer"
                       title="Create Remediation Task"
                       :width="720"
                       :height="650"
                       @close="$emit('close-remediation-composer')">
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
          @submit="$emit('submit-remediation-task', $event)">
        </remediation-task-form>
      </floating-window>

      <floating-window :show="showTemplateEditor"
                       title="Remediation Template"
                       :width="760"
                       :height="720"
                       @close="$emit('close-template-editor')">
        <div class="detail-section" v-if="templateError">
          <div class="capacity-callout">
            <strong>{{ templateError }}</strong>
          </div>
        </div>
        <remediation-template-form
          :initial-value="editingTemplate"
          :saving="templateSaving"
          :submit-label="editingTemplate && editingTemplate.id ? 'Save Remediation Template' : 'Create Remediation Template'"
          @submit="$emit('save-template', $event)">
        </remediation-template-form>
        <div class="form-actions" style="margin-top:12px" v-if="editingTemplate?.id">
          <button class="btn" @click="$emit('remove-template', editingTemplate)" :disabled="templateSaving">Delete Template</button>
        </div>
      </floating-window>
    </div>
  `,
  methods: {
    formatDateTime,
    formatActionLabel: formatAlertActionLabel,
    resolveWorkflowRoute: resolveAlertWorkflowRoute,
    describeTemplateAutomation: describeAlertTemplateAutomation,
    describeRemediationTemplate: describeAlertRemediationTemplate,
    remediationTemplatePrimaryActionLabel: getAlertRemediationTemplatePrimaryActionLabel,
    remediationTemplatePrimaryActionIcon: getAlertRemediationTemplatePrimaryActionIcon,
    openWorkflowLink(route) {
      if (!route) return;
      this.$router.push(route);
    },
  },
};
