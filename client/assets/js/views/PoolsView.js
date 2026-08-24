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
                </div>
              </div>
              <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;justify-content:flex-end">
                <status-badge :status="isCurrentConnection(connection) ? 'connected' : (connection.is_default ? 'success' : 'notice')"></status-badge>
                <button class="btn btn-sm" @click="openRegistration(connection)">
                  <span class="mdi mdi-pencil-outline"></span>
                </button>
                <button class="btn btn-sm" v-if="!connection.is_default" @click="makeDefault(connection.id)">
                  <span class="mdi mdi-star-outline"></span>
                </button>
                <button class="btn btn-sm" @click="removeConnection(connection.id)">
                  <span class="mdi mdi-delete-outline"></span>
                </button>
              </div>
            </div>
          </div>
          <div v-else class="empty-state" style="padding:18px 12px">Register pool targets here for future logins and multi-pool operations.</div>
          <div class="form-error" v-if="connectionError" style="text-align:left">{{ connectionError }}</div>
        </div>
      </div>

      <data-table :columns="columns" :data="pools" :loading="loading" :searchable="true" @row-click="openProperties">
        <template #cell-name_label="{ row }">
          <span style="color:var(--text-primary);font-weight:500">{{ row.name_label || 'Unnamed Pool' }}</span>
        </template>
        <template #cell-tags="{ row }">
          <span class="mono">{{ truncateList(row.tags) }}</span>
        </template>
      </data-table>

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
                       :height="430"
                       @close="showRegistration = false">
        <pool-registration-form
          :initial-value="connectionDraft"
          :submit-label="editingConnectionId ? 'Update Pool Target' : 'Save Pool Target'"
          @submit="submitConnection">
        </pool-registration-form>
      </floating-window>
    </div>
  `,
  data() {
    return {
      loading: true,
      pools: [],
      hosts: [],
      connections: [],
      selectedPool: null,
      showProps: false,
      showRegistration: false,
      editingConnectionId: null,
      connectionDraft: null,
      connectionError: null,
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
    truncateList,
    summarizeCount,
    isCurrentConnection(connection) {
      return store.host === connection.host || store.host === connection.name;
    },
    async loadAll() {
      await Promise.all([this.loadPools(), this.loadHosts(), this.loadConnections()]);
    },
    async loadPools() {
      this.loading = true;
      try {
        const result = await api.getPools();
        this.pools = result.data || [];
      } catch (error) {
        console.error(error);
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
        port: 443,
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
      try {
        await api.deleteConnection(id);
        await this.loadConnections();
      } catch (error) {
        this.connectionError = error.message || 'Unable to remove pool target';
      }
    },
  },
};
