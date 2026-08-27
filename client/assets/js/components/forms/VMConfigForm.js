function normalizeVmAffinityRef(value = '') {
  const normalized = String(value || '').trim();
  return normalized === 'OpaqueRef:NULL' ? '' : normalized;
}

const VM_BLOCKABLE_OPERATION_OPTIONS = [
  { value: 'start', label: 'Start', detail: 'Prevent normal workload boot requests.' },
  { value: 'clean_shutdown', label: 'Clean Shutdown', detail: 'Block guest-aware shutdown actions.' },
  { value: 'hard_shutdown', label: 'Forced Shutdown', detail: 'Block immediate power-off requests.' },
  { value: 'clean_reboot', label: 'Clean Reboot', detail: 'Block guest-aware reboot actions.' },
  { value: 'hard_reboot', label: 'Forced Reboot', detail: 'Block immediate reset requests.' },
  { value: 'pause', label: 'Pause', detail: 'Prevent pausing the current domain.' },
  { value: 'unpause', label: 'Unpause', detail: 'Prevent resuming from a paused state.' },
  { value: 'suspend', label: 'Suspend', detail: 'Prevent suspend image creation for this VM.' },
  { value: 'resume', label: 'Resume', detail: 'Prevent resume operations after suspension.' },
  { value: 'pool_migrate', label: 'Migrate', detail: 'Block same-pool relocation and XenMotion handoffs.' },
];

const VM_DOMAIN_TYPE_OPTIONS = [
  { value: 'unspecified', label: 'Automatic / Unspecified', detail: 'Let the current VM profile decide the effective domain type.' },
  { value: 'hvm', label: 'HVM', detail: 'Fully virtualized guest with device-model-backed boot behavior.' },
  { value: 'pv', label: 'PV', detail: 'Paravirtualized guest profile for legacy PV workloads.' },
  { value: 'pvh', label: 'PVH', detail: 'Modern hardware-assisted PVH profile for supported guests.' },
  { value: 'pv_in_pvh', label: 'PV in PVH', detail: 'Run PV inside a PVH container when the workload supports it.' },
];

const VM_MANAGED_PLATFORM_KEYS = new Set(['secureboot', 'videoram', 'igd_passthrough']);

function formatVmStringMapLines(record = {}) {
  return Object.entries(record || {})
    .filter(([key]) => String(key || '').trim())
    .map(([key, value]) => `${String(key).trim()}=${String(value || '').trim()}`)
    .join('\n');
}

function parseVmStringMapLines(lines = '', fieldLabel = 'metadata') {
  const map = {};
  const entries = String(lines || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  for (const entry of entries) {
    const index = entry.indexOf('=');
    if (index <= 0) {
      return {
        error: `Each ${fieldLabel} line must use key=value format. Problem: ${entry}`,
        map: {},
      };
    }

    const key = entry.slice(0, index).trim();
    const value = entry.slice(index + 1).trim();
    if (!key) {
      return {
        error: `Each ${fieldLabel} line must include a key before "=". Problem: ${entry}`,
        map: {},
      };
    }

    map[key] = value;
  }

  return { error: '', map };
}

function normalizeVmSecureBootValue(value = '') {
  const normalized = String(value || '').trim().toLowerCase();
  return ['1', 'true', 'enabled', 'on', 'yes', 'required'].includes(normalized);
}

function normalizeVmBooleanFlag(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized) return fallback;
  return ['1', 'true', 'enabled', 'on', 'yes', 'required'].includes(normalized);
}

function normalizeVmPlatformInteger(value, fallback = 0) {
  const normalized = Number(value ?? fallback);
  if (!Number.isFinite(normalized)) return fallback;
  return Math.max(0, Math.round(normalized));
}

function withoutVmManagedPlatformKeys(record = {}) {
  return Object.fromEntries(
    Object.entries(record || {})
      .filter(([key]) => {
        const normalizedKey = String(key || '').trim().toLowerCase();
        return normalizedKey && !VM_MANAGED_PLATFORM_KEYS.has(normalizedKey);
      })
  );
}

function normalizeVmDomainType(value = {}, fallback = 'unspecified') {
  const explicit = String(value.domain_type || value.domainType || '').trim().toLowerCase();
  if (explicit) return explicit;

  if (String(value.HVM_boot_policy || '').trim()) return 'hvm';
  if (String(value.PV_bootloader || value.PV_kernel || '').trim()) return 'pv';
  return fallback;
}

function buildVmConfigDraft(value = {}) {
  const memoryBytes = Number(value.memory_static_max || value.memoryStaticMax || 0);
  const memoryStaticMinBytes = Number(value.memory_static_min || value.memoryStaticMin || value.memory_dynamic_min || memoryBytes || 0);
  const blockedOperations = value.blocked_operations || value.blockedOperations || {};
  const platform = value.platform || {};
  return {
    nameLabel: value.name_label || value.nameLabel || '',
    nameDescription: value.name_description || value.nameDescription || '',
    userVersion: Math.max(0, Number(value.user_version ?? value.userVersion ?? 0) || 0),
    startDelay: Math.max(0, Number(value.start_delay ?? value.startDelay ?? 0) || 0),
    shutdownDelay: Math.max(0, Number(value.shutdown_delay ?? value.shutdownDelay ?? 0) || 0),
    order: Math.max(0, Number(value.order ?? value.bootOrder ?? 0) || 0),
    vcpus: Number(value.VCPUs_at_startup || value.vcpus || 1) || 1,
    memoryGiB: Math.max(1, Math.round(memoryBytes / (1024 ** 3)) || 1),
    memoryStaticMinGiB: Math.max(1, Math.round(memoryStaticMinBytes / (1024 ** 3)) || 1),
    hardwarePlatformVersion: Math.max(0, Number(value.hardware_platform_version ?? value.hardwarePlatformVersion ?? 0) || 0),
    domainType: normalizeVmDomainType(value),
    secureBootEnabled: normalizeVmSecureBootValue(platform.secureboot),
    videoRamMiB: normalizeVmPlatformInteger(platform.videoram),
    igdPassthroughEnabled: normalizeVmBooleanFlag(platform.igd_passthrough, false),
    hasVendorDevice: normalizeVmBooleanFlag(value.has_vendor_device, true),
    affinity: normalizeVmAffinityRef(value.affinity || value.affinityRef || ''),
    applianceRef: normalizeVmAffinityRef(value.appliance || value.applianceRef || ''),
    snapshotScheduleRef: normalizeVmAffinityRef(value.snapshot_schedule || value.snapshotScheduleRef || ''),
    tags: Array.isArray(value.tags) ? value.tags.join(', ') : String(value.tags || ''),
    blockedOperations: Object.keys(blockedOperations || {}).filter(Boolean),
    blockedOperationCode: Object.values(blockedOperations || {}).find((entry) => String(entry || '').trim()) || 'OPERATION_NOT_ALLOWED',
    vcpusParamsLines: formatVmStringMapLines(value.VCPUs_params || value.vcpusParams || {}),
    otherConfigLines: formatVmStringMapLines(value.other_config || value.otherConfig || {}),
    xenstoreDataLines: formatVmStringMapLines(value.xenstore_data || value.xenstoreData || {}),
    nvramLines: formatVmStringMapLines(value.NVRAM || value.nvram || {}),
    platformLines: formatVmStringMapLines(withoutVmManagedPlatformKeys(platform)),
  };
}

const VMConfigForm = {
  props: ['initialValue', 'submitLabel', 'saving', 'hostOptions', 'applianceOptions', 'snapshotScheduleOptions'],
  emits: ['submit'],
  template: `
    <form @submit.prevent="handleSubmit">
      <div class="form-group">
        <label for="vm-config-name">VM Name</label>
        <input id="vm-config-name" class="form-input" v-model="draft.nameLabel" placeholder="app-01" required>
      </div>

      <div class="form-group">
        <label for="vm-config-description">Description</label>
        <textarea id="vm-config-description"
                  class="form-input form-textarea"
                  v-model="draft.nameDescription"
                  placeholder="Describe the workload intent, owner, or maintenance notes."></textarea>
      </div>

      <div class="vm-inline-form-grid">
        <div class="form-group">
          <label for="vm-config-user-version">Version Tag</label>
          <input id="vm-config-user-version" class="form-input" v-model.number="draft.userVersion" type="number" min="0" step="1" required>
        </div>

        <div class="form-group">
          <label for="vm-config-start-delay">Start Delay (s)</label>
          <input id="vm-config-start-delay" class="form-input" v-model.number="draft.startDelay" type="number" min="0" step="1" required>
        </div>

        <div class="form-group">
          <label for="vm-config-shutdown-delay">Shutdown Delay (s)</label>
          <input id="vm-config-shutdown-delay" class="form-input" v-model.number="draft.shutdownDelay" type="number" min="0" step="1" required>
        </div>

        <div class="form-group">
          <label for="vm-config-order">Boot Order</label>
          <input id="vm-config-order" class="form-input" v-model.number="draft.order" type="number" min="0" step="1" required>
        </div>

        <div class="form-group">
          <label for="vm-config-vcpus">vCPUs</label>
          <input id="vm-config-vcpus" class="form-input" v-model.number="draft.vcpus" type="number" min="1" max="128" required>
        </div>

        <div class="form-group">
          <label for="vm-config-memory">Memory (GiB)</label>
          <input id="vm-config-memory" class="form-input" v-model.number="draft.memoryGiB" type="number" min="1" step="1" required>
        </div>

        <div class="form-group">
          <label for="vm-config-memory-static-min">Static Min Memory (GiB)</label>
          <input id="vm-config-memory-static-min" class="form-input" v-model.number="draft.memoryStaticMinGiB" type="number" min="1" step="1" required>
        </div>

        <div class="form-group">
          <label for="vm-config-hardware-platform-version">Virtual Hardware Platform</label>
          <input id="vm-config-hardware-platform-version"
                 class="form-input"
                 v-model.number="draft.hardwarePlatformVersion"
                 type="number"
                 min="0"
                 step="1"
                 placeholder="0">
        </div>

        <div class="form-group">
          <label for="vm-config-domain-type">Domain Type</label>
          <select id="vm-config-domain-type" class="form-input" v-model="draft.domainType">
            <option v-for="option in domainTypeOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
          <div class="text-muted mono" style="font-size:11px;margin-top:6px">
            {{ selectedDomainTypeDetail }}
          </div>
        </div>

        <div class="form-group">
          <label class="stack-item" for="vm-config-secure-boot" style="align-items:flex-start;gap:12px">
            <input id="vm-config-secure-boot" type="checkbox" v-model="draft.secureBootEnabled">
            <div>
              <strong>Secure Boot</strong>
              <div class="text-muted mono" style="font-size:11px">
                Keep the platform-level secure boot flag pinned without editing advanced platform metadata by hand.
              </div>
            </div>
          </label>
        </div>

        <div class="form-group">
          <label for="vm-config-video-ram">Video RAM (MiB)</label>
          <input id="vm-config-video-ram"
                 class="form-input"
                 v-model.number="draft.videoRamMiB"
                 type="number"
                 min="0"
                 step="1"
                 placeholder="0">
          <div class="text-muted mono" style="font-size:11px;margin-top:6px">
            Leave at <code>0</code> to keep the toolstack default virtual display memory allocation.
          </div>
        </div>

        <div class="form-group">
          <label class="stack-item" for="vm-config-igd-passthrough" style="align-items:flex-start;gap:12px">
            <input id="vm-config-igd-passthrough" type="checkbox" v-model="draft.igdPassthroughEnabled">
            <div>
              <strong>IGD Passthrough</strong>
              <div class="text-muted mono" style="font-size:11px">
                Pins the platform-level Intel integrated graphics passthrough hint for the next VM boot when supported by the selected host hardware.
              </div>
            </div>
          </label>
        </div>

        <div class="form-group">
          <label class="stack-item" for="vm-config-has-vendor-device" style="align-items:flex-start;gap:12px">
            <input id="vm-config-has-vendor-device" type="checkbox" v-model="draft.hasVendorDevice">
            <div>
              <strong>Vendor Device Emulation</strong>
              <div class="text-muted mono" style="font-size:11px">
                Controls the emulated PCI vendor device used by HVM Windows guests to discover or update PV drivers on next boot.
              </div>
            </div>
          </label>
        </div>
      </div>

      <div class="form-group">
        <label for="vm-config-affinity">Home Server Affinity</label>
        <select id="vm-config-affinity" class="form-input" v-model="draft.affinity">
          <option value="">Automatic / No Preference</option>
          <option v-if="draft.affinity && !hasHostOption(draft.affinity)" :value="draft.affinity">
            Current Selection · {{ draft.affinity }}
          </option>
          <option v-for="host in hostOptions || []" :key="host.ref" :value="host.ref">
            {{ hostOptionLabel(host) }}
          </option>
        </select>
      </div>

      <div class="form-group">
        <label for="vm-config-appliance">VM Appliance</label>
        <select id="vm-config-appliance" class="form-input" v-model="draft.applianceRef">
          <option value="">Automatic / No Appliance Group</option>
          <option v-if="draft.applianceRef && !hasApplianceOption(draft.applianceRef)" :value="draft.applianceRef">
            Current Selection · {{ draft.applianceRef }}
          </option>
          <option v-for="appliance in applianceOptions || []" :key="appliance.ref" :value="appliance.ref">
            {{ applianceOptionLabel(appliance) }}
          </option>
        </select>
      </div>

      <div class="form-group">
        <label for="vm-config-snapshot-schedule">Snapshot Schedule</label>
        <select id="vm-config-snapshot-schedule" class="form-input" v-model="draft.snapshotScheduleRef">
          <option value="">Automatic / No Snapshot Schedule</option>
          <option v-if="draft.snapshotScheduleRef && !hasSnapshotScheduleOption(draft.snapshotScheduleRef)" :value="draft.snapshotScheduleRef">
            Current Selection · {{ draft.snapshotScheduleRef }}
          </option>
          <option v-for="schedule in snapshotScheduleOptions || []" :key="schedule.ref" :value="schedule.ref">
            {{ snapshotScheduleOptionLabel(schedule) }}
          </option>
        </select>
      </div>

      <div class="form-group">
        <label for="vm-config-tags">Tags</label>
        <input id="vm-config-tags" class="form-input" v-model="draft.tags" placeholder="prod, api, tier-1">
      </div>

      <div class="vm-inline-form-grid">
        <div class="form-group">
          <label>Blocked Operations</label>
          <div class="stack-list">
            <label v-for="option in blockedOperationOptions"
                   :key="option.value"
                   class="stack-item"
                   style="gap:10px;align-items:flex-start">
              <input type="checkbox" :value="option.value" v-model="draft.blockedOperations">
              <div>
                <strong>{{ option.label }}</strong>
                <div class="text-muted mono" style="font-size:11px">{{ option.detail }}</div>
              </div>
            </label>
          </div>
        </div>

        <div class="form-group">
          <label for="vm-config-blocked-operation-code">Blocked Operation Code</label>
          <input id="vm-config-blocked-operation-code"
                 class="form-input"
                 v-model="draft.blockedOperationCode"
                 placeholder="OPERATION_NOT_ALLOWED">
        </div>
      </div>

      <div class="form-group">
        <label for="vm-config-vcpus-params">VM VCPUs_params</label>
        <textarea id="vm-config-vcpus-params"
                  class="form-input form-textarea"
                  rows="4"
                  v-model="draft.vcpusParamsLines"
                  placeholder="weight=256&#10;cap=0"></textarea>
      </div>

      <div class="form-group">
        <label for="vm-config-other-config">VM other_config</label>
        <textarea id="vm-config-other-config"
                  class="form-input form-textarea"
                  rows="4"
                  v-model="draft.otherConfigLines"
                  placeholder="owner=platform-ops&#10;patch-window=sun-0200"></textarea>
      </div>

      <div class="form-group">
        <label for="vm-config-xenstore-data">VM xenstore_data</label>
        <textarea id="vm-config-xenstore-data"
                  class="form-input form-textarea"
                  rows="4"
                  v-model="draft.xenstoreDataLines"
                  placeholder="vm-data/cloud-init=enabled&#10;guest/channel=ops"></textarea>
      </div>

      <div class="form-group">
        <label for="vm-config-nvram">VM NVRAM</label>
        <textarea id="vm-config-nvram"
                  class="form-input form-textarea"
                  rows="4"
                  v-model="draft.nvramLines"
                  placeholder="EFI/BootOrder=0001,0002&#10;EFI/SecureBootMode=user"></textarea>
      </div>

      <div class="form-group">
        <label for="vm-config-platform">VM platform</label>
        <textarea id="vm-config-platform"
                  class="form-input form-textarea"
                  rows="4"
                  v-model="draft.platformLines"
                  placeholder="firmware=uefi&#10;vtpm=enabled"></textarea>
      </div>

      <div class="text-muted mono" style="font-size:11px;margin-bottom:12px">
        Use one <code>key=value</code> pair per line for CPU-policy parameters, advanced VM metadata, XenStore, and UEFI NVRAM. The dedicated Secure Boot toggle, Video RAM field, and IGD Passthrough toggle above own the <code>secureboot</code>, <code>videoram</code>, and <code>igd_passthrough</code> platform keys. Xen only applies NVRAM updates while the VM is halted.
      </div>

      <div class="form-error" v-if="validationError" style="text-align:left;margin-bottom:12px">{{ validationError }}</div>

      <button class="form-btn" type="submit" :disabled="saving">
        <span class="mdi mdi-content-save-outline"></span>
        {{ saving ? 'Saving...' : (submitLabel || 'Save VM Config') }}
      </button>
    </form>
  `,
  data() {
    return {
      draft: buildVmConfigDraft(this.initialValue),
      validationError: '',
      blockedOperationOptions: VM_BLOCKABLE_OPERATION_OPTIONS,
      domainTypeOptions: VM_DOMAIN_TYPE_OPTIONS,
    };
  },
  computed: {
    selectedDomainTypeDetail() {
      const match = VM_DOMAIN_TYPE_OPTIONS.find((option) => option.value === this.draft.domainType) || VM_DOMAIN_TYPE_OPTIONS[0];
      return `${match.detail} This takes effect on the next VM boot.`;
    },
  },
  watch: {
    initialValue: {
      deep: true,
      handler(value) {
        this.draft = buildVmConfigDraft(value);
        this.validationError = '';
      },
    },
  },
  methods: {
    hasHostOption(ref) {
      return (this.hostOptions || []).some((host) => String(host?.ref || '').trim() === String(ref || '').trim());
    },
    hostOptionLabel(host = {}) {
      return `${host.name_label || host.address || host.ref} · ${host.address || host.uuid || host.ref}`;
    },
    hasApplianceOption(ref) {
      return (this.applianceOptions || []).some((appliance) => String(appliance?.ref || '').trim() === String(ref || '').trim());
    },
    applianceOptionLabel(appliance = {}) {
      const memberCount = Array.isArray(appliance.VMs) ? appliance.VMs.length : 0;
      return `${appliance.name_label || appliance.uuid || appliance.ref} · ${memberCount} VM${memberCount === 1 ? '' : 's'}`;
    },
    hasSnapshotScheduleOption(ref) {
      return (this.snapshotScheduleOptions || []).some((schedule) => String(schedule?.ref || '').trim() === String(ref || '').trim());
    },
    snapshotScheduleOptionLabel(schedule = {}) {
      const frequency = String(schedule.frequency || 'custom').replace(/_/g, ' ');
      const retainedSnapshots = Math.max(0, Number(schedule.retained_snapshots || 0) || 0);
      return `${schedule.name_label || schedule.uuid || schedule.ref} · ${frequency} · retain ${retainedSnapshots}`;
    },
    handleSubmit() {
      if (Number(this.draft.memoryStaticMinGiB || 0) > Number(this.draft.memoryGiB || 0)) {
        this.validationError = 'Static Min Memory cannot exceed the configured Memory (GiB) value.';
        return;
      }

      const blockedOperationCode = String(this.draft.blockedOperationCode || '').trim() || 'OPERATION_NOT_ALLOWED';

      const vcpusParams = parseVmStringMapLines(this.draft.vcpusParamsLines, 'VM VCPUs_params');
      if (vcpusParams.error) {
        this.validationError = vcpusParams.error;
        return;
      }

      const otherConfig = parseVmStringMapLines(this.draft.otherConfigLines, 'VM other_config');
      if (otherConfig.error) {
        this.validationError = otherConfig.error;
        return;
      }

      const xenstoreData = parseVmStringMapLines(this.draft.xenstoreDataLines, 'VM xenstore_data');
      if (xenstoreData.error) {
        this.validationError = xenstoreData.error;
        return;
      }

      const nvram = parseVmStringMapLines(this.draft.nvramLines, 'VM NVRAM');
      if (nvram.error) {
        this.validationError = nvram.error;
        return;
      }

      const platform = parseVmStringMapLines(this.draft.platformLines, 'VM platform');
      if (platform.error) {
        this.validationError = platform.error;
        return;
      }

      platform.map.secureboot = this.draft.secureBootEnabled ? 'enabled' : 'disabled';
      const videoRamMiB = normalizeVmPlatformInteger(this.draft.videoRamMiB);
      if (videoRamMiB > 0) {
        platform.map.videoram = String(videoRamMiB);
      } else {
        delete platform.map.videoram;
      }
      platform.map.igd_passthrough = this.draft.igdPassthroughEnabled ? 'true' : 'false';

      this.validationError = '';
      this.$emit('submit', {
        nameLabel: this.draft.nameLabel.trim(),
        nameDescription: this.draft.nameDescription.trim(),
        userVersion: Math.max(0, Number(this.draft.userVersion || 0)),
        startDelay: Math.max(0, Number(this.draft.startDelay || 0)),
        shutdownDelay: Math.max(0, Number(this.draft.shutdownDelay || 0)),
        order: Math.max(0, Number(this.draft.order || 0)),
        vcpus: Number(this.draft.vcpus || 1),
        memoryStaticMax: Math.max(1, Number(this.draft.memoryGiB || 1)) * (1024 ** 3),
        memoryStaticMin: Math.max(1, Number(this.draft.memoryStaticMinGiB || this.draft.memoryGiB || 1)) * (1024 ** 3),
        hardwarePlatformVersion: Math.max(0, Number(this.draft.hardwarePlatformVersion || 0)),
        domainType: String(this.draft.domainType || 'unspecified').trim() || 'unspecified',
        hasVendorDevice: Boolean(this.draft.hasVendorDevice),
        affinity: normalizeVmAffinityRef(this.draft.affinity),
        applianceRef: normalizeVmAffinityRef(this.draft.applianceRef),
        snapshotScheduleRef: normalizeVmAffinityRef(this.draft.snapshotScheduleRef),
        tags: this.draft.tags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
        blockedOperations: Object.fromEntries(
          (Array.isArray(this.draft.blockedOperations) ? this.draft.blockedOperations : [])
            .filter(Boolean)
            .map((operation) => [operation, blockedOperationCode])
        ),
        vcpusParams: vcpusParams.map,
        otherConfig: otherConfig.map,
        xenstoreData: xenstoreData.map,
        nvram: nvram.map,
        platform: platform.map,
      });
    },
  },
};
