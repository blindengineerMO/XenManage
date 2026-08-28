const VMConsoleTab = {
  props: ['model'],
  emits: ['launch'],
  methods: {
    handleLaunch(consoleRecord) {
      this.$emit('launch', consoleRecord);
    },
  },
  template: `
    <div>
      <div class="dashboard-panels">
        <div class="dash-card">
          <div class="dash-card-label">Console Access</div>
          <p class="text-muted" style="margin-bottom:12px">
            Launch a session-authenticated VM console directly from the workload workspace. XenMange resolves the current XAPI console record and opens the browser-accessible endpoint through a guarded launch view.
          </p>
          <div class="stack-list" v-if="model.consoles.length">
            <div v-for="consoleRecord in model.consoles" :key="consoleRecord.ref" class="stack-item">
              <div>
                <strong>{{ consoleRecord.protocolLabel }}</strong>
                <div class="text-muted mono" style="font-size:11px">
                  {{ consoleRecord.location || consoleRecord.absoluteLocation || consoleRecord.ref }}
                </div>
              </div>
              <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
                <span class="badge badge-info">{{ consoleRecord.protocol || 'unknown' }}</span>
                <button class="btn btn-primary btn-sm"
                        type="button"
                        :disabled="!consoleRecord.launchUrl"
                        @click="handleLaunch(consoleRecord)">
                  <span class="mdi mdi-monitor-arrow-down-variant"></span>
                  Launch
                </button>
              </div>
            </div>
          </div>
          <div v-else class="empty-state">
            <p>No XAPI console records were returned for this VM.</p>
          </div>
        </div>

        <div class="dash-card">
          <div class="dash-card-label">Operator Notes</div>
          <div class="stack-list">
            <div class="stack-item">
              <div>
                <strong>Preferred Session</strong>
                <div class="text-muted mono" style="font-size:11px">
                  {{ model.preferredSessionSummary }}
                </div>
              </div>
              <span class="badge badge-info">launch</span>
            </div>
            <div class="stack-item">
              <div>
                <strong>Fallback Behavior</strong>
                <div class="text-muted mono" style="font-size:11px">
                  If the remote console endpoint refuses inline framing, the launch view still provides a direct hand-off into the resolved console session in a separate browser surface.
                </div>
              </div>
              <span class="badge badge-warning">fallback</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
};
