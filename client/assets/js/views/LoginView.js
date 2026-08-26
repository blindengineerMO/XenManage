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

        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">
          <button class="btn btn-sm"
                  :class="{ 'btn-primary': authMode === 'local' }"
                  @click="authMode = 'local'">
            <span class="mdi mdi-shield-account-outline"></span>
            XenMange Sign In
          </button>
          <button class="btn btn-sm"
                  :class="{ 'btn-primary': authMode === 'xen' }"
                  @click="authMode = 'xen'">
            <span class="mdi mdi-server-network"></span>
            Direct Xen Login
          </button>
        </div>

        <form v-if="authMode === 'local'" @submit.prevent="handleAppLogin">
          <div class="form-group">
            <label for="app-username">Username</label>
            <input id="app-username"
                   class="form-input"
                   v-model="appUsername"
                   autocomplete="username"
                   placeholder="admin"
                   required>
          </div>
          <div class="form-group">
            <label for="app-password">Password</label>
            <input id="app-password"
                   class="form-input"
                   v-model="appPassword"
                   type="password"
                   autocomplete="current-password"
                   placeholder="Password"
                   required>
          </div>

          <div class="form-actions">
            <button class="form-btn" type="submit" :disabled="loading">
              <span v-if="loading" class="loading-spinner" style="margin-right:8px"></span>
              {{ loading ? 'Signing In...' : 'Sign In to XenMange' }}
            </button>
            <button class="form-btn form-btn-secondary" type="button" :disabled="loading" @click="launchDemo">
              <span class="mdi mdi-flask-outline"></span>
              Open Demo Dashboard
            </button>
          </div>
          <div class="login-meta-note">Bootstrap control-plane credentials default to <span class="mono">admin / admin123!</span> unless overridden by environment configuration.</div>
          <div class="form-error" v-if="error">{{ error }}</div>
        </form>

        <template v-else>
          <connection-login-form
            :connection-name="connectionName"
            :host="host"
            :username="username"
            :password="password"
            :loading="loading"
            :error="error"
            @submit="handleXenLogin"
            @launch-demo="launchDemo"
            @update:connection-name="connectionName = $event"
            @update:host="host = $event"
            @update:username="username = $event"
            @update:password="password = $event">
          </connection-login-form>
        </template>
      </div>
    </div>
  `,
  data() {
    return {
      authMode: 'local',
      appUsername: 'admin',
      appPassword: '',
      host: '',
      username: 'root',
      password: '',
      connectionName: '',
      loading: false,
      error: null,
    };
  },
  mounted() {
    this.applyPendingLoginTarget();
  },
  methods: {
    getPendingLoginTarget() {
      try {
        const raw = window.sessionStorage.getItem('xenmange.pendingLoginTarget');
        return raw ? JSON.parse(raw) : null;
      } catch (error) {
        return null;
      }
    },
    clearPendingLoginTarget() {
      window.sessionStorage.removeItem('xenmange.pendingLoginTarget');
    },
    applyPendingLoginTarget() {
      const pendingTarget = this.getPendingLoginTarget();
      if (!pendingTarget || !pendingTarget.host) return;

      this.authMode = 'xen';
      this.connectionName = pendingTarget.connectionName || pendingTarget.name || '';
      this.host = pendingTarget.host || '';
      this.username = pendingTarget.username || this.username;
    },
    async handleAppLogin() {
      this.loading = true;
      this.error = null;

      try {
        const result = await api.login(this.appUsername, this.appPassword);
        applySessionStatus(result);
        this.$router.push('/pools');
      } catch (error) {
        this.error = error.message || 'Unable to sign in';
      } finally {
        this.loading = false;
      }
    },
    async handleXenLogin() {
      this.loading = true;
      this.error = null;

      try {
        const pendingTarget = this.getPendingLoginTarget();
        const result = await api.xenLogin(this.host, this.username, this.password, {
          connectionId: pendingTarget?.connectionId || this.$route.query.connectionId || null,
          connectionName: pendingTarget?.connectionName || this.connectionName || '',
          port: pendingTarget?.port || 443,
        });
        applySessionStatus(result);
        this.clearPendingLoginTarget();
        this.$router.push(pendingTarget?.returnTo || this.$route.query.returnTo || '/');
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
      applySessionStatus({
        authenticated: true,
        connected: true,
        demoMode: true,
        host: 'Demo Fabric',
        username: 'demo',
        authMode: 'demo',
        currentTargetKey: 'demo-fabric',
        connectedTargets: [
          {
            targetKey: 'demo-fabric',
            connectionId: 1,
            connectionName: 'Demo Fabric',
            host: 'demo.fabric.local',
            username: 'demo',
            active: true,
          },
          {
            targetKey: 'demo-edge',
            connectionId: 2,
            connectionName: 'Demo Edge Fabric',
            host: 'demo-edge.fabric.local',
            username: 'demo',
            active: false,
          },
        ],
        user: {
          id: 'demo',
          username: 'demo',
          displayName: 'Demo Operator',
          role: 'admin',
        },
        governance: {
          currentRole: 'admin',
          policy: {
            defaultRole: 'admin',
            requireDestructiveApproval: true,
            approvalTtlMinutes: 240,
          },
        },
      });
      this.clearPendingLoginTarget();
      this.$router.push('/');
    },
  },
};
