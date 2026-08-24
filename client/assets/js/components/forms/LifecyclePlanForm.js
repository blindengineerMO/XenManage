function buildLifecyclePlanDraft(initialValue = {}, hostRecord = {}) {
  const source = initialValue || {};
  return {
    baselineStatus: source.baselineStatus || 'unknown',
    targetStage: source.targetStage || 'review',
    maintenanceWindow: source.maintenanceWindow || hostRecord?.other_config?.maintenance_window || '',
    patchGroup: source.patchGroup || '',
    owner: source.owner || '',
    nextAction: source.nextAction || 'scan',
    rebootRequired: Boolean(source.rebootRequired),
    evacuationRequired: Boolean(source.evacuationRequired),
    dueDate: source.dueDate || '',
    notes: source.notes || '',
  };
}

const LifecyclePlanForm = {
  props: ['hostRecord', 'initialValue', 'submitLabel', 'saving'],
  emits: ['submit'],
  template: `
    <form @submit.prevent="handleSubmit">
      <div class="vm-inline-form-grid">
        <div class="form-group">
          <label for="lifecycle-baseline-status">Baseline Status</label>
          <select id="lifecycle-baseline-status" class="form-input" v-model="draft.baselineStatus">
            <option value="compliant">Compliant</option>
            <option value="drifted">Drifted</option>
            <option value="unknown">Unknown</option>
          </select>
        </div>

        <div class="form-group">
          <label for="lifecycle-target-stage">Target Stage</label>
          <select id="lifecycle-target-stage" class="form-input" v-model="draft.targetStage">
            <option value="aligned">Aligned</option>
            <option value="review">Review</option>
            <option value="maintenance">Maintenance</option>
            <option value="remediate">Remediate</option>
          </select>
        </div>
      </div>

      <div class="vm-inline-form-grid">
        <div class="form-group">
          <label for="lifecycle-next-action">Next Action</label>
          <select id="lifecycle-next-action" class="form-input" v-model="draft.nextAction">
            <option value="scan">Run Scan</option>
            <option value="patch">Apply Patch</option>
            <option value="reboot">Schedule Reboot</option>
            <option value="validate">Validate Outcome</option>
            <option value="none">No Action</option>
          </select>
        </div>

        <div class="form-group">
          <label for="lifecycle-due-date">Due Date</label>
          <input id="lifecycle-due-date" class="form-input" v-model="draft.dueDate" type="date">
        </div>
      </div>

      <div class="vm-inline-form-grid">
        <div class="form-group">
          <label for="lifecycle-maintenance-window">Maintenance Window</label>
          <input id="lifecycle-maintenance-window" class="form-input" v-model="draft.maintenanceWindow" placeholder="Sun 02:00">
        </div>

        <div class="form-group">
          <label for="lifecycle-patch-group">Patch Group</label>
          <input id="lifecycle-patch-group" class="form-input" v-model="draft.patchGroup" placeholder="Production Ring A">
        </div>
      </div>

      <div class="vm-inline-form-grid">
        <div class="form-group">
          <label for="lifecycle-owner">Owner</label>
          <input id="lifecycle-owner" class="form-input" v-model="draft.owner" placeholder="Platform Ops">
        </div>

        <div class="form-group">
          <label for="lifecycle-host-name">Host</label>
          <input id="lifecycle-host-name" class="form-input" :value="hostLabel" disabled>
        </div>
      </div>

      <label class="form-toggle">
        <input type="checkbox" v-model="draft.rebootRequired">
        <span>Reboot required after remediation</span>
      </label>

      <label class="form-toggle">
        <input type="checkbox" v-model="draft.evacuationRequired">
        <span>Evacuate workloads before work begins</span>
      </label>

      <div class="form-group">
        <label for="lifecycle-plan-notes">Plan Notes</label>
        <textarea id="lifecycle-plan-notes"
                  class="form-input form-textarea"
                  v-model="draft.notes"
                  rows="5"
                  placeholder="Patch target, firmware note, maintenance prerequisites, or rollback guidance."></textarea>
      </div>

      <div class="form-actions">
        <button class="form-btn" type="submit" :disabled="saving">
          <span class="mdi mdi-content-save-outline"></span>
          {{ saving ? 'Saving...' : (submitLabel || 'Save Lifecycle Plan') }}
        </button>
      </div>
    </form>
  `,
  data() {
    return {
      draft: buildLifecyclePlanDraft(this.initialValue, this.hostRecord),
    };
  },
  computed: {
    hostLabel() {
      return this.hostRecord?.name_label || this.hostRecord?.hostname || this.hostRecord?.ref || '';
    },
  },
  watch: {
    initialValue: {
      deep: true,
      handler(value) {
        this.draft = buildLifecyclePlanDraft(value, this.hostRecord);
      },
    },
    hostRecord(value, previousValue) {
      if ((value?.ref || '') !== (previousValue?.ref || '')) {
        this.draft = buildLifecyclePlanDraft(this.initialValue, value);
      }
    },
  },
  methods: {
    handleSubmit() {
      this.$emit('submit', {
        baselineStatus: this.draft.baselineStatus,
        targetStage: this.draft.targetStage,
        maintenanceWindow: this.draft.maintenanceWindow.trim(),
        patchGroup: this.draft.patchGroup.trim(),
        owner: this.draft.owner.trim(),
        nextAction: this.draft.nextAction,
        rebootRequired: Boolean(this.draft.rebootRequired),
        evacuationRequired: Boolean(this.draft.evacuationRequired),
        dueDate: this.draft.dueDate || '',
        notes: this.draft.notes.trim(),
      });
    },
  },
};
