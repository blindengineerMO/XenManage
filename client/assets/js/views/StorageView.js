const StorageView = {
  components: { DataTable, FloatingWindow },
  template: `
    <div class="animate-fade-in">
      <div class="section-head">
        <div>
          <h2 class="section-title">
            <span class="mdi mdi-harddisk"></span>
            Storage Repositories
          </h2>
          <p class="section-subtitle">Capacity visibility and VDI inventory within floating detail windows.</p>
        </div>
        <button class="btn btn-primary" @click="loadSRs">
          <span class="mdi mdi-refresh"></span>
          Refresh
        </button>
      </div>

      <data-table :columns="columns" :data="srs" :loading="loading" :searchable="true" @row-click="openProperties">
        <template #cell-name_label="{ row }">
          <span style="color:var(--text-primary);font-weight:500">{{ row.name_label || 'Unnamed' }}</span>
        </template>
        <template #cell-type="{ row }">
          <span class="badge badge-info">{{ row.type || 'unknown' }}</span>
        </template>
        <template #cell-physical_size="{ row }">
          <span class="mono">{{ formatBytes(row.physical_size) }}</span>
        </template>
        <template #cell-virtual_allocation="{ row }">
          <span class="mono">{{ formatBytes(row.virtual_allocation) }}</span>
        </template>
      </data-table>

      <floating-window :show="showProps" title="Storage Repository" :width="720" :height="460" @close="showProps = false">
        <div v-if="selectedSR">
          <div class="property-grid">
            <span class="text-muted">Name</span><span>{{ selectedSR.name_label || '-' }}</span>
            <span class="text-muted">Type</span><span>{{ selectedSR.type || '-' }}</span>
            <span class="text-muted">Physical Size</span><span class="mono">{{ formatBytes(selectedSR.physical_size) }}</span>
            <span class="text-muted">Virtual Allocation</span><span class="mono">{{ formatBytes(selectedSR.virtual_allocation) }}</span>
            <span class="text-muted">UUID</span><span class="mono property-wrap">{{ selectedSR.uuid || '-' }}</span>
            <span class="text-muted">Tags</span><span>{{ truncateList(selectedSR.tags) }}</span>
          </div>

          <div class="detail-section">
            <div class="detail-section-title">Attached VDIs</div>
            <div class="stack-list">
              <div class="stack-item" v-if="vdiLoading">
                <span class="loading-spinner"></span>
                <span class="mono">Loading VDI inventory...</span>
              </div>
              <div class="stack-item" v-else-if="!vdis.length">
                <span class="mdi mdi-database-off-outline text-muted"></span>
                <span class="mono">No VDIs reported for this repository.</span>
              </div>
              <div class="stack-item" v-for="vdi in vdis.slice(0, 12)" :key="vdi.ref">
                <div>
                  <strong>{{ vdi.name_label || 'Unnamed VDI' }}</strong>
                  <div class="text-muted mono" style="font-size:11px">{{ formatBytes(vdi.virtual_size) }} · {{ vdi.type || 'disk' }}</div>
                </div>
                <span class="badge badge-info">{{ vdi.managed ? 'managed' : 'unmanaged' }}</span>
              </div>
            </div>
          </div>
        </div>
      </floating-window>
    </div>
  `,
  data() {
    return {
      loading: true,
      srs: [],
      selectedSR: null,
      showProps: false,
      vdiLoading: false,
      vdis: [],
      columns: [
        { key: 'name_label', label: 'Name' },
        { key: 'type', label: 'Type' },
        { key: 'physical_size', label: 'Physical Size' },
        { key: 'virtual_allocation', label: 'Virtual Allocation' },
        { key: 'uuid', label: 'UUID' },
      ],
    };
  },
  async mounted() {
    if (!store.authenticated) {
      this.$router.push('/login');
      return;
    }
    await this.loadSRs();
  },
  methods: {
    formatBytes,
    truncateList,
    async loadSRs() {
      this.loading = true;
      try {
        const result = await api.getSRs();
        this.srs = result.data || [];
      } catch (error) {
        console.error(error);
      } finally {
        this.loading = false;
      }
    },
    async openProperties(row) {
      this.selectedSR = row;
      this.showProps = true;
      this.vdiLoading = true;
      this.vdis = [];

      try {
        const result = await api.getSRVDIs(row.ref);
        this.vdis = result.data || [];
      } catch (error) {
        this.vdis = [];
      } finally {
        this.vdiLoading = false;
      }
    },
  },
};

