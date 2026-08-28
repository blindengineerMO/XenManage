const HostTargetConnectDialog = {
  components: {
    FloatingWindow,
  },
  props: {
    show: {
      type: Boolean,
      default: false,
    },
    connectTarget: {
      type: Object,
      default: null,
    },
    password: {
      type: String,
      default: '',
    },
    connectLoading: {
      type: Boolean,
      default: false,
    },
    connectError: {
      type: String,
      default: '',
    },
    useSavedCredential: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['close', 'submit', 'update:password', 'update:use-saved-credential'],
  template: `
    <floating-window :show="show"
                     title="Connect to Host Target"
                     :width="460"
                     :height="360"
                     @close="$emit('close')">
      <form v-if="connectTarget" @submit.prevent="$emit('submit')">
        <div class="property-grid" style="margin-bottom:18px">
          <span class="text-muted">Host Target</span><span>{{ connectTarget.name || '-' }}</span>
          <span class="text-muted">Host</span><span class="mono property-wrap">{{ connectTarget.host || '-' }}</span>
          <span class="text-muted">Username</span><span class="mono">{{ connectTarget.username || '-' }}</span>
        </div>

        <div class="form-group">
          <label for="host-connect-password">{{ useSavedCredential ? 'Vault Credential' : 'Host Password' }}</label>
          <label class="form-toggle" v-if="connectTarget.vault_credential_id" style="margin-bottom:12px">
            <input type="checkbox"
                   :checked="useSavedCredential"
                   @change="$emit('update:use-saved-credential', $event.target.checked)">
            <span>Use linked vault credential for this host target</span>
          </label>
          <div v-if="useSavedCredential" class="empty-state" style="padding:12px 14px">
            XenMange will resolve the linked vault credential server-side. No password will be sent back to the browser.
          </div>
          <input v-else
                 id="host-connect-password"
                 class="form-input"
                 :value="password"
                 @input="$emit('update:password', $event.target.value)"
                 type="password"
                 autocomplete="current-password"
                 placeholder="Password"
                 required>
        </div>

        <div class="form-actions">
          <button class="form-btn" type="submit" :disabled="connectLoading">
            <span v-if="connectLoading" class="loading-spinner" style="margin-right:8px"></span>
            {{ connectLoading ? 'Connecting...' : 'Connect to Host' }}
          </button>
          <button class="form-btn form-btn-secondary" type="button" :disabled="connectLoading" @click="$emit('close')">
            Cancel
          </button>
        </div>
        <div class="login-meta-note">This attaches the selected standalone host target to the current XenMange session without leaving the Hosts workspace.</div>
        <div class="form-error" v-if="connectError">{{ connectError }}</div>
      </form>
    </floating-window>
  `,
};
