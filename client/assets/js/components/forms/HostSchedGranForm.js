function buildHostSchedGranDraft(value = {}) {
  return {
    schedGran: value.sched_gran || value.schedGran || 'cpu',
  };
}

const HostSchedGranForm = {
  props: ['initialValue', 'submitLabel', 'saving'],
  emits: ['submit'],
  template: `
    <form @submit.prevent="handleSubmit">
      <div class="form-group">
        <label for="host-sched-gran">Scheduler Granularity</label>
        <select id="host-sched-gran"
                class="form-select"
                v-model="draft.schedGran">
          <option value="cpu">CPU scheduling</option>
          <option value="core">Core scheduling</option>
          <option value="socket">Socket scheduling</option>
        </select>
      </div>

      <div class="text-muted mono" style="font-size:11px;margin-bottom:12px">
        Adjust Xen scheduler granularity for the selected host. This affects how the hypervisor groups CPU scheduling decisions for resident workloads.
      </div>

      <button class="form-btn" type="submit" :disabled="saving">
        <span class="mdi mdi-content-save-outline"></span>
        {{ saving ? 'Saving...' : (submitLabel || 'Save Scheduler Policy') }}
      </button>
    </form>
  `,
  data() {
    return {
      draft: buildHostSchedGranDraft(this.initialValue),
    };
  },
  watch: {
    initialValue: {
      deep: true,
      handler(value) {
        this.draft = buildHostSchedGranDraft(value);
      },
    },
  },
  methods: {
    handleSubmit() {
      this.$emit('submit', {
        schedGran: String(this.draft.schedGran || 'cpu').trim() || 'cpu',
      });
    },
  },
};
