const PoolWorkspaceDialogs = {
  components: {
    FloatingWindow,
    PoolConfigForm,
    PoolHaForm,
  },
  props: {
    selectedPool: { type: Object, default: null },
    selectedPoolHosts: { type: Array, default: () => [] },
    selectedPoolStorageOptions: { type: Array, default: () => [] },
    selectedPoolDefaultStorageLabel: { type: String, default: '' },
    selectedPoolMigrationCompressionLabel: { type: String, default: '' },
    selectedPoolMigrationCompressionDetail: { type: String, default: '' },
    selectedPoolWlbEnabledLabel: { type: String, default: '' },
    selectedPoolWlbDetail: { type: String, default: '' },
    selectedPoolVswitchControllerConfigured: { type: Boolean, default: false },
    selectedPoolVswitchControllerDetail: { type: String, default: '' },
    selectedPoolIgmpSnoopingLabel: { type: String, default: '' },
    selectedPoolIgmpSnoopingDetail: { type: String, default: '' },
    selectedPoolOtherConfigSummary: { type: String, default: '' },
    selectedPoolOtherConfigEntries: { type: Array, default: () => [] },
    selectedPoolHaEnabledLabel: { type: String, default: '' },
    selectedPoolHaStatusDetail: { type: String, default: '' },
    selectedPoolHaPlannerDetail: { type: String, default: '' },
    poolConfigSaving: { type: Boolean, default: false },
    poolHaSaving: { type: Boolean, default: false },
    showPoolIdentityWindow: { type: Boolean, default: false },
    showPoolContextWindow: { type: Boolean, default: false },
    showPoolHaWindow: { type: Boolean, default: false },
    showPoolJoinWindow: { type: Boolean, default: false },
    poolJoinDraft: {
      type: Object,
      default: () => ({
        joiningHostAddress: '',
        joiningHostUsername: '',
        joiningHostPassword: '',
        masterAddress: '',
        masterUsername: '',
        masterPassword: '',
        force: false,
      }),
    },
    poolJoinSaving: { type: Boolean, default: false },
    poolJoinError: { type: String, default: '' },
  },
  emits: [
    'close-pool-identity',
    'close-pool-context',
    'close-pool-ha',
    'close-pool-join',
    'submit-selected-pool-config',
    'submit-selected-pool-ha-state',
    'update:pool-join-draft',
    'submit-pool-join',
  ],
  template: `
    <div>
      <floating-window :show="showPoolIdentityWindow"
                       title="Pool Identity"
                       :width="720"
                       :height="520"
                       @close="$emit('close-pool-identity')">
        <div class="detail-section" v-if="selectedPool">
          <div class="detail-title">Pool Metadata Editor</div>
          <p class="text-muted" style="margin-bottom:12px">Update the operator-facing pool name and description without leaving the pool detail workspace.</p>
          <pool-config-form
            :initial-value="selectedPool"
            :storage-options="selectedPoolStorageOptions"
            :submit-label="'Save Pool Metadata'"
            :saving="poolConfigSaving"
            @submit="$emit('submit-selected-pool-config', $event)">
          </pool-config-form>
        </div>
      </floating-window>

      <floating-window :show="showPoolContextWindow"
                       title="Pool Context"
                       :width="760"
                       :height="560"
                       @close="$emit('close-pool-context')">
        <div class="detail-section" v-if="selectedPool">
          <div class="detail-title">Context Snapshot</div>
          <div class="stack-list">
            <div class="stack-item">
              <div>
                <strong>{{ selectedPool.name_label || 'Selected pool' }}</strong>
                <div class="text-muted mono" style="font-size:11px">
                  {{ selectedPool.uuid || selectedPool.ref || 'pool ref unavailable' }}
                </div>
              </div>
              <span class="badge badge-info">{{ summarizeCount('hosts', selectedPoolHosts.length) }}</span>
            </div>
            <div class="stack-item">
              <div>
                <strong>Default SR</strong>
                <div class="text-muted mono" style="font-size:11px">{{ selectedPoolDefaultStorageLabel }}</div>
              </div>
              <span class="badge badge-info">sr</span>
            </div>
            <div class="stack-item">
              <div>
                <strong>Migration Compression</strong>
                <div class="text-muted mono" style="font-size:11px">{{ selectedPoolMigrationCompressionDetail }}</div>
              </div>
              <span class="badge" :class="selectedPool?.migration_compression ? 'badge-success' : 'badge-warning'">
                {{ selectedPoolMigrationCompressionLabel }}
              </span>
            </div>
            <div class="stack-item">
              <div>
                <strong>Workload Balancing</strong>
                <div class="text-muted mono" style="font-size:11px">{{ selectedPoolWlbDetail }}</div>
              </div>
              <span class="badge" :class="selectedPool?.wlb_enabled ? 'badge-success' : 'badge-warning'">
                {{ selectedPoolWlbEnabledLabel }}
              </span>
            </div>
            <div class="stack-item">
              <div>
                <strong>Legacy vSwitch Controller</strong>
                <div class="text-muted mono" style="font-size:11px">{{ selectedPoolVswitchControllerDetail }}</div>
              </div>
              <span class="badge" :class="selectedPoolVswitchControllerConfigured ? 'badge-warning' : 'badge-info'">
                {{ selectedPoolVswitchControllerConfigured ? 'legacy' : 'none' }}
              </span>
            </div>
            <div class="stack-item">
              <div>
                <strong>IGMP Snooping</strong>
                <div class="text-muted mono" style="font-size:11px">{{ selectedPoolIgmpSnoopingDetail }}</div>
              </div>
              <span class="badge" :class="selectedPool?.IGMP_snooping_enabled ? 'badge-success' : 'badge-warning'">
                {{ selectedPoolIgmpSnoopingLabel }}
              </span>
            </div>
            <div class="stack-item">
              <div>
                <strong>Migration Network</strong>
                <div class="text-muted mono" style="font-size:11px">{{ selectedPool.migration_network || 'not configured' }}</div>
              </div>
              <span class="badge badge-info">network</span>
            </div>
            <div class="stack-item">
              <div>
                <strong>Pool other_config</strong>
                <div class="text-muted mono" style="font-size:11px">{{ selectedPoolOtherConfigSummary }}</div>
              </div>
              <span class="badge badge-info">{{ selectedPoolOtherConfigEntries.length }}</span>
            </div>
          </div>
          <p class="text-muted" style="margin:12px 0 0">Deeper SDN controller lifecycle workflows and richer WLB enrollment still remain follow-on parity work.</p>
        </div>
      </floating-window>

      <floating-window :show="showPoolHaWindow"
                       title="High Availability"
                       :width="720"
                       :height="520"
                       @close="$emit('close-pool-ha')">
        <div class="detail-section" v-if="selectedPool">
          <div class="detail-title">HA Policy</div>
          <div class="stack-list" style="margin-bottom:12px">
            <div class="stack-item">
              <div>
                <strong>Status</strong>
                <div class="text-muted mono" style="font-size:11px">{{ selectedPoolHaStatusDetail }}</div>
              </div>
              <span class="badge" :class="selectedPool?.ha_enabled ? 'badge-success' : 'badge-warning'">
                {{ selectedPoolHaEnabledLabel }}
              </span>
            </div>
            <div class="stack-item">
              <div>
                <strong>Failover Planner</strong>
                <div class="text-muted mono" style="font-size:11px">{{ selectedPoolHaPlannerDetail }}</div>
              </div>
              <span class="badge badge-info">{{ selectedPool?.ha_plan_exists_for || 0 }}</span>
            </div>
          </div>
          <pool-ha-form
            :initial-value="selectedPool"
            :storage-options="selectedPoolStorageOptions"
            :saving="poolHaSaving"
            :submit-label="selectedPool?.ha_enabled ? 'Save HA Settings' : 'Enable HA'"
            @submit="$emit('submit-selected-pool-ha-state', $event)">
          </pool-ha-form>
        </div>
      </floating-window>

      <floating-window :show="showPoolJoinWindow"
                       title="Join Host To Pool"
                       :width="560"
                       :height="560"
                       @close="$emit('close-pool-join')">
        <div class="detail-section">
          <div class="detail-title">Target Pool Coordinator</div>
          <p class="text-muted" style="margin-bottom:12px">Credentials for the coordinator of the pool the new host is joining.</p>
          <div class="form-group">
            <label>Coordinator Address</label>
            <input class="form-control" type="text" :value="poolJoinDraft.masterAddress" @input="updateJoinDraft('masterAddress', $event.target.value)" placeholder="10.0.0.10" />
          </div>
          <div class="form-group">
            <label>Coordinator Username</label>
            <input class="form-control" type="text" :value="poolJoinDraft.masterUsername" @input="updateJoinDraft('masterUsername', $event.target.value)" placeholder="root" />
          </div>
          <div class="form-group">
            <label>Coordinator Password</label>
            <input class="form-control" type="password" :value="poolJoinDraft.masterPassword" @input="updateJoinDraft('masterPassword', $event.target.value)" />
          </div>

          <div class="detail-title" style="margin-top:16px">Joining Host</div>
          <p class="text-muted" style="margin-bottom:12px">Credentials for the standalone host that will become a pool member.</p>
          <div class="form-group">
            <label>Host Address</label>
            <input class="form-control" type="text" :value="poolJoinDraft.joiningHostAddress" @input="updateJoinDraft('joiningHostAddress', $event.target.value)" placeholder="10.0.0.20" />
          </div>
          <div class="form-group">
            <label>Host Username</label>
            <input class="form-control" type="text" :value="poolJoinDraft.joiningHostUsername" @input="updateJoinDraft('joiningHostUsername', $event.target.value)" placeholder="root" />
          </div>
          <div class="form-group">
            <label>Host Password</label>
            <input class="form-control" type="password" :value="poolJoinDraft.joiningHostPassword" @input="updateJoinDraft('joiningHostPassword', $event.target.value)" />
          </div>
          <div class="form-group">
            <label style="display:flex;align-items:center;gap:8px">
              <input type="checkbox" :checked="poolJoinDraft.force" @change="updateJoinDraft('force', $event.target.checked)" />
              Skip compatibility checks (join_force)
            </label>
          </div>

          <div class="form-error" v-if="poolJoinError" style="margin-bottom:12px">{{ poolJoinError }}</div>
          <div style="display:flex;justify-content:flex-end">
            <button class="btn btn-primary" :disabled="Boolean(poolJoinSaving)" @click="$emit('submit-pool-join')">
              <span class="mdi mdi-source-merge"></span>
              {{ poolJoinSaving ? 'Joining...' : 'Join Pool' }}
            </button>
          </div>
        </div>
      </floating-window>
    </div>
  `,
  methods: {
    summarizeCount,
    updateJoinDraft(field, value) {
      this.$emit('update:pool-join-draft', { ...this.poolJoinDraft, [field]: value });
    },
  },
};
