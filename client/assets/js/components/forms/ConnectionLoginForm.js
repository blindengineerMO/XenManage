const ConnectionLoginForm = {
  props: [
    'connectionName',
    'host',
    'username',
    'password',
    'loading',
    'error',
  ],
  emits: [
    'submit',
    'launch-demo',
    'update:connectionName',
    'update:host',
    'update:username',
    'update:password',
  ],
  template: `
    <form @submit.prevent="$emit('submit')">
      <div class="vm-inline-form-grid">
        <div class="form-group">
          <label for="connection-name">Profile Name</label>
          <input id="connection-name"
                 class="form-input"
                 :value="connectionName"
                 @input="$emit('update:connectionName', $event.target.value)"
                 placeholder="Production Pool"
                 autocomplete="organization">
        </div>
        <div class="form-group">
          <label for="connection-host">Host Address</label>
          <input id="connection-host"
                 class="form-input"
                 :value="host"
                 @input="$emit('update:host', $event.target.value)"
                 placeholder="xenserver.local"
                 autocomplete="url"
                 required>
        </div>
      </div>
      <div class="vm-inline-form-grid">
        <div class="form-group">
          <label for="connection-username">Username</label>
          <input id="connection-username"
                 class="form-input"
                 :value="username"
                 @input="$emit('update:username', $event.target.value)"
                 placeholder="root"
                 autocomplete="username"
                 required>
        </div>
        <div class="form-group">
          <label for="connection-password">Password</label>
          <input id="connection-password"
                 class="form-input"
                 type="password"
                 :value="password"
                 @input="$emit('update:password', $event.target.value)"
                 placeholder="Password"
                 autocomplete="current-password"
                 required>
        </div>
      </div>

      <div class="form-actions">
        <button class="form-btn" type="submit" :disabled="loading">
          <span v-if="loading" class="loading-spinner" style="margin-right:8px"></span>
          {{ loading ? 'Connecting...' : 'Initialize Connection' }}
        </button>
        <button class="form-btn form-btn-secondary" type="button" :disabled="loading" @click="$emit('launch-demo')">
          <span class="mdi mdi-flask-outline"></span>
          Open Demo Dashboard
        </button>
      </div>
      <div class="login-meta-note">Pool target registration now lives in the Pools workspace. Demo mode still loads mock pools, hosts, VMs, storage, networking, templates, and alerts for UI testing.</div>
      <div class="form-error" v-if="error">{{ error }}</div>
    </form>
  `,
};
