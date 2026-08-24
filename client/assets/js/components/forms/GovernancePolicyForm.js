function buildGovernancePolicyDraft(initialValue = {}) {
  return {
    defaultRole: initialValue.defaultRole || 'admin',
    requireDestructiveApproval: initialValue.requireDestructiveApproval !== false,
    approvalTtlMinutes: Number(initialValue.approvalTtlMinutes || 240),
  };
}

const GovernancePolicyForm = {
  props: ['initialValue', 'saving', 'submitLabel'],
  emits: ['submit'],
  template: `
    <form @submit.prevent="handleSubmit">
      <div class="vm-inline-form-grid">
        <div class="form-group">
          <label for="governance-default-role">Default Role</label>
          <select id="governance-default-role" class="form-input" v-model="draft.defaultRole">
            <option value="read-only">Read Only</option>
            <option value="operator">Operator</option>
            <option value="admin">Admin</option>
          </select>
        </div>

        <div class="form-group">
          <label for="governance-approval-ttl">Approval Window (minutes)</label>
          <input id="governance-approval-ttl" class="form-input" v-model.number="draft.approvalTtlMinutes" type="number" min="5" max="10080">
        </div>
      </div>

      <label class="form-toggle">
        <input type="checkbox" v-model="draft.requireDestructiveApproval">
        <span>Require approved governance tokens for destructive actions in operator mode</span>
      </label>

      <div class="form-actions">
        <button class="form-btn" type="submit" :disabled="saving">
          <span class="mdi mdi-content-save-outline"></span>
          {{ saving ? 'Saving...' : (submitLabel || 'Save Governance Policy') }}
        </button>
      </div>
    </form>
  `,
  data() {
    return {
      draft: buildGovernancePolicyDraft(this.initialValue),
    };
  },
  watch: {
    initialValue: {
      deep: true,
      handler(value) {
        this.draft = buildGovernancePolicyDraft(value);
      },
    },
  },
  methods: {
    handleSubmit() {
      this.$emit('submit', {
        defaultRole: this.draft.defaultRole,
        requireDestructiveApproval: Boolean(this.draft.requireDestructiveApproval),
        approvalTtlMinutes: Number(this.draft.approvalTtlMinutes || 240),
      });
    },
  },
};
