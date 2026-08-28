const HostWorkspaceDialogs = {
  components: {
    FloatingWindow,
    HostConfigForm,
    HostGuestVcpusParamsForm,
    HostLoggingForm,
    HostSchedGranForm,
    StatusBadge,
  },
  props: {
    selectedHost: {
      type: Object,
      default: null,
    },
    selectedHostPool: {
      type: Object,
      default: null,
    },
    selectedHostSummaryProfile: {
      type: Object,
      default: () => ({}),
    },
    hostConfigSaving: {
      type: Boolean,
      default: false,
    },
    showHostIdentityWindow: {
      type: Boolean,
      default: false,
    },
    showHostContextWindow: {
      type: Boolean,
      default: false,
    },
    showHostLoggingWindow: {
      type: Boolean,
      default: false,
    },
    showHostGuestCpuWindow: {
      type: Boolean,
      default: false,
    },
    showHostSchedulerWindow: {
      type: Boolean,
      default: false,
    },
    showHostPlatformWindow: {
      type: Boolean,
      default: false,
    },
  },
  emits: [
    'close-host-identity',
    'close-host-context',
    'close-host-logging',
    'close-host-guest-cpu',
    'close-host-scheduler',
    'close-host-platform',
    'submit-host-config',
    'submit-host-logging',
    'submit-host-guest-vcpus',
    'submit-host-scheduler',
  ],
  template: `
    <div>
      <floating-window :show="showHostIdentityWindow"
                       title="Host Identity"
                       :width="720"
                       :height="520"
                       @close="$emit('close-host-identity')">
        <div class="detail-section" v-if="selectedHost">
          <div class="detail-title">Metadata Editor</div>
          <p class="text-muted" style="margin-bottom:12px">
            Update the operator-facing host label and description without leaving the host detail workspace.
          </p>
          <host-config-form
            :initial-value="selectedHost"
            :saving="hostConfigSaving"
            :submit-label="'Save Host Metadata'"
            @submit="$emit('submit-host-config', $event)">
          </host-config-form>
        </div>
      </floating-window>

      <floating-window :show="showHostContextWindow"
                       title="Host Context"
                       :width="720"
                       :height="500"
                       @close="$emit('close-host-context')">
        <div class="detail-section" v-if="selectedHost">
          <div class="detail-title">Operational Context</div>
          <div class="stack-list">
            <div class="stack-item">
              <div>
                <strong>{{ selectedHost.name_label || 'Selected host' }}</strong>
                <div class="text-muted mono" style="font-size:11px">{{ selectedHost.uuid || selectedHost.ref || 'host ref unavailable' }}</div>
              </div>
              <status-badge :status="selectedHost.enabled ? 'enabled' : 'disabled'"></status-badge>
            </div>
            <div class="stack-item">
              <div>
                <strong>Address</strong>
                <div class="text-muted mono" style="font-size:11px">{{ selectedHost.address || selectedHost.hostname || 'not reported' }}</div>
              </div>
              <span class="badge badge-info">network</span>
            </div>
            <div class="stack-item">
              <div>
                <strong>Pool Membership</strong>
                <div class="text-muted mono" style="font-size:11px">{{ selectedHostPool ? (selectedHostPool.name_label || selectedHostPool.uuid || selectedHostPool.ref) : 'Unknown / standalone' }}</div>
              </div>
              <span class="badge badge-info">pool</span>
            </div>
            <div class="stack-item">
              <div>
                <strong>Operator Description</strong>
                <div class="text-muted mono" style="font-size:11px">{{ selectedHost.name_description || 'No operator-facing host description has been saved yet.' }}</div>
              </div>
              <span class="badge badge-info">notes</span>
            </div>
            <div class="stack-item">
              <div>
                <strong>Logging Overrides</strong>
                <div class="text-muted mono" style="font-size:11px">{{ selectedHostSummaryProfile.loggingSummary }}</div>
              </div>
              <span class="badge badge-info">logging</span>
            </div>
          </div>
        </div>
      </floating-window>

      <floating-window :show="showHostLoggingWindow"
                       title="Host Logging"
                       :width="720"
                       :height="480"
                       @close="$emit('close-host-logging')">
        <div class="detail-section" v-if="selectedHost">
          <div class="detail-title">Logging Overrides</div>
          <p class="text-muted" style="margin-bottom:12px">
            Keep per-host syslog destinations or verbosity overrides visible beside maintenance and telemetry workflows.
          </p>
          <host-logging-form
            :initial-value="selectedHost"
            :saving="hostConfigSaving"
            :submit-label="'Save Host Logging'"
            @submit="$emit('submit-host-logging', $event)">
          </host-logging-form>
          <div class="text-muted mono" style="font-size:11px;margin-top:12px">
            {{ selectedHostSummaryProfile.loggingSummary }}
          </div>
        </div>
      </floating-window>

      <floating-window :show="showHostGuestCpuWindow"
                       title="Guest CPU Policy"
                       :width="720"
                       :height="480"
                       @close="$emit('close-host-guest-cpu')">
        <div class="detail-section" v-if="selectedHost">
          <div class="detail-title">Guest VCPU Defaults</div>
          <p class="text-muted" style="margin-bottom:12px">
            Keep the host-wide Xen guest VCPU defaults visible and editable beside placement and maintenance workflows.
          </p>
          <host-guest-vcpus-params-form
            :initial-value="selectedHost"
            :saving="hostConfigSaving"
            :submit-label="'Save Guest VCPU Policy'"
            @submit="$emit('submit-host-guest-vcpus', $event)">
          </host-guest-vcpus-params-form>
          <div class="text-muted mono" style="font-size:11px;margin-top:12px">
            {{ selectedHostSummaryProfile.guestVcpusParamsSummary }}
          </div>
        </div>
      </floating-window>

      <floating-window :show="showHostSchedulerWindow"
                       title="Scheduler Policy"
                       :width="720"
                       :height="460"
                       @close="$emit('close-host-scheduler')">
        <div class="detail-section" v-if="selectedHost">
          <div class="detail-title">CPU Scheduling</div>
          <p class="text-muted" style="margin-bottom:12px">
            Align Xen CPU scheduling behavior for this host without leaving the broader operations workspace.
          </p>
          <host-sched-gran-form
            :initial-value="selectedHost"
            :saving="hostConfigSaving"
            :submit-label="'Save Scheduler Policy'"
            @submit="$emit('submit-host-scheduler', $event)">
          </host-sched-gran-form>
          <div class="text-muted mono" style="font-size:11px;margin-top:12px">
            {{ selectedHostSummaryProfile.schedGranLabel }}
          </div>
        </div>
      </floating-window>

      <floating-window :show="showHostPlatformWindow"
                       title="Platform and Licensing"
                       :width="760"
                       :height="560"
                       @close="$emit('close-host-platform')">
        <div class="detail-section" v-if="selectedHost">
          <div class="detail-title">Platform Snapshot</div>
          <div class="stack-list">
            <div class="stack-item">
              <div>
                <strong>Edition</strong>
                <div class="text-muted mono" style="font-size:11px">{{ selectedHostSummaryProfile.editionLabel }}</div>
              </div>
              <span class="badge badge-info">license</span>
            </div>
            <div class="stack-item">
              <div>
                <strong>CPU Topology</strong>
                <div class="text-muted mono" style="font-size:11px">{{ selectedHostSummaryProfile.cpuSummary }}</div>
              </div>
              <span class="badge badge-info">compute</span>
            </div>
            <div class="stack-item">
              <div>
                <strong>Software Version</strong>
                <div class="text-muted mono" style="font-size:11px">{{ selectedHostSummaryProfile.softwareVersionSummary }}</div>
              </div>
              <span class="badge badge-info">platform</span>
            </div>
            <div class="stack-item">
              <div>
                <strong>License Server</strong>
                <div class="text-muted mono" style="font-size:11px">{{ selectedHostSummaryProfile.licenseServerSummary }}</div>
              </div>
              <span class="badge badge-info">support</span>
            </div>
            <div class="stack-item">
              <div>
                <strong>Supported HW Versions</strong>
                <div class="text-muted mono" style="font-size:11px">{{ selectedHostSummaryProfile.hardwarePlatformSummary }}</div>
              </div>
              <span class="badge badge-info">compatibility</span>
            </div>
            <div class="stack-item">
              <div>
                <strong>External Authentication</strong>
                <div class="text-muted mono" style="font-size:11px">{{ selectedHostSummaryProfile.externalAuthTypeLabel }} · {{ selectedHostSummaryProfile.externalAuthServiceLabel }}</div>
              </div>
              <span class="badge badge-info">identity</span>
            </div>
            <div class="stack-item">
              <div>
                <strong>External Auth Configuration</strong>
                <div class="text-muted mono" style="font-size:11px">{{ selectedHostSummaryProfile.externalAuthConfigSummary }}</div>
              </div>
              <span class="badge badge-info">directory</span>
            </div>
            <div class="stack-item">
              <div>
                <strong>Guest VCPU Parameters</strong>
                <div class="text-muted mono" style="font-size:11px">{{ selectedHostSummaryProfile.guestVcpusParamsSummary }}</div>
              </div>
              <span class="badge badge-info">scheduler</span>
            </div>
            <div class="stack-item">
              <div>
                <strong>Scheduler Granularity</strong>
                <div class="text-muted mono" style="font-size:11px">{{ selectedHostSummaryProfile.schedGranLabel }}</div>
              </div>
              <span class="badge badge-info">cpu policy</span>
            </div>
            <div class="stack-item">
              <div>
                <strong>Legacy SSL</strong>
                <div class="text-muted mono" style="font-size:11px">{{ selectedHostSummaryProfile.sslLegacyLabel }}</div>
              </div>
              <span class="badge badge-warning">deprecated</span>
            </div>
            <div class="stack-item">
              <div>
                <strong>BIOS Strings</strong>
                <div class="text-muted mono" style="font-size:11px">{{ selectedHostSummaryProfile.biosStringsSummary }}</div>
              </div>
              <span class="badge badge-info">firmware</span>
            </div>
          </div>
        </div>
      </floating-window>
    </div>
  `,
};
