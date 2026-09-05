const NetworkingView = {
  components: {
    DataTable,
    FloatingWindow,
    StatusBadge,
    NetworkCreateDialogs,
    NetworkPropertiesWindow,
    NetworkWorkspaceDialogs,
  },
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
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-sm" @click="showCreateNetworkWindow = true">
            <span class="mdi mdi-lan-connect"></span>
            Create Network
          </button>
          <button class="btn btn-sm" @click="showCreateVlanWindow = true">
            <span class="mdi mdi-tag-outline"></span>
            Create VLAN
          </button>
          <button class="btn btn-sm" @click="showCreateBondWindow = true">
            <span class="mdi mdi-lan-pending"></span>
            Create Bond
          </button>
          <button class="btn btn-primary" @click="loadNetworks">
            <span class="mdi mdi-refresh"></span>
            Refresh
          </button>
        </div>
      </div>

      <div class="stack-item" v-if="workspaceMessage" style="margin-bottom:16px">
        <div>
          <strong>Workspace updated</strong>
          <div class="text-muted mono" style="font-size:11px">{{ workspaceMessage }}</div>
        </div>
        <span class="badge badge-running">ready</span>
      </div>

      <div class="dash-card" v-if="networkSelectionProfile.rows.length" style="margin-bottom:16px">
        <div class="dash-card-label">Batch Network Actions</div>
        <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap">
          <div>
            <strong>{{ networkSelectionProfile.rows.length }} networks selected</strong>
            <div class="text-muted mono" style="font-size:11px;margin-top:4px">{{ networkSelectionProfile.summary }}</div>
          </div>
          <div class="dashboard-hero-rail" style="gap:8px">
            <button class="btn btn-sm btn-danger"
                    v-if="networkSelectionProfile.destroyReady.length"
                    :disabled="Boolean(bulkActionBusy)"
                    @click="applyBulkNetworkAction('destroy')">
              <span class="mdi mdi-delete-outline"></span>
              {{ bulkActionBusy === 'destroy' ? 'Destroying...' : `Destroy Selected (${networkSelectionProfile.destroyReady.length})` }}
            </button>
            <button class="btn btn-sm" :disabled="Boolean(bulkActionBusy)" @click="clearNetworkSelection">Clear Selection</button>
          </div>
        </div>
        <div class="text-muted mono" v-if="networkSelectionProfile.blocked.length" style="font-size:11px;margin-top:12px">
          {{ networkSelectionProfile.blocked.length }} selected network{{ networkSelectionProfile.blocked.length === 1 ? ' remains' : 's remain' }} blocked until host uplinks and workload interfaces are detached.
        </div>
        <div class="form-error" v-if="bulkError" style="text-align:left;margin-top:12px">{{ bulkError }}</div>
      </div>

      <data-table :columns="columns"
                  :data="networks"
                  :loading="loading"
                  :searchable="true"
                  :selectable="true"
                  :selected-keys="selectedNetworkRefs"
                  row-key="ref"
                  empty-message="No networks connected. Connect to a XenServer pool to get started."
                  empty-icon="mdi-lan"
                  @selection-change="handleNetworkSelectionChange"
                  @cell-edit="saveInlineNetworkEdit"
                  @row-click="openProperties">
        <template #empty-action>
          <button class="btn btn-sm btn-primary" @click="$router.push('/pools')">Go to Pools</button>
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

      <network-properties-window
        :show="showProps"
        :selected-network="selectedNetwork"
        :selected-network-vlan-label="selectedNetworkVlanLabel"
        :selected-network-topology-label="selectedNetworkTopologyLabel"
        :selected-network-purpose-label="selectedNetworkPurposeLabel"
        :selected-network-host-uplinks="selectedNetworkHostUplinks"
        :selected-network-vm-attachments="selectedNetworkVmAttachments"
        :focused-network-context="focusedNetworkContext"
        :detail-action-busy="detailActionBusy"
        :detail-action-error="detailActionError"
        :detail-action-message="detailActionMessage"
        :detail-loading="detailLoading"
        :detail-error="detailError || ''"
        :disconnecting-vif-ref="disconnectingVifRef"
        :removing-vif-ref="removingVifRef"
        :focused-pif-ref="focusedPifRef"
        :focused-vif-ref="focusedVifRef"
        @close="clearSelectedNetworkDetail"
        @open-network-metadata="showNetworkMetadataWindow = true"
        @open-network-identity="showNetworkIdentityWindow = true"
        @open-network-attach-vif="showNetworkAttachVifWindow = true"
        @open-network-vif-qos="showNetworkVifQosWindow = true"
        @disconnect-selected-network-vif="disconnectSelectedNetworkVif"
        @remove-selected-network-vif="removeSelectedNetworkVif"
        @open-host-workspace="openHostWorkspace"
        @open-vm-workspace="openVmWorkspace">
      </network-properties-window>

      <network-workspace-dialogs
        :selected-network="selectedNetwork"
        :selected-network-topology-label="selectedNetworkTopologyLabel"
        :selected-network-vlan-label="selectedNetworkVlanLabel"
        :selected-network-destroy-blocked-reason="selectedNetworkDestroyBlockedReason"
        :network-vif-vm-options="networkVifVmOptions"
        :network-vif-qos-options="networkVifQosOptions"
        :selected-attachment-vif-ref="selectedAttachmentVifRef"
        :selected-network-vif-qos-summary="selectedNetworkVifQosSummary"
        :selected-network-vif-qos-target="selectedNetworkVifQosTarget"
        :detail-action-busy="detailActionBusy"
        :show-network-metadata-window="showNetworkMetadataWindow"
        :show-network-identity-window="showNetworkIdentityWindow"
        :show-network-attach-vif-window="showNetworkAttachVifWindow"
        :show-network-vif-qos-window="showNetworkVifQosWindow"
        @close-network-metadata="showNetworkMetadataWindow = false"
        @close-network-identity="showNetworkIdentityWindow = false"
        @close-network-attach-vif="showNetworkAttachVifWindow = false"
        @close-network-vif-qos="showNetworkVifQosWindow = false"
        @submit-selected-network-config="submitSelectedNetworkConfig"
        @destroy-selected-network="destroySelectedNetwork"
        @submit-selected-network-vif="submitSelectedNetworkVif"
        @update:selected-attachment-vif-ref="selectedAttachmentVifRef = $event"
        @submit-selected-network-vif-qos="submitSelectedNetworkVifQos">
      </network-workspace-dialogs>

      <network-create-dialogs
        :show-create-network-window="showCreateNetworkWindow"
        :show-create-vlan-window="showCreateVlanWindow"
        :show-create-bond-window="showCreateBondWindow"
        :create-busy="createBusy"
        :create-error="createError"
        :create-vlan-busy="createVlanBusy"
        :create-vlan-error="createVlanError"
        :create-bond-busy="createBondBusy"
        :create-bond-error="createBondError"
        :network-vlan-options="networkVlanOptions"
        :network-vlan-pif-options="networkVlanPifOptions"
        @close-create-network="showCreateNetworkWindow = false"
        @close-create-vlan="showCreateVlanWindow = false"
        @close-create-bond="showCreateBondWindow = false"
        @submit-network-create="submitNetworkCreate"
        @submit-network-vlan="submitNetworkVlan"
        @submit-network-bond="submitNetworkBond">
      </network-create-dialogs>
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
      selectedNetworkRefs: [],
      bulkActionBusy: '',
      bulkError: '',
      showCreateNetworkWindow: false,
      showCreateVlanWindow: false,
      showCreateBondWindow: false,
      showNetworkMetadataWindow: false,
      showNetworkIdentityWindow: false,
      showNetworkAttachVifWindow: false,
      showNetworkVifQosWindow: false,
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
      selectedAttachmentVifRef: '',
      focusedPifRef: '',
      focusedVifRef: '',
      focusedNetworkClass: '',
      lastAppliedFocusKey: '',
      columns: [
        { key: 'name_label', label: 'Name', editable: true, emptyLabel: 'Unnamed Network' },
        { key: 'name_description', label: 'Description', editable: true, emptyLabel: '—', truncate: true },
        { key: 'bridge', label: 'Bridge' },
        { key: 'vlan', label: 'VLAN' },
        { key: 'managed', label: 'Managed' },
        { key: 'uuid', label: 'UUID', truncate: true },
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
      return buildNetworkVlanOptions(this.networks);
    },
    networkVlanPifOptions() {
      return buildNetworkVlanPifOptions(this.availableHosts);
    },
    networkVifVmOptions() {
      return buildNetworkVifVmOptions(this.relatedVMs);
    },
    networkVifQosOptions() {
      return buildNetworkVifQosOptions(this.selectedNetworkVmAttachments);
    },
    networkSelectionProfile() {
      return buildNetworkSelectionProfile(this.networks, this.selectedNetworkRefs);
    },
    selectedNetworkTopologyLabel() {
      return buildSelectedNetworkTopologyLabel(this.selectedNetwork, this.selectedNetworkHostUplinks, this.selectedNetworkVlanLabel);
    },
    focusedNetworkContext() {
      return buildFocusedNetworkContext(
        this.focusedNetworkClass,
        this.focusedPifRef,
        this.focusedVifRef,
        this.selectedNetworkVlanLabel,
        this.selectedNetwork
      );
    },
    selectedNetworkHostUplinks() {
      return buildSelectedNetworkHostUplinks(this.selectedNetwork, this.relatedHosts, this.selectedNetworkVlanLabel);
    },
    selectedNetworkVmAttachments() {
      return buildSelectedNetworkVmAttachments(this.selectedNetwork, this.relatedVMs, this.relatedVifs);
    },
    selectedNetworkVifQosTarget() {
      if (!this.selectedAttachmentVifRef) return null;
      return this.relatedVifs.find((vif) => vif.ref === this.selectedAttachmentVifRef) || null;
    },
    selectedNetworkVifQosSummary() {
      const target = this.selectedNetworkVifQosTarget;
      if (!target) return 'Select an attached interface to review or update its QoS shaping policy.';
      return this.summarizeVifQos(target, { emptyLabel: 'No QoS shaping is currently configured on this interface.' });
    },
    selectedNetworkDestroyBlockedReason() {
      return buildSelectedNetworkDestroyBlockedReason(this.selectedNetwork);
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
    summarizeVifQos: summarizeNetworkVifQos,
    formatVlanLabel: formatNetworkVlanLabel,
    syncSelectedAttachmentVifRef() {
      this.selectedAttachmentVifRef = resolveSelectedNetworkAttachmentVifRef(
        this.selectedNetworkVmAttachments,
        this.focusedVifRef,
        this.selectedAttachmentVifRef
      );
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
        const validRefs = new Set(this.networks.map((network) => network.ref).filter(Boolean));
        this.selectedNetworkRefs = this.selectedNetworkRefs.filter((ref) => validRefs.has(ref));
      } catch (error) {
        console.error(error);
        this.availableHosts = [];
        this.selectedNetworkRefs = [];
      } finally {
        this.loading = false;
      }
      await this.syncRouteFocus();
    },
    handleNetworkSelectionChange(keys) {
      this.selectedNetworkRefs = Array.isArray(keys) ? keys : [];
      this.bulkError = '';
    },
    clearNetworkSelection() {
      this.selectedNetworkRefs = [];
      this.bulkError = '';
    },
    async submitNetworkCreate(payload) {
      this.workspaceMessage = '';
      this.createError = '';
      this.createBusy = true;

      try {
        const record = await api.createNetwork(payload);
        await this.loadNetworks();
        this.showCreateNetworkWindow = false;
        this.workspaceMessage = buildNetworkCreateMessage(record, payload);
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
        this.showCreateVlanWindow = false;
        const targetNetwork = this.networks.find((entry) => entry.ref === (record.networkRef || payload.networkRef))
          || record.network
          || null;
        const targetPif = this.networkVlanPifOptions.find((entry) => entry.value === payload.pifRef) || null;
        this.workspaceMessage = buildNetworkVlanCreateMessage(record, payload, targetNetwork, targetPif);
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
        this.showCreateBondWindow = false;
        const targetNetwork = this.networks.find((entry) => entry.ref === (record.networkRef || payload.networkRef))
          || record.network
          || null;
        this.workspaceMessage = buildNetworkBondCreateMessage(record, payload, targetNetwork);
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
        this.detailActionMessage = buildNetworkVifAttachMessage(targetVm, payload, this.selectedNetwork);
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

      const confirmed = await requestGlobalConfirm({
        title: 'Remove Workload Interface',
        message: `Remove ${attachment.interfaceRef} from ${attachment.vmName || attachment.vmRef}? This deletes the network interface record from the selected VM.`,
        confirmLabel: 'Remove Interface',
        danger: true,
      });

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
        this.detailActionMessage = buildNetworkVifRemoveMessage(attachment, this.selectedNetwork);
      } catch (error) {
        this.detailActionError = error.message || 'Unable to remove the selected workload interface from this network.';
      } finally {
        this.detailActionBusy = '';
        this.removingVifRef = '';
      }
    },
    async submitSelectedNetworkVifQos(payload) {
      const vifRef = this.selectedAttachmentVifRef || this.selectedNetworkVifQosTarget?.ref || '';
      if (!this.selectedNetwork?.ref || !vifRef) {
        this.detailActionError = 'Select an attached interface before saving QoS policy changes.';
        return;
      }

      this.detailActionError = '';
      this.detailActionMessage = '';
      this.detailActionBusy = 'config-vif';

      try {
        const record = await api.updateNetworkInterfaceConfig(vifRef, payload);
        const attachment = this.selectedNetworkVmAttachments.find((entry) => entry.interfaceRef === vifRef) || null;
        this.focusedVifRef = vifRef;
        this.focusedNetworkClass = 'vif';
        await this.refreshSelectedNetworkDetail({ refreshRelationships: true });
        this.detailActionMessage = buildNetworkVifQosMessage(attachment, vifRef, this.selectedNetwork);
        this.selectedAttachmentVifRef = record?.ref || vifRef;
      } catch (error) {
        this.detailActionError = error.message || 'Unable to save QoS settings for the selected workload interface.';
      } finally {
        this.detailActionBusy = '';
      }
    },
    buildCurrentDetailFocusOptions(options = {}) {
      return buildCurrentNetworkDetailFocusOptions({
        focusedPifRef: this.focusedPifRef,
        focusedVifRef: this.focusedVifRef,
        focusedNetworkClass: this.focusedNetworkClass,
        relatedHosts: this.relatedHosts,
        relatedVMs: this.relatedVMs,
        relatedVifs: this.relatedVifs,
      }, options);
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
      this.resetNetworkWorkspaceWindows();
      this.showProps = false;
      this.selectedNetwork = null;
      this.relatedHosts = [];
      this.relatedVMs = [];
      this.relatedVifs = [];
      this.disconnectingVifRef = '';
      this.selectedAttachmentVifRef = '';
      this.focusedPifRef = '';
      this.focusedVifRef = '';
      this.removingVifRef = '';
      this.focusedNetworkClass = '';
      this.lastAppliedFocusKey = '';
    },
    resetNetworkWorkspaceWindows() {
      this.showNetworkMetadataWindow = false;
      this.showNetworkIdentityWindow = false;
      this.showNetworkAttachVifWindow = false;
      this.showNetworkVifQosWindow = false;
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
        this.detailActionMessage = buildNetworkConfigMessage(record, payload, this.selectedNetwork);
      } catch (error) {
        this.detailActionError = error.message || 'Unable to save the selected network metadata.';
      } finally {
        this.detailActionBusy = '';
      }
    },
    async saveInlineNetworkEdit({ row, key, value }) {
      if (!['name_label', 'name_description'].includes(key) || !row?.ref) return;
      this.workspaceMessage = '';
      this.detailActionError = '';
      try {
        const record = await api.updateNetworkConfig(row.ref, {
          nameLabel: key === 'name_label' ? value : (row.name_label || ''),
          nameDescription: key === 'name_description' ? value : (row.name_description || ''),
          mtu: Number(row.MTU || row.mtu || 1500),
          defaultLockingMode: row.default_locking_mode || row.defaultLockingMode || 'unlocked',
          purpose: Array.isArray(row.purpose) ? row.purpose : [],
          tags: Array.isArray(row.tags) ? row.tags : [],
          otherConfig: row.other_config || row.otherConfig || {},
        });
        this.networks = this.networks.map((entry) => entry.ref === row.ref ? { ...entry, ...record } : entry);
        this.workspaceMessage = key === 'name_label' ? `${value} was renamed.` : 'Description was updated.';
      } catch (error) {
        this.detailActionError = error.message || 'Unable to update the network inline.';
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
      const confirmed = await requestGlobalConfirm({
        title: 'Destroy Network',
        message: `Destroy ${network.name_label || network.ref}? This permanently removes the Xen network record once the platform accepts the request.`,
        confirmLabel: 'Destroy Network',
        danger: true,
      });

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
        this.workspaceMessage = buildNetworkDestroyMessage(network);
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
    async applyBulkNetworkAction(action) {
      if (action !== 'destroy') return;

      const targets = this.networkSelectionProfile.destroyReady;
      if (!targets.length) {
        this.bulkError = 'No selected networks are currently detached and ready for the destroy action.';
        return;
      }

      const confirmed = await requestGlobalConfirm({
        title: 'Destroy Selected Networks',
        message: `Destroy ${targets.length} selected network${targets.length === 1 ? '' : 's'}? This permanently removes each detached Xen network record once the platform accepts the request.`,
        confirmLabel: targets.length === 1 ? 'Destroy Network' : 'Destroy Networks',
        danger: true,
      });

      if (!confirmed) return;

      this.workspaceMessage = '';
      this.bulkError = '';
      this.bulkActionBusy = action;
      let completed = 0;
      let approvalDraft = null;
      let selectedNetworkDestroyed = false;

      try {
        for (const network of targets) {
          try {
            const approvalId = await this.resolveNetworkGovernanceApproval('destroy-network', network);
            await api.destroyNetwork(network.ref, approvalId ? { approvalId } : {});
            completed += 1;
            if (this.selectedNetwork?.ref === network.ref) {
              selectedNetworkDestroyed = true;
            }
          } catch (error) {
            approvalDraft = error.code === 'APPROVAL_REQUIRED' ? error.approvalDraft : null;
            this.bulkError = completed
              ? `Processed ${completed} network(s) before stopping: ${error.message || 'Unable to continue the batch network destroy action.'}`
              : (error.message || 'Unable to continue the batch network destroy action.');
            break;
          }
        }
      } finally {
        this.bulkActionBusy = '';
      }

      if (completed) {
        await this.loadNetworks();
        if (selectedNetworkDestroyed) {
          this.clearSelectedNetworkDetail();
        }
        this.workspaceMessage = buildBulkNetworkDestroyMessage(targets.slice(0, completed));
      }

      if (approvalDraft) {
        await handoffToGovernanceApproval(
          this.$router,
          approvalDraft,
          'Approval required before destroying one or more selected networks.'
        );
      }
    },
    async openProperties(row, options = {}) {
      this.resetNetworkWorkspaceWindows();
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
        this.syncSelectedAttachmentVifRef();
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

      const confirmed = await requestGlobalConfirm({
        title: 'Hot-Unplug Interface',
        message: `Hot-unplug ${attachment.interfaceRef} from ${attachment.vmName || attachment.vmRef}? The VIF record stays mapped to this network and VM, but live traffic is disconnected until it is plugged again.`,
        confirmLabel: 'Hot-Unplug Interface',
        danger: true,
      });

      if (!confirmed) return;

      this.detailActionError = '';
      this.detailActionMessage = '';
      this.detailActionBusy = 'disconnect-vif';
      this.disconnectingVifRef = attachment.interfaceRef;

      try {
        const result = await api.disconnectVMNic(attachment.vmRef, attachment.interfaceRef, { force: true });
        await this.refreshSelectedNetworkDetail({ refreshRelationships: true });
        this.detailActionMessage = buildNetworkVifDisconnectMessage(result, attachment, this.selectedNetwork);
      } catch (error) {
        this.detailActionError = error.message || 'Unable to hot-unplug the selected workload interface from this network.';
      } finally {
        this.detailActionBusy = '';
        this.disconnectingVifRef = '';
      }
    },
    openHostWorkspace(uplink) {
      const location = buildNetworkHostWorkspaceLocation(uplink);
      if (!location) return;
      this.clearSelectedNetworkDetail();
      this.$router.push(location);
    },
    openVmWorkspace(attachment) {
      const location = buildNetworkVmWorkspaceLocation(attachment);
      if (!location) return;
      this.clearSelectedNetworkDetail();
      this.$router.push(location);
    },
    findNetworkByFocus(focus) {
      return findNetworkByFocus(this.networks, focus);
    },
    resolveFocusedNetworkTarget(focus) {
      return resolveFocusedNetworkTarget(this.networks, focus);
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
