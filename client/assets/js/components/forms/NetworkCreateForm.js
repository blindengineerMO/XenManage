function buildNetworkCreateDraft() {
  return {
    nameLabel: '',
    nameDescription: '',
    mtu: 1500,
    bridge: '',
    tags: '',
    otherConfigLines: '',
  };
}

function parseNetworkConfigLines(lines = '') {
  const map = {};
  const entries = String(lines || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  for (const entry of entries) {
    const index = entry.indexOf('=');
    if (index <= 0) {
      return {
        error: `Each advanced config line must use key=value format. Problem: ${entry}`,
        map: {},
      };
    }

    const key = entry.slice(0, index).trim();
    const value = entry.slice(index + 1).trim();
    if (!key) {
      return {
        error: `Each advanced config line must include a key before "=". Problem: ${entry}`,
        map: {},
      };
    }

    map[key] = value;
  }

  return { error: '', map };
}

const NetworkCreateForm = {
  props: ['submitLabel', 'saving'],
  emits: ['submit'],
  template: `
    <form @submit.prevent="handleSubmit">
      <div class="vm-inline-form-grid">
        <div class="form-group">
          <label for="network-create-name">Network Name</label>
          <input id="network-create-name"
                 class="form-input"
                 v-model="draft.nameLabel"
                 placeholder="Backup Network"
                 required>
        </div>

        <div class="form-group">
          <label for="network-create-bridge">Bridge Name</label>
          <input id="network-create-bridge"
                 class="form-input mono"
                 v-model="draft.bridge"
                 placeholder="xenbr10"
                 required>
        </div>
      </div>

      <div class="form-group">
        <label for="network-create-description">Description</label>
        <textarea id="network-create-description"
                  class="form-input form-textarea"
                  rows="3"
                  v-model="draft.nameDescription"
                  placeholder="Operator-facing notes for the network purpose or traffic boundary."></textarea>
      </div>

      <div class="vm-inline-form-grid">
        <div class="form-group">
          <label for="network-create-mtu">MTU</label>
          <input id="network-create-mtu"
                 class="form-input"
                 v-model.number="draft.mtu"
                 type="number"
                 min="576"
                 max="9216"
                 required>
        </div>

        <div class="form-group">
          <label for="network-create-tags">Tags</label>
          <input id="network-create-tags"
                 class="form-input"
                 v-model="draft.tags"
                 placeholder="backup, replication">
        </div>
      </div>

      <div class="form-group">
        <label for="network-create-other-config">Network other_config</label>
        <textarea id="network-create-other-config"
                  class="form-input form-textarea"
                  rows="3"
                  v-model="draft.otherConfigLines"
                  placeholder="vlan=220&#10;domain=backup"></textarea>
      </div>

      <div class="text-muted mono" style="font-size:11px;margin-bottom:12px">
        One <code>key=value</code> pair per line. Bridge names should be unique within the connected Xen fabric.
      </div>

      <div class="form-error" v-if="validationError" style="text-align:left;margin-bottom:12px">{{ validationError }}</div>

      <button class="form-btn" type="submit" :disabled="saving">
        <span class="mdi mdi-lan-connect"></span>
        {{ saving ? 'Submitting...' : (submitLabel || 'Create Network') }}
      </button>
    </form>
  `,
  data() {
    return {
      draft: buildNetworkCreateDraft(),
      validationError: '',
    };
  },
  methods: {
    handleSubmit() {
      const otherConfig = parseNetworkConfigLines(this.draft.otherConfigLines);
      if (otherConfig.error) {
        this.validationError = otherConfig.error;
        return;
      }

      this.validationError = '';
      this.$emit('submit', {
        nameLabel: this.draft.nameLabel.trim(),
        nameDescription: this.draft.nameDescription.trim(),
        mtu: Math.max(576, Number(this.draft.mtu || 1500)),
        bridge: this.draft.bridge.trim(),
        tags: this.draft.tags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
        otherConfig: otherConfig.map,
      });
      this.draft = buildNetworkCreateDraft();
    },
  },
};
