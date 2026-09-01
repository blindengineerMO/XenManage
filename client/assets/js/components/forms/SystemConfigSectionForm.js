function buildSystemConfigDraft(initialValue = {}, fields = []) {
  return Object.fromEntries(
    fields.map((field) => {
      const fallback = field.defaultValue !== undefined ? field.defaultValue : (
        field.type === 'checkbox' ? false : (field.type === 'number' ? 0 : '')
      );
      return [field.key, initialValue[field.key] !== undefined ? initialValue[field.key] : fallback];
    })
  );
}

const SystemConfigSectionForm = {
  props: ['initialValue', 'fields', 'saving', 'submitLabel'],
  emits: ['submit', 'draft-change'],
  template: `
    <form @submit.prevent="handleSubmit">
      <div class="vm-inline-form-grid">
        <div v-for="field in normalizedFields"
             :key="field.key"
             class="form-group"
             :style="field.type === 'checkbox' ? 'grid-column:1 / -1' : ''">
          <template v-if="field.type === 'checkbox'">
            <label class="form-toggle">
              <input type="checkbox" v-model="draft[field.key]">
              <span>{{ field.label }}</span>
            </label>
            <div class="text-muted" style="font-size:12px;margin-top:6px" v-if="field.help">{{ field.help }}</div>
          </template>

          <template v-else-if="field.type === 'select'">
            <label :for="'system-config-' + field.key">{{ field.label }}</label>
            <select class="form-input"
                    :id="'system-config-' + field.key"
                    v-model="draft[field.key]">
              <option v-for="option in field.options || []" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
            <div class="text-muted" style="font-size:12px;margin-top:6px" v-if="field.help">{{ field.help }}</div>
          </template>

          <template v-else-if="field.type === 'textarea'">
            <label :for="'system-config-' + field.key">{{ field.label }}</label>
            <textarea class="form-input"
                      :id="'system-config-' + field.key"
                      :placeholder="field.placeholder || ''"
                      rows="3"
                      v-model="draft[field.key]"></textarea>
            <div class="text-muted" style="font-size:12px;margin-top:6px" v-if="field.help">{{ field.help }}</div>
          </template>

          <template v-else>
            <label :for="'system-config-' + field.key">{{ field.label }}</label>
            <input class="form-input"
                   :id="'system-config-' + field.key"
                   :type="field.type || 'text'"
                   :min="field.min"
                   :max="field.max"
                   :step="field.step || (field.type === 'number' ? 1 : undefined)"
                   :placeholder="field.placeholder || ''"
                   v-model="draft[field.key]">
            <div class="text-muted" style="font-size:12px;margin-top:6px" v-if="field.help">{{ field.help }}</div>
          </template>
        </div>
      </div>

      <div class="form-actions">
        <button class="form-btn" type="submit" :disabled="saving">
          <span class="mdi mdi-content-save-outline"></span>
          {{ saving ? 'Saving...' : (submitLabel || 'Save Settings') }}
        </button>
      </div>
    </form>
  `,
  data() {
    return {
      draft: buildSystemConfigDraft(this.initialValue, this.fields),
    };
  },
  computed: {
    normalizedFields() {
      return Array.isArray(this.fields) ? this.fields : [];
    },
  },
  watch: {
    draft: {
      deep: true,
      handler() {
        this.$emit('draft-change', this.buildPayload());
      },
    },
    initialValue: {
      deep: true,
      handler(value) {
        this.draft = buildSystemConfigDraft(value, this.fields);
      },
    },
    fields: {
      deep: true,
      handler(value) {
        this.draft = buildSystemConfigDraft(this.initialValue, value);
      },
    },
  },
  methods: {
    buildPayload() {
      const payload = {};

      for (const field of this.normalizedFields) {
        let value = this.draft[field.key];

        if (field.type === 'number') {
          value = Number(value || 0);
        } else if (field.type === 'checkbox') {
          value = Boolean(value);
        } else {
          value = String(value || '').trim();
        }

        payload[field.key] = value;
      }

      return payload;
    },
    handleSubmit() {
      const payload = this.buildPayload();
      this.$emit('submit', payload);
    },
  },
};
