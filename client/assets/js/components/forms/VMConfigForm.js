function buildVmConfigDraft(value = {}) {
  const memoryBytes = Number(value.memory_static_max || value.memoryStaticMax || 0);
  return {
    nameLabel: value.name_label || value.nameLabel || '',
    nameDescription: value.name_description || value.nameDescription || '',
    vcpus: Number(value.VCPUs_at_startup || value.vcpus || 1) || 1,
    memoryGiB: Math.max(1, Math.round(memoryBytes / (1024 ** 3)) || 1),
    tags: Array.isArray(value.tags) ? value.tags.join(', ') : String(value.tags || ''),
  };
}

const VMConfigForm = {
  props: ['initialValue', 'submitLabel', 'saving'],
  emits: ['submit'],
  template: `
    <form @submit.prevent="handleSubmit">
      <div class="form-group">
        <label for="vm-config-name">VM Name</label>
        <input id="vm-config-name" class="form-input" v-model="draft.nameLabel" placeholder="app-01" required>
      </div>

      <div class="form-group">
        <label for="vm-config-description">Description</label>
        <textarea id="vm-config-description"
                  class="form-input form-textarea"
                  v-model="draft.nameDescription"
                  placeholder="Describe the workload intent, owner, or maintenance notes."></textarea>
      </div>

      <div class="vm-inline-form-grid">
        <div class="form-group">
          <label for="vm-config-vcpus">vCPUs</label>
          <input id="vm-config-vcpus" class="form-input" v-model.number="draft.vcpus" type="number" min="1" max="128" required>
        </div>

        <div class="form-group">
          <label for="vm-config-memory">Memory (GiB)</label>
          <input id="vm-config-memory" class="form-input" v-model.number="draft.memoryGiB" type="number" min="1" step="1" required>
        </div>
      </div>

      <div class="form-group">
        <label for="vm-config-tags">Tags</label>
        <input id="vm-config-tags" class="form-input" v-model="draft.tags" placeholder="prod, api, tier-1">
      </div>

      <button class="form-btn" type="submit" :disabled="saving">
        <span class="mdi mdi-content-save-outline"></span>
        {{ saving ? 'Saving...' : (submitLabel || 'Save VM Config') }}
      </button>
    </form>
  `,
  data() {
    return {
      draft: buildVmConfigDraft(this.initialValue),
    };
  },
  watch: {
    initialValue: {
      deep: true,
      handler(value) {
        this.draft = buildVmConfigDraft(value);
      },
    },
  },
  methods: {
    handleSubmit() {
      this.$emit('submit', {
        nameLabel: this.draft.nameLabel.trim(),
        nameDescription: this.draft.nameDescription.trim(),
        vcpus: Number(this.draft.vcpus || 1),
        memoryStaticMax: Math.max(1, Number(this.draft.memoryGiB || 1)) * (1024 ** 3),
        tags: this.draft.tags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
      });
    },
  },
};
