const PoolsView = {
  components: { DataTable, FloatingWindow, PoolRegistrationForm, StatusBadge },
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
            <span class="text-muted">Default SR</span><span class="mono property-wrap">{{ selectedPool.default_SR || '-' }}</span>
            <span class="text-muted">Migration Network</span><span class="mono property-wrap">{{ selectedPool.migration_network || '-' }}</span>
            <span class="text-muted">Master Host</span><span class="mono property-wrap">{{ selectedPool.master || '-' }}</span>
            <span class="text-muted">Host Count</span><span>{{ summarizeCount('hosts', selectedPoolHosts.length) }}</span>
            <span class="text-muted">Tags</span><span>{{ truncateList(selectedPool.tags) }}</span>
            <span class="text-muted">Other Config</span><span class="mono property-wrap">{{ JSON.stringify(selectedPool.other_config || {}) }}</span>
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
      connections: [],
      credentials: [],
      selectedPool: null,
      showProps: false,
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
      return this.connections.find((connection) => connection.is_default) || this.connections[0] || null;
    },
    selectedPoolHosts() {
      if (!this.selectedPool) return [];

      return this.resolvePoolHosts(this.selectedPool).map((host) => ({
        ...host,
        role: this.isPoolMaster(host, this.selectedPool) ? 'Master' : 'Member',
        residentVmCount: Array.isArray(host.resident_VMs) ? host.resident_VMs.length : 0,
      }));
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
      return visibility === 'shared' ? 'Shared' : 'Private';
    },
    ownershipLabel(connection) {
      if (connection.is_owner) return 'Owned by you';
      return `Owner ${connection.owner_display_name || connection.owner_username}`;
    },
    isCurrentConnection(connection) {
      return Boolean(this.findAttachedTarget(connection)?.active);
    },
    isConnectionAttached(connection) {
      return Boolean(this.findAttachedTarget(connection));
    },
    findAttachedTarget(connection) {
      const connectionId = Number(connection?.id || 0);
      return this.attachedTargets.find((target) =>
        (connectionId && Number(target.connectionId || 0) === connectionId)
        || (
          String(target.host || '').toLowerCase() === String(connection?.host || '').toLowerCase()
          && String(target.username || '').toLowerCase() === String(connection?.username || '').toLowerCase()
        )
      ) || null;
    },
    async loadAll() {
      await Promise.all([this.loadPools(), this.loadHosts(), this.loadConnections(), this.loadCredentials()]);
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
    async loadCredentials() {
      try {
        const result = await api.getCredentials();
        this.credentials = result.data || [];
      } catch (error) {
        this.credentials = [];
      }
    },
    openProperties(row) {
      this.selectedPool = row;
      this.showProps = true;
    },
    findPoolByFocus(focus) {
      return this.pools.find((pool) =>
        recordMatchesRouteFocus(pool, focus, ['ref', 'uuid', 'name_label'])
      ) || null;
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
      return Boolean(host && pool && pool.master && host.ref === pool.master);
    },
    resolvePoolHosts(pool) {
      if (!pool) return [];

      const poolRefs = new Set(
        [
          pool.master,
          ...(Array.isArray(pool.hosts) ? pool.hosts : []),
          ...(Array.isArray(pool.resident_hosts) ? pool.resident_hosts : []),
          ...(Array.isArray(pool.slaves) ? pool.slaves : []),
        ].filter(Boolean)
      );

      let matches = this.hosts.filter((host) =>
        poolRefs.has(host.ref) || poolRefs.has(host.uuid)
      );

      if (!matches.length) {
        const poolKeys = [pool.ref, pool.uuid, pool.name_label]
          .filter(Boolean)
          .map((value) => String(value).toLowerCase());

        matches = this.hosts.filter((host) => {
          const hostKeys = [host.pool, host.pool_ref, host.pool_uuid, host.pool_name]
            .filter(Boolean)
            .map((value) => String(value).toLowerCase());

          return hostKeys.some((value) => poolKeys.includes(value));
        });
      }

      if (!matches.length && this.pools.length === 1 && this.pools[0].ref === pool.ref) {
        return this.hosts;
      }

      return matches;
    },
    openRegistration(connection = null) {
      this.connectionError = null;
      this.editingConnectionId = connection?.id || null;
      this.connectionDraft = connection ? { ...connection } : {
        name: '',
        host: '',
        username: 'root',
        vault_credential_id: null,
        port: 443,
        visibility: store.user ? 'private' : 'shared',
        is_default: false,
      };
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
