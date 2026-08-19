const TemplatesView = {
  components: { DataTable, FloatingWindow },
  template: `
    <div class="animate-fade-in">
      <div class="section-head">
        <div>
          <h2 class="section-title">
            <span class="mdi mdi-file-document-multiple-outline"></span>
            Templates
          </h2>
          <p class="section-subtitle">Golden image inventory for repeatable VM deployment and standards-driven operations.</p>
        </div>
        <button class="btn btn-primary" @click="loadTemplates">
          <span class="mdi mdi-refresh"></span>
          Refresh
        </button>
      </div>

      <data-table :columns="columns" :data="templates" :loading="loading" :searchable="true" @row-click="openProperties">
        <template #cell-name_label="{ row }">
          <span style="color:var(--text-primary);font-weight:500">{{ row.name_label || 'Unnamed Template' }}</span>
        </template>
        <template #cell-memory_static_max="{ row }">
          <span class="mono">{{ formatBytes(row.memory_static_max) }}</span>
        </template>
        <template #cell-VCPUs_at_startup="{ row }">
          <span class="mono">{{ row.VCPUs_at_startup || 0 }}</span>
        </template>
      </data-table>

      <floating-window :show="showProps" title="Template Properties" :width="620" :height="420" @close="showProps = false">
        <div v-if="selectedTemplate">
          <div class="property-grid">
            <span class="text-muted">Name</span><span>{{ selectedTemplate.name_label || '-' }}</span>
            <span class="text-muted">Description</span><span>{{ selectedTemplate.name_description || '-' }}</span>
            <span class="text-muted">vCPUs</span><span class="mono">{{ selectedTemplate.VCPUs_at_startup || 0 }}</span>
            <span class="text-muted">Memory</span><span class="mono">{{ formatBytes(selectedTemplate.memory_static_max) }}</span>
            <span class="text-muted">Boot Policy</span><span>{{ selectedTemplate.HVM_boot_policy || selectedTemplate.PV_bootloader || '-' }}</span>
            <span class="text-muted">UUID</span><span class="mono property-wrap">{{ selectedTemplate.uuid || '-' }}</span>
            <span class="text-muted">Tags</span><span>{{ truncateList(selectedTemplate.tags) }}</span>
            <span class="text-muted">Platform</span><span class="mono property-wrap">{{ JSON.stringify(selectedTemplate.platform || {}) }}</span>
          </div>

          <div class="detail-section">
            <div class="detail-section-title">Template Role</div>
            <div class="stack-item">
              <div>
                <strong>Standardized Provisioning Source</strong>
                <div class="text-muted mono" style="font-size:11px">Use this inventory to build golden image governance and repeatable deployment workflows.</div>
              </div>
              <span class="badge badge-info">library</span>
            </div>
          </div>
        </div>
      </floating-window>
    </div>
  `,
  data() {
    return {
      loading: true,
      templates: [],
      selectedTemplate: null,
      showProps: false,
      columns: [
        { key: 'name_label', label: 'Name' },
        { key: 'VCPUs_at_startup', label: 'vCPUs' },
        { key: 'memory_static_max', label: 'Memory' },
        { key: 'uuid', label: 'UUID' },
      ],
    };
  },
  async mounted() {
    if (!store.authenticated) {
      this.$router.push('/login');
      return;
    }
    await this.loadTemplates();
  },
  methods: {
    formatBytes,
    truncateList,
    async loadTemplates() {
      this.loading = true;
      try {
        const result = await api.getTemplates();
        this.templates = result.data || [];
      } catch (error) {
        console.error(error);
      } finally {
        this.loading = false;
      }
    },
    openProperties(row) {
      this.selectedTemplate = row;
      this.showProps = true;
    },
  },
};

