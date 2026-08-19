const VMDeviceForm = {
  props: ['mode', 'storageOptions', 'networkOptions', 'submitLabel', 'saving'],
  emits: ['submit'],
  template: `
    <form @submit.prevent="handleSubmit">
      <template v-if="mode === 'disk'">
        <div class="form-group">
          <label for="vm-disk-sr">Storage Repository</label>
          <select id="vm-disk-sr" class="form-input" v-model="draft.srRef" required>
            <option value="" disabled>Select storage</option>
            <option v-for="sr in storageOptions" :key="sr.ref" :value="sr.ref">
              {{ sr.name_label || sr.ref }} · {{ sr.type || 'storage' }}
            </option>
          </select>
        </div>

        <div class="form-group">
          <label for="vm-disk-name">Disk Name</label>
          <input id="vm-disk-name" class="form-input" v-model="draft.nameLabel" placeholder="data-disk-02" required>
        </div>

        <div class="form-group">
          <label for="vm-disk-size">Capacity (GiB)</label>
          <input id="vm-disk-size" class="form-input" v-model.number="draft.sizeGiB" type="number" min="1" step="1" required>
        </div>
      </template>

      <template v-else>
        <div class="form-group">
          <label for="vm-nic-network">Network</label>
          <select id="vm-nic-network" class="form-input" v-model="draft.networkRef" required>
            <option value="" disabled>Select network</option>
            <option v-for="network in networkOptions" :key="network.ref" :value="network.ref">
              {{ network.name_label || network.bridge || network.ref }}
            </option>
          </select>
        </div>

        <div class="vm-inline-form-grid">
          <div class="form-group">
            <label for="vm-nic-device">Device Slot</label>
            <input id="vm-nic-device" class="form-input" v-model="draft.deviceLabel" placeholder="1">
          </div>

          <div class="form-group">
            <label for="vm-nic-mac">MAC Address</label>
            <input id="vm-nic-mac" class="form-input" v-model="draft.mac" placeholder="Auto / optional">
          </div>
        </div>
      </template>

      <button class="form-btn" type="submit" :disabled="saving">
        <span class="mdi" :class="mode === 'disk' ? 'mdi-harddisk-plus' : 'mdi-lan-connect'"></span>
        {{ saving ? 'Submitting...' : submitLabel }}
      </button>
    </form>
  `,
  data() {
    return {
      draft: this.buildDraft(),
    };
  },
  watch: {
    mode() {
      this.draft = this.buildDraft();
    },
    storageOptions: {
      deep: true,
      handler() {
        if (this.mode === 'disk' && !this.draft.srRef && this.storageOptions.length) {
          this.draft.srRef = this.storageOptions[0].ref;
        }
      },
    },
    networkOptions: {
      deep: true,
      handler() {
        if (this.mode === 'nic' && !this.draft.networkRef && this.networkOptions.length) {
          this.draft.networkRef = this.networkOptions[0].ref;
        }
      },
    },
  },
  methods: {
    buildDraft() {
      return {
        srRef: this.storageOptions?.[0]?.ref || '',
        nameLabel: '',
        sizeGiB: 20,
        networkRef: this.networkOptions?.[0]?.ref || '',
        deviceLabel: '',
        mac: '',
      };
    },
    handleSubmit() {
      if (this.mode === 'disk') {
        this.$emit('submit', {
          srRef: this.draft.srRef,
          nameLabel: this.draft.nameLabel.trim(),
          sizeBytes: Math.max(1, Number(this.draft.sizeGiB || 1)) * (1024 ** 3),
        });
        this.draft = this.buildDraft();
        return;
      }

      this.$emit('submit', {
        networkRef: this.draft.networkRef,
        deviceLabel: this.draft.deviceLabel.trim(),
        mac: this.draft.mac.trim(),
      });
      this.draft = this.buildDraft();
    },
  },
};
