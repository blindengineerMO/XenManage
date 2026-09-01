const PromptWindow = {
  props: {
    show: { type: Boolean, default: false },
    title: { type: String, default: 'Enter a value' },
    label: { type: String, default: '' },
    placeholder: { type: String, default: '' },
    initialValue: { type: String, default: '' },
    confirmLabel: { type: String, default: 'OK' },
    errorMessage: { type: String, default: '' },
  },
  emits: ['close', 'confirm'],
  data() {
    return {
      value: this.initialValue,
    };
  },
  watch: {
    show(visible) {
      if (visible) {
        this.value = this.initialValue;
        this.$nextTick(() => this.$refs.input?.focus());
      }
    },
  },
  methods: {
    submit() {
      const trimmed = this.value.trim();
      if (!trimmed) return;
      this.$emit('confirm', trimmed);
    },
  },
  template: `
    <div v-if="show" class="app-modal-backdrop" @mousedown.self="$emit('close')">
      <section class="app-modal-window" role="dialog" aria-modal="true" :aria-label="title">
        <header class="app-modal-header">
          <span class="mdi mdi-form-textbox"></span>
          <span>{{ title }}</span>
          <button class="fw-close" type="button" @click="$emit('close')"><span class="mdi mdi-close"></span></button>
        </header>
        <div class="app-modal-body">
        <div class="form-group" v-if="label">
          <label>{{ label }}</label>
          <input ref="input"
                 class="form-control"
                 type="text"
                 :placeholder="placeholder"
                 v-model="value"
                 @keyup.enter="submit"
                 @keyup.esc="$emit('close')" />
        </div>
        <div class="form-error" v-if="errorMessage" style="margin-top:8px">{{ errorMessage }}</div>
        <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:16px">
          <button class="btn btn-sm" type="button" @click="$emit('close')">Cancel</button>
          <button class="btn btn-sm btn-primary" type="button" :disabled="!value.trim()" @click="submit">{{ confirmLabel }}</button>
        </div>
        </div>
      </section>
    </div>
  `,
};
