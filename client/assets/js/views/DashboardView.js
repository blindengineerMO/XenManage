function dashboardScopeTargets() {
  return getVFabricScopeTargets();
}

async function loadDashboardAcrossScope(load) {
  const targets = dashboardScopeTargets();
  if (!targets.length) return [await load('')];
  return Promise.all(targets.map((target) => load(target.targetKey)));
}

function mergeDashboardSummaries(summaries = []) {
  const countKeys = ['poolCount', 'hostCount', 'vmCount', 'templateCount', 'srCount', 'networkCount'];
  const merged = { vmStates: {}, hostStates: {}, pools: [], hosts: [] };
  summaries.forEach((summary) => {
    countKeys.forEach((key) => { merged[key] = Number(merged[key] || 0) + Number(summary?.[key] || 0); });
    ['vmStates', 'hostStates'].forEach((key) => {
      Object.entries(summary?.[key] || {}).forEach(([state, value]) => {
        merged[key][state] = Number(merged[key][state] || 0) + Number(value || 0);
      });
    });
    merged.pools.push(...(summary?.pools || []));
    merged.hosts.push(...(summary?.hosts || []));
  });
  return merged;
}

const DashboardView = {
  components: { StatusBadge, FloatingWindow, PoolPropertiesWindow, HostPropertiesWindow },
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
            <p class="section-subtitle">Select a summary card to open its workspace.</p>
            <p class="section-subtitle text-cyan" v-if="store.vFabricScope?.scope">Read scope: {{ store.vFabricScope.scope.name }} · {{ store.vFabricScope.attachedTargets.length }} attached member{{ store.vFabricScope.attachedTargets.length === 1 ? '' : 's' }}</p>
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
          <button class="dash-card dash-card-nav"
               v-for="card in summaryCards"
               :key="card.key"
               type="button"
               @click="openSummaryCard(card)">
            <div class="dash-card-label">{{ card.label }}</div>
            <div class="dash-card-value">{{ card.value }}</div>
            <div class="dash-card-icon mdi" :class="card.icon"></div>
          </button>
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
              <button class="stack-item stack-item-button"
                   v-for="message in sortedMessages.slice(0, 8)"
                   :key="message.ref"
                   type="button"
                   @click="openAlertDetails(message)">
                <div>
                  <strong>{{ getMessageHeadline(message) }}</strong>
                  <div class="text-muted mono" style="font-size:11px">{{ formatDateTime(message.timestamp) }}</div>
                </div>
                <status-badge :status="getMessageSeverity(message)"></status-badge>
              </button>
            </div>
          </div>

          <div class="dash-card" v-if="summary.pools && summary.pools.length">
            <div class="dash-card-label">Pool Matrix</div>
            <div class="stack-list">
              <button class="stack-item stack-item-button"
                   v-for="pool in summary.pools"
                   :key="pool.ref"
                   type="button"
                   @click="openPoolDetails(pool)">
                <div>
                  <strong>{{ pool.name_label || 'Unnamed Pool' }}</strong>
                  <div class="text-muted mono" style="font-size:11px">{{ pool.uuid || pool.ref }}</div>
                </div>
                <span class="badge badge-info">{{ summarizeCount('tags', (pool.tags || []).length) }}</span>
              </button>
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
              <button class="stack-item stack-item-button"
                      v-for="task in sortedTasks.slice(0, 6)"
                      :key="task.ref"
                      type="button"
                      @click="openTaskDetails(task)">
                <div>
                  <strong>{{ task.name_label || 'Task' }}</strong>
                  <div class="text-muted mono" style="font-size:11px">{{ formatTaskProgress(task.progress) }} · {{ formatDateTime(task.finished || task.created) }}</div>
                </div>
                <status-badge :status="task.status || 'info'"></status-badge>
              </button>
            </div>
          </div>

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

          <div class="dash-card" v-if="topHostConsumers.length">
            <div class="dash-card-label">Top Host Consumers</div>
            <div class="stack-list">
              <button class="stack-item stack-item-button"
                      v-for="host in topHostConsumers"
                      :key="host.ref"
                      type="button"
                      @click="openHostDetails(host)">
                <div>
                  <strong>{{ host.name_label || host.hostname || 'Host' }}</strong>
                  <div class="text-muted mono" style="font-size:11px">
                    {{ formatBytes(host.memoryUsed) }} consumed · {{ formatPercentValue(host.memoryUsagePercent) }} memory · {{ (host.assignedVms || []).length }} VMs
                  </div>
                </div>
                <status-badge :status="host.status"></status-badge>
              </button>
            </div>
          </div>
        </div>

        <floating-window
          title="Alert Details"
          :show="Boolean(selectedAlert)"
          :width="680"
          :height="500"
          :x="360"
          :y="96"
          @close="selectedAlert = null">
          <template v-if="selectedAlert">
            <div style="display:flex;justify-content:space-between;gap:16px;align-items:flex-start;margin-bottom:16px">
              <div>
                <div class="dash-card-label">{{ getMessageSeverity(selectedAlert) }} alert</div>
                <h3 style="margin:4px 0 0;font-family:var(--font-heading);color:var(--text-primary)">{{ getMessageHeadline(selectedAlert) }}</h3>
              </div>
              <status-badge :status="getMessageSeverity(selectedAlert)"></status-badge>
            </div>

            <div class="detail-section">
              <div class="detail-label">Full message</div>
              <pre class="alert-detail-message">{{ fullAlertMessage(selectedAlert) }}</pre>
            </div>

            <div class="alert-detail-grid" style="margin-top:14px">
              <div class="alert-detail-item"><span>Time</span><strong>{{ formatDateTime(selectedAlert.timestamp) }}</strong></div>
              <div class="alert-detail-item"><span>Class</span><strong>{{ selectedAlert.cls || selectedAlert.class || '-' }}</strong></div>
              <div class="alert-detail-item"><span>Object UUID</span><strong class="mono">{{ selectedAlert.obj_uuid || selectedAlert.objectUuid || '-' }}</strong></div>
              <div class="alert-detail-item"><span>Alert UUID</span><strong class="mono">{{ selectedAlert.uuid || '-' }}</strong></div>
              <div class="alert-detail-item"><span>Reference</span><strong class="mono">{{ selectedAlert.ref || '-' }}</strong></div>
            </div>

            <div class="detail-section" style="margin-top:14px">
              <div class="detail-label">Full event payload</div>
              <pre class="alert-detail-payload">{{ formatAlertPayload(selectedAlert) }}</pre>
            </div>
          </template>
        </floating-window>

        <floating-window
          title="Task Details"
          :show="Boolean(selectedTask)"
          :width="680"
          :height="500"
          :x="380"
          :y="112"
          @close="selectedTask = null">
          <template v-if="selectedTask">
            <div style="display:flex;justify-content:space-between;gap:16px;align-items:flex-start;margin-bottom:16px">
              <div>
                <div class="dash-card-label">Task execution</div>
                <h3 style="margin:4px 0 0;font-family:var(--font-heading);color:var(--text-primary)">{{ selectedTask.name_label || 'Task' }}</h3>
              </div>
              <status-badge :status="selectedTask.status || 'info'"></status-badge>
            </div>

            <div class="detail-section">
              <div class="detail-label">Description</div>
              <p class="task-detail-description">{{ selectedTask.name_description || 'No description was supplied.' }}</p>
            </div>

            <div class="alert-detail-grid" style="margin-top:14px">
              <div class="alert-detail-item"><span>Progress</span><strong>{{ formatTaskProgress(selectedTask.progress) }}</strong></div>
              <div class="alert-detail-item"><span>Created</span><strong>{{ formatDateTime(selectedTask.created) }}</strong></div>
              <div class="alert-detail-item"><span>Finished</span><strong>{{ selectedTask.finished ? formatDateTime(selectedTask.finished) : 'In progress' }}</strong></div>
              <div class="alert-detail-item"><span>Resident On</span><strong class="mono">{{ selectedTask.resident_on || '-' }}</strong></div>
              <div class="alert-detail-item"><span>UUID</span><strong class="mono">{{ selectedTask.uuid || '-' }}</strong></div>
              <div class="alert-detail-item"><span>Reference</span><strong class="mono">{{ selectedTask.ref || '-' }}</strong></div>
            </div>

            <div class="detail-section" style="margin-top:14px">
              <div class="detail-label">Result or error</div>
              <pre class="alert-detail-message">{{ fullTaskResult(selectedTask) }}</pre>
            </div>

            <div class="detail-section" style="margin-top:14px">
              <div class="detail-label">Full task payload</div>
              <pre class="alert-detail-payload">{{ formatTaskPayload(selectedTask) }}</pre>
            </div>
          </template>
        </floating-window>

        <pool-properties-window
          :show="Boolean(selectedPool)"
          :selected-pool="selectedPool"
          :selected-pool-default-storage-label="selectedPoolDefaultStorageLabel"
          :selected-pool-migration-compression-label="selectedPoolMigrationCompressionLabel"
          :selected-pool-wlb-enabled-label="selectedPoolWlbEnabledLabel"
          :selected-pool-wlb-url-label="selectedPoolWlbUrlLabel"
          :selected-pool-vswitch-controller-label="selectedPoolVswitchControllerLabel"
          :selected-pool-igmp-snooping-label="selectedPoolIgmpSnoopingLabel"
          :selected-pool-ha-enabled-label="selectedPoolHaEnabledLabel"
          :selected-pool-ha-tolerance-label="selectedPoolHaToleranceLabel"
          :selected-pool-other-config-summary="selectedPoolOtherConfigSummary"
          :selected-pool-hosts="selectedPoolHosts"
          :pool-host-columns="poolHostColumns"
          :pool-updates="poolUpdates"
          :pool-updates-loading="poolUpdatesLoading"
          :pool-updates-error="poolDetailsError"
          :resolve-host-label="resolvePoolHostLabel"
          @close="closePoolDetails"
          @open-pool-identity="openPoolsWorkspace"
          @open-pool-context="openPoolsWorkspace"
          @open-pool-ha="openPoolsWorkspace"
          @open-pool-join="openPoolsWorkspace"
          @eject-host="openPoolsWorkspace">
        </pool-properties-window>

        <host-properties-window
          :show="Boolean(selectedDashboardHost)"
          :selected-host="selectedDashboardHost"
          :selected-host-pool="selectedDashboardHostPool"
          :selected-host-maintenance-mode="selectedDashboardHostMaintenanceMode"
          :selected-host-summary-profile="selectedDashboardHostSummaryProfile"
          :selected-host-relationship-profile="selectedDashboardHostRelationshipProfile"
          :metrics-loading="dashboardHostDetailsLoading"
          :metrics-error="dashboardHostMetricsError"
          :host-metrics="dashboardHostMetrics"
          :host-metric-history="dashboardHostMetricHistory"
          :inventory-loading="dashboardHostDetailsLoading"
          :inventory-error="dashboardHostInventoryError"
          :inventory-columns="hostInventoryColumns"
          @close="closeHostDetails"
          @open-host-identity="openHostsWorkspace"
          @open-host-context="openHostsWorkspace"
          @open-host-logging="openHostsWorkspace"
          @open-host-guest-cpu="openHostsWorkspace"
          @open-host-scheduler="openHostsWorkspace"
          @open-host-platform="openHostsWorkspace"
          @enter-maintenance="openHostsWorkspace"
          @exit-maintenance="openHostsWorkspace"
          @power-action="openHostsWorkspace"
          @toggle-multipathing="openHostsWorkspace">
        </host-properties-window>
      </template>
    </div>
  `,
  data() {
    return {
      store,
      loading: true,
      summary: {},
      messages: [],
      tasks: [],
      capacity: null,
      selectedAlert: null,
      selectedTask: null,
      selectedPool: null,
      poolDetailsError: '',
      poolDetailHosts: [],
      poolDetailStorage: [],
      poolDetailVms: [],
      poolUpdates: { kind: '', updates: [] },
      poolUpdatesLoading: false,
      selectedDashboardHost: null,
      dashboardHostDetailsLoading: false,
      dashboardHostMetricsError: '',
      dashboardHostInventoryError: '',
      dashboardHostMetrics: {},
      dashboardHostMetricHistory: { metrics: [] },
      dashboardHostRelatedPools: [],
      dashboardHostRelatedVms: [],
      dashboardHostRelatedStorage: [],
      dashboardHostRelatedNetworks: [],
      hostInventoryColumns: [
        { key: 'kind', label: 'Kind' },
        { key: 'name', label: 'Name' },
        { key: 'detail', label: 'Detail' },
        { key: 'status', label: 'Status' },
        { key: 'ref', label: 'Reference' },
      ],
      poolHostColumns: [
        { key: 'name_label', label: 'Host' },
        { key: 'role', label: 'Role' },
        { key: 'enabled', label: 'Status' },
        { key: 'address', label: 'Address' },
        { key: 'residentVmCount', label: 'VMs' },
        { key: 'tags', label: 'Tags' },
        { key: 'actions', label: '' },
      ],
      summaryOrder: ['hosts', 'vms', 'templates', 'storage', 'networks', 'pools'],
    };
  },
  computed: {
    summaryCards() {
      const cards = {
        hosts: { key: 'hosts', label: 'Hosts', value: this.summary.hostCount || 0, icon: 'mdi-server', route: '/hosts' },
        vms: { key: 'vms', label: 'Virtual Machines', value: this.summary.vmCount || 0, icon: 'mdi-desktop-tower', route: '/vms' },
        templates: { key: 'templates', label: 'Templates', value: this.summary.templateCount || 0, icon: 'mdi-file-document-outline', route: '/templates' },
        storage: { key: 'storage', label: 'Storage Repos', value: this.summary.srCount || 0, icon: 'mdi-harddisk', route: '/storage' },
        networks: { key: 'networks', label: 'Networks', value: this.summary.networkCount || 0, icon: 'mdi-lan', route: '/networking' },
        pools: { key: 'pools', label: 'Pools', value: this.summary.poolCount || 0, icon: 'mdi-source-branch', route: '/pools' },
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
    topHostConsumers() {
      return [...(this.capacity?.hostBalanceRows || [])]
        .sort((left, right) => Number(right.memoryUsed || 0) - Number(left.memoryUsed || 0))
        .slice(0, 5);
    },
    selectedDashboardHostPool() {
      return resolveHostPool(this.selectedDashboardHost, this.dashboardHostRelatedPools);
    },
    selectedDashboardHostMaintenanceMode() {
      return resolveHostMaintenanceState(this.selectedDashboardHost);
    },
    selectedDashboardHostSummaryProfile() {
      return buildSelectedHostSummaryProfile(this.selectedDashboardHost);
    },
    selectedDashboardHostRelationshipProfile() {
      return buildSelectedHostRelationshipProfile({
        selectedHost: this.selectedDashboardHost,
        selectedHostPool: this.selectedDashboardHostPool,
        relatedVMs: this.dashboardHostRelatedVms,
        relatedStorage: this.dashboardHostRelatedStorage,
        relatedNetworks: this.dashboardHostRelatedNetworks,
        metricsLoading: this.dashboardHostDetailsLoading,
        hostMetrics: this.dashboardHostMetrics,
      });
    },
    selectedPoolHosts() {
      return buildSelectedPoolHosts(this.selectedPool, this.poolDetailHosts, [this.selectedPool])
        .map((host) => ({
          ...host,
          residentVmCount: this.poolDetailVms.filter((vm) => vm.resident_on === host.ref).length,
        }));
    },
    selectedPoolDefaultStorageLabel() {
      return resolvePoolStorageLabel(this.poolDetailStorage, this.selectedPool?.default_SR);
    },
    selectedPoolMigrationCompressionLabel() {
      return buildSelectedPoolMigrationCompressionLabel(this.selectedPool);
    },
    selectedPoolWlbEnabledLabel() {
      return buildSelectedPoolWlbEnabledLabel(this.selectedPool);
    },
    selectedPoolWlbUrlLabel() {
      return buildSelectedPoolWlbUrlLabel(this.selectedPool);
    },
    selectedPoolVswitchControllerLabel() {
      return buildSelectedPoolVswitchControllerLabel(this.selectedPool);
    },
    selectedPoolIgmpSnoopingLabel() {
      return buildSelectedPoolIgmpSnoopingLabel(this.selectedPool);
    },
    selectedPoolHaEnabledLabel() {
      return buildSelectedPoolHaEnabledLabel(this.selectedPool);
    },
    selectedPoolHaToleranceLabel() {
      return buildSelectedPoolHaToleranceLabel(this.selectedPool);
    },
    selectedPoolOtherConfigSummary() {
      return buildSelectedPoolOtherConfigSummary(buildSelectedPoolOtherConfigEntries(this.selectedPool));
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
    this.$watch(() => store.vFabricScope?.scope?.id || '', () => this.loadDashboard());
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
    openAlertDetails(message) {
      this.selectedAlert = message;
    },
    fullAlertMessage(message) {
      return [message.body, message.error, message.errorMessage, message.details, message.message]
        .filter((value, index, values) => value && values.indexOf(value) === index)
        .join('\n\n') || 'No message body was supplied.';
    },
    formatAlertPayload(message) {
      return JSON.stringify(message, null, 2);
    },
    openTaskDetails(task) {
      this.selectedTask = task;
    },
    fullTaskResult(task) {
      const errors = Array.isArray(task.error_info) ? task.error_info : [task.error_info];
      return [task.result, task.error, task.errorMessage, ...errors]
        .filter((value, index, values) => value && values.indexOf(value) === index)
        .map((value) => typeof value === 'string' ? value : JSON.stringify(value, null, 2))
        .join('\n\n') || 'No result or error detail was supplied.';
    },
    formatTaskPayload(task) {
      return JSON.stringify(task, null, 2);
    },
    async openPoolDetails(pool) {
      this.selectedPool = pool;
      this.poolDetailsError = '';
      this.poolUpdatesLoading = true;
      try {
        const [record, hostsResult, storageResult, vmsResult, updates] = await Promise.all([
          api.getPool(pool.ref, pool.scopeTargetKey),
          api.getHosts(pool.scopeTargetKey),
          api.getSRs(pool.scopeTargetKey),
          api.getVMs('', pool.scopeTargetKey),
          api.getPoolUpdates(pool.ref, pool.scopeTargetKey),
        ]);
        this.selectedPool = record;
        this.poolDetailHosts = hostsResult.data || [];
        this.poolDetailStorage = storageResult.data || [];
        this.poolDetailVms = vmsResult.data || [];
        this.poolUpdates = updates || { kind: '', updates: [] };
      } catch (error) {
        this.poolDetailsError = error.message || 'Unable to load the full pool record.';
      } finally {
        this.poolUpdatesLoading = false;
      }
    },
    closePoolDetails() {
      this.selectedPool = null;
      this.poolDetailsError = '';
      this.poolUpdates = { kind: '', updates: [] };
    },
    resolvePoolHostLabel(ref) {
      return this.poolDetailHosts.find((host) => host.ref === ref)?.name_label || ref;
    },
    openPoolsWorkspace() {
      this.$router.push('/pools');
    },
    async openHostDetails(host) {
      this.selectedDashboardHost = host;
      this.dashboardHostDetailsLoading = true;
      this.dashboardHostMetricsError = '';
      this.dashboardHostInventoryError = '';
      try {
        const detail = await loadHostDetailContext(api, host);
        this.dashboardHostMetrics = detail.hostMetrics;
        this.dashboardHostMetricHistory = detail.hostMetricHistory;
        this.dashboardHostRelatedPools = detail.relatedPools;
        this.dashboardHostRelatedVms = detail.relatedVMs;
        this.dashboardHostRelatedStorage = detail.relatedStorage;
        this.dashboardHostRelatedNetworks = detail.relatedNetworks;
        this.dashboardHostMetricsError = detail.metricsError || '';
        this.dashboardHostInventoryError = detail.inventoryError || '';
      } finally {
        this.dashboardHostDetailsLoading = false;
      }
    },
    closeHostDetails() {
      this.selectedDashboardHost = null;
      this.dashboardHostMetrics = {};
      this.dashboardHostMetricHistory = { metrics: [] };
      this.dashboardHostRelatedPools = [];
      this.dashboardHostRelatedVms = [];
      this.dashboardHostRelatedStorage = [];
      this.dashboardHostRelatedNetworks = [];
    },
    openHostsWorkspace() {
      this.$router.push('/hosts');
    },
    stateCount(collection, key) {
      return collection && collection[key] ? collection[key] : 0;
    },
    capacityColorClass(percent) {
      const status = getUtilizationStatus(percent, { warning: 75, critical: 90 });
      if (status === 'critical') return 'red';
      if (status === 'warning') return 'amber';
      return 'green';
    },
    openSummaryCard(card) {
      if (card?.route) this.$router.push(card.route);
    },
    async loadDashboard() {
      this.loading = true;
      try {
        const [summaryResults, messageResults, taskResults, hostResults, srResults, vmResults] = await Promise.all([
          loadDashboardAcrossScope((targetKey) => api.dashboard(targetKey)),
          loadDashboardAcrossScope((targetKey) => api.dashboardMessages(targetKey).catch(() => [])),
          loadDashboardAcrossScope((targetKey) => api.getTasks(targetKey).catch(() => ({ data: [] }))),
          loadDashboardAcrossScope((targetKey) => api.getHosts(targetKey).catch(() => ({ data: [] }))),
          loadDashboardAcrossScope((targetKey) => api.getSRs(targetKey).catch(() => ({ data: [] }))),
          loadDashboardAcrossScope((targetKey) => api.getVMs('', targetKey).catch(() => ({ data: [] }))),
        ]);
        const scopeTargets = dashboardScopeTargets();
        const annotateScopedData = (results) => results.flatMap((result, index) => (
          (Array.isArray(result) ? result : (result?.data || [])).map((entry) => ({
            ...entry,
            scopeTargetKey: scopeTargets[index]?.targetKey || '',
          }))
        ));
        const summary = mergeDashboardSummaries(summaryResults.map((entry, index) => ({
          ...entry,
          pools: (entry?.pools || []).map((pool) => ({ ...pool, scopeTargetKey: scopeTargets[index]?.targetKey || '' })),
          hosts: (entry?.hosts || []).map((host) => ({ ...host, scopeTargetKey: scopeTargets[index]?.targetKey || '' })),
        })));
        const messages = annotateScopedData(messageResults);
        const tasks = annotateScopedData(taskResults);
        const hostRecords = annotateScopedData(hostResults);
        const srs = annotateScopedData(srResults);
        const vms = annotateScopedData(vmResults);
        const metricEntries = await Promise.all(hostRecords.map(async (host) => {
          try {
            const metrics = await api.getHostMetrics(host.ref, host.scopeTargetKey || '');
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

        const capacitySrs = srs.map((sr) => ({
          ...sr,
          freeBytes: Math.max(0, Number(sr.physical_size || 0) - Number(sr.virtual_allocation || 0)),
          utilizationPercent: percentValue(Number(sr.virtual_allocation || 0), Number(sr.physical_size || 0)),
        }));

        this.summary = summary || {};
        this.messages = messages || [];
        this.tasks = tasks;
        this.capacity = buildCapacityAnalytics({
          hosts: capacityHosts,
          srs: capacitySrs,
          vms,
          tasks,
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
