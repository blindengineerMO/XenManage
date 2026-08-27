function formatPoolOtherConfigLines(record = {}) {
  return Object.entries(record || {})
    .filter(([key]) => String(key || '').trim())
    .map(([key, value]) => `${String(key).trim()}=${String(value || '').trim()}`)
    .join('\n');
}

function parsePoolOtherConfigLines(lines = '') {
  const map = {};
  const entries = String(lines || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  for (const entry of entries) {
    const index = entry.indexOf('=');
    if (index <= 0) {
      return {
        error: `Each pool other_config line must use key=value format. Problem: ${entry}`,
        map: {},
      };
    }

    const key = entry.slice(0, index).trim();
    const value = entry.slice(index + 1).trim();
    if (!key) {
      return {
        error: `Each pool other_config line must include a key before "=". Problem: ${entry}`,
        map: {},
      };
    }

    map[key] = value;
  }

  return { error: '', map };
}

function buildPoolConfigDraft(value = {}) {
  return {
    nameLabel: value.name_label || value.nameLabel || '',
    nameDescription: value.name_description || value.nameDescription || '',
    defaultSrRef: value.default_SR || value.defaultSrRef || '',
    igmpSnoopingEnabled: Boolean(value.IGMP_snooping_enabled ?? value.igmpSnoopingEnabled),
    migrationCompressionEnabled: Boolean(value.migration_compression ?? value.migrationCompressionEnabled),
    wlbEnabled: Boolean(value.wlb_enabled ?? value.wlbEnabled),
    tags: Array.isArray(value.tags) ? value.tags.join(', ') : String(value.tags || ''),
    otherConfigLines: formatPoolOtherConfigLines(value.other_config || value.otherConfig || {}),
  };
}

const PoolConfigForm = {
  props: ['initialValue', 'submitLabel', 'saving', 'storageOptions'],
  emits: ['submit'],
  template: `
    <form @submit.prevent="handleSubmit">
      <div class="form-group">
        <label for="pool-config-name">Pool Name</label>
        <input id="pool-config-name"
               class="form-input"
               v-model="draft.nameLabel"
               placeholder="Production Pool"
               required>
      </div>

      <div class="form-group">
        <label for="pool-config-description">Description</label>
        <textarea id="pool-config-description"
                  class="form-input form-textarea"
                  rows="4"
                  v-model="draft.nameDescription"
                  placeholder="Describe the pool role, tenancy, or operator notes."></textarea>
      </div>

      <div class="form-group">
        <label for="pool-config-default-sr">Default Storage Repository</label>
        <select id="pool-config-default-sr"
                class="form-select"
                v-model="draft.defaultSrRef">
          <option value="" disabled>Select a pool-scoped SR</option>
          <option v-for="option in normalizedStorageOptions"
                  :key="option.value"
                  :value="option.value">
            {{ option.label }}
          </option>
        </select>
        <div class="login-meta-note" v-if="normalizedStorageOptions.length">
          Pick the default SR that operators should use for storage-first workflows in this pool.
        </div>
        <div class="login-meta-note" v-else>
          No storage repositories are currently scoped to this pool, so the existing default SR will be preserved.
        </div>
      </div>

      <div class="text-muted mono" style="font-size:11px;margin-bottom:12px">
        This editor updates the operator-facing pool label, description, default SR, migration policy, WLB posture, IGMP snooping policy, tags, and custom metadata. Use one <code>key=value</code> pair per line for pool-specific metadata.
      </div>

      <div class="form-group">
        <label class="form-toggle" for="pool-config-migration-compression">
          <input id="pool-config-migration-compression"
                 type="checkbox"
                 v-model="draft.migrationCompressionEnabled">
          <span>Enable pool-wide migration compression by default</span>
        </label>
        <div class="login-meta-note">
          Sets the pool migration-compression preference used for same-pool relocation workflows and operator guidance.
        </div>
      </div>

      <div class="form-group">
        <label class="form-toggle" for="pool-config-wlb-enabled">
          <input id="pool-config-wlb-enabled"
                 type="checkbox"
                 v-model="draft.wlbEnabled">
          <span>Enable workload balancing for this pool</span>
        </label>
        <div class="login-meta-note">
          Uses the current Xen pool WLB toggle. The configured WLB endpoint remains read-only here because the upstream pool class documents the URL as readable but does not expose a matching setter.
        </div>
      </div>

      <div class="form-group">
        <label class="form-toggle" for="pool-config-igmp-snooping">
          <input id="pool-config-igmp-snooping"
                 type="checkbox"
                 v-model="draft.igmpSnoopingEnabled">
          <span>Enable IGMP snooping for multicast-sensitive pool networks</span>
        </label>
        <div class="login-meta-note">
          Keeps multicast membership tracking explicit at the pool level for workloads that rely on broadcast containment.
        </div>
      </div>

      <div class="form-group">
        <label for="pool-config-tags">Pool Tags</label>
        <input id="pool-config-tags"
               class="form-input"
               v-model="draft.tags"
               placeholder="prod, west, governed">
      </div>

      <div class="form-group">
        <label for="pool-config-other-config">Pool other_config</label>
        <textarea id="pool-config-other-config"
                  class="form-input form-textarea"
                  rows="4"
                  v-model="draft.otherConfigLines"
                  placeholder="owner=platform-ops&#10;cluster_profile=balanced"></textarea>
      </div>

      <div class="form-error" v-if="validationError" style="text-align:left;margin-bottom:12px">{{ validationError }}</div>

      <button class="form-btn" type="submit" :disabled="saving">
        <span class="mdi mdi-content-save-outline"></span>
        {{ saving ? 'Saving...' : (submitLabel || 'Save Pool Metadata') }}
      </button>
    </form>
  `,
  data() {
    return {
      draft: buildPoolConfigDraft(this.initialValue),
      validationError: '',
    };
  },
  computed: {
    normalizedStorageOptions() {
      return Array.isArray(this.storageOptions) ? this.storageOptions : [];
    },
  },
  watch: {
    initialValue: {
      deep: true,
      handler(value) {
        this.draft = buildPoolConfigDraft(value);
        this.validationError = '';
      },
    },
  },
  methods: {
    handleSubmit() {
      const otherConfig = parsePoolOtherConfigLines(this.draft.otherConfigLines);
      if (otherConfig.error) {
        this.validationError = otherConfig.error;
        return;
      }

      this.validationError = '';
      this.$emit('submit', {
        nameLabel: this.draft.nameLabel.trim(),
        nameDescription: this.draft.nameDescription.trim(),
        defaultSrRef: String(this.draft.defaultSrRef || '').trim(),
        igmpSnoopingEnabled: Boolean(this.draft.igmpSnoopingEnabled),
        migrationCompressionEnabled: Boolean(this.draft.migrationCompressionEnabled),
        wlbEnabled: Boolean(this.draft.wlbEnabled),
        tags: this.draft.tags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
        otherConfig: otherConfig.map,
      });
    },
  },
};
