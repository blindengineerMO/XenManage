const NetworkCreateDialogs = {
  components: {
    FloatingWindow,
    NetworkBondCreateForm,
    NetworkCreateForm,
    NetworkVlanCreateForm,
  },
  props: {
    showCreateNetworkWindow: { type: Boolean, default: false },
    showCreateVlanWindow: { type: Boolean, default: false },
    showCreateBondWindow: { type: Boolean, default: false },
    createBusy: { type: Boolean, default: false },
    createError: { type: String, default: '' },
    createVlanBusy: { type: Boolean, default: false },
    createVlanError: { type: String, default: '' },
    createBondBusy: { type: Boolean, default: false },
    createBondError: { type: String, default: '' },
    networkVlanOptions: { type: Array, default: () => [] },
    networkVlanPifOptions: { type: Array, default: () => [] },
  },
  emits: [
    'close-create-network',
    'close-create-vlan',
    'close-create-bond',
    'submit-network-create',
    'submit-network-vlan',
    'submit-network-bond',
  ],
  template: `
    <div>
      <floating-window :show="showCreateNetworkWindow"
                       title="Create Network"
                       :width="760"
                       :height="560"
                       @close="$emit('close-create-network')">
        <div class="detail-section">
          <div class="detail-title">Managed Network</div>
          <p class="text-muted" style="margin-bottom:12px">Provision a managed bridge with explicit MTU, optional tags, and custom metadata without leaving the Networking workspace.</p>
          <network-create-form
            :saving="createBusy"
            :submit-label="'Create Network'"
            @submit="$emit('submit-network-create', $event)">
          </network-create-form>
          <div class="form-error" v-if="createError" style="text-align:left;margin-top:12px">{{ createError }}</div>
        </div>
      </floating-window>

      <floating-window :show="showCreateVlanWindow"
                       title="Create VLAN"
                       :width="760"
                       :height="520"
                       @close="$emit('close-create-vlan')">
        <div class="detail-section">
          <div class="detail-title">Tagged Uplink Mapping</div>
          <p class="text-muted" style="margin-bottom:12px">Attach a VLAN tag to an existing host uplink and map the tagged traffic back onto a selected network object.</p>
          <network-vlan-create-form
            :network-options="networkVlanOptions"
            :pif-options="networkVlanPifOptions"
            :saving="createVlanBusy"
            :submit-label="'Create VLAN'"
            @submit="$emit('submit-network-vlan', $event)">
          </network-vlan-create-form>
          <div class="form-error" v-if="createVlanError" style="text-align:left;margin-top:12px">{{ createVlanError }}</div>
        </div>
      </floating-window>

      <floating-window :show="showCreateBondWindow"
                       title="Create Bond"
                       :width="760"
                       :height="540"
                       @close="$emit('close-create-bond')">
        <div class="detail-section">
          <div class="detail-title">Bonded Uplink Path</div>
          <p class="text-muted" style="margin-bottom:12px">Aggregate multiple uplinks into one logical path on a selected network using one of the Xen-supported bond modes.</p>
          <network-bond-create-form
            :network-options="networkVlanOptions"
            :pif-options="networkVlanPifOptions"
            :saving="createBondBusy"
            :submit-label="'Create Bond'"
            @submit="$emit('submit-network-bond', $event)">
          </network-bond-create-form>
          <div class="form-error" v-if="createBondError" style="text-align:left;margin-top:12px">{{ createBondError }}</div>
        </div>
      </floating-window>
    </div>
  `,
};
