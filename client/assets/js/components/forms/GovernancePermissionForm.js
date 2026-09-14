function buildPermissionGrantDraft() {
  return {
    permission: '',
    scopeType: 'global',
    scopeRef: '*',
    effect: 'allow',
  };
}

const GovernancePermissionForm = {
  props: ['saving', 'submitLabel'],
  emits: ['submit'],
  template: `
    <form @submit.prevent="handleSubmit">
      <div class="vm-inline-form-grid">
        <div class="form-group">
          <label for="permission-grant-permission">Permission</label>
          <input id="permission-grant-permission" class="form-input" v-model="draft.permission" required placeholder="vm.power.start">
        </div>
        <div class="form-group">
          <label for="permission-grant-effect">Effect</label>
          <select id="permission-grant-effect" class="form-input" v-model="draft.effect">
            <option value="allow">Allow</option>
            <option value="deny">Deny</option>
          </select>
        </div>
      </div>

      <div class="vm-inline-form-grid">
        <div class="form-group">
          <label for="permission-grant-scope-type">Scope</label>
          <select id="permission-grant-scope-type" class="form-input" v-model="draft.scopeType">
            <option value="global">Global</option>
            <option value="organization">Organization</option>
            <option value="project">Project</option>
            <option value="target">Target / Pool Connection</option>
            <option value="pool">Pool</option>
            <option value="resource">Resource</option>
            <option value="tag">Tag</option>
          </select>
        </div>
        <div class="form-group">
          <label for="permission-grant-scope-ref">Scope Reference</label>
          <input id="permission-grant-scope-ref" class="form-input" v-model="draft.scopeRef" placeholder="* for everything in scope">
        </div>
      </div>

      <div class="form-actions">
        <button class="form-btn" type="submit" :disabled="saving || !draft.permission.trim()">
          <span class="mdi mdi-shield-plus-outline"></span>
          {{ saving ? 'Saving...' : (submitLabel || 'Add Grant') }}
        </button>
      </div>
    </form>
  `,
  data() {
    return { draft: buildPermissionGrantDraft() };
  },
  methods: {
    handleSubmit() {
      this.$emit('submit', {
        permission: this.draft.permission.trim(),
        scopeType: this.draft.scopeType,
        scopeRef: this.draft.scopeRef.trim() || '*',
        effect: this.draft.effect,
      });
      this.draft = buildPermissionGrantDraft();
    },
  },
};
