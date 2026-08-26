const CapacityView = {
  components: {
    FloatingWindow,
    StatusBadge,
    'metric-trend-card': MetricTrendCard,
    'remediation-task-form': RemediationTaskForm,
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
                         @close="closeRemediationComposer">
          <div class="stack-list">
            <div class="form-error" v-if="remediationError" style="text-align:left">{{ remediationError }}</div>
            <remediation-task-form
              :initial-value="remediationDraft"
              :saving="remediationSaving"
              submit-label="Create Follow-through"
              @submit="submitForecastRemediation">
            </remediation-task-form>
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
    topHosts() {
      return [...this.hosts].sort((left, right) => right.memoryUsagePercent - left.memoryUsagePercent);
    },
    topStorage() {
      return [...this.srs].sort((left, right) => right.utilizationPercent - left.utilizationPercent);
    },
    capacityAnalytics() {
      return buildCapacityAnalytics({
        hosts: this.hosts,
        srs: this.srs,
        vms: this.vms,
        tasks: this.tasks,
        messages: this.messages,
        clusterHistory: this.clusterHistory,
        historyRange: this.historyRange,
      });
    },
    topVms() {
      return this.capacityAnalytics.topVmConsumers;
    },
    hostBalanceRows() {
      return this.capacityAnalytics.hostBalanceRows;
    },
    noisyNeighborCandidates() {
      return this.capacityAnalytics.noisyNeighborCandidates;
    },
    capacityForecast() {
      return this.capacityAnalytics.forecast;
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
    capacityAutomationTasks() {
      return sortTasks(this.tasks.filter((task) => this.isCapacityAutomationTask(task)));
    },
    capacityCards() {
      const clusterMemoryUsed = this.capacityAnalytics.summary.memoryUsedPercent;
      const clusterStorageUsed = this.capacityAnalytics.summary.storageUsedPercent;
      const memoryCommit = this.capacityAnalytics.summary.memoryCommitPercent;

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
          key: 'vm-commit',
          label: 'VM Commit',
          value: formatPercentValue(memoryCommit),
          detail: `${formatBytes(this.capacityAnalytics.summary.totalVmMemoryDemand)} allocated across ${this.capacityAnalytics.summary.vmCount} workloads`,
          icon: 'mdi-chart-sankey',
          valueClass: this.vms.length ? `text-${this.colorClass(memoryCommit)}` : '',
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
          key: 'neighbors',
          label: 'Noisy Neighbors',
          value: String(this.noisyNeighborCandidates.length),
          detail: this.noisyNeighborCandidates.length ? `${this.noisyNeighborCandidates[0].name_label || 'A workload'} dominates a hot host footprint` : 'No dominant VM signatures inferred',
          icon: 'mdi-transit-connection-variant',
          valueClass: this.noisyNeighborCandidates.length ? 'text-amber' : 'text-green',
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
      const overdueAutomationTasks = this.capacityAutomationTasks.filter((task) => this.taskSlaMeta(task).isOverdue);

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

      if (this.noisyNeighborCandidates.length) {
        const vm = this.noisyNeighborCandidates[0];
        items.push({
          title: 'Review dominant workload placement',
          detail: `${vm.name_label || 'A VM'} accounts for ${formatPercentValue(vm.riskPercentOfHost)} of ${vm.hostName}'s current memory footprint.`,
          status: vm.hostStatus || 'warning',
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

      if (this.capacityAutomationTasks.length) {
        const task = this.capacityAutomationTasks[0];
        items.push({
          title: 'Staged capacity follow-through ready',
          detail: `${task.name_label || 'A remediation task'} already carries ${this.taskEvidenceChecklist(task).length} evidence checks and ${this.taskCompletionCriteria(task).length} completion criteria into the capacity queue, with ${this.taskSlaMeta(task).label.toLowerCase()} timing.`,
          status: this.taskSlaMeta(task).tone,
        });
      }

      if (overdueAutomationTasks.length) {
        const task = overdueAutomationTasks[0];
        items.push({
          title: 'Overdue capacity follow-through',
          detail: `${task.name_label || 'A remediation task'} is ${this.taskSlaMeta(task).label.toLowerCase()} and should be reassigned or closed before the next provisioning wave.`,
          status: 'critical',
        });
      }

      items.push({
        title: this.capacityForecast.title,
        detail: `${this.capacityForecast.detail} ${this.capacityForecast.confidence}`,
        status: this.capacityForecast.status,
      });

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
      if (this.selectedEntityType === 'vm') return 'Capacity VM Detail';
      return 'Capacity Detail';
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
    taskSlaBadgeClass(task) {
      return getTaskSlaBadgeClass(this.taskSlaMeta(task));
    },
    isRemediationTask(task) {
      return String(task?.task_kind || '').toLowerCase() === 'remediation' || String(task?.source || '').toLowerCase() === 'remediation';
    },
    isCapacityAutomationTask(task) {
      if (!this.isRemediationTask(task)) return false;
      return task.target_route === '/capacity' || String(task.action_type || '').toLowerCase() === 'capacity';
    },
    taskEvidenceChecklist(task) {
      return Array.isArray(task?.evidence_checklist) ? task.evidence_checklist : [];
    },
    taskCompletionCriteria(task) {
      return Array.isArray(task?.completion_criteria) ? task.completion_criteria : [];
    },
    openAutomationTask(task) {
      if (!task?.ref) return;
      this.showInspector = false;
      this.showRemediationComposer = false;
      this.$router.push(buildFocusedRoute('/activity', {
        kind: 'task',
        ref: task.ref || '',
        uuid: task.uuid || '',
        name: task.name_label || '',
        cls: 'task',
        source: 'capacity',
      }));
    },
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
    vmRecommendation(vm) {
      if (vm.riskPercentOfHost >= 20) {
        return `${vm.name_label || 'This workload'} is consuming a large share of its host's memory envelope. Validate whether it should remain pinned here or be redistributed before maintenance, evacuation, or new deployments.`;
      }
      if (vm.riskPercentOfHost >= 12) {
        return `${vm.name_label || 'This workload'} is one of the larger workloads on its current host. Keep it in view when balancing capacity or planning recovery targets.`;
      }
      return 'This workload does not currently stand out as a likely contention driver based on live placement and configured memory demand.';
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
      const driver = this.capacityForecast?.driver || null;
      if (!driver?.entityType) return null;
      if (driver.entityType === 'host') {
        const host = this.hostBalanceRows.find((entry) => entry.ref === driver.entityRef || entry.uuid === driver.entityUuid) || null;
        return host ? { type: 'host', entity: host } : null;
      }
      if (driver.entityType === 'sr') {
        const storage = this.srs.find((entry) => entry.ref === driver.entityRef || entry.uuid === driver.entityUuid) || null;
        return storage ? { type: 'storage', entity: storage } : null;
      }
      if (driver.entityType === 'vm') {
        const vm = this.vms.find((entry) => entry.ref === driver.entityRef || entry.uuid === driver.entityUuid) || null;
        return vm ? { type: 'vm', entity: vm } : null;
      }
      return null;
    },
    inspectForecastDriver() {
      const driver = this.forecastDriverRecord();
      if (!driver?.entity) return;
      this.openInspector(driver.type, driver.entity);
    },
    buildForecastRemediationDraft() {
      const driver = this.forecastDriverRecord();
      const forecast = this.capacityForecast || {};
      if (!driver?.entity) return null;

      const entity = driver.entity;
      const targetRoute = '/capacity';
      const relatedClass = driver.type === 'storage' ? 'sr' : driver.type;
      const relatedObject = entity.uuid || entity.ref || '';
      const driverName = entity.name_label || entity.hostname || entity.address || entity.ref || forecast.driver?.entityName || 'capacity driver';
      const dueDate = (() => {
        const next = new Date();
        next.setDate(next.getDate() + 1);
        const offsetDate = new Date(next.getTime() - next.getTimezoneOffset() * 60000);
        return offsetDate.toISOString().slice(0, 10);
      })();

      const lifecyclePlanSeed = driver.type === 'host'
        ? {
            enabled: true,
            baselineStatus: 'drifted',
            targetStage: 'maintenance',
            maintenanceWindow: entity.other_config?.maintenance_window || '',
            patchGroup: '',
            owner: store.username || '',
            nextAction: 'validate',
            rebootRequired: false,
            evacuationRequired: true,
            dueDate,
            notes: `Created from the Tuesday, August 25, 2026 capacity forecast for ${driverName}.`,
          }
        : null;
      const resilienceRunbookSeed = driver.type === 'storage'
        ? {
            enabled: true,
            recoveryTier: 'tier-1',
            haPolicy: 'priority-restart',
            restartPriority: 'high',
            backupWindowHours: 12,
            rpoMinutes: 30,
            rtoMinutes: 90,
            restorePointStatus: 'review',
            owner: store.username || '',
            standbyHostRef: '',
            failoverNetworkRef: '',
            runbookSteps: [
              `Validate backup currency for workloads backed by ${driverName}.`,
              `Confirm recovery capacity before additional allocation lands on ${driverName}.`,
            ],
            notes: `Created from the Tuesday, August 25, 2026 capacity forecast for ${driverName}.`,
          }
        : null;
      const vmMigrationSeed = driver.type === 'vm'
        ? {
            enabled: true,
            mode: 'same-pool',
            hostRef: '',
            destinationTargetKey: '',
            transferNetworkRef: '',
            srRef: '',
            vifNetworkMap: [],
            live: ['running', 'suspended'].includes(String(entity.power_state || '').toLowerCase()),
            copy: false,
            force: false,
            compress: ['running', 'suspended'].includes(String(entity.power_state || '').toLowerCase()),
            setAsHomeServer: true,
            notes: `Created from the Tuesday, August 25, 2026 capacity forecast for ${driverName}.`,
          }
        : null;

      return {
        nameLabel: `Capacity Follow-through: ${driverName}`,
        nameDescription: `${forecast.detail || 'Forecast-driven follow-through requested.'}\n\n${forecast.nextAction || 'Review the current pressure signature and capture the next operational step.'}`,
        actionType: 'capacity',
        assignee: store.username || '',
        dueDate,
        alertRef: '',
        alertUuid: '',
        alertSummary: forecast.title || 'Capacity forecast follow-through',
        targetRoute,
        relatedObject,
        relatedClass,
        workspaceSummary: forecast.attribution || `Open Capacity on ${driverName} and capture the next rebalancing or remediation step.`,
        evidenceChecklist: [
          `Review the current forecast driver for ${driverName}.`,
          'Capture whether the trend is sustained across the active telemetry window.',
          'Document the next balancing, cleanup, or protection step before closing the task.',
        ],
        completionCriteria: [
          'A named operator owns the follow-through.',
          'The forecast driver has been reviewed in Capacity.',
          'Any downstream Lifecycle or Resilience work has been launched or explicitly ruled out.',
        ],
        lifecyclePlanSeed,
        resilienceRunbookSeed,
        vmMigrationSeed,
      };
    },
    openForecastRemediationComposer() {
      this.remediationDraft = this.buildForecastRemediationDraft();
      this.remediationError = null;
      this.forecastActionError = null;
      this.showRemediationComposer = Boolean(this.remediationDraft);
    },
    buildForecastTaskFocus(task, payload = {}) {
      return {
        kind: 'task',
        ref: task?.ref || '',
        uuid: task?.uuid || '',
        name: task?.name_label || payload.nameLabel || '',
        cls: 'task',
        source: 'capacity',
      };
    },
    async runForecastAutomation(mode, buildRoute) {
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
        const route = typeof buildRoute === 'function'
          ? buildRoute(task, payload, focus)
          : buildFocusedRoute('/activity', focus);
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
      await this.runForecastAutomation('lifecycle', (task, payload, focus) =>
        buildFocusedRoute('/lifecycle', focus, { seedAction: 'lifecycle-plan' })
      );
    },
    async launchForecastLifecycleMaintenance() {
      if (!this.hasForecastLifecycleSeed()) return;
      await this.runForecastAutomation('lifecycle-maintenance', (task, payload, focus) =>
        buildFocusedRoute('/lifecycle', focus, { seedAction: 'lifecycle-maintenance' })
      );
    },
    async launchForecastResilienceDraft() {
      if (!this.hasForecastResilienceSeed()) return;
      await this.runForecastAutomation('resilience', (task, payload, focus) =>
        buildFocusedRoute('/resilience', focus, { seedAction: 'resilience-runbook' })
      );
    },
    async launchForecastResilienceDrill() {
      if (!this.hasForecastResilienceSeed()) return;
      await this.runForecastAutomation('resilience-drill', (task, payload, focus) =>
        buildFocusedRoute('/resilience', focus, { seedAction: 'resilience-drill' })
      );
    },
    async launchForecastVmMigrationDraft() {
      if (!this.hasForecastVmMigrationSeed()) return;
      await this.runForecastAutomation('vm-migration', (task, payload, focus) =>
        buildFocusedRoute('/vms', focus, { seedAction: 'vm-migration' })
      );
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
      if (!focus) return null;
      if (focus.kind === 'host' || focus.cls === 'host') {
        const host = this.hostBalanceRows.find((entry) =>
          recordMatchesRouteFocus(entry, focus, ['ref', 'uuid', 'name_label', 'hostname', 'address'])
        ) || null;
        return host ? { type: 'host', entity: host } : null;
      }
      if (focus.kind === 'storage' || focus.cls === 'sr' || focus.cls === 'vdi' || focus.cls === 'vbd') {
        const storage = this.srs.find((entry) =>
          recordMatchesRouteFocus(entry, focus, ['ref', 'uuid', 'name_label'])
        ) || null;
        return storage ? { type: 'storage', entity: storage } : null;
      }
      if (focus.kind === 'vm' || focus.cls === 'vm') {
        const vm = this.vms.find((entry) =>
          recordMatchesRouteFocus(entry, focus, ['ref', 'uuid', 'name_label'])
        ) || null;
        return vm ? { type: 'vm', entity: vm } : null;
      }
      return null;
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
      return (this.clusterHistory.metrics || []).find((entry) => entry.metricName === metricName)?.points || [];
    },
    combineMetricSeries(metricNames = [], metrics = []) {
      const buckets = new Map();
      (Array.isArray(metricNames) ? metricNames : []).forEach((metricName) => {
        const points = (Array.isArray(metrics) ? metrics : []).find((entry) => entry.metricName === metricName)?.points || [];
        points.forEach((point) => {
          const ts = Number(point?.ts || 0);
          if (!ts) return;
          buckets.set(ts, (buckets.get(ts) || 0) + Number(point?.value || 0));
        });
      });
      return [...buckets.entries()]
        .sort((left, right) => left[0] - right[0])
        .map(([ts, value]) => ({ ts, value }));
    },
    combinedClusterMetricSeries(metricNames = []) {
      return this.combineMetricSeries(metricNames, this.clusterHistory.metrics || []);
    },
    inspectorMetricSeries(metricName) {
      return (this.inspectorHistory.metrics || []).find((entry) => entry.metricName === metricName)?.points || [];
    },
    combinedInspectorMetricSeries(metricNames = []) {
      return this.combineMetricSeries(metricNames, this.inspectorHistory.metrics || []);
    },
    historyStatus(series, thresholds = {}) {
      const points = Array.isArray(series) ? series : [];
      const latest = Number(points[points.length - 1]?.value || 0);
      if (thresholds.critical !== undefined && latest >= thresholds.critical) return 'critical';
      if (thresholds.warning !== undefined && latest >= thresholds.warning) return 'warning';
      return 'success';
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
        const baselineHostsByRef = Object.fromEntries((baselineResult?.hosts || []).map((entry) => [entry.entityRef, entry]));
        const baselineVmsByRef = Object.fromEntries((baselineResult?.vms || []).map((entry) => [entry.entityRef, entry]));
        const baselineStorageByRef = Object.fromEntries((baselineResult?.storage || []).map((entry) => [entry.entityRef, entry]));
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
          const baseline = baselineHostsByRef[host.ref] || {};
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
            cpuUsagePercentLatest: Number(baseline.cpu_usage_percent || 0),
            latestTelemetryTs: Number(baseline.ts || 0),
            residentVmCount: Array.isArray(host.resident_VMs) ? host.resident_VMs.length : 0,
          };
        });

        this.srs = (srsResult.data || []).map((sr) => {
          const baseline = baselineStorageByRef[sr.ref] || {};
          const physical = Number(sr.physical_size || 0);
          const allocation = Number(sr.virtual_allocation || 0);
          const freeBytes = Math.max(0, physical - allocation);

          return {
            ...sr,
            freeBytes,
            utilizationPercent: percentValue(allocation, physical),
            latestUtilizationPercent: Number(baseline.utilization_percent || 0),
            latestTelemetryTs: Number(baseline.ts || 0),
          };
        });

        this.vms = (vmsResult.data || []).map((vm) => {
          const baseline = baselineVmsByRef[vm.ref] || {};
          return {
            ...vm,
            memoryActualBytesLatest: Number(baseline.memory_actual_bytes || 0),
            memoryUsagePercentLatest: Number(baseline.memory_usage_percent || 0),
            cpuUsagePercentLatest: Number(baseline.cpu_usage_percent || 0),
            vcpuCountLatest: Number(baseline.vcpu_count || 0),
            latestTelemetryTs: Number(baseline.ts || 0),
          };
        });
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
