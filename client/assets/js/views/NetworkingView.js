const NetworkingView = {
  components: { DataTable, FloatingWindow, StatusBadge, NetworkCreateForm, NetworkConfigForm, NetworkVlanCreateForm, NetworkBondCreateForm, NetworkVifAttachForm },
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

      <div class="dashboard-panels" style="margin-bottom:16px">
        <div class="dash-card">
          <div class="dash-card-label">Create Network</div>
          <p class="text-muted" style="margin-bottom:12px">Provision a managed bridge with explicit MTU, optional tags, and custom metadata without leaving the Networking workspace.</p>
          <network-create-form
            :saving="createBusy"
            :submit-label="'Create Network'"
            @submit="submitNetworkCreate">
          </network-create-form>
          <div class="form-error" v-if="createError" style="text-align:left;margin-top:12px">{{ createError }}</div>
        </div>

        <div class="dash-card">
          <div class="dash-card-label">Create VLAN</div>
          <p class="text-muted" style="margin-bottom:12px">Attach a VLAN tag to an existing host uplink and map the tagged traffic back onto a selected network object.</p>
          <network-vlan-create-form
            :network-options="networkVlanOptions"
            :pif-options="networkVlanPifOptions"
            :saving="createVlanBusy"
            :submit-label="'Create VLAN'"
            @submit="submitNetworkVlan">
          </network-vlan-create-form>
          <div class="form-error" v-if="createVlanError" style="text-align:left;margin-top:12px">{{ createVlanError }}</div>
        </div>

        <div class="dash-card">
          <div class="dash-card-label">Create Bond</div>
          <p class="text-muted" style="margin-bottom:12px">Aggregate multiple uplinks into one logical path on a selected network using one of the Xen-supported bond modes.</p>
          <network-bond-create-form
            :network-options="networkVlanOptions"
            :pif-options="networkVlanPifOptions"
            :saving="createBondBusy"
            :submit-label="'Create Bond'"
            @submit="submitNetworkBond">
          </network-bond-create-form>
          <div class="form-error" v-if="createBondError" style="text-align:left;margin-top:12px">{{ createBondError }}</div>
        </div>
      </div>

      <div class="stack-item" v-if="workspaceMessage" style="margin-bottom:16px">
        <div>
          <strong>Workspace updated</strong>
          <div class="text-muted mono" style="font-size:11px">{{ workspaceMessage }}</div>
        </div>
        <span class="badge badge-running">ready</span>
      </div>

      <data-table :columns="columns" :data="networks" :loading="loading" :searchable="true" @row-click="openProperties">
        <template #cell-name_label="{ row }">
          <span style="color:var(--text-primary);font-weight:500">{{ row.name_label || 'Unnamed' }}</span>
        </template>
        <template #cell-bridge="{ row }">
          <span class="mono text-cyan">{{ row.bridge || '-' }}</span>
        </template>
        <template #cell-vlan="{ row }">
          <span class="mono">{{ formatVlanLabel(row) }}</span>
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
            <span class="text-muted">MTU</span><span class="mono">{{ selectedNetwork.MTU || '-' }}</span>
            <span class="text-muted">Managed</span><status-badge :status="selectedNetwork.managed ? 'enabled' : 'disabled'"></status-badge>
            <span class="text-muted">VLAN Tag</span><span class="mono">{{ selectedNetworkVlanLabel }}</span>
            <span class="text-muted">Topology</span><span>{{ selectedNetworkTopologyLabel }}</span>
            <span class="text-muted">Default Locking Mode</span><span>{{ selectedNetwork.default_locking_mode || '-' }}</span>
            <span class="text-muted">Purpose</span><span>{{ selectedNetworkPurposeLabel }}</span>
            <span class="text-muted">Host Uplinks</span><span>{{ summarizeCount('uplinks', selectedNetworkHostUplinks.length) }}</span>
            <span class="text-muted">Attached Workloads</span><span>{{ summarizeCount('interfaces', selectedNetworkVmAttachments.length) }}</span>
            <span class="text-muted">UUID</span><span class="mono property-wrap">{{ selectedNetwork.uuid || '-' }}</span>
            <span class="text-muted">Tags</span><span>{{ truncateList(selectedNetwork.tags) }}</span>
            <span class="text-muted">Other Config</span><span class="mono property-wrap">{{ JSON.stringify(selectedNetwork.other_config || {}) }}</span>
          </div>

          <div class="detail-section" v-if="focusedNetworkContext">
            <div class="detail-section-title">{{ focusedNetworkContext.title }}</div>
            <div class="capacity-callout">
              <strong>{{ focusedNetworkContext.summary }}</strong>
              <div class="text-muted mono" style="font-size:11px;margin-top:8px">{{ focusedNetworkContext.detail }}</div>
            </div>
          </div>

          <div class="detail-section">
            <div class="detail-section-title">Network Operations</div>
            <div class="dashboard-panels">
              <div class="dash-card">
                <div class="dash-card-label">Network Metadata</div>
                <p class="text-muted" style="margin-bottom:12px">Update the operator-facing network name, description, MTU, tags, and advanced metadata while keeping bridge assignment read-only.</p>
                <network-config-form
                  :initial-value="selectedNetwork"
                  :submit-label="'Save Network Metadata'"
                  :saving="detailActionBusy === 'config'"
                  @submit="submitSelectedNetworkConfig">
                </network-config-form>
              </div>

              <div class="dash-card">
                <div class="dash-card-label">Network Identity</div>
                <div class="stack-list" style="margin-bottom:12px">
                  <div class="stack-item">
                    <div>
                      <strong>{{ selectedNetwork.name_label || 'Selected network' }}</strong>
                      <div class="text-muted mono" style="font-size:11px">
                        {{ selectedNetwork.uuid || selectedNetwork.ref || 'network ref unavailable' }} · {{ selectedNetwork.bridge || 'bridge unavailable' }}
                      </div>
                    </div>
                    <span class="badge badge-info">{{ selectedNetwork.managed ? 'managed' : 'unmanaged' }}</span>
                  </div>
                  <div class="stack-item">
                    <div>
                      <strong>Bridge Assignment</strong>
                      <div class="text-muted mono" style="font-size:11px">{{ selectedNetwork.bridge || 'bridge unavailable' }}</div>
                    </div>
                    <span class="badge badge-running">read-only</span>
                  </div>
                  <div class="stack-item">
                    <div>
                      <strong>Topology Snapshot</strong>
                      <div class="text-muted mono" style="font-size:11px">{{ selectedNetworkTopologyLabel }}</div>
                    </div>
                    <span class="badge badge-info">{{ selectedNetworkVlanLabel }}</span>
                  </div>
                </div>
                <p class="text-muted" style="margin:0 0 12px">Bridge attachment stays constructor-scoped in Xen, so metadata edits here intentionally stop short of renaming or rehoming the bridge itself.</p>
                <button class="btn btn-sm"
                        type="button"
                        :disabled="Boolean(detailActionBusy) || Boolean(selectedNetworkDestroyBlockedReason)"
                        @click="destroySelectedNetwork">
                  <span class="mdi mdi-delete-outline"></span>
                  {{ detailActionBusy === 'destroy-network' ? 'Destroying...' : 'Destroy Network' }}
                </button>
                <div class="text-muted mono" v-if="selectedNetworkDestroyBlockedReason" style="font-size:11px;margin-top:10px">
                  {{ selectedNetworkDestroyBlockedReason }}
                </div>
              </div>

              <div class="dash-card">
                <div class="dash-card-label">Attach Workload Interface</div>
                <p class="text-muted" style="margin-bottom:12px">Create a new VIF on this network for a selected VM without leaving the Networking detail workspace.</p>
                <network-vif-attach-form
                  :vm-options="networkVifVmOptions"
                  :saving="detailActionBusy === 'create-vif'"
                  :submit-label="'Attach VIF'"
                  @submit="submitSelectedNetworkVif">
                </network-vif-attach-form>
              </div>
            </div>

            <div class="form-error" v-if="detailActionError" style="text-align:left;margin-top:12px">{{ detailActionError }}</div>
            <div class="stack-item" v-else-if="detailActionMessage" style="margin-top:12px">
              <div>
                <strong>Network operation completed</strong>
                <div class="text-muted mono" style="font-size:11px">{{ detailActionMessage }}</div>
              </div>
              <span class="badge badge-running">ready</span>
            </div>
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
                      <div class="text-muted mono" style="font-size:11px">{{ attachment.interfaceRef }} · {{ attachment.powerState }} · {{ attachment.currentlyAttached ? 'attached' : 'hot-unplugged' }}</div>
                      <div class="text-muted mono" style="font-size:11px">{{ attachment.detail }}</div>
                    </div>
                    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
                      <span class="badge badge-running" v-if="isFocusedVif(attachment)">focused interface</span>
                      <span class="badge" :class="attachment.currentlyAttached ? 'badge-running' : 'badge-halted'">
                        {{ attachment.currentlyAttached ? 'attached' : 'hot-unplugged' }}
                      </span>
                      <button class="btn btn-sm"
                              type="button"
                              :disabled="Boolean(detailActionBusy) || !attachment.currentlyAttached"
                              @click="disconnectSelectedNetworkVif(attachment)">
                        <span class="mdi mdi-power-plug-off-outline"></span>
                        {{ detailActionBusy === 'disconnect-vif' && disconnectingVifRef === attachment.interfaceRef ? 'Disconnecting...' : 'Disconnect VIF' }}
                      </button>
                      <button class="btn btn-sm"
                              type="button"
                              :disabled="Boolean(detailActionBusy)"
                              @click="removeSelectedNetworkVif(attachment)">
                        <span class="mdi mdi-lan-disconnect"></span>
                        {{ detailActionBusy === 'remove-vif' && removingVifRef === attachment.interfaceRef ? 'Removing...' : 'Remove VIF' }}
                      </button>
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
      availableHosts: [],
      createBusy: false,
      createError: '',
      createVlanBusy: false,
      createVlanError: '',
      createBondBusy: false,
      createBondError: '',
      workspaceMessage: '',
      selectedNetwork: null,
      relatedHosts: [],
      relatedVMs: [],
      relatedVifs: [],
      showProps: false,
      detailActionBusy: '',
      detailActionError: '',
      detailActionMessage: '',
      disconnectingVifRef: '',
      detailLoading: false,
      detailError: null,
      removingVifRef: '',
      focusedPifRef: '',
      focusedVifRef: '',
      focusedNetworkClass: '',
      lastAppliedFocusKey: '',
      columns: [
        { key: 'name_label', label: 'Name' },
        { key: 'bridge', label: 'Bridge' },
        { key: 'vlan', label: 'VLAN' },
        { key: 'managed', label: 'Managed' },
        { key: 'uuid', label: 'UUID' },
      ],
    };
  },
  computed: {
    selectedNetworkVlanLabel() {
      return this.formatVlanLabel(this.selectedNetwork);
    },
    selectedNetworkPurposeLabel() {
      const purpose = Array.isArray(this.selectedNetwork?.purpose) ? this.selectedNetwork.purpose.filter(Boolean) : [];
      return purpose.length ? purpose.join(', ') : '-';
    },
    networkVlanOptions() {
      return this.networks.map((network) => ({
        value: network.ref,
        label: `${network.name_label || network.bridge || network.ref} · ${network.bridge || '-'} · ${this.formatVlanLabel(network)}`,
      }));
    },
    networkVlanPifOptions() {
      return this.availableHosts.flatMap((host) =>
        (Array.isArray(host.PIFs) ? host.PIFs : []).map((ref, index) => ({
          value: ref,
          label: `${host.name_label || host.hostname || host.address || host.ref || 'Host'} · uplink ${index + 1} · ${ref}`,
        }))
      );
    },
    networkVifVmOptions() {
      return this.relatedVMs.map((vm) => ({
        value: vm.ref,
        label: `${vm.name_label || vm.ref} · ${vm.power_state || 'Unknown'} · ${vm.uuid || vm.ref}`,
      }));
    },
    selectedNetworkTopologyLabel() {
      if (!this.selectedNetwork) return '-';
      const uplinkCount = Array.isArray(this.selectedNetwork.PIFs) ? this.selectedNetwork.PIFs.length : 0;
      const attachmentCount = Array.isArray(this.selectedNetwork.VIFs) ? this.selectedNetwork.VIFs.length : 0;
      const hostCount = new Set(this.selectedNetworkHostUplinks.map((uplink) => uplink.hostRef || uplink.hostUuid || uplink.hostName)).size;
      const parts = [
        this.selectedNetworkVlanLabel,
        `${uplinkCount} uplink${uplinkCount === 1 ? '' : 's'}`,
        `${attachmentCount} interface${attachmentCount === 1 ? '' : 's'}`,
      ];
      if (hostCount) {
        parts.push(`${hostCount} host${hostCount === 1 ? '' : 's'}`);
      }
      return parts.join(' · ');
    },
    focusedNetworkContext() {
      if (!this.focusedNetworkClass) return null;

      if (this.focusedNetworkClass === 'vif') {
        return {
          title: 'Focused Interface Handoff',
          summary: 'This network was opened from a specific VM interface path.',
          detail: `${this.focusedVifRef || 'Interface ref unavailable'} · ${this.selectedNetworkVlanLabel} · ${this.selectedNetwork?.bridge || 'no bridge label'}`,
        };
      }

      if (this.focusedNetworkClass === 'pif') {
        return {
          title: 'Focused Uplink Handoff',
          summary: 'This network was opened from a specific host uplink path.',
          detail: `${this.focusedPifRef || 'Uplink ref unavailable'} · ${this.selectedNetworkVlanLabel} · ${this.selectedNetwork?.bridge || 'no bridge label'}`,
        };
      }

      if (this.focusedNetworkClass === 'vlan') {
        return {
          title: 'Focused VLAN Handoff',
          summary: 'This network was opened from a VLAN-targeted alert or follow-through route.',
          detail: `${this.focusedPifRef || 'Representative uplink unavailable'} · ${this.selectedNetworkVlanLabel} · ${this.selectedNetwork?.bridge || 'no bridge label'}`,
        };
      }

      if (this.focusedNetworkClass === 'bond') {
        return {
          title: 'Focused Bond Handoff',
          summary: 'This network was opened from a bond-targeted alert or follow-through route.',
          detail: `${this.focusedPifRef || 'Representative uplink unavailable'} · ${this.selectedNetworkVlanLabel} · ${this.selectedNetwork?.bridge || 'no bridge label'}`,
        };
      }

      return null;
    },
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
            detail: `${this.selectedNetworkVlanLabel} · ${host.enabled ? 'enabled host' : 'disabled host'} · ${host.hostname || 'no hostname'} · ${host.uuid || host.ref || '-'}`,
            status: host.enabled ? 'enabled' : 'warning',
          }))
      );
    },
    selectedNetworkVmAttachments() {
      if (!this.selectedNetwork) return [];

      const attachments = new Set(Array.isArray(this.selectedNetwork.VIFs) ? this.selectedNetwork.VIFs : []);
      const vifMap = new Map(this.relatedVifs.map((vif) => [vif.ref, vif]));
      return this.relatedVMs.flatMap((vm) =>
        (Array.isArray(vm.VIFs) ? vm.VIFs : [])
          .filter((ref) => attachments.has(ref))
          .map((ref, index) => {
            const vif = vifMap.get(ref) || {};
            const currentlyAttached = Boolean(vif.currently_attached);
            return {
              id: `${vm.ref || vm.uuid || vm.name_label || 'vm'}-${ref}-${index}`,
              vmRef: vm.ref || '',
              vmUuid: vm.uuid || '',
              vmName: vm.name_label || vm.ref || 'Virtual Machine',
              interfaceRef: ref,
              powerState: vm.power_state || 'Unknown',
              device: String(vif.device || ''),
              mac: String(vif.MAC || ''),
              currentlyAttached,
              detail: `${vif.device ? `device ${vif.device}` : 'device auto'} · ${vif.MAC || 'auto MAC'} · ${formatBytes(vm.memory_static_max)} · ${vm.uuid || vm.ref || '-'}`,
              status: currentlyAttached ? (vm.power_state || 'info') : 'disconnected',
            };
          })
      );
    },
    selectedNetworkDestroyBlockedReason() {
      if (!this.selectedNetwork) return '';

      const pifCount = Array.isArray(this.selectedNetwork.PIFs) ? this.selectedNetwork.PIFs.length : 0;
      const vifCount = Array.isArray(this.selectedNetwork.VIFs) ? this.selectedNetwork.VIFs.length : 0;
      if (!pifCount && !vifCount) return '';

      const segments = [];
      if (pifCount) segments.push(`${pifCount} host uplink${pifCount === 1 ? '' : 's'}`);
      if (vifCount) segments.push(`${vifCount} workload interface${vifCount === 1 ? '' : 's'}`);
      return `Destroy requires a detached managed network. ${segments.join(' and ')} still map to this network.`;
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
    formatVlanLabel(network) {
      const value = String(network?.other_config?.vlan || '').trim();
      return value ? `VLAN ${value}` : 'untagged';
    },
    async loadNetworks() {
      this.loading = true;
      try {
        const [networkResult, hostResult] = await Promise.all([
          api.getNetworks(),
          api.getHosts(),
        ]);
        this.networks = networkResult.data || [];
        this.availableHosts = hostResult.data || [];
      } catch (error) {
        console.error(error);
        this.availableHosts = [];
      } finally {
        this.loading = false;
      }
      await this.syncRouteFocus();
    },
    async submitNetworkCreate(payload) {
      this.workspaceMessage = '';
      this.createError = '';
      this.createBusy = true;

      try {
        const record = await api.createNetwork(payload);
        await this.loadNetworks();
        this.workspaceMessage = `${record.name_label || payload.nameLabel} was created on ${record.bridge || payload.bridge}.`;
        const created = this.networks.find((entry) => entry.ref === record.ref) || record;
        if (created?.ref) {
          await this.openProperties(created);
        }
      } catch (error) {
        this.createError = error.message || 'Unable to create the requested network.';
      } finally {
        this.createBusy = false;
      }
    },
    async submitNetworkVlan(payload) {
      this.workspaceMessage = '';
      this.createVlanError = '';
      this.createVlanBusy = true;

      try {
        const record = await api.createNetworkVlan(payload);
        await this.loadNetworks();
        const targetNetwork = this.networks.find((entry) => entry.ref === (record.networkRef || payload.networkRef))
          || record.network
          || null;
        const targetPif = this.networkVlanPifOptions.find((entry) => entry.value === payload.pifRef) || null;
        this.workspaceMessage = `VLAN ${record.tag || payload.tag} was created on ${targetPif?.label || payload.pifRef} for ${targetNetwork?.name_label || record.network?.name_label || payload.networkRef}.`;
        if (targetNetwork?.ref) {
          await this.openProperties(targetNetwork, {
            focusedPifRef: payload.pifRef,
            focusedNetworkClass: 'vlan',
          });
        }
      } catch (error) {
        this.createVlanError = error.message || 'Unable to create the requested VLAN mapping.';
      } finally {
        this.createVlanBusy = false;
      }
    },
    async submitNetworkBond(payload) {
      this.workspaceMessage = '';
      this.createBondError = '';
      this.createBondBusy = true;

      try {
        const record = await api.createNetworkBond(payload);
        await this.loadNetworks();
        const targetNetwork = this.networks.find((entry) => entry.ref === (record.networkRef || payload.networkRef))
          || record.network
          || null;
        this.workspaceMessage = `Bond ${record.mode || payload.mode} was created across ${(record.memberPifRefs || payload.pifRefs || []).length} uplinks for ${targetNetwork?.name_label || record.network?.name_label || payload.networkRef}.`;
        if (targetNetwork?.ref) {
          await this.openProperties(targetNetwork, {
            focusedPifRef: (payload.pifRefs || [])[0] || '',
            focusedNetworkClass: 'bond',
          });
        }
      } catch (error) {
        this.createBondError = error.message || 'Unable to create the requested bond mapping.';
      } finally {
        this.createBondBusy = false;
      }
    },
    async submitSelectedNetworkVif(payload) {
      if (!this.selectedNetwork?.ref) {
        this.detailActionError = 'Select a network before attaching a new workload interface.';
        return;
      }

      if (!payload?.vmRef) {
        this.detailActionError = 'Select a VM before attaching a new workload interface.';
        return;
      }

      this.detailActionError = '';
      this.detailActionMessage = '';
      this.detailActionBusy = 'create-vif';

      try {
        const targetVm = this.relatedVMs.find((vm) => vm.ref === payload.vmRef) || null;
        const result = await api.addVMNic(payload.vmRef, {
          networkRef: this.selectedNetwork.ref,
          deviceLabel: payload.deviceLabel,
          mac: payload.mac,
        });
        this.focusedVifRef = result?.vifRef || '';
        this.focusedNetworkClass = this.focusedVifRef ? 'vif' : this.focusedNetworkClass;
        await this.refreshSelectedNetworkDetail({ refreshRelationships: true });
        this.detailActionMessage = `${targetVm?.name_label || payload.vmRef} was connected to ${this.selectedNetwork?.name_label || this.selectedNetwork.ref}.`;
      } catch (error) {
        this.detailActionError = error.message || 'Unable to attach a new workload interface on the selected network.';
      } finally {
        this.detailActionBusy = '';
      }
    },
    async removeSelectedNetworkVif(attachment) {
      if (!this.selectedNetwork?.ref) {
        this.detailActionError = 'Select a network before removing a workload interface.';
        return;
      }

      if (!attachment?.vmRef || !attachment?.interfaceRef) {
        this.detailActionError = 'The selected workload interface could not be resolved for removal.';
        return;
      }

      const confirmed = typeof window === 'undefined'
        ? true
        : window.confirm(`Remove ${attachment.interfaceRef} from ${attachment.vmName || attachment.vmRef}? This deletes the network interface record from the selected VM.`);

      if (!confirmed) return;

      this.detailActionError = '';
      this.detailActionMessage = '';
      this.detailActionBusy = 'remove-vif';
      this.removingVifRef = attachment.interfaceRef;

      try {
        await api.removeVMNic(attachment.vmRef, attachment.interfaceRef, { force: true });
        if (normalizeFocusValue(this.focusedVifRef) === normalizeFocusValue(attachment.interfaceRef)) {
          this.focusedVifRef = '';
          if (this.focusedNetworkClass === 'vif') {
            this.focusedNetworkClass = '';
          }
        }
        await this.refreshSelectedNetworkDetail({ refreshRelationships: true });
        this.detailActionMessage = `${attachment.vmName || attachment.vmRef} interface ${attachment.interfaceRef} was removed from ${this.selectedNetwork?.name_label || this.selectedNetwork.ref}.`;
      } catch (error) {
        this.detailActionError = error.message || 'Unable to remove the selected workload interface from this network.';
      } finally {
        this.detailActionBusy = '';
        this.removingVifRef = '';
      }
    },
    buildCurrentDetailFocusOptions(options = {}) {
      const includeRelationships = options.includeRelationships !== false;
      return {
        focusedPifRef: this.focusedPifRef,
        focusedVifRef: this.focusedVifRef,
        focusedNetworkClass: this.focusedNetworkClass,
        hosts: includeRelationships ? this.relatedHosts : undefined,
        vms: includeRelationships ? this.relatedVMs : undefined,
        vifs: includeRelationships ? this.relatedVifs : undefined,
      };
    },
    async refreshSelectedNetworkDetail(options = {}) {
      if (!this.selectedNetwork?.ref) return;

      const selectedRef = this.selectedNetwork.ref;
      const focusOptions = this.buildCurrentDetailFocusOptions({
        includeRelationships: !options.refreshRelationships,
      });
      await this.loadNetworks();
      const updated = this.networks.find((entry) => entry.ref === selectedRef) || this.selectedNetwork;
      await this.openProperties(updated, focusOptions);
    },
    clearSelectedNetworkDetail() {
      this.showProps = false;
      this.selectedNetwork = null;
      this.relatedHosts = [];
      this.relatedVMs = [];
      this.relatedVifs = [];
      this.disconnectingVifRef = '';
      this.focusedPifRef = '';
      this.focusedVifRef = '';
      this.removingVifRef = '';
      this.focusedNetworkClass = '';
      this.lastAppliedFocusKey = '';
    },
    async submitSelectedNetworkConfig(payload) {
      if (!this.selectedNetwork?.ref) {
        this.detailActionError = 'No selected network is available for metadata updates.';
        return;
      }

      this.detailActionError = '';
      this.detailActionMessage = '';
      this.detailActionBusy = 'config';

      try {
        const record = await api.updateNetworkConfig(this.selectedNetwork.ref, payload);
        await this.refreshSelectedNetworkDetail();
        this.detailActionMessage = `${record.name_label || payload.nameLabel || this.selectedNetwork.ref} network metadata was updated.`;
      } catch (error) {
        this.detailActionError = error.message || 'Unable to save the selected network metadata.';
      } finally {
        this.detailActionBusy = '';
      }
    },
    async resolveNetworkGovernanceApproval(action, target) {
      if (action === 'destroy-network' && target?.ref) {
        return resolveGovernanceApproval({
          actionKey: 'network_destroy',
          entityType: 'network',
          entityRef: target.ref,
          entityName: target.name_label || target.uuid || target.ref || 'Network',
          route: '/networking',
        });
      }

      return '';
    },
    async destroySelectedNetwork() {
      if (!this.selectedNetwork?.ref) {
        this.detailActionError = 'No selected network is available for the destroy action.';
        return;
      }

      if (this.selectedNetworkDestroyBlockedReason) {
        this.detailActionError = this.selectedNetworkDestroyBlockedReason;
        return;
      }

      const network = { ...this.selectedNetwork };
      const confirmed = typeof window === 'undefined'
        ? true
        : window.confirm(`Destroy ${network.name_label || network.ref}? This permanently removes the Xen network record once the platform accepts the request.`);

      if (!confirmed) return;

      this.workspaceMessage = '';
      this.detailActionError = '';
      this.detailActionMessage = '';
      this.detailActionBusy = 'destroy-network';

      try {
        const approvalId = await this.resolveNetworkGovernanceApproval('destroy-network', network);
        await api.destroyNetwork(network.ref, approvalId ? { approvalId } : {});
        await this.loadNetworks();
        this.clearSelectedNetworkDetail();
        this.workspaceMessage = `${network.name_label || network.ref} was destroyed and removed from the current network inventory view.`;
      } catch (error) {
        if (error.code === 'APPROVAL_REQUIRED') {
          this.detailActionError = 'Governance approval is required before destroying this network.';
          await handoffToGovernanceApproval(
            this.$router,
            error.approvalDraft,
            'Approval required before destroying this network.'
          );
          return;
        }
        this.detailActionError = error.message || 'Unable to destroy the selected network.';
      } finally {
        this.detailActionBusy = '';
      }
    },
    async openProperties(row, options = {}) {
      this.selectedNetwork = row;
      this.showProps = true;
      this.detailActionError = '';
      this.detailActionMessage = '';
      this.detailLoading = true;
      this.detailError = null;
      this.relatedHosts = options.hosts || [];
      this.relatedVMs = options.vms || [];
      this.relatedVifs = options.vifs || [];
      this.focusedPifRef = options.focusedPifRef || '';
      this.focusedVifRef = options.focusedVifRef || '';
      this.focusedNetworkClass = options.focusedNetworkClass || '';

      try {
        if (!options.hosts || !options.vms || !options.vifs) {
          const [hostsResult, vmsResult, vifResult] = await Promise.all([
            api.getHosts(),
            api.getVMs(),
            api.getNetworkInterfaces(),
          ]);
          this.relatedHosts = hostsResult.data || [];
          this.relatedVMs = vmsResult.data || [];
          this.relatedVifs = vifResult.data || [];
        }
      } catch (error) {
        this.relatedHosts = [];
        this.relatedVMs = [];
        this.relatedVifs = [];
        this.detailError = error.message || 'Unable to load network relationship detail';
      } finally {
        this.detailLoading = false;
      }
    },
    async disconnectSelectedNetworkVif(attachment) {
      if (!this.selectedNetwork?.ref) {
        this.detailActionError = 'Select a network before disconnecting a workload interface.';
        return;
      }

      if (!attachment?.vmRef || !attachment?.interfaceRef) {
        this.detailActionError = 'The selected workload interface could not be resolved for disconnect.';
        return;
      }

      if (!attachment.currentlyAttached) {
        this.detailActionError = `${attachment.interfaceRef} is already hot-unplugged from live traffic.`;
        return;
      }

      const confirmed = typeof window === 'undefined'
        ? true
        : window.confirm(`Hot-unplug ${attachment.interfaceRef} from ${attachment.vmName || attachment.vmRef}? The VIF record stays mapped to this network and VM, but live traffic is disconnected until it is plugged again.`);

      if (!confirmed) return;

      this.detailActionError = '';
      this.detailActionMessage = '';
      this.detailActionBusy = 'disconnect-vif';
      this.disconnectingVifRef = attachment.interfaceRef;

      try {
        const result = await api.disconnectVMNic(attachment.vmRef, attachment.interfaceRef, { force: true });
        await this.refreshSelectedNetworkDetail({ refreshRelationships: true });
        this.detailActionMessage = result?.alreadyDisconnected
          ? `${attachment.vmName || attachment.vmRef} interface ${attachment.interfaceRef} was already disconnected from live traffic on ${this.selectedNetwork?.name_label || this.selectedNetwork.ref}.`
          : `${attachment.vmName || attachment.vmRef} interface ${attachment.interfaceRef} was hot-unplugged from ${this.selectedNetwork?.name_label || this.selectedNetwork.ref}.`;
      } catch (error) {
        this.detailActionError = error.message || 'Unable to hot-unplug the selected workload interface from this network.';
      } finally {
        this.detailActionBusy = '';
        this.disconnectingVifRef = '';
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
        return { network: direct, focusedPifRef: '', focusedVifRef: '', focusedNetworkClass: '' };
      }

      for (const network of this.networks) {
        if (['pif', 'bond', 'vlan'].includes(focus.cls) && recordMatchesRouteFocus(network, focus, [], network.PIFs || [])) {
          return { network, focusedPifRef: focus.ref || '', focusedVifRef: '', focusedNetworkClass: focus.cls || '' };
        }

        if (focus.cls === 'vif' && recordMatchesRouteFocus(network, focus, [], network.VIFs || [])) {
          return { network, focusedPifRef: '', focusedVifRef: focus.ref || '', focusedNetworkClass: focus.cls || '' };
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
        this.focusedNetworkClass = '';
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
        focusedNetworkClass: target.focusedNetworkClass,
      });
      this.lastAppliedFocusKey = key;
    },
  },
};
