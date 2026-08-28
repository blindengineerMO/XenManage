const HostPropertiesWindow = {
  components: {
    DataTable,
    FloatingWindow,
    HostMaintenanceForm,
    StatusBadge,
    'metric-trend-card': MetricTrendCard,
  },
  props: {
    show: {
      type: Boolean,
      default: false,
    },
    selectedHost: {
      type: Object,
      default: null,
    },
    selectedHostPool: {
      type: Object,
      default: null,
    },
    selectedHostMaintenanceMode: {
      type: Boolean,
      default: false,
    },
    selectedHostSummaryProfile: {
      type: Object,
      default: () => ({}),
    },
    selectedHostRelationshipProfile: {
      type: Object,
      default: () => ({
        storageRecords: [],
        networkRecords: [],
        maintenanceDraft: {},
        maintenanceNetworkOptions: [],
        vmRecords: [],
        inventoryRows: [],
        shutdownReady: false,
      }),
    },
    hostActionMessage: {
      type: String,
      default: '',
    },
    actionError: {
      type: String,
      default: '',
    },
    hostActionBusy: {
      type: String,
      default: '',
    },
    metricsLoading: {
      type: Boolean,
      default: false,
    },
    metricsError: {
      type: String,
      default: '',
    },
    hostMetrics: {
      type: Object,
      default: () => ({}),
    },
    hostMetricHistory: {
      type: Object,
      default: () => ({ metrics: [] }),
    },
    inventoryLoading: {
      type: Boolean,
      default: false,
    },
    inventoryError: {
      type: String,
      default: '',
    },
    inventoryColumns: {
      type: Array,
      default: () => [],
    },
  },
  emits: [
    'close',
    'open-host-identity',
    'open-host-context',
    'open-host-logging',
    'open-host-guest-cpu',
    'open-host-scheduler',
    'open-host-platform',
    'enter-maintenance',
    'exit-maintenance',
    'power-action',
  ],
  template: `
    <floating-window :show="show" title="Host Properties" :width="860" :height="640" @close="$emit('close')">
      <div v-if="selectedHost">
        <div class="property-grid">
          <span class="text-muted">Name</span><span>{{ selectedHost.name_label || '-' }}</span>
          <span class="text-muted">Description</span><span>{{ selectedHost.name_description || '-' }}</span>
          <span class="text-muted">Address</span><span class="mono">{{ selectedHost.address || '-' }}</span>
          <span class="text-muted">Status</span><status-badge :status="selectedHost.enabled ? 'enabled' : 'disabled'"></status-badge>
          <span class="text-muted">Maintenance Mode</span><status-badge :status="selectedHostMaintenanceMode ? 'warning' : 'enabled'"></status-badge>
          <span class="text-muted">Pool Membership</span><span>{{ selectedHostPool ? (selectedHostPool.name_label || selectedHostPool.uuid || selectedHostPool.ref) : 'Unknown / standalone' }}</span>
          <span class="text-muted">UUID</span><span class="mono property-wrap">{{ selectedHost.uuid || '-' }}</span>
          <span class="text-muted">Tags</span><span>{{ truncateList(selectedHost.tags) }}</span>
          <span class="text-muted">Hostname</span><span>{{ selectedHost.hostname || '-' }}</span>
          <span class="text-muted">Edition</span><span>{{ selectedHostSummaryProfile.editionLabel }}</span>
          <span class="text-muted">CPU Topology</span><span>{{ selectedHostSummaryProfile.cpuSummary }}</span>
          <span class="text-muted">Software Version</span><span class="mono property-wrap">{{ selectedHostSummaryProfile.softwareVersionSummary }}</span>
          <span class="text-muted">License Server</span><span class="mono property-wrap">{{ selectedHostSummaryProfile.licenseServerSummary }}</span>
          <span class="text-muted">Supported HW Versions</span><span class="mono property-wrap">{{ selectedHostSummaryProfile.hardwarePlatformSummary }}</span>
          <span class="text-muted">External Auth Type</span><span>{{ selectedHostSummaryProfile.externalAuthTypeLabel }}</span>
          <span class="text-muted">External Auth Service</span><span class="mono property-wrap">{{ selectedHostSummaryProfile.externalAuthServiceLabel }}</span>
          <span class="text-muted">Guest VCPU Params</span><span class="mono property-wrap">{{ selectedHostSummaryProfile.guestVcpusParamsSummary }}</span>
          <span class="text-muted">Scheduler Granularity</span><span>{{ selectedHostSummaryProfile.schedGranLabel }}</span>
          <span class="text-muted">Legacy SSL</span><span>{{ selectedHostSummaryProfile.sslLegacyLabel }}</span>
          <span class="text-muted">BIOS Strings</span><span class="mono property-wrap">{{ selectedHostSummaryProfile.biosStringsSummary }}</span>
          <span class="text-muted">Logging</span><span class="mono property-wrap">{{ selectedHostSummaryProfile.loggingSummary }}</span>
          <span class="text-muted">Resident VMs</span><span>{{ summarizeCount('attached', (selectedHost.resident_VMs || []).length) }}</span>
          <span class="text-muted">Storage Paths</span><span>{{ summarizeCount('repositories', selectedHostRelationshipProfile.storageRecords.length) }}</span>
          <span class="text-muted">Network Paths</span><span>{{ summarizeCount('networks', selectedHostRelationshipProfile.networkRecords.length) }}</span>
          <span class="text-muted">Other Config</span><span class="mono property-wrap">{{ JSON.stringify(selectedHost.other_config || {}) }}</span>
        </div>

        <div class="stack-item" v-if="hostActionMessage" style="margin-top:12px">
          <div>
            <strong>Host operation completed</strong>
            <div class="text-muted mono" style="font-size:11px">{{ hostActionMessage }}</div>
          </div>
        </div>
        <div class="form-error" v-if="actionError" style="text-align:left">{{ actionError }}</div>

        <div class="detail-section">
          <div class="detail-section-title">Host Workspaces</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn btn-sm" type="button" @click="$emit('open-host-identity')">
              <span class="mdi mdi-form-textbox"></span>
              Host Identity
            </button>
            <button class="btn btn-sm" type="button" @click="$emit('open-host-context')">
              <span class="mdi mdi-card-account-details-outline"></span>
              Host Context
            </button>
            <button class="btn btn-sm" type="button" @click="$emit('open-host-logging')">
              <span class="mdi mdi-text-box-search-outline"></span>
              Host Logging
            </button>
            <button class="btn btn-sm" type="button" @click="$emit('open-host-guest-cpu')">
              <span class="mdi mdi-chip"></span>
              Guest CPU Policy
            </button>
            <button class="btn btn-sm" type="button" @click="$emit('open-host-scheduler')">
              <span class="mdi mdi-tune-variant"></span>
              Scheduler Policy
            </button>
            <button class="btn btn-sm" type="button" @click="$emit('open-host-platform')">
              <span class="mdi mdi-server-cog-outline"></span>
              Platform and Licensing
            </button>
          </div>
          <div class="text-muted mono" style="font-size:11px;margin-top:10px">
            {{ selectedHost.address || selectedHost.hostname || 'no address' }} · {{ selectedHostSummaryProfile.editionLabel }} · {{ selectedHostSummaryProfile.schedGranLabel }}
          </div>
        </div>

        <div class="detail-section">
          <div class="detail-section-title">Operations</div>
          <div class="dashboard-panels">
            <div class="dash-card">
              <div class="dash-card-label">Maintenance Mode</div>
              <p class="text-muted" style="margin-bottom:12px">
                Mirror the XenCenter workflow by disabling placement and evacuating running workloads before maintenance begins.
              </p>
              <host-maintenance-form
                v-if="!selectedHostMaintenanceMode"
                :initial-value="selectedHostRelationshipProfile.maintenanceDraft"
                :network-options="selectedHostRelationshipProfile.maintenanceNetworkOptions"
                :saving="hostActionBusy === 'maintenance-enter'"
                submit-label="Enter Maintenance Mode"
                @submit="$emit('enter-maintenance', $event)">
              </host-maintenance-form>
              <div v-else class="stack-list">
                <div class="stack-item">
                  <div>
                    <strong>Host is already in maintenance mode</strong>
                    <div class="text-muted mono" style="font-size:11px">
                      Re-enable this host when patching, firmware work, or diagnostics are complete.
                    </div>
                  </div>
                  <span class="badge badge-warning">maintenance</span>
                </div>
                <button class="btn btn-primary btn-sm"
                        :disabled="Boolean(hostActionBusy)"
                        @click="$emit('exit-maintenance')">
                  <span class="mdi mdi-playlist-check"></span>
                  {{ hostActionBusy === 'maintenance-exit' ? 'Re-enabling...' : 'Exit Maintenance Mode' }}
                </button>
              </div>
            </div>

            <div class="dash-card">
              <div class="dash-card-label">Power Control</div>
              <div class="stack-list">
                <div class="stack-item">
                  <div>
                    <strong>Reboot / Shutdown Guardrails</strong>
                    <div class="text-muted mono" style="font-size:11px">
                      XenServer requires the host to be disabled and free of running resident VMs before reboot or shutdown.
                    </div>
                  </div>
                  <span class="badge" :class="selectedHostRelationshipProfile.shutdownReady ? 'badge-running' : 'badge-warning'">
                    {{ selectedHostRelationshipProfile.shutdownReady ? 'ready' : 'blocked' }}
                  </span>
                </div>
                <div class="stack-item">
                  <div>
                    <strong>Workload Placement</strong>
                    <div class="text-muted mono" style="font-size:11px">
                      {{ selectedHostRelationshipProfile.vmRecords.length ? selectedHostRelationshipProfile.vmRecords.length + ' resident VM(s) still mapped to this host.' : 'No resident VMs remain on this host.' }}
                    </div>
                  </div>
                  <status-badge :status="selectedHostRelationshipProfile.vmRecords.length ? 'warning' : 'enabled'"></status-badge>
                </div>
              </div>

              <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px">
                <button class="btn btn-sm"
                        :disabled="Boolean(hostActionBusy) || !selectedHostRelationshipProfile.shutdownReady"
                        @click="$emit('power-action', 'reboot')">
                  <span class="mdi mdi-restart"></span>
                  {{ hostActionBusy === 'reboot' ? 'Rebooting...' : 'Reboot Host' }}
                </button>
                <button class="btn btn-danger btn-sm"
                        :disabled="Boolean(hostActionBusy) || !selectedHostRelationshipProfile.shutdownReady"
                        @click="$emit('power-action', 'shutdown')">
                  <span class="mdi mdi-power"></span>
                  {{ hostActionBusy === 'shutdown' ? 'Shutting down...' : 'Shutdown Host' }}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div class="detail-section">
          <div class="detail-section-title">Live Host Metrics</div>
          <div class="stack-item" v-if="metricsLoading">
            <span class="loading-spinner"></span>
            <span class="mono">Collecting host metrics...</span>
          </div>
          <div class="stack-item" v-else-if="metricsError">
            <div>
              <strong>Metrics unavailable</strong>
              <div class="text-muted mono" style="font-size:11px">{{ metricsError }}</div>
            </div>
            <span class="badge badge-error">error</span>
          </div>
          <div v-else class="property-grid">
            <span class="text-muted">Telemetry State</span><status-badge :status="hostMetrics.live === false ? 'warning' : (hostMetrics.live ? 'running' : 'info')"></status-badge>
            <span class="text-muted">Memory Total</span><span class="mono">{{ formatBytes(hostMetrics.memory_total) }}</span>
            <span class="text-muted">Memory Free</span><span class="mono">{{ formatBytes(hostMetrics.memory_free) }}</span>
            <span class="text-muted">Memory Utilization</span><span class="mono">{{ formatPercent((hostMetrics.memory_total || 0) - (hostMetrics.memory_free || 0), hostMetrics.memory_total) }}</span>
          </div>
        </div>

        <div class="detail-section">
          <div class="detail-section-title">Historical Host Telemetry</div>
          <div class="dashboard-panels">
            <metric-trend-card
              title="Host Memory Utilization"
              subtitle="Persisted memory-pressure history for this host."
              :series="hostMetricSeries('memory_used_percent')"
              value-kind="percent"
              :accent-status="historyStatus(hostMetricSeries('memory_used_percent'), { warning: 70, critical: 85 })">
            </metric-trend-card>
            <metric-trend-card
              title="Host CPU Utilization"
              subtitle="Persisted RRD-derived CPU pressure for this host."
              :series="hostMetricSeries('cpu_usage_percent')"
              value-kind="percent"
              :accent-status="historyStatus(hostMetricSeries('cpu_usage_percent'), { warning: 70, critical: 90 })">
            </metric-trend-card>
            <metric-trend-card
              title="Host Network Throughput"
              subtitle="Persisted host ingress and egress throughput from Xen RRD telemetry."
              :series="combinedHostMetricSeries(['network_rx_kib_per_s', 'network_tx_kib_per_s'])"
              value-kind="throughput"
              accent-status="info">
            </metric-trend-card>
          </div>
        </div>

        <div class="detail-section">
          <div class="detail-section-title">Related Host Inventory</div>
          <div class="stack-item" v-if="inventoryLoading">
            <span class="loading-spinner"></span>
            <span class="mono">Mapping pool, VM, storage, and network relationships...</span>
          </div>
          <div class="stack-item" v-else-if="inventoryError">
            <div>
              <strong>Inventory mapping unavailable</strong>
              <div class="text-muted mono" style="font-size:11px">{{ inventoryError }}</div>
            </div>
            <span class="badge badge-error">error</span>
          </div>
          <data-table v-else
                      :columns="inventoryColumns"
                      :data="selectedHostRelationshipProfile.inventoryRows"
                      :loading="false"
                      :searchable="true">
            <template #cell-kind="{ row }">
              <span class="badge badge-info">{{ row.kind }}</span>
            </template>
            <template #cell-name="{ row }">
              <span style="color:var(--text-primary);font-weight:500">{{ row.name }}</span>
            </template>
            <template #cell-status="{ row }">
              <status-badge :status="row.status"></status-badge>
            </template>
            <template #cell-ref="{ row }">
              <span class="mono property-wrap">{{ row.ref || '-' }}</span>
            </template>
          </data-table>
        </div>
      </div>
    </floating-window>
  `,
  methods: {
    formatBytes,
    formatPercent,
    truncateList,
    summarizeCount,
    hostMetricSeries(metricName) {
      return findHostMetricSeries(this.hostMetricHistory, metricName);
    },
    combinedHostMetricSeries(metricNames = []) {
      return combineHostMetricSeries(this.hostMetricHistory, metricNames);
    },
    historyStatus(series, thresholds = {}) {
      return getHostHistoryStatus(series, thresholds);
    },
  },
};
