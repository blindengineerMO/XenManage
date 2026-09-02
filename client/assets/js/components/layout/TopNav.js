const TopNav = {
  components: { AddTargetWindow, ProfileWindow },
  props: ['sidebarOpen'],
  emits: ['toggle-sidebar'],
  template: `
    <nav class="topnav">
      <button class="topnav-toggle" type="button" :aria-label="sidebarOpen ? 'Collapse navigation' : 'Expand navigation'" :aria-expanded="sidebarOpen" @click="$emit('toggle-sidebar')">
        <span class="mdi" :class="sidebarOpen ? 'mdi-menu-open' : 'mdi-menu'"></span>
      </button>
      <div class="topnav-brand">
        <img src="/assets/images/logo.svg" alt="XenMange">
        <span>XenMange</span>
      </div>
      <div class="topnav-breadcrumb" aria-label="Breadcrumb">
        <template v-for="(crumb, index) in breadcrumbTrail" :key="crumb.key">
          <span v-if="crumb.icon" class="mdi" :class="crumb.icon" style="font-size:14px"></span>
          <button v-if="crumb.to && !crumb.current"
                  type="button"
                  class="topnav-breadcrumb-link"
                  @click="navigateBreadcrumb(crumb.to)">
            {{ crumb.label }}
          </button>
          <span v-else class="bc-current" :class="{ 'bc-muted': !crumb.current }">{{ crumb.label }}</span>
          <span v-if="index < breadcrumbTrail.length - 1" class="bc-sep">/</span>
        </template>
      </div>
      <div class="topnav-actions">
        <button class="btn btn-sm" v-if="store.authenticated" @click="openVmCreate" title="New VM (Ctrl/Cmd+N)">
          <span class="mdi mdi-desktop-tower-monitor"></span>
          New VM
        </button>
        <button class="btn btn-sm btn-primary" v-if="store.authenticated" @click="openAddTargetWindow" title="Add Target">
          <span class="mdi mdi-server-plus"></span>
          Add Target
        </button>
        <button class="btn btn-sm" v-if="store.authenticated" @click="openGlobalSearch" title="Search (Ctrl/Cmd+K)">
          <span class="mdi mdi-magnify"></span>
          Search
        </button>
        <button class="btn btn-sm" v-if="store.authenticated" @click="router.push('/governance')">
          <span class="mdi mdi-shield-account-outline"></span>
          {{ roleLabel }}
        </button>
        <button class="btn btn-sm" v-if="store.authenticated" aria-label="My Profile" @click="openProfileWindow" title="My Profile">
          <span class="mdi mdi-account-circle-outline"></span>
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

            <div class="topnav-scope-panel" v-if="attachedTargets.length">
              <div class="topnav-scope-head">
                <div>
                  <strong>Read Scope</strong>
                  <div class="text-muted mono" style="font-size:11px">Aggregate attached members. Writes stay on the active target.</div>
                </div>
                <button class="btn btn-sm" :class="{ 'btn-primary': !store.vFabricScope }" @click="clearScope">Active Target</button>
              </div>
              <button
                v-for="fabric in vFabrics"
                :key="fabric.id"
                class="topnav-scope-option"
                :class="{ active: Number(store.vFabricScope?.scope?.id) === Number(fabric.id) }"
                :disabled="scopePendingId === fabric.id"
                @click="selectVFabricScope(fabric)">
                <span class="dot" :class="'scope-dot-' + (fabric.color_tag || 'green')"></span>
                <span>
                  <strong>{{ fabric.name }}</strong>
                  <small>{{ fabric.members?.length || 0 }} saved member{{ (fabric.members?.length || 0) === 1 ? '' : 's' }}</small>
                </span>
                <span class="mdi mdi-layers-triple-outline"></span>
              </button>
              <div class="text-muted mono" style="font-size:11px" v-if="scopeLoading">Loading vFabric scopes...</div>
              <div class="text-muted mono" style="font-size:11px" v-else-if="!vFabrics.length">No visible vFabrics yet.</div>
              <div class="text-muted mono" style="font-size:11px" v-if="store.vFabricScope?.scope">
                {{ store.vFabricScope.attachedTargets.length }} attached · {{ store.vFabricScope.unavailableMembers.length }} unavailable
              </div>
            </div>

            <div class="form-error" v-if="targetError" style="text-align:left;margin-top:10px">{{ targetError }}</div>
          </div>
        </div>
        <button class="btn btn-sm" v-if="store.authenticated" aria-label="Sign out" title="Sign out" @click="handleLogout">
          <span class="mdi mdi-logout"></span>
        </button>
      </div>
      <add-target-window :show="showAddTargetWindow" @close="showAddTargetWindow = false"></add-target-window>
      <profile-window :show="showProfileWindow" @close="showProfileWindow = false"></profile-window>
    </nav>
  `,
  setup() {
    const router = useRouter();
    const route = useRoute();
    const targetShell = ref(null);
    const targetPanelOpen = ref(false);
    const pendingTargetKey = ref('');
    const targetError = ref('');
    const showAddTargetWindow = ref(false);
    const showProfileWindow = ref(false);
    const vFabrics = ref([]);
    const scopeLoading = ref(false);
    const scopePendingId = ref(null);

    const breadcrumbTrail = computed(() => buildTopNavBreadcrumbs(route));
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
      if (targetPanelOpen.value) loadVFabrics();
    };

    const loadVFabrics = async () => {
      scopeLoading.value = true;
      try {
        const result = await api.getVFabrics();
        vFabrics.value = Array.isArray(result) ? result : (result?.data || []);
      } catch (error) {
        targetError.value = error.message || 'Unable to load vFabric scopes';
      } finally {
        scopeLoading.value = false;
      }
    };

    const clearScope = () => {
      clearVFabricScope();
      targetError.value = '';
    };

    const selectVFabricScope = async (fabric) => {
      scopePendingId.value = fabric.id;
      targetError.value = '';
      try {
        const result = await api.getVFabricScope(fabric.id);
        if (!result?.attachedTargets?.length) {
          throw new Error(`${fabric.name} has no attached live members in this session.`);
        }
        store.vFabricScope = result;
      } catch (error) {
        targetError.value = error.message || 'Unable to select the vFabric scope';
      } finally {
        scopePendingId.value = null;
      }
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

    const navigateBreadcrumb = (to) => {
      if (!to) return;
      router.push(to);
    };

    const openGlobalSearch = () => {
      const query = route.path === '/inventory'
        ? cleanRouteQuery({ ...route.query, focusSearch: '1' })
        : { focusSearch: '1' };
      router.push({ path: '/inventory', query });
    };

    const openAddTargetWindow = () => {
      showAddTargetWindow.value = true;
    };

    const openProfileWindow = () => {
      showProfileWindow.value = true;
    };

    const openVmCreate = () => {
      router.push({ path: '/vms', query: { create: '1' } });
    };

    const isEditableTarget = (target) => {
      const tagName = String(target?.tagName || '').toLowerCase();
      return target?.isContentEditable || ['input', 'textarea', 'select'].includes(tagName);
    };

    const onShortcutKeydown = (event) => {
      if (!store.authenticated || event.defaultPrevented) return;
      if (isEditableTarget(event.target)) return;

      const key = String(event.key || '').toLowerCase();
      const hasPrimaryModifier = event.metaKey || event.ctrlKey;
      if (!hasPrimaryModifier || event.altKey) return;

      if (key === 'k') {
        event.preventDefault();
        openGlobalSearch();
        return;
      }

      if (key === 'n') {
        event.preventDefault();
        if (store.connected) {
          openVmCreate();
        } else {
          openAddTargetWindow();
          if (route.path === '/login') {
            router.push('/pools');
          }
        }
      }
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
      document.addEventListener('keydown', onShortcutKeydown);
    });

    onBeforeUnmount(() => {
      document.removeEventListener('click', onDocumentClick);
      document.removeEventListener('keydown', onShortcutKeydown);
    });

    return {
      activateTarget,
      attachedTargets,
      breadcrumbTrail,
      clearScope,
      detachTarget,
      handleLogout,
      navigateBreadcrumb,
      openAddTargetWindow,
      openGlobalSearch,
      openPools,
      openProfileWindow,
      openVmCreate,
      pendingTargetKey,
      roleLabel,
      router,
      showAddTargetWindow,
      showProfileWindow,
      scopeLoading,
      scopePendingId,
      selectVFabricScope,
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
      vFabrics,
    };
  },
};
