const StoragePropertiesWindow = {
  components: {
    FloatingWindow,
    StatusBadge,
  },
  props: {
    show: {
      type: Boolean,
      default: false,
    },
    selectedSr: {
      type: Object,
      default: null,
    },
    vdis: {
      type: Array,
      default: () => [],
    },
    relatedVms: {
      type: Array,
      default: () => [],
    },
    storageDetailProfile: {
      type: Object,
      default: () => ({
        attachmentPathCount: 0,
        workloadCount: 0,
        topologyLabel: '',
        otherConfigSummary: '',
        focusedContext: null,
        attachmentRows: [],
      }),
    },
    detailLoading: {
      type: Boolean,
      default: false,
    },
    detailError: {
      type: String,
      default: '',
    },
    detailActionBusy: {
      type: String,
      default: '',
    },
    detailActionError: {
      type: String,
      default: '',
    },
    detailActionMessage: {
      type: String,
      default: '',
    },
    focusedVdiRef: {
      type: String,
      default: '',
    },
    focusedVdiUuid: {
      type: String,
      default: '',
    },
    focusedVbdRef: {
      type: String,
      default: '',
    },
    focusedStorageClass: {
      type: String,
      default: '',
    },
  },
  emits: [
    'close',
    'open-sr-identity',
    'open-sr-actions',
    'open-sr-create-vdi',
    'open-sr-resize-vdi',
    'delete-vdi',
    'open-vm-workspace',
    'open-host-workspace',
  ],
  template: `
    <floating-window :show="show" title="Storage Repository" :width="880" :height="620" @close="$emit('close')">
      <div v-if="selectedSr">
        <div class="property-grid">
          <span class="text-muted">Name</span><span>{{ selectedSr.name_label || '-' }}</span>
          <span class="text-muted">Description</span><span>{{ selectedSr.name_description || '-' }}</span>
          <span class="text-muted">Type</span><span>{{ selectedSr.type || '-' }}</span>
          <span class="text-muted">Physical Size</span><span class="mono">{{ formatBytes(selectedSr.physical_size) }}</span>
          <span class="text-muted">Virtual Allocation</span><span class="mono">{{ formatBytes(selectedSr.virtual_allocation) }}</span>
          <span class="text-muted">Local Cache</span><span>{{ selectedSr.local_cache_enabled ? 'Enabled' : 'Disabled' }}</span>
          <span class="text-muted">Mapped VDIs</span><span>{{ summarizeCount('disks', vdis.length) }}</span>
          <span class="text-muted">Attachment Paths</span><span>{{ summarizeCount('attachment paths', storageDetailProfile.attachmentPathCount) }}</span>
          <span class="text-muted">Attached Workloads</span><span>{{ summarizeCount('workloads', storageDetailProfile.workloadCount) }}</span>
          <span class="text-muted">Topology</span><span>{{ storageDetailProfile.topologyLabel }}</span>
          <span class="text-muted">UUID</span><span class="mono property-wrap">{{ selectedSr.uuid || '-' }}</span>
          <span class="text-muted">Tags</span><span>{{ truncateList(selectedSr.tags) }}</span>
          <span class="text-muted">Other Config</span><span>{{ storageDetailProfile.otherConfigSummary }}</span>
        </div>

        <div class="detail-section" v-if="storageDetailProfile.focusedContext">
          <div class="detail-section-title">{{ storageDetailProfile.focusedContext.title }}</div>
          <div class="capacity-callout">
            <strong>{{ storageDetailProfile.focusedContext.summary }}</strong>
            <div class="text-muted mono" style="font-size:11px;margin-top:8px">{{ storageDetailProfile.focusedContext.detail }}</div>
          </div>
        </div>

        <div class="detail-section">
          <div class="detail-section-title">Storage Operations</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn btn-sm" type="button" @click="$emit('open-sr-identity')">
              <span class="mdi mdi-card-text-outline"></span>
              Repository Identity
            </button>
            <button class="btn btn-sm" type="button" @click="$emit('open-sr-actions')">
              <span class="mdi mdi-wrench-cog-outline"></span>
              Repository Actions
            </button>
            <button class="btn btn-sm" type="button" @click="$emit('open-sr-create-vdi')">
              <span class="mdi mdi-database-plus-outline"></span>
              Create Or Attach VDI
            </button>
            <button class="btn btn-sm" type="button" @click="$emit('open-sr-resize-vdi')">
              <span class="mdi mdi-arrow-expand-horizontal"></span>
              Resize Existing VDI
            </button>
          </div>
          <div class="text-muted mono" style="font-size:11px;margin-top:10px">
            {{ selectedSr.type || 'sr' }} · {{ selectedSr.local_cache_enabled ? 'local cache enabled' : 'local cache disabled' }} · {{ summarizeCount('disks', vdis.length) }}
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
                        @click="$emit('delete-vdi', vdi)">
                  <span class="mdi mdi-delete-outline"></span>
                  {{ detailActionBusy === 'delete-vdi:' + vdi.ref ? 'Deleting...' : 'Delete' }}
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
            <div class="stack-item" v-else-if="!storageDetailProfile.attachmentRows.length">
              <span class="mdi mdi-connection text-muted"></span>
              <span class="mono">No workload attachment topology was resolved for this repository.</span>
            </div>
            <div class="stack-item" v-for="row in storageDetailProfile.attachmentRows" :key="row.id">
              <div>
                <strong>{{ row.vdiName }}</strong>
                <div class="text-muted mono" style="font-size:11px">{{ row.vbdRef || 'No VBD ref' }} · {{ row.vmName }}</div>
                <div class="text-muted mono" style="font-size:11px">{{ row.hostName }} · {{ row.detail }}</div>
              </div>
              <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:flex-end">
                <span class="badge badge-running" v-if="isFocusedAttachment(row)">focused attachment</span>
                <button class="btn btn-sm" v-if="row.vmRef" @click="$emit('open-vm-workspace', row)">
                  <span class="mdi mdi-open-in-app"></span>
                  Open VM
                </button>
                <button class="btn btn-sm" v-if="row.hostRef" @click="$emit('open-host-workspace', row)">
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
  `,
  methods: {
    formatBytes,
    summarizeCount,
    truncateList,
    getVdiAttachmentCount(vdi) {
      const refs = new Set(Array.isArray(vdi?.VBDs) ? vdi.VBDs : []);
      if (!refs.size) return 0;

      return this.relatedVms.filter((vm) =>
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
  },
};
