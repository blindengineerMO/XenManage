const LoginView = {
  template: `
    <div class="login-screen">
      <div class="scanline-overlay"></div>
      <div class="login-stack">
      <div class="login-box animate-scale-in">
        <div class="login-logo">
          <img src="/assets/images/logo.svg" alt="XenMange">
          <h1>XenMange</h1>
          <p>XenServer Management Interface</p>
        </div>

        <form @submit.prevent="handleAppLogin">
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
          <div class="login-meta-note">Bootstrap control-plane credentials default to <span class="mono">admin / admin123!</span> unless overridden by environment configuration. Pool and host target registration now happens after sign-in from the Pools and Hosts workspaces.</div>
          <div class="form-error" v-if="error">{{ error }}</div>
        </form>
      </div>

      <div class="donate-card animate-scale-in">
        <div class="donate-card-header">
          <span class="mdi mdi-heart-outline"></span>
          <span>Donate to the Developer</span>
        </div>
        <p class="donate-card-text">
          XenMange is a homebrew, one-person project — built out of a wish to see the Xen ecosystem grow into something as robust and enterprise-capable as its bigger competitors. The time and cost of development is covered entirely by donations from users like <strong>you</strong>.
        </p>
        <div class="donate-card-body">
          <img class="donate-qr"
               src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=10&data=https%3A%2F%2Fcash.app%2F%24MatthewPuckett"
               width="84" height="84" loading="lazy"
               alt="Cash App QR code for $MatthewPuckett">
          <div class="donate-card-cta">
            <a class="donate-link" href="https://cash.app/$MatthewPuckett" target="_blank" rel="noopener noreferrer">
              <span class="mdi mdi-cash-multiple"></span>
              Click here to offer support
            </a>
            <span class="donate-card-note">Scan the code or follow the link to send any amount you choose.</span>
          </div>
        </div>
      </div>
      </div>
    </div>
  `,
  data() {
    return {
      appUsername: 'admin',
      appPassword: '',
      loading: false,
      error: null,
    };
  },
  methods: {
    async resolvePostLoginRoute() {
      try {
        const [connections, hostTargets] = await Promise.all([
          api.getConnections(),
          api.getHostTargets(),
        ]);

        if (!(connections.length || hostTargets.length)) {
          return {
            path: '/pools',
            query: { register: '1' },
          };
        }
      } catch (_error) {
        return '/pools';
      }

      return '/pools';
    },
    async handleAppLogin() {
      this.loading = true;
      this.error = null;

      try {
        const result = await api.login(this.appUsername, this.appPassword);
        applySessionStatus(result);
        const destination = await this.resolvePostLoginRoute();
        this.$router.push(destination);
      } catch (error) {
        this.error = error.message || 'Unable to sign in';
      } finally {
        this.loading = false;
      }
    },
    launchDemo() {
      this.error = null;
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
      this.$router.push('/');
    },
  },
};
