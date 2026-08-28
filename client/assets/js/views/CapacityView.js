const CapacityView = {
  components: {
    StatusBadge,
    'metric-trend-card': MetricTrendCard,
    CapacityWorkspaceDialogs,
  },
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
            <div class="dash-card-label">Telemetry Window</div>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              <button v-for="range in historyRanges"
                      :key="range.value"
                      class="btn btn-sm"
                      :class="{ 'btn-primary': historyRange === range.value }"
                      @click="changeHistoryRange(range.value)">
                {{ range.label }}
              </button>
            </div>
            <div class="text-muted mono" style="font-size:11px;margin-top:10px">
              {{ historyLoading ? 'Refreshing persisted telemetry history...' : 'Trend cards now reflect persisted telemetry history captured in the local perf database.' }}
            </div>
          </div>
        </div>

        <div class="dashboard-panels">
          <metric-trend-card
            title="Cluster Memory Trend"
            subtitle="Summed host-memory pressure across the current telemetry window."
            :series="clusterMetricSeries('cluster_memory_used_percent')"
            value-kind="percent"
            :accent-status="historyStatus(clusterMetricSeries('cluster_memory_used_percent'), { warning: 70, critical: 85 })">
          </metric-trend-card>
          <metric-trend-card
            title="Cluster CPU Trend"
            subtitle="Average persisted host CPU pressure derived from Xen RRD telemetry."
            :series="clusterMetricSeries('cluster_cpu_usage_percent')"
            value-kind="percent"
            :accent-status="historyStatus(clusterMetricSeries('cluster_cpu_usage_percent'), { warning: 70, critical: 90 })">
          </metric-trend-card>
          <metric-trend-card
            title="Storage Utilization Trend"
            subtitle="Aggregated SR allocation pressure across the current telemetry window."
            :series="clusterMetricSeries('cluster_storage_utilization_percent')"
            value-kind="percent"
            :accent-status="historyStatus(clusterMetricSeries('cluster_storage_utilization_percent'), { warning: 75, critical: 90 })">
          </metric-trend-card>
          <metric-trend-card
            title="VM Memory Demand Trend"
            subtitle="Current workload memory footprint persisted over time."
            :series="clusterMetricSeries('cluster_vm_memory_actual_bytes')"
            value-kind="bytes"
            accent-status="info">
          </metric-trend-card>
          <metric-trend-card
            title="VM Network Throughput"
            subtitle="Aggregated persisted VM ingress and egress throughput."
            :series="combinedClusterMetricSeries(['cluster_vm_network_rx_kib_per_s', 'cluster_vm_network_tx_kib_per_s'])"
            value-kind="throughput"
            accent-status="info">
          </metric-trend-card>
          <metric-trend-card
            title="VM Disk Throughput"
            subtitle="Aggregated persisted VM read and write throughput."
            :series="combinedClusterMetricSeries(['cluster_vm_disk_read_kib_per_s', 'cluster_vm_disk_write_kib_per_s'])"
            value-kind="throughput"
            accent-status="info">
          </metric-trend-card>
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
            <div class="dash-card-label">Top VM Consumers</div>
            <div class="stack-list" v-if="topVms.length">
              <button class="stack-item stack-item-button"
                      v-for="vm in topVms"
                      :key="vm.ref"
                      @click="openInspector('vm', vm)">
                <div class="capacity-item-main">
                  <strong>{{ vm.name_label || 'Virtual Machine' }}</strong>
                  <div class="text-muted mono" style="font-size:11px">{{ vm.hostName }} · {{ vm.vcpuDemand }} vCPU · {{ formatPercentValue(vm.cpuUsagePercent || 0) }} CPU</div>
                  <div class="capacity-meter">
                    <div class="capacity-meter-track">
                      <div class="capacity-meter-fill"
                           :class="getUtilizationStatus(vm.riskPercentOfHost, { warning: 12, critical: 20 })"
                           :style="{ width: formatPercentValue(vm.riskPercentOfHost) }"></div>
                    </div>
                    <span class="mono">{{ formatBytes(vm.memoryDemand) }} observed</span>
                  </div>
                </div>
                <status-badge :status="getUtilizationStatus(vm.riskPercentOfHost, { warning: 12, critical: 20 })"></status-badge>
              </button>
            </div>
            <div v-else class="empty-state" style="padding:20px 12px">No VM placement inventory available.</div>
          </div>

          <div class="dash-card">
            <div class="dash-card-label">Placement Imbalance</div>
            <div class="stack-list" v-if="hostBalanceRows.length">
              <button class="stack-item stack-item-button"
                      v-for="row in hostBalanceRows.slice(0, 6)"
                      :key="row.ref"
                      @click="openInspector('host', row)">
                <div class="capacity-item-main">
                  <strong>{{ row.name_label || row.hostname || 'Host' }}</strong>
                  <div class="text-muted mono" style="font-size:11px">
                    {{ formatBytes(row.vmMemoryDemand) }} observed · {{ row.assignedVms.length }} VMs · {{ formatPercentValue(row.vmCpuUsagePercent || 0) }} CPU avg
                  </div>
                  <div class="capacity-meter">
                    <div class="capacity-meter-track">
                      <div class="capacity-meter-fill"
                           :class="row.status"
                           :style="{ width: formatPercentValue(row.pressurePercent) }"></div>
                    </div>
                    <span class="mono">{{ formatPercentValue(row.imbalancePercent) }} skew</span>
                  </div>
                </div>
                <status-badge :status="row.status"></status-badge>
              </button>
            </div>
            <div v-else class="empty-state" style="padding:20px 12px">No placement telemetry available.</div>
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
            <div class="dash-card-label">Staged Automation Queue</div>
            <div class="stack-list" v-if="capacityAutomationTasks.length">
              <button class="stack-item stack-item-button"
                      v-for="task in capacityAutomationTasks.slice(0, 6)"
                      :key="task.ref"
                      @click="openAutomationTask(task)">
                <div>
                  <strong>{{ task.name_label || 'Remediation Task' }}</strong>
                  <div class="text-muted mono" style="font-size:11px">{{ task.assignee || 'Unassigned' }} · {{ task.related_alert_summary || task.related_object || task.ref }}</div>
                  <div class="text-muted" style="font-size:12px;margin-top:6px">{{ task.workspace_summary || task.name_description || 'No workbench brief captured.' }}</div>
                  <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:6px">
                    <span class="badge" :class="taskSlaBadgeClass(task)">{{ taskSlaMeta(task).label }}</span>
                    <span class="text-muted mono" style="font-size:11px">{{ taskSlaMeta(task).ageLabel }}</span>
                  </div>
                  <div class="text-muted mono" style="font-size:11px;margin-top:6px">{{ taskEvidenceChecklist(task).length }} evidence · {{ taskCompletionCriteria(task).length }} completion</div>
                </div>
                <status-badge :status="task.status || 'pending'"></status-badge>
              </button>
            </div>
            <div v-else class="empty-state" style="padding:20px 12px">No capacity-specific remediation staging is queued yet.</div>
          </div>

          <div class="dash-card">
            <div class="dash-card-label">Forecast & Thresholds</div>
            <div class="metric-row">
              <span>Live Memory Used</span>
              <strong :class="'text-' + colorClass(capacityAnalytics.summary.memoryUsedPercent)">{{ formatPercentValue(capacityAnalytics.summary.memoryUsedPercent) }}</strong>
            </div>
            <div class="metric-row">
              <span>VM Memory Commit</span>
              <strong :class="'text-' + colorClass(capacityAnalytics.summary.memoryCommitPercent)">{{ formatPercentValue(capacityAnalytics.summary.memoryCommitPercent) }}</strong>
            </div>
            <div class="metric-row">
              <span>Storage Commit</span>
              <strong :class="'text-' + colorClass(capacityAnalytics.summary.storageUsedPercent)">{{ formatPercentValue(capacityAnalytics.summary.storageUsedPercent) }}</strong>
            </div>
            <div class="metric-row">
              <span>Imbalance Index</span>
              <strong :class="'text-' + colorClass(capacityAnalytics.summary.imbalancePercent)">{{ formatPercentValue(capacityAnalytics.summary.imbalancePercent) }}</strong>
            </div>
            <div class="detail-section" style="margin-top:12px">
              <div class="capacity-callout">
                <strong>{{ capacityForecast.title }}</strong>
                <p>{{ capacityForecast.detail }} {{ capacityForecast.nextAction }}</p>
                <div v-if="capacityForecast.attribution" class="text-muted" style="font-size:12px;margin-top:8px">{{ capacityForecast.attribution }}</div>
                <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px" v-if="capacityForecast.driver">
                  <button class="btn btn-sm" @click="inspectForecastDriver">
                    <span class="mdi mdi-crosshairs-gps"></span>
                    Inspect Driver
                  </button>
                  <button class="btn btn-primary btn-sm"
                          :disabled="remediationSaving || !!forecastActionBusy"
                          @click="queueForecastFollowThrough">
                    <span class="mdi mdi-clipboard-plus-outline"></span>
                    {{ forecastActionBusy === 'queue' ? 'Queueing...' : 'Queue Follow-through' }}
                  </button>
                  <button class="btn btn-sm"
                          v-if="hasForecastLifecycleSeed()"
                          :disabled="remediationSaving || !!forecastActionBusy"
                          @click="launchForecastLifecycleMaintenance">
                    <span class="mdi mdi-wrench-clock"></span>
                    {{ forecastActionBusy === 'lifecycle-maintenance' ? 'Launching...' : 'Launch Maintenance Handoff' }}
                  </button>
                  <button class="btn btn-sm"
                          v-if="hasForecastLifecycleSeed()"
                          :disabled="remediationSaving || !!forecastActionBusy"
                          @click="launchForecastLifecycleDraft">
                    <span class="mdi mdi-calendar-edit-outline"></span>
                    {{ forecastActionBusy === 'lifecycle' ? 'Launching...' : 'Draft Lifecycle Plan' }}
                  </button>
                  <button class="btn btn-sm"
                          v-if="hasForecastResilienceSeed()"
                          :disabled="remediationSaving || !!forecastActionBusy"
                          @click="launchForecastResilienceDrill">
                    <span class="mdi mdi-clipboard-pulse-outline"></span>
                    {{ forecastActionBusy === 'resilience-drill' ? 'Launching...' : 'Launch Recovery Drill Handoff' }}
                  </button>
                  <button class="btn btn-sm"
                          v-if="hasForecastResilienceSeed()"
                          :disabled="remediationSaving || !!forecastActionBusy"
                          @click="launchForecastResilienceDraft">
                    <span class="mdi mdi-book-edit-outline"></span>
                    {{ forecastActionBusy === 'resilience' ? 'Launching...' : 'Draft Recovery Runbook' }}
                  </button>
                  <button class="btn btn-sm"
                          v-if="hasForecastVmMigrationSeed()"
                          :disabled="remediationSaving || !!forecastActionBusy"
                          @click="launchForecastVmMigrationDraft">
                    <span class="mdi mdi-swap-horizontal-bold"></span>
                    {{ forecastActionBusy === 'vm-migration' ? 'Launching...' : 'Draft VM Migration' }}
                  </button>
                  <button class="btn btn-sm"
                          :disabled="remediationSaving || !!forecastActionBusy"
                          @click="openForecastRemediationComposer">
                    <span class="mdi mdi-clipboard-check-outline"></span>
                    Create Follow-through
                  </button>
                </div>
                <div class="form-error" v-if="forecastActionError" style="text-align:left;margin-top:10px">{{ forecastActionError }}</div>
                <div class="text-muted mono" style="font-size:11px;margin-top:8px">{{ capacityForecast.confidence }}</div>
              </div>
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

        <div class="dashboard-panels">
          <div class="dash-card">
            <div class="dash-card-label">Noisy-Neighbor Candidates</div>
            <div class="stack-list" v-if="noisyNeighborCandidates.length">
              <button class="stack-item stack-item-button"
                      v-for="candidate in noisyNeighborCandidates"
                      :key="candidate.ref"
                      @click="openInspector('vm', candidate)">
                <div class="capacity-item-main">
                  <strong>{{ candidate.name_label || 'Virtual Machine' }}</strong>
                  <div class="text-muted mono" style="font-size:11px">
                    {{ candidate.hostName }} · {{ formatPercentValue(candidate.riskPercentOfHost) }} of host memory footprint
                  </div>
                  <div class="text-muted" style="font-size:12px;margin-top:6px">{{ candidate.recommendation }}</div>
                </div>
                <status-badge :status="candidate.hostStatus || 'warning'"></status-badge>
              </button>
            </div>
            <div v-else class="empty-state" style="padding:20px 12px">
              No dominant workload signatures detected from the current placement view.
            </div>
          </div>
        </div>

        <capacity-workspace-dialogs
          :show-inspector="showInspector"
          :inspector-title="inspectorTitle"
          :selected-entity-type="selectedEntityType"
          :selected-entity="selectedEntity"
          :inspector-history="inspectorHistory"
          :show-remediation-composer="showRemediationComposer"
          :remediation-draft="remediationDraft"
          :remediation-saving="remediationSaving"
          :remediation-error="remediationError"
          @close-inspector="closeInspector"
          @close-remediation-composer="closeRemediationComposer"
          @submit-forecast-remediation="submitForecastRemediation">
        </capacity-workspace-dialogs>
      </template>
    </div>
  `,
  data() {
    return {
      loading: true,
      hosts: [],
      srs: [],
      vms: [],
      messages: [],
      tasks: [],
      clusterHistory: { metrics: [] },
      inspectorHistory: { metrics: [] },
      historyLoading: false,
      inspectorHistoryLoading: false,
      historyRange: '24h',
      historyRanges: [
        { value: '1h', label: '1h' },
        { value: '6h', label: '6h' },
        { value: '24h', label: '24h' },
        { value: '7d', label: '7d' },
        { value: '30d', label: '30d' },
      ],
      selectedEntity: null,
      selectedEntityType: '',
      showInspector: false,
      showRemediationComposer: false,
      remediationDraft: null,
      remediationSaving: false,
      remediationError: null,
      forecastActionBusy: '',
      forecastActionError: null,
      lastAppliedFocusKey: '',
    };
  },
  computed: {
    capacityWorkspaceModel() {
      return buildCapacityWorkspaceModel({
        hosts: this.hosts,
        srs: this.srs,
        vms: this.vms,
        tasks: this.tasks,
        messages: this.messages,
        clusterHistory: this.clusterHistory,
        historyRange: this.historyRange,
        selectedEntityType: this.selectedEntityType,
        isCapacityAutomationTask: (task) => this.isCapacityAutomationTask(task),
        taskSlaMeta: (task) => this.taskSlaMeta(task),
        taskEvidenceChecklist: (task) => this.taskEvidenceChecklist(task),
        taskCompletionCriteria: (task) => this.taskCompletionCriteria(task),
        colorClass: (percent) => this.colorClass(percent),
      });
    },
    topHosts() {
      return this.capacityWorkspaceModel.topHosts;
    },
    topStorage() {
      return this.capacityWorkspaceModel.topStorage;
    },
    capacityAnalytics() {
      return this.capacityWorkspaceModel.analytics;
    },
    topVms() {
      return this.capacityWorkspaceModel.topVms;
    },
    hostBalanceRows() {
      return this.capacityWorkspaceModel.hostBalanceRows;
    },
    noisyNeighborCandidates() {
      return this.capacityWorkspaceModel.noisyNeighborCandidates;
    },
    capacityForecast() {
      return this.capacityWorkspaceModel.capacityForecast;
    },
    clusterMemory() {
      return this.capacityWorkspaceModel.clusterMemory;
    },
    clusterStorage() {
      return this.capacityWorkspaceModel.clusterStorage;
    },
    liveHosts() {
      return this.capacityWorkspaceModel.liveHosts;
    },
    hotHosts() {
      return this.capacityWorkspaceModel.hotHosts;
    },
    storageRisks() {
      return this.capacityWorkspaceModel.storageRisks;
    },
    activeTasks() {
      return this.capacityWorkspaceModel.activeTasks;
    },
    capacityAutomationTasks() {
      return this.capacityWorkspaceModel.capacityAutomationTasks;
    },
    capacityCards() {
      return this.capacityWorkspaceModel.capacityCards;
    },
    recommendations() {
      return this.capacityWorkspaceModel.recommendations;
    },
    inspectorTitle() {
      return this.capacityWorkspaceModel.inspectorTitle;
    },
  },
  async mounted() {
    if (!store.authenticated) {
      this.$router.push('/login');
      return;
    }

    await this.loadCapacity();
    await this.syncRouteFocus();
  },
  watch: {
    '$route.query': {
      deep: true,
      async handler() {
        await this.syncRouteFocus();
      },
    },
  },
  methods: {
    formatBytes,
    formatThroughput,
    formatPercentValue,
    truncateList,
    getUtilizationStatus,
    taskSlaMeta: getTaskDueMeta,
    isRemediationTask: isCapacityViewRemediationTask,
    isCapacityAutomationTask: isCapacityViewAutomationTask,
    taskEvidenceChecklist: getCapacityTaskEvidenceChecklist,
    taskCompletionCriteria: getCapacityTaskCompletionCriteria,
    taskSlaBadgeClass(task) {
      return getTaskSlaBadgeClass(this.taskSlaMeta(task));
    },
    openAutomationTask(task) {
      const location = buildCapacityAutomationTaskLocation(task);
      if (!location) return;
      this.showInspector = false;
      this.showRemediationComposer = false;
      this.$router.push(location);
    },
    hostCapacityStatus(host) {
      return getCapacityHostStatus(host);
    },
    storageCapacityStatus(sr) {
      return getCapacityStorageStatus(sr);
    },
    colorClass(percent) {
      return getCapacityColorClass(percent);
    },
    hostRecommendation(host) {
      return buildCapacityHostRecommendation(host);
    },
    storageRecommendation(sr) {
      return buildCapacityStorageRecommendation(sr);
    },
    vmRecommendation(vm) {
      return buildCapacityVmRecommendation(vm);
    },
    openInspector(type, entity) {
      this.selectedEntityType = type;
      this.selectedEntity = entity;
      this.showInspector = true;
      this.showRemediationComposer = false;
      this.loadInspectorHistory();
    },
    closeInspector() {
      this.showInspector = false;
      this.selectedEntity = null;
      this.selectedEntityType = '';
      this.inspectorHistory = { metrics: [] };
    },
    closeRemediationComposer() {
      this.showRemediationComposer = false;
      this.remediationDraft = null;
      this.remediationSaving = false;
      this.remediationError = null;
    },
    hasForecastLifecycleSeed() {
      return Boolean(this.buildForecastRemediationDraft()?.lifecyclePlanSeed?.enabled);
    },
    hasForecastResilienceSeed() {
      return Boolean(this.buildForecastRemediationDraft()?.resilienceRunbookSeed?.enabled);
    },
    hasForecastVmMigrationSeed() {
      return Boolean(this.buildForecastRemediationDraft()?.vmMigrationSeed?.enabled);
    },
    forecastDriverRecord() {
      return buildCapacityForecastDriverRecord(this.capacityForecast, this.hostBalanceRows, this.srs, this.vms);
    },
    inspectForecastDriver() {
      const driver = this.forecastDriverRecord();
      if (!driver?.entity) return;
      this.openInspector(driver.type, driver.entity);
    },
    buildForecastRemediationDraft() {
      return buildCapacityForecastRemediationDraft(this.capacityForecast, this.forecastDriverRecord(), store.username || '');
    },
    openForecastRemediationComposer() {
      this.remediationDraft = this.buildForecastRemediationDraft();
      this.remediationError = null;
      this.forecastActionError = null;
      this.showRemediationComposer = Boolean(this.remediationDraft);
    },
    buildForecastTaskFocus(task, payload = {}) {
      return buildCapacityTaskFocus(task, payload);
    },
    async runForecastAutomation(mode) {
      if (this.remediationSaving || this.forecastActionBusy) return null;

      const payload = this.buildForecastRemediationDraft();
      if (!payload) return null;

      this.forecastActionBusy = mode;
      this.forecastActionError = null;
      this.remediationError = null;

      try {
        const task = await api.createRemediationTask(payload);
        this.closeRemediationComposer();
        const focus = this.buildForecastTaskFocus(task, payload);
        const route = buildCapacityForecastAutomationRoute(mode, focus);
        if (route) {
          this.$router.push(route);
        }
        return task;
      } catch (error) {
        this.forecastActionError = error.message || 'Unable to automate the forecast follow-through.';
        return null;
      } finally {
        this.forecastActionBusy = '';
      }
    },
    async queueForecastFollowThrough() {
      await this.runForecastAutomation('queue');
    },
    async launchForecastLifecycleDraft() {
      if (!this.hasForecastLifecycleSeed()) return;
      await this.runForecastAutomation('lifecycle');
    },
    async launchForecastLifecycleMaintenance() {
      if (!this.hasForecastLifecycleSeed()) return;
      await this.runForecastAutomation('lifecycle-maintenance');
    },
    async launchForecastResilienceDraft() {
      if (!this.hasForecastResilienceSeed()) return;
      await this.runForecastAutomation('resilience');
    },
    async launchForecastResilienceDrill() {
      if (!this.hasForecastResilienceSeed()) return;
      await this.runForecastAutomation('resilience-drill');
    },
    async launchForecastVmMigrationDraft() {
      if (!this.hasForecastVmMigrationSeed()) return;
      await this.runForecastAutomation('vm-migration');
    },
    async submitForecastRemediation(payload) {
      this.remediationSaving = true;
      this.remediationError = null;
      this.forecastActionError = null;
      try {
        const task = await api.createRemediationTask(payload);
        this.closeRemediationComposer();
        this.$router.push(buildFocusedRoute('/activity', this.buildForecastTaskFocus(task, payload)));
      } catch (error) {
        this.remediationError = error.message || 'Unable to create the forecast follow-through task.';
      } finally {
        this.remediationSaving = false;
      }
    },
    findFocusedEntity(focus) {
      return findCapacityFocusedEntity(focus, this.hostBalanceRows, this.srs, this.vms);
    },
    async syncRouteFocus() {
      const focus = getRouteFocus(this.$route.query);
      if (!focus) {
        this.lastAppliedFocusKey = '';
        return;
      }

      const key = getRouteFocusKey(focus);
      if (this.lastAppliedFocusKey === key) return;

      const target = this.findFocusedEntity(focus);
      if (!target?.entity) return;

      this.lastAppliedFocusKey = key;
      this.openInspector(target.type, target.entity);
    },
    clusterMetricSeries(metricName) {
      return getCapacityMetricSeries(metricName, this.clusterHistory.metrics || []);
    },
    combinedClusterMetricSeries(metricNames = []) {
      return combineCapacityMetricSeries(metricNames, this.clusterHistory.metrics || []);
    },
    inspectorMetricSeries(metricName) {
      return getCapacityMetricSeries(metricName, this.inspectorHistory.metrics || []);
    },
    combinedInspectorMetricSeries(metricNames = []) {
      return combineCapacityMetricSeries(metricNames, this.inspectorHistory.metrics || []);
    },
    historyStatus(series, thresholds = {}) {
      return getCapacityHistoryStatus(series, thresholds);
    },
    async changeHistoryRange(range) {
      this.historyRange = range;
      await this.loadClusterHistory();
      if (this.showInspector && this.selectedEntity) {
        await this.loadInspectorHistory();
      }
    },
    async loadClusterHistory() {
      this.historyLoading = true;
      try {
        this.clusterHistory = await api.getClusterMetrics(this.historyRange);
      } catch (error) {
        console.error(error);
        this.clusterHistory = { metrics: [] };
      } finally {
        this.historyLoading = false;
      }
    },
    async loadInspectorHistory() {
      if (!this.selectedEntity?.ref) {
        this.inspectorHistory = { metrics: [] };
        return;
      }

      this.inspectorHistoryLoading = true;
      try {
        if (this.selectedEntityType === 'host') {
          this.inspectorHistory = await api.getHostMetricHistory(this.selectedEntity.ref, this.historyRange);
        } else if (this.selectedEntityType === 'storage') {
          this.inspectorHistory = await api.getStorageMetricHistory(this.selectedEntity.ref, this.historyRange);
        } else if (this.selectedEntityType === 'vm') {
          this.inspectorHistory = await api.getVmMetricHistory(this.selectedEntity.ref, this.historyRange);
        } else {
          this.inspectorHistory = { metrics: [] };
        }
      } catch (error) {
        console.error(error);
        this.inspectorHistory = { metrics: [] };
      } finally {
        this.inspectorHistoryLoading = false;
      }
    },
    async loadCapacity() {
      this.loading = true;
      try {
        const [hostsResult, srsResult, tasksResult, vmsResult, alertsResult, baselineResult] = await Promise.all([
          api.getHosts(),
          api.getSRs(),
          api.getTasks(),
          api.getVMs().catch(() => ({ data: [] })),
          api.getAlerts().catch(() => []),
          api.getCapacityBaseline().catch(() => ({ hosts: [], vms: [], storage: [] })),
        ]);

        const hostRecords = hostsResult.data || [];
        const baselineMaps = buildCapacityBaselineMaps(baselineResult);
        const metricEntries = await Promise.all(hostRecords.map(async (host) => {
          try {
            const metrics = await api.getHostMetrics(host.ref);
            return [host.ref, metrics];
          } catch (error) {
            return [host.ref, { live: false, memory_total: 0, memory_free: 0 }];
          }
        }));
        const metricsByRef = Object.fromEntries(metricEntries);

        this.hosts = buildCapacityHostRecords(hostRecords, metricsByRef, baselineMaps.hostsByRef);
        this.srs = buildCapacityStorageRecords(srsResult.data || [], baselineMaps.storageByRef);
        this.vms = buildCapacityVmRecords(vmsResult.data || [], baselineMaps.vmsByRef);
        this.messages = alertsResult || [];
        this.tasks = tasksResult.data || [];
        await this.loadClusterHistory();
        await this.syncRouteFocus();
      } catch (error) {
        console.error(error);
        this.hosts = [];
        this.srs = [];
        this.vms = [];
        this.messages = [];
        this.tasks = [];
        this.clusterHistory = { metrics: [] };
      } finally {
        this.loading = false;
      }
    },
  },
};
