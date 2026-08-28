const CapacityWorkspaceDialogs = {
  components: {
    FloatingWindow,
    StatusBadge,
    MetricTrendCard,
    RemediationTaskForm,
  },
  props: {
    showInspector: { type: Boolean, default: false },
    inspectorTitle: { type: String, default: 'Capacity Detail' },
    selectedEntityType: { type: String, default: '' },
    selectedEntity: { type: Object, default: null },
    inspectorHistory: { type: Object, default: () => ({ metrics: [] }) },
    showRemediationComposer: { type: Boolean, default: false },
    remediationDraft: { type: Object, default: null },
    remediationSaving: { type: Boolean, default: false },
    remediationError: { type: String, default: null },
  },
  emits: [
    'close-inspector',
    'close-remediation-composer',
    'submit-forecast-remediation',
  ],
  template: `
    <div>
      <floating-window :show="showInspector"
                       :title="inspectorTitle"
                       :width="760"
                       :height="480"
                       @close="$emit('close-inspector')">
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

          <div class="detail-section">
            <div class="detail-section-title">Historical Telemetry</div>
            <div class="dashboard-panels">
              <metric-trend-card
                title="Host Memory Utilization"
                subtitle="Persisted host-memory pressure for the selected telemetry window."
                :series="inspectorMetricSeries('memory_used_percent')"
                value-kind="percent"
                :accent-status="historyStatus(inspectorMetricSeries('memory_used_percent'), { warning: 70, critical: 85 })">
              </metric-trend-card>
              <metric-trend-card
                title="Host CPU Utilization"
                subtitle="Persisted RRD-derived CPU pressure for the selected host."
                :series="inspectorMetricSeries('cpu_usage_percent')"
                value-kind="percent"
                :accent-status="historyStatus(inspectorMetricSeries('cpu_usage_percent'), { warning: 70, critical: 90 })">
              </metric-trend-card>
              <metric-trend-card
                title="Host Network Throughput"
                subtitle="Persisted host ingress and egress throughput from Xen RRD telemetry."
                :series="combinedInspectorMetricSeries(['network_rx_kib_per_s', 'network_tx_kib_per_s'])"
                value-kind="throughput"
                accent-status="info">
              </metric-trend-card>
            </div>
          </div>

          <div class="detail-section" v-if="selectedEntity.assignedVms && selectedEntity.assignedVms.length">
            <div class="detail-section-title">Dominant Workloads</div>
            <div class="stack-list">
              <div class="stack-item" v-for="vm in selectedEntity.assignedVms.slice(0, 4)" :key="vm.ref">
                <div>
                  <strong>{{ vm.name_label || vm.ref }}</strong>
                  <div class="text-muted mono" style="font-size:11px">{{ formatBytes(vm.memoryDemand) }} · {{ vm.vcpuDemand }} vCPU</div>
                </div>
                <status-badge :status="getUtilizationStatus(vm.riskPercentOfHost, { warning: 12, critical: 20 })"></status-badge>
              </div>
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

          <div class="detail-section">
            <div class="detail-section-title">Historical Utilization</div>
            <metric-trend-card
              title="SR Allocation Trend"
              subtitle="Persisted storage pressure for the selected repository."
              :series="inspectorMetricSeries('utilization_percent')"
              value-kind="percent"
              :accent-status="historyStatus(inspectorMetricSeries('utilization_percent'), { warning: 75, critical: 90 })">
            </metric-trend-card>
          </div>
        </div>

        <div v-if="selectedEntityType === 'vm' && selectedEntity">
          <div class="property-grid">
            <span class="text-muted">Virtual Machine</span><span>{{ selectedEntity.name_label || '-' }}</span>
            <span class="text-muted">Resident Host</span><span>{{ selectedEntity.hostName || '-' }}</span>
            <span class="text-muted">Power State</span><status-badge :status="selectedEntity.power_state || 'info'"></status-badge>
            <span class="text-muted">vCPUs</span><span class="mono">{{ selectedEntity.vcpuDemand }}</span>
            <span class="text-muted">Observed Memory</span><span class="mono">{{ formatBytes(selectedEntity.memoryDemand) }}</span>
            <span class="text-muted">CPU Usage</span><span class="mono">{{ formatPercentValue(selectedEntity.cpuUsagePercent || 0) }}</span>
            <span class="text-muted">Host Footprint</span><span class="mono">{{ formatPercentValue(selectedEntity.riskPercentOfHost) }}</span>
            <span class="text-muted">UUID</span><span class="mono property-wrap">{{ selectedEntity.uuid || '-' }}</span>
            <span class="text-muted">Tags</span><span>{{ truncateList(selectedEntity.tags) }}</span>
          </div>

          <div class="detail-section">
            <div class="detail-section-title">Placement Guidance</div>
            <div class="capacity-callout">
              <strong>{{ selectedEntity.riskPercentOfHost >= 20 ? 'Review this workload before the next rebalance window' : 'Workload size appears normal for its current host' }}</strong>
              <p>{{ vmRecommendation(selectedEntity) }}</p>
            </div>
          </div>

          <div class="detail-section">
            <div class="detail-section-title">Historical Footprint</div>
            <div class="dashboard-panels">
              <metric-trend-card
                title="VM Memory Utilization"
                subtitle="Persisted workload memory demand relative to configured memory."
                :series="inspectorMetricSeries('memory_usage_percent')"
                value-kind="percent"
                :accent-status="historyStatus(inspectorMetricSeries('memory_usage_percent'), { warning: 75, critical: 90 })">
              </metric-trend-card>
              <metric-trend-card
                title="VM CPU Utilization"
                subtitle="Persisted RRD-derived vCPU pressure averaged across this workload's configured CPUs."
                :series="inspectorMetricSeries('cpu_usage_percent')"
                value-kind="percent"
                :accent-status="historyStatus(inspectorMetricSeries('cpu_usage_percent'), { warning: 70, critical: 90 })">
              </metric-trend-card>
              <metric-trend-card
                title="VM Network Throughput"
                subtitle="Persisted VM ingress and egress throughput."
                :series="combinedInspectorMetricSeries(['network_rx_kib_per_s', 'network_tx_kib_per_s'])"
                value-kind="throughput"
                accent-status="info">
              </metric-trend-card>
              <metric-trend-card
                title="VM Disk Throughput"
                subtitle="Persisted VM read and write throughput."
                :series="combinedInspectorMetricSeries(['disk_read_kib_per_s', 'disk_write_kib_per_s'])"
                value-kind="throughput"
                accent-status="info">
              </metric-trend-card>
            </div>
          </div>
        </div>
      </floating-window>

      <floating-window :show="showRemediationComposer"
                       title="Forecast Follow-through"
                       :width="720"
                       :height="700"
                       @close="$emit('close-remediation-composer')">
        <div class="stack-list">
          <div class="form-error" v-if="remediationError" style="text-align:left">{{ remediationError }}</div>
          <remediation-task-form
            :initial-value="remediationDraft"
            :saving="remediationSaving"
            submit-label="Create Follow-through"
            @submit="$emit('submit-forecast-remediation', $event)">
          </remediation-task-form>
        </div>
      </floating-window>
    </div>
  `,
  methods: {
    formatBytes,
    formatPercentValue,
    truncateList,
    getUtilizationStatus,
    hostCapacityStatus(host) {
      return getCapacityHostStatus(host);
    },
    storageCapacityStatus(sr) {
      return getCapacityStorageStatus(sr);
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
    inspectorMetricSeries(metricName) {
      return getCapacityMetricSeries(metricName, this.inspectorHistory.metrics || []);
    },
    combinedInspectorMetricSeries(metricNames = []) {
      return combineCapacityMetricSeries(metricNames, this.inspectorHistory.metrics || []);
    },
    historyStatus(series, thresholds = {}) {
      return getCapacityHistoryStatus(series, thresholds);
    },
  },
};
