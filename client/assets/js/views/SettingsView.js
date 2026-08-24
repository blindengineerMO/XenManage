const SettingsView = {
  components: {
    FloatingWindow,
    StatusBadge,
    'system-config-section-form': SystemConfigSectionForm,
    'retention-policy-form': RetentionPolicyForm,
  },
  template: `
    <div class="animate-fade-in">
      <div v-if="loading" class="empty-state">
        <span class="loading-spinner"></span>
        <p style="margin-top:12px">Loading runtime configuration, retention controls, and cleanup posture...</p>
      </div>

      <template v-else>
        <div class="section-head">
          <div>
            <h2 class="section-title">
              <span class="mdi mdi-tune-variant"></span>
              Settings
            </h2>
            <p class="section-subtitle">Centralized runtime configuration, session controls, proxy settings, logging posture, and governed data-retention operations.</p>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn" @click="previewRetention()">
              <span class="mdi mdi-magnify-scan"></span>
              Preview Sweep
            </button>
            <button class="btn btn-primary" @click="runRetention()">
              <span class="mdi mdi-broom"></span>
              Run Retention
            </button>
            <button class="btn btn-primary" @click="loadSettings">
              <span class="mdi mdi-refresh"></span>
              Refresh
            </button>
          </div>
        </div>

        <div class="dashboard-hero">
          <div>
            <div class="dash-card-label">Configuration Plane</div>
            <h3>Live control for session behavior, proxy posture, logging defaults, and retention governance.</h3>
            <p>The Settings workspace turns the existing key-value infrastructure into a first-class management surface, with explicit runtime guidance, saved policies, and one-click cleanup previews for historical data domains.</p>
          </div>
          <div class="dashboard-hero-rail">
            <button class="btn btn-primary" @click="$router.push('/governance')">
              <span class="mdi mdi-shield-account-outline"></span>
              Governance
            </button>
            <button class="btn" @click="$router.push('/activity')">
              <span class="mdi mdi-timeline-clock-outline"></span>
              Activity
            </button>
            <button class="btn" @click="$router.push('/alerts')">
              <span class="mdi mdi-bell-alert-outline"></span>
              Alerts
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
    </div>
  `,
  data() {
    return {
      loading: true,
      savingSection: '',
      policySaving: false,
      previewLoading: false,
      runLoading: false,
      pageError: '',
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
      retentionPolicies: [],
      retentionPreview: {
        generatedAt: '',
        results: [],
      },
      showPolicyEditor: false,
      selectedPolicy: null,
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
  },
  mounted() {
    this.loadSettings();
  },
  methods: {
    async loadSettings() {
      this.loading = true;
      this.pageError = '';

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
        this.retentionPolicies = Array.isArray(response.retentionPolicies) ? response.retentionPolicies : [];
      } catch (error) {
        this.pageError = error.message || 'Failed to load settings.';
      } finally {
        this.loading = false;
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
    formatDateTime(value) {
      return formatDateTime(value);
    },
    formatDomainLabel(domain) {
      const policy = this.retentionPolicies.find((entry) => entry.domain === domain);
      return policy?.label || domain;
    },
  },
};
