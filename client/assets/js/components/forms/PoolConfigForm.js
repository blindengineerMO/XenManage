function buildPoolConfigDraft(value = {}) {
  return {
    nameLabel: value.name_label || value.nameLabel || '',
    nameDescription: value.name_description || value.nameDescription || '',
  };
}

const PoolConfigForm = {
  props: ['initialValue', 'submitLabel', 'saving'],
  emits: ['submit'],
  template: `
    <form @submit.prevent="handleSubmit">
      <div class="form-group">
        <label for="pool-config-name">Pool Name</label>
        <input id="pool-config-name"
               class="form-input"
               v-model="draft.nameLabel"
               placeholder="Production Pool"
               required>
      </div>

      <div class="form-group">
        <label for="pool-config-description">Description</label>
        <textarea id="pool-config-description"
                  class="form-input form-textarea"
                  rows="4"
                  v-model="draft.nameDescription"
                  placeholder="Describe the pool role, tenancy, or operator notes."></textarea>
      </div>

      <div class="text-muted mono" style="font-size:11px;margin-bottom:12px">
        This editor updates the operator-facing pool label and description only. Default SR, HA posture, and advanced pool policy controls remain follow-on parity work.
      </div>

      <button class="form-btn" type="submit" :disabled="saving">
        <span class="mdi mdi-content-save-outline"></span>
        {{ saving ? 'Saving...' : (submitLabel || 'Save Pool Metadata') }}
      </button>
    </form>
  `,
  data() {
    return {
      draft: buildPoolConfigDraft(this.initialValue),
    };
  },
  watch: {
    initialValue: {
      deep: true,
      handler(value) {
        this.draft = buildPoolConfigDraft(value);
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
