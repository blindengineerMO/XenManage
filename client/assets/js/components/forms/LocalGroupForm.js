function buildLocalGroupDraft(initialValue = {}) {
  return {
    name: initialValue.name || '',
    memberUserIds: Array.isArray(initialValue.memberUserIds)
      ? initialValue.memberUserIds.map((value) => String(value))
      : Array.isArray(initialValue.member_ids)
        ? initialValue.member_ids.map((value) => String(value))
        : [],
  };
}

const LocalGroupForm = {
  props: ['initialValue', 'saving', 'submitLabel', 'userOptions'],
  emits: ['submit'],
  template: `
    <form @submit.prevent="handleSubmit">
      <div class="vm-inline-form-grid">
        <div class="form-group" style="grid-column:1 / -1">
          <label for="local-group-name">Group Name</label>
          <input id="local-group-name"
                 class="form-input"
                 v-model="draft.name"
                 placeholder="Platform Operations"
                 required>
        </div>

        <div class="form-group" style="grid-column:1 / -1">
          <label for="local-group-members">Members</label>
          <select id="local-group-members"
                  class="form-input"
                  v-model="draft.memberUserIds"
                  multiple
                  size="8">
            <option v-for="user in userOptions || []" :key="user.id" :value="String(user.id)">
              {{ user.display_name || user.username }} · {{ user.username }} · {{ user.role }}
            </option>
          </select>
          <div class="text-muted" style="font-size:12px;margin-top:6px">
            Hold Ctrl or Command to select multiple local users for the group.
          </div>
        </div>
      </div>

      <div class="form-actions">
        <button class="form-btn" type="submit" :disabled="saving">
          <span class="mdi mdi-account-group-outline"></span>
          {{ saving ? 'Saving...' : (submitLabel || 'Save Group') }}
        </button>
      </div>
    </form>
  `,
  data() {
    return {
      draft: buildLocalGroupDraft(this.initialValue),
    };
  },
  watch: {
    initialValue: {
      deep: true,
      handler(value) {
        this.draft = buildLocalGroupDraft(value);
      },
    },
  },
  methods: {
    handleSubmit() {
      this.$emit('submit', {
        name: String(this.draft.name || '').trim(),
        memberUserIds: (this.draft.memberUserIds || []).map((value) => Number(value || 0)).filter(Boolean),
      });
    },
  },
};
