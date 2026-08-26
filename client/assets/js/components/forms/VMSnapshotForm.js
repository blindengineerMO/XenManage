function buildVmSnapshotDraft() {
  return {
    nameLabel: '',
    nameDescription: '',
    mode: 'snapshot',
  };
}

const VMSnapshotForm = {
  props: ['submitLabel', 'saving'],
  emits: ['submit'],
  template: `
    <form @submit.prevent="handleSubmit">
      <div class="form-group">
        <label for="vm-snapshot-name">Snapshot Name</label>
        <input id="vm-snapshot-name" class="form-input" v-model="draft.nameLabel" placeholder="pre-maintenance-2026-08-24" required>
      </div>

      <div class="form-group">
        <label for="vm-snapshot-mode">Protection Mode</label>
        <select id="vm-snapshot-mode" class="form-input" v-model="draft.mode">
          <option value="snapshot">Disk Snapshot</option>
          <option value="checkpoint">Checkpoint</option>
        </select>
      </div>

      <div class="form-group">
        <label for="vm-snapshot-description">Notes</label>
        <textarea id="vm-snapshot-description"
                  class="form-input form-textarea"
                  v-model="draft.nameDescription"
                  placeholder="Capture the reason, change window, or operator note for this restore point."></textarea>
      </div>

      <button class="form-btn" type="submit" :disabled="saving">
        <span class="mdi mdi-camera-plus-outline"></span>
        {{ saving ? 'Creating...' : (submitLabel || 'Create Snapshot') }}
      </button>
    </form>
  `,
  data() {
    return {
      draft: buildVmSnapshotDraft(),
    };
  },
  methods: {
    handleSubmit() {
      this.$emit('submit', {
        nameLabel: this.draft.nameLabel.trim(),
        nameDescription: this.draft.nameDescription.trim(),
        mode: this.draft.mode === 'checkpoint' ? 'checkpoint' : 'snapshot',
      });
      this.draft = buildVmSnapshotDraft();
    },
  },
};
