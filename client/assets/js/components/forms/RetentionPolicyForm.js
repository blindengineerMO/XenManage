function buildRetentionPolicyDraft(initialValue = {}) {
  return {
    enabled: initialValue.enabled !== false,
    retentionDays: Number(initialValue.retentionDays || 30),
  };
}

const RetentionPolicyForm = {
  props: ['initialValue', 'saving', 'submitLabel'],
  emits: ['submit'],
  template: `
    <form @submit.prevent="handleSubmit">
      <div class="vm-inline-form-grid">
        <div class="form-group">
          <label for="retention-days">Retention Window (days)</label>
          <input id="retention-days"
                 class="form-input"
                 type="number"
                 min="1"
                 max="3650"
                 v-model.number="draft.retentionDays">
        </div>
      </div>

      <label class="form-toggle">
        <input type="checkbox" v-model="draft.enabled">
        <span>Enable this retention policy for scheduled and manual sweeps</span>
      </label>

      <div class="form-actions">
        <button class="form-btn" type="submit" :disabled="saving">
          <span class="mdi mdi-content-save-outline"></span>
          {{ saving ? 'Saving...' : (submitLabel || 'Save Retention Policy') }}
        </button>
      </div>
    </form>
  `,
  data() {
    return {
      draft: buildRetentionPolicyDraft(this.initialValue),
    };
  },
  watch: {
    initialValue: {
      deep: true,
      handler(value) {
        this.draft = buildRetentionPolicyDraft(value);
      },
    },
  },
  methods: {
    handleSubmit() {
      this.$emit('submit', {
        enabled: Boolean(this.draft.enabled),
        retentionDays: Number(this.draft.retentionDays || 30),
      });
    },
  },
};
