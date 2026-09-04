const GovernanceControlPanel = {
  components: {
    FloatingWindow,
    GovernancePolicyForm,
    GovernanceQuotaForm,
    GovernanceApprovalForm,
    LocalUserForm,
    LocalGroupForm,
    UserPasswordForm,
    StatusBadge,
  },
  props: {
    show: { type: Boolean, default: false },
    activeTab: { type: String, default: 'policy' },
    policy: { type: Object, default: () => ({}) },
    policySaving: { type: Boolean, default: false },
    policyError: { type: String, default: '' },
    quotaRows: { type: Array, default: () => [] },
    selectedQuotaRow: { type: Object, default: null },
    quotaSaving: { type: Boolean, default: false },
    quotaError: { type: String, default: '' },
    approvals: { type: Array, default: () => [] },
    approvalDraft: { type: Object, default: null },
    approvalSaving: { type: Boolean, default: false },
    approvalError: { type: String, default: '' },
    decidingApprovalId: { type: String, default: '' },
    canManageUsers: { type: Boolean, default: false },
    users: { type: Array, default: () => [] },
    groups: { type: Array, default: () => [] },
    selectedUser: { type: Object, default: null },
    showUserComposer: { type: Boolean, default: false },
    userSaving: { type: Boolean, default: false },
    userError: { type: String, default: '' },
    showPasswordReset: { type: Boolean, default: false },
    passwordSaving: { type: Boolean, default: false },
    passwordError: { type: String, default: '' },
    selectedGroup: { type: Object, default: null },
    showGroupComposer: { type: Boolean, default: false },
    groupSaving: { type: Boolean, default: false },
    groupError: { type: String, default: '' },
  },
  emits: ['close', 'select-tab', 'save-policy', 'select-quota', 'save-quota', 'delete-quota', 'save-approval', 'decide-approval', 'new-user', 'select-user', 'save-user', 'open-password-reset', 'close-password-reset', 'save-password', 'new-group', 'select-group', 'save-group', 'remove-group'],
  template: `
    <floating-window :show="show" title="Governance Control Panel" :width="980" :height="700" @close="$emit('close')">
      <div class="detail-section" style="margin-top:0">
        <div class="governance-panel-tabs" role="tablist" aria-label="Governance controls">
          <button v-for="tab in tabs" :key="tab.key" type="button" class="governance-panel-tab" :class="{ active: activeTab === tab.key }" @click="$emit('select-tab', tab.key)">
            <span class="mdi" :class="tab.icon"></span>
            <span>{{ tab.label }}</span>
          </button>
        </div>

        <div v-if="activeTab === 'policy'" class="governance-panel-section">
          <div class="detail-title">Governance Policy</div>
          <p class="text-muted">Set default operator scope and the approval guardrail applied to protected mutations.</p>
          <governance-policy-form :initial-value="policy" :saving="policySaving" :groups="groups" submit-label="Save Governance Policy" @submit="$emit('save-policy', $event)"></governance-policy-form>
          <div class="form-error" v-if="policyError">{{ policyError }}</div>
        </div>

        <div v-else-if="activeTab === 'quotas'" class="governance-panel-grid">
          <div class="stack-list">
            <button v-for="row in quotaRows" :key="row.poolRef" class="stack-item stack-item-button" :class="{ active: selectedQuotaRow?.poolRef === row.poolRef }" @click="$emit('select-quota', row)">
              <div><strong>{{ row.poolName }}</strong><div class="text-muted mono" style="font-size:11px">{{ row.detail }}</div></div>
              <status-badge :status="row.status"></status-badge>
            </button>
          </div>
          <div class="governance-panel-editor" v-if="selectedQuotaRow">
            <div class="detail-title">{{ selectedQuotaRow.poolName }} Quota</div>
            <governance-quota-form :initial-value="selectedQuotaRow.quota || {}" :pool-record="selectedQuotaRow" :saving="quotaSaving" submit-label="Save Pool Quota" @submit="$emit('save-quota', $event)"></governance-quota-form>
            <button v-if="selectedQuotaRow.quota" class="btn" :disabled="quotaSaving" @click="$emit('delete-quota', selectedQuotaRow)">Remove Quota</button>
            <div class="form-error" v-if="quotaError">{{ quotaError }}</div>
          </div>
          <div v-else class="empty-state">Select a pool to configure its quota.</div>
        </div>

        <div v-else-if="activeTab === 'approvals'" class="governance-panel-grid">
          <div class="stack-list">
            <div v-for="approval in approvals" :key="approval.id" class="stack-item">
              <div><strong>{{ formatApprovalAction(approval.actionKey) }}</strong><div class="text-muted mono" style="font-size:11px">{{ approval.entityName || approval.entityRef }} · {{ approval.requestedBy }}</div><div class="text-muted" style="font-size:12px;margin-top:5px">{{ approval.justification }}</div></div>
              <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap"><button v-if="approval.status === 'pending'" class="btn btn-sm" :disabled="decidingApprovalId === approval.id" @click="$emit('decide-approval', approval, 'approved')">Approve</button><button v-if="approval.status === 'pending'" class="btn btn-sm" :disabled="decidingApprovalId === approval.id" @click="$emit('decide-approval', approval, 'rejected')">Reject</button><status-badge :status="mapApprovalStatus(approval.status)"></status-badge></div>
            </div>
          </div>
          <div class="governance-panel-editor"><div class="detail-title">Request Approval</div><governance-approval-form :initial-value="approvalDraft" :saving="approvalSaving" submit-label="Request Approval" @submit="$emit('save-approval', $event)"></governance-approval-form><div class="form-error" v-if="approvalError">{{ approvalError }}</div></div>
        </div>

        <div v-else-if="activeTab === 'users'" class="governance-panel-grid">
          <div><button v-if="canManageUsers" class="btn btn-sm" style="margin-bottom:8px" @click="$emit('new-user')"><span class="mdi mdi-account-plus-outline"></span>New User</button><div class="stack-list"><button v-for="user in users" :key="user.id" class="stack-item stack-item-button" :class="{ active: selectedUser?.id === user.id }" @click="$emit('select-user', user)"><div><strong>{{ user.display_name || user.username }}</strong><div class="text-muted mono" style="font-size:11px">{{ user.username }} · {{ user.role }}</div></div><span class="badge" :class="user.active ? 'badge-success' : 'badge-warning'">{{ user.active ? 'Active' : 'Disabled' }}</span></button></div></div>
          <div class="governance-panel-editor" v-if="canManageUsers"><div class="detail-title">{{ selectedUser && !showUserComposer ? 'Edit Local User' : 'Create Local User' }}</div><local-user-form :initial-value="showUserComposer ? emptyUserDraft : (selectedUser || {})" :saving="userSaving" :submit-label="showUserComposer ? 'Create User' : 'Save User'" :mode="showUserComposer ? 'create' : 'edit'" :group-options="groups" @submit="$emit('save-user', $event)"></local-user-form><button v-if="selectedUser && !showUserComposer" class="btn" :disabled="passwordSaving" @click="$emit('open-password-reset', selectedUser)">Reset Password</button><user-password-form v-if="showPasswordReset" :saving="passwordSaving" submit-label="Rotate Password" @submit="$emit('save-password', $event)"></user-password-form><div class="form-error" v-if="userError || passwordError">{{ userError || passwordError }}</div></div>
        </div>

        <div v-else class="governance-panel-grid">
          <div><button v-if="canManageUsers" class="btn btn-sm" style="margin-bottom:8px" @click="$emit('new-group')"><span class="mdi mdi-account-group-outline"></span>New Group</button><div class="stack-list"><button v-for="group in groups" :key="group.id" class="stack-item stack-item-button" :class="{ active: selectedGroup?.id === group.id }" @click="$emit('select-group', group)"><div><strong>{{ group.name }}</strong><div class="text-muted mono" style="font-size:11px">{{ group.member_count || 0 }} members</div></div><span class="badge badge-info">{{ group.member_count || 0 }}</span></button></div></div>
          <div class="governance-panel-editor" v-if="canManageUsers"><div class="detail-title">{{ selectedGroup && !showGroupComposer ? 'Edit Local Group' : 'Create Local Group' }}</div><local-group-form :initial-value="showGroupComposer ? emptyGroupDraft : (selectedGroup || {})" :saving="groupSaving" :submit-label="showGroupComposer ? 'Create Group' : 'Save Group'" :user-options="users" @submit="$emit('save-group', $event)"></local-group-form><button v-if="selectedGroup && !showGroupComposer" class="btn" :disabled="groupSaving" @click="$emit('remove-group', selectedGroup)">Remove Group</button><div class="form-error" v-if="groupError">{{ groupError }}</div></div>
        </div>
      </div>
    </floating-window>
  `,
  data() { return { emptyUserDraft: {}, emptyGroupDraft: {}, tabs: [{ key: 'policy', label: 'Policy', icon: 'mdi-shield-cog-outline' }, { key: 'quotas', label: 'Quotas', icon: 'mdi-gauge' }, { key: 'users', label: 'Users', icon: 'mdi-account-multiple-outline' }, { key: 'groups', label: 'Groups', icon: 'mdi-account-group-outline' }, { key: 'approvals', label: 'Approvals', icon: 'mdi-clipboard-check-outline' }] }; },
  methods: { mapApprovalStatus: mapGovernanceApprovalStatus, formatApprovalAction: formatGovernanceApprovalAction },
};
