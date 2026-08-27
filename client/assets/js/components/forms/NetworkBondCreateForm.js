function buildNetworkBondDraft() {
  return {
    networkRef: '',
    pifRefs: [],
    mode: 'balance-slb',
  };
}

const NetworkBondCreateForm = {
  props: ['networkOptions', 'pifOptions', 'submitLabel', 'saving'],
  emits: ['submit'],
  template: `
    <form @submit.prevent="handleSubmit">
      <div class="form-group">
        <label for="network-bond-network">Target Network</label>
        <select id="network-bond-network" class="form-input" v-model="draft.networkRef" required>
          <option value="" disabled>Select network</option>
          <option v-for="option in networkOptions || []" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
      </div>

      <div class="vm-inline-form-grid">
        <div class="form-group">
          <label for="network-bond-mode">Bond Mode</label>
          <select id="network-bond-mode" class="form-input" v-model="draft.mode">
            <option value="balance-slb">balance-slb</option>
            <option value="active-backup">active-backup</option>
            <option value="lacp">lacp</option>
          </select>
        </div>

        <div class="form-group">
          <label for="network-bond-members">Bond Members</label>
          <select id="network-bond-members"
                  class="form-input"
                  v-model="draft.pifRefs"
                  multiple
                  size="6">
            <option v-for="option in pifOptions || []" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </div>
      </div>

      <div class="text-muted" style="font-size:12px;margin-bottom:12px">
        Hold Ctrl or Command to select multiple uplinks. Choose at least two `PIF`s that belong to the same host path before submitting the bond request.
      </div>

      <div class="form-error" v-if="validationError" style="text-align:left;margin-bottom:12px">{{ validationError }}</div>

      <button class="form-btn" type="submit" :disabled="saving || !networkOptions?.length || (pifOptions?.length || 0) < 2">
        <span class="mdi mdi-ethernet-cable"></span>
        {{ saving ? 'Submitting...' : (submitLabel || 'Create Bond') }}
      </button>
    </form>
  `,
  data() {
    return {
      draft: buildNetworkBondDraft(),
      validationError: '',
    };
  },
  watch: {
    networkOptions: {
      deep: true,
      immediate: true,
      handler(options) {
        if (!this.draft.networkRef && Array.isArray(options) && options.length) {
          this.draft.networkRef = options[0].value;
        }
      },
    },
  },
  methods: {
    handleSubmit() {
      const members = Array.isArray(this.draft.pifRefs)
        ? this.draft.pifRefs.map((value) => String(value || '').trim()).filter(Boolean)
        : [];

      if (members.length < 2) {
        this.validationError = 'Select at least two uplinks before creating a bond.';
        return;
      }

      this.validationError = '';
      this.$emit('submit', {
        networkRef: String(this.draft.networkRef || '').trim(),
        pifRefs: members,
        mode: String(this.draft.mode || 'balance-slb').trim(),
      });
      this.draft = buildNetworkBondDraft();
      if (Array.isArray(this.networkOptions) && this.networkOptions.length) {
        this.draft.networkRef = this.networkOptions[0].value;
      }
    },
  },
};
