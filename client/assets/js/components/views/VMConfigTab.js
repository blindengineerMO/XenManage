const VMConfigTab = {
  components: {
    'vm-config-form': VMConfigForm,
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
          <div class="dash-card-label">Config Editor</div>
          <p class="text-muted" style="margin-bottom:12px">
            Update the visible workload identity, preferred home server, core sizing, and advanced metadata here. For live environments, XenAPI may require the guest to be halted before some CPU or memory changes apply.
          </p>
          <vm-config-form
            :initial-value="model.vm"
            :host-options="model.hostOptions"
            :appliance-options="model.applianceOptions"
            :snapshot-schedule-options="model.snapshotScheduleOptions"
            :submit-label="'Save VM Config'"
            :saving="model.saving"
            @submit="handleSubmit">
          </vm-config-form>
        </div>

        <div class="dash-card">
          <div class="dash-card-label">Current Effective Settings</div>
          <div class="stack-list">
            <div class="stack-item">
              <div>
                <strong>Compute</strong>
                <div class="text-muted mono" style="font-size:11px">{{ model.vcpuDetail }} · static max {{ model.memoryStaticMaxGiB }} GiB</div>
              </div>
              <span class="badge badge-info">vm</span>
            </div>
            <div class="stack-item">
              <div>
                <strong>Memory Envelope</strong>
                <div class="text-muted mono" style="font-size:11px">Balloon {{ model.memoryDynamicMinGiB }}-{{ model.memoryDynamicMaxGiB }} GiB inside static {{ model.memoryStaticMinGiB }}-{{ model.memoryStaticMaxGiB }} GiB.</div>
              </div>
              <span class="badge badge-info">{{ model.memoryDynamicMinGiB }}-{{ model.memoryDynamicMaxGiB }} GiB</span>
            </div>
            <div class="stack-item">
              <div>
                <strong>Identity</strong>
                <div class="text-muted mono" style="font-size:11px">{{ model.vm.uuid || model.vm.ref }}</div>
              </div>
              <span class="badge badge-info">uuid</span>
            </div>
            <div class="stack-item">
              <div>
                <strong>Version Tag</strong>
                <div class="text-muted mono" style="font-size:11px">Revision {{ model.vm.user_version ?? 0 }}</div>
              </div>
              <span class="badge badge-info">rev</span>
            </div>
            <div class="stack-item">
              <div>
                <strong>Start Delay</strong>
                <div class="text-muted mono" style="font-size:11px">{{ model.vm.start_delay ?? 0 }} seconds before staged startup continues.</div>
              </div>
              <span class="badge badge-info">{{ model.vm.start_delay ?? 0 }}s</span>
            </div>
            <div class="stack-item">
              <div>
                <strong>Shutdown Delay</strong>
                <div class="text-muted mono" style="font-size:11px">{{ model.vm.shutdown_delay ?? 0 }} seconds before staged shutdown continues.</div>
              </div>
              <span class="badge badge-info">{{ model.vm.shutdown_delay ?? 0 }}s</span>
            </div>
            <div class="stack-item">
              <div>
                <strong>Boot Order</strong>
                <div class="text-muted mono" style="font-size:11px">Sequence {{ model.vm.order ?? 0 }} in pool-managed startup and shutdown ordering.</div>
              </div>
              <span class="badge badge-info">#{{ model.vm.order ?? 0 }}</span>
            </div>
            <div class="stack-item">
              <div>
                <strong>Virtual Hardware Platform</strong>
                <div class="text-muted mono" style="font-size:11px">{{ model.hardwarePlatformDetail }}</div>
              </div>
              <span class="badge badge-info">{{ model.hardwarePlatformBadge }}</span>
            </div>
            <div class="stack-item">
              <div>
                <strong>Domain Type</strong>
                <div class="text-muted mono" style="font-size:11px">{{ model.domainTypeDetail }}</div>
              </div>
              <span class="badge badge-info">{{ model.domainTypeBadge }}</span>
            </div>
            <div class="stack-item">
              <div>
                <strong>Secure Boot</strong>
                <div class="text-muted mono" style="font-size:11px">{{ model.secureBootDetail }}</div>
              </div>
              <span class="badge" :class="model.secureBootEnabled ? 'badge-running' : 'badge-info'">
                {{ model.secureBootEnabled ? 'enabled' : 'disabled' }}
              </span>
            </div>
            <div class="stack-item">
              <div>
                <strong>Video RAM</strong>
                <div class="text-muted mono" style="font-size:11px">{{ model.videoRamDetail }}</div>
              </div>
              <span class="badge badge-info">{{ model.videoRamBadge }}</span>
            </div>
            <div class="stack-item">
              <div>
                <strong>IGD Passthrough</strong>
                <div class="text-muted mono" style="font-size:11px">{{ model.igdPassthroughDetail }}</div>
              </div>
              <span class="badge" :class="model.igdPassthroughEnabled ? 'badge-running' : 'badge-info'">
                {{ model.igdPassthroughEnabled ? 'enabled' : 'disabled' }}
              </span>
            </div>
            <div class="stack-item">
              <div>
                <strong>Vendor Device Emulation</strong>
                <div class="text-muted mono" style="font-size:11px">{{ model.vendorDeviceDetail }}</div>
              </div>
              <span class="badge" :class="model.vendorDeviceEnabled ? 'badge-running' : 'badge-info'">
                {{ model.vendorDeviceEnabled ? 'enabled' : 'disabled' }}
              </span>
            </div>
            <div class="stack-item">
              <div>
                <strong>Affinity Preference</strong>
                <div class="text-muted mono" style="font-size:11px">{{ model.affinityLabel }}</div>
              </div>
              <span class="badge" :class="model.affinityPinned ? 'badge-running' : 'badge-info'">
                {{ model.affinityPinned ? 'pinned' : 'auto' }}
              </span>
            </div>
            <div class="stack-item">
              <div>
                <strong>VM Appliance</strong>
                <div class="text-muted mono" style="font-size:11px">{{ model.applianceDetail }}</div>
              </div>
              <span class="badge" :class="model.hasAppliance ? 'badge-running' : 'badge-info'">
                {{ model.hasAppliance ? `${model.applianceVmCount} VMs` : 'none' }}
              </span>
            </div>
            <div class="stack-item">
              <div>
                <strong>Snapshot Schedule</strong>
                <div class="text-muted mono" style="font-size:11px">{{ model.snapshotScheduleDetail }}</div>
              </div>
              <span class="badge" :class="model.hasSnapshotSchedule ? (model.snapshotScheduleEnabled ? 'badge-running' : 'badge-warning') : 'badge-info'">
                {{ model.hasSnapshotSchedule ? (model.snapshotScheduleEnabled ? 'enabled' : 'disabled') : 'none' }}
              </span>
            </div>
            <div class="stack-item">
              <div>
                <strong>Protection Policy</strong>
                <div class="text-muted mono" style="font-size:11px">{{ model.protectionPolicyDetail }}</div>
              </div>
              <span class="badge" :class="model.hasProtectionPolicy ? 'badge-warning' : 'badge-info'">
                {{ model.hasProtectionPolicy ? 'legacy' : 'none' }}
              </span>
            </div>
            <div class="stack-item">
              <div>
                <strong>Tag Set</strong>
                <div class="text-muted mono" style="font-size:11px">{{ model.tagsSummary }}</div>
              </div>
              <span class="badge badge-info">{{ model.tagsCount }}</span>
            </div>
            <div class="stack-item">
              <div>
                <strong>Blocked Operations</strong>
                <div class="text-muted mono" style="font-size:11px">{{ model.blockedOperationsSummary }}</div>
              </div>
              <span class="badge" :class="model.blockedOperationsCount ? 'badge-warning' : 'badge-info'">
                {{ model.blockedOperationsCount || 'none' }}
              </span>
            </div>
            <div class="stack-item">
              <div>
                <strong>VM VCPUs_params</strong>
                <div class="text-muted mono" style="font-size:11px">{{ model.vcpusParamsSummary }}</div>
              </div>
              <span class="badge badge-info">{{ model.vcpusParamsCount }}</span>
            </div>
            <div class="stack-item">
              <div>
                <strong>VM other_config</strong>
                <div class="text-muted mono" style="font-size:11px">{{ model.otherConfigSummary }}</div>
              </div>
              <span class="badge badge-info">{{ model.otherConfigCount }}</span>
            </div>
            <div class="stack-item">
              <div>
                <strong>VM xenstore_data</strong>
                <div class="text-muted mono" style="font-size:11px">{{ model.xenstoreDataSummary }}</div>
              </div>
              <span class="badge badge-info">{{ model.xenstoreDataCount }}</span>
            </div>
            <div class="stack-item">
              <div>
                <strong>VM NVRAM</strong>
                <div class="text-muted mono" style="font-size:11px">{{ model.nvramDetail }}</div>
              </div>
              <span class="badge badge-info">{{ model.nvramCount }}</span>
            </div>
            <div class="stack-item">
              <div>
                <strong>VM platform</strong>
                <div class="text-muted mono" style="font-size:11px">{{ model.platformSummary }}</div>
              </div>
              <span class="badge badge-info">{{ model.platformCount }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
};
