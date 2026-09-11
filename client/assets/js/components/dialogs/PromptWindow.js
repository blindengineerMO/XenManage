const PromptWindow = {
  props: {
    show: { type: Boolean, default: false },
    title: { type: String, default: 'Enter a value' },
    label: { type: String, default: '' },
    placeholder: { type: String, default: '' },
    initialValue: { type: String, default: '' },
    confirmLabel: { type: String, default: 'OK' },
    errorMessage: { type: String, default: '' },
    showKindSelect: { type: Boolean, default: false },
    kindOptions: {
      type: Array,
      default: () => [
        { value: 'snippet', label: 'Snippet' },
        { value: 'deployment-template', label: 'Deployment Template' },
        { value: 'guest-script', label: 'Guest Script' },
      ],
    },
    initialKind: { type: String, default: 'snippet' },
  },
  emits: ['close', 'confirm'],
  data() {
    return {
      value: this.initialValue,
      kind: this.initialKind,
    };
  },
  watch: {
    show(visible) {
      if (visible) {
        this.value = this.initialValue;
        this.kind = this.initialKind;
        this.$nextTick(() => this.$refs.input?.focus());
      }
    },
  },
  methods: {
    submit() {
      const trimmed = this.value.trim();
      if (!trimmed) return;
      this.$emit('confirm', trimmed, this.kind);
    },
  },
  template: `
    <teleport to="body">
      <div v-if="show" class="app-modal-backdrop" @mousedown.self="$emit('close')">
        <section class="app-modal-window" role="dialog" aria-modal="true" :aria-label="title" @keydown.esc.prevent="$emit('close')">
          <header class="app-modal-header">
            <span class="mdi mdi-form-textbox"></span>
            <span>{{ title }}</span>
            <button class="fw-close" type="button" :aria-label="'Close ' + title" @click="$emit('close')"><span class="mdi mdi-close"></span></button>
          </header>
          <div class="app-modal-body">
          <div class="form-group" v-if="label">
            <label for="prompt-window-input">{{ label }}</label>
            <input ref="input"
                   class="form-input"
                   id="prompt-window-input"
                   type="text"
                   :aria-describedby="errorMessage ? 'prompt-window-error' : null"
                   :placeholder="placeholder"
                   v-model="value"
                   @keyup.enter="submit"
                   @keyup.esc="$emit('close')" />
          </div>
          <div class="form-group" v-if="showKindSelect">
            <label for="prompt-window-kind">Kind</label>
            <select class="form-input" id="prompt-window-kind" v-model="kind">
              <option v-for="option in kindOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
            </select>
          </div>
          <div id="prompt-window-error" class="form-error" v-if="errorMessage" role="alert" style="margin-top:8px">{{ errorMessage }}</div>
          <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:16px">
            <button class="btn btn-sm" type="button" @click="$emit('close')">Cancel</button>
            <button class="btn btn-sm btn-primary" type="button" :disabled="!value.trim()" @click="submit">{{ confirmLabel }}</button>
          </div>
          </div>
        </section>
      </div>
    </teleport>
  `,
};
