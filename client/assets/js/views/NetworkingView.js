const NetworkingView = {
  components: { DataTable, FloatingWindow, StatusBadge },
  template: `
    <div class="animate-fade-in">
      <div class="section-head">
        <div>
          <h2 class="section-title">
            <span class="mdi mdi-lan"></span>
            Networks
          </h2>
          <p class="section-subtitle">Bridge-level visibility for shared, managed, and bonded network fabrics.</p>
        </div>
        <button class="btn btn-primary" @click="loadNetworks">
          <span class="mdi mdi-refresh"></span>
          Refresh
        </button>
      </div>

      <data-table :columns="columns" :data="networks" :loading="loading" :searchable="true" @row-click="openProperties">
        <template #cell-name_label="{ row }">
          <span style="color:var(--text-primary);font-weight:500">{{ row.name_label || 'Unnamed' }}</span>
        </template>
        <template #cell-bridge="{ row }">
          <span class="mono text-cyan">{{ row.bridge || '-' }}</span>
        </template>
        <template #cell-managed="{ row }">
          <status-badge :status="row.managed ? 'enabled' : 'disabled'"></status-badge>
        </template>
      </data-table>

      <floating-window :show="showProps" title="Network Properties" :width="620" :height="400" @close="showProps = false">
        <div v-if="selectedNetwork" class="property-grid">
          <span class="text-muted">Name</span><span>{{ selectedNetwork.name_label || '-' }}</span>
          <span class="text-muted">Bridge</span><span class="mono">{{ selectedNetwork.bridge || '-' }}</span>
          <span class="text-muted">Description</span><span>{{ selectedNetwork.name_description || selectedNetwork.description || '-' }}</span>
          <span class="text-muted">Managed</span><status-badge :status="selectedNetwork.managed ? 'enabled' : 'disabled'"></status-badge>
          <span class="text-muted">Default Locking Mode</span><span>{{ selectedNetwork.default_locking_mode || '-' }}</span>
          <span class="text-muted">UUID</span><span class="mono property-wrap">{{ selectedNetwork.uuid || '-' }}</span>
          <span class="text-muted">Tags</span><span>{{ truncateList(selectedNetwork.tags) }}</span>
          <span class="text-muted">Other Config</span><span class="mono property-wrap">{{ JSON.stringify(selectedNetwork.other_config || {}) }}</span>
        </div>
      </floating-window>
    </div>
  `,
  data() {
    return {
      loading: true,
      networks: [],
      selectedNetwork: null,
      showProps: false,
      columns: [
        { key: 'name_label', label: 'Name' },
        { key: 'bridge', label: 'Bridge' },
        { key: 'managed', label: 'Managed' },
        { key: 'uuid', label: 'UUID' },
      ],
    };
  },
  async mounted() {
    if (!store.authenticated) {
      this.$router.push('/login');
      return;
    }
    await this.loadNetworks();
  },
  methods: {
    truncateList,
    async loadNetworks() {
      this.loading = true;
      try {
        const result = await api.getNetworks();
        this.networks = result.data || [];
      } catch (error) {
        console.error(error);
      } finally {
        this.loading = false;
      }
    },
    openProperties(row) {
      this.selectedNetwork = row;
      this.showProps = true;
    },
  },
};

