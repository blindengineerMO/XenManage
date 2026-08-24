const GovernanceView = {
  components: {
    FloatingWindow,
    StatusBadge,
    'governance-policy-form': GovernancePolicyForm,
    'governance-quota-form': GovernanceQuotaForm,
    'governance-approval-form': GovernanceApprovalForm,
    'local-user-form': LocalUserForm,
    'user-password-form': UserPasswordForm,
  },
  template: `
    <div class="animate-fade-in">
      <div v-if="loading" class="empty-state">
        <span class="loading-spinner"></span>
        <p style="margin-top:12px">Loading governance policy, local-user posture, quota posture, and approval history...</p>
      </div>

      <template v-else>
        <div class="section-head">
          <div>
            <h2 class="section-title">
              <span class="mdi mdi-shield-account-outline"></span>
              Governance
            </h2>
            <p class="section-subtitle">Role-aware operations, local user administration, pool quotas, and approval-gated destructive actions for the evolving XenMange control plane.</p>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn"
                    v-if="canManageUsers"
                    @click="openUserComposer()">
              <span class="mdi mdi-account-plus-outline"></span>
              Add User
            </button>
            <button class="btn" @click="openApprovalComposer()">
              <span class="mdi mdi-clipboard-check-outline"></span>
              Request Approval
            </button>
            <button class="btn btn-primary" @click="loadGovernance">
              <span class="mdi mdi-refresh"></span>
              Refresh
            </button>
          </div>
        </div>

        <div class="dashboard-hero">
          <div>
            <div class="dash-card-label">Access Control Plane</div>
            <h3>Session role, local-user access, quota guardrails, and approval flow in one workspace.</h3>
            <p>This governance pass now combines persisted local user administration with session role modes, pool quotas, and explicit approval tracking so the control plane behaves more like a scoped administrative product.</p>
          </div>
          <div class="dashboard-hero-rail">
            <button class="btn btn-primary" @click="$router.push('/activity')">
              <span class="mdi mdi-timeline-clock-outline"></span>
              Audit Trail
            </button>
            <button class="btn" @click="$router.push('/templates')">
              <span class="mdi mdi-file-document-multiple-outline"></span>
              Templates
            </button>
            <button class="btn" @click="$router.push('/vms')">
              <span class="mdi mdi-desktop-tower"></span>
              VM Actions
            </button>
          </div>
        </div>

        <div class="dash-grid">
          <div class="dash-card" v-for="card in summaryCards" :key="card.key">
            <div class="dash-card-label">{{ card.label }}</div>
            <div class="dash-card-value" :class="card.valueClass || ''">{{ card.value }}</div>
            <div class="dash-card-icon mdi" :class="card.icon"></div>
            <div class="text-muted mono" style="margin-top:8px;font-size:11px">{{ card.detail }}</div>
          </div>
        </div>

        <div class="dashboard-panels">
          <div class="dash-card">
            <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap">
              <div class="dash-card-label">Local Users</div>
              <button class="btn btn-sm"
                      v-if="canManageUsers"
                      @click="openUserComposer()">
                <span class="mdi mdi-account-plus-outline"></span>
                New User
              </button>
            </div>
            <div class="stack-list" v-if="users.length">
              <button class="stack-item stack-item-button"
                      v-for="user in users"
                      :key="user.id"
                      @click="openUserEditor(user)">
                <div>
                  <strong>{{ user.display_name || user.username }}</strong>
                  <div class="text-muted mono" style="font-size:11px">
                    {{ user.username }} · {{ formatRole(user.role) }} · {{ user.active ? 'Active' : 'Disabled' }}
                  </div>
                  <div class="text-muted" style="font-size:12px;margin-top:6px">
                    {{ user.email || 'No email recorded' }} · {{ user.group_count || 0 }} {{ (user.group_count || 0) === 1 ? 'group' : 'groups' }}
                  </div>
                  <div class="text-muted mono" style="font-size:11px;margin-top:4px">
                    Last login {{ formatDateTime(user.last_login_at) }}
                  </div>
                </div>
                <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
                  <span class="badge" :class="user.active ? 'badge-success' : 'badge-warning'">
                    {{ user.active ? 'Active' : 'Disabled' }}
                  </span>
                  <span class="badge" :class="roleBadgeClass(user.role)">
                    {{ formatRole(user.role) }}
                  </span>
                </div>
              </button>
            </div>
            <div v-else class="empty-state" style="padding:20px 12px">
              <p v-if="canManageUsers">No local users have been created beyond the bootstrap account.</p>
              <p v-else>Switch into a local admin session to inspect and manage control-plane users.</p>
            </div>
          </div>

          <div class="dash-card">
            <div class="dash-card-label">Session Role</div>
            <div class="stack-list">
              <button class="stack-item stack-item-button"
                      v-for="role in roles"
                      :key="role.value"
                      @click="switchRole(role.value)">
                <div>
                  <strong>{{ role.label }}</strong>
                  <div class="text-muted mono" style="font-size:11px">{{ role.detail }}</div>
                </div>
                <span class="badge" :class="store.governance.currentRole === role.value ? 'badge-success' : 'badge-info'">
                  {{ store.governance.currentRole === role.value ? 'Active' : 'Switch' }}
                </span>
              </button>
            </div>
          </div>

          <div class="dash-card">
            <div class="dash-card-label">Access Coverage</div>
            <div class="stack-list">
              <div class="stack-item" v-for="item in accessCoverageRows" :key="item.title">
                <div>
                  <strong>{{ item.title }}</strong>
                  <div class="text-muted" style="font-size:12px">{{ item.detail }}</div>
                </div>
                <span class="badge" :class="item.badgeClass">{{ item.value }}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="dashboard-panels">
          <div class="dash-card">
            <div class="dash-card-label">Governance Policy</div>
            <governance-policy-form
              :initial-value="policy"
              :saving="policySaving"
              submit-label="Save Governance Policy"
              @submit="savePolicy">
            </governance-policy-form>
            <div class="form-error" v-if="policyError" style="text-align:left">{{ policyError }}</div>
          </div>

          <div class="dash-card">
            <div class="dash-card-label">Role Guidance</div>
            <div class="stack-list">
              <div class="stack-item" v-for="item in roleGuidance" :key="item.title">
                <div>
                  <strong>{{ item.title }}</strong>
                  <div class="text-muted" style="font-size:12px">{{ item.detail }}</div>
                </div>
                <status-badge :status="item.status"></status-badge>
              </div>
            </div>
          </div>
        </div>

        <div class="dashboard-panels">
          <div class="dash-card">
            <div class="dash-card-label">Pool Quotas</div>
            <div class="stack-list" v-if="quotaRows.length">
              <button class="stack-item stack-item-button"
                      v-for="row in quotaRows"
                      :key="row.poolRef"
                      @click="openQuotaEditor(row)">
                <div>
                  <strong>{{ row.poolName }}</strong>
                  <div class="text-muted mono" style="font-size:11px">
                    {{ row.currentVmCount }} VMs · {{ row.currentRunningVmCount }} running · {{ row.currentTotalMemoryGiB }} GiB
                  </div>
                  <div class="text-muted" style="font-size:12px;margin-top:6px">{{ row.detail }}</div>
                </div>
                <status-badge :status="row.status"></status-badge>
              </button>
            </div>
            <div v-else class="empty-state" style="padding:20px 12px">No pools were returned for quota posture analysis.</div>
          </div>

          <div class="dash-card">
            <div class="dash-card-label">Approval Queue</div>
            <div class="stack-list" v-if="approvals.length">
              <div class="stack-item" v-for="approval in approvals.slice(0, 8)" :key="approval.id">
                <div>
                  <strong>{{ formatApprovalAction(approval.actionKey) }}</strong>
                  <div class="text-muted mono" style="font-size:11px">{{ approval.entityName || approval.entityRef }} · {{ approval.requestedBy }} · {{ formatDateTime(approval.requestedAt) }}</div>
                  <div class="text-muted" style="font-size:12px;margin-top:6px">{{ approval.justification }}</div>
                  <div class="text-muted mono" style="font-size:11px;margin-top:4px" v-if="approval.expiresAt">Expires {{ formatDateTime(approval.expiresAt) }}</div>
                </div>
                <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
                  <button class="btn btn-sm"
                          v-if="approval.status === 'pending'"
                          :disabled="store.governance.currentRole !== 'admin' || decidingApprovalId === approval.id"
                          @click="decideApproval(approval, 'approved')">
                    Approve
                  </button>
                  <button class="btn btn-sm"
                          v-if="approval.status === 'pending'"
                          :disabled="store.governance.currentRole !== 'admin' || decidingApprovalId === approval.id"
                          @click="decideApproval(approval, 'rejected')">
                    Reject
                  </button>
                  <status-badge :status="mapApprovalStatus(approval.status)"></status-badge>
                </div>
              </div>
            </div>
            <div v-else class="empty-state" style="padding:20px 12px">No approval requests have been recorded yet.</div>
          </div>
        </div>

        <div class="dashboard-panels">
          <div class="dash-card">
            <div class="dash-card-label">Quota Coverage</div>
            <div class="stack-list">
              <div class="stack-item" v-for="row in quotaRows.slice(0, 6)" :key="row.poolRef">
                <div>
                  <strong>{{ row.poolName }}</strong>
                  <div class="text-muted mono" style="font-size:11px">
                    {{ row.quota?.enabled ? 'Quota enforced' : 'No quota enforced' }} · {{ row.quota?.owner || 'No owner' }}
                  </div>
                </div>
                <span class="badge" :class="row.quota?.enabled ? 'badge-info' : 'badge-warning'">
                  {{ row.quota?.enabled ? 'Policy' : 'Gap' }}
                </span>
              </div>
            </div>
          </div>

          <div class="dash-card">
            <div class="dash-card-label">Approval Posture</div>
            <div class="stack-list">
              <div class="stack-item">
                <div>
                  <strong>Session Scope</strong>
                  <div class="text-muted" style="font-size:12px">Operators can request approvals, while admin sessions decide and consume the queue for protected actions.</div>
                </div>
                <span class="badge" :class="store.governance.currentRole === 'admin' ? 'badge-success' : 'badge-info'">
                  {{ formatRole(store.governance.currentRole) }}
                </span>
              </div>
              <div class="stack-item">
                <div>
                  <strong>Policy Window</strong>
                  <div class="text-muted" style="font-size:12px">Approved tokens currently expire after {{ policy.approvalTtlMinutes || 240 }} minutes unless overridden per request.</div>
                </div>
                <span class="badge" :class="policy.requireDestructiveApproval ? 'badge-success' : 'badge-warning'">
                  {{ policy.requireDestructiveApproval ? 'Gated' : 'Open' }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <floating-window :show="showQuotaEditor"
                         title="Pool Quota"
                         :width="720"
                         :height="560"
                         @close="closeQuotaEditor">
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
              @submit="saveQuota">
            </governance-quota-form>
            <div class="form-actions" style="margin-top:12px" v-if="selectedQuotaRow.quota">
              <button class="btn" @click="deleteQuota(selectedQuotaRow)" :disabled="quotaSaving">Remove Quota</button>
            </div>
          </div>
        </floating-window>

        <floating-window :show="showApprovalComposer"
                         title="Approval Request"
                         :width="720"
                         :height="560"
                         @close="closeApprovalComposer">
          <div class="detail-section" v-if="approvalError">
            <div class="capacity-callout">
              <strong>{{ approvalError }}</strong>
            </div>
          </div>
          <governance-approval-form
            :saving="approvalSaving"
            submit-label="Request Approval"
            @submit="saveApprovalRequest">
          </governance-approval-form>
        </floating-window>

        <floating-window :show="showUserComposer"
                         title="Create Local User"
                         :width="720"
                         :height="580"
                         @close="closeUserComposer">
          <div class="detail-section" v-if="userError">
            <div class="capacity-callout">
              <strong>{{ userError }}</strong>
            </div>
          </div>
          <local-user-form
            :saving="userSaving"
            submit-label="Create User"
            mode="create"
            @submit="saveNewUser">
          </local-user-form>
        </floating-window>

        <floating-window :show="showUserEditor"
                         title="Edit Local User"
                         :width="760"
                         :height="620"
                         @close="closeUserEditor">
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
                  <span>{{ isCurrentSessionUser(selectedUser) ? 'Yes' : 'No' }}</span>
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
              @submit="saveExistingUser">
            </local-user-form>

            <div class="form-actions" style="margin-top:12px">
              <button class="btn" @click="openPasswordReset(selectedUser)" :disabled="passwordSaving">
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
                         @close="closePasswordReset">
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
            @submit="submitPasswordReset">
          </user-password-form>
        </floating-window>
      </template>
    </div>
  `,
  data() {
    return {
      loading: true,
      policySaving: false,
      quotaSaving: false,
      approvalSaving: false,
      userSaving: false,
      passwordSaving: false,
      decidingApprovalId: '',
      policyError: '',
      quotaError: '',
      approvalError: '',
      userError: '',
      passwordError: '',
      summary: {
        pendingApprovalCount: 0,
        approvedApprovalCount: 0,
        enforcedQuotaCount: 0,
        poolCount: 0,
      },
      userSummary: {
        totalUsers: 0,
        activeUsers: 0,
        activeAdmins: 0,
      },
      policy: {
        defaultRole: 'admin',
        requireDestructiveApproval: true,
        approvalTtlMinutes: 240,
      },
      approvals: [],
      quotaRows: [],
      users: [],
      showQuotaEditor: false,
      showApprovalComposer: false,
      showUserComposer: false,
      showUserEditor: false,
      showPasswordReset: false,
      selectedQuotaRow: null,
      selectedUser: null,
    };
  },
  setup() {
    return { store };
  },
  computed: {
    roles() {
      return [
        { value: 'read-only', label: 'Read Only', detail: 'Browse inventory and reports without changing infrastructure state.' },
        { value: 'operator', label: 'Operator', detail: 'Perform standard changes, with destructive actions gated by approval when policy requires it.' },
        { value: 'admin', label: 'Admin', detail: 'Full access to policy, approval, quota, and user-administration workflows.' },
      ];
    },
    canManageUsers() {
      return store.authMode === 'local' && store.governance.currentRole === 'admin';
    },
    summaryCards() {
      return [
        {
          key: 'role',
          label: 'Current Role',
          value: this.formatRole(store.governance.currentRole),
          detail: `Default role is ${this.formatRole(this.policy.defaultRole)}`,
          icon: 'mdi-shield-account-outline',
          valueClass: store.governance.currentRole === 'read-only' ? 'text-amber' : 'text-green',
        },
        {
          key: 'approvals',
          label: 'Pending Approvals',
          value: String(this.summary.pendingApprovalCount || 0),
          detail: `${this.summary.approvedApprovalCount || 0} approved requests remain in the current queue`,
          icon: 'mdi-clipboard-check-outline',
          valueClass: (this.summary.pendingApprovalCount || 0) ? 'text-amber' : 'text-green',
        },
        {
          key: 'quotas',
          label: 'Enforced Quotas',
          value: String(this.summary.enforcedQuotaCount || 0),
          detail: `${this.summary.poolCount || 0} pools currently inspected for quota posture`,
          icon: 'mdi-gauge',
          valueClass: (this.summary.enforcedQuotaCount || 0) ? 'text-cyan' : 'text-amber',
        },
        {
          key: 'policy',
          label: 'Destructive Gate',
          value: this.policy.requireDestructiveApproval ? 'Approval Required' : 'Direct Operator Access',
          detail: `Approval tokens expire after ${this.policy.approvalTtlMinutes || 240} minutes`,
          icon: 'mdi-shield-lock-outline',
          valueClass: this.policy.requireDestructiveApproval ? 'text-green' : 'text-amber',
        },
        {
          key: 'users',
          label: 'Active Users',
          value: String(this.userSummary.activeUsers || 0),
          detail: `${this.userSummary.activeAdmins || 0} active administrators across ${this.userSummary.totalUsers || 0} local accounts`,
          icon: 'mdi-account-multiple-outline',
          valueClass: (this.userSummary.activeUsers || 0) > 1 ? 'text-cyan' : 'text-amber',
        },
      ];
    },
    accessCoverageRows() {
      const operatorCount = this.users.filter((user) => user.role === 'operator').length;
      const readOnlyCount = this.users.filter((user) => user.role === 'read-only').length;
      const activeOperatorCount = this.users.filter((user) => user.role === 'operator' && user.active).length;
      const activeReadOnlyCount = this.users.filter((user) => user.role === 'read-only' && user.active).length;

      return [
        {
          title: 'Administrator Coverage',
          detail: this.userSummary.activeAdmins
            ? 'At least one active admin account can recover policy, approvals, and access-control settings.'
            : 'No active admin coverage remains. Recover control before continuing operations.',
          value: `${this.userSummary.activeAdmins || 0} admin${(this.userSummary.activeAdmins || 0) === 1 ? '' : 's'}`,
          badgeClass: this.userSummary.activeAdmins ? 'badge-success' : 'badge-error',
        },
        {
          title: 'Operator Footprint',
          detail: `${activeOperatorCount} active operators can run day-to-day infrastructure changes without full policy ownership.`,
          value: `${operatorCount} operators`,
          badgeClass: 'badge-info',
        },
        {
          title: 'Read-Only Access',
          detail: `${activeReadOnlyCount} viewers can inspect dashboards, inventory, and audit data without mutation rights.`,
          value: `${readOnlyCount} viewers`,
          badgeClass: 'badge-warning',
        },
      ];
    },
    roleGuidance() {
      return [
        {
          title: 'Read Only Sessions',
          detail: 'Use read-only mode for dashboard, audit, and inventory walkthroughs where infrastructure state should stay untouched.',
          status: store.governance.currentRole === 'read-only' ? 'info' : 'success',
        },
        {
          title: 'Operator Sessions',
          detail: this.policy.requireDestructiveApproval
            ? 'Operators can work normally, but shutdown, reboot, and suspend flows require approved governance tokens first.'
            : 'Operators currently have direct access to destructive actions because approval gating is disabled.',
          status: this.policy.requireDestructiveApproval ? 'warning' : 'info',
        },
        {
          title: 'Quota Guardrails',
          detail: this.summary.enforcedQuotaCount
            ? 'Pool quota enforcement is active and will block template deployments that exceed configured envelopes.'
            : 'No pool quotas are currently enforced; deployments only depend on live infrastructure state.',
          status: this.summary.enforcedQuotaCount ? 'success' : 'warning',
        },
      ];
    },
  },
  async mounted() {
    if (!store.authenticated) {
      this.$router.push('/login');
      return;
    }
    await this.loadGovernance();
  },
  methods: {
    formatDateTime,
    formatRole(value) {
      if (value === 'read-only') return 'Read Only';
      if (value === 'operator') return 'Operator';
      return 'Admin';
    },
    roleBadgeClass(value) {
      if (value === 'admin') return 'badge-info';
      if (value === 'operator') return 'badge-success';
      return 'badge-warning';
    },
    isCurrentSessionUser(user) {
      return String(user?.id || '') === String(store.user?.id || '');
    },
    mapApprovalStatus(value) {
      if (value === 'approved' || value === 'used') return 'success';
      if (value === 'rejected' || value === 'expired') return 'warning';
      return 'pending';
    },
    formatApprovalAction(value) {
      return String(value || 'approval')
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (char) => char.toUpperCase());
    },
    async loadGovernance() {
      this.loading = true;
      try {
        const [result, usersResult] = await Promise.all([
          api.getGovernance(),
          this.canManageUsers
            ? api.getUsers().catch((error) => {
              this.userError = error.message || 'Unable to load local users';
              return null;
            })
            : Promise.resolve(null),
        ]);

        this.summary = result.summary || this.summary;
        this.policy = result.policy || this.policy;
        this.approvals = result.approvals || [];
        this.quotaRows = result.quotaRows || [];
        this.userSummary = result.userSummary || this.userSummary;
        this.users = usersResult?.data || (this.canManageUsers ? this.users : []);

        store.governance = {
          currentRole: result.currentRole || store.governance.currentRole,
          policy: result.policy || store.governance.policy,
        };
      } catch (error) {
        console.error(error);
      } finally {
        this.loading = false;
      }
    },
    async switchRole(role) {
      if (store.governance.currentRole === role) return;
      this.policyError = '';
      try {
        const result = await api.setGovernanceRole(role);
        store.governance = {
          ...store.governance,
          currentRole: result.role || role,
          policy: this.policy,
        };
        await this.loadGovernance();
      } catch (error) {
        this.policyError = error.code === 'ROLE_ESCALATION_NOT_ALLOWED'
          ? 'This session cannot elevate beyond the account role assigned to the current operator.'
          : (error.message || 'Unable to switch governance role');
      }
    },
    async savePolicy(payload) {
      if (store.governance.currentRole !== 'admin') {
        this.policyError = 'Switch back to an admin session role before changing governance policy.';
        return;
      }
      this.policySaving = true;
      this.policyError = '';
      try {
        const result = await api.saveGovernancePolicy(payload);
        this.policy = result;
        store.governance = {
          ...store.governance,
          policy: result,
        };
        await this.loadGovernance();
      } catch (error) {
        this.policyError = error.message || 'Unable to save governance policy';
      } finally {
        this.policySaving = false;
      }
    },
    openQuotaEditor(row) {
      this.selectedQuotaRow = row;
      this.quotaError = '';
      this.showQuotaEditor = true;
    },
    closeQuotaEditor() {
      this.showQuotaEditor = false;
      this.selectedQuotaRow = null;
      this.quotaError = '';
    },
    async saveQuota(payload) {
      if (!this.selectedQuotaRow) return;
      if (store.governance.currentRole !== 'admin') {
        this.quotaError = 'Switch back to an admin session role before changing pool quota policy.';
        return;
      }
      this.quotaSaving = true;
      this.quotaError = '';
      try {
        await api.saveGovernanceQuota(this.selectedQuotaRow.poolRef, payload);
        await this.loadGovernance();
        this.closeQuotaEditor();
      } catch (error) {
        this.quotaError = error.message || 'Unable to save pool quota';
      } finally {
        this.quotaSaving = false;
      }
    },
    async deleteQuota(row) {
      if (!row?.poolRef) return;
      if (store.governance.currentRole !== 'admin') {
        this.quotaError = 'Switch back to an admin session role before removing pool quota policy.';
        return;
      }
      this.quotaSaving = true;
      this.quotaError = '';
      try {
        await api.deleteGovernanceQuota(row.poolRef);
        await this.loadGovernance();
        this.closeQuotaEditor();
      } catch (error) {
        this.quotaError = error.message || 'Unable to remove pool quota';
      } finally {
        this.quotaSaving = false;
      }
    },
    openApprovalComposer() {
      this.approvalError = '';
      this.showApprovalComposer = true;
    },
    closeApprovalComposer() {
      this.showApprovalComposer = false;
      this.approvalError = '';
    },
    openUserComposer() {
      this.userError = '';
      this.showUserComposer = true;
    },
    closeUserComposer() {
      this.showUserComposer = false;
      this.userError = '';
    },
    openUserEditor(user) {
      this.selectedUser = user;
      this.userError = '';
      this.showUserEditor = true;
    },
    closeUserEditor() {
      this.showUserEditor = false;
      this.selectedUser = null;
      this.userError = '';
    },
    openPasswordReset(user) {
      this.selectedUser = user;
      this.passwordError = '';
      this.showPasswordReset = true;
    },
    closePasswordReset() {
      this.showPasswordReset = false;
      this.passwordError = '';
    },
    async saveNewUser(payload) {
      this.userSaving = true;
      this.userError = '';
      try {
        await api.createUser(payload);
        await this.loadGovernance();
        this.closeUserComposer();
      } catch (error) {
        this.userError = error.message || 'Unable to create local user';
      } finally {
        this.userSaving = false;
      }
    },
    async saveExistingUser(payload) {
      if (!this.selectedUser) return;
      this.userSaving = true;
      this.userError = '';
      try {
        const result = await api.updateUser(this.selectedUser.id, payload);
        if (this.isCurrentSessionUser(result)) {
          store.user = {
            ...store.user,
            username: result.username,
            displayName: result.display_name || result.username,
            role: result.role,
          };
          store.username = result.username;
        }
        await this.loadGovernance();
        this.selectedUser = this.users.find((entry) => Number(entry.id) === Number(result.id)) || result;
      } catch (error) {
        this.userError = error.message || 'Unable to update local user';
      } finally {
        this.userSaving = false;
      }
    },
    async submitPasswordReset(payload) {
      if (!this.selectedUser) return;
      this.passwordSaving = true;
      this.passwordError = '';
      try {
        await api.resetUserPassword(this.selectedUser.id, payload);
        await this.loadGovernance();
        this.closePasswordReset();
      } catch (error) {
        this.passwordError = error.message || 'Unable to rotate the local password';
      } finally {
        this.passwordSaving = false;
      }
    },
    async saveApprovalRequest(payload) {
      this.approvalSaving = true;
      this.approvalError = '';
      try {
        await api.requestGovernanceApproval(payload);
        await this.loadGovernance();
        this.closeApprovalComposer();
      } catch (error) {
        this.approvalError = error.message || 'Unable to submit approval request';
      } finally {
        this.approvalSaving = false;
      }
    },
    async decideApproval(approval, decision) {
      if (store.governance.currentRole !== 'admin') {
        this.approvalError = 'Switch back to an admin session role before deciding approvals.';
        return;
      }
      this.decidingApprovalId = approval.id;
      try {
        await api.decideGovernanceApproval(approval.id, { decision, notes: '' });
        await this.loadGovernance();
      } catch (error) {
        this.approvalError = error.message || 'Unable to update approval status';
      } finally {
        this.decidingApprovalId = '';
      }
    },
  },
};
