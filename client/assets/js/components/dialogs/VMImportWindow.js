const VMImportWindow = {
  components: {
    FloatingWindow,
    'vm-import-form': VMImportForm,
  },
  props: {
    showImportWindow: {
      type: Boolean,
      default: false,
    },
    importError: {
      type: String,
      default: null,
    },
    importStatusMessage: {
      type: String,
      default: '',
    },
    importStorageOptions: {
      type: Array,
      default: () => [],
    },
    importSaving: {
      type: Boolean,
      default: false,
    },
  },
  emits: [
    'close',
    'submit-vm-import',
  ],
  template: `
    <floating-window :show="showImportWindow"
                     title="Import Virtual Machine"
                     :width="700"
                     :height="620"
                     @close="$emit('close')">
      <div class="stack-list">
        <div class="form-error" v-if="importError" style="text-align:left">{{ importError }}</div>
        <div v-if="importStatusMessage" class="stack-item">
          <div>
            <strong>Import Completed</strong>
            <div class="text-muted mono" style="font-size:11px">{{ importStatusMessage }}</div>
          </div>
          <span class="badge badge-running">ready</span>
        </div>
        <vm-import-form
          :storage-options="importStorageOptions"
          :saving="importSaving"
          :submit-label="'Import Virtual Machine'"
          @submit="$emit('submit-vm-import', $event)">
        </vm-import-form>
      </div>
    </floating-window>
  `,
};
