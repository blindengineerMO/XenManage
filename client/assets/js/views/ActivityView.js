const ActivityView = {
  components: { DataTable, FloatingWindow, StatusBadge },
  template: `
    <div class="animate-fade-in">
      <div class="section-head">
        <div>
          <h2 class="section-title">
            <span class="mdi mdi-timeline-clock-outline"></span>
            Activity
          </h2>
          <p class="section-subtitle">Operational task history for lifecycle actions, migration work, and background management jobs.</p>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button
            v-for="filter in filters"
            :key="filter"
            class="btn btn-sm"
            :class="{ 'btn-primary': activeFilter === filter }"
            @click="activeFilter = filter">
            {{ filter }}
          </button>
          <button class="btn btn-primary" @click="loadTasks">
            <span class="mdi mdi-refresh"></span>
            Refresh
          </button>
        </div>
      </div>

      <data-table :columns="columns" :data="filteredTasks" :loading="loading" :searchable="true" @row-click="openProperties">
        <template #cell-status="{ row }">
          <status-badge :status="row.status || 'info'"></status-badge>
        </template>
        <template #cell-name_label="{ row }">
          <span style="color:var(--text-primary);font-weight:500">{{ row.name_label || 'Unnamed Task' }}</span>
        </template>
        <template #cell-progress="{ row }">
          <span class="mono">{{ formatTaskProgress(row.progress) }}</span>
        </template>
        <template #cell-finished="{ row }">
          <span class="mono">{{ formatDateTime(row.finished || row.created) }}</span>
        </template>
      </data-table>

      <floating-window :show="showProps" title="Task Detail" :width="720" :height="460" @close="showProps = false">
        <div v-if="selectedTask">
          <div class="property-grid">
            <span class="text-muted">Status</span><status-badge :status="selectedTask.status || 'info'"></status-badge>
            <span class="text-muted">Name</span><span>{{ selectedTask.name_label || '-' }}</span>
            <span class="text-muted">Description</span><span>{{ selectedTask.name_description || '-' }}</span>
            <span class="text-muted">Progress</span><span class="mono">{{ formatTaskProgress(selectedTask.progress) }}</span>
            <span class="text-muted">Created</span><span class="mono">{{ formatDateTime(selectedTask.created) }}</span>
            <span class="text-muted">Finished</span><span class="mono">{{ formatDateTime(selectedTask.finished) }}</span>
            <span class="text-muted">Resident On</span><span class="mono property-wrap">{{ selectedTask.resident_on || '-' }}</span>
            <span class="text-muted">UUID</span><span class="mono property-wrap">{{ selectedTask.uuid || '-' }}</span>
            <span class="text-muted">Result</span><span class="property-wrap">{{ taskResult(selectedTask) }}</span>
          </div>

          <div class="detail-section" v-if="selectedTask.error_info && selectedTask.error_info.length">
            <div class="detail-section-title">Error Info</div>
            <div class="stack-list">
              <div class="stack-item" v-for="(error, index) in selectedTask.error_info" :key="index">
                <div>
                  <strong>{{ String(error) }}</strong>
                </div>
                <span class="badge badge-error">error</span>
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
      activeFilter: 'all',
      filters: ['all', 'success', 'pending', 'failure'],
      tasks: [],
      selectedTask: null,
      showProps: false,
      columns: [
        { key: 'status', label: 'Status' },
        { key: 'name_label', label: 'Task' },
        { key: 'progress', label: 'Progress' },
        { key: 'finished', label: 'Finished' },
      ],
    };
  },
  computed: {
    sortedTasks() {
      return sortTasks(this.tasks);
    },
    filteredTasks() {
      if (this.activeFilter === 'all') {
        return this.sortedTasks;
      }

      return this.sortedTasks.filter((task) => (task.status || '').toLowerCase() === this.activeFilter);
    },
  },
  async mounted() {
    if (!store.authenticated) {
      this.$router.push('/login');
      return;
    }
    await this.loadTasks();
  },
  methods: {
    formatDateTime,
    formatTaskProgress,
    taskResult(task) {
      if (task.result) return String(task.result);
      if (task.error_info && task.error_info.length) return task.error_info.map(String).join(' | ');
      return '-';
    },
    async loadTasks() {
      this.loading = true;
      try {
        const result = await api.getTasks();
        this.tasks = result.data || [];
      } catch (error) {
        console.error(error);
        this.tasks = [];
      } finally {
        this.loading = false;
      }
    },
    openProperties(row) {
      this.selectedTask = row;
      this.showProps = true;
    },
  },
};

