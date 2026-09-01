const AddTargetWindow = {
  components: {
    FloatingWindow,
    PoolRegistrationForm,
    HostRegistrationForm,
  },
  props: {
    show: { type: Boolean, default: false },
  },
  emits: ['close'],
  template: `
    <floating-window :show="show" title="Add Target" :width="740" :height="620" @close="$emit('close')">
      <div class="detail-section" style="margin-top:0">
        <div class="detail-section-title">Target Type</div>
        <div class="target-type-switcher" role="tablist" aria-label="Target type">
          <button type="button" class="target-type-button" :class="{ active: targetType === 'pool' }" @click="targetType = 'pool'">
            <span class="mdi mdi-source-branch"></span>
            Pool
            <small>Register a Xen pool coordinator</small>
          </button>
          <button type="button" class="target-type-button" :class="{ active: targetType === 'host' }" @click="targetType = 'host'">
            <span class="mdi mdi-server"></span>
            Standalone Host
            <small>Register a single Xen host</small>
          </button>
        </div>
        <p class="text-muted" style="margin:14px 0 18px;line-height:1.6">
          {{ targetType === 'pool'
            ? 'Save a pool coordinator for future connections and multi-pool operations.'
            : 'Save an independent host, or queue it as a member of a registered pool.' }}
        </p>

        <pool-registration-form
          v-if="targetType === 'pool'"
          :key="`pool-${formKey}`"
          :initial-value="{}"
          :credential-options="credentials"
          submit-label="Save Pool Target"
          @submit="savePoolTarget">
        </pool-registration-form>

        <host-registration-form
          v-else
          :key="`host-${formKey}`"
          :initial-value="{}"
          :pool-options="poolOptions"
          :credential-options="credentials"
          submit-label="Save Host Target"
          @submit="saveHostTarget">
        </host-registration-form>

        <div class="form-error" v-if="error" style="text-align:left;margin-top:12px">{{ error }}</div>
        <div class="stack-item" v-if="successMessage" style="margin-top:12px">
          <div>
            <strong>Target saved</strong>
            <div class="text-muted mono" style="font-size:11px">{{ successMessage }}</div>
          </div>
          <span class="badge badge-success">ready</span>
        </div>
      </div>
    </floating-window>
  `,
  data() {
    return {
      targetType: 'pool',
      poolOptions: [],
      credentials: [],
      error: '',
      successMessage: '',
      formKey: 0,
    };
  },
  watch: {
    show(value) {
      if (value) this.loadContext();
    },
  },
  methods: {
    async loadContext() {
      this.error = '';
      this.successMessage = '';
      const [connectionsResult, credentialsResult] = await Promise.allSettled([
        api.getConnections(),
        api.getCredentials(),
      ]);
      const connections = connectionsResult.status === 'fulfilled' ? connectionsResult.value : null;
      const credentials = credentialsResult.status === 'fulfilled' ? credentialsResult.value : null;

      this.poolOptions = Array.isArray(connections?.data) ? connections.data : [];
      this.credentials = Array.isArray(credentials?.data) ? credentials.data : [];

      if (connectionsResult.status === 'rejected') {
        this.error = 'Saved pool targets are unavailable. You can still register a target with manual credentials.';
      }
    },
    async savePoolTarget(payload) {
      this.error = '';
      this.successMessage = '';
      try {
        const record = await api.saveConnection(payload);
        this.poolOptions = [...this.poolOptions, record];
        this.successMessage = `${record.name || payload.name} is ready to connect.`;
        this.formKey += 1;
      } catch (error) {
        this.error = error.message || 'Unable to save the pool target.';
      }
    },
    async saveHostTarget(payload) {
      this.error = '';
      this.successMessage = '';
      try {
        const record = await api.saveHostTarget(payload);
        this.successMessage = `${record.name || payload.name} is ready to connect.`;
        this.formKey += 1;
      } catch (error) {
        this.error = error.message || 'Unable to save the host target.';
      }
    },
  },
};
