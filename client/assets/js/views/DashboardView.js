const DashboardView = {
  components: { StatusBadge },
  template: `
    <div class="animate-fade-in">
      <div v-if="loading" class="empty-state">
        <span class="loading-spinner"></span>
        <p style="margin-top:12px">Loading environment data...</p>
      </div>

      <template v-else>
        <div class="section-head">
          <div>
            <h2 class="section-title">
              <span class="mdi mdi-monitor-dashboard"></span>
              Dashboard
            </h2>
            <p class="section-subtitle">Drag summary cards to reorganize the command surface.</p>
          </div>
          <button class="btn btn-primary" @click="loadDashboard">
            <span class="mdi mdi-refresh"></span>
            Refresh
          </button>
        </div>

        <div class="dashboard-hero">
          <div>
            <div class="dash-card-label">Cluster Command Nexus</div>
            <h3>Unified telemetry, live inventory, and faster operator response.</h3>
            <p>Borrowing from enterprise control planes, XenMange now exposes templates, alert triage, and denser operational surfaces directly inside the dashboard.</p>
          </div>
          <div class="dashboard-hero-rail">
            <button class="btn btn-primary" @click="$router.push('/alerts')">
              <span class="mdi mdi-bell-alert-outline"></span>
              Open Alerts
            </button>
            <button class="btn" @click="$router.push('/capacity')">
              <span class="mdi mdi-chart-areaspline"></span>
              Open Capacity
            </button>
            <button class="btn" @click="$router.push('/resilience')">
              <span class="mdi mdi-shield-lock-outline"></span>
              Resilience
            </button>
            <button class="btn" @click="$router.push('/activity')">
              <span class="mdi mdi-timeline-clock-outline"></span>
              Open Activity
            </button>
            <button class="btn" @click="$router.push('/templates')">
              <span class="mdi mdi-file-document-multiple-outline"></span>
              Template Library
            </button>
          </div>
        </div>

        <div class="dash-grid">
          <div class="dash-card dash-card-draggable"
               v-for="card in summaryCards"
               :key="card.key"
               draggable="true"
               @dragstart="startCardDrag(card.key)"
               @dragover.prevent
               @drop="dropCard(card.key)">
            <div class="dash-card-label">{{ card.label }}</div>
            <div class="dash-card-value">{{ card.value }}</div>
            <div class="dash-card-icon mdi" :class="card.icon"></div>
          </div>
        </div>

        <div class="dashboard-panels">
          <div class="dash-card">
            <div class="dash-card-label">Runtime Overview</div>
            <div class="metric-row">
              <span>Running VMs</span>
              <strong class="text-green">{{ stateCount(summary.vmStates, 'running') }}</strong>
            </div>
            <div class="metric-row">
              <span>Halted VMs</span>
              <strong>{{ stateCount(summary.vmStates, 'halted') }}</strong>
            </div>
            <div class="metric-row">
              <span>Suspended VMs</span>
              <strong class="text-amber">{{ stateCount(summary.vmStates, 'suspended') }}</strong>
            </div>
            <div class="metric-row">
              <span>Enabled Hosts</span>
              <strong class="text-cyan">{{ stateCount(summary.hostStates, 'enabled') }}</strong>
            </div>
          </div>

          <div class="dash-card">
            <div class="dash-card-label">Operational Pulse</div>
            <div class="stack-list">
              <div class="stack-item" v-for="host in (summary.hosts || []).slice(0, 5)" :key="host.ref">
                <div>
                  <strong>{{ host.name || host.name_label || 'Host' }}</strong>
                  <div class="text-muted mono" style="font-size:11px">{{ host.address || host.uuid || host.ref }}</div>
                </div>
                <status-badge :status="host.enabled ? 'enabled' : 'disabled'"></status-badge>
              </div>
            </div>
          </div>

          <div class="dash-card">
            <div class="dash-card-label">Alert Triage</div>
            <div class="metric-row">
              <span>Critical</span>
              <strong class="text-red">{{ alertCounts.critical }}</strong>
            </div>
            <div class="metric-row">
              <span>Warning</span>
              <strong class="text-amber">{{ alertCounts.warning }}</strong>
            </div>
            <div class="metric-row">
              <span>Informational</span>
              <strong class="text-cyan">{{ alertCounts.info + alertCounts.notice }}</strong>
            </div>
            <div class="metric-row">
              <span>Recent Events</span>
              <strong>{{ messages.length }}</strong>
            </div>
          </div>
        </div>

        <div class="dashboard-panels">
          <div class="dash-card" v-if="sortedMessages.length">
            <div class="dash-card-label">Recent Alerts</div>
            <div class="stack-list">
              <div class="stack-item" v-for="message in sortedMessages.slice(0, 8)" :key="message.ref">
                <div>
                  <strong>{{ getMessageHeadline(message) }}</strong>
                  <div class="text-muted mono" style="font-size:11px">{{ formatDateTime(message.timestamp) }}</div>
                </div>
                <status-badge :status="getMessageSeverity(message)"></status-badge>
              </div>
            </div>
          </div>

          <div class="dash-card" v-if="summary.pools && summary.pools.length">
            <div class="dash-card-label">Pool Matrix</div>
            <div class="stack-list">
              <div class="stack-item" v-for="pool in summary.pools" :key="pool.ref">
                <div>
                  <strong>{{ pool.name_label || 'Unnamed Pool' }}</strong>
                  <div class="text-muted mono" style="font-size:11px">{{ pool.uuid || pool.ref }}</div>
                </div>
                <span class="badge badge-info">{{ summarizeCount('tags', (pool.tags || []).length) }}</span>
              </div>
            </div>
          </div>

          <div class="dash-card">
            <div class="dash-card-label">Template Momentum</div>
            <div class="metric-row">
              <span>Library Templates</span>
              <strong class="text-cyan">{{ summary.templateCount || 0 }}</strong>
            </div>
            <div class="metric-row">
              <span>Deployable Inventory</span>
              <strong>{{ summary.vmCount || 0 }} active workloads</strong>
            </div>
            <div class="metric-row">
              <span>Recommended Next Step</span>
              <strong class="text-green">Standardize golden images</strong>
            </div>
          </div>

          <div class="dash-card" v-if="sortedTasks.length">
            <div class="dash-card-label">Recent Tasks</div>
            <div class="stack-list">
              <div class="stack-item" v-for="task in sortedTasks.slice(0, 6)" :key="task.ref">
                <div>
                  <strong>{{ task.name_label || 'Task' }}</strong>
                  <div class="text-muted mono" style="font-size:11px">{{ formatTaskProgress(task.progress) }} · {{ formatDateTime(task.finished || task.created) }}</div>
                </div>
                <status-badge :status="task.status || 'info'"></status-badge>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>
  `,
  data() {
    return {
      loading: true,
      summary: {},
      messages: [],
      tasks: [],
      draggedCardKey: null,
      summaryOrder: ['hosts', 'vms', 'templates', 'storage', 'networks', 'pools'],
    };
  },
  computed: {
    summaryCards() {
      const cards = {
        hosts: { key: 'hosts', label: 'Hosts', value: this.summary.hostCount || 0, icon: 'mdi-server' },
        vms: { key: 'vms', label: 'Virtual Machines', value: this.summary.vmCount || 0, icon: 'mdi-desktop-tower' },
        templates: { key: 'templates', label: 'Templates', value: this.summary.templateCount || 0, icon: 'mdi-file-document-outline' },
        storage: { key: 'storage', label: 'Storage Repos', value: this.summary.srCount || 0, icon: 'mdi-harddisk' },
        networks: { key: 'networks', label: 'Networks', value: this.summary.networkCount || 0, icon: 'mdi-lan' },
        pools: { key: 'pools', label: 'Pools', value: this.summary.poolCount || 0, icon: 'mdi-cluster' },
      };

      return this.summaryOrder.map((key) => cards[key]).filter(Boolean);
    },
    sortedMessages() {
      return sortMessages(this.messages);
    },
    alertCounts() {
      return this.sortedMessages.reduce((counts, message) => {
        const severity = getMessageSeverity(message);
        counts[severity] = (counts[severity] || 0) + 1;
        return counts;
      }, { critical: 0, warning: 0, info: 0, notice: 0 });
    },
    sortedTasks() {
      return sortTasks(this.tasks);
    },
  },
  async mounted() {
    if (!store.authenticated) {
      this.$router.push('/login');
      return;
    }

    const savedOrder = window.localStorage.getItem('xenmange.dashboard.summaryOrder');
    if (savedOrder) {
      try {
        const parsed = JSON.parse(savedOrder);
        if (Array.isArray(parsed) && parsed.length) {
          this.summaryOrder = parsed;
        }
      } catch (error) {
        // Ignore invalid persisted layout data.
      }
    }

    await this.loadDashboard();
  },
  methods: {
    formatDateTime,
    formatTaskProgress,
    getMessageHeadline,
    getMessageSeverity,
    summarizeCount,
    stateCount(collection, key) {
      return collection && collection[key] ? collection[key] : 0;
    },
    startCardDrag(key) {
      this.draggedCardKey = key;
    },
    dropCard(targetKey) {
      if (!this.draggedCardKey || this.draggedCardKey === targetKey) return;

      const currentIndex = this.summaryOrder.indexOf(this.draggedCardKey);
      const targetIndex = this.summaryOrder.indexOf(targetKey);
      if (currentIndex === -1 || targetIndex === -1) return;

      const nextOrder = [...this.summaryOrder];
      const [moved] = nextOrder.splice(currentIndex, 1);
      nextOrder.splice(targetIndex, 0, moved);
      this.summaryOrder = nextOrder;
      this.draggedCardKey = null;
      window.localStorage.setItem('xenmange.dashboard.summaryOrder', JSON.stringify(nextOrder));
    },
    async loadDashboard() {
      this.loading = true;
      try {
        const [summary, messages, tasks] = await Promise.all([
          api.dashboard(),
          api.dashboardMessages().catch(() => []),
          api.getTasks().catch(() => ({ data: [] })),
        ]);
        this.summary = summary || {};
        this.messages = messages || [];
        this.tasks = tasks.data || [];
      } catch (error) {
        console.error('Dashboard error:', error);
      } finally {
        this.loading = false;
      }
    },
  },
};

