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
            <button class="btn" @click="$router.push('/inventory')">
              <span class="mdi mdi-sitemap-outline"></span>
              Open Inventory
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
            <div class="dash-card-label">Capacity Watch</div>
            <div class="metric-row">
              <span>Live Memory Used</span>
              <strong :class="'text-' + capacityColorClass(capacitySummary.memoryUsedPercent)">{{ formatPercentValue(capacitySummary.memoryUsedPercent) }}</strong>
            </div>
            <div class="metric-row">
              <span>VM Memory Commit</span>
              <strong :class="'text-' + capacityColorClass(capacitySummary.memoryCommitPercent)">{{ formatPercentValue(capacitySummary.memoryCommitPercent) }}</strong>
            </div>
            <div class="metric-row">
              <span>Storage Commit</span>
              <strong :class="'text-' + capacityColorClass(capacitySummary.storageUsedPercent)">{{ formatPercentValue(capacitySummary.storageUsedPercent) }}</strong>
            </div>
            <div class="metric-row">
              <span>Noisy-Neighbor Candidates</span>
              <strong class="text-amber">{{ capacitySummary.noisyNeighborCount || 0 }}</strong>
            </div>
            <div class="detail-section" style="margin-top:12px">
              <div class="capacity-callout">
                <strong>{{ capacityForecast.title }}</strong>
                <p>{{ capacityForecast.detail }}</p>
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

        <div class="dashboard-panels" v-if="capacityTopConsumers.length || capacityHotHosts.length">
          <div class="dash-card" v-if="capacityTopConsumers.length">
            <div class="dash-card-label">Top Consumers</div>
            <div class="stack-list">
              <div class="stack-item" v-for="vm in capacityTopConsumers.slice(0, 4)" :key="vm.ref">
                <div>
                  <strong>{{ vm.name_label || 'Virtual Machine' }}</strong>
                  <div class="text-muted mono" style="font-size:11px">{{ vm.hostName }} · {{ formatBytes(vm.memoryDemand) }} · {{ vm.vcpuDemand }} vCPU</div>
                </div>
                <status-badge :status="getUtilizationStatus(vm.riskPercentOfHost, { warning: 12, critical: 20 })"></status-badge>
              </div>
            </div>
          </div>

          <div class="dash-card" v-if="capacityHotHosts.length">
            <div class="dash-card-label">Placement Hotspots</div>
            <div class="stack-list">
              <div class="stack-item" v-for="host in capacityHotHosts.slice(0, 4)" :key="host.ref">
                <div>
                  <strong>{{ host.name_label || host.name || 'Host' }}</strong>
                  <div class="text-muted mono" style="font-size:11px">{{ formatPercentValue(host.pressurePercent) }} pressure · {{ host.assignedVms.length }} VMs · {{ formatPercentValue(host.imbalancePercent) }} skew</div>
                </div>
                <status-badge :status="host.status"></status-badge>
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
      capacity: null,
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
        pools: { key: 'pools', label: 'Pools', value: this.summary.poolCount || 0, icon: 'mdi-source-branch' },
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
    capacitySummary() {
      return this.capacity?.summary || {};
    },
    capacityForecast() {
      return this.capacity?.forecast || summarizeCapacityRisk();
    },
    capacityTopConsumers() {
      return this.capacity?.topVmConsumers || [];
    },
    capacityHotHosts() {
      return (this.capacity?.hostBalanceRows || []).filter((host) => ['critical', 'warning'].includes(host.status));
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
    formatBytes,
    formatPercentValue,
    formatTaskProgress,
    getMessageHeadline,
    getMessageSeverity,
    getUtilizationStatus,
    summarizeCount,
    stateCount(collection, key) {
      return collection && collection[key] ? collection[key] : 0;
    },
    capacityColorClass(percent) {
      const status = getUtilizationStatus(percent, { warning: 75, critical: 90 });
      if (status === 'critical') return 'red';
      if (status === 'warning') return 'amber';
      return 'green';
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
        const [summary, messages, tasks, hostsResult, srsResult, vmsResult] = await Promise.all([
          api.dashboard(),
          api.dashboardMessages().catch(() => []),
          api.getTasks().catch(() => ({ data: [] })),
          api.getHosts().catch(() => ({ data: [] })),
          api.getSRs().catch(() => ({ data: [] })),
          api.getVMs().catch(() => ({ data: [] })),
        ]);
        const hostRecords = hostsResult.data || [];
        const metricEntries = await Promise.all(hostRecords.map(async (host) => {
          try {
            const metrics = await api.getHostMetrics(host.ref);
            return [host.ref, metrics];
          } catch (error) {
            return [host.ref, { live: false, memory_total: 0, memory_free: 0 }];
          }
        }));
        const metricsByRef = Object.fromEntries(metricEntries);
        const capacityHosts = hostRecords.map((host) => {
          const metrics = metricsByRef[host.ref] || {};
          const memoryTotal = Number(metrics.memory_total || 0);
          const memoryFree = Number(metrics.memory_free || 0);
          const memoryUsed = Math.max(0, memoryTotal - memoryFree);

          return {
            ...host,
            live: Boolean(metrics.live),
            memoryTotal,
            memoryFree,
            memoryUsed,
            memoryUsagePercent: percentValue(memoryUsed, memoryTotal),
          };
        });

        const capacitySrs = (srsResult.data || []).map((sr) => ({
          ...sr,
          freeBytes: Math.max(0, Number(sr.physical_size || 0) - Number(sr.virtual_allocation || 0)),
          utilizationPercent: percentValue(Number(sr.virtual_allocation || 0), Number(sr.physical_size || 0)),
        }));

        this.summary = summary || {};
        this.messages = messages || [];
        this.tasks = tasks.data || [];
        this.capacity = buildCapacityAnalytics({
          hosts: capacityHosts,
          srs: capacitySrs,
          vms: vmsResult.data || [],
          tasks: tasks.data || [],
          messages: messages || [],
        });
      } catch (error) {
        console.error('Dashboard error:', error);
        this.capacity = null;
      } finally {
        this.loading = false;
      }
    },
  },
};
