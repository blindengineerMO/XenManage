const InventoryView = {
  components: {
    DataTable,
    FloatingWindow,
    StatusBadge,
    InventorySavedWorkspacesWindow,
    InventoryConnectionAtlasWindow,
  },
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
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn btn-sm" @click="showSavedWorkspacesWindow = true">
              <span class="mdi mdi-folder-star-outline"></span>
              Saved Workspaces ({{ savedWorkspaces.length }})
            </button>
            <button class="btn btn-sm" @click="showConnectionAtlasWindow = true">
              <span class="mdi mdi-server-network-outline"></span>
              Connection Atlas ({{ safeConnections.length }})
            </button>
            <button class="btn btn-primary" @click="loadInventory">
              <span class="mdi mdi-refresh"></span>
              Refresh
            </button>
          </div>
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

        <inventory-saved-workspaces-window
          :show-saved-workspaces-window="showSavedWorkspacesWindow"
          :workspace-name="workspaceName"
          :workspace-target-connection-id="workspaceTargetConnectionId"
          :workspace-visibility="workspaceVisibility"
          :safe-connections="safeConnections"
          :saved-workspaces="savedWorkspaces"
          :workspace-saving="workspaceSaving"
          :workspace-error="workspaceError"
          :can-save-workspace="canSaveWorkspace"
          @close="showSavedWorkspacesWindow = false"
          @update-workspace-name="workspaceName = $event"
          @update-workspace-target-connection-id="workspaceTargetConnectionId = $event"
          @update-workspace-visibility="workspaceVisibility = $event"
          @save-workspace="saveWorkspace"
          @apply-workspace="applyWorkspace"
          @open-workspace-target="openWorkspaceTarget"
          @remove-workspace="removeWorkspace">
        </inventory-saved-workspaces-window>

        <inventory-connection-atlas-window
          :show-connection-atlas-window="showConnectionAtlasWindow"
          :safe-connections="safeConnections"
          :top-tags="topTags"
          :connection-default-pending-id="connectionDefaultPendingId"
          :connection-action-error="connectionActionError"
          @close="showConnectionAtlasWindow = false"
          @apply-tag="applyTag"
          @set-default-connection="setDefaultConnection"
          @open-connection-target="openConnectionTarget">
        </inventory-connection-atlas-window>
      </template>
    </div>
  `,
  data() {
    return {
      loading: true,
      searchQuery: '',
      workspaceName: '',
      workspaceTargetConnectionId: '',
      workspaceVisibility: store.user ? 'private' : 'shared',
      workspaceSaving: false,
      workspaceError: '',
      connectionDefaultPendingId: null,
      connectionActionError: '',
      activeScope: 'all',
      scopes: [
        { value: 'all', label: 'All' },
        { value: 'pool', label: 'Pools' },
        { value: 'template', label: 'Templates' },
        { value: 'vm', label: 'VMs' },
        { value: 'host', label: 'Hosts' },
        { value: 'storage', label: 'Storage' },
        { value: 'vdi', label: 'VDIs' },
        { value: 'vbd', label: 'VBDs' },
        { value: 'network', label: 'Networks' },
        { value: 'vif', label: 'VIFs' },
        { value: 'pif', label: 'PIFs' },
        { value: 'alert', label: 'Alerts' },
        { value: 'task', label: 'Tasks' },
      ],
      resources: {
        pools: [],
        templates: [],
        vms: [],
        hosts: [],
        srs: [],
        vdis: [],
        networks: [],
        alerts: [],
        tasks: [],
      },
      connections: [],
      savedWorkspaces: [],
      selectedResult: null,
      showResult: false,
      showSavedWorkspacesWindow: false,
      showConnectionAtlasWindow: false,
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
      return buildInventorySafeConnections(this.connections);
    },
    allResults() {
      return buildInventoryAllResults(this.resources);
    },
    filteredResults() {
      return buildFilteredInventoryResults(this.allResults, this.activeScope, this.searchQuery);
    },
    totalObjectCount() {
      return countInventoryObjects(this.allResults);
    },
    topTags() {
      return buildInventoryTopTags(this.allResults);
    },
    summaryCards() {
      return buildInventorySummaryCards({
        totalObjectCount: this.totalObjectCount,
        resources: this.resources,
        filteredResults: this.filteredResults,
        safeConnections: this.safeConnections,
        savedWorkspaces: this.savedWorkspaces,
        activeScope: this.activeScope,
      });
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

    await this.loadSavedWorkspaces();
    await this.loadInventory();
  },
  methods: {
    formatDateTime,
    firstTag(tags) {
      return getInventoryFirstTag(tags);
    },
    applyTag(tag) {
      this.searchQuery = tag;
    },
    navigateToResult(result) {
      this.closeResult();
      this.$router.push(buildInventoryResultNavigation(result));
    },
    openResult(result) {
      this.selectedResult = result;
      this.showResult = true;
    },
    closeResult() {
      this.showResult = false;
      this.selectedResult = null;
    },
    findAttachedTarget(connection) {
      return findInventoryAttachedTarget(store.connectedTargets || [], connection);
    },
    async loadSavedWorkspaces() {
      try {
        const result = await api.getInventoryWorkspaces();
        this.savedWorkspaces = result.data || [];
        window.localStorage.setItem('xenmange.inventory.workspaces', JSON.stringify(this.savedWorkspaces));
      } catch (error) {
        try {
          const saved = JSON.parse(window.localStorage.getItem('xenmange.inventory.workspaces') || '[]');
          this.savedWorkspaces = Array.isArray(saved) ? saved : [];
        } catch (storageError) {
          this.savedWorkspaces = [];
        }
      }
    },
    persistWorkspaces() {
      window.localStorage.setItem('xenmange.inventory.workspaces', JSON.stringify(this.savedWorkspaces));
    },
    async saveWorkspace() {
      const name = this.workspaceName.trim();
      if (!name) return;

      this.workspaceSaving = true;
      this.workspaceError = '';
      try {
        const workspace = await api.createInventoryWorkspace(buildInventoryWorkspacePayload({
          name,
          activeScope: this.activeScope,
          searchQuery: this.searchQuery,
          workspaceTargetConnectionId: this.workspaceTargetConnectionId,
          workspaceVisibility: this.workspaceVisibility,
          hasUser: Boolean(store.user),
        }));
        this.savedWorkspaces = [workspace, ...this.savedWorkspaces.filter((entry) => entry.id !== workspace.id)].slice(0, 24);
        this.persistWorkspaces();
        this.workspaceName = '';
        this.workspaceTargetConnectionId = '';
        this.workspaceVisibility = store.user ? 'private' : 'shared';
      } catch (error) {
        this.workspaceError = error.message || 'Unable to save the inventory workspace';
      } finally {
        this.workspaceSaving = false;
      }
    },
    applyWorkspace(workspace) {
      this.activeScope = workspace.scope || 'all';
      this.searchQuery = workspace.query || '';
      this.workspaceTargetConnectionId = workspace.targetConnectionId ? String(workspace.targetConnectionId) : '';
    },
    openWorkspaceTarget(workspace) {
      const connection = this.safeConnections.find((entry) => Number(entry.id) === Number(workspace?.targetConnectionId || 0));
      if (!connection) return;
      this.openConnectionTarget(connection);
    },
    async removeWorkspace(id) {
      const workspace = this.savedWorkspaces.find((entry) => Number(entry.id) === Number(id));
      this.workspaceSaving = true;
      this.workspaceError = '';
      try {
        const approvalId = await resolveGovernanceApproval({
          actionKey: 'inventory_workspace_delete',
          entityType: 'workspace',
          entityRef: String(id),
          entityName: workspace?.name || `Workspace ${id}`,
          route: '/inventory',
        });
        await api.deleteInventoryWorkspace(id, approvalId ? { approvalId } : null);
        this.savedWorkspaces = this.savedWorkspaces.filter((workspace) => workspace.id !== id);
        this.persistWorkspaces();
      } catch (error) {
        if (error.code === 'APPROVAL_REQUIRED') {
          this.workspaceError = 'Governance approval is required before deleting this workspace preset.';
          await handoffToGovernanceApproval(
            this.$router,
            error.approvalDraft,
            'Approval required before deleting this saved inventory workspace.'
          );
          return;
        }
        this.workspaceError = error.message || 'Unable to remove the inventory workspace';
      } finally {
        this.workspaceSaving = false;
      }
    },
    async setDefaultConnection(connection) {
      if (!connection?.id) return;
      this.connectionDefaultPendingId = connection.id;
      this.connectionActionError = '';
      try {
        await api.setDefaultConnection(connection.id);
        this.connections = this.connections.map((entry) => ({
          ...entry,
          is_default: Number(entry.id) === Number(connection.id) ? 1 : 0,
        }));
      } catch (error) {
        this.connectionActionError = error.message || 'Unable to update the default target';
      } finally {
        this.connectionDefaultPendingId = null;
      }
    },
    async openConnectionTarget(connection) {
      if (!connection?.id) return;
      this.connectionActionError = '';
      try {
        const attachedTarget = this.findAttachedTarget(connection);
        if (attachedTarget) {
          const result = await api.activateLiveTarget(
            attachedTarget.targetKey
              ? { targetKey: attachedTarget.targetKey }
              : { connectionId: Number(connection.id) }
          );
          applySessionStatus(result);
          await this.loadInventory();
          return;
        }

        await this.$router.push({
          path: '/pools',
          query: {
            connectionId: String(connection.id),
            returnTo: '/inventory'
          },
        });
      } catch (error) {
        this.connectionActionError = error.message || 'Unable to hand off into the selected login target';
      }
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

        const vdiResults = await Promise.allSettled(
          (srs.data || []).map((sr) => api.getSRVDIs(sr.ref))
        );
        const vdis = vdiResults.flatMap((result) =>
          result.status === 'fulfilled' ? (result.value.data || []) : []
        );

        this.resources = {
          pools: pools.data || [],
          templates: templates.data || [],
          vms: vms.data || [],
          hosts: hosts.data || [],
          srs: srs.data || [],
          vdis,
          networks: networks.data || [],
          alerts: alerts || [],
          tasks: tasks.data || [],
        };
        this.connections = Array.isArray(connections) ? connections.filter((connection) => connection && typeof connection === 'object') : [];
        this.connectionActionError = '';
      } catch (error) {
        console.error(error);
        this.resources = buildInventoryEmptyResources();
        this.connections = [];
      } finally {
        this.loading = false;
      }
    },
  },
};
