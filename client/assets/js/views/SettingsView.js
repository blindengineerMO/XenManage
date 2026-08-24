const SettingsView = {
  components: {
    DataTable,
    FloatingWindow,
    StatusBadge,
    CredentialVaultForm,
    'system-config-section-form': SystemConfigSectionForm,
    'retention-policy-form': RetentionPolicyForm,
  },
  template: `
    <div class="animate-fade-in">
      <div v-if="loading" class="empty-state">
        <span class="loading-spinner"></span>
        <p style="margin-top:12px">Loading runtime configuration, vault posture, and retention controls...</p>
      </div>

      <template v-else>
        <div class="section-head">
          <div>
            <h2 class="section-title">
              <span class="mdi mdi-tune-variant"></span>
              Settings
            </h2>
            <p class="section-subtitle">Centralized runtime configuration, credential-vault management, proxy posture, logging defaults, and governed data-retention operations.</p>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
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

        <div class="dashboard-hero">
          <div>
            <div class="dash-card-label">Configuration Plane</div>
            <h3>Live control for session behavior, vault-backed Xen targets, proxy posture, logging defaults, and retention governance.</h3>
            <p>The Settings workspace turns runtime settings and the encrypted credential vault into first-class management surfaces, with explicit key guidance, saved secret inventory, and one-click cleanup previews for historical data domains.</p>
          </div>
          <div class="dashboard-hero-rail">
            <button class="btn btn-primary" @click="$router.push('/governance')">
              <span class="mdi mdi-shield-account-outline"></span>
              Governance
            </button>
            <button class="btn" @click="$router.push('/pools')">
              <span class="mdi mdi-cluster"></span>
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
              :saving="savingSection === 'general'"
              submit-label="Save General Settings"
              @submit="saveSection('general', $event)">
            </system-config-section-form>
          </div>

          <div class="dash-card">
            <div class="dash-card-label">Network & URL</div>
            <system-config-section-form
              :initial-value="config.network"
              :fields="networkFields"
              :saving="savingSection === 'network'"
              submit-label="Save Network Settings"
              @submit="saveSection('network', $event)">
            </system-config-section-form>
          </div>
        </div>

        <div class="dashboard-panels">
          <div class="dash-card">
            <div class="dash-card-label">Security</div>
            <system-config-section-form
              :initial-value="config.security"
              :fields="securityFields"
              :saving="savingSection === 'security'"
              submit-label="Save Security Settings"
              @submit="saveSection('security', $event)">
            </system-config-section-form>
          </div>

          <div class="dash-card">
            <div class="dash-card-label">Logging</div>
            <system-config-section-form
              :initial-value="config.logging"
              :fields="loggingFields"
              :saving="savingSection === 'logging'"
              submit-label="Save Logging Settings"
              @submit="saveSection('logging', $event)">
            </system-config-section-form>
          </div>
        </div>

        <div class="dashboard-panels">
          <div class="dash-card">
            <div class="dash-card-label">Retention Runtime</div>
            <system-config-section-form
              :initial-value="config.retention"
              :fields="retentionRuntimeFields"
              :saving="savingSection === 'retention'"
              submit-label="Save Retention Runtime"
              @submit="saveSection('retention', $event)">
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
                <span class="text-muted">Credential Count</span><span>{{ credentials.length }}</span>
                <span class="text-muted">Vault DB Path</span><span class="mono property-wrap">{{ vaultStatus.vaultDatabasePath || '-' }}</span>
                <span class="text-muted">Timezone</span><span>{{ config.general.timezone || '-' }}</span>
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

      <floating-window :show="showPolicyEditor"
                       title="Retention Policy"
                       :width="720"
                       :height="500"
                       @close="closePolicyEditor">
        <div v-if="selectedPolicy">
          <div class="detail-section">
            <div class="detail-section-title">{{ selectedPolicy.label }}</div>
            <div class="capacity-callout">
              <strong>{{ selectedPolicy.description }}</strong>
              <div class="text-muted mono" style="font-size:11px;margin-top:8px">
                Domain key {{ selectedPolicy.domain }} · Last run {{ selectedPolicy.lastRunAt ? formatDateTime(selectedPolicy.lastRunAt) : 'never' }}
              </div>
            </div>
          </div>

          <retention-policy-form
            :initial-value="selectedPolicy"
            :saving="policySaving"
            submit-label="Save Retention Policy"
            @submit="savePolicy">
          </retention-policy-form>

          <div class="form-actions" style="margin-top:12px">
            <button class="btn" :disabled="previewLoading" @click="previewRetention(selectedPolicy.domain)">
              <span class="mdi mdi-magnify-scan"></span>
              Preview This Domain
            </button>
            <button class="btn btn-primary" :disabled="runLoading" @click="runRetention(selectedPolicy.domain)">
              <span class="mdi mdi-broom"></span>
              Run This Domain
            </button>
          </div>
        </div>
      </floating-window>

      <floating-window :show="showCredentialEditor"
                       :title="editingCredentialId ? 'Edit Vault Credential' : 'Add Vault Credential'"
                       :width="620"
                       :height="520"
                       @close="closeCredentialEditor">
        <div>
          <div class="detail-section" v-if="editingCredentialId">
            <div class="detail-section-title">Credential Activity</div>
            <div class="property-grid">
              <span class="text-muted">Last Used</span><span>{{ credentialDraft?.lastUsedAt ? formatDateTime(credentialDraft.lastUsedAt) : 'Never' }}</span>
              <span class="text-muted">Updated</span><span>{{ credentialDraft?.updatedAt ? formatDateTime(credentialDraft.updatedAt) : formatDateTime(credentialDraft?.createdAt) }}</span>
              <span class="text-muted">Scope</span><span>{{ credentialDraft?.scope === 'shared' ? 'Shared' : 'Private' }}</span>
              <span class="text-muted">Target Type</span><span>{{ credentialDraft?.targetType === 'host' ? 'Host' : 'Pool' }}</span>
            </div>
          </div>

          <credential-vault-form
            :initial-value="credentialDraft"
            :saving="credentialSaving"
            :mode="editingCredentialId ? 'edit' : 'create'"
            :submit-label="editingCredentialId ? 'Save Credential Changes' : 'Save Vault Credential'"
            @submit="saveCredential">
          </credential-vault-form>

          <div class="form-actions" v-if="editingCredentialId" style="margin-top:12px">
            <button class="btn"
                    :disabled="credentialDeleteId === editingCredentialId"
                    @click="removeCredential(credentialDraft)">
              <span class="mdi" :class="credentialDeleteId === editingCredentialId ? 'mdi-loading mdi-spin' : 'mdi-delete-outline'"></span>
              {{ credentialDeleteId === editingCredentialId ? 'Removing...' : 'Delete Credential' }}
            </button>
          </div>
        </div>
      </floating-window>
    </div>
  `,
  data() {
    return {
      loading: true,
      savingSection: '',
      policySaving: false,
      previewLoading: false,
      runLoading: false,
      credentialLoading: false,
      credentialSaving: false,
      credentialDeleteId: null,
      pageError: '',
      credentialError: '',
      config: {
        general: { appName: 'XenMange', timezone: 'UTC' },
        network: { publicBaseUrl: '', trustProxy: false },
        security: { sessionMaxAgeMs: 86400000, failedLoginWindowMinutes: 15, failedLoginMaxAttempts: 20 },
        logging: { level: 'info', structuredJson: false },
        retention: { sweepIntervalHours: 24, vacuumAfterSweep: true },
      },
      runtime: {
        env: '',
        port: '',
        restartRequiredSettings: [],
        liveAppliedSettings: [],
      },
      vaultStatus: {
        hasConfiguredMasterKey: false,
        usingDevelopmentFallback: false,
        hasPreviousMasterKey: false,
        rotationRecommended: false,
        keySource: '',
        vaultDatabasePath: '',
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
      return [
        { key: 'appName', label: 'Application Name', type: 'text', placeholder: 'XenMange' },
        { key: 'timezone', label: 'Timezone', type: 'text', placeholder: 'America/Chicago', help: 'Used for consistent timestamp rendering throughout the control plane.' },
      ];
    },
    networkFields() {
      return [
        { key: 'publicBaseUrl', label: 'Public Base URL', type: 'text', placeholder: 'https://xenmange.example.com', help: 'Set this when the app is served behind Traefik, Nginx, or another reverse proxy.' },
        { key: 'trustProxy', label: 'Trust reverse-proxy headers', type: 'checkbox', help: 'Applies live to Express so forwarded host and protocol headers are honored immediately.' },
      ];
    },
    securityFields() {
      return [
        { key: 'sessionMaxAgeMs', label: 'Session Timeout (ms)', type: 'number', min: 60000, max: 2592000000, help: 'Applies live to the session cookie lifetime for active and new sessions.' },
        { key: 'failedLoginWindowMinutes', label: 'Failed Login Window (minutes)', type: 'number', min: 1, max: 1440, help: 'Captured for lockout policy planning; current login throttling consumes this after a process restart.' },
        { key: 'failedLoginMaxAttempts', label: 'Max Failed Logins', type: 'number', min: 1, max: 100, help: 'Captured for auth policy enforcement and reported in runtime guidance.' },
      ];
    },
    loggingFields() {
      return [
        {
          key: 'level',
          label: 'Log Level',
          type: 'select',
          options: [
            { value: 'trace', label: 'Trace' },
            { value: 'debug', label: 'Debug' },
            { value: 'info', label: 'Info' },
            { value: 'warn', label: 'Warn' },
            { value: 'error', label: 'Error' },
          ],
          help: 'Stored centrally for logger wiring and operator reference.',
        },
        { key: 'structuredJson', label: 'Prefer structured JSON logs', type: 'checkbox', help: 'Useful when shipping logs into external aggregation later.' },
      ];
    },
    retentionRuntimeFields() {
      return [
        { key: 'sweepIntervalHours', label: 'Scheduled Sweep Interval (hours)', type: 'number', min: 1, max: 168, help: 'Changing this restarts the in-process retention scheduler immediately.' },
        { key: 'vacuumAfterSweep', label: 'Vacuum databases after retention runs', type: 'checkbox', help: 'Helps reclaim SQLite disk space after purge operations.' },
      ];
    },
    summaryCards() {
      const enabledPolicies = this.retentionPolicies.filter((policy) => policy.enabled).length;
      const liveAppliedCount = (this.runtime.liveAppliedSettings || []).length;
      const restartRequiredCount = (this.runtime.restartRequiredSettings || []).length;
      const totalPreview = (this.retentionPreview.results || []).reduce((sum, result) => sum + Number(result.candidateCount || 0), 0);
      const sharedCredentials = this.credentials.filter((credential) => credential.scope === 'shared').length;
      const hostCredentials = this.credentials.filter((credential) => credential.targetType === 'host').length;

      return [
        {
          key: 'app',
          label: 'App Identity',
          value: this.config.general.appName || 'XenMange',
          icon: 'mdi-application-cog-outline',
          detail: `Timezone ${this.config.general.timezone || 'UTC'}`,
        },
        {
          key: 'session',
          label: 'Session Timeout',
          value: `${Math.round(Number(this.config.security.sessionMaxAgeMs || 0) / 60000)}m`,
          icon: 'mdi-timer-sand',
          detail: `${this.config.security.failedLoginMaxAttempts || 0} failed attempts within ${this.config.security.failedLoginWindowMinutes || 0} minutes`,
        },
        {
          key: 'vault',
          label: 'Vault Inventory',
          value: `${this.credentials.length}`,
          icon: 'mdi-key-wireless',
          detail: `${sharedCredentials} shared · ${hostCredentials} host credential(s)`,
        },
        {
          key: 'retention',
          label: 'Active Policies',
          value: `${enabledPolicies}/${this.retentionPolicies.length || 0}`,
          icon: 'mdi-broom',
          detail: `${totalPreview} record(s) currently eligible in the latest preview`,
        },
        {
          key: 'runtime',
          label: 'Live vs Restart',
          value: `${liveAppliedCount}/${liveAppliedCount + restartRequiredCount || 1}`,
          icon: 'mdi-lightning-bolt-outline',
          detail: `${restartRequiredCount} setting(s) still require a restart-sensitive path`,
        },
      ];
    },
    runtimeGuidance() {
      return [
        {
          title: 'Live-Applied Settings',
          detail: (this.runtime.liveAppliedSettings || []).join(', ') || 'No live-applied settings reported.',
          badge: 'Live',
          badgeClass: 'badge-success',
        },
        {
          title: 'Restart-Sensitive Settings',
          detail: (this.runtime.restartRequiredSettings || []).join(', ') || 'No restart-sensitive settings reported.',
          badge: 'Restart',
          badgeClass: 'badge-warning',
        },
        {
          title: 'Proxy Guidance',
          detail: 'Use Public Base URL plus Trust Proxy together when XenMange sits behind Traefik, Nginx, or a cloud load balancer.',
          badge: 'Guide',
          badgeClass: 'badge-info',
        },
      ];
    },
    vaultGuidance() {
      return [
        {
          title: 'Master Key Source',
          detail: this.vaultStatus.usingDevelopmentFallback
            ? 'Vault secrets currently rely on a development-only derived key because VAULT_ENCRYPTION_KEY is not configured.'
            : (this.vaultStatus.hasConfiguredMasterKey
              ? 'VAULT_ENCRYPTION_KEY is loaded from the environment, so vault secret wrapping is explicitly configured.'
              : 'No vault master key is configured. Production deployments should fail fast until one is supplied.'),
          badge: this.vaultStatus.usingDevelopmentFallback ? 'Dev Only' : (this.vaultStatus.hasConfiguredMasterKey ? 'Ready' : 'Missing'),
          badgeClass: this.vaultStatus.usingDevelopmentFallback ? 'badge-warning' : (this.vaultStatus.hasConfiguredMasterKey ? 'badge-success' : 'badge-error'),
        },
        {
          title: 'Rotation Posture',
          detail: this.vaultStatus.hasPreviousMasterKey
            ? 'A previous vault master key is loaded, so legacy wrapped DEKs can still be decrypted during rotation.'
            : 'No previous vault master key is loaded. Set VAULT_ENCRYPTION_KEY_PREVIOUS during a staged key rotation window.',
          badge: this.vaultStatus.hasPreviousMasterKey ? 'Rotation Window' : 'Single Key',
          badgeClass: this.vaultStatus.hasPreviousMasterKey ? 'badge-info' : 'badge-warning',
        },
        {
          title: 'Secret Handling',
          detail: 'Passwords remain encrypted in vault.db and are only decrypted server-side when opening a live Xen pool or host target.',
          badge: 'Server Only',
          badgeClass: 'badge-success',
        },
      ];
    },
  },
  mounted() {
    this.loadAll();
  },
  methods: {
    async loadAll() {
      this.loading = true;
      this.pageError = '';

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
        this.runtime = response.runtime || this.runtime;
        this.retentionPolicies = Array.isArray(response.retentionPolicies) ? response.retentionPolicies : this.retentionPolicies;
      } catch (error) {
        this.pageError = error.message || 'Failed to save settings.';
      } finally {
        this.savingSection = '';
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
        const result = await api.runRetentionSweep({ domain, dryRun: false });
        this.retentionPreview = {
          generatedAt: result.generatedAt,
          results: result.results.map((entry) => ({
            ...entry,
            candidateCount: 0,
          })),
        };
        await this.loadSettings();
      } catch (error) {
        this.pageError = error.message || 'Failed to run retention sweep.';
      } finally {
        this.runLoading = false;
      }
    },
    openCredentialEditor(credential = null) {
      this.credentialError = '';
      this.editingCredentialId = credential?.id || null;
      this.credentialDraft = credential ? { ...credential } : {
        name: '',
        scope: 'private',
        targetType: 'pool',
        targetHint: '',
        username: 'root',
      };
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
        await api.deleteCredential(targetId);
        this.credentials = this.credentials.filter((entry) => Number(entry.id) !== targetId);
        if (Number(this.editingCredentialId) === targetId) {
          this.closeCredentialEditor();
        }
        await this.loadSettings();
      } catch (error) {
        this.credentialError = error.message || 'Failed to delete the vault credential.';
      } finally {
        this.credentialDeleteId = null;
      }
    },
    formatDateTime(value) {
      return formatDateTime(value);
    },
    formatDomainLabel(domain) {
      const policy = this.retentionPolicies.find((entry) => entry.domain === domain);
      return policy?.label || domain;
    },
    formatVaultKeySource(value) {
      if (value === 'environment') return 'Environment Variable';
      if (value === 'derived-development') return 'Derived Development Key';
      if (value === 'missing') return 'Missing';
      return value || '-';
    },
  },
};
