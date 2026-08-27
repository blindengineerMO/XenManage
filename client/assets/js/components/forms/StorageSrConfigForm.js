function isManagedStorageOtherConfigKey(key = '') {
  return ['last_rescan_at', 'last_repair_at'].includes(String(key || '').trim());
}

function formatStorageOtherConfigLines(record = {}) {
  return Object.entries(record || {})
    .filter(([key, value]) => !isManagedStorageOtherConfigKey(key) && String(key || '').trim() && String(value || '').trim())
    .map(([key, value]) => `${String(key).trim()}=${String(value).trim()}`)
    .join('\n');
}

function buildStorageSrConfigDraft(value = {}) {
  return {
    nameLabel: value.name_label || value.nameLabel || '',
    nameDescription: value.name_description || value.nameDescription || '',
    tags: Array.isArray(value.tags) ? value.tags.join(', ') : String(value.tags || ''),
    otherConfigLines: formatStorageOtherConfigLines(value.other_config || value.otherConfig || {}),
  };
}

function parseStorageOtherConfigLines(lines = '') {
  const map = {};
  const entries = String(lines || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  for (const entry of entries) {
    const index = entry.indexOf('=');
    if (index <= 0) {
      return {
        error: `Each other_config line must use key=value format. Problem: ${entry}`,
        map: {},
      };
    }

    const key = entry.slice(0, index).trim();
    const value = entry.slice(index + 1).trim();
    if (!key) {
      return {
        error: `Each other_config line must include a key before "=". Problem: ${entry}`,
        map: {},
      };
    }

    map[key] = value;
  }

  return { error: '', map };
}

const StorageSrConfigForm = {
  props: ['initialValue', 'submitLabel', 'saving'],
  emits: ['submit'],
  template: `
    <form @submit.prevent="handleSubmit">
      <div class="form-group">
        <label for="storage-sr-config-name">Repository Display Name</label>
        <input id="storage-sr-config-name"
               class="form-input"
               v-model="draft.nameLabel"
               placeholder="Primary SR"
               required>
      </div>

      <div class="form-group">
        <label for="storage-sr-config-description">Repository Description</label>
        <textarea id="storage-sr-config-description"
                  class="form-input form-textarea"
                  rows="4"
                  v-model="draft.nameDescription"
                  placeholder="Describe the repository role, retention tier, or operator notes."></textarea>
      </div>

      <div class="form-group">
        <label for="storage-sr-config-tags">Repository Tags</label>
        <input id="storage-sr-config-tags"
               class="form-input"
               v-model="draft.tags"
               placeholder="flash, performance, prod">
      </div>

      <div class="form-group">
        <label for="storage-sr-config-other-config">Repository other_config</label>
        <textarea id="storage-sr-config-other-config"
                  class="form-input form-textarea"
                  rows="4"
                  v-model="draft.otherConfigLines"
                  placeholder="owner=platform-ops&#10;tier=gold"></textarea>
      </div>

      <div class="text-muted mono" style="font-size:11px;margin-bottom:12px">
        One entry per line in <code>key=value</code> format. XenManage keeps the rescan and repair telemetry keys managed separately.
      </div>

      <div class="form-error" v-if="validationError" style="text-align:left;margin-bottom:12px">{{ validationError }}</div>

      <button class="form-btn" type="submit" :disabled="saving">
        <span class="mdi mdi-content-save-outline"></span>
        {{ saving ? 'Saving...' : (submitLabel || 'Save Repository Metadata') }}
      </button>
    </form>
  `,
  data() {
    return {
      draft: buildStorageSrConfigDraft(this.initialValue),
      validationError: '',
    };
  },
  watch: {
    initialValue: {
      deep: true,
      handler(value) {
        this.draft = buildStorageSrConfigDraft(value);
        this.validationError = '';
      },
    },
  },
  methods: {
    handleSubmit() {
      const otherConfig = parseStorageOtherConfigLines(this.draft.otherConfigLines);
      if (otherConfig.error) {
        this.validationError = otherConfig.error;
        return;
      }

      this.validationError = '';
      this.$emit('submit', {
        nameLabel: this.draft.nameLabel.trim(),
        nameDescription: this.draft.nameDescription.trim(),
        tags: this.draft.tags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
        otherConfig: otherConfig.map,
      });
    },
  },
};
