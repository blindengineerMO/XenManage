function buildNetworkVlanDraft() {
  return {
    networkRef: '',
    pifRef: '',
    tag: 100,
  };
}

const NetworkVlanCreateForm = {
  props: ['networkOptions', 'pifOptions', 'submitLabel', 'saving'],
  emits: ['submit'],
  template: `
    <form @submit.prevent="handleSubmit">
      <div class="vm-inline-form-grid">
        <div class="form-group">
          <label for="network-vlan-network">Target Network</label>
          <select id="network-vlan-network" class="form-input" v-model="draft.networkRef" required>
            <option value="" disabled>Select network</option>
            <option v-for="option in networkOptions || []" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </div>

        <div class="form-group">
          <label for="network-vlan-pif">Tagged Host Uplink</label>
          <select id="network-vlan-pif" class="form-input" v-model="draft.pifRef" required>
            <option value="" disabled>Select tagged uplink</option>
            <option v-for="option in pifOptions || []" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </div>
      </div>

      <div class="form-group">
        <label for="network-vlan-tag">VLAN ID</label>
        <input id="network-vlan-tag"
               class="form-input"
               v-model.number="draft.tag"
               type="number"
               min="1"
               max="4094"
               required>
      </div>

      <div class="text-muted mono" style="font-size:11px;margin-bottom:12px">
        Xen will tag traffic on the selected host uplink and map the resulting VLAN path onto the chosen network object.
      </div>

      <div class="form-error" v-if="validationError" style="text-align:left;margin-bottom:12px">{{ validationError }}</div>

      <button class="form-btn" type="submit" :disabled="saving || !networkOptions?.length || !pifOptions?.length">
        <span class="mdi mdi-tag-outline"></span>
        {{ saving ? 'Submitting...' : (submitLabel || 'Create VLAN') }}
      </button>
    </form>
  `,
  data() {
    return {
      draft: buildNetworkVlanDraft(),
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
    pifOptions: {
      deep: true,
      immediate: true,
      handler(options) {
        if (!this.draft.pifRef && Array.isArray(options) && options.length) {
          this.draft.pifRef = options[0].value;
        }
      },
    },
  },
  methods: {
    handleSubmit() {
      const tag = Number(this.draft.tag || 0);
      if (!Number.isInteger(tag) || tag < 1 || tag > 4094) {
        this.validationError = 'VLAN ID must be an integer between 1 and 4094.';
        return;
      }

      this.validationError = '';
      this.$emit('submit', {
        networkRef: String(this.draft.networkRef || '').trim(),
        pifRef: String(this.draft.pifRef || '').trim(),
        tag,
      });
      this.draft = buildNetworkVlanDraft();
      if (Array.isArray(this.networkOptions) && this.networkOptions.length) {
        this.draft.networkRef = this.networkOptions[0].value;
      }
      if (Array.isArray(this.pifOptions) && this.pifOptions.length) {
        this.draft.pifRef = this.pifOptions[0].value;
      }
    },
  },
};
