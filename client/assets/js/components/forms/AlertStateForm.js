function toLocalDateTimeValue(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return offsetDate.toISOString().slice(0, 16);
}

function buildAlertStateDraft(initialValue = {}) {
  return {
    acknowledged: Boolean(initialValue.acknowledged),
    severityOverride: initialValue.severityOverride || '',
    suppressionUntilLocal: toLocalDateTimeValue(initialValue.suppressionUntil),
    healthAction: initialValue.healthAction || 'none',
    notes: initialValue.notes || '',
  };
}

function futureLocalDateTime(hours) {
  const date = new Date(Date.now() + hours * 60 * 60 * 1000);
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return offsetDate.toISOString().slice(0, 16);
}

const AlertStateForm = {
  props: ['initialValue', 'saving', 'submitLabel'],
  emits: ['submit'],
  template: `
    <form @submit.prevent="handleSubmit">
      <label class="form-toggle">
        <input type="checkbox" v-model="draft.acknowledged">
        <span>Acknowledge this alert for the current operator queue</span>
      </label>

      <div class="vm-inline-form-grid">
        <div class="form-group">
          <label for="alert-severity-override">Severity Override</label>
          <select id="alert-severity-override" class="form-input" v-model="draft.severityOverride">
            <option value="">Use detected severity</option>
            <option value="critical">Critical</option>
            <option value="warning">Warning</option>
            <option value="info">Info</option>
            <option value="notice">Notice</option>
          </select>
        </div>

        <div class="form-group">
          <label for="alert-health-action">Health Action</label>
          <select id="alert-health-action" class="form-input" v-model="draft.healthAction">
            <option value="none">No Action</option>
            <option value="inspect">Inspect Related Object</option>
            <option value="monitor">Monitor Trend</option>
            <option value="review">Schedule Review</option>
            <option value="evacuate">Prepare Evacuation</option>
            <option value="snapshot">Create Protection Point</option>
            <option value="lifecycle">Open Lifecycle Review</option>
            <option value="capacity">Open Capacity Review</option>
            <option value="resilience">Open Resilience Review</option>
            <option value="governance">Open Governance Review</option>
          </select>
        </div>
      </div>

      <div class="form-group">
        <label for="alert-suppression-until">Suppress Until</label>
        <input id="alert-suppression-until" class="form-input" type="datetime-local" v-model="draft.suppressionUntilLocal">
      </div>

      <div class="form-actions" style="justify-content:flex-start;gap:8px">
        <button class="btn btn-sm" type="button" @click="draft.suppressionUntilLocal = futureLocalDateTime(4)">Suppress 4h</button>
        <button class="btn btn-sm" type="button" @click="draft.suppressionUntilLocal = futureLocalDateTime(24)">Suppress 24h</button>
        <button class="btn btn-sm" type="button" @click="draft.suppressionUntilLocal = ''">Clear Suppression</button>
      </div>

      <div class="form-group">
        <label for="alert-operator-notes">Operator Notes</label>
        <textarea id="alert-operator-notes"
                  class="form-input form-textarea"
                  rows="5"
                  v-model="draft.notes"
                  placeholder="Triage note, escalation path, maintenance context, or why the alert was suppressed."></textarea>
      </div>

      <div class="form-actions">
        <button class="form-btn" type="submit" :disabled="saving">
          <span class="mdi mdi-content-save-outline"></span>
          {{ saving ? 'Saving...' : (submitLabel || 'Save Alert State') }}
        </button>
      </div>
    </form>
  `,
  data() {
    return {
      draft: buildAlertStateDraft(this.initialValue),
    };
  },
  watch: {
    initialValue: {
      deep: true,
      handler(value) {
        this.draft = buildAlertStateDraft(value);
      },
    },
  },
  methods: {
    futureLocalDateTime,
    handleSubmit() {
      this.$emit('submit', {
        acknowledged: Boolean(this.draft.acknowledged),
        severityOverride: this.draft.severityOverride || '',
        suppressionUntil: this.draft.suppressionUntilLocal ? new Date(this.draft.suppressionUntilLocal).toISOString() : '',
        healthAction: this.draft.healthAction || 'none',
        notes: this.draft.notes.trim(),
      });
    },
  },
};
