const StorageView = {
  components: { DataTable, FloatingWindow, StatusBadge, StorageSrCreateForm, StorageVdiForm, StorageVdiResizeForm },
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
        <button class="btn btn-primary" @click="loadSRs">
          <span class="mdi mdi-refresh"></span>
          Refresh
        </button>
      </div>

      <div class="dash-card" style="margin-bottom:16px">
        <div class="dash-card-label">Create Storage Repository</div>
        <p class="text-muted" style="margin-bottom:12px">Provision a new SR against NFS, iSCSI, local EXT, or local LVM without leaving the Storage workspace.</p>
        <storage-sr-create-form
          :hosts="availableHosts"
          :saving="createSrBusy"
          :submit-label="'Create Storage Repository'"
          @submit="submitStorageRepository">
        </storage-sr-create-form>
        <div class="form-error" v-if="createSrError" style="text-align:left;margin-top:12px">{{ createSrError }}</div>
      </div>

      <div class="stack-item" v-if="workspaceMessage" style="margin-bottom:16px">
        <div>
          <strong>Workspace updated</strong>
          <div class="text-muted mono" style="font-size:11px">{{ workspaceMessage }}</div>
        </div>
        <span class="badge badge-running">ready</span>
      </div>

      <div class="dash-card" v-if="selectedSrRows.length" style="margin-bottom:16px">
        <div class="dash-card-label">Batch Storage Actions</div>
        <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap">
          <div>
            <strong>{{ selectedSrRows.length }} repositories selected</strong>
            <div class="text-muted mono" style="font-size:11px;margin-top:4px">{{ selectedSrSelectionSummary }}</div>
          </div>
          <div class="dashboard-hero-rail" style="gap:8px">
            <button class="btn btn-sm btn-primary"
                    :disabled="Boolean(bulkActionBusy)"
                    @click="applyBulkStorageAction('rescan')">
              <span class="mdi mdi-refresh-circle"></span>
              {{ bulkActionBusy === 'rescan' ? 'Rescanning...' : `Rescan Selected (${selectedSrRows.length})` }}
            </button>
            <button class="btn btn-sm" :disabled="Boolean(bulkActionBusy)" @click="clearSrSelection">Clear Selection</button>
          </div>
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

      <floating-window :show="showProps" title="Storage Repository" :width="880" :height="620" @close="showProps = false">
        <div v-if="selectedSR">
          <div class="property-grid">
            <span class="text-muted">Name</span><span>{{ selectedSR.name_label || '-' }}</span>
            <span class="text-muted">Type</span><span>{{ selectedSR.type || '-' }}</span>
            <span class="text-muted">Physical Size</span><span class="mono">{{ formatBytes(selectedSR.physical_size) }}</span>
            <span class="text-muted">Virtual Allocation</span><span class="mono">{{ formatBytes(selectedSR.virtual_allocation) }}</span>
            <span class="text-muted">Mapped VDIs</span><span>{{ summarizeCount('disks', vdis.length) }}</span>
            <span class="text-muted">Attachment Paths</span><span>{{ summarizeCount('attachment paths', selectedSrAttachmentPathCount) }}</span>
            <span class="text-muted">Attached Workloads</span><span>{{ summarizeCount('workloads', selectedSrWorkloadCount) }}</span>
            <span class="text-muted">Topology</span><span>{{ selectedSrTopologyLabel }}</span>
            <span class="text-muted">UUID</span><span class="mono property-wrap">{{ selectedSR.uuid || '-' }}</span>
            <span class="text-muted">Tags</span><span>{{ truncateList(selectedSR.tags) }}</span>
          </div>

          <div class="detail-section" v-if="focusedStorageContext">
            <div class="detail-section-title">{{ focusedStorageContext.title }}</div>
            <div class="capacity-callout">
              <strong>{{ focusedStorageContext.summary }}</strong>
              <div class="text-muted mono" style="font-size:11px;margin-top:8px">{{ focusedStorageContext.detail }}</div>
            </div>
          </div>

          <div class="detail-section">
            <div class="detail-section-title">Storage Operations</div>
            <div class="dashboard-panels">
              <div class="dash-card">
                <div class="dash-card-label">Repository Actions</div>
                <p class="text-muted" style="margin-bottom:12px">Refresh the selected SR so new LUNs, scan results, or detached disk records are visible immediately inside this workspace.</p>
                <div class="stack-list" style="margin-bottom:12px">
                  <div class="stack-item">
                    <div>
                      <strong>{{ selectedSR.name_label || 'Selected repository' }}</strong>
                      <div class="text-muted mono" style="font-size:11px">
                        {{ selectedSR.uuid || selectedSR.ref || 'SR ref unavailable' }} · {{ formatBytes(selectedSR.virtual_allocation) }} allocated
                      </div>
                    </div>
                    <span class="badge badge-info">{{ selectedSR.type || 'sr' }}</span>
                  </div>
                  <div class="stack-item" v-if="selectedSR.other_config?.last_rescan_at">
                    <div>
                      <strong>Last Rescan</strong>
                      <div class="text-muted mono" style="font-size:11px">{{ selectedSR.other_config.last_rescan_at }}</div>
                    </div>
                    <span class="badge badge-running">tracked</span>
                  </div>
                  <div class="stack-item" v-if="selectedSR.other_config?.last_repair_at">
                    <div>
                      <strong>Last Repair</strong>
                      <div class="text-muted mono" style="font-size:11px">{{ selectedSR.other_config.last_repair_at }}</div>
                    </div>
                    <span class="badge badge-info">tracked</span>
                  </div>
                </div>
                <button class="form-btn"
                        type="button"
                        :disabled="Boolean(detailActionBusy)"
                        @click="applyDetailStorageAction('rescan')">
                  <span class="mdi mdi-refresh-circle"></span>
                  {{ detailActionBusy === 'rescan' ? 'Rescanning...' : 'Rescan Repository' }}
                </button>
                <button class="btn btn-sm"
                        type="button"
                        style="margin-top:10px"
                        :disabled="Boolean(detailActionBusy)"
                        @click="applyDetailStorageAction('repair')">
                  <span class="mdi mdi-wrench-outline"></span>
                  {{ detailActionBusy === 'repair' ? 'Repairing...' : 'Repair Repository' }}
                </button>
                <button class="btn btn-sm"
                        type="button"
                        style="margin-top:10px"
                        :disabled="Boolean(detailActionBusy)"
                        @click="forgetSelectedSr">
                  <span class="mdi mdi-database-remove-outline"></span>
                  {{ detailActionBusy === 'forget-sr' ? 'Forgetting...' : 'Forget Repository' }}
                </button>
                <button class="btn btn-sm"
                        type="button"
                        style="margin-top:10px"
                        :disabled="Boolean(detailActionBusy) || Boolean(selectedSrDestroyBlockedReason)"
                        @click="destroySelectedSr">
                  <span class="mdi mdi-delete-forever-outline"></span>
                  {{ detailActionBusy === 'destroy-sr' ? 'Destroying...' : 'Destroy Repository' }}
                </button>
                <div class="text-muted mono" v-if="selectedSrDestroyBlockedReason" style="font-size:11px;margin-top:10px">
                  {{ selectedSrDestroyBlockedReason }}
                </div>
              </div>

              <div class="dash-card">
                <div class="dash-card-label">Create Detached VDI</div>
                <p class="text-muted" style="margin-bottom:12px">Provision a standalone VDI on this repository so it is ready for a later attachment or workflow handoff.</p>
                <storage-vdi-form
                  :sr="selectedSR"
                  :saving="detailActionBusy === 'create-vdi'"
                  :submit-label="'Create Detached VDI'"
                  @submit="submitDetachedVdi">
                </storage-vdi-form>
              </div>

              <div class="dash-card">
                <div class="dash-card-label">Resize Existing VDI</div>
                <p class="text-muted" style="margin-bottom:12px">Adjust the capacity of a VDI already tracked by this repository without leaving the Storage detail workspace.</p>
                <storage-vdi-resize-form
                  :vdi-options="vdis"
                  :focused-vdi-ref="focusedVdiRef"
                  :attachment-counts="storageVdiAttachmentCounts"
                  :saving="detailActionBusy === 'resize-vdi'"
                  :submit-label="'Resize VDI'"
                  @submit="submitResizeVdi">
                </storage-vdi-resize-form>
              </div>
            </div>

            <div class="form-error" v-if="detailActionError" style="text-align:left;margin-top:12px">{{ detailActionError }}</div>
            <div class="stack-item" v-else-if="detailActionMessage" style="margin-top:12px">
              <div>
                <strong>Storage operation completed</strong>
                <div class="text-muted mono" style="font-size:11px">{{ detailActionMessage }}</div>
              </div>
              <span class="badge badge-running">ready</span>
            </div>
          </div>

          <div class="detail-section">
            <div class="detail-section-title">Attached VDIs</div>
            <div class="stack-list">
              <div class="stack-item" v-if="detailLoading">
                <span class="loading-spinner"></span>
                <span class="mono">Loading storage relationships...</span>
              </div>
              <div class="stack-item" v-else-if="!vdis.length">
                <span class="mdi mdi-database-off-outline text-muted"></span>
                <span class="mono">No VDIs reported for this repository.</span>
              </div>
              <div class="stack-item" v-for="vdi in vdis.slice(0, 12)" :key="vdi.ref">
                <div>
                  <strong>{{ vdi.name_label || 'Unnamed VDI' }}</strong>
                  <div class="text-muted mono" style="font-size:11px">
                    {{ formatBytes(vdi.virtual_size) }} · {{ vdi.type || 'disk' }} · {{ summarizeCount('attachments', getVdiAttachmentCount(vdi)) }}
                  </div>
                  <div class="text-muted mono" v-if="getVdiDeleteBlockedReason(vdi)" style="font-size:11px">
                    {{ getVdiDeleteBlockedReason(vdi) }}
                  </div>
                </div>
                <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
                  <span class="badge badge-running" v-if="isFocusedVdi(vdi)">focused</span>
                  <span class="badge badge-warning" v-if="getVdiAttachmentCount(vdi)">attached</span>
                  <span class="badge badge-info">{{ vdi.managed ? 'managed' : 'unmanaged' }}</span>
                  <button class="btn btn-sm"
                          :disabled="Boolean(detailActionBusy) || Boolean(getVdiDeleteBlockedReason(vdi))"
                          @click="deleteSelectedVdi(vdi)">
                    <span class="mdi mdi-delete-outline"></span>
                    {{ detailActionBusy === `delete-vdi:${vdi.ref}` ? 'Deleting...' : 'Delete' }}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div class="detail-section">
            <div class="detail-section-title">Attachment Topology</div>
            <div class="stack-list">
              <div class="stack-item" v-if="detailLoading">
                <span class="loading-spinner"></span>
                <span class="mono">Correlating VBD attachments with workloads and resident hosts...</span>
              </div>
              <div class="stack-item" v-else-if="detailError">
                <div>
                  <strong>Topology mapping unavailable</strong>
                  <div class="text-muted mono" style="font-size:11px">{{ detailError }}</div>
                </div>
                <span class="badge badge-error">error</span>
              </div>
              <div class="stack-item" v-else-if="!selectedSrAttachmentRows.length">
                <span class="mdi mdi-connection text-muted"></span>
                <span class="mono">No workload attachment topology was resolved for this repository.</span>
              </div>
              <div class="stack-item" v-for="row in selectedSrAttachmentRows" :key="row.id">
                <div>
                  <strong>{{ row.vdiName }}</strong>
                  <div class="text-muted mono" style="font-size:11px">{{ row.vbdRef || 'No VBD ref' }} · {{ row.vmName }}</div>
                  <div class="text-muted mono" style="font-size:11px">{{ row.hostName }} · {{ row.detail }}</div>
                </div>
                <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:flex-end">
                  <span class="badge badge-running" v-if="isFocusedAttachment(row)">focused attachment</span>
                  <button class="btn btn-sm" v-if="row.vmRef" @click="openVmWorkspace(row)">
                    <span class="mdi mdi-open-in-app"></span>
                    Open VM
                  </button>
                  <button class="btn btn-sm" v-if="row.hostRef" @click="openHostWorkspace(row)">
                    <span class="mdi mdi-server-outline"></span>
                    Open Host
                  </button>
                  <status-badge :status="row.status"></status-badge>
                </div>
              </div>
            </div>
          </div>
        </div>
      </floating-window>
    </div>
  `,
  data() {
    return {
      loading: true,
      srs: [],
      selectedSR: null,
      showProps: false,
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
      workspaceMessage: '',
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
    selectedSrRows() {
      const selected = new Set(Array.isArray(this.selectedSrRefs) ? this.selectedSrRefs : []);
      return this.srs.filter((sr) => selected.has(sr.ref));
    },
    selectedSrSelectionSummary() {
      if (!this.selectedSrRows.length) return 'No storage repositories selected.';
      const totalCapacity = this.selectedSrRows.reduce((sum, sr) => sum + Number(sr.physical_size || 0), 0);
      const totalAllocation = this.selectedSrRows.reduce((sum, sr) => sum + Number(sr.virtual_allocation || 0), 0);
      return `${this.formatBytes(totalAllocation)} allocated of ${this.formatBytes(totalCapacity)} across ${this.selectedSrRows.length} ${this.selectedSrRows.length === 1 ? 'repository' : 'repositories'}`;
    },
    selectedSrAttachmentRows() {
      if (!this.vdis.length) return [];

      return this.vdis.flatMap((vdi) => {
        const vbdRefs = Array.isArray(vdi.VBDs) ? vdi.VBDs : [];
        const attachedVms = this.relatedVMs.filter((vm) =>
          Array.isArray(vm.VBDs) && vm.VBDs.some((ref) => vbdRefs.includes(ref))
        );

        if (!attachedVms.length) {
          return [{
            id: `${vdi.ref || vdi.uuid || 'vdi'}-unattached`,
            vdiRef: vdi.ref || '',
            vdiUuid: vdi.uuid || '',
            vdiName: vdi.name_label || vdi.ref || 'Unnamed VDI',
            vbdRef: vbdRefs[0] || '',
            vmRef: '',
            vmUuid: '',
            vmName: 'No mapped workload',
            hostName: 'Unplaced / not discovered',
            detail: `${formatBytes(vdi.virtual_size)} · ${vdi.type || 'disk'} · no VM attachment match`,
            status: 'warning',
          }];
        }

        return attachedVms.map((vm) => {
          const matchedVbdRef = (vm.VBDs || []).find((ref) => vbdRefs.includes(ref)) || '';
          const host = this.relatedHosts.find((candidate) =>
            candidate.ref === vm.resident_on || candidate.uuid === vm.resident_on
          ) || null;

          return {
            id: `${vdi.ref || vdi.uuid || 'vdi'}-${vm.ref || vm.uuid || 'vm'}-${matchedVbdRef || 'vbd'}`,
            vdiRef: vdi.ref || '',
            vdiUuid: vdi.uuid || '',
            vdiName: vdi.name_label || vdi.ref || 'Unnamed VDI',
            vbdRef: matchedVbdRef,
            vmRef: vm.ref || '',
            vmUuid: vm.uuid || '',
            vmName: vm.name_label || vm.ref || 'Virtual Machine',
            hostRef: host?.ref || '',
            hostUuid: host?.uuid || '',
            hostName: host ? (host.name_label || host.address || host.ref || 'Host') : 'Host not mapped',
            detail: `${formatBytes(vdi.virtual_size)} · ${vm.power_state || 'Unknown'} · ${host?.address || host?.uuid || vm.resident_on || 'no host ref'}`,
            status: vm.power_state || 'info',
          };
        });
      });
    },
    storageVdiAttachmentCounts() {
      return Object.fromEntries(this.vdis.map((vdi) => [vdi.ref, this.getVdiAttachmentCount(vdi)]));
    },
    selectedSrWorkloadCount() {
      return new Set(this.selectedSrAttachmentRows.filter((row) => row.vmRef).map((row) => row.vmRef)).size;
    },
    selectedSrAttachmentPathCount() {
      return new Set(
        this.selectedSrAttachmentRows
          .map((row) => row.vbdRef)
          .filter((ref) => Boolean(ref))
      ).size;
    },
    selectedSrTopologyLabel() {
      if (!this.selectedSR) return '-';

      const diskCount = this.vdis.length;
      const attachmentCount = this.selectedSrAttachmentPathCount;
      const workloadCount = this.selectedSrWorkloadCount;
      const hostCount = new Set(
        this.selectedSrAttachmentRows
          .map((row) => row.hostRef || row.hostUuid || (row.hostName !== 'Host not mapped' ? row.hostName : ''))
          .filter((value) => Boolean(value))
      ).size;

      const parts = [
        `${diskCount} disk${diskCount === 1 ? '' : 's'}`,
        `${attachmentCount} attachment path${attachmentCount === 1 ? '' : 's'}`,
        `${workloadCount} workload${workloadCount === 1 ? '' : 's'}`,
      ];

      if (hostCount) {
        parts.push(`${hostCount} host${hostCount === 1 ? '' : 's'}`);
      }

      return parts.join(' · ');
    },
    focusedStorageContext() {
      if (!this.focusedStorageClass) return null;

      if (this.focusedStorageClass === 'vdi') {
        return {
          title: 'Focused VDI Handoff',
          summary: 'This repository was opened from a specific virtual disk path.',
          detail: `${this.focusedVdiRef || this.focusedVdiUuid || 'Virtual disk ref unavailable'} · ${this.selectedSrTopologyLabel}`,
        };
      }

      if (this.focusedStorageClass === 'vbd') {
        return {
          title: 'Focused VBD Handoff',
          summary: 'This repository was opened from a specific attachment path.',
          detail: `${this.focusedVbdRef || 'Attachment ref unavailable'} · ${this.selectedSrTopologyLabel}`,
        };
      }

      return null;
    },
    selectedSrDestroyBlockedReason() {
      if (!this.selectedSR) return 'No storage repository is selected.';
      if (this.detailLoading) return 'Storage relationships are still loading before destroy safety checks can finish.';
      if (this.vdis.length) {
        return `Destroy requires an empty repository. ${this.vdis.length} ${this.vdis.length === 1 ? 'disk' : 'disks'} still map to this storage repository.`;
      }
      return '';
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
      this.createSrBusy = true;

      try {
        const record = await api.createSR(payload);
        const targetHost = this.availableHosts.find((host) => host.ref === payload.hostRef);
        await this.loadSRs();
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
    clearSelectedStorageDetail() {
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
    async openProperties(row, options = {}) {
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

      this.detailLoading = false;
    },
    async applyBulkStorageAction(action) {
      if (action !== 'rescan') return;

      const targets = this.selectedSrRows;
      if (!targets.length) {
        this.bulkError = 'No selected storage repositories are available for rescanning.';
        return;
      }

      this.bulkError = null;
      this.bulkActionBusy = action;
      let completed = 0;

      try {
        for (const sr of targets) {
          try {
            await api.rescanSR(sr.ref);
            completed += 1;
          } catch (error) {
            this.bulkError = completed
              ? `Processed ${completed} repository${completed === 1 ? '' : 'ies'} before stopping: ${error.message || 'Unable to continue the storage rescan.'}`
              : (error.message || 'Unable to continue the storage rescan.');
            return;
          }
        }
      } finally {
        this.bulkActionBusy = '';
      }

      await this.loadSRs();

      if (this.selectedSR?.ref && targets.some((sr) => sr.ref === this.selectedSR.ref)) {
        const updated = this.srs.find((sr) => sr.ref === this.selectedSR.ref) || this.selectedSR;
        await this.openProperties(updated);
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

      if (this.selectedSrDestroyBlockedReason) {
        this.detailActionError = this.selectedSrDestroyBlockedReason;
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
        const record = await api.createStorageVdi(this.selectedSR.ref, payload);
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
    getVdiAttachmentCount(vdi) {
      const refs = new Set(Array.isArray(vdi?.VBDs) ? vdi.VBDs : []);
      if (!refs.size) return 0;

      return this.relatedVMs.filter((vm) =>
        Array.isArray(vm.VBDs) && vm.VBDs.some((ref) => refs.has(ref))
      ).length;
    },
    getVdiDeleteBlockedReason(vdi) {
      const attachmentCount = this.getVdiAttachmentCount(vdi);
      if (!attachmentCount) return '';
      return `Delete is limited to detached VDIs. ${attachmentCount} workload attachment${attachmentCount === 1 ? '' : 's'} still map to this disk.`;
    },
    isFocusedVdi(vdi) {
      return recordMatchesRouteFocus(vdi, {
        ref: this.focusedVdiRef,
        uuid: this.focusedVdiUuid,
        name: '',
        kind: 'storage',
        cls: '',
        source: 'focus',
      }, ['ref', 'uuid', 'name_label'], this.focusedVdiRef ? (vdi.VBDs || []) : []);
    },
    isFocusedAttachment(row) {
      return normalizeFocusValue(row?.vbdRef) === normalizeFocusValue(this.focusedVbdRef);
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
