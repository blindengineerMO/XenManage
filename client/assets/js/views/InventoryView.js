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
                <select class="form-input"
                        style="max-width:240px"
                        v-model="workspaceTargetConnectionId">
                  <option value="">No target binding</option>
                  <option v-for="connection in safeConnections"
                          :key="connection.id"
                          :value="String(connection.id)">
                    {{ connection.name || connection.host }}
                  </option>
                </select>
                <select class="form-input"
                        style="max-width:240px"
                        v-model="workspaceVisibility">
                  <option value="private">Private Workspace</option>
                  <option value="shared">Shared Workspace</option>
                </select>
                <button class="btn btn-primary btn-sm" @click="saveWorkspace" :disabled="!canSaveWorkspace || workspaceSaving">
                  <span class="mdi mdi-content-save-outline"></span>
                  {{ workspaceSaving ? 'Saving...' : 'Save Workspace' }}
                </button>
              </div>
              <div class="text-muted mono" style="font-size:11px;margin-top:6px">Workspace presets now persist through the server and can optionally bind to a saved target for deliberate connection switching.</div>
              <div class="form-error" v-if="workspaceError" style="text-align:left">{{ workspaceError }}</div>

              <div class="stack-list" v-if="savedWorkspaces.length">
                <div class="stack-item" v-for="workspace in savedWorkspaces" :key="workspace.id">
                  <div>
                    <strong>{{ workspace.name }}</strong>
                    <div class="text-muted mono" style="font-size:11px">{{ workspace.scope }} · {{ workspace.query || 'no query filter' }}</div>
                    <div class="text-muted mono" style="font-size:11px">
                      {{ resolveWorkspaceTargetLabel(workspace) }}
                      <span v-if="workspace.updatedAt"> · updated {{ formatDateTime(workspace.updatedAt) }}</span>
                    </div>
                    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
                      <span class="badge" :class="workspace.visibility === 'shared' ? 'badge-info' : 'badge-success'">{{ visibilityLabel(workspace.visibility) }}</span>
                      <span class="badge badge-info" v-if="workspace.owner_display_name || workspace.owner_username">{{ ownershipLabel(workspace) }}</span>
                    </div>
                  </div>
                  <div style="display:flex;gap:8px;flex-wrap:wrap">
                    <button class="btn btn-sm" @click="applyWorkspace(workspace)">
                      <span class="mdi mdi-target-variant"></span>
                      Apply
                    </button>
                    <button class="btn btn-sm"
                            v-if="workspace.targetConnectionId"
                            @click="openWorkspaceTarget(workspace)">
                      <span class="mdi mdi-login-variant"></span>
                      Open Target
                    </button>
                    <button class="btn btn-sm" v-if="workspace.can_manage !== false" @click="removeWorkspace(workspace.id)">
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
                  <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
                    <span class="badge" :class="connection.visibility === 'shared' ? 'badge-info' : 'badge-success'">{{ visibilityLabel(connection.visibility) }}</span>
                    <span class="badge badge-info" v-if="connection.owner_display_name || connection.owner_username">{{ ownershipLabel(connection) }}</span>
                  </div>
                </div>
                <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;justify-content:flex-end">
                  <status-badge :status="isConnectionActive(connection) ? 'connected' : (connection.is_default ? 'success' : 'notice')"></status-badge>
                  <button class="btn btn-sm"
                          @click="setDefaultConnection(connection)"
                          :disabled="connectionDefaultPendingId === connection.id || connection.is_default || connection.can_manage === false">
                    <span class="mdi mdi-pin-outline"></span>
                    {{ connection.is_default ? 'Default' : (connectionDefaultPendingId === connection.id ? 'Saving...' : 'Set Default') }}
                  </button>
                  <button class="btn btn-sm" @click="openConnectionTarget(connection)">
                    <span class="mdi mdi-login-variant"></span>
                    Open Login
                  </button>
                </div>
              </div>
            </div>
            <div v-else class="empty-state" style="padding:18px 12px">No saved connection targets yet.</div>
            <div class="form-error" v-if="connectionActionError" style="text-align:left">{{ connectionActionError }}</div>

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
          visibility: connection.visibility || 'shared',
          owner_display_name: connection.owner_display_name || '',
          owner_username: connection.owner_username || '',
          is_owner: Boolean(connection.is_owner),
          can_manage: connection.can_manage !== false,
        }));
    },
    allResults() {
      const storageMap = new Map((this.resources.srs || []).map((sr) => [sr.ref, sr]));
      const hostMap = new Map((this.resources.hosts || []).map((host) => [host.ref, host]));
      const vmsByVbdRef = new Map();
      const vmsByVifRef = new Map();

      for (const vm of this.resources.vms || []) {
        for (const ref of vm.VBDs || []) {
          vmsByVbdRef.set(ref, vm);
        }
        for (const ref of vm.VIFs || []) {
          vmsByVifRef.set(ref, vm);
        }
      }

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

      const vdiResults = (this.resources.vdis || []).map((vdi) => {
        const sr = storageMap.get(vdi.SR) || null;
        const attachmentCount = Array.isArray(vdi.VBDs) ? vdi.VBDs.length : 0;
        return {
          kind: 'vdi',
          name: vdi.name_label || vdi.ref || 'Virtual Disk Image',
          context: `${sr?.name_label || vdi.SR || 'Unknown SR'} · ${formatBytes(vdi.virtual_size)} · ${attachmentCount} attachment${attachmentCount === 1 ? '' : 's'}`,
          status: vdi.managed ? 'info' : 'warning',
          tags: `${vdi.type || 'disk'}${vdi.managed ? ', managed' : ', unmanaged'}`,
          summary: `${vdi.uuid || vdi.ref || 'VDI'} stored in ${sr?.name_label || 'the selected repository'}.`,
          route: '/storage',
          ref: vdi.ref,
          uuid: vdi.uuid,
          focusKind: 'storage',
          focusClass: 'vdi',
          parentName: sr?.name_label || '',
        };
      });

      const vbdResults = (this.resources.vdis || []).flatMap((vdi) => {
        const sr = storageMap.get(vdi.SR) || null;
        return (vdi.VBDs || []).map((vbdRef, index) => {
          const vm = vmsByVbdRef.get(vbdRef) || null;
          const host = hostMap.get(vm?.resident_on) || null;
          return {
            kind: 'vbd',
            name: `VBD ${vm?.name_label || index + 1}`,
            context: `${vdi.name_label || vdi.ref || 'VDI'} · ${vm?.name_label || 'No mapped VM'} · ${host?.name_label || host?.address || 'Host not mapped'}`,
            status: vm?.power_state || (vm ? 'info' : 'warning'),
            tags: sr?.name_label || vdi.SR || '-',
            summary: `${vbdRef} backs ${vdi.name_label || 'a storage object'}${vm ? ` for ${vm.name_label || vm.ref}` : ''}.`,
            route: '/storage',
            ref: vbdRef,
            uuid: '',
            focusKind: 'storage',
            focusClass: 'vbd',
            parentName: sr?.name_label || '',
          };
        });
      });

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

      const vifResults = (this.resources.networks || []).flatMap((network) =>
        (network.VIFs || []).map((vifRef, index) => {
          const vm = vmsByVifRef.get(vifRef) || null;
          return {
            kind: 'vif',
            name: `VIF ${vm?.name_label || index + 1}`,
            context: `${network.name_label || network.bridge || 'Network'} · ${vm?.name_label || 'No mapped VM'} · VLAN ${(network.other_config || {}).vlan || '-'}`,
            status: vm?.power_state || 'info',
            tags: network.bridge || '-',
            summary: `${vifRef} attaches ${vm?.name_label || 'a workload'} to ${network.name_label || network.bridge || 'the selected network'}.`,
            route: '/networking',
            ref: vifRef,
            uuid: '',
            focusKind: 'network',
            focusClass: 'vif',
            parentName: network.name_label || network.bridge || '',
          };
        })
      );

      const pifResults = (this.resources.networks || []).flatMap((network) =>
        (network.PIFs || []).map((pifRef, index) => {
          const host = (this.resources.hosts || []).find((candidate) => Array.isArray(candidate.PIFs) && candidate.PIFs.includes(pifRef)) || null;
          return {
            kind: 'pif',
            name: `PIF ${host?.name_label || index + 1}`,
            context: `${network.name_label || network.bridge || 'Network'} · ${host?.name_label || 'No mapped host'} · ${host?.address || host?.uuid || 'address unavailable'}`,
            status: host?.enabled ? 'enabled' : (host ? 'warning' : 'info'),
            tags: network.bridge || '-',
            summary: `${pifRef} uplinks ${host?.name_label || 'a host'} into ${network.name_label || network.bridge || 'the selected bridge'}.`,
            route: '/networking',
            ref: pifRef,
            uuid: '',
            focusKind: 'network',
            focusClass: 'pif',
            parentName: network.name_label || network.bridge || '',
          };
        })
      );

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
        ...vdiResults,
        ...vbdResults,
        ...networkResults,
        ...vifResults,
        ...pifResults,
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
          detail: `${this.resources.vdis.length || 0} VDIs plus ${this.filteredResults.filter((item) => ['vbd', 'vif', 'pif'].includes(item.kind)).length} attachment records indexed alongside ${this.resources.alerts.length || 0} alerts and ${this.resources.tasks.length || 0} tasks`,
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

    await this.loadSavedWorkspaces();
    await this.loadInventory();
  },
  methods: {
    formatDateTime,
    visibilityLabel(visibility) {
      return visibility === 'shared' ? 'Shared' : 'Private';
    },
    ownershipLabel(record) {
      if (record.is_owner) return 'Owned by you';
      return `Owner ${record.owner_display_name || record.owner_username}`;
    },
    firstTag(tags) {
      return String(tags || '').split(',').map((value) => value.trim()).find(Boolean) || '';
    },
    applyTag(tag) {
      this.searchQuery = tag;
    },
    navigateToResult(result) {
      this.closeResult();
      this.$router.push(buildFocusedRoute(result.route || '/', {
        kind: result.focusKind || result.kind || '',
        ref: result.ref || '',
        uuid: result.uuid || '',
        name: result.name || '',
        cls: result.focusClass || result.kind || '',
        source: 'inventory',
      }));
    },
    openResult(result) {
      this.selectedResult = result;
      this.showResult = true;
    },
    closeResult() {
      this.showResult = false;
      this.selectedResult = null;
    },
    resolveWorkspaceTargetLabel(workspace) {
      const targetId = Number(workspace?.targetConnectionId || 0);
      if (!targetId) return 'No saved target binding';
      const connection = this.safeConnections.find((entry) => Number(entry.id) === targetId);
      return connection ? `Target ${connection.name || connection.host}` : `Target #${targetId}`;
    },
    findAttachedTarget(connection) {
      const connectionId = Number(connection?.id || 0);
      return (store.connectedTargets || []).find((target) =>
        (connectionId && Number(target.connectionId || 0) === connectionId)
        || (
          String(target.host || '').toLowerCase() === String(connection?.host || '').toLowerCase()
          && String(target.username || '').toLowerCase() === String(connection?.username || '').toLowerCase()
        )
      ) || null;
    },
    isConnectionActive(connection) {
      return Boolean(this.findAttachedTarget(connection)?.active);
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
        const workspace = await api.createInventoryWorkspace({
          name,
          scope: this.activeScope,
          query: this.searchQuery.trim(),
          targetConnectionId: this.workspaceTargetConnectionId ? Number(this.workspaceTargetConnectionId) : null,
          notes: '',
          visibility: this.workspaceVisibility || (store.user ? 'private' : 'shared'),
        });
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
        this.resources = {
          pools: [],
          templates: [],
          vms: [],
          hosts: [],
          srs: [],
          vdis: [],
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
