const routes = [
  { path: '/login', component: LoginView },
  { path: '/', component: DashboardView },
  { path: '/pools', component: PoolsView },
  { path: '/templates', component: TemplatesView },
  { path: '/vms', component: VMsView },
  { path: '/hosts', component: HostsView },
  { path: '/storage', component: StorageView },
  { path: '/networking', component: NetworkingView },
  { path: '/inventory', component: InventoryView },
  { path: '/governance', component: GovernanceView },
  { path: '/settings', component: SettingsView },
  { path: '/lifecycle', component: LifecycleView },
  { path: '/capacity', component: CapacityView },
  { path: '/resilience', component: ResilienceView },
  { path: '/alerts', component: AlertsView },
  { path: '/activity', component: ActivityView },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach((to, from, next) => {
  if (!store.ready) {
    next();
    return;
  }

  if (to.path !== '/login' && !store.authenticated) {
    next('/login');
    return;
  }

  if (to.path === '/login' && store.authenticated) {
    next(store.connected ? '/' : '/pools');
    return;
  }

  next();
});

const app = createApp({
  components: { TopNav, SideNav, StatusBar },
  template: `
    <div>
      <div v-if="!store.ready" class="boot-shell">
        <div class="boot-panel animate-scale-in">
          <img src="/assets/images/logo.svg" alt="XenMange">
          <h1>XenMange</h1>
          <p>{{ store.bootMessage }}</p>
          <span class="loading-spinner"></span>
        </div>
      </div>

      <template v-else-if="store.authenticated">
        <top-nav :sidebar-open="store.sidebarOpen" @toggle-sidebar="store.sidebarOpen = !store.sidebarOpen"></top-nav>
        <side-nav :collapsed="!store.sidebarOpen"></side-nav>
        <main class="main-content" :class="{ expanded: !store.sidebarOpen }">
          <router-view></router-view>
        </main>
        <status-bar></status-bar>
      </template>

      <template v-else>
        <router-view></router-view>
      </template>
    </div>
  `,
  setup() {
    return { store };
  },
});

app.use(router);
app.mount('#app');

async function bootstrapSession() {
  const bootstrap = window.__XENMANGE_BOOTSTRAP__;
  store.bootMessage = 'Verifying session state';

  if (bootstrap && typeof bootstrap === 'object') {
    applySessionStatus({
      ...bootstrap,
      demoMode: false,
    });
    store.bootMessage = store.authenticated ? 'Restoring control surface' : 'Preparing connection console';
  } else {
    try {
      const status = await api.status();
      applySessionStatus(status);
      store.bootMessage = status.authenticated ? 'Restoring control surface' : 'Preparing connection console';
    } catch (error) {
      resetSessionState();
      store.bootMessage = 'Preparing connection console';
    }
  }

  store.ready = true;

  if (store.authenticated && router.currentRoute.value.path === '/login') {
    router.replace(store.connected ? '/' : '/pools');
  }

  if (!store.authenticated && router.currentRoute.value.path !== '/login') {
    router.replace('/login');
  }
}

bootstrapSession();
