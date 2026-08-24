function buildResilienceRunbookDraft(initialValue = {}) {
  const source = initialValue || {};
  return {
    recoveryTier: source.recoveryTier || 'standard',
    haPolicy: source.haPolicy || 'manual',
    restartPriority: source.restartPriority || 'medium',
    backupWindowHours: Number(source.backupWindowHours || 24),
    rpoMinutes: Number(source.rpoMinutes || 60),
    rtoMinutes: Number(source.rtoMinutes || 120),
    restorePointStatus: source.restorePointStatus || 'review',
    owner: source.owner || '',
    standbyHostRef: source.standbyHostRef || '',
    failoverNetworkRef: source.failoverNetworkRef || '',
    lastVerifiedAt: source.lastVerifiedAt ? String(source.lastVerifiedAt).slice(0, 16) : '',
    runbookStepsText: Array.isArray(source.runbookSteps) ? source.runbookSteps.join('\n') : '',
    notes: source.notes || '',
  };
}

const ResilienceRunbookForm = {
  props: ['initialValue', 'poolRecord', 'hosts', 'networks', 'submitLabel', 'saving'],
  emits: ['submit'],
  template: `
    <form @submit.prevent="handleSubmit">
      <div class="vm-inline-form-grid">
        <div class="form-group">
          <label for="resilience-recovery-tier">Recovery Tier</label>
          <select id="resilience-recovery-tier" class="form-input" v-model="draft.recoveryTier">
            <option value="tier-1">Tier-1</option>
            <option value="tier-2">Tier-2</option>
            <option value="standard">Standard</option>
            <option value="edge">Edge</option>
          </select>
        </div>

        <div class="form-group">
          <label for="resilience-ha-policy">HA Policy</label>
          <select id="resilience-ha-policy" class="form-input" v-model="draft.haPolicy">
            <option value="auto-failover">Auto Failover</option>
            <option value="priority-restart">Priority Restart</option>
            <option value="manual">Manual</option>
            <option value="disabled">Disabled</option>
          </select>
        </div>
      </div>

      <div class="vm-inline-form-grid">
        <div class="form-group">
          <label for="resilience-restart-priority">Restart Priority</label>
          <select id="resilience-restart-priority" class="form-input" v-model="draft.restartPriority">
            <option value="highest">Highest</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
            <option value="best-effort">Best Effort</option>
          </select>
        </div>

        <div class="form-group">
          <label for="resilience-owner">Owner</label>
          <input id="resilience-owner" class="form-input" v-model="draft.owner" placeholder="Platform Ops">
        </div>
      </div>

      <div class="vm-inline-form-grid">
        <div class="form-group">
          <label for="resilience-backup-window">Backup Window (hours)</label>
          <input id="resilience-backup-window" class="form-input" v-model.number="draft.backupWindowHours" type="number" min="1" max="720">
        </div>

        <div class="form-group">
          <label for="resilience-restore-status">Restore-Point Status</label>
          <select id="resilience-restore-status" class="form-input" v-model="draft.restorePointStatus">
            <option value="current">Current</option>
            <option value="review">Needs Review</option>
            <option value="stale">Stale</option>
            <option value="missing">Missing</option>
          </select>
        </div>
      </div>

      <div class="vm-inline-form-grid">
        <div class="form-group">
          <label for="resilience-rpo">RPO (minutes)</label>
          <input id="resilience-rpo" class="form-input" v-model.number="draft.rpoMinutes" type="number" min="5" max="10080">
        </div>

        <div class="form-group">
          <label for="resilience-rto">RTO (minutes)</label>
          <input id="resilience-rto" class="form-input" v-model.number="draft.rtoMinutes" type="number" min="5" max="10080">
        </div>
      </div>

      <div class="vm-inline-form-grid">
        <div class="form-group">
          <label for="resilience-standby-host">Standby Host</label>
          <select id="resilience-standby-host" class="form-input" v-model="draft.standbyHostRef">
            <option value="">No explicit standby host</option>
            <option v-for="host in hosts || []" :key="host.ref" :value="host.ref">
              {{ host.name_label || host.hostname || host.ref }}
            </option>
          </select>
        </div>

        <div class="form-group">
          <label for="resilience-failover-network">Failover Network</label>
          <select id="resilience-failover-network" class="form-input" v-model="draft.failoverNetworkRef">
            <option value="">No explicit failover network</option>
            <option v-for="network in networks || []" :key="network.ref" :value="network.ref">
              {{ network.name_label || network.bridge || network.ref }}
            </option>
          </select>
        </div>
      </div>

      <div class="vm-inline-form-grid">
        <div class="form-group">
          <label for="resilience-pool-label">Pool</label>
          <input id="resilience-pool-label" class="form-input" :value="poolLabel" disabled>
        </div>

        <div class="form-group">
          <label for="resilience-verified-at">Last Verified</label>
          <input id="resilience-verified-at" class="form-input" v-model="draft.lastVerifiedAt" type="datetime-local">
        </div>
      </div>

      <div class="form-group">
        <label for="resilience-runbook-steps">Runbook Steps</label>
        <textarea id="resilience-runbook-steps"
                  class="form-input form-textarea"
                  v-model="draft.runbookStepsText"
                  rows="6"
                  placeholder="One step per line: verify backups, evacuate workloads, validate storage, run restore drill."></textarea>
      </div>

      <div class="form-group">
        <label for="resilience-runbook-notes">Runbook Notes</label>
        <textarea id="resilience-runbook-notes"
                  class="form-input form-textarea"
                  v-model="draft.notes"
                  rows="5"
                  placeholder="Escalation path, restore dependencies, network sequencing, or operator caveats."></textarea>
      </div>

      <div class="form-actions">
        <button class="form-btn" type="submit" :disabled="saving">
          <span class="mdi mdi-content-save-outline"></span>
          {{ saving ? 'Saving...' : (submitLabel || 'Save Runbook') }}
        </button>
      </div>
    </form>
  `,
  data() {
    return {
      draft: buildResilienceRunbookDraft(this.initialValue),
    };
  },
  computed: {
    poolLabel() {
      return this.poolRecord?.name_label || this.poolRecord?.ref || '';
    },
  },
  watch: {
    initialValue: {
      deep: true,
      handler(value) {
        this.draft = buildResilienceRunbookDraft(value);
      },
    },
  },
  methods: {
    handleSubmit() {
      this.$emit('submit', {
        recoveryTier: this.draft.recoveryTier,
        haPolicy: this.draft.haPolicy,
        restartPriority: this.draft.restartPriority,
        backupWindowHours: Number(this.draft.backupWindowHours || 24),
        rpoMinutes: Number(this.draft.rpoMinutes || 60),
        rtoMinutes: Number(this.draft.rtoMinutes || 120),
        restorePointStatus: this.draft.restorePointStatus,
        owner: this.draft.owner.trim(),
        standbyHostRef: this.draft.standbyHostRef || '',
        failoverNetworkRef: this.draft.failoverNetworkRef || '',
        lastVerifiedAt: this.draft.lastVerifiedAt ? new Date(this.draft.lastVerifiedAt).toISOString() : '',
        runbookSteps: String(this.draft.runbookStepsText || '')
          .split('\n')
          .map((step) => step.trim())
          .filter(Boolean),
        notes: this.draft.notes.trim(),
      });
    },
  },
};
