const HostsView = {
  components: {
    DataTable,
    StatusBadge,
    FloatingWindow,
    HostRegistrationForm,
    HostMaintenanceForm,
    HostConfigForm,
    HostLoggingForm,
    'metric-trend-card': MetricTrendCard,
  },
  template: `
    <div class="animate-fade-in">
      <div class="section-head">
        <div>
          <h2 class="section-title">
            <span class="mdi mdi-server"></span>
            Hosts
          </h2>
          <p class="section-subtitle">Dense infrastructure inventory with quick-access host details and host-target registration.</p>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn" @click="openRegistration()">
            <span class="mdi mdi-plus"></span>
            Register Host
          </button>
          <button class="btn btn-primary" @click="loadAll">
            <span class="mdi mdi-refresh"></span>
            Refresh
          </button>
        </div>
      </div>

      <div class="dashboard-panels">
        <div class="dash-card">
          <div class="dash-card-label">Registered Host Targets</div>
          <div class="stack-list" v-if="hostTargets.length">
            <div class="stack-item" v-for="target in hostTargets" :key="target.id">
              <div>
                <strong>{{ target.name }}</strong>
                <div class="text-muted mono" style="font-size:11px">{{ target.host }} · {{ target.username }} · :{{ target.port || 443 }}</div>
                <div class="text-muted" style="font-size:12px;margin-top:6px">
                  {{ target.mode === 'pool-member' ? `Pool member of ${target.pool_name || 'registered pool'}` : 'Standalone host target' }}
                  <span v-if="isCurrentTarget(target)"> · connected now</span>
                  <span v-else-if="isTargetAttached(target)"> · attached in session</span>
                  <span v-if="target.vault_credential_id"> · vault credential linked</span>
                </div>
                <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
                  <span class="badge" :class="target.visibility === 'shared' ? 'badge-info' : 'badge-success'">{{ visibilityLabel(target.visibility) }}</span>
                  <span class="badge badge-info" v-if="target.owner_display_name || target.owner_username">{{ ownershipLabel(target) }}</span>
                </div>
              </div>
              <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;justify-content:flex-end">
                <status-badge :status="target.mode === 'pool-member'
                  ? 'pending'
                  : (isCurrentTarget(target) ? 'connected' : (isTargetAttached(target) ? 'success' : 'info'))"></status-badge>
                <button class="btn btn-sm"
                        v-if="target.mode === 'standalone' && !isTargetAttached(target)"
                        :disabled="isTargetBusy(target, 'connect')"
                        @click="connectHostTarget(target)">
                  <span class="mdi" :class="isTargetBusy(target, 'connect') ? 'mdi-loading mdi-spin' : (target.vault_credential_id ? 'mdi-connection' : 'mdi-login-variant')"></span>
                  {{ isTargetBusy(target, 'connect') ? 'Connecting...' : (target.vault_credential_id ? 'Connect' : 'Open Login') }}
                </button>
                <button class="btn btn-sm"
                        v-if="target.mode === 'standalone' && isTargetAttached(target) && !isCurrentTarget(target)"
                        :disabled="isTargetBusy(target, 'activate')"
                        @click="activateHostTarget(target)">
                  <span class="mdi" :class="isTargetBusy(target, 'activate') ? 'mdi-loading mdi-spin' : 'mdi-target'"></span>
                  {{ isTargetBusy(target, 'activate') ? 'Activating...' : 'Activate' }}
                </button>
                <button class="btn btn-sm"
                        v-if="target.mode === 'pool-member'"
                        @click="openPoolTarget(target)">
                  <span class="mdi mdi-open-in-app"></span>
                  Open Pool
                </button>
                <button class="btn btn-sm" v-if="target.can_manage !== false" @click="openRegistration(target)">
                  <span class="mdi mdi-pencil-outline"></span>
                </button>
                <button class="btn btn-sm" v-if="target.can_manage !== false" @click="removeTarget(target.id)">
                  <span class="mdi mdi-delete-outline"></span>
                </button>
              </div>
            </div>
          </div>
          <div v-else class="empty-state" style="padding:18px 12px">Register standalone hosts or queue hosts as members of a saved pool target.</div>
          <div class="form-error" v-if="targetError" style="text-align:left">{{ targetError }}</div>
        </div>
      </div>

      <div class="dash-card" v-if="selectedHostRows.length" style="margin-bottom:16px">
        <div class="dash-card-label">Batch Host Actions</div>
        <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap">
          <div>
            <strong>{{ selectedHostRows.length }} hosts selected</strong>
            <div class="text-muted mono" style="font-size:11px;margin-top:4px">{{ selectedHostSelectionSummary }}</div>
          </div>
          <div class="dashboard-hero-rail" style="gap:8px">
            <button class="btn btn-sm btn-primary"
                    v-if="selectedHostMaintenanceCounts.ready"
                    :disabled="Boolean(bulkHostActionBusy)"
                    @click="applyBulkHostMaintenance('enter')">
              <span class="mdi mdi-wrench-clock"></span>
              {{ bulkHostActionBusy === 'maintenance-enter' ? 'Applying...' : `Enter Maintenance Selected (${selectedHostMaintenanceCounts.ready})` }}
            </button>
            <button class="btn btn-sm"
                    v-if="selectedHostMaintenanceCounts.maintenance"
                    :disabled="Boolean(bulkHostActionBusy)"
                    @click="applyBulkHostMaintenance('exit')">
              <span class="mdi mdi-playlist-check"></span>
              {{ bulkHostActionBusy === 'maintenance-exit' ? 'Applying...' : `Exit Maintenance Selected (${selectedHostMaintenanceCounts.maintenance})` }}
            </button>
            <button class="btn btn-sm" :disabled="Boolean(bulkHostActionBusy)" @click="clearHostSelection">Clear Selection</button>
          </div>
        </div>
        <div class="form-error" v-if="bulkError" style="text-align:left;margin-top:12px">{{ bulkError }}</div>
      </div>

      <data-table :columns="columns"
                  :data="hosts"
                  :loading="loading"
                  :searchable="true"
                  :selectable="true"
                  :selected-keys="selectedHostRefs"
                  row-key="ref"
                  @selection-change="handleHostSelectionChange"
                  @row-click="openProperties">
        <template #cell-name_label="{ row }">
          <span style="color:var(--text-primary);font-weight:500">{{ row.name_label || 'Unnamed Host' }}</span>
        </template>
        <template #cell-enabled="{ row }">
          <status-badge :status="row.enabled ? 'enabled' : 'disabled'"></status-badge>
        </template>
      </data-table>

      <floating-window :show="showProps" title="Host Properties" :width="860" :height="640" @close="showProps = false">
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
            <span class="text-muted">Logging</span><span class="mono property-wrap">{{ selectedHostLoggingSummary }}</span>
            <span class="text-muted">Resident VMs</span><span>{{ summarizeCount('attached', (selectedHost.resident_VMs || []).length) }}</span>
            <span class="text-muted">Storage Paths</span><span>{{ summarizeCount('repositories', selectedHostStorageRecords.length) }}</span>
            <span class="text-muted">Network Paths</span><span>{{ summarizeCount('networks', selectedHostNetworkRecords.length) }}</span>
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
            <div class="detail-section-title">Host Metadata</div>
            <div class="dashboard-panels">
              <div class="dash-card">
                <div class="dash-card-label">Host Identity</div>
                <p class="text-muted" style="margin-bottom:12px">
                  Update the operator-facing host label and description without leaving the host detail workspace.
                </p>
                <host-config-form
                  :initial-value="selectedHost"
                  :saving="hostConfigSaving"
                  :submit-label="'Save Host Metadata'"
                  @submit="submitSelectedHostConfig">
                </host-config-form>
              </div>

              <div class="dash-card">
                <div class="dash-card-label">Host Context</div>
                <div class="stack-list">
                  <div class="stack-item">
                    <div>
                      <strong>{{ selectedHost.name_label || 'Selected host' }}</strong>
                      <div class="text-muted mono" style="font-size:11px">{{ selectedHost.uuid || selectedHost.ref || 'host ref unavailable' }}</div>
                    </div>
                    <status-badge :status="selectedHost.enabled ? 'enabled' : 'disabled'"></status-badge>
                  </div>
                  <div class="stack-item">
                    <div>
                      <strong>Address</strong>
                      <div class="text-muted mono" style="font-size:11px">{{ selectedHost.address || selectedHost.hostname || 'not reported' }}</div>
                    </div>
                    <span class="badge badge-info">network</span>
                  </div>
                  <div class="stack-item">
                    <div>
                      <strong>Pool Membership</strong>
                      <div class="text-muted mono" style="font-size:11px">{{ selectedHostPool ? (selectedHostPool.name_label || selectedHostPool.uuid || selectedHostPool.ref) : 'Unknown / standalone' }}</div>
                    </div>
                    <span class="badge badge-info">pool</span>
                  </div>
                  <div class="stack-item">
                    <div>
                      <strong>Operator Description</strong>
                      <div class="text-muted mono" style="font-size:11px">{{ selectedHost.name_description || 'No operator-facing host description has been saved yet.' }}</div>
                    </div>
                    <span class="badge badge-info">notes</span>
                  </div>
                  <div class="stack-item">
                    <div>
                      <strong>Logging Overrides</strong>
                      <div class="text-muted mono" style="font-size:11px">{{ selectedHostLoggingSummary }}</div>
                    </div>
                    <span class="badge badge-info">logging</span>
                  </div>
                </div>
              </div>

              <div class="dash-card">
                <div class="dash-card-label">Host Logging</div>
                <p class="text-muted" style="margin-bottom:12px">
                  Keep per-host syslog destinations or verbosity overrides visible beside maintenance and telemetry workflows.
                </p>
                <host-logging-form
                  :initial-value="selectedHost"
                  :saving="hostConfigSaving"
                  :submit-label="'Save Host Logging'"
                  @submit="submitSelectedHostLogging">
                </host-logging-form>
                <div class="text-muted mono" style="font-size:11px;margin-top:12px">
                  {{ selectedHostLoggingSummary }}
                </div>
              </div>
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
                  :initial-value="hostMaintenanceDraft"
                  :network-options="maintenanceNetworkOptions"
                  :saving="hostActionBusy === 'maintenance-enter'"
                  submit-label="Enter Maintenance Mode"
                  @submit="enterMaintenanceMode">
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
                          @click="exitMaintenanceMode">
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
                    <span class="badge" :class="hostShutdownReady ? 'badge-running' : 'badge-warning'">
                      {{ hostShutdownReady ? 'ready' : 'blocked' }}
                    </span>
                  </div>
                  <div class="stack-item">
                    <div>
                      <strong>Workload Placement</strong>
                      <div class="text-muted mono" style="font-size:11px">
                        {{ selectedHostVmRecords.length ? `${selectedHostVmRecords.length} resident VM(s) still mapped to this host.` : 'No resident VMs remain on this host.' }}
                      </div>
                    </div>
                    <status-badge :status="selectedHostVmRecords.length ? 'warning' : 'enabled'"></status-badge>
                  </div>
                </div>

                <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px">
                  <button class="btn btn-sm"
                          :disabled="Boolean(hostActionBusy) || !hostShutdownReady"
                          @click="powerAction('reboot')">
                    <span class="mdi mdi-restart"></span>
                    {{ hostActionBusy === 'reboot' ? 'Rebooting...' : 'Reboot Host' }}
                  </button>
                  <button class="btn btn-danger btn-sm"
                          :disabled="Boolean(hostActionBusy) || !hostShutdownReady"
                          @click="powerAction('shutdown')">
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
                        :data="selectedHostInventoryRows"
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

      <floating-window :show="showRegistration"
                       :title="editingTargetId ? 'Edit Host Target' : 'Register Host Target'"
                       :width="620"
                       :height="620"
                       @close="showRegistration = false">
        <host-registration-form
          :initial-value="hostTargetDraft"
          :pool-options="connections"
          :credential-options="credentials"
          :submit-label="editingTargetId ? 'Update Host Target' : 'Save Host Target'"
          @submit="submitTarget">
        </host-registration-form>
      </floating-window>
    </div>
  `,
  data() {
    return {
      store,
      loading: true,
      hosts: [],
      hostTargets: [],
      connections: [],
      credentials: [],
      selectedHost: null,
      showProps: false,
      showRegistration: false,
      editingTargetId: null,
      hostTargetDraft: null,
      metricsLoading: false,
      metricsError: null,
      inventoryLoading: false,
      inventoryError: null,
      targetError: null,
      targetActionBusyId: null,
      targetActionBusyKind: '',
      actionError: null,
      hostActionMessage: '',
      hostActionBusy: '',
      hostConfigSaving: false,
      selectedHostRefs: [],
      bulkHostActionBusy: '',
      bulkError: null,
      hostMetrics: {},
      hostMetricHistory: { metrics: [] },
      lastAppliedFocusKey: '',
      relatedPools: [],
      relatedVMs: [],
      relatedStorage: [],
      relatedNetworks: [],
      columns: [
        { key: 'name_label', label: 'Name' },
        { key: 'enabled', label: 'Status' },
        { key: 'address', label: 'Address' },
        { key: 'uuid', label: 'UUID' },
      ],
      inventoryColumns: [
        { key: 'kind', label: 'Kind' },
        { key: 'name', label: 'Name' },
        { key: 'detail', label: 'Detail' },
        { key: 'status', label: 'Status' },
        { key: 'ref', label: 'Reference' },
      ],
    };
  },
  computed: {
    attachedTargets() {
      return Array.isArray(store.connectedTargets) ? store.connectedTargets : [];
    },
    selectedHostRows() {
      const selected = new Set(Array.isArray(this.selectedHostRefs) ? this.selectedHostRefs : []);
      return this.hosts.filter((host) => selected.has(host.ref));
    },
    selectedHostMaintenanceCounts() {
      return this.selectedHostRows.reduce((counts, host) => {
        if (this.resolveHostMaintenanceState(host)) {
          counts.maintenance += 1;
        } else {
          counts.ready += 1;
        }
        return counts;
      }, { ready: 0, maintenance: 0 });
    },
    selectedHostSelectionSummary() {
      const parts = [];
      if (this.selectedHostMaintenanceCounts.ready) parts.push(`${this.selectedHostMaintenanceCounts.ready} ready for maintenance`);
      if (this.selectedHostMaintenanceCounts.maintenance) parts.push(`${this.selectedHostMaintenanceCounts.maintenance} already in maintenance`);
      return parts.length ? parts.join(' · ') : 'No selected host maintenance states were recognized.';
    },
    selectedHostPool() {
      return this.resolveHostPool(this.selectedHost);
    },
    selectedHostMaintenanceMode() {
      return this.resolveHostMaintenanceState(this.selectedHost);
    },
    maintenanceNetworkOptions() {
      const poolMigrationRef = this.selectedHostPool?.migration_network || '';
      const ordered = [...this.selectedHostNetworkRecords];
      if (poolMigrationRef) {
        const poolMigrationNetwork = this.relatedNetworks.find((network) => network.ref === poolMigrationRef);
        if (poolMigrationNetwork && !ordered.some((network) => network.ref === poolMigrationNetwork.ref)) {
          ordered.unshift(poolMigrationNetwork);
        }
      }
      return ordered;
    },
    hostMaintenanceDraft() {
      return {
        networkRef: this.selectedHostPool?.migration_network || this.maintenanceNetworkOptions[0]?.ref || '',
        poolMigrationNetworkRef: this.selectedHostPool?.migration_network || '',
        evacuateBatchSize: 0,
        evacuateRunningVms: true,
      };
    },
    hostShutdownReady() {
      if (!this.selectedHost) return false;
      return !this.selectedHost.enabled && this.selectedHostVmRecords.length === 0;
    },
    selectedHostLoggingSummary() {
      const entries = Object.entries(this.selectedHost?.logging || {})
        .filter(([key]) => String(key || '').trim())
        .map(([key, value]) => `${String(key).trim()}=${String(value || '').trim()}`);

      return entries.length ? entries.join(' · ') : 'No host-specific logging overrides are currently configured.';
    },
    selectedHostVmRecords() {
      if (!this.selectedHost) return [];
      const residentRefs = new Set(Array.isArray(this.selectedHost.resident_VMs) ? this.selectedHost.resident_VMs : []);

      return this.relatedVMs.filter((vm) => residentRefs.has(vm.ref) || residentRefs.has(vm.uuid));
    },
    selectedHostStorageRecords() {
      if (!this.selectedHost) return [];

      const hostPbdRefs = new Set(Array.isArray(this.selectedHost.PBDs) ? this.selectedHost.PBDs : []);
      let records = this.relatedStorage.filter((sr) =>
        Array.isArray(sr.PBDs) && sr.PBDs.some((ref) => hostPbdRefs.has(ref))
      );

      if (!records.length && this.selectedHostPool?.default_SR) {
        records = this.relatedStorage.filter((sr) => sr.ref === this.selectedHostPool.default_SR);
      }

      return records;
    },
    selectedHostNetworkRecords() {
      if (!this.selectedHost) return [];

      const hostPifRefs = new Set(Array.isArray(this.selectedHost.PIFs) ? this.selectedHost.PIFs : []);
      let records = this.relatedNetworks.filter((network) =>
        Array.isArray(network.PIFs) && network.PIFs.some((ref) => hostPifRefs.has(ref))
      );

      if (!records.length && this.selectedHostPool?.migration_network) {
        records = this.relatedNetworks.filter((network) => network.ref === this.selectedHostPool.migration_network);
      }

      return records;
    },
    selectedHostInventoryRows() {
      if (!this.selectedHost) return [];

      const cpuInfo = this.selectedHost.cpu_info || this.selectedHost.CPU_info || {};
      const cpuCount = cpuInfo.cpu_count || cpuInfo.CPU_count || this.selectedHost.host_CPUs?.length || 0;
      const cpuModel = cpuInfo.modelname || cpuInfo.vendor || 'Host compute plane';
      const memorySummary = this.metricsLoading
        ? 'Memory telemetry loading'
        : `${formatBytes(this.hostMetrics.memory_total)} total · ${formatBytes(this.hostMetrics.memory_free)} free`;

      const rows = [
        {
          kind: 'compute',
          name: this.selectedHost.name_label || this.selectedHost.hostname || 'Host',
          detail: `${cpuCount || 0} CPUs · ${cpuModel} · ${memorySummary}`,
          status: this.hostMetrics.live === false ? 'warning' : (this.selectedHost.enabled ? 'enabled' : 'disabled'),
          ref: this.selectedHost.ref || this.selectedHost.uuid || '',
        },
      ];

      if (this.selectedHostPool) {
        rows.push({
          kind: 'pool',
          name: this.selectedHostPool.name_label || 'Pool Membership',
          detail: `${this.selectedHostPool.uuid || this.selectedHostPool.ref || '-'} · default SR ${this.selectedHostPool.default_SR || '-'}`,
          status: 'info',
          ref: this.selectedHostPool.ref || this.selectedHostPool.uuid || '',
        });
      }

      rows.push(...this.selectedHostVmRecords.map((vm) => ({
        kind: 'vm',
        name: vm.name_label || vm.ref || 'Virtual Machine',
        detail: `${vm.power_state || 'Unknown'} · ${vm.VCPUs_at_startup || 0} vCPU · ${formatBytes(vm.memory_static_max)}`,
        status: vm.power_state || 'info',
        ref: vm.ref || vm.uuid || '',
      })));

      rows.push(...this.selectedHostStorageRecords.map((sr) => ({
        kind: 'storage',
        name: sr.name_label || sr.ref || 'Storage Repository',
        detail: `${sr.type || 'unknown'} · ${formatBytes(sr.virtual_allocation)} / ${formatBytes(sr.physical_size)}`,
        status: getUtilizationStatus(percentValue(sr.virtual_allocation, sr.physical_size), { warning: 75, critical: 90 }),
        ref: sr.ref || sr.uuid || '',
      })));

      rows.push(...this.selectedHostNetworkRecords.map((network) => ({
        kind: 'network',
        name: network.name_label || network.bridge || 'Network',
        detail: `${network.bridge || '-'} · VLAN ${(network.other_config || {}).vlan || '-'} · ${network.managed ? 'managed' : 'unmanaged'}`,
        status: network.managed ? 'enabled' : 'disabled',
        ref: network.ref || network.uuid || '',
      })));

      return rows;
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
    hosts() {
      const validRefs = new Set(this.hosts.map((host) => host.ref));
      this.selectedHostRefs = this.selectedHostRefs.filter((ref) => validRefs.has(ref));
    },
  },
  methods: {
    formatBytes,
    formatThroughput,
    formatPercent,
    truncateList,
    summarizeCount,
    resolveHostMaintenanceState(host) {
      if (!host) return false;
      if (host.maintenance_mode === true) return true;
      return String(host.other_config?.maintenance_mode || '').toLowerCase() === 'true';
    },
    visibilityLabel(visibility) {
      return visibility === 'shared' ? 'Shared' : 'Private';
    },
    ownershipLabel(target) {
      if (target.is_owner) return 'Owned by you';
      return `Owner ${target.owner_display_name || target.owner_username}`;
    },
    findAttachedTarget(target) {
      if (!target || target.mode !== 'standalone') return null;
      const host = String(target.host || '').toLowerCase();
      const username = String(target.username || '').toLowerCase();
      const port = Number(target.port || 443) || 443;
      return this.attachedTargets.find((entry) =>
        String(entry.host || '').toLowerCase() === host
        && String(entry.username || '').toLowerCase() === username
        && (Number(entry.port || 443) || 443) === port
      ) || null;
    },
    isTargetAttached(target) {
      return Boolean(this.findAttachedTarget(target));
    },
    isCurrentTarget(target) {
      return Boolean(this.findAttachedTarget(target)?.active);
    },
    isTargetBusy(target, kind) {
      return Number(this.targetActionBusyId || 0) === Number(target?.id || 0) && this.targetActionBusyKind === kind;
    },
    hostMetricSeries(metricName) {
      return (this.hostMetricHistory.metrics || []).find((entry) => entry.metricName === metricName)?.points || [];
    },
    combinedHostMetricSeries(metricNames = []) {
      const buckets = new Map();
      (Array.isArray(metricNames) ? metricNames : []).forEach((metricName) => {
        const points = this.hostMetricSeries(metricName);
        points.forEach((point) => {
          const ts = Number(point?.ts || 0);
          if (!ts) return;
          buckets.set(ts, (buckets.get(ts) || 0) + Number(point?.value || 0));
        });
      });
      return [...buckets.entries()]
        .sort((left, right) => left[0] - right[0])
        .map(([ts, value]) => ({ ts, value }));
    },
    historyStatus(series, thresholds = {}) {
      const points = Array.isArray(series) ? series : [];
      const latest = Number(points[points.length - 1]?.value || 0);
      if (thresholds.critical !== undefined && latest >= thresholds.critical) return 'critical';
      if (thresholds.warning !== undefined && latest >= thresholds.warning) return 'warning';
      return 'success';
    },
    async loadAll() {
      await Promise.all([this.loadHosts(), this.loadHostTargets(), this.loadConnections(), this.loadCredentials()]);
    },
    async loadHosts() {
      this.loading = true;
      try {
        const result = await api.getHosts();
        this.hosts = result.data || [];
      } catch (error) {
        console.error(error);
      } finally {
        this.loading = false;
      }
      await this.syncRouteFocus();
    },
    handleHostSelectionChange(keys) {
      this.selectedHostRefs = Array.isArray(keys) ? keys : [];
      this.bulkError = null;
    },
    clearHostSelection() {
      this.selectedHostRefs = [];
      this.bulkError = null;
    },
    async loadHostTargets() {
      try {
        this.hostTargets = await api.getHostTargets();
      } catch (error) {
        this.hostTargets = [];
      }
    },
    async loadConnections() {
      try {
        this.connections = await api.getConnections();
      } catch (error) {
        this.connections = [];
      }
    },
    async loadCredentials() {
      try {
        const result = await api.getCredentials();
        this.credentials = result.data || [];
      } catch (error) {
        this.credentials = [];
      }
    },
    async openProperties(row) {
      this.selectedHost = row;
      this.showProps = true;
      this.actionError = null;
      this.hostActionMessage = '';
      this.hostActionBusy = '';
      this.metricsLoading = true;
      this.metricsError = null;
      this.hostMetrics = {};
      this.hostMetricHistory = { metrics: [] };
      this.inventoryLoading = true;
      this.inventoryError = null;
      this.relatedPools = [];
      this.relatedVMs = [];
      this.relatedStorage = [];
      this.relatedNetworks = [];

      const [metricsResult, metricHistoryResult, poolsResult, vmsResult, storageResult, networksResult] = await Promise.allSettled([
        api.getHostMetrics(row.ref),
        api.getHostMetricHistory(row.ref),
        api.getPools(),
        api.getVMs(),
        api.getSRs(),
        api.getNetworks(),
      ]);

      if (metricsResult.status === 'fulfilled') {
        this.hostMetrics = metricsResult.value;
      } else {
        this.metricsError = metricsResult.reason?.message || 'Unable to load metrics';
      }
      if (metricHistoryResult.status === 'fulfilled') {
        this.hostMetricHistory = metricHistoryResult.value;
      }
      this.metricsLoading = false;

      if (poolsResult.status === 'fulfilled') {
        this.relatedPools = poolsResult.value.data || [];
      }
      if (vmsResult.status === 'fulfilled') {
        this.relatedVMs = vmsResult.value.data || [];
      }
      if (storageResult.status === 'fulfilled') {
        this.relatedStorage = storageResult.value.data || [];
      }
      if (networksResult.status === 'fulfilled') {
        this.relatedNetworks = networksResult.value.data || [];
      }

      if (
        poolsResult.status === 'rejected' &&
        vmsResult.status === 'rejected' &&
        storageResult.status === 'rejected' &&
        networksResult.status === 'rejected'
      ) {
        this.inventoryError = 'Unable to map related pool and host inventory.';
      }

      this.inventoryLoading = false;
    },
    async refreshSelectedHost() {
      if (!this.selectedHost?.ref) return;
      await this.loadHosts();
      const updated = this.hosts.find((host) => host.ref === this.selectedHost.ref);
      if (updated) {
        await this.openProperties(updated);
      }
    },
    applySelectedHostRecord(record) {
      this.selectedHost = { ...this.selectedHost, ...(record || {}) };
      this.hosts = this.hosts.map((entry) => (entry.ref === this.selectedHost.ref ? { ...entry, ...(record || {}) } : entry));
    },
    async submitSelectedHostConfig(payload) {
      if (!this.selectedHost?.ref) return;

      this.actionError = null;
      this.hostActionMessage = '';
      this.hostConfigSaving = true;
      try {
        const record = await api.updateHostConfig(this.selectedHost.ref, payload);
        this.applySelectedHostRecord(record);
        this.hostActionMessage = `${record?.name_label || payload.nameLabel || this.selectedHost.ref} metadata was updated.`;
      } catch (error) {
        this.actionError = error.message || 'Unable to save host metadata.';
      } finally {
        this.hostConfigSaving = false;
      }
    },
    async submitSelectedHostLogging(payload) {
      if (!this.selectedHost?.ref) return;

      this.actionError = null;
      this.hostActionMessage = '';
      this.hostConfigSaving = true;
      try {
        const record = await api.updateHostConfig(this.selectedHost.ref, {
          nameLabel: this.selectedHost.name_label || this.selectedHost.hostname || this.selectedHost.ref,
          nameDescription: this.selectedHost.name_description || '',
          logging: payload.logging || {},
        });
        this.applySelectedHostRecord(record);
        this.hostActionMessage = `${record?.name_label || this.selectedHost.ref} logging configuration was updated.`;
      } catch (error) {
        this.actionError = error.message || 'Unable to save host logging.';
      } finally {
        this.hostConfigSaving = false;
      }
    },
    findHostByFocus(focus) {
      return this.hosts.find((host) =>
        recordMatchesRouteFocus(host, focus, ['ref', 'uuid', 'name_label', 'hostname', 'address'])
      ) || null;
    },
    async syncRouteFocus() {
      const focus = getRouteFocus(this.$route.query);
      if (!focus || (focus.kind && focus.kind !== 'host')) {
        this.lastAppliedFocusKey = '';
        return;
      }

      if (this.loading || !this.hosts.length) return;

      const key = getRouteFocusKey(focus);
      if (this.lastAppliedFocusKey === key) return;

      const match = this.findHostByFocus(focus);
      if (!match) return;

      await this.openProperties(match);
      this.lastAppliedFocusKey = key;
    },
    resolveHostPool(host) {
      if (!host) return null;

      const hostKeys = [host.pool, host.pool_ref, host.pool_uuid, host.pool_name]
        .filter(Boolean)
        .map((value) => String(value).toLowerCase());

      if (hostKeys.length) {
        const directMatch = this.relatedPools.find((pool) => {
          const poolKeys = [pool.ref, pool.uuid, pool.name_label]
            .filter(Boolean)
            .map((value) => String(value).toLowerCase());
          return hostKeys.some((value) => poolKeys.includes(value));
        });

        if (directMatch) return directMatch;
      }

      const relationshipMatch = this.relatedPools.find((pool) => this.poolContainsHost(pool, host));
      if (relationshipMatch) return relationshipMatch;

      if (this.relatedPools.length === 1) return this.relatedPools[0];
      return null;
    },
    poolContainsHost(pool, host) {
      if (!pool || !host) return false;

      const poolRefs = new Set(
        [
          pool.master,
          ...(Array.isArray(pool.hosts) ? pool.hosts : []),
          ...(Array.isArray(pool.resident_hosts) ? pool.resident_hosts : []),
          ...(Array.isArray(pool.slaves) ? pool.slaves : []),
        ].filter(Boolean)
      );

      return poolRefs.has(host.ref) || poolRefs.has(host.uuid);
    },
    async resolveHostGovernanceApproval(actionKey) {
      if (!this.selectedHost?.ref) return '';
      return resolveGovernanceApproval({
        actionKey,
        entityType: 'host',
        entityRef: this.selectedHost.ref,
        entityName: this.selectedHost.name_label || this.selectedHost.hostname || this.selectedHost.ref,
        route: '/hosts',
      });
    },
    async ensureHostBatchContext() {
      if (this.relatedPools.length) return;
      try {
        const pools = await api.getPools();
        this.relatedPools = pools.data || [];
      } catch (_error) {
        this.relatedPools = [];
      }
    },
    getEligibleBatchHosts(mode) {
      if (mode === 'enter') {
        return this.selectedHostRows.filter((host) => !this.resolveHostMaintenanceState(host));
      }
      if (mode === 'exit') {
        return this.selectedHostRows.filter((host) => this.resolveHostMaintenanceState(host));
      }
      return [];
    },
    buildBulkHostMaintenancePayload(host) {
      const pool = this.resolveHostPool(host);
      return {
        networkRef: pool?.migration_network || '',
        evacuateBatchSize: 0,
        evacuateRunningVms: true,
      };
    },
    async applyBulkHostMaintenance(mode) {
      const targets = this.getEligibleBatchHosts(mode);
      if (!targets.length) {
        this.bulkError = `No selected hosts are currently eligible for maintenance ${mode}.`;
        return;
      }

      await this.ensureHostBatchContext();
      this.bulkError = null;
      this.bulkHostActionBusy = mode === 'enter' ? 'maintenance-enter' : 'maintenance-exit';
      let completed = 0;

      try {
        for (const host of targets) {
          try {
            if (mode === 'enter') {
              await api.enterHostMaintenance(host.ref, this.buildBulkHostMaintenancePayload(host));
            } else {
              await api.exitHostMaintenance(host.ref);
            }
            completed += 1;
          } catch (error) {
            this.bulkError = completed
              ? `Processed ${completed} host(s) before stopping: ${error.message || 'Unable to continue the batch maintenance action.'}`
              : (error.message || 'Unable to continue the batch maintenance action.');
            return;
          }
        }
      } finally {
        this.bulkHostActionBusy = '';
      }

      await this.loadHosts();

      if (this.selectedHost?.ref && targets.some((host) => host.ref === this.selectedHost.ref)) {
        await this.refreshSelectedHost();
      }
    },
    async enterMaintenanceMode(payload) {
      if (!this.selectedHost?.ref) return;

      this.actionError = null;
      this.hostActionMessage = '';
      this.hostActionBusy = 'maintenance-enter';
      try {
        await api.enterHostMaintenance(this.selectedHost.ref, payload);
        await this.refreshSelectedHost();
      } catch (error) {
        this.actionError = error.message || 'Unable to enter maintenance mode.';
      } finally {
        this.hostActionBusy = '';
      }
    },
    async exitMaintenanceMode() {
      if (!this.selectedHost?.ref) return;

      this.actionError = null;
      this.hostActionMessage = '';
      this.hostActionBusy = 'maintenance-exit';
      try {
        await api.exitHostMaintenance(this.selectedHost.ref);
        await this.refreshSelectedHost();
      } catch (error) {
        this.actionError = error.message || 'Unable to exit maintenance mode.';
      } finally {
        this.hostActionBusy = '';
      }
    },
    async powerAction(action) {
      if (!this.selectedHost?.ref) return;

      this.actionError = null;
      this.hostActionMessage = '';
      this.hostActionBusy = action;
      const actionKey = action === 'shutdown' ? 'host_shutdown' : 'host_reboot';

      try {
        const approvalId = await this.resolveHostGovernanceApproval(actionKey);
        if (action === 'shutdown') {
          await api.shutdownHost(this.selectedHost.ref, approvalId ? { approvalId } : {});
        } else {
          await api.rebootHost(this.selectedHost.ref, approvalId ? { approvalId } : {});
        }
        await this.refreshSelectedHost();
      } catch (error) {
        if (error.code === 'APPROVAL_REQUIRED') {
          this.actionError = `Governance approval is required before continuing this host ${action}.`;
          await handoffToGovernanceApproval(
            this.$router,
            error.approvalDraft,
            `Approval required before continuing this host ${action}.`
          );
          return;
        }
        this.actionError = error.message || `Unable to ${action} host.`;
      } finally {
        this.hostActionBusy = '';
      }
    },
    openRegistration(target = null) {
      this.targetError = null;
      this.editingTargetId = target?.id || null;
      this.hostTargetDraft = target ? { ...target } : {
        name: '',
        host: '',
        username: 'root',
        vault_credential_id: null,
        port: 443,
        mode: 'standalone',
        pool_connection_id: this.connections[0]?.id || null,
        notes: '',
        visibility: store.user ? 'private' : 'shared',
      };
      this.showRegistration = true;
    },
    async submitTarget(payload) {
      this.targetError = null;
      try {
        const attachAfterSave = Boolean(payload.attachAfterSave);
        const requestPayload = { ...payload };
        delete requestPayload.attachAfterSave;

        let savedTarget;
        if (this.editingTargetId) {
          savedTarget = await api.updateHostTarget(this.editingTargetId, requestPayload);
        } else {
          savedTarget = await api.saveHostTarget(requestPayload);
        }
        this.showRegistration = false;
        await this.loadHostTargets();
        if (attachAfterSave && savedTarget?.mode === 'standalone') {
          await this.connectHostTarget(savedTarget);
        }
      } catch (error) {
        this.targetError = error.message || 'Unable to save host target';
      }
    },
    async connectHostTarget(target) {
      if (!target) return;
      if (target.mode === 'pool-member') {
        await this.openPoolTarget(target);
        return;
      }

      this.targetError = null;
      this.targetActionBusyId = target.id;
      this.targetActionBusyKind = 'connect';

      try {
        if (target.vault_credential_id) {
          const result = await api.xenLogin(target.host, target.username, '', {
            vaultCredentialId: target.vault_credential_id,
            connectionName: target.name || '',
            port: target.port || 443,
          });
          applySessionStatus(result);
          await this.loadAll();
          return;
        }

        window.sessionStorage.setItem('xenmange.pendingLoginTarget', JSON.stringify({
          connectionName: target.name || '',
          name: target.name || '',
          host: target.host || '',
          username: target.username || 'root',
          port: target.port || 443,
          returnTo: '/hosts',
        }));
        await this.$router.push('/login');
      } catch (error) {
        this.targetError = error.message || 'Unable to connect the selected host target';
      } finally {
        this.targetActionBusyId = null;
        this.targetActionBusyKind = '';
      }
    },
    async activateHostTarget(target) {
      const attachedTarget = this.findAttachedTarget(target);
      if (!attachedTarget?.targetKey) return;

      this.targetError = null;
      this.targetActionBusyId = target.id;
      this.targetActionBusyKind = 'activate';

      try {
        const result = await api.activateLiveTarget({ targetKey: attachedTarget.targetKey });
        applySessionStatus(result);
        await this.loadAll();
      } catch (error) {
        this.targetError = error.message || 'Unable to activate the selected host target';
      } finally {
        this.targetActionBusyId = null;
        this.targetActionBusyKind = '';
      }
    },
    async openPoolTarget(target) {
      if (!target?.pool_connection_id) {
        this.targetError = 'This host target is not linked to a saved pool target yet.';
        return;
      }
      await this.$router.push({
        path: '/pools',
        query: {
          connectionId: String(target.pool_connection_id),
          returnTo: '/hosts',
        },
      });
    },
    async removeTarget(id) {
      const target = this.hostTargets.find((entry) => Number(entry.id) === Number(id));
      this.targetError = null;
      try {
        const approvalId = await resolveGovernanceApproval({
          actionKey: 'host_target_delete',
          entityType: 'host-target',
          entityRef: String(id),
          entityName: target?.name || target?.host || `Host target ${id}`,
          route: '/hosts',
        });
        await api.deleteHostTarget(id, approvalId ? { approvalId } : null);
        await this.loadHostTargets();
      } catch (error) {
        if (error.code === 'APPROVAL_REQUIRED') {
          this.targetError = 'Governance approval is required before removing this host target.';
          await handoffToGovernanceApproval(
            this.$router,
            error.approvalDraft,
            'Approval required before removing this saved host target.'
          );
          return;
        }
        this.targetError = error.message || 'Unable to remove host target';
      }
    },
  },
};
