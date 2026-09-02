const ApplicationsView = {
  components: { FloatingWindow },
  template: `
    <div class="animate-fade-in">
      <div class="section-head">
        <div>
          <h2 class="section-title"><span class="mdi mdi-apps"></span> Applications</h2>
          <p class="section-subtitle">Curate approved Template Library assets into self-service catalog applications.</p>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-sm" @click="loadAnalytics"><span class="mdi mdi-chart-box-outline"></span> Analytics</button>
          <button class="btn btn-sm" @click="showReview = true"><span class="mdi mdi-clipboard-check-outline"></span> Review Requests<span v-if="pendingRequestCount" class="tree-count" style="margin-left:6px">{{ pendingRequestCount }}</span></button>
          <button class="btn btn-primary" @click="showCreate = true"><span class="mdi mdi-plus"></span> Create Application</button>
        </div>
      </div>
      <div v-if="errorMessage" class="alert alert-error">{{ errorMessage }}</div>
      <div v-if="successMessage" class="alert alert-success">{{ successMessage }}</div>

      <floating-window :title="editingId ? 'Edit Application' : 'Create Application'" :show="showCreate" :width="760" :height="650" :x="140" :y="72" @close="closeEditor">
        <div class="dash-card-label" style="margin-bottom:14px">Catalog Application</div>
        <div class="form-grid">
          <div class="form-group"><label>Title</label><input class="form-input" v-model="draft.title" @input="syncSlug"></div>
          <div class="form-group"><label>Slug</label><input class="form-input" v-model="draft.slug"></div>
          <div class="form-group"><label>Template Library Source</label>
            <select class="form-select" v-model.number="draft.sourceItemId"><option :value="null">Select source</option><option v-for="item in sources" :key="item.id" :value="item.id">{{ item.name }} · {{ item.kind }}</option></select>
          </div>
          <div class="form-group"><label>Naming Pattern</label><input class="form-input" v-model="draft.namingPattern" placeholder="WEB-XXXX"></div>
          <div class="form-group"><label>Category</label><input class="form-input" v-model="draft.category" placeholder="Web"></div>
          <div class="form-group"><label>Card Image URL (HTTPS)</label><input class="form-input" type="url" v-model="draft.imageUrl" placeholder="https://example.com/application.png"></div>
          <div class="form-group"><label>Maximum Active Requests</label><input class="form-input" type="number" min="1" v-model.number="draft.maxActivePerSubscriber"></div>
          <div class="form-group"><label>Lease Duration (hours)</label><input class="form-input" type="number" min="1" max="87600" v-model.number="draft.leaseDurationHours" placeholder="No expiration"></div>
          <div class="form-group"><label>Monthly Rate / vCPU (USD)</label><input class="form-input" type="number" min="0" step="0.01" v-model.number="draft.costPerVcpu"></div>
          <div class="form-group"><label>Monthly Rate / GiB RAM (USD)</label><input class="form-input" type="number" min="0" step="0.01" v-model.number="draft.costPerGiBRam"></div>
          <div class="form-group"><label>Monthly Rate / GiB Disk (USD)</label><input class="form-input" type="number" min="0" step="0.01" v-model.number="draft.costPerGiBDisk"></div>
          <div class="form-group"><label>Eligible Pool Refs (JSON)</label><textarea class="form-input mono" rows="3" v-model="draft.targetPoolRefsJson" placeholder='["OpaqueRef:pool-a", "OpaqueRef:pool-b"]'></textarea></div>
          <div class="form-group"><label>Description</label><textarea class="form-input" v-model="draft.description"></textarea></div>
          <div class="form-group"><label>Lifecycle</label><input class="form-input" value="Draft (validate before publishing)" disabled></div>
          <div class="form-group"><label>Approval Policy</label><select class="form-select" v-model="draft.approvalMode"><option value="manual">Administrator review</option><option value="multi-step">Multi-step approval</option><option value="auto">Approve automatically</option><option value="threshold">Approve under numeric threshold</option><option value="webhook">External webhook</option></select></div>
          <div class="form-group" v-if="draft.approvalMode === 'multi-step'"><label>Approval Steps (JSON)</label><textarea class="form-input mono" rows="4" v-model="draft.approvalStepsJson" placeholder='["Infrastructure review","Security review"]'></textarea></div>
          <div class="form-group" v-if="draft.approvalMode === 'threshold'"><label>Threshold Field</label><input class="form-input" v-model="draft.approvalThresholdField" placeholder="memoryGiB"></div>
          <div class="form-group" v-if="draft.approvalMode === 'threshold'"><label>Automatic Approval Maximum</label><input class="form-input" type="number" v-model.number="draft.approvalThresholdMax"></div>
          <div class="form-group" v-if="draft.approvalMode === 'webhook'"><label>Webhook URL</label><input class="form-input" type="url" v-model="draft.approvalWebhookUrl" placeholder="https://approvals.example.com/xenmange"></div>
          <div class="form-group" v-if="draft.approvalMode === 'webhook'"><label>Shared Webhook Credential</label><select class="form-select" v-model.number="draft.approvalCredentialId"><option :value="null">Select credential</option><option v-for="credential in webhookCredentials" :key="credential.id" :value="credential.id">{{ credential.name }}</option></select></div>
          <div class="form-group"><label>Subscriber Fields (JSON)</label><textarea class="form-input mono" rows="6" v-model="draft.subscriberFieldsJson" placeholder='[{"key":"environment","label":"Environment","type":"select","options":["dev","prod"],"default":"dev"}]'></textarea></div>
          <div class="form-group"><label>Fixed Variables (JSON)</label><textarea class="form-input mono" rows="6" v-model="draft.fixedVariablesJson" placeholder='{"templateRef":"OpaqueRef:...","vcpus":2,"memoryStaticMax":4294967296}'></textarea></div>
        </div>
        <div style="display:flex;gap:8px"><button class="btn btn-primary" @click="saveEntry" :disabled="saving">{{ saving ? 'Saving...' : editingId ? 'Save Changes' : 'Create' }}</button><button class="btn btn-sm" @click="closeEditor">Cancel</button></div>
      </floating-window>

      <floating-window title="Catalog Analytics" :show="showAnalytics" :width="760" :height="520" :x="170" :y="84" @close="showAnalytics = false">
        <div class="dash-grid" style="margin-bottom:14px">
          <div class="dash-card"><div class="dash-card-label">Requests</div><div class="dash-card-value">{{ analytics.totals?.requestVolume || 0 }}</div></div>
          <div class="dash-card"><div class="dash-card-label">Active</div><div class="dash-card-value">{{ analytics.totals?.activeCount || 0 }}</div></div>
          <div class="dash-card"><div class="dash-card-label">Reclaimed / Expired</div><div class="dash-card-value">{{ analytics.totals?.reclaimedCount || 0 }}</div></div>
          <div class="dash-card"><div class="dash-card-label">Pending</div><div class="dash-card-value">{{ analytics.totals?.pendingCount || 0 }}</div></div>
        </div>
        <div class="stack-list" v-if="analytics.entries?.length">
          <div class="stack-item" v-for="entry in analytics.entries" :key="entry.id">
            <div><strong>{{ entry.title }}</strong><div class="text-muted mono" style="font-size:11px">{{ entry.request_volume }} requests · {{ entry.avg_approval_minutes === null ? 'No decisions' : entry.avg_approval_minutes + ' min average approval' }}</div></div>
            <div class="catalog-approval-chain"><span class="badge badge-success">{{ entry.active_count }} active</span><span class="badge badge-info">{{ entry.reclaimed_count }} reclaimed</span></div>
          </div>
        </div>
      </floating-window>

      <floating-window title="Application Versions" :show="showVersions" :width="680" :height="460" :x="190" :y="96" @close="showVersions = false">
        <div class="dash-card-label" style="margin-bottom:14px">Immutable Version History</div>
        <div class="stack-list" v-if="versions.length">
          <div class="stack-item" v-for="version in versions" :key="version.id">
            <div><strong>Version {{ version.version_number }}</strong><div class="text-muted mono" style="font-size:11px">{{ version.lifecycle_stage }} · {{ version.validation_status }} · {{ new Date(version.created_at).toLocaleString() }}</div><div v-if="version.validation_notes" class="text-muted" style="font-size:11px">{{ version.validation_notes }}</div></div>
            <span class="badge" :class="version.validation_status === 'validated' ? 'badge-success' : version.validation_status === 'failed' ? 'badge-danger' : 'badge-info'">{{ version.validation_status }}</span>
          </div>
        </div>
        <div v-else class="empty-state">No versions recorded.</div>
      </floating-window>

      <floating-window title="Request Review Queue" :show="showReview" :width="720" :height="520" :x="180" :y="90" @close="showReview = false">
        <div class="dash-card-label" style="margin-bottom:14px">Catalog Requests</div>
        <div class="stack-list" v-if="requests.length">
          <div class="stack-item" v-for="request in requests" :key="request.id">
            <div><strong>{{ request.title }}</strong><div class="text-muted mono" style="font-size:11px">{{ request.requested_by_name || 'subscriber' }} · {{ request.generated_name || 'Awaiting approval' }}<span v-if="request.approvalSteps?.length"> · step {{ approvedStepCount(request) + 1 }} of {{ request.approvalSteps.length }}: {{ currentApprovalStep(request)?.label || 'complete' }}</span><span v-if="request.hook_status"> · hook {{ request.hook_status }} ({{ request.hook_attempt_count }})</span><span v-if="request.decided_at"> · decided {{ new Date(request.decided_at).toLocaleString() }}</span></div><div v-if="request.approvalSteps?.length" class="catalog-approval-chain"><span v-for="step in request.approvalSteps" :key="step.id" class="badge" :class="step.status === 'approved' ? 'badge-success' : step.status === 'rejected' ? 'badge-danger' : 'badge-info'">{{ step.step_order }}. {{ step.label }}</span></div><div v-if="request.hook_last_error" class="form-error" style="margin-top:4px;text-align:left">{{ request.hook_last_error }}</div></div>
            <div style="display:flex;gap:6px;align-items:center"><span class="badge badge-info">{{ request.status }}</span><button v-if="request.status === 'pending'" class="btn btn-sm" @click="reviewRequest(request, 'approved')">Approve</button><button v-if="request.status === 'pending'" class="btn btn-sm btn-danger" @click="reviewRequest(request, 'rejected')">Reject</button><button v-if="request.status === 'approved'" class="btn btn-sm btn-primary" @click="deployRequest(request)">Deploy</button></div>
          </div>
        </div>
        <div v-else class="empty-state">No catalog requests require review.</div>
      </floating-window>

      <div class="dash-grid" v-if="entries.length">
        <div class="dash-card" v-for="entry in entries" :key="entry.id">
          <div class="dash-card-label">{{ entry.visibility }} · v{{ entry.currentVersion?.version_number || 1 }} · {{ entry.currentVersion?.lifecycle_stage || 'draft' }}</div>
          <div class="dash-card-value" style="font-size:18px">{{ entry.title }}</div>
          <div class="text-muted mono" style="font-size:11px;margin-top:8px">{{ entry.slug }} · {{ entry.naming_pattern }} · {{ entry.leaseDurationHours ? entry.leaseDurationHours + 'h lease' : 'no lease' }}</div>
          <p class="text-muted" style="font-size:12px">{{ entry.description || 'No description' }}</p>
          <div class="catalog-approval-chain"><span class="badge" :class="entry.currentVersion?.validation_status === 'validated' ? 'badge-success' : entry.currentVersion?.validation_status === 'failed' ? 'badge-danger' : 'badge-info'">{{ entry.currentVersion?.validation_status || 'untested' }}</span></div>
          <div style="display:flex;gap:6px;margin-top:12px;flex-wrap:wrap"><button class="btn btn-sm" @click="editEntry(entry)">Edit</button><button class="btn btn-sm" @click="loadVersions(entry)">Versions</button><button v-if="entry.currentVersion?.validation_status !== 'validated'" class="btn btn-sm" @click="validateEntry(entry, 'validated')">Validate</button><button v-if="entry.currentVersion?.validation_status === 'validated' && entry.visibility !== 'published'" class="btn btn-sm btn-primary" @click="publishEntry(entry)">Publish</button><button class="btn btn-sm btn-danger" @click="deleteEntry(entry)">Retire</button></div>
        </div>
      </div>
      <div v-else class="empty-state">{{ loading ? 'Loading applications...' : 'No catalog applications have been curated yet.' }}</div>

    </div>
  `,
  data() {
    return { entries: [], sources: [], requests: [], credentials: [], versions: [], analytics: { entries: [], totals: {} }, loading: false, saving: false, showCreate: false, showReview: false, showVersions: false, showAnalytics: false, editingId: null, errorMessage: '', successMessage: '', draft: this.emptyDraft() };
  },
  computed: {
    pendingRequestCount() { return this.requests.filter((request) => request.status === 'pending').length; },
    webhookCredentials() { return this.credentials.filter((credential) => credential.targetType === 'webhook' && credential.scope === 'shared'); },
  },
  async mounted() {
    await this.load();
  },
  methods: {
    emptyDraft() {
      return { title: '', slug: '', sourceItemId: null, namingPattern: 'NODE-XXXX', category: '', imageUrl: '', description: '', visibility: 'draft', approvalMode: 'manual', approvalStepsJson: '["Infrastructure review", "Security review"]', approvalThresholdField: '', approvalThresholdMax: null, approvalWebhookUrl: '', approvalCredentialId: null, maxActivePerSubscriber: null, leaseDurationHours: null, costPerVcpu: null, costPerGiBRam: null, costPerGiBDisk: null, targetPoolRefsJson: '[]', subscriberFieldsJson: '[]', fixedVariablesJson: '{}' };
    },
    syncSlug() {
      if (!this.draft.slug || this.draft.slug === this.lastGeneratedSlug) {
        this.draft.slug = this.draft.title.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        this.lastGeneratedSlug = this.draft.slug;
      }
    },
    async load() {
      this.loading = true;
      this.errorMessage = '';
      try {
        const [catalog, tree, requests, credentials] = await Promise.all([api.getCatalogAdminEntries(), api.getTemplateLibraryTree(), api.getCatalogAdminRequests(), api.getCredentials()]);
        this.entries = catalog.entries || [];
        this.requests = requests.requests || [];
        this.credentials = credentials.data || [];
        const collect = (nodes) => nodes.flatMap((node) => node.type === 'item' ? [node] : collect(node.children || []));
        this.sources = collect(tree.data || []).filter((item) => ['deployment-template', 'guest-script', 'snippet'].includes(item.kind));
      } catch (error) {
        this.errorMessage = error.message || 'Catalog administration requires the catalog.admin role.';
      } finally {
        this.loading = false;
      }
    },
    async loadAnalytics() {
      this.errorMessage = '';
      try { this.analytics = await api.getCatalogAnalytics(); this.showAnalytics = true; }
      catch (error) { this.errorMessage = error.message || 'Unable to load catalog analytics.'; }
    },
    closeEditor() { this.showCreate = false; this.editingId = null; this.draft = this.emptyDraft(); },
    editEntry(entry) {
      this.editingId = entry.id;
      const policy = entry.approvalPolicy || { mode: entry.requiresApproval === false ? 'auto' : 'manual' };
      this.draft = { title: entry.title, slug: entry.slug, sourceItemId: entry.source_item_id, namingPattern: entry.naming_pattern, category: entry.category || '', imageUrl: entry.image_url || '', description: entry.description || '', visibility: 'draft', approvalMode: policy.mode, approvalStepsJson: JSON.stringify(policy.steps || ['Infrastructure review', 'Security review'], null, 2), approvalThresholdField: policy.field || '', approvalThresholdMax: policy.max ?? null, approvalWebhookUrl: policy.url || '', approvalCredentialId: policy.credentialId || null, maxActivePerSubscriber: entry.maxActivePerSubscriber, leaseDurationHours: entry.leaseDurationHours, costPerVcpu: entry.costRates?.perVcpu ?? null, costPerGiBRam: entry.costRates?.perGiBRam ?? null, costPerGiBDisk: entry.costRates?.perGiBDisk ?? null, targetPoolRefsJson: JSON.stringify(entry.targetPoolRefs || [], null, 2), subscriberFieldsJson: JSON.stringify(entry.subscriberFields || [], null, 2), fixedVariablesJson: JSON.stringify(entry.fixedVariables || {}, null, 2) };
      this.showCreate = true;
    },
    async saveEntry() {
      this.saving = true;
      this.errorMessage = '';
      try {
        let subscriberFields;
        let fixedVariables;
        let approvalSteps;
        let targetPoolRefs;
        try {
          subscriberFields = JSON.parse(this.draft.subscriberFieldsJson || '[]');
          fixedVariables = JSON.parse(this.draft.fixedVariablesJson || '{}');
          approvalSteps = this.draft.approvalMode === 'multi-step' ? JSON.parse(this.draft.approvalStepsJson || '[]') : [];
          targetPoolRefs = JSON.parse(this.draft.targetPoolRefsJson || '[]');
        } catch (error) {
          this.errorMessage = 'Approval steps, pool targets, subscriber fields, and fixed variables must be valid JSON.';
          return;
        }
        const approvalPolicy = this.draft.approvalMode === 'multi-step'
          ? { mode: 'multi-step', steps: approvalSteps }
          : this.draft.approvalMode === 'threshold'
          ? { mode: 'threshold', field: this.draft.approvalThresholdField, max: this.draft.approvalThresholdMax }
          : this.draft.approvalMode === 'webhook'
            ? { mode: 'webhook', url: this.draft.approvalWebhookUrl, credentialId: this.draft.approvalCredentialId }
          : { mode: this.draft.approvalMode };
        const costRates = { perVcpu: this.draft.costPerVcpu, perGiBRam: this.draft.costPerGiBRam, perGiBDisk: this.draft.costPerGiBDisk };
        Object.keys(costRates).forEach((key) => { if (costRates[key] === null || costRates[key] === '') delete costRates[key]; });
        const payload = { ...this.draft, approvalPolicy, subscriberFields, fixedVariables, costRates, targetPoolRefs, maxActivePerSubscriber: this.draft.maxActivePerSubscriber || null, leaseDurationHours: this.draft.leaseDurationHours || null };
        if (this.editingId) await api.updateCatalogEntry(this.editingId, payload);
        else await api.createCatalogEntry(payload);
        this.successMessage = `${this.draft.title} was ${this.editingId ? 'updated' : 'added to the catalog'}.`;
        this.closeEditor();
        await this.load();
      } catch (error) {
        this.errorMessage = error.message || 'Unable to create the application.';
      } finally {
        this.saving = false;
      }
    },
    async deleteEntry(entry) {
      if (!window.confirm(`Retire ${entry.title}? Its existing requests will also be removed.`)) return;
      try { await api.deleteCatalogEntry(entry.id); this.successMessage = `${entry.title} was retired.`; await this.load(); }
      catch (error) { this.errorMessage = error.message || 'Unable to retire the application.'; }
    },
    async loadVersions(entry) {
      this.errorMessage = '';
      try { const result = await api.getCatalogEntryVersions(entry.id); this.versions = result.versions || []; this.showVersions = true; }
      catch (error) { this.errorMessage = error.message || 'Unable to load application versions.'; }
    },
    async validateEntry(entry, validationStatus) {
      this.errorMessage = '';
      try { await api.validateCatalogEntryVersion(entry.id, entry.currentVersion.id, { validationStatus }); this.successMessage = `${entry.title} version ${entry.currentVersion.version_number} validated.`; await this.load(); }
      catch (error) { this.errorMessage = error.message || 'Unable to validate the application version.'; }
    },
    async publishEntry(entry) {
      this.errorMessage = '';
      try { await api.publishCatalogEntry(entry.id); this.successMessage = `${entry.title} published to the catalog.`; await this.load(); }
      catch (error) { this.errorMessage = error.message || 'Unable to publish the application version.'; }
    },
    async reviewRequest(request, status) {
      this.errorMessage = '';
      try {
        await api.reviewCatalogRequest(request.id, status);
        this.successMessage = `${request.title} request ${status}.`;
        await this.load();
      } catch (error) {
        this.errorMessage = error.message || 'Unable to review the catalog request.';
      }
    },
    approvedStepCount(request) { return (request.approvalSteps || []).filter((step) => step.status === 'approved').length; },
    currentApprovalStep(request) { return (request.approvalSteps || []).find((step) => step.status === 'pending') || null; },
    async deployRequest(request) {
      this.errorMessage = '';
      try {
        await api.deployCatalogRequest(request.id);
        this.successMessage = `${request.title} deployment started.`;
        await this.load();
      } catch (error) {
        this.errorMessage = error.message || 'Unable to deploy the catalog request.';
      }
    },
  },
};
