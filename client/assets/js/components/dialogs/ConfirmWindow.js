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
    <div v-if="show" class="app-modal-backdrop" @mousedown.self="$emit('close')">
      <section class="app-modal-window" role="dialog" aria-modal="true" :aria-label="title">
        <header class="app-modal-header">
          <span class="mdi" :class="danger ? 'mdi-alert-outline' : 'mdi-information-outline'"></span>
          <span>{{ title }}</span>
          <button class="fw-close" type="button" @click="$emit('close')"><span class="mdi mdi-close"></span></button>
        </header>
        <div class="app-modal-body">
        <p class="text-muted" style="white-space:pre-wrap;margin:0">{{ message }}</p>
        <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:16px">
          <button class="btn btn-sm" type="button" @click="$emit('close')">Cancel</button>
          <button :class="danger ? 'btn btn-sm btn-danger' : 'btn btn-sm btn-primary'" type="button" @click="$emit('confirm')">{{ confirmLabel }}</button>
        </div>
        </div>
      </section>
    </div>
  `,
};
