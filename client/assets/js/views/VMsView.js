const VMsView = {
  components: { DataTable, StatusBadge, FloatingWindow },
  template: `
    <div class="animate-fade-in">
      <div class="section-head">
        <div>
          <h2 class="section-title">
            <span class="mdi mdi-desktop-tower"></span>
            Virtual Machines
          </h2>
          <p class="section-subtitle">Searchable and sortable VM inventory with custom control windows.</p>
        </div>
        <button class="btn btn-primary" @click="loadVMs">
          <span class="mdi mdi-refresh"></span>
          Refresh
        </button>
      </div>

      <data-table :columns="columns" :data="vms" :loading="loading" :searchable="true" @row-click="openProperties">
        <template #cell-name_label="{ row }">
          <span style="color:var(--text-primary);font-weight:500">{{ row.name_label || 'Unnamed' }}</span>
        </template>
        <template #cell-power_state="{ row }">
          <status-badge :status="row.power_state"></status-badge>
        </template>
        <template #cell-VCPUs_at_startup="{ row }">
          <span class="mono">{{ row.VCPUs_at_startup || 0 }}</span>
        </template>
        <template #cell-memory_static_max="{ row }">
          <span class="mono">{{ formatBytes(row.memory_static_max) }}</span>
        </template>
      </data-table>

      <floating-window :show="showProps" title="VM Properties" :width="560" :height="420" @close="showProps = false">
        <div v-if="selectedVM">
          <div class="property-grid">
            <span class="text-muted">Name</span><span>{{ selectedVM.name_label || '-' }}</span>
            <span class="text-muted">Description</span><span>{{ selectedVM.name_description || '-' }}</span>
            <span class="text-muted">State</span><status-badge :status="selectedVM.power_state"></status-badge>
            <span class="text-muted">vCPUs</span><span class="mono">{{ selectedVM.VCPUs_at_startup || 0 }}</span>
            <span class="text-muted">Memory</span><span class="mono">{{ formatBytes(selectedVM.memory_static_max) }}</span>
            <span class="text-muted">UUID</span><span class="mono property-wrap">{{ selectedVM.uuid || '-' }}</span>
            <span class="text-muted">Tags</span><span>{{ truncateList(selectedVM.tags) }}</span>
          </div>

          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:16px">
            <button class="btn btn-primary btn-sm" v-if="selectedVM.power_state === 'Halted'" @click="vmAction('start', selectedVM.ref)">
              <span class="mdi mdi-play"></span>
              Start
            </button>
            <button class="btn btn-sm" v-if="selectedVM.power_state === 'Running'" @click="vmAction('shutdown', selectedVM.ref)">
              <span class="mdi mdi-stop"></span>
              Shutdown
            </button>
            <button class="btn btn-danger btn-sm" v-if="selectedVM.power_state === 'Running'" @click="vmAction('shutdown', selectedVM.ref, { force: true })">
              <span class="mdi mdi-power"></span>
              Force Off
            </button>
            <button class="btn btn-sm" v-if="selectedVM.power_state === 'Running'" @click="vmAction('reboot', selectedVM.ref)">
              <span class="mdi mdi-restart"></span>
              Reboot
            </button>
            <button class="btn btn-sm" v-if="selectedVM.power_state === 'Running'" @click="vmAction('suspend', selectedVM.ref)">
              <span class="mdi mdi-pause"></span>
              Suspend
            </button>
            <button class="btn btn-primary btn-sm" v-if="selectedVM.power_state === 'Suspended'" @click="vmAction('resume', selectedVM.ref)">
              <span class="mdi mdi-play-circle-outline"></span>
              Resume
            </button>
          </div>

          <div class="form-error" v-if="actionError" style="text-align:left">{{ actionError }}</div>
        </div>
      </floating-window>
    </div>
  `,
  data() {
    return {
      loading: true,
      vms: [],
      showProps: false,
      selectedVM: null,
      actionError: null,
      columns: [
        { key: 'name_label', label: 'Name' },
        { key: 'power_state', label: 'State' },
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
    await this.loadVMs();
  },
  methods: {
    formatBytes,
    truncateList,
    async loadVMs() {
      this.loading = true;
      try {
        const result = await api.getVMs();
        this.vms = result.data || [];
      } catch (error) {
        console.error(error);
      } finally {
        this.loading = false;
      }
    },
    openProperties(row) {
      this.selectedVM = row;
      this.showProps = true;
      this.actionError = null;
    },
    async vmAction(action, ref, options = {}) {
      this.actionError = null;
      try {
        await api.vmAction(action, ref, options);
        await this.loadVMs();
        const updated = this.vms.find((vm) => vm.ref === ref);
        if (updated) {
          this.selectedVM = updated;
        }
      } catch (error) {
        this.actionError = error.message || 'Action failed';
      }
    },
  },
};

