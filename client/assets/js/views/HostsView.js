const HostsView = {
  components: { DataTable, StatusBadge, FloatingWindow },
  template: `
    <div class="animate-fade-in">
      <div class="section-head">
        <div>
          <h2 class="section-title">
            <span class="mdi mdi-server"></span>
            Hosts
          </h2>
          <p class="section-subtitle">Dense infrastructure inventory with quick-access host details.</p>
        </div>
        <button class="btn btn-primary" @click="loadHosts">
          <span class="mdi mdi-refresh"></span>
          Refresh
        </button>
      </div>

      <data-table :columns="columns" :data="hosts" :loading="loading" :searchable="true" @row-click="openProperties">
        <template #cell-name_label="{ row }">
          <span style="color:var(--text-primary);font-weight:500">{{ row.name_label || 'Unnamed Host' }}</span>
        </template>
        <template #cell-enabled="{ row }">
          <status-badge :status="row.enabled ? 'enabled' : 'disabled'"></status-badge>
        </template>
      </data-table>

      <floating-window :show="showProps" title="Host Properties" :width="620" :height="420" @close="showProps = false">
        <div v-if="selectedHost">
          <div class="property-grid">
            <span class="text-muted">Name</span><span>{{ selectedHost.name_label || '-' }}</span>
            <span class="text-muted">Address</span><span class="mono">{{ selectedHost.address || '-' }}</span>
            <span class="text-muted">Status</span><status-badge :status="selectedHost.enabled ? 'enabled' : 'disabled'"></status-badge>
            <span class="text-muted">UUID</span><span class="mono property-wrap">{{ selectedHost.uuid || '-' }}</span>
            <span class="text-muted">Tags</span><span>{{ truncateList(selectedHost.tags) }}</span>
            <span class="text-muted">Hostname</span><span>{{ selectedHost.hostname || '-' }}</span>
            <span class="text-muted">Resident VMs</span><span>{{ summarizeCount('attached', (selectedHost.resident_VMs || []).length) }}</span>
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
        </div>
      </floating-window>
    </div>
  `,
  data() {
    return {
      loading: true,
      hosts: [],
      selectedHost: null,
      showProps: false,
      metricsLoading: false,
      metricsError: null,
      hostMetrics: {},
      columns: [
        { key: 'name_label', label: 'Name' },
        { key: 'enabled', label: 'Status' },
        { key: 'address', label: 'Address' },
        { key: 'uuid', label: 'UUID' },
      ],
    };
  },
  async mounted() {
    if (!store.authenticated) {
      this.$router.push('/login');
      return;
    }
    await this.loadHosts();
  },
  methods: {
    formatBytes,
    formatPercent,
    truncateList,
    summarizeCount,
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
    },
    async openProperties(row) {
      this.selectedHost = row;
      this.showProps = true;
      this.metricsLoading = true;
      this.metricsError = null;
      this.hostMetrics = {};

      try {
        this.hostMetrics = await api.getHostMetrics(row.ref);
      } catch (error) {
        this.metricsError = error.message || 'Unable to load metrics';
      } finally {
        this.metricsLoading = false;
      }
    },
  },
};

