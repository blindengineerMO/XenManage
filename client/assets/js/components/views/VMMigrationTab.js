const VMMigrationTab = {
  components: {
    'vm-migration-form': VMMigrationForm,
  },
  props: ['model'],
  emits: ['submit', 'destination-target-change'],
  methods: {
    handleSubmit(payload) {
      this.$emit('submit', payload);
    },
    handleDestinationTargetChange(targetKey) {
      this.$emit('destination-target-change', targetKey);
    },
  },
  template: `
    <div>
      <div class="dashboard-panels">
        <div class="dash-card">
          <div class="dash-card-label">Move Workload Placement</div>
          <p class="text-muted" style="margin-bottom:12px">
            Relocate a halted VM, live-migrate it within the current pool, or remap it across an attached destination fabric without leaving the VM details workspace.
          </p>
          <vm-migration-form
            :initial-value="model.vm"
            :initial-draft="model.initialDraft"
            :host-options="model.hostOptions"
            :destination-targets="model.destinationTargets"
            :destination-hosts="model.destinationHosts"
            :destination-storage-options="model.destinationStorageOptions"
            :destination-network-options="model.destinationNetworkOptions"
            :source-network-options="model.sourceNetworkOptions"
            :destination-loading="model.destinationLoading"
            :destination-error="model.destinationError"
            :pool-migration-compression-enabled="model.poolMigrationCompressionEnabled"
            :active-target-key="model.activeTargetKey"
            :saving="model.saving"
            @destination-target-change="handleDestinationTargetChange"
            @submit="handleSubmit">
          </vm-migration-form>
        </div>

        <div class="dash-card">
          <div class="dash-card-label">Migration Guidance</div>
          <div class="stack-list">
            <div class="stack-item">
              <div>
                <strong>Current Host</strong>
                <div class="text-muted mono" style="font-size:11px">
                  {{ model.currentHostSummary }}
                </div>
              </div>
              <span class="badge" :class="model.currentHostReady ? 'badge-running' : 'badge-warning'">
                {{ model.currentHostReady ? 'ready' : 'check' }}
              </span>
            </div>
            <div class="stack-item">
              <div>
                <strong>Eligible Destinations</strong>
                <div class="text-muted mono" style="font-size:11px">
                  {{ model.eligibleDestinationsSummary }}
                </div>
              </div>
              <span class="badge badge-info">pool</span>
            </div>
            <div class="stack-item">
              <div>
                <strong>Attached Target Fabrics</strong>
                <div class="text-muted mono" style="font-size:11px">
                  {{ model.targetFabricsSummary }}
                </div>
              </div>
              <span class="badge badge-info">fabric</span>
            </div>
            <div class="stack-item">
              <div>
                <strong>Runtime Mode</strong>
                <div class="text-muted mono" style="font-size:11px">
                  {{ model.runtimeModeSummary }}
                </div>
              </div>
              <span class="badge badge-info">{{ model.runtimeModeBadge }}</span>
            </div>
            <div class="stack-item" v-if="model.destinationFabricSummary">
              <div>
                <strong>Destination Fabric Context</strong>
                <div class="text-muted mono" style="font-size:11px">
                  {{ model.destinationFabricSummary }}
                </div>
              </div>
              <span class="badge badge-info">target</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
};
