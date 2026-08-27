function buildNetworkVifAttachDraft(vmOptions = []) {
  return {
    vmRef: vmOptions[0]?.value || '',
    deviceLabel: '',
    mac: '',
  };
}

const NetworkVifAttachForm = {
  props: ['vmOptions', 'submitLabel', 'saving'],
  emits: ['submit'],
  template: `
    <form @submit.prevent="handleSubmit">
      <div class="form-group">
        <label for="network-vif-vm">Target VM</label>
        <select id="network-vif-vm" class="form-input" v-model="draft.vmRef" required>
          <option value="" disabled>Select VM</option>
          <option v-for="option in vmOptions || []" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
      </div>

      <div class="vm-inline-form-grid">
        <div class="form-group">
          <label for="network-vif-device">Device Slot</label>
          <input id="network-vif-device" class="form-input" v-model="draft.deviceLabel" placeholder="Auto / optional">
        </div>

        <div class="form-group">
          <label for="network-vif-mac">MAC Address</label>
          <input id="network-vif-mac" class="form-input" v-model="draft.mac" placeholder="Auto / optional">
        </div>
      </div>

      <div class="text-muted mono" style="font-size:11px;margin-bottom:12px">
        Attach a new virtual interface to the selected VM on this network. Leave the device slot and MAC empty to let Xen assign defaults.
      </div>

      <button class="form-btn" type="submit" :disabled="saving || !vmOptions?.length">
        <span class="mdi mdi-lan-connect"></span>
        {{ saving ? 'Submitting...' : (submitLabel || 'Attach VIF') }}
      </button>
    </form>
  `,
  data() {
    return {
      draft: buildNetworkVifAttachDraft(this.vmOptions),
    };
  },
  watch: {
    vmOptions: {
      deep: true,
      immediate: true,
      handler(options) {
        if (!this.draft.vmRef && Array.isArray(options) && options.length) {
          this.draft.vmRef = options[0].value;
        }
      },
    },
  },
  methods: {
    handleSubmit() {
      this.$emit('submit', {
        vmRef: String(this.draft.vmRef || '').trim(),
        deviceLabel: String(this.draft.deviceLabel || '').trim(),
        mac: String(this.draft.mac || '').trim(),
      });
      this.draft = buildNetworkVifAttachDraft(this.vmOptions);
    },
  },
};
