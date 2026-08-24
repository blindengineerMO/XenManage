function buildTemplateDeployDraft(template = {}, hostOptions = [], storageOptions = [], networkOptions = []) {
  const memoryBytes = Number(template.memory_static_max || 0);
  return {
    nameLabel: template.name_label ? `${template.name_label}-01` : '',
    nameDescription: template.name_description || '',
    hostRef: hostOptions[0]?.ref || '',
    storageRef: storageOptions[0]?.ref || '',
    networkRef: networkOptions[0]?.ref || '',
    vcpus: Number(template.VCPUs_at_startup || 1) || 1,
    memoryGiB: Math.max(1, Math.round(memoryBytes / (1024 ** 3)) || 1),
    tags: Array.isArray(template.tags) ? template.tags.join(', ') : '',
    startAfter: true,
  };
}

const TemplateDeployForm = {
  props: ['templateRecord', 'hostOptions', 'storageOptions', 'networkOptions', 'submitLabel', 'saving'],
  emits: ['submit'],
  template: `
    <form @submit.prevent="handleSubmit">
      <div class="form-group">
        <label for="template-deploy-name">VM Name</label>
        <input id="template-deploy-name" class="form-input" v-model="draft.nameLabel" placeholder="ubuntu-prod-01" required>
      </div>

      <div class="form-group">
        <label for="template-deploy-description">Description</label>
        <textarea id="template-deploy-description"
                  class="form-input form-textarea"
                  v-model="draft.nameDescription"
                  placeholder="Deployment note, service owner, or rollout intent."></textarea>
      </div>

      <div class="vm-inline-form-grid">
        <div class="form-group">
          <label for="template-deploy-host">Target Host</label>
          <select id="template-deploy-host" class="form-input" v-model="draft.hostRef" required>
            <option value="" disabled>Select host</option>
            <option v-for="host in hostOptions" :key="host.ref" :value="host.ref">
              {{ host.name_label || host.hostname || host.ref }} · {{ host.address || host.uuid || '-' }}
            </option>
          </select>
        </div>

        <div class="form-group">
          <label for="template-deploy-storage">Preferred Storage</label>
          <select id="template-deploy-storage" class="form-input" v-model="draft.storageRef" required>
            <option value="" disabled>Select storage</option>
            <option v-for="sr in storageOptions" :key="sr.ref" :value="sr.ref">
              {{ sr.name_label || sr.ref }} · {{ sr.type || 'storage' }}
            </option>
          </select>
        </div>
      </div>

      <div class="vm-inline-form-grid">
        <div class="form-group">
          <label for="template-deploy-network">Primary Network</label>
          <select id="template-deploy-network" class="form-input" v-model="draft.networkRef" required>
            <option value="" disabled>Select network</option>
            <option v-for="network in networkOptions" :key="network.ref" :value="network.ref">
              {{ network.name_label || network.bridge || network.ref }}
            </option>
          </select>
        </div>

        <div class="form-group">
          <label for="template-deploy-tags">Tags</label>
          <input id="template-deploy-tags" class="form-input" v-model="draft.tags" placeholder="prod, app, linux">
        </div>
      </div>

      <div class="vm-inline-form-grid">
        <div class="form-group">
          <label for="template-deploy-vcpus">vCPUs</label>
          <input id="template-deploy-vcpus" class="form-input" v-model.number="draft.vcpus" type="number" min="1" max="128" required>
        </div>

        <div class="form-group">
          <label for="template-deploy-memory">Memory (GiB)</label>
          <input id="template-deploy-memory" class="form-input" v-model.number="draft.memoryGiB" type="number" min="1" step="1" required>
        </div>
      </div>

      <label class="form-toggle">
        <input type="checkbox" v-model="draft.startAfter">
        <span>Start VM after deployment completes</span>
      </label>

      <button class="form-btn" type="submit" :disabled="saving">
        <span class="mdi mdi-rocket-launch-outline"></span>
        {{ saving ? 'Deploying...' : (submitLabel || 'Deploy VM') }}
      </button>
    </form>
  `,
  data() {
    return {
      draft: buildTemplateDeployDraft(this.templateRecord, this.hostOptions, this.storageOptions, this.networkOptions),
    };
  },
  watch: {
    templateRecord: {
      deep: true,
      handler(value) {
        this.draft = buildTemplateDeployDraft(value, this.hostOptions, this.storageOptions, this.networkOptions);
      },
    },
    hostOptions: {
      deep: true,
      handler(value) {
        if (!this.draft.hostRef && value.length) this.draft.hostRef = value[0].ref;
      },
    },
    storageOptions: {
      deep: true,
      handler(value) {
        if (!this.draft.storageRef && value.length) this.draft.storageRef = value[0].ref;
      },
    },
    networkOptions: {
      deep: true,
      handler(value) {
        if (!this.draft.networkRef && value.length) this.draft.networkRef = value[0].ref;
      },
    },
  },
  methods: {
    handleSubmit() {
      this.$emit('submit', {
        nameLabel: this.draft.nameLabel.trim(),
        nameDescription: this.draft.nameDescription.trim(),
        hostRef: this.draft.hostRef || null,
        storageRef: this.draft.storageRef || null,
        networkRef: this.draft.networkRef || null,
        vcpus: Number(this.draft.vcpus || 1),
        memoryStaticMax: Math.max(1, Number(this.draft.memoryGiB || 1)) * (1024 ** 3),
        tags: this.draft.tags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
        startAfter: Boolean(this.draft.startAfter),
      });
    },
  },
};
