const StorageView = {
  components: {
    DataTable,
    FloatingWindow,
    StatusBadge,
    StoragePropertiesWindow,
    StorageCreateSrWindow,
    StorageWorkspaceDialogs,
  },
  template: `
    <div class="animate-fade-in">
      <div class="section-head">
        <div>
          <h2 class="section-title">
            <span class="mdi mdi-harddisk"></span>
            Storage Repositories
          </h2>
          <p class="section-subtitle">Capacity visibility with VDI-to-workload attachment mapping inside the operator detail pane.</p>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-sm" @click="showCreateSrWindow = true">
            <span class="mdi mdi-database-plus-outline"></span>
            Create Storage Repository
          </button>
          <button class="btn btn-primary" @click="loadSRs">
            <span class="mdi mdi-refresh"></span>
            Refresh
          </button>
        </div>
      </div>

      <div class="stack-item" v-if="workspaceMessage" style="margin-bottom:16px">
        <div>
          <strong>Workspace updated</strong>
          <div class="text-muted mono" style="font-size:11px">{{ workspaceMessage }}</div>
        </div>
        <span class="badge badge-running">ready</span>
      </div>

      <div class="dash-card" v-if="storageSelectionProfile.rows.length" style="margin-bottom:16px">
        <div class="dash-card-label">Batch Storage Actions</div>
        <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap">
          <div>
            <strong>{{ storageSelectionProfile.rows.length }} repositories selected</strong>
            <div class="text-muted mono" style="font-size:11px;margin-top:4px">{{ storageSelectionProfile.summary }}</div>
          </div>
          <div class="dashboard-hero-rail" style="gap:8px">
            <button class="btn btn-sm btn-primary"
                    :disabled="Boolean(bulkActionBusy)"
                    @click="applyBulkStorageAction('rescan')">
              <span class="mdi mdi-refresh-circle"></span>
              {{ bulkActionBusy === 'rescan' ? 'Rescanning...' : `Rescan Selected (${storageSelectionProfile.rows.length})` }}
            </button>
            <button class="btn btn-sm"
                    v-if="storageSelectionProfile.forgetReady.length"
                    :disabled="Boolean(bulkActionBusy)"
                    @click="applyBulkStorageAction('forget')">
              <span class="mdi mdi-database-remove-outline"></span>
              {{ bulkActionBusy === 'forget' ? 'Forgetting...' : `Forget Selected (${storageSelectionProfile.forgetReady.length})` }}
            </button>
            <button class="btn btn-sm btn-danger"
                    v-if="storageSelectionProfile.destroyReady.length"
                    :disabled="Boolean(bulkActionBusy)"
                    @click="applyBulkStorageAction('destroy')">
              <span class="mdi mdi-delete-outline"></span>
              {{ bulkActionBusy === 'destroy' ? 'Destroying...' : `Destroy Selected (${storageSelectionProfile.destroyReady.length})` }}
            </button>
            <button class="btn btn-sm" :disabled="Boolean(bulkActionBusy)" @click="clearSrSelection">Clear Selection</button>
          </div>
        </div>
        <div class="text-muted mono" v-if="storageSelectionProfile.destroyBlocked.length" style="font-size:11px;margin-top:12px">
          {{ storageSelectionProfile.destroyBlocked.length }} selected repositor{{ storageSelectionProfile.destroyBlocked.length === 1 ? 'y remains' : 'ies remain' }} non-empty and cannot be batch-destroyed yet.
        </div>
        <div class="text-muted mono" v-if="storageSelectionProfile.destroyUnknown.length" style="font-size:11px;margin-top:6px">
          {{ storageSelectionProfile.destroyUnknown.length }} selected repositor{{ storageSelectionProfile.destroyUnknown.length === 1 ? 'y needs' : 'ies need' }} disk inventory detail before destroy eligibility can be confirmed.
        </div>
        <div class="form-error" v-if="bulkError" style="text-align:left;margin-top:12px">{{ bulkError }}</div>
      </div>

      <data-table :columns="columns"
                  :data="srs"
                  :loading="loading"
                  :searchable="true"
                  :selectable="true"
                  :selected-keys="selectedSrRefs"
                  row-key="ref"
                  @selection-change="handleSrSelectionChange"
                  @row-click="openProperties">
        <template #cell-name_label="{ row }">
          <span style="color:var(--text-primary);font-weight:500">{{ row.name_label || 'Unnamed' }}</span>
        </template>
        <template #cell-type="{ row }">
          <span class="badge badge-info">{{ row.type || 'unknown' }}</span>
        </template>
        <template #cell-physical_size="{ row }">
          <span class="mono">{{ formatBytes(row.physical_size) }}</span>
        </template>
        <template #cell-virtual_allocation="{ row }">
          <span class="mono">{{ formatBytes(row.virtual_allocation) }}</span>
        </template>
      </data-table>

      <storage-properties-window
        :show="showProps"
        :selected-sr="selectedSR"
        :vdis="vdis"
        :related-vms="relatedVMs"
        :storage-detail-profile="storageDetailProfile"
        :detail-loading="detailLoading"
        :detail-error="detailError"
        :detail-action-busy="detailActionBusy"
        :detail-action-error="detailActionError"
        :detail-action-message="detailActionMessage"
        :focused-vdi-ref="focusedVdiRef"
        :focused-vdi-uuid="focusedVdiUuid"
        :focused-vbd-ref="focusedVbdRef"
        :focused-storage-class="focusedStorageClass"
        @close="clearSelectedStorageDetail"
        @open-sr-identity="showSrIdentityWindow = true"
        @open-sr-actions="showSrActionsWindow = true"
        @open-sr-create-vdi="showSrCreateVdiWindow = true"
        @open-sr-resize-vdi="showSrResizeVdiWindow = true"
        @delete-vdi="deleteSelectedVdi"
        @open-vm-workspace="openVmWorkspace"
        @open-host-workspace="openHostWorkspace">
      </storage-properties-window>

      <storage-workspace-dialogs
        :selected-sr="selectedSR"
        :storage-detail-profile="storageDetailProfile"
        :related-vms="relatedVMs"
        :vdis="vdis"
        :focused-vdi-ref="focusedVdiRef"
        :detail-action-busy="detailActionBusy"
        :local-cache-host-ref="localCacheHostRef"
        :show-sr-identity-window="showSrIdentityWindow"
        :show-sr-actions-window="showSrActionsWindow"
        :show-sr-create-vdi-window="showSrCreateVdiWindow"
        :show-sr-resize-vdi-window="showSrResizeVdiWindow"
        @close-sr-identity="showSrIdentityWindow = false"
        @close-sr-actions="showSrActionsWindow = false"
        @close-sr-create-vdi="showSrCreateVdiWindow = false"
        @close-sr-resize-vdi="showSrResizeVdiWindow = false"
        @submit-sr-config="submitSelectedSrConfig"
        @apply-detail-storage-action="applyDetailStorageAction"
        @update:local-cache-host-ref="localCacheHostRef = $event"
        @toggle-local-cache="toggleSelectedSrLocalCache"
        @forget-sr="forgetSelectedSr"
        @destroy-sr="destroySelectedSr"
        @submit-detached-vdi="submitDetachedVdi"
        @submit-resize-vdi="submitResizeVdi">
      </storage-workspace-dialogs>

      <storage-create-sr-window
        :show="showCreateSrWindow"
        :available-hosts="availableHosts"
        :create-sr-busy="createSrBusy"
        :create-sr-probe-busy="createSrProbeBusy"
        :create-sr-error="createSrError"
        :create-sr-probe-error="createSrProbeError"
        :create-sr-import-error="createSrImportError"
        :create-sr-probe-result="createSrProbeResult"
        :create-sr-probe-request="createSrProbeRequest"
        :create-sr-import-busy-key="createSrImportBusyKey"
        @close="showCreateSrWindow = false"
        @submit="submitStorageRepository"
        @probe="probeStorageRepository"
        @introduce-probed-sr="introduceProbedSr">
      </storage-create-sr-window>
    </div>
  `,
  data() {
    return {
      loading: true,
      srs: [],
      selectedSR: null,
      showCreateSrWindow: false,
      showProps: false,
      showSrIdentityWindow: false,
      showSrActionsWindow: false,
      showSrCreateVdiWindow: false,
      showSrResizeVdiWindow: false,
      detailLoading: false,
      detailError: '',
      vdis: [],
      relatedVMs: [],
      relatedHosts: [],
      availableHosts: [],
      focusedVdiRef: '',
      focusedVdiUuid: '',
      focusedVbdRef: '',
      focusedStorageClass: '',
      selectedSrRefs: [],
      bulkActionBusy: '',
      bulkError: null,
      detailActionBusy: '',
      detailActionError: '',
      detailActionMessage: '',
      createSrBusy: false,
      createSrError: '',
      createSrProbeBusy: false,
      createSrProbeError: '',
      createSrProbeResult: null,
      createSrProbeRequest: null,
      createSrImportBusyKey: '',
      createSrImportError: '',
      workspaceMessage: '',
      localCacheHostRef: '',
      lastAppliedFocusKey: '',
      columns: [
        { key: 'name_label', label: 'Name' },
        { key: 'type', label: 'Type' },
        { key: 'physical_size', label: 'Physical Size' },
        { key: 'virtual_allocation', label: 'Virtual Allocation' },
        { key: 'uuid', label: 'UUID' },
      ],
    };
  },
  computed: {
    storageSelectionProfile() {
      return buildStorageSelectionProfile(this.srs, this.selectedSrRefs);
    },
    storageDetailProfile() {
      return buildStorageDetailProfile({
        selectedSR: this.selectedSR,
        vdis: this.vdis,
        relatedVMs: this.relatedVMs,
        relatedHosts: this.relatedHosts,
        detailLoading: this.detailLoading,
        localCacheHostRef: this.localCacheHostRef,
        focusedVdiRef: this.focusedVdiRef,
        focusedVdiUuid: this.focusedVdiUuid,
        focusedVbdRef: this.focusedVbdRef,
        focusedStorageClass: this.focusedStorageClass,
      });
    },
  },
  async mounted() {
    if (!store.authenticated) {
      this.$router.push('/login');
      return;
    }
    await Promise.all([this.loadSRs(), this.loadCreateHosts()]);
  },
  watch: {
    '$route.query': {
      deep: true,
      async handler() {
        await this.syncRouteFocus();
      },
    },
    srs() {
      const validRefs = new Set(this.srs.map((sr) => sr.ref));
      this.selectedSrRefs = this.selectedSrRefs.filter((ref) => validRefs.has(ref));
    },
  },
  methods: {
    formatBytes,
    summarizeCount,
    truncateList,
    async loadCreateHosts() {
      try {
        const result = await api.getHosts();
        this.availableHosts = result.data || [];
      } catch (_error) {
        this.availableHosts = [];
      }
    },
    async loadSRs() {
      this.loading = true;
      try {
        const result = await api.getSRs();
        this.srs = result.data || [];
      } catch (error) {
        console.error(error);
      } finally {
        this.loading = false;
      }
      await this.syncRouteFocus();
    },
    handleSrSelectionChange(keys) {
      this.selectedSrRefs = Array.isArray(keys) ? keys : [];
      this.bulkError = null;
    },
    clearSrSelection() {
      this.selectedSrRefs = [];
      this.bulkError = null;
    },
    async submitStorageRepository(payload) {
      this.workspaceMessage = '';
      this.createSrError = '';
      this.createSrProbeError = '';
      this.createSrImportError = '';
      this.createSrBusy = true;

      try {
        const record = await api.createSR(payload);
        const targetHost = this.availableHosts.find((host) => host.ref === payload.hostRef);
        await this.loadSRs();
        this.createSrProbeResult = null;
        this.createSrProbeRequest = null;
        this.showCreateSrWindow = false;
        this.workspaceMessage = `${record.name_label || payload.nameLabel} was created on ${targetHost?.name_label || payload.hostRef}.`;
        const created = this.srs.find((entry) => entry.ref === record.ref) || record;
        if (created?.ref) {
          await this.openProperties(created, { hosts: this.availableHosts });
        }
      } catch (error) {
        this.createSrError = error.message || 'Unable to create the requested storage repository.';
      } finally {
        this.createSrBusy = false;
      }
    },
    async probeStorageRepository(payload) {
      this.workspaceMessage = '';
      this.createSrError = '';
      this.createSrProbeError = '';
      this.createSrImportError = '';
      this.createSrProbeBusy = true;

      try {
        this.createSrProbeRequest = { ...payload };
        this.createSrProbeResult = await api.probeSR(payload);
      } catch (error) {
        this.createSrProbeRequest = null;
        this.createSrProbeResult = null;
        this.createSrProbeError = error.message || 'Unable to probe the requested storage configuration.';
      } finally {
        this.createSrProbeBusy = false;
      }
    },
    buildProbeResultKey(result, index) {
      return result?.sr?.uuid || result?.sr?.name_label || `probe-${index}`;
    },
    isSharedStorageType(type) {
      return ['nfs', 'lvmoiscsi'].includes(String(type || '').trim());
    },
    canIntroduceProbedSr(result) {
      return Boolean(this.createSrProbeRequest?.hostRef && result?.complete && result?.sr?.uuid);
    },
    async introduceProbedSr(result, index) {
      if (!this.canIntroduceProbedSr(result)) {
        this.createSrImportError = 'Probe results must include a complete discovered SR with a UUID before it can be introduced.';
        return;
      }

      const probeRequest = this.createSrProbeRequest || {};
      const probeKey = this.buildProbeResultKey(result, index);
      const payload = {
        hostRef: probeRequest.hostRef,
        uuid: result.sr.uuid,
        nameLabel: result.sr.name_label || `Imported ${String(probeRequest.type || 'storage').toUpperCase()} SR`,
        nameDescription: result.sr.name_description || '',
        type: probeRequest.type,
        contentType: 'user',
        shared: this.isSharedStorageType(probeRequest.type),
        deviceConfig: Object.keys(result.configuration || {}).length ? result.configuration : (probeRequest.deviceConfig || {}),
        smConfig: probeRequest.smConfig || {},
      };

      this.workspaceMessage = '';
      this.createSrError = '';
      this.createSrProbeError = '';
      this.createSrImportError = '';
      this.createSrImportBusyKey = probeKey;

      try {
        const record = await api.importSR(payload);
        const targetHost = this.availableHosts.find((host) => host.ref === payload.hostRef);
        await this.loadSRs();
        this.createSrProbeResult = null;
        this.createSrProbeRequest = null;
        this.showCreateSrWindow = false;
        this.workspaceMessage = record.alreadyAttached
          ? `${record.name_label || payload.nameLabel} was already attached on ${targetHost?.name_label || payload.hostRef}; the SR inventory was refreshed.`
          : record.introduced
            ? `${record.name_label || payload.nameLabel} was introduced from ${payload.uuid} and attached to ${targetHost?.name_label || payload.hostRef}.`
            : `${record.name_label || payload.nameLabel} was attached to ${targetHost?.name_label || payload.hostRef}.`;
        const imported = this.srs.find((entry) => entry.ref === record.ref) || record;
        if (imported?.ref) {
          await this.openProperties(imported, { hosts: this.availableHosts });
        }
      } catch (error) {
        this.createSrImportError = error.message || 'Unable to introduce the probed storage repository.';
      } finally {
        this.createSrImportBusyKey = '';
      }
    },
    clearSelectedStorageDetail() {
      this.resetStorageWorkspaceWindows();
      this.showProps = false;
      this.selectedSR = null;
      this.vdis = [];
      this.relatedVMs = [];
      this.relatedHosts = [];
      this.focusedVdiRef = '';
      this.focusedVdiUuid = '';
      this.focusedVbdRef = '';
      this.focusedStorageClass = '';
      this.lastAppliedFocusKey = '';
    },
    resetStorageWorkspaceWindows() {
      this.showSrIdentityWindow = false;
      this.showSrActionsWindow = false;
      this.showSrCreateVdiWindow = false;
      this.showSrResizeVdiWindow = false;
    },
    buildCurrentDetailFocusOptions() {
      return {
        focusedVdiRef: this.focusedVdiRef,
        focusedVdiUuid: this.focusedVdiUuid,
        focusedVbdRef: this.focusedVbdRef,
        focusedStorageClass: this.focusedStorageClass,
      };
    },
    async refreshSelectedSrDetail() {
      if (!this.selectedSR?.ref) return;

      const selectedRef = this.selectedSR.ref;
      const focusOptions = this.buildCurrentDetailFocusOptions();
      await this.loadSRs();
      const updated = this.srs.find((sr) => sr.ref === selectedRef) || this.selectedSR;
      await this.openProperties(updated, focusOptions);
    },
    async submitSelectedSrConfig(payload) {
      if (!this.selectedSR?.ref) {
        this.detailActionError = 'No selected storage repository is available for identity updates.';
        return;
      }

      this.detailActionError = '';
      this.detailActionMessage = '';
      this.detailActionBusy = 'config';

      try {
        const record = await api.updateSRConfig(this.selectedSR.ref, payload);
        await this.refreshSelectedSrDetail();
        this.detailActionMessage = `${record.name_label || payload.nameLabel || this.selectedSR.ref} repository metadata was updated.`;
      } catch (error) {
        this.detailActionError = error.message || 'Unable to save the repository identity for the selected storage repository.';
      } finally {
        this.detailActionBusy = '';
      }
    },
    syncSelectedSrLocalCacheHost() {
      const hosts = this.storageDetailProfile.accessHosts;
      if (!hosts.length) {
        this.localCacheHostRef = '';
        return;
      }

      const stillValid = hosts.some((host) => host.ref === this.localCacheHostRef);
      if (stillValid) return;

      this.localCacheHostRef = hosts[0]?.ref || '';
    },
    async openProperties(row, options = {}) {
      this.resetStorageWorkspaceWindows();
      this.selectedSR = row;
      this.showProps = true;
      this.detailLoading = true;
      this.detailError = '';
      this.vdis = options.vdis || [];
      this.relatedVMs = options.vms || [];
      this.relatedHosts = options.hosts || [];
      this.focusedVdiRef = options.focusedVdiRef || '';
      this.focusedVdiUuid = options.focusedVdiUuid || '';
      this.focusedVbdRef = options.focusedVbdRef || '';
      this.focusedStorageClass = options.focusedStorageClass || '';
      this.detailActionError = '';
      this.detailActionMessage = '';

      const [vdisResult, vmsResult, hostsResult] = await Promise.allSettled([
        options.vdis ? Promise.resolve({ data: options.vdis }) : api.getSRVDIs(row.ref),
        options.vms ? Promise.resolve({ data: options.vms }) : api.getVMs(),
        options.hosts ? Promise.resolve({ data: options.hosts }) : api.getHosts(),
      ]);

      if (vdisResult.status === 'fulfilled') {
        this.vdis = vdisResult.value.data || [];
      } else {
        this.vdis = [];
      }

      if (vmsResult.status === 'fulfilled') {
        this.relatedVMs = vmsResult.value.data || [];
      } else {
        this.relatedVMs = [];
      }

      if (hostsResult.status === 'fulfilled') {
        this.relatedHosts = hostsResult.value.data || [];
      } else {
        this.relatedHosts = [];
      }

      if (vdisResult.status === 'rejected' && vmsResult.status === 'rejected' && hostsResult.status === 'rejected') {
        this.detailError = 'Unable to load VDI, VM, and host relationship data.';
      }

      this.syncSelectedSrLocalCacheHost();
      this.detailLoading = false;
    },
    async applyBulkStorageAction(action) {
      const isRescan = action === 'rescan';
      const isForget = action === 'forget';
      const isDestroy = action === 'destroy';
      if (!isRescan && !isForget && !isDestroy) return;

      const targets = isRescan
        ? this.storageSelectionProfile.rows
        : isForget
          ? this.storageSelectionProfile.forgetReady
          : this.storageSelectionProfile.destroyReady;
      if (!targets.length) {
        this.bulkError = isRescan
          ? 'No selected storage repositories are available for rescanning.'
          : isForget
            ? 'No selected storage repositories are available for the forget action.'
            : 'No selected storage repositories are currently empty and destroy-ready.';
        return;
      }

      const confirmed = typeof window === 'undefined'
        ? true
        : window.confirm(
          isRescan
            ? `Rescan ${targets.length} selected ${targets.length === 1 ? 'repository' : 'repositories'}?`
            : isForget
              ? `Forget ${targets.length} selected ${targets.length === 1 ? 'repository' : 'repositories'} from XenManage inventory? The backing storage will not be deleted.`
              : `Destroy ${targets.length} selected empty ${targets.length === 1 ? 'repository' : 'repositories'}? This permanently deletes the backing storage after XenAPI accepts the request.`
        );
      if (!confirmed) return;

      this.workspaceMessage = '';
      this.bulkError = null;
      this.bulkActionBusy = action;
      let completed = 0;
      let approvalDraft = null;
      let selectedSrRemoved = false;

      try {
        for (const sr of targets) {
          try {
            if (isRescan) {
              await api.rescanSR(sr.ref);
            } else if (isForget) {
              const approvalId = await this.resolveStorageGovernanceApproval('forget-sr', sr);
              await api.forgetSR(sr.ref, approvalId ? { approvalId } : {});
            } else {
              const approvalId = await this.resolveStorageGovernanceApproval('destroy-sr', sr);
              await api.destroySR(sr.ref, approvalId ? { approvalId } : {});
            }
            completed += 1;
            if (!isRescan && this.selectedSR?.ref === sr.ref) {
              selectedSrRemoved = true;
            }
          } catch (error) {
            approvalDraft = error.code === 'APPROVAL_REQUIRED' ? error.approvalDraft : null;
            this.bulkError = completed
              ? `Processed ${completed} repository${completed === 1 ? '' : 'ies'} before stopping: ${error.message || 'Unable to continue the selected storage action.'}`
              : (error.message || 'Unable to continue the selected storage action.');
            break;
          }
        }
      } finally {
        this.bulkActionBusy = '';
      }

      if (!completed && approvalDraft) {
        await handoffToGovernanceApproval(
          this.$router,
          approvalDraft,
          isDestroy
            ? 'Approval required before destroying one or more selected storage repositories.'
            : 'Approval required before forgetting one or more selected storage repositories.'
        );
        return;
      }

      await this.loadSRs();

      if (!isRescan && selectedSrRemoved) {
        this.clearSelectedStorageDetail();
      } else if (this.selectedSR?.ref && targets.some((sr) => sr.ref === this.selectedSR.ref)) {
        const updated = this.srs.find((sr) => sr.ref === this.selectedSR.ref) || this.selectedSR;
        await this.openProperties(updated);
      }

      if (completed && isForget) {
        this.workspaceMessage = buildBulkStorageForgetMessage(targets.slice(0, completed));
      } else if (completed && isDestroy) {
        this.workspaceMessage = buildBulkStorageDestroyMessage(targets.slice(0, completed));
      }

      if (approvalDraft) {
        await handoffToGovernanceApproval(
          this.$router,
          approvalDraft,
          isDestroy
            ? 'Approval required before destroying one or more selected storage repositories.'
            : 'Approval required before forgetting one or more selected storage repositories.'
        );
      }
    },
    async applyDetailStorageAction(action) {
      if (!['rescan', 'repair'].includes(action)) return;
      if (!this.selectedSR?.ref) {
        this.detailActionError = `No selected storage repository is available for ${action === 'repair' ? 'repair' : 'rescanning'}.`;
        return;
      }

      this.detailActionError = '';
      this.detailActionMessage = '';
      this.detailActionBusy = action;

      try {
        const result = action === 'repair'
          ? await api.repairSR(this.selectedSR.ref)
          : await api.rescanSR(this.selectedSR.ref);
        await this.refreshSelectedSrDetail();
        if (action === 'repair') {
          const reattachedCount = Number(result?.reattachedCount || 0);
          this.detailActionMessage = reattachedCount
            ? `${this.selectedSR?.name_label || 'The selected repository'} repair refreshed storage metadata and reattached ${reattachedCount} path${reattachedCount === 1 ? '' : 's'}.`
            : `${this.selectedSR?.name_label || 'The selected repository'} repair refreshed storage metadata. No detached paths required reattachment.`;
        } else {
          this.detailActionMessage = `${this.selectedSR?.name_label || 'The selected repository'} was rescanned and its inventory was refreshed.`;
        }
      } catch (error) {
        this.detailActionError = error.message || (action === 'repair'
          ? 'Unable to continue the storage repair.'
          : 'Unable to continue the storage rescan.');
      } finally {
        this.detailActionBusy = '';
      }
    },
    async toggleSelectedSrLocalCache() {
      if (!this.selectedSR?.ref) {
        this.detailActionError = 'No selected storage repository is available for local cache updates.';
        return;
      }

      if (this.storageDetailProfile.localCacheBlockedReason) {
        this.detailActionError = this.storageDetailProfile.localCacheBlockedReason;
        return;
      }

      this.detailActionError = '';
      this.detailActionMessage = '';
      this.detailActionBusy = 'local-cache';

      try {
        const nextEnabled = !Boolean(this.selectedSR.local_cache_enabled);
        const record = await api.setSRLocalCache(this.selectedSR.ref, {
          hostRef: this.localCacheHostRef,
          enabled: nextEnabled,
        });
        const targetHost = this.storageDetailProfile.accessHosts.find((host) => host.ref === this.localCacheHostRef) || null;
        await this.refreshSelectedSrDetail();
        this.detailActionMessage = nextEnabled
          ? `${record.name_label || this.selectedSR.ref} is now the local cache SR for ${targetHost?.name_label || this.localCacheHostRef}.`
          : `${record.name_label || this.selectedSR.ref} local cache assignment was cleared for ${targetHost?.name_label || this.localCacheHostRef}.`;
      } catch (error) {
        this.detailActionError = error.message || 'Unable to update the local cache assignment for the selected storage repository.';
      } finally {
        this.detailActionBusy = '';
      }
    },
    async forgetSelectedSr() {
      if (!this.selectedSR?.ref) {
        this.detailActionError = 'No selected storage repository is available for the forget action.';
        return;
      }

      const repository = { ...this.selectedSR };
      const confirmed = typeof window === 'undefined'
        ? true
        : window.confirm(`Forget ${repository.name_label || repository.ref} from XenManage inventory? The backing storage will not be deleted.`);

      if (!confirmed) return;

      this.workspaceMessage = '';
      this.detailActionError = '';
      this.detailActionMessage = '';
      this.detailActionBusy = 'forget-sr';

      try {
        const approvalId = await this.resolveStorageGovernanceApproval('forget-sr', repository);
        await api.forgetSR(repository.ref, approvalId ? { approvalId } : {});
        await this.loadSRs();
        this.clearSelectedStorageDetail();
        this.workspaceMessage = `${repository.name_label || repository.ref} was forgotten and removed from the current storage inventory view.`;
      } catch (error) {
        if (error.code === 'APPROVAL_REQUIRED') {
          this.detailActionError = 'Governance approval is required before forgetting this storage repository.';
          await handoffToGovernanceApproval(
            this.$router,
            error.approvalDraft,
            'Approval required before forgetting this storage repository.'
          );
          return;
        }
        this.detailActionError = error.message || 'Unable to forget the selected storage repository.';
      } finally {
        this.detailActionBusy = '';
      }
    },
    async destroySelectedSr() {
      if (!this.selectedSR?.ref) {
        this.detailActionError = 'No selected storage repository is available for the destroy action.';
        return;
      }

      if (this.storageDetailProfile.destroyBlockedReason) {
        this.detailActionError = this.storageDetailProfile.destroyBlockedReason;
        return;
      }

      const repository = { ...this.selectedSR };
      const confirmed = typeof window === 'undefined'
        ? true
        : window.confirm(`Destroy ${repository.name_label || repository.ref}? This permanently deletes the backing storage after XenAPI accepts the request.`);

      if (!confirmed) return;

      this.workspaceMessage = '';
      this.detailActionError = '';
      this.detailActionMessage = '';
      this.detailActionBusy = 'destroy-sr';

      try {
        const approvalId = await this.resolveStorageGovernanceApproval('destroy-sr', repository);
        await api.destroySR(repository.ref, approvalId ? { approvalId } : {});
        await this.loadSRs();
        this.clearSelectedStorageDetail();
        this.workspaceMessage = `${repository.name_label || repository.ref} was destroyed and removed from the current storage inventory view.`;
      } catch (error) {
        if (error.code === 'APPROVAL_REQUIRED') {
          this.detailActionError = 'Governance approval is required before destroying this storage repository.';
          await handoffToGovernanceApproval(
            this.$router,
            error.approvalDraft,
            'Approval required before destroying this storage repository.'
          );
          return;
        }
        this.detailActionError = error.message || 'Unable to destroy the selected storage repository.';
      } finally {
        this.detailActionBusy = '';
      }
    },
    async submitDetachedVdi(payload) {
      if (!this.selectedSR?.ref) {
        this.detailActionError = 'Select a storage repository before creating a detached VDI.';
        return;
      }

      this.detailActionError = '';
      this.detailActionMessage = '';
      this.detailActionBusy = 'create-vdi';

      try {
        let record = null;
        if (payload.attachVmRef) {
          const targetVm = this.relatedVMs.find((vm) => vm.ref === payload.attachVmRef) || null;
          record = await api.addVMDisk(payload.attachVmRef, {
            srRef: this.selectedSR.ref,
            nameLabel: payload.nameLabel,
            sizeBytes: payload.sizeBytes,
          });
          this.focusedVdiRef = record?.vdiRef || '';
          this.focusedStorageClass = this.focusedVdiRef ? 'vdi' : this.focusedStorageClass;
          await this.refreshSelectedSrDetail();
          this.detailActionMessage = `${payload.nameLabel || 'New VDI'} was created on ${this.selectedSR?.name_label || 'the selected repository'} and attached to ${targetVm?.name_label || payload.attachVmRef}.`;
          return;
        }

        record = await api.createStorageVdi(this.selectedSR.ref, payload);
        await this.refreshSelectedSrDetail();
        this.detailActionMessage = `${record.name_label || payload.nameLabel || 'Detached VDI'} was created on ${this.selectedSR?.name_label || 'the selected repository'}.`;
      } catch (error) {
        this.detailActionError = error.message || 'Unable to create the detached VDI.';
      } finally {
        this.detailActionBusy = '';
      }
    },
    async submitResizeVdi(payload) {
      if (!this.selectedSR?.ref) {
        this.detailActionError = 'Select a storage repository before resizing a VDI.';
        return;
      }

      if (!payload?.vdiRef) {
        this.detailActionError = 'Select a VDI before submitting the resize request.';
        return;
      }

      this.detailActionError = '';
      this.detailActionMessage = '';
      this.detailActionBusy = 'resize-vdi';

      try {
        const record = await api.resizeStorageVdi(this.selectedSR.ref, payload.vdiRef, { sizeBytes: payload.sizeBytes });
        await this.refreshSelectedSrDetail();
        this.detailActionMessage = `${record.name_label || payload.vdiRef} was resized to ${this.formatBytes(payload.sizeBytes)} on ${this.selectedSR?.name_label || 'the selected repository'}.`;
      } catch (error) {
        this.detailActionError = error.message || 'Unable to resize the selected VDI.';
      } finally {
        this.detailActionBusy = '';
      }
    },
    async resolveStorageGovernanceApproval(action, target) {
      if (action === 'delete-vdi' && target?.ref) {
        return resolveGovernanceApproval({
          actionKey: 'vdi_delete',
          entityType: 'vdi',
          entityRef: target.ref,
          entityName: target.name_label || target.uuid || target.ref || 'Virtual disk',
          route: '/storage',
        });
      }

      if (action === 'forget-sr' && target?.ref) {
        return resolveGovernanceApproval({
          actionKey: 'sr_forget',
          entityType: 'sr',
          entityRef: target.ref,
          entityName: target.name_label || target.uuid || target.ref || 'Storage repository',
          route: '/storage',
        });
      }

      if (action === 'destroy-sr' && target?.ref) {
        return resolveGovernanceApproval({
          actionKey: 'sr_destroy',
          entityType: 'sr',
          entityRef: target.ref,
          entityName: target.name_label || target.uuid || target.ref || 'Storage repository',
          route: '/storage',
        });
      }

      return '';
    },
    async deleteSelectedVdi(vdi) {
      if (!this.selectedSR?.ref || !vdi?.ref) return;
      const blockedReason = this.getVdiDeleteBlockedReason(vdi);
      if (blockedReason) {
        this.detailActionError = blockedReason;
        return;
      }

      this.detailActionError = '';
      this.detailActionMessage = '';
      this.detailActionBusy = `delete-vdi:${vdi.ref}`;

      try {
        const approvalId = await this.resolveStorageGovernanceApproval('delete-vdi', vdi);
        await api.deleteStorageVdi(this.selectedSR.ref, vdi.ref, approvalId ? { approvalId } : null);
        await this.refreshSelectedSrDetail();
        this.detailActionMessage = `${vdi.name_label || vdi.ref} was deleted from ${this.selectedSR?.name_label || 'the selected repository'}.`;
      } catch (error) {
        if (error.code === 'APPROVAL_REQUIRED') {
          this.detailActionError = 'Governance approval is required before deleting this VDI.';
          await handoffToGovernanceApproval(
            this.$router,
            error.approvalDraft,
            'Approval required before deleting this VDI.'
          );
          return;
        }
        this.detailActionError = error.message || 'Unable to delete the selected VDI.';
      } finally {
        this.detailActionBusy = '';
      }
    },
    describeSrProbeSummary(result) {
      if (!result) return '';

      if (result.mode === 'probe') {
        return result.rawXml
          ? 'The host returned backend-specific XML output rather than structured probe records.'
          : 'The host did not return structured probe records for this request.';
      }

      const summary = result.summary || {};
      const total = Number(summary.totalResults || 0);
      const existing = Number(summary.existingSrs || 0);
      const complete = Number(summary.completeResults || 0);
      return `${total} candidate${total === 1 ? '' : 's'} · ${existing} existing SR${existing === 1 ? '' : 's'} · ${complete} complete configuration${complete === 1 ? '' : 's'}`;
    },
    formatProbeMap(record) {
      const entries = Object.entries(record || {}).filter(([key, value]) =>
        String(key || '').trim() && String(value || '').trim()
      );
      if (!entries.length) return '';
      return entries.map(([key, value]) => `${key}=${value}`).join(' · ');
    },
    formatProbeSrStat(record) {
      if (!record) return '';

      const parts = [];
      if (record.uuid) {
        parts.push(record.uuid);
      }
      if (record.health) {
        parts.push(record.health);
      }
      if (Number(record.total_space || 0) > 0) {
        parts.push(`${this.formatBytes(record.free_space || 0)} free of ${this.formatBytes(record.total_space || 0)}`);
      }
      if (record.clustered) {
        parts.push('clustered');
      }

      return parts.join(' · ');
    },
    openVmWorkspace(row) {
      if (!row?.vmRef) return;
      this.showProps = false;
      this.$router.push(buildFocusedRoute('/vms', {
        kind: 'vm',
        ref: row.vmRef,
        uuid: row.vmUuid || '',
        name: row.vmName || '',
        cls: 'vm',
        source: 'storage',
      }));
    },
    openHostWorkspace(row) {
      if (!row?.hostRef) return;
      this.showProps = false;
      this.$router.push(buildFocusedRoute('/hosts', {
        kind: 'host',
        ref: row.hostRef,
        uuid: row.hostUuid || '',
        name: row.hostName || '',
        cls: 'host',
        source: 'storage',
      }));
    },
    findStorageByFocus(focus) {
      return this.srs.find((sr) =>
        recordMatchesRouteFocus(sr, focus, ['ref', 'uuid', 'name_label'])
      ) || null;
    },
    async resolveFocusedStorageTarget(focus) {
      const direct = this.findStorageByFocus(focus);
      if (direct) {
        return { sr: direct, vdis: null, focusedVdi: null };
      }

      for (const sr of this.srs) {
        try {
          const result = await api.getSRVDIs(sr.ref);
          const vdis = result.data || [];
          const match = vdis.find((vdi) =>
            recordMatchesRouteFocus(
              vdi,
              focus,
              ['ref', 'uuid', 'name_label'],
              focus.ref && focus.cls === 'vbd' ? (vdi.VBDs || []) : []
            )
          );

          if (match) {
            return { sr, vdis, focusedVdi: match };
          }
        } catch (error) {
          // Keep searching other repositories when one VDI inventory call fails.
        }
      }

      return null;
    },
    async syncRouteFocus() {
      const focus = getRouteFocus(this.$route.query);
      if (!focus || (focus.kind && focus.kind !== 'storage')) {
        this.lastAppliedFocusKey = '';
        this.focusedVdiRef = '';
        this.focusedVdiUuid = '';
        this.focusedVbdRef = '';
        this.focusedStorageClass = '';
        return;
      }

      if (this.loading || !this.srs.length) return;

      const key = getRouteFocusKey(focus);
      if (this.lastAppliedFocusKey === key) return;

      const target = await this.resolveFocusedStorageTarget(focus);
      if (!target?.sr) return;

      await this.openProperties(target.sr, {
        vdis: target.vdis,
        focusedVdiRef: target.focusedVdi?.ref || '',
        focusedVdiUuid: target.focusedVdi?.uuid || focus.uuid || '',
        focusedVbdRef: focus.cls === 'vbd' ? (focus.ref || '') : '',
        focusedStorageClass: ['vdi', 'vbd'].includes(focus.cls) ? focus.cls : '',
      });
      this.lastAppliedFocusKey = key;
    },
  },
};
