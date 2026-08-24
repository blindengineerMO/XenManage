function buildGovernanceApprovalDraft(initialValue = {}) {
  return {
    actionKey: initialValue.actionKey || 'vm_shutdown',
    entityType: initialValue.entityType || 'vm',
    entityRef: initialValue.entityRef || '',
    entityName: initialValue.entityName || '',
    route: initialValue.route || '/vms',
    justification: initialValue.justification || '',
  };
}

const GovernanceApprovalForm = {
  props: ['initialValue', 'saving', 'submitLabel'],
  emits: ['submit'],
  template: `
    <form @submit.prevent="handleSubmit">
      <div class="vm-inline-form-grid">
        <div class="form-group">
          <label for="governance-approval-action">Approval Action</label>
          <select id="governance-approval-action" class="form-input" v-model="draft.actionKey">
            <option value="vm_shutdown">VM Shutdown</option>
            <option value="vm_reboot">VM Reboot</option>
            <option value="vm_suspend">VM Suspend</option>
            <option value="connection_delete">Remove Saved Pool Target</option>
            <option value="host_target_delete">Remove Saved Host Target</option>
          </select>
        </div>

        <div class="form-group">
          <label for="governance-approval-type">Entity Type</label>
          <select id="governance-approval-type" class="form-input" v-model="draft.entityType">
            <option value="vm">VM</option>
            <option value="connection">Connection</option>
            <option value="host-target">Host Target</option>
          </select>
        </div>
      </div>

      <div class="vm-inline-form-grid">
        <div class="form-group">
          <label for="governance-approval-ref">Entity Ref</label>
          <input id="governance-approval-ref" class="form-input" v-model="draft.entityRef" placeholder="OpaqueRef:vm-demo-1">
        </div>

        <div class="form-group">
          <label for="governance-approval-name">Entity Name</label>
          <input id="governance-approval-name" class="form-input" v-model="draft.entityName" placeholder="billing-api-01">
        </div>
      </div>

      <div class="form-group">
        <label for="governance-approval-route">Route</label>
        <input id="governance-approval-route" class="form-input" v-model="draft.route" placeholder="/vms">
      </div>

      <div class="form-group">
        <label for="governance-approval-justification">Justification</label>
        <textarea id="governance-approval-justification"
                  class="form-input form-textarea"
                  v-model="draft.justification"
                  rows="5"
                  placeholder="Document why this destructive action is needed and what safety checks were completed first."></textarea>
      </div>

      <div class="form-actions">
        <button class="form-btn" type="submit" :disabled="saving">
          <span class="mdi mdi-clipboard-check-outline"></span>
          {{ saving ? 'Submitting...' : (submitLabel || 'Request Approval') }}
        </button>
      </div>
    </form>
  `,
  data() {
    return {
      draft: buildGovernanceApprovalDraft(this.initialValue),
    };
  },
  watch: {
    initialValue: {
      deep: true,
      handler(value) {
        this.draft = buildGovernanceApprovalDraft(value);
      },
    },
  },
  methods: {
    handleSubmit() {
      this.$emit('submit', {
        actionKey: this.draft.actionKey,
        entityType: this.draft.entityType,
        entityRef: this.draft.entityRef.trim(),
        entityName: this.draft.entityName.trim(),
        route: this.draft.route.trim(),
        justification: this.draft.justification.trim(),
      });
    },
  },
};
