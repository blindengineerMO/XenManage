function buildResilienceDrillDraft(initialValue = {}) {
  const source = initialValue || {};
  return {
    drillType: source.drillType || 'restore',
    status: source.status || 'success',
    scope: source.scope || '',
    executedAt: source.executedAt ? String(source.executedAt).slice(0, 16) : '',
    durationMinutes: Number(source.durationMinutes || 30),
    summary: source.summary || '',
    findings: source.findings || '',
    nextStep: source.nextStep || '',
  };
}

const ResilienceDrillForm = {
  props: ['initialValue', 'poolRecord', 'saving', 'submitLabel'],
  emits: ['submit'],
  template: `
    <form @submit.prevent="handleSubmit">
      <div class="vm-inline-form-grid">
        <div class="form-group">
          <label for="resilience-drill-type">Drill Type</label>
          <select id="resilience-drill-type" class="form-input" v-model="draft.drillType">
            <option value="restore">Restore</option>
            <option value="failover">Failover</option>
            <option value="evacuation">Evacuation</option>
            <option value="backup-verify">Backup Verify</option>
          </select>
        </div>

        <div class="form-group">
          <label for="resilience-drill-status">Outcome</label>
          <select id="resilience-drill-status" class="form-input" v-model="draft.status">
            <option value="success">Success</option>
            <option value="warning">Warning</option>
            <option value="critical">Critical</option>
            <option value="pending">Pending</option>
          </select>
        </div>
      </div>

      <div class="vm-inline-form-grid">
        <div class="form-group">
          <label for="resilience-drill-pool">Pool</label>
          <input id="resilience-drill-pool" class="form-input" :value="poolLabel" disabled>
        </div>

        <div class="form-group">
          <label for="resilience-drill-executed-at">Executed At</label>
          <input id="resilience-drill-executed-at" class="form-input" v-model="draft.executedAt" type="datetime-local">
        </div>
      </div>

      <div class="vm-inline-form-grid">
        <div class="form-group">
          <label for="resilience-drill-scope">Scope</label>
          <input id="resilience-drill-scope" class="form-input" v-model="draft.scope" placeholder="Pool-wide restore validation">
        </div>

        <div class="form-group">
          <label for="resilience-drill-duration">Duration (minutes)</label>
          <input id="resilience-drill-duration" class="form-input" v-model.number="draft.durationMinutes" type="number" min="0" max="10080">
        </div>
      </div>

      <div class="form-group">
        <label for="resilience-drill-summary">Summary</label>
        <input id="resilience-drill-summary" class="form-input" v-model="draft.summary" placeholder="Validated app recovery on standby capacity">
      </div>

      <div class="form-group">
        <label for="resilience-drill-findings">Findings</label>
        <textarea id="resilience-drill-findings"
                  class="form-input form-textarea"
                  v-model="draft.findings"
                  rows="5"
                  placeholder="Capture timing, dependency issues, or manual remediation that surfaced during the drill."></textarea>
      </div>

      <div class="form-group">
        <label for="resilience-drill-next-step">Next Step</label>
        <textarea id="resilience-drill-next-step"
                  class="form-input form-textarea"
                  v-model="draft.nextStep"
                  rows="3"
                  placeholder="Schedule another drill, update the runbook, or patch a dependency before the next window."></textarea>
      </div>

      <div class="form-actions">
        <button class="form-btn" type="submit" :disabled="saving">
          <span class="mdi mdi-clipboard-check-outline"></span>
          {{ saving ? 'Logging...' : (submitLabel || 'Log Drill') }}
        </button>
      </div>
    </form>
  `,
  data() {
    return {
      draft: buildResilienceDrillDraft(this.initialValue),
    };
  },
  computed: {
    poolLabel() {
      return this.poolRecord?.name_label || this.poolRecord?.ref || '';
    },
  },
  methods: {
    handleSubmit() {
      this.$emit('submit', {
        drillType: this.draft.drillType,
        status: this.draft.status,
        scope: this.draft.scope.trim(),
        executedAt: this.draft.executedAt ? new Date(this.draft.executedAt).toISOString() : new Date().toISOString(),
        durationMinutes: Number(this.draft.durationMinutes || 0),
        summary: this.draft.summary.trim(),
        findings: this.draft.findings.trim(),
        nextStep: this.draft.nextStep.trim(),
      });
    },
  },
};
