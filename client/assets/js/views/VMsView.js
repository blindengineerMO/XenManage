const VMsView = {
  components: {
    DataTable,
    StatusBadge,
    'vm-properties-window': VMPropertiesWindow,
    'vm-import-window': VMImportWindow,
  },
  template: `
    <div class="animate-fade-in">
      <div class="section-head">
        <div>
          <h2 class="section-title">
            <span class="mdi mdi-desktop-tower"></span>
            Virtual Machines
          </h2>
          <p class="section-subtitle">Searchable VM inventory with a richer operator detail workspace for placement, attached resources, and configuration tasks.</p>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-sm" @click="openImportWindow">
            <span class="mdi mdi-package-up"></span>
            Import XVA
          </button>
          <button class="btn btn-primary" @click="loadVMs">
            <span class="mdi mdi-refresh"></span>
            Refresh
          </button>
        </div>
      </div>

      <div class="dash-card" v-if="selectedVmRows.length" style="margin-bottom:16px">
        <div class="dash-card-label">Batch VM Actions</div>
        <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap">
          <div>
            <strong>{{ selectedVmRows.length }} VMs selected</strong>
            <div class="text-muted mono" style="font-size:11px;margin-top:4px">{{ selectedVmSelectionSummary }}</div>
          </div>
          <div class="dashboard-hero-rail" style="gap:8px">
            <button class="btn btn-sm btn-primary"
                    v-if="selectedVmStateCounts.halted"
                    :disabled="Boolean(bulkActionBusy)"
                    @click="applyBulkVmAction('start')">
              <span class="mdi mdi-play"></span>
              {{ bulkActionBusy === 'start' ? 'Starting...' : `Start Selected (${selectedVmStateCounts.halted})` }}
            </button>
            <button class="btn btn-sm"
                    v-if="selectedVmStateCounts.running"
                    :disabled="Boolean(bulkActionBusy)"
                    @click="applyBulkVmAction('shutdown')">
              <span class="mdi mdi-stop"></span>
              {{ bulkActionBusy === 'shutdown' ? 'Stopping...' : `Shutdown Selected (${selectedVmStateCounts.running})` }}
            </button>
            <button class="btn btn-sm"
                    v-if="selectedVmStateCounts.running"
                    :disabled="Boolean(bulkActionBusy)"
                    @click="applyBulkVmAction('reboot')">
              <span class="mdi mdi-restart"></span>
              {{ bulkActionBusy === 'reboot' ? 'Rebooting...' : `Reboot Selected (${selectedVmStateCounts.running})` }}
            </button>
            <button class="btn btn-sm"
                    v-if="selectedVmStateCounts.running"
                    :disabled="Boolean(bulkActionBusy)"
                    @click="applyBulkVmAction('suspend')">
              <span class="mdi mdi-pause"></span>
              {{ bulkActionBusy === 'suspend' ? 'Suspending...' : `Suspend Selected (${selectedVmStateCounts.running})` }}
            </button>
            <button class="btn btn-sm btn-primary"
                    v-if="selectedVmStateCounts.suspended"
                    :disabled="Boolean(bulkActionBusy)"
                    @click="applyBulkVmAction('resume')">
              <span class="mdi mdi-play-circle-outline"></span>
              {{ bulkActionBusy === 'resume' ? 'Resuming...' : `Resume Selected (${selectedVmStateCounts.suspended})` }}
            </button>
            <button class="btn btn-sm" :disabled="Boolean(bulkActionBusy)" @click="clearVmSelection">Clear Selection</button>
          </div>
        </div>
        <div class="form-error" v-if="bulkError" style="text-align:left;margin-top:12px">{{ bulkError }}</div>
      </div>

      <data-table :columns="columns"
                  :data="vms"
                  :loading="loading"
                  :searchable="true"
                  :selectable="true"
                  :selected-keys="selectedVmRefs"
                  row-key="ref"
                  @selection-change="handleVmSelectionChange"
                  @row-click="openProperties">
        <template #cell-name_label="{ row }">
          <span style="color:var(--text-primary);font-weight:500">{{ row.name_label || 'Unnamed' }}</span>
        </template>
        <template #cell-power_state="{ row }">
          <status-badge :status="row.power_state"></status-badge>
        </template>
        <template #cell-VCPUs_at_startup="{ row }">
          <span class="mono">{{ row.VCPUs_at_startup || 0 }}</span>
        </template>
        <template #cell-memory_static_max="{ row }">
          <span class="mono">{{ formatBytes(row.memory_static_max) }}</span>
        </template>
      </data-table>

      <vm-properties-window
        :show="showProps"
        :selected-vm="selectedVM"
        :selected-vm-compute-profile="selectedVmComputeProfile"
        :selected-vm-host="selectedVmHost"
        :action-busy="actionBusy"
        :tabs="tabs"
        :active-tab="activeTab"
        :action-error="actionError"
        :detail-loading="detailLoading"
        :detail-error="detailError"
        :vm-tab-models="vmTabModels"
        @close="showProps = false"
        @update-active-tab="activeTab = $event"
        @vm-action="handleVmWindowAction"
        @launch-console="launchConsole"
        @migration-target-change="handleMigrationTargetChange"
        @submit-vm-migration="submitVMMigration"
        @export-selected-vm="exportSelectedVM"
        @submit-vm-duplicate="submitVMDuplicate"
        @submit-vm-snapshot="submitVMSnapshot"
        @snapshot-action="handleVmSnapshotAction"
        @submit-vm-config="submitVmConfig"
        @submit-disk-device="submitDiskDevice"
        @submit-nic-device="submitNicDevice">
      </vm-properties-window>

      <vm-import-window
        :show-import-window="showImportWindow"
        :import-error="importError"
        :import-status-message="importStatusMessage"
        :import-storage-options="importStorageOptions"
        :import-saving="importSaving"
        @close="closeImportWindow"
        @submit-vm-import="submitVMImport">
      </vm-import-window>
    </div>
  `,
  data() {
    return {
      loading: true,
      vms: [],
      showProps: false,
      showImportWindow: false,
      selectedVM: null,
      detailLoading: false,
      detailError: null,
      actionError: null,
      actionBusy: '',
      importSaving: false,
      importError: null,
      importStatusMessage: '',
      exportBusy: '',
      configSaving: false,
      diskSaving: false,
      nicSaving: false,
      migrationSaving: false,
      migrationDestinationLoading: false,
      migrationDestinationError: null,
      migrationDestinationTargetKey: '',
      migrationDestinationHosts: [],
      migrationDestinationPools: [],
      migrationDestinationStorage: [],
      migrationDestinationNetworks: [],
      duplicateSaving: false,
      snapshotSaving: false,
      activeTab: 'overview',
      lastAppliedFocusKey: '',
      automationTasks: [],
      migrationSeed: null,
      migrationSourceTask: null,
      selectedVmRefs: [],
      bulkActionBusy: '',
      bulkError: null,
      relatedHosts: [],
      relatedPools: [],
      relatedAppliances: [],
      relatedSnapshotSchedules: [],
      relatedStorage: [],
      relatedNetworks: [],
      relatedVdis: [],
      vmCompatibility: { hosts: [], lastBootCpuFlags: {}, possibleHostRefs: [], hardwarePlatformVersion: 0, maskingApiAvailable: false },
      vmConsoles: [],
      vmSnapshots: [],
      vmMetricHistory: { metrics: [] },
      snapshotBusy: '',
      tabs: [
        { key: 'overview', label: 'Overview', icon: 'mdi-card-account-details-outline' },
        { key: 'resources', label: 'Resources', icon: 'mdi-vector-link' },
        { key: 'compatibility', label: 'Compatibility', icon: 'mdi-chip' },
        { key: 'console', label: 'Console', icon: 'mdi-monitor-dashboard' },
        { key: 'migration', label: 'Migration', icon: 'mdi-swap-horizontal-bold' },
        { key: 'portability', label: 'Import / Export', icon: 'mdi-package-variant-closed' },
        { key: 'duplicate', label: 'Clone / Copy', icon: 'mdi-content-copy' },
        { key: 'protection', label: 'Protection', icon: 'mdi-camera-timer' },
        { key: 'config', label: 'Config', icon: 'mdi-tune-variant' },
        { key: 'devices', label: 'Add Devices', icon: 'mdi-plus-box-multiple-outline' },
      ],
      columns: [
        { key: 'name_label', label: 'Name' },
        { key: 'power_state', label: 'State' },
        { key: 'VCPUs_at_startup', label: 'vCPUs' },
        { key: 'memory_static_max', label: 'Memory' },
        { key: 'uuid', label: 'UUID' },
      ],
      diskColumns: [
        { key: 'name_label', label: 'Disk' },
        { key: 'storageName', label: 'Storage' },
        { key: 'virtual_size', label: 'Capacity' },
        { key: 'type', label: 'Type' },
        { key: 'ref', label: 'Reference' },
      ],
      networkColumns: [
        { key: 'name_label', label: 'Network' },
        { key: 'bridge', label: 'Bridge' },
        { key: 'vlan', label: 'VLAN' },
        { key: 'managed', label: 'State' },
        { key: 'ref', label: 'Reference' },
      ],
      compatibilityColumns: [
        { key: 'name_label', label: 'Host' },
        { key: 'readiness', label: 'Readiness' },
        { key: 'compatible', label: 'Placement' },
        { key: 'cpuModel', label: 'CPU Model' },
        { key: 'compatibilityError', label: 'Operator Note' },
      ],
    };
  },
  computed: {
    currentTargetKey() {
      return String(store.currentTargetKey || '').trim();
    },
    selectedVmRows() {
      return filterSelectedVmRows(this.vms, this.selectedVmRefs);
    },
    selectedVmStateCounts() {
      return countSelectedVmStates(this.selectedVmRows);
    },
    selectedVmSelectionSummary() {
      return summarizeSelectedVmStates(this.selectedVmStateCounts);
    },
    migrationInitialDraft() {
      return this.migrationSeed ? { ...this.migrationSeed } : null;
    },
    migrationTargetOptions() {
      return (Array.isArray(store.connectedTargets) ? store.connectedTargets : [])
        .filter((target) => String(target?.targetKey || '').trim())
        .filter((target) => String(target.targetKey || '').trim() !== this.currentTargetKey);
    },
    migrationDestinationTargetLabel() {
      const target = this.migrationTargetOptions.find((entry) => entry.targetKey === this.migrationDestinationTargetKey) || null;
      return target ? (target.connectionName || target.host || target.targetKey) : '';
    },
    selectedVmHost() {
      return findSelectedVmHost(this.selectedVM, this.relatedHosts);
    },
    selectedVmAffinityHost() {
      return findSelectedVmAffinityHost(this.selectedVM, this.relatedHosts);
    },
    selectedVmAffinityLabel() {
      return formatSelectedVmAffinityLabel(this.selectedVM, this.selectedVmAffinityHost);
    },
    selectedVmAppliance() {
      return resolveSelectedVmLinkedRecord(this.selectedVM?.appliance, this.relatedAppliances);
    },
    selectedVmApplianceVmCount() {
      return countVmLinkedRecordMembers(this.selectedVmAppliance);
    },
    selectedVmApplianceSummary() {
      return summarizeVmLinkedRecord(this.selectedVmAppliance, 'None');
    },
    selectedVmApplianceDetail() {
      return formatSelectedVmApplianceDetail(this.selectedVmAppliance);
    },
    selectedVmSnapshotSchedule() {
      return resolveSelectedVmLinkedRecord(this.selectedVM?.snapshot_schedule, this.relatedSnapshotSchedules);
    },
    selectedVmSnapshotScheduleEnabled() {
      return isVmLinkedRecordEnabled(this.selectedVmSnapshotSchedule);
    },
    selectedVmSnapshotScheduleVmCount() {
      return countVmLinkedRecordMembers(this.selectedVmSnapshotSchedule);
    },
    selectedVmSnapshotScheduleSummary() {
      return summarizeVmLinkedRecord(this.selectedVmSnapshotSchedule, 'None');
    },
    selectedVmSnapshotScheduleDetail() {
      return formatSelectedVmSnapshotScheduleDetail(this.selectedVmSnapshotSchedule);
    },
    selectedVmProtectionPolicy() {
      return resolveSelectedVmProtectionPolicy(this.selectedVM);
    },
    selectedVmProtectionPolicySummary() {
      return this.selectedVmProtectionPolicy || 'None / not reported';
    },
    selectedVmProtectionPolicyDetail() {
      return formatSelectedVmProtectionPolicyDetail(this.selectedVmProtectionPolicy);
    },
    selectedVmGuestMetricsProfile() {
      return buildSelectedVmGuestMetricsProfile(this.selectedVM, formatDateTime);
    },
    selectedVmRecommendationsProfile() {
      return buildSelectedVmRecommendationsProfile(this.selectedVM);
    },
    selectedVmComputeProfile() {
      return buildSelectedVmComputeProfile(this.selectedVM);
    },
    selectedVmPlatformProfile() {
      return buildSelectedVmPlatformProfile(this.selectedVM);
    },
    selectedVmRecordSummaryProfile() {
      return buildSelectedVmRecordSummaryProfile(this.selectedVM);
    },
    selectedVmPool() {
      return findSelectedVmPool(this.selectedVmHost, this.relatedPools);
    },
    selectedVmPoolMigrationCompressionEnabled() {
      return resolveVmPoolMigrationCompressionEnabled(this.selectedVmPool);
    },
    attachedVmDisks() {
      return buildAttachedVmDisks(this.selectedVM, this.relatedVdis, this.relatedStorage);
    },
    attachedVmNetworks() {
      return buildAttachedVmNetworks(this.selectedVM, this.relatedNetworks);
    },
    migrationHostOptions() {
      return buildSelectedVmMigrationHostOptions({
        vm: this.selectedVM,
        selectedVmHost: this.selectedVmHost,
        selectedVmPool: this.selectedVmPool,
        hosts: this.relatedHosts,
      });
    },
    vmConfigHostOptions() {
      return buildSelectedVmConfigHostOptions({
        vm: this.selectedVM,
        selectedVmPool: this.selectedVmPool,
        hosts: this.relatedHosts,
      });
    },
    importStorageOptions() {
      return Array.isArray(this.relatedStorage) ? this.relatedStorage : [];
    },
    vmTabModels() {
      return buildVmTabModels(this);
    },
  },
  async mounted() {
    if (!store.authenticated) {
      this.$router.push('/login');
      return;
    }
    await this.loadVMs();
    await this.syncRouteFocus();
  },
  watch: {
    '$route.query': {
      deep: true,
      async handler() {
        await this.syncRouteFocus();
      },
    },
    vms() {
      this.selectedVmRefs = filterValidSelectedVmRefs(this.selectedVmRefs, this.vms);
    },
  },
  methods: {
    formatBytes,
    formatThroughput,
    formatDateTime,
    truncateList,
    downloadBlob(content, type, filename) {
      const blob = content instanceof Blob ? content : new Blob([content], { type });
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      window.URL.revokeObjectURL(url);
    },
    async loadVMs() {
      this.loading = true;
      try {
        this.vms = await loadVmRecords(api);
      } catch (error) {
        console.error(error);
      } finally {
        this.loading = false;
      }
      await this.syncRouteFocus();
    },
    handleVmSelectionChange(keys) {
      this.selectedVmRefs = normalizeSelectedVmRefs(keys);
      this.bulkError = null;
    },
    clearVmSelection() {
      this.selectedVmRefs = [];
      this.bulkError = null;
    },
    async ensureAutomationTasksLoaded(force = false) {
      if (!force && this.automationTasks.length) return;

      this.automationTasks = await loadVmAutomationTasks(api);
    },
    async openProperties(row, options = {}) {
      const workspaceState = buildVmPropertiesWorkspaceState(row, options);
      // Render the selected VM immediately; detail requests must not delay the window itself.
      this.selectedVM = workspaceState.selectedVM;
      this.showProps = workspaceState.showProps;
      this.activeTab = workspaceState.activeTab;
      this.actionError = workspaceState.actionError;
      this.exportBusy = workspaceState.exportBusy;
      this.migrationSeed = workspaceState.migrationSeed;
      this.migrationSourceTask = workspaceState.migrationSourceTask;
      await this.$nextTick();

      if (!row?.ref) {
        Object.assign(this, buildVmDetailErrorState('Unable to open VM detail without a VM reference.'));
        return;
      }

      await this.loadVmDetail(row.ref);

      if (workspaceState.migrationSeed?.mode === 'cross-pool' && workspaceState.migrationSeed.destinationTargetKey) {
        await this.ensureMigrationDestinationContext(workspaceState.migrationSeed.destinationTargetKey);
      }
    },
    async ensureImportContext() {
      try {
        Object.assign(this, await loadVmInventoryContext(api));
      } catch (error) {
        this.importError = error.message || 'Unable to load import targets';
      }
    },
    resetMigrationDestinationContext() {
      Object.assign(this, createEmptyVmMigrationDestinationState());
    },
    async loadMigrationDestinationContext(targetKey = '') {
      const normalizedTargetKey = String(targetKey || '').trim();
      if (!normalizedTargetKey) {
        this.resetMigrationDestinationContext();
        return;
      }

      Object.assign(this, buildVmMigrationDestinationLoadingState(normalizedTargetKey));

      try {
        const inventory = await loadVmInventoryContext(api, normalizedTargetKey);
        Object.assign(this, buildVmMigrationDestinationInventoryState(normalizedTargetKey, inventory));
      } catch (error) {
        Object.assign(this, buildVmMigrationDestinationErrorState(error.message));
      } finally {
        this.migrationDestinationLoading = false;
      }
    },
    async ensureMigrationDestinationContext(preferredTargetKey = '') {
      const nextTargetKey = resolveVmMigrationDestinationTargetKey(
        preferredTargetKey,
        this.migrationDestinationTargetKey,
        this.migrationTargetOptions
      );
      if (!nextTargetKey) {
        this.resetMigrationDestinationContext();
        return;
      }

      if (this.migrationDestinationTargetKey === nextTargetKey && hasVmMigrationDestinationInventory(this)) {
        return;
      }

      await this.loadMigrationDestinationContext(nextTargetKey);
    },
    async handleMigrationTargetChange(targetKey) {
      await this.loadMigrationDestinationContext(targetKey);
    },
    async openImportWindow() {
      await this.ensureImportContext();
      Object.assign(this, buildVmImportWindowOpenState());
    },
    closeImportWindow() {
      Object.assign(this, buildVmImportWindowClosedState());
    },
    async loadVmDetail(ref) {
      Object.assign(this, createVmDetailLoadingState());
      try {
        const detailContext = await loadVmDetailContext(api, ref);
        Object.assign(this, buildVmDetailWorkspaceState(detailContext, this.selectedVM));
        await this.ensureMigrationDestinationContext();
      } catch (error) {
        Object.assign(this, buildVmDetailErrorState(error.message));
        this.resetMigrationDestinationContext();
      } finally {
        Object.assign(this, buildVmDetailLoadingCompleteState());
      }
    },
    async refreshVmDetail(ref) {
      await this.loadVMs();
      this.selectedVM = findRefreshedVmRecord(this.vms, ref, this.selectedVM);
      await this.loadVmDetail(ref);
    },
    async syncRouteFocus() {
      const result = await syncVmRouteFocusWorkflow({
        routeQuery: this.$route.query,
        loading: this.loading,
        vms: this.vms,
        lastAppliedFocusKey: this.lastAppliedFocusKey,
        automationTasks: this.automationTasks,
        loadTasks: async (force = false, currentTasks = []) => {
          if (!force && currentTasks.length) return currentTasks;
          const nextTasks = await loadVmAutomationTasks(api);
          this.automationTasks = nextTasks;
          return nextTasks;
        },
        openProperties: (vm, options) => this.openProperties(vm, options),
      });

      this.lastAppliedFocusKey = result.lastAppliedFocusKey;
      this.automationTasks = result.automationTasks;
    },
    async syncMigrationSourceTaskStatus(status, result) {
      const syncResult = await syncVmMigrationSourceTaskWorkflow({
        api,
        migrationSourceTask: this.migrationSourceTask,
        automationTasks: this.automationTasks,
        status,
        result,
        username: store.username || '',
      });
      this.automationTasks = syncResult.automationTasks;
      this.migrationSourceTask = syncResult.migrationSourceTask;
    },
    getEligibleBatchVms(action) {
      return getEligibleVmBatchActionTargets(action, this.selectedVmRows);
    },
    async performVmAction(action, ref, options = {}) {
      const approvalId = await this.resolveGovernanceApproval(action, ref);
      return executeVmPowerAction(api, action, ref, options, approvalId);
    },
    async handleVmWindowAction(payload) {
      if (!payload?.action || !payload?.ref) return;
      await this.vmAction(payload.action, payload.ref, payload.options || {});
    },
    async handleVmSnapshotAction(payload) {
      if (!payload?.action || !payload?.snapshot) return;
      await this.snapshotAction(payload.action, payload.snapshot);
    },
    async vmAction(action, ref, options = {}) {
      this.actionError = null;
      this.actionBusy = buildVmActionBusyKey(action, options);
      try {
        await this.performVmAction(action, ref, options);
        await this.refreshVmDetail(ref);
      } catch (error) {
        if (error.code === 'APPROVAL_REQUIRED') {
          this.actionError = buildVmActionApprovalErrorMessage();
          await handoffToGovernanceApproval(
            this.$router,
            error.approvalDraft,
            'Approval required before continuing this VM power operation.'
          );
          return;
        }
        this.actionError = error.message || 'Action failed';
      } finally {
        this.actionBusy = '';
      }
    },
    async applyBulkVmAction(action, options = {}) {
      const targets = this.getEligibleBatchVms(action);
      if (!targets.length) {
        this.bulkError = buildVmBatchIneligibleMessage();
        return;
      }

      this.bulkError = null;
      this.bulkActionBusy = buildVmActionBusyKey(action, options);

      try {
        await executeBulkVmPowerAction(targets, (vm) => this.performVmAction(action, vm.ref, options));
      } catch (error) {
        if (error.code === 'APPROVAL_REQUIRED') {
          this.bulkError = buildVmBulkActionApprovalErrorMessage();
          await handoffToGovernanceApproval(
            this.$router,
            error.approvalDraft,
            'Approval required before continuing this bulk VM power operation.'
          );
          return;
        }

        this.bulkError = buildVmBatchActionFailureMessage(error.completed || 0, error.message);
        return;
      } finally {
        this.bulkActionBusy = '';
      }

      await this.loadVMs();

      if (shouldRefreshSelectedVmAfterBulk(this.selectedVM?.ref, targets)) {
        this.selectedVM = refreshSelectedVmAfterBulkAction(this.vms, this.selectedVM);
        await this.loadVmDetail(this.selectedVM.ref);
      }
    },
    async resolveGovernanceApproval(action, ref, target = null) {
      return resolveVmActionApprovalId(action, ref, target, this.vms, this.selectedVM, resolveGovernanceApproval);
    },
    async submitVmConfig(payload) {
      if (!this.selectedVM) return;

      this.actionError = null;
      this.configSaving = true;
      try {
        const updated = await saveVmConfigRecord(api, this.selectedVM.ref, payload);
        this.selectedVM = { ...this.selectedVM, ...(updated || {}) };
        await this.refreshVmDetail(this.selectedVM.ref);
      } catch (error) {
        this.actionError = error.message || 'Unable to save VM configuration';
      } finally {
        this.configSaving = false;
      }
    },
    async submitDiskDevice(payload) {
      if (!this.selectedVM) return;

      this.actionError = null;
      this.diskSaving = true;
      try {
        const result = await attachVmDiskDevice(api, this.selectedVM.ref, payload);
        const nextState = applyVmDiskAttachmentResult(this.selectedVM, this.relatedVdis, payload, result);
        this.selectedVM = nextState.selectedVM;
        this.relatedVdis = nextState.relatedVdis;
      } catch (error) {
        this.actionError = error.message || 'Unable to add virtual disk';
      } finally {
        this.diskSaving = false;
      }
    },
    async submitNicDevice(payload) {
      if (!this.selectedVM) return;

      this.actionError = null;
      this.nicSaving = true;
      try {
        const result = await attachVmNicDevice(api, this.selectedVM.ref, payload);
        const nextState = applyVmNicAttachmentResult(this.selectedVM, this.relatedNetworks, payload, result);
        this.selectedVM = nextState.selectedVM;
        this.relatedNetworks = nextState.relatedNetworks;
      } catch (error) {
        this.actionError = error.message || 'Unable to add virtual NIC';
      } finally {
        this.nicSaving = false;
      }
    },
    async submitVMDuplicate(payload) {
      if (!this.selectedVM) return;

      this.actionError = null;
      this.duplicateSaving = true;
      try {
        const record = await duplicateVmRecord(api, this.selectedVM.ref, payload);
        await this.loadVMs();
        const created = this.vms.find((entry) => entry.ref === record?.ref) || record;
        if (created?.ref) {
          await this.openProperties(created);
        } else {
          await this.refreshVmDetail(this.selectedVM.ref);
          this.activeTab = 'duplicate';
        }
      } catch (error) {
        this.actionError = error.message || 'Unable to create VM clone or full copy';
      } finally {
        this.duplicateSaving = false;
      }
    },
    async exportSelectedVM(metadataOnly = false) {
      if (!this.selectedVM?.ref) return;

      this.actionError = null;
      this.exportBusy = metadataOnly ? 'metadata' : 'full';
      try {
        const result = await exportVmArchive(api, this.selectedVM.ref, metadataOnly);
        this.downloadBlob(
          result.blob,
          result.contentType || 'application/octet-stream',
          buildVmExportFilename(result, metadataOnly)
        );
      } catch (error) {
        this.actionError = error.message || 'Unable to export virtual machine';
      } finally {
        this.exportBusy = '';
      }
    },
    launchConsole(consoleRecord) {
      const launchUrl = String(consoleRecord?.launchUrl || '').trim();
      if (!launchUrl) {
        this.actionError = 'No console launch endpoint was available for this record.';
        return;
      }

      const launched = window.open(launchUrl, '_blank', 'noopener');
      if (!launched) {
        this.actionError = 'The browser blocked the console window. Allow pop-ups for XenMange and try again.';
      }
    },
    async submitVMMigration(payload) {
      if (!this.selectedVM) return;

      this.actionError = null;
      this.migrationSaving = true;
      let taskSyncError = null;
      try {
        const record = await migrateVmRecord(api, this.selectedVM.ref, payload);
        const result = buildVmMigrationCompletionMessage(this.selectedVM, payload, record);

        try {
          await this.syncMigrationSourceTaskStatus('success', result);
        } catch (error) {
          taskSyncError = error;
        }

        if (payload.mode === 'cross-pool' && record?.destinationTargetKey) {
          const status = await api.activateLiveTarget({ targetKey: record.destinationTargetKey }).catch(() => null);
          if (status) {
            applySessionStatus(status);
          }

          await this.loadVMs();
          const migratedVm = findMigratedVmRecord(this.vms, record);

          if (migratedVm) {
            await this.openProperties(migratedVm);
            this.activeTab = 'migration';
            if (taskSyncError) {
              this.actionError = buildVmMigrationTaskSyncErrorMessage();
            }
            return;
          }
        }

        await this.refreshVmDetail(record?.destinationVmRef || this.selectedVM.ref);
        this.activeTab = 'migration';

        if (taskSyncError) {
          this.actionError = buildVmMigrationTaskSyncErrorMessage();
        }
      } catch (error) {
        this.actionError = error.message || 'Unable to migrate the VM';
      } finally {
        this.migrationSaving = false;
      }
    },
    async submitVMImport(payload) {
      this.importError = null;
      this.importStatusMessage = '';
      this.importSaving = true;
      try {
        const result = await importVmArchive(api, payload);
        await this.loadVMs();
        const importedVm = result?.importedVm?.ref
          ? this.vms.find((entry) => entry.ref === result.importedVm.ref) || result.importedVm
          : null;
        this.importStatusMessage = buildVmImportCompletionMessage(result, payload);

        if (importedVm?.ref) {
          this.showImportWindow = false;
          await this.openProperties(importedVm);
          this.activeTab = 'portability';
        }
      } catch (error) {
        this.importError = error.message || 'Unable to import virtual machine';
      } finally {
        this.importSaving = false;
      }
    },
    async submitVMSnapshot(payload) {
      if (!this.selectedVM) return;

      this.actionError = null;
      this.snapshotSaving = true;
      try {
        await createVmSnapshotRecord(api, this.selectedVM.ref, payload);
        await this.refreshVmDetail(this.selectedVM.ref);
        this.activeTab = 'protection';
      } catch (error) {
        this.actionError = error.message || 'Unable to create VM snapshot';
      } finally {
        this.snapshotSaving = false;
      }
    },
    async snapshotAction(action, snapshot) {
      if (!this.selectedVM || !snapshot?.ref) return;

      this.actionError = null;
      this.snapshotBusy = buildVmSnapshotBusyKey(action, snapshot.ref);
      try {
        const approvalId = await this.resolveGovernanceApproval(action, this.selectedVM.ref, snapshot);
        await executeVmSnapshotRecordAction(api, action, this.selectedVM.ref, snapshot.ref, approvalId);
        await this.refreshVmDetail(this.selectedVM.ref);
        this.activeTab = 'protection';
      } catch (error) {
        if (error.code === 'APPROVAL_REQUIRED') {
          this.actionError = buildVmSnapshotApprovalErrorMessage();
          await handoffToGovernanceApproval(
            this.$router,
            error.approvalDraft,
            'Approval required before continuing this snapshot action.'
          );
          return;
        }
        this.actionError = error.message || 'Unable to complete snapshot action';
      } finally {
        this.snapshotBusy = '';
      }
    },
  },
};
