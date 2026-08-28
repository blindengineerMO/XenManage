const PoolsView = {
  components: { DataTable, FloatingWindow, PoolRegistrationForm, PoolConfigForm, PoolHaForm, StatusBadge },
  template: `
    <div class="animate-fade-in">
      <div class="section-head">
        <div>
          <h2 class="section-title">
            <span class="mdi mdi-cluster"></span>
            Pools
          </h2>
          <p class="section-subtitle">Live pool topology plus registered pool targets for multi-pool administration.</p>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn" @click="openRegistration()">
            <span class="mdi mdi-plus"></span>
            Register Pool
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
            <button class="btn" @click="openRegistration()">
              <span class="mdi mdi-plus"></span>
              Register Another Pool
            </button>
          </div>
          <div class="form-error" v-if="liveDataError" style="text-align:left;margin-top:12px">{{ liveDataError }}</div>
        </div>

        <div class="dash-card" v-if="attachedTargets.length">
          <div class="dash-card-label">Attached Live Targets</div>
          <div class="stack-list">
            <div class="stack-item" v-for="target in attachedTargets" :key="target.targetKey">
              <div>
                <strong>{{ target.connectionName || target.host }}</strong>
                <div class="text-muted mono" style="font-size:11px">{{ target.host }} · {{ target.username }} · :{{ target.port || 443 }}</div>
                <div class="text-muted" style="font-size:12px;margin-top:6px">
                  Attached {{ formatDateTime(target.connectedAt) }}
                  <span v-if="target.lastActivatedAt"> · active since {{ formatDateTime(target.lastActivatedAt) }}</span>
                </div>
              </div>
              <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;justify-content:flex-end">
                <status-badge :status="target.active ? 'connected' : 'success'"></status-badge>
                <button class="btn btn-sm" v-if="!target.active" @click="activateLiveTarget(target)">
                  <span class="mdi mdi-target"></span>
                  Activate
                </button>
                <button class="btn btn-sm" @click="disconnectLiveTarget(target)">
                  <span class="mdi mdi-link-variant-remove"></span>
                  Detach
                </button>
              </div>
            </div>
          </div>
        </div>

        <div class="dash-card">
          <div class="dash-card-label">Registered Pool Targets</div>
          <div class="stack-list" v-if="connections.length">
            <div class="stack-item" v-for="connection in connections" :key="connection.id">
              <div>
                <strong>{{ connection.name }}</strong>
                <div class="text-muted mono" style="font-size:11px">{{ connection.host }} · {{ connection.username }} · :{{ connection.port || 443 }}</div>
                <div class="text-muted" style="font-size:12px;margin-top:6px">
                  {{ connection.is_default ? 'Default saved target' : 'Saved pool target' }}
                  <span v-if="isCurrentConnection(connection)"> · connected now</span>
                  <span v-else-if="isConnectionAttached(connection)"> · attached in session</span>
                  <span v-if="connection.vault_credential_id"> · vault credential linked</span>
                </div>
                <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
                  <span class="badge" :class="connection.visibility === 'shared' ? 'badge-info' : 'badge-success'">{{ visibilityLabel(connection.visibility) }}</span>
                  <span class="badge badge-info" v-if="connection.owner_display_name || connection.owner_username">{{ ownershipLabel(connection) }}</span>
                </div>
              </div>
              <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;justify-content:flex-end">
                <status-badge :status="isCurrentConnection(connection) ? 'connected' : (isConnectionAttached(connection) ? 'success' : (connection.is_default ? 'success' : 'notice'))"></status-badge>
                <button class="btn btn-sm"
                        v-if="!isConnectionAttached(connection)"
                        @click="openConnectDialog(connection)">
                  <span class="mdi mdi-connection"></span>
                  Connect
                </button>
                <button class="btn btn-sm"
                        v-if="isConnectionAttached(connection) && !isCurrentConnection(connection)"
                        @click="activateConnection(connection)">
                  <span class="mdi mdi-target"></span>
                  Activate
                </button>
                <button class="btn btn-sm" v-if="connection.can_manage !== false" @click="openRegistration(connection)">
                  <span class="mdi mdi-pencil-outline"></span>
                </button>
                <button class="btn btn-sm" v-if="!connection.is_default && connection.can_manage !== false" @click="makeDefault(connection.id)">
                  <span class="mdi mdi-star-outline"></span>
                </button>
                <button class="btn btn-sm" v-if="connection.can_manage !== false" @click="removeConnection(connection.id)">
                  <span class="mdi mdi-delete-outline"></span>
                </button>
              </div>
            </div>
          </div>
          <div v-else class="empty-state" style="padding:18px 12px">Register pool targets here for future logins and multi-pool operations.</div>
          <div class="form-error" v-if="connectionError" style="text-align:left">{{ connectionError }}</div>
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

      <floating-window :show="showProps" title="Pool Properties" :width="820" :height="560" @close="showProps = false">
        <div v-if="selectedPool">
          <div class="property-grid">
            <span class="text-muted">Name</span><span>{{ selectedPool.name_label || '-' }}</span>
            <span class="text-muted">Description</span><span>{{ selectedPool.name_description || '-' }}</span>
            <span class="text-muted">UUID</span><span class="mono property-wrap">{{ selectedPool.uuid || '-' }}</span>
            <span class="text-muted">Default SR</span><span class="mono property-wrap">{{ selectedPoolDefaultStorageLabel }}</span>
            <span class="text-muted">Migration Compression</span><span>{{ selectedPoolMigrationCompressionLabel }}</span>
            <span class="text-muted">WLB Enabled</span><span>{{ selectedPoolWlbEnabledLabel }}</span>
            <span class="text-muted">WLB URL</span><span class="mono property-wrap">{{ selectedPoolWlbUrlLabel }}</span>
            <span class="text-muted">vSwitch Controller</span><span class="mono property-wrap">{{ selectedPoolVswitchControllerLabel }}</span>
            <span class="text-muted">IGMP Snooping</span><span>{{ selectedPoolIgmpSnoopingLabel }}</span>
            <span class="text-muted">Migration Network</span><span class="mono property-wrap">{{ selectedPool.migration_network || '-' }}</span>
            <span class="text-muted">Master Host</span><span class="mono property-wrap">{{ selectedPool.master || '-' }}</span>
            <span class="text-muted">Host Count</span><span>{{ summarizeCount('hosts', selectedPoolHosts.length) }}</span>
            <span class="text-muted">HA Enabled</span><span>{{ selectedPoolHaEnabledLabel }}</span>
            <span class="text-muted">HA Tolerance</span><span>{{ selectedPoolHaToleranceLabel }}</span>
            <span class="text-muted">Tags</span><span>{{ truncateList(selectedPool.tags) }}</span>
            <span class="text-muted">Other Config</span><span class="mono property-wrap">{{ selectedPoolOtherConfigSummary }}</span>
          </div>

          <div class="detail-section">
            <div class="detail-section-title">Pool Metadata</div>
            <div class="dashboard-panels">
              <div class="dash-card">
                <div class="dash-card-label">Pool Identity</div>
                <p class="text-muted" style="margin-bottom:12px">Update the operator-facing pool name and description without leaving the pool detail workspace.</p>
                <pool-config-form
                  :initial-value="selectedPool"
                  :storage-options="selectedPoolStorageOptions"
                  :submit-label="'Save Pool Metadata'"
                  :saving="poolConfigSaving"
                  @submit="submitSelectedPoolConfig">
                </pool-config-form>
              </div>

              <div class="dash-card">
                <div class="dash-card-label">Pool Context</div>
                <div class="stack-list">
                  <div class="stack-item">
                    <div>
                      <strong>{{ selectedPool.name_label || 'Selected pool' }}</strong>
                      <div class="text-muted mono" style="font-size:11px">
                        {{ selectedPool.uuid || selectedPool.ref || 'pool ref unavailable' }}
                      </div>
                    </div>
                    <span class="badge badge-info">{{ summarizeCount('hosts', selectedPoolHosts.length) }}</span>
                  </div>
                  <div class="stack-item">
                    <div>
                      <strong>Default SR</strong>
                      <div class="text-muted mono" style="font-size:11px">{{ selectedPoolDefaultStorageLabel }}</div>
                    </div>
                    <span class="badge badge-info">sr</span>
                  </div>
                  <div class="stack-item">
                    <div>
                      <strong>Migration Compression</strong>
                      <div class="text-muted mono" style="font-size:11px">{{ selectedPoolMigrationCompressionDetail }}</div>
                    </div>
                    <span class="badge" :class="selectedPool?.migration_compression ? 'badge-success' : 'badge-warning'">
                      {{ selectedPoolMigrationCompressionLabel }}
                    </span>
                  </div>
                  <div class="stack-item">
                    <div>
                      <strong>Workload Balancing</strong>
                      <div class="text-muted mono" style="font-size:11px">{{ selectedPoolWlbDetail }}</div>
                    </div>
                    <span class="badge" :class="selectedPool?.wlb_enabled ? 'badge-success' : 'badge-warning'">
                      {{ selectedPoolWlbEnabledLabel }}
                    </span>
                  </div>
                  <div class="stack-item">
                    <div>
                      <strong>Legacy vSwitch Controller</strong>
                      <div class="text-muted mono" style="font-size:11px">{{ selectedPoolVswitchControllerDetail }}</div>
                    </div>
                    <span class="badge" :class="selectedPoolVswitchControllerConfigured ? 'badge-warning' : 'badge-info'">
                      {{ selectedPoolVswitchControllerConfigured ? 'legacy' : 'none' }}
                    </span>
                  </div>
                  <div class="stack-item">
                    <div>
                      <strong>IGMP Snooping</strong>
                      <div class="text-muted mono" style="font-size:11px">{{ selectedPoolIgmpSnoopingDetail }}</div>
                    </div>
                    <span class="badge" :class="selectedPool?.IGMP_snooping_enabled ? 'badge-success' : 'badge-warning'">
                      {{ selectedPoolIgmpSnoopingLabel }}
                    </span>
                  </div>
                  <div class="stack-item">
                    <div>
                      <strong>Migration Network</strong>
                      <div class="text-muted mono" style="font-size:11px">{{ selectedPool.migration_network || 'not configured' }}</div>
                    </div>
                    <span class="badge badge-info">network</span>
                  </div>
                  <div class="stack-item">
                    <div>
                      <strong>Pool other_config</strong>
                      <div class="text-muted mono" style="font-size:11px">{{ selectedPoolOtherConfigSummary }}</div>
                    </div>
                    <span class="badge badge-info">{{ selectedPoolOtherConfigEntries.length }}</span>
                  </div>
                </div>
                <p class="text-muted" style="margin:0">Deeper SDN controller lifecycle workflows and richer WLB enrollment still remain follow-on parity work.</p>
              </div>
            </div>
            <div class="dashboard-panels" style="margin-top:16px">
              <div class="dash-card">
                <div class="dash-card-label">High Availability</div>
                <div class="stack-list" style="margin-bottom:12px">
                  <div class="stack-item">
                    <div>
                      <strong>Status</strong>
                      <div class="text-muted mono" style="font-size:11px">{{ selectedPoolHaStatusDetail }}</div>
                    </div>
                    <span class="badge" :class="selectedPool?.ha_enabled ? 'badge-success' : 'badge-warning'">
                      {{ selectedPoolHaEnabledLabel }}
                    </span>
                  </div>
                  <div class="stack-item">
                    <div>
                      <strong>Failover Planner</strong>
                      <div class="text-muted mono" style="font-size:11px">{{ selectedPoolHaPlannerDetail }}</div>
                    </div>
                    <span class="badge badge-info">{{ selectedPool?.ha_plan_exists_for || 0 }}</span>
                  </div>
                </div>
                <pool-ha-form
                  :initial-value="selectedPool"
                  :storage-options="selectedPoolStorageOptions"
                  :saving="poolHaSaving"
                  :submit-label="selectedPool?.ha_enabled ? 'Save HA Settings' : 'Enable HA'"
                  @submit="submitSelectedPoolHaState">
                </pool-ha-form>
              </div>
            </div>
            <div class="stack-item" v-if="poolActionMessage" style="margin-top:12px">
              <div>
                <strong>Pool operation completed</strong>
                <div class="text-muted mono" style="font-size:11px">{{ poolActionMessage }}</div>
              </div>
            </div>
            <div class="form-error" v-if="poolActionError" style="text-align:left;margin-top:12px">{{ poolActionError }}</div>
          </div>

          <div class="detail-section">
            <div class="detail-section-title">Associated Hosts</div>
            <data-table :columns="poolHostColumns" :data="selectedPoolHosts" :loading="loading" :searchable="false">
              <template #cell-name_label="{ row }">
                <span style="color:var(--text-primary);font-weight:500">{{ row.name_label || row.hostname || 'Unnamed Host' }}</span>
              </template>
              <template #cell-role="{ row }">
                <span class="badge" :class="row.role === 'Master' ? 'badge-info' : 'badge-success'">{{ row.role }}</span>
              </template>
              <template #cell-enabled="{ row }">
                <status-badge :status="row.enabled ? 'enabled' : 'disabled'"></status-badge>
              </template>
              <template #cell-residentVmCount="{ row }">
                <span class="mono">{{ row.residentVmCount }}</span>
              </template>
              <template #cell-tags="{ row }">
                <span class="mono">{{ truncateList(row.tags) }}</span>
              </template>
            </data-table>
          </div>
        </div>
      </floating-window>

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

      <floating-window :show="showConnectDialogWindow"
                       title="Connect to Pool Target"
                       :width="460"
                       :height="360"
                       @close="closeConnectDialog">
        <form v-if="connectTarget" @submit.prevent="connectTargetSession">
          <div class="property-grid" style="margin-bottom:18px">
            <span class="text-muted">Pool Target</span><span>{{ connectTarget.name || '-' }}</span>
            <span class="text-muted">Host</span><span class="mono property-wrap">{{ connectTarget.host || '-' }}</span>
            <span class="text-muted">Username</span><span class="mono">{{ connectTarget.username || '-' }}</span>
          </div>

          <div class="form-group">
            <label for="pool-connect-password">{{ useSavedCredential ? 'Vault Credential' : 'Pool Password' }}</label>
            <label class="form-toggle" v-if="connectTarget.vault_credential_id" style="margin-bottom:12px">
              <input type="checkbox" v-model="useSavedCredential">
              <span>Use linked vault credential for this pool target</span>
            </label>
            <div v-if="useSavedCredential" class="empty-state" style="padding:12px 14px">
              XenMange will resolve the linked vault credential server-side. No password will be sent back to the browser.
            </div>
            <input v-else
                   id="pool-connect-password"
                   class="form-input"
                   v-model="connectPassword"
                   type="password"
                   autocomplete="current-password"
                   placeholder="Password"
                   required>
          </div>

          <div class="form-actions">
            <button class="form-btn" type="submit" :disabled="connectLoading">
              <span v-if="connectLoading" class="loading-spinner" style="margin-right:8px"></span>
              {{ connectLoading ? 'Connecting...' : 'Connect to Pool' }}
            </button>
            <button class="form-btn form-btn-secondary" type="button" :disabled="connectLoading" @click="closeConnectDialog">
              Cancel
            </button>
          </div>
          <div class="login-meta-note">This attaches the selected Xen target to the current XenMange session without signing you out of the control plane.</div>
          <div class="form-error" v-if="connectError">{{ connectError }}</div>
        </form>
      </floating-window>
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
  },
  watch: {
    '$route.query': {
      deep: true,
      async handler() {
        await this.syncRouteFocus();
        await this.syncPendingConnectionTarget();
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
    openProperties(row) {
      this.poolActionMessage = '';
      this.poolActionError = null;
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
