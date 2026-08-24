const TopNav = {
  props: ['sidebarOpen'],
  emits: ['toggle-sidebar'],
  template: `
    <nav class="topnav">
      <button class="topnav-toggle" @click="$emit('toggle-sidebar')">
        <span class="mdi" :class="sidebarOpen ? 'mdi-menu-open' : 'mdi-menu'"></span>
      </button>
      <div class="topnav-brand">
        <img src="/assets/images/logo.svg" alt="XenMange">
        <span>XenMange</span>
      </div>
      <div class="topnav-breadcrumb">
        <span class="mdi mdi-home" style="font-size:14px"></span>
        <span class="bc-sep">/</span>
        <span class="bc-current">{{ currentPage }}</span>
      </div>
      <div class="topnav-actions">
        <button class="btn btn-sm" v-if="store.authenticated" @click="router.push('/governance')">
          <span class="mdi mdi-shield-account-outline"></span>
          {{ roleLabel }}
        </button>
        <div class="topnav-status">
          <span class="dot" :class="{ disconnected: !store.authenticated }"></span>
          <span>{{ store.authenticated ? store.host : 'Disconnected' }}</span>
        </div>
        <button class="btn btn-sm" v-if="store.authenticated" @click="handleLogout">
          <span class="mdi mdi-logout"></span>
        </button>
      </div>
    </nav>
  `,
  setup() {
    const router = useRouter();
    const route = useRoute();
    const currentPage = computed(() => {
      const names = {
        '/': 'Dashboard',
        '/login': 'Connection',
        '/pools': 'Pools',
        '/templates': 'Templates',
        '/vms': 'Virtual Machines',
        '/hosts': 'Hosts',
        '/storage': 'Storage',
        '/networking': 'Networking',
        '/inventory': 'Inventory',
        '/governance': 'Governance',
        '/lifecycle': 'Lifecycle',
        '/capacity': 'Capacity',
        '/resilience': 'Resilience',
        '/alerts': 'Alerts',
        '/activity': 'Activity',
      };
      return names[route.path] || route.path;
    });
    const roleLabel = computed(() => {
      const value = store.governance?.currentRole || 'admin';
      if (value === 'read-only') return 'Read Only';
      if (value === 'operator') return 'Operator';
      return 'Admin';
    });

    const handleLogout = async () => {
      try {
        await api.logout();
      } catch (error) {
        // Ignore logout cleanup failures during disconnect.
      }

      store.authenticated = false;
      store.demoMode = false;
      store.host = '';
      store.username = '';
      store.governance = {
        currentRole: 'admin',
        policy: {
          defaultRole: 'admin',
          requireDestructiveApproval: true,
          approvalTtlMinutes: 240,
        },
      };
      router.push('/login');
    };

    return { currentPage, handleLogout, roleLabel, router, store };
  },
};
