const HostsView = {
  components: {
    DataTable,
    StatusBadge,
    FloatingWindow,
    HostPropertiesWindow,
    HostTargetConnectDialog,
    HostTargetsWindow,
    HostWorkspaceDialogs,
    HostRegistrationForm,
  },
  template: `
    <div class="animate-fade-in">
      <div class="section-head">
        <div>
          <h2 class="section-title">
            <span class="mdi mdi-server"></span>
            Hosts
          </h2>
          <p class="section-subtitle">Dense infrastructure inventory with quick-access host details and host-target registration.</p>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-sm" @click="showRegisteredTargetsWindow = true">
            <span class="mdi mdi-server-network-outline"></span>
            Registered Host Targets ({{ hostTargets.length }})
          </button>
          <button class="btn" @click="openRegistration()">
            <span class="mdi mdi-plus"></span>
            Register Host
          </button>
          <button class="btn btn-primary" @click="loadAll">
            <span class="mdi mdi-refresh"></span>
            Refresh
          </button>
        </div>
      </div>

      <div class="dash-card" v-if="selectedHostRows.length" style="margin-bottom:16px">
        <div class="dash-card-label">Batch Host Actions</div>
        <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap">
          <div>
            <strong>{{ selectedHostRows.length }} hosts selected</strong>
            <div class="text-muted mono" style="font-size:11px;margin-top:4px">{{ selectedHostSelectionSummary }}</div>
          </div>
          <div class="dashboard-hero-rail" style="gap:8px">
            <button class="btn btn-sm btn-primary"
                    v-if="selectedHostMaintenanceCounts.ready"
                    :disabled="Boolean(bulkHostActionBusy)"
                    @click="applyBulkHostMaintenance('enter')">
              <span class="mdi mdi-wrench-clock"></span>
              {{ bulkHostActionBusy === 'maintenance-enter' ? 'Applying...' : `Enter Maintenance Selected (${selectedHostMaintenanceCounts.ready})` }}
            </button>
            <button class="btn btn-sm"
                    v-if="selectedHostMaintenanceCounts.maintenance"
                    :disabled="Boolean(bulkHostActionBusy)"
                    @click="applyBulkHostMaintenance('exit')">
              <span class="mdi mdi-playlist-check"></span>
              {{ bulkHostActionBusy === 'maintenance-exit' ? 'Applying...' : `Exit Maintenance Selected (${selectedHostMaintenanceCounts.maintenance})` }}
            </button>
            <button class="btn btn-sm" :disabled="Boolean(bulkHostActionBusy)" @click="clearHostSelection">Clear Selection</button>
          </div>
        </div>
        <div class="form-error" v-if="bulkError" style="text-align:left;margin-top:12px">{{ bulkError }}</div>
      </div>

      <data-table :columns="columns"
                  :data="hosts"
                  :loading="loading"
                  :searchable="true"
                  :selectable="true"
                  :selected-keys="selectedHostRefs"
                  row-key="ref"
                  @selection-change="handleHostSelectionChange"
                  @row-click="openProperties">
        <template #cell-name_label="{ row }">
          <span style="color:var(--text-primary);font-weight:500">{{ row.name_label || 'Unnamed Host' }}</span>
        </template>
        <template #cell-enabled="{ row }">
          <status-badge :status="row.enabled ? 'enabled' : 'disabled'"></status-badge>
        </template>
      </data-table>

      <host-properties-window
        :show="showProps"
        :selected-host="selectedHost"
        :selected-host-pool="selectedHostPool"
        :selected-host-maintenance-mode="selectedHostMaintenanceMode"
        :selected-host-summary-profile="selectedHostSummaryProfile"
        :selected-host-relationship-profile="selectedHostRelationshipProfile"
        :host-action-message="hostActionMessage"
        :action-error="actionError"
        :host-action-busy="hostActionBusy"
        :metrics-loading="metricsLoading"
        :metrics-error="metricsError"
        :host-metrics="hostMetrics"
        :host-metric-history="hostMetricHistory"
        :inventory-loading="inventoryLoading"
        :inventory-error="inventoryError"
        :inventory-columns="inventoryColumns"
        @close="closeHostProperties"
        @open-host-identity="showHostIdentityWindow = true"
        @open-host-context="showHostContextWindow = true"
        @open-host-logging="showHostLoggingWindow = true"
        @open-host-guest-cpu="showHostGuestCpuWindow = true"
        @open-host-scheduler="showHostSchedulerWindow = true"
        @open-host-platform="showHostPlatformWindow = true"
        @enter-maintenance="enterMaintenanceMode"
        @exit-maintenance="exitMaintenanceMode"
        @power-action="powerAction">
      </host-properties-window>

      <host-workspace-dialogs
        :selected-host="selectedHost"
        :selected-host-pool="selectedHostPool"
        :selected-host-summary-profile="selectedHostSummaryProfile"
        :host-config-saving="hostConfigSaving"
        :show-host-identity-window="showHostIdentityWindow"
        :show-host-context-window="showHostContextWindow"
        :show-host-logging-window="showHostLoggingWindow"
        :show-host-guest-cpu-window="showHostGuestCpuWindow"
        :show-host-scheduler-window="showHostSchedulerWindow"
        :show-host-platform-window="showHostPlatformWindow"
        @close-host-identity="showHostIdentityWindow = false"
        @close-host-context="showHostContextWindow = false"
        @close-host-logging="showHostLoggingWindow = false"
        @close-host-guest-cpu="showHostGuestCpuWindow = false"
        @close-host-scheduler="showHostSchedulerWindow = false"
        @close-host-platform="showHostPlatformWindow = false"
        @submit-host-config="submitSelectedHostConfig"
        @submit-host-logging="submitSelectedHostLogging"
        @submit-host-guest-vcpus="submitSelectedHostGuestVcpusParams"
        @submit-host-scheduler="submitSelectedHostSchedGran">
      </host-workspace-dialogs>

      <host-targets-window
        :show="showRegisteredTargetsWindow"
        :host-targets="hostTargets"
        :target-error="targetError"
        :attached-targets="attachedTargets"
        :target-action-busy-id="targetActionBusyId"
        :target-action-busy-kind="targetActionBusyKind"
        @close="showRegisteredTargetsWindow = false"
        @connect="connectHostTarget"
        @activate="activateHostTarget"
        @open-pool="openPoolTarget"
        @edit="openRegistration"
        @remove="removeTarget">
      </host-targets-window>

      <floating-window :show="showRegistration"
                       :title="editingTargetId ? 'Edit Host Target' : 'Register Host Target'"
                       :width="620"
                       :height="620"
                       @close="showRegistration = false">
        <host-registration-form
          :initial-value="hostTargetDraft"
          :pool-options="connections"
          :credential-options="credentials"
          :submit-label="editingTargetId ? 'Update Host Target' : 'Save Host Target'"
          @submit="submitTarget">
        </host-registration-form>
      </floating-window>

      <host-target-connect-dialog
        :show="showHostConnectDialogWindow"
        :connect-target="connectTarget"
        :password="connectPassword"
        :connect-loading="connectLoading"
        :connect-error="connectError"
        :use-saved-credential="useSavedCredential"
        @close="closeHostConnectDialog"
        @submit="connectStandaloneHostTarget"
        @update:password="connectPassword = $event"
        @update:use-saved-credential="useSavedCredential = $event">
      </host-target-connect-dialog>
    </div>
  `,
  data() {
    return {
      store,
      loading: true,
      hosts: [],
      hostTargets: [],
      connections: [],
      credentials: [],
      selectedHost: null,
      showProps: false,
      showHostIdentityWindow: false,
      showHostContextWindow: false,
      showHostLoggingWindow: false,
      showHostGuestCpuWindow: false,
      showHostSchedulerWindow: false,
      showHostPlatformWindow: false,
      showRegisteredTargetsWindow: false,
      showRegistration: false,
      showHostConnectDialogWindow: false,
      editingTargetId: null,
      hostTargetDraft: null,
      metricsLoading: false,
      metricsError: null,
      inventoryLoading: false,
      inventoryError: null,
      targetError: null,
      targetActionBusyId: null,
      targetActionBusyKind: '',
      connectTarget: null,
      connectPassword: '',
      connectLoading: false,
      connectError: null,
      useSavedCredential: false,
      actionError: null,
      hostActionMessage: '',
      hostActionBusy: '',
      hostConfigSaving: false,
      selectedHostRefs: [],
      bulkHostActionBusy: '',
      bulkError: null,
      hostMetrics: {},
      hostMetricHistory: { metrics: [] },
      lastAppliedFocusKey: '',
      relatedPools: [],
      relatedVMs: [],
      relatedStorage: [],
      relatedNetworks: [],
      columns: [
        { key: 'name_label', label: 'Name' },
        { key: 'enabled', label: 'Status' },
        { key: 'address', label: 'Address' },
        { key: 'uuid', label: 'UUID' },
      ],
      inventoryColumns: [
        { key: 'kind', label: 'Kind' },
        { key: 'name', label: 'Name' },
        { key: 'detail', label: 'Detail' },
        { key: 'status', label: 'Status' },
        { key: 'ref', label: 'Reference' },
      ],
    };
  },
  computed: {
    attachedTargets() {
      return Array.isArray(store.connectedTargets) ? store.connectedTargets : [];
    },
    selectedHostRows() {
      return filterSelectedHostRows(this.hosts, this.selectedHostRefs);
    },
    selectedHostMaintenanceCounts() {
      return countSelectedHostMaintenanceStates(this.selectedHostRows);
    },
    selectedHostSelectionSummary() {
      return summarizeSelectedHostMaintenanceStates(this.selectedHostMaintenanceCounts);
    },
    selectedHostPool() {
      return resolveHostPool(this.selectedHost, this.relatedPools);
    },
    selectedHostMaintenanceMode() {
      return resolveHostMaintenanceState(this.selectedHost);
    },
    selectedHostSummaryProfile() {
      return buildSelectedHostSummaryProfile(this.selectedHost);
    },
    selectedHostRelationshipProfile() {
      return buildSelectedHostRelationshipProfile({
        selectedHost: this.selectedHost,
        selectedHostPool: this.selectedHostPool,
        relatedVMs: this.relatedVMs,
        relatedStorage: this.relatedStorage,
        relatedNetworks: this.relatedNetworks,
        metricsLoading: this.metricsLoading,
        hostMetrics: this.hostMetrics,
      });
    },
  },
  async mounted() {
    if (!store.authenticated) {
      this.$router.push('/login');
      return;
    }
    await this.loadAll();
    await this.syncRouteFocus();
  },
  watch: {
    '$route.query': {
      deep: true,
      async handler() {
        await this.syncRouteFocus();
      },
    },
    hosts() {
      const validRefs = new Set(this.hosts.map((host) => host.ref));
      this.selectedHostRefs = this.selectedHostRefs.filter((ref) => validRefs.has(ref));
    },
  },
    methods: {
      formatBytes,
      formatThroughput,
      formatPercent,
      truncateList,
      summarizeCount,
      resolveHostMaintenanceState,
      summarizeHostStringMap,
    async loadAll() {
      await Promise.all([this.loadHosts(), this.loadHostTargets(), this.loadConnections(), this.loadCredentials()]);
    },
    async loadHosts() {
      this.loading = true;
      try {
        const result = await api.getHosts();
        this.hosts = result.data || [];
      } catch (error) {
        console.error(error);
      } finally {
        this.loading = false;
      }
      await this.syncRouteFocus();
    },
    handleHostSelectionChange(keys) {
      this.selectedHostRefs = Array.isArray(keys) ? keys : [];
      this.bulkError = null;
    },
    clearHostSelection() {
      this.selectedHostRefs = [];
      this.bulkError = null;
    },
    async loadHostTargets() {
      try {
        this.hostTargets = await api.getHostTargets();
      } catch (error) {
        this.hostTargets = [];
      }
    },
    async loadConnections() {
      try {
        this.connections = await api.getConnections();
      } catch (error) {
        this.connections = [];
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
    resetHostWorkspaceWindows() {
      this.showHostIdentityWindow = false;
      this.showHostContextWindow = false;
      this.showHostLoggingWindow = false;
      this.showHostGuestCpuWindow = false;
      this.showHostSchedulerWindow = false;
      this.showHostPlatformWindow = false;
    },
    closeHostProperties() {
      this.showProps = false;
      this.resetHostWorkspaceWindows();
    },
    async openProperties(row) {
      this.resetHostWorkspaceWindows();
      this.selectedHost = row;
      this.showProps = true;
      this.actionError = null;
      this.hostActionMessage = '';
      this.hostActionBusy = '';
      this.metricsLoading = true;
      this.metricsError = null;
      this.hostMetrics = {};
      this.hostMetricHistory = { metrics: [] };
      this.inventoryLoading = true;
      this.inventoryError = null;
      this.relatedPools = [];
      this.relatedVMs = [];
      this.relatedStorage = [];
      this.relatedNetworks = [];

      const [metricsResult, metricHistoryResult, poolsResult, vmsResult, storageResult, networksResult] = await Promise.allSettled([
        api.getHostMetrics(row.ref),
        api.getHostMetricHistory(row.ref),
        api.getPools(),
        api.getVMs(),
        api.getSRs(),
        api.getNetworks(),
      ]);

      if (metricsResult.status === 'fulfilled') {
        this.hostMetrics = metricsResult.value;
      } else {
        this.metricsError = metricsResult.reason?.message || 'Unable to load metrics';
      }
      if (metricHistoryResult.status === 'fulfilled') {
        this.hostMetricHistory = metricHistoryResult.value;
      }
      this.metricsLoading = false;

      if (poolsResult.status === 'fulfilled') {
        this.relatedPools = poolsResult.value.data || [];
      }
      if (vmsResult.status === 'fulfilled') {
        this.relatedVMs = vmsResult.value.data || [];
      }
      if (storageResult.status === 'fulfilled') {
        this.relatedStorage = storageResult.value.data || [];
      }
      if (networksResult.status === 'fulfilled') {
        this.relatedNetworks = networksResult.value.data || [];
      }

      if (
        poolsResult.status === 'rejected' &&
        vmsResult.status === 'rejected' &&
        storageResult.status === 'rejected' &&
        networksResult.status === 'rejected'
      ) {
        this.inventoryError = 'Unable to map related pool and host inventory.';
      }

      this.inventoryLoading = false;
    },
    async refreshSelectedHost() {
      if (!this.selectedHost?.ref) return;
      await this.loadHosts();
      const updated = this.hosts.find((host) => host.ref === this.selectedHost.ref);
      if (updated) {
        await this.openProperties(updated);
      }
    },
    applySelectedHostRecord(record) {
      this.selectedHost = { ...this.selectedHost, ...(record || {}) };
      this.hosts = this.hosts.map((entry) => (entry.ref === this.selectedHost.ref ? { ...entry, ...(record || {}) } : entry));
    },
    async submitSelectedHostConfig(payload) {
      if (!this.selectedHost?.ref) return;

      this.actionError = null;
      this.hostActionMessage = '';
      this.hostConfigSaving = true;
      try {
        const record = await api.updateHostConfig(this.selectedHost.ref, payload);
        this.applySelectedHostRecord(record);
        this.hostActionMessage = `${record?.name_label || payload.nameLabel || this.selectedHost.ref} metadata was updated.`;
      } catch (error) {
        this.actionError = error.message || 'Unable to save host metadata.';
      } finally {
        this.hostConfigSaving = false;
      }
    },
    async submitSelectedHostLogging(payload) {
      if (!this.selectedHost?.ref) return;

      this.actionError = null;
      this.hostActionMessage = '';
      this.hostConfigSaving = true;
      try {
        const record = await api.updateHostConfig(this.selectedHost.ref, {
          nameLabel: this.selectedHost.name_label || this.selectedHost.hostname || this.selectedHost.ref,
          nameDescription: this.selectedHost.name_description || '',
          logging: payload.logging || {},
        });
        this.applySelectedHostRecord(record);
        this.hostActionMessage = `${record?.name_label || this.selectedHost.ref} logging configuration was updated.`;
      } catch (error) {
        this.actionError = error.message || 'Unable to save host logging.';
      } finally {
        this.hostConfigSaving = false;
      }
    },
    async submitSelectedHostGuestVcpusParams(payload) {
      if (!this.selectedHost?.ref) return;

      this.actionError = null;
      this.hostActionMessage = '';
      this.hostConfigSaving = true;
      try {
        const record = await api.updateHostConfig(this.selectedHost.ref, {
          nameLabel: this.selectedHost.name_label || this.selectedHost.hostname || this.selectedHost.ref,
          nameDescription: this.selectedHost.name_description || '',
          tags: Array.isArray(this.selectedHost.tags) ? this.selectedHost.tags : [],
          guestVcpusParams: payload.guestVcpusParams || {},
        });
        this.applySelectedHostRecord(record);
        this.hostActionMessage = `${record?.name_label || this.selectedHost.ref} guest VCPU policy was updated.`;
      } catch (error) {
        this.actionError = error.message || 'Unable to save host guest VCPU parameters.';
      } finally {
        this.hostConfigSaving = false;
      }
    },
    async submitSelectedHostSchedGran(payload) {
      if (!this.selectedHost?.ref) return;

      this.actionError = null;
      this.hostActionMessage = '';
      this.hostConfigSaving = true;
      try {
        const record = await api.updateHostConfig(this.selectedHost.ref, {
          nameLabel: this.selectedHost.name_label || this.selectedHost.hostname || this.selectedHost.ref,
          nameDescription: this.selectedHost.name_description || '',
          tags: Array.isArray(this.selectedHost.tags) ? this.selectedHost.tags : [],
          schedGran: payload.schedGran || 'cpu',
        });
        this.applySelectedHostRecord(record);
        this.hostActionMessage = `${record?.name_label || this.selectedHost.ref} scheduler policy was updated.`;
      } catch (error) {
        this.actionError = error.message || 'Unable to save host scheduler policy.';
      } finally {
        this.hostConfigSaving = false;
      }
    },
    async syncRouteFocus() {
      const focus = getRouteFocus(this.$route.query);
      if (!focus || (focus.kind && focus.kind !== 'host')) {
        this.lastAppliedFocusKey = '';
        return;
      }

      if (this.loading || !this.hosts.length) return;

      const key = getRouteFocusKey(focus);
      if (this.lastAppliedFocusKey === key) return;

      const match = findHostByFocus(this.hosts, focus);
      if (!match) return;

      await this.openProperties(match);
      this.lastAppliedFocusKey = key;
    },
    async resolveHostGovernanceApproval(actionKey) {
      if (!this.selectedHost?.ref) return '';
      return resolveGovernanceApproval({
        actionKey,
        entityType: 'host',
        entityRef: this.selectedHost.ref,
        entityName: this.selectedHost.name_label || this.selectedHost.hostname || this.selectedHost.ref,
        route: '/hosts',
      });
    },
    async ensureHostBatchContext() {
      if (this.relatedPools.length) return;
      try {
        const pools = await api.getPools();
        this.relatedPools = pools.data || [];
      } catch (_error) {
        this.relatedPools = [];
      }
    },
    getEligibleBatchHosts(mode) {
      if (mode === 'enter') {
        return this.selectedHostRows.filter((host) => !resolveHostMaintenanceState(host));
      }
      if (mode === 'exit') {
        return this.selectedHostRows.filter((host) => resolveHostMaintenanceState(host));
      }
      return [];
    },
    buildBulkHostMaintenancePayload(host) {
      const pool = resolveHostPool(host, this.relatedPools);
      return {
        networkRef: pool?.migration_network || '',
        evacuateBatchSize: 0,
        evacuateRunningVms: true,
      };
    },
    async applyBulkHostMaintenance(mode) {
      const targets = this.getEligibleBatchHosts(mode);
      if (!targets.length) {
        this.bulkError = `No selected hosts are currently eligible for maintenance ${mode}.`;
        return;
      }

      await this.ensureHostBatchContext();
      this.bulkError = null;
      this.bulkHostActionBusy = mode === 'enter' ? 'maintenance-enter' : 'maintenance-exit';
      let completed = 0;

      try {
        for (const host of targets) {
          try {
            if (mode === 'enter') {
              await api.enterHostMaintenance(host.ref, this.buildBulkHostMaintenancePayload(host));
            } else {
              await api.exitHostMaintenance(host.ref);
            }
            completed += 1;
          } catch (error) {
            this.bulkError = completed
              ? `Processed ${completed} host(s) before stopping: ${error.message || 'Unable to continue the batch maintenance action.'}`
              : (error.message || 'Unable to continue the batch maintenance action.');
            return;
          }
        }
      } finally {
        this.bulkHostActionBusy = '';
      }

      await this.loadHosts();

      if (this.selectedHost?.ref && targets.some((host) => host.ref === this.selectedHost.ref)) {
        await this.refreshSelectedHost();
      }
    },
    async enterMaintenanceMode(payload) {
      if (!this.selectedHost?.ref) return;

      this.actionError = null;
      this.hostActionMessage = '';
      this.hostActionBusy = 'maintenance-enter';
      try {
        await api.enterHostMaintenance(this.selectedHost.ref, payload);
        await this.refreshSelectedHost();
      } catch (error) {
        this.actionError = error.message || 'Unable to enter maintenance mode.';
      } finally {
        this.hostActionBusy = '';
      }
    },
    async exitMaintenanceMode() {
      if (!this.selectedHost?.ref) return;

      this.actionError = null;
      this.hostActionMessage = '';
      this.hostActionBusy = 'maintenance-exit';
      try {
        await api.exitHostMaintenance(this.selectedHost.ref);
        await this.refreshSelectedHost();
      } catch (error) {
        this.actionError = error.message || 'Unable to exit maintenance mode.';
      } finally {
        this.hostActionBusy = '';
      }
    },
    async powerAction(action) {
      if (!this.selectedHost?.ref) return;

      this.actionError = null;
      this.hostActionMessage = '';
      this.hostActionBusy = action;
      const actionKey = action === 'shutdown' ? 'host_shutdown' : 'host_reboot';

      try {
        const approvalId = await this.resolveHostGovernanceApproval(actionKey);
        if (action === 'shutdown') {
          await api.shutdownHost(this.selectedHost.ref, approvalId ? { approvalId } : {});
        } else {
          await api.rebootHost(this.selectedHost.ref, approvalId ? { approvalId } : {});
        }
        await this.refreshSelectedHost();
      } catch (error) {
        if (error.code === 'APPROVAL_REQUIRED') {
          this.actionError = `Governance approval is required before continuing this host ${action}.`;
          await handoffToGovernanceApproval(
            this.$router,
            error.approvalDraft,
            `Approval required before continuing this host ${action}.`
          );
          return;
        }
        this.actionError = error.message || `Unable to ${action} host.`;
      } finally {
        this.hostActionBusy = '';
      }
    },
    openRegistration(target = null) {
      this.targetError = null;
      this.editingTargetId = target?.id || null;
      this.hostTargetDraft = target ? { ...target } : {
        name: '',
        host: '',
        username: 'root',
        vault_credential_id: null,
        port: 443,
        mode: 'standalone',
        pool_connection_id: this.connections[0]?.id || null,
        notes: '',
        visibility: store.user ? 'private' : 'shared',
      };
      this.showRegistration = true;
    },
    openHostConnectDialog(target) {
      if (!target) return;
      this.connectTarget = { ...target };
      this.connectPassword = '';
      this.connectError = null;
      this.connectLoading = false;
      this.useSavedCredential = Boolean(target.vault_credential_id);
      this.showHostConnectDialogWindow = true;
    },
    closeHostConnectDialog() {
      this.showHostConnectDialogWindow = false;
      this.connectTarget = null;
      this.connectPassword = '';
      this.connectLoading = false;
      this.connectError = null;
      this.useSavedCredential = false;
    },
    async submitTarget(payload) {
      this.targetError = null;
      try {
        const attachAfterSave = Boolean(payload.attachAfterSave);
        const requestPayload = { ...payload };
        delete requestPayload.attachAfterSave;

        let savedTarget;
        if (this.editingTargetId) {
          savedTarget = await api.updateHostTarget(this.editingTargetId, requestPayload);
        } else {
          savedTarget = await api.saveHostTarget(requestPayload);
        }
        this.showRegistration = false;
        await this.loadHostTargets();
        if (attachAfterSave && savedTarget?.mode === 'standalone') {
          await this.connectHostTarget(savedTarget);
        }
      } catch (error) {
        this.targetError = error.message || 'Unable to save host target';
      }
    },
    async connectHostTarget(target) {
      if (!target) return;
      if (target.mode === 'pool-member') {
        await this.openPoolTarget(target);
        return;
      }

      this.targetError = null;
      this.targetActionBusyId = target.id;
      this.targetActionBusyKind = 'connect';

      try {
        if (target.vault_credential_id) {
          const result = await api.xenLogin(target.host, target.username, '', {
            vaultCredentialId: target.vault_credential_id,
            connectionName: target.name || '',
            port: target.port || 443,
          });
          applySessionStatus(result);
          await this.loadAll();
          return;
        }

        this.openHostConnectDialog(target);
      } catch (error) {
        this.targetError = error.message || 'Unable to connect the selected host target';
      } finally {
        this.targetActionBusyId = null;
        this.targetActionBusyKind = '';
      }
    },
    async connectStandaloneHostTarget() {
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
            connectionName: this.connectTarget.name || '',
            port: this.connectTarget.port || 443,
          }
        );
        applySessionStatus(result);
        this.closeHostConnectDialog();
        await this.loadAll();
      } catch (error) {
        this.connectError = error.message || 'Unable to connect the selected host target';
      } finally {
        this.connectLoading = false;
      }
    },
    async activateHostTarget(target) {
      const attachedTarget = findAttachedHostTarget(this.attachedTargets, target);
      if (!attachedTarget?.targetKey) return;

      this.targetError = null;
      this.targetActionBusyId = target.id;
      this.targetActionBusyKind = 'activate';

      try {
        const result = await api.activateLiveTarget({ targetKey: attachedTarget.targetKey });
        applySessionStatus(result);
        await this.loadAll();
      } catch (error) {
        this.targetError = error.message || 'Unable to activate the selected host target';
      } finally {
        this.targetActionBusyId = null;
        this.targetActionBusyKind = '';
      }
    },
    async openPoolTarget(target) {
      if (!target?.pool_connection_id) {
        this.targetError = 'This host target is not linked to a saved pool target yet.';
        return;
      }
      await this.$router.push({
        path: '/pools',
        query: {
          connectionId: String(target.pool_connection_id),
          returnTo: '/hosts',
        },
      });
    },
    async removeTarget(id) {
      const target = this.hostTargets.find((entry) => Number(entry.id) === Number(id));
      this.targetError = null;
      try {
        const approvalId = await resolveGovernanceApproval({
          actionKey: 'host_target_delete',
          entityType: 'host-target',
          entityRef: String(id),
          entityName: target?.name || target?.host || `Host target ${id}`,
          route: '/hosts',
        });
        await api.deleteHostTarget(id, approvalId ? { approvalId } : null);
        await this.loadHostTargets();
      } catch (error) {
        if (error.code === 'APPROVAL_REQUIRED') {
          this.targetError = 'Governance approval is required before removing this host target.';
          await handoffToGovernanceApproval(
            this.$router,
            error.approvalDraft,
            'Approval required before removing this saved host target.'
          );
          return;
        }
        this.targetError = error.message || 'Unable to remove host target';
      }
    },
  },
};
