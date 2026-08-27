function formatHostLoggingLines(record = {}) {
  return Object.entries(record || {})
    .filter(([key]) => String(key || '').trim())
    .map(([key, value]) => `${String(key).trim()}=${String(value || '').trim()}`)
    .join('\n');
}

function parseHostLoggingLines(lines = '') {
  const map = {};
  const entries = String(lines || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  for (const entry of entries) {
    const index = entry.indexOf('=');
    if (index <= 0) {
      return {
        error: `Each host logging line must use key=value format. Problem: ${entry}`,
        map: {},
      };
    }

    const key = entry.slice(0, index).trim();
    const value = entry.slice(index + 1).trim();
    if (!key) {
      return {
        error: `Each host logging line must include a key before "=". Problem: ${entry}`,
        map: {},
      };
    }

    map[key] = value;
  }

  return { error: '', map };
}

function buildHostLoggingDraft(value = {}) {
  return {
    loggingLines: formatHostLoggingLines(value.logging || {}),
  };
}

const HostLoggingForm = {
  props: ['initialValue', 'submitLabel', 'saving'],
  emits: ['submit'],
  template: `
    <form @submit.prevent="handleSubmit">
      <div class="form-group">
        <label for="host-logging-config-map">Host Logging</label>
        <textarea id="host-logging-config-map"
                  class="form-input form-textarea"
                  rows="5"
                  v-model="draft.loggingLines"
                  placeholder="syslog_destination=10.0.0.50&#10;syslog_level=warning"></textarea>
      </div>

      <div class="text-muted mono" style="font-size:11px;margin-bottom:12px">
        Use one <code>key=value</code> pair per line for host logging outputs and verbosity controls. Leave the editor empty to clear host-level logging overrides.
      </div>

      <div class="form-error" v-if="validationError" style="text-align:left;margin-bottom:12px">{{ validationError }}</div>

      <button class="form-btn" type="submit" :disabled="saving">
        <span class="mdi mdi-content-save-outline"></span>
        {{ saving ? 'Saving...' : (submitLabel || 'Save Host Logging') }}
      </button>
    </form>
  `,
  data() {
    return {
      draft: buildHostLoggingDraft(this.initialValue),
      validationError: '',
    };
  },
  watch: {
    initialValue: {
      deep: true,
      handler(value) {
        this.draft = buildHostLoggingDraft(value);
        this.validationError = '';
      },
    },
  },
  methods: {
    handleSubmit() {
      const logging = parseHostLoggingLines(this.draft.loggingLines);
      if (logging.error) {
        this.validationError = logging.error;
        return;
      }

      this.validationError = '';
      this.$emit('submit', { logging: logging.map });
    },
  },
};
