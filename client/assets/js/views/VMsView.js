const VMsView = {
  components: {
    DataTable,
    StatusBadge,
    FloatingWindow,
    'vm-config-form': VMConfigForm,
    'vm-device-form': VMDeviceForm,
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
        <button class="btn btn-primary" @click="loadVMs">
          <span class="mdi mdi-refresh"></span>
          Refresh
        </button>
      </div>

      <data-table :columns="columns" :data="vms" :loading="loading" :searchable="true" @row-click="openProperties">
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
                <span class="text-muted">vCPUs</span><span class="mono">{{ selectedVM.VCPUs_at_startup || 0 }}</span>
                <span class="text-muted">Memory</span><span class="mono">{{ formatBytes(selectedVM.memory_static_max) }}</span>
                <span class="text-muted">Boot Policy</span><span>{{ selectedVM.HVM_boot_policy || selectedVM.PV_bootloader || 'Default' }}</span>
                <span class="text-muted">Affinity</span><span class="mono property-wrap">{{ selectedVM.affinity || '-' }}</span>
                <span class="text-muted">Tags</span><span>{{ truncateList(selectedVM.tags) }}</span>
                <span class="text-muted">Platform</span><span class="mono property-wrap">{{ JSON.stringify(selectedVM.platform || {}) }}</span>
              </div>

              <div class="vm-resource-grid">
                <div class="dash-card vm-resource-card" v-for="card in overviewCards" :key="card.key">
                  <div class="dash-card-label">{{ card.label }}</div>
                  <div class="dash-card-value" :class="card.valueClass || ''">{{ card.value }}</div>
                  <div class="text-muted mono" style="margin-top:8px;font-size:11px">{{ card.detail }}</div>
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

            <div v-else-if="activeTab === 'config'">
              <div class="dashboard-panels">
                <div class="dash-card">
                  <div class="dash-card-label">Config Editor</div>
                  <p class="text-muted" style="margin-bottom:12px">
                    Update the visible workload identity and core sizing here. For live environments, XenAPI may require the guest to be halted before some CPU or memory changes apply.
                  </p>
                  <vm-config-form
                    :initial-value="selectedVM"
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
                        <strong>Identity</strong>
                        <div class="text-muted mono" style="font-size:11px">{{ selectedVM.uuid || selectedVM.ref }}</div>
                      </div>
                      <span class="badge badge-info">uuid</span>
                    </div>
                    <div class="stack-item">
                      <div>
                        <strong>Tag Set</strong>
                        <div class="text-muted mono" style="font-size:11px">{{ truncateList(selectedVM.tags) }}</div>
                      </div>
                      <span class="badge badge-info">{{ (selectedVM.tags || []).length || 0 }}</span>
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
    </div>
  `,
  data() {
    return {
      loading: true,
      vms: [],
      showProps: false,
      selectedVM: null,
      detailLoading: false,
      detailError: null,
      actionError: null,
      actionBusy: '',
      configSaving: false,
      diskSaving: false,
      nicSaving: false,
      activeTab: 'overview',
      relatedHosts: [],
      relatedPools: [],
      relatedStorage: [],
      relatedNetworks: [],
      relatedVdis: [],
      tabs: [
        { key: 'overview', label: 'Overview', icon: 'mdi-card-account-details-outline' },
        { key: 'resources', label: 'Resources', icon: 'mdi-vector-link' },
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
    };
  },
  computed: {
    selectedVmHost() {
      if (!this.selectedVM) return null;

      const refs = [this.selectedVM.resident_on, this.selectedVM.affinity]
        .filter(Boolean)
        .map((value) => String(value).toLowerCase());

      return this.relatedHosts.find((host) =>
        [host.ref, host.uuid, host.name_label, host.hostname]
          .filter(Boolean)
          .map((value) => String(value).toLowerCase())
          .some((value) => refs.includes(value))
      ) || null;
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
          value: this.selectedVM.HVM_boot_policy || this.selectedVM.PV_bootloader || 'Default',
          detail: `Affinity ${this.selectedVM.affinity || 'not pinned'} · ${(this.selectedVM.tags || []).length || 0} tags`,
          valueClass: 'text-amber',
        },
      ];
    },
  },
  async mounted() {
    if (!store.authenticated) {
      this.$router.push('/login');
      return;
    }
    await this.loadVMs();
  },
  methods: {
    formatBytes,
    truncateList,
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
    },
    async openProperties(row) {
      this.selectedVM = row;
      this.showProps = true;
      this.activeTab = 'overview';
      this.actionError = null;
      await this.loadVmDetail(row.ref);
    },
    async loadVmDetail(ref) {
      this.detailLoading = true;
      this.detailError = null;
      try {
        const [vm, hosts, pools, storage, networks] = await Promise.all([
          api.getVM(ref),
          api.getHosts().catch(() => ({ data: [] })),
          api.getPools().catch(() => ({ data: [] })),
          api.getSRs().catch(() => ({ data: [] })),
          api.getNetworks().catch(() => ({ data: [] })),
        ]);

        this.selectedVM = { ...(this.selectedVM || {}), ...(vm || {}) };
        this.relatedHosts = hosts.data || [];
        this.relatedPools = pools.data || [];
        this.relatedStorage = storage.data || [];
        this.relatedNetworks = networks.data || [];

        const vdiResults = await Promise.all(
          this.relatedStorage.map((sr) =>
            api.getSRVDIs(sr.ref)
              .then((result) => result.data || [])
              .catch(() => [])
          )
        );
        this.relatedVdis = vdiResults.flat();
      } catch (error) {
        this.detailError = error.message || 'Unable to load VM detail';
      } finally {
        this.detailLoading = false;
      }
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
    async refreshVmDetail(ref) {
      await this.loadVMs();
      const updated = this.vms.find((vm) => vm.ref === ref);
      if (updated) {
        this.selectedVM = updated;
      }
      await this.loadVmDetail(ref);
    },
    async vmAction(action, ref, options = {}) {
      this.actionError = null;
      this.actionBusy = action + (options.force ? '-force' : '');
      try {
        await api.vmAction(action, ref, options);
        await this.refreshVmDetail(ref);
      } catch (error) {
        this.actionError = error.message || 'Action failed';
      } finally {
        this.actionBusy = '';
      }
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
  },
};
