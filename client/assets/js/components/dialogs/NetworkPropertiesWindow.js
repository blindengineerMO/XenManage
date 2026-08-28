const NetworkPropertiesWindow = {
  components: {
    FloatingWindow,
    StatusBadge,
  },
  props: {
    show: { type: Boolean, default: false },
    selectedNetwork: { type: Object, default: null },
    selectedNetworkVlanLabel: { type: String, default: '' },
    selectedNetworkTopologyLabel: { type: String, default: '' },
    selectedNetworkPurposeLabel: { type: String, default: '' },
    selectedNetworkHostUplinks: { type: Array, default: () => [] },
    selectedNetworkVmAttachments: { type: Array, default: () => [] },
    focusedNetworkContext: { type: Object, default: null },
    detailActionBusy: { type: String, default: '' },
    detailActionError: { type: String, default: '' },
    detailActionMessage: { type: String, default: '' },
    detailLoading: { type: Boolean, default: false },
    detailError: { type: String, default: '' },
    disconnectingVifRef: { type: String, default: '' },
    removingVifRef: { type: String, default: '' },
    focusedPifRef: { type: String, default: '' },
    focusedVifRef: { type: String, default: '' },
  },
  emits: [
    'close',
    'open-network-metadata',
    'open-network-identity',
    'open-network-attach-vif',
    'open-network-vif-qos',
    'disconnect-selected-network-vif',
    'remove-selected-network-vif',
    'open-host-workspace',
    'open-vm-workspace',
  ],
  template: `
    <floating-window :show="show" title="Network Properties" :width="860" :height="620" @close="$emit('close')">
      <div v-if="selectedNetwork">
        <div class="property-grid">
          <span class="text-muted">Name</span><span>{{ selectedNetwork.name_label || '-' }}</span>
          <span class="text-muted">Bridge</span><span class="mono">{{ selectedNetwork.bridge || '-' }}</span>
          <span class="text-muted">Description</span><span>{{ selectedNetwork.name_description || selectedNetwork.description || '-' }}</span>
          <span class="text-muted">MTU</span><span class="mono">{{ selectedNetwork.MTU || '-' }}</span>
          <span class="text-muted">Managed</span><status-badge :status="selectedNetwork.managed ? 'enabled' : 'disabled'"></status-badge>
          <span class="text-muted">VLAN Tag</span><span class="mono">{{ selectedNetworkVlanLabel }}</span>
          <span class="text-muted">Topology</span><span>{{ selectedNetworkTopologyLabel }}</span>
          <span class="text-muted">Default Locking Mode</span><span>{{ selectedNetwork.default_locking_mode || '-' }}</span>
          <span class="text-muted">Purpose</span><span>{{ selectedNetworkPurposeLabel }}</span>
          <span class="text-muted">Host Uplinks</span><span>{{ summarizeCount('uplinks', selectedNetworkHostUplinks.length) }}</span>
          <span class="text-muted">Attached Workloads</span><span>{{ summarizeCount('interfaces', selectedNetworkVmAttachments.length) }}</span>
          <span class="text-muted">UUID</span><span class="mono property-wrap">{{ selectedNetwork.uuid || '-' }}</span>
          <span class="text-muted">Tags</span><span>{{ truncateList(selectedNetwork.tags) }}</span>
          <span class="text-muted">Other Config</span><span class="mono property-wrap">{{ JSON.stringify(selectedNetwork.other_config || {}) }}</span>
        </div>

        <div class="detail-section" v-if="focusedNetworkContext">
          <div class="detail-section-title">{{ focusedNetworkContext.title }}</div>
          <div class="capacity-callout">
            <strong>{{ focusedNetworkContext.summary }}</strong>
            <div class="text-muted mono" style="font-size:11px;margin-top:8px">{{ focusedNetworkContext.detail }}</div>
          </div>
        </div>

        <div class="detail-section">
          <div class="detail-section-title">Network Operations</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn btn-sm" type="button" @click="$emit('open-network-metadata')">
              <span class="mdi mdi-card-text-outline"></span>
              Network Metadata
            </button>
            <button class="btn btn-sm" type="button" @click="$emit('open-network-identity')">
              <span class="mdi mdi-fingerprint"></span>
              Network Identity
            </button>
            <button class="btn btn-sm" type="button" @click="$emit('open-network-attach-vif')">
              <span class="mdi mdi-lan-connect"></span>
              Attach Workload Interface
            </button>
            <button class="btn btn-sm" type="button" @click="$emit('open-network-vif-qos')">
              <span class="mdi mdi-speedometer-medium"></span>
              Interface QoS
            </button>
          </div>
          <div class="text-muted mono" style="font-size:11px;margin-top:10px">
            {{ selectedNetwork.bridge || 'bridge unavailable' }} · {{ selectedNetworkTopologyLabel }} · {{ summarizeCount('interfaces', selectedNetworkVmAttachments.length) }}
          </div>

          <div class="form-error" v-if="detailActionError" style="text-align:left;margin-top:12px">{{ detailActionError }}</div>
          <div class="stack-item" v-else-if="detailActionMessage" style="margin-top:12px">
            <div>
              <strong>Network operation completed</strong>
              <div class="text-muted mono" style="font-size:11px">{{ detailActionMessage }}</div>
            </div>
            <span class="badge badge-running">ready</span>
          </div>
        </div>

        <div class="detail-section">
          <div class="detail-section-title">Network Relationship Mapping</div>
          <div class="stack-item" v-if="detailLoading">
            <span class="loading-spinner"></span>
            <span class="mono">Collecting host uplinks and VM interface attachments...</span>
          </div>
          <div class="stack-item" v-else-if="detailError">
            <div>
              <strong>Relationship mapping unavailable</strong>
              <div class="text-muted mono" style="font-size:11px">{{ detailError }}</div>
            </div>
            <span class="badge badge-error">error</span>
          </div>
          <div class="dashboard-panels" v-else>
            <div class="dash-card">
              <div class="dash-card-label">Host Uplinks</div>
              <div class="stack-list" v-if="selectedNetworkHostUplinks.length">
                <div class="stack-item" v-for="uplink in selectedNetworkHostUplinks" :key="uplink.id">
                  <div>
                    <strong>{{ uplink.hostName }}</strong>
                    <div class="text-muted mono" style="font-size:11px">{{ uplink.hostAddress }} · {{ uplink.interfaceRef }}</div>
                    <div class="text-muted mono" style="font-size:11px">{{ uplink.detail }}</div>
                  </div>
                  <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
                    <span class="badge badge-running" v-if="isFocusedPif(uplink)">focused uplink</span>
                    <button class="btn btn-sm" @click="$emit('open-host-workspace', uplink)">
                      <span class="mdi mdi-server-outline"></span>
                      Open Host
                    </button>
                    <status-badge :status="uplink.status"></status-badge>
                  </div>
                </div>
              </div>
              <div v-else class="empty-state" style="padding:18px 12px">No host uplinks were mapped for this bridge.</div>
            </div>

            <div class="dash-card">
              <div class="dash-card-label">Connected Workloads</div>
              <div class="stack-list" v-if="selectedNetworkVmAttachments.length">
                <div class="stack-item" v-for="attachment in selectedNetworkVmAttachments" :key="attachment.id">
                  <div>
                    <strong>{{ attachment.vmName }}</strong>
                    <div class="text-muted mono" style="font-size:11px">{{ attachment.interfaceRef }} · {{ attachment.powerState }} · {{ attachment.currentlyAttached ? 'attached' : 'hot-unplugged' }}</div>
                    <div class="text-muted mono" style="font-size:11px">{{ attachment.detail }}</div>
                  </div>
                  <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
                    <span class="badge badge-running" v-if="isFocusedVif(attachment)">focused interface</span>
                    <span class="badge badge-info" v-if="attachment.qosConfigured">QoS</span>
                    <span class="badge" :class="attachment.currentlyAttached ? 'badge-running' : 'badge-halted'">
                      {{ attachment.currentlyAttached ? 'attached' : 'hot-unplugged' }}
                    </span>
                    <button class="btn btn-sm"
                            type="button"
                            :disabled="Boolean(detailActionBusy) || !attachment.currentlyAttached"
                            @click="$emit('disconnect-selected-network-vif', attachment)">
                      <span class="mdi mdi-power-plug-off-outline"></span>
                      {{ detailActionBusy === 'disconnect-vif' && disconnectingVifRef === attachment.interfaceRef ? 'Disconnecting...' : 'Disconnect VIF' }}
                    </button>
                    <button class="btn btn-sm"
                            type="button"
                            :disabled="Boolean(detailActionBusy)"
                            @click="$emit('remove-selected-network-vif', attachment)">
                      <span class="mdi mdi-lan-disconnect"></span>
                      {{ detailActionBusy === 'remove-vif' && removingVifRef === attachment.interfaceRef ? 'Removing...' : 'Remove VIF' }}
                    </button>
                    <button class="btn btn-sm" @click="$emit('open-vm-workspace', attachment)">
                      <span class="mdi mdi-open-in-app"></span>
                      Open VM
                    </button>
                    <status-badge :status="attachment.status"></status-badge>
                  </div>
                </div>
              </div>
              <div v-else class="empty-state" style="padding:18px 12px">No VM interfaces currently reference this network.</div>
            </div>
          </div>
        </div>
      </div>
    </floating-window>
  `,
  methods: {
    summarizeCount,
    truncateList,
    isFocusedPif(uplink) {
      return normalizeFocusValue(uplink?.interfaceRef) === normalizeFocusValue(this.focusedPifRef);
    },
    isFocusedVif(attachment) {
      return normalizeFocusValue(attachment?.interfaceRef) === normalizeFocusValue(this.focusedVifRef);
    },
  },
};
