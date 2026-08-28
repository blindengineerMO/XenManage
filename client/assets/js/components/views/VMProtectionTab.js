const VMProtectionTab = {
  components: {
    'vm-snapshot-form': VMSnapshotForm,
  },
  props: ['model'],
  emits: ['submit', 'snapshot-action'],
  methods: {
    handleSubmit(payload) {
      this.$emit('submit', payload);
    },
    handleSnapshotAction(action, snapshot) {
      this.$emit('snapshot-action', action, snapshot);
    },
  },
  template: `
    <div>
      <div class="dashboard-panels">
        <div class="dash-card">
          <div class="dash-card-label">Create Restore Point</div>
          <p class="text-muted" style="margin-bottom:12px">
            Capture a disk snapshot or a checkpoint before patching, application upgrades, or operator-led remediation.
          </p>
          <vm-snapshot-form
            :submit-label="'Create Restore Point'"
            :saving="model.saving"
            @submit="handleSubmit">
          </vm-snapshot-form>
        </div>

        <div class="dash-card">
          <div class="dash-card-label">Protection Summary</div>
          <div class="stack-list">
            <div class="stack-item">
              <div>
                <strong>{{ model.snapshotCount }} restore point{{ model.snapshotCount === 1 ? '' : 's' }}</strong>
                <div class="text-muted mono" style="font-size:11px">
                  {{ model.latestSnapshotSummary }}
                </div>
              </div>
              <span class="badge" :class="model.hasLatestSnapshot ? 'badge-running' : 'badge-warning'">
                {{ model.latestSnapshotMode }}
              </span>
            </div>
            <div class="stack-item">
              <div>
                <strong>Operator Guidance</strong>
                <div class="text-muted mono" style="font-size:11px">
                  Use checkpoints for risky live changes and disk snapshots for rollback points that do not need runtime memory preserved.
                </div>
              </div>
              <span class="badge badge-info">workflow</span>
            </div>
          </div>
        </div>
      </div>

      <div class="detail-section">
        <div class="detail-section-title">Recovery Points</div>
        <div v-if="model.snapshotRows.length" class="stack-list vm-snapshot-list">
          <div v-for="snapshot in model.snapshotRows" :key="snapshot.ref" class="stack-item vm-snapshot-row">
            <div>
              <strong>{{ snapshot.nameLabel }}</strong>
              <div class="text-muted mono" style="font-size:11px">
                {{ snapshot.timestampLabel }} · {{ snapshot.ref }}
              </div>
              <div class="text-muted" style="margin-top:6px;font-size:12px">
                {{ snapshot.description }}
              </div>
            </div>

            <div class="vm-snapshot-actions">
              <span class="badge" :class="snapshot.modeClass">
                {{ snapshot.modeLabel }}
              </span>
              <button class="btn btn-sm"
                      :disabled="model.snapshotBusy"
                      @click="handleSnapshotAction('revert', snapshot.raw)">
                <span class="mdi mdi-restore"></span>
                {{ snapshot.revertLabel }}
              </button>
              <button class="btn btn-danger btn-sm"
                      :disabled="model.snapshotBusy"
                      @click="handleSnapshotAction('delete', snapshot.raw)">
                <span class="mdi mdi-delete-outline"></span>
                {{ snapshot.deleteLabel }}
              </button>
            </div>
          </div>
        </div>
        <div v-else class="empty-state vm-snapshot-empty">
          <span class="mdi mdi-camera-off-outline" style="font-size:32px;color:var(--text-secondary)"></span>
          <p style="margin-top:12px">Create the first restore point for this workload to make rollback and checkpoint recovery available from the VM details pane.</p>
        </div>
      </div>
    </div>
  `,
};
