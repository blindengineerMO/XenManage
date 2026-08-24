function buildTemplateDeploymentValidationDraft(record = {}) {
  return {
    validationStatus: record.validationStatus || 'pending',
    guestCustomization: record.guestCustomization || '',
    bootVerified: Boolean(record.bootVerified),
    networkVerified: Boolean(record.networkVerified),
    storageVerified: Boolean(record.storageVerified),
    policyTagged: Boolean(record.policyTagged),
    validationNotes: record.validationNotes || '',
  };
}

const TemplateDeploymentValidationForm = {
  props: ['deploymentRecord', 'saving', 'submitLabel'],
  emits: ['submit'],
  template: `
    <form @submit.prevent="handleSubmit">
      <div class="vm-inline-form-grid">
        <div class="form-group">
          <label for="deployment-validation-status">Validation Status</label>
          <select id="deployment-validation-status" class="form-input" v-model="draft.validationStatus">
            <option value="pending">Pending</option>
            <option value="validated">Validated</option>
            <option value="warning">Warning</option>
            <option value="failed">Failed</option>
          </select>
        </div>

        <div class="form-group">
          <label for="deployment-validation-customization">Guest Customization</label>
          <input id="deployment-validation-customization" class="form-input" v-model="draft.guestCustomization" placeholder="cloud-init baseline">
        </div>
      </div>

      <div class="stack-list" style="margin-bottom:16px">
        <label class="form-toggle">
          <input type="checkbox" v-model="draft.bootVerified">
          <span>Guest boot completed and operator console access was confirmed</span>
        </label>
        <label class="form-toggle">
          <input type="checkbox" v-model="draft.networkVerified">
          <span>Primary network, addressing, and expected connectivity were verified</span>
        </label>
        <label class="form-toggle">
          <input type="checkbox" v-model="draft.storageVerified">
          <span>Root disk, mapped storage, and expected capacity were validated</span>
        </label>
        <label class="form-toggle">
          <input type="checkbox" v-model="draft.policyTagged">
          <span>Governance or workload tags were applied to the deployed VM</span>
        </label>
      </div>

      <div class="form-group">
        <label for="deployment-validation-notes">Validation Notes</label>
        <textarea id="deployment-validation-notes"
                  class="form-input form-textarea"
                  v-model="draft.validationNotes"
                  placeholder="Capture guest issues, missing devices, customization outcomes, or follow-up tasks."></textarea>
      </div>

      <button class="form-btn" type="submit" :disabled="saving">
        <span class="mdi mdi-clipboard-check-outline"></span>
        {{ saving ? 'Saving...' : (submitLabel || 'Save Validation') }}
      </button>
    </form>
  `,
  data() {
    return {
      draft: buildTemplateDeploymentValidationDraft(this.deploymentRecord),
    };
  },
  watch: {
    deploymentRecord: {
      deep: true,
      handler(value) {
        this.draft = buildTemplateDeploymentValidationDraft(value);
      },
    },
  },
  methods: {
    handleSubmit() {
      this.$emit('submit', {
        validationStatus: this.draft.validationStatus,
        guestCustomization: this.draft.guestCustomization.trim(),
        bootVerified: Boolean(this.draft.bootVerified),
        networkVerified: Boolean(this.draft.networkVerified),
        storageVerified: Boolean(this.draft.storageVerified),
        policyTagged: Boolean(this.draft.policyTagged),
        validationNotes: this.draft.validationNotes.trim(),
      });
    },
  },
};
