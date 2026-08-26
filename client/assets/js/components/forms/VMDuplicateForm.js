function buildVmDuplicateDraft(value = {}, storageOptions = []) {
  const baseName = String(value.name_label || value.nameLabel || 'vm').trim();
  return {
    nameLabel: baseName ? `${baseName}-clone` : '',
    nameDescription: value.name_description || value.nameDescription || '',
    mode: 'clone',
    srRef: storageOptions[0]?.ref || '',
    startAfter: false,
  };
}

const VMDuplicateForm = {
  props: ['initialValue', 'storageOptions', 'submitLabel', 'saving'],
  emits: ['submit'],
  template: `
    <form @submit.prevent="handleSubmit">
      <div class="form-group">
        <label for="vm-duplicate-name">New VM Name</label>
        <input id="vm-duplicate-name" class="form-input" v-model="draft.nameLabel" placeholder="app-01-clone" required>
      </div>

      <div class="form-group">
        <label for="vm-duplicate-description">Description</label>
        <textarea id="vm-duplicate-description"
                  class="form-input form-textarea"
                  v-model="draft.nameDescription"
                  placeholder="Capture the rollout purpose, test intent, or copy destination note."></textarea>
      </div>

      <div class="vm-inline-form-grid">
        <div class="form-group">
          <label for="vm-duplicate-mode">Copy Mode</label>
          <select id="vm-duplicate-mode" class="form-input" v-model="draft.mode">
            <option value="clone">Fast Clone (CoW)</option>
            <option value="copy">Full Copy</option>
          </select>
        </div>

        <div class="form-group" v-if="draft.mode === 'copy'">
          <label for="vm-duplicate-storage">Target Storage</label>
          <select id="vm-duplicate-storage" class="form-input" v-model="draft.srRef" required>
            <option value="" disabled>Select storage</option>
            <option v-for="sr in storageOptions" :key="sr.ref" :value="sr.ref">
              {{ sr.name_label || sr.ref }} · {{ sr.type || 'storage' }}
            </option>
          </select>
        </div>
      </div>

      <label class="form-toggle">
        <input type="checkbox" v-model="draft.startAfter">
        <span>Start the duplicated VM after provisioning completes</span>
      </label>

      <button class="form-btn" type="submit" :disabled="saving">
        <span class="mdi mdi-content-copy"></span>
        {{ saving ? 'Provisioning...' : (submitLabel || 'Create VM Copy') }}
      </button>
    </form>
  `,
  data() {
    return {
      draft: buildVmDuplicateDraft(this.initialValue, this.storageOptions),
    };
  },
  watch: {
    initialValue: {
      deep: true,
      handler(value) {
        this.draft = buildVmDuplicateDraft(value, this.storageOptions);
      },
    },
    storageOptions: {
      deep: true,
      handler(value) {
        if (!this.draft.srRef && value.length) {
          this.draft.srRef = value[0].ref;
        }
      },
    },
  },
  methods: {
    handleSubmit() {
      this.$emit('submit', {
        nameLabel: this.draft.nameLabel.trim(),
        nameDescription: this.draft.nameDescription.trim(),
        mode: this.draft.mode === 'copy' ? 'copy' : 'clone',
        srRef: this.draft.mode === 'copy' ? (this.draft.srRef || '') : '',
        startAfter: Boolean(this.draft.startAfter),
      });
    },
  },
};
