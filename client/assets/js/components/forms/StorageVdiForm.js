function buildStorageVdiDraft(vmOptions = []) {
  return {
    nameLabel: '',
    attachmentMode: 'detached',
    attachVmRef: vmOptions[0]?.ref || '',
    type: 'user',
    sizeGiB: 20,
  };
}

const StorageVdiForm = {
  props: ['sr', 'submitLabel', 'saving', 'vmOptions'],
  emits: ['submit'],
  template: `
    <form @submit.prevent="handleSubmit">
      <div class="stack-item" style="margin-bottom:12px">
        <div>
          <strong>{{ sr?.name_label || 'Selected repository' }}</strong>
          <div class="text-muted mono" style="font-size:11px">
            {{ sr?.uuid || sr?.ref || 'SR ref unavailable' }} · {{ sr?.type || 'storage' }}
          </div>
        </div>
        <span class="badge badge-info">{{ sr?.type || 'sr' }}</span>
      </div>

      <div class="form-group">
        <label for="storage-vdi-name">VDI Name</label>
        <input id="storage-vdi-name" class="form-input" v-model="draft.nameLabel" placeholder="logs-archive-01" required>
      </div>

      <div class="form-group">
        <label for="storage-vdi-attachment-mode">Provisioning Mode</label>
        <select id="storage-vdi-attachment-mode" class="form-input" v-model="draft.attachmentMode">
          <option value="detached">Create Detached VDI</option>
          <option value="attach" :disabled="!vmOptions?.length">Create And Attach To VM</option>
        </select>
      </div>

      <div class="form-group" v-if="draft.attachmentMode === 'attach'">
        <label for="storage-vdi-attach-vm">Target VM</label>
        <select id="storage-vdi-attach-vm" class="form-input" v-model="draft.attachVmRef" :disabled="!vmOptions.length" required>
          <option value="" disabled>Select workload</option>
          <option v-for="vm in vmOptions" :key="vm.ref" :value="vm.ref">
            {{ vm.name_label || vm.ref }} · {{ vm.power_state || 'Unknown' }}
          </option>
        </select>
      </div>

      <div class="stack-item" v-if="draft.attachmentMode === 'attach'" style="margin-bottom:12px">
        <div>
          <strong>Attachment Workflow</strong>
          <div class="text-muted mono" style="font-size:11px">
            Storage-side attachment reuses the existing VM disk workflow and always provisions a user VDI on the selected repository before attaching it to the target workload.
          </div>
        </div>
        <span class="badge badge-warning">attached</span>
      </div>

      <div class="vm-inline-form-grid">
        <div class="form-group">
          <label for="storage-vdi-type">VDI Type</label>
          <select id="storage-vdi-type" class="form-input" v-model="draft.type" :disabled="draft.attachmentMode === 'attach'" required>
            <option value="user">User</option>
            <option value="system">System</option>
            <option value="metadata">Metadata</option>
            <option value="redo_log">Redo Log</option>
          </select>
        </div>

        <div class="form-group">
          <label for="storage-vdi-size">Capacity (GiB)</label>
          <input id="storage-vdi-size" class="form-input" v-model.number="draft.sizeGiB" type="number" min="1" step="1" required>
        </div>
      </div>

      <button class="form-btn" type="submit" :disabled="saving || !sr?.ref">
        <span class="mdi mdi-database-plus-outline"></span>
        {{ saving ? 'Submitting...' : submitLabel }}
      </button>
    </form>
  `,
  data() {
    return {
      draft: buildStorageVdiDraft(this.vmOptions),
    };
  },
  watch: {
    vmOptions: {
      deep: true,
      handler(value) {
        if (this.draft.attachmentMode === 'attach' && !this.draft.attachVmRef && (value || []).length) {
          this.draft.attachVmRef = value[0].ref;
        }
      },
    },
    'draft.attachmentMode'(value) {
      if (value === 'attach') {
        this.draft.type = 'user';
        if (!this.draft.attachVmRef && (this.vmOptions || []).length) {
          this.draft.attachVmRef = this.vmOptions[0].ref;
        }
      }
    },
  },
  methods: {
    handleSubmit() {
      this.$emit('submit', {
        nameLabel: this.draft.nameLabel.trim(),
        type: this.draft.attachmentMode === 'attach'
          ? 'user'
          : String(this.draft.type || 'user').trim(),
        attachVmRef: this.draft.attachmentMode === 'attach'
          ? String(this.draft.attachVmRef || '').trim()
          : '',
        sizeBytes: Math.max(1, Number(this.draft.sizeGiB || 1)) * (1024 ** 3),
      });
      this.draft = buildStorageVdiDraft(this.vmOptions);
    },
  },
};
