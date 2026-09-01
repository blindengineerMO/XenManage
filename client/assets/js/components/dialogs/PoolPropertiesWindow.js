const PoolPropertiesWindow = {
  components: {
    DataTable,
    FloatingWindow,
    StatusBadge,
  },
  props: {
    show: { type: Boolean, default: false },
    selectedPool: { type: Object, default: null },
    selectedPoolDefaultStorageLabel: { type: String, default: '' },
    selectedPoolMigrationCompressionLabel: { type: String, default: '' },
    selectedPoolWlbEnabledLabel: { type: String, default: '' },
    selectedPoolWlbUrlLabel: { type: String, default: '' },
    selectedPoolVswitchControllerLabel: { type: String, default: '' },
    selectedPoolIgmpSnoopingLabel: { type: String, default: '' },
    selectedPoolHaEnabledLabel: { type: String, default: '' },
    selectedPoolHaToleranceLabel: { type: String, default: '' },
    selectedPoolOtherConfigSummary: { type: String, default: '' },
    selectedPoolHosts: { type: Array, default: () => [] },
    poolHostColumns: { type: Array, default: () => [] },
    poolActionMessage: { type: String, default: '' },
    poolActionError: { type: String, default: '' },
    poolUpdates: { type: Object, default: () => ({ kind: '', updates: [] }) },
    poolUpdatesLoading: { type: Boolean, default: false },
    poolUpdatesError: { type: String, default: '' },
    resolveHostLabel: { type: Function, default: (ref) => ref },
    loading: { type: Boolean, default: false },
  },
  emits: [
    'close',
    'open-pool-identity',
    'open-pool-context',
    'open-pool-ha',
    'open-pool-join',
    'eject-host',
  ],
  template: `
    <floating-window :show="show" title="Pool Properties" :width="820" :height="560" @close="$emit('close')">
      <div v-if="selectedPool">
        <div class="property-grid">
          <span class="text-muted">Name</span><span>{{ selectedPool.name_label || '-' }}</span>
          <span class="text-muted">Description</span><span>{{ selectedPool.name_description || '-' }}</span>
          <span class="text-muted">UUID</span><span class="mono property-wrap">{{ selectedPool.uuid || '-' }}</span>
          <span class="text-muted">Default SR</span><span class="mono property-wrap">{{ selectedPoolDefaultStorageLabel }}</span>
          <span class="text-muted">Migration Compression</span><span>{{ selectedPoolMigrationCompressionLabel }}</span>
          <span class="text-muted">WLB Enabled</span><span>{{ selectedPoolWlbEnabledLabel }}</span>
          <span class="text-muted">WLB URL</span><span class="mono property-wrap">{{ selectedPoolWlbUrlLabel }}</span>
          <span class="text-muted">vSwitch Controller</span><span class="mono property-wrap">{{ selectedPoolVswitchControllerLabel }}</span>
          <span class="text-muted">IGMP Snooping</span><span>{{ selectedPoolIgmpSnoopingLabel }}</span>
          <span class="text-muted">Migration Network</span><span class="mono property-wrap">{{ selectedPool.migration_network || '-' }}</span>
          <span class="text-muted">Master Host</span><span class="mono property-wrap">{{ selectedPool.master || '-' }}</span>
          <span class="text-muted">Host Count</span><span>{{ summarizeCount('hosts', selectedPoolHosts.length) }}</span>
          <span class="text-muted">HA Enabled</span><span>{{ selectedPoolHaEnabledLabel }}</span>
          <span class="text-muted">HA Tolerance</span><span>{{ selectedPoolHaToleranceLabel }}</span>
          <span class="text-muted">Tags</span><span>{{ truncateList(selectedPool.tags) }}</span>
          <span class="text-muted">Other Config</span><span class="mono property-wrap">{{ selectedPoolOtherConfigSummary }}</span>
        </div>

        <div class="detail-section">
          <div class="detail-section-title">Pool Workspaces</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn btn-sm" type="button" @click="$emit('open-pool-identity')">
              <span class="mdi mdi-form-textbox"></span>
              Pool Identity
            </button>
            <button class="btn btn-sm" type="button" @click="$emit('open-pool-context')">
              <span class="mdi mdi-file-tree-outline"></span>
              Pool Context
            </button>
            <button class="btn btn-sm" type="button" @click="$emit('open-pool-ha')">
              <span class="mdi mdi-shield-check-outline"></span>
              High Availability ({{ selectedPoolHaEnabledLabel }})
            </button>
            <button class="btn btn-sm" type="button" @click="$emit('open-pool-join')">
              <span class="mdi mdi-source-merge"></span>
              Join Host
            </button>
          </div>
          <div class="text-muted mono" style="font-size:11px;margin-top:10px">
            {{ selectedPoolDefaultStorageLabel }} · {{ selectedPoolMigrationCompressionLabel }} compression · {{ selectedPoolHaToleranceLabel }}
          </div>
          <div class="stack-item" v-if="poolActionMessage" style="margin-top:12px">
            <div>
              <strong>Pool operation completed</strong>
              <div class="text-muted mono" style="font-size:11px">{{ poolActionMessage }}</div>
            </div>
          </div>
          <div class="form-error" v-if="poolActionError" style="text-align:left;margin-top:12px">{{ poolActionError }}</div>
        </div>

        <div class="detail-section">
          <div class="detail-section-title">Associated Hosts</div>
          <data-table :columns="poolHostColumns" :data="selectedPoolHosts" :loading="loading" :searchable="false">
            <template #cell-name_label="{ row }">
              <span style="color:var(--text-primary);font-weight:500">{{ row.name_label || row.hostname || 'Unnamed Host' }}</span>
            </template>
            <template #cell-role="{ row }">
              <span class="badge" :class="row.role === 'Master' ? 'badge-info' : 'badge-success'">{{ row.role }}</span>
            </template>
            <template #cell-enabled="{ row }">
              <status-badge :status="row.enabled ? 'enabled' : 'disabled'"></status-badge>
            </template>
            <template #cell-residentVmCount="{ row }">
              <span class="mono">{{ row.residentVmCount }}</span>
            </template>
            <template #cell-tags="{ row }">
              <span class="mono">{{ truncateList(row.tags) }}</span>
            </template>
            <template #cell-actions="{ row }">
              <button class="btn btn-sm"
                      type="button"
                      v-if="row.role !== 'Master'"
                      @click.stop="$emit('eject-host', row)">
                <span class="mdi mdi-source-branch-remove"></span>
                Eject
              </button>
            </template>
          </data-table>
        </div>

        <div class="detail-section">
          <div class="detail-section-title">Pool Updates</div>
          <p class="text-muted" style="margin-bottom:12px" v-if="poolUpdates.kind === 'pool_patch'">
            This pool reports legacy hotfix (<span class="mono">pool_patch</span>) records rather than the newer update format.
          </p>
          <p class="text-muted" v-if="poolUpdatesLoading">Loading pool updates...</p>
          <div class="form-error" v-else-if="poolUpdatesError">{{ poolUpdatesError }}</div>
          <p class="text-muted" v-else-if="!poolUpdates.updates || poolUpdates.updates.length === 0">
            No update or patch records were reported for this pool.
          </p>
          <div class="stack-list" v-else>
            <div class="stack-item" v-for="update in poolUpdates.updates" :key="update.ref">
              <div>
                <strong>{{ update.nameLabel }}</strong>
                <div class="text-muted mono" style="font-size:11px">
                  {{ update.version ? 'v' + update.version : 'version unknown' }}
                  <template v-if="update.nameDescription"> · {{ update.nameDescription }}</template>
                </div>
                <div class="text-muted mono" style="font-size:11px" v-if="update.pendingHostRefs.length">
                  Not yet applied on: {{ update.pendingHostRefs.map(resolveHostLabel).join(', ') }}
                </div>
              </div>
              <span class="badge" :class="update.fullyApplied ? 'badge-success' : 'badge-warning'">
                {{ update.fullyApplied ? 'applied' : 'pending' }}
              </span>
            </div>
          </div>
          <p class="text-muted" style="margin-top:12px" v-if="poolUpdates.updates && poolUpdates.updates.length">
            Uploading and applying new updates is not yet supported in-app; use XenCenter or the CLI to introduce and apply update packages.
          </p>
        </div>
      </div>
    </floating-window>
  `,
  methods: {
    summarizeCount,
    truncateList,
  },
};
