const StorageView = {
  components: {
    DataTable,
    FloatingWindow,
    StatusBadge,
    StoragePropertiesWindow,
    StorageCreateSrWindow,
    StorageWorkspaceDialogs,
    StorageBrowserWindow,
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
        @clone-vdi="cloneSelectedVdi"
        @snapshot-vdi="snapshotSelectedVdi"
        @open-attach-cd="openAttachCdWindow"
        @open-file-browser="openFileBrowser"
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
        :show-attach-cd-window="showAttachCdWindow"
        :attach-cd-vdi="attachCdVdi"
        :attach-cd-vm-ref="attachCdVmRef"
        @close-sr-identity="showSrIdentityWindow = false"
        @close-sr-actions="showSrActionsWindow = false"
        @close-sr-create-vdi="showSrCreateVdiWindow = false"
        @close-sr-resize-vdi="showSrResizeVdiWindow = false"
        @close-attach-cd="showAttachCdWindow = false"
        @submit-sr-config="submitSelectedSrConfig"
        @apply-detail-storage-action="applyDetailStorageAction"
        @update:local-cache-host-ref="localCacheHostRef = $event"
        @update:attach-cd-vm-ref="attachCdVmRef = $event"
        @toggle-local-cache="toggleSelectedSrLocalCache"
        @forget-sr="forgetSelectedSr"
        @destroy-sr="destroySelectedSr"
        @submit-detached-vdi="submitDetachedVdi"
        @submit-resize-vdi="submitResizeVdi"
        @submit-attach-cd="submitAttachCd">
      </storage-workspace-dialogs>

      <storage-browser-window
        :show="showFileBrowser"
        :selected-sr="selectedSR"
        :current-path="fileBrowserPath"
        :entries="fileBrowserEntries"
        :loading="fileBrowserLoading"
        :error="fileBrowserError"
        :action-busy="fileBrowserActionBusy"
        @close="showFileBrowser = false"
        @navigate="navigateFileBrowser"
        @mkdir="mkdirFileBrowser"
        @upload="uploadFileBrowser"
        @rename="renameFileBrowserEntry"
        @delete="deleteFileBrowserEntry">
      </storage-browser-window>

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
    return createStorageViewState();
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
        this.availableHosts = await loadStorageHosts(api);
      } catch (_error) {
        this.availableHosts = [];
      }
    },
    async loadSRs() {
      this.loading = true;
      try {
        this.srs = await loadStorageRecords(api);
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
        await this.loadSRs();
        this.createSrProbeResult = null;
        this.createSrProbeRequest = null;
        this.showCreateSrWindow = false;
        this.workspaceMessage = buildStorageRepositoryCreateMessage(record, payload, this.availableHosts);
        const created = findRefreshedStorageRecord(this.srs, record.ref, record);
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
    async introduceProbedSr(result, index) {
      if (!canIntroduceStorageProbeResult(this.createSrProbeRequest, result)) {
        this.createSrImportError = 'Probe results must include a complete discovered SR with a UUID before it can be introduced.';
        return;
      }

      const probeRequest = this.createSrProbeRequest || {};
      const probeKey = buildStorageProbeResultKey(result, index);
      const payload = buildStorageProbeImportPayload(probeRequest, result);
      if (!payload) {
        this.createSrImportError = 'Unable to build the storage repository import payload from the current probe result.';
        return;
      }

      this.workspaceMessage = '';
      this.createSrError = '';
      this.createSrProbeError = '';
      this.createSrImportError = '';
      this.createSrImportBusyKey = probeKey;

      try {
        const record = await api.importSR(payload);
        await this.loadSRs();
        this.createSrProbeResult = null;
        this.createSrProbeRequest = null;
        this.showCreateSrWindow = false;
        this.workspaceMessage = buildStorageRepositoryImportMessage(record, payload, this.availableHosts);
        const imported = findRefreshedStorageRecord(this.srs, record.ref, record);
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
      Object.assign(this, createEmptyStorageDetailState());
    },
    resetStorageWorkspaceWindows() {
      Object.assign(this, buildStorageWorkspaceWindowResetState());
    },
    buildCurrentDetailFocusOptions() {
      return buildStorageDetailFocusOptions(this);
    },
    async refreshSelectedSrDetail() {
      if (!this.selectedSR?.ref) return;

      const selectedRef = this.selectedSR.ref;
      const focusOptions = buildStorageDetailFocusOptions(this);
      await this.loadSRs();
      const updated = findRefreshedStorageRecord(this.srs, selectedRef, this.selectedSR);
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
      Object.assign(this, buildStoragePropertiesWorkspaceState(row, options));

      try {
        const detailContext = await loadStorageDetailContext(api, row, options);
        Object.assign(this, buildStorageDetailWorkspaceState(detailContext));
      } catch (error) {
        Object.assign(this, buildStorageDetailErrorState(error.message));
      } finally {
        this.syncSelectedSrLocalCacheHost();
        Object.assign(this, buildStorageDetailLoadingCompleteState());
      }
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

      if (action === 'delete-file' && target?.ref) {
        return resolveGovernanceApproval({
          actionKey: 'sr_file_delete',
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
    async cloneSelectedVdi(vdi) {
      if (!this.selectedSR?.ref || !vdi?.ref) return;
      this.detailActionError = '';
      this.detailActionMessage = '';
      this.detailActionBusy = `clone-vdi:${vdi.ref}`;

      try {
        const record = await api.cloneStorageVdi(this.selectedSR.ref, vdi.ref, {
          nameLabel: `${vdi.name_label || 'disk'} clone`,
          snapshot: false,
        });
        await this.refreshSelectedSrDetail();
        this.detailActionMessage = `${record.name_label || vdi.ref} was cloned on ${this.selectedSR?.name_label || 'the selected repository'}.`;
      } catch (error) {
        this.detailActionError = error.message || 'Unable to clone the selected VDI.';
      } finally {
        this.detailActionBusy = '';
      }
    },
    async snapshotSelectedVdi(vdi) {
      if (!this.selectedSR?.ref || !vdi?.ref) return;
      this.detailActionError = '';
      this.detailActionMessage = '';
      this.detailActionBusy = `snapshot-vdi:${vdi.ref}`;

      try {
        const record = await api.cloneStorageVdi(this.selectedSR.ref, vdi.ref, {
          nameLabel: `${vdi.name_label || 'disk'} snapshot`,
          snapshot: true,
        });
        await this.refreshSelectedSrDetail();
        this.detailActionMessage = `${record.name_label || vdi.ref} snapshot was created on ${this.selectedSR?.name_label || 'the selected repository'}.`;
      } catch (error) {
        this.detailActionError = error.message || 'Unable to snapshot the selected VDI.';
      } finally {
        this.detailActionBusy = '';
      }
    },
    openAttachCdWindow(vdi) {
      this.attachCdVdi = vdi;
      this.attachCdVmRef = '';
      this.showAttachCdWindow = true;
    },
    async submitAttachCd() {
      if (!this.selectedSR?.ref || !this.attachCdVdi?.ref || !this.attachCdVmRef) return;
      this.detailActionError = '';
      this.detailActionMessage = '';
      this.detailActionBusy = 'attach-cd';

      try {
        await api.attachStorageVdiAsCd(this.selectedSR.ref, this.attachCdVdi.ref, { vmRef: this.attachCdVmRef });
        const targetVm = this.relatedVMs.find((vm) => vm.ref === this.attachCdVmRef);
        this.showAttachCdWindow = false;
        await this.refreshSelectedSrDetail();
        this.detailActionMessage = `${this.attachCdVdi.name_label || this.attachCdVdi.ref} was attached as a CD to ${targetVm?.name_label || this.attachCdVmRef}.`;
      } catch (error) {
        this.detailActionError = error.message || 'Unable to attach the selected ISO as a CD.';
      } finally {
        this.detailActionBusy = '';
      }
    },
    async openFileBrowser() {
      this.showFileBrowser = true;
      this.fileBrowserPath = '';
      await this.loadFileBrowserDirectory('');
    },
    async loadFileBrowserDirectory(path) {
      if (!this.selectedSR?.ref) return;
      this.fileBrowserLoading = true;
      this.fileBrowserError = '';

      try {
        this.fileBrowserEntries = await api.listStorageFiles(this.selectedSR.ref, path);
        this.fileBrowserPath = path;
      } catch (error) {
        this.fileBrowserError = error.message || 'Unable to load the storage file listing.';
      } finally {
        this.fileBrowserLoading = false;
      }
    },
    async navigateFileBrowser(path) {
      await this.loadFileBrowserDirectory(path);
    },
    async mkdirFileBrowser({ path, name }) {
      if (!this.selectedSR?.ref) return;
      this.fileBrowserActionBusy = 'mkdir';
      this.fileBrowserError = '';

      try {
        await api.mkdirStorageFile(this.selectedSR.ref, { path, name });
        await this.loadFileBrowserDirectory(this.fileBrowserPath);
      } catch (error) {
        this.fileBrowserError = error.message || 'Unable to create the requested folder.';
      } finally {
        this.fileBrowserActionBusy = '';
      }
    },
    async uploadFileBrowser({ path, file }) {
      if (!this.selectedSR?.ref) return;
      this.fileBrowserActionBusy = 'upload';
      this.fileBrowserError = '';

      try {
        await api.uploadStorageFile(this.selectedSR.ref, path, file);
        await this.loadFileBrowserDirectory(this.fileBrowserPath);
      } catch (error) {
        this.fileBrowserError = error.message || 'Unable to upload the selected file.';
      } finally {
        this.fileBrowserActionBusy = '';
      }
    },
    async renameFileBrowserEntry({ fromPath, toPath }) {
      if (!this.selectedSR?.ref) return;
      this.fileBrowserActionBusy = 'move';
      this.fileBrowserError = '';

      try {
        await api.moveStorageFile(this.selectedSR.ref, { fromPath, toPath });
        await this.loadFileBrowserDirectory(this.fileBrowserPath);
      } catch (error) {
        this.fileBrowserError = error.message || 'Unable to rename the selected entry.';
      } finally {
        this.fileBrowserActionBusy = '';
      }
    },
    async deleteFileBrowserEntry(entry) {
      if (!this.selectedSR?.ref) return;
      const targetPath = this.fileBrowserPath ? `${this.fileBrowserPath}/${entry.name}` : entry.name;
      const confirmed = typeof window === 'undefined'
        ? true
        : window.confirm(`Delete ${entry.name}? This cannot be undone.`);
      if (!confirmed) return;

      this.fileBrowserActionBusy = `delete:${entry.name}`;
      this.fileBrowserError = '';

      try {
        const approvalId = await this.resolveStorageGovernanceApproval('delete-file', { ref: this.selectedSR.ref, name_label: this.selectedSR.name_label });
        await api.deleteStorageFile(this.selectedSR.ref, targetPath, approvalId || '');
        await this.loadFileBrowserDirectory(this.fileBrowserPath);
      } catch (error) {
        if (error.code === 'APPROVAL_REQUIRED') {
          this.fileBrowserError = 'Governance approval is required before deleting this file.';
          await handoffToGovernanceApproval(
            this.$router,
            error.approvalDraft,
            'Approval required before deleting this storage file.'
          );
          return;
        }
        this.fileBrowserError = error.message || 'Unable to delete the selected entry.';
      } finally {
        this.fileBrowserActionBusy = '';
      }
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
    async syncRouteFocus() {
      const nextState = await syncStorageRouteFocusWorkflow({
        routeQuery: this.$route.query,
        loading: this.loading,
        srs: this.srs,
        lastAppliedFocusKey: this.lastAppliedFocusKey,
        loadSrVdis: (ref) => api.getSRVDIs(ref),
        openProperties: async (row, options = {}) => {
          await this.openProperties(row, options);
        },
      });
      Object.assign(this, nextState);
    },
  },
};
