const CapacityView = {
  components: { FloatingWindow, StatusBadge },
  template: `
    <div class="animate-fade-in">
      <div v-if="loading" class="empty-state">
        <span class="loading-spinner"></span>
        <p style="margin-top:12px">Loading host telemetry and storage capacity...</p>
      </div>

      <template v-else>
        <div class="section-head">
          <div>
            <h2 class="section-title">
              <span class="mdi mdi-chart-areaspline"></span>
              Capacity
            </h2>
            <p class="section-subtitle">Live host memory pressure, storage commitment, and operator guidance for rebalancing before contention becomes outage-driven work.</p>
          </div>
          <button class="btn btn-primary" @click="loadCapacity">
            <span class="mdi mdi-refresh"></span>
            Refresh
          </button>
        </div>

        <div class="dashboard-hero capacity-hero">
          <div>
            <div class="dash-card-label">Capacity Sentinel</div>
            <h3>Headroom, saturation, and imbalance before they become incidents.</h3>
            <p>XenMange now consolidates live host telemetry and storage commitment into a dedicated workspace so operators can spot hot hosts, plan remediation windows, and decide where to rebalance workloads.</p>
          </div>
          <div class="dashboard-hero-rail">
            <button class="btn btn-primary" @click="$router.push('/hosts')">
              <span class="mdi mdi-server"></span>
              Open Hosts
            </button>
            <button class="btn" @click="$router.push('/storage')">
              <span class="mdi mdi-harddisk"></span>
              Open Storage
            </button>
            <button class="btn" @click="$router.push('/activity')">
              <span class="mdi mdi-timeline-clock-outline"></span>
              Active Tasks
            </button>
          </div>
        </div>

        <div class="dash-grid">
          <div class="dash-card" v-for="card in capacityCards" :key="card.key">
            <div class="dash-card-label">{{ card.label }}</div>
            <div class="dash-card-value" :class="card.valueClass || ''">{{ card.value }}</div>
            <div class="dash-card-icon mdi" :class="card.icon"></div>
            <div class="text-muted mono" style="margin-top:8px;font-size:11px">{{ card.detail }}</div>
          </div>
        </div>

        <div class="dashboard-panels">
          <div class="dash-card">
            <div class="dash-card-label">Host Pressure</div>
            <div class="stack-list" v-if="topHosts.length">
              <button class="stack-item stack-item-button"
                      v-for="host in topHosts"
                      :key="host.ref"
                      @click="openInspector('host', host)">
                <div class="capacity-item-main">
                  <strong>{{ host.name_label || host.hostname || 'Host' }}</strong>
                  <div class="text-muted mono" style="font-size:11px">{{ host.address || host.uuid || host.ref }} · {{ host.residentVmCount }} VMs</div>
                  <div class="capacity-meter">
                    <div class="capacity-meter-track">
                      <div class="capacity-meter-fill"
                           :class="hostCapacityStatus(host)"
                           :style="{ width: formatPercentValue(host.memoryUsagePercent) }"></div>
                    </div>
                    <span class="mono">{{ formatPercentValue(host.memoryUsagePercent) }} used</span>
                  </div>
                </div>
                <status-badge :status="hostCapacityStatus(host)"></status-badge>
              </button>
            </div>
            <div v-else class="empty-state" style="padding:20px 12px">No host telemetry available.</div>
          </div>

          <div class="dash-card">
            <div class="dash-card-label">Storage Saturation</div>
            <div class="stack-list" v-if="topStorage.length">
              <button class="stack-item stack-item-button"
                      v-for="sr in topStorage"
                      :key="sr.ref"
                      @click="openInspector('storage', sr)">
                <div class="capacity-item-main">
                  <strong>{{ sr.name_label || 'Storage Repository' }}</strong>
                  <div class="text-muted mono" style="font-size:11px">{{ formatBytes(sr.virtual_allocation) }} / {{ formatBytes(sr.physical_size) }} · {{ sr.type || 'unknown' }}</div>
                  <div class="capacity-meter">
                    <div class="capacity-meter-track">
                      <div class="capacity-meter-fill"
                           :class="storageCapacityStatus(sr)"
                           :style="{ width: formatPercentValue(sr.utilizationPercent) }"></div>
                    </div>
                    <span class="mono">{{ formatPercentValue(sr.utilizationPercent) }} allocated</span>
                  </div>
                </div>
                <status-badge :status="storageCapacityStatus(sr)"></status-badge>
              </button>
            </div>
            <div v-else class="empty-state" style="padding:20px 12px">No storage repositories reported.</div>
          </div>
        </div>

        <div class="dashboard-panels">
          <div class="dash-card">
            <div class="dash-card-label">Cluster Snapshot</div>
            <div class="metric-row">
              <span>Total Memory</span>
              <strong class="mono">{{ formatBytes(clusterMemory.total) }}</strong>
            </div>
            <div class="metric-row">
              <span>Free Memory</span>
              <strong class="mono text-cyan">{{ formatBytes(clusterMemory.free) }}</strong>
            </div>
            <div class="metric-row">
              <span>Storage Free</span>
              <strong class="mono text-green">{{ formatBytes(clusterStorage.free) }}</strong>
            </div>
            <div class="metric-row">
              <span>Live Hosts</span>
              <strong>{{ liveHosts }} / {{ hosts.length }}</strong>
            </div>
            <div class="metric-row">
              <span>Active Background Tasks</span>
              <strong class="text-amber">{{ activeTasks.length }}</strong>
            </div>
          </div>

          <div class="dash-card">
            <div class="dash-card-label">Operator Guidance</div>
            <div class="stack-list">
              <div class="stack-item" v-for="item in recommendations" :key="item.title">
                <div>
                  <strong>{{ item.title }}</strong>
                  <div class="text-muted" style="font-size:12px">{{ item.detail }}</div>
                </div>
                <status-badge :status="item.status"></status-badge>
              </div>
            </div>
          </div>
        </div>

        <floating-window :show="showInspector"
                         :title="inspectorTitle"
                         :width="760"
                         :height="480"
                         @close="closeInspector">
          <div v-if="selectedEntityType === 'host' && selectedEntity">
            <div class="property-grid">
              <span class="text-muted">Host</span><span>{{ selectedEntity.name_label || selectedEntity.hostname || '-' }}</span>
              <span class="text-muted">Address</span><span class="mono">{{ selectedEntity.address || '-' }}</span>
              <span class="text-muted">Status</span><status-badge :status="hostCapacityStatus(selectedEntity)"></status-badge>
              <span class="text-muted">Resident VMs</span><span>{{ selectedEntity.residentVmCount }}</span>
              <span class="text-muted">Memory Total</span><span class="mono">{{ formatBytes(selectedEntity.memoryTotal) }}</span>
              <span class="text-muted">Memory Used</span><span class="mono">{{ formatBytes(selectedEntity.memoryUsed) }}</span>
              <span class="text-muted">Memory Free</span><span class="mono">{{ formatBytes(selectedEntity.memoryFree) }}</span>
              <span class="text-muted">Utilization</span><span class="mono">{{ formatPercentValue(selectedEntity.memoryUsagePercent) }}</span>
              <span class="text-muted">UUID</span><span class="mono property-wrap">{{ selectedEntity.uuid || '-' }}</span>
              <span class="text-muted">Tags</span><span>{{ truncateList(selectedEntity.tags) }}</span>
            </div>

            <div class="detail-section">
              <div class="detail-section-title">Telemetry Guidance</div>
              <div class="capacity-callout">
                <strong>{{ selectedEntity.memoryUsagePercent >= 85 ? 'Rebalance recommended' : 'Capacity within normal operating envelope' }}</strong>
                <p>{{ hostRecommendation(selectedEntity) }}</p>
              </div>
            </div>
          </div>

          <div v-if="selectedEntityType === 'storage' && selectedEntity">
            <div class="property-grid">
              <span class="text-muted">Storage Repo</span><span>{{ selectedEntity.name_label || '-' }}</span>
              <span class="text-muted">Type</span><span>{{ selectedEntity.type || '-' }}</span>
              <span class="text-muted">Status</span><status-badge :status="storageCapacityStatus(selectedEntity)"></status-badge>
              <span class="text-muted">Physical Size</span><span class="mono">{{ formatBytes(selectedEntity.physical_size) }}</span>
              <span class="text-muted">Allocated</span><span class="mono">{{ formatBytes(selectedEntity.virtual_allocation) }}</span>
              <span class="text-muted">Free</span><span class="mono">{{ formatBytes(selectedEntity.freeBytes) }}</span>
              <span class="text-muted">Utilization</span><span class="mono">{{ formatPercentValue(selectedEntity.utilizationPercent) }}</span>
              <span class="text-muted">UUID</span><span class="mono property-wrap">{{ selectedEntity.uuid || '-' }}</span>
              <span class="text-muted">Tags</span><span>{{ truncateList(selectedEntity.tags) }}</span>
            </div>

            <div class="detail-section">
              <div class="detail-section-title">Storage Guidance</div>
              <div class="capacity-callout">
                <strong>{{ selectedEntity.utilizationPercent >= 90 ? 'Expansion or cleanup needed' : 'Storage headroom acceptable' }}</strong>
                <p>{{ storageRecommendation(selectedEntity) }}</p>
              </div>
            </div>
          </div>
        </floating-window>
      </template>
    </div>
  `,
  data() {
    return {
      loading: true,
      hosts: [],
      srs: [],
      tasks: [],
      selectedEntity: null,
      selectedEntityType: '',
      showInspector: false,
    };
  },
  computed: {
    topHosts() {
      return [...this.hosts].sort((left, right) => right.memoryUsagePercent - left.memoryUsagePercent);
    },
    topStorage() {
      return [...this.srs].sort((left, right) => right.utilizationPercent - left.utilizationPercent);
    },
    clusterMemory() {
      return this.hosts.reduce((accumulator, host) => {
        accumulator.total += host.memoryTotal;
        accumulator.used += host.memoryUsed;
        accumulator.free += host.memoryFree;
        return accumulator;
      }, { total: 0, used: 0, free: 0 });
    },
    clusterStorage() {
      return this.srs.reduce((accumulator, sr) => {
        accumulator.total += Number(sr.physical_size || 0);
        accumulator.allocated += Number(sr.virtual_allocation || 0);
        accumulator.free += sr.freeBytes;
        return accumulator;
      }, { total: 0, allocated: 0, free: 0 });
    },
    liveHosts() {
      return this.hosts.filter((host) => host.live).length;
    },
    hotHosts() {
      return this.hosts.filter((host) => host.memoryUsagePercent >= 85 && host.enabled);
    },
    storageRisks() {
      return this.srs.filter((sr) => sr.utilizationPercent >= 85);
    },
    activeTasks() {
      return this.tasks.filter((task) => ['pending', 'queued'].includes((task.status || '').toLowerCase()));
    },
    capacityCards() {
      const clusterMemoryUsed = percentValue(this.clusterMemory.used, this.clusterMemory.total);
      const clusterStorageUsed = percentValue(this.clusterStorage.allocated, this.clusterStorage.total);

      return [
        {
          key: 'memory',
          label: 'Host Memory',
          value: formatPercentValue(clusterMemoryUsed),
          detail: `${formatBytes(this.clusterMemory.used)} used of ${formatBytes(this.clusterMemory.total)}`,
          icon: 'mdi-memory',
          valueClass: this.hosts.length ? `text-${this.colorClass(this.hosts.length ? clusterMemoryUsed : 0)}` : '',
        },
        {
          key: 'storage',
          label: 'Storage Commit',
          value: formatPercentValue(clusterStorageUsed),
          detail: `${formatBytes(this.clusterStorage.allocated)} allocated of ${formatBytes(this.clusterStorage.total)}`,
          icon: 'mdi-database',
          valueClass: this.srs.length ? `text-${this.colorClass(this.srs.length ? clusterStorageUsed : 0)}` : '',
        },
        {
          key: 'hot-hosts',
          label: 'Pressure Hosts',
          value: String(this.hotHosts.length),
          detail: this.hotHosts.length ? `${this.hotHosts[0].name_label || 'Host'} is the highest-pressure node` : 'No hosts above the pressure threshold',
          icon: 'mdi-thermometer-alert',
          valueClass: this.hotHosts.length ? 'text-amber' : 'text-green',
        },
        {
          key: 'tasks',
          label: 'Active Tasks',
          value: String(this.activeTasks.length),
          detail: this.activeTasks.length ? 'Background maintenance or scans are still running' : 'No active background jobs reported',
          icon: 'mdi-progress-clock',
          valueClass: this.activeTasks.length ? 'text-cyan' : 'text-green',
        },
      ];
    },
    recommendations() {
      const items = [];

      if (this.hotHosts.length) {
        const host = this.hotHosts[0];
        items.push({
          title: 'Rebalance compute load',
          detail: `${host.name_label || 'Host'} is running at ${formatPercentValue(host.memoryUsagePercent)} memory utilization across ${host.residentVmCount} resident VMs.`,
          status: 'warning',
        });
      }

      if (this.storageRisks.length) {
        const sr = this.storageRisks[0];
        items.push({
          title: 'Expand or reclaim storage',
          detail: `${sr.name_label || 'Storage Repo'} is at ${formatPercentValue(sr.utilizationPercent)} allocation and should be reviewed before the next provisioning wave.`,
          status: sr.utilizationPercent >= 90 ? 'critical' : 'warning',
        });
      }

      if (this.activeTasks.length) {
        const task = this.activeTasks[0];
        items.push({
          title: 'Track active maintenance',
          detail: `${task.name_label || 'Background task'} is still in progress and may affect host availability or capacity planning decisions.`,
          status: 'pending',
        });
      }

      if (!items.length) {
        items.push({
          title: 'Capacity healthy',
          detail: 'Current telemetry is within expected operating thresholds. Use this surface to watch for drift before peak load periods.',
          status: 'success',
        });
      }

      return items;
    },
    inspectorTitle() {
      if (this.selectedEntityType === 'host') return 'Capacity Host Detail';
      if (this.selectedEntityType === 'storage') return 'Capacity Storage Detail';
      return 'Capacity Detail';
    },
  },
  async mounted() {
    if (!store.authenticated) {
      this.$router.push('/login');
      return;
    }

    await this.loadCapacity();
  },
  methods: {
    formatBytes,
    formatPercentValue,
    truncateList,
    hostCapacityStatus(host) {
      if (!host.enabled) return 'disabled';
      if (!host.live) return 'offline';
      return getUtilizationStatus(host.memoryUsagePercent, { warning: 70, critical: 85 });
    },
    storageCapacityStatus(sr) {
      return getUtilizationStatus(sr.utilizationPercent, { warning: 75, critical: 90 });
    },
    colorClass(percent) {
      const status = getUtilizationStatus(percent, { warning: 75, critical: 90 });
      if (status === 'critical') return 'red';
      if (status === 'warning') return 'amber';
      return 'green';
    },
    hostRecommendation(host) {
      if (host.memoryUsagePercent >= 85) {
        return `Consider migrating one or more workloads from ${host.name_label || 'this host'} or scheduling additional capacity before the next demand spike.`;
      }
      if (!host.live) {
        return 'Live telemetry is unavailable for this host, so verify its metrics pipeline before relying on recent utilization data.';
      }
      return 'This host currently has enough headroom for normal operations, but keep it in rotation when reviewing balancing opportunities.';
    },
    storageRecommendation(sr) {
      if (sr.utilizationPercent >= 90) {
        return 'Immediate expansion, cleanup, or workload redistribution is recommended to avoid provisioning failures and snapshot pressure.';
      }
      if (sr.utilizationPercent >= 75) {
        return 'Capacity remains usable, but this repository should be watched during template deployments or snapshot-heavy maintenance.';
      }
      return 'Storage headroom is currently healthy for standard provisioning and maintenance activity.';
    },
    openInspector(type, entity) {
      this.selectedEntityType = type;
      this.selectedEntity = entity;
      this.showInspector = true;
    },
    closeInspector() {
      this.showInspector = false;
      this.selectedEntity = null;
      this.selectedEntityType = '';
    },
    async loadCapacity() {
      this.loading = true;
      try {
        const [hostsResult, srsResult, tasksResult] = await Promise.all([
          api.getHosts(),
          api.getSRs(),
          api.getTasks(),
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

        this.hosts = hostRecords.map((host) => {
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
            residentVmCount: Array.isArray(host.resident_VMs) ? host.resident_VMs.length : 0,
          };
        });

        this.srs = (srsResult.data || []).map((sr) => {
          const physical = Number(sr.physical_size || 0);
          const allocation = Number(sr.virtual_allocation || 0);
          const freeBytes = Math.max(0, physical - allocation);

          return {
            ...sr,
            freeBytes,
            utilizationPercent: percentValue(allocation, physical),
          };
        });

        this.tasks = tasksResult.data || [];
      } catch (error) {
        console.error(error);
        this.hosts = [];
        this.srs = [];
        this.tasks = [];
      } finally {
        this.loading = false;
      }
    },
  },
};

