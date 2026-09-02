const SideNav = {
  props: ['collapsed'],
  template: `
    <aside class="sidenav" :class="{ collapsed }">
      <div class="sidenav-header" v-if="!collapsed">Navigation</div>
      <div class="sidenav-tree">
        <div class="tree-item" role="link" tabindex="0" aria-label="Dashboard" :aria-current="$route.path === '/' ? 'page' : null" :class="{ active: $route.path === '/' }" @click="$router.push('/')" @keydown.enter.prevent="$router.push('/')" @keydown.space.prevent="$router.push('/')">
          <span class="mdi mdi-view-dashboard"></span>
          <span class="tree-label" v-if="!collapsed">Dashboard</span>
        </div>
        <div class="tree-item" role="link" tabindex="0" aria-label="Pools" :aria-current="$route.path === '/pools' ? 'page' : null" :class="{ active: $route.path === '/pools' }" @click="$router.push('/pools')" @keydown.enter.prevent="$router.push('/pools')" @keydown.space.prevent="$router.push('/pools')">
          <span class="mdi mdi-source-branch"></span>
          <span class="tree-label" v-if="!collapsed">Pools</span>
          <span class="tree-count" v-if="!collapsed && inventory.pools.length">{{ inventory.pools.length }}</span>
        </div>
        <div class="tree-item" role="link" tabindex="0" aria-label="Templates" :aria-current="$route.path === '/templates' ? 'page' : null" :class="{ active: $route.path === '/templates' }" @click="$router.push('/templates')" @keydown.enter.prevent="$router.push('/templates')" @keydown.space.prevent="$router.push('/templates')">
          <span class="mdi mdi-file-document-multiple-outline"></span>
          <span class="tree-label" v-if="!collapsed">Templates</span>
          <span class="tree-count" v-if="!collapsed && inventory.templates.length">{{ inventory.templates.length }}</span>
        </div>
        <div class="tree-item" role="link" tabindex="0" aria-label="Template Library" :aria-current="$route.path === '/template-library' ? 'page' : null" :class="{ active: $route.path === '/template-library' }" @click="$router.push('/template-library')" @keydown.enter.prevent="$router.push('/template-library')" @keydown.space.prevent="$router.push('/template-library')">
          <span class="mdi mdi-code-json"></span>
          <span class="tree-label" v-if="!collapsed">Template Library</span>
        </div>
        <div class="tree-item" role="link" tabindex="0" aria-label="Catalog" :aria-current="$route.path === catalogPath ? 'page' : null" :class="{ active: $route.path === catalogPath }" @click="$router.push(catalogPath)" @keydown.enter.prevent="$router.push(catalogPath)" @keydown.space.prevent="$router.push(catalogPath)">
          <span class="mdi mdi-storefront-outline"></span>
          <span class="tree-label" v-if="!collapsed">Catalog</span>
        </div>
        <div class="tree-item" role="link" tabindex="0" aria-label="Applications" :aria-current="$route.path === '/applications' ? 'page' : null" :class="{ active: $route.path === '/applications' }" @click="$router.push('/applications')" @keydown.enter.prevent="$router.push('/applications')" @keydown.space.prevent="$router.push('/applications')">
          <span class="mdi mdi-apps"></span>
          <span class="tree-label" v-if="!collapsed">Applications</span>
        </div>
        <div class="tree-item" role="link" tabindex="0" aria-label="Virtual Machines" :aria-current="$route.path === '/vms' ? 'page' : null" :class="{ active: $route.path === '/vms' }" @click="$router.push('/vms')" @keydown.enter.prevent="$router.push('/vms')" @keydown.space.prevent="$router.push('/vms')">
          <span class="mdi mdi-desktop-tower"></span>
          <span class="tree-label" v-if="!collapsed">Virtual Machines</span>
          <span class="tree-count" v-if="!collapsed && inventory.vms.length">{{ inventory.vms.length }}</span>
        </div>
        <div class="tree-item" role="link" tabindex="0" aria-label="Hosts" :aria-current="$route.path === '/hosts' ? 'page' : null" :class="{ active: $route.path === '/hosts' }" @click="$router.push('/hosts')" @keydown.enter.prevent="$router.push('/hosts')" @keydown.space.prevent="$router.push('/hosts')">
          <span class="mdi mdi-server"></span>
          <span class="tree-label" v-if="!collapsed">Hosts</span>
          <span class="tree-count" v-if="!collapsed && inventory.hosts.length">{{ inventory.hosts.length }}</span>
        </div>
        <div class="tree-item" role="link" tabindex="0" aria-label="Storage" :aria-current="$route.path === '/storage' ? 'page' : null" :class="{ active: $route.path === '/storage' }" @click="$router.push('/storage')" @keydown.enter.prevent="$router.push('/storage')" @keydown.space.prevent="$router.push('/storage')">
          <span class="mdi mdi-harddisk"></span>
          <span class="tree-label" v-if="!collapsed">Storage</span>
          <span class="tree-count" v-if="!collapsed && inventory.srs.length">{{ inventory.srs.length }}</span>
        </div>
        <div class="tree-item" role="link" tabindex="0" aria-label="Networking" :aria-current="$route.path === '/networking' ? 'page' : null" :class="{ active: $route.path === '/networking' }" @click="$router.push('/networking')" @keydown.enter.prevent="$router.push('/networking')" @keydown.space.prevent="$router.push('/networking')">
          <span class="mdi mdi-lan"></span>
          <span class="tree-label" v-if="!collapsed">Networking</span>
          <span class="tree-count" v-if="!collapsed && inventory.networks.length">{{ inventory.networks.length }}</span>
        </div>
        <div class="tree-item" role="link" tabindex="0" aria-label="Inventory" :aria-current="$route.path === '/inventory' ? 'page' : null" :class="{ active: $route.path === '/inventory' }" @click="$router.push('/inventory')" @keydown.enter.prevent="$router.push('/inventory')" @keydown.space.prevent="$router.push('/inventory')">
          <span class="mdi mdi-sitemap-outline"></span>
          <span class="tree-label" v-if="!collapsed">Inventory</span>
        </div>
        <div class="tree-item" role="link" tabindex="0" aria-label="vFabrics" :aria-current="$route.path === '/vfabrics' ? 'page' : null" :class="{ active: $route.path === '/vfabrics' }" @click="$router.push('/vfabrics')" @keydown.enter.prevent="$router.push('/vfabrics')" @keydown.space.prevent="$router.push('/vfabrics')">
          <span class="mdi mdi-vector-combine"></span>
          <span class="tree-label" v-if="!collapsed">vFabrics</span>
        </div>
        <div class="tree-item" role="link" tabindex="0" aria-label="Governance" :aria-current="$route.path === '/governance' ? 'page' : null" :class="{ active: $route.path === '/governance' }" @click="$router.push('/governance')" @keydown.enter.prevent="$router.push('/governance')" @keydown.space.prevent="$router.push('/governance')">
          <span class="mdi mdi-shield-account-outline"></span>
          <span class="tree-label" v-if="!collapsed">Governance</span>
        </div>
        <div class="tree-item" role="link" tabindex="0" aria-label="Settings" :aria-current="$route.path === '/settings' ? 'page' : null" :class="{ active: $route.path === '/settings' }" @click="$router.push('/settings')" @keydown.enter.prevent="$router.push('/settings')" @keydown.space.prevent="$router.push('/settings')">
          <span class="mdi mdi-tune-variant"></span>
          <span class="tree-label" v-if="!collapsed">Settings</span>
        </div>
        <div class="tree-item" role="link" tabindex="0" aria-label="Lifecycle" :aria-current="$route.path === '/lifecycle' ? 'page' : null" :class="{ active: $route.path === '/lifecycle' }" @click="$router.push('/lifecycle')" @keydown.enter.prevent="$router.push('/lifecycle')" @keydown.space.prevent="$router.push('/lifecycle')">
          <span class="mdi mdi-shield-sync-outline"></span>
          <span class="tree-label" v-if="!collapsed">Lifecycle</span>
        </div>
        <div class="tree-item" role="link" tabindex="0" aria-label="Capacity" :aria-current="$route.path === '/capacity' ? 'page' : null" :class="{ active: $route.path === '/capacity' }" @click="$router.push('/capacity')" @keydown.enter.prevent="$router.push('/capacity')" @keydown.space.prevent="$router.push('/capacity')">
          <span class="mdi mdi-chart-areaspline"></span>
          <span class="tree-label" v-if="!collapsed">Capacity</span>
        </div>
        <div class="tree-item" role="link" tabindex="0" aria-label="Resilience" :aria-current="$route.path === '/resilience' ? 'page' : null" :class="{ active: $route.path === '/resilience' }" @click="$router.push('/resilience')" @keydown.enter.prevent="$router.push('/resilience')" @keydown.space.prevent="$router.push('/resilience')">
          <span class="mdi mdi-shield-lock-outline"></span>
          <span class="tree-label" v-if="!collapsed">Resilience</span>
        </div>
        <div class="tree-item" role="link" tabindex="0" aria-label="Alerts" :aria-current="$route.path === '/alerts' ? 'page' : null" :class="{ active: $route.path === '/alerts' }" @click="$router.push('/alerts')" @keydown.enter.prevent="$router.push('/alerts')" @keydown.space.prevent="$router.push('/alerts')">
          <span class="mdi mdi-bell-alert-outline"></span>
          <span class="tree-label" v-if="!collapsed">Alerts</span>
        </div>
        <div class="tree-item" role="link" tabindex="0" aria-label="Activity" :aria-current="$route.path === '/activity' ? 'page' : null" :class="{ active: $route.path === '/activity' }" @click="$router.push('/activity')" @keydown.enter.prevent="$router.push('/activity')" @keydown.space.prevent="$router.push('/activity')">
          <span class="mdi mdi-timeline-clock-outline"></span>
          <span class="tree-label" v-if="!collapsed">Activity</span>
        </div>

        <div v-if="!collapsed" class="tree-section">
          <div class="tree-section-label">Live Inventory</div>

          <div class="tree-item tree-item-subtle" role="link" tabindex="0" aria-label="Pool Records" @click="$router.push('/pools')" @keydown.enter.prevent="$router.push('/pools')" @keydown.space.prevent="$router.push('/pools')">
            <span class="mdi mdi-source-branch"></span>
            <span class="tree-label">Pool Records</span>
            <span class="tree-count">{{ inventory.pools.length }}</span>
          </div>
          <div class="tree-children" v-if="false">
            <div class="tree-empty" v-if="inventoryLoading">Syncing live pool records...</div>
            <div class="tree-item tree-item-child"
                 v-for="pool in inventory.pools.slice(0, 6)"
                 :key="pool.ref"
                 @click="$router.push('/pools')">
              <span class="mdi mdi-database-outline"></span>
              <span class="tree-label">{{ pool.name_label || 'Unnamed Pool' }}</span>
            </div>
          </div>

          <div class="tree-item tree-item-subtle" role="link" tabindex="0" aria-label="Live Template Library" @click="$router.push('/templates')" @keydown.enter.prevent="$router.push('/templates')" @keydown.space.prevent="$router.push('/templates')">
            <span class="mdi mdi-file-document-multiple-outline"></span>
            <span class="tree-label">Template Library</span>
            <span class="tree-count">{{ inventory.templates.length }}</span>
          </div>
          <div class="tree-children" v-if="false">
            <div class="tree-empty" v-if="inventoryLoading">Syncing template catalog...</div>
            <div class="tree-item tree-item-child"
                 v-for="template in inventory.templates.slice(0, 6)"
                 :key="template.ref"
                 @click="$router.push('/templates')">
              <span class="mdi mdi-file-document-outline"></span>
              <span class="tree-label">{{ template.name_label || 'Template' }}</span>
            </div>
          </div>

          <div class="tree-item tree-item-subtle" role="link" tabindex="0" aria-label="Host Records" @click="$router.push('/hosts')" @keydown.enter.prevent="$router.push('/hosts')" @keydown.space.prevent="$router.push('/hosts')">
            <span class="mdi mdi-server"></span>
            <span class="tree-label">Host Records</span>
            <span class="tree-count">{{ inventory.hosts.length }}</span>
          </div>
          <div class="tree-children" v-if="false">
            <div class="tree-empty" v-if="inventoryLoading">Syncing live host records...</div>
            <div class="tree-item tree-item-child"
                 v-for="host in inventory.hosts.slice(0, 8)"
                 :key="host.ref"
                 @click="$router.push('/hosts')">
              <span class="mdi" :class="host.enabled ? 'mdi-check-decagram text-green' : 'mdi-alert-circle text-amber'"></span>
              <span class="tree-label">{{ host.name_label || host.hostname || 'Host' }}</span>
            </div>
          </div>

          <div class="tree-item tree-item-subtle" role="link" tabindex="0" aria-label="Storage Repositories" @click="$router.push('/storage')" @keydown.enter.prevent="$router.push('/storage')" @keydown.space.prevent="$router.push('/storage')">
            <span class="mdi mdi-harddisk"></span>
            <span class="tree-label">Storage Repositories</span>
            <span class="tree-count">{{ inventory.srs.length }}</span>
          </div>
          <div class="tree-children" v-if="false">
            <div class="tree-empty" v-if="inventoryLoading">Syncing storage inventory...</div>
            <div class="tree-item tree-item-child"
                 v-for="sr in inventory.srs.slice(0, 6)"
                 :key="sr.ref"
                 @click="$router.push('/storage')">
              <span class="mdi mdi-harddisk"></span>
              <span class="tree-label">{{ sr.name_label || 'Storage Repo' }}</span>
            </div>
          </div>

          <div class="tree-item tree-item-subtle" role="link" tabindex="0" aria-label="Network Fabrics" @click="$router.push('/networking')" @keydown.enter.prevent="$router.push('/networking')" @keydown.space.prevent="$router.push('/networking')">
            <span class="mdi mdi-lan"></span>
            <span class="tree-label">Network Fabrics</span>
            <span class="tree-count">{{ inventory.networks.length }}</span>
          </div>
          <div class="tree-children" v-if="false">
            <div class="tree-empty" v-if="inventoryLoading">Syncing network inventory...</div>
            <div class="tree-item tree-item-child"
                 v-for="network in inventory.networks.slice(0, 8)"
                 :key="network.ref"
                 @click="$router.push('/networking')">
              <span class="mdi mdi-lan"></span>
              <span class="tree-label">{{ network.name_label || network.bridge || 'Network' }}</span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  `,
  data() {
    return {
      catalogPath,
      inventoryLoading: false,
      inventory: {
        pools: [],
        templates: [],
        vms: [],
        hosts: [],
        srs: [],
        networks: [],
      },
      expandedGroups: {
        pools: true,
        templates: false,
        hosts: false,
        storage: false,
        networks: false,
      },
    };
  },
  mounted() {
    this.loadInventory();
  },
  methods: {
    toggleGroup(name) {
      this.expandedGroups[name] = !this.expandedGroups[name];
    },
    async loadInventory() {
      if (!store.authenticated) return;

      this.inventoryLoading = true;

      try {
        const [pools, templates, vms, hosts, srs, networks] = await Promise.all([
          api.getPools().catch(() => ({ data: [] })),
          api.getTemplates().catch(() => ({ data: [] })),
          api.getVMs().catch(() => ({ data: [] })),
          api.getHosts().catch(() => ({ data: [] })),
          api.getSRs().catch(() => ({ data: [] })),
          api.getNetworks().catch(() => ({ data: [] })),
        ]);

        this.inventory = {
          pools: pools.data || [],
          templates: templates.data || [],
          vms: vms.data || [],
          hosts: hosts.data || [],
          srs: srs.data || [],
          networks: networks.data || [],
        };
      } catch (error) {
        // Keep navigation usable even if inventory refresh fails.
      } finally {
        this.inventoryLoading = false;
      }
    },
  },
  watch: {
    'store.authenticated'() {
      this.loadInventory();
    },
  },
};
