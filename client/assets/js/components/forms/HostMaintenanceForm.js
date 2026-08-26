function buildHostMaintenanceDraft(initialValue = {}, networkOptions = []) {
  const normalizedNetworkOptions = Array.isArray(networkOptions) ? networkOptions : [];
  const preferredNetworkRef = initialValue.networkRef
    || initialValue.maintenanceNetworkRef
    || initialValue.poolMigrationNetworkRef
    || normalizedNetworkOptions[0]?.ref
    || '';

  return {
    networkRef: preferredNetworkRef,
    evacuateBatchSize: Number(initialValue.evacuateBatchSize || 0),
    evacuateRunningVms: initialValue.evacuateRunningVms !== false,
  };
}

const HostMaintenanceForm = {
  props: ['initialValue', 'networkOptions', 'saving', 'submitLabel'],
  emits: ['submit'],
  template: `
    <form @submit.prevent="handleSubmit">
      <div class="vm-inline-form-grid">
        <div class="form-group">
          <label for="host-maint-network">Migration Network</label>
          <select id="host-maint-network" class="form-input" v-model="draft.networkRef" :disabled="!draft.evacuateRunningVms">
            <option value="">Select migration network</option>
            <option v-for="network in normalizedNetworkOptions" :key="network.ref" :value="network.ref">
              {{ network.name_label || network.bridge || network.ref }}
            </option>
          </select>
        </div>

        <div class="form-group">
          <label for="host-maint-batch">Evacuation Batch Size</label>
          <input id="host-maint-batch"
                 class="form-input"
                 type="number"
                 min="0"
                 max="64"
                 step="1"
                 v-model.number="draft.evacuateBatchSize">
        </div>
      </div>

      <label class="form-toggle">
        <input type="checkbox" v-model="draft.evacuateRunningVms">
        <span>Evacuate running VMs before finishing maintenance mode</span>
      </label>

      <div class="text-muted mono" style="font-size:11px;margin-top:10px">
        Choose the migration network used during workload evacuation. Leave batch size at 0 to let XenServer use the host default.
      </div>

      <div class="form-actions">
        <button class="form-btn" type="submit" :disabled="saving">
          <span class="mdi mdi-wrench-clock"></span>
          {{ saving ? 'Applying...' : (submitLabel || 'Enter Maintenance Mode') }}
        </button>
      </div>
    </form>
  `,
  computed: {
    normalizedNetworkOptions() {
      return Array.isArray(this.networkOptions) ? this.networkOptions : [];
    },
  },
  data() {
    return {
      draft: buildHostMaintenanceDraft(this.initialValue, this.networkOptions),
    };
  },
  watch: {
    initialValue: {
      deep: true,
      handler(value) {
        this.draft = buildHostMaintenanceDraft(value, this.networkOptions);
      },
    },
    networkOptions: {
      deep: true,
      handler(value) {
        this.draft = buildHostMaintenanceDraft(this.initialValue || this.draft, value);
      },
    },
  },
  methods: {
    handleSubmit() {
      this.$emit('submit', {
        networkRef: this.draft.evacuateRunningVms ? String(this.draft.networkRef || '').trim() : '',
        evacuateBatchSize: Math.max(0, Number(this.draft.evacuateBatchSize || 0)),
        evacuateRunningVms: Boolean(this.draft.evacuateRunningVms),
      });
    },
  },
};
