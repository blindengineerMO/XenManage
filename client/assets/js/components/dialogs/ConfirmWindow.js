const ConfirmWindow = {
  props: {
    show: { type: Boolean, default: false },
    title: { type: String, default: 'Confirm' },
    message: { type: String, default: '' },
    confirmLabel: { type: String, default: 'Confirm' },
    danger: { type: Boolean, default: false },
  },
  emits: ['close', 'confirm'],
  template: `
    <teleport to="body">
      <div v-if="show" class="app-modal-backdrop" @mousedown.self="$emit('close')">
        <section class="app-modal-window confirm-window"
                 :class="{ 'confirm-window-danger': danger }"
                 :role="danger ? 'alertdialog' : 'dialog'"
                 aria-modal="true"
                 :aria-label="title"
                 tabindex="-1"
                 @keydown.esc.prevent="$emit('close')">
          <header class="app-modal-header confirm-window-header">
            <span class="mdi" :class="danger ? 'mdi-alert-outline' : 'mdi-information-outline'"></span>
            <span>{{ title }}</span>
            <button class="fw-close" type="button" aria-label="Close confirmation" @click="$emit('close')"><span class="mdi mdi-close"></span></button>
          </header>
          <div class="app-modal-body confirm-window-body">
            <div class="confirm-window-marker" aria-hidden="true"><span class="mdi" :class="danger ? 'mdi-alert' : 'mdi-shield-check-outline'"></span></div>
            <p class="confirm-window-message">{{ message }}</p>
            <div class="confirm-window-actions">
              <button ref="cancelButton" class="btn btn-sm" type="button" @click="$emit('close')">Cancel</button>
              <button :class="danger ? 'btn btn-sm btn-danger' : 'btn btn-sm btn-primary'" type="button" @click="$emit('confirm')">{{ confirmLabel }}</button>
            </div>
          </div>
        </section>
      </div>
    </teleport>
  `,
  watch: {
    show(value) {
      if (value) this.$nextTick(() => this.$refs.cancelButton?.focus());
    },
  },
};
