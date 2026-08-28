const NetworkWorkspaceDialogs = {
  components: {
    FloatingWindow,
    NetworkConfigForm,
    NetworkVifAttachForm,
    NetworkVifQosForm,
  },
  props: {
    selectedNetwork: { type: Object, default: null },
    selectedNetworkTopologyLabel: { type: String, default: '' },
    selectedNetworkVlanLabel: { type: String, default: '' },
    selectedNetworkDestroyBlockedReason: { type: String, default: '' },
    networkVifVmOptions: { type: Array, default: () => [] },
    networkVifQosOptions: { type: Array, default: () => [] },
    selectedAttachmentVifRef: { type: String, default: '' },
    selectedNetworkVifQosSummary: { type: String, default: '' },
    selectedNetworkVifQosTarget: { type: Object, default: null },
    detailActionBusy: { type: String, default: '' },
    showNetworkMetadataWindow: { type: Boolean, default: false },
    showNetworkIdentityWindow: { type: Boolean, default: false },
    showNetworkAttachVifWindow: { type: Boolean, default: false },
    showNetworkVifQosWindow: { type: Boolean, default: false },
  },
  emits: [
    'close-network-metadata',
    'close-network-identity',
    'close-network-attach-vif',
    'close-network-vif-qos',
    'submit-selected-network-config',
    'destroy-selected-network',
    'submit-selected-network-vif',
    'update:selected-attachment-vif-ref',
    'submit-selected-network-vif-qos',
  ],
  template: `
    <div>
      <floating-window :show="showNetworkMetadataWindow"
                       title="Network Metadata"
                       :width="760"
                       :height="560"
                       @close="$emit('close-network-metadata')">
        <div class="detail-section" v-if="selectedNetwork">
          <div class="detail-title">Operator Metadata</div>
          <p class="text-muted" style="margin-bottom:12px">Update the operator-facing network name, description, MTU, tags, and advanced metadata while keeping bridge assignment read-only.</p>
          <network-config-form
            :initial-value="selectedNetwork"
            :submit-label="'Save Network Metadata'"
            :saving="detailActionBusy === 'config'"
            @submit="$emit('submit-selected-network-config', $event)">
          </network-config-form>
        </div>
      </floating-window>

      <floating-window :show="showNetworkIdentityWindow"
                       title="Network Identity"
                       :width="760"
                       :height="520"
                       @close="$emit('close-network-identity')">
        <div class="detail-section" v-if="selectedNetwork">
          <div class="detail-title">Identity Snapshot</div>
          <p class="text-muted" style="margin-bottom:12px">Review immutable bridge placement, topology hints, and network destroy readiness from one focused identity sheet.</p>
          <div class="stack-list" style="margin-bottom:12px">
            <div class="stack-item">
              <div>
                <strong>{{ selectedNetwork.name_label || 'Selected network' }}</strong>
                <div class="text-muted mono" style="font-size:11px">
                  {{ selectedNetwork.uuid || selectedNetwork.ref || 'network ref unavailable' }} · {{ selectedNetwork.bridge || 'bridge unavailable' }}
                </div>
              </div>
              <span class="badge badge-info">{{ selectedNetwork.managed ? 'managed' : 'unmanaged' }}</span>
            </div>
            <div class="stack-item">
              <div>
                <strong>Bridge Assignment</strong>
                <div class="text-muted mono" style="font-size:11px">{{ selectedNetwork.bridge || 'bridge unavailable' }}</div>
              </div>
              <span class="badge badge-running">read-only</span>
            </div>
            <div class="stack-item">
              <div>
                <strong>Topology Snapshot</strong>
                <div class="text-muted mono" style="font-size:11px">{{ selectedNetworkTopologyLabel }}</div>
              </div>
              <span class="badge badge-info">{{ selectedNetworkVlanLabel }}</span>
            </div>
          </div>
          <p class="text-muted" style="margin:0 0 12px">Bridge attachment stays constructor-scoped in Xen, so metadata edits here intentionally stop short of renaming or rehoming the bridge itself.</p>
          <button class="btn btn-sm"
                  type="button"
                  :disabled="Boolean(detailActionBusy) || Boolean(selectedNetworkDestroyBlockedReason)"
                  @click="$emit('destroy-selected-network')">
            <span class="mdi mdi-delete-outline"></span>
            {{ detailActionBusy === 'destroy-network' ? 'Destroying...' : 'Destroy Network' }}
          </button>
          <div class="text-muted mono" v-if="selectedNetworkDestroyBlockedReason" style="font-size:11px;margin-top:10px">
            {{ selectedNetworkDestroyBlockedReason }}
          </div>
        </div>
      </floating-window>

      <floating-window :show="showNetworkAttachVifWindow"
                       title="Attach Workload Interface"
                       :width="760"
                       :height="520"
                       @close="$emit('close-network-attach-vif')">
        <div class="detail-section" v-if="selectedNetwork">
          <div class="detail-title">Workload Interface Attach</div>
          <p class="text-muted" style="margin-bottom:12px">Create a new VIF on this network for a selected VM without leaving the Networking detail workspace.</p>
          <network-vif-attach-form
            :vm-options="networkVifVmOptions"
            :saving="detailActionBusy === 'create-vif'"
            :submit-label="'Attach VIF'"
            @submit="$emit('submit-selected-network-vif', $event)">
          </network-vif-attach-form>
        </div>
      </floating-window>

      <floating-window :show="showNetworkVifQosWindow"
                       title="Interface QoS"
                       :width="760"
                       :height="560"
                       @close="$emit('close-network-vif-qos')">
        <div class="detail-section" v-if="selectedNetwork">
          <div class="detail-title">Bandwidth Shaping</div>
          <p class="text-muted" style="margin-bottom:12px">Tune Xen VIF bandwidth shaping for an attached workload path without leaving the selected network workspace.</p>
          <div v-if="networkVifQosOptions.length">
            <div class="form-group">
              <label for="network-vif-qos-target">Attached Interface</label>
              <select id="network-vif-qos-target"
                      class="form-input"
                      :value="selectedAttachmentVifRef"
                      @change="$emit('update:selected-attachment-vif-ref', $event.target.value)"
                      :disabled="Boolean(detailActionBusy)">
                <option v-for="option in networkVifQosOptions" :key="option.value" :value="option.value">
                  {{ option.label }}
                </option>
              </select>
            </div>
            <div class="text-muted mono" style="font-size:11px;margin-bottom:12px">
              {{ selectedNetworkVifQosSummary }}
            </div>
            <network-vif-qos-form
              :initial-value="selectedNetworkVifQosTarget"
              :submit-label="'Save Interface QoS'"
              :saving="detailActionBusy === 'config-vif'"
              @submit="$emit('submit-selected-network-vif-qos', $event)">
            </network-vif-qos-form>
          </div>
          <div v-else class="empty-state" style="padding:18px 12px">Attach a workload interface to this network before editing per-VIF QoS policy.</div>
        </div>
      </floating-window>
    </div>
  `,
};
