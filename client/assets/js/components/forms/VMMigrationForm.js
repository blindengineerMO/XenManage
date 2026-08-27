function normalizeMigrationTargets(targets = [], activeTargetKey = '') {
  const normalizedActiveTargetKey = String(activeTargetKey || '').trim();
  return (Array.isArray(targets) ? targets : [])
    .filter((target) => String(target?.targetKey || '').trim() && String(target?.targetKey || '').trim() !== normalizedActiveTargetKey)
    .map((target) => ({ ...target, targetKey: String(target.targetKey || '').trim() }));
}

function findSourceNetworkForVif(vifRef, networks = []) {
  return (Array.isArray(networks) ? networks : []).find((network) =>
    Array.isArray(network?.VIFs) && network.VIFs.includes(vifRef)
  ) || null;
}

function pickMatchingDestinationNetwork(sourceNetwork, destinationNetworks = []) {
  const normalizedDestinationNetworks = Array.isArray(destinationNetworks) ? destinationNetworks : [];
  if (!sourceNetwork) return normalizedDestinationNetworks[0]?.ref || '';

  const sourceKeys = [
    sourceNetwork.name_label,
    sourceNetwork.bridge,
    sourceNetwork.uuid,
    sourceNetwork.ref,
  ]
    .filter(Boolean)
    .map((value) => String(value).trim().toLowerCase());

  const directMatch = normalizedDestinationNetworks.find((network) =>
    [network.name_label, network.bridge, network.uuid, network.ref]
      .filter(Boolean)
      .map((value) => String(value).trim().toLowerCase())
      .some((value) => sourceKeys.includes(value))
  );

  return directMatch?.ref || normalizedDestinationNetworks[0]?.ref || '';
}

function buildVifNetworkMap(initialValue = {}, sourceNetworks = [], destinationNetworks = [], currentMappings = []) {
  const sourceVifs = Array.isArray(initialValue?.VIFs) ? initialValue.VIFs.filter(Boolean) : [];
  const destinationNetworkRefs = new Set((Array.isArray(destinationNetworks) ? destinationNetworks : []).map((network) => network.ref));

  return sourceVifs.map((vifRef) => {
    const existing = (Array.isArray(currentMappings) ? currentMappings : []).find((entry) => entry.vifRef === vifRef) || null;
    const sourceNetwork = findSourceNetworkForVif(vifRef, sourceNetworks);
    const preferredNetworkRef = existing?.networkRef && destinationNetworkRefs.has(existing.networkRef)
      ? existing.networkRef
      : pickMatchingDestinationNetwork(sourceNetwork, destinationNetworks);

    return {
      vifRef,
      networkRef: preferredNetworkRef,
      sourceLabel: sourceNetwork?.name_label || sourceNetwork?.bridge || sourceNetwork?.uuid || vifRef,
      sourceMeta: sourceNetwork?.bridge || sourceNetwork?.uuid || sourceNetwork?.ref || '',
    };
  });
}

function buildVmMigrationDraft(props = {}, currentDraft = null) {
  const seedDraft = currentDraft && typeof currentDraft === 'object'
    ? currentDraft
    : (props.initialDraft && typeof props.initialDraft === 'object' ? props.initialDraft : null);
  const normalizedHostOptions = Array.isArray(props.hostOptions) ? props.hostOptions : [];
  const normalizedTargets = normalizeMigrationTargets(props.destinationTargets, props.activeTargetKey);
  const normalizedDestinationHosts = Array.isArray(props.destinationHosts) ? props.destinationHosts : [];
  const normalizedDestinationStorage = Array.isArray(props.destinationStorageOptions) ? props.destinationStorageOptions : [];
  const normalizedDestinationNetworks = Array.isArray(props.destinationNetworkOptions) ? props.destinationNetworkOptions : [];
  const currentHostRef = props.initialValue?.resident_on || props.initialValue?.affinity || '';
  const powerState = String(props.initialValue?.power_state || '').toLowerCase();
  const liveEligible = powerState === 'running' || powerState === 'suspended';
  const poolMigrationCompressionEnabled = typeof props.poolMigrationCompressionEnabled === 'boolean'
    ? props.poolMigrationCompressionEnabled
    : true;
  const preferredHostRef = normalizedHostOptions.find((host) => host.ref !== currentHostRef)?.ref || normalizedHostOptions[0]?.ref || '';
  const currentMode = String(seedDraft?.mode || '').trim();
  const mode = currentMode === 'cross-pool' || currentMode === 'same-pool'
    ? currentMode
    : (normalizedHostOptions.length ? 'same-pool' : (normalizedTargets.length ? 'cross-pool' : 'same-pool'));

  const destinationTargetKey = normalizedTargets.some((target) => target.targetKey === seedDraft?.destinationTargetKey)
    ? seedDraft.destinationTargetKey
    : normalizedTargets[0]?.targetKey || '';
  const transferNetworkRef = normalizedDestinationNetworks.some((network) => network.ref === seedDraft?.transferNetworkRef)
    ? seedDraft.transferNetworkRef
    : normalizedDestinationNetworks[0]?.ref || '';
  const srRef = normalizedDestinationStorage.some((storage) => storage.ref === seedDraft?.srRef)
    ? seedDraft.srRef
    : normalizedDestinationStorage[0]?.ref || '';
  const vifNetworkMap = buildVifNetworkMap(
    props.initialValue,
    props.sourceNetworkOptions,
    normalizedDestinationNetworks,
    seedDraft?.vifNetworkMap
  );

  return {
    mode: mode === 'same-pool' && !normalizedHostOptions.length && normalizedTargets.length ? 'cross-pool' : mode,
    hostRef: normalizedHostOptions.some((host) => host.ref === seedDraft?.hostRef) ? seedDraft.hostRef : preferredHostRef,
    destinationTargetKey,
    destinationHostRef: normalizedDestinationHosts.some((host) => host.ref === seedDraft?.destinationHostRef)
      ? seedDraft.destinationHostRef
      : normalizedDestinationHosts[0]?.ref || '',
    transferNetworkRef,
    srRef,
    vifNetworkMap,
    live: liveEligible ? seedDraft?.live !== false : false,
    copy: liveEligible ? false : Boolean(seedDraft?.copy),
    force: Boolean(seedDraft?.force),
    compress: liveEligible
      ? (seedDraft?.compress !== undefined ? Boolean(seedDraft.compress) : Boolean(poolMigrationCompressionEnabled))
      : false,
    setAsHomeServer: Boolean(seedDraft?.setAsHomeServer ?? currentHostRef),
  };
}

const VMMigrationForm = {
  props: [
    'initialValue',
    'hostOptions',
    'destinationTargets',
    'destinationHosts',
    'destinationStorageOptions',
    'destinationNetworkOptions',
    'sourceNetworkOptions',
    'initialDraft',
    'destinationLoading',
    'destinationError',
    'poolMigrationCompressionEnabled',
    'saving',
    'submitLabel',
    'activeTargetKey',
  ],
  emits: ['submit', 'destination-target-change'],
  template: `
    <form @submit.prevent="handleSubmit">
      <div class="form-group">
        <label for="vm-migration-mode">Migration Scope</label>
        <select id="vm-migration-mode" class="form-input" v-model="draft.mode">
          <option value="same-pool" :disabled="!normalizedHostOptions.length">Same pool / host move</option>
          <option value="cross-pool" :disabled="!crossPoolAvailable">Cross-pool / storage-remapped</option>
        </select>
      </div>

      <template v-if="draft.mode === 'same-pool'">
        <div class="form-group">
          <label for="vm-migration-host">Destination Host</label>
          <select id="vm-migration-host" class="form-input" v-model="draft.hostRef" required>
            <option value="" disabled>Select destination host</option>
            <option v-for="host in normalizedHostOptions" :key="host.ref" :value="host.ref">
              {{ host.name_label || host.address || host.ref }}{{ host.address ? ' · ' + host.address : '' }}
            </option>
          </select>
        </div>

        <div class="vm-inline-form-grid">
          <label class="form-toggle">
            <input type="checkbox" v-model="draft.live" :disabled="!liveEligible">
            <span>Use live migration when the VM state allows it</span>
          </label>

          <label class="form-toggle">
            <input type="checkbox" v-model="draft.compress" :disabled="!liveEligible">
            <span>Compress the migration stream</span>
          </label>
        </div>

        <div class="vm-inline-form-grid">
          <label class="form-toggle">
            <input type="checkbox" v-model="draft.force">
            <span>Force the relocation if compatibility checks require an override</span>
          </label>

          <label class="form-toggle">
            <input type="checkbox" v-model="draft.setAsHomeServer">
            <span>Update the VM home server affinity to the selected host</span>
          </label>
        </div>

        <div class="text-muted mono" style="font-size:11px;margin-top:10px">
          {{ liveEligible
            ? 'Running and suspended VMs can stay online during a live migration. Halted VMs will be relocated with a cold move instead.'
            : 'This workload is not running, so XenMange will perform a relocate-style move instead of live migration.' }}
        </div>
        <div class="text-muted mono" style="font-size:11px;margin-top:6px" v-if="liveEligible">
          Pool default migration compression is {{ poolMigrationCompressionEnabled === false ? 'disabled' : 'enabled' }} for this workload's current pool.
        </div>
      </template>

      <template v-else>
        <div class="form-group">
          <label for="vm-migration-target">Destination Live Target</label>
          <select id="vm-migration-target" class="form-input" v-model="draft.destinationTargetKey" required>
            <option value="" disabled>Select destination target</option>
            <option v-for="target in normalizedTargets" :key="target.targetKey" :value="target.targetKey">
              {{ target.connectionName || target.host || target.targetKey }}{{ target.host ? ' · ' + target.host : '' }}
            </option>
          </select>
        </div>

        <div v-if="destinationLoading" class="stack-item" style="margin-bottom:12px">
          <div>
            <strong>Loading destination placement inventory</strong>
            <div class="text-muted mono" style="font-size:11px">Fetching destination hosts, networks, and storage from the selected live target.</div>
          </div>
          <span class="loading-spinner"></span>
        </div>

        <div v-else-if="destinationError" class="form-error" style="text-align:left;margin-bottom:12px">{{ destinationError }}</div>

        <div class="vm-inline-form-grid">
          <div class="form-group" style="margin:0">
            <label for="vm-migration-transfer-network">Transfer Network</label>
            <select id="vm-migration-transfer-network" class="form-input" v-model="draft.transferNetworkRef" :disabled="destinationLoading" required>
              <option value="" disabled>Select transfer network</option>
              <option v-for="network in normalizedDestinationNetworks" :key="network.ref" :value="network.ref">
                {{ network.name_label || network.bridge || network.ref }}
              </option>
            </select>
          </div>

          <div class="form-group" style="margin:0">
            <label for="vm-migration-storage">Destination Storage</label>
            <select id="vm-migration-storage" class="form-input" v-model="draft.srRef" :disabled="destinationLoading" required>
              <option value="" disabled>Select destination storage</option>
              <option v-for="storage in normalizedDestinationStorage" :key="storage.ref" :value="storage.ref">
                {{ storage.name_label || storage.uuid || storage.ref }}
              </option>
            </select>
          </div>
        </div>

        <div class="stack-list" v-if="draft.vifNetworkMap.length" style="margin:14px 0">
          <div class="stack-item" v-for="mapping in draft.vifNetworkMap" :key="mapping.vifRef" style="align-items:flex-start">
            <div style="min-width:0;flex:1">
              <strong>{{ mapping.sourceLabel }}</strong>
              <div class="text-muted mono" style="font-size:11px">{{ mapping.sourceMeta || mapping.vifRef }}</div>
            </div>
            <select class="form-input" style="max-width:280px" v-model="mapping.networkRef" :disabled="destinationLoading" required>
              <option value="" disabled>Select destination network</option>
              <option v-for="network in normalizedDestinationNetworks" :key="network.ref" :value="network.ref">
                {{ network.name_label || network.bridge || network.ref }}
              </option>
            </select>
          </div>
        </div>

        <div class="vm-inline-form-grid">
          <label class="form-toggle">
            <input type="checkbox" v-model="draft.live" :disabled="!liveEligible || draft.copy">
            <span>Keep the VM online when the current power state allows a live move</span>
          </label>

          <label class="form-toggle">
            <input type="checkbox" v-model="draft.copy" :disabled="liveEligible">
            <span>Preserve the source VM and create a cross-pool copy instead of moving it</span>
          </label>
        </div>

        <div class="text-muted mono" style="font-size:11px;margin-top:10px">
          {{ liveEligible
            ? 'Cross-pool live migration uses destination transfer networking plus per-VIF network remapping and storage placement on the target fabric.'
            : 'Because this VM is not running, XenMange can either cold-move it or preserve the source as a cross-pool copy.' }}
        </div>
      </template>

      <div class="form-actions">
        <button class="form-btn" type="submit" :disabled="saving || submitDisabled">
          <span class="mdi mdi-swap-horizontal-bold"></span>
          {{ saving ? 'Migrating...' : resolvedSubmitLabel }}
        </button>
      </div>
    </form>
  `,
  computed: {
    normalizedHostOptions() {
      return Array.isArray(this.hostOptions) ? this.hostOptions : [];
    },
    normalizedTargets() {
      return normalizeMigrationTargets(this.destinationTargets, this.activeTargetKey);
    },
    normalizedDestinationStorage() {
      return Array.isArray(this.destinationStorageOptions) ? this.destinationStorageOptions : [];
    },
    normalizedDestinationNetworks() {
      return Array.isArray(this.destinationNetworkOptions) ? this.destinationNetworkOptions : [];
    },
    crossPoolAvailable() {
      return this.normalizedTargets.length > 0;
    },
    liveEligible() {
      const powerState = String(this.initialValue?.power_state || '').toLowerCase();
      return powerState === 'running' || powerState === 'suspended';
    },
    submitDisabled() {
      if (this.draft.mode === 'cross-pool') {
        return !this.draft.destinationTargetKey
          || !this.draft.transferNetworkRef
          || !this.draft.srRef
          || this.draft.vifNetworkMap.some((entry) => !entry.networkRef);
      }
      return !this.draft.hostRef;
    },
    resolvedSubmitLabel() {
      if (this.submitLabel) return this.submitLabel;
      if (this.draft.mode === 'cross-pool') {
        return this.draft.copy ? 'Copy VM Across Pools' : 'Migrate Across Pools';
      }
      return 'Migrate VM';
    },
  },
  data() {
    return {
      draft: buildVmMigrationDraft(this.$props),
    };
  },
  watch: {
    initialValue: {
      deep: true,
      handler() {
        this.syncDraft({ preserveCurrentDraft: false });
      },
    },
    hostOptions: {
      deep: true,
      handler() {
        this.syncDraft();
      },
    },
    destinationTargets: {
      deep: true,
      handler() {
        this.syncDraft();
      },
    },
    destinationHosts: {
      deep: true,
      handler() {
        this.syncDraft();
      },
    },
    destinationStorageOptions: {
      deep: true,
      handler() {
        this.syncDraft();
      },
    },
    destinationNetworkOptions: {
      deep: true,
      handler() {
        this.syncDraft();
      },
    },
    sourceNetworkOptions: {
      deep: true,
      handler() {
        this.syncDraft();
      },
    },
    initialDraft: {
      deep: true,
      handler() {
        this.syncDraft({ preserveCurrentDraft: false });
      },
    },
    poolMigrationCompressionEnabled() {
      this.syncDraft({ preserveCurrentDraft: false });
    },
    'draft.destinationTargetKey'(value, previousValue) {
      if (!value || value === previousValue) return;
      if (this.draft.mode !== 'cross-pool') return;
      this.$emit('destination-target-change', value);
    },
    'draft.mode'(value, previousValue) {
      if (value === previousValue) return;
      if (value === 'cross-pool' && this.draft.destinationTargetKey) {
        this.$emit('destination-target-change', this.draft.destinationTargetKey);
      }
    },
  },
  mounted() {
    if (this.draft.mode === 'cross-pool' && this.draft.destinationTargetKey) {
      this.$emit('destination-target-change', this.draft.destinationTargetKey);
    }
  },
  methods: {
    syncDraft(options = {}) {
      const preserveCurrentDraft = options.preserveCurrentDraft !== false;
      this.draft = buildVmMigrationDraft(this.$props, preserveCurrentDraft ? this.draft : null);
    },
    handleSubmit() {
      if (this.draft.mode === 'cross-pool') {
        this.$emit('submit', {
          mode: 'cross-pool',
          destinationTargetKey: String(this.draft.destinationTargetKey || '').trim(),
          transferNetworkRef: String(this.draft.transferNetworkRef || '').trim(),
          srRef: String(this.draft.srRef || '').trim(),
          vifNetworkMap: this.draft.vifNetworkMap.map((entry) => ({
            vifRef: String(entry.vifRef || '').trim(),
            networkRef: String(entry.networkRef || '').trim(),
          })),
          live: this.liveEligible ? Boolean(this.draft.live) : false,
          copy: this.liveEligible ? false : Boolean(this.draft.copy),
          force: false,
          compress: false,
          setAsHomeServer: false,
        });
        return;
      }

      this.$emit('submit', {
        mode: 'same-pool',
        hostRef: String(this.draft.hostRef || '').trim(),
        live: this.liveEligible ? Boolean(this.draft.live) : false,
        copy: false,
        force: Boolean(this.draft.force),
        compress: this.liveEligible ? Boolean(this.draft.compress) : false,
        setAsHomeServer: Boolean(this.draft.setAsHomeServer),
      });
    },
  },
};
