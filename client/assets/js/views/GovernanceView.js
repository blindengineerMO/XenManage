const GovernanceView = {
  components: {
    StatusBadge,
    'governance-policy-form': GovernancePolicyForm,
    GovernanceWorkspaceDialogs,
    GovernanceControlPanel,
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
            <p class="section-subtitle text-cyan" v-if="store.vFabricScope?.scope">Read scope: {{ store.vFabricScope.scope.name }} · {{ store.vFabricScope.attachedTargets.length }} attached member{{ store.vFabricScope.attachedTargets.length === 1 ? '' : 's' }} · quota posture is aggregated; control-plane changes are disabled</p>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn"
                    v-if="canManageUsers && !isVFabricScopeReadOnly"
                    @click="openUserComposer()">
              <span class="mdi mdi-account-plus-outline"></span>
              Add User
            </button>
            <button class="btn"
                    v-if="canManageUsers && !isVFabricScopeReadOnly"
                    @click="openGroupComposer()">
              <span class="mdi mdi-account-group-outline"></span>
              Add Group
            </button>
            <button v-if="!isVFabricScopeReadOnly" class="btn" @click="openApprovalComposer()">
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
          <div class="dash-card" v-if="vFabricQuotaEvaluation">
            <div class="dash-card-label">vFabric Quota</div>
            <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start">
              <div>
                <strong>{{ vFabricQuotaEvaluation.vFabricName }}</strong>
                <div class="text-muted mono" style="font-size:11px;margin-top:5px">{{ vFabricQuotaEvaluation.usage.vmCount }} VMs · {{ vFabricQuotaEvaluation.usage.runningVmCount }} running · {{ vFabricQuotaEvaluation.usage.totalMemoryGiB }} GiB</div>
                <div class="text-muted" style="font-size:12px;margin-top:7px">{{ vFabricQuotaEvaluation.detail }}</div>
              </div>
              <status-badge :status="vFabricQuotaEvaluation.status"></status-badge>
            </div>
          </div>
          <div class="dash-card">
            <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap">
              <div class="dash-card-label">Local Users</div>
              <button class="btn btn-sm"
                      v-if="canManageUsers && !isVFabricScopeReadOnly"
                      @click="openUserComposer()">
                <span class="mdi mdi-account-plus-outline"></span>
                New User
              </button>
            </div>
            <div class="stack-list" v-if="users.length">
              <button class="stack-item stack-item-button"
                      v-for="user in users"
                      :key="user.id"
                      @click="!isVFabricScopeReadOnly && openUserEditor(user)">
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
                      v-if="canManageUsers && !isVFabricScopeReadOnly"
                      @click="openGroupComposer()">
                <span class="mdi mdi-account-group-outline"></span>
                New Group
              </button>
            </div>
            <div class="stack-list" v-if="groups.length">
              <button class="stack-item stack-item-button"
                      v-for="group in groups"
                      :key="group.id"
                      @click="!isVFabricScopeReadOnly && openGroupEditor(group)">
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
            <div class="stack-list" v-if="!isVFabricScopeReadOnly">
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

              <div class="stack-item" v-if="breakGlass.active" style="align-items:flex-start">
                <div>
                  <strong class="text-red">Break-glass elevation active</strong>
                  <div class="text-muted mono" style="font-size:11px">Expires {{ formatDateTime(breakGlass.expiresAt) }} · activated by {{ breakGlass.activatedBy }}</div>
                  <div class="text-muted" style="font-size:12px;margin-top:6px">{{ breakGlass.justification }}</div>
                </div>
                <button class="btn btn-sm" @click="deactivateBreakGlass" :disabled="breakGlassSaving">End Now</button>
              </div>

              <div class="stack-item" v-else-if="!showBreakGlassForm">
                <div>
                  <strong>Emergency access</strong>
                  <div class="text-muted" style="font-size:12px">Elevate to admin for 30 minutes with a recorded justification.</div>
                </div>
                <button class="btn btn-sm" @click="openBreakGlassForm">Break Glass</button>
              </div>

              <div class="stack-item" v-else style="flex-direction:column;align-items:stretch;gap:8px">
                <div class="form-group" style="margin:0">
                  <label for="break-glass-justification">Justification (min 10 characters)</label>
                  <textarea id="break-glass-justification" class="form-input" rows="2" v-model="breakGlassJustification" placeholder="Why does this session need emergency admin access?"></textarea>
                </div>
                <div class="form-group" style="margin:0" v-if="accountHasMfa">
                  <label for="break-glass-mfa">MFA Token</label>
                  <input id="break-glass-mfa" class="form-input" v-model="breakGlassMfaToken" placeholder="6-digit code">
                </div>
                <p class="text-red" style="margin:0;font-size:12px" v-if="breakGlassError">{{ breakGlassError }}</p>
                <div style="display:flex;gap:8px">
                  <button class="btn btn-sm btn-primary" @click="activateBreakGlass" :disabled="breakGlassSaving">
                    {{ breakGlassSaving ? 'Activating...' : 'Activate' }}
                  </button>
                  <button class="btn btn-sm" @click="closeBreakGlassForm" :disabled="breakGlassSaving">Cancel</button>
                </div>
              </div>
            </div>
            <div v-else class="empty-state" style="padding:20px 12px">
              Session-role changes are unavailable while reviewing an aggregated vFabric scope.
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
            <p class="text-muted">Manage default session scope and destructive-action approval requirements in the unified governance panel.</p>
            <button v-if="!isVFabricScopeReadOnly" class="btn" @click="openGovernancePanel('policy')"><span class="mdi mdi-shield-cog-outline"></span>Manage Policy</button>
            <p v-else class="text-muted">Policy, approvals, users, and groups remain control-plane-wide. Select one target to change them.</p>
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
                      :key="row.scopeRowKey || row.poolRef"
                      @click="!isVFabricScopeReadOnly && openQuotaEditor(row)">
                <div>
                  <strong>{{ row.poolName }}</strong>
                  <div class="text-muted mono" style="font-size:11px">
                    {{ row.currentVmCount }} VMs · {{ row.currentRunningVmCount }} running · {{ row.currentTotalMemoryGiB }} GiB
                    <span v-if="row.scopeTargetLabel"> · {{ row.scopeTargetLabel }}</span>
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
                          v-if="approval.status === 'pending' && !isVFabricScopeReadOnly"
                          :disabled="store.governance.currentRole !== 'admin' || decidingApprovalId === approval.id"
                          @click="decideApproval(approval, 'approved')">
                    Approve
                  </button>
                  <button class="btn btn-sm"
                          v-if="approval.status === 'pending' && !isVFabricScopeReadOnly"
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
              <div class="stack-item" v-for="row in quotaRows.slice(0, 6)" :key="row.scopeRowKey || row.poolRef">
                <div>
                  <strong>{{ row.poolName }}</strong>
                  <div class="text-muted mono" style="font-size:11px">
                    {{ row.quota?.enabled ? 'Quota enforced' : 'No quota enforced' }} · {{ row.quota?.owner || 'No owner' }}
                    <span v-if="row.scopeTargetLabel"> · {{ row.scopeTargetLabel }}</span>
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

        <governance-workspace-dialogs
          :show-quota-editor="false"
          :selected-quota-row="selectedQuotaRow"
          :quota-error="quotaError"
          :quota-saving="quotaSaving"
          :show-approval-composer="false"
          :approval-error="approvalError"
          :approval-draft="approvalDraft"
          :approval-saving="approvalSaving"
          :show-user-composer="false"
          :user-error="userError"
          :user-saving="userSaving"
          :groups="groups"
          :show-user-editor="false"
          :selected-user="selectedUser"
          :selected-user-is-current-session="selectedUserIsCurrentSession"
          :password-saving="passwordSaving"
          :show-password-reset="false"
          :password-error="passwordError"
          :show-group-composer="false"
          :group-error="groupError"
          :group-saving="groupSaving"
          :users="users"
          :show-group-editor="false"
          :selected-group="selectedGroup"
          @close-quota-editor="closeQuotaEditor"
          @save-quota="saveQuota"
          @delete-quota="deleteQuota"
          @close-approval-composer="closeApprovalComposer"
          @save-approval-request="saveApprovalRequest"
          @close-user-composer="closeUserComposer"
          @save-new-user="saveNewUser"
          @close-user-editor="closeUserEditor"
          @save-existing-user="saveExistingUser"
          @open-password-reset="openPasswordReset"
          @close-password-reset="closePasswordReset"
          @submit-password-reset="submitPasswordReset"
          @close-group-composer="closeGroupComposer"
          @save-new-group="saveNewGroup"
          @close-group-editor="closeGroupEditor"
          @save-existing-group="saveExistingGroup"
          @remove-group="removeGroup">
        </governance-workspace-dialogs>

        <governance-control-panel
          :show="showGovernancePanel"
          :active-tab="governancePanelTab"
          :policy="policy" :policy-saving="policySaving" :policy-error="policyError"
          :quota-rows="quotaRows" :selected-quota-row="selectedQuotaRow" :quota-saving="quotaSaving" :quota-error="quotaError"
          :approvals="approvals" :approval-draft="approvalDraft" :approval-saving="approvalSaving" :approval-error="approvalError" :deciding-approval-id="decidingApprovalId"
          :can-manage-users="canManageUsers" :users="users" :groups="groups" :selected-user="selectedUser" :show-user-composer="showUserComposer" :user-saving="userSaving" :user-error="userError" :show-password-reset="showPasswordReset" :password-saving="passwordSaving" :password-error="passwordError"
          :selected-group="selectedGroup" :show-group-composer="showGroupComposer" :group-saving="groupSaving" :group-error="groupError"
          @close="closeGovernancePanel" @select-tab="selectGovernancePanelTab" @save-policy="savePolicy"
          @select-quota="openQuotaEditor" @save-quota="saveQuota" @delete-quota="deleteQuota"
          @save-approval="saveApprovalRequest" @decide-approval="decideApproval"
          @new-user="openUserComposer" @select-user="openUserEditor" @save-user="showUserComposer ? saveNewUser($event) : saveExistingUser($event)" @open-password-reset="openPasswordReset" @save-password="submitPasswordReset"
          @new-group="openGroupComposer" @select-group="openGroupEditor" @save-group="showGroupComposer ? saveNewGroup($event) : saveExistingGroup($event)" @remove-group="removeGroup">
        </governance-control-panel>
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
      showBreakGlassForm: false,
      breakGlassJustification: '',
      breakGlassMfaToken: '',
      breakGlassSaving: false,
      breakGlassError: '',
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
      vFabricQuotaEvaluation: null,
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
      showGovernancePanel: false,
      governancePanelTab: 'policy',
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
    selectedUserIsCurrentSession() {
      return this.selectedUser ? this.isCurrentSessionUser(this.selectedUser) : false;
    },
    isVFabricScopeReadOnly() {
      return hasVFabricScope();
    },
    breakGlass() {
      return store.governance.breakGlass || { active: false };
    },
    accountHasMfa() {
      return Boolean(store.user?.mfaEnabled);
    },
  },
  async mounted() {
    if (!store.authenticated) {
      this.$router.push('/login');
      return;
    }
    await this.loadGovernance();
    this.consumePendingApprovalDraft();
    this.$watch(() => store.vFabricScope?.scope?.id || '', () => {
      if (hasVFabricScope()) this.closeGovernancePanel();
      this.loadGovernance();
    });
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
        const [governanceResults, usersResult, groupsResult, vFabricQuotaEvaluation] = await Promise.all([
          this.loadGovernanceAcrossScope(),
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
          hasVFabricScope()
            ? api.getVFabricQuota(store.vFabricScope.scope.id).catch(() => null)
            : Promise.resolve(null),
        ]);

        const result = governanceResults[0] || {};
        this.summary = mergeGovernanceScopeSummaries(governanceResults, this.summary);
        this.policy = result.policy || this.policy;
        this.approvals = result.approvals || [];
        this.quotaRows = mergeGovernanceScopeQuotaRows(governanceResults);
        this.vFabricQuotaEvaluation = vFabricQuotaEvaluation;
        this.userSummary = result.userSummary || this.userSummary;
        this.users = usersResult?.data || (this.canManageUsers ? this.users : []);
        this.groups = groupsResult?.data || (this.canManageUsers ? this.groups : []);

        store.governance = {
          currentRole: result.currentRole || store.governance.currentRole,
          policy: result.policy || store.governance.policy,
          breakGlass: result.breakGlass || { active: false },
        };
      } catch (error) {
        console.error(error);
      } finally {
        this.loading = false;
      }
    },
    async switchRole(role) {
      if (hasVFabricScope()) return;
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
    openBreakGlassForm() {
      this.breakGlassJustification = '';
      this.breakGlassMfaToken = '';
      this.breakGlassError = '';
      this.showBreakGlassForm = true;
    },
    closeBreakGlassForm() {
      this.showBreakGlassForm = false;
      this.breakGlassError = '';
    },
    async activateBreakGlass() {
      if (this.breakGlassJustification.trim().length < 10) {
        this.breakGlassError = 'Justification must be at least 10 characters.';
        return;
      }
      this.breakGlassSaving = true;
      this.breakGlassError = '';
      try {
        const state = await api.activateBreakGlass({
          justification: this.breakGlassJustification.trim(),
          mfaToken: this.breakGlassMfaToken.trim(),
        });
        store.governance = { ...store.governance, currentRole: 'admin', breakGlass: state };
        this.showBreakGlassForm = false;
        await this.loadGovernance();
      } catch (error) {
        this.breakGlassError = error.code === 'MFA_REQUIRED'
          ? 'A valid MFA token is required to activate emergency access.'
          : (error.message || 'Unable to activate break-glass elevation');
      } finally {
        this.breakGlassSaving = false;
      }
    },
    async deactivateBreakGlass() {
      this.breakGlassSaving = true;
      try {
        const state = await api.deactivateBreakGlass();
        store.governance = { ...store.governance, breakGlass: state };
        await this.loadGovernance();
      } catch (error) {
        this.breakGlassError = error.message || 'Unable to end break-glass elevation';
      } finally {
        this.breakGlassSaving = false;
      }
    },
    async savePolicy(payload) {
      if (hasVFabricScope()) return;
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
    openGovernancePanel(tab = 'policy') {
      if (hasVFabricScope()) return;
      this.governancePanelTab = tab;
      this.showGovernancePanel = true;
    },
    closeGovernancePanel() {
      this.showGovernancePanel = false;
      this.showQuotaEditor = false;
      this.showApprovalComposer = false;
      this.showUserComposer = false;
      this.showUserEditor = false;
      this.showGroupComposer = false;
      this.showGroupEditor = false;
      this.showPasswordReset = false;
    },
    selectGovernancePanelTab(tab) {
      this.governancePanelTab = tab;
      this.showQuotaEditor = false;
      this.showApprovalComposer = false;
      this.showUserComposer = false;
      this.showGroupComposer = false;
      this.showPasswordReset = false;
    },
    openQuotaEditor(row) {
      if (hasVFabricScope()) return;
      this.selectedQuotaRow = row;
      this.quotaError = '';
      this.showGovernancePanel = true;
      this.governancePanelTab = 'quotas';
    },
    closeQuotaEditor() {
      this.showQuotaEditor = false;
      this.selectedQuotaRow = null;
      this.quotaError = '';
    },
    async saveQuota(payload) {
      if (hasVFabricScope()) return;
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
      if (hasVFabricScope()) return;
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
      if (hasVFabricScope()) return;
      this.approvalError = message || '';
      this.approvalDraft = normalizeGovernanceApprovalDraft(draft || {});
      this.showApprovalComposer = true;
      this.showGovernancePanel = true;
      this.governancePanelTab = 'approvals';
    },
    closeApprovalComposer() {
      this.showApprovalComposer = false;
      this.approvalError = '';
      this.approvalDraft = null;
    },
    openUserComposer() {
      if (hasVFabricScope()) return;
      this.userError = '';
      this.showUserComposer = true;
      this.selectedUser = null;
      this.showGovernancePanel = true;
      this.governancePanelTab = 'users';
    },
    closeUserComposer() {
      this.showUserComposer = false;
      this.userError = '';
    },
    openUserEditor(user) {
      if (hasVFabricScope()) return;
      this.selectedUser = user;
      this.userError = '';
      this.showUserEditor = true;
      this.showUserComposer = false;
      this.showGovernancePanel = true;
      this.governancePanelTab = 'users';
    },
    closeUserEditor() {
      this.showUserEditor = false;
      this.selectedUser = null;
      this.userError = '';
    },
    openGroupComposer() {
      if (hasVFabricScope()) return;
      this.groupError = '';
      this.showGroupComposer = true;
      this.selectedGroup = null;
      this.showGovernancePanel = true;
      this.governancePanelTab = 'groups';
    },
    closeGroupComposer() {
      this.showGroupComposer = false;
      this.groupError = '';
    },
    openGroupEditor(group) {
      if (hasVFabricScope()) return;
      this.selectedGroup = group;
      this.groupError = '';
      this.showGroupEditor = true;
      this.showGroupComposer = false;
      this.showGovernancePanel = true;
      this.governancePanelTab = 'groups';
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
      this.showGovernancePanel = true;
      this.governancePanelTab = 'users';
    },
    closePasswordReset() {
      this.showPasswordReset = false;
      this.passwordError = '';
    },
    async saveNewUser(payload) {
      if (hasVFabricScope()) return;
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
      if (hasVFabricScope()) return;
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
      if (hasVFabricScope()) return;
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
      if (hasVFabricScope()) return;
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
      if (hasVFabricScope()) return;
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
      if (hasVFabricScope()) return;
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
      if (hasVFabricScope()) return;
      this.approvalSaving = true;
      this.approvalError = '';
      try {
        await api.requestGovernanceApproval(payload);
        await this.loadGovernance();
        // A completed approval request is a terminal composer action; return
        // the operator to the workspace instead of leaving a blank panel on top.
        this.closeGovernancePanel();
      } catch (error) {
        this.approvalError = error.message || 'Unable to submit approval request';
      } finally {
        this.approvalSaving = false;
      }
    },
    async decideApproval(approval, decision) {
      if (this.isVFabricScopeReadOnly) return;
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
    async loadGovernanceAcrossScope() {
      const targets = getVFabricScopeTargets();
      if (!targets.length) return [await api.getGovernance()];
      return Promise.all(targets.map(async (target) => ({
        ...(await api.getGovernance(target.targetKey)),
        scopeTargetKey: target.targetKey,
        scopeTargetLabel: target.connectionName || target.host || target.targetKey,
      })));
    },
  },
};

function mergeGovernanceScopeSummaries(results = [], fallback = {}) {
  const first = results[0]?.summary || fallback;
  return results.reduce((summary, result) => ({
    ...summary,
    poolCount: Number(summary.poolCount || 0) + Number(result?.summary?.poolCount || 0),
    enforcedQuotaCount: Number(summary.enforcedQuotaCount || 0) + Number(result?.summary?.enforcedQuotaCount || 0),
  }), {
    ...first,
    poolCount: 0,
    enforcedQuotaCount: 0,
  });
}

function mergeGovernanceScopeQuotaRows(results = []) {
  return results.flatMap((result) => (result?.quotaRows || []).map((row) => ({
    ...row,
    scopeTargetKey: result.scopeTargetKey || '',
    scopeTargetLabel: result.scopeTargetLabel || '',
    scopeRowKey: result.scopeTargetKey ? `${result.scopeTargetKey}::${row.poolRef}` : row.poolRef,
  })));
}
