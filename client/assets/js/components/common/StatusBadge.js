const StatusBadge = {
  props: ['status'],
  template: `
    <span class="badge" :class="badgeClass">
      <span class="mdi" :class="iconClass"></span>
      {{ status }}
    </span>
  `,
  computed: {
    badgeClass() {
      const state = (this.status || '').toLowerCase();
      if (['running', 'online', 'enabled', 'connected', 'true', 'success', 'completed', 'compatible', 'ready'].includes(state)) return 'badge-running';
      if (['halted', 'offline', 'disabled', 'disconnected', 'false', 'cancelled', 'canceled'].includes(state)) return 'badge-halted';
      if (['suspended', 'paused', 'warning', 'maintenance', 'review'].includes(state)) return 'badge-suspended';
      if (['pending', 'queued', 'notice'].includes(state)) return 'badge-info';
      if (['error', 'critical', 'failed', 'failure', 'incompatible', 'blocked'].includes(state)) return 'badge-error';
      return 'badge-info';
    },
    iconClass() {
      const state = (this.status || '').toLowerCase();
      if (['running', 'online', 'enabled', 'connected', 'true', 'success', 'completed', 'compatible', 'ready'].includes(state)) return 'mdi-circle';
      if (['halted', 'offline', 'disabled', 'disconnected', 'false', 'cancelled', 'canceled'].includes(state)) return 'mdi-circle-outline';
      if (['suspended', 'paused', 'warning', 'maintenance', 'review'].includes(state)) return 'mdi-pause-circle';
      if (['pending', 'queued', 'notice'].includes(state)) return 'mdi-timer-sand';
      if (['error', 'critical', 'failed', 'failure', 'incompatible', 'blocked'].includes(state)) return 'mdi-alert-circle';
      return 'mdi-information';
    },
  },
};
