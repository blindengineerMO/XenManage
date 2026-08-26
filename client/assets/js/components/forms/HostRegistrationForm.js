const HostRegistrationForm = {
  props: ['initialValue', 'poolOptions', 'submitLabel', 'credentialOptions'],
  emits: ['submit'],
  template: `
    <form @submit.prevent="handleSubmit">
      <div class="form-group">
        <label for="host-target-name">Host Name</label>
        <input id="host-target-name" class="form-input" v-model="draft.name" placeholder="compute-node-b03" required>
      </div>
      <div class="form-group">
        <label for="host-target-address">Host Address</label>
        <input id="host-target-address" class="form-input" v-model="draft.host" placeholder="10.42.0.13" required>
      </div>
      <div class="form-group">
        <label for="host-target-username">Username</label>
        <input id="host-target-username" class="form-input" v-model="draft.username" placeholder="root" required>
      </div>
      <div class="form-group">
        <label for="host-target-vault-credential">Saved Vault Credential</label>
        <select id="host-target-vault-credential" class="form-input" v-model.number="draft.vaultCredentialId">
          <option :value="null">Use manual password later</option>
          <option v-for="credential in filteredCredentialOptions" :key="credential.id" :value="credential.id">
            {{ credential.name }} · {{ credential.username }} · {{ credential.scope }}
          </option>
        </select>
        <div class="login-meta-note" v-if="selectedCredential">
          This host target is linked to the saved vault credential for <span class="mono">{{ selectedCredential.username }}</span>.
        </div>
      </div>
      <div class="form-group">
        <label for="host-target-port">Port</label>
        <input id="host-target-port" class="form-input" v-model.number="draft.port" type="number" min="1" max="65535" required>
      </div>
      <div class="form-group">
        <label for="host-target-mode">Registration Mode</label>
        <select id="host-target-mode" class="form-input" v-model="draft.mode">
          <option value="standalone">Standalone Host</option>
          <option value="pool-member">Pool Member</option>
        </select>
      </div>
      <div class="form-group" v-if="draft.mode === 'pool-member'">
        <label for="host-target-pool">Target Pool</label>
        <select id="host-target-pool" class="form-input" v-model.number="draft.poolConnectionId" required>
          <option :value="null" disabled>Select a registered pool</option>
          <option v-for="pool in poolOptions" :key="pool.id" :value="pool.id">
            {{ pool.name }} · {{ pool.host }}
          </option>
        </select>
      </div>
      <div class="form-group">
        <label for="host-target-notes">Notes</label>
        <textarea id="host-target-notes" class="form-input" v-model="draft.notes" rows="4" placeholder="Maintenance plan, rack note, onboarding status..."></textarea>
      </div>
      <div class="form-group">
        <label for="host-target-visibility">Visibility</label>
        <select id="host-target-visibility" class="form-input" v-model="draft.visibility">
          <option value="private">Private to my control-plane account</option>
          <option value="shared">Shared with other operators</option>
        </select>
      </div>
      <div class="form-group" v-if="draft.mode === 'standalone' && selectedCredential">
        <label class="form-toggle">
          <input type="checkbox" v-model="draft.attachAfterSave">
          <span>Attach this standalone host to the current session after save</span>
        </label>
        <div class="login-meta-note">
          XenMange will use the linked vault credential server-side and keep you in the current control-plane session.
        </div>
      </div>
      <div class="form-actions">
        <button class="form-btn" type="submit">{{ submitLabel || 'Save Host Target' }}</button>
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
      return (this.credentialOptions || []).filter((credential) => credential.targetType === 'host');
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
    poolOptions() {
      if (this.draft.mode === 'pool-member' && !this.draft.poolConnectionId && this.poolOptions.length) {
        this.draft.poolConnectionId = this.poolOptions[0].id;
      }
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
        mode: value?.mode || 'standalone',
        poolConnectionId: value?.pool_connection_id || value?.poolConnectionId || null,
        notes: value?.notes || '',
        visibility: value?.visibility || 'private',
        attachAfterSave: false,
      };
    },
    handleSubmit() {
      this.$emit('submit', {
        name: this.draft.name.trim(),
        host: this.draft.host.trim(),
        username: this.draft.username.trim(),
        vaultCredentialId: this.draft.vaultCredentialId ? Number(this.draft.vaultCredentialId) : null,
        port: Number(this.draft.port || 443),
        mode: this.draft.mode,
        poolConnectionId: this.draft.mode === 'pool-member' ? Number(this.draft.poolConnectionId || 0) : null,
        notes: this.draft.notes.trim(),
        visibility: this.draft.visibility || 'private',
        attachAfterSave: Boolean(this.draft.attachAfterSave && this.draft.mode === 'standalone' && this.draft.vaultCredentialId),
      });
    },
  },
};
