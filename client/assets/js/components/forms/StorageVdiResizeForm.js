function buildStorageVdiResizeDraft(vdiOptions = [], focusedVdiRef = '') {
  const initial = (vdiOptions || []).find((entry) => entry.ref === focusedVdiRef) || vdiOptions[0] || null;
  return {
    vdiRef: initial?.ref || '',
    sizeGiB: Math.max(1, Math.round(Number(initial?.virtual_size || 0) / (1024 ** 3)) || 1),
  };
}

const StorageVdiResizeForm = {
  props: ['vdiOptions', 'focusedVdiRef', 'submitLabel', 'saving', 'attachmentCounts'],
  emits: ['submit'],
  template: `
    <form @submit.prevent="handleSubmit">
      <div class="form-group">
        <label for="storage-vdi-resize-target">Target VDI</label>
        <select id="storage-vdi-resize-target" class="form-input" v-model="draft.vdiRef" :disabled="!vdiOptions.length" required>
          <option value="" disabled>Select VDI</option>
          <option v-for="vdi in vdiOptions" :key="vdi.ref" :value="vdi.ref">
            {{ vdi.name_label || vdi.ref }} · {{ formatBytes(vdi.virtual_size) }} · {{ vdi.type || 'disk' }}
          </option>
        </select>
      </div>

      <div class="stack-item" v-if="selectedVdi" style="margin-bottom:12px">
        <div>
          <strong>{{ selectedVdi.name_label || 'Selected VDI' }}</strong>
          <div class="text-muted mono" style="font-size:11px">
            {{ selectedVdi.uuid || selectedVdi.ref || 'VDI ref unavailable' }} · current size {{ formatBytes(selectedVdi.virtual_size) }}
          </div>
        </div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <span class="badge badge-warning" v-if="selectedAttachmentCount">attached</span>
          <span class="badge badge-info">{{ selectedVdi.type || 'vdi' }}</span>
        </div>
      </div>

      <div class="stack-item" v-if="resizeGuidance" style="margin-bottom:12px">
        <div>
          <strong>Resize Guidance</strong>
          <div class="text-muted mono" style="font-size:11px">{{ resizeGuidance }}</div>
        </div>
        <span class="badge badge-warning">review</span>
      </div>

      <div class="form-group">
        <label for="storage-vdi-resize-size">New Capacity (GiB)</label>
        <input id="storage-vdi-resize-size" class="form-input" v-model.number="draft.sizeGiB" type="number" min="1" step="1" :disabled="!selectedVdi" required>
      </div>

      <button class="form-btn" type="submit" :disabled="saving || !selectedVdi">
        <span class="mdi mdi-arrow-expand-horizontal"></span>
        {{ saving ? 'Submitting...' : submitLabel }}
      </button>
    </form>
  `,
  data() {
    return {
      draft: buildStorageVdiResizeDraft(this.vdiOptions, this.focusedVdiRef),
    };
  },
  computed: {
    selectedVdi() {
      return (this.vdiOptions || []).find((entry) => entry.ref === this.draft.vdiRef) || null;
    },
    selectedAttachmentCount() {
      if (!this.selectedVdi?.ref) return 0;
      return Number(this.attachmentCounts?.[this.selectedVdi.ref] || 0);
    },
    resizeGuidance() {
      if (!this.selectedAttachmentCount) return '';
      return `This VDI is attached to ${this.selectedAttachmentCount} workload${this.selectedAttachmentCount === 1 ? '' : 's'}. Resize grows the virtual disk, but guest partition and filesystem expansion still need follow-through inside the workload.`;
    },
  },
  watch: {
    vdiOptions: {
      deep: true,
      handler(value) {
        const current = (value || []).find((entry) => entry.ref === this.draft.vdiRef);
        if (!current) {
          this.draft = buildStorageVdiResizeDraft(value || [], this.focusedVdiRef);
          return;
        }

        this.draft.sizeGiB = Math.max(1, Math.round(Number(current.virtual_size || 0) / (1024 ** 3)) || 1);
      },
    },
    focusedVdiRef(value) {
      if (!value) return;
      const focused = (this.vdiOptions || []).find((entry) => entry.ref === value);
      if (!focused) return;

      this.draft.vdiRef = focused.ref;
      this.draft.sizeGiB = Math.max(1, Math.round(Number(focused.virtual_size || 0) / (1024 ** 3)) || 1);
    },
  },
  methods: {
    formatBytes,
    handleSubmit() {
      this.$emit('submit', {
        vdiRef: this.draft.vdiRef,
        sizeBytes: Math.max(1, Number(this.draft.sizeGiB || 1)) * (1024 ** 3),
      });
    },
  },
};
