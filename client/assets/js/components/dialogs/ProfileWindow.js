const ProfileWindow = {
  components: { FloatingWindow },
  props: {
    show: { type: Boolean, default: false },
  },
  emits: ['close'],
  template: `
    <floating-window :show="show" title="My Profile" :width="640" :height="560" @close="$emit('close')">
      <div class="target-type-switcher" role="tablist" aria-label="Profile sections" style="flex-wrap:wrap">
        <button type="button" class="target-type-button" :class="{ active: activeTab === 'profile' }" @click="activeTab = 'profile'">
          <span class="mdi mdi-account-outline"></span>
          Profile
        </button>
        <button type="button" class="target-type-button" :class="{ active: activeTab === 'password' }" @click="activeTab = 'password'">
          <span class="mdi mdi-form-textbox-password"></span>
          Password
        </button>
        <button type="button" class="target-type-button" :class="{ active: activeTab === 'appearance' }" @click="activeTab = 'appearance'">
          <span class="mdi mdi-theme-light-dark"></span>
          Appearance
        </button>
        <button type="button" class="target-type-button" :class="{ active: activeTab === 'notifications' }" @click="activeTab = 'notifications'">
          <span class="mdi mdi-bell-outline"></span>
          Notifications
        </button>
        <button type="button" class="target-type-button" :class="{ active: activeTab === 'mfa' }" @click="activeTab = 'mfa'">
          <span class="mdi mdi-shield-key-outline"></span>
          MFA
        </button>
      </div>

      <div v-if="activeTab === 'profile'" class="detail-section" style="margin-top:16px">
        <div class="detail-section-title">Profile</div>
        <div style="display:flex;gap:16px;align-items:center;margin-bottom:16px">
          <img v-if="avatarUrl" :src="avatarUrl" class="profile-avatar-preview" alt="Avatar">
          <div v-else class="profile-avatar-placeholder">
            <span class="mdi mdi-account"></span>
          </div>
          <div style="display:flex;flex-direction:column;gap:8px">
            <div style="display:flex;gap:8px">
              <button type="button" class="btn btn-sm" @click="triggerAvatarPicker" :disabled="avatarBusy">Upload Avatar</button>
              <button type="button" class="btn btn-sm btn-danger" v-if="avatarUrl" @click="removeAvatar" :disabled="avatarBusy">Remove</button>
            </div>
            <span class="text-muted" style="font-size:11px">PNG, JPEG or WebP. Max 2MB.</span>
            <input ref="avatarInput" type="file" accept="image/png,image/jpeg,image/webp" style="display:none" @change="onAvatarSelected">
          </div>
        </div>

        <form @submit.prevent="saveProfile">
          <div class="form-group">
            <label>Username</label>
            <input class="form-input" :value="profile.username" disabled>
          </div>
          <div class="form-group">
            <label>Display Name</label>
            <input class="form-input" v-model="profileForm.displayName" maxlength="120">
          </div>
          <div class="form-group">
            <label>Email</label>
            <input class="form-input" type="email" v-model="profileForm.email" maxlength="160">
          </div>
          <div class="form-actions">
            <button class="form-btn" type="submit" :disabled="profileBusy">{{ profileBusy ? 'Saving...' : 'Save Profile' }}</button>
          </div>
          <div class="form-error" v-if="profileError">{{ profileError }}</div>
          <div class="text-muted" v-if="profileSaved" style="font-size:12px">Profile updated.</div>
        </form>
      </div>

      <div v-else-if="activeTab === 'password'" class="detail-section" style="margin-top:16px">
        <div class="detail-section-title">Change Password</div>
        <form @submit.prevent="changePassword">
          <div class="form-group">
            <label>Current Password</label>
            <input class="form-input" type="password" v-model="passwordForm.currentPassword" autocomplete="current-password" required>
          </div>
          <div class="form-group">
            <label>New Password</label>
            <input class="form-input" type="password" v-model="passwordForm.newPassword" autocomplete="new-password" minlength="8" required>
          </div>
          <div class="form-actions">
            <button class="form-btn" type="submit" :disabled="passwordBusy">{{ passwordBusy ? 'Updating...' : 'Update Password' }}</button>
          </div>
          <div class="form-error" v-if="passwordError">{{ passwordError }}</div>
          <div class="text-muted" v-if="passwordSaved" style="font-size:12px">{{ passwordSaved }}</div>
        </form>
      </div>

      <div v-else-if="activeTab === 'appearance'" class="detail-section" style="margin-top:16px">
        <div class="detail-section-title">Appearance</div>
        <div class="target-type-switcher">
          <button type="button" class="target-type-button" :class="{ active: profile.theme === 'dark' }" @click="setTheme('dark')">
            <span class="mdi mdi-weather-night"></span>
            Dark
          </button>
          <button type="button" class="target-type-button" :class="{ active: profile.theme === 'light' }" @click="setTheme('light')">
            <span class="mdi mdi-weather-sunny"></span>
            Light
          </button>
        </div>
        <div class="form-error" v-if="themeError">{{ themeError }}</div>
      </div>

      <div v-else-if="activeTab === 'notifications'" class="detail-section" style="margin-top:16px">
        <div class="detail-section-title">Web Push Notifications</div>
        <p class="text-muted" style="line-height:1.6">Enable browser push notifications for alerts, governance approvals, and catalog events.</p>
        <div v-if="!pushConfigured" class="form-error">Web push is not configured on this server (missing VAPID keys).</div>
        <template v-else>
          <div class="form-actions" style="justify-content:flex-start;gap:8px">
            <button v-if="!pushSubscribed" type="button" class="btn btn-sm btn-primary" @click="enablePush" :disabled="pushBusy">Enable Push</button>
            <button v-else type="button" class="btn btn-sm btn-danger" @click="disablePush" :disabled="pushBusy">Disable Push</button>
            <button v-if="pushSubscribed" type="button" class="btn btn-sm" @click="sendTestPush" :disabled="pushBusy">Send Test Notification</button>
          </div>
          <div class="form-error" v-if="pushError">{{ pushError }}</div>
          <div class="text-muted" v-if="pushMessage" style="font-size:12px">{{ pushMessage }}</div>
        </template>
      </div>

      <div v-else-if="activeTab === 'mfa'" class="detail-section" style="margin-top:16px">
        <div class="detail-section-title">Multi-Factor Authentication</div>
        <div v-if="profile.mfa_enabled">
          <p class="text-muted">MFA is currently <strong style="color:var(--neon-green)">enabled</strong> for your account.</p>
          <form @submit.prevent="disableMfa">
            <div class="form-group">
              <label>Current Password</label>
              <input class="form-input" type="password" v-model="mfaDisablePassword" autocomplete="current-password" required>
            </div>
            <div class="form-actions">
              <button class="form-btn form-btn-secondary" type="submit" :disabled="mfaBusy">Disable MFA</button>
            </div>
            <div class="form-error" v-if="mfaError">{{ mfaError }}</div>
          </form>
        </div>
        <div v-else>
          <p class="text-muted" v-if="!mfaEnrollment">Add an authenticator app (Google Authenticator, Authy, 1Password, etc.) for a second sign-in factor.</p>
          <button v-if="!mfaEnrollment" type="button" class="btn btn-sm btn-primary" @click="beginMfaEnrollment" :disabled="mfaBusy">Start Enrollment</button>

          <div v-else>
            <p class="text-muted">Scan or manually enter this secret in your authenticator app, then confirm with a generated code.</p>
            <div class="form-group">
              <label>Secret</label>
              <input class="form-input mono" :value="mfaEnrollment.secret" readonly @focus="$event.target.select()">
            </div>
            <div class="form-group">
              <label>otpauth:// URI</label>
              <input class="form-input mono" :value="mfaEnrollment.otpAuthUri" readonly @focus="$event.target.select()" style="font-size:11px">
            </div>
            <form @submit.prevent="confirmMfaEnrollment">
              <div class="form-group">
                <label>Confirmation Code</label>
                <input class="form-input" v-model="mfaToken" inputmode="numeric" maxlength="6" placeholder="123456" required>
              </div>
              <div class="form-actions">
                <button class="form-btn" type="submit" :disabled="mfaBusy">{{ mfaBusy ? 'Verifying...' : 'Confirm & Enable' }}</button>
              </div>
            </form>
          </div>
          <div class="form-error" v-if="mfaError">{{ mfaError }}</div>
        </div>
      </div>
    </floating-window>
  `,
  data() {
    return {
      activeTab: 'profile',
      profile: { username: '', display_name: '', email: '', theme: 'dark', avatar_path: '', mfa_enabled: false },
      profileForm: { displayName: '', email: '' },
      profileBusy: false,
      profileError: '',
      profileSaved: false,
      passwordForm: { currentPassword: '', newPassword: '' },
      passwordBusy: false,
      passwordError: '',
      passwordSaved: '',
      avatarBusy: false,
      themeError: '',
      pushConfigured: false,
      pushSubscribed: false,
      pushBusy: false,
      pushError: '',
      pushMessage: '',
      mfaEnrollment: null,
      mfaToken: '',
      mfaBusy: false,
      mfaError: '',
      mfaDisablePassword: '',
    };
  },
  computed: {
    avatarUrl() {
      if (String(this.profile.avatar_path || '').startsWith('data:image/')) return this.profile.avatar_path;
      return this.profile.avatar_path ? `/api/profile/avatar/${this.profile.id}?v=${encodeURIComponent(this.profile.avatar_path)}` : '';
    },
  },
  watch: {
    show(value) {
      if (value) this.loadProfile();
    },
  },
  methods: {
    async loadProfile() {
      try {
        const result = await api.getProfile();
        this.profile = result.data;
        this.profileForm = { displayName: this.profile.display_name || '', email: this.profile.email || '' };
        this.profileError = '';
      } catch (error) {
        this.profileError = error.message || 'Unable to load profile';
      }

      try {
        const vapid = await api.getPushVapidPublicKey();
        this.pushConfigured = Boolean(vapid.configured);
      } catch (_) {
        this.pushConfigured = false;
      }

      if (this.pushConfigured && 'serviceWorker' in navigator) {
        try {
          const registration = await navigator.serviceWorker.ready;
          const subscription = await registration.pushManager.getSubscription();
          this.pushSubscribed = Boolean(subscription);
        } catch (_) {
          this.pushSubscribed = false;
        }
      }
    },
    async saveProfile() {
      this.profileBusy = true;
      this.profileError = '';
      this.profileSaved = false;
      try {
        const result = await api.updateProfile(this.profileForm);
        this.profile = result.data;
        if (store.user) {
          store.user.displayName = this.profile.display_name || this.profile.username;
        }
        this.profileSaved = true;
      } catch (error) {
        this.profileError = error.message || 'Unable to update profile';
      } finally {
        this.profileBusy = false;
      }
    },
    async changePassword() {
      this.passwordBusy = true;
      this.passwordError = '';
      this.passwordSaved = '';
      try {
        const result = await api.changeProfilePassword(this.passwordForm);
        this.passwordForm = { currentPassword: '', newPassword: '' };
        this.passwordSaved = result.revokedSessions
          ? `Password updated. ${result.revokedSessions} other session(s) were signed out.`
          : 'Password updated.';
      } catch (error) {
        this.passwordError = error.message || 'Unable to change password';
      } finally {
        this.passwordBusy = false;
      }
    },
    async setTheme(theme) {
      if (this.profile.theme === theme) return;
      this.themeError = '';
      try {
        const result = await api.setProfileTheme(theme);
        this.profile = result.data;
        applyTheme(theme);
        if (store.user) store.user.theme = theme;
      } catch (error) {
        this.themeError = error.message || 'Unable to update theme';
      }
    },
    triggerAvatarPicker() {
      this.$refs.avatarInput?.click();
    },
    async onAvatarSelected(event) {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file) return;

      this.avatarBusy = true;
      this.profileError = '';
      try {
        const result = await api.uploadProfileAvatar(file);
        this.profile = result.data;
      } catch (error) {
        this.profileError = error.message || 'Unable to upload avatar';
      } finally {
        this.avatarBusy = false;
      }
    },
    async removeAvatar() {
      this.avatarBusy = true;
      try {
        const result = await api.removeProfileAvatar();
        this.profile = result.data;
      } catch (error) {
        this.profileError = error.message || 'Unable to remove avatar';
      } finally {
        this.avatarBusy = false;
      }
    },
    async enablePush() {
      this.pushBusy = true;
      this.pushError = '';
      this.pushMessage = '';
      try {
        const vapid = await api.getPushVapidPublicKey();
        const registration = await navigator.serviceWorker.register('/assets/service-worker.js');
        await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapid.publicKey),
        });
        const json = subscription.toJSON();
        await api.subscribePush({ endpoint: json.endpoint, keys: json.keys });
        this.pushSubscribed = true;
        this.pushMessage = 'Push notifications enabled.';
      } catch (error) {
        this.pushError = error.message || 'Unable to enable push notifications';
      } finally {
        this.pushBusy = false;
      }
    },
    async disablePush() {
      this.pushBusy = true;
      this.pushError = '';
      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          await api.unsubscribePush(subscription.endpoint);
          await subscription.unsubscribe();
        }
        this.pushSubscribed = false;
        this.pushMessage = 'Push notifications disabled.';
      } catch (error) {
        this.pushError = error.message || 'Unable to disable push notifications';
      } finally {
        this.pushBusy = false;
      }
    },
    async sendTestPush() {
      this.pushBusy = true;
      this.pushError = '';
      this.pushMessage = '';
      try {
        const result = await api.sendTestPushNotification();
        this.pushMessage = result.sent ? 'Test notification sent.' : 'No active subscription received it.';
      } catch (error) {
        this.pushError = error.message || 'Unable to send test notification';
      } finally {
        this.pushBusy = false;
      }
    },
    async beginMfaEnrollment() {
      this.mfaBusy = true;
      this.mfaError = '';
      try {
        const result = await api.mfaBeginEnrollment();
        this.mfaEnrollment = result.data;
      } catch (error) {
        this.mfaError = error.message || 'Unable to start MFA enrollment';
      } finally {
        this.mfaBusy = false;
      }
    },
    async confirmMfaEnrollment() {
      this.mfaBusy = true;
      this.mfaError = '';
      try {
        const result = await api.mfaConfirmEnrollment(this.mfaToken);
        this.profile = result.data;
        this.mfaEnrollment = null;
        this.mfaToken = '';
        if (store.user) store.user.mfaEnabled = true;
      } catch (error) {
        this.mfaError = error.message || 'Invalid confirmation code';
      } finally {
        this.mfaBusy = false;
      }
    },
    async disableMfa() {
      this.mfaBusy = true;
      this.mfaError = '';
      try {
        const result = await api.mfaDisable(this.mfaDisablePassword);
        this.profile = result.data;
        this.mfaDisablePassword = '';
        if (store.user) store.user.mfaEnabled = false;
      } catch (error) {
        this.mfaError = error.message || 'Unable to disable MFA';
      } finally {
        this.mfaBusy = false;
      }
    },
  },
};

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
