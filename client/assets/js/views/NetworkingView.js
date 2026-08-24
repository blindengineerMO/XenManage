const NetworkingView = {
  components: { DataTable, FloatingWindow, StatusBadge },
  template: `
    <div class="animate-fade-in">
      <div class="section-head">
        <div>
          <h2 class="section-title">
            <span class="mdi mdi-lan"></span>
            Networks
          </h2>
          <p class="section-subtitle">Bridge-level visibility with connected host uplinks and attached workload paths in one operator pane.</p>
        </div>
        <button class="btn btn-primary" @click="loadNetworks">
          <span class="mdi mdi-refresh"></span>
          Refresh
        </button>
      </div>

      <data-table :columns="columns" :data="networks" :loading="loading" :searchable="true" @row-click="openProperties">
        <template #cell-name_label="{ row }">
          <span style="color:var(--text-primary);font-weight:500">{{ row.name_label || 'Unnamed' }}</span>
        </template>
        <template #cell-bridge="{ row }">
          <span class="mono text-cyan">{{ row.bridge || '-' }}</span>
        </template>
        <template #cell-managed="{ row }">
          <status-badge :status="row.managed ? 'enabled' : 'disabled'"></status-badge>
        </template>
      </data-table>

      <floating-window :show="showProps" title="Network Properties" :width="860" :height="620" @close="showProps = false">
        <div v-if="selectedNetwork">
          <div class="property-grid">
            <span class="text-muted">Name</span><span>{{ selectedNetwork.name_label || '-' }}</span>
            <span class="text-muted">Bridge</span><span class="mono">{{ selectedNetwork.bridge || '-' }}</span>
            <span class="text-muted">Description</span><span>{{ selectedNetwork.name_description || selectedNetwork.description || '-' }}</span>
            <span class="text-muted">Managed</span><status-badge :status="selectedNetwork.managed ? 'enabled' : 'disabled'"></status-badge>
            <span class="text-muted">Default Locking Mode</span><span>{{ selectedNetwork.default_locking_mode || '-' }}</span>
            <span class="text-muted">Host Uplinks</span><span>{{ summarizeCount('uplinks', selectedNetworkHostUplinks.length) }}</span>
            <span class="text-muted">Attached Workloads</span><span>{{ summarizeCount('interfaces', selectedNetworkVmAttachments.length) }}</span>
            <span class="text-muted">UUID</span><span class="mono property-wrap">{{ selectedNetwork.uuid || '-' }}</span>
            <span class="text-muted">Tags</span><span>{{ truncateList(selectedNetwork.tags) }}</span>
            <span class="text-muted">Other Config</span><span class="mono property-wrap">{{ JSON.stringify(selectedNetwork.other_config || {}) }}</span>
          </div>

          <div class="detail-section">
            <div class="detail-section-title">Network Relationship Mapping</div>
            <div class="stack-item" v-if="detailLoading">
              <span class="loading-spinner"></span>
              <span class="mono">Collecting host uplinks and VM interface attachments...</span>
            </div>
            <div class="stack-item" v-else-if="detailError">
              <div>
                <strong>Relationship mapping unavailable</strong>
                <div class="text-muted mono" style="font-size:11px">{{ detailError }}</div>
              </div>
              <span class="badge badge-error">error</span>
            </div>
            <div class="dashboard-panels" v-else>
              <div class="dash-card">
                <div class="dash-card-label">Host Uplinks</div>
                <div class="stack-list" v-if="selectedNetworkHostUplinks.length">
                  <div class="stack-item" v-for="uplink in selectedNetworkHostUplinks" :key="uplink.id">
                    <div>
                      <strong>{{ uplink.hostName }}</strong>
                      <div class="text-muted mono" style="font-size:11px">{{ uplink.hostAddress }} · {{ uplink.interfaceRef }}</div>
                      <div class="text-muted mono" style="font-size:11px">{{ uplink.detail }}</div>
                    </div>
                    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
                      <span class="badge badge-running" v-if="isFocusedPif(uplink)">focused uplink</span>
                      <button class="btn btn-sm" @click="openHostWorkspace(uplink)">
                        <span class="mdi mdi-server-outline"></span>
                        Open Host
                      </button>
                      <status-badge :status="uplink.status"></status-badge>
                    </div>
                  </div>
                </div>
                <div v-else class="empty-state" style="padding:18px 12px">No host uplinks were mapped for this bridge.</div>
              </div>

              <div class="dash-card">
                <div class="dash-card-label">Connected Workloads</div>
                <div class="stack-list" v-if="selectedNetworkVmAttachments.length">
                  <div class="stack-item" v-for="attachment in selectedNetworkVmAttachments" :key="attachment.id">
                    <div>
                      <strong>{{ attachment.vmName }}</strong>
                      <div class="text-muted mono" style="font-size:11px">{{ attachment.interfaceRef }} · {{ attachment.powerState }}</div>
                      <div class="text-muted mono" style="font-size:11px">{{ attachment.detail }}</div>
                    </div>
                    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
                      <span class="badge badge-running" v-if="isFocusedVif(attachment)">focused interface</span>
                      <button class="btn btn-sm" @click="openVmWorkspace(attachment)">
                        <span class="mdi mdi-open-in-app"></span>
                        Open VM
                      </button>
                      <status-badge :status="attachment.status"></status-badge>
                    </div>
                  </div>
                </div>
                <div v-else class="empty-state" style="padding:18px 12px">No VM interfaces currently reference this network.</div>
              </div>
            </div>
          </div>
        </div>
      </floating-window>
    </div>
  `,
  data() {
    return {
      loading: true,
      networks: [],
      selectedNetwork: null,
      relatedHosts: [],
      relatedVMs: [],
      showProps: false,
      detailLoading: false,
      detailError: null,
      focusedPifRef: '',
      focusedVifRef: '',
      lastAppliedFocusKey: '',
      columns: [
        { key: 'name_label', label: 'Name' },
        { key: 'bridge', label: 'Bridge' },
        { key: 'managed', label: 'Managed' },
        { key: 'uuid', label: 'UUID' },
      ],
    };
  },
  computed: {
    selectedNetworkHostUplinks() {
      if (!this.selectedNetwork) return [];

      const uplinks = new Set(Array.isArray(this.selectedNetwork.PIFs) ? this.selectedNetwork.PIFs : []);
      return this.relatedHosts.flatMap((host) =>
        (Array.isArray(host.PIFs) ? host.PIFs : [])
          .filter((ref) => uplinks.has(ref))
          .map((ref, index) => ({
            id: `${host.ref || host.uuid || host.address || 'host'}-${ref}-${index}`,
            hostRef: host.ref || '',
            hostUuid: host.uuid || '',
            hostName: host.name_label || host.hostname || host.address || host.ref || 'Host',
            hostAddress: host.address || host.hostname || host.uuid || '-',
            interfaceRef: ref,
            detail: `${host.enabled ? 'enabled host' : 'disabled host'} · ${host.hostname || 'no hostname'} · ${host.uuid || host.ref || '-'}`,
            status: host.enabled ? 'enabled' : 'warning',
          }))
      );
    },
    selectedNetworkVmAttachments() {
      if (!this.selectedNetwork) return [];

      const attachments = new Set(Array.isArray(this.selectedNetwork.VIFs) ? this.selectedNetwork.VIFs : []);
      return this.relatedVMs.flatMap((vm) =>
        (Array.isArray(vm.VIFs) ? vm.VIFs : [])
          .filter((ref) => attachments.has(ref))
          .map((ref, index) => ({
            id: `${vm.ref || vm.uuid || vm.name_label || 'vm'}-${ref}-${index}`,
            vmRef: vm.ref || '',
            vmUuid: vm.uuid || '',
            vmName: vm.name_label || vm.ref || 'Virtual Machine',
            interfaceRef: ref,
            powerState: vm.power_state || 'Unknown',
            detail: `${vm.VCPUs_at_startup || 0} vCPU · ${formatBytes(vm.memory_static_max)} · ${vm.uuid || vm.ref || '-'}`,
            status: vm.power_state || 'info',
          }))
      );
    },
  },
  async mounted() {
    if (!store.authenticated) {
      this.$router.push('/login');
      return;
    }
    await this.loadNetworks();
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
    summarizeCount,
    truncateList,
    async loadNetworks() {
      this.loading = true;
      try {
        const result = await api.getNetworks();
        this.networks = result.data || [];
      } catch (error) {
        console.error(error);
      } finally {
        this.loading = false;
      }
      await this.syncRouteFocus();
    },
    async openProperties(row, options = {}) {
      this.selectedNetwork = row;
      this.showProps = true;
      this.detailLoading = true;
      this.detailError = null;
      this.relatedHosts = options.hosts || [];
      this.relatedVMs = options.vms || [];
      this.focusedPifRef = options.focusedPifRef || '';
      this.focusedVifRef = options.focusedVifRef || '';

      try {
        if (!options.hosts || !options.vms) {
          const [hostsResult, vmsResult] = await Promise.all([
            api.getHosts(),
            api.getVMs(),
          ]);
          this.relatedHosts = hostsResult.data || [];
          this.relatedVMs = vmsResult.data || [];
        }
      } catch (error) {
        this.relatedHosts = [];
        this.relatedVMs = [];
        this.detailError = error.message || 'Unable to load network relationship detail';
      } finally {
        this.detailLoading = false;
      }
    },
    isFocusedPif(uplink) {
      return normalizeFocusValue(uplink?.interfaceRef) === normalizeFocusValue(this.focusedPifRef);
    },
    isFocusedVif(attachment) {
      return normalizeFocusValue(attachment?.interfaceRef) === normalizeFocusValue(this.focusedVifRef);
    },
    openHostWorkspace(uplink) {
      if (!uplink?.hostRef) return;
      this.showProps = false;
      this.$router.push(buildFocusedRoute('/hosts', {
        kind: 'host',
        ref: uplink.hostRef,
        uuid: uplink.hostUuid || '',
        name: uplink.hostName || '',
        cls: 'host',
        source: 'network',
      }));
    },
    openVmWorkspace(attachment) {
      if (!attachment?.vmRef) return;
      this.showProps = false;
      this.$router.push(buildFocusedRoute('/vms', {
        kind: 'vm',
        ref: attachment.vmRef,
        uuid: attachment.vmUuid || '',
        name: attachment.vmName || '',
        cls: 'vm',
        source: 'network',
      }));
    },
    findNetworkByFocus(focus) {
      return this.networks.find((network) =>
        recordMatchesRouteFocus(network, focus, ['ref', 'uuid', 'name_label', 'bridge'])
      ) || null;
    },
    resolveFocusedNetworkTarget(focus) {
      const direct = this.findNetworkByFocus(focus);
      if (direct) {
        return { network: direct, focusedPifRef: '', focusedVifRef: '' };
      }

      for (const network of this.networks) {
        if (focus.cls === 'pif' && recordMatchesRouteFocus(network, focus, [], network.PIFs || [])) {
          return { network, focusedPifRef: focus.ref || '', focusedVifRef: '' };
        }

        if (focus.cls === 'vif' && recordMatchesRouteFocus(network, focus, [], network.VIFs || [])) {
          return { network, focusedPifRef: '', focusedVifRef: focus.ref || '' };
        }
      }

      return null;
    },
    async syncRouteFocus() {
      const focus = getRouteFocus(this.$route.query);
      if (!focus || (focus.kind && focus.kind !== 'network')) {
        this.lastAppliedFocusKey = '';
        this.focusedPifRef = '';
        this.focusedVifRef = '';
        return;
      }

      if (this.loading || !this.networks.length) return;

      const key = getRouteFocusKey(focus);
      if (this.lastAppliedFocusKey === key) return;

      const target = this.resolveFocusedNetworkTarget(focus);
      if (!target?.network) return;

      await this.openProperties(target.network, {
        focusedPifRef: target.focusedPifRef,
        focusedVifRef: target.focusedVifRef,
      });
      this.lastAppliedFocusKey = key;
    },
  },
};
