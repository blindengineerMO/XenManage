function buildRemediationTemplateDraft(initialValue = {}) {
  const source = initialValue && typeof initialValue === 'object' ? initialValue : {};
  const evidenceChecklist = Array.isArray(source.evidenceChecklist) ? source.evidenceChecklist : [];
  const completionCriteria = Array.isArray(source.completionCriteria) ? source.completionCriteria : [];
  const lifecycleSeed = source.lifecyclePlanSeed && typeof source.lifecyclePlanSeed === 'object'
    ? source.lifecyclePlanSeed
    : null;
  const resilienceSeed = source.resilienceRunbookSeed && typeof source.resilienceRunbookSeed === 'object'
    ? source.resilienceRunbookSeed
    : null;
  return {
    enabled: source.enabled !== false,
    name: source.name || '',
    matchClass: source.matchClass || '',
    matchTargetRoute: source.matchTargetRoute || '',
    matchObject: source.matchObject || '',
    matchSeverity: source.matchSeverity || '',
    matchText: source.matchText || '',
    textMatchMode: source.textMatchMode || 'phrase',
    actionType: source.actionType || 'review',
    taskNameTemplate: source.taskNameTemplate || 'Review: {summary}',
    defaultAssignee: source.defaultAssignee || '',
    defaultDueDays: source.defaultDueDays ?? 0,
    defaultTargetRoute: source.defaultTargetRoute || '',
    defaultNotes: source.defaultNotes || '',
    workspaceSummaryTemplate: source.workspaceSummaryTemplate || '',
    evidenceChecklistText: evidenceChecklist.join('\n'),
    completionCriteriaText: completionCriteria.join('\n'),
    launchMode: source.launchMode || 'draft',
    recurrenceMode: source.recurrenceMode || 'manual',
    recurrenceScope: source.recurrenceScope || 'object',
    cooldownDays: source.cooldownDays ?? 0,
    lifecycleSeedEnabled: Boolean(lifecycleSeed?.enabled),
    lifecycleBaselineStatus: lifecycleSeed?.baselineStatus || 'unknown',
    lifecycleTargetStage: lifecycleSeed?.targetStage || 'review',
    lifecycleMaintenanceWindow: lifecycleSeed?.maintenanceWindow || '',
    lifecyclePatchGroup: lifecycleSeed?.patchGroup || '',
    lifecycleOwner: lifecycleSeed?.owner || '',
    lifecycleNextAction: lifecycleSeed?.nextAction || 'scan',
    lifecycleRebootRequired: Boolean(lifecycleSeed?.rebootRequired),
    lifecycleEvacuationRequired: Boolean(lifecycleSeed?.evacuationRequired),
    lifecycleDueDays: lifecycleSeed?.dueDays ?? 0,
    lifecycleNotes: lifecycleSeed?.notes || '',
    resilienceSeedEnabled: Boolean(resilienceSeed?.enabled),
    resilienceRecoveryTier: resilienceSeed?.recoveryTier || 'standard',
    resilienceHaPolicy: resilienceSeed?.haPolicy || 'manual',
    resilienceRestartPriority: resilienceSeed?.restartPriority || 'medium',
    resilienceBackupWindowHours: resilienceSeed?.backupWindowHours ?? 24,
    resilienceRpoMinutes: resilienceSeed?.rpoMinutes ?? 60,
    resilienceRtoMinutes: resilienceSeed?.rtoMinutes ?? 120,
    resilienceRestorePointStatus: resilienceSeed?.restorePointStatus || 'review',
    resilienceOwner: resilienceSeed?.owner || '',
    resilienceStandbyHostRef: resilienceSeed?.standbyHostRef || '',
    resilienceFailoverNetworkRef: resilienceSeed?.failoverNetworkRef || '',
    resilienceRunbookStepsText: Array.isArray(resilienceSeed?.runbookSteps) ? resilienceSeed.runbookSteps.join('\n') : '',
    resilienceNotes: resilienceSeed?.notes || '',
  };
}

const RemediationTaskTemplateForm = {
  props: ['initialValue', 'saving', 'submitLabel'],
  emits: ['submit'],
  template: `
    <form @submit.prevent="handleSubmit">
      <div class="form-group">
        <label class="checkbox-row">
          <input type="checkbox" v-model="draft.enabled">
          <span>Template Enabled</span>
        </label>
      </div>

      <div class="form-group">
        <label for="remediation-template-name">Template Name</label>
        <input id="remediation-template-name" class="form-input" v-model="draft.name" placeholder="Storage Capacity Review" required>
      </div>

      <div class="vm-inline-form-grid">
        <div class="form-group">
          <label for="remediation-template-class">Match Class</label>
          <select id="remediation-template-class" class="form-input" v-model="draft.matchClass">
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
            <option value="bond">Bond</option>
            <option value="vlan">VLAN</option>
            <option value="task">Task</option>
            <option value="alert">Alert</option>
          </select>
        </div>

        <div class="form-group">
          <label for="remediation-template-route">Match Workspace</label>
          <select id="remediation-template-route" class="form-input" v-model="draft.matchTargetRoute">
            <option value="">Any Workspace</option>
            <option value="/hosts">Hosts</option>
            <option value="/storage">Storage</option>
            <option value="/vms">Virtual Machines</option>
            <option value="/pools">Pools</option>
            <option value="/networking">Networking</option>
            <option value="/activity">Activity</option>
            <option value="/inventory">Inventory</option>
            <option value="/capacity">Capacity</option>
            <option value="/resilience">Resilience</option>
            <option value="/lifecycle">Lifecycle</option>
            <option value="/governance">Governance</option>
          </select>
        </div>
      </div>

      <div class="vm-inline-form-grid">
        <div class="form-group">
          <label for="remediation-template-severity">Match Severity</label>
          <select id="remediation-template-severity" class="form-input" v-model="draft.matchSeverity">
            <option value="">Any Severity</option>
            <option value="critical">Critical</option>
            <option value="warning">Warning</option>
            <option value="info">Info</option>
            <option value="notice">Notice</option>
          </select>
        </div>

        <div class="form-group">
          <label for="remediation-template-action">Workflow Action</label>
          <select id="remediation-template-action" class="form-input" v-model="draft.actionType">
            <option value="inspect">Inspect Related Object</option>
            <option value="monitor">Monitor Trend</option>
            <option value="review">Schedule Review</option>
            <option value="evacuate">Prepare Evacuation</option>
            <option value="snapshot">Create Protection Point</option>
            <option value="lifecycle">Lifecycle Review</option>
            <option value="capacity">Capacity Review</option>
            <option value="resilience">Resilience Review</option>
            <option value="governance">Governance Review</option>
          </select>
        </div>
      </div>

      <div class="form-group">
        <label for="remediation-template-object">Match Object / UUID</label>
        <input id="remediation-template-object" class="form-input" v-model="draft.matchObject" placeholder="sr-demo-uuid-1">
      </div>

      <div class="vm-inline-form-grid">
        <div class="form-group">
          <label for="remediation-template-text">Match Text</label>
          <input id="remediation-template-text" class="form-input" v-model="draft.matchText" placeholder="storage threshold">
        </div>

        <div class="form-group">
          <label for="remediation-template-text-mode">Text Match Mode</label>
          <select id="remediation-template-text-mode" class="form-input" v-model="draft.textMatchMode">
            <option value="phrase">Contains Phrase</option>
            <option value="all">All Terms</option>
          </select>
        </div>
      </div>

      <div class="detail-section" style="margin-top:8px">
        <div class="detail-section-title">Default Task Draft</div>
      </div>

      <div class="vm-inline-form-grid">
        <div class="form-group">
          <label for="remediation-template-launch-mode">Launch Behavior</label>
          <select id="remediation-template-launch-mode" class="form-input" v-model="draft.launchMode">
            <option value="draft">Open Draft First</option>
            <option value="queue">Queue Immediately</option>
            <option value="lifecycle-plan">Launch Lifecycle Draft</option>
            <option value="lifecycle-maintenance">Launch Maintenance Handoff</option>
            <option value="resilience-runbook">Launch Recovery Runbook Draft</option>
            <option value="resilience-drill">Launch Recovery Drill Handoff</option>
            <option value="vm-migration">Launch VM Migration Handoff</option>
          </select>
        </div>

        <div class="form-group">
          <label for="remediation-template-recurrence">Recurrence Guard</label>
          <select id="remediation-template-recurrence" class="form-input" v-model="draft.recurrenceMode">
            <option value="manual">No Guard</option>
            <option value="once">Once Per Scope</option>
            <option value="daily">At Most Daily</option>
            <option value="weekly">At Most Weekly</option>
            <option value="cooldown">Custom Cooldown</option>
          </select>
        </div>
      </div>

      <div class="vm-inline-form-grid">
        <div class="form-group">
          <label for="remediation-template-scope">Recurrence Scope</label>
          <select id="remediation-template-scope" class="form-input" v-model="draft.recurrenceScope">
            <option value="object">Related Object</option>
            <option value="alert">Alert Record</option>
            <option value="class">Class + Workspace + Summary</option>
          </select>
        </div>

        <div class="form-group" v-if="draft.recurrenceMode === 'cooldown'">
          <label for="remediation-template-cooldown">Cooldown Days</label>
          <input id="remediation-template-cooldown" class="form-input" type="number" min="1" max="365" v-model.number="draft.cooldownDays">
        </div>
      </div>

      <div class="form-group">
        <label for="remediation-template-name-pattern">Task Name Template</label>
        <input id="remediation-template-name-pattern"
               class="form-input"
               v-model="draft.taskNameTemplate"
               placeholder="Capacity Review: {summary}"
               required>
        <div class="text-muted mono" style="font-size:11px;margin-top:6px">Use placeholders like {summary}, {class}, {object}, {severity}, or {workspace}.</div>
      </div>

      <div class="vm-inline-form-grid">
        <div class="form-group">
          <label for="remediation-template-assignee">Default Assignee</label>
          <input id="remediation-template-assignee" class="form-input" v-model="draft.defaultAssignee" placeholder="Platform Ops">
        </div>

        <div class="form-group">
          <label for="remediation-template-due-days">Default Due In (days)</label>
          <input id="remediation-template-due-days" class="form-input" type="number" min="0" max="365" v-model.number="draft.defaultDueDays">
        </div>
      </div>

      <div class="form-group">
        <label for="remediation-template-target-route">Default Target Workspace</label>
        <select id="remediation-template-target-route" class="form-input" v-model="draft.defaultTargetRoute">
          <option value="">Use Alert Workflow</option>
          <option value="/hosts">Hosts</option>
          <option value="/storage">Storage</option>
          <option value="/vms">Virtual Machines</option>
          <option value="/pools">Pools</option>
          <option value="/networking">Networking</option>
          <option value="/activity">Activity</option>
          <option value="/inventory">Inventory</option>
          <option value="/capacity">Capacity</option>
          <option value="/resilience">Resilience</option>
          <option value="/lifecycle">Lifecycle</option>
          <option value="/governance">Governance</option>
        </select>
      </div>

      <div class="form-group">
        <label for="remediation-template-notes">Default Task Notes</label>
        <textarea id="remediation-template-notes"
                  class="form-input form-textarea"
                  rows="5"
                  v-model="draft.defaultNotes"
                  placeholder="Document the default operator guidance, validation checks, and expected closure criteria for this alert pattern."></textarea>
      </div>

      <div class="detail-section" style="margin-top:8px">
        <div class="detail-section-title">Workbench Staging</div>
      </div>

      <div class="form-group">
        <label for="remediation-template-workspace-summary">Workspace Brief Template</label>
        <input id="remediation-template-workspace-summary"
               class="form-input"
               v-model="draft.workspaceSummaryTemplate"
               placeholder="Validate storage contention, confirm owner, and capture mitigation evidence for {summary}.">
        <div class="text-muted mono" style="font-size:11px;margin-top:6px">This appears in downstream workbench queues and can use the same placeholders as the task name.</div>
      </div>

      <div class="form-group">
        <label for="remediation-template-evidence">Evidence Checklist</label>
        <textarea id="remediation-template-evidence"
                  class="form-input form-textarea"
                  rows="4"
                  v-model="draft.evidenceChecklistText"
                  placeholder="One item per line: confirm active workloads, capture latency evidence, review affected hosts."></textarea>
      </div>

      <div class="form-group">
        <label for="remediation-template-completion">Completion Criteria</label>
        <textarea id="remediation-template-completion"
                  class="form-input form-textarea"
                  rows="4"
                  v-model="draft.completionCriteriaText"
                  placeholder="One item per line: mitigation owner assigned, follow-up logged, closure note captured."></textarea>
      </div>

      <div class="detail-section" style="margin-top:8px">
        <div class="detail-section-title">Lifecycle Draft Seed</div>
      </div>

      <label class="form-toggle">
        <input type="checkbox" v-model="draft.lifecycleSeedEnabled">
        <span>Seed a lifecycle plan when this template is queued</span>
      </label>

      <template v-if="draft.lifecycleSeedEnabled">
        <div class="vm-inline-form-grid">
          <div class="form-group">
            <label for="remediation-template-lifecycle-baseline">Baseline Status</label>
            <select id="remediation-template-lifecycle-baseline" class="form-input" v-model="draft.lifecycleBaselineStatus">
              <option value="compliant">Compliant</option>
              <option value="drifted">Drifted</option>
              <option value="unknown">Unknown</option>
            </select>
          </div>

          <div class="form-group">
            <label for="remediation-template-lifecycle-stage">Target Stage</label>
            <select id="remediation-template-lifecycle-stage" class="form-input" v-model="draft.lifecycleTargetStage">
              <option value="aligned">Aligned</option>
              <option value="review">Review</option>
              <option value="maintenance">Maintenance</option>
              <option value="remediate">Remediate</option>
            </select>
          </div>
        </div>

        <div class="vm-inline-form-grid">
          <div class="form-group">
            <label for="remediation-template-lifecycle-action">Next Action</label>
            <select id="remediation-template-lifecycle-action" class="form-input" v-model="draft.lifecycleNextAction">
              <option value="scan">Run Scan</option>
              <option value="patch">Apply Patch</option>
              <option value="reboot">Schedule Reboot</option>
              <option value="validate">Validate Outcome</option>
              <option value="none">No Action</option>
            </select>
          </div>

          <div class="form-group">
            <label for="remediation-template-lifecycle-due-days">Plan Due In (days)</label>
            <input id="remediation-template-lifecycle-due-days" class="form-input" type="number" min="0" max="365" v-model.number="draft.lifecycleDueDays">
          </div>
        </div>

        <div class="vm-inline-form-grid">
          <div class="form-group">
            <label for="remediation-template-lifecycle-window">Maintenance Window</label>
            <input id="remediation-template-lifecycle-window" class="form-input" v-model="draft.lifecycleMaintenanceWindow" placeholder="Sun 02:00">
          </div>

          <div class="form-group">
            <label for="remediation-template-lifecycle-patch">Patch Group</label>
            <input id="remediation-template-lifecycle-patch" class="form-input" v-model="draft.lifecyclePatchGroup" placeholder="Production Ring A">
          </div>
        </div>

        <div class="form-group">
          <label for="remediation-template-lifecycle-owner">Lifecycle Owner</label>
          <input id="remediation-template-lifecycle-owner" class="form-input" v-model="draft.lifecycleOwner" placeholder="Platform Ops">
        </div>

        <label class="form-toggle">
          <input type="checkbox" v-model="draft.lifecycleRebootRequired">
          <span>Reboot required after remediation</span>
        </label>

        <label class="form-toggle">
          <input type="checkbox" v-model="draft.lifecycleEvacuationRequired">
          <span>Evacuate workloads before work begins</span>
        </label>

        <div class="form-group">
          <label for="remediation-template-lifecycle-notes">Lifecycle Notes</label>
          <textarea id="remediation-template-lifecycle-notes"
                    class="form-input form-textarea"
                    rows="4"
                    v-model="draft.lifecycleNotes"
                    placeholder="Patch sequencing, rollback notes, firmware caveats, or host-level preparation."></textarea>
        </div>
      </template>

      <div class="detail-section" style="margin-top:8px">
        <div class="detail-section-title">Recovery Runbook Seed</div>
      </div>

      <label class="form-toggle">
        <input type="checkbox" v-model="draft.resilienceSeedEnabled">
        <span>Seed a resilience runbook when this template is queued</span>
      </label>

      <template v-if="draft.resilienceSeedEnabled">
        <div class="vm-inline-form-grid">
          <div class="form-group">
            <label for="remediation-template-recovery-tier">Recovery Tier</label>
            <select id="remediation-template-recovery-tier" class="form-input" v-model="draft.resilienceRecoveryTier">
              <option value="tier-1">Tier-1</option>
              <option value="tier-2">Tier-2</option>
              <option value="standard">Standard</option>
              <option value="edge">Edge</option>
            </select>
          </div>

          <div class="form-group">
            <label for="remediation-template-ha-policy">HA Policy</label>
            <select id="remediation-template-ha-policy" class="form-input" v-model="draft.resilienceHaPolicy">
              <option value="auto-failover">Auto Failover</option>
              <option value="priority-restart">Priority Restart</option>
              <option value="manual">Manual</option>
              <option value="disabled">Disabled</option>
            </select>
          </div>
        </div>

        <div class="vm-inline-form-grid">
          <div class="form-group">
            <label for="remediation-template-restart-priority">Restart Priority</label>
            <select id="remediation-template-restart-priority" class="form-input" v-model="draft.resilienceRestartPriority">
              <option value="highest">Highest</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
              <option value="best-effort">Best Effort</option>
            </select>
          </div>

          <div class="form-group">
            <label for="remediation-template-resilience-owner">Runbook Owner</label>
            <input id="remediation-template-resilience-owner" class="form-input" v-model="draft.resilienceOwner" placeholder="Platform Ops">
          </div>
        </div>

        <div class="vm-inline-form-grid">
          <div class="form-group">
            <label for="remediation-template-backup-window">Backup Window (hours)</label>
            <input id="remediation-template-backup-window" class="form-input" type="number" min="1" max="720" v-model.number="draft.resilienceBackupWindowHours">
          </div>

          <div class="form-group">
            <label for="remediation-template-restore-status">Restore-Point Status</label>
            <select id="remediation-template-restore-status" class="form-input" v-model="draft.resilienceRestorePointStatus">
              <option value="current">Current</option>
              <option value="review">Needs Review</option>
              <option value="stale">Stale</option>
              <option value="missing">Missing</option>
            </select>
          </div>
        </div>

        <div class="vm-inline-form-grid">
          <div class="form-group">
            <label for="remediation-template-rpo">RPO (minutes)</label>
            <input id="remediation-template-rpo" class="form-input" type="number" min="5" max="10080" v-model.number="draft.resilienceRpoMinutes">
          </div>

          <div class="form-group">
            <label for="remediation-template-rto">RTO (minutes)</label>
            <input id="remediation-template-rto" class="form-input" type="number" min="5" max="10080" v-model.number="draft.resilienceRtoMinutes">
          </div>
        </div>

        <div class="vm-inline-form-grid">
          <div class="form-group">
            <label for="remediation-template-standby-host">Standby Host Ref</label>
            <input id="remediation-template-standby-host" class="form-input" v-model="draft.resilienceStandbyHostRef" placeholder="OpaqueRef:host-demo-1">
          </div>

          <div class="form-group">
            <label for="remediation-template-failover-network">Failover Network Ref</label>
            <input id="remediation-template-failover-network" class="form-input" v-model="draft.resilienceFailoverNetworkRef" placeholder="OpaqueRef:net-demo-1">
          </div>
        </div>

        <div class="form-group">
          <label for="remediation-template-runbook-steps">Runbook Steps</label>
          <textarea id="remediation-template-runbook-steps"
                    class="form-input form-textarea"
                    rows="5"
                    v-model="draft.resilienceRunbookStepsText"
                    placeholder="One step per line: confirm backups, validate standby host, verify failover network, execute restore drill."></textarea>
        </div>

        <div class="form-group">
          <label for="remediation-template-runbook-notes">Runbook Notes</label>
          <textarea id="remediation-template-runbook-notes"
                    class="form-input form-textarea"
                    rows="4"
                    v-model="draft.resilienceNotes"
                    placeholder="Escalation path, pool failover dependencies, or DR-specific caveats."></textarea>
        </div>
      </template>

      <div class="form-actions">
        <button class="form-btn" type="submit" :disabled="saving">
          <span class="mdi mdi-content-save-outline"></span>
          {{ saving ? 'Saving...' : (submitLabel || 'Save Remediation Template') }}
        </button>
      </div>
    </form>
  `,
  data() {
    return {
      draft: buildRemediationTemplateDraft(this.initialValue),
    };
  },
  watch: {
    initialValue: {
      deep: true,
      handler(value) {
        this.draft = buildRemediationTemplateDraft(value);
      },
    },
  },
  methods: {
    handleSubmit() {
      const lifecyclePlanSeed = this.draft.lifecycleSeedEnabled
        ? {
          enabled: true,
          baselineStatus: this.draft.lifecycleBaselineStatus || 'unknown',
          targetStage: this.draft.lifecycleTargetStage || 'review',
          maintenanceWindow: this.draft.lifecycleMaintenanceWindow.trim(),
          patchGroup: this.draft.lifecyclePatchGroup.trim(),
          owner: this.draft.lifecycleOwner.trim(),
          nextAction: this.draft.lifecycleNextAction || 'scan',
          rebootRequired: Boolean(this.draft.lifecycleRebootRequired),
          evacuationRequired: Boolean(this.draft.lifecycleEvacuationRequired),
          dueDays: Number(this.draft.lifecycleDueDays || 0),
          notes: this.draft.lifecycleNotes.trim(),
        }
        : null;
      const resilienceRunbookSeed = this.draft.resilienceSeedEnabled
        ? {
          enabled: true,
          recoveryTier: this.draft.resilienceRecoveryTier || 'standard',
          haPolicy: this.draft.resilienceHaPolicy || 'manual',
          restartPriority: this.draft.resilienceRestartPriority || 'medium',
          backupWindowHours: Number(this.draft.resilienceBackupWindowHours || 24),
          rpoMinutes: Number(this.draft.resilienceRpoMinutes || 60),
          rtoMinutes: Number(this.draft.resilienceRtoMinutes || 120),
          restorePointStatus: this.draft.resilienceRestorePointStatus || 'review',
          owner: this.draft.resilienceOwner.trim(),
          standbyHostRef: this.draft.resilienceStandbyHostRef.trim(),
          failoverNetworkRef: this.draft.resilienceFailoverNetworkRef.trim(),
          runbookSteps: String(this.draft.resilienceRunbookStepsText || '')
            .split('\n')
            .map((entry) => entry.trim())
            .filter(Boolean),
          notes: this.draft.resilienceNotes.trim(),
        }
        : null;
      this.$emit('submit', {
        enabled: Boolean(this.draft.enabled),
        name: this.draft.name.trim(),
        matchClass: this.draft.matchClass || '',
        matchTargetRoute: this.draft.matchTargetRoute || '',
        matchObject: this.draft.matchObject.trim(),
        matchSeverity: this.draft.matchSeverity || '',
        matchText: this.draft.matchText.trim(),
        textMatchMode: this.draft.textMatchMode || 'phrase',
        actionType: this.draft.actionType || 'review',
        taskNameTemplate: this.draft.taskNameTemplate.trim(),
        defaultAssignee: this.draft.defaultAssignee.trim(),
        defaultDueDays: Number(this.draft.defaultDueDays || 0),
        defaultTargetRoute: this.draft.defaultTargetRoute || '',
        defaultNotes: this.draft.defaultNotes.trim(),
        workspaceSummaryTemplate: this.draft.workspaceSummaryTemplate.trim(),
        evidenceChecklist: String(this.draft.evidenceChecklistText || '')
          .split('\n')
          .map((entry) => entry.trim())
          .filter(Boolean),
        completionCriteria: String(this.draft.completionCriteriaText || '')
          .split('\n')
          .map((entry) => entry.trim())
          .filter(Boolean),
        launchMode: this.draft.launchMode || 'draft',
        recurrenceMode: this.draft.recurrenceMode || 'manual',
        recurrenceScope: this.draft.recurrenceScope || 'object',
        cooldownDays: Number(this.draft.recurrenceMode === 'cooldown' ? (this.draft.cooldownDays || 1) : 0),
        lifecyclePlanSeed,
        resilienceRunbookSeed,
      });
    },
  },
};
