const StorageView = {
  components: { DataTable, FloatingWindow, StatusBadge },
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

      <data-table :columns="columns" :data="srs" :loading="loading" :searchable="true" @row-click="openProperties">
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
            <span class="text-muted">Attached Workloads</span><span>{{ summarizeCount('workloads', selectedSrWorkloadCount) }}</span>
            <span class="text-muted">UUID</span><span class="mono property-wrap">{{ selectedSR.uuid || '-' }}</span>
            <span class="text-muted">Tags</span><span>{{ truncateList(selectedSR.tags) }}</span>
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
                </div>
                <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
                  <span class="badge badge-running" v-if="isFocusedVdi(vdi)">focused</span>
                  <span class="badge badge-info">{{ vdi.managed ? 'managed' : 'unmanaged' }}</span>
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
      focusedVdiRef: '',
      focusedVdiUuid: '',
      focusedVbdRef: '',
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
    selectedSrWorkloadCount() {
      return new Set(this.selectedSrAttachmentRows.filter((row) => row.vmRef).map((row) => row.vmRef)).size;
    },
  },
  async mounted() {
    if (!store.authenticated) {
      this.$router.push('/login');
      return;
    }
    await this.loadSRs();
    await this.syncRouteFocus();
  },
  watch: {
    '$route.query': {
      deep: true,
      async handler() {
        await this.syncRouteFocus();
      },
    },
  },
  methods: {
    formatBytes,
    summarizeCount,
    truncateList,
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
    getVdiAttachmentCount(vdi) {
      const refs = new Set(Array.isArray(vdi?.VBDs) ? vdi.VBDs : []);
      if (!refs.size) return 0;

      return this.relatedVMs.filter((vm) =>
        Array.isArray(vm.VBDs) && vm.VBDs.some((ref) => refs.has(ref))
      ).length;
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
      });
      this.lastAppliedFocusKey = key;
    },
  },
};
