function buildAlertPolicyDraft(initialValue = {}) {
  const source = initialValue && typeof initialValue === 'object' ? initialValue : {};
  return {
    enabled: source.enabled !== false,
    name: source.name || '',
    matchClass: source.matchClass || '',
    matchTargetRoute: source.matchTargetRoute || '',
    matchObject: source.matchObject || '',
    matchSeverity: source.matchSeverity || '',
    matchText: source.matchText || '',
    textMatchMode: source.textMatchMode || 'phrase',
    autoAcknowledge: Boolean(source.autoAcknowledge),
    suppressionHours: Number(source.suppressionHours || 0),
    severityOverride: source.severityOverride || '',
    healthAction: source.healthAction || 'none',
    notes: source.notes || '',
  };
}

const AlertPolicyForm = {
  props: ['initialValue', 'saving', 'submitLabel'],
  emits: ['submit'],
  template: `
    <form @submit.prevent="handleSubmit">
      <label class="form-toggle">
        <input type="checkbox" v-model="draft.enabled">
        <span>Enable this policy for incoming matching alerts</span>
      </label>

      <div class="form-group">
        <label for="alert-policy-name">Policy Name</label>
        <input id="alert-policy-name" class="form-input" v-model="draft.name" placeholder="Storage warning quiet window">
      </div>

      <div class="vm-inline-form-grid">
        <div class="form-group">
          <label for="alert-policy-class">Match Class</label>
          <select id="alert-policy-class" class="form-input" v-model="draft.matchClass">
            <option value="">Any Class</option>
            <option value="host">Host</option>
            <option value="sr">Storage Repository</option>
            <option value="vdi">VDI</option>
            <option value="vbd">VBD</option>
            <option value="vm">VM</option>
            <option value="pool">Pool</option>
            <option value="network">Network</option>
            <option value="vif">VIF</option>
            <option value="pif">PIF</option>
            <option value="task">Task</option>
          </select>
        </div>

        <div class="form-group">
          <label for="alert-policy-target-route">Target Workspace</label>
          <select id="alert-policy-target-route" class="form-input" v-model="draft.matchTargetRoute">
            <option value="">Any Workspace</option>
            <option value="/hosts">Hosts</option>
            <option value="/storage">Storage</option>
            <option value="/vms">Virtual Machines</option>
            <option value="/pools">Pools</option>
            <option value="/networking">Networking</option>
            <option value="/activity">Activity</option>
            <option value="/inventory">Inventory</option>
          </select>
        </div>

        <div class="form-group">
          <label for="alert-policy-severity">Match Severity</label>
          <select id="alert-policy-severity" class="form-input" v-model="draft.matchSeverity">
            <option value="">Any Severity</option>
            <option value="critical">Critical</option>
            <option value="warning">Warning</option>
            <option value="info">Info</option>
            <option value="notice">Notice</option>
          </select>
        </div>
      </div>

      <div class="form-group">
        <label for="alert-policy-match-object">Match Object / UUID</label>
        <input id="alert-policy-match-object" class="form-input" v-model="draft.matchObject" placeholder="sr-uuid-1, vm-uuid-1, alpha-xen">
      </div>

      <div class="vm-inline-form-grid">
        <div class="form-group">
        <label for="alert-policy-match-text">Match Text</label>
        <input id="alert-policy-match-text" class="form-input" v-model="draft.matchText" placeholder="storage, maintenance, replication, alpha-xen">
        </div>

        <div class="form-group">
          <label for="alert-policy-text-mode">Text Match Mode</label>
          <select id="alert-policy-text-mode" class="form-input" v-model="draft.textMatchMode">
            <option value="phrase">Contains Phrase</option>
            <option value="all">All Terms</option>
          </select>
        </div>
      </div>

      <div class="vm-inline-form-grid">
        <div class="form-group">
          <label for="alert-policy-suppress-hours">Suppress For (hours)</label>
          <input id="alert-policy-suppress-hours" class="form-input" type="number" min="0" max="720" v-model.number="draft.suppressionHours">
        </div>

        <div class="form-group">
          <label for="alert-policy-override-severity">Severity Override</label>
          <select id="alert-policy-override-severity" class="form-input" v-model="draft.severityOverride">
            <option value="">Use detected severity</option>
            <option value="critical">Critical</option>
            <option value="warning">Warning</option>
            <option value="info">Info</option>
            <option value="notice">Notice</option>
          </select>
        </div>
      </div>

      <div class="vm-inline-form-grid">
        <div class="form-group">
          <label for="alert-policy-action">Workflow Action</label>
          <select id="alert-policy-action" class="form-input" v-model="draft.healthAction">
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

        <div class="form-group" style="display:flex;align-items:flex-end">
          <label class="form-toggle" style="margin-bottom:0">
            <input type="checkbox" v-model="draft.autoAcknowledge">
            <span>Auto-acknowledge when matched</span>
          </label>
        </div>
      </div>

      <div class="form-group">
        <label for="alert-policy-notes">Policy Notes</label>
        <textarea id="alert-policy-notes"
                  class="form-input form-textarea"
                  rows="4"
                  v-model="draft.notes"
                  placeholder="Explain when this policy should suppress noise or route operators into a specific workflow."></textarea>
      </div>

      <div class="form-actions">
        <button class="form-btn" type="submit" :disabled="saving">
          <span class="mdi mdi-content-save-outline"></span>
          {{ saving ? 'Saving...' : (submitLabel || 'Save Alert Policy') }}
        </button>
      </div>
    </form>
  `,
  data() {
    return {
      draft: buildAlertPolicyDraft(this.initialValue),
    };
  },
  watch: {
    initialValue: {
      deep: true,
      handler(value) {
        this.draft = buildAlertPolicyDraft(value);
      },
    },
  },
  methods: {
    handleSubmit() {
      this.$emit('submit', {
        enabled: Boolean(this.draft.enabled),
        name: this.draft.name.trim(),
        matchClass: this.draft.matchClass || '',
        matchTargetRoute: this.draft.matchTargetRoute || '',
        matchObject: this.draft.matchObject.trim(),
        matchSeverity: this.draft.matchSeverity || '',
        matchText: this.draft.matchText.trim(),
        textMatchMode: this.draft.textMatchMode || 'phrase',
        autoAcknowledge: Boolean(this.draft.autoAcknowledge),
        suppressionHours: Number(this.draft.suppressionHours || 0),
        severityOverride: this.draft.severityOverride || '',
        healthAction: this.draft.healthAction || 'none',
        notes: this.draft.notes.trim(),
      });
    },
  },
};
