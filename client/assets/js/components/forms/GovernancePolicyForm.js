const APPROVAL_WINDOW_DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function minutesToTimeInput(minutes) {
  const clamped = Math.max(0, Math.min(1440, Number(minutes) || 0));
  const hours = Math.floor(clamped / 60) % 24;
  const mins = clamped % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

function timeInputToMinutes(value, fallback) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value || '');
  if (!match) return fallback;
  const hours = Number(match[1]);
  const mins = Number(match[2]);
  if (hours > 23 || mins > 59) return fallback;
  return hours * 60 + mins;
}

function buildGovernancePolicyDraft(initialValue = {}) {
  return {
    defaultRole: initialValue.defaultRole || 'admin',
    requireDestructiveApproval: initialValue.requireDestructiveApproval !== false,
    approvalTtlMinutes: Number(initialValue.approvalTtlMinutes || 240),
    requireApproverDifferentFromRequester: Boolean(initialValue.requireApproverDifferentFromRequester),
    requireTwoPersonApproval: Boolean(initialValue.requireTwoPersonApproval),
    requireScheduledApprovalWindow: Boolean(initialValue.requireScheduledApprovalWindow),
    approvalWindowDays: Array.isArray(initialValue.approvalWindowDays) && initialValue.approvalWindowDays.length
      ? [...initialValue.approvalWindowDays]
      : [1, 2, 3, 4, 5],
    approvalWindowStart: minutesToTimeInput(initialValue.approvalWindowStartMinute ?? 0),
    approvalWindowEnd: minutesToTimeInput(initialValue.approvalWindowEndMinute ?? 1440),
    requireDomainApproverGroup: Boolean(initialValue.requireDomainApproverGroup),
    securityApproverGroupId: initialValue.securityApproverGroupId || '',
    infrastructureApproverGroupId: initialValue.infrastructureApproverGroupId || '',
  };
}

const GovernancePolicyForm = {
  props: ['initialValue', 'saving', 'submitLabel', 'groups'],
  emits: ['submit'],
  template: `
    <form @submit.prevent="handleSubmit">
      <div class="vm-inline-form-grid">
        <div class="form-group">
          <label for="governance-default-role">Default Role</label>
          <select id="governance-default-role" class="form-input" v-model="draft.defaultRole">
            <option value="read-only">Read Only</option>
            <option value="operator">Operator</option>
            <option value="admin">Admin</option>
          </select>
        </div>

        <div class="form-group">
          <label for="governance-approval-ttl">Approval Window (minutes)</label>
          <input id="governance-approval-ttl" class="form-input" v-model.number="draft.approvalTtlMinutes" type="number" min="5" max="10080">
        </div>
      </div>

      <label class="form-toggle">
        <input type="checkbox" v-model="draft.requireDestructiveApproval">
        <span>Require approved governance tokens for destructive actions in operator mode</span>
      </label>

      <label class="form-toggle">
        <input type="checkbox" v-model="draft.requireApproverDifferentFromRequester">
        <span>Separation of duties: the administrator who requested an approval cannot also approve it</span>
      </label>

      <label class="form-toggle">
        <input type="checkbox" v-model="draft.requireTwoPersonApproval">
        <span>Two-person approval: destructive requests need two different administrators to approve before they take effect</span>
      </label>

      <label class="form-toggle">
        <input type="checkbox" v-model="draft.requireScheduledApprovalWindow">
        <span>Scheduled approval window: approvals may only be granted during the configured recurring UTC window below</span>
      </label>

      <div class="vm-inline-form-grid" v-if="draft.requireScheduledApprovalWindow">
        <div class="form-group">
          <label>Allowed Days (UTC)</label>
          <div class="form-checkbox-row">
            <label v-for="(label, day) in dayLabels" :key="day" class="form-toggle form-toggle-inline">
              <input type="checkbox" :value="day" v-model="draft.approvalWindowDays">
              <span>{{ label }}</span>
            </label>
          </div>
        </div>

        <div class="form-group">
          <label for="governance-window-start">Window Start (UTC)</label>
          <input id="governance-window-start" class="form-input" v-model="draft.approvalWindowStart" type="time">
        </div>

        <div class="form-group">
          <label for="governance-window-end">Window End (UTC)</label>
          <input id="governance-window-end" class="form-input" v-model="draft.approvalWindowEnd" type="time">
        </div>
      </div>

      <label class="form-toggle">
        <input type="checkbox" v-model="draft.requireDomainApproverGroup">
        <span>Security + Infrastructure approval: route approvals for security-domain and infrastructure-domain requests to a designated local group</span>
      </label>

      <div class="vm-inline-form-grid" v-if="draft.requireDomainApproverGroup">
        <div class="form-group">
          <label for="governance-security-approver-group">Security Approver Group</label>
          <select id="governance-security-approver-group" class="form-input" v-model="draft.securityApproverGroupId">
            <option value="">Not required</option>
            <option v-for="group in groups || []" :key="group.id" :value="group.id">{{ group.name }}</option>
          </select>
        </div>

        <div class="form-group">
          <label for="governance-infrastructure-approver-group">Infrastructure Approver Group</label>
          <select id="governance-infrastructure-approver-group" class="form-input" v-model="draft.infrastructureApproverGroupId">
            <option value="">Not required</option>
            <option v-for="group in groups || []" :key="group.id" :value="group.id">{{ group.name }}</option>
          </select>
        </div>
      </div>

      <div class="form-actions">
        <button class="form-btn" type="submit" :disabled="saving">
          <span class="mdi mdi-content-save-outline"></span>
          {{ saving ? 'Saving...' : (submitLabel || 'Save Governance Policy') }}
        </button>
      </div>
    </form>
  `,
  data() {
    return {
      draft: buildGovernancePolicyDraft(this.initialValue),
      dayLabels: APPROVAL_WINDOW_DAY_LABELS,
    };
  },
  watch: {
    initialValue: {
      deep: true,
      handler(value) {
        this.draft = buildGovernancePolicyDraft(value);
      },
    },
  },
  methods: {
    handleSubmit() {
      this.$emit('submit', {
        defaultRole: this.draft.defaultRole,
        requireDestructiveApproval: Boolean(this.draft.requireDestructiveApproval),
        approvalTtlMinutes: Number(this.draft.approvalTtlMinutes || 240),
        requireApproverDifferentFromRequester: Boolean(this.draft.requireApproverDifferentFromRequester),
        requireTwoPersonApproval: Boolean(this.draft.requireTwoPersonApproval),
        requireScheduledApprovalWindow: Boolean(this.draft.requireScheduledApprovalWindow),
        approvalWindowDays: [...this.draft.approvalWindowDays].sort(),
        approvalWindowStartMinute: timeInputToMinutes(this.draft.approvalWindowStart, 0),
        approvalWindowEndMinute: timeInputToMinutes(this.draft.approvalWindowEnd, 1440),
        requireDomainApproverGroup: Boolean(this.draft.requireDomainApproverGroup),
        securityApproverGroupId: this.draft.securityApproverGroupId ? Number(this.draft.securityApproverGroupId) : null,
        infrastructureApproverGroupId: this.draft.infrastructureApproverGroupId ? Number(this.draft.infrastructureApproverGroupId) : null,
      });
    },
  },
};
