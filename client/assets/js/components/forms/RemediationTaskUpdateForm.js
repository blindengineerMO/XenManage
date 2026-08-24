function buildRemediationTaskUpdateDraft(initialValue = {}) {
  const source = initialValue && typeof initialValue === 'object' ? initialValue : {};
  return {
    status: source.status || 'pending',
    assignee: source.assignee || '',
    dueDate: source.due_date || source.dueDate || '',
    result: source.result || '',
    nameDescription: source.name_description || source.nameDescription || '',
  };
}

const RemediationTaskUpdateForm = {
  props: ['initialValue', 'saving', 'submitLabel'],
  emits: ['submit'],
  template: `
    <form @submit.prevent="handleSubmit">
      <div class="vm-inline-form-grid">
        <div class="form-group">
          <label for="remediation-update-status">Status</label>
          <select id="remediation-update-status" class="form-input" v-model="draft.status">
            <option value="pending">Pending</option>
            <option value="queued">Queued</option>
            <option value="in_progress">In Progress</option>
            <option value="success">Completed Successfully</option>
            <option value="warning">Completed With Warning</option>
            <option value="failure">Failed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        <div class="form-group">
          <label for="remediation-update-assignee">Assignee</label>
          <input id="remediation-update-assignee" class="form-input" v-model="draft.assignee" placeholder="Platform Ops">
        </div>
      </div>

      <div class="form-group">
        <label for="remediation-update-due-date">Due Date</label>
        <input id="remediation-update-due-date" class="form-input" type="date" v-model="draft.dueDate">
      </div>

      <div class="form-group">
        <label for="remediation-update-result">Result / Closure Note</label>
        <textarea id="remediation-update-result"
                  class="form-input form-textarea"
                  rows="4"
                  v-model="draft.result"
                  placeholder="Capture operator outcome, blockers, or closure notes."></textarea>
      </div>

      <div class="form-group">
        <label for="remediation-update-notes">Task Notes</label>
        <textarea id="remediation-update-notes"
                  class="form-input form-textarea"
                  rows="5"
                  v-model="draft.nameDescription"
                  placeholder="Keep the task instructions or remediation guidance current as the work evolves."></textarea>
      </div>

      <div class="form-actions">
        <button class="form-btn" type="submit" :disabled="saving">
          <span class="mdi mdi-content-save-outline"></span>
          {{ saving ? 'Saving...' : (submitLabel || 'Save Task Update') }}
        </button>
      </div>
    </form>
  `,
  data() {
    return {
      draft: buildRemediationTaskUpdateDraft(this.initialValue),
    };
  },
  watch: {
    initialValue: {
      deep: true,
      handler(value) {
        this.draft = buildRemediationTaskUpdateDraft(value);
      },
    },
  },
  methods: {
    handleSubmit() {
      this.$emit('submit', {
        status: this.draft.status || 'pending',
        assignee: this.draft.assignee.trim(),
        dueDate: this.draft.dueDate || '',
        result: this.draft.result.trim(),
        nameDescription: this.draft.nameDescription.trim(),
      });
    },
  },
};
