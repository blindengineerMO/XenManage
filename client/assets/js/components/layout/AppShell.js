const AppShell = {
  components: { TopNav, SideNav, StatusBar, ConfirmWindow },
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

      <confirm-window
        :show="globalConfirmState.show"
        :title="globalConfirmState.title"
        :message="globalConfirmState.message"
        :confirm-label="globalConfirmState.confirmLabel"
        :danger="globalConfirmState.danger"
        @close="respondToGlobalConfirm(false)"
        @confirm="respondToGlobalConfirm(true)">
      </confirm-window>
    </div>
  `,
  setup() {
    const respondToGlobalConfirm = (confirmed) => {
      settleGlobalConfirm(confirmed);
    };

    return {
      globalConfirmState,
      respondToGlobalConfirm,
      store,
    };
  },
};
