function buildCredentialVaultDraft(initialValue = {}) {
  return {
    name: initialValue.name || '',
    scope: initialValue.scope || 'private',
    targetType: initialValue.targetType || 'pool',
    targetHint: initialValue.targetHint || '',
    username: initialValue.username || 'root',
    password: '',
  };
}

const CredentialVaultForm = {
  props: ['initialValue', 'saving', 'submitLabel', 'mode'],
  emits: ['submit'],
  template: `
    <form @submit.prevent="handleSubmit">
      <div class="vm-inline-form-grid">
        <div class="form-group">
          <label for="vault-credential-name">Credential Name</label>
          <input id="vault-credential-name"
                 class="form-input"
                 v-model="draft.name"
                 placeholder="Production Pool Root"
                 required>
        </div>

        <div class="form-group">
          <label for="vault-credential-scope">Visibility</label>
          <select id="vault-credential-scope" class="form-input" v-model="draft.scope">
            <option value="private">Private</option>
            <option value="shared">Shared</option>
          </select>
          <div class="text-muted" style="font-size:12px;margin-top:6px">
            Private credentials stay personal to the current operator. Shared credentials can be linked by any authenticated XenMange user.
          </div>
        </div>

        <div class="form-group">
          <label for="vault-credential-target-type">Target Type</label>
          <select id="vault-credential-target-type" class="form-input" v-model="draft.targetType">
            <option value="pool">Pool</option>
            <option value="host">Host</option>
          </select>
        </div>

        <div class="form-group">
          <label for="vault-credential-target-hint">Target Hint</label>
          <input id="vault-credential-target-hint"
                 class="form-input"
                 v-model="draft.targetHint"
                 placeholder="prod-pool-a or 10.0.0.25">
          <div class="text-muted" style="font-size:12px;margin-top:6px">
            Optional hostname, IP, or operator note used to help distinguish similar credentials.
          </div>
        </div>

        <div class="form-group">
          <label for="vault-credential-username">Username</label>
          <input id="vault-credential-username"
                 class="form-input"
                 v-model="draft.username"
                 placeholder="root"
                 required>
        </div>

        <div class="form-group">
          <label for="vault-credential-password">{{ isEditMode ? 'Rotate Secret' : 'Password' }}</label>
          <input id="vault-credential-password"
                 class="form-input"
                 v-model="draft.password"
                 type="password"
                 :placeholder="isEditMode ? 'Leave blank to keep the current secret' : 'Password'"
                 :required="!isEditMode">
          <div class="text-muted" style="font-size:12px;margin-top:6px">
            {{ isEditMode ? 'Leave this empty to update metadata only. Entering a value rotates the encrypted secret.' : 'The password is encrypted server-side and never returned to the browser after save.' }}
          </div>
        </div>
      </div>

      <div class="form-actions">
        <button class="form-btn" type="submit" :disabled="saving">
          <span class="mdi mdi-content-save-outline"></span>
          {{ saving ? 'Saving...' : (submitLabel || 'Save Credential') }}
        </button>
      </div>
    </form>
  `,
  data() {
    return {
      draft: buildCredentialVaultDraft(this.initialValue),
    };
  },
  computed: {
    isEditMode() {
      return this.mode === 'edit';
    },
  },
  watch: {
    initialValue: {
      deep: true,
      handler(value) {
        this.draft = buildCredentialVaultDraft(value);
      },
    },
  },
  methods: {
    handleSubmit() {
      this.$emit('submit', {
        name: String(this.draft.name || '').trim(),
        scope: this.draft.scope === 'shared' ? 'shared' : 'private',
        targetType: this.draft.targetType === 'host' ? 'host' : 'pool',
        targetHint: String(this.draft.targetHint || '').trim(),
        username: String(this.draft.username || '').trim(),
        password: String(this.draft.password || ''),
      });
    },
  },
};
