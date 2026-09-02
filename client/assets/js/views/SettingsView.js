const SettingsView = {
  components: {
    DataTable,
    StatusBadge,
    SettingsWorkspaceDialogs,
    'system-config-section-form': SystemConfigSectionForm,
  },
  template: `
    <div class="animate-fade-in">
      <div v-if="loading" class="empty-state">
        <span class="loading-spinner"></span>
        <p style="margin-top:12px">Loading runtime configuration, telemetry posture, vault posture, and retention controls...</p>
      </div>

      <template v-else>
        <div class="section-head">
          <div>
            <h2 class="section-title">
              <span class="mdi mdi-tune-variant"></span>
              Settings
            </h2>
            <p class="section-subtitle">Centralized runtime configuration, telemetry collection, credential-vault management, proxy posture, logging defaults, and governed data-retention operations.</p>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn btn-primary"
                    :disabled="!dirtySectionCount || savingAll"
                    @click="saveAllSections">
              <span class="mdi" :class="savingAll ? 'mdi-loading mdi-spin' : 'mdi-content-save-all-outline'"></span>
              {{ savingAll ? 'Saving All...' : `Save All${dirtySectionCount ? ` (${dirtySectionCount})` : ''}` }}
            </button>
            <button class="btn" @click="openCredentialEditor()">
              <span class="mdi mdi-key-plus"></span>
              New Credential
            </button>
            <button class="btn" @click="previewRetention()">
              <span class="mdi mdi-magnify-scan"></span>
              Preview Sweep
            </button>
            <button class="btn btn-primary" @click="runRetention()">
              <span class="mdi mdi-broom"></span>
              Run Retention
            </button>
            <button class="btn btn-primary" @click="loadAll">
              <span class="mdi mdi-refresh"></span>
              Refresh
            </button>
          </div>
        </div>

        <div class="stack-item" v-if="dirtySectionCount" style="margin-bottom:16px">
          <div>
            <strong>{{ dirtySectionCount }} unsaved settings section{{ dirtySectionCount === 1 ? '' : 's' }}</strong>
            <div class="text-muted mono" style="font-size:11px">{{ dirtySectionLabels.join(' · ') }}</div>
          </div>
          <span class="badge badge-warning">pending</span>
        </div>

        <div class="dashboard-hero">
          <div>
            <div class="dash-card-label">Configuration Plane</div>
            <h3>Live control for session behavior, vault-backed Xen targets, proxy posture, logging defaults, and retention governance.</h3>
            <p>The Settings workspace turns runtime settings, persisted telemetry collection, and the encrypted credential vault into first-class management surfaces, with explicit key guidance, collector health, saved secret inventory, and one-click cleanup previews for historical data domains.</p>
          </div>
          <div class="dashboard-hero-rail">
            <button class="btn btn-primary" @click="$router.push('/governance')">
              <span class="mdi mdi-shield-account-outline"></span>
              Governance
            </button>
            <button class="btn" @click="$router.push('/pools')">
              <span class="mdi mdi-source-branch"></span>
              Pools
            </button>
            <button class="btn" @click="$router.push('/hosts')">
              <span class="mdi mdi-server"></span>
              Hosts
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
            <div class="dash-card-label">General</div>
            <system-config-section-form
              :initial-value="config.general"
              :fields="generalFields"
              :saving="savingSection === 'general' || savingAll"
              submit-label="Save General Settings"
              @submit="saveSection('general', $event)"
              @draft-change="updateSectionDraft('general', $event)">
            </system-config-section-form>
          </div>

          <div class="dash-card">
            <div class="dash-card-label">Network & URL</div>
            <system-config-section-form
              :initial-value="config.network"
              :fields="networkFields"
              :saving="savingSection === 'network' || savingAll"
              submit-label="Save Network Settings"
              @submit="saveSection('network', $event)"
              @draft-change="updateSectionDraft('network', $event)">
            </system-config-section-form>
          </div>
        </div>

        <div class="dashboard-panels">
          <div class="dash-card">
            <div class="dash-card-label">Security</div>
            <system-config-section-form
              :initial-value="config.security"
              :fields="securityFields"
              :saving="savingSection === 'security' || savingAll"
              submit-label="Save Security Settings"
              @submit="saveSection('security', $event)"
              @draft-change="updateSectionDraft('security', $event)">
            </system-config-section-form>
          </div>

          <div class="dash-card">
            <div class="dash-card-label">Logging</div>
            <system-config-section-form
              :initial-value="config.logging"
              :fields="loggingFields"
              :saving="savingSection === 'logging' || savingAll"
              submit-label="Save Logging Settings"
              @submit="saveSection('logging', $event)"
              @draft-change="updateSectionDraft('logging', $event)">
            </system-config-section-form>
          </div>
        </div>

        <div class="dashboard-panels">
          <div class="dash-card">
            <div class="dash-card-label">Operator Interaction</div>
            <system-config-section-form
              :initial-value="config.interaction"
              :fields="interactionFields"
              :saving="savingSection === 'interaction' || savingAll"
              submit-label="Save Interaction Settings"
              @submit="saveSection('interaction', $event)"
              @draft-change="updateSectionDraft('interaction', $event)">
            </system-config-section-form>
          </div>

          <div class="dash-card">
            <div class="dash-card-label">Undo Window</div>
            <div class="stack-item">
              <div>
                <strong>{{ config.interaction.undoDelaySeconds }} second{{ Number(config.interaction.undoDelaySeconds) === 1 ? '' : 's' }}</strong>
                <div class="text-muted" style="font-size:12px;margin-top:6px">Queued VM power operations can be cancelled before the request reaches XenServer.</div>
              </div>
              <span class="badge badge-info">live</span>
            </div>
          </div>
        </div>

        <div class="dashboard-panels">
          <div class="dash-card">
            <div class="dash-card-label">Telemetry Collection</div>
            <system-config-section-form
              :initial-value="config.performance"
              :fields="performanceFields"
              :saving="savingSection === 'performance' || savingAll"
              submit-label="Save Telemetry Settings"
              @submit="saveSection('performance', $event)"
              @draft-change="updateSectionDraft('performance', $event)">
            </system-config-section-form>
          </div>

          <div class="dash-card">
            <div class="dash-card-label">Collector Status</div>
            <div class="stack-list">
              <div class="stack-item">
                <div>
                  <strong>{{ collectorModeLabel }}</strong>
                  <div class="text-muted" style="font-size:12px;margin-top:6px">
                    {{ telemetryCollector.enabled
                        ? `Polling every ${formatSecondsLabel(telemetryCollector.intervalSeconds)} across live Xen targets while the server is running.`
                        : 'Background telemetry polling is disabled. History only refreshes when operators explicitly trigger metrics routes.' }}
                  </div>
                </div>
                <span class="badge" :class="collectorBadgeClass">{{ collectorBadgeLabel }}</span>
              </div>
              <div class="stack-item">
                <div>
                  <strong>Latest Collector Result</strong>
                  <div class="text-muted mono" style="font-size:11px;margin-top:6px">
                    {{ telemetryCollector.lastRunAt ? formatDateTime(telemetryCollector.lastRunAt) : 'No collector run has completed yet.' }}
                  </div>
                  <div class="text-muted" style="font-size:12px;margin-top:6px">
                    {{ collectorResultSummary }}
                  </div>
                </div>
                <span class="badge" :class="telemetryCollector.lastError ? 'badge-error' : 'badge-info'">
                  {{ telemetryCollector.lastError ? 'Error' : 'Summary' }}
                </span>
              </div>
            </div>

            <div class="detail-section" style="margin-top:16px">
              <div class="detail-section-title">Collector Runtime</div>
              <div class="property-grid">
                <span class="text-muted">Enabled</span><span>{{ telemetryCollector.enabled ? 'Yes' : 'No' }}</span>
                <span class="text-muted">Interval</span><span>{{ formatSecondsLabel(telemetryCollector.intervalSeconds) }}</span>
                <span class="text-muted">Targets Seen</span><span>{{ telemetryCollector.targetCount || 0 }}</span>
                <span class="text-muted">Runs Completed</span><span>{{ telemetryCollector.runCount || 0 }}</span>
                <span class="text-muted">Next Run</span><span>{{ telemetryCollector.nextRunAt ? formatDateTime(telemetryCollector.nextRunAt) : '-' }}</span>
                <span class="text-muted">Last Duration</span><span>{{ telemetryCollector.lastDurationMs ? `${telemetryCollector.lastDurationMs} ms` : '-' }}</span>
              </div>
              <div class="form-error" v-if="telemetryCollector.lastError" style="margin-top:12px;text-align:left">
                {{ telemetryCollector.lastError }}
              </div>
            </div>
          </div>
        </div>

        <div class="dashboard-panels">
          <div class="dash-card">
            <div class="dash-card-label">Retention Runtime</div>
            <system-config-section-form
              :initial-value="config.retention"
              :fields="retentionRuntimeFields"
              :saving="savingSection === 'retention' || savingAll"
              submit-label="Save Retention Runtime"
              @submit="saveSection('retention', $event)"
              @draft-change="updateSectionDraft('retention', $event)">
            </system-config-section-form>
          </div>

          <div class="dash-card">
            <div class="dash-card-label">Vault Posture</div>
            <div class="stack-list">
              <div class="stack-item" v-for="item in vaultGuidance" :key="item.title">
                <div>
                  <strong>{{ item.title }}</strong>
                  <div class="text-muted" style="font-size:12px;margin-top:6px">{{ item.detail }}</div>
                </div>
                <span class="badge" :class="item.badgeClass">{{ item.badge }}</span>
              </div>
            </div>

            <div class="detail-section" style="margin-top:16px">
              <div class="detail-section-title">Vault Runtime</div>
              <div class="property-grid">
                <span class="text-muted">Key Source</span><span>{{ formatVaultKeySource(vaultStatus.keySource) }}</span>
                <span class="text-muted">Development Fallback</span><span>{{ vaultStatus.usingDevelopmentFallback ? 'Enabled' : 'Disabled' }}</span>
                <span class="text-muted">Previous Key Loaded</span><span>{{ vaultStatus.hasPreviousMasterKey ? 'Yes' : 'No' }}</span>
                <span class="text-muted">Re-wrap Needed</span><span>{{ vaultStatus.staleCredentialCount || 0 }}</span>
                <span class="text-muted">Credential Count</span><span>{{ credentials.length }}</span>
                <span class="text-muted">Vault DB Path</span><span class="mono property-wrap">{{ vaultStatus.vaultDatabasePath || '-' }}</span>
                <span class="text-muted">Timezone</span><span>{{ config.general.timezone || '-' }}</span>
              </div>
              <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:14px">
                <button class="btn btn-sm"
                        @click="rewrapVaultCredentials"
                        :disabled="rewrapLoading || !vaultStatus.hasPreviousMasterKey || !Number(vaultStatus.staleCredentialCount || 0)">
                  <span class="mdi" :class="rewrapLoading ? 'mdi-loading mdi-spin' : 'mdi-key-sync'"></span>
                  {{ rewrapLoading ? 'Re-wrapping...' : 'Re-wrap Legacy Keys' }}
                </button>
                <div class="text-muted" style="font-size:12px;line-height:1.6">
                  Refresh any credential still wrapped by the previous master key without exposing plaintext secrets to the browser.
                </div>
              </div>
              <div class="form-error" v-if="vaultStatus.scanError" style="margin-top:12px;text-align:left">
                {{ vaultStatus.scanError }}
              </div>
              <div class="empty-state" v-if="vaultActionMessage" style="padding:12px 14px;margin-top:12px;text-align:left">
                {{ vaultActionMessage }}
              </div>
            </div>
          </div>
        </div>

        <div class="dashboard-panels">
          <div class="dash-card">
            <div class="dash-card-label">Saved Credentials</div>
            <div class="inventory-toolbar" style="margin-bottom:12px">
              <div class="text-muted" style="line-height:1.6">
                Create encrypted pool and host credentials once, then link them from the Pools and Hosts workspaces without returning secrets to the browser.
              </div>
              <div style="display:flex;gap:8px;flex-wrap:wrap">
                <button class="btn btn-sm" @click="loadCredentials" :disabled="credentialLoading">
                  <span class="mdi mdi-refresh"></span>
                  {{ credentialLoading ? 'Refreshing...' : 'Refresh Vault' }}
                </button>
                <button class="btn btn-sm"
                        @click="rewrapVaultCredentials"
                        :disabled="rewrapLoading || !vaultStatus.hasPreviousMasterKey || !Number(vaultStatus.staleCredentialCount || 0)">
                  <span class="mdi" :class="rewrapLoading ? 'mdi-loading mdi-spin' : 'mdi-key-sync'"></span>
                  {{ rewrapLoading ? 'Re-wrapping...' : 'Re-wrap Legacy Keys' }}
                </button>
                <button class="btn btn-primary btn-sm" @click="openCredentialEditor()">
                  <span class="mdi mdi-key-plus"></span>
                  Add Credential
                </button>
              </div>
            </div>

            <data-table
              v-if="credentials.length || credentialLoading"
              :columns="credentialColumns"
              :data="credentials"
              :loading="credentialLoading"
              :searchable="true"
              row-key="id"
              @row-click="openCredentialEditor">
              <template #cell-name="{ row }">
                <span style="color:var(--text-primary);font-weight:500">{{ row.name }}</span>
              </template>
              <template #cell-targetType="{ row }">
                <span class="badge" :class="row.targetType === 'host' ? 'badge-warning' : 'badge-info'">
                  {{ row.targetType === 'host' ? 'Host' : 'Pool' }}
                </span>
              </template>
              <template #cell-scope="{ row }">
                <span class="badge" :class="row.scope === 'shared' ? 'badge-success' : 'badge-info'">
                  {{ row.scope === 'shared' ? 'Shared' : 'Private' }}
                </span>
              </template>
              <template #cell-targetHint="{ row }">
                <span class="mono">{{ row.targetHint || '-' }}</span>
              </template>
              <template #cell-lastUsedAt="{ row }">
                <span class="mono">{{ row.lastUsedAt ? formatDateTime(row.lastUsedAt) : 'Never' }}</span>
              </template>
              <template #cell-updatedAt="{ row }">
                <span class="mono">{{ row.updatedAt ? formatDateTime(row.updatedAt) : formatDateTime(row.createdAt) }}</span>
              </template>
              <template #cell-actions="{ row }">
                <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end" @click.stop>
                  <button class="btn btn-sm" @click.stop="openCredentialEditor(row)">
                    <span class="mdi mdi-pencil-outline"></span>
                  </button>
                  <button class="btn btn-sm"
                          :disabled="credentialDeleteId === row.id"
                          @click.stop="removeCredential(row)">
                    <span class="mdi" :class="credentialDeleteId === row.id ? 'mdi-loading mdi-spin' : 'mdi-delete-outline'"></span>
                  </button>
                </div>
              </template>
            </data-table>
            <div v-else class="empty-state" style="padding:20px 12px">
              No saved vault credentials yet. Add one here, then bind it to a pool or host target from the operational workspaces.
            </div>
            <div class="form-error" v-if="credentialError" style="margin-top:12px">{{ credentialError }}</div>
          </div>

          <div class="dash-card">
            <div class="dash-card-label">Runtime Guidance</div>
            <div class="stack-list">
              <div class="stack-item" v-for="item in runtimeGuidance" :key="item.title">
                <div>
                  <strong>{{ item.title }}</strong>
                  <div class="text-muted" style="font-size:12px;margin-top:6px">{{ item.detail }}</div>
                </div>
                <span class="badge" :class="item.badgeClass">{{ item.badge }}</span>
              </div>
            </div>
            <div class="detail-section" style="margin-top:16px">
              <div class="detail-section-title">Current Runtime</div>
              <div class="property-grid">
                <span class="text-muted">Environment</span><span>{{ runtime.env || '-' }}</span>
                <span class="text-muted">Port</span><span class="mono">{{ runtime.port || '-' }}</span>
                <span class="text-muted">Timezone</span><span>{{ config.general.timezone || '-' }}</span>
                <span class="text-muted">Sweep Interval</span><span>{{ config.retention.sweepIntervalHours || 24 }} hour(s)</span>
                <span class="text-muted">Collector Interval</span><span>{{ formatSecondsLabel(config.performance.collectionIntervalSeconds || 60) }}</span>
                <span class="text-muted">Collector State</span><span>{{ collectorModeLabel }}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="dashboard-panels">
          <div class="dash-card">
            <div class="dash-card-label">Retention Policies</div>
            <div class="stack-list" v-if="retentionPolicies.length">
              <button class="stack-item stack-item-button"
                      v-for="policy in retentionPolicies"
                      :key="policy.domain"
                      @click="openPolicyEditor(policy)">
                <div>
                  <strong>{{ policy.label }}</strong>
                  <div class="text-muted mono" style="font-size:11px">
                    {{ policy.retentionDays }} day window · {{ policy.enabled ? 'enabled' : 'disabled' }}
                  </div>
                  <div class="text-muted" style="font-size:12px;margin-top:6px">{{ policy.description }}</div>
                  <div class="text-muted mono" style="font-size:11px;margin-top:4px">
                    Last run {{ policy.lastRunAt ? formatDateTime(policy.lastRunAt) : 'never' }} · Last purge {{ policy.lastPurgedCount || 0 }}
                  </div>
                </div>
                <status-badge :status="policy.enabled ? 'info' : 'warning'"></status-badge>
              </button>
            </div>
            <div v-else class="empty-state" style="padding:20px 12px">No retention policies are defined yet.</div>
          </div>

          <div class="dash-card">
            <div class="dash-card-label">Latest Preview</div>
            <div class="stack-list" v-if="retentionPreview.results && retentionPreview.results.length">
              <div class="stack-item" v-for="result in retentionPreview.results" :key="result.domain">
                <div>
                  <strong>{{ result.label || formatDomainLabel(result.domain) }}</strong>
                  <div class="text-muted mono" style="font-size:11px">Cutoff {{ formatDateTime(result.cutoffDate) }}</div>
                  <div class="text-muted" style="font-size:12px;margin-top:6px">{{ result.candidateCount || 0 }} record(s) would be purged.</div>
                </div>
                <span class="badge" :class="result.candidateCount ? 'badge-warning' : 'badge-success'">
                  {{ result.candidateCount ? 'Pending' : 'Clean' }}
                </span>
              </div>
            </div>
            <div v-else class="empty-state" style="padding:20px 12px">Run a retention preview to see what historical data is eligible for cleanup.</div>
          </div>
        </div>

        <div class="form-error" v-if="pageError" style="margin-top:16px">{{ pageError }}</div>
      </template>

      <settings-workspace-dialogs
        :show-policy-editor="showPolicyEditor"
        :selected-policy="selectedPolicy"
        :policy-saving="policySaving"
        :preview-loading="previewLoading"
        :run-loading="runLoading"
        :show-credential-editor="showCredentialEditor"
        :editing-credential-id="editingCredentialId"
        :credential-draft="credentialDraft"
        :credential-saving="credentialSaving"
        :credential-delete-id="credentialDeleteId"
        @close-policy-editor="closePolicyEditor"
        @save-policy="savePolicy"
        @preview-retention="previewRetention"
        @run-retention="runRetention"
        @close-credential-editor="closeCredentialEditor"
        @save-credential="saveCredential"
        @remove-credential="removeCredential">
      </settings-workspace-dialogs>
    </div>
  `,
  data() {
    return {
      loading: true,
      savingSection: '',
      savingAll: false,
      sectionDrafts: {},
      policySaving: false,
      previewLoading: false,
      runLoading: false,
      credentialLoading: false,
      credentialSaving: false,
      credentialDeleteId: null,
      rewrapLoading: false,
      pageError: '',
      credentialError: '',
      vaultActionMessage: '',
      config: {
        general: { appName: 'XenMange', timezone: 'UTC' },
        network: { publicBaseUrl: '', trustProxy: false },
        security: { sessionMaxAgeMs: 86400000, failedLoginWindowMinutes: 15, failedLoginMaxAttempts: 20 },
        logging: { level: 'info', structuredJson: false },
        performance: { collectionEnabled: true, collectionIntervalSeconds: 60 },
        interaction: { undoDelaySeconds: 5 },
        retention: { sweepIntervalHours: 24, vacuumAfterSweep: true },
      },
      runtime: {
        env: '',
        port: '',
        restartRequiredSettings: [],
        liveAppliedSettings: [],
        metricsCollector: {
          enabled: true,
          intervalSeconds: 60,
          active: false,
          inFlight: false,
          targetCount: 0,
          runCount: 0,
          lastRunAt: '',
          lastDurationMs: 0,
          nextRunAt: '',
          lastError: '',
          lastResult: null,
        },
      },
      vaultStatus: {
        hasConfiguredMasterKey: false,
        usingDevelopmentFallback: false,
        hasPreviousMasterKey: false,
        rotationRecommended: false,
        keySource: '',
        vaultDatabasePath: '',
        totalCredentialCount: 0,
        staleCredentialCount: 0,
        rewrapAvailable: false,
        scanAvailable: false,
        scanError: '',
      },
      credentials: [],
      retentionPolicies: [],
      retentionPreview: {
        generatedAt: '',
        results: [],
      },
      showPolicyEditor: false,
      selectedPolicy: null,
      showCredentialEditor: false,
      editingCredentialId: null,
      credentialDraft: null,
      credentialColumns: [
        { key: 'name', label: 'Name' },
        { key: 'targetType', label: 'Target' },
        { key: 'scope', label: 'Scope' },
        { key: 'username', label: 'Username' },
        { key: 'targetHint', label: 'Hint' },
        { key: 'lastUsedAt', label: 'Last Used' },
        { key: 'updatedAt', label: 'Updated' },
        { key: 'actions', label: 'Actions' },
      ],
    };
  },
  computed: {
    generalFields() {
      return getSettingsGeneralFields();
    },
    networkFields() {
      return getSettingsNetworkFields();
    },
    securityFields() {
      return getSettingsSecurityFields();
    },
    loggingFields() {
      return getSettingsLoggingFields();
    },
    performanceFields() {
      return getSettingsPerformanceFields();
    },
    interactionFields() {
      return getSettingsInteractionFields();
    },
    retentionRuntimeFields() {
      return getSettingsRetentionRuntimeFields();
    },
    telemetryCollector() {
      return buildSettingsTelemetryCollector(this.runtime);
    },
    collectorModeLabel() {
      return getSettingsCollectorModeLabel(this.telemetryCollector);
    },
    collectorBadgeLabel() {
      return getSettingsCollectorBadgeLabel(this.telemetryCollector);
    },
    collectorBadgeClass() {
      return getSettingsCollectorBadgeClass(this.telemetryCollector);
    },
    collectorResultSummary() {
      return getSettingsCollectorResultSummary(this.telemetryCollector);
    },
    summaryCards() {
      return buildSettingsSummaryCards({
        config: this.config,
        retentionPolicies: this.retentionPolicies,
        retentionPreview: this.retentionPreview,
        credentials: this.credentials,
        vaultStatus: this.vaultStatus,
        telemetryCollector: this.telemetryCollector,
        formatSecondsLabel: this.formatSecondsLabel,
      });
    },
    runtimeGuidance() {
      return buildSettingsRuntimeGuidance(
        this.runtime,
        this.telemetryCollector,
        this.collectorBadgeLabel,
        this.collectorBadgeClass,
        this.formatSecondsLabel
      );
    },
    vaultGuidance() {
      return buildSettingsVaultGuidance(this.vaultStatus);
    },
    dirtySectionKeys() {
      return Object.keys(this.sectionDrafts);
    },
    dirtySectionCount() {
      return this.dirtySectionKeys.length;
    },
    dirtySectionLabels() {
      const labels = {
        general: 'General',
        network: 'Network & URL',
        security: 'Security',
        logging: 'Logging',
        performance: 'Telemetry Collection',
        interaction: 'Operator Interaction',
        retention: 'Retention Runtime',
      };
      return this.dirtySectionKeys.map((section) => labels[section] || section);
    },
  },
  mounted() {
    this.loadAll();
  },
  methods: {
    async loadAll() {
      this.loading = true;
      this.pageError = '';
      this.vaultActionMessage = '';

      try {
        await Promise.all([this.loadSettings(), this.loadCredentials()]);
      } finally {
        this.loading = false;
      }
    },
    async loadSettings() {
      try {
        const response = await api.getSystemConfig();
        this.config = {
          general: response.general || this.config.general,
          network: response.network || this.config.network,
          security: response.security || this.config.security,
          logging: response.logging || this.config.logging,
          performance: response.performance || this.config.performance,
          interaction: response.interaction || this.config.interaction,
          retention: response.retention || this.config.retention,
        };
        this.runtime = response.runtime || this.runtime;
        this.vaultStatus = response.vault || this.vaultStatus;
        this.retentionPolicies = Array.isArray(response.retentionPolicies) ? response.retentionPolicies : [];
      } catch (error) {
        this.pageError = error.message || 'Failed to load settings.';
      }
    },
    async loadCredentials() {
      this.credentialLoading = true;
      this.credentialError = '';

      try {
        const response = await api.getCredentials();
        this.credentials = Array.isArray(response.data) ? response.data : [];
      } catch (error) {
        this.credentials = [];
        this.credentialError = error.message || 'Failed to load vault credentials.';
      } finally {
        this.credentialLoading = false;
      }
    },
    async saveSection(section, payload) {
      this.savingSection = section;
      this.pageError = '';

      try {
        const response = await api.saveSystemConfigSection(section, payload);
        this.config[section] = response.section || this.config[section];
        if (section === 'interaction') applyUndoDelaySeconds(this.config.interaction.undoDelaySeconds);
        this.runtime = response.runtime || this.runtime;
        this.retentionPolicies = Array.isArray(response.retentionPolicies) ? response.retentionPolicies : this.retentionPolicies;
        this.clearSectionDraft(section);
      } catch (error) {
        this.pageError = error.message || 'Failed to save settings.';
      } finally {
        this.savingSection = '';
      }
    },
    updateSectionDraft(section, payload) {
      if (this.isSectionDraftDirty(section, payload)) {
        this.sectionDrafts = { ...this.sectionDrafts, [section]: payload };
        return;
      }
      this.clearSectionDraft(section);
    },
    isSectionDraftDirty(section, payload) {
      const current = this.config[section] || {};
      return Object.entries(payload || {}).some(([key, value]) => current[key] !== value);
    },
    clearSectionDraft(section) {
      if (!Object.prototype.hasOwnProperty.call(this.sectionDrafts, section)) return;
      const { [section]: _discarded, ...remainingDrafts } = this.sectionDrafts;
      this.sectionDrafts = remainingDrafts;
    },
    async saveAllSections() {
      const pendingEntries = Object.entries(this.sectionDrafts);
      if (!pendingEntries.length) return;

      this.savingAll = true;
      this.pageError = '';
      try {
        for (const [section, payload] of pendingEntries) {
          const response = await api.saveSystemConfigSection(section, payload);
          this.config[section] = response.section || this.config[section];
          if (section === 'interaction') applyUndoDelaySeconds(this.config.interaction.undoDelaySeconds);
          this.runtime = response.runtime || this.runtime;
          this.retentionPolicies = Array.isArray(response.retentionPolicies) ? response.retentionPolicies : this.retentionPolicies;
          this.clearSectionDraft(section);
        }
      } catch (error) {
        this.pageError = error.message || 'Failed to save all pending settings.';
      } finally {
        this.savingAll = false;
      }
    },
    openPolicyEditor(policy) {
      this.selectedPolicy = { ...policy };
      this.showPolicyEditor = true;
    },
    closePolicyEditor() {
      this.showPolicyEditor = false;
      this.selectedPolicy = null;
    },
    async savePolicy(payload) {
      if (!this.selectedPolicy) return;

      this.policySaving = true;
      this.pageError = '';

      try {
        const response = await api.saveRetentionPolicy(this.selectedPolicy.domain, payload);
        this.retentionPolicies = this.retentionPolicies.map((policy) =>
          policy.domain === response.domain ? response : policy
        );
        this.selectedPolicy = { ...response };
      } catch (error) {
        this.pageError = error.message || 'Failed to save the retention policy.';
      } finally {
        this.policySaving = false;
      }
    },
    async previewRetention(domain = '') {
      this.previewLoading = true;
      this.pageError = '';

      try {
        this.retentionPreview = await api.previewRetentionSweep(domain);
      } catch (error) {
        this.pageError = error.message || 'Failed to preview retention sweep.';
      } finally {
        this.previewLoading = false;
      }
    },
    async runRetention(domain = '') {
      this.runLoading = true;
      this.pageError = '';

      try {
        const entityRef = domain || 'all';
        const entityName = domain ? this.formatDomainLabel(domain) : 'All Retention Domains';
        const approvalId = await resolveGovernanceApproval({
          actionKey: 'retention_sweep_run',
          entityType: 'retention-domain',
          entityRef,
          entityName,
          route: '/settings',
        });
        const result = await api.runRetentionSweep({
          domain,
          dryRun: false,
          ...(approvalId ? { approvalId } : {}),
        });
        this.retentionPreview = {
          generatedAt: result.generatedAt,
          results: result.results.map((entry) => ({
            ...entry,
            candidateCount: 0,
          })),
        };
        await this.loadSettings();
      } catch (error) {
        if (error.code === 'APPROVAL_REQUIRED') {
          this.pageError = 'Governance approval is required before running retention cleanup.';
          await handoffToGovernanceApproval(
            this.$router,
            error.approvalDraft,
            'Approval required before running retention cleanup.'
          );
          return;
        }
        this.pageError = error.message || 'Failed to run retention sweep.';
      } finally {
        this.runLoading = false;
      }
    },
    openCredentialEditor(credential = null) {
      this.credentialError = '';
      this.editingCredentialId = credential?.id || null;
      this.credentialDraft = buildSettingsCredentialDraft(credential);
      this.showCredentialEditor = true;
    },
    closeCredentialEditor() {
      this.showCredentialEditor = false;
      this.editingCredentialId = null;
      this.credentialDraft = null;
    },
    async saveCredential(payload) {
      this.credentialSaving = true;
      this.credentialError = '';

      try {
        if (this.editingCredentialId) {
          const updated = await api.updateCredential(this.editingCredentialId, payload);
          this.credentials = this.credentials.map((credential) =>
            credential.id === updated.id ? updated : credential
          );
          this.credentialDraft = { ...updated };
        } else {
          const created = await api.createCredential(payload);
          this.credentials = [created, ...this.credentials];
          this.closeCredentialEditor();
        }

        await this.loadSettings();
      } catch (error) {
        this.credentialError = error.message || 'Failed to save the vault credential.';
      } finally {
        this.credentialSaving = false;
      }
    },
    async removeCredential(credential) {
      const targetId = Number(credential?.id || 0);
      if (!targetId) return;

      this.credentialDeleteId = targetId;
      this.credentialError = '';

      try {
        const approvalId = await resolveGovernanceApproval({
          actionKey: 'credential_delete',
          entityType: 'credential',
          entityRef: String(targetId),
          entityName: credential?.name || `Credential ${targetId}`,
          route: '/settings',
        });
        await api.deleteCredential(targetId, approvalId ? { approvalId } : null);
        this.credentials = this.credentials.filter((entry) => Number(entry.id) !== targetId);
        if (Number(this.editingCredentialId) === targetId) {
          this.closeCredentialEditor();
        }
        await this.loadSettings();
      } catch (error) {
        if (error.code === 'APPROVAL_REQUIRED') {
          this.credentialError = 'Governance approval is required before deleting this vault credential.';
          await handoffToGovernanceApproval(
            this.$router,
            error.approvalDraft,
            'Approval required before deleting this vault credential.'
          );
          return;
        }
        this.credentialError = error.message || 'Failed to delete the vault credential.';
      } finally {
        this.credentialDeleteId = null;
      }
    },
    async rewrapVaultCredentials() {
      this.rewrapLoading = true;
      this.pageError = '';
      this.credentialError = '';
      this.vaultActionMessage = '';

      try {
        const response = await api.rewrapVaultCredentials();
        this.vaultStatus = response.vault || this.vaultStatus;
        const result = response.result || {};
        this.vaultActionMessage = `${result.rewrapped || 0} stale credential wrap(s) were re-wrapped under the current master key. ${result.alreadyCurrent || 0} credential(s) were already current.`;
        await this.loadCredentials();
      } catch (error) {
        this.credentialError = error.message || 'Failed to re-wrap legacy vault credentials.';
      } finally {
        this.rewrapLoading = false;
      }
    },
    formatDateTime(value) {
      return formatDateTime(value);
    },
    formatSecondsLabel(value) {
      const seconds = Math.max(0, Number(value || 0));
      if (!seconds) return '0 seconds';
      return `${seconds} second(s)`;
    },
    formatDomainLabel(domain) {
      return resolveSettingsDomainLabel(domain, this.retentionPolicies);
    },
    formatVaultKeySource(value) {
      return formatSettingsVaultKeySource(value);
    },
  },
};
