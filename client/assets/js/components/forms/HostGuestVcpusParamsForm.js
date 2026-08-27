function formatHostGuestVcpusParamLines(record = {}) {
  return Object.entries(record || {})
    .filter(([key]) => String(key || '').trim())
    .map(([key, value]) => `${String(key).trim()}=${String(value || '').trim()}`)
    .join('\n');
}

function parseHostGuestVcpusParamLines(lines = '') {
  const map = {};
  const entries = String(lines || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  for (const entry of entries) {
    const index = entry.indexOf('=');
    if (index <= 0) {
      return {
        error: `Each guest VCPU parameter line must use key=value format. Problem: ${entry}`,
        map: {},
      };
    }

    const key = entry.slice(0, index).trim();
    const value = entry.slice(index + 1).trim();
    if (!key) {
      return {
        error: `Each guest VCPU parameter line must include a key before "=". Problem: ${entry}`,
        map: {},
      };
    }

    map[key] = value;
  }

  return { error: '', map };
}

function buildHostGuestVcpusParamsDraft(value = {}) {
  return {
    guestVcpusParamsLines: formatHostGuestVcpusParamLines(value.guest_VCPUs_params || value.guestVcpusParams || {}),
  };
}

const HostGuestVcpusParamsForm = {
  props: ['initialValue', 'submitLabel', 'saving'],
  emits: ['submit'],
  template: `
    <form @submit.prevent="handleSubmit">
      <div class="form-group">
        <label for="host-guest-vcpus-params">Guest VCPU Parameters</label>
        <textarea id="host-guest-vcpus-params"
                  class="form-input form-textarea"
                  rows="5"
                  v-model="draft.guestVcpusParamsLines"
                  placeholder="weight=256&#10;cap=0"></textarea>
      </div>

      <div class="text-muted mono" style="font-size:11px;margin-bottom:12px">
        Use one <code>key=value</code> pair per line for the host-wide guest VCPU policy defaults Xen applies to resident workloads.
      </div>

      <div class="form-error" v-if="validationError" style="text-align:left;margin-bottom:12px">{{ validationError }}</div>

      <button class="form-btn" type="submit" :disabled="saving">
        <span class="mdi mdi-content-save-outline"></span>
        {{ saving ? 'Saving...' : (submitLabel || 'Save Guest VCPU Policy') }}
      </button>
    </form>
  `,
  data() {
    return {
      draft: buildHostGuestVcpusParamsDraft(this.initialValue),
      validationError: '',
    };
  },
  watch: {
    initialValue: {
      deep: true,
      handler(value) {
        this.draft = buildHostGuestVcpusParamsDraft(value);
        this.validationError = '';
      },
    },
  },
  methods: {
    handleSubmit() {
      const guestVcpusParams = parseHostGuestVcpusParamLines(this.draft.guestVcpusParamsLines);
      if (guestVcpusParams.error) {
        this.validationError = guestVcpusParams.error;
        return;
      }

      this.validationError = '';
      this.$emit('submit', { guestVcpusParams: guestVcpusParams.map });
    },
  },
};
