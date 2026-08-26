function buildStorageVdiDraft() {
  return {
    nameLabel: '',
    type: 'user',
    sizeGiB: 20,
  };
}

const StorageVdiForm = {
  props: ['sr', 'submitLabel', 'saving'],
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

      <div class="vm-inline-form-grid">
        <div class="form-group">
          <label for="storage-vdi-type">VDI Type</label>
          <select id="storage-vdi-type" class="form-input" v-model="draft.type" required>
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
      draft: buildStorageVdiDraft(),
    };
  },
  methods: {
    handleSubmit() {
      this.$emit('submit', {
        nameLabel: this.draft.nameLabel.trim(),
        type: String(this.draft.type || 'user').trim(),
        sizeBytes: Math.max(1, Number(this.draft.sizeGiB || 1)) * (1024 ** 3),
      });
      this.draft = buildStorageVdiDraft();
    },
  },
};
