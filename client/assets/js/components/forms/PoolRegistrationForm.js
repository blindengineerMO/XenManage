const PoolRegistrationForm = {
  props: ['initialValue', 'submitLabel', 'credentialOptions'],
  emits: ['submit'],
  template: `
    <form @submit.prevent="handleSubmit">
      <div class="form-group">
        <label for="pool-name">Profile Name</label>
        <input id="pool-name" class="form-input" v-model="draft.name" placeholder="Production Pool" required>
      </div>
      <div class="form-group">
        <label for="pool-host">Pool Address</label>
        <input id="pool-host" class="form-input" v-model="draft.host" placeholder="pool.example.local" required>
      </div>
      <div class="form-group">
        <label for="pool-username">Username</label>
        <input id="pool-username" class="form-input" v-model="draft.username" placeholder="root" required>
      </div>
      <div class="form-group">
        <label for="pool-vault-credential">Saved Vault Credential</label>
        <select id="pool-vault-credential" class="form-input" v-model.number="draft.vaultCredentialId">
          <option :value="null">Use manual password at connect time</option>
          <option v-for="credential in filteredCredentialOptions" :key="credential.id" :value="credential.id">
            {{ credential.name }} · {{ credential.username }} · {{ credential.scope }}
          </option>
        </select>
        <div class="login-meta-note" v-if="selectedCredential">
          This pool target is linked to the saved vault credential for <span class="mono">{{ selectedCredential.username }}</span>.
        </div>
      </div>
      <div class="form-group">
        <label for="pool-port">Port</label>
        <input id="pool-port" class="form-input" v-model.number="draft.port" type="number" min="1" max="65535" required>
      </div>
      <div class="form-group">
        <label for="pool-visibility">Visibility</label>
        <select id="pool-visibility" class="form-input" v-model="draft.visibility">
          <option value="private">Private to my control-plane account</option>
          <option value="shared">Shared with other operators</option>
        </select>
      </div>
      <label class="form-toggle">
        <input type="checkbox" v-model="draft.isDefault">
        <span>Set as default saved pool target</span>
      </label>
      <div class="form-actions">
        <button class="form-btn" type="submit">{{ submitLabel || 'Save Pool Target' }}</button>
      </div>
    </form>
  `,
  data() {
    return {
      draft: this.buildDraft(this.initialValue),
    };
  },
  computed: {
    filteredCredentialOptions() {
      return (this.credentialOptions || []).filter((credential) => credential.targetType === 'pool');
    },
    selectedCredential() {
      return this.filteredCredentialOptions.find((credential) => Number(credential.id) === Number(this.draft.vaultCredentialId || 0)) || null;
    },
  },
  watch: {
    initialValue: {
      deep: true,
      handler(value) {
        this.draft = this.buildDraft(value);
      },
    },
    'draft.vaultCredentialId'(value) {
      const credential = this.filteredCredentialOptions.find((entry) => Number(entry.id) === Number(value || 0));
      if (credential) {
        this.draft.username = credential.username || this.draft.username;
      }
    },
  },
  methods: {
    buildDraft(value) {
      return {
        name: value?.name || '',
        host: value?.host || '',
        username: value?.username || 'root',
        vaultCredentialId: value?.vault_credential_id || value?.vaultCredentialId || null,
        port: Number(value?.port || 443),
        isDefault: Boolean(value?.is_default || value?.isDefault),
        visibility: value?.visibility || 'private',
      };
    },
    handleSubmit() {
      this.$emit('submit', {
        name: this.draft.name.trim(),
        host: this.draft.host.trim(),
        username: this.draft.username.trim(),
        vaultCredentialId: this.draft.vaultCredentialId ? Number(this.draft.vaultCredentialId) : null,
        port: Number(this.draft.port || 443),
        visibility: this.draft.visibility || 'private',
        isDefault: Boolean(this.draft.isDefault),
      });
    },
  },
};
