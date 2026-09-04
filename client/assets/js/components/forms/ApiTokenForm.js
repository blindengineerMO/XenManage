function buildApiTokenDraft() {
  return {
    name: '',
    permissions: '',
    expiresAt: '',
    allowedIps: '',
  };
}

const ApiTokenForm = {
  props: ['saving', 'submitLabel'],
  emits: ['submit'],
  template: `
    <form @submit.prevent="handleSubmit">
      <div class="form-group">
        <label for="api-token-name">Token Name</label>
        <input id="api-token-name" class="form-input" v-model="draft.name" required maxlength="120" placeholder="CI deployment token">
      </div>

      <div class="form-group">
        <label for="api-token-permissions">Permissions (comma-separated, blank grants the account's full role template)</label>
        <input id="api-token-permissions" class="form-input" v-model="draft.permissions" placeholder="vm.read, vm.create">
      </div>

      <div class="vm-inline-form-grid">
        <div class="form-group">
          <label for="api-token-expires">Expires At (optional)</label>
          <input id="api-token-expires" class="form-input" v-model="draft.expiresAt" type="date">
        </div>
      </div>

      <div class="form-group">
        <label for="api-token-ips">Allowed IPs (comma-separated IPv4/IPv6 addresses or IPv4 CIDR ranges, blank allows any)</label>
        <input id="api-token-ips" class="form-input" v-model="draft.allowedIps" placeholder="203.0.113.4, 198.51.100.0/24">
      </div>

      <div class="form-actions">
        <button class="form-btn" type="submit" :disabled="saving || !draft.name.trim()">
          <span class="mdi mdi-key-plus"></span>
          {{ saving ? 'Creating...' : (submitLabel || 'Create Token') }}
        </button>
      </div>
    </form>
  `,
  data() {
    return { draft: buildApiTokenDraft() };
  },
  methods: {
    handleSubmit() {
      this.$emit('submit', {
        name: this.draft.name.trim(),
        permissions: this.draft.permissions.split(',').map((entry) => entry.trim()).filter(Boolean),
        expiresAt: this.draft.expiresAt ? new Date(this.draft.expiresAt).toISOString() : '',
        allowedIps: this.draft.allowedIps.split(',').map((entry) => entry.trim()).filter(Boolean),
      });
      this.draft = buildApiTokenDraft();
    },
  },
};
