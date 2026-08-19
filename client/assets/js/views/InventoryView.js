const InventoryView = {
  components: { DataTable, FloatingWindow, StatusBadge },
  template: `
    <div class="animate-fade-in">
      <div v-if="loading" class="empty-state">
        <span class="loading-spinner"></span>
        <p style="margin-top:12px">Loading global inventory index and operator workspaces...</p>
      </div>

      <template v-else>
        <div class="section-head">
          <div>
            <h2 class="section-title">
              <span class="mdi mdi-sitemap-outline"></span>
              Inventory
            </h2>
            <p class="section-subtitle">Universal search, saved targets, and repeatable operator workspaces across the current Xen management surface.</p>
          </div>
          <button class="btn btn-primary" @click="loadInventory">
            <span class="mdi mdi-refresh"></span>
            Refresh
          </button>
        </div>

        <div class="dashboard-hero inventory-hero">
          <div>
            <div class="dash-card-label">Global Inventory Index</div>
            <h3>Search once across compute, storage, networking, alerts, and task history.</h3>
            <p>XenMange now brings the current cluster inventory, saved connection atlas, and operator workspace presets together so navigation feels more like a control plane and less like isolated screens.</p>
          </div>
          <div class="dashboard-hero-rail">
            <button class="btn btn-primary" @click="$router.push('/')">
              <span class="mdi mdi-view-dashboard"></span>
              Dashboard
            </button>
            <button class="btn" @click="$router.push('/activity')">
              <span class="mdi mdi-timeline-clock-outline"></span>
              Task History
            </button>
            <button class="btn" @click="$router.push('/alerts')">
              <span class="mdi mdi-bell-alert-outline"></span>
              Alert Stream
            </button>
          </div>
        </div>

        <div class="dash-grid">
          <div class="dash-card" v-for="card in summaryCards" :key="card.key">
            <div class="dash-card-label">{{ card.label }}</div>
            <div class="dash-card-value" :class="card.valueClass || ''">{{ card.value }}</div>
            <div class="dash-card-icon mdi" :class="card.icon"></div>
            <div class="text-muted mono" style="margin-top:8px;font-size:11px">{{ card.detail }}</div>
          </div>
        </div>

        <div class="dashboard-panels">
          <div class="dash-card">
            <div class="dash-card-label">Search Workspace</div>
            <div class="inventory-toolbar">
              <input class="data-table-search"
                     placeholder="Search live inventory, alerts, tasks, UUIDs, and tags..."
                     v-model="searchQuery">
              <div style="display:flex;gap:8px;flex-wrap:wrap">
                <button
                  v-for="scope in scopes"
                  :key="scope.value"
                  class="btn btn-sm"
                  :class="{ 'btn-primary': activeScope === scope.value }"
                  @click="activeScope = scope.value">
                  {{ scope.label }}
                </button>
              </div>
            </div>

            <div class="detail-section">
              <div class="detail-section-title">Saved Workspaces</div>
              <div class="inventory-toolbar">
                <input class="data-table-search"
                       placeholder="Name this search preset..."
                       v-model="workspaceName">
                <button class="btn btn-primary btn-sm" @click="saveWorkspace" :disabled="!canSaveWorkspace">
                  <span class="mdi mdi-content-save-outline"></span>
                  Save Workspace
                </button>
              </div>

              <div class="stack-list" v-if="savedWorkspaces.length">
                <div class="stack-item" v-for="workspace in savedWorkspaces" :key="workspace.id">
                  <div>
                    <strong>{{ workspace.name }}</strong>
                    <div class="text-muted mono" style="font-size:11px">{{ workspace.scope }} · {{ workspace.query || 'no query filter' }}</div>
                  </div>
                  <div style="display:flex;gap:8px;flex-wrap:wrap">
                    <button class="btn btn-sm" @click="applyWorkspace(workspace)">
                      <span class="mdi mdi-target-variant"></span>
                      Apply
                    </button>
                    <button class="btn btn-sm" @click="removeWorkspace(workspace.id)">
                      <span class="mdi mdi-delete-outline"></span>
                      Remove
                    </button>
                  </div>
                </div>
              </div>
              <div v-else class="empty-state" style="padding:18px 12px">Save frequent search scopes as reusable operator workspaces.</div>
            </div>
          </div>

          <div class="dash-card">
            <div class="dash-card-label">Connection Atlas</div>
            <div class="stack-list" v-if="safeConnections.length">
              <div class="stack-item" v-for="connection in safeConnections" :key="connection.id">
                <div>
                  <strong>{{ connection.name || 'Saved Target' }}</strong>
                  <div class="text-muted mono" style="font-size:11px">{{ connection.host || '-' }} · {{ connection.username || '-' }} · :{{ connection.port || 443 }}</div>
                  <div class="text-muted" style="font-size:12px;margin-top:6px">
                    {{ connection.is_default ? 'Default saved target' : 'Saved connection target' }}
                    <span v-if="connection.last_connected_at"> · last used {{ formatDateTime(connection.last_connected_at) }}</span>
                  </div>
                </div>
                <status-badge :status="connection.is_default ? 'success' : (store.host === connection.host ? 'connected' : 'notice')"></status-badge>
              </div>
            </div>
            <div v-else class="empty-state" style="padding:18px 12px">No saved connection targets yet.</div>

            <div class="detail-section">
              <div class="detail-section-title">Top Tags</div>
              <div style="display:flex;gap:8px;flex-wrap:wrap">
                <button class="badge badge-info inventory-tag-button"
                        v-for="tag in topTags"
                        :key="tag.label"
                        @click="applyTag(tag.label)">
                  {{ tag.label }} · {{ tag.count }}
                </button>
              </div>
              <div v-if="!topTags.length" class="text-muted mono" style="font-size:11px">No tags discovered in the current live inventory.</div>
            </div>
          </div>
        </div>

        <data-table :columns="columns"
                    :data="filteredResults"
                    :loading="loading"
                    :searchable="false"
                    @row-click="openResult">
          <template #cell-kind="{ row }">
            <span class="badge badge-info">{{ row.kind }}</span>
          </template>
          <template #cell-name="{ row }">
            <span style="color:var(--text-primary);font-weight:500">{{ row.name }}</span>
          </template>
          <template #cell-status="{ row }">
            <status-badge :status="row.status"></status-badge>
          </template>
          <template #cell-tags="{ row }">
            <span class="mono">{{ row.tags || '-' }}</span>
          </template>
        </data-table>

        <floating-window :show="showResult"
                         title="Inventory Result Detail"
                         :width="720"
                         :height="460"
                         @close="closeResult">
          <div v-if="selectedResult">
            <div class="property-grid">
              <span class="text-muted">Kind</span><span>{{ selectedResult.kind }}</span>
              <span class="text-muted">Name</span><span>{{ selectedResult.name }}</span>
              <span class="text-muted">Status</span><status-badge :status="selectedResult.status"></status-badge>
              <span class="text-muted">Context</span><span class="property-wrap">{{ selectedResult.context || '-' }}</span>
              <span class="text-muted">Tags</span><span>{{ selectedResult.tags || '-' }}</span>
              <span class="text-muted">Route</span><span class="mono">{{ selectedResult.route }}</span>
              <span class="text-muted">Reference</span><span class="mono property-wrap">{{ selectedResult.ref || selectedResult.uuid || '-' }}</span>
              <span class="text-muted">Summary</span><span class="property-wrap">{{ selectedResult.summary || '-' }}</span>
            </div>

            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:16px">
              <button class="btn btn-primary" @click="navigateToResult(selectedResult)">
                <span class="mdi mdi-open-in-new"></span>
                Open Workspace
              </button>
              <button class="btn btn-sm" v-if="selectedResult.tags && selectedResult.tags !== '-'" @click="searchQuery = firstTag(selectedResult.tags)">
                <span class="mdi mdi-tag-search-outline"></span>
                Search First Tag
              </button>
            </div>
          </div>
        </floating-window>
      </template>
    </div>
  `,
  data() {
    return {
      loading: true,
      searchQuery: '',
      workspaceName: '',
      activeScope: 'all',
      scopes: [
        { value: 'all', label: 'All' },
        { value: 'pool', label: 'Pools' },
        { value: 'template', label: 'Templates' },
        { value: 'vm', label: 'VMs' },
        { value: 'host', label: 'Hosts' },
        { value: 'storage', label: 'Storage' },
        { value: 'network', label: 'Networks' },
        { value: 'alert', label: 'Alerts' },
        { value: 'task', label: 'Tasks' },
      ],
      resources: {
        pools: [],
        templates: [],
        vms: [],
        hosts: [],
        srs: [],
        networks: [],
        alerts: [],
        tasks: [],
      },
      connections: [],
      savedWorkspaces: [],
      selectedResult: null,
      showResult: false,
      columns: [
        { key: 'kind', label: 'Kind' },
        { key: 'name', label: 'Name' },
        { key: 'context', label: 'Context' },
        { key: 'status', label: 'Status' },
        { key: 'tags', label: 'Tags' },
      ],
    };
  },
  setup() {
    return { store };
  },
  computed: {
    safeConnections() {
      return (Array.isArray(this.connections) ? this.connections : [])
        .filter((connection) => connection && typeof connection === 'object')
        .map((connection, index) => ({
          id: connection.id ?? `saved-target-${index}`,
          name: connection.name || '',
          host: connection.host || '',
          username: connection.username || '',
          port: connection.port || 443,
          is_default: Boolean(connection.is_default),
          last_connected_at: connection.last_connected_at || '',
        }));
    },
    allResults() {
      const vmResults = (this.resources.vms || []).map((vm) => ({
        kind: 'vm',
        name: vm.name_label || 'Virtual Machine',
        context: `${vm.power_state || 'Unknown'} · ${vm.uuid || vm.ref}`,
        status: vm.power_state || 'info',
        tags: truncateList(vm.tags),
        summary: vm.name_description || 'Virtual machine inventory entry',
        route: '/vms',
        ref: vm.ref,
        uuid: vm.uuid,
      }));

      const hostResults = (this.resources.hosts || []).map((host) => ({
        kind: 'host',
        name: host.name_label || host.hostname || 'Host',
        context: `${host.address || host.uuid || host.ref} · ${(host.resident_VMs || []).length} VMs`,
        status: host.enabled ? 'enabled' : 'disabled',
        tags: truncateList(host.tags),
        summary: host.hostname || 'Host inventory entry',
        route: '/hosts',
        ref: host.ref,
        uuid: host.uuid,
      }));

      const poolResults = (this.resources.pools || []).map((pool) => ({
        kind: 'pool',
        name: pool.name_label || 'Pool',
        context: `${pool.uuid || pool.ref} · default SR ${pool.default_SR || '-'}`,
        status: 'info',
        tags: truncateList(pool.tags),
        summary: pool.name_description || 'Pool inventory entry',
        route: '/pools',
        ref: pool.ref,
        uuid: pool.uuid,
      }));

      const templateResults = (this.resources.templates || []).map((template) => ({
        kind: 'template',
        name: template.name_label || 'Template',
        context: `${template.VCPUs_at_startup || 0} vCPU · ${formatBytes(template.memory_static_max)}`,
        status: 'info',
        tags: truncateList(template.tags),
        summary: template.name_description || 'Template inventory entry',
        route: '/templates',
        ref: template.ref,
        uuid: template.uuid,
      }));

      const storageResults = (this.resources.srs || []).map((sr) => ({
        kind: 'storage',
        name: sr.name_label || 'Storage Repository',
        context: `${formatBytes(sr.virtual_allocation)} / ${formatBytes(sr.physical_size)} · ${sr.type || 'unknown'}`,
        status: getUtilizationStatus(percentValue(sr.virtual_allocation, sr.physical_size), { warning: 75, critical: 90 }),
        tags: truncateList(sr.tags),
        summary: 'Storage repository inventory entry',
        route: '/storage',
        ref: sr.ref,
        uuid: sr.uuid,
      }));

      const networkResults = (this.resources.networks || []).map((network) => ({
        kind: 'network',
        name: network.name_label || network.bridge || 'Network',
        context: `${network.bridge || '-'} · ${network.uuid || network.ref}`,
        status: network.managed ? 'enabled' : 'disabled',
        tags: truncateList(network.tags),
        summary: network.name_description || 'Network inventory entry',
        route: '/networking',
        ref: network.ref,
        uuid: network.uuid,
      }));

      const alertResults = sortMessages(this.resources.alerts || []).map((message) => ({
        kind: 'alert',
        name: getMessageHeadline(message),
        context: formatDateTime(message.timestamp),
        status: getMessageSeverity(message),
        tags: message.cls || '-',
        summary: message.body || 'Alert event',
        route: '/alerts',
        ref: message.ref,
        uuid: message.uuid,
      }));

      const taskResults = sortTasks(this.resources.tasks || []).map((task) => ({
        kind: 'task',
        name: task.name_label || 'Task',
        context: `${formatTaskProgress(task.progress)} · ${formatDateTime(task.finished || task.created)}`,
        status: task.status || 'info',
        tags: task.resident_on || '-',
        summary: task.name_description || 'Operational task',
        route: '/activity',
        ref: task.ref,
        uuid: task.uuid,
      }));

      return [
        ...poolResults,
        ...templateResults,
        ...vmResults,
        ...hostResults,
        ...storageResults,
        ...networkResults,
        ...alertResults,
        ...taskResults,
      ];
    },
    filteredResults() {
      const query = this.searchQuery.trim().toLowerCase();

      return this.allResults.filter((item) => {
        const scopeMatch = this.activeScope === 'all' || item.kind === this.activeScope;
        if (!scopeMatch) return false;
        if (!query) return true;

        const haystack = [
          item.kind,
          item.name,
          item.context,
          item.status,
          item.tags,
          item.summary,
          item.uuid,
          item.ref,
        ].join(' ').toLowerCase();

        return haystack.includes(query);
      });
    },
    totalObjectCount() {
      return this.allResults.filter((item) => item.kind !== 'alert' && item.kind !== 'task').length;
    },
    topTags() {
      const counts = new Map();
      for (const item of this.allResults) {
        for (const tag of String(item.tags || '')
          .split(',')
          .map((value) => value.trim())
          .filter((value) => value && value !== '-')) {
          counts.set(tag, (counts.get(tag) || 0) + 1);
        }
      }

      return [...counts.entries()]
        .map(([label, count]) => ({ label, count }))
        .sort((left, right) => right.count - left.count)
        .slice(0, 10);
    },
    summaryCards() {
      return [
        {
          key: 'objects',
          label: 'Indexed Objects',
          value: String(this.totalObjectCount),
          detail: `${this.resources.alerts.length || 0} alerts and ${this.resources.tasks.length || 0} tasks also searchable`,
          icon: 'mdi-database-search-outline',
          valueClass: this.totalObjectCount ? 'text-cyan' : '',
        },
        {
          key: 'connections',
          label: 'Saved Targets',
          value: String(this.safeConnections.length),
          detail: this.safeConnections.length ? `${this.safeConnections.filter((connection) => connection.is_default).length} defaults pinned` : 'No saved targets yet',
          icon: 'mdi-server-network-outline',
          valueClass: this.safeConnections.length ? 'text-green' : '',
        },
        {
          key: 'workspaces',
          label: 'Saved Workspaces',
          value: String(this.savedWorkspaces.length),
          detail: this.savedWorkspaces.length ? 'Reusable search presets for common operator flows' : 'Save common search scopes for repeatable navigation',
          icon: 'mdi-folder-star-outline',
          valueClass: this.savedWorkspaces.length ? 'text-amber' : '',
        },
        {
          key: 'scope',
          label: 'Current Scope',
          value: this.activeScope === 'all' ? 'All' : this.activeScope,
          detail: `${this.filteredResults.length} results match the active query`,
          icon: 'mdi-filter-outline',
          valueClass: 'text-green',
        },
      ];
    },
    canSaveWorkspace() {
      return Boolean(this.workspaceName.trim());
    },
  },
  async mounted() {
    if (!store.authenticated) {
      this.$router.push('/login');
      return;
    }

    this.loadSavedWorkspaces();
    await this.loadInventory();
  },
  methods: {
    formatDateTime,
    firstTag(tags) {
      return String(tags || '').split(',').map((value) => value.trim()).find(Boolean) || '';
    },
    applyTag(tag) {
      this.searchQuery = tag;
    },
    navigateToResult(result) {
      this.closeResult();
      this.$router.push(result.route || '/');
    },
    openResult(result) {
      this.selectedResult = result;
      this.showResult = true;
    },
    closeResult() {
      this.showResult = false;
      this.selectedResult = null;
    },
    loadSavedWorkspaces() {
      try {
        const saved = JSON.parse(window.localStorage.getItem('xenmange.inventory.workspaces') || '[]');
        this.savedWorkspaces = Array.isArray(saved) ? saved : [];
      } catch (error) {
        this.savedWorkspaces = [];
      }
    },
    persistWorkspaces() {
      window.localStorage.setItem('xenmange.inventory.workspaces', JSON.stringify(this.savedWorkspaces));
    },
    saveWorkspace() {
      const name = this.workspaceName.trim();
      if (!name) return;

      const workspace = {
        id: `workspace-${Date.now()}`,
        name,
        scope: this.activeScope,
        query: this.searchQuery.trim(),
        createdAt: new Date().toISOString(),
      };

      this.savedWorkspaces = [workspace, ...this.savedWorkspaces].slice(0, 12);
      this.persistWorkspaces();
      this.workspaceName = '';
    },
    applyWorkspace(workspace) {
      this.activeScope = workspace.scope || 'all';
      this.searchQuery = workspace.query || '';
    },
    removeWorkspace(id) {
      this.savedWorkspaces = this.savedWorkspaces.filter((workspace) => workspace.id !== id);
      this.persistWorkspaces();
    },
    async loadInventory() {
      this.loading = true;
      try {
        const [pools, templates, vms, hosts, srs, networks, alerts, tasks, connections] = await Promise.all([
          api.getPools().catch(() => ({ data: [] })),
          api.getTemplates().catch(() => ({ data: [] })),
          api.getVMs().catch(() => ({ data: [] })),
          api.getHosts().catch(() => ({ data: [] })),
          api.getSRs().catch(() => ({ data: [] })),
          api.getNetworks().catch(() => ({ data: [] })),
          api.dashboardMessages().catch(() => []),
          api.getTasks().catch(() => ({ data: [] })),
          api.getConnections().catch(() => []),
        ]);

        this.resources = {
          pools: pools.data || [],
          templates: templates.data || [],
          vms: vms.data || [],
          hosts: hosts.data || [],
          srs: srs.data || [],
          networks: networks.data || [],
          alerts: alerts || [],
          tasks: tasks.data || [],
        };
        this.connections = Array.isArray(connections) ? connections.filter((connection) => connection && typeof connection === 'object') : [];
      } catch (error) {
        console.error(error);
        this.resources = {
          pools: [],
          templates: [],
          vms: [],
          hosts: [],
          srs: [],
          networks: [],
          alerts: [],
          tasks: [],
        };
        this.connections = [];
      } finally {
        this.loading = false;
      }
    },
  },
};
