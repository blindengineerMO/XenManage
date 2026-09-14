const ProjectsView = {
  components: {
    FloatingWindow,
    ConfirmWindow,
  },
  template: `
    <div class="animate-fade-in vfabrics-view">
      <div class="section-head">
        <div>
          <h2 class="section-title"><span class="mdi mdi-domain"></span> Organizations & Projects</h2>
          <p class="section-subtitle">Group pools into organizations and projects, bind pool access, and enforce per-project VM/vCPU/memory/storage/GPU/network quotas.</p>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-sm" :disabled="loading" @click="loadWorkspace"><span class="mdi mdi-refresh"></span> Refresh</button>
          <button class="btn btn-sm" @click="openCreateOrganization"><span class="mdi mdi-domain-plus"></span> New Organization</button>
          <button class="btn btn-primary" :disabled="!organizations.length" @click="openCreateProject(null)"><span class="mdi mdi-folder-plus-outline"></span> New Project</button>
        </div>
      </div>

      <div v-if="error" class="form-error" style="text-align:left;margin-bottom:14px">{{ error }}</div>
      <div v-if="loading" class="empty-state"><span class="loading-spinner"></span><p style="margin-top:12px">Loading organizations and projects...</p></div>

      <template v-else>
        <div class="vfabric-summary-grid">
          <div class="dash-card"><div class="dash-card-label">Organizations</div><div class="dash-card-value">{{ organizations.length }}</div><div class="dash-card-icon mdi mdi-domain"></div></div>
          <div class="dash-card"><div class="dash-card-label">Projects</div><div class="dash-card-value">{{ projects.length }}</div><div class="dash-card-icon mdi mdi-folder-outline"></div></div>
          <div class="dash-card"><div class="dash-card-label">Pools In Scope</div><div class="dash-card-value">{{ scopedPoolCount }}</div><div class="dash-card-icon mdi mdi-source-branch"></div></div>
        </div>

        <div v-if="!organizations.length" class="empty-state vfabric-empty-state">
          <span class="mdi mdi-domain"></span>
          <h3>No organizations yet</h3>
          <p>Create an organization, then a project underneath it to bind pool access and quotas.</p>
          <button class="btn btn-primary" @click="openCreateOrganization"><span class="mdi mdi-plus"></span> New Organization</button>
        </div>

        <div v-else v-for="org in organizations" :key="org.id" class="detail-section" style="margin-bottom:22px">
          <div class="section-head" style="margin-bottom:10px">
            <div class="detail-title"><span class="mdi mdi-domain"></span> {{ org.name }}<span class="text-muted" style="font-weight:400;font-size:12px;margin-left:8px">{{ org.description }}</span></div>
            <div style="display:flex;gap:8px">
              <button class="btn btn-sm" @click="openCreateProject(org)"><span class="mdi mdi-folder-plus-outline"></span> New Project</button>
              <button class="btn btn-sm btn-danger" :disabled="projectsForOrg(org.id).length > 0" :title="projectsForOrg(org.id).length ? 'Remove all projects before deleting an organization' : ''" @click="orgPendingDelete = org"><span class="mdi mdi-delete-outline"></span> Delete</button>
            </div>
          </div>

          <div v-if="!projectsForOrg(org.id).length" class="vfabric-selector-empty">No projects in this organization yet.</div>

          <div v-else class="vfabric-card-grid">
            <article v-for="project in projectsForOrg(org.id)" :key="project.id" class="vfabric-card" :class="project.enabled ? 'vfabric-card-green' : 'vfabric-card-red'">
              <div class="vfabric-card-head">
                <div>
                  <div class="dash-card-label">{{ project.enabled ? 'active' : 'disabled' }} project</div>
                  <h3>{{ project.name }}</h3>
                </div>
                <span class="badge badge-info">{{ project.target_ids.length }} pools</span>
              </div>
              <p class="vfabric-card-description">{{ project.description || 'No operator description supplied.' }}</p>
              <div class="vfabric-members" aria-label="Project pool access">
                <span v-for="targetId in project.target_ids" :key="targetId" class="vfabric-member-pill">
                  <span class="mdi mdi-source-branch"></span>{{ managedTargetName(targetId) }}
                </span>
                <span v-if="!project.target_ids.length" class="text-muted mono">No pool access bound</span>
              </div>
              <div class="vfabric-members" aria-label="Project network access" style="margin-top:6px">
                <span v-for="ref in project.network_refs" :key="ref" class="vfabric-member-pill">
                  <span class="mdi mdi-lan"></span>{{ networkName(ref) }}
                </span>
                <span v-if="!project.network_refs.length" class="text-muted mono">No network access bound</span>
              </div>
              <div class="capacity-callout" style="margin-top:14px">
                <strong>Cost Center: {{ project.cost_center || 'Unassigned' }}</strong>
                <div class="text-muted" style="font-size:12px;margin-top:5px">Recovery tier: {{ project.default_recovery_tier || 'None' }} &middot; {{ project.members.length }} member{{ project.members.length === 1 ? '' : 's' }}</div>
                <div v-if="project.quota && project.quota.enabled" class="text-muted" style="font-size:12px;margin-top:5px">Quota enforced: {{ project.quota.max_vm_count || '∞' }} VMs &middot; {{ project.quota.max_vcpus || '∞' }} vCPUs &middot; {{ project.quota.max_memory_gib || '∞' }} GiB RAM</div>
                <div v-else class="text-muted" style="font-size:12px;margin-top:5px">No quota enforced.</div>
              </div>
              <div class="vfabric-card-footer">
                <span class="text-muted mono">Owner: {{ ownerName(project.owner_user_id) }}</span>
                <div style="display:flex;gap:8px;flex-wrap:wrap">
                  <button class="btn btn-sm" @click="openQuotaEditor(project)"><span class="mdi mdi-gauge"></span> Quota</button>
                  <button class="btn btn-sm" @click="openMembersEditor(project)"><span class="mdi mdi-account-multiple-outline"></span> Members</button>
                  <button class="btn btn-sm" @click="openCreateProject(org, project)"><span class="mdi mdi-pencil"></span> Edit</button>
                  <button class="btn btn-sm btn-danger" @click="projectPendingDelete = project"><span class="mdi mdi-delete-outline"></span> Delete</button>
                </div>
              </div>
            </article>
          </div>
        </div>
      </template>

      <floating-window :show="showOrgEditor" title="New Organization" :width="520" :height="360" @close="closeOrgEditor">
        <form class="vfabric-form" @submit.prevent="saveOrganization">
          <div class="form-group"><label for="org-name">Name</label><input id="org-name" class="form-input" v-model.trim="orgDraft.name" maxlength="120" required placeholder="Platform Engineering"></div>
          <div class="form-group"><label for="org-description">Description</label><textarea id="org-description" class="form-input vfabric-textarea" v-model="orgDraft.description" maxlength="500" placeholder="Business unit or division this organization represents"></textarea></div>
          <div v-if="orgEditorError" class="form-error" style="text-align:left">{{ orgEditorError }}</div>
          <div class="vfabric-form-actions"><button type="button" class="btn" :disabled="orgSaving" @click="closeOrgEditor">Cancel</button><button type="submit" class="btn btn-primary" :disabled="orgSaving || !orgDraft.name.trim()"><span class="mdi mdi-plus"></span>{{ orgSaving ? 'Saving...' : 'Create Organization' }}</button></div>
        </form>
      </floating-window>

      <confirm-window :show="Boolean(orgPendingDelete)" title="Delete Organization" :message="'Delete ' + (orgPendingDelete?.name || 'this organization') + '? It must have no remaining projects.'" confirm-label="Delete Organization" :danger="true" @close="orgPendingDelete = null" @confirm="deleteOrganization"></confirm-window>

      <floating-window :show="showProjectEditor" :title="editingProject ? 'Edit Project' : 'New Project'" :width="820" :height="680" @close="closeProjectEditor">
        <form class="vfabric-form" @submit.prevent="saveProject">
          <div class="vfabric-form-grid">
            <div class="form-group">
              <label for="project-org">Organization</label>
              <select id="project-org" class="form-input" v-model.number="projectDraft.organizationId" :disabled="Boolean(editingProject)" required>
                <option v-for="org in organizations" :key="org.id" :value="org.id">{{ org.name }}</option>
              </select>
            </div>
            <div class="form-group"><label for="project-name">Name</label><input id="project-name" class="form-input" v-model.trim="projectDraft.name" maxlength="120" required placeholder="Payments Platform"></div>
          </div>
          <div class="form-group"><label for="project-description">Description</label><textarea id="project-description" class="form-input vfabric-textarea" v-model="projectDraft.description" maxlength="500" placeholder="Purpose of this project"></textarea></div>
          <div class="vfabric-form-grid">
            <div class="form-group"><label for="project-cost-center">Cost Center</label><input id="project-cost-center" class="form-input" v-model.trim="projectDraft.costCenter" maxlength="120" placeholder="CC-4021"></div>
            <div class="form-group">
              <label for="project-recovery-tier">Default Recovery Tier</label>
              <select id="project-recovery-tier" class="form-input" v-model="projectDraft.defaultRecoveryTier">
                <option value="">None</option>
                <option v-for="tier in recoveryTiers" :key="tier" :value="tier">{{ tier }}</option>
              </select>
              <p class="field-help">Bound to the same recovery-tier vocabulary used by Resilience Runbooks.</p>
            </div>
          </div>
          <div class="form-group">
            <label for="project-owner">Owner</label>
            <select id="project-owner" class="form-input" v-model="projectDraft.ownerUserId">
              <option :value="null">Unassigned</option>
              <option v-for="user in users" :key="user.id" :value="user.id">{{ user.username }}</option>
            </select>
          </div>
          <label v-if="editingProject" class="form-toggle"><input type="checkbox" v-model="projectDraft.enabled"><span>Project enabled</span></label>

          <section class="detail-section vfabric-selector-section">
            <div class="detail-section-title">Pool Access</div>
            <p class="text-muted">Select the managed pools this project may create resources against. Leave empty to allow every pool.</p>
            <div class="vfabric-target-grid" v-if="managedTargets.length">
              <button v-for="target in managedTargets" :key="target.id" type="button" class="vfabric-target-option" :class="{ active: projectDraft.targetIds.includes(target.id) }" @click="toggleTarget(target.id)">
                <span class="mdi mdi-source-branch"></span><span><strong>{{ target.name }}</strong><small>{{ target.host }}</small></span><span class="mdi vfabric-target-check" :class="projectDraft.targetIds.includes(target.id) ? 'mdi-check-circle' : 'mdi-circle-outline'"></span>
              </button>
            </div>
            <div v-else class="vfabric-selector-empty">No managed pool targets are registered yet.</div>
          </section>

          <section class="detail-section vfabric-selector-section">
            <div class="detail-section-title">Network Access</div>
            <p class="text-muted">Select the networks/VLANs this project's VMs may attach to. Leave empty to allow every network.</p>
            <div class="vfabric-target-grid" v-if="networks.length">
              <button v-for="network in networks" :key="network.ref" type="button" class="vfabric-target-option" :class="{ active: projectDraft.networkRefs.includes(network.ref) }" @click="toggleNetwork(network.ref)">
                <span class="mdi mdi-lan"></span><span><strong>{{ network.name_label || network.ref }}</strong><small>{{ network.bridge || network.ref }}</small></span><span class="mdi vfabric-target-check" :class="projectDraft.networkRefs.includes(network.ref) ? 'mdi-check-circle' : 'mdi-circle-outline'"></span>
              </button>
            </div>
            <div v-else class="vfabric-selector-empty">No networks visible on the active connection yet.</div>
          </section>

          <div v-if="projectEditorError" class="form-error" style="text-align:left">{{ projectEditorError }}</div>
          <div class="vfabric-form-actions"><button type="button" class="btn" :disabled="projectSaving" @click="closeProjectEditor">Cancel</button><button type="submit" class="btn btn-primary" :disabled="projectSaving || !projectDraft.name.trim() || !projectDraft.organizationId"><span class="mdi" :class="editingProject ? 'mdi-content-save-outline' : 'mdi-plus'"></span>{{ projectSaving ? 'Saving...' : (editingProject ? 'Save Project' : 'Create Project') }}</button></div>
        </form>
      </floating-window>

      <confirm-window :show="Boolean(projectPendingDelete)" title="Delete Project" :message="'Delete ' + (projectPendingDelete?.name || 'this project') + '? Quota, membership, and pool-access bindings will be removed. Existing VMs are unaffected.'" confirm-label="Delete Project" :danger="true" @close="projectPendingDelete = null" @confirm="deleteProject"></confirm-window>

      <floating-window :show="showQuotaEditor" title="Project Quota" :width="700" :height="640" @close="closeQuotaEditor">
        <div class="detail-section" v-if="quotaProject">
          <div class="detail-title">{{ quotaProject.name }}</div>
          <p class="text-muted">Caps apply to resources tagged into this project via VM creation. A blank field means no cap for that dimension.</p>
          <form @submit.prevent="saveQuota">
            <label class="form-toggle"><input type="checkbox" v-model="quotaDraft.enabled"><span>Enforce this project quota</span></label>
            <div class="vm-inline-form-grid">
              <div class="form-group"><label>Max VMs</label><input class="form-input" type="number" min="0" v-model.number="quotaDraft.maxVmCount"></div>
              <div class="form-group"><label>Max vCPUs</label><input class="form-input" type="number" min="0" v-model.number="quotaDraft.maxVcpus"></div>
            </div>
            <div class="vm-inline-form-grid">
              <div class="form-group"><label>Max Memory (GiB)</label><input class="form-input" type="number" min="0" v-model.number="quotaDraft.maxMemoryGiB"></div>
              <div class="form-group"><label>Max Storage (GiB)</label><input class="form-input" type="number" min="0" v-model.number="quotaDraft.maxStorageGiB"></div>
            </div>
            <div class="vm-inline-form-grid">
              <div class="form-group"><label>Max GPUs</label><input class="form-input" type="number" min="0" v-model.number="quotaDraft.maxGpuCount"></div>
              <div class="form-group"><label>Max Networks</label><input class="form-input" type="number" min="0" v-model.number="quotaDraft.maxNetworkCount"></div>
            </div>
            <div class="form-group">
              <label>Approval Threshold - Memory (GiB)</label>
              <input class="form-input" type="number" min="0" v-model.number="quotaDraft.approvalThresholdMemoryGiB">
              <p class="field-help">VMs requesting more than this much memory require a governance approval before they can be created in this project. 0 disables the threshold.</p>
            </div>
            <div v-if="quotaError" class="form-error" style="text-align:left">{{ quotaError }}</div>
            <div class="vfabric-form-actions"><button type="button" class="btn" :disabled="quotaSaving" @click="closeQuotaEditor">Cancel</button><button type="submit" class="btn btn-primary" :disabled="quotaSaving"><span class="mdi mdi-content-save-outline"></span>{{ quotaSaving ? 'Saving...' : 'Save Quota' }}</button></div>
          </form>
          <div class="capacity-callout" style="margin-top:16px" v-if="quotaEvaluation">
            <strong>Live usage vs. quota</strong>
            <div class="text-muted" style="font-size:12px;margin-top:5px">
              {{ quotaEvaluation.usage.vmCount }} VMs &middot; {{ quotaEvaluation.usage.vcpus }} vCPUs &middot; {{ Math.round(quotaEvaluation.usage.memoryGiB * 10) / 10 }} GiB RAM &middot; {{ quotaEvaluation.usage.gpuCount }} GPUs &middot; {{ quotaEvaluation.usage.networkCount }} networks
            </div>
            <div class="text-muted" style="font-size:12px;margin-top:5px" v-if="quotaEvaluation.evaluation.breaches.length">Currently over quota for: {{ quotaEvaluation.evaluation.breaches.join(', ') }}</div>
            <div class="text-muted" style="font-size:12px;margin-top:5px" v-else>Within the configured quota envelope.</div>
          </div>
        </div>
      </floating-window>

      <floating-window :show="showMembersEditor" title="Project Members" :width="640" :height="560" @close="closeMembersEditor">
        <div class="detail-section" v-if="membersProject">
          <div class="detail-title">{{ membersProject.name }}</div>
          <table class="data-table" style="margin-top:10px">
            <thead><tr><th>User</th><th>Role</th></tr></thead>
            <tbody>
              <tr v-for="member in membersProject.members" :key="member.user_id">
                <td>{{ userName(member.user_id) }}</td>
                <td>
                  <select class="form-input" :value="member.role" @change="setMemberRole(member.user_id, $event.target.value)">
                    <option value="owner">Owner</option>
                    <option value="member">Member</option>
                    <option value="viewer">Viewer</option>
                  </select>
                </td>
              </tr>
              <tr v-if="!membersProject.members.length"><td colspan="2" class="text-muted">No members added yet.</td></tr>
            </tbody>
          </table>
          <div class="vfabric-form-grid" style="margin-top:16px">
            <div class="form-group">
              <label for="member-add-user">Add Member</label>
              <select id="member-add-user" class="form-input" v-model="newMemberUserId">
                <option :value="null">Select a user</option>
                <option v-for="user in addableUsers" :key="user.id" :value="user.id">{{ user.username }}</option>
              </select>
            </div>
            <div class="form-group">
              <label for="member-add-role">Role</label>
              <select id="member-add-role" class="form-input" v-model="newMemberRole">
                <option value="owner">Owner</option>
                <option value="member">Member</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>
          </div>
          <button class="btn btn-primary" :disabled="!newMemberUserId || membersSaving" @click="addMember"><span class="mdi mdi-account-plus-outline"></span> Add Member</button>
          <div v-if="membersError" class="form-error" style="text-align:left;margin-top:12px">{{ membersError }}</div>
        </div>
      </floating-window>
    </div>
  `,
  data() {
    return {
      loading: true,
      error: '',
      organizations: [],
      projects: [],
      managedTargets: [],
      networks: [],
      users: [],
      recoveryTiers: ['tier-1', 'tier-2', 'standard', 'edge'],
      showOrgEditor: false,
      orgSaving: false,
      orgEditorError: '',
      orgDraft: { name: '', description: '' },
      orgPendingDelete: null,
      showProjectEditor: false,
      projectSaving: false,
      projectEditorError: '',
      editingProject: null,
      projectDraft: this.emptyProjectDraft(),
      projectPendingDelete: null,
      showQuotaEditor: false,
      quotaSaving: false,
      quotaError: '',
      quotaProject: null,
      quotaEvaluation: null,
      quotaDraft: this.emptyQuotaDraft(),
      showMembersEditor: false,
      membersSaving: false,
      membersError: '',
      membersProject: null,
      newMemberUserId: null,
      newMemberRole: 'member',
    };
  },
  computed: {
    scopedPoolCount() {
      return new Set(this.projects.flatMap((project) => project.target_ids)).size;
    },
    addableUsers() {
      const existing = new Set((this.membersProject?.members || []).map((member) => Number(member.user_id)));
      return this.users.filter((user) => !existing.has(Number(user.id)));
    },
  },
  async mounted() {
    if (!store.authenticated) {
      this.$router.push('/login');
      return;
    }
    await this.loadWorkspace();
  },
  methods: {
    emptyProjectDraft() {
      return { organizationId: null, name: '', description: '', costCenter: '', defaultRecoveryTier: '', ownerUserId: null, enabled: true, targetIds: [], networkRefs: [] };
    },
    emptyQuotaDraft() {
      return { enabled: true, maxVmCount: 0, maxVcpus: 0, maxMemoryGiB: 0, maxStorageGiB: 0, maxGpuCount: 0, maxNetworkCount: 0, approvalThresholdMemoryGiB: 0 };
    },
    responseData(response) {
      return Array.isArray(response) ? response : (Array.isArray(response?.data) ? response.data : []);
    },
    projectsForOrg(orgId) {
      return this.projects.filter((project) => Number(project.organization_id) === Number(orgId));
    },
    managedTargetName(targetId) {
      return this.managedTargets.find((target) => Number(target.id) === Number(targetId))?.name || `Target ${targetId}`;
    },
    networkName(ref) {
      return this.networks.find((network) => network.ref === ref)?.name_label || ref;
    },
    ownerName(ownerUserId) {
      if (!ownerUserId) return 'Unassigned';
      return this.users.find((user) => Number(user.id) === Number(ownerUserId))?.username || `User ${ownerUserId}`;
    },
    userName(userId) {
      return this.users.find((user) => Number(user.id) === Number(userId))?.username || `User ${userId}`;
    },
    async loadWorkspace() {
      this.loading = true;
      this.error = '';
      try {
        const [organizations, projects, managedTargets, networks, users] = await Promise.all([
          api.getOrganizations(),
          api.getProjects(),
          api.getManagedTargets().catch(() => ({ data: [] })),
          api.getNetworks().catch(() => ({ data: [] })),
          api.getUsers().catch(() => ({ data: [] })),
        ]);
        this.organizations = this.responseData(organizations);
        this.projects = this.responseData(projects);
        this.managedTargets = this.responseData(managedTargets);
        this.networks = this.responseData(networks);
        this.users = this.responseData(users);
      } catch (error) {
        this.error = error.message || 'Unable to load organizations and projects.';
      } finally {
        this.loading = false;
      }
    },
    openCreateOrganization() {
      this.orgEditorError = '';
      this.orgDraft = { name: '', description: '' };
      this.showOrgEditor = true;
    },
    closeOrgEditor(force = false) {
      if (this.orgSaving && !force) return;
      this.showOrgEditor = false;
    },
    async saveOrganization() {
      this.orgSaving = true;
      this.orgEditorError = '';
      try {
        const organization = await api.createOrganization({ ...this.orgDraft, name: this.orgDraft.name.trim() });
        this.organizations = [...this.organizations, organization].sort((left, right) => left.name.localeCompare(right.name));
        this.closeOrgEditor(true);
      } catch (error) {
        this.orgEditorError = error.message || 'Unable to create this organization.';
      } finally {
        this.orgSaving = false;
      }
    },
    async deleteOrganization() {
      const organization = this.orgPendingDelete;
      if (!organization) return;
      this.orgPendingDelete = null;
      this.error = '';
      try {
        await api.deleteOrganization(organization.id);
        this.organizations = this.organizations.filter((entry) => entry.id !== organization.id);
      } catch (error) {
        this.error = error.message || 'Unable to delete this organization.';
      }
    },
    openCreateProject(org, project = null) {
      this.editingProject = project;
      this.projectEditorError = '';
      this.projectDraft = project ? {
        organizationId: project.organization_id,
        name: project.name,
        description: project.description || '',
        costCenter: project.cost_center || '',
        defaultRecoveryTier: project.default_recovery_tier || '',
        ownerUserId: project.owner_user_id || null,
        enabled: Boolean(project.enabled),
        targetIds: [...project.target_ids],
        networkRefs: [...project.network_refs],
      } : { ...this.emptyProjectDraft(), organizationId: org?.id || this.organizations[0]?.id || null };
      this.showProjectEditor = true;
    },
    closeProjectEditor(force = false) {
      if (this.projectSaving && !force) return;
      this.showProjectEditor = false;
      this.editingProject = null;
    },
    toggleTarget(id) {
      const values = this.projectDraft.targetIds;
      this.projectDraft.targetIds = values.includes(id) ? values.filter((value) => value !== id) : [...values, id];
    },
    toggleNetwork(ref) {
      const values = this.projectDraft.networkRefs;
      this.projectDraft.networkRefs = values.includes(ref) ? values.filter((value) => value !== ref) : [...values, ref];
    },
    async saveProject() {
      this.projectSaving = true;
      this.projectEditorError = '';
      try {
        const payload = { ...this.projectDraft, name: this.projectDraft.name.trim() };
        const record = this.editingProject
          ? await api.updateProject(this.editingProject.id, payload)
          : await api.createProject(payload);
        const index = this.projects.findIndex((project) => project.id === record.id);
        if (index === -1) this.projects = [...this.projects, record];
        else this.projects.splice(index, 1, record);
        this.closeProjectEditor(true);
      } catch (error) {
        this.projectEditorError = error.message || 'Unable to save this project.';
      } finally {
        this.projectSaving = false;
      }
    },
    async deleteProject() {
      const project = this.projectPendingDelete;
      if (!project) return;
      this.projectPendingDelete = null;
      this.error = '';
      try {
        await api.deleteProject(project.id);
        this.projects = this.projects.filter((entry) => entry.id !== project.id);
      } catch (error) {
        this.error = error.message || 'Unable to delete this project.';
      }
    },
    async openQuotaEditor(project) {
      this.quotaProject = project;
      this.quotaError = '';
      this.quotaEvaluation = null;
      this.quotaDraft = project.quota ? {
        enabled: Boolean(project.quota.enabled),
        maxVmCount: Number(project.quota.max_vm_count || 0),
        maxVcpus: Number(project.quota.max_vcpus || 0),
        maxMemoryGiB: Number(project.quota.max_memory_gib || 0),
        maxStorageGiB: Number(project.quota.max_storage_gib || 0),
        maxGpuCount: Number(project.quota.max_gpu_count || 0),
        maxNetworkCount: Number(project.quota.max_network_count || 0),
        approvalThresholdMemoryGiB: Number(project.quota.approval_threshold_memory_gib || 0),
      } : this.emptyQuotaDraft();
      this.showQuotaEditor = true;
      try {
        this.quotaEvaluation = await api.getProjectQuotaEvaluation(project.id);
      } catch (error) {
        this.quotaEvaluation = null;
      }
    },
    closeQuotaEditor(force = false) {
      if (this.quotaSaving && !force) return;
      this.showQuotaEditor = false;
      this.quotaProject = null;
    },
    async saveQuota() {
      if (!this.quotaProject) return;
      this.quotaSaving = true;
      this.quotaError = '';
      try {
        const quota = await api.saveProjectQuota(this.quotaProject.id, this.quotaDraft);
        const index = this.projects.findIndex((project) => project.id === this.quotaProject.id);
        if (index !== -1) this.projects[index].quota = quota;
        this.closeQuotaEditor(true);
      } catch (error) {
        this.quotaError = error.message || 'Unable to save this project quota.';
      } finally {
        this.quotaSaving = false;
      }
    },
    openMembersEditor(project) {
      this.membersProject = project;
      this.membersError = '';
      this.newMemberUserId = null;
      this.newMemberRole = 'member';
      this.showMembersEditor = true;
    },
    closeMembersEditor(force = false) {
      if (this.membersSaving && !force) return;
      this.showMembersEditor = false;
      this.membersProject = null;
    },
    async setMemberRole(userId, role) {
      if (!this.membersProject) return;
      this.membersSaving = true;
      this.membersError = '';
      try {
        const { data } = await api.setProjectMember(this.membersProject.id, userId, { role });
        this.membersProject.members = data;
        const index = this.projects.findIndex((project) => project.id === this.membersProject.id);
        if (index !== -1) this.projects[index].members = data;
      } catch (error) {
        this.membersError = error.message || 'Unable to update this member role.';
      } finally {
        this.membersSaving = false;
      }
    },
    async addMember() {
      if (!this.newMemberUserId || !this.membersProject) return;
      await this.setMemberRole(this.newMemberUserId, this.newMemberRole);
      this.newMemberUserId = null;
      this.newMemberRole = 'member';
    },
  },
};
