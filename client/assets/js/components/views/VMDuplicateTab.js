const VMDuplicateTab = {
  components: {
    'vm-duplicate-form': VMDuplicateForm,
  },
  props: ['model'],
  emits: ['submit'],
  methods: {
    handleSubmit(payload) {
      this.$emit('submit', payload);
    },
  },
  template: `
    <div>
      <div class="dashboard-panels">
        <div class="dash-card">
          <div class="dash-card-label">Create Clone or Full Copy</div>
          <p class="text-muted" style="margin-bottom:12px">
            Provision a fast Copy-on-Write clone for rapid testing, or a full copy when you need isolated disks and explicit storage placement.
          </p>
          <vm-duplicate-form
            :initial-value="model.vm"
            :storage-options="model.storageOptions"
            :submit-label="'Create VM Copy'"
            :saving="model.saving"
            @submit="handleSubmit">
          </vm-duplicate-form>
        </div>

        <div class="dash-card">
          <div class="dash-card-label">Duplication Guidance</div>
          <div class="stack-list">
            <div class="stack-item">
              <div>
                <strong>Source Readiness</strong>
                <div class="text-muted mono" style="font-size:11px">
                  XenAPI clone and copy operations require the source VM to be halted before provisioning begins.
                </div>
              </div>
              <span class="badge" :class="model.sourceReady ? 'badge-running' : 'badge-warning'">
                {{ model.sourceReadyBadge }}
              </span>
            </div>
            <div class="stack-item">
              <div>
                <strong>Mode Selection</strong>
                <div class="text-muted mono" style="font-size:11px">
                  Fast clone keeps disks on a CoW chain for speed, while full copy breaks out full disks onto a selected SR.
                </div>
              </div>
              <span class="badge badge-info">parity</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
};
