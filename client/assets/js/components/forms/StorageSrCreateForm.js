function buildStorageSrCreateDraft() {
  return {
    hostRef: '',
    nameLabel: '',
    nameDescription: '',
    type: 'nfs',
    shared: true,
    server: '',
    serverpath: '',
    device: '',
    target: '',
    targetIQN: '',
    SCSIid: '',
    extraDeviceConfig: '',
    smConfigLines: '',
  };
}

function storageSrTypeMeta(type) {
  if (type === 'lvmoiscsi') {
    return {
      label: 'iSCSI',
      shared: true,
      fields: [
        { key: 'target', label: 'Target Portal', placeholder: '10.42.0.50' },
        { key: 'targetIQN', label: 'Target IQN', placeholder: 'iqn.2026-08.lab.storage:archive' },
        { key: 'SCSIid', label: 'SCSI ID', placeholder: '36001405f7c5c9b1a0d8450b3d5410012' },
      ],
      summary: 'Shared block-backed storage managed through LVM over iSCSI.',
    };
  }

  if (type === 'ext') {
    return {
      label: 'Local EXT',
      shared: false,
      fields: [
        { key: 'device', label: 'Device Path', placeholder: '/dev/sdb' },
      ],
      summary: 'Thin-provisioned local filesystem storage created directly on the selected device.',
    };
  }

  if (type === 'lvm') {
    return {
      label: 'Local LVM',
      shared: false,
      fields: [
        { key: 'device', label: 'Device Path', placeholder: '/dev/nvme1n1' },
      ],
      summary: 'Thick-provisioned local block storage created directly on the selected device.',
    };
  }

  return {
    label: 'NFS',
    shared: true,
    fields: [
      { key: 'server', label: 'NFS Server', placeholder: '10.42.0.25' },
      { key: 'serverpath', label: 'NFS Export Path', placeholder: '/exports/xen/primary' },
    ],
    summary: 'Shared file-backed storage mounted from an exported NFS path.',
  };
}

function parseConfigLines(lines = '') {
  const map = {};
  const entries = String(lines || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  for (const entry of entries) {
    const index = entry.indexOf('=');
    if (index <= 0) {
      return {
        error: `Each advanced config line must use key=value format. Problem: ${entry}`,
        map: {},
      };
    }

    const key = entry.slice(0, index).trim();
    const value = entry.slice(index + 1).trim();
    if (!key) {
      return {
        error: `Each advanced config line must include a key before "=". Problem: ${entry}`,
        map: {},
      };
    }

    map[key] = value;
  }

  return { error: '', map };
}

const StorageSrCreateForm = {
  props: ['hosts', 'saving', 'submitLabel'],
  emits: ['submit'],
  template: `
    <form @submit.prevent="handleSubmit">
      <div class="vm-inline-form-grid">
        <div class="form-group">
          <label for="storage-sr-host">Placement Host</label>
          <select id="storage-sr-host" class="form-input" v-model="draft.hostRef" :disabled="!hostOptions.length" required>
            <option value="" disabled>Select Host</option>
            <option v-for="host in hostOptions" :key="host.ref" :value="host.ref">
              {{ host.name_label || host.address || host.ref }} · {{ host.address || host.uuid || 'no address' }}
            </option>
          </select>
        </div>

        <div class="form-group">
          <label for="storage-sr-type">Repository Type</label>
          <select id="storage-sr-type" class="form-input" v-model="draft.type" required>
            <option value="nfs">NFS</option>
            <option value="lvmoiscsi">iSCSI</option>
            <option value="ext">Local EXT</option>
            <option value="lvm">Local LVM</option>
          </select>
        </div>
      </div>

      <div class="stack-item" style="margin-bottom:12px">
        <div>
          <strong>{{ selectedTypeMeta.label }}</strong>
          <div class="text-muted mono" style="font-size:11px">{{ selectedTypeMeta.summary }}</div>
        </div>
        <span class="badge badge-info">{{ selectedTypeMeta.shared ? 'shared' : 'local' }}</span>
      </div>

      <div class="vm-inline-form-grid">
        <div class="form-group">
          <label for="storage-sr-name">Repository Name</label>
          <input id="storage-sr-name" class="form-input" v-model="draft.nameLabel" placeholder="Archive SR" required>
        </div>

        <div class="form-group">
          <label for="storage-sr-description">Description</label>
          <input id="storage-sr-description" class="form-input" v-model="draft.nameDescription" placeholder="Cold archive storage for retained workloads">
        </div>
      </div>

      <div class="vm-inline-form-grid">
        <div class="form-group" v-for="field in selectedTypeMeta.fields" :key="field.key">
          <label :for="'storage-sr-field-' + field.key">{{ field.label }}</label>
          <input :id="'storage-sr-field-' + field.key"
                 class="form-input"
                 v-model="draft[field.key]"
                 :placeholder="field.placeholder"
                 required>
        </div>
      </div>

      <div class="form-group">
        <label for="storage-sr-extra-device-config">Extra Device Config</label>
        <textarea id="storage-sr-extra-device-config"
                  class="form-input form-textarea"
                  rows="3"
                  v-model="draft.extraDeviceConfig"
                  placeholder="preferred-image-formats=qcow2"></textarea>
      </div>

      <div class="form-group">
        <label for="storage-sr-sm-config">Storage Manager Config</label>
        <textarea id="storage-sr-sm-config"
                  class="form-input form-textarea"
                  rows="3"
                  v-model="draft.smConfigLines"
                  placeholder="allocation=thin"></textarea>
      </div>

      <div class="form-error" v-if="validationError" style="text-align:left;margin-bottom:12px">{{ validationError }}</div>

      <button class="form-btn" type="submit" :disabled="saving || !hostOptions.length">
        <span class="mdi mdi-harddisk-plus"></span>
        {{ saving ? 'Submitting...' : submitLabel }}
      </button>
    </form>
  `,
  data() {
    return {
      draft: buildStorageSrCreateDraft(),
      validationError: '',
    };
  },
  computed: {
    hostOptions() {
      return Array.isArray(this.hosts) ? this.hosts : [];
    },
    selectedTypeMeta() {
      return storageSrTypeMeta(this.draft.type);
    },
  },
  watch: {
    'draft.type'(value) {
      this.draft.shared = storageSrTypeMeta(value).shared;
      this.validationError = '';
    },
  },
  methods: {
    handleSubmit() {
      const extraDeviceConfig = parseConfigLines(this.draft.extraDeviceConfig);
      if (extraDeviceConfig.error) {
        this.validationError = extraDeviceConfig.error;
        return;
      }

      const smConfig = parseConfigLines(this.draft.smConfigLines);
      if (smConfig.error) {
        this.validationError = smConfig.error;
        return;
      }

      const deviceConfig = {
        ...extraDeviceConfig.map,
      };

      for (const field of this.selectedTypeMeta.fields) {
        const value = String(this.draft[field.key] || '').trim();
        if (!value) {
          this.validationError = `${field.label} is required before creating this storage repository.`;
          return;
        }
        deviceConfig[field.key] = value;
      }

      this.validationError = '';
      this.$emit('submit', {
        hostRef: this.draft.hostRef,
        nameLabel: this.draft.nameLabel.trim(),
        nameDescription: this.draft.nameDescription.trim(),
        type: this.draft.type,
        contentType: 'user',
        shared: this.draft.shared,
        deviceConfig,
        smConfig: smConfig.map,
      });
      this.draft = buildStorageSrCreateDraft();
    },
  },
};
