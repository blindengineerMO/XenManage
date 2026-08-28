function formatNetworkVifQosLines(record = {}) {
  return Object.entries(record || {})
    .filter(([key]) => String(key || '').trim())
    .map(([key, value]) => `${String(key).trim()}=${String(value || '').trim()}`)
    .join('\n');
}

function parseNetworkVifQosLines(lines = '') {
  const map = {};
  const entries = String(lines || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  for (const entry of entries) {
    const index = entry.indexOf('=');
    if (index <= 0) {
      return {
        error: `Each VIF QoS parameter line must use key=value format. Problem: ${entry}`,
        map: {},
      };
    }

    const key = entry.slice(0, index).trim();
    const value = entry.slice(index + 1).trim();
    if (!key) {
      return {
        error: `Each VIF QoS parameter line must include a key before "=". Problem: ${entry}`,
        map: {},
      };
    }

    map[key] = value;
  }

  return { error: '', map };
}

function buildNetworkVifQosDraft(value = {}) {
  return {
    qosAlgorithmType: value.qos_algorithm_type || value.qosAlgorithmType || '',
    qosAlgorithmParamsLines: formatNetworkVifQosLines(value.qos_algorithm_params || value.qosAlgorithmParams || {}),
  };
}

const NetworkVifQosForm = {
  props: ['initialValue', 'submitLabel', 'saving'],
  emits: ['submit'],
  template: `
    <form @submit.prevent="handleSubmit">
      <div class="form-group">
        <label for="network-vif-qos-type">QoS Algorithm</label>
        <input id="network-vif-qos-type"
               class="form-input"
               v-model="draft.qosAlgorithmType"
               :list="supportedAlgorithms.length ? 'network-vif-qos-type-list' : null"
               placeholder="ratelimit">
        <datalist id="network-vif-qos-type-list" v-if="supportedAlgorithms.length">
          <option v-for="algorithm in supportedAlgorithms" :key="algorithm" :value="algorithm"></option>
        </datalist>
      </div>

      <div class="form-group">
        <label for="network-vif-qos-params">QoS Parameters</label>
        <textarea id="network-vif-qos-params"
                  class="form-input form-textarea"
                  rows="3"
                  v-model="draft.qosAlgorithmParamsLines"
                  placeholder="kbps=50000&#10;timeslice_us=50000"></textarea>
      </div>

      <div class="text-muted mono" style="font-size:11px;margin-bottom:12px">
        Use one <code>key=value</code> pair per line. Clear the algorithm type and parameters together to remove an existing QoS policy.
      </div>

      <div class="form-error" v-if="validationError" style="text-align:left;margin-bottom:12px">{{ validationError }}</div>

      <button class="form-btn" type="submit" :disabled="saving">
        <span class="mdi mdi-speedometer"></span>
        {{ saving ? 'Saving...' : (submitLabel || 'Save Interface QoS') }}
      </button>
    </form>
  `,
  data() {
    return {
      draft: buildNetworkVifQosDraft(this.initialValue),
      validationError: '',
    };
  },
  computed: {
    supportedAlgorithms() {
      return Array.isArray(this.initialValue?.qos_supported_algorithms)
        ? this.initialValue.qos_supported_algorithms.filter(Boolean)
        : [];
    },
  },
  watch: {
    initialValue: {
      deep: true,
      handler(value) {
        this.draft = buildNetworkVifQosDraft(value);
        this.validationError = '';
      },
    },
  },
  methods: {
    handleSubmit() {
      const qosAlgorithmParams = parseNetworkVifQosLines(this.draft.qosAlgorithmParamsLines);
      if (qosAlgorithmParams.error) {
        this.validationError = qosAlgorithmParams.error;
        return;
      }

      const normalizedQosAlgorithmType = String(this.draft.qosAlgorithmType || '').trim();
      if (!normalizedQosAlgorithmType && Object.keys(qosAlgorithmParams.map).length) {
        this.validationError = 'Choose a QoS algorithm before saving QoS parameters.';
        return;
      }

      this.validationError = '';
      this.$emit('submit', {
        qosAlgorithmType: normalizedQosAlgorithmType,
        qosAlgorithmParams: qosAlgorithmParams.map,
      });
    },
  },
};
