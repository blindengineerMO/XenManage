function buildHostConfigDraft(value = {}) {
  return {
    nameLabel: value.name_label || value.nameLabel || '',
    nameDescription: value.name_description || value.nameDescription || '',
  };
}

const HostConfigForm = {
  props: ['initialValue', 'submitLabel', 'saving'],
  emits: ['submit'],
  template: `
    <form @submit.prevent="handleSubmit">
      <div class="form-group">
        <label for="host-config-name">Host Name</label>
        <input id="host-config-name"
               class="form-input"
               v-model="draft.nameLabel"
               placeholder="alpha-xen"
               required>
      </div>

      <div class="form-group">
        <label for="host-config-description">Description</label>
        <textarea id="host-config-description"
                  class="form-input form-textarea"
                  rows="4"
                  v-model="draft.nameDescription"
                  placeholder="Describe the host role, patch posture, ownership, or operator notes."></textarea>
      </div>

      <div class="text-muted mono" style="font-size:11px;margin-bottom:12px">
        Update the operator-facing host label and long-form description without leaving the Host Properties workspace.
      </div>

      <button class="form-btn" type="submit" :disabled="saving">
        <span class="mdi mdi-content-save-outline"></span>
        {{ saving ? 'Saving...' : (submitLabel || 'Save Host Metadata') }}
      </button>
    </form>
  `,
  data() {
    return {
      draft: buildHostConfigDraft(this.initialValue),
    };
  },
  watch: {
    initialValue: {
      deep: true,
      handler(value) {
        this.draft = buildHostConfigDraft(value);
      },
    },
  },
  methods: {
    handleSubmit() {
      this.$emit('submit', {
        nameLabel: this.draft.nameLabel.trim(),
        nameDescription: this.draft.nameDescription.trim(),
      });
    },
  },
};
