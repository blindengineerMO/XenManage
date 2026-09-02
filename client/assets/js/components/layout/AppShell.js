const AppShell = {
  components: { TopNav, SideNav, StatusBar, ConfirmWindow, UndoBar },
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
        <a class="skip-link" href="#workspace-main">Skip to workspace content</a>
        <top-nav :sidebar-open="store.sidebarOpen" @toggle-sidebar="store.sidebarOpen = !store.sidebarOpen"></top-nav>
        <side-nav :collapsed="!store.sidebarOpen"></side-nav>
        <main id="workspace-main" class="main-content" :class="{ expanded: !store.sidebarOpen }" tabindex="-1">
          <nav v-if="workspaceTabs.length" class="workspace-tabs" aria-label="Open workspaces">
            <div class="workspace-tabs-scroller">
              <div v-for="tab in workspaceTabs"
                   :key="tab.path"
                   class="workspace-tab"
                   :class="{ active: tab.path === route.path }"
                   role="tab"
                   tabindex="0"
                   :aria-selected="tab.path === route.path"
                   @click="openWorkspace(tab.path)"
                   @keydown.enter.prevent="openWorkspace(tab.path)"
                   @keydown.space.prevent="openWorkspace(tab.path)">
                <span class="mdi" :class="tab.icon"></span>
                <span class="workspace-tab-label">{{ tab.label }}</span>
                <button type="button"
                      class="workspace-tab-close"
                      :aria-label="'Close ' + tab.label"
                      @click.stop="closeWorkspace(tab.path)"
                      @keydown.enter.stop.prevent="closeWorkspace(tab.path)">
                  <span class="mdi mdi-close"></span>
                </button>
              </div>
            </div>
          </nav>
          <router-view v-slot="{ Component, route: viewRoute }">
            <keep-alive>
              <component :is="Component" :key="workspaceCacheKey(viewRoute)"></component>
            </keep-alive>
          </router-view>
        </main>
        <status-bar></status-bar>
      </template>

      <template v-else>
        <router-view></router-view>
      </template>

      <confirm-window
        :show="globalConfirmState.show"
        :title="globalConfirmState.title"
        :message="globalConfirmState.message"
        :confirm-label="globalConfirmState.confirmLabel"
        :danger="globalConfirmState.danger"
        @close="respondToGlobalConfirm(false)"
        @confirm="respondToGlobalConfirm(true)">
      </confirm-window>

      <undo-bar
        :show="globalUndoState.show"
        :title="globalUndoState.title"
        :message="globalUndoState.message"
        :seconds-remaining="globalUndoState.secondsRemaining"
        @undo="respondToGlobalUndo">
      </undo-bar>
    </div>
  `,
  setup() {
    const routerInstance = useRouter();
    const route = useRoute();
    const workspaceTabs = reactive([]);
    const defaultWorkspace = '/';
    const mobileNavigation = window.matchMedia('(max-width: 760px)');

    const collapseNavigationOnMobile = (event) => {
      if (event.matches) store.sidebarOpen = false;
    };

    collapseNavigationOnMobile(mobileNavigation);
    mobileNavigation.addEventListener('change', collapseNavigationOnMobile);

    const routeIcon = (path) => ({
      '/': 'mdi-view-dashboard-outline',
      '/pools': 'mdi-server-network',
      '/templates': 'mdi-content-copy',
      '/template-library': 'mdi-folder-multiple-outline',
      '/catalog': 'mdi-storefront-outline',
      '/applications': 'mdi-apps',
      '/vms': 'mdi-desktop-tower',
      '/hosts': 'mdi-server',
      '/storage': 'mdi-database',
      '/networking': 'mdi-lan',
      '/inventory': 'mdi-magnify',
      '/vfabrics': 'mdi-layers-triple-outline',
      '/governance': 'mdi-shield-account-outline',
      '/settings': 'mdi-cog-outline',
      '/lifecycle': 'mdi-calendar-clock-outline',
      '/capacity': 'mdi-chart-donut',
      '/resilience': 'mdi-shield-check-outline',
      '/alerts': 'mdi-bell-outline',
      '/activity': 'mdi-pulse',
    }[path] || 'mdi-view-grid-outline');

    const ensureWorkspace = (targetRoute) => {
      if (!store.authenticated || targetRoute.path === '/login') return;
      const existing = workspaceTabs.find((tab) => tab.path === targetRoute.path);
      if (existing) return;
      workspaceTabs.push({
        path: targetRoute.path,
        label: resolveAppRouteLabel(targetRoute.path),
        icon: routeIcon(targetRoute.path),
      });
    };

    const openWorkspace = (path) => {
      if (path !== route.path) routerInstance.push(path);
    };

    const closeWorkspace = (path) => {
      const index = workspaceTabs.findIndex((tab) => tab.path === path);
      if (index < 0) return;
      const wasActive = route.path === path;
      workspaceTabs.splice(index, 1);
      if (!wasActive) return;
      const nextTab = workspaceTabs[index] || workspaceTabs[index - 1];
      routerInstance.push(nextTab?.path || defaultWorkspace);
    };

    const workspaceCacheKey = (targetRoute) => targetRoute.path;
    ensureWorkspace(route);
    const removeRouteHook = routerInstance.afterEach((targetRoute) => ensureWorkspace(targetRoute));

    const respondToGlobalConfirm = (confirmed) => {
      settleGlobalConfirm(confirmed);
    };
    const respondToGlobalUndo = () => settleGlobalUndo(false);

    onBeforeUnmount(() => {
      removeRouteHook();
      mobileNavigation.removeEventListener('change', collapseNavigationOnMobile);
    });

    return {
      globalConfirmState,
      globalUndoState,
      respondToGlobalConfirm,
      respondToGlobalUndo,
      store,
      route,
      workspaceTabs,
      openWorkspace,
      closeWorkspace,
      workspaceCacheKey,
    };
  },
};
