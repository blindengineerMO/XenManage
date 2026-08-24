function buildTemplatePromotionDraft(initialValue = {}) {
  return {
    baselineTemplateRef: initialValue.baselineTemplateRef || '',
    retireExistingStable: initialValue.retireExistingStable !== false,
    promotionNotes: initialValue.promotionNotes || '',
  };
}

const TemplatePromotionForm = {
  props: ['initialValue', 'saving', 'submitLabel', 'baselineLabel', 'eligible'],
  emits: ['submit'],
  template: `
    <form @submit.prevent="handleSubmit">
      <div class="detail-section" style="margin-top:0">
        <div class="detail-section-title">Promotion Controls</div>
        <div class="text-muted" style="line-height:1.6">
          {{ eligible
            ? 'Promote this staged template to the stable baseline so future rollout guidance and validation follow-through point at the new generation.'
            : 'This template must be validation-complete before it can be promoted to the stable baseline.' }}
        </div>
      </div>

      <div class="form-group" v-if="baselineLabel">
        <label class="form-toggle">
          <input type="checkbox" v-model="draft.retireExistingStable">
          <span>Retire current stable baseline: {{ baselineLabel }}</span>
        </label>
      </div>

      <div class="form-group">
        <label for="template-promotion-notes">Promotion Notes</label>
        <textarea id="template-promotion-notes"
                  class="form-input form-textarea"
                  v-model="draft.promotionNotes"
                  placeholder="Capture why this candidate is ready, what changed, and any rollout guardrails."
                  :disabled="!eligible"></textarea>
      </div>

      <button class="form-btn" type="submit" :disabled="saving || !eligible">
        <span class="mdi mdi-arrow-up-bold-circle-outline"></span>
        {{ saving ? 'Promoting...' : (submitLabel || 'Promote to Stable') }}
      </button>
    </form>
  `,
  data() {
    return {
      draft: buildTemplatePromotionDraft(this.initialValue),
    };
  },
  watch: {
    initialValue: {
      deep: true,
      handler(value) {
        this.draft = buildTemplatePromotionDraft(value);
      },
    },
  },
  methods: {
    handleSubmit() {
      this.$emit('submit', {
        baselineTemplateRef: String(this.draft.baselineTemplateRef || '').trim(),
        retireExistingStable: Boolean(this.draft.retireExistingStable),
        promotionNotes: String(this.draft.promotionNotes || '').trim(),
      });
    },
  },
};
