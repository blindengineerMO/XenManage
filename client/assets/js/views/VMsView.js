const VMsView = {
  components: {
    DataTable,
    StatusBadge,
    FloatingWindow,
    'metric-trend-card': MetricTrendCard,
    'vm-config-form': VMConfigForm,
    'vm-device-form': VMDeviceForm,
    'vm-import-form': VMImportForm,
    'vm-migration-form': VMMigrationForm,
    'vm-duplicate-form': VMDuplicateForm,
    'vm-snapshot-form': VMSnapshotForm,
  },
  template: `
    <div class="animate-fade-in">
      <div class="section-head">
        <div>
          <h2 class="section-title">
            <span class="mdi mdi-desktop-tower"></span>
            Virtual Machines
          </h2>
          <p class="section-subtitle">Searchable VM inventory with a richer operator detail workspace for placement, attached resources, and configuration tasks.</p>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-sm" @click="openImportWindow">
            <span class="mdi mdi-package-up"></span>
            Import XVA
          </button>
          <button class="btn btn-primary" @click="loadVMs">
            <span class="mdi mdi-refresh"></span>
            Refresh
          </button>
        </div>
      </div>

      <div class="dash-card" v-if="selectedVmRows.length" style="margin-bottom:16px">
        <div class="dash-card-label">Batch VM Actions</div>
        <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap">
          <div>
            <strong>{{ selectedVmRows.length }} VMs selected</strong>
            <div class="text-muted mono" style="font-size:11px;margin-top:4px">{{ selectedVmSelectionSummary }}</div>
          </div>
          <div class="dashboard-hero-rail" style="gap:8px">
            <button class="btn btn-sm btn-primary"
                    v-if="selectedVmStateCounts.halted"
                    :disabled="Boolean(bulkActionBusy)"
                    @click="applyBulkVmAction('start')">
              <span class="mdi mdi-play"></span>
              {{ bulkActionBusy === 'start' ? 'Starting...' : `Start Selected (${selectedVmStateCounts.halted})` }}
            </button>
            <button class="btn btn-sm"
                    v-if="selectedVmStateCounts.running"
                    :disabled="Boolean(bulkActionBusy)"
                    @click="applyBulkVmAction('shutdown')">
              <span class="mdi mdi-stop"></span>
              {{ bulkActionBusy === 'shutdown' ? 'Stopping...' : `Shutdown Selected (${selectedVmStateCounts.running})` }}
            </button>
            <button class="btn btn-sm"
                    v-if="selectedVmStateCounts.running"
                    :disabled="Boolean(bulkActionBusy)"
                    @click="applyBulkVmAction('reboot')">
              <span class="mdi mdi-restart"></span>
              {{ bulkActionBusy === 'reboot' ? 'Rebooting...' : `Reboot Selected (${selectedVmStateCounts.running})` }}
            </button>
            <button class="btn btn-sm"
                    v-if="selectedVmStateCounts.running"
                    :disabled="Boolean(bulkActionBusy)"
                    @click="applyBulkVmAction('suspend')">
              <span class="mdi mdi-pause"></span>
              {{ bulkActionBusy === 'suspend' ? 'Suspending...' : `Suspend Selected (${selectedVmStateCounts.running})` }}
            </button>
            <button class="btn btn-sm btn-primary"
                    v-if="selectedVmStateCounts.suspended"
                    :disabled="Boolean(bulkActionBusy)"
                    @click="applyBulkVmAction('resume')">
              <span class="mdi mdi-play-circle-outline"></span>
              {{ bulkActionBusy === 'resume' ? 'Resuming...' : `Resume Selected (${selectedVmStateCounts.suspended})` }}
            </button>
            <button class="btn btn-sm" :disabled="Boolean(bulkActionBusy)" @click="clearVmSelection">Clear Selection</button>
          </div>
        </div>
        <div class="form-error" v-if="bulkError" style="text-align:left;margin-top:12px">{{ bulkError }}</div>
      </div>

      <data-table :columns="columns"
                  :data="vms"
                  :loading="loading"
                  :searchable="true"
                  :selectable="true"
                  :selected-keys="selectedVmRefs"
                  row-key="ref"
                  @selection-change="handleVmSelectionChange"
                  @row-click="openProperties">
        <template #cell-name_label="{ row }">
          <span style="color:var(--text-primary);font-weight:500">{{ row.name_label || 'Unnamed' }}</span>
        </template>
        <template #cell-power_state="{ row }">
          <status-badge :status="row.power_state"></status-badge>
        </template>
        <template #cell-VCPUs_at_startup="{ row }">
          <span class="mono">{{ row.VCPUs_at_startup || 0 }}</span>
        </template>
        <template #cell-memory_static_max="{ row }">
          <span class="mono">{{ formatBytes(row.memory_static_max) }}</span>
        </template>
      </data-table>

      <floating-window :show="showProps" title="VM Details" :width="980" :height="700" @close="showProps = false">
        <div v-if="selectedVM" class="vm-detail-shell">
          <div class="vm-detail-hero">
            <div>
              <div class="dash-card-label">Virtual Machine</div>
              <h3>{{ selectedVM.name_label || 'Unnamed VM' }}</h3>
              <p>{{ selectedVM.name_description || 'Inspect placement, attached resources, runtime state, and configuration from a single operator pane.' }}</p>

              <div class="vm-stat-chips">
                <span class="badge badge-info">{{ selectedVM.power_state || 'Unknown' }}</span>
                <span class="badge badge-info">{{ selectedVM.VCPUs_at_startup || 0 }} vCPU</span>
                <span class="badge badge-info">{{ formatBytes(selectedVM.memory_static_max) }}</span>
                <span class="badge" :class="selectedVmHost ? 'badge-running' : 'badge-halted'">
                  {{ selectedVmHost ? (selectedVmHost.name_label || selectedVmHost.address || 'Placed') : 'No host placement' }}
                </span>
              </div>
            </div>

            <div class="vm-detail-actions">
              <button class="btn btn-primary btn-sm"
                      v-if="selectedVM.power_state === 'Halted'"
                      :disabled="Boolean(actionBusy)"
                      @click="vmAction('start', selectedVM.ref)">
                <span class="mdi mdi-play"></span>
                {{ actionBusy === 'start' ? 'Starting...' : 'Start' }}
              </button>
              <button class="btn btn-sm"
                      v-if="selectedVM.power_state === 'Running'"
                      :disabled="Boolean(actionBusy)"
                      @click="vmAction('shutdown', selectedVM.ref)">
                <span class="mdi mdi-stop"></span>
                {{ actionBusy === 'shutdown' ? 'Stopping...' : 'Shutdown' }}
              </button>
              <button class="btn btn-danger btn-sm"
                      v-if="selectedVM.power_state === 'Running'"
                      :disabled="Boolean(actionBusy)"
                      @click="vmAction('shutdown', selectedVM.ref, { force: true })">
                <span class="mdi mdi-power"></span>
                {{ actionBusy === 'shutdown-force' ? 'Forcing...' : 'Force Off' }}
              </button>
              <button class="btn btn-sm"
                      v-if="selectedVM.power_state === 'Running'"
                      :disabled="Boolean(actionBusy)"
                      @click="vmAction('reboot', selectedVM.ref)">
                <span class="mdi mdi-restart"></span>
                {{ actionBusy === 'reboot' ? 'Rebooting...' : 'Reboot' }}
              </button>
              <button class="btn btn-sm"
                      v-if="selectedVM.power_state === 'Running'"
                      :disabled="Boolean(actionBusy)"
                      @click="vmAction('suspend', selectedVM.ref)">
                <span class="mdi mdi-pause"></span>
                {{ actionBusy === 'suspend' ? 'Suspending...' : 'Suspend' }}
              </button>
              <button class="btn btn-primary btn-sm"
                      v-if="selectedVM.power_state === 'Suspended'"
                      :disabled="Boolean(actionBusy)"
                      @click="vmAction('resume', selectedVM.ref)">
                <span class="mdi mdi-play-circle-outline"></span>
                {{ actionBusy === 'resume' ? 'Resuming...' : 'Resume' }}
              </button>
            </div>
          </div>

          <div class="vm-tab-strip">
            <button v-for="tab in tabs"
                    :key="tab.key"
                    class="vm-tab-button"
                    :class="{ active: activeTab === tab.key }"
                    @click="activeTab = tab.key">
              <span class="mdi" :class="tab.icon"></span>
              {{ tab.label }}
            </button>
          </div>

          <div class="form-error" v-if="actionError" style="text-align:left">{{ actionError }}</div>

          <div v-if="detailLoading" class="empty-state">
            <span class="loading-spinner"></span>
            <p style="margin-top:12px">Loading placement, storage, network, and configuration details...</p>
          </div>

          <div v-else-if="detailError" class="stack-item">
            <div>
              <strong>VM detail loading issue</strong>
              <div class="text-muted mono" style="font-size:11px">{{ detailError }}</div>
            </div>
            <span class="badge badge-error">error</span>
          </div>

          <template v-else>
            <div v-if="activeTab === 'overview'">
              <div class="property-grid">
                <span class="text-muted">Name</span><span>{{ selectedVM.name_label || '-' }}</span>
                <span class="text-muted">Description</span><span>{{ selectedVM.name_description || '-' }}</span>
                <span class="text-muted">State</span><status-badge :status="selectedVM.power_state"></status-badge>
                <span class="text-muted">UUID</span><span class="mono property-wrap">{{ selectedVM.uuid || '-' }}</span>
                <span class="text-muted">Resident Host</span><span>{{ selectedVmHost ? (selectedVmHost.name_label || selectedVmHost.address || selectedVmHost.ref) : '-' }}</span>
                <span class="text-muted">Pool</span><span>{{ selectedVmPool ? (selectedVmPool.name_label || selectedVmPool.uuid || selectedVmPool.ref) : 'Standalone / unknown' }}</span>
                <span class="text-muted">User Version</span><span class="mono">{{ selectedVM.user_version ?? 0 }}</span>
                <span class="text-muted">Start Delay</span><span class="mono">{{ selectedVM.start_delay ?? 0 }}s</span>
                <span class="text-muted">Shutdown Delay</span><span class="mono">{{ selectedVM.shutdown_delay ?? 0 }}s</span>
                <span class="text-muted">Boot Order</span><span class="mono">{{ selectedVM.order ?? 0 }}</span>
                <span class="text-muted">Virtual Hardware Platform</span><span class="mono">{{ selectedVmHardwarePlatformSummary }}</span>
                <span class="text-muted">Domain Type</span><span>{{ selectedVmDomainTypeSummary }}</span>
                <span class="text-muted">Secure Boot</span><span>{{ selectedVmSecureBootSummary }}</span>
                <span class="text-muted">Video RAM</span><span class="mono">{{ selectedVmVideoRamSummary }}</span>
                <span class="text-muted">IGD Passthrough</span><span>{{ selectedVmIgdPassthroughSummary }}</span>
                <span class="text-muted">Vendor Device</span><span>{{ selectedVmVendorDeviceSummary }}</span>
                <span class="text-muted">vCPUs</span><span class="mono">{{ selectedVM.VCPUs_at_startup || 0 }}</span>
                <span class="text-muted">Memory Static Min</span><span class="mono">{{ formatBytes(selectedVM.memory_static_min || selectedVM.memory_static_max) }}</span>
                <span class="text-muted">Memory</span><span class="mono">{{ formatBytes(selectedVM.memory_static_max) }}</span>
                <span class="text-muted">Boot Policy</span><span>{{ selectedVM.HVM_boot_policy || selectedVM.PV_bootloader || 'Default' }}</span>
                <span class="text-muted">Affinity</span><span class="mono property-wrap">{{ selectedVmAffinityLabel }}</span>
                <span class="text-muted">Appliance</span><span class="mono property-wrap">{{ selectedVmApplianceSummary }}</span>
                <span class="text-muted">Snapshot Schedule</span><span class="mono property-wrap">{{ selectedVmSnapshotScheduleSummary }}</span>
                <span class="text-muted">Protection Policy</span><span class="mono property-wrap">{{ selectedVmProtectionPolicySummary }}</span>
                <span class="text-muted">Tags</span><span>{{ truncateList(selectedVM.tags) }}</span>
                <span class="text-muted">Blocked Operations</span><span class="mono property-wrap">{{ selectedVmBlockedOperationsSummary }}</span>
                <span class="text-muted">VCPU Params</span><span class="mono property-wrap">{{ selectedVmVcpusParamsSummary }}</span>
                <span class="text-muted">Other Config</span><span class="mono property-wrap">{{ selectedVmOtherConfigSummary }}</span>
                <span class="text-muted">XenStore Data</span><span class="mono property-wrap">{{ selectedVmXenstoreDataSummary }}</span>
                <span class="text-muted">NVRAM</span><span class="mono property-wrap">{{ selectedVmNvramSummary }}</span>
                <span class="text-muted">Platform</span><span class="mono property-wrap">{{ selectedVmPlatformSummary }}</span>
              </div>

              <div class="vm-resource-grid">
                <div class="dash-card vm-resource-card" v-for="card in overviewCards" :key="card.key">
                  <div class="dash-card-label">{{ card.label }}</div>
                  <div class="dash-card-value" :class="card.valueClass || ''">{{ card.value }}</div>
                  <div class="text-muted mono" style="margin-top:8px;font-size:11px">{{ card.detail }}</div>
                </div>
              </div>

              <div class="detail-section">
                <div class="detail-section-title">Historical VM Footprint</div>
                <div class="dashboard-panels">
                  <metric-trend-card
                    title="VM Memory Utilization"
                    subtitle="Persisted workload memory demand relative to configured memory."
                    :series="vmMetricSeries('memory_usage_percent')"
                    value-kind="percent"
                    :accent-status="historyStatus(vmMetricSeries('memory_usage_percent'), { warning: 75, critical: 90 })">
                  </metric-trend-card>
                  <metric-trend-card
                    title="VM CPU Utilization"
                    subtitle="Persisted RRD-derived vCPU pressure averaged across this workload's configured CPUs."
                    :series="vmMetricSeries('cpu_usage_percent')"
                    value-kind="percent"
                    :accent-status="historyStatus(vmMetricSeries('cpu_usage_percent'), { warning: 70, critical: 90 })">
                  </metric-trend-card>
                  <metric-trend-card
                    title="VM Network Throughput"
                    subtitle="Persisted VM ingress and egress throughput."
                    :series="combinedVmMetricSeries(['network_rx_kib_per_s', 'network_tx_kib_per_s'])"
                    value-kind="throughput"
                    accent-status="info">
                  </metric-trend-card>
                  <metric-trend-card
                    title="VM Disk Throughput"
                    subtitle="Persisted VM read and write throughput."
                    :series="combinedVmMetricSeries(['disk_read_kib_per_s', 'disk_write_kib_per_s'])"
                    value-kind="throughput"
                    accent-status="info">
                  </metric-trend-card>
                </div>
              </div>
            </div>

            <div v-else-if="activeTab === 'resources'">
              <div class="dashboard-panels">
                <div class="dash-card">
                  <div class="dash-card-label">Runtime Placement</div>
                  <div class="stack-list">
                    <div class="stack-item">
                      <div>
                        <strong>{{ selectedVmHost ? (selectedVmHost.name_label || 'Host') : 'Unplaced' }}</strong>
                        <div class="text-muted mono" style="font-size:11px">
                          {{ selectedVmHost ? (selectedVmHost.address || selectedVmHost.uuid || selectedVmHost.ref) : 'No current host record' }}
                        </div>
                      </div>
                      <status-badge :status="selectedVmHost && selectedVmHost.enabled ? 'enabled' : 'warning'"></status-badge>
                    </div>
                    <div class="stack-item">
                      <div>
                        <strong>{{ selectedVmPool ? (selectedVmPool.name_label || 'Pool') : 'No pool relationship' }}</strong>
                        <div class="text-muted mono" style="font-size:11px">
                          {{ selectedVmPool ? ((selectedVmPool.uuid || selectedVmPool.ref || '-') + ' · default SR ' + (selectedVmPool.default_SR || '-')) : 'Pool membership was not reported for this workload.' }}
                        </div>
                      </div>
                      <span class="badge badge-info">placement</span>
                    </div>
                  </div>
                </div>

                <div class="dash-card">
                  <div class="dash-card-label">Config Notes</div>
                  <div class="stack-list">
                    <div class="stack-item">
                      <div>
                        <strong>Device Inventory</strong>
                        <div class="text-muted mono" style="font-size:11px">
                          {{ attachedVmDisks.length }} disks · {{ attachedVmNetworks.length }} network paths
                        </div>
                      </div>
                      <span class="badge badge-info">mapped</span>
                    </div>
                    <div class="stack-item">
                      <div>
                        <strong>Change Window Guidance</strong>
                        <div class="text-muted mono" style="font-size:11px">
                          CPU and memory changes may require the VM to be halted depending on XenServer policy and guest tooling.
                        </div>
                      </div>
                      <span class="badge badge-info">notice</span>
                    </div>
                  </div>
                </div>
              </div>

              <div class="detail-section">
                <div class="detail-section-title">Attached Storage</div>
                <data-table :columns="diskColumns" :data="attachedVmDisks" :loading="false" :searchable="true">
                  <template #cell-name_label="{ row }">
                    <span style="color:var(--text-primary);font-weight:500">{{ row.name_label || row.ref }}</span>
                  </template>
                  <template #cell-virtual_size="{ row }">
                    <span class="mono">{{ formatBytes(row.virtual_size) }}</span>
                  </template>
                  <template #cell-storageName="{ row }">
                    <span>{{ row.storageName }}</span>
                  </template>
                </data-table>
              </div>

              <div class="detail-section">
                <div class="detail-section-title">Attached Networks</div>
                <data-table :columns="networkColumns" :data="attachedVmNetworks" :loading="false" :searchable="true">
                  <template #cell-name_label="{ row }">
                    <span style="color:var(--text-primary);font-weight:500">{{ row.name_label || row.bridge || row.ref }}</span>
                  </template>
                  <template #cell-managed="{ row }">
                    <status-badge :status="row.managed ? 'enabled' : 'disabled'"></status-badge>
                  </template>
                  <template #cell-vlan="{ row }">
                    <span class="mono">{{ row.vlan }}</span>
                  </template>
                </data-table>
              </div>
            </div>

            <div v-else-if="activeTab === 'compatibility'">
              <div class="dashboard-panels">
                <div class="dash-card">
                  <div class="dash-card-label">Placement Compatibility</div>
                  <p class="text-muted" style="margin-bottom:12px">
                    Current XAPI guidance favors preflight host compatibility checks over direct CPU masking. XenMange evaluates candidate hosts and highlights where the workload can boot or migrate safely.
                  </p>
                  <div class="stack-list">
                    <div class="stack-item">
                      <div>
                        <strong>Eligible Hosts</strong>
                        <div class="text-muted mono" style="font-size:11px">
                          {{ compatibilityHosts.length ? `${compatibleHostCount} compatible of ${compatibilityHosts.length} evaluated host${compatibilityHosts.length === 1 ? '' : 's'}` : 'No host compatibility data was returned for this workload.' }}
                        </div>
                      </div>
                      <span class="badge" :class="compatibleHostCount ? 'badge-running' : 'badge-warning'">
                        {{ compatibleHostCount ? 'ready' : 'review' }}
                      </span>
                    </div>
                    <div class="stack-item">
                      <div>
                        <strong>Hardware Platform Version</strong>
                        <div class="text-muted mono" style="font-size:11px">
                          {{ vmCompatibility.hardwarePlatformVersion ? `Virtual hardware platform ${vmCompatibility.hardwarePlatformVersion}` : 'No explicit virtual hardware platform requirement was reported.' }}
                        </div>
                      </div>
                      <span class="badge badge-info">vm</span>
                    </div>
                    <div class="stack-item">
                      <div>
                        <strong>CPU Feature Baseline</strong>
                        <div class="text-muted mono" style="font-size:11px">
                          {{ compatibilityFlagCount ? `${compatibilityFlagCount} last-boot CPU feature flag${compatibilityFlagCount === 1 ? '' : 's'} captured for operator review` : 'The current XAPI record did not expose last-boot CPU flags for this workload.' }}
                        </div>
                      </div>
                      <span class="badge badge-info">baseline</span>
                    </div>
                  </div>
                </div>

                <div class="dash-card">
                  <div class="dash-card-label">Compatibility Guidance</div>
                  <div class="stack-list">
                    <div class="stack-item">
                      <div>
                        <strong>Current Host Family</strong>
                        <div class="text-muted mono" style="font-size:11px">
                          {{ selectedVmHost?.cpu_info?.modelname || 'No active resident host CPU model was found for this VM.' }}
                        </div>
                      </div>
                      <span class="badge badge-info">cpu</span>
                    </div>
                    <div class="stack-item">
                      <div>
                        <strong>XAPI Coverage Note</strong>
                        <div class="text-muted mono" style="font-size:11px">
                          Host CPU feature mutation calls are removed in the current official XAPI reference, so XenMange surfaces compatibility evidence and migration prechecks instead of exposing stale masking toggles.
                        </div>
                      </div>
                      <span class="badge badge-warning">docs</span>
                    </div>
                  </div>
                </div>
              </div>

              <div class="detail-section">
                <div class="detail-section-title">Host Compatibility Matrix</div>
                <data-table :columns="compatibilityColumns" :data="compatibilityHosts" :loading="false" :searchable="true">
                  <template #cell-name_label="{ row }">
                    <span style="color:var(--text-primary);font-weight:500">{{ row.name_label }}</span>
                  </template>
                  <template #cell-readiness="{ row }">
                    <status-badge :status="row.readiness"></status-badge>
                  </template>
                  <template #cell-compatible="{ row }">
                    <span class="badge" :class="row.compatible ? 'badge-running' : 'badge-warning'">
                      {{ row.compatible ? 'compatible' : 'blocked' }}
                    </span>
                  </template>
                  <template #cell-cpuModel="{ row }">
                    <span class="mono">{{ row.cpuModel || '-' }}</span>
                  </template>
                  <template #cell-compatibilityError="{ row }">
                    <span class="mono property-wrap">{{ row.compatibilityError || (row.compatible ? 'Placement checks passed.' : '-') }}</span>
                  </template>
                </data-table>
              </div>

              <div class="detail-section" v-if="compatibilityFlagRows.length">
                <div class="detail-section-title">Last Boot CPU Flags</div>
                <div class="property-grid">
                  <template v-for="flag in compatibilityFlagRows" :key="flag.key">
                    <span class="text-muted mono">{{ flag.key }}</span>
                    <span class="mono">{{ flag.value }}</span>
                  </template>
                </div>
              </div>
            </div>

            <div v-else-if="activeTab === 'console'">
              <div class="dashboard-panels">
                <div class="dash-card">
                  <div class="dash-card-label">Console Access</div>
                  <p class="text-muted" style="margin-bottom:12px">
                    Launch a session-authenticated VM console directly from the workload workspace. XenMange resolves the current XAPI console record and opens the browser-accessible endpoint through a guarded launch view.
                  </p>
                  <div class="stack-list" v-if="vmConsoles.length">
                    <div v-for="consoleRecord in vmConsoles" :key="consoleRecord.ref" class="stack-item">
                      <div>
                        <strong>{{ consoleRecord.protocolLabel }}</strong>
                        <div class="text-muted mono" style="font-size:11px">
                          {{ consoleRecord.location || consoleRecord.absoluteLocation || consoleRecord.ref }}
                        </div>
                      </div>
                      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
                        <span class="badge badge-info">{{ consoleRecord.protocol || 'unknown' }}</span>
                        <button class="btn btn-primary btn-sm"
                                type="button"
                                :disabled="!consoleRecord.launchUrl"
                                @click="launchConsole(consoleRecord)">
                          <span class="mdi mdi-monitor-arrow-down-variant"></span>
                          Launch
                        </button>
                      </div>
                    </div>
                  </div>
                  <div v-else class="empty-state">
                    <p>No XAPI console records were returned for this VM.</p>
                  </div>
                </div>

                <div class="dash-card">
                  <div class="dash-card-label">Operator Notes</div>
                  <div class="stack-list">
                    <div class="stack-item">
                      <div>
                        <strong>Preferred Session</strong>
                        <div class="text-muted mono" style="font-size:11px">
                          {{ primaryConsole ? `${primaryConsole.protocolLabel} via ${primaryConsole.protocol || 'unknown'} transport` : 'No preferred console session is currently available.' }}
                        </div>
                      </div>
                      <span class="badge badge-info">launch</span>
                    </div>
                    <div class="stack-item">
                      <div>
                        <strong>Fallback Behavior</strong>
                        <div class="text-muted mono" style="font-size:11px">
                          If the remote console endpoint refuses inline framing, the launch view still provides a direct hand-off into the resolved console session in a separate browser surface.
                        </div>
                      </div>
                      <span class="badge badge-warning">fallback</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div v-else-if="activeTab === 'migration'">
              <div class="dashboard-panels">
                <div class="dash-card">
                  <div class="dash-card-label">Move Workload Placement</div>
                  <p class="text-muted" style="margin-bottom:12px">
                    Relocate a halted VM, live-migrate it within the current pool, or remap it across an attached destination fabric without leaving the VM details workspace.
                  </p>
                  <vm-migration-form
                    :initial-value="selectedVM"
                    :initial-draft="migrationInitialDraft"
                    :host-options="migrationHostOptions"
                    :destination-targets="migrationTargetOptions"
                    :destination-hosts="migrationDestinationHosts"
                    :destination-storage-options="migrationDestinationStorage"
                    :destination-network-options="migrationDestinationNetworks"
                    :source-network-options="attachedVmNetworks"
                    :destination-loading="migrationDestinationLoading"
                    :destination-error="migrationDestinationError"
                    :active-target-key="currentTargetKey"
                    :saving="migrationSaving"
                    @destination-target-change="handleMigrationTargetChange"
                    @submit="submitVMMigration">
                  </vm-migration-form>
                </div>

                <div class="dash-card">
                  <div class="dash-card-label">Migration Guidance</div>
                  <div class="stack-list">
                    <div class="stack-item">
                      <div>
                        <strong>Current Host</strong>
                        <div class="text-muted mono" style="font-size:11px">
                          {{ selectedVmHost ? `${selectedVmHost.name_label || selectedVmHost.ref} · ${selectedVmHost.address || selectedVmHost.uuid || '-'}` : 'No resident host is currently mapped for this VM.' }}
                        </div>
                      </div>
                      <span class="badge" :class="selectedVmHost && selectedVmHost.enabled ? 'badge-running' : 'badge-warning'">
                        {{ selectedVmHost && selectedVmHost.enabled ? 'ready' : 'check' }}
                      </span>
                    </div>
                    <div class="stack-item">
                      <div>
                        <strong>Eligible Destinations</strong>
                        <div class="text-muted mono" style="font-size:11px">
                          {{ migrationHostOptions.length ? `${migrationHostOptions.length} pool host${migrationHostOptions.length === 1 ? '' : 's'} available for same-pool placement` : 'No alternate enabled hosts were found in the current pool.' }}
                        </div>
                      </div>
                      <span class="badge badge-info">pool</span>
                    </div>
                    <div class="stack-item">
                      <div>
                        <strong>Attached Target Fabrics</strong>
                        <div class="text-muted mono" style="font-size:11px">
                          {{ migrationTargetOptions.length ? `${migrationTargetOptions.length} additional live target${migrationTargetOptions.length === 1 ? '' : 's'} available for cross-pool placement` : 'Attach another live target to unlock cross-pool migration and storage remapping.' }}
                        </div>
                      </div>
                      <span class="badge badge-info">fabric</span>
                    </div>
                    <div class="stack-item">
                      <div>
                        <strong>Runtime Mode</strong>
                        <div class="text-muted mono" style="font-size:11px">
                          {{ selectedVM && (selectedVM.power_state === 'Running' || selectedVM.power_state === 'Suspended')
                            ? 'This VM can stay online during a live migration if the target host is compatible.'
                            : 'This VM is not running, so XenMange will submit a relocate-style move instead of a live migration.' }}
                        </div>
                      </div>
                      <span class="badge badge-info">{{ selectedVM && (selectedVM.power_state === 'Running' || selectedVM.power_state === 'Suspended') ? 'live' : 'relocate' }}</span>
                    </div>
                    <div class="stack-item" v-if="migrationDestinationTargetLabel">
                      <div>
                        <strong>Destination Fabric Context</strong>
                        <div class="text-muted mono" style="font-size:11px">
                          {{ migrationDestinationTargetLabel }}{{ migrationDestinationPools.length ? ` · ${migrationDestinationPools.length} pool${migrationDestinationPools.length === 1 ? '' : 's'}` : '' }}{{ migrationDestinationStorage.length ? ` · ${migrationDestinationStorage.length} SR option${migrationDestinationStorage.length === 1 ? '' : 's'}` : '' }}
                        </div>
                      </div>
                      <span class="badge badge-info">target</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div v-else-if="activeTab === 'portability'">
              <div class="dashboard-panels">
                <div class="dash-card">
                  <div class="dash-card-label">Export Virtual Machine</div>
                  <p class="text-muted" style="margin-bottom:12px">
                    Stream a XenServer XVA package or a metadata-only archive directly from the selected workload without leaving the VM details workspace.
                  </p>
                  <div class="form-actions" style="justify-content:flex-start">
                    <button class="form-btn"
                            type="button"
                            :disabled="Boolean(exportBusy)"
                            @click="exportSelectedVM(false)">
                      <span class="mdi mdi-package-down"></span>
                      {{ exportBusy === 'full' ? 'Exporting...' : 'Export Full XVA' }}
                    </button>
                    <button class="btn btn-sm"
                            type="button"
                            :disabled="Boolean(exportBusy)"
                            @click="exportSelectedVM(true)">
                      <span class="mdi mdi-file-document-outline"></span>
                      {{ exportBusy === 'metadata' ? 'Exporting...' : 'Export Metadata' }}
                    </button>
                  </div>
                </div>

                <div class="dash-card">
                  <div class="dash-card-label">Portability Guidance</div>
                  <div class="stack-list">
                    <div class="stack-item">
                      <div>
                        <strong>Archive Scope</strong>
                        <div class="text-muted mono" style="font-size:11px">
                          Full XVA exports include disk payloads for all attached VDIs. Metadata exports capture placement and VM definition details without the disk image bulk.
                        </div>
                      </div>
                      <span class="badge badge-info">scope</span>
                    </div>
                    <div class="stack-item">
                      <div>
                        <strong>Import Targeting</strong>
                        <div class="text-muted mono" style="font-size:11px">
                          Use the top-level Import XVA action to register or restore workloads into any reachable storage target, then reopen the created VM here for post-import validation.
                        </div>
                      </div>
                      <span class="badge badge-info">workflow</span>
                    </div>
                    <div class="stack-item">
                      <div>
                        <strong>Attached Resources</strong>
                        <div class="text-muted mono" style="font-size:11px">
                          {{ attachedVmDisks.length }} disk{{ attachedVmDisks.length === 1 ? '' : 's' }} · {{ attachedVmNetworks.length }} network path{{ attachedVmNetworks.length === 1 ? '' : 's' }} mapped for this workload.
                        </div>
                      </div>
                      <span class="badge badge-info">inventory</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div v-else-if="activeTab === 'duplicate'">
              <div class="dashboard-panels">
                <div class="dash-card">
                  <div class="dash-card-label">Create Clone or Full Copy</div>
                  <p class="text-muted" style="margin-bottom:12px">
                    Provision a fast Copy-on-Write clone for rapid testing, or a full copy when you need isolated disks and explicit storage placement.
                  </p>
                  <vm-duplicate-form
                    :initial-value="selectedVM"
                    :storage-options="relatedStorage"
                    :submit-label="'Create VM Copy'"
                    :saving="duplicateSaving"
                    @submit="submitVMDuplicate">
                  </vm-duplicate-form>
                </div>

                <div class="dash-card">
                  <div class="dash-card-label">Duplication Guidance</div>
                  <div class="stack-list">
                    <div class="stack-item">
                      <div>
                        <strong>Source Readiness</strong>
                        <div class="text-muted mono" style="font-size:11px">
                          XenAPI clone and copy operations require the source VM to be halted before provisioning begins.
                        </div>
                      </div>
                      <span class="badge" :class="selectedVM.power_state === 'Halted' ? 'badge-running' : 'badge-warning'">
                        {{ selectedVM.power_state === 'Halted' ? 'ready' : selectedVM.power_state || 'state' }}
                      </span>
                    </div>
                    <div class="stack-item">
                      <div>
                        <strong>Mode Selection</strong>
                        <div class="text-muted mono" style="font-size:11px">
                          Fast clone keeps disks on a CoW chain for speed, while full copy breaks out full disks onto a selected SR.
                        </div>
                      </div>
                      <span class="badge badge-info">parity</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div v-else-if="activeTab === 'protection'">
              <div class="dashboard-panels">
                <div class="dash-card">
                  <div class="dash-card-label">Create Restore Point</div>
                  <p class="text-muted" style="margin-bottom:12px">
                    Capture a disk snapshot or a checkpoint before patching, application upgrades, or operator-led remediation.
                  </p>
                  <vm-snapshot-form
                    :submit-label="'Create Restore Point'"
                    :saving="snapshotSaving"
                    @submit="submitVMSnapshot">
                  </vm-snapshot-form>
                </div>

                <div class="dash-card">
                  <div class="dash-card-label">Protection Summary</div>
                  <div class="stack-list">
                    <div class="stack-item">
                      <div>
                        <strong>{{ vmSnapshots.length }} restore point{{ vmSnapshots.length === 1 ? '' : 's' }}</strong>
                        <div class="text-muted mono" style="font-size:11px">
                          {{ latestSnapshot ? `Latest ${formatDateTime(latestSnapshot.snapshot_time)}` : 'No VM snapshots or checkpoints have been captured yet.' }}
                        </div>
                      </div>
                      <span class="badge" :class="latestSnapshot ? 'badge-running' : 'badge-warning'">
                        {{ latestSnapshot ? (latestSnapshot.snapshot_mode || 'snapshot') : 'empty' }}
                      </span>
                    </div>
                    <div class="stack-item">
                      <div>
                        <strong>Operator Guidance</strong>
                        <div class="text-muted mono" style="font-size:11px">
                          Use checkpoints for risky live changes and disk snapshots for rollback points that do not need runtime memory preserved.
                        </div>
                      </div>
                      <span class="badge badge-info">workflow</span>
                    </div>
                  </div>
                </div>
              </div>

              <div class="detail-section">
                <div class="detail-section-title">Recovery Points</div>
                <div v-if="vmSnapshots.length" class="stack-list vm-snapshot-list">
                  <div v-for="snapshot in vmSnapshots" :key="snapshot.ref" class="stack-item vm-snapshot-row">
                    <div>
                      <strong>{{ snapshot.name_label || snapshot.ref }}</strong>
                      <div class="text-muted mono" style="font-size:11px">
                        {{ formatDateTime(snapshot.snapshot_time) }} · {{ snapshot.ref }}
                      </div>
                      <div class="text-muted" style="margin-top:6px;font-size:12px">
                        {{ snapshot.name_description || 'No operator note was recorded for this restore point.' }}
                      </div>
                    </div>

                    <div class="vm-snapshot-actions">
                      <span class="badge" :class="snapshot.snapshot_mode === 'checkpoint' ? 'badge-warning' : 'badge-info'">
                        {{ snapshot.snapshot_mode === 'checkpoint' ? 'checkpoint' : 'snapshot' }}
                      </span>
                      <button class="btn btn-sm"
                              :disabled="Boolean(snapshotBusy)"
                              @click="snapshotAction('revert', snapshot)">
                        <span class="mdi mdi-restore"></span>
                        {{ snapshotBusy === `revert:${snapshot.ref}` ? 'Reverting...' : 'Revert' }}
                      </button>
                      <button class="btn btn-danger btn-sm"
                              :disabled="Boolean(snapshotBusy)"
                              @click="snapshotAction('delete', snapshot)">
                        <span class="mdi mdi-delete-outline"></span>
                        {{ snapshotBusy === `delete:${snapshot.ref}` ? 'Deleting...' : 'Delete' }}
                      </button>
                    </div>
                  </div>
                </div>
                <div v-else class="empty-state vm-snapshot-empty">
                  <span class="mdi mdi-camera-off-outline" style="font-size:32px;color:var(--text-secondary)"></span>
                  <p style="margin-top:12px">Create the first restore point for this workload to make rollback and checkpoint recovery available from the VM details pane.</p>
                </div>
              </div>
            </div>

            <div v-else-if="activeTab === 'config'">
              <div class="dashboard-panels">
                <div class="dash-card">
                  <div class="dash-card-label">Config Editor</div>
                  <p class="text-muted" style="margin-bottom:12px">
                    Update the visible workload identity, preferred home server, core sizing, and advanced metadata here. For live environments, XenAPI may require the guest to be halted before some CPU or memory changes apply.
                  </p>
                  <vm-config-form
                    :initial-value="selectedVM"
                    :host-options="vmConfigHostOptions"
                    :appliance-options="relatedAppliances"
                    :snapshot-schedule-options="relatedSnapshotSchedules"
                    :submit-label="'Save VM Config'"
                    :saving="configSaving"
                    @submit="submitVmConfig">
                  </vm-config-form>
                </div>

                <div class="dash-card">
                  <div class="dash-card-label">Current Effective Settings</div>
                  <div class="stack-list">
                    <div class="stack-item">
                      <div>
                        <strong>Compute</strong>
                        <div class="text-muted mono" style="font-size:11px">{{ selectedVM.VCPUs_at_startup || 0 }} vCPU · {{ formatBytes(selectedVM.memory_static_max) }}</div>
                      </div>
                      <span class="badge badge-info">vm</span>
                    </div>
                    <div class="stack-item">
                      <div>
                        <strong>Static Min Memory</strong>
                        <div class="text-muted mono" style="font-size:11px">Floor {{ selectedVmMemoryStaticMinGiB }} GiB at boot time.</div>
                      </div>
                      <span class="badge badge-info">{{ selectedVmMemoryStaticMinGiB }} GiB</span>
                    </div>
                    <div class="stack-item">
                      <div>
                        <strong>Identity</strong>
                        <div class="text-muted mono" style="font-size:11px">{{ selectedVM.uuid || selectedVM.ref }}</div>
                      </div>
                      <span class="badge badge-info">uuid</span>
                    </div>
                    <div class="stack-item">
                      <div>
                        <strong>Version Tag</strong>
                        <div class="text-muted mono" style="font-size:11px">Revision {{ selectedVM.user_version ?? 0 }}</div>
                      </div>
                      <span class="badge badge-info">rev</span>
                    </div>
                    <div class="stack-item">
                      <div>
                        <strong>Start Delay</strong>
                        <div class="text-muted mono" style="font-size:11px">{{ selectedVM.start_delay ?? 0 }} seconds before staged startup continues.</div>
                      </div>
                      <span class="badge badge-info">{{ selectedVM.start_delay ?? 0 }}s</span>
                    </div>
                    <div class="stack-item">
                      <div>
                        <strong>Shutdown Delay</strong>
                        <div class="text-muted mono" style="font-size:11px">{{ selectedVM.shutdown_delay ?? 0 }} seconds before staged shutdown continues.</div>
                      </div>
                      <span class="badge badge-info">{{ selectedVM.shutdown_delay ?? 0 }}s</span>
                    </div>
                    <div class="stack-item">
                      <div>
                        <strong>Boot Order</strong>
                        <div class="text-muted mono" style="font-size:11px">Sequence {{ selectedVM.order ?? 0 }} in pool-managed startup and shutdown ordering.</div>
                      </div>
                      <span class="badge badge-info">#{{ selectedVM.order ?? 0 }}</span>
                    </div>
                    <div class="stack-item">
                      <div>
                        <strong>Virtual Hardware Platform</strong>
                        <div class="text-muted mono" style="font-size:11px">{{ selectedVmHardwarePlatformDetail }}</div>
                      </div>
                      <span class="badge badge-info">{{ selectedVmHardwarePlatformBadge }}</span>
                    </div>
                    <div class="stack-item">
                      <div>
                        <strong>Domain Type</strong>
                        <div class="text-muted mono" style="font-size:11px">{{ selectedVmDomainTypeDetail }}</div>
                      </div>
                      <span class="badge badge-info">{{ selectedVmDomainTypeBadge }}</span>
                    </div>
                    <div class="stack-item">
                      <div>
                        <strong>Secure Boot</strong>
                        <div class="text-muted mono" style="font-size:11px">{{ selectedVmSecureBootDetail }}</div>
                      </div>
                      <span class="badge" :class="selectedVmSecureBootEnabled ? 'badge-running' : 'badge-info'">
                        {{ selectedVmSecureBootEnabled ? 'enabled' : 'disabled' }}
                      </span>
                    </div>
                    <div class="stack-item">
                      <div>
                        <strong>Video RAM</strong>
                        <div class="text-muted mono" style="font-size:11px">{{ selectedVmVideoRamDetail }}</div>
                      </div>
                      <span class="badge badge-info">{{ selectedVmVideoRamBadge }}</span>
                    </div>
                    <div class="stack-item">
                      <div>
                        <strong>IGD Passthrough</strong>
                        <div class="text-muted mono" style="font-size:11px">{{ selectedVmIgdPassthroughDetail }}</div>
                      </div>
                      <span class="badge" :class="selectedVmIgdPassthroughEnabled ? 'badge-running' : 'badge-info'">
                        {{ selectedVmIgdPassthroughEnabled ? 'enabled' : 'disabled' }}
                      </span>
                    </div>
                    <div class="stack-item">
                      <div>
                        <strong>Vendor Device Emulation</strong>
                        <div class="text-muted mono" style="font-size:11px">{{ selectedVmVendorDeviceDetail }}</div>
                      </div>
                      <span class="badge" :class="selectedVmVendorDeviceEnabled ? 'badge-running' : 'badge-info'">
                        {{ selectedVmVendorDeviceEnabled ? 'enabled' : 'disabled' }}
                      </span>
                    </div>
                    <div class="stack-item">
                      <div>
                        <strong>Affinity Preference</strong>
                        <div class="text-muted mono" style="font-size:11px">{{ selectedVmAffinityLabel }}</div>
                      </div>
                      <span class="badge" :class="normalizeVmAffinity(selectedVM.affinity) ? 'badge-running' : 'badge-info'">
                        {{ normalizeVmAffinity(selectedVM.affinity) ? 'pinned' : 'auto' }}
                      </span>
                    </div>
                    <div class="stack-item">
                      <div>
                        <strong>VM Appliance</strong>
                        <div class="text-muted mono" style="font-size:11px">{{ selectedVmApplianceDetail }}</div>
                      </div>
                      <span class="badge" :class="selectedVmAppliance ? 'badge-running' : 'badge-info'">
                        {{ selectedVmAppliance ? `${selectedVmApplianceVmCount} VMs` : 'none' }}
                      </span>
                    </div>
                    <div class="stack-item">
                      <div>
                        <strong>Snapshot Schedule</strong>
                        <div class="text-muted mono" style="font-size:11px">{{ selectedVmSnapshotScheduleDetail }}</div>
                      </div>
                      <span class="badge" :class="selectedVmSnapshotSchedule ? (selectedVmSnapshotScheduleEnabled ? 'badge-running' : 'badge-warning') : 'badge-info'">
                        {{ selectedVmSnapshotSchedule ? (selectedVmSnapshotScheduleEnabled ? 'enabled' : 'disabled') : 'none' }}
                      </span>
                    </div>
                    <div class="stack-item">
                      <div>
                        <strong>Protection Policy</strong>
                        <div class="text-muted mono" style="font-size:11px">{{ selectedVmProtectionPolicyDetail }}</div>
                      </div>
                      <span class="badge" :class="selectedVmProtectionPolicy ? 'badge-warning' : 'badge-info'">
                        {{ selectedVmProtectionPolicy ? 'legacy' : 'none' }}
                      </span>
                    </div>
                    <div class="stack-item">
                      <div>
                        <strong>Tag Set</strong>
                        <div class="text-muted mono" style="font-size:11px">{{ truncateList(selectedVM.tags) }}</div>
                      </div>
                      <span class="badge badge-info">{{ (selectedVM.tags || []).length || 0 }}</span>
                    </div>
                    <div class="stack-item">
                      <div>
                        <strong>Blocked Operations</strong>
                        <div class="text-muted mono" style="font-size:11px">{{ selectedVmBlockedOperationsSummary }}</div>
                      </div>
                      <span class="badge" :class="selectedVmBlockedOperationsCount ? 'badge-warning' : 'badge-info'">
                        {{ selectedVmBlockedOperationsCount || 'none' }}
                      </span>
                    </div>
                    <div class="stack-item">
                      <div>
                        <strong>VM VCPUs_params</strong>
                        <div class="text-muted mono" style="font-size:11px">{{ selectedVmVcpusParamsSummary }}</div>
                      </div>
                      <span class="badge badge-info">{{ selectedVmVcpusParamsCount }}</span>
                    </div>
                    <div class="stack-item">
                      <div>
                        <strong>VM other_config</strong>
                        <div class="text-muted mono" style="font-size:11px">{{ selectedVmOtherConfigSummary }}</div>
                      </div>
                      <span class="badge badge-info">{{ selectedVmOtherConfigCount }}</span>
                    </div>
                    <div class="stack-item">
                      <div>
                        <strong>VM xenstore_data</strong>
                        <div class="text-muted mono" style="font-size:11px">{{ selectedVmXenstoreDataSummary }}</div>
                      </div>
                      <span class="badge badge-info">{{ selectedVmXenstoreDataCount }}</span>
                    </div>
                    <div class="stack-item">
                      <div>
                        <strong>VM NVRAM</strong>
                        <div class="text-muted mono" style="font-size:11px">{{ selectedVmNvramDetail }}</div>
                      </div>
                      <span class="badge badge-info">{{ selectedVmNvramCount }}</span>
                    </div>
                    <div class="stack-item">
                      <div>
                        <strong>VM platform</strong>
                        <div class="text-muted mono" style="font-size:11px">{{ selectedVmPlatformSummary }}</div>
                      </div>
                      <span class="badge badge-info">{{ selectedVmPlatformCount }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div v-else>
              <div class="dashboard-panels">
                <div class="dash-card">
                  <div class="dash-card-label">Add Virtual Disk</div>
                  <p class="text-muted" style="margin-bottom:12px">Create and attach an additional VDI to this workload from an available storage repository.</p>
                  <vm-device-form
                    mode="disk"
                    :storage-options="relatedStorage"
                    :network-options="[]"
                    :submit-label="'Add Disk Device'"
                    :saving="diskSaving"
                    @submit="submitDiskDevice">
                  </vm-device-form>
                </div>

                <div class="dash-card">
                  <div class="dash-card-label">Add Network Interface</div>
                  <p class="text-muted" style="margin-bottom:12px">Attach an additional virtual NIC to an available network fabric for the current pool or environment.</p>
                  <vm-device-form
                    mode="nic"
                    :storage-options="[]"
                    :network-options="relatedNetworks"
                    :submit-label="'Add Network Device'"
                    :saving="nicSaving"
                    @submit="submitNicDevice">
                  </vm-device-form>
                </div>
              </div>
            </div>
          </template>
        </div>
      </floating-window>

      <floating-window :show="showImportWindow"
                       title="Import Virtual Machine"
                       :width="700"
                       :height="620"
                       @close="closeImportWindow">
        <div class="stack-list">
          <div class="form-error" v-if="importError" style="text-align:left">{{ importError }}</div>
          <div v-if="importStatusMessage" class="stack-item">
            <div>
              <strong>Import Completed</strong>
              <div class="text-muted mono" style="font-size:11px">{{ importStatusMessage }}</div>
            </div>
            <span class="badge badge-running">ready</span>
          </div>
          <vm-import-form
            :storage-options="importStorageOptions"
            :saving="importSaving"
            :submit-label="'Import Virtual Machine'"
            @submit="submitVMImport">
          </vm-import-form>
        </div>
      </floating-window>
    </div>
  `,
  data() {
    return {
      loading: true,
      vms: [],
      showProps: false,
      showImportWindow: false,
      selectedVM: null,
      detailLoading: false,
      detailError: null,
      actionError: null,
      actionBusy: '',
      importSaving: false,
      importError: null,
      importStatusMessage: '',
      exportBusy: '',
      configSaving: false,
      diskSaving: false,
      nicSaving: false,
      migrationSaving: false,
      migrationDestinationLoading: false,
      migrationDestinationError: null,
      migrationDestinationTargetKey: '',
      migrationDestinationHosts: [],
      migrationDestinationPools: [],
      migrationDestinationStorage: [],
      migrationDestinationNetworks: [],
      duplicateSaving: false,
      snapshotSaving: false,
      activeTab: 'overview',
      lastAppliedFocusKey: '',
      automationTasks: [],
      migrationSeed: null,
      migrationSourceTask: null,
      selectedVmRefs: [],
      bulkActionBusy: '',
      bulkError: null,
      relatedHosts: [],
      relatedPools: [],
      relatedAppliances: [],
      relatedSnapshotSchedules: [],
      relatedStorage: [],
      relatedNetworks: [],
      relatedVdis: [],
      vmCompatibility: { hosts: [], lastBootCpuFlags: {}, possibleHostRefs: [], hardwarePlatformVersion: 0, maskingApiAvailable: false },
      vmConsoles: [],
      vmSnapshots: [],
      vmMetricHistory: { metrics: [] },
      snapshotBusy: '',
      tabs: [
        { key: 'overview', label: 'Overview', icon: 'mdi-card-account-details-outline' },
        { key: 'resources', label: 'Resources', icon: 'mdi-vector-link' },
        { key: 'compatibility', label: 'Compatibility', icon: 'mdi-chip' },
        { key: 'console', label: 'Console', icon: 'mdi-monitor-dashboard' },
        { key: 'migration', label: 'Migration', icon: 'mdi-swap-horizontal-bold' },
        { key: 'portability', label: 'Import / Export', icon: 'mdi-package-variant-closed' },
        { key: 'duplicate', label: 'Clone / Copy', icon: 'mdi-content-copy' },
        { key: 'protection', label: 'Protection', icon: 'mdi-camera-timer' },
        { key: 'config', label: 'Config', icon: 'mdi-tune-variant' },
        { key: 'devices', label: 'Add Devices', icon: 'mdi-plus-box-multiple-outline' },
      ],
      columns: [
        { key: 'name_label', label: 'Name' },
        { key: 'power_state', label: 'State' },
        { key: 'VCPUs_at_startup', label: 'vCPUs' },
        { key: 'memory_static_max', label: 'Memory' },
        { key: 'uuid', label: 'UUID' },
      ],
      diskColumns: [
        { key: 'name_label', label: 'Disk' },
        { key: 'storageName', label: 'Storage' },
        { key: 'virtual_size', label: 'Capacity' },
        { key: 'type', label: 'Type' },
        { key: 'ref', label: 'Reference' },
      ],
      networkColumns: [
        { key: 'name_label', label: 'Network' },
        { key: 'bridge', label: 'Bridge' },
        { key: 'vlan', label: 'VLAN' },
        { key: 'managed', label: 'State' },
        { key: 'ref', label: 'Reference' },
      ],
      compatibilityColumns: [
        { key: 'name_label', label: 'Host' },
        { key: 'readiness', label: 'Readiness' },
        { key: 'compatible', label: 'Placement' },
        { key: 'cpuModel', label: 'CPU Model' },
        { key: 'compatibilityError', label: 'Operator Note' },
      ],
    };
  },
  computed: {
    currentTargetKey() {
      return String(store.currentTargetKey || '').trim();
    },
    selectedVmRows() {
      const selected = new Set(Array.isArray(this.selectedVmRefs) ? this.selectedVmRefs : []);
      return this.vms.filter((vm) => selected.has(vm.ref));
    },
    selectedVmStateCounts() {
      return this.selectedVmRows.reduce((counts, vm) => {
        const state = String(vm.power_state || '').trim().toLowerCase();
        if (state === 'running') counts.running += 1;
        else if (state === 'halted') counts.halted += 1;
        else if (state === 'suspended') counts.suspended += 1;
        else counts.other += 1;
        return counts;
      }, { running: 0, halted: 0, suspended: 0, other: 0 });
    },
    selectedVmSelectionSummary() {
      const parts = [];
      if (this.selectedVmStateCounts.running) parts.push(`${this.selectedVmStateCounts.running} running`);
      if (this.selectedVmStateCounts.halted) parts.push(`${this.selectedVmStateCounts.halted} halted`);
      if (this.selectedVmStateCounts.suspended) parts.push(`${this.selectedVmStateCounts.suspended} suspended`);
      if (this.selectedVmStateCounts.other) parts.push(`${this.selectedVmStateCounts.other} other`);
      return parts.length ? parts.join(' · ') : 'No selected VM power states were recognized.';
    },
    migrationInitialDraft() {
      return this.migrationSeed ? { ...this.migrationSeed } : null;
    },
    migrationTargetOptions() {
      return (Array.isArray(store.connectedTargets) ? store.connectedTargets : [])
        .filter((target) => String(target?.targetKey || '').trim())
        .filter((target) => String(target.targetKey || '').trim() !== this.currentTargetKey);
    },
    migrationDestinationTargetLabel() {
      const target = this.migrationTargetOptions.find((entry) => entry.targetKey === this.migrationDestinationTargetKey) || null;
      return target ? (target.connectionName || target.host || target.targetKey) : '';
    },
    selectedVmHost() {
      if (!this.selectedVM) return null;

      const refs = [this.selectedVM.resident_on, this.normalizeVmAffinity(this.selectedVM.affinity)]
        .filter(Boolean)
        .map((value) => String(value).toLowerCase());

      return this.relatedHosts.find((host) =>
        [host.ref, host.uuid, host.name_label, host.hostname]
          .filter(Boolean)
          .map((value) => String(value).toLowerCase())
          .some((value) => refs.includes(value))
      ) || null;
    },
    selectedVmAffinityHost() {
      const affinityRef = this.normalizeVmAffinity(this.selectedVM?.affinity);
      if (!affinityRef) return null;
      return this.relatedHosts.find((host) => String(host?.ref || '').trim() === affinityRef) || null;
    },
    selectedVmAffinityLabel() {
      const affinityRef = this.normalizeVmAffinity(this.selectedVM?.affinity);
      if (!affinityRef) return 'Automatic / no preference';
      return this.selectedVmAffinityHost
        ? `${this.selectedVmAffinityHost.name_label || this.selectedVmAffinityHost.address || this.selectedVmAffinityHost.ref} (${affinityRef})`
        : affinityRef;
    },
    selectedVmAppliance() {
      const applianceRef = String(this.selectedVM?.appliance || '').trim();
      if (!applianceRef || applianceRef === 'OpaqueRef:NULL') return null;
      return this.relatedAppliances.find((appliance) => String(appliance?.ref || '').trim() === applianceRef) || {
        ref: applianceRef,
        name_label: applianceRef,
        VMs: [],
      };
    },
    selectedVmApplianceVmCount() {
      return Array.isArray(this.selectedVmAppliance?.VMs) ? this.selectedVmAppliance.VMs.length : 0;
    },
    selectedVmApplianceSummary() {
      return this.selectedVmAppliance?.name_label || this.selectedVmAppliance?.uuid || this.selectedVmAppliance?.ref || 'None';
    },
    selectedVmApplianceDetail() {
      if (!this.selectedVmAppliance) {
        return 'No VM appliance grouping is pinned for this workload.';
      }
      return `${this.selectedVmApplianceSummary} coordinates grouped startup and shutdown sequencing across ${this.selectedVmApplianceVmCount} VM${this.selectedVmApplianceVmCount === 1 ? '' : 's'} in this appliance.`;
    },
    selectedVmSnapshotSchedule() {
      const snapshotScheduleRef = String(this.selectedVM?.snapshot_schedule || '').trim();
      if (!snapshotScheduleRef || snapshotScheduleRef === 'OpaqueRef:NULL') return null;
      return this.relatedSnapshotSchedules.find((schedule) => String(schedule?.ref || '').trim() === snapshotScheduleRef) || {
        ref: snapshotScheduleRef,
        name_label: snapshotScheduleRef,
        VMs: [],
      };
    },
    selectedVmSnapshotScheduleEnabled() {
      return Boolean(this.selectedVmSnapshotSchedule?.enabled);
    },
    selectedVmSnapshotScheduleVmCount() {
      return Array.isArray(this.selectedVmSnapshotSchedule?.VMs) ? this.selectedVmSnapshotSchedule.VMs.length : 0;
    },
    selectedVmSnapshotScheduleSummary() {
      return this.selectedVmSnapshotSchedule?.name_label || this.selectedVmSnapshotSchedule?.uuid || this.selectedVmSnapshotSchedule?.ref || 'None';
    },
    selectedVmSnapshotScheduleDetail() {
      if (!this.selectedVmSnapshotSchedule) {
        return 'No automatic snapshot schedule is pinned for this workload.';
      }
      const cadence = String(this.selectedVmSnapshotSchedule.frequency || 'custom').replace(/_/g, ' ');
      const retainedSnapshots = Math.max(0, Number(this.selectedVmSnapshotSchedule.retained_snapshots || 0) || 0);
      const timeWindowParts = [];
      if (this.selectedVmSnapshotSchedule.schedule?.hour !== undefined || this.selectedVmSnapshotSchedule.schedule?.min !== undefined) {
        const hour = String(this.selectedVmSnapshotSchedule.schedule?.hour ?? '00').padStart(2, '0');
        const minute = String(this.selectedVmSnapshotSchedule.schedule?.min ?? '00').padStart(2, '0');
        timeWindowParts.push(`${hour}:${minute} local`);
      }
      if (String(this.selectedVmSnapshotSchedule.schedule?.days || '').trim()) {
        timeWindowParts.push(`days ${this.selectedVmSnapshotSchedule.schedule.days}`);
      }
      const timeWindow = timeWindowParts.length ? ` Window ${timeWindowParts.join(' · ')}.` : '';
      return `${this.selectedVmSnapshotScheduleSummary} is ${this.selectedVmSnapshotScheduleEnabled ? 'enabled' : 'disabled'} on a ${cadence} cadence, retains ${retainedSnapshots} snapshot${retainedSnapshots === 1 ? '' : 's'}, and currently covers ${this.selectedVmSnapshotScheduleVmCount} VM${this.selectedVmSnapshotScheduleVmCount === 1 ? '' : 's'}.${timeWindow}`;
    },
    selectedVmProtectionPolicy() {
      const protectionPolicyRef = String(this.selectedVM?.protection_policy || '').trim();
      if (!protectionPolicyRef || protectionPolicyRef === 'OpaqueRef:NULL') return '';
      return protectionPolicyRef;
    },
    selectedVmProtectionPolicySummary() {
      return this.selectedVmProtectionPolicy || 'None / not reported';
    },
    selectedVmProtectionPolicyDetail() {
      if (!this.selectedVmProtectionPolicy) {
        return 'No legacy VMPP protection policy reference is reported for this workload.';
      }
      return `${this.selectedVmProtectionPolicy} is a legacy VMPP reference. Upstream XAPI deprecated VMPP in XenServer 6.2 and marked the class removed in XenServer 6.2, so XenMange surfaces this field as read-only guidance instead of an editable policy assignment.`;
    },
    selectedVmOtherConfigEntries() {
      return Object.entries(this.selectedVM?.other_config || {})
        .filter(([key, value]) => String(key || '').trim() && String(value || '').trim());
    },
    selectedVmVcpusParamsEntries() {
      return Object.entries(this.selectedVM?.VCPUs_params || {})
        .filter(([key, value]) => String(key || '').trim() && String(value || '').trim());
    },
    selectedVmVcpusParamsCount() {
      return this.selectedVmVcpusParamsEntries.length;
    },
    selectedVmVcpusParamsSummary() {
      if (!this.selectedVmVcpusParamsEntries.length) return '-';
      const summary = this.selectedVmVcpusParamsEntries
        .slice(0, 2)
        .map(([key, value]) => `${key}=${value}`)
        .join(' · ');
      if (this.selectedVmVcpusParamsEntries.length <= 2) return summary;
      return `${summary} +${this.selectedVmVcpusParamsEntries.length - 2} more`;
    },
    selectedVmMemoryStaticMinGiB() {
      return Math.max(0, Math.round(Number(this.selectedVM?.memory_static_min || this.selectedVM?.memory_static_max || 0) / (1024 ** 3)) || 0);
    },
    selectedVmHardwarePlatformVersion() {
      return Math.max(0, Number(this.selectedVM?.hardware_platform_version || 0) || 0);
    },
    selectedVmHardwarePlatformSummary() {
      return this.selectedVmHardwarePlatformVersion ? `v${this.selectedVmHardwarePlatformVersion}` : 'Auto / default';
    },
    selectedVmHardwarePlatformDetail() {
      if (!this.selectedVmHardwarePlatformVersion) {
        return 'No explicit virtual hardware platform override is pinned for this workload.';
      }
      return `Pinned to virtual hardware platform version ${this.selectedVmHardwarePlatformVersion} for host compatibility checks.`;
    },
    selectedVmHardwarePlatformBadge() {
      return this.selectedVmHardwarePlatformVersion ? `v${this.selectedVmHardwarePlatformVersion}` : 'auto';
    },
    selectedVmDomainTypeValue() {
      const explicit = String(this.selectedVM?.domain_type || '').trim().toLowerCase();
      if (explicit) return explicit;
      if (String(this.selectedVM?.HVM_boot_policy || '').trim()) return 'hvm';
      if (String(this.selectedVM?.PV_bootloader || this.selectedVM?.PV_kernel || '').trim()) return 'pv';
      return 'unspecified';
    },
    selectedVmDomainTypeSummary() {
      return {
        unspecified: 'Automatic / Unspecified',
        hvm: 'HVM',
        pv: 'PV',
        pvh: 'PVH',
        pv_in_pvh: 'PV in PVH',
      }[this.selectedVmDomainTypeValue] || 'Automatic / Unspecified';
    },
    selectedVmDomainTypeDetail() {
      return `${this.selectedVmDomainTypeSummary} takes effect on the next VM boot and supersedes legacy HVM boot-policy tuning.`;
    },
    selectedVmDomainTypeBadge() {
      return this.selectedVmDomainTypeValue === 'unspecified' ? 'auto' : this.selectedVmDomainTypeSummary;
    },
    selectedVmSecureBootEnabled() {
      const normalized = String(this.selectedVM?.platform?.secureboot || '').trim().toLowerCase();
      return ['1', 'true', 'enabled', 'on', 'yes', 'required'].includes(normalized);
    },
    selectedVmSecureBootSummary() {
      return this.selectedVmSecureBootEnabled ? 'Enabled' : 'Disabled';
    },
    selectedVmSecureBootDetail() {
      return this.selectedVmSecureBootEnabled
        ? 'Secure Boot is enabled for platform-mediated guest boot validation.'
        : 'Secure Boot is disabled for this workload platform profile.';
    },
    selectedVmVideoRamMiB() {
      const normalized = Number(this.selectedVM?.platform?.videoram || 0);
      if (!Number.isFinite(normalized)) return 0;
      return Math.max(0, Math.round(normalized));
    },
    selectedVmVideoRamSummary() {
      return this.selectedVmVideoRamMiB ? `${this.selectedVmVideoRamMiB} MiB` : 'Auto / default';
    },
    selectedVmVideoRamDetail() {
      if (!this.selectedVmVideoRamMiB) {
        return 'No explicit virtual display memory override is pinned for this workload.';
      }
      return `Pinned to ${this.selectedVmVideoRamMiB} MiB of virtual display memory for the guest graphics adapter on the next VM boot.`;
    },
    selectedVmVideoRamBadge() {
      return this.selectedVmVideoRamMiB ? `${this.selectedVmVideoRamMiB} MiB` : 'auto';
    },
    selectedVmIgdPassthroughEnabled() {
      const normalized = String(this.selectedVM?.platform?.igd_passthrough || '').trim().toLowerCase();
      return ['1', 'true', 'enabled', 'on', 'yes', 'required'].includes(normalized);
    },
    selectedVmIgdPassthroughSummary() {
      return this.selectedVmIgdPassthroughEnabled ? 'Enabled' : 'Disabled';
    },
    selectedVmIgdPassthroughDetail() {
      return this.selectedVmIgdPassthroughEnabled
        ? 'The Intel integrated graphics passthrough hint is enabled for the next VM boot and requires compatible host GPU support.'
        : 'The Intel integrated graphics passthrough hint is disabled for this workload platform profile.';
    },
    selectedVmVendorDeviceEnabled() {
      return Boolean(this.selectedVM?.has_vendor_device);
    },
    selectedVmVendorDeviceSummary() {
      return this.selectedVmVendorDeviceEnabled ? 'Enabled' : 'Disabled';
    },
    selectedVmVendorDeviceDetail() {
      return this.selectedVmVendorDeviceEnabled
        ? 'The HVM vendor-device PCI hint is enabled for Windows PV-driver discovery on next boot.'
        : 'The HVM vendor-device PCI hint is disabled for this workload profile.';
    },
    selectedVmBlockedOperationsEntries() {
      return Object.entries(this.selectedVM?.blocked_operations || {})
        .filter(([key, value]) => String(key || '').trim() && String(value || '').trim());
    },
    selectedVmBlockedOperationsCount() {
      return this.selectedVmBlockedOperationsEntries.length;
    },
    selectedVmBlockedOperationsSummary() {
      if (!this.selectedVmBlockedOperationsEntries.length) return '-';
      const summary = this.selectedVmBlockedOperationsEntries
        .slice(0, 2)
        .map(([key, value]) => `${key}=${value}`)
        .join(' · ');
      if (this.selectedVmBlockedOperationsEntries.length <= 2) return summary;
      return `${summary} +${this.selectedVmBlockedOperationsEntries.length - 2} more`;
    },
    selectedVmOtherConfigCount() {
      return this.selectedVmOtherConfigEntries.length;
    },
    selectedVmOtherConfigSummary() {
      if (!this.selectedVmOtherConfigEntries.length) return '-';
      const summary = this.selectedVmOtherConfigEntries
        .slice(0, 2)
        .map(([key, value]) => `${key}=${value}`)
        .join(' · ');
      if (this.selectedVmOtherConfigEntries.length <= 2) return summary;
      return `${summary} +${this.selectedVmOtherConfigEntries.length - 2} more`;
    },
    selectedVmXenstoreDataEntries() {
      return Object.entries(this.selectedVM?.xenstore_data || {})
        .filter(([key, value]) => String(key || '').trim() && String(value || '').trim());
    },
    selectedVmXenstoreDataCount() {
      return this.selectedVmXenstoreDataEntries.length;
    },
    selectedVmXenstoreDataSummary() {
      if (!this.selectedVmXenstoreDataEntries.length) return '-';
      const summary = this.selectedVmXenstoreDataEntries
        .slice(0, 2)
        .map(([key, value]) => `${key}=${value}`)
        .join(' · ');
      if (this.selectedVmXenstoreDataEntries.length <= 2) return summary;
      return `${summary} +${this.selectedVmXenstoreDataEntries.length - 2} more`;
    },
    selectedVmNvramEntries() {
      return Object.entries(this.selectedVM?.NVRAM || {})
        .filter(([key, value]) => String(key || '').trim() && String(value || '').trim());
    },
    selectedVmNvramCount() {
      return this.selectedVmNvramEntries.length;
    },
    selectedVmNvramSummary() {
      if (!this.selectedVmNvramEntries.length) return '-';
      const summary = this.selectedVmNvramEntries
        .slice(0, 2)
        .map(([key, value]) => `${key}=${value}`)
        .join(' · ');
      if (this.selectedVmNvramEntries.length <= 2) return summary;
      return `${summary} +${this.selectedVmNvramEntries.length - 2} more`;
    },
    selectedVmNvramDetail() {
      if (!this.selectedVmNvramEntries.length) {
        return 'No explicit guest NVRAM overrides are pinned for this workload.';
      }
      return `${this.selectedVmNvramSummary} Xen only applies NVRAM updates while the VM is halted.`;
    },
    selectedVmPlatformEntries() {
      return Object.entries(this.selectedVM?.platform || {})
        .filter(([key, value]) => String(key || '').trim() && String(value || '').trim());
    },
    selectedVmPlatformCount() {
      return this.selectedVmPlatformEntries.length;
    },
    selectedVmPlatformSummary() {
      if (!this.selectedVmPlatformEntries.length) return '-';
      const summary = this.selectedVmPlatformEntries
        .slice(0, 2)
        .map(([key, value]) => `${key}=${value}`)
        .join(' · ');
      if (this.selectedVmPlatformEntries.length <= 2) return summary;
      return `${summary} +${this.selectedVmPlatformEntries.length - 2} more`;
    },
    selectedVmPool() {
      if (this.selectedVmHost) {
        const hostPoolKeys = [this.selectedVmHost.pool, this.selectedVmHost.pool_ref, this.selectedVmHost.pool_uuid, this.selectedVmHost.pool_name]
          .filter(Boolean)
          .map((value) => String(value).toLowerCase());

        if (hostPoolKeys.length) {
          const direct = this.relatedPools.find((pool) =>
            [pool.ref, pool.uuid, pool.name_label]
              .filter(Boolean)
              .map((value) => String(value).toLowerCase())
              .some((value) => hostPoolKeys.includes(value))
          );
          if (direct) return direct;
        }

        const relationship = this.relatedPools.find((pool) => this.poolContainsHost(pool, this.selectedVmHost));
        if (relationship) return relationship;
      }

      if (this.relatedPools.length === 1) return this.relatedPools[0];
      return null;
    },
    attachedVmDisks() {
      if (!this.selectedVM) return [];

      const vbdRefs = new Set(Array.isArray(this.selectedVM.VBDs) ? this.selectedVM.VBDs : []);
      return this.relatedVdis
        .filter((vdi) => Array.isArray(vdi.VBDs) && vdi.VBDs.some((ref) => vbdRefs.has(ref)))
        .map((vdi) => ({
          ...vdi,
          storageName: this.relatedStorage.find((sr) => sr.ref === vdi.SR)?.name_label || vdi.SR || '-',
        }));
    },
    attachedVmNetworks() {
      if (!this.selectedVM) return [];

      const vifRefs = new Set(Array.isArray(this.selectedVM.VIFs) ? this.selectedVM.VIFs : []);
      return this.relatedNetworks
        .filter((network) => Array.isArray(network.VIFs) && network.VIFs.some((ref) => vifRefs.has(ref)))
        .map((network) => ({
          ...network,
          vlan: (network.other_config || {}).vlan || '-',
        }));
    },
    migrationHostOptions() {
      const currentHostRef = this.selectedVmHost?.ref || this.selectedVM?.resident_on || this.normalizeVmAffinity(this.selectedVM?.affinity) || '';
      return this.relatedHosts
        .filter((host) => host.ref !== currentHostRef)
        .filter((host) => this.hostBelongsToSelectedPool(host))
        .sort((left, right) => {
          if (Boolean(left.enabled) !== Boolean(right.enabled)) {
            return left.enabled ? -1 : 1;
          }
          return String(left.name_label || left.address || left.ref).localeCompare(String(right.name_label || right.address || right.ref));
        });
    },
    vmConfigHostOptions() {
      return this.relatedHosts
        .filter((host) => this.hostBelongsToSelectedPool(host))
        .sort((left, right) => {
          const leftPinned = left.ref === this.normalizeVmAffinity(this.selectedVM?.affinity);
          const rightPinned = right.ref === this.normalizeVmAffinity(this.selectedVM?.affinity);
          if (leftPinned !== rightPinned) return leftPinned ? -1 : 1;
          if (Boolean(left.enabled) !== Boolean(right.enabled)) return left.enabled ? -1 : 1;
          return String(left.name_label || left.address || left.ref).localeCompare(String(right.name_label || right.address || right.ref));
        });
    },
    importStorageOptions() {
      return Array.isArray(this.relatedStorage) ? this.relatedStorage : [];
    },
    overviewCards() {
      return [
        {
          key: 'placement',
          label: 'Placement',
          value: this.selectedVmHost ? (this.selectedVmHost.name_label || 'Host') : 'Pending',
          detail: this.selectedVmPool ? `Pool ${this.selectedVmPool.name_label || this.selectedVmPool.uuid || this.selectedVmPool.ref}` : 'No pool relationship mapped',
          valueClass: this.selectedVmHost ? 'text-green' : 'text-amber',
        },
        {
          key: 'storage',
          label: 'Attached Disks',
          value: String(this.attachedVmDisks.length),
          detail: this.attachedVmDisks.length ? `${formatBytes(this.attachedVmDisks.reduce((sum, disk) => sum + Number(disk.virtual_size || 0), 0))} total capacity mapped` : 'No disk mappings discovered',
          valueClass: this.attachedVmDisks.length ? 'text-cyan' : '',
        },
        {
          key: 'networks',
          label: 'Network Paths',
          value: String(this.attachedVmNetworks.length),
          detail: this.attachedVmNetworks.length ? this.attachedVmNetworks.map((network) => network.name_label || network.bridge).join(', ') : 'No NIC mappings discovered',
          valueClass: this.attachedVmNetworks.length ? 'text-green' : '',
        },
        {
          key: 'boot',
          label: 'Boot Profile',
          value: this.selectedVmDomainTypeSummary,
          detail: `${this.selectedVmSecureBootSummary} secure boot · ${this.selectedVmVendorDeviceSummary} vendor device`,
          valueClass: 'text-amber',
        },
      ];
    },
    latestSnapshot() {
      return this.vmSnapshots[0] || null;
    },
    compatibilityHosts() {
      return Array.isArray(this.vmCompatibility?.hosts) ? this.vmCompatibility.hosts : [];
    },
    compatibleHostCount() {
      return this.compatibilityHosts.filter((host) => host.compatible).length;
    },
    compatibilityFlagRows() {
      return Object.entries(this.vmCompatibility?.lastBootCpuFlags || {})
        .map(([key, value]) => ({ key, value: String(value) }))
        .slice(0, 18);
    },
    compatibilityFlagCount() {
      return this.compatibilityFlagRows.length;
    },
    primaryConsole() {
      return this.vmConsoles[0] || null;
    },
  },
  async mounted() {
    if (!store.authenticated) {
      this.$router.push('/login');
      return;
    }
    await this.loadVMs();
    await this.syncRouteFocus();
  },
  watch: {
    '$route.query': {
      deep: true,
      async handler() {
        await this.syncRouteFocus();
      },
    },
    vms() {
      const validRefs = new Set(this.vms.map((vm) => vm.ref));
      this.selectedVmRefs = this.selectedVmRefs.filter((ref) => validRefs.has(ref));
    },
  },
  methods: {
    formatBytes,
    formatThroughput,
    formatDateTime,
    truncateList,
    normalizeVmAffinity(value = '') {
      const normalized = String(value || '').trim();
      return normalized === 'OpaqueRef:NULL' ? '' : normalized;
    },
    downloadBlob(content, type, filename) {
      const blob = content instanceof Blob ? content : new Blob([content], { type });
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      window.URL.revokeObjectURL(url);
    },
    vmMetricSeries(metricName) {
      return (this.vmMetricHistory.metrics || []).find((entry) => entry.metricName === metricName)?.points || [];
    },
    combinedVmMetricSeries(metricNames = []) {
      const buckets = new Map();
      (Array.isArray(metricNames) ? metricNames : []).forEach((metricName) => {
        const points = this.vmMetricSeries(metricName);
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
    historyStatus(series, thresholds = {}) {
      const points = Array.isArray(series) ? series : [];
      const latest = Number(points[points.length - 1]?.value || 0);
      if (thresholds.critical !== undefined && latest >= thresholds.critical) return 'critical';
      if (thresholds.warning !== undefined && latest >= thresholds.warning) return 'warning';
      return 'success';
    },
    async loadVMs() {
      this.loading = true;
      try {
        const result = await api.getVMs();
        this.vms = result.data || [];
      } catch (error) {
        console.error(error);
      } finally {
        this.loading = false;
      }
      await this.syncRouteFocus();
    },
    handleVmSelectionChange(keys) {
      this.selectedVmRefs = Array.isArray(keys) ? keys : [];
      this.bulkError = null;
    },
    clearVmSelection() {
      this.selectedVmRefs = [];
      this.bulkError = null;
    },
    async ensureAutomationTasksLoaded(force = false) {
      if (!force && this.automationTasks.length) return;

      const result = await api.getTasks().catch(() => ({ data: [] }));
      this.automationTasks = result.data || [];
    },
    async openProperties(row, options = {}) {
      const nextActiveTab = String(options.activeTab || '').trim() || 'overview';
      const nextMigrationSeed = options.migrationSeed && typeof options.migrationSeed === 'object'
        ? { ...options.migrationSeed }
        : null;

      this.selectedVM = row;
      this.showProps = true;
      this.activeTab = nextActiveTab;
      this.actionError = null;
      this.exportBusy = '';
      this.migrationSeed = nextMigrationSeed;
      this.migrationSourceTask = options.migrationSourceTask || null;
      await this.loadVmDetail(row.ref);

      if (nextMigrationSeed?.mode === 'cross-pool' && nextMigrationSeed.destinationTargetKey) {
        await this.ensureMigrationDestinationContext(nextMigrationSeed.destinationTargetKey);
      }
    },
    async ensureImportContext() {
      try {
        const [hosts, pools, storage, networks] = await Promise.all([
          api.getHosts().catch(() => ({ data: [] })),
          api.getPools().catch(() => ({ data: [] })),
          api.getSRs().catch(() => ({ data: [] })),
          api.getNetworks().catch(() => ({ data: [] })),
        ]);
        this.relatedHosts = hosts.data || [];
        this.relatedPools = pools.data || [];
        this.relatedStorage = storage.data || [];
        this.relatedNetworks = networks.data || [];
      } catch (error) {
        this.importError = error.message || 'Unable to load import targets';
      }
    },
    resetMigrationDestinationContext() {
      this.migrationDestinationLoading = false;
      this.migrationDestinationError = null;
      this.migrationDestinationTargetKey = '';
      this.migrationDestinationHosts = [];
      this.migrationDestinationPools = [];
      this.migrationDestinationStorage = [];
      this.migrationDestinationNetworks = [];
    },
    async loadMigrationDestinationContext(targetKey = '') {
      const normalizedTargetKey = String(targetKey || '').trim();
      if (!normalizedTargetKey) {
        this.resetMigrationDestinationContext();
        return;
      }

      this.migrationDestinationLoading = true;
      this.migrationDestinationError = null;
      this.migrationDestinationTargetKey = normalizedTargetKey;

      try {
        const [hosts, pools, storage, networks] = await Promise.all([
          api.getHosts(normalizedTargetKey).catch(() => ({ data: [] })),
          api.getPools(normalizedTargetKey).catch(() => ({ data: [] })),
          api.getSRs(normalizedTargetKey).catch(() => ({ data: [] })),
          api.getNetworks(normalizedTargetKey).catch(() => ({ data: [] })),
        ]);

        this.migrationDestinationHosts = hosts.data || [];
        this.migrationDestinationPools = pools.data || [];
        this.migrationDestinationStorage = storage.data || [];
        this.migrationDestinationNetworks = networks.data || [];
      } catch (error) {
        this.migrationDestinationError = error.message || 'Unable to load destination migration inventory';
      } finally {
        this.migrationDestinationLoading = false;
      }
    },
    async ensureMigrationDestinationContext(preferredTargetKey = '') {
      const nextTargetKey = String(preferredTargetKey || this.migrationDestinationTargetKey || this.migrationTargetOptions[0]?.targetKey || '').trim();
      if (!nextTargetKey) {
        this.resetMigrationDestinationContext();
        return;
      }

      if (this.migrationDestinationTargetKey === nextTargetKey && (
        this.migrationDestinationHosts.length
        || this.migrationDestinationStorage.length
        || this.migrationDestinationNetworks.length
      )) {
        return;
      }

      await this.loadMigrationDestinationContext(nextTargetKey);
    },
    async handleMigrationTargetChange(targetKey) {
      await this.loadMigrationDestinationContext(targetKey);
    },
    async openImportWindow() {
      this.importError = null;
      this.importStatusMessage = '';
      await this.ensureImportContext();
      this.showImportWindow = true;
    },
    closeImportWindow() {
      this.showImportWindow = false;
      this.importSaving = false;
      this.importError = null;
    },
    findVmByFocus(focus) {
      return this.vms.find((vm) =>
        recordMatchesRouteFocus(vm, focus, ['ref', 'uuid', 'name_label'])
      ) || null;
    },
    findTaskByFocus(focus) {
      return this.automationTasks.find((task) =>
        recordMatchesRouteFocus(task, focus, ['ref', 'uuid', 'name_label'])
      ) || null;
    },
    findVmByTask(task) {
      if (!task) return null;

      const relatedObject = String(task.related_object || '').trim();
      const relatedObjectLower = relatedObject.toLowerCase();
      const relatedClass = String(task.related_class || '').trim().toLowerCase();

      if (relatedObject && (!relatedClass || relatedClass === 'vm')) {
        const directMatch = this.vms.find((vm) =>
          [vm.ref, vm.uuid, vm.name_label]
            .filter(Boolean)
            .map((value) => String(value).trim().toLowerCase())
            .includes(relatedObjectLower)
        );
        if (directMatch) return directMatch;
      }

      const haystack = `${task.name_label || ''} ${task.name_description || ''} ${task.workspace_summary || ''} ${task.related_alert_summary || ''}`.toLowerCase();
      return this.vms.find((vm) => {
        const label = String(vm.name_label || '').trim().toLowerCase();
        return Boolean(label) && haystack.includes(label);
      }) || null;
    },
    async loadVmDetail(ref) {
      this.detailLoading = true;
      this.detailError = null;
      this.vmMetricHistory = { metrics: [] };
      this.vmSnapshots = [];
      this.vmCompatibility = { hosts: [], lastBootCpuFlags: {}, possibleHostRefs: [], hardwarePlatformVersion: 0, maskingApiAvailable: false };
      this.vmConsoles = [];
      try {
        const [vm, hosts, pools, appliances, snapshotSchedules, storage, networks, metricHistory, snapshots, compatibility, consoles] = await Promise.all([
          api.getVM(ref),
          api.getHosts().catch(() => ({ data: [] })),
          api.getPools().catch(() => ({ data: [] })),
          api.getVMAppliances().catch(() => ({ data: [] })),
          api.getVMSnapshotSchedules().catch(() => ({ data: [] })),
          api.getSRs().catch(() => ({ data: [] })),
          api.getNetworks().catch(() => ({ data: [] })),
          api.getVmMetricHistory(ref).catch(() => ({ metrics: [] })),
          api.getVMSnapshots(ref).catch(() => ({ data: [] })),
          api.getVMCompatibility(ref).catch(() => ({ hosts: [], lastBootCpuFlags: {}, possibleHostRefs: [], hardwarePlatformVersion: 0, maskingApiAvailable: false })),
          api.getVMConsoles(ref).catch(() => ({ data: [] })),
        ]);

        this.selectedVM = { ...(this.selectedVM || {}), ...(vm || {}) };
        this.relatedHosts = hosts.data || [];
        this.relatedPools = pools.data || [];
        this.relatedAppliances = appliances.data || [];
        this.relatedSnapshotSchedules = snapshotSchedules.data || [];
        this.relatedStorage = storage.data || [];
        this.relatedNetworks = networks.data || [];
        this.vmMetricHistory = metricHistory || { metrics: [] };
        this.vmSnapshots = (snapshots.data || [])
          .map((entry) => this.normalizeSnapshot(entry))
          .sort((left, right) => new Date(right.snapshot_time || 0) - new Date(left.snapshot_time || 0));
        this.vmCompatibility = compatibility || { hosts: [], lastBootCpuFlags: {}, possibleHostRefs: [], hardwarePlatformVersion: 0, maskingApiAvailable: false };
        this.vmConsoles = (consoles.data || []).map((entry) => this.normalizeConsoleRecord(entry));

        const vdiResults = await Promise.all(
          this.relatedStorage.map((sr) =>
            api.getSRVDIs(sr.ref)
              .then((result) => result.data || [])
              .catch(() => [])
          )
        );
        this.relatedVdis = vdiResults.flat();
        await this.ensureMigrationDestinationContext();
      } catch (error) {
        this.detailError = error.message || 'Unable to load VM detail';
        this.resetMigrationDestinationContext();
      } finally {
        this.detailLoading = false;
      }
    },
    normalizeSnapshot(entry = {}) {
      return {
        ...entry,
        snapshot_mode: entry.snapshot_mode === 'checkpoint' ? 'checkpoint' : 'snapshot',
        snapshot_time: entry.snapshot_time || entry.snapshotTime || '',
      };
    },
    normalizeConsoleRecord(entry = {}) {
      const protocol = String(entry.protocol || '').trim().toLowerCase();
      return {
        ...entry,
        protocol,
        protocolLabel: protocol === 'rfb'
          ? 'Remote Frame Buffer Console'
          : protocol === 'rdp'
            ? 'Remote Desktop Console'
            : 'Remote Console',
        launchUrl: entry.launchUrl || entry.launchPath || '',
      };
    },
    poolContainsHost(pool, host) {
      if (!pool || !host) return false;

      const poolRefs = new Set(
        [
          pool.master,
          ...(Array.isArray(pool.hosts) ? pool.hosts : []),
          ...(Array.isArray(pool.resident_hosts) ? pool.resident_hosts : []),
          ...(Array.isArray(pool.slaves) ? pool.slaves : []),
        ].filter(Boolean)
      );

      return poolRefs.has(host.ref) || poolRefs.has(host.uuid);
    },
    hostBelongsToSelectedPool(host) {
      if (!host) return false;
      if (!this.selectedVmPool) return true;

      const directMatches = [
        host.pool,
        host.pool_ref,
        host.pool_uuid,
        host.pool_name,
      ]
        .filter(Boolean)
        .map((value) => String(value).toLowerCase());

      const poolKeys = [
        this.selectedVmPool.ref,
        this.selectedVmPool.uuid,
        this.selectedVmPool.name_label,
      ]
        .filter(Boolean)
        .map((value) => String(value).toLowerCase());

      if (directMatches.some((value) => poolKeys.includes(value))) {
        return true;
      }

      return this.poolContainsHost(this.selectedVmPool, host);
    },
    async refreshVmDetail(ref) {
      await this.loadVMs();
      const updated = this.vms.find((vm) => vm.ref === ref);
      if (updated) {
        this.selectedVM = updated;
      }
      await this.loadVmDetail(ref);
    },
    async syncRouteFocus() {
      const focus = getRouteFocus(this.$route.query);
      const seedAction = String(this.$route.query.seedAction || '').trim().toLowerCase();

      if (!focus || (focus.kind && !['vm', 'task'].includes(focus.kind))) {
        this.lastAppliedFocusKey = '';
        return;
      }

      if (this.loading || !this.vms.length) return;

      const key = `${getRouteFocusKey(focus)}|${seedAction}`;
      if (this.lastAppliedFocusKey === key) return;

      if (focus.kind === 'task') {
        await this.ensureAutomationTasksLoaded();
        let task = this.findTaskByFocus(focus);
        if (!task) {
          await this.ensureAutomationTasksLoaded(true);
          task = this.findTaskByFocus(focus);
        }
        if (!task) return;

        if (seedAction === 'vm-migration' && task.vm_migration_seed?.enabled) {
          const vm = this.findVmByTask(task);
          if (!vm) return;
          await this.openProperties(vm, {
            activeTab: 'migration',
            migrationSeed: task.vm_migration_seed,
            migrationSourceTask: task,
          });
          this.lastAppliedFocusKey = key;
        }
        return;
      }

      const match = this.findVmByFocus(focus);
      if (!match) return;

      await this.openProperties(match);
      this.lastAppliedFocusKey = key;
    },
    isRemediationTask(task) {
      return String(task?.task_kind || '').toLowerCase() === 'remediation'
        || String(task?.source || '').toLowerCase() === 'remediation';
    },
    async syncMigrationSourceTaskStatus(status, result) {
      if (!this.migrationSourceTask?.ref || !this.isRemediationTask(this.migrationSourceTask)) return;

      const currentStatus = String(this.migrationSourceTask.status || '').trim().toLowerCase();
      if (['success', 'warning', 'failure', 'cancelled'].includes(currentStatus)) return;

      const updatedTask = await api.updateRemediationTask(this.migrationSourceTask.ref, {
        status,
        assignee: this.migrationSourceTask.assignee || store.username || '',
        dueDate: this.migrationSourceTask.due_date || this.migrationSourceTask.dueDate || '',
        result,
        nameDescription: this.migrationSourceTask.name_description || this.migrationSourceTask.nameDescription || '',
      });

      this.automationTasks = this.automationTasks.map((task) => task.ref === updatedTask.ref ? updatedTask : task);
      this.migrationSourceTask = updatedTask;
    },
    getEligibleBatchVms(action) {
      if (action === 'start') {
        return this.selectedVmRows.filter((vm) => String(vm.power_state || '').trim().toLowerCase() === 'halted');
      }
      if (action === 'resume') {
        return this.selectedVmRows.filter((vm) => String(vm.power_state || '').trim().toLowerCase() === 'suspended');
      }
      if (['shutdown', 'reboot', 'suspend'].includes(action)) {
        return this.selectedVmRows.filter((vm) => String(vm.power_state || '').trim().toLowerCase() === 'running');
      }
      return [];
    },
    async performVmAction(action, ref, options = {}) {
      const approvalId = await this.resolveGovernanceApproval(action, ref);
      return api.vmAction(action, ref, approvalId ? { ...options, approvalId } : options);
    },
    async vmAction(action, ref, options = {}) {
      this.actionError = null;
      this.actionBusy = action + (options.force ? '-force' : '');
      try {
        await this.performVmAction(action, ref, options);
        await this.refreshVmDetail(ref);
      } catch (error) {
        if (error.code === 'APPROVAL_REQUIRED') {
          this.actionError = 'Governance approval is required before continuing this VM power operation.';
          await handoffToGovernanceApproval(
            this.$router,
            error.approvalDraft,
            'Approval required before continuing this VM power operation.'
          );
          return;
        }
        this.actionError = error.message || 'Action failed';
      } finally {
        this.actionBusy = '';
      }
    },
    async applyBulkVmAction(action, options = {}) {
      const targets = this.getEligibleBatchVms(action);
      if (!targets.length) {
        this.bulkError = 'No selected VMs are currently eligible for that power action.';
        return;
      }

      this.bulkError = null;
      this.bulkActionBusy = action + (options.force ? '-force' : '');
      let completed = 0;

      try {
        for (const vm of targets) {
          try {
            await this.performVmAction(action, vm.ref, options);
            completed += 1;
          } catch (error) {
            if (error.code === 'APPROVAL_REQUIRED') {
              this.bulkError = 'Governance approval is required before continuing this bulk VM power operation.';
              await handoffToGovernanceApproval(
                this.$router,
                error.approvalDraft,
                'Approval required before continuing this bulk VM power operation.'
              );
              return;
            }

            this.bulkError = completed
              ? `Processed ${completed} VM(s) before stopping: ${error.message || 'Unable to continue the batch action.'}`
              : (error.message || 'Unable to continue the batch action.');
            return;
          }
        }
      } finally {
        this.bulkActionBusy = '';
      }

      await this.loadVMs();

      if (this.selectedVM?.ref && targets.some((vm) => vm.ref === this.selectedVM.ref)) {
        const updated = this.vms.find((vm) => vm.ref === this.selectedVM.ref) || this.selectedVM;
        this.selectedVM = updated;
        await this.loadVmDetail(this.selectedVM.ref);
      }
    },
    async resolveGovernanceApproval(action, ref, target = null) {
      const actionMap = {
        shutdown: 'vm_shutdown',
        reboot: 'vm_reboot',
        suspend: 'vm_suspend',
        revert: 'vm_snapshot_revert',
        delete: 'vm_snapshot_delete',
      };
      const actionKey = actionMap[action];
      if (!actionKey) return '';
      const vm = this.vms.find((entry) => entry.ref === ref) || this.selectedVM;
      return resolveGovernanceApproval({
        actionKey,
        entityType: target ? 'vm-snapshot' : 'vm',
        entityRef: target?.ref || ref,
        entityName: target?.name_label || vm?.name_label || vm?.uuid || 'Virtual machine',
        route: '/vms',
      });
    },
    async submitVmConfig(payload) {
      if (!this.selectedVM) return;

      this.actionError = null;
      this.configSaving = true;
      try {
        const updated = await api.updateVMConfig(this.selectedVM.ref, payload);
        this.selectedVM = { ...this.selectedVM, ...(updated || {}) };
        await this.refreshVmDetail(this.selectedVM.ref);
      } catch (error) {
        this.actionError = error.message || 'Unable to save VM configuration';
      } finally {
        this.configSaving = false;
      }
    },
    async submitDiskDevice(payload) {
      if (!this.selectedVM) return;

      this.actionError = null;
      this.diskSaving = true;
      try {
        const result = await api.addVMDisk(this.selectedVM.ref, payload);
        const nextVbdRef = result?.vbdRef || `generated-vbd-${Date.now()}`;
        const nextVdiRef = result?.vdiRef || `generated-vdi-${Date.now()}`;

        this.selectedVM = {
          ...this.selectedVM,
          VBDs: [...(this.selectedVM.VBDs || []), nextVbdRef],
        };
        this.relatedVdis = [
          ...this.relatedVdis,
          {
            ref: nextVdiRef,
            SR: payload.srRef,
            name_label: payload.nameLabel,
            virtual_size: payload.sizeBytes,
            type: 'user',
            managed: true,
            VBDs: [nextVbdRef],
          },
        ];
      } catch (error) {
        this.actionError = error.message || 'Unable to add virtual disk';
      } finally {
        this.diskSaving = false;
      }
    },
    async submitNicDevice(payload) {
      if (!this.selectedVM) return;

      this.actionError = null;
      this.nicSaving = true;
      try {
        const result = await api.addVMNic(this.selectedVM.ref, payload);
        const nextVifRef = result?.vifRef || `generated-vif-${Date.now()}`;

        this.selectedVM = {
          ...this.selectedVM,
          VIFs: [...(this.selectedVM.VIFs || []), nextVifRef],
        };
        this.relatedNetworks = this.relatedNetworks.map((network) => (
          network.ref === payload.networkRef
            ? { ...network, VIFs: [...(network.VIFs || []), nextVifRef] }
            : network
        ));
      } catch (error) {
        this.actionError = error.message || 'Unable to add virtual NIC';
      } finally {
        this.nicSaving = false;
      }
    },
    async submitVMDuplicate(payload) {
      if (!this.selectedVM) return;

      this.actionError = null;
      this.duplicateSaving = true;
      try {
        const record = await api.duplicateVM(this.selectedVM.ref, payload);
        await this.loadVMs();
        const created = this.vms.find((entry) => entry.ref === record?.ref) || record;
        if (created?.ref) {
          await this.openProperties(created);
        } else {
          await this.refreshVmDetail(this.selectedVM.ref);
          this.activeTab = 'duplicate';
        }
      } catch (error) {
        this.actionError = error.message || 'Unable to create VM clone or full copy';
      } finally {
        this.duplicateSaving = false;
      }
    },
    async exportSelectedVM(metadataOnly = false) {
      if (!this.selectedVM?.ref) return;

      this.actionError = null;
      this.exportBusy = metadataOnly ? 'metadata' : 'full';
      try {
        const result = await api.exportVM(this.selectedVM.ref, { metadataOnly });
        this.downloadBlob(
          result.blob,
          result.contentType || 'application/octet-stream',
          result.filename || (metadataOnly ? 'vm-metadata.xva' : 'vm-export.xva')
        );
      } catch (error) {
        this.actionError = error.message || 'Unable to export virtual machine';
      } finally {
        this.exportBusy = '';
      }
    },
    launchConsole(consoleRecord) {
      const launchUrl = String(consoleRecord?.launchUrl || '').trim();
      if (!launchUrl) {
        this.actionError = 'No console launch endpoint was available for this record.';
        return;
      }

      const launched = window.open(launchUrl, '_blank', 'noopener');
      if (!launched) {
        this.actionError = 'The browser blocked the console window. Allow pop-ups for XenMange and try again.';
      }
    },
    async submitVMMigration(payload) {
      if (!this.selectedVM) return;

      this.actionError = null;
      this.migrationSaving = true;
      let taskSyncError = null;
      try {
        const record = await api.migrateVM(this.selectedVM.ref, payload);
        const vmLabel = this.selectedVM.name_label || this.selectedVM.uuid || this.selectedVM.ref || 'VM';
        const result = payload.mode === 'cross-pool'
          ? `VM migration completed for ${vmLabel} onto ${record?.destinationTargetKey || payload.destinationTargetKey || 'the selected target fabric'}.`
          : `VM migration completed for ${vmLabel} onto ${payload.hostRef || 'the selected host'}.`;

        try {
          await this.syncMigrationSourceTaskStatus('success', result);
        } catch (error) {
          taskSyncError = error;
        }

        if (payload.mode === 'cross-pool' && record?.destinationTargetKey) {
          const status = await api.activateLiveTarget({ targetKey: record.destinationTargetKey }).catch(() => null);
          if (status) {
            applySessionStatus(status);
          }

          await this.loadVMs();
          const migratedVm = this.vms.find((entry) => entry.ref === record.destinationVmRef)
            || this.vms.find((entry) => record.destinationVmUuid && entry.uuid === record.destinationVmUuid)
            || this.vms.find((entry) => entry.name_label && entry.name_label === record.name_label)
            || null;

          if (migratedVm) {
            await this.openProperties(migratedVm);
            this.activeTab = 'migration';
            if (taskSyncError) {
              this.actionError = 'The VM migration completed, but the source remediation task could not be updated automatically.';
            }
            return;
          }
        }

        await this.refreshVmDetail(record?.destinationVmRef || this.selectedVM.ref);
        this.activeTab = 'migration';

        if (taskSyncError) {
          this.actionError = 'The VM migration completed, but the source remediation task could not be updated automatically.';
        }
      } catch (error) {
        this.actionError = error.message || 'Unable to migrate the VM';
      } finally {
        this.migrationSaving = false;
      }
    },
    async submitVMImport(payload) {
      this.importError = null;
      this.importStatusMessage = '';
      this.importSaving = true;
      try {
        const result = await api.importVM(payload);
        await this.loadVMs();
        const importedVm = result?.importedVm?.ref
          ? this.vms.find((entry) => entry.ref === result.importedVm.ref) || result.importedVm
          : null;
        this.importStatusMessage = result?.metadataOnly
          ? `${result.fileName || payload.fileName || 'Archive'} metadata imported successfully.`
          : `${result.fileName || payload.fileName || 'Archive'} imported successfully.`;

        if (importedVm?.ref) {
          this.showImportWindow = false;
          await this.openProperties(importedVm);
          this.activeTab = 'portability';
        }
      } catch (error) {
        this.importError = error.message || 'Unable to import virtual machine';
      } finally {
        this.importSaving = false;
      }
    },
    async submitVMSnapshot(payload) {
      if (!this.selectedVM) return;

      this.actionError = null;
      this.snapshotSaving = true;
      try {
        await api.createVMSnapshot(this.selectedVM.ref, payload);
        await this.refreshVmDetail(this.selectedVM.ref);
        this.activeTab = 'protection';
      } catch (error) {
        this.actionError = error.message || 'Unable to create VM snapshot';
      } finally {
        this.snapshotSaving = false;
      }
    },
    async snapshotAction(action, snapshot) {
      if (!this.selectedVM || !snapshot?.ref) return;

      this.actionError = null;
      this.snapshotBusy = `${action}:${snapshot.ref}`;
      try {
        const approvalId = await this.resolveGovernanceApproval(action, this.selectedVM.ref, snapshot);
        if (action === 'revert') {
          await api.revertVMSnapshot(
            this.selectedVM.ref,
            snapshot.ref,
            approvalId ? { approvalId } : {}
          );
        } else {
          await api.deleteVMSnapshot(
            this.selectedVM.ref,
            snapshot.ref,
            approvalId ? { approvalId } : {}
          );
        }
        await this.refreshVmDetail(this.selectedVM.ref);
        this.activeTab = 'protection';
      } catch (error) {
        if (error.code === 'APPROVAL_REQUIRED') {
          this.actionError = 'Governance approval is required before continuing this snapshot action.';
          await handoffToGovernanceApproval(
            this.$router,
            error.approvalDraft,
            'Approval required before continuing this snapshot action.'
          );
          return;
        }
        this.actionError = error.message || 'Unable to complete snapshot action';
      } finally {
        this.snapshotBusy = '';
      }
    },
  },
};
