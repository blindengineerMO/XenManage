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
                  empty-message="No hosts connected. Connect to a XenServer pool to get started."
                  empty-icon="mdi-server"
                  @selection-change="handleHostSelectionChange"
                  @cell-edit="saveInlineHostEdit"
                  @row-click="openProperties">
        <template #empty-action>
          <button class="btn btn-sm btn-primary" @click="$router.push('/pools')">Go to Pools</button>
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
        @power-action="powerAction"
        @toggle-multipathing="toggleHostMultipathing">
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
      ...createHostsViewState(),
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
        this.hosts = await loadHostRecords(api);
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
        this.hostTargets = await loadHostTargetRecords(api);
      } catch (error) {
        this.hostTargets = [];
      }
    },
    async loadConnections() {
      try {
        this.connections = await loadHostConnectionRecords(api);
      } catch (error) {
        this.connections = [];
      }
    },
    async loadCredentials() {
      try {
        this.credentials = await loadHostCredentialRecords(api);
      } catch (error) {
        this.credentials = [];
      }
    },
    resetHostWorkspaceWindows() {
      Object.assign(this, buildHostWorkspaceWindowResetState());
    },
    closeHostProperties() {
      Object.assign(this, buildHostPropertiesClosedState());
    },
    async openProperties(row) {
      Object.assign(this, buildHostPropertiesWorkspaceState(row));
      const detailContext = await loadHostDetailContext(api, row);
      Object.assign(this, buildHostDetailWorkspaceState(detailContext));
      Object.assign(this, buildHostDetailLoadingCompleteState());
    },
    async refreshSelectedHost() {
      if (!this.selectedHost?.ref) return;
      const selectedHostRef = this.selectedHost.ref;
      await this.loadHosts();
      const updated = findRefreshedHostRecord(this.hosts, selectedHostRef);
      if (updated) {
        await this.openProperties(updated);
      }
    },
    applySelectedHostRecord(record) {
      this.selectedHost = { ...this.selectedHost, ...(record || {}) };
      this.hosts = this.hosts.map((entry) => (entry.ref === this.selectedHost.ref ? { ...entry, ...(record || {}) } : entry));
    },
    async saveInlineHostEdit({ row, key, value }) {
      if (!['name_label', 'name_description'].includes(key) || !row?.ref) return;

      this.actionError = null;
      this.hostActionMessage = '';
      try {
        const record = await api.updateHostConfig(row.ref, {
          nameLabel: key === 'name_label' ? value : (row.name_label || ''),
          nameDescription: key === 'name_description' ? value : (row.name_description || ''),
          tags: Array.isArray(row.tags) ? row.tags : [],
          guestVcpusParams: row.guest_VCPUs_params || {},
          schedGran: row.sched_gran || undefined,
          logging: row.logging || {},
        });
        this.hosts = this.hosts.map((entry) => (entry.ref === row.ref ? { ...entry, ...record } : entry));
        if (this.selectedHost?.ref === row.ref) this.selectedHost = { ...this.selectedHost, ...record };
        this.hostActionMessage = key === 'name_label' ? `${record?.name_label || value} was renamed.` : 'Description was updated.';
      } catch (error) {
        this.actionError = error.message || 'Unable to update the host inline.';
      }
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
        const record = await api.updateHostConfig(this.selectedHost.ref, buildHostLoggingUpdatePayload(this.selectedHost, payload));
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
        const record = await api.updateHostConfig(this.selectedHost.ref, buildHostGuestVcpusUpdatePayload(this.selectedHost, payload));
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
        const record = await api.updateHostConfig(this.selectedHost.ref, buildHostSchedulerUpdatePayload(this.selectedHost, payload));
        this.applySelectedHostRecord(record);
        this.hostActionMessage = `${record?.name_label || this.selectedHost.ref} scheduler policy was updated.`;
      } catch (error) {
        this.actionError = error.message || 'Unable to save host scheduler policy.';
      } finally {
        this.hostConfigSaving = false;
      }
    },
    async syncRouteFocus() {
      const nextState = await syncHostRouteFocusWorkflow({
        routeQuery: this.$route.query,
        loading: this.loading,
        hosts: this.hosts,
        lastAppliedFocusKey: this.lastAppliedFocusKey,
        openProperties: this.openProperties,
      });
      Object.assign(this, nextState);
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
    async toggleHostMultipathing(enabled) {
      if (!this.selectedHost?.ref) return;

      const confirmed = await requestGlobalConfirm({
        title: `${enabled ? 'Enable' : 'Disable'} Multipathing`,
        message: `${enabled ? 'Enable' : 'Disable'} storage multipathing on ${this.selectedHost.name_label || this.selectedHost.ref}? Every storage path on this host will be unplugged and replugged.`,
        confirmLabel: enabled ? 'Enable Multipathing' : 'Disable Multipathing',
        danger: true,
      });
      if (!confirmed) return;

      this.actionError = null;
      this.hostActionMessage = '';
      this.hostActionBusy = enabled ? 'multipath-enable' : 'multipath-disable';
      try {
        const approvalId = await this.resolveHostGovernanceApproval('host_multipathing_update');
        await api.setHostMultipathing(this.selectedHost.ref, { enabled, approvalId: approvalId || undefined });
        this.hostActionMessage = `${this.selectedHost.name_label || this.selectedHost.ref} multipathing was ${enabled ? 'enabled' : 'disabled'}.`;
        await this.refreshSelectedHost();
      } catch (error) {
        if (error.code === 'APPROVAL_REQUIRED') {
          this.actionError = 'Governance approval is required before changing storage multipathing.';
          await handoffToGovernanceApproval(
            this.$router,
            error.approvalDraft,
            'Approval required before changing storage multipathing.'
          );
          return;
        }
        this.actionError = error.message || 'Unable to update storage multipathing.';
      } finally {
        this.hostActionBusy = '';
      }
    },
    openRegistration(target = null) {
      Object.assign(this, buildHostRegistrationOpenState(target, this.connections, store.user));
    },
    openHostConnectDialog(target) {
      if (!target) return;
      Object.assign(this, buildHostConnectDialogOpenState(target));
    },
    closeHostConnectDialog() {
      Object.assign(this, buildHostConnectDialogClosedState());
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
            hostTargetId: target.id,
            connectionName: target.name || '',
            port: target.port || 443,
          });
          applySessionStatus(result);
          this.showRegisteredTargetsWindow = false;
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
            hostTargetId: this.connectTarget.id,
            connectionName: this.connectTarget.name || '',
            port: this.connectTarget.port || 443,
          }
        );
        applySessionStatus(result);
        this.closeHostConnectDialog();
        this.showRegisteredTargetsWindow = false;
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
