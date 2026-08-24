const TemplatesView = {
  components: {
    DataTable,
    FloatingWindow,
    StatusBadge,
    'template-deploy-form': TemplateDeployForm,
    'template-governance-form': TemplateGovernanceForm,
    'template-deployment-validation-form': TemplateDeploymentValidationForm,
  },
  template: `
    <div class="animate-fade-in">
      <div class="section-head">
        <div>
          <h2 class="section-title">
            <span class="mdi mdi-file-document-multiple-outline"></span>
            Templates
          </h2>
          <p class="section-subtitle">Golden image inventory for repeatable VM deployment, standards-driven lifecycle tagging, governance metadata, and post-deploy validation follow-through.</p>
        </div>
        <button class="btn btn-primary" @click="loadAll">
          <span class="mdi mdi-refresh"></span>
          Refresh
        </button>
      </div>

      <div class="dashboard-panels">
        <div class="dash-card">
          <div class="dash-card-label">Template Governance</div>
          <div class="stack-list">
            <div class="stack-item">
              <div>
                <strong>{{ templateStageCount('stable') }} stable baselines</strong>
                <div class="text-muted mono" style="font-size:11px">Images approved for repeatable rollout and production-aligned provisioning.</div>
              </div>
              <span class="badge badge-running">stable</span>
            </div>
            <div class="stack-item">
              <div>
                <strong>{{ governanceCoverageSummary }}</strong>
                <div class="text-muted mono" style="font-size:11px">Persisted version, ownership, and customization metadata tracked outside of template tags.</div>
              </div>
              <span class="badge badge-info">catalog</span>
            </div>
            <div class="stack-item">
              <div>
                <strong>{{ validationAttentionSummary }}</strong>
                <div class="text-muted mono" style="font-size:11px">Templates and recent deployments still needing validation or promotion review.</div>
              </div>
              <span class="badge badge-halted">review</span>
            </div>
          </div>
        </div>

        <div class="dash-card">
          <div class="dash-card-label">Recent Deployments</div>
          <div class="stack-list" v-if="recentDeployments.length">
            <button class="stack-item stack-item-button"
                    v-for="deployment in recentDeployments"
                    :key="deployment.id"
                    @click="openDeploymentValidation(deployment)">
              <div class="capacity-item-main">
                <strong>{{ deployment.vmName }}</strong>
                <div class="text-muted mono" style="font-size:11px">
                  {{ deployment.templateName }}{{ deployment.templateVersion ? ' · ' + deployment.templateVersion : '' }} · {{ resolveDeploymentLabel(hostOptions, deployment.hostRef, deployment.hostLabel || 'Unassigned host') }}
                </div>
                <div class="text-muted mono" style="font-size:11px">
                  {{ resolveDeploymentLabel(storageOptions, deployment.storageRef, deployment.storageLabel || 'No storage') }} · {{ resolveDeploymentLabel(networkOptions, deployment.networkRef, deployment.networkLabel || 'No network') }} · {{ formatDateTime(deployment.submittedAt) }}
                </div>
              </div>
              <status-badge :status="mapDeploymentStatus(deployment.validationStatus)"></status-badge>
            </button>
          </div>
          <div v-else class="empty-state" style="padding:18px 12px">
            Template launches will appear here with validation status and placement context.
          </div>
        </div>
      </div>

      <data-table :columns="columns" :data="normalizedTemplates" :loading="loading" :searchable="true" @row-click="openProperties">
        <template #cell-name_label="{ row }">
          <span style="color:var(--text-primary);font-weight:500">{{ row.name_label || 'Unnamed Template' }}</span>
        </template>
        <template #cell-versionLabel="{ row }">
          <span class="mono">{{ row.versionLabel || '-' }}</span>
        </template>
        <template #cell-profileLabel="{ row }">
          <span class="badge badge-info">{{ row.profileLabel }}</span>
        </template>
        <template #cell-lifecycleStage="{ row }">
          <span class="badge" :class="templateStageBadgeClass(row.lifecycleStage)">
            {{ row.lifecycleStage }}
          </span>
        </template>
        <template #cell-validationStatus="{ row }">
          <status-badge :status="mapValidationStatus(row.validationStatus)"></status-badge>
        </template>
        <template #cell-memory_static_max="{ row }">
          <span class="mono">{{ formatBytes(row.memory_static_max) }}</span>
        </template>
      </data-table>

      <floating-window :show="showProps" title="Template Properties" :width="860" :height="680" @close="showProps = false">
        <div v-if="selectedTemplate">
          <div class="dashboard-hero" style="margin-bottom:12px;padding:18px">
            <div>
              <div class="dash-card-label">Template Library Record</div>
              <h3>{{ selectedTemplate.name_label || 'Template' }}</h3>
              <p>{{ selectedTemplate.name_description || 'Golden-image source for repeatable VM deployment and standards-led rollout.' }}</p>
            </div>
            <div class="dashboard-hero-rail">
              <button class="btn" @click="openGovernance(selectedTemplate)">
                <span class="mdi mdi-shield-edit-outline"></span>
                Edit Governance
              </button>
              <button class="btn btn-primary" @click="openDeploy(selectedTemplate)">
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
                      @click="openDeploymentValidation(deployment)">
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
        </div>
      </floating-window>

      <floating-window :show="showGovernance"
                       title="Template Governance"
                       :width="720"
                       :height="640"
                       @close="showGovernance = false">
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
            @submit="saveGovernance">
          </template-governance-form>

          <div class="form-error" v-if="governanceError" style="text-align:left">{{ governanceError }}</div>
        </div>
      </floating-window>

      <floating-window :show="showDeploy"
                       title="Deploy From Template"
                       :width="720"
                       :height="680"
                       @close="showDeploy = false">
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
            @submit="submitDeployment">
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
                       @close="showDeploymentValidation = false">
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
            @submit="saveDeploymentValidation">
          </template-deployment-validation-form>

          <div class="form-error" v-if="deploymentValidationError" style="text-align:left">{{ deploymentValidationError }}</div>
        </div>
      </floating-window>
    </div>
  `,
  data() {
    return {
      loading: true,
      templates: [],
      hosts: [],
      storage: [],
      networks: [],
      governanceRecords: [],
      deployments: [],
      selectedTemplate: null,
      governanceTemplateRecord: null,
      deployTemplateRecord: null,
      selectedDeployment: null,
      showProps: false,
      showGovernance: false,
      showDeploy: false,
      showDeploymentValidation: false,
      governanceSaving: false,
      governanceError: null,
      deploySaving: false,
      deployError: null,
      deploymentValidationSaving: false,
      deploymentValidationError: null,
      deploymentMessage: '',
      lastAppliedFocusKey: '',
      columns: [
        { key: 'name_label', label: 'Name' },
        { key: 'versionLabel', label: 'Version' },
        { key: 'profileLabel', label: 'Profile' },
        { key: 'lifecycleStage', label: 'Stage' },
        { key: 'validationStatus', label: 'Validation' },
        { key: 'memory_static_max', label: 'Memory' },
      ],
    };
  },
  computed: {
    governanceMap() {
      return Object.fromEntries((this.governanceRecords || []).map((record) => [record.templateRef, record]));
    },
    normalizedTemplates() {
      return this.templates.map((template) => ({
        ...template,
        versionLabel: this.getTemplateVersion(template),
        profileLabel: this.getTemplateProfile(template),
        lifecycleStage: this.getLifecycleStage(template),
        validationStatus: this.getValidationStatus(template),
      }));
    },
    hostOptions() {
      return this.hosts.filter((host) => host && host.ref);
    },
    storageOptions() {
      return this.storage.filter((sr) => sr && sr.ref);
    },
    networkOptions() {
      return this.networks.filter((network) => network && network.ref);
    },
    recentDeployments() {
      return (this.deployments || []).slice(0, 8);
    },
    governanceCoverageSummary() {
      const governed = this.templates.filter((template) => Boolean(this.governanceMap[template.ref])).length;
      return `${governed} of ${this.templates.length || 0} templates have persisted governance records`;
    },
    validationAttentionSummary() {
      const templateAttention = this.normalizedTemplates.filter((template) => ['untested', 'review', 'failed'].includes(template.validationStatus)).length;
      const deploymentAttention = this.recentDeployments.filter((deployment) => ['pending', 'warning', 'failed'].includes(deployment.validationStatus)).length;
      return `${templateAttention} templates and ${deploymentAttention} recent deployments need review`;
    },
    selectedTemplateDeployments() {
      if (!this.selectedTemplate) return [];
      return this.deployments.filter((deployment) => deployment.templateRef === this.selectedTemplate.ref);
    },
  },
  async mounted() {
    if (!store.authenticated) {
      this.$router.push('/login');
      return;
    }
    await this.loadAll();
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
    formatBytes,
    formatDateTime,
    truncateList,
    templateStageBadgeClass(stage) {
      if (stage === 'stable') return 'badge-running';
      if (stage === 'staged') return 'badge-halted';
      if (stage === 'deprecated') return 'badge-error';
      return 'badge-info';
    },
    mapValidationStatus(status) {
      if (status === 'validated') return 'success';
      if (status === 'failed') return 'critical';
      if (status === 'review') return 'warning';
      return 'info';
    },
    mapDeploymentStatus(status) {
      if (status === 'validated') return 'success';
      if (status === 'failed') return 'critical';
      if (status === 'warning') return 'warning';
      return 'pending';
    },
    getTemplateGovernanceRecord(templateRef) {
      return this.governanceMap[templateRef] || null;
    },
    getTemplateProfile(template) {
      const governance = this.getTemplateGovernanceRecord(template.ref);
      if (governance?.profileLabel) return governance.profileLabel;

      const tags = (template.tags || []).map((tag) => String(tag).toLowerCase());
      if (tags.includes('windows')) return 'Windows';
      if (tags.includes('linux')) return 'Linux';
      if ((template.platform || {}).vtpm) return 'Secure Windows';
      if ((template.platform || {}).secureboot) return 'Secure Linux';
      return 'Standard';
    },
    getLifecycleStage(template) {
      const governance = this.getTemplateGovernanceRecord(template.ref);
      if (governance?.lifecycleStage) return governance.lifecycleStage;

      const tags = (template.tags || []).map((tag) => String(tag).toLowerCase());
      if (tags.includes('stable') || tags.includes('baseline')) return 'stable';
      if (tags.includes('staged') || tags.includes('candidate')) return 'staged';
      return 'draft';
    },
    getValidationStatus(template) {
      return this.getTemplateGovernanceRecord(template.ref)?.validationStatus || 'untested';
    },
    getTemplateVersion(template) {
      return this.getTemplateGovernanceRecord(template.ref)?.versionLabel || '';
    },
    getGuestCustomization(template) {
      return this.getTemplateGovernanceRecord(template.ref)?.guestCustomization || '';
    },
    isGoldenImage(template) {
      const governance = this.getTemplateGovernanceRecord(template.ref);
      if (governance) return Boolean(governance.goldenImage);
      const tags = (template.tags || []).map((tag) => String(tag).toLowerCase());
      return tags.includes('golden') || tags.includes('baseline');
    },
    templateStageCount(stage) {
      return this.normalizedTemplates.filter((template) => template.lifecycleStage === stage).length;
    },
    resolveDeploymentLabel(collection, ref, fallback) {
      const record = (collection || []).find((item) => item.ref === ref);
      if (!record) return fallback || ref || '-';
      return record.name_label || record.hostname || record.bridge || record.address || record.ref || fallback || '-';
    },
    openProperties(row) {
      this.selectedTemplate = row;
      this.showProps = true;
    },
    findTemplateByFocus(focus) {
      return this.normalizedTemplates.find((template) =>
        recordMatchesRouteFocus(template, focus, ['ref', 'uuid', 'name_label', 'versionLabel'])
      ) || null;
    },
    openGovernance(template) {
      this.governanceTemplateRecord = template;
      this.governanceError = null;
      this.showGovernance = true;
    },
    openDeploy(template) {
      this.deployTemplateRecord = template;
      this.deployError = null;
      this.deploymentMessage = '';
      this.showDeploy = true;
    },
    openDeploymentValidation(record) {
      this.selectedDeployment = record;
      this.deploymentValidationError = null;
      this.showDeploymentValidation = true;
    },
    async loadAll() {
      this.loading = true;
      try {
        const [templates, hosts, storage, networks, governance, deployments] = await Promise.all([
          api.getTemplates(),
          api.getHosts().catch(() => ({ data: [] })),
          api.getSRs().catch(() => ({ data: [] })),
          api.getNetworks().catch(() => ({ data: [] })),
          api.getTemplateGovernance().catch(() => ({ data: [] })),
          api.getTemplateDeployments().catch(() => ({ data: [] })),
        ]);

        this.templates = templates.data || [];
        this.hosts = hosts.data || [];
        this.storage = storage.data || [];
        this.networks = networks.data || [];
        this.governanceRecords = governance.data || [];
        this.deployments = deployments.data || [];
      } catch (error) {
        console.error(error);
      } finally {
        this.loading = false;
      }
      await this.syncRouteFocus();
    },
    async syncRouteFocus() {
      const focus = getRouteFocus(this.$route.query);
      if (!focus || (focus.kind && focus.kind !== 'template')) {
        this.lastAppliedFocusKey = '';
        return;
      }

      if (this.loading || !this.normalizedTemplates.length) return;

      const key = getRouteFocusKey(focus);
      if (this.lastAppliedFocusKey === key) return;

      const match = this.findTemplateByFocus(focus);
      if (!match) return;

      this.openProperties(match);
      this.lastAppliedFocusKey = key;
    },
    async saveGovernance(payload) {
      if (!this.governanceTemplateRecord) return;

      this.governanceSaving = true;
      this.governanceError = null;
      try {
        const record = await api.saveTemplateGovernance(this.governanceTemplateRecord.ref, payload);
        const nextRecords = this.governanceRecords.filter((entry) => entry.templateRef !== record.templateRef);
        this.governanceRecords = [...nextRecords, record];
        if (this.selectedTemplate?.ref === record.templateRef) {
          this.selectedTemplate = { ...this.selectedTemplate };
        }
        this.showGovernance = false;
      } catch (error) {
        this.governanceError = error.message || 'Unable to save template governance';
      } finally {
        this.governanceSaving = false;
      }
    },
    async submitDeployment(payload) {
      if (!this.deployTemplateRecord) return;

      this.deploySaving = true;
      this.deployError = null;
      this.deploymentMessage = '';
      try {
        const record = await api.deployTemplate(this.deployTemplateRecord.ref, payload);
        if (record.deploymentAudit) {
          this.deployments = [record.deploymentAudit, ...this.deployments].slice(0, 24);
        } else {
          const deployments = await api.getTemplateDeployments();
          this.deployments = deployments.data || [];
        }

        const deploymentAudit = record.deploymentAudit || {};
        const hostLabel = this.resolveDeploymentLabel(this.hostOptions, deploymentAudit.hostRef || payload.hostRef, payload.hostRef || 'selected host');
        this.deploymentMessage = `${record.name_label || payload.nameLabel} prepared on ${hostLabel}${payload.startAfter ? ' and started.' : '.'}`;
        await this.loadAll();
      } catch (error) {
        this.deployError = error.message || 'Unable to deploy template';
      } finally {
        this.deploySaving = false;
      }
    },
    async saveDeploymentValidation(payload) {
      if (!this.selectedDeployment) return;

      this.deploymentValidationSaving = true;
      this.deploymentValidationError = null;
      try {
        const record = await api.updateTemplateDeploymentValidation(this.selectedDeployment.id, payload);
        this.deployments = this.deployments.map((entry) => entry.id === record.id ? record : entry);
        this.selectedDeployment = record;
      } catch (error) {
        this.deploymentValidationError = error.message || 'Unable to save deployment validation';
      } finally {
        this.deploymentValidationSaving = false;
      }
    },
  },
};
