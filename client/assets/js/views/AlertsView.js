const AlertsView = {
  components: { DataTable, FloatingWindow, StatusBadge },
  template: `
    <div class="animate-fade-in">
      <div class="section-head">
        <div>
          <h2 class="section-title">
            <span class="mdi mdi-bell-alert-outline"></span>
            Alerts
          </h2>
          <p class="section-subtitle">Severity-first event triage with searchable incident history and floating detail inspection.</p>
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
          <button class="btn btn-primary" @click="loadMessages">
            <span class="mdi mdi-refresh"></span>
            Refresh
          </button>
        </div>
      </div>

      <data-table :columns="columns" :data="filteredMessages" :loading="loading" :searchable="true" @row-click="openProperties">
        <template #cell-severity="{ row }">
          <status-badge :status="row.severity"></status-badge>
        </template>
        <template #cell-summary="{ row }">
          <span style="color:var(--text-primary);font-weight:500">{{ row.summary }}</span>
        </template>
        <template #cell-timestamp="{ row }">
          <span class="mono">{{ formatDateTime(row.timestamp) }}</span>
        </template>
      </data-table>

      <floating-window :show="showProps" title="Alert Detail" :width="680" :height="440" @close="showProps = false">
        <div v-if="selectedMessage">
          <div class="property-grid">
            <span class="text-muted">Severity</span><status-badge :status="selectedMessage.severity"></status-badge>
            <span class="text-muted">Summary</span><span>{{ selectedMessage.summary }}</span>
            <span class="text-muted">Class</span><span>{{ selectedMessage.cls || '-' }}</span>
            <span class="text-muted">Object</span><span class="mono property-wrap">{{ selectedMessage.obj_uuid || selectedMessage.ref }}</span>
            <span class="text-muted">Timestamp</span><span class="mono">{{ formatDateTime(selectedMessage.timestamp) }}</span>
            <span class="text-muted">Body</span><span class="property-wrap">{{ selectedMessage.body || '-' }}</span>
            <span class="text-muted">UUID</span><span class="mono property-wrap">{{ selectedMessage.uuid || '-' }}</span>
          </div>
        </div>
      </floating-window>
    </div>
  `,
  data() {
    return {
      loading: true,
      activeFilter: 'all',
      filters: ['all', 'critical', 'warning', 'info', 'notice'],
      messages: [],
      selectedMessage: null,
      showProps: false,
      columns: [
        { key: 'severity', label: 'Severity' },
        { key: 'summary', label: 'Summary' },
        { key: 'cls', label: 'Class' },
        { key: 'timestamp', label: 'Timestamp' },
      ],
    };
  },
  computed: {
    decoratedMessages() {
      return sortMessages(this.messages).map((message) => ({
        ...message,
        severity: getMessageSeverity(message),
        summary: getMessageHeadline(message),
      }));
    },
    filteredMessages() {
      if (this.activeFilter === 'all') {
        return this.decoratedMessages;
      }

      return this.decoratedMessages.filter((message) => message.severity === this.activeFilter);
    },
  },
  async mounted() {
    if (!store.authenticated) {
      this.$router.push('/login');
      return;
    }
    await this.loadMessages();
  },
  methods: {
    formatDateTime,
    async loadMessages() {
      this.loading = true;
      try {
        this.messages = await api.dashboardMessages();
      } catch (error) {
        console.error(error);
        this.messages = [];
      } finally {
        this.loading = false;
      }
    },
    openProperties(row) {
      this.selectedMessage = row;
      this.showProps = true;
    },
  },
};

