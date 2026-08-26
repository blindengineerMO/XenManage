function buildVmImportDraft(storageOptions = []) {
  return {
    file: null,
    fileName: '',
    srRef: storageOptions[0]?.ref || '',
    metadataOnly: false,
    restore: false,
    force: false,
  };
}

const VMImportForm = {
  props: ['storageOptions', 'saving', 'submitLabel'],
  emits: ['submit'],
  template: `
    <form @submit.prevent="handleSubmit">
      <div class="form-group">
        <label for="vm-import-file">XVA Package</label>
        <input id="vm-import-file" class="form-input" type="file" accept=".xva,application/octet-stream,.xml,.tar" @change="handleFileChange" required>
        <div class="text-muted mono" style="font-size:11px;margin-top:8px">
          {{ draft.fileName || 'Choose an exported XenServer XVA package or metadata archive.' }}
        </div>
      </div>

      <div class="form-group" v-if="!draft.metadataOnly">
        <label for="vm-import-storage">Target Storage</label>
        <select id="vm-import-storage" class="form-input" v-model="draft.srRef">
          <option value="">Use pool default storage</option>
          <option v-for="sr in storageOptions" :key="sr.ref" :value="sr.ref">
            {{ sr.name_label || sr.ref }} · {{ sr.type || 'storage' }}
          </option>
        </select>
      </div>

      <div class="vm-inline-form-grid">
        <label class="form-toggle">
          <input type="checkbox" v-model="draft.metadataOnly">
          <span>Import metadata only without disk payloads</span>
        </label>

        <label class="form-toggle">
          <input type="checkbox" v-model="draft.restore">
          <span>Restore original VM identity and MAC addresses</span>
        </label>
      </div>

      <label class="form-toggle">
        <input type="checkbox" v-model="draft.force">
        <span>Ignore checksum failures during import if XenServer allows it</span>
      </label>

      <div class="text-muted mono" style="font-size:11px;margin-top:10px">
        Full imports stream the package directly to XenServer. Metadata-only imports are useful for archival review or template inspection without disk materialization.
      </div>

      <div class="form-actions">
        <button class="form-btn" type="submit" :disabled="saving || !draft.file">
          <span class="mdi mdi-package-up"></span>
          {{ saving ? 'Importing...' : (submitLabel || 'Import XVA Package') }}
        </button>
      </div>
    </form>
  `,
  data() {
    return {
      draft: buildVmImportDraft(this.storageOptions),
    };
  },
  watch: {
    storageOptions: {
      deep: true,
      handler(value) {
        if (!this.draft.srRef && Array.isArray(value) && value.length) {
          this.draft.srRef = value[0].ref;
        }
      },
    },
  },
  methods: {
    handleFileChange(event) {
      const file = event?.target?.files?.[0] || null;
      this.draft.file = file;
      this.draft.fileName = file?.name || '';
    },
    handleSubmit() {
      if (!this.draft.file) return;

      this.$emit('submit', {
        file: this.draft.file,
        fileName: this.draft.file.name || this.draft.fileName || 'package.xva',
        srRef: this.draft.metadataOnly ? '' : String(this.draft.srRef || '').trim(),
        metadataOnly: Boolean(this.draft.metadataOnly),
        restore: Boolean(this.draft.restore),
        force: Boolean(this.draft.force),
      });
    },
  },
};
