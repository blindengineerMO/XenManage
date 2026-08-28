const GovernanceWorkspaceDialogs = {
  components: {
    FloatingWindow,
    GovernanceQuotaForm,
    GovernanceApprovalForm,
    LocalUserForm,
    LocalGroupForm,
    UserPasswordForm,
  },
  props: {
    showQuotaEditor: { type: Boolean, default: false },
    selectedQuotaRow: { type: Object, default: null },
    quotaError: { type: String, default: '' },
    quotaSaving: { type: Boolean, default: false },
    showApprovalComposer: { type: Boolean, default: false },
    approvalError: { type: String, default: '' },
    approvalDraft: { type: Object, default: null },
    approvalSaving: { type: Boolean, default: false },
    showUserComposer: { type: Boolean, default: false },
    userError: { type: String, default: '' },
    userSaving: { type: Boolean, default: false },
    groups: { type: Array, default: () => [] },
    showUserEditor: { type: Boolean, default: false },
    selectedUser: { type: Object, default: null },
    selectedUserIsCurrentSession: { type: Boolean, default: false },
    passwordSaving: { type: Boolean, default: false },
    showPasswordReset: { type: Boolean, default: false },
    passwordError: { type: String, default: '' },
    showGroupComposer: { type: Boolean, default: false },
    groupError: { type: String, default: '' },
    groupSaving: { type: Boolean, default: false },
    users: { type: Array, default: () => [] },
    showGroupEditor: { type: Boolean, default: false },
    selectedGroup: { type: Object, default: null },
  },
  emits: [
    'close-quota-editor',
    'save-quota',
    'delete-quota',
    'close-approval-composer',
    'save-approval-request',
    'close-user-composer',
    'save-new-user',
    'close-user-editor',
    'save-existing-user',
    'open-password-reset',
    'close-password-reset',
    'submit-password-reset',
    'close-group-composer',
    'save-new-group',
    'close-group-editor',
    'save-existing-group',
    'remove-group',
  ],
  template: `
    <div>
      <floating-window :show="showQuotaEditor"
                       title="Pool Quota"
                       :width="720"
                       :height="560"
                       @close="$emit('close-quota-editor')">
        <div v-if="selectedQuotaRow">
          <div class="detail-section" v-if="quotaError">
            <div class="capacity-callout">
              <strong>{{ quotaError }}</strong>
            </div>
          </div>
          <governance-quota-form
            :initial-value="selectedQuotaRow.quota || {}"
            :pool-record="selectedQuotaRow"
            :saving="quotaSaving"
            submit-label="Save Pool Quota"
            @submit="$emit('save-quota', $event)">
          </governance-quota-form>
          <div class="form-actions" style="margin-top:12px" v-if="selectedQuotaRow.quota">
            <button class="btn" @click="$emit('delete-quota', selectedQuotaRow)" :disabled="quotaSaving">Remove Quota</button>
          </div>
        </div>
      </floating-window>

      <floating-window :show="showApprovalComposer"
                       title="Approval Request"
                       :width="720"
                       :height="560"
                       @close="$emit('close-approval-composer')">
        <div class="detail-section" v-if="approvalError">
          <div class="capacity-callout">
            <strong>{{ approvalError }}</strong>
          </div>
        </div>
        <governance-approval-form
          :initial-value="approvalDraft"
          :saving="approvalSaving"
          submit-label="Request Approval"
          @submit="$emit('save-approval-request', $event)">
        </governance-approval-form>
      </floating-window>

      <floating-window :show="showUserComposer"
                       title="Create Local User"
                       :width="720"
                       :height="580"
                       @close="$emit('close-user-composer')">
        <div class="detail-section" v-if="userError">
          <div class="capacity-callout">
            <strong>{{ userError }}</strong>
          </div>
        </div>
        <local-user-form
          :saving="userSaving"
          submit-label="Create User"
          mode="create"
          :group-options="groups"
          @submit="$emit('save-new-user', $event)">
        </local-user-form>
      </floating-window>

      <floating-window :show="showUserEditor"
                       title="Edit Local User"
                       :width="760"
                       :height="620"
                       @close="$emit('close-user-editor')">
        <div v-if="selectedUser">
          <div class="detail-section">
            <div class="property-grid">
              <div>
                <label>Last Login</label>
                <span>{{ formatDateTime(selectedUser.last_login_at) }}</span>
              </div>
              <div>
                <label>Created</label>
                <span>{{ formatDateTime(selectedUser.created_at) }}</span>
              </div>
              <div>
                <label>Groups</label>
                <span>{{ selectedUser.groups?.length ? selectedUser.groups.join(', ') : 'No groups assigned yet' }}</span>
              </div>
              <div>
                <label>Current Session</label>
                <span>{{ selectedUserIsCurrentSession ? 'Yes' : 'No' }}</span>
              </div>
            </div>
          </div>

          <div class="detail-section" v-if="userError">
            <div class="capacity-callout">
              <strong>{{ userError }}</strong>
            </div>
          </div>

          <local-user-form
            :initial-value="selectedUser"
            :saving="userSaving"
            submit-label="Save User"
            mode="edit"
            :group-options="groups"
            @submit="$emit('save-existing-user', $event)">
          </local-user-form>

          <div class="form-actions" style="margin-top:12px">
            <button class="btn" @click="$emit('open-password-reset', selectedUser)" :disabled="passwordSaving">
              <span class="mdi mdi-lock-reset"></span>
              Reset Password
            </button>
          </div>
        </div>
      </floating-window>

      <floating-window :show="showPasswordReset"
                       title="Reset Local Password"
                       :width="560"
                       :height="360"
                       @close="$emit('close-password-reset')">
        <div class="detail-section" v-if="passwordError">
          <div class="capacity-callout">
            <strong>{{ passwordError }}</strong>
          </div>
        </div>
        <div class="detail-section" v-if="selectedUser">
          <div class="capacity-callout">
            <strong>{{ selectedUser.display_name || selectedUser.username }}</strong>
            <div class="text-muted mono" style="font-size:11px;margin-top:6px">{{ selectedUser.username }}</div>
          </div>
        </div>
        <user-password-form
          :saving="passwordSaving"
          submit-label="Rotate Password"
          @submit="$emit('submit-password-reset', $event)">
        </user-password-form>
      </floating-window>

      <floating-window :show="showGroupComposer"
                       title="Create Local Group"
                       :width="720"
                       :height="520"
                       @close="$emit('close-group-composer')">
        <div class="detail-section" v-if="groupError">
          <div class="capacity-callout">
            <strong>{{ groupError }}</strong>
          </div>
        </div>
        <local-group-form
          :saving="groupSaving"
          submit-label="Create Group"
          :user-options="users"
          @submit="$emit('save-new-group', $event)">
        </local-group-form>
      </floating-window>

      <floating-window :show="showGroupEditor"
                       title="Edit Local Group"
                       :width="760"
                       :height="560"
                       @close="$emit('close-group-editor')">
        <div v-if="selectedGroup">
          <div class="detail-section">
            <div class="property-grid">
              <div>
                <label>Created</label>
                <span>{{ formatDateTime(selectedGroup.created_at) }}</span>
              </div>
              <div>
                <label>Members</label>
                <span>{{ selectedGroup.member_count || 0 }}</span>
              </div>
            </div>
          </div>

          <div class="detail-section" v-if="groupError">
            <div class="capacity-callout">
              <strong>{{ groupError }}</strong>
            </div>
          </div>

          <local-group-form
            :initial-value="selectedGroup"
            :saving="groupSaving"
            submit-label="Save Group"
            :user-options="users"
            @submit="$emit('save-existing-group', $event)">
          </local-group-form>

          <div class="form-actions" style="margin-top:12px">
            <button class="btn" @click="$emit('remove-group', selectedGroup)" :disabled="groupSaving">Remove Group</button>
          </div>
        </div>
      </floating-window>
    </div>
  `,
  methods: {
    formatDateTime,
  },
};
