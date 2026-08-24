function buildUserPasswordDraft() {
  return {
    password: '',
  };
}

const UserPasswordForm = {
  props: ['saving', 'submitLabel'],
  emits: ['submit'],
  template: `
    <form @submit.prevent="handleSubmit">
      <div class="vm-inline-form-grid">
        <div class="form-group" style="grid-column:1 / -1">
          <label for="local-user-reset-password">New Password</label>
          <input id="local-user-reset-password"
                 class="form-input"
                 type="password"
                 v-model="draft.password"
                 placeholder="Minimum 10 characters"
                 required>
          <div class="text-muted" style="font-size:12px;margin-top:6px">
            This replaces the user’s local XenMange password immediately.
          </div>
        </div>
      </div>

      <div class="form-actions">
        <button class="form-btn" type="submit" :disabled="saving">
          <span class="mdi mdi-lock-reset"></span>
          {{ saving ? 'Saving...' : (submitLabel || 'Reset Password') }}
        </button>
      </div>
    </form>
  `,
  data() {
    return {
      draft: buildUserPasswordDraft(),
    };
  },
  methods: {
    handleSubmit() {
      this.$emit('submit', {
        password: String(this.draft.password || ''),
      });
      this.draft = buildUserPasswordDraft();
    },
  },
};
