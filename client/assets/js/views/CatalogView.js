const CatalogView = {
  components: { FloatingWindow },
  template: `
    <div class="catalog-storefront animate-fade-in">
      <header class="catalog-masthead">
        <a class="catalog-brand" href="/catalog" aria-label="XenMange Application Catalog"><img src="/assets/images/logo.svg" alt=""><span>XENMANGE</span><small>APPLICATION CATALOG</small></a>
        <div class="catalog-masthead-actions">
          <button v-if="store.authenticated" class="btn btn-sm" @click="loadRequests">My Requests</button>
          <button v-else class="btn btn-sm" @click="signIn">Subscriber Sign In</button>
          <button class="btn btn-primary" @click="loadCatalog" :disabled="loading"><span class="mdi mdi-refresh"></span> Refresh</button>
        </div>
      </header>

      <main class="catalog-view">
        <section class="catalog-hero">
          <div class="catalog-eyebrow"><span class="mdi mdi-storefront-outline"></span> Self-Service Infrastructure</div>
          <h1>Published applications,<br><em>ready to request.</em></h1>
          <p>Choose an approved application. XenMange applies the placement, network, storage, and governance standards behind the scenes.</p>
          <div class="catalog-hero-meta"><span><b>{{ entries.length }}</b> available applications</span><span>Curated by your cloud platform team</span></div>
        </section>

        <div v-if="errorMessage" class="alert alert-error">{{ errorMessage }}</div>
        <div v-if="successMessage" class="alert alert-success">{{ successMessage }}</div>

        <section class="catalog-grid" v-if="!loading && entries.length" aria-label="Available applications">
        <button class="catalog-card" v-for="entry in entries" :key="entry.id" @click="selectEntry(entry)">
          <img v-if="entry.image_url" :src="entry.image_url" alt="">
          <div v-else class="catalog-card-icon"><span class="mdi mdi-cube-outline"></span></div>
          <div class="dash-card-label">{{ entry.category || 'Application' }}</div>
          <div class="dash-card-value" style="font-size:18px">{{ entry.title }}</div>
          <div class="text-muted" style="font-size:12px;margin-top:8px">{{ entry.description || 'Curated self-service deployment.' }}</div>
          <div class="catalog-card-footer">
            <span class="badge badge-info" v-for="tag in entry.tags || []" :key="tag">{{ tag }}</span>
            <span class="badge badge-warning" v-if="entry.requiresApproval">Approval</span>
            <span class="catalog-card-action">Request <span class="mdi mdi-arrow-right"></span></span>
          </div>
        </button>
        </section>
        <div v-else-if="!loading" class="empty-state">No published catalog applications are available.</div>
        <div v-else class="empty-state"><span class="loading-spinner"></span> Loading catalog...</div>
      </main>

      <floating-window v-if="selectedEntry" :title="'Request ' + selectedEntry.title" :show="Boolean(selectedEntry)" :width="640" :height="440" :x="170" :y="88" @close="selectedEntry = null">
        <div class="dash-card-label">Application Request</div>
        <p class="text-muted" style="margin:8px 0 16px">{{ selectedEntry.description || 'Provide the fields approved by the catalog curator.' }}</p>
        <div class="form-grid">
          <div class="form-group" v-for="field in selectedEntry.subscriberFields || []" :key="field.key">
            <label :for="'catalog-field-' + field.key">{{ field.label }}<span v-if="field.required"> *</span></label>
            <select v-if="field.type === 'select'" class="form-select" :id="'catalog-field-' + field.key" v-model="requestParameters[field.key]">
              <option value="">Select {{ field.label }}</option>
              <option v-for="option in field.options || []" :key="option" :value="option">{{ option }}</option>
            </select>
            <input v-else :id="'catalog-field-' + field.key" class="form-input" :type="field.type === 'number' ? 'number' : field.type === 'boolean' ? 'checkbox' : 'text'" v-model="requestParameters[field.key]">
          </div>
        </div>
        <div class="text-muted mono" style="font-size:11px;margin:10px 0" v-if="selectedEntry.maxActivePerSubscriber">
          Limited to {{ selectedEntry.maxActivePerSubscriber }} active request{{ selectedEntry.maxActivePerSubscriber === 1 ? '' : 's' }} per subscriber.
        </div>
        <div class="catalog-hero-meta" style="margin:8px 0 14px" v-if="selectedEstimate !== null"><span>Estimated monthly cost <b>{{ formatCost(selectedEstimate) }}</b></span></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-primary" @click="submitRequest" :disabled="submitting">
            {{ submitting ? 'Submitting...' : store.authenticated ? 'Submit Request' : 'Sign in to Request' }}
          </button>
          <button class="btn btn-sm" @click="selectedEntry = null">Close</button>
        </div>
      </floating-window>

      <floating-window title="My Requests" :show="showRequests" :width="620" :height="440" :x="210" :y="100" @close="showRequests = false">
        <div class="dash-card-label">My Requests</div>
        <div class="stack-list" v-if="requests.length">
          <div class="stack-item" v-for="request in requests" :key="request.id">
            <div><strong>{{ request.title }}</strong><div class="text-muted mono" style="font-size:11px">{{ request.generated_name || 'Awaiting approval' }}<span v-if="request.approvalSteps?.length"> · {{ request.approvalSteps.filter((step) => step.status === 'approved').length }}/{{ request.approvalSteps.length }} approvals</span><span v-if="request.estimated_monthly_cost !== null"> · estimate {{ formatCost(request.estimated_monthly_cost) }}/mo</span><span v-if="request.actual_monthly_cost !== null"> · showback {{ formatCost(request.actual_monthly_cost) }}/mo</span><span v-if="request.lease_expires_at"> · lease {{ request.status === 'expired' ? 'expired' : 'ends' }} {{ new Date(request.lease_expires_at).toLocaleString() }}</span></div><div v-if="request.approvalSteps?.length" class="catalog-approval-chain"><span v-for="step in request.approvalSteps" :key="step.id" class="badge" :class="step.status === 'approved' ? 'badge-success' : step.status === 'rejected' ? 'badge-danger' : 'badge-info'">{{ step.label }}</span></div></div>
            <div style="display:flex;gap:5px;flex-wrap:wrap;justify-content:flex-end"><span class="badge" :class="request.status === 'expired' ? 'badge-danger' : 'badge-info'">{{ request.status }}</span><template v-if="request.status === 'complete'"><button class="btn btn-sm" @click="runDay2(request, 'start')">Start</button><button class="btn btn-sm" @click="runDay2(request, 'stop')">Stop</button><button class="btn btn-sm" @click="runDay2(request, 'reboot')">Reboot</button><button class="btn btn-sm" @click="openResize(request)">Resize</button><button class="btn btn-sm" @click="runDay2(request, 'snapshot')">Snapshot</button></template><button v-if="['complete', 'expired'].includes(request.status)" class="btn btn-sm btn-danger" @click="runDay2(request, 'decommission')">Decommission</button></div>
          </div>
        </div>
        <div v-else class="empty-state">No catalog requests yet.</div>
      </floating-window>

      <floating-window title="Resize Catalog Deployment" :show="Boolean(resizeTarget)" :width="460" :height="260" :x="230" :y="120" @close="resizeTarget = null">
        <div class="form-grid">
          <div class="form-group"><label>Virtual CPUs</label><input class="form-input" type="number" min="1" max="256" v-model.number="resizeDraft.vcpus"></div>
          <div class="form-group"><label>Memory (GiB)</label><input class="form-input" type="number" min="0.25" max="4096" step="0.25" v-model.number="resizeDraft.memoryGiB"></div>
        </div>
        <div style="display:flex;gap:8px"><button class="btn btn-primary" @click="submitResize">Apply Resize</button><button class="btn btn-sm" @click="resizeTarget = null">Cancel</button></div>
      </floating-window>
    </div>
  `,
  data() {
    return { store, entries: [], requests: [], selectedEntry: null, resizeTarget: null, resizeDraft: { vcpus: 2, memoryGiB: 4 }, requestParameters: {}, loading: false, submitting: false, showRequests: false, errorMessage: '', successMessage: '' };
  },
  computed: {
    selectedEstimate() {
      if (!this.selectedEntry || !Object.keys(this.selectedEntry.costRates || {}).length) return null;
      const values = { ...(this.selectedEntry.costBasis || {}), ...(this.requestParameters || {}) };
      const rates = this.selectedEntry.costRates;
      const vcpus = Number(values.vcpus || values.VCPUs || 0);
      const memoryGiB = Number(values.memoryGiB ?? (Number(values.memoryStaticMax || 0) / (1024 ** 3)));
      const diskGiB = Number(values.diskGiB ?? values.diskSizeGiB ?? values.diskSizeGb ?? values.storageGiB ?? 0);
      return Math.round(((vcpus * (rates.perVcpu || 0)) + (memoryGiB * (rates.perGiBRam || 0)) + (diskGiB * (rates.perGiBDisk || 0))) * 100) / 100;
    },
  },
  async mounted() {
    await this.loadCatalog();
  },
  methods: {
    formatCost(value) { return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(Number(value || 0)); },
    async loadCatalog() {
      this.loading = true;
      this.errorMessage = '';
      try {
        const result = await api.getCatalog();
        this.entries = result.entries || [];
      } catch (error) {
        this.errorMessage = error.message || 'Unable to load the catalog.';
      } finally {
        this.loading = false;
      }
    },
    selectEntry(entry) {
      this.selectedEntry = entry;
      this.requestParameters = Object.fromEntries((entry.subscriberFields || []).map((field) => [field.key, field.default ?? (field.type === 'boolean' ? false : '')]));
      this.successMessage = '';
    },
    async submitRequest() {
      if (!store.authenticated) {
        this.$router.push('/login');
        return;
      }
      this.submitting = true;
      this.errorMessage = '';
      try {
        await api.submitCatalogRequest(this.selectedEntry.slug, this.requestParameters);
        this.successMessage = `${this.selectedEntry.title} request submitted.`;
        this.selectedEntry = null;
        await this.loadRequests();
      } catch (error) {
        this.errorMessage = error.message || 'Unable to submit the request.';
      } finally {
        this.submitting = false;
      }
    },
    async loadRequests() {
      if (!store.authenticated) return;
      this.showRequests = true;
      try {
        const result = await api.getMyCatalogRequests();
        this.requests = result.requests || [];
      } catch (error) {
        this.errorMessage = error.message || 'Unable to load catalog requests.';
      }
    },
    async runDay2(request, action) {
      this.errorMessage = '';
      try { await api.runCatalogDay2Action(request.id, { action }); this.successMessage = `${request.title} ${action} completed.`; await this.loadRequests(); }
      catch (error) { this.errorMessage = error.message || `Unable to ${action} the catalog deployment.`; }
    },
    openResize(request) { this.resizeTarget = request; this.resizeDraft = { vcpus: 2, memoryGiB: 4 }; },
    async submitResize() {
      if (!this.resizeTarget) return;
      try { await api.runCatalogDay2Action(this.resizeTarget.id, { action: 'resize', ...this.resizeDraft }); this.successMessage = `${this.resizeTarget.title} resized.`; this.resizeTarget = null; await this.loadRequests(); }
      catch (error) { this.errorMessage = error.message || 'Unable to resize the catalog deployment.'; }
    },
    signIn() {
      this.$router.push({ path: '/login', query: { returnTo: this.$route.path } });
    },
  },
};
