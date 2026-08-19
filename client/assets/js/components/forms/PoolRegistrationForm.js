const PoolRegistrationForm = {
  props: ['initialValue', 'submitLabel'],
  emits: ['submit'],
  template: `
    <form @submit.prevent="handleSubmit">
      <div class="form-group">
        <label for="pool-name">Profile Name</label>
        <input id="pool-name" class="form-input" v-model="draft.name" placeholder="Production Pool" required>
      </div>
      <div class="form-group">
        <label for="pool-host">Pool Address</label>
        <input id="pool-host" class="form-input" v-model="draft.host" placeholder="pool.example.local" required>
      </div>
      <div class="form-group">
        <label for="pool-username">Username</label>
        <input id="pool-username" class="form-input" v-model="draft.username" placeholder="root" required>
      </div>
      <div class="form-group">
        <label for="pool-port">Port</label>
        <input id="pool-port" class="form-input" v-model.number="draft.port" type="number" min="1" max="65535" required>
      </div>
      <label class="form-toggle">
        <input type="checkbox" v-model="draft.isDefault">
        <span>Set as default saved pool target</span>
      </label>
      <div class="form-actions">
        <button class="form-btn" type="submit">{{ submitLabel || 'Save Pool Target' }}</button>
      </div>
    </form>
  `,
  data() {
    return {
      draft: this.buildDraft(this.initialValue),
    };
  },
  watch: {
    initialValue: {
      deep: true,
      handler(value) {
        this.draft = this.buildDraft(value);
      },
    },
  },
  methods: {
    buildDraft(value) {
      return {
        name: value?.name || '',
        host: value?.host || '',
        username: value?.username || 'root',
        port: Number(value?.port || 443),
        isDefault: Boolean(value?.is_default || value?.isDefault),
      };
    },
    handleSubmit() {
      this.$emit('submit', {
        name: this.draft.name.trim(),
        host: this.draft.host.trim(),
        username: this.draft.username.trim(),
        port: Number(this.draft.port || 443),
        isDefault: Boolean(this.draft.isDefault),
      });
    },
  },
};
