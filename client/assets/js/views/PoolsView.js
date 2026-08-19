const PoolsView = {
  components: { DataTable, FloatingWindow },
  template: `
    <div class="animate-fade-in">
      <div class="section-head">
        <div>
          <h2 class="section-title">
            <span class="mdi mdi-cluster"></span>
            Pools
          </h2>
          <p class="section-subtitle">Live pool topology with quick-reference metadata.</p>
        </div>
        <button class="btn btn-primary" @click="loadPools">
          <span class="mdi mdi-refresh"></span>
          Refresh
        </button>
      </div>

      <data-table :columns="columns" :data="pools" :loading="loading" :searchable="true" @row-click="openProperties">
        <template #cell-name_label="{ row }">
          <span style="color:var(--text-primary);font-weight:500">{{ row.name_label || 'Unnamed Pool' }}</span>
        </template>
        <template #cell-tags="{ row }">
          <span class="mono">{{ truncateList(row.tags) }}</span>
        </template>
      </data-table>

      <floating-window :show="showProps" title="Pool Properties" :width="620" :height="360" @close="showProps = false">
        <div v-if="selectedPool" class="property-grid">
          <span class="text-muted">Name</span><span>{{ selectedPool.name_label || '-' }}</span>
          <span class="text-muted">Description</span><span>{{ selectedPool.name_description || '-' }}</span>
          <span class="text-muted">UUID</span><span class="mono property-wrap">{{ selectedPool.uuid || '-' }}</span>
          <span class="text-muted">Default SR</span><span class="mono property-wrap">{{ selectedPool.default_SR || '-' }}</span>
          <span class="text-muted">Migration Network</span><span class="mono property-wrap">{{ selectedPool.migration_network || '-' }}</span>
          <span class="text-muted">Tags</span><span>{{ truncateList(selectedPool.tags) }}</span>
          <span class="text-muted">Other Config</span><span class="mono property-wrap">{{ JSON.stringify(selectedPool.other_config || {}) }}</span>
        </div>
      </floating-window>
    </div>
  `,
  data() {
    return {
      loading: true,
      pools: [],
      selectedPool: null,
      showProps: false,
      columns: [
        { key: 'name_label', label: 'Name' },
        { key: 'uuid', label: 'UUID' },
        { key: 'default_SR', label: 'Default SR' },
        { key: 'tags', label: 'Tags' },
      ],
    };
  },
  async mounted() {
    if (!store.authenticated) {
      this.$router.push('/login');
      return;
    }
    await this.loadPools();
  },
  methods: {
    truncateList,
    async loadPools() {
      this.loading = true;
      try {
        const result = await api.getPools();
        this.pools = result.data || [];
      } catch (error) {
        console.error(error);
      } finally {
        this.loading = false;
      }
    },
    openProperties(row) {
      this.selectedPool = row;
      this.showProps = true;
    },
  },
};

