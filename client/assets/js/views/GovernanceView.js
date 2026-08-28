const GovernanceView = {
  components: {
    FloatingWindow,
    StatusBadge,
    'governance-policy-form': GovernancePolicyForm,
    'governance-quota-form': GovernanceQuotaForm,
    'governance-approval-form': GovernanceApprovalForm,
    'local-user-form': LocalUserForm,
    'local-group-form': LocalGroupForm,
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
            <button class="btn"
                    v-if="canManageUsers"
                    @click="openGroupComposer()">
              <span class="mdi mdi-account-group-outline"></span>
              Add Group
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
            <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap">
              <div class="dash-card-label">Local Groups</div>
              <button class="btn btn-sm"
                      v-if="canManageUsers"
                      @click="openGroupComposer()">
                <span class="mdi mdi-account-group-outline"></span>
                New Group
              </button>
            </div>
            <div class="stack-list" v-if="groups.length">
              <button class="stack-item stack-item-button"
                      v-for="group in groups"
                      :key="group.id"
                      @click="openGroupEditor(group)">
                <div>
                  <strong>{{ group.name }}</strong>
                  <div class="text-muted mono" style="font-size:11px">
                    {{ group.member_count || 0 }} {{ (group.member_count || 0) === 1 ? 'member' : 'members' }}
                  </div>
                  <div class="text-muted" style="font-size:12px;margin-top:6px">
                    {{ group.members?.length ? group.members.join(', ') : 'No members assigned yet' }}
                  </div>
                </div>
                <span class="badge badge-info">{{ group.member_count || 0 }}</span>
              </button>
            </div>
            <div v-else class="empty-state" style="padding:20px 12px">
              <p v-if="canManageUsers">Create local groups to organize operators into reusable access cohorts.</p>
              <p v-else>Switch into a local admin session to inspect and manage control-plane groups.</p>
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
            :initial-value="approvalDraft"
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
            :group-options="groups"
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
              :group-options="groups"
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

        <floating-window :show="showGroupComposer"
                         title="Create Local Group"
                         :width="720"
                         :height="520"
                         @close="closeGroupComposer">
          <div class="detail-section" v-if="groupError">
            <div class="capacity-callout">
              <strong>{{ groupError }}</strong>
            </div>
          </div>
          <local-group-form
            :saving="groupSaving"
            submit-label="Create Group"
            :user-options="users"
            @submit="saveNewGroup">
          </local-group-form>
        </floating-window>

        <floating-window :show="showGroupEditor"
                         title="Edit Local Group"
                         :width="760"
                         :height="560"
                         @close="closeGroupEditor">
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
              @submit="saveExistingGroup">
            </local-group-form>

            <div class="form-actions" style="margin-top:12px">
              <button class="btn" @click="removeGroup(selectedGroup)" :disabled="groupSaving">Remove Group</button>
            </div>
          </div>
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
      groupSaving: false,
      passwordSaving: false,
      decidingApprovalId: '',
      policyError: '',
      quotaError: '',
      approvalError: '',
      userError: '',
      groupError: '',
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
        totalGroups: 0,
      },
      policy: {
        defaultRole: 'admin',
        requireDestructiveApproval: true,
        approvalTtlMinutes: 240,
      },
      approvals: [],
      quotaRows: [],
      users: [],
      groups: [],
      approvalDraft: null,
      showQuotaEditor: false,
      showApprovalComposer: false,
      showUserComposer: false,
      showUserEditor: false,
      showGroupComposer: false,
      showGroupEditor: false,
      showPasswordReset: false,
      selectedQuotaRow: null,
      selectedUser: null,
      selectedGroup: null,
    };
  },
  setup() {
    return { store };
  },
  computed: {
    roles() {
      return buildGovernanceRoles();
    },
    canManageUsers() {
      return canManageGovernanceUsers(store.authMode, store.governance.currentRole);
    },
    summaryCards() {
      return buildGovernanceSummaryCards({
        summary: this.summary,
        policy: this.policy,
        userSummary: this.userSummary,
        groups: this.groups,
        currentRole: store.governance.currentRole,
      });
    },
    accessCoverageRows() {
      return buildGovernanceAccessCoverageRows(this.users, this.groups, this.userSummary);
    },
    roleGuidance() {
      return buildGovernanceRoleGuidance(store.governance.currentRole, this.policy, this.summary);
    },
  },
  async mounted() {
    if (!store.authenticated) {
      this.$router.push('/login');
      return;
    }
    await this.loadGovernance();
    this.consumePendingApprovalDraft();
  },
  methods: {
    formatDateTime,
    formatRole: formatGovernanceRole,
    roleBadgeClass: getGovernanceRoleBadgeClass,
    isCurrentSessionUser(user) {
      return isCurrentGovernanceSessionUser(user, store.user);
    },
    mapApprovalStatus: mapGovernanceApprovalStatus,
    formatApprovalAction: formatGovernanceApprovalAction,
    async loadGovernance() {
      this.loading = true;
      try {
        const [result, usersResult, groupsResult] = await Promise.all([
          api.getGovernance(),
          this.canManageUsers
            ? api.getUsers().catch((error) => {
              this.userError = error.message || 'Unable to load local users';
              return null;
            })
            : Promise.resolve(null),
          this.canManageUsers
            ? api.getGroups().catch((error) => {
              this.groupError = error.message || 'Unable to load local groups';
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
        this.groups = groupsResult?.data || (this.canManageUsers ? this.groups : []);

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
    consumePendingApprovalDraft() {
      const pendingDraft = readPendingGovernanceApprovalDraft();
      const shouldCompose = String(this.$route.query.composeApproval || '') === '1';
      const handoffMessage = String(this.$route.query.message || '').trim();

      if (!pendingDraft && !shouldCompose) return;

      const approvalMessage = handoffMessage
        || (pendingDraft?.actionKey
          ? 'Governance approval is required before the requested destructive action can continue.'
          : '');

      this.openApprovalComposer(pendingDraft, approvalMessage);
      clearPendingGovernanceApprovalDraft();

      if (shouldCompose || handoffMessage) {
        this.$router.replace('/governance');
      }
    },
    openApprovalComposer(draft = null, message = '') {
      this.approvalError = message || '';
      this.approvalDraft = normalizeGovernanceApprovalDraft(draft || {});
      this.showApprovalComposer = true;
    },
    closeApprovalComposer() {
      this.showApprovalComposer = false;
      this.approvalError = '';
      this.approvalDraft = null;
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
    openGroupComposer() {
      this.groupError = '';
      this.showGroupComposer = true;
    },
    closeGroupComposer() {
      this.showGroupComposer = false;
      this.groupError = '';
    },
    openGroupEditor(group) {
      this.selectedGroup = group;
      this.groupError = '';
      this.showGroupEditor = true;
    },
    closeGroupEditor() {
      this.showGroupEditor = false;
      this.selectedGroup = null;
      this.groupError = '';
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
    async saveNewGroup(payload) {
      this.groupSaving = true;
      this.groupError = '';
      try {
        await api.createGroup(payload);
        await this.loadGovernance();
        this.closeGroupComposer();
      } catch (error) {
        this.groupError = error.message || 'Unable to create local group';
      } finally {
        this.groupSaving = false;
      }
    },
    async saveExistingGroup(payload) {
      if (!this.selectedGroup) return;
      this.groupSaving = true;
      this.groupError = '';
      try {
        const result = await api.updateGroup(this.selectedGroup.id, payload);
        await this.loadGovernance();
        this.selectedGroup = this.groups.find((entry) => Number(entry.id) === Number(result.id)) || result;
      } catch (error) {
        this.groupError = error.message || 'Unable to update local group';
      } finally {
        this.groupSaving = false;
      }
    },
    async removeGroup(group) {
      if (!group?.id) return;
      this.groupSaving = true;
      this.groupError = '';
      try {
        await api.deleteGroup(group.id);
        await this.loadGovernance();
        this.closeGroupEditor();
      } catch (error) {
        this.groupError = error.message || 'Unable to remove local group';
      } finally {
        this.groupSaving = false;
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
