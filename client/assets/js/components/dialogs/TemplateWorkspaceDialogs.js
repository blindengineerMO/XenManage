const TemplateWorkspaceDialogs = {
  components: {
    FloatingWindow,
    StatusBadge,
    TemplateDeployForm,
    TemplateGovernanceForm,
    TemplatePromotionForm,
    TemplateDeploymentValidationForm,
  },
  props: {
    showProps: { type: Boolean, default: false },
    selectedTemplate: { type: Object, default: null },
    governanceMap: { type: Object, default: () => ({}) },
    operatingSystemTemplateRefs: { type: Array, default: () => [] },
    hostOptions: { type: Array, default: () => [] },
    storageOptions: { type: Array, default: () => [] },
    networkOptions: { type: Array, default: () => [] },
    deployments: { type: Array, default: () => [] },
    selectedTemplateDeployments: { type: Array, default: () => [] },
    selectedTemplateHistory: { type: Array, default: () => [] },
    historyRestoreLoadingId: { type: [String, Number], default: '' },
    historyRestoreError: { type: String, default: null },
    historyRestoreMessage: { type: String, default: '' },
    showGovernance: { type: Boolean, default: false },
    governanceTemplateRecord: { type: Object, default: null },
    governanceSaving: { type: Boolean, default: false },
    governanceError: { type: String, default: null },
    showDeploy: { type: Boolean, default: false },
    deployTemplateRecord: { type: Object, default: null },
    deploySaving: { type: Boolean, default: false },
    deployError: { type: String, default: null },
    deploymentMessage: { type: String, default: '' },
    showDeploymentValidation: { type: Boolean, default: false },
    selectedDeployment: { type: Object, default: null },
    deploymentValidationSaving: { type: Boolean, default: false },
    deploymentValidationError: { type: String, default: null },
    showPromotionReview: { type: Boolean, default: false },
    promotionTemplateRecord: { type: Object, default: null },
    currentPromotionBaseline: { type: Object, default: null },
    promotionDiffRows: { type: Array, default: () => [] },
    promotionDraft: { type: Object, default: () => ({}) },
    promotionSaving: { type: Boolean, default: false },
    promotionError: { type: String, default: null },
    promotionHistory: { type: Array, default: () => [] },
    promotionHistoryLoading: { type: Boolean, default: false },
  },
  emits: [
    'close-props',
    'open-governance',
    'open-promotion-review',
    'open-deploy',
    'open-deployment-validation',
    'restore-governance-history',
    'close-governance',
    'save-governance',
    'close-deploy',
    'submit-deployment',
    'close-deployment-validation',
    'save-deployment-validation',
    'close-promotion-review',
    'submit-promotion',
  ],
  template: `
    <div>
      <floating-window :show="showProps"
                       title="Template Properties"
                       :width="860"
                       :height="680"
                       @close="$emit('close-props')">
        <div v-if="selectedTemplate">
          <div class="dashboard-hero" style="margin-bottom:12px;padding:18px">
            <div>
              <div class="dash-card-label">Template Library Record</div>
              <h3>{{ selectedTemplate.name_label || 'Template' }}</h3>
              <p>{{ selectedTemplate.name_description || 'Golden-image source for repeatable VM deployment and standards-led rollout.' }}</p>
            </div>
            <div class="dashboard-hero-rail">
              <button class="btn" @click="$emit('open-governance', selectedTemplate)">
                <span class="mdi mdi-shield-edit-outline"></span>
                Edit Governance
              </button>
              <button class="btn"
                      :disabled="!canPromoteTemplate(selectedTemplate)"
                      @click="$emit('open-promotion-review', selectedTemplate)">
                <span class="mdi mdi-arrow-up-bold-circle-outline"></span>
                Compare & Promote
              </button>
              <button v-if="!isOperatingSystemProfile(selectedTemplate)" class="btn btn-primary" @click="$emit('open-deploy', selectedTemplate)">
                <span class="mdi mdi-rocket-launch-outline"></span>
                Deploy Template
              </button>
            </div>
          </div>

          <div class="property-grid">
            <span class="text-muted">Name</span><span>{{ selectedTemplate.name_label || '-' }}</span>
            <span class="text-muted">Description</span><span>{{ selectedTemplate.name_description || '-' }}</span>
            <span class="text-muted">Profile</span><span>{{ getTemplateProfile(selectedTemplate) }}</span>
            <span class="text-muted">Version</span><span class="mono">{{ getTemplateVersion(selectedTemplate) || '-' }}</span>
            <span class="text-muted">Lifecycle Stage</span><span>{{ getLifecycleStage(selectedTemplate) }}</span>
            <span class="text-muted">Validation Status</span><status-badge :status="mapValidationStatus(getValidationStatus(selectedTemplate))"></status-badge>
            <span class="text-muted">Golden Image</span><span>{{ isGoldenImage(selectedTemplate) ? 'Yes' : 'No' }}</span>
            <span class="text-muted">Guest Customization</span><span>{{ getGuestCustomization(selectedTemplate) || '-' }}</span>
            <span class="text-muted">Catalog Owner</span><span>{{ getTemplateGovernanceRecord(selectedTemplate.ref)?.owner || '-' }}</span>
            <span class="text-muted">Last Validated</span><span>{{ formatDateTime(getTemplateGovernanceRecord(selectedTemplate.ref)?.lastValidatedAt) }}</span>
            <span class="text-muted">vCPUs</span><span class="mono">{{ selectedTemplate.VCPUs_at_startup || 0 }}</span>
            <span class="text-muted">Memory</span><span class="mono">{{ formatBytes(selectedTemplate.memory_static_max) }}</span>
            <span class="text-muted">Boot Policy</span><span>{{ selectedTemplate.HVM_boot_policy || selectedTemplate.PV_bootloader || '-' }}</span>
            <span class="text-muted">UUID</span><span class="mono property-wrap">{{ selectedTemplate.uuid || '-' }}</span>
            <span class="text-muted">Tags</span><span>{{ truncateList(selectedTemplate.tags) }}</span>
            <span class="text-muted">Platform</span><span class="mono property-wrap">{{ JSON.stringify(selectedTemplate.platform || {}) }}</span>
          </div>

          <div class="dashboard-panels" style="margin-top:18px">
            <div class="dash-card">
              <div class="dash-card-label">Provisioning Defaults</div>
              <div class="stack-list">
                <div class="stack-item">
                  <div>
                    <strong>Preferred Storage</strong>
                    <div class="text-muted mono" style="font-size:11px">{{ storageOptions[0] ? (storageOptions[0].name_label || storageOptions[0].ref) : 'No storage discovered' }}</div>
                  </div>
                  <span class="badge badge-info">default</span>
                </div>
                <div class="stack-item">
                  <div>
                    <strong>Preferred Network</strong>
                    <div class="text-muted mono" style="font-size:11px">{{ networkOptions[0] ? (networkOptions[0].name_label || networkOptions[0].bridge || networkOptions[0].ref) : 'No network discovered' }}</div>
                  </div>
                  <span class="badge badge-info">default</span>
                </div>
              </div>
            </div>

            <div class="dash-card">
              <div class="dash-card-label">Governance Controls</div>
              <div class="stack-list">
                <div class="stack-item">
                  <div>
                    <strong>{{ getTemplateVersion(selectedTemplate) || 'Version not set' }}</strong>
                    <div class="text-muted mono" style="font-size:11px">{{ getTemplateGovernanceRecord(selectedTemplate.ref)?.notes || 'Use governance notes to track hardening, ownership, and promotion history.' }}</div>
                  </div>
                  <span class="badge" :class="isGoldenImage(selectedTemplate) ? 'badge-running' : 'badge-info'">
                    {{ isGoldenImage(selectedTemplate) ? 'golden' : 'catalog' }}
                  </span>
                </div>
                <div class="stack-item">
                  <div>
                    <strong>{{ getGuestCustomization(selectedTemplate) || 'No guest customization profile' }}</strong>
                    <div class="text-muted mono" style="font-size:11px">Persist guest-init or sysprep guidance so deploys follow the expected baseline.</div>
                  </div>
                  <span class="badge badge-info">customization</span>
                </div>
              </div>
            </div>
          </div>

          <div class="detail-section">
            <div class="detail-section-title">Recent Validation Activity</div>
            <div class="stack-list" v-if="selectedTemplateDeployments.length">
              <button class="stack-item stack-item-button"
                      v-for="deployment in selectedTemplateDeployments.slice(0, 4)"
                      :key="deployment.id"
                      @click="$emit('open-deployment-validation', deployment)">
                <div class="capacity-item-main">
                  <strong>{{ deployment.vmName }}</strong>
                  <div class="text-muted mono" style="font-size:11px">
                    {{ resolveDeploymentLabel(hostOptions, deployment.hostRef, deployment.hostLabel || 'Unassigned host') }} · {{ formatDateTime(deployment.submittedAt) }}
                  </div>
                  <div class="text-muted mono" style="font-size:11px">{{ deployment.validationNotes || 'No validation notes recorded yet.' }}</div>
                </div>
                <status-badge :status="mapDeploymentStatus(deployment.validationStatus)"></status-badge>
              </button>
            </div>
            <div v-else class="empty-state" style="padding:18px 12px">
              No deployment validation records exist for this template yet.
            </div>
          </div>

          <div class="detail-section">
            <div class="detail-section-title">Governance History</div>
            <div class="stack-list" v-if="selectedTemplateHistory.length">
              <div class="stack-item" v-for="entry in selectedTemplateHistory.slice(0, 6)" :key="entry.id">
                <div class="capacity-item-main">
                  <strong>{{ formatHistoryEvent(entry.eventType) }}</strong>
                  <div class="text-muted mono" style="font-size:11px">
                    {{ entry.snapshot.versionLabel || selectedTemplate.name_label || entry.templateRef }} · {{ entry.actor || 'system' }} · {{ formatDateTime(entry.happenedAt) }}
                  </div>
                  <div class="text-muted mono" style="font-size:11px">
                    {{ entry.detail || entry.snapshot.notes || 'No additional governance detail recorded.' }}
                  </div>
                </div>
                <div style="display:flex;align-items:center;gap:8px">
                  <button class="btn btn-ghost"
                          :disabled="historyRestoreLoadingId === entry.id"
                          @click="$emit('restore-governance-history', { templateRef: selectedTemplate.ref, entry })">
                    {{ historyRestoreLoadingId === entry.id ? 'Restoring...' : 'Restore Snapshot' }}
                  </button>
                  <span class="badge" :class="templateStageBadgeClass(entry.snapshot.lifecycleStage)">
                    {{ entry.snapshot.lifecycleStage }}
                  </span>
                </div>
              </div>
            </div>
            <div v-else class="empty-state" style="padding:18px 12px">
              Governance saves and promotions will build a template-specific history trail here.
            </div>
            <div class="stack-item" v-if="historyRestoreMessage" style="margin-top:12px">
              <div>
                <strong>History Restored</strong>
                <div class="text-muted mono" style="font-size:11px">{{ historyRestoreMessage }}</div>
              </div>
              <span class="badge badge-running">restored</span>
            </div>
            <div class="form-error" v-if="historyRestoreError" style="text-align:left;margin-top:12px">{{ historyRestoreError }}</div>
          </div>
        </div>
      </floating-window>

      <floating-window :show="showGovernance"
                       title="Template Governance"
                       :width="720"
                       :height="640"
                       @close="$emit('close-governance')">
        <div v-if="governanceTemplateRecord">
          <div class="detail-section" style="margin-top:0">
            <div class="detail-section-title">Catalog Target</div>
            <div class="stack-item">
              <div>
                <strong>{{ governanceTemplateRecord.name_label || 'Template' }}</strong>
                <div class="text-muted mono" style="font-size:11px">
                  {{ governanceTemplateRecord.uuid || governanceTemplateRecord.ref }} · {{ getTemplateProfile(governanceTemplateRecord) }} · {{ getLifecycleStage(governanceTemplateRecord) }}
                </div>
              </div>
              <span class="badge badge-info">governance</span>
            </div>
          </div>

          <template-governance-form
            :template-record="governanceTemplateRecord"
            :initial-value="getTemplateGovernanceRecord(governanceTemplateRecord.ref)"
            :saving="governanceSaving"
            :submit-label="'Save Governance'"
            @submit="$emit('save-governance', $event)">
          </template-governance-form>

          <div class="form-error" v-if="governanceError" style="text-align:left">{{ governanceError }}</div>
        </div>
      </floating-window>

      <floating-window :show="showDeploy"
                       title="Deploy From Template"
                       :width="720"
                       :height="680"
                       @close="$emit('close-deploy')">
        <div v-if="deployTemplateRecord">
          <div class="detail-section" style="margin-top:0">
            <div class="detail-section-title">Deployment Source</div>
            <div class="stack-item">
              <div>
                <strong>{{ deployTemplateRecord.name_label || 'Template' }}</strong>
                <div class="text-muted mono" style="font-size:11px">
                  {{ getTemplateProfile(deployTemplateRecord) }} · {{ getLifecycleStage(deployTemplateRecord) }} · {{ getTemplateVersion(deployTemplateRecord) || 'no version' }}
                </div>
                <div class="text-muted mono" style="font-size:11px">
                  Validation {{ getValidationStatus(deployTemplateRecord) }} · {{ getGuestCustomization(deployTemplateRecord) || 'no guest customization profile' }}
                </div>
              </div>
              <span class="badge" :class="templateStageBadgeClass(getLifecycleStage(deployTemplateRecord))">{{ getLifecycleStage(deployTemplateRecord) }}</span>
            </div>
          </div>

          <template-deploy-form
            :template-record="deployTemplateRecord"
            :host-options="hostOptions"
            :storage-options="storageOptions"
            :network-options="networkOptions"
            :submit-label="'Deploy VM'"
            :saving="deploySaving"
            @submit="$emit('submit-deployment', $event)">
          </template-deploy-form>

          <div class="form-error" v-if="deployError" style="text-align:left">{{ deployError }}</div>
          <div class="stack-item" v-if="deploymentMessage" style="margin-top:12px">
            <div>
              <strong>Deployment Submitted</strong>
              <div class="text-muted mono" style="font-size:11px">{{ deploymentMessage }}</div>
            </div>
            <span class="badge badge-running">ready</span>
          </div>
        </div>
      </floating-window>

      <floating-window :show="showDeploymentValidation"
                       title="Deployment Validation"
                       :width="760"
                       :height="660"
                       @close="$emit('close-deployment-validation')">
        <div v-if="selectedDeployment">
          <div class="dashboard-hero" style="margin-bottom:12px;padding:18px">
            <div>
              <div class="dash-card-label">Deployment Record</div>
              <h3>{{ selectedDeployment.vmName || 'Deployment' }}</h3>
              <p>{{ selectedDeployment.templateName || 'Template' }}{{ selectedDeployment.templateVersion ? ' · ' + selectedDeployment.templateVersion : '' }} · {{ formatDateTime(selectedDeployment.submittedAt) }}</p>
            </div>
            <div class="dashboard-hero-rail">
              <status-badge :status="mapDeploymentStatus(selectedDeployment.validationStatus)"></status-badge>
            </div>
          </div>

          <div class="property-grid">
            <span class="text-muted">Template</span><span>{{ selectedDeployment.templateName || '-' }}</span>
            <span class="text-muted">VM</span><span>{{ selectedDeployment.vmName || '-' }}</span>
            <span class="text-muted">Host</span><span>{{ resolveDeploymentLabel(hostOptions, selectedDeployment.hostRef, selectedDeployment.hostLabel || '-') }}</span>
            <span class="text-muted">Storage</span><span>{{ resolveDeploymentLabel(storageOptions, selectedDeployment.storageRef, selectedDeployment.storageLabel || '-') }}</span>
            <span class="text-muted">Network</span><span>{{ resolveDeploymentLabel(networkOptions, selectedDeployment.networkRef, selectedDeployment.networkLabel || '-') }}</span>
            <span class="text-muted">Submitted By</span><span>{{ selectedDeployment.submittedBy || '-' }}</span>
            <span class="text-muted">Submitted At</span><span>{{ formatDateTime(selectedDeployment.submittedAt) }}</span>
            <span class="text-muted">Guest Customization</span><span>{{ selectedDeployment.guestCustomization || '-' }}</span>
          </div>

          <div class="detail-section">
            <div class="detail-section-title">Validation Checklist</div>
            <div class="stack-list">
              <div class="stack-item">
                <div>
                  <strong>Guest Boot</strong>
                  <div class="text-muted mono" style="font-size:11px">Confirm first boot, console access, and baseline guest services.</div>
                </div>
                <status-badge :status="selectedDeployment.bootVerified ? 'success' : 'warning'"></status-badge>
              </div>
              <div class="stack-item">
                <div>
                  <strong>Network Reachability</strong>
                  <div class="text-muted mono" style="font-size:11px">Validate expected connectivity and primary network attachment.</div>
                </div>
                <status-badge :status="selectedDeployment.networkVerified ? 'success' : 'warning'"></status-badge>
              </div>
              <div class="stack-item">
                <div>
                  <strong>Storage Mapping</strong>
                  <div class="text-muted mono" style="font-size:11px">Review root disk placement and intended storage capacity.</div>
                </div>
                <status-badge :status="selectedDeployment.storageVerified ? 'success' : 'warning'"></status-badge>
              </div>
              <div class="stack-item">
                <div>
                  <strong>Policy Tags</strong>
                  <div class="text-muted mono" style="font-size:11px">Apply workload or governance tags after provisioning.</div>
                </div>
                <status-badge :status="selectedDeployment.policyTagged ? 'success' : 'warning'"></status-badge>
              </div>
            </div>
          </div>

          <template-deployment-validation-form
            :deployment-record="selectedDeployment"
            :saving="deploymentValidationSaving"
            :submit-label="'Save Validation'"
            @submit="$emit('save-deployment-validation', $event)">
          </template-deployment-validation-form>

          <div class="form-error" v-if="deploymentValidationError" style="text-align:left">{{ deploymentValidationError }}</div>
        </div>
      </floating-window>

      <floating-window :show="showPromotionReview"
                       title="Template Promotion Review"
                       :width="860"
                       :height="700"
                       @close="$emit('close-promotion-review')">
        <div v-if="promotionTemplateRecord">
          <div class="dashboard-hero" style="margin-bottom:12px;padding:18px">
            <div>
              <div class="dash-card-label">Promotion Candidate</div>
              <h3>{{ promotionTemplateRecord.name_label || 'Template' }}</h3>
              <p>{{ promotionTemplateRecord.versionLabel || 'No version label' }} · {{ promotionTemplateRecord.profileLabel }} · {{ templateDeploymentSummary(promotionTemplateRecord.ref) }}</p>
            </div>
            <div class="dashboard-hero-rail">
              <span class="badge" :class="templateStageBadgeClass(promotionTemplateRecord.lifecycleStage)">{{ promotionTemplateRecord.lifecycleStage }}</span>
              <status-badge :status="mapValidationStatus(promotionTemplateRecord.validationStatus)"></status-badge>
            </div>
          </div>

          <div class="detail-section" style="margin-top:0">
            <div class="detail-section-title">Baseline Comparison</div>
            <div class="property-grid">
              <span class="text-muted">Current Stable</span><span>{{ currentPromotionBaseline?.name_label || 'None' }}</span>
              <span class="text-muted">Current Stable Version</span><span class="mono">{{ currentPromotionBaseline?.versionLabel || '-' }}</span>
              <span class="text-muted">Candidate Version</span><span class="mono">{{ promotionTemplateRecord.versionLabel || '-' }}</span>
              <span class="text-muted">Candidate Validation</span><status-badge :status="mapValidationStatus(promotionTemplateRecord.validationStatus)"></status-badge>
              <span class="text-muted">Customization</span><span>{{ promotionTemplateRecord.guestCustomization || '-' }}</span>
              <span class="text-muted">Owner</span><span>{{ getTemplateGovernanceRecord(promotionTemplateRecord.ref)?.owner || '-' }}</span>
            </div>
          </div>

          <div class="detail-section">
            <div class="detail-section-title">Promotion Delta</div>
            <div class="stack-list">
              <div class="stack-item" v-for="row in promotionDiffRows" :key="row.label">
                <div class="capacity-item-main">
                  <strong>{{ row.label }}</strong>
                  <div class="text-muted mono" style="font-size:11px">Current stable: {{ row.current || '-' }}</div>
                  <div class="text-muted mono" style="font-size:11px">Candidate: {{ row.next || '-' }}</div>
                </div>
                <span class="badge" :class="row.changed ? 'badge-warning' : 'badge-info'">{{ row.changed ? 'changed' : 'same' }}</span>
              </div>
            </div>
          </div>

          <template-promotion-form
            :initial-value="promotionDraft"
            :baseline-label="formatPromotionBaselineLabel(currentPromotionBaseline)"
            :eligible="canPromoteTemplate(promotionTemplateRecord)"
            :saving="promotionSaving"
            submit-label="Promote to Stable"
            @submit="$emit('submit-promotion', $event)">
          </template-promotion-form>

          <div class="detail-section">
            <div class="detail-section-title">Recent Governance Changes</div>
            <div class="stack-list" v-if="promotionHistory.length">
              <div class="stack-item" v-for="entry in promotionHistory.slice(0, 6)" :key="entry.id">
                <div class="capacity-item-main">
                  <strong>{{ formatHistoryEvent(entry.eventType) }}</strong>
                  <div class="text-muted mono" style="font-size:11px">
                    {{ entry.snapshot.versionLabel || promotionTemplateRecord.versionLabel || promotionTemplateRecord.ref }} · {{ entry.actor || 'system' }} · {{ formatDateTime(entry.happenedAt) }}
                  </div>
                  <div class="text-muted mono" style="font-size:11px">{{ entry.detail || entry.snapshot.notes || 'No extra notes recorded.' }}</div>
                </div>
                <div style="display:flex;align-items:center;gap:8px">
                  <button class="btn btn-ghost"
                          :disabled="historyRestoreLoadingId === entry.id"
                          @click="$emit('restore-governance-history', { templateRef: promotionTemplateRecord.ref, entry })">
                    {{ historyRestoreLoadingId === entry.id ? 'Restoring...' : 'Restore Snapshot' }}
                  </button>
                  <span class="badge" :class="templateStageBadgeClass(entry.snapshot.lifecycleStage)">{{ entry.snapshot.lifecycleStage }}</span>
                </div>
              </div>
            </div>
            <div v-else-if="promotionHistoryLoading" class="empty-state" style="padding:18px 12px">
              Loading template governance history...
            </div>
            <div v-else class="empty-state" style="padding:18px 12px">
              No governance history has been recorded for this template yet.
            </div>
          </div>

          <div class="stack-item" v-if="historyRestoreMessage" style="margin-top:12px">
            <div>
              <strong>History Restored</strong>
              <div class="text-muted mono" style="font-size:11px">{{ historyRestoreMessage }}</div>
            </div>
            <span class="badge badge-running">restored</span>
          </div>
          <div class="form-error" v-if="promotionError" style="text-align:left">{{ promotionError }}</div>
          <div class="form-error" v-if="historyRestoreError" style="text-align:left;margin-top:12px">{{ historyRestoreError }}</div>
        </div>
      </floating-window>
    </div>
  `,
  methods: {
    isOperatingSystemProfile(template) {
      return this.operatingSystemTemplateRefs.includes(template?.ref);
    },
    formatBytes,
    formatDateTime,
    truncateList,
    templateStageBadgeClass: buildTemplateStageBadgeClass,
    mapValidationStatus: mapTemplateValidationStatusBadge,
    mapDeploymentStatus: mapTemplateDeploymentStatusBadge,
    getTemplateGovernanceRecord(templateRef) {
      return getTemplateGovernanceRecord(this.governanceMap, templateRef);
    },
    getTemplateProfile(template) {
      return getTemplateProfile(template, this.governanceMap);
    },
    getLifecycleStage(template) {
      return getTemplateLifecycleStage(template, this.governanceMap);
    },
    getValidationStatus(template) {
      return getTemplateValidationStatus(template, this.governanceMap);
    },
    getTemplateVersion(template) {
      return getTemplateVersionLabel(template, this.governanceMap);
    },
    getGuestCustomization(template) {
      return getTemplateGuestCustomizationLabel(template, this.governanceMap);
    },
    isGoldenImage(template) {
      return isTemplateGoldenImage(template, this.governanceMap);
    },
    resolveDeploymentLabel(collection, ref, fallback) {
      return resolveTemplateDeploymentLabel(collection, ref, fallback);
    },
    canPromoteTemplate(template) {
      return canPromoteTemplateRecord(template, this.governanceMap);
    },
    templateDeploymentSummary(templateRef) {
      return buildTemplateDeploymentSummary(this.deployments, templateRef);
    },
    formatPromotionBaselineLabel(baseline) {
      if (!baseline) return '';
      return `${baseline.name_label || baseline.ref} · ${baseline.versionLabel || 'no version'}`;
    },
    formatHistoryEvent(eventType) {
      return formatTemplateHistoryEvent(eventType);
    },
  },
};
