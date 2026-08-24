function buildLocalUserDraft(initialValue = {}, mode = 'create') {
  return {
    username: initialValue.username || '',
    password: '',
    displayName: initialValue.display_name || initialValue.displayName || '',
    email: initialValue.email || '',
    role: initialValue.role || 'operator',
    active: initialValue.active !== false,
    groupIds: Array.isArray(initialValue.groupIds)
      ? initialValue.groupIds.map((value) => String(value))
      : Array.isArray(initialValue.groupsDetailed)
        ? initialValue.groupsDetailed.map((group) => String(group.id))
        : Array.isArray(initialValue.group_ids)
          ? initialValue.group_ids.map((value) => String(value))
          : [],
    mode,
  };
}

const LocalUserForm = {
  props: ['initialValue', 'saving', 'submitLabel', 'mode', 'groupOptions'],
  emits: ['submit'],
  template: `
    <form @submit.prevent="handleSubmit">
      <div class="vm-inline-form-grid">
        <div class="form-group">
          <label for="local-user-username">Username</label>
          <input id="local-user-username"
                 class="form-input"
                 v-model="draft.username"
                 placeholder="ops-admin"
                 required>
        </div>

        <div class="form-group" v-if="isCreateMode">
          <label for="local-user-password">Initial Password</label>
          <input id="local-user-password"
                 class="form-input"
                 type="password"
                 v-model="draft.password"
                 placeholder="Minimum 10 characters"
                 required>
          <div class="text-muted" style="font-size:12px;margin-top:6px">
            Initial control-plane password for the new operator account.
          </div>
        </div>

        <div class="form-group">
          <label for="local-user-display-name">Display Name</label>
          <input id="local-user-display-name"
                 class="form-input"
                 v-model="draft.displayName"
                 placeholder="Platform Operations">
        </div>

        <div class="form-group">
          <label for="local-user-email">Email</label>
          <input id="local-user-email"
                 class="form-input"
                 type="email"
                 v-model="draft.email"
                 placeholder="ops@example.com">
        </div>

        <div class="form-group">
          <label for="local-user-role">Role Ceiling</label>
          <select id="local-user-role" class="form-input" v-model="draft.role">
            <option value="read-only">Read Only</option>
            <option value="operator">Operator</option>
            <option value="admin">Admin</option>
          </select>
        </div>

        <div class="form-group" style="grid-column:1 / -1">
          <label for="local-user-groups">Group Membership</label>
          <select id="local-user-groups"
                  class="form-input"
                  v-model="draft.groupIds"
                  multiple
                  size="6">
            <option v-for="group in groupOptions || []" :key="group.id" :value="String(group.id)">
              {{ group.name }} · {{ group.member_count || 0 }} {{ (group.member_count || 0) === 1 ? 'member' : 'members' }}
            </option>
          </select>
          <div class="text-muted" style="font-size:12px;margin-top:6px">
            Hold Ctrl or Command to select multiple groups for the control-plane operator.
          </div>
        </div>

        <div class="form-group" style="grid-column:1 / -1">
          <label class="form-toggle">
            <input type="checkbox" v-model="draft.active">
            <span>Account is active and allowed to sign in</span>
          </label>
          <div class="text-muted" style="font-size:12px;margin-top:6px">
            Disable the account to preserve audit history while preventing new control-plane sessions.
          </div>
        </div>
      </div>

      <div class="form-actions">
        <button class="form-btn" type="submit" :disabled="saving">
          <span class="mdi mdi-account-cog-outline"></span>
          {{ saving ? 'Saving...' : (submitLabel || 'Save User') }}
        </button>
      </div>
    </form>
  `,
  data() {
    return {
      draft: buildLocalUserDraft(this.initialValue, this.mode),
    };
  },
  computed: {
    isCreateMode() {
      return this.mode !== 'edit';
    },
  },
  watch: {
    initialValue: {
      deep: true,
      handler(value) {
        this.draft = buildLocalUserDraft(value, this.mode);
      },
    },
    mode(value) {
      this.draft = buildLocalUserDraft(this.initialValue, value);
    },
  },
  methods: {
    handleSubmit() {
      const payload = {
        username: String(this.draft.username || '').trim(),
        displayName: String(this.draft.displayName || '').trim(),
        email: String(this.draft.email || '').trim(),
        role: this.draft.role || 'operator',
        active: Boolean(this.draft.active),
        groupIds: (this.draft.groupIds || []).map((value) => Number(value || 0)).filter(Boolean),
      };

      if (this.isCreateMode) {
        payload.password = String(this.draft.password || '');
      }

      this.$emit('submit', payload);
    },
  },
};
