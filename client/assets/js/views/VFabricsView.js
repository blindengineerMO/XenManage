const VFabricsView = {
  components: {
    FloatingWindow,
    ConfirmWindow,
    GovernanceQuotaForm,
  },
  template: `
    <div class="animate-fade-in vfabrics-view">
      <div class="section-head">
        <div>
          <h2 class="section-title"><span class="mdi mdi-vector-combine"></span> vFabrics</h2>
          <p class="section-subtitle">Logical operational groupings across registered pools and standalone hosts. Membership is additive and never changes XenServer clustering.</p>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-sm" :disabled="loading" @click="loadWorkspace"><span class="mdi mdi-refresh"></span> Refresh</button>
          <button class="btn btn-primary" @click="openCreate"><span class="mdi mdi-vector-combine"></span> Create vFabric</button>
        </div>
      </div>

      <div v-if="error" class="form-error" style="text-align:left;margin-bottom:14px">{{ error }}</div>
      <div v-if="loading" class="empty-state"><span class="loading-spinner"></span><p style="margin-top:12px">Loading vFabric control-plane records...</p></div>

      <template v-else>
        <div class="vfabric-summary-grid">
          <div class="dash-card"><div class="dash-card-label">vFabrics</div><div class="dash-card-value">{{ fabrics.length }}</div><div class="dash-card-icon mdi mdi-vector-combine"></div></div>
          <div class="dash-card"><div class="dash-card-label">Grouped Pools</div><div class="dash-card-value">{{ groupedPoolCount }}</div><div class="dash-card-icon mdi mdi-source-branch"></div></div>
          <div class="dash-card"><div class="dash-card-label">Grouped Hosts</div><div class="dash-card-value">{{ groupedHostCount }}</div><div class="dash-card-icon mdi mdi-server"></div></div>
        </div>

        <div v-if="!fabrics.length" class="empty-state vfabric-empty-state">
          <span class="mdi mdi-vector-combine"></span>
          <h3>No vFabrics yet</h3>
          <p>Create a control-plane grouping for pools and standalone hosts without changing their XenServer relationships.</p>
          <button class="btn btn-primary" @click="openCreate"><span class="mdi mdi-plus"></span> Create vFabric</button>
        </div>

        <div v-else class="vfabric-card-grid">
          <article v-for="fabric in fabrics" :key="fabric.id" class="vfabric-card" :class="'vfabric-card-' + (fabric.color_tag || 'green')">
            <div class="vfabric-card-head">
              <div>
                <div class="dash-card-label">{{ fabric.visibility }} control-plane scope</div>
                <h3>{{ fabric.name }}</h3>
              </div>
              <span class="badge" :class="fabric.visibility === 'shared' ? 'badge-info' : 'badge-neutral'">{{ fabric.members.length }} targets</span>
            </div>
            <p class="vfabric-card-description">{{ fabric.description || 'No operator description supplied.' }}</p>
            <div class="vfabric-members" aria-label="vFabric member targets">
              <span v-for="member in fabric.members" :key="member.kind + '-' + member.target_id" class="vfabric-member-pill">
                <span class="mdi" :class="member.kind === 'pool' ? 'mdi-source-branch' : 'mdi-server'"></span>
                {{ member.name }}
              </span>
              <span v-if="!fabric.members.length" class="text-muted mono">No visible members</span>
            </div>
            <div class="capacity-callout" style="margin-top:14px" v-if="fabric.quotaEvaluation">
              <strong>Aggregate quota · {{ fabric.quotaEvaluation.status }}</strong>
              <div class="text-muted" style="font-size:12px;margin-top:5px">{{ fabric.quotaEvaluation.usage.vmCount }} VMs · {{ fabric.quotaEvaluation.usage.runningVmCount }} running · {{ fabric.quotaEvaluation.usage.totalMemoryGiB }} GiB</div>
              <div class="text-muted" style="font-size:12px;margin-top:5px">{{ fabric.quotaEvaluation.detail }}</div>
            </div>
            <div class="vfabric-card-footer">
              <span class="text-muted mono">{{ fabric.owner_display_name || 'Shared control-plane record' }}</span>
              <div style="display:flex;gap:8px">
                <button class="btn btn-sm" :disabled="!fabric.can_manage || !isAdmin" @click="openQuotaEditor(fabric)"><span class="mdi mdi-gauge"></span> Quota</button>
                <button class="btn btn-sm" :disabled="!fabric.can_manage" @click="openEdit(fabric)"><span class="mdi mdi-pencil"></span> Edit</button>
                <button class="btn btn-sm btn-danger" :disabled="!fabric.can_manage" @click="fabricPendingDelete = fabric"><span class="mdi mdi-delete-outline"></span> Delete</button>
              </div>
            </div>
          </article>
        </div>
      </template>

      <floating-window :show="showEditor" :title="editingFabric ? 'Edit vFabric' : 'Create vFabric'" :width="780" :height="610" @close="closeEditor">
        <form class="vfabric-form" @submit.prevent="saveFabric">
          <div class="vfabric-form-grid">
            <div class="form-group"><label for="vfabric-name">Name</label><input id="vfabric-name" class="form-input" v-model.trim="draft.name" maxlength="120" required placeholder="West Region Production"></div>
            <div class="form-group"><label for="vfabric-color">Accent</label><select id="vfabric-color" class="form-input" v-model="draft.colorTag"><option value="green">Green</option><option value="cyan">Cyan</option><option value="amber">Amber</option><option value="red">Red</option></select></div>
          </div>
          <div class="form-group"><label for="vfabric-description">Description</label><textarea id="vfabric-description" class="form-input vfabric-textarea" v-model="draft.description" maxlength="500" placeholder="Business, regional, or operational purpose for this grouping"></textarea></div>
          <label class="form-toggle"><input type="checkbox" v-model="isShared"><span>Share this vFabric with other operators</span></label>

          <section class="detail-section vfabric-selector-section">
            <div class="detail-section-title">Pool Members</div>
            <p class="text-muted">Select registered pool coordinators to include. This only saves a XenMange grouping.</p>
            <div class="vfabric-target-grid" v-if="connections.length">
              <button v-for="connection in connections" :key="connection.id" type="button" class="vfabric-target-option" :class="{ active: draft.connectionIds.includes(connection.id) }" @click="toggleMember('connectionIds', connection.id)">
                <span class="mdi mdi-source-branch"></span><span><strong>{{ connection.name }}</strong><small>{{ connection.host }}</small></span><span class="mdi vfabric-target-check" :class="draft.connectionIds.includes(connection.id) ? 'mdi-check-circle' : 'mdi-circle-outline'"></span>
              </button>
            </div>
            <div v-else class="vfabric-selector-empty">No registered pool targets are visible to this account.</div>
          </section>

          <section class="detail-section vfabric-selector-section">
            <div class="detail-section-title">Standalone Host Members</div>
            <p class="text-muted">Select independent hosts. Pool-member registrations are intentionally excluded to avoid duplicate pool scope.</p>
            <div class="vfabric-target-grid" v-if="standaloneHosts.length">
              <button v-for="host in standaloneHosts" :key="host.id" type="button" class="vfabric-target-option" :class="{ active: draft.hostTargetIds.includes(host.id) }" @click="toggleMember('hostTargetIds', host.id)">
                <span class="mdi mdi-server"></span><span><strong>{{ host.name }}</strong><small>{{ host.host }}</small></span><span class="mdi vfabric-target-check" :class="draft.hostTargetIds.includes(host.id) ? 'mdi-check-circle' : 'mdi-circle-outline'"></span>
              </button>
            </div>
            <div v-else class="vfabric-selector-empty">No standalone host targets are visible to this account.</div>
          </section>

          <div v-if="editorError" class="form-error" style="text-align:left">{{ editorError }}</div>
          <div class="vfabric-form-actions"><button type="button" class="btn" :disabled="saving" @click="closeEditor">Cancel</button><button type="submit" class="btn btn-primary" :disabled="saving || !draft.name.trim()"><span class="mdi" :class="editingFabric ? 'mdi-content-save-outline' : 'mdi-plus' "></span>{{ saving ? 'Saving...' : (editingFabric ? 'Save vFabric' : 'Create vFabric') }}</button></div>
        </form>
      </floating-window>

      <confirm-window :show="Boolean(fabricPendingDelete)" title="Delete vFabric" :message="'Delete ' + (fabricPendingDelete?.name || 'this vFabric') + '? Its saved target registrations and XenServer resources will not be changed.'" confirm-label="Delete vFabric" :danger="true" @close="fabricPendingDelete = null" @confirm="deleteFabric"></confirm-window>

      <floating-window :show="showQuotaEditor" title="vFabric Aggregate Quota" :width="680" :height="590" @close="closeQuotaEditor">
        <div class="detail-section" v-if="quotaFabric">
          <div class="detail-title">{{ quotaFabric.name }}</div>
          <p class="text-muted">Caps apply across every member target. Deployment is blocked when the policy is breached or when member coverage is incomplete.</p>
          <governance-quota-form
            :initial-value="quotaFabric.quotaEvaluation?.quota || {}"
            :pool-record="{ poolName: quotaFabric.name }"
            :saving="quotaSaving"
            scope-label="vFabric"
            enforcement-label="Enforce this aggregate quota"
            submit-label="Save vFabric Quota"
            @submit="saveQuota">
          </governance-quota-form>
          <button v-if="quotaFabric.quotaEvaluation?.quota" class="btn" :disabled="quotaSaving" @click="deleteQuota">Remove vFabric Quota</button>
          <div v-if="quotaError" class="form-error" style="text-align:left;margin-top:12px">{{ quotaError }}</div>
        </div>
      </floating-window>
    </div>
  `,
  data() {
    return {
      loading: true,
      saving: false,
      error: '',
      editorError: '',
      fabrics: [],
      connections: [],
      hostTargets: [],
      editingFabric: null,
      fabricPendingDelete: null,
      showEditor: false,
      showQuotaEditor: false,
      quotaSaving: false,
      quotaError: '',
      quotaFabric: null,
      draft: this.emptyDraft(),
    };
  },
  computed: {
    standaloneHosts() {
      return this.hostTargets.filter((host) => host.mode === 'standalone');
    },
    groupedPoolCount() {
      return new Set(this.fabrics.flatMap((fabric) => fabric.members.filter((member) => member.kind === 'pool').map((member) => member.target_id))).size;
    },
    groupedHostCount() {
      return new Set(this.fabrics.flatMap((fabric) => fabric.members.filter((member) => member.kind === 'host').map((member) => member.target_id))).size;
    },
    isShared: {
      get() { return this.draft.visibility === 'shared'; },
      set(value) { this.draft.visibility = value ? 'shared' : 'private'; },
    },
    isAdmin() {
      return store.governance?.currentRole === 'admin';
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
    emptyDraft() {
      return { name: '', description: '', colorTag: 'green', visibility: store.user ? 'private' : 'shared', connectionIds: [], hostTargetIds: [] };
    },
    async loadWorkspace() {
      this.loading = true;
      this.error = '';
      try {
        const [fabrics, connections, hostTargets] = await Promise.all([api.getVFabrics(), api.getConnections(), api.getHostTargets()]);
        const records = this.responseData(fabrics);
        const quotaEvaluations = await Promise.all(records.map(async (fabric) => ({
          id: fabric.id,
          evaluation: await api.getVFabricQuota(fabric.id).catch(() => null),
        })));
        const evaluationById = new Map(quotaEvaluations.map((entry) => [entry.id, entry.evaluation]));
        this.fabrics = records.map((fabric) => ({ ...fabric, quotaEvaluation: evaluationById.get(fabric.id) || null }));
        this.connections = this.responseData(connections);
        this.hostTargets = this.responseData(hostTargets);
      } catch (error) {
        this.error = error.message || 'Unable to load vFabric records.';
      } finally {
        this.loading = false;
      }
    },
    openCreate() {
      this.editingFabric = null;
      this.editorError = '';
      this.draft = this.emptyDraft();
      this.showEditor = true;
    },
    openEdit(fabric) {
      this.editingFabric = fabric;
      this.editorError = '';
      this.draft = {
        name: fabric.name || '',
        description: fabric.description || '',
        colorTag: fabric.color_tag || 'green',
        visibility: fabric.visibility || 'private',
        connectionIds: fabric.members.filter((member) => member.kind === 'pool').map((member) => member.target_id),
        hostTargetIds: fabric.members.filter((member) => member.kind === 'host').map((member) => member.target_id),
      };
      this.showEditor = true;
    },
    closeEditor(force = false) {
      if (this.saving && !force) return;
      this.showEditor = false;
      this.editingFabric = null;
      this.editorError = '';
    },
    toggleMember(key, id) {
      const values = this.draft[key];
      this.draft[key] = values.includes(id) ? values.filter((value) => value !== id) : [...values, id];
    },
    openQuotaEditor(fabric) {
      if (!this.isAdmin || !fabric?.can_manage) return;
      this.quotaFabric = fabric;
      this.quotaError = '';
      this.showQuotaEditor = true;
    },
    closeQuotaEditor(force = false) {
      if (this.quotaSaving && !force) return;
      this.showQuotaEditor = false;
      this.quotaFabric = null;
      this.quotaError = '';
    },
    async saveQuota(payload) {
      if (!this.quotaFabric) return;
      this.quotaSaving = true;
      this.quotaError = '';
      try {
        await api.saveVFabricQuota(this.quotaFabric.id, payload);
        await this.loadWorkspace();
        this.closeQuotaEditor(true);
      } catch (error) {
        this.quotaError = error.message || 'Unable to save the vFabric quota.';
      } finally {
        this.quotaSaving = false;
      }
    },
    async deleteQuota() {
      if (!this.quotaFabric) return;
      this.quotaSaving = true;
      this.quotaError = '';
      try {
        await api.deleteVFabricQuota(this.quotaFabric.id);
        await this.loadWorkspace();
        this.closeQuotaEditor(true);
      } catch (error) {
        this.quotaError = error.message || 'Unable to remove the vFabric quota.';
      } finally {
        this.quotaSaving = false;
      }
    },
    responseData(response) {
      return Array.isArray(response) ? response : (Array.isArray(response?.data) ? response.data : []);
    },
    async saveFabric() {
      this.saving = true;
      this.editorError = '';
      try {
        const payload = { ...this.draft, name: this.draft.name.trim() };
        const record = this.editingFabric
          ? await api.updateVFabric(this.editingFabric.id, payload)
          : await api.createVFabric(payload);
        const index = this.fabrics.findIndex((fabric) => fabric.id === record.id);
        if (index === -1) this.fabrics = [...this.fabrics, record].sort((left, right) => left.name.localeCompare(right.name));
        else this.fabrics.splice(index, 1, record);
        this.closeEditor(true);
      } catch (error) {
        this.editorError = error.message || 'Unable to save this vFabric.';
      } finally {
        this.saving = false;
      }
    },
    async deleteFabric() {
      const fabric = this.fabricPendingDelete;
      if (!fabric) return;
      this.fabricPendingDelete = null;
      this.error = '';
      try {
        await api.deleteVFabric(fabric.id);
        this.fabrics = this.fabrics.filter((entry) => entry.id !== fabric.id);
      } catch (error) {
        this.error = error.message || 'Unable to delete this vFabric.';
      }
    },
  },
};
