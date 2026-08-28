const VMOverviewTab = {
  components: {
    StatusBadge,
    'metric-trend-card': MetricTrendCard,
  },
  props: ['model'],
  template: `
    <div>
      <div class="property-grid">
        <span class="text-muted">Name</span><span>{{ model.vm.name_label || '-' }}</span>
        <span class="text-muted">Description</span><span>{{ model.vm.name_description || '-' }}</span>
        <span class="text-muted">State</span><status-badge :status="model.vm.power_state"></status-badge>
        <span class="text-muted">UUID</span><span class="mono property-wrap">{{ model.vm.uuid || '-' }}</span>
        <span class="text-muted">Resident Host</span><span>{{ model.host ? (model.host.name_label || model.host.address || model.host.ref) : '-' }}</span>
        <span class="text-muted">Pool</span><span>{{ model.pool ? (model.pool.name_label || model.pool.uuid || model.pool.ref) : 'Standalone / unknown' }}</span>
        <span class="text-muted">User Version</span><span class="mono">{{ model.vm.user_version ?? 0 }}</span>
        <span class="text-muted">Start Delay</span><span class="mono">{{ model.vm.start_delay ?? 0 }}s</span>
        <span class="text-muted">Shutdown Delay</span><span class="mono">{{ model.vm.shutdown_delay ?? 0 }}s</span>
        <span class="text-muted">Boot Order</span><span class="mono">{{ model.vm.order ?? 0 }}</span>
        <span class="text-muted">Virtual Hardware Platform</span><span class="mono">{{ model.hardwarePlatformSummary }}</span>
        <span class="text-muted">Domain Type</span><span>{{ model.domainTypeSummary }}</span>
        <span class="text-muted">Secure Boot</span><span>{{ model.secureBootSummary }}</span>
        <span class="text-muted">Video RAM</span><span class="mono">{{ model.videoRamSummary }}</span>
        <span class="text-muted">IGD Passthrough</span><span>{{ model.igdPassthroughSummary }}</span>
        <span class="text-muted">Vendor Device</span><span>{{ model.vendorDeviceSummary }}</span>
        <span class="text-muted">Startup vCPUs</span><span class="mono">{{ model.vm.VCPUs_at_startup || 0 }}</span>
        <span class="text-muted">Max vCPUs</span><span class="mono">{{ model.vm.VCPUs_max || model.vm.VCPUs_at_startup || 0 }}</span>
        <span class="text-muted">Memory Static Min</span><span class="mono">{{ model.memoryStaticMinFormatted }}</span>
        <span class="text-muted">Memory Dynamic Min</span><span class="mono">{{ model.memoryDynamicMinFormatted }}</span>
        <span class="text-muted">Memory Dynamic Max</span><span class="mono">{{ model.memoryDynamicMaxFormatted }}</span>
        <span class="text-muted">Memory Static Max</span><span class="mono">{{ model.memoryStaticMaxFormatted }}</span>
        <span class="text-muted">Boot Policy</span><span>{{ model.vm.HVM_boot_policy || model.vm.PV_bootloader || 'Default' }}</span>
        <span class="text-muted">Affinity</span><span class="mono property-wrap">{{ model.affinityLabel }}</span>
        <span class="text-muted">Appliance</span><span class="mono property-wrap">{{ model.applianceSummary }}</span>
        <span class="text-muted">Snapshot Schedule</span><span class="mono property-wrap">{{ model.snapshotScheduleSummary }}</span>
        <span class="text-muted">Protection Policy</span><span class="mono property-wrap">{{ model.protectionPolicySummary }}</span>
        <span class="text-muted">Guest Metrics</span><span class="mono property-wrap">{{ model.guestMetricsSummary }}</span>
        <span class="text-muted">Recommendations</span><span class="mono property-wrap">{{ model.recommendationsSummary }}</span>
        <span class="text-muted">Tags</span><span>{{ model.tagsSummary }}</span>
        <span class="text-muted">Blocked Operations</span><span class="mono property-wrap">{{ model.blockedOperationsSummary }}</span>
        <span class="text-muted">VCPU Params</span><span class="mono property-wrap">{{ model.vcpusParamsSummary }}</span>
        <span class="text-muted">Other Config</span><span class="mono property-wrap">{{ model.otherConfigSummary }}</span>
        <span class="text-muted">XenStore Data</span><span class="mono property-wrap">{{ model.xenstoreDataSummary }}</span>
        <span class="text-muted">NVRAM</span><span class="mono property-wrap">{{ model.nvramSummary }}</span>
        <span class="text-muted">Platform</span><span class="mono property-wrap">{{ model.platformSummary }}</span>
      </div>

      <div class="vm-resource-grid">
        <div class="dash-card vm-resource-card" v-for="card in model.overviewCards" :key="card.key">
          <div class="dash-card-label">{{ card.label }}</div>
          <div class="dash-card-value" :class="card.valueClass || ''">{{ card.value }}</div>
          <div class="text-muted mono" style="margin-top:8px;font-size:11px">{{ card.detail }}</div>
        </div>
      </div>

      <div class="detail-section">
        <div class="detail-section-title">Guest Runtime & Guidance</div>
        <div class="dashboard-panels">
          <div class="dash-card">
            <div class="dash-card-label">Guest Metrics</div>
            <div class="stack-list">
              <div class="stack-item">
                <div>
                  <strong>Guest Agent</strong>
                  <div class="text-muted mono" style="font-size:11px">{{ model.guestMetricsHeartbeatSummary }} · {{ model.guestMetricsUpdatedSummary }}</div>
                </div>
                <span class="badge" :class="model.guestMetricsLive ? 'badge-running' : 'badge-warning'">
                  {{ model.guestMetricsLive ? 'live' : 'unknown' }}
                </span>
              </div>
              <div class="stack-item">
                <div>
                  <strong>Guest OS</strong>
                  <div class="text-muted mono" style="font-size:11px">{{ model.guestOsSummary }}</div>
                </div>
                <span class="badge badge-info">os</span>
              </div>
              <div class="stack-item">
                <div>
                  <strong>PV Drivers</strong>
                  <div class="text-muted mono" style="font-size:11px">{{ model.guestPvDriversSummary }}</div>
                </div>
                <span class="badge badge-info">drivers</span>
              </div>
              <div class="stack-item">
                <div>
                  <strong>Guest Networks</strong>
                  <div class="text-muted mono" style="font-size:11px">{{ model.guestNetworksSummary }}</div>
                </div>
                <span class="badge badge-info">network</span>
              </div>
            </div>
          </div>

          <div class="dash-card">
            <div class="dash-card-label">Recommendations</div>
            <p class="text-muted" style="margin-bottom:12px">
              Xen exposes VM recommendations as read-only XML guidance describing suggested values and ranges for this workload.
            </p>
            <div class="text-muted mono property-wrap" style="font-size:11px;white-space:pre-wrap">
              {{ model.recommendationsBody }}
            </div>
          </div>
        </div>
      </div>

      <div class="detail-section">
        <div class="detail-section-title">Historical VM Footprint</div>
        <div class="dashboard-panels">
          <metric-trend-card
            title="VM Memory Utilization"
            subtitle="Persisted workload memory demand relative to configured memory."
            :series="model.memoryUsageSeries"
            value-kind="percent"
            :accent-status="model.memoryUsageStatus">
          </metric-trend-card>
          <metric-trend-card
            title="VM CPU Utilization"
            subtitle="Persisted RRD-derived vCPU pressure averaged across this workload's configured CPUs."
            :series="model.cpuUsageSeries"
            value-kind="percent"
            :accent-status="model.cpuUsageStatus">
          </metric-trend-card>
          <metric-trend-card
            title="VM Network Throughput"
            subtitle="Persisted VM ingress and egress throughput."
            :series="model.networkThroughputSeries"
            value-kind="throughput"
            accent-status="info">
          </metric-trend-card>
          <metric-trend-card
            title="VM Disk Throughput"
            subtitle="Persisted VM read and write throughput."
            :series="model.diskThroughputSeries"
            value-kind="throughput"
            accent-status="info">
          </metric-trend-card>
        </div>
      </div>
    </div>
  `,
};
