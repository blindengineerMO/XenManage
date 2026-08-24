function buildTemplateGovernanceDraft(templateRecord = {}, initialValue = {}) {
  const templateTags = Array.isArray(templateRecord.tags) ? templateRecord.tags.map((tag) => String(tag).toLowerCase()) : [];
  const fallbackProfile = templateTags.includes('windows')
    ? 'Windows'
    : templateTags.includes('linux')
      ? 'Linux'
      : templateRecord.platform?.vtpm
        ? 'Secure Windows'
        : templateRecord.platform?.secureboot
          ? 'Secure Linux'
          : 'Standard';
  const fallbackStage = templateTags.includes('stable') || templateTags.includes('baseline')
    ? 'stable'
    : templateTags.includes('staged') || templateTags.includes('candidate')
      ? 'staged'
      : 'draft';

  return {
    versionLabel: initialValue.versionLabel || '',
    profileLabel: initialValue.profileLabel || fallbackProfile,
    lifecycleStage: initialValue.lifecycleStage || fallbackStage,
    goldenImage: typeof initialValue.goldenImage === 'boolean'
      ? initialValue.goldenImage
      : templateTags.includes('golden') || templateTags.includes('baseline'),
    guestCustomization: initialValue.guestCustomization || '',
    validationStatus: initialValue.validationStatus || 'untested',
    lastValidatedAt: initialValue.lastValidatedAt ? String(initialValue.lastValidatedAt).slice(0, 10) : '',
    owner: initialValue.owner || '',
    notes: initialValue.notes || '',
  };
}

const TemplateGovernanceForm = {
  props: ['templateRecord', 'initialValue', 'saving', 'submitLabel'],
  emits: ['submit'],
  template: `
    <form @submit.prevent="handleSubmit">
      <div class="vm-inline-form-grid">
        <div class="form-group">
          <label for="template-governance-version">Version Label</label>
          <input id="template-governance-version" class="form-input" v-model="draft.versionLabel" placeholder="2026.08-lts">
        </div>

        <div class="form-group">
          <label for="template-governance-owner">Catalog Owner</label>
          <input id="template-governance-owner" class="form-input" v-model="draft.owner" placeholder="Platform Ops">
        </div>
      </div>

      <div class="vm-inline-form-grid">
        <div class="form-group">
          <label for="template-governance-profile">Profile Label</label>
          <input id="template-governance-profile" class="form-input" v-model="draft.profileLabel" placeholder="Linux, Secure Windows, Database">
        </div>

        <div class="form-group">
          <label for="template-governance-stage">Lifecycle Stage</label>
          <select id="template-governance-stage" class="form-input" v-model="draft.lifecycleStage">
            <option value="draft">Draft</option>
            <option value="staged">Staged</option>
            <option value="stable">Stable</option>
            <option value="deprecated">Deprecated</option>
          </select>
        </div>
      </div>

      <div class="vm-inline-form-grid">
        <div class="form-group">
          <label for="template-governance-customization">Guest Customization</label>
          <input id="template-governance-customization" class="form-input" v-model="draft.guestCustomization" placeholder="cloud-init baseline, sysprep-core, domain-join">
        </div>

        <div class="form-group">
          <label for="template-governance-validation">Validation Status</label>
          <select id="template-governance-validation" class="form-input" v-model="draft.validationStatus">
            <option value="untested">Untested</option>
            <option value="review">Needs Review</option>
            <option value="validated">Validated</option>
            <option value="failed">Failed</option>
          </select>
        </div>
      </div>

      <div class="vm-inline-form-grid">
        <div class="form-group">
          <label for="template-governance-date">Last Validated</label>
          <input id="template-governance-date" class="form-input" v-model="draft.lastValidatedAt" type="date">
        </div>

        <div class="form-group" style="display:flex;align-items:flex-end">
          <label class="form-toggle" style="margin-bottom:0">
            <input type="checkbox" v-model="draft.goldenImage">
            <span>Mark as golden image baseline</span>
          </label>
        </div>
      </div>

      <div class="form-group">
        <label for="template-governance-notes">Governance Notes</label>
        <textarea id="template-governance-notes"
                  class="form-input form-textarea"
                  v-model="draft.notes"
                  placeholder="Track guest tooling, patch wave, hardening notes, or approval details."></textarea>
      </div>

      <button class="form-btn" type="submit" :disabled="saving">
        <span class="mdi mdi-content-save-outline"></span>
        {{ saving ? 'Saving...' : (submitLabel || 'Save Governance') }}
      </button>
    </form>
  `,
  data() {
    return {
      draft: buildTemplateGovernanceDraft(this.templateRecord, this.initialValue),
    };
  },
  watch: {
    initialValue: {
      deep: true,
      handler(value) {
        this.draft = buildTemplateGovernanceDraft(this.templateRecord, value);
      },
    },
    templateRecord: {
      deep: true,
      handler(value) {
        this.draft = buildTemplateGovernanceDraft(value, this.initialValue);
      },
    },
  },
  methods: {
    handleSubmit() {
      this.$emit('submit', {
        versionLabel: this.draft.versionLabel.trim(),
        profileLabel: this.draft.profileLabel.trim(),
        lifecycleStage: this.draft.lifecycleStage,
        goldenImage: Boolean(this.draft.goldenImage),
        guestCustomization: this.draft.guestCustomization.trim(),
        validationStatus: this.draft.validationStatus,
        lastValidatedAt: this.draft.lastValidatedAt ? `${this.draft.lastValidatedAt}T00:00:00.000Z` : '',
        owner: this.draft.owner.trim(),
        notes: this.draft.notes.trim(),
      });
    },
  },
};
