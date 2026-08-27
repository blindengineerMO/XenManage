function buildPoolHaDraft(initialValue = {}, storageOptions = []) {
  const normalizedStorageOptions = Array.isArray(storageOptions) ? storageOptions : [];
  const preferredHeartbeatSrRef = initialValue.heartbeatSrRef
    || initialValue.default_SR
    || normalizedStorageOptions[0]?.value
    || '';

  return {
    heartbeatSrRef: preferredHeartbeatSrRef,
    haHostFailuresToTolerate: Number.isFinite(Number(initialValue.ha_host_failures_to_tolerate))
      ? Number(initialValue.ha_host_failures_to_tolerate)
      : 1,
  };
}

const PoolHaForm = {
  props: ['initialValue', 'storageOptions', 'saving', 'submitLabel'],
  emits: ['submit'],
  template: `
    <form @submit.prevent="handleSubmit">
      <div class="form-group" v-if="!isCurrentlyEnabled">
        <label for="pool-ha-heartbeat-sr">Heartbeat Storage Repository</label>
        <select id="pool-ha-heartbeat-sr" class="form-input" v-model="draft.heartbeatSrRef">
          <option value="">Select heartbeat SR</option>
          <option v-for="option in normalizedStorageOptions" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
      </div>

      <div class="form-group">
        <label for="pool-ha-tolerance">Host Failures To Tolerate</label>
        <input id="pool-ha-tolerance"
               class="form-input"
               type="number"
               min="0"
               max="32"
               step="1"
               v-model.number="draft.haHostFailuresToTolerate">
      </div>

      <div class="text-muted mono" style="font-size:11px;margin-bottom:12px">
        <template v-if="isCurrentlyEnabled">
          Adjust the planner target here without tearing HA down. Disabling HA still stops automatic restart handling after host failure until the pool is re-enabled.
        </template>
        <template v-else>
          Enabling HA requires a shared or otherwise suitable heartbeat SR for storage heartbeating. The tolerance target controls how many host failures the planner should be able to absorb.
        </template>
      </div>

      <div class="form-actions">
        <button class="form-btn" type="submit" :disabled="saving || (!isCurrentlyEnabled && !draft.heartbeatSrRef)">
          <span class="mdi" :class="isCurrentlyEnabled ? 'mdi-shield-sync-outline' : 'mdi-shield-check-outline'"></span>
          {{ saving ? 'Applying...' : (submitLabel || (isCurrentlyEnabled ? 'Save HA Settings' : 'Enable HA')) }}
        </button>
        <button v-if="isCurrentlyEnabled"
                class="form-btn form-btn-secondary"
                type="button"
                :disabled="saving"
                @click="disableHa">
          <span class="mdi mdi-shield-off-outline"></span>
          Disable HA
        </button>
      </div>
    </form>
  `,
  computed: {
    normalizedStorageOptions() {
      return Array.isArray(this.storageOptions) ? this.storageOptions : [];
    },
    isCurrentlyEnabled() {
      return Boolean(this.initialValue?.ha_enabled);
    },
  },
  data() {
    return {
      draft: buildPoolHaDraft(this.initialValue, this.storageOptions),
    };
  },
  watch: {
    initialValue: {
      deep: true,
      handler(value) {
        this.draft = buildPoolHaDraft(value, this.storageOptions);
      },
    },
    storageOptions: {
      deep: true,
      handler(value) {
        this.draft = buildPoolHaDraft(this.initialValue || this.draft, value);
      },
    },
  },
  methods: {
    handleSubmit() {
      this.$emit('submit', {
        enabled: true,
        heartbeatSrRefs: this.isCurrentlyEnabled
          ? []
          : [String(this.draft.heartbeatSrRef || '').trim()].filter(Boolean),
        haHostFailuresToTolerate: Math.max(0, Number(this.draft.haHostFailuresToTolerate || 0)),
      });
    },
    disableHa() {
      this.$emit('submit', {
        enabled: false,
        heartbeatSrRefs: [],
        haHostFailuresToTolerate: Math.max(0, Number(this.draft.haHostFailuresToTolerate || 0)),
      });
    },
  },
};
