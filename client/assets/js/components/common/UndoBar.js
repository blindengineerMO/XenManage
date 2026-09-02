const UndoBar = {
  props: {
    show: { type: Boolean, default: false },
    title: { type: String, default: 'Action queued' },
    message: { type: String, default: '' },
    secondsRemaining: { type: Number, default: 5 },
  },
  emits: ['undo'],
  template: `
    <aside v-if="show" class="undo-bar" role="status" aria-live="polite">
      <span class="mdi mdi-timer-sand undo-bar-icon" aria-hidden="true"></span>
      <div class="undo-bar-copy">
        <strong>{{ title }}</strong>
        <span>{{ message }}</span>
      </div>
      <span class="undo-bar-countdown">{{ secondsRemaining }}s</span>
      <button type="button" class="undo-bar-button" @click="$emit('undo')">
        <span class="mdi mdi-undo-variant"></span>
        Undo
      </button>
    </aside>
  `,
};
