const VMPropertiesWindow = {
  components: {
    FloatingWindow,
    VMOverviewTab,
    VMResourcesTab,
    VMCompatibilityTab,
    VMConsoleTab,
    VMMigrationTab,
    VMPortabilityTab,
    VMDuplicateTab,
    VMProtectionTab,
    VMConfigTab,
    VMAddDevicesTab,
  },
  props: {
    showProps: {
      type: Boolean,
      default: false,
    },
    selectedVM: {
      type: Object,
      default: null,
    },
    selectedVmComputeProfile: {
      type: Object,
      default: () => ({}),
    },
    selectedVmHost: {
      type: Object,
      default: null,
    },
    actionBusy: {
      type: String,
      default: '',
    },
    tabs: {
      type: Array,
      default: () => [],
    },
    activeTab: {
      type: String,
      default: 'overview',
    },
    actionError: {
      type: String,
      default: null,
    },
    detailLoading: {
      type: Boolean,
      default: false,
    },
    detailError: {
      type: String,
      default: null,
    },
    vmTabModels: {
      type: Object,
      default: () => ({}),
    },
  },
  emits: [
    'close',
    'update-active-tab',
    'vm-action',
    'launch-console',
    'migration-target-change',
    'submit-vm-migration',
    'export-selected-vm',
    'submit-vm-duplicate',
    'submit-vm-snapshot',
    'snapshot-action',
    'submit-vm-config',
    'submit-disk-device',
    'submit-nic-device',
  ],
  template: `
    <floating-window :show="showProps"
                     title="VM Details"
                     :width="980"
                     :height="700"
                     @close="$emit('close')">
      <div v-if="selectedVM" class="vm-detail-shell">
        <div class="vm-detail-hero">
          <div>
            <div class="dash-card-label">Virtual Machine</div>
            <h3>{{ selectedVM.name_label || 'Unnamed VM' }}</h3>
            <p>{{ selectedVM.name_description || 'Inspect placement, attached resources, runtime state, and configuration from a single operator pane.' }}</p>

            <div class="vm-stat-chips">
              <span class="badge badge-info">{{ selectedVM.power_state || 'Unknown' }}</span>
              <span class="badge badge-info">{{ selectedVmComputeProfile.vcpuSummary }}</span>
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
                    @click="$emit('vm-action', { action: 'start', ref: selectedVM.ref })">
              <span class="mdi mdi-play"></span>
              {{ actionBusy === 'start' ? 'Starting...' : 'Start' }}
            </button>
            <button class="btn btn-sm"
                    v-if="selectedVM.power_state === 'Running'"
                    :disabled="Boolean(actionBusy)"
                    @click="$emit('vm-action', { action: 'shutdown', ref: selectedVM.ref })">
              <span class="mdi mdi-stop"></span>
              {{ actionBusy === 'shutdown' ? 'Stopping...' : 'Shutdown' }}
            </button>
            <button class="btn btn-danger btn-sm"
                    v-if="selectedVM.power_state === 'Running'"
                    :disabled="Boolean(actionBusy)"
                    @click="$emit('vm-action', { action: 'shutdown', ref: selectedVM.ref, options: { force: true } })">
              <span class="mdi mdi-power"></span>
              {{ actionBusy === 'shutdown-force' ? 'Forcing...' : 'Force Off' }}
            </button>
            <button class="btn btn-sm"
                    v-if="selectedVM.power_state === 'Running'"
                    :disabled="Boolean(actionBusy)"
                    @click="$emit('vm-action', { action: 'reboot', ref: selectedVM.ref })">
              <span class="mdi mdi-restart"></span>
              {{ actionBusy === 'reboot' ? 'Rebooting...' : 'Reboot' }}
            </button>
            <button class="btn btn-sm"
                    v-if="selectedVM.power_state === 'Running'"
                    :disabled="Boolean(actionBusy)"
                    @click="$emit('vm-action', { action: 'suspend', ref: selectedVM.ref })">
              <span class="mdi mdi-pause"></span>
              {{ actionBusy === 'suspend' ? 'Suspending...' : 'Suspend' }}
            </button>
            <button class="btn btn-primary btn-sm"
                    v-if="selectedVM.power_state === 'Suspended'"
                    :disabled="Boolean(actionBusy)"
                    @click="$emit('vm-action', { action: 'resume', ref: selectedVM.ref })">
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
                  @click="$emit('update-active-tab', tab.key)">
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
          <vm-overview-tab v-if="activeTab === 'overview'" :model="vmTabModels.overview"></vm-overview-tab>

          <vm-resources-tab v-else-if="activeTab === 'resources'" :model="vmTabModels.resources"></vm-resources-tab>

          <vm-compatibility-tab v-else-if="activeTab === 'compatibility'" :model="vmTabModels.compatibility"></vm-compatibility-tab>

          <vm-console-tab
            v-else-if="activeTab === 'console'"
            :model="vmTabModels.console"
            @launch="$emit('launch-console', $event)">
          </vm-console-tab>

          <vm-migration-tab
            v-else-if="activeTab === 'migration'"
            :model="vmTabModels.migration"
            @destination-target-change="$emit('migration-target-change', $event)"
            @submit="$emit('submit-vm-migration', $event)">
          </vm-migration-tab>

          <vm-portability-tab
            v-else-if="activeTab === 'portability'"
            :model="vmTabModels.portability"
            @export="$emit('export-selected-vm', $event)">
          </vm-portability-tab>

          <vm-duplicate-tab
            v-else-if="activeTab === 'duplicate'"
            :model="vmTabModels.duplicate"
            @submit="$emit('submit-vm-duplicate', $event)">
          </vm-duplicate-tab>

          <vm-protection-tab
            v-else-if="activeTab === 'protection'"
            :model="vmTabModels.protection"
            @submit="$emit('submit-vm-snapshot', $event)"
            @snapshot-action="$emit('snapshot-action', $event)">
          </vm-protection-tab>

          <vm-config-tab
            v-else-if="activeTab === 'config'"
            :model="vmTabModels.config"
            @submit="$emit('submit-vm-config', $event)">
          </vm-config-tab>

          <vm-add-devices-tab
            v-else
            :model="vmTabModels.devices"
            @submit-disk="$emit('submit-disk-device', $event)"
            @submit-nic="$emit('submit-nic-device', $event)">
          </vm-add-devices-tab>
        </template>
      </div>
    </floating-window>
  `,
  methods: {
    formatBytes,
  },
};
