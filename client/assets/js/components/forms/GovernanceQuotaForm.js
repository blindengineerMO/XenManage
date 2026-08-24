function buildGovernanceQuotaDraft(initialValue = {}, poolRecord = {}) {
  return {
    enabled: initialValue.enabled !== false,
    owner: initialValue.owner || '',
    maxVmCount: Number(initialValue.maxVmCount || 0),
    maxRunningVmCount: Number(initialValue.maxRunningVmCount || 0),
    maxTotalMemoryGiB: Number(initialValue.maxTotalMemoryGiB || 0),
    notes: initialValue.notes || '',
    poolName: poolRecord.poolName || poolRecord.name_label || poolRecord.ref || '',
  };
}

const GovernanceQuotaForm = {
  props: ['initialValue', 'poolRecord', 'saving', 'submitLabel'],
  emits: ['submit'],
  template: `
    <form @submit.prevent="handleSubmit">
      <div class="vm-inline-form-grid">
        <div class="form-group">
          <label for="governance-quota-pool">Pool</label>
          <input id="governance-quota-pool" class="form-input" :value="draft.poolName" disabled>
        </div>

        <div class="form-group">
          <label for="governance-quota-owner">Owner</label>
          <input id="governance-quota-owner" class="form-input" v-model="draft.owner" placeholder="Platform Ops">
        </div>
      </div>

      <label class="form-toggle">
        <input type="checkbox" v-model="draft.enabled">
        <span>Enforce this pool quota</span>
      </label>

      <div class="vm-inline-form-grid">
        <div class="form-group">
          <label for="governance-quota-vms">Max VMs</label>
          <input id="governance-quota-vms" class="form-input" v-model.number="draft.maxVmCount" type="number" min="0" max="100000">
        </div>

        <div class="form-group">
          <label for="governance-quota-running">Max Running VMs</label>
          <input id="governance-quota-running" class="form-input" v-model.number="draft.maxRunningVmCount" type="number" min="0" max="100000">
        </div>
      </div>

      <div class="vm-inline-form-grid">
        <div class="form-group">
          <label for="governance-quota-memory">Max Memory (GiB)</label>
          <input id="governance-quota-memory" class="form-input" v-model.number="draft.maxTotalMemoryGiB" type="number" min="0" max="1048576">
        </div>
      </div>

      <div class="form-group">
        <label for="governance-quota-notes">Quota Notes</label>
        <textarea id="governance-quota-notes"
                  class="form-input form-textarea"
                  v-model="draft.notes"
                  rows="5"
                  placeholder="Track budget owners, exception rationale, or future growth notes for this pool."></textarea>
      </div>

      <div class="form-actions">
        <button class="form-btn" type="submit" :disabled="saving">
          <span class="mdi mdi-content-save-outline"></span>
          {{ saving ? 'Saving...' : (submitLabel || 'Save Pool Quota') }}
        </button>
      </div>
    </form>
  `,
  data() {
    return {
      draft: buildGovernanceQuotaDraft(this.initialValue, this.poolRecord),
    };
  },
  watch: {
    initialValue: {
      deep: true,
      handler(value) {
        this.draft = buildGovernanceQuotaDraft(value, this.poolRecord);
      },
    },
    poolRecord: {
      deep: true,
      handler(value) {
        this.draft = buildGovernanceQuotaDraft(this.initialValue, value);
      },
    },
  },
  methods: {
    handleSubmit() {
      this.$emit('submit', {
        enabled: Boolean(this.draft.enabled),
        owner: this.draft.owner.trim(),
        maxVmCount: Number(this.draft.maxVmCount || 0),
        maxRunningVmCount: Number(this.draft.maxRunningVmCount || 0),
        maxTotalMemoryGiB: Number(this.draft.maxTotalMemoryGiB || 0),
        notes: this.draft.notes.trim(),
      });
    },
  },
};
