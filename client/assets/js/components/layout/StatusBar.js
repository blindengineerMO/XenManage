const StatusBar = {
  template: `
    <div class="statusbar">
      <div class="statusbar-item">
        <span class="mdi mdi-shield-check"></span>
        <span>Secure</span>
      </div>
      <div class="statusbar-item">
        <span class="mdi mdi-server-network"></span>
        <span>{{ store.authenticated ? store.host : 'No connection' }}</span>
      </div>
      <div class="statusbar-item">
        <span class="mdi mdi-radar"></span>
        <span>{{ store.ready ? (store.demoMode ? 'Demo shell online' : 'Interactive shell online') : 'Bootstrap in progress' }}</span>
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
    store() {
      return store;
    },
  },
};

