const VMAddDevicesTab = {
  components: {
    'vm-device-form': VMDeviceForm,
  },
  props: ['model'],
  emits: ['submit-disk', 'submit-nic'],
  methods: {
    handleDiskSubmit(payload) {
      this.$emit('submit-disk', payload);
    },
    handleNicSubmit(payload) {
      this.$emit('submit-nic', payload);
    },
  },
  template: `
    <div class="dashboard-panels">
      <div class="dash-card">
        <div class="dash-card-label">Add Virtual Disk</div>
        <p class="text-muted" style="margin-bottom:12px">Create and attach an additional VDI to this workload from an available storage repository.</p>
        <vm-device-form
          mode="disk"
          :storage-options="model.storageOptions"
          :network-options="[]"
          :submit-label="'Add Disk Device'"
          :saving="model.diskSaving"
          @submit="handleDiskSubmit">
        </vm-device-form>
      </div>

      <div class="dash-card">
        <div class="dash-card-label">Add Network Interface</div>
        <p class="text-muted" style="margin-bottom:12px">Attach an additional virtual NIC to an available network fabric for the current pool or environment.</p>
        <vm-device-form
          mode="nic"
          :storage-options="[]"
          :network-options="model.networkOptions"
          :submit-label="'Add Network Device'"
          :saving="model.nicSaving"
          @submit="handleNicSubmit">
        </vm-device-form>
      </div>
    </div>
  `,
};
