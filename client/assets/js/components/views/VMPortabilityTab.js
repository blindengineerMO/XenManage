const VMPortabilityTab = {
  props: ['model'],
  emits: ['export'],
  methods: {
    handleExport(metadataOnly) {
      this.$emit('export', metadataOnly);
    },
  },
  template: `
    <div>
      <div class="dashboard-panels">
        <div class="dash-card">
          <div class="dash-card-label">Export Virtual Machine</div>
          <p class="text-muted" style="margin-bottom:12px">
            Stream a XenServer XVA package or a metadata-only archive directly from the selected workload without leaving the VM details workspace.
          </p>
          <div class="form-actions" style="justify-content:flex-start">
            <button class="form-btn"
                    type="button"
                    :disabled="model.exportBusy"
                    @click="handleExport(false)">
              <span class="mdi mdi-package-down"></span>
              {{ model.fullExportLabel }}
            </button>
            <button class="btn btn-sm"
                    type="button"
                    :disabled="model.exportBusy"
                    @click="handleExport(true)">
              <span class="mdi mdi-file-document-outline"></span>
              {{ model.metadataExportLabel }}
            </button>
          </div>
        </div>

        <div class="dash-card">
          <div class="dash-card-label">Portability Guidance</div>
          <div class="stack-list">
            <div class="stack-item">
              <div>
                <strong>Archive Scope</strong>
                <div class="text-muted mono" style="font-size:11px">
                  Full XVA exports include disk payloads for all attached VDIs. Metadata exports capture placement and VM definition details without the disk image bulk.
                </div>
              </div>
              <span class="badge badge-info">scope</span>
            </div>
            <div class="stack-item">
              <div>
                <strong>Import Targeting</strong>
                <div class="text-muted mono" style="font-size:11px">
                  Use the top-level Import XVA action to register or restore workloads into any reachable storage target, then reopen the created VM here for post-import validation.
                </div>
              </div>
              <span class="badge badge-info">workflow</span>
            </div>
            <div class="stack-item">
              <div>
                <strong>Attached Resources</strong>
                <div class="text-muted mono" style="font-size:11px">
                  {{ model.attachedResourcesSummary }}
                </div>
              </div>
              <span class="badge badge-info">inventory</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
};
