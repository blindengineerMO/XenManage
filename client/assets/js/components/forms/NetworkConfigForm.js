function formatExistingNetworkConfigLines(record = {}) {
  return Object.entries(record || {})
    .filter(([key]) => String(key || '').trim())
    .map(([key, value]) => `${String(key).trim()}=${String(value || '').trim()}`)
    .join('\n');
}

function buildNetworkConfigDraft(value = {}) {
  return {
    nameLabel: value.name_label || value.nameLabel || '',
    nameDescription: value.name_description || value.nameDescription || '',
    mtu: Number(value.MTU || value.mtu || 1500),
    defaultLockingMode: value.default_locking_mode || value.defaultLockingMode || 'unlocked',
    purpose: Array.isArray(value.purpose) ? [...value.purpose] : [],
    tags: Array.isArray(value.tags) ? value.tags.join(', ') : String(value.tags || ''),
    otherConfigLines: formatExistingNetworkConfigLines(value.other_config || value.otherConfig || {}),
  };
}

function parseExistingNetworkConfigLines(lines = '') {
  const map = {};
  const entries = String(lines || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  for (const entry of entries) {
    const index = entry.indexOf('=');
    if (index <= 0) {
      return {
        error: `Each network other_config line must use key=value format. Problem: ${entry}`,
        map: {},
      };
    }

    const key = entry.slice(0, index).trim();
    const value = entry.slice(index + 1).trim();
    if (!key) {
      return {
        error: `Each network other_config line must include a key before "=". Problem: ${entry}`,
        map: {},
      };
    }

    map[key] = value;
  }

  return { error: '', map };
}

const NetworkConfigForm = {
  props: ['initialValue', 'submitLabel', 'saving'],
  emits: ['submit'],
  template: `
    <form @submit.prevent="handleSubmit">
      <div class="vm-inline-form-grid">
        <div class="form-group">
          <label for="network-config-name">Network Name</label>
          <input id="network-config-name"
                 class="form-input"
                 v-model="draft.nameLabel"
                 placeholder="VM Network"
                 required>
        </div>

        <div class="form-group">
          <label for="network-config-mtu">MTU</label>
          <input id="network-config-mtu"
                 class="form-input"
                 v-model.number="draft.mtu"
                 type="number"
                 min="576"
                 max="9216"
                 required>
        </div>
      </div>

      <div class="form-group">
        <label for="network-config-description">Description</label>
        <textarea id="network-config-description"
                  class="form-input form-textarea"
                  rows="3"
                  v-model="draft.nameDescription"
                  placeholder="Operator-facing notes for traffic ownership, routing, or tenancy."></textarea>
      </div>

      <div class="form-group">
        <label for="network-config-tags">Tags</label>
        <input id="network-config-tags"
               class="form-input"
               v-model="draft.tags"
               placeholder="prod, east-west, monitored">
      </div>

      <div class="vm-inline-form-grid">
        <div class="form-group">
          <label for="network-config-locking-mode">Default Locking Mode</label>
          <select id="network-config-locking-mode" class="form-input" v-model="draft.defaultLockingMode">
            <option value="unlocked">unlocked</option>
            <option value="disabled">disabled</option>
          </select>
        </div>

        <div class="form-group">
          <label>Purpose</label>
          <div class="stack-list">
            <label class="stack-item" style="gap:10px;align-items:flex-start">
              <input type="checkbox" value="nbd" v-model="draft.purpose">
              <div>
                <strong>NBD</strong>
                <div class="text-muted mono" style="font-size:11px">Network Block Device service using TLS</div>
              </div>
            </label>
            <label class="stack-item" style="gap:10px;align-items:flex-start">
              <input type="checkbox" value="insecure_nbd" v-model="draft.purpose">
              <div>
                <strong>Insecure NBD</strong>
                <div class="text-muted mono" style="font-size:11px">Network Block Device without integrity or confidentiality</div>
              </div>
            </label>
          </div>
        </div>
      </div>

      <div class="form-group">
        <label for="network-config-other-config">Network other_config</label>
        <textarea id="network-config-other-config"
                  class="form-input form-textarea"
                  rows="3"
                  v-model="draft.otherConfigLines"
                  placeholder="vlan=120&#10;owner=platform-ops"></textarea>
      </div>

      <div class="text-muted mono" style="font-size:11px;margin-bottom:12px">
        The bridge is managed separately by Xen and stays read-only here. Use one <code>key=value</code> pair per line for advanced network metadata.
      </div>

      <div class="form-error" v-if="validationError" style="text-align:left;margin-bottom:12px">{{ validationError }}</div>

      <button class="form-btn" type="submit" :disabled="saving">
        <span class="mdi mdi-content-save-outline"></span>
        {{ saving ? 'Saving...' : (submitLabel || 'Save Network Metadata') }}
      </button>
    </form>
  `,
  data() {
    return {
      draft: buildNetworkConfigDraft(this.initialValue),
      validationError: '',
    };
  },
  watch: {
    initialValue: {
      deep: true,
      handler(value) {
        this.draft = buildNetworkConfigDraft(value);
        this.validationError = '';
      },
    },
  },
  methods: {
    handleSubmit() {
      const otherConfig = parseExistingNetworkConfigLines(this.draft.otherConfigLines);
      if (otherConfig.error) {
        this.validationError = otherConfig.error;
        return;
      }

      this.validationError = '';
      this.$emit('submit', {
        nameLabel: this.draft.nameLabel.trim(),
        nameDescription: this.draft.nameDescription.trim(),
        mtu: Math.max(576, Number(this.draft.mtu || 1500)),
        defaultLockingMode: String(this.draft.defaultLockingMode || 'unlocked').trim() || 'unlocked',
        purpose: Array.isArray(this.draft.purpose) ? this.draft.purpose.filter(Boolean) : [],
        tags: this.draft.tags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
        otherConfig: otherConfig.map,
      });
    },
  },
};
