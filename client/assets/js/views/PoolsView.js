const PoolsView = {
  components: {
    DataTable,
    FloatingWindow,
    PoolPropertiesWindow,
    PoolRegistrationForm,
    PoolTargetConnectDialog,
    PoolTargetsDialogs,
    PoolWorkspaceDialogs,
  },
  template: `
    <div class="animate-fade-in">
      <div class="section-head">
        <div>
          <h2 class="section-title">
            <span class="mdi mdi-source-branch"></span>
            Pools
          </h2>
          <p class="section-subtitle">Live pool topology plus registered pool targets for multi-pool administration.</p>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn" @click="openRegistration()">
            <span class="mdi mdi-plus"></span>
            Register Pool
          </button>
          <button class="btn btn-sm"
                  v-if="attachedTargets.length"
                  @click="showAttachedTargetsWindow = true">
            <span class="mdi mdi-lan-connect"></span>
            Attached Live Targets ({{ attachedTargets.length }})
          </button>
          <button class="btn btn-sm" @click="showRegisteredTargetsWindow = true">
            <span class="mdi mdi-server-network-outline"></span>
            Registered Pool Targets ({{ connections.length }})
          </button>
          <button class="btn btn-primary" @click="loadAll">
            <span class="mdi mdi-refresh"></span>
            Refresh
          </button>
        </div>
      </div>

      <div class="dashboard-panels">
        <div class="dash-card" v-if="showConnectionGuidance">
          <div class="dash-card-label">Control-Plane Session</div>
          <div class="text-muted" style="line-height:1.6">
            XenMange is signed in as <span class="mono">{{ store.user?.displayName || store.username || 'operator' }}</span>, but there is no live Xen target attached yet.
            Connect one of the registered pool targets below to load live topology, host membership, and VM inventory into this workspace.
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px">
            <button class="btn btn-primary"
                    v-if="preferredConnection"
                    @click="openConnectDialog(preferredConnection)">
              <span class="mdi mdi-connection"></span>
              Connect {{ preferredConnection.name || preferredConnection.host }}
            </button>
            <button class="btn"
                    @click="showRegisteredTargetsWindow = true">
              <span class="mdi mdi-server-network-outline"></span>
              Browse Registered Targets
            </button>
            <button class="btn" @click="openRegistration()">
              <span class="mdi mdi-plus"></span>
              Register Another Pool
            </button>
          </div>
          <div class="form-error" v-if="liveDataError" style="text-align:left;margin-top:12px">{{ liveDataError }}</div>
        </div>
      </div>

      <data-table v-if="pools.length"
                  :columns="columns"
                  :data="pools"
                  :loading="loading"
                  :searchable="true"
                  @row-click="openProperties">
        <template #cell-name_label="{ row }">
          <span style="color:var(--text-primary);font-weight:500">{{ row.name_label || 'Unnamed Pool' }}</span>
        </template>
        <template #cell-tags="{ row }">
          <span class="mono">{{ truncateList(row.tags) }}</span>
        </template>
        <template #cell-default_SR="{ row }">
          <span class="mono property-wrap">{{ resolveStorageLabel(row.default_SR) }}</span>
        </template>
      </data-table>
      <div v-else class="empty-state" style="padding:24px 18px">
        <div v-if="showConnectionGuidance">No live pool topology is available until a Xen target is connected for this session.</div>
        <div v-else>No pools were returned by the currently attached Xen target.</div>
      </div>

      <pool-properties-window
        :show="showProps"
        :selected-pool="selectedPool"
        :selected-pool-default-storage-label="selectedPoolDefaultStorageLabel"
        :selected-pool-migration-compression-label="selectedPoolMigrationCompressionLabel"
        :selected-pool-wlb-enabled-label="selectedPoolWlbEnabledLabel"
        :selected-pool-wlb-url-label="selectedPoolWlbUrlLabel"
        :selected-pool-vswitch-controller-label="selectedPoolVswitchControllerLabel"
        :selected-pool-igmp-snooping-label="selectedPoolIgmpSnoopingLabel"
        :selected-pool-ha-enabled-label="selectedPoolHaEnabledLabel"
        :selected-pool-ha-tolerance-label="selectedPoolHaToleranceLabel"
        :selected-pool-other-config-summary="selectedPoolOtherConfigSummary"
        :selected-pool-hosts="selectedPoolHosts"
        :pool-host-columns="poolHostColumns"
        :pool-action-message="poolActionMessage || ''"
        :pool-action-error="poolActionError || ''"
        :loading="loading"
        @close="closePoolProperties"
        @open-pool-identity="showPoolIdentityWindow = true"
        @open-pool-context="showPoolContextWindow = true"
        @open-pool-ha="showPoolHaWindow = true">
      </pool-properties-window>

      <pool-workspace-dialogs
        :selected-pool="selectedPool"
        :selected-pool-hosts="selectedPoolHosts"
        :selected-pool-storage-options="selectedPoolStorageOptions"
        :selected-pool-default-storage-label="selectedPoolDefaultStorageLabel"
        :selected-pool-migration-compression-label="selectedPoolMigrationCompressionLabel"
        :selected-pool-migration-compression-detail="selectedPoolMigrationCompressionDetail"
        :selected-pool-wlb-enabled-label="selectedPoolWlbEnabledLabel"
        :selected-pool-wlb-detail="selectedPoolWlbDetail"
        :selected-pool-vswitch-controller-configured="selectedPoolVswitchControllerConfigured"
        :selected-pool-vswitch-controller-detail="selectedPoolVswitchControllerDetail"
        :selected-pool-igmp-snooping-label="selectedPoolIgmpSnoopingLabel"
        :selected-pool-igmp-snooping-detail="selectedPoolIgmpSnoopingDetail"
        :selected-pool-other-config-summary="selectedPoolOtherConfigSummary"
        :selected-pool-other-config-entries="selectedPoolOtherConfigEntries"
        :selected-pool-ha-enabled-label="selectedPoolHaEnabledLabel"
        :selected-pool-ha-status-detail="selectedPoolHaStatusDetail"
        :selected-pool-ha-planner-detail="selectedPoolHaPlannerDetail"
        :pool-config-saving="poolConfigSaving"
        :pool-ha-saving="poolHaSaving"
        :show-pool-identity-window="showPoolIdentityWindow"
        :show-pool-context-window="showPoolContextWindow"
        :show-pool-ha-window="showPoolHaWindow"
        @close-pool-identity="showPoolIdentityWindow = false"
        @close-pool-context="showPoolContextWindow = false"
        @close-pool-ha="showPoolHaWindow = false"
        @submit-selected-pool-config="submitSelectedPoolConfig"
        @submit-selected-pool-ha-state="submitSelectedPoolHaState">
      </pool-workspace-dialogs>

      <floating-window :show="showRegistration"
                       :title="editingConnectionId ? 'Edit Pool Target' : 'Register Pool Target'"
                       :width="560"
                       :height="500"
                       @close="showRegistration = false">
        <pool-registration-form
          :initial-value="connectionDraft"
          :credential-options="credentials"
          :submit-label="editingConnectionId ? 'Update Pool Target' : 'Save Pool Target'"
          @submit="submitConnection">
        </pool-registration-form>
      </floating-window>

      <pool-target-connect-dialog
        :show="showConnectDialogWindow"
        :connect-target="connectTarget"
        :password="connectPassword"
        :connect-loading="connectLoading"
        :connect-error="connectError || ''"
        :use-saved-credential="useSavedCredential"
        @close="closeConnectDialog"
        @submit="connectTargetSession"
        @update:password="connectPassword = $event"
        @update:use-saved-credential="useSavedCredential = $event">
      </pool-target-connect-dialog>

      <pool-targets-dialogs
        :show-attached-targets-window="showAttachedTargetsWindow"
        :show-registered-targets-window="showRegisteredTargetsWindow"
        :attached-targets="attachedTargets"
        :connections="connections"
        :connection-error="connectionError || ''"
        @close-attached-targets="showAttachedTargetsWindow = false"
        @close-registered-targets="showRegisteredTargetsWindow = false"
        @activate-live-target="activateLiveTarget"
        @disconnect-live-target="disconnectLiveTarget"
        @open-connect-dialog="openConnectDialog"
        @activate-connection="activateConnection"
        @open-registration="openRegistration"
        @make-default="makeDefault"
        @remove-connection="removeConnection">
      </pool-targets-dialogs>
    </div>
  `,
  data() {
    return {
      store,
      loading: true,
      pools: [],
      hosts: [],
      storage: [],
      connections: [],
      credentials: [],
      selectedPool: null,
      showProps: false,
      showPoolIdentityWindow: false,
      showPoolContextWindow: false,
      showPoolHaWindow: false,
      poolConfigSaving: false,
      poolHaSaving: false,
      poolActionError: null,
      poolActionMessage: '',
      showRegistration: false,
      editingConnectionId: null,
      connectionDraft: null,
      connectionError: null,
      liveDataError: null,
      showConnectDialogWindow: false,
      showAttachedTargetsWindow: false,
      showRegisteredTargetsWindow: false,
      connectTarget: null,
      connectPassword: '',
      connectLoading: false,
      connectError: null,
      useSavedCredential: false,
      lastAppliedFocusKey: '',
      columns: [
        { key: 'name_label', label: 'Name' },
        { key: 'uuid', label: 'UUID' },
        { key: 'default_SR', label: 'Default SR' },
        { key: 'tags', label: 'Tags' },
      ],
      poolHostColumns: [
        { key: 'name_label', label: 'Host' },
        { key: 'role', label: 'Role' },
        { key: 'enabled', label: 'Status' },
        { key: 'address', label: 'Address' },
        { key: 'residentVmCount', label: 'VMs' },
        { key: 'tags', label: 'Tags' },
      ],
    };
  },
  computed: {
    showConnectionGuidance() {
      return store.authenticated && !store.connected && !store.demoMode;
    },
    attachedTargets() {
      return Array.isArray(store.connectedTargets) ? store.connectedTargets : [];
    },
    preferredConnection() {
      return buildPreferredPoolConnection(this.connections);
    },
    selectedPoolHosts() {
      return buildSelectedPoolHosts(this.selectedPool, this.hosts, this.pools);
    },
    selectedPoolStorageOptions() {
      return buildSelectedPoolStorageOptions(this.selectedPool, this.selectedPoolHosts, this.storage);
    },
    selectedPoolDefaultStorageLabel() {
      return resolvePoolStorageLabel(this.storage, this.selectedPool?.default_SR);
    },
    selectedPoolMigrationCompressionLabel() {
      return buildSelectedPoolMigrationCompressionLabel(this.selectedPool);
    },
    selectedPoolMigrationCompressionDetail() {
      return buildSelectedPoolMigrationCompressionDetail(this.selectedPool);
    },
    selectedPoolWlbEnabledLabel() {
      return buildSelectedPoolWlbEnabledLabel(this.selectedPool);
    },
    selectedPoolWlbUrlLabel() {
      return buildSelectedPoolWlbUrlLabel(this.selectedPool);
    },
    selectedPoolWlbDetail() {
      return buildSelectedPoolWlbDetail(this.selectedPool);
    },
    selectedPoolVswitchControllerLabel() {
      return buildSelectedPoolVswitchControllerLabel(this.selectedPool);
    },
    selectedPoolVswitchControllerConfigured() {
      return isSelectedPoolVswitchControllerConfigured(this.selectedPool);
    },
    selectedPoolVswitchControllerDetail() {
      return buildSelectedPoolVswitchControllerDetail(this.selectedPool);
    },
    selectedPoolIgmpSnoopingLabel() {
      return buildSelectedPoolIgmpSnoopingLabel(this.selectedPool);
    },
    selectedPoolIgmpSnoopingDetail() {
      return buildSelectedPoolIgmpSnoopingDetail(this.selectedPool);
    },
    selectedPoolHaEnabledLabel() {
      return buildSelectedPoolHaEnabledLabel(this.selectedPool);
    },
    selectedPoolHaToleranceLabel() {
      return buildSelectedPoolHaToleranceLabel(this.selectedPool);
    },
    selectedPoolHaStatusDetail() {
      return buildSelectedPoolHaStatusDetail(this.selectedPool);
    },
    selectedPoolHaPlannerDetail() {
      return buildSelectedPoolHaPlannerDetail(this.selectedPool);
    },
    selectedPoolOtherConfigEntries() {
      return buildSelectedPoolOtherConfigEntries(this.selectedPool);
    },
    selectedPoolOtherConfigSummary() {
      return buildSelectedPoolOtherConfigSummary(this.selectedPoolOtherConfigEntries);
    },
  },
  async mounted() {
    if (!store.authenticated) {
      this.$router.push('/login');
      return;
    }
    await this.loadAll();
    await this.syncRouteFocus();
    await this.syncPendingConnectionTarget();
    this.syncRegistrationIntent();
  },
  watch: {
    '$route.query': {
      deep: true,
      async handler() {
        await this.syncRouteFocus();
        await this.syncPendingConnectionTarget();
        this.syncRegistrationIntent();
      },
    },
  },
  methods: {
    formatDateTime,
    truncateList,
    summarizeCount,
    visibilityLabel(visibility) {
      return buildPoolVisibilityLabel(visibility);
    },
    ownershipLabel(connection) {
      return buildPoolOwnershipLabel(connection);
    },
    isCurrentConnection(connection) {
      return isPoolCurrentConnection(this.attachedTargets, connection);
    },
    isConnectionAttached(connection) {
      return isPoolConnectionAttached(this.attachedTargets, connection);
    },
    findAttachedTarget(connection) {
      return findPoolAttachedTarget(this.attachedTargets, connection);
    },
    async loadAll() {
      await Promise.all([this.loadPools(), this.loadHosts(), this.loadStorage(), this.loadConnections(), this.loadCredentials()]);
    },
    async loadPools() {
      this.loading = true;
      this.liveDataError = null;
      try {
        const result = await api.getPools();
        this.pools = result.data || [];
      } catch (error) {
        this.pools = [];
        if (error.code === 'XEN_TARGET_NOT_CONNECTED') {
          this.liveDataError = 'Connect a registered pool target to load live topology.';
        } else {
          this.liveDataError = error.message || 'Unable to load live pool topology';
        }
      } finally {
        this.loading = false;
      }
      await this.syncRouteFocus();
    },
    async loadHosts() {
      try {
        const result = await api.getHosts();
        this.hosts = result.data || [];
      } catch (error) {
        this.hosts = [];
      }
    },
    async loadConnections() {
      try {
        this.connections = await api.getConnections();
      } catch (error) {
        this.connections = [];
      }
    },
    async loadStorage() {
      try {
        const result = await api.getSRs();
        this.storage = result.data || [];
      } catch (error) {
        this.storage = [];
      }
    },
    async loadCredentials() {
      try {
        const result = await api.getCredentials();
        this.credentials = result.data || [];
      } catch (error) {
        this.credentials = [];
      }
    },
    resetPoolWorkspaceWindows() {
      this.showPoolIdentityWindow = false;
      this.showPoolContextWindow = false;
      this.showPoolHaWindow = false;
    },
    closePoolProperties() {
      this.showProps = false;
      this.resetPoolWorkspaceWindows();
    },
    openProperties(row) {
      this.poolActionMessage = '';
      this.poolActionError = null;
      this.resetPoolWorkspaceWindows();
      this.selectedPool = row;
      this.showProps = true;
    },
    async submitSelectedPoolConfig(payload) {
      if (!this.selectedPool) return;

      this.poolActionMessage = '';
      this.poolActionError = null;
      this.poolConfigSaving = true;
      try {
        const record = await api.updatePoolConfig(this.selectedPool.ref, payload);
        this.selectedPool = { ...this.selectedPool, ...(record || {}) };
        this.pools = this.pools.map((entry) => (entry.ref === this.selectedPool.ref ? { ...entry, ...(record || {}) } : entry));
        this.poolActionMessage = buildPoolConfigSavedMessage(record, payload, this.selectedPool);
      } catch (error) {
        this.poolActionError = error.message || 'Unable to save pool metadata';
      } finally {
        this.poolConfigSaving = false;
      }
    },
    async submitSelectedPoolHaState(payload) {
      if (!this.selectedPool) return;

      this.poolActionMessage = '';
      this.poolActionError = null;
      this.poolHaSaving = true;
      try {
        const wasEnabled = Boolean(this.selectedPool?.ha_enabled);
        const record = await api.updatePoolHaState(this.selectedPool.ref, {
          ...payload,
          configuration: this.selectedPool?.ha_configuration || {},
        });
        this.selectedPool = { ...this.selectedPool, ...(record || {}) };
        this.pools = this.pools.map((entry) => (entry.ref === this.selectedPool.ref ? { ...entry, ...(record || {}) } : entry));
        this.poolActionMessage = buildPoolHaSavedMessage(record, payload, this.selectedPool, wasEnabled);
      } catch (error) {
        this.poolActionError = error.message || 'Unable to update pool HA state';
      } finally {
        this.poolHaSaving = false;
      }
    },
    resolveStorageLabel(ref) {
      return resolvePoolStorageLabel(this.storage, ref);
    },
    findPoolByFocus(focus) {
      return findPoolByFocus(this.pools, focus);
    },
    async syncRouteFocus() {
      const focus = getRouteFocus(this.$route.query);
      if (!focus || (focus.kind && focus.kind !== 'pool')) {
        this.lastAppliedFocusKey = '';
        return;
      }

      if (this.loading || !this.pools.length) return;

      const key = getRouteFocusKey(focus);
      if (this.lastAppliedFocusKey === key) return;

      const match = this.findPoolByFocus(focus);
      if (!match) return;

      this.openProperties(match);
      this.lastAppliedFocusKey = key;
    },
    async syncPendingConnectionTarget() {
      const connectionId = Number(this.$route.query.connectionId || 0);
      if (!connectionId) return;
      const connection = this.connections.find((entry) => Number(entry.id) === connectionId);
      if (!connection || this.isCurrentConnection(connection)) return;

      if (this.isConnectionAttached(connection)) {
        await this.activateConnection(connection);
        return;
      }

      if (!this.showConnectDialogWindow || Number(this.connectTarget?.id || 0) !== connectionId) {
        this.openConnectDialog(connection);
      }
    },
    syncRegistrationIntent() {
      if (String(this.$route.query.register || '').trim() !== '1') return;
      if (this.showRegistration) return;
      this.openRegistration();
    },
    async navigateToPendingReturn() {
      const returnTo = String(this.$route.query.returnTo || '').trim();
      if (returnTo && returnTo !== this.$route.path) {
        await this.$router.push(returnTo);
      }
    },
    isPoolMaster(host, pool) {
      return isPoolMasterHost(host, pool);
    },
    resolvePoolHosts(pool) {
      return resolvePoolHosts(pool, this.hosts, this.pools);
    },
    openRegistration(connection = null) {
      this.connectionError = null;
      this.editingConnectionId = connection?.id || null;
      this.connectionDraft = buildPoolConnectionDraft(connection, Boolean(store.user));
      this.showRegistration = true;
    },
    async submitConnection(payload) {
      this.connectionError = null;
      try {
        if (this.editingConnectionId) {
          await api.updateConnection(this.editingConnectionId, payload);
        } else {
          await api.saveConnection(payload);
        }
        this.showRegistration = false;
        await this.loadConnections();
      } catch (error) {
        this.connectionError = error.message || 'Unable to save pool target';
      }
    },
    async makeDefault(id) {
      try {
        await api.setDefaultConnection(id);
        await this.loadConnections();
      } catch (error) {
        this.connectionError = error.message || 'Unable to set default pool target';
      }
    },
    async removeConnection(id) {
      const connection = this.connections.find((entry) => Number(entry.id) === Number(id));
      this.connectionError = null;
      try {
        const approvalId = await resolveGovernanceApproval({
          actionKey: 'connection_delete',
          entityType: 'connection',
          entityRef: String(id),
          entityName: connection?.name || connection?.host || `Pool target ${id}`,
          route: '/pools',
        });
        await api.deleteConnection(id, approvalId ? { approvalId } : null);
        await this.loadConnections();
      } catch (error) {
        if (error.code === 'APPROVAL_REQUIRED') {
          this.connectionError = 'Governance approval is required before removing this pool target.';
          await handoffToGovernanceApproval(
            this.$router,
            error.approvalDraft,
            'Approval required before removing this saved pool target.'
          );
          return;
        }
        this.connectionError = error.message || 'Unable to remove pool target';
      }
    },
    openConnectDialog(connection) {
      if (!connection) return;
      this.connectTarget = { ...connection };
      this.connectPassword = '';
      this.connectError = null;
      this.useSavedCredential = Boolean(connection.vault_credential_id);
      this.showConnectDialogWindow = true;
    },
    closeConnectDialog() {
      this.showConnectDialogWindow = false;
      this.connectTarget = null;
      this.connectPassword = '';
      this.connectLoading = false;
      this.connectError = null;
      this.useSavedCredential = false;
    },
    async activateLiveTarget(target) {
      if (!target?.targetKey) return;
      this.connectionError = null;
      try {
        const result = await api.activateLiveTarget({ targetKey: target.targetKey });
        applySessionStatus(result);
        await Promise.all([this.loadPools(), this.loadHosts(), this.loadConnections()]);
      } catch (error) {
        this.connectionError = error.message || 'Unable to activate the selected live target';
      }
    },
    async activateConnection(connection) {
      if (!connection?.id) return;
      this.connectionError = null;
      try {
        const attachedTarget = this.findAttachedTarget(connection);
        const result = await api.activateLiveTarget(
          attachedTarget?.targetKey
            ? { targetKey: attachedTarget.targetKey }
            : { connectionId: Number(connection.id) }
        );
        applySessionStatus(result);
        await Promise.all([this.loadPools(), this.loadHosts(), this.loadConnections()]);
        await this.navigateToPendingReturn();
      } catch (error) {
        this.connectionError = error.message || 'Unable to activate the selected pool target';
      }
    },
    async disconnectLiveTarget(target) {
      if (!target?.targetKey) return;
      this.connectionError = null;
      try {
        const result = await api.detachLiveTarget(target.targetKey);
        applySessionStatus(result);
        await Promise.all([this.loadPools(), this.loadHosts(), this.loadConnections()]);
      } catch (error) {
        this.connectionError = error.message || 'Unable to detach the selected live target';
      }
    },
    async connectTargetSession() {
      if (!this.connectTarget) return;

      this.connectLoading = true;
      this.connectError = null;

      try {
        const result = await api.xenLogin(
          this.connectTarget.host,
          this.connectTarget.username,
          this.useSavedCredential ? '' : this.connectPassword,
          {
            vaultCredentialId: this.useSavedCredential ? this.connectTarget.vault_credential_id : null,
            connectionId: this.connectTarget.id || null,
            connectionName: this.connectTarget.name || '',
            port: this.connectTarget.port || 443,
          }
        );
        applySessionStatus(result);
        this.closeConnectDialog();
        await this.loadAll();
        await this.navigateToPendingReturn();
      } catch (error) {
        this.connectError = error.message || 'Unable to connect to the selected pool target';
      } finally {
        this.connectLoading = false;
      }
    },
  },
};
