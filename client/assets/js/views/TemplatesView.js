const TemplatesView = {
  components: {
    DataTable,
    StatusBadge,
    FloatingWindow,
    'template-create-form': TemplateCreateForm,
    TemplateWorkspaceDialogs,
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
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-sm btn-primary" @click="openTemplateCreate('operating-system')"><span class="mdi mdi-file-plus-outline"></span>New OS Profile</button>
          <button class="btn btn-sm" @click="openTemplateCreate('deployable')"><span class="mdi mdi-content-copy"></span>Create Golden Template</button>
          <button class="btn btn-primary" @click="loadAll"><span class="mdi mdi-refresh"></span>Refresh</button>
        </div>
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
          <div class="dash-card-label">Promotion Queue</div>
          <div class="stack-list" v-if="promotionCandidates.length">
            <button class="stack-item stack-item-button"
                    v-for="template in promotionCandidates.slice(0, 6)"
                    :key="template.ref"
                    @click="openPromotionReview(template)">
              <div class="capacity-item-main">
                <strong>{{ template.name_label || 'Template' }}</strong>
                <div class="text-muted mono" style="font-size:11px">
                  {{ template.versionLabel || 'No version' }} · {{ template.profileLabel }} · validated {{ formatDateTime(getTemplateGovernanceRecord(template.ref)?.lastValidatedAt) }}
                </div>
                <div class="text-muted mono" style="font-size:11px">
                  {{ resolvePromotionBaseline(template)?.versionLabel || 'No active stable baseline' }} · {{ templateDeploymentSummary(template.ref) }}
                </div>
              </div>
              <span class="badge badge-info">promote</span>
            </button>
          </div>
          <div v-else class="empty-state" style="padding:18px 12px">
            No staged-and-validated templates are waiting for promotion right now.
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

      <floating-window :show="showTemplateCreate" :title="templateCreateKind === 'operating-system' ? 'Create Operating-System Profile' : 'Create Deployable Golden Template'" :width="760" :height="560" @close="showTemplateCreate = false">
        <template-create-form :key="templateCreateKind" :saving="templateCreateSaving" :kind="templateCreateKind" :operating-systems="templateOperatingSystems" :virtual-machines="templateSourceVms" @submit="createTemplate"></template-create-form>
        <div class="form-error" v-if="templateCreateError">{{ templateCreateError }}</div>
      </floating-window>

      <template-workspace-dialogs
        :show-props="showProps"
        :selected-template="selectedTemplate"
        :governance-map="governanceMap"
        :operating-system-template-refs="operatingSystemTemplateRefs"
        :host-options="hostOptions"
        :storage-options="storageOptions"
        :network-options="networkOptions"
        :deployments="deployments"
        :selected-template-deployments="selectedTemplateDeployments"
        :selected-template-history="selectedTemplateHistory"
        :history-restore-loading-id="historyRestoreLoadingId"
        :history-restore-error="historyRestoreError"
        :history-restore-message="historyRestoreMessage"
        :show-governance="showGovernance"
        :governance-template-record="governanceTemplateRecord"
        :governance-saving="governanceSaving"
        :governance-error="governanceError"
        :show-deploy="showDeploy"
        :deploy-template-record="deployTemplateRecord"
        :deploy-saving="deploySaving"
        :deploy-error="deployError"
        :deployment-message="deploymentMessage"
        :show-deployment-validation="showDeploymentValidation"
        :selected-deployment="selectedDeployment"
        :deployment-validation-saving="deploymentValidationSaving"
        :deployment-validation-error="deploymentValidationError"
        :show-promotion-review="showPromotionReview"
        :promotion-template-record="promotionTemplateRecord"
        :current-promotion-baseline="currentPromotionBaseline"
        :promotion-diff-rows="promotionDiffRows"
        :promotion-draft="promotionDraft"
        :promotion-saving="promotionSaving"
        :promotion-error="promotionError"
        :promotion-history="promotionHistory"
        :promotion-history-loading="promotionHistoryLoading"
        @close-props="showProps = false"
        @open-governance="openGovernance"
        @open-promotion-review="openPromotionReview"
        @open-deploy="openDeploy"
        @open-deployment-validation="openDeploymentValidation"
        @restore-governance-history="handleRestoreGovernanceHistory"
        @close-governance="showGovernance = false"
        @save-governance="saveGovernance"
        @close-deploy="showDeploy = false"
        @submit-deployment="submitDeployment"
        @close-deployment-validation="showDeploymentValidation = false"
        @save-deployment-validation="saveDeploymentValidation"
        @close-promotion-review="showPromotionReview = false"
        @submit-promotion="submitPromotion">
      </template-workspace-dialogs>
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
      promotionTemplateRecord: null,
      showProps: false,
      showGovernance: false,
      showDeploy: false,
      showDeploymentValidation: false,
      showPromotionReview: false,
      showTemplateCreate: false,
      templateCreateKind: 'operating-system',
      templateCreateSaving: false,
      templateCreateError: '',
      templateOperatingSystems: [],
      templateSourceVms: [],
      operatingSystemTemplateRefs: [],
      governanceSaving: false,
      governanceError: null,
      deploySaving: false,
      deployError: null,
      deploymentValidationSaving: false,
      deploymentValidationError: null,
      promotionSaving: false,
      promotionError: null,
      promotionHistoryLoading: false,
      historyRestoreLoadingId: '',
      historyRestoreError: null,
      historyRestoreMessage: '',
      deploymentMessage: '',
      governanceHistoryByTemplate: {},
      promotionDraft: {
        baselineTemplateRef: '',
        retireExistingStable: true,
        promotionNotes: '',
      },
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
      return buildTemplateGovernanceMap(this.governanceRecords);
    },
    normalizedTemplates() {
      return buildNormalizedTemplates(this.templates, this.governanceMap);
    },
    hostOptions() {
      return buildTemplateResourceOptions(this.hosts);
    },
    storageOptions() {
      return buildTemplateResourceOptions(this.storage);
    },
    networkOptions() {
      return buildTemplateResourceOptions(this.networks);
    },
    recentDeployments() {
      return buildRecentTemplateDeployments(this.deployments);
    },
    promotionCandidates() {
      return buildTemplatePromotionCandidates(this.normalizedTemplates, this.governanceMap);
    },
    governanceCoverageSummary() {
      return buildTemplateGovernanceCoverageSummary(this.templates, this.governanceMap);
    },
    validationAttentionSummary() {
      return buildTemplateValidationAttentionSummary(this.normalizedTemplates, this.recentDeployments);
    },
    selectedTemplateDeployments() {
      return buildSelectedTemplateDeployments(this.deployments, this.selectedTemplate);
    },
    selectedTemplateHistory() {
      return getTemplateHistoryEntries(this.governanceHistoryByTemplate, this.selectedTemplate?.ref || '');
    },
    currentPromotionBaseline() {
      if (!this.promotionTemplateRecord) return null;
      return this.resolvePromotionBaseline(this.promotionTemplateRecord);
    },
    promotionHistory() {
      return getTemplateHistoryEntries(this.governanceHistoryByTemplate, this.promotionTemplateRecord?.ref || '');
    },
    promotionDiffRows() {
      return buildTemplatePromotionDiffRows(
        this.promotionTemplateRecord,
        this.currentPromotionBaseline,
        this.governanceMap
      );
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
    templateStageCount(stage) {
      return countTemplatesByStage(this.normalizedTemplates, stage);
    },
    resolveDeploymentLabel(collection, ref, fallback) {
      return resolveTemplateDeploymentLabel(collection, ref, fallback);
    },
    async handleRestoreGovernanceHistory(payload) {
      if (!payload?.templateRef || !payload?.entry) return;
      await this.restoreGovernanceHistory(payload.templateRef, payload.entry);
    },
    async openProperties(row) {
      this.selectedTemplate = row;
      this.showProps = true;
      await this.loadTemplateHistory(row.ref);
    },
    async openTemplateCreate(kind) {
      this.templateCreateKind = kind === 'deployable' ? 'deployable' : 'operating-system';
      this.templateCreateError = '';
      try {
        const [sources, vms] = await Promise.all([api.getVmCreationSources(), api.getVMs()]);
        this.templateOperatingSystems = sources.operatingSystems || [];
        this.templateSourceVms = vms.data || [];
      } catch (error) {
        this.templateCreateError = error.message || 'Unable to load template creation sources';
      }
      this.showTemplateCreate = true;
    },
    async createTemplate(payload) {
      this.templateCreateSaving = true;
      this.templateCreateError = '';
      try {
        const template = await api.createVmTemplate(payload);
        await this.loadAll();
        this.showTemplateCreate = false;
        await this.openProperties(this.normalizedTemplates.find((entry) => entry.ref === template.ref) || template);
      } catch (error) {
        this.templateCreateError = error.message || 'Unable to create template';
      } finally {
        this.templateCreateSaving = false;
      }
    },
    findTemplateByFocus(focus) {
      return findTemplateByFocus(this.normalizedTemplates, focus);
    },
    openGovernance(template) {
      this.governanceTemplateRecord = template;
      this.governanceError = null;
      this.historyRestoreError = null;
      this.historyRestoreMessage = '';
      this.showGovernance = true;
    },
    openDeploy(template) {
      this.deployTemplateRecord = template;
      this.deployError = null;
      this.deploymentMessage = '';
      this.showDeploy = true;
    },
    async openPromotionReview(template) {
      this.promotionTemplateRecord = template;
      this.promotionError = null;
      this.historyRestoreError = null;
      this.historyRestoreMessage = '';
      const baseline = this.resolvePromotionBaseline(template);
      this.promotionDraft = buildTemplatePromotionDraft(template, baseline);
      this.showPromotionReview = true;
      await this.loadTemplateHistory(template.ref, true);
    },
    openDeploymentValidation(record) {
      this.selectedDeployment = record;
      this.deploymentValidationError = null;
      this.showDeploymentValidation = true;
    },
    canPromoteTemplate(template) {
      return canPromoteTemplateRecord(template, this.governanceMap);
    },
    resolvePromotionBaseline(template) {
      return resolveTemplatePromotionBaseline(template, this.normalizedTemplates, this.governanceMap);
    },
    templateDeploymentSummary(templateRef) {
      return buildTemplateDeploymentSummary(this.deployments, templateRef);
    },
    formatHistoryEvent(eventType) {
      return formatTemplateHistoryEvent(eventType);
    },
    async loadTemplateHistory(templateRef, force = false) {
      if (!templateRef) return;
      if (!force && this.governanceHistoryByTemplate[templateRef]) return;
      this.promotionHistoryLoading = true;
      try {
        const response = await api.getTemplateGovernanceHistory(templateRef);
        this.governanceHistoryByTemplate = {
          ...this.governanceHistoryByTemplate,
          [templateRef]: response.data || [],
        };
      } catch (_error) {
        this.governanceHistoryByTemplate = {
          ...this.governanceHistoryByTemplate,
          [templateRef]: [],
        };
      } finally {
        this.promotionHistoryLoading = false;
      }
    },
    async loadAll() {
      this.loading = true;
      try {
        const [templates, hosts, storage, networks, governance, deployments, creationSources] = await Promise.all([
          api.getTemplates(),
          api.getHosts().catch(() => ({ data: [] })),
          api.getSRs().catch(() => ({ data: [] })),
          api.getNetworks().catch(() => ({ data: [] })),
          api.getTemplateGovernance().catch(() => ({ data: [] })),
          api.getTemplateDeployments().catch(() => ({ data: [] })),
          api.getVmCreationSources().catch(() => ({ operatingSystems: [] })),
        ]);

        this.templates = templates.data || [];
        this.hosts = hosts.data || [];
        this.storage = storage.data || [];
        this.networks = networks.data || [];
        this.governanceRecords = governance.data || [];
        this.deployments = deployments.data || [];
        this.operatingSystemTemplateRefs = (creationSources.operatingSystems || []).map((source) => source.ref);
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
        await this.loadTemplateHistory(record.templateRef, true);
        this.historyRestoreError = null;
        this.historyRestoreMessage = '';
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
        this.deploymentMessage = buildTemplateDeploymentMessage(record, payload, this.hostOptions);
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
    async submitPromotion(payload) {
      if (!this.promotionTemplateRecord) return;

      this.promotionSaving = true;
      this.promotionError = null;
      try {
        const result = await api.promoteTemplateGovernance(this.promotionTemplateRecord.ref, payload);
        const nextMap = {
          [result.promoted.templateRef]: result.promoted,
          ...Object.fromEntries((result.deprecated || []).map((entry) => [entry.templateRef, entry])),
        };
        this.governanceRecords = this.governanceRecords
          .filter((entry) => !nextMap[entry.templateRef])
          .concat(Object.values(nextMap));
        this.governanceHistoryByTemplate = {
          ...this.governanceHistoryByTemplate,
          [this.promotionTemplateRecord.ref]: result.history || [],
        };
        await this.loadAll();
        this.historyRestoreError = null;
        this.historyRestoreMessage = '';
        this.showPromotionReview = false;
      } catch (error) {
        this.promotionError = error.message || 'Unable to promote template';
      } finally {
        this.promotionSaving = false;
      }
    },
    async restoreGovernanceHistory(templateRef, entry) {
      if (!templateRef || !entry?.id) return;

      this.historyRestoreLoadingId = entry.id;
      this.historyRestoreError = null;
      this.historyRestoreMessage = '';
      try {
        const result = await api.restoreTemplateGovernanceHistory(templateRef, entry.id);
        const record = result.record;
        this.governanceRecords = this.governanceRecords
          .filter((item) => item.templateRef !== record.templateRef)
          .concat(record);
        this.governanceHistoryByTemplate = {
          ...this.governanceHistoryByTemplate,
          [templateRef]: result.history || [],
        };
        if (this.selectedTemplate?.ref === templateRef) {
          this.selectedTemplate = { ...this.selectedTemplate };
        }
        if (this.promotionTemplateRecord?.ref === templateRef) {
          this.promotionTemplateRecord = { ...this.promotionTemplateRecord };
        }
        this.historyRestoreMessage = buildTemplateHistoryRestoreMessage(record, templateRef, entry);
      } catch (error) {
        this.historyRestoreError = error.message || 'Unable to restore template governance history';
      } finally {
        this.historyRestoreLoadingId = '';
      }
    },
  },
};
