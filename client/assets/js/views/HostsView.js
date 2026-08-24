const HostsView = {
  components: { DataTable, StatusBadge, FloatingWindow, HostRegistrationForm, 'metric-trend-card': MetricTrendCard },
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
                  <span v-if="target.vault_credential_id"> · vault credential linked</span>
                </div>
              </div>
              <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;justify-content:flex-end">
                <status-badge :status="target.mode === 'pool-member' ? 'pending' : 'info'"></status-badge>
                <button class="btn btn-sm" @click="openRegistration(target)">
                  <span class="mdi mdi-pencil-outline"></span>
                </button>
                <button class="btn btn-sm" @click="removeTarget(target.id)">
                  <span class="mdi mdi-delete-outline"></span>
                </button>
              </div>
            </div>
          </div>
          <div v-else class="empty-state" style="padding:18px 12px">Register standalone hosts or queue hosts as members of a saved pool target.</div>
          <div class="form-error" v-if="targetError" style="text-align:left">{{ targetError }}</div>
        </div>
      </div>

      <data-table :columns="columns" :data="hosts" :loading="loading" :searchable="true" @row-click="openProperties">
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
            <span class="text-muted">Address</span><span class="mono">{{ selectedHost.address || '-' }}</span>
            <span class="text-muted">Status</span><status-badge :status="selectedHost.enabled ? 'enabled' : 'disabled'"></status-badge>
            <span class="text-muted">Pool Membership</span><span>{{ selectedHostPool ? (selectedHostPool.name_label || selectedHostPool.uuid || selectedHostPool.ref) : 'Unknown / standalone' }}</span>
            <span class="text-muted">UUID</span><span class="mono property-wrap">{{ selectedHost.uuid || '-' }}</span>
            <span class="text-muted">Tags</span><span>{{ truncateList(selectedHost.tags) }}</span>
            <span class="text-muted">Hostname</span><span>{{ selectedHost.hostname || '-' }}</span>
            <span class="text-muted">Resident VMs</span><span>{{ summarizeCount('attached', (selectedHost.resident_VMs || []).length) }}</span>
            <span class="text-muted">Storage Paths</span><span>{{ summarizeCount('repositories', selectedHostStorageRecords.length) }}</span>
            <span class="text-muted">Network Paths</span><span>{{ summarizeCount('networks', selectedHostNetworkRecords.length) }}</span>
            <span class="text-muted">Other Config</span><span class="mono property-wrap">{{ JSON.stringify(selectedHost.other_config || {}) }}</span>
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
            <div class="detail-section-title">Historical Memory Trend</div>
            <metric-trend-card
              title="Host Memory Utilization"
              subtitle="Persisted memory-pressure history for this host."
              :series="hostMetricSeries('memory_used_percent')"
              value-kind="percent"
              :accent-status="historyStatus(hostMetricSeries('memory_used_percent'), { warning: 70, critical: 85 })">
            </metric-trend-card>
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
                       :height="560"
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
    selectedHostPool() {
      return this.resolveHostPool(this.selectedHost);
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
  },
  methods: {
    formatBytes,
    formatPercent,
    truncateList,
    summarizeCount,
    hostMetricSeries(metricName) {
      return (this.hostMetricHistory.metrics || []).find((entry) => entry.metricName === metricName)?.points || [];
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
      };
      this.showRegistration = true;
    },
    async submitTarget(payload) {
      this.targetError = null;
      try {
        if (this.editingTargetId) {
          await api.updateHostTarget(this.editingTargetId, payload);
        } else {
          await api.saveHostTarget(payload);
        }
        this.showRegistration = false;
        await this.loadHostTargets();
      } catch (error) {
        this.targetError = error.message || 'Unable to save host target';
      }
    },
    async removeTarget(id) {
      try {
        await api.deleteHostTarget(id);
        await this.loadHostTargets();
      } catch (error) {
        this.targetError = error.message || 'Unable to remove host target';
      }
    },
  },
};
