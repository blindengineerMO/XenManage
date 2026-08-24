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
      if (store.connected) return store.host || 'Connected';
      return 'No Xen target';
    },
    shellLabel() {
      if (!store.ready) return 'Bootstrap in progress';
      if (store.demoMode) return 'Demo shell online';
      return store.connected ? 'Interactive shell online' : 'Control-plane session online';
    },
    store() {
      return store;
    },
  },
};
