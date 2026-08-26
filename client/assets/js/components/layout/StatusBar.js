const StatusBar = {
  template: `
    <div class="statusbar">
      <div class="statusbar-item">
        <span class="mdi mdi-shield-check"></span>
        <span>Secure</span>
      </div>
      <div class="statusbar-item">
        <span class="mdi mdi-server-network"></span>
        <span>{{ connectionLabel }}</span>
      </div>
      <div class="statusbar-item">
        <span class="mdi mdi-radar"></span>
        <span>{{ shellLabel }}</span>
      </div>
      <div class="statusbar-item" style="margin-left:auto">
        <span class="mdi mdi-clock-outline"></span>
        <span>{{ time }}</span>
      </div>
    </div>
  `,
  data() {
    return {
      time: '',
      interval: null,
    };
  },
  mounted() {
    this.updateTime();
    this.interval = setInterval(this.updateTime, 1000);
  },
  beforeUnmount() {
    clearInterval(this.interval);
  },
  methods: {
    updateTime() {
      this.time = new Date().toLocaleTimeString('en-US', { hour12: false });
    },
  },
  computed: {
    connectionLabel() {
      if (!store.authenticated) return 'No connection';
      if (store.demoMode) return 'Demo Fabric';
      if (store.connected) {
        const activeLabel = store.host || 'Connected';
        if ((store.connectedTargets || []).length > 1) {
          return `${store.connectedTargets.length} live targets · ${activeLabel}`;
        }
        return activeLabel;
      }
      return 'No Xen target';
    },
    shellLabel() {
      if (!store.ready) return 'Bootstrap in progress';
      if (store.demoMode) return 'Demo shell online';
      if (!store.connected) return 'Control-plane session online';
      return (store.connectedTargets || []).length > 1
        ? 'Multi-target shell online'
        : 'Interactive shell online';
    },
    store() {
      return store;
    },
  },
};
