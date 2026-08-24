function buildRemediationTaskDraft(initialValue = {}) {
  const source = initialValue && typeof initialValue === 'object' ? initialValue : {};
  const evidenceChecklist = Array.isArray(source.evidenceChecklist) ? source.evidenceChecklist : [];
  const completionCriteria = Array.isArray(source.completionCriteria) ? source.completionCriteria : [];
  const lifecyclePlanSeed = source.lifecyclePlanSeed && typeof source.lifecyclePlanSeed === 'object'
    ? source.lifecyclePlanSeed
    : null;
  const resilienceRunbookSeed = source.resilienceRunbookSeed && typeof source.resilienceRunbookSeed === 'object'
    ? source.resilienceRunbookSeed
    : null;
  return {
    nameLabel: source.nameLabel || '',
    nameDescription: source.nameDescription || '',
    actionType: source.actionType || 'review',
    assignee: source.assignee || '',
    dueDate: source.dueDate || '',
    alertRef: source.alertRef || '',
    alertUuid: source.alertUuid || '',
    alertSummary: source.alertSummary || '',
    targetRoute: source.targetRoute || '',
    relatedObject: source.relatedObject || '',
    relatedClass: source.relatedClass || '',
    workspaceSummary: source.workspaceSummary || '',
    evidenceChecklist,
    completionCriteria,
    templateId: source.templateId || '',
    templateName: source.templateName || '',
    templateLaunchMode: source.templateLaunchMode || 'draft',
    recurrenceMode: source.recurrenceMode || 'manual',
    recurrenceScope: source.recurrenceScope || 'object',
    cooldownDays: source.cooldownDays ?? 0,
    lifecyclePlanSeed,
    resilienceRunbookSeed,
  };
}

const RemediationTaskForm = {
  props: ['initialValue', 'saving', 'submitLabel'],
  emits: ['submit'],
  template: `
    <form @submit.prevent="handleSubmit">
      <div class="detail-section" style="margin-top:0" v-if="draft.alertSummary">
        <div class="detail-section-title">Source Alert</div>
        <div class="stack-item">
          <div>
            <strong>{{ draft.alertSummary }}</strong>
            <div class="text-muted mono" style="font-size:11px">{{ draft.alertRef || '-' }} · {{ draft.targetRoute || 'no target workspace' }}</div>
            <div class="text-muted mono" style="font-size:11px">{{ draft.relatedClass || 'record' }} · {{ draft.relatedObject || 'no related object supplied' }}</div>
          </div>
          <span class="badge badge-info">alert</span>
        </div>
      </div>

      <div class="detail-section" style="margin-top:0" v-if="draft.templateName">
        <div class="detail-section-title">Automation Template</div>
        <div class="stack-item">
          <div>
            <strong>{{ draft.templateName }}</strong>
            <div class="text-muted mono" style="font-size:11px">{{ draft.templateLaunchMode || 'draft' }} · {{ draft.recurrenceMode || 'manual' }} · {{ draft.recurrenceScope || 'object' }}</div>
          </div>
          <span class="badge badge-success">template</span>
        </div>
      </div>

      <div class="detail-section" style="margin-top:0" v-if="draft.workspaceSummary || draft.evidenceChecklist.length || draft.completionCriteria.length">
        <div class="detail-section-title">Workbench Staging</div>
        <div class="capacity-callout" v-if="draft.workspaceSummary">
          <strong>{{ draft.workspaceSummary }}</strong>
        </div>
        <div class="stack-list" v-if="draft.evidenceChecklist.length">
          <div class="stack-item" v-for="item in draft.evidenceChecklist" :key="'evidence-' + item">
            <div>
              <strong>{{ item }}</strong>
            </div>
            <span class="badge badge-info">evidence</span>
          </div>
        </div>
        <div class="stack-list" v-if="draft.completionCriteria.length" style="margin-top:8px">
          <div class="stack-item" v-for="item in draft.completionCriteria" :key="'completion-' + item">
            <div>
              <strong>{{ item }}</strong>
            </div>
            <span class="badge badge-success">completion</span>
          </div>
        </div>
      </div>

      <div class="detail-section" style="margin-top:0" v-if="draft.lifecyclePlanSeed || draft.resilienceRunbookSeed">
        <div class="detail-section-title">Downstream Draft Seeds</div>
        <div class="stack-list">
          <div class="stack-item" v-if="draft.lifecyclePlanSeed">
            <div>
              <strong>Lifecycle Plan</strong>
              <div class="text-muted mono" style="font-size:11px">{{ formatLifecycleSeed(draft.lifecyclePlanSeed) }}</div>
            </div>
            <span class="badge badge-info">lifecycle</span>
          </div>
          <div class="stack-item" v-if="draft.resilienceRunbookSeed">
            <div>
              <strong>Recovery Runbook</strong>
              <div class="text-muted mono" style="font-size:11px">{{ formatRunbookSeed(draft.resilienceRunbookSeed) }}</div>
            </div>
            <span class="badge badge-success">resilience</span>
          </div>
        </div>
      </div>

      <div class="form-group">
        <label for="remediation-task-name">Task Name</label>
        <input id="remediation-task-name" class="form-input" v-model="draft.nameLabel" placeholder="Capacity review for Storage nearing threshold" required>
      </div>

      <div class="form-group">
        <label for="remediation-task-action">Action Type</label>
        <select id="remediation-task-action" class="form-input" v-model="draft.actionType">
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

      <div class="vm-inline-form-grid">
        <div class="form-group">
          <label for="remediation-task-assignee">Assignee</label>
          <input id="remediation-task-assignee" class="form-input" v-model="draft.assignee" placeholder="root">
        </div>

        <div class="form-group">
          <label for="remediation-task-due-date">Due Date</label>
          <input id="remediation-task-due-date" class="form-input" type="date" v-model="draft.dueDate">
        </div>
      </div>

      <div class="form-group">
        <label for="remediation-task-notes">Task Notes</label>
        <textarea id="remediation-task-notes"
                  class="form-input form-textarea"
                  rows="5"
                  v-model="draft.nameDescription"
                  placeholder="Document the remediation goal, operator guidance, and any dependencies to check before closing this task."></textarea>
      </div>

      <div class="form-actions">
        <button class="form-btn" type="submit" :disabled="saving">
          <span class="mdi mdi-clipboard-check-outline"></span>
          {{ saving ? 'Creating...' : (submitLabel || 'Create Remediation Task') }}
        </button>
      </div>
    </form>
  `,
  data() {
    return {
      draft: buildRemediationTaskDraft(this.initialValue),
    };
  },
  watch: {
    initialValue: {
      deep: true,
      handler(value) {
        this.draft = buildRemediationTaskDraft(value);
      },
    },
  },
  methods: {
    handleSubmit() {
      this.$emit('submit', {
        nameLabel: this.draft.nameLabel.trim(),
        nameDescription: this.draft.nameDescription.trim(),
        actionType: this.draft.actionType || 'review',
        assignee: this.draft.assignee.trim(),
        dueDate: this.draft.dueDate || '',
        alertRef: this.draft.alertRef,
        alertUuid: this.draft.alertUuid,
        alertSummary: this.draft.alertSummary,
        targetRoute: this.draft.targetRoute || '',
        relatedObject: this.draft.relatedObject.trim(),
        relatedClass: this.draft.relatedClass || '',
        workspaceSummary: this.draft.workspaceSummary.trim(),
        evidenceChecklist: [...this.draft.evidenceChecklist],
        completionCriteria: [...this.draft.completionCriteria],
        templateId: this.draft.templateId || '',
        templateName: this.draft.templateName || '',
        templateLaunchMode: this.draft.templateLaunchMode || 'draft',
        recurrenceMode: this.draft.recurrenceMode || 'manual',
        recurrenceScope: this.draft.recurrenceScope || 'object',
        cooldownDays: Number(this.draft.cooldownDays || 0),
        lifecyclePlanSeed: this.draft.lifecyclePlanSeed ? { ...this.draft.lifecyclePlanSeed } : null,
        resilienceRunbookSeed: this.draft.resilienceRunbookSeed ? { ...this.draft.resilienceRunbookSeed } : null,
      });
    },
    formatLifecycleSeed(seed) {
      if (!seed) return '';
      return [
        seed.targetStage || 'review',
        seed.baselineStatus || 'unknown',
        seed.owner || 'unassigned',
        seed.dueDate || (seed.dueDays ? `${seed.dueDays}d` : 'no due date'),
      ].join(' · ');
    },
    formatRunbookSeed(seed) {
      if (!seed) return '';
      const stepCount = Array.isArray(seed.runbookSteps) ? seed.runbookSteps.length : 0;
      return [
        seed.recoveryTier || 'standard',
        seed.haPolicy || 'manual',
        `${seed.rpoMinutes || 60}m RPO`,
        `${stepCount} step${stepCount === 1 ? '' : 's'}`,
      ].join(' · ');
    },
  },
};
