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
        <div class="live-target-switcher" v-if="store.authenticated" ref="targetShell">
          <button
            type="button"
            class="topnav-target-button"
            :class="{ active: targetPanelOpen }"
            @click="toggleTargetPanel">
            <span class="dot" :class="{ disconnected: !store.connected }"></span>
            <span class="mdi mdi-server-network"></span>
            <span class="topnav-target-copy">
              <strong>{{ targetSummaryLabel }}</strong>
              <span>{{ targetDetailLabel }}</span>
            </span>
            <span class="mdi" :class="targetPanelOpen ? 'mdi-chevron-up' : 'mdi-chevron-down'"></span>
          </button>

          <div v-if="targetPanelOpen" class="topnav-target-panel">
            <div class="topnav-target-panel-head">
              <div>
                <strong>Attached Live Targets</strong>
                <div class="text-muted mono" style="font-size:11px">{{ targetPanelSummary }}</div>
              </div>
              <button class="btn btn-sm" @click="openPools">
                <span class="mdi mdi-server-plus"></span>
                Manage
              </button>
            </div>

            <div class="stack-list" v-if="attachedTargets.length">
              <div class="stack-item" v-for="target in attachedTargets" :key="target.targetKey">
                <div style="display:flex;flex-direction:column;gap:4px;min-width:0;flex:1">
                  <strong>{{ targetLabel(target) }}</strong>
                  <div class="text-muted mono" style="font-size:11px">{{ targetMeta(target) }}</div>
                  <div style="display:flex;gap:6px;flex-wrap:wrap">
                    <span class="badge" :class="target.active ? 'badge-running' : 'badge-info'">
                      {{ target.active ? 'active' : 'attached' }}
                    </span>
                    <span class="badge badge-info" v-if="target.connectionId">saved target</span>
                    <span class="badge badge-info" v-else>direct target</span>
                  </div>
                </div>

                <div class="topnav-target-actions">
                  <button
                    v-if="!target.active"
                    class="btn btn-sm"
                    :disabled="pendingTargetKey === target.targetKey"
                    @click="activateTarget(target)">
                    Activate
                  </button>
                  <button
                    class="btn btn-sm btn-danger"
                    :disabled="pendingTargetKey === target.targetKey"
                    @click="detachTarget(target)">
                    Detach
                  </button>
                </div>
              </div>
            </div>

            <div v-else class="empty-state topnav-target-empty">
              No live Xen targets are attached yet. Open Pools to connect a saved pool or register another host.
            </div>

            <div class="form-error" v-if="targetError" style="text-align:left;margin-top:10px">{{ targetError }}</div>
          </div>
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
    const targetShell = ref(null);
    const targetPanelOpen = ref(false);
    const pendingTargetKey = ref('');
    const targetError = ref('');

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
    const attachedTargets = computed(() => store.connectedTargets || []);
    const activeTarget = computed(() => getActiveLiveTarget(attachedTargets.value));
    const targetSummaryLabel = computed(() => {
      if (store.demoMode) return 'Demo Fabric';
      if (!store.connected) return 'No Xen target';
      return formatLiveTargetLabel(activeTarget.value) || store.host || 'Connected';
    });
    const targetDetailLabel = computed(() => {
      if (store.demoMode) return 'Mock infrastructure attached';
      if (!attachedTargets.value.length) return 'Attach a saved pool or host';
      if (attachedTargets.value.length === 1) {
        return formatLiveTargetMeta(attachedTargets.value[0]);
      }
      return `${attachedTargets.value.length} live targets attached`;
    });
    const targetPanelSummary = computed(() => {
      if (store.demoMode) return 'Mock infrastructure targets are active for the demo session.';
      if (!attachedTargets.value.length) return 'No live Xen sessions are attached to this control-plane login.';
      const current = formatLiveTargetLabel(activeTarget.value) || 'None';
      return `${attachedTargets.value.length} target${attachedTargets.value.length === 1 ? '' : 's'} attached · active ${current}`;
    });

    const targetLabel = (target) => formatLiveTargetLabel(target) || 'Unknown target';
    const targetMeta = (target) => formatLiveTargetMeta(target);

    const closeTargetPanel = () => {
      targetPanelOpen.value = false;
    };

    const onDocumentClick = (event) => {
      if (!targetPanelOpen.value) return;
      if (!targetShell.value?.contains(event.target)) {
        closeTargetPanel();
      }
    };

    const toggleTargetPanel = () => {
      targetPanelOpen.value = !targetPanelOpen.value;
      targetError.value = '';
    };

    const activateTarget = async (target) => {
      pendingTargetKey.value = target.targetKey;
      targetError.value = '';

      try {
        const result = await api.activateLiveTarget({ targetKey: target.targetKey });
        applySessionStatus(result);
      } catch (error) {
        targetError.value = error.message || 'Unable to activate the selected live target';
      } finally {
        pendingTargetKey.value = '';
      }
    };

    const detachTarget = async (target) => {
      pendingTargetKey.value = target.targetKey;
      targetError.value = '';

      try {
        const result = await api.detachLiveTarget(target.targetKey);
        applySessionStatus(result);
      } catch (error) {
        targetError.value = error.message || 'Unable to detach the selected live target';
      } finally {
        pendingTargetKey.value = '';
      }
    };

    const openPools = () => {
      closeTargetPanel();
      router.push('/pools');
    };

    const handleLogout = async () => {
      try {
        await api.logout();
      } catch (error) {
        // Ignore logout cleanup failures during disconnect.
      }

      resetSessionState();
      router.push('/login');
    };

    onMounted(() => {
      document.addEventListener('click', onDocumentClick);
    });

    onBeforeUnmount(() => {
      document.removeEventListener('click', onDocumentClick);
    });

    return {
      activateTarget,
      attachedTargets,
      currentPage,
      detachTarget,
      handleLogout,
      openPools,
      pendingTargetKey,
      roleLabel,
      router,
      store,
      targetDetailLabel,
      targetError,
      targetLabel,
      targetMeta,
      targetPanelOpen,
      targetPanelSummary,
      targetShell,
      targetSummaryLabel,
      toggleTargetPanel,
    };
  },
};
