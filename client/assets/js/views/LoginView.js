const LoginView = {
  components: { ConnectionLoginForm },
  template: `
    <div class="login-screen">
      <div class="scanline-overlay"></div>
      <div class="login-box animate-scale-in">
        <div class="login-logo">
          <img src="/assets/images/logo.svg" alt="XenMange">
          <h1>XenMange</h1>
          <p>XenServer Management Interface</p>
        </div>

        <connection-login-form
          :connection-name="connectionName"
          :host="host"
          :username="username"
          :password="password"
          :loading="loading"
          :error="error"
          @submit="handleLogin"
          @launch-demo="launchDemo"
          @update:connection-name="connectionName = $event"
          @update:host="host = $event"
          @update:username="username = $event"
          @update:password="password = $event">
        </connection-login-form>

        <div class="saved-connections" v-if="connections.length">
          <div class="saved-connections-head">
            <span>Saved Targets</span>
            <button class="btn btn-sm" @click="loadConnections" :disabled="connectionsLoading">
              <span class="mdi mdi-refresh"></span>
              Sync
            </button>
          </div>
          <button class="saved-connection"
                  v-for="connection in connections"
                  :key="connection.id"
                  @click="useConnection(connection)">
            <span class="mdi mdi-server-network"></span>
            <span class="saved-connection-meta">
              <strong>
                {{ connection.name }}
                <span v-if="connection.is_default" class="saved-connection-default">DEFAULT</span>
              </strong>
              <span>{{ connection.host }} · {{ connection.username }}</span>
            </span>
          </button>
        </div>
      </div>
    </div>
  `,
  data() {
    return {
      host: '',
      username: 'root',
      password: '',
      connectionName: '',
      loading: false,
      error: null,
      connectionsLoading: false,
      connections: [],
    };
  },
  async mounted() {
    await this.loadConnections();
  },
  methods: {
    async loadConnections() {
      this.connectionsLoading = true;
      try {
        this.connections = await api.getConnections();
        const defaultConnection = this.connections.find((connection) => connection.is_default);
        if (defaultConnection && !this.host) {
          this.useConnection(defaultConnection);
        }
      } catch (error) {
        this.connections = [];
      } finally {
        this.connectionsLoading = false;
      }
    },
    useConnection(connection) {
      this.connectionName = connection.name || '';
      this.host = connection.host || '';
      this.username = connection.username || 'root';
      this.password = '';
      this.error = null;
    },
    async handleLogin() {
      this.loading = true;
      this.error = null;

      try {
        await api.login(this.host, this.username, this.password);

        store.authenticated = true;
        store.demoMode = false;
        store.host = this.host;
        store.username = this.username;
        this.$router.push('/');
      } catch (error) {
        this.error = error.message || 'Connection failed';
      } finally {
        this.loading = false;
      }
    },
    launchDemo() {
      this.error = null;
      this.password = '';
      this.host = 'demo.fabric.local';
      this.username = 'demo';
      this.connectionName = 'Demo Fabric';
      store.authenticated = true;
      store.demoMode = true;
      store.host = 'Demo Fabric';
      store.username = 'demo';
      this.$router.push('/');
    },
  },
};
