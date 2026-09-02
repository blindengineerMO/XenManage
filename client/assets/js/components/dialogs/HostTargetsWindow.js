const HostTargetsWindow = {
  components: {
    FloatingWindow,
    StatusBadge,
  },
  props: {
    show: {
      type: Boolean,
      default: false,
    },
    hostTargets: {
      type: Array,
      default: () => [],
    },
    targetError: {
      type: String,
      default: '',
    },
    attachedTargets: {
      type: Array,
      default: () => [],
    },
    targetActionBusyId: {
      type: [String, Number, null],
      default: null,
    },
    targetActionBusyKind: {
      type: String,
      default: '',
    },
  },
  emits: ['close', 'connect', 'activate', 'open-pool', 'edit', 'remove'],
  template: `
    <floating-window :show="show"
                     title="Registered Host Targets"
                     :width="820"
                     :height="540"
                     @close="$emit('close')">
      <div class="detail-section">
        <div class="detail-title">Saved Host Targets</div>
        <div class="stack-list" v-if="hostTargets.length">
          <div class="stack-item" v-for="target in hostTargets" :key="target.id">
            <div>
              <strong>{{ target.name }}</strong>
              <div class="text-muted mono" style="font-size:11px">{{ target.host }} · {{ target.username }} · :{{ target.port || 443 }}</div>
              <div class="text-muted" style="font-size:12px;margin-top:6px">
                {{ target.mode === 'pool-member' ? 'Pool member of ' + (target.pool_name || 'registered pool') : 'Standalone host target' }}
                <span v-if="isCurrentTarget(target)"> · connected now</span>
                <span v-else-if="isTargetAttached(target)"> · attached in session</span>
                <span v-if="target.vault_credential_id"> · vault credential linked</span>
              </div>
              <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
                <span class="badge" :class="target.visibility === 'shared' ? 'badge-info' : 'badge-success'">{{ visibilityLabel(target.visibility) }}</span>
                <span class="badge badge-info" v-if="target.owner_display_name || target.owner_username">{{ ownershipLabel(target) }}</span>
              </div>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;justify-content:flex-end">
              <status-badge :status="target.mode === 'pool-member'
                ? 'pending'
                : (isCurrentTarget(target) ? 'connected' : (isTargetAttached(target) ? 'success' : 'info'))"></status-badge>
              <button class="btn btn-sm"
                      v-if="target.mode === 'standalone' && !isTargetAttached(target)"
                      :disabled="isTargetBusy(target, 'connect')"
                      @click="$emit('connect', target)">
                <span class="mdi" :class="isTargetBusy(target, 'connect') ? 'mdi-loading mdi-spin' : 'mdi-connection'"></span>
                {{ isTargetBusy(target, 'connect') ? 'Connecting...' : 'Connect' }}
              </button>
              <button class="btn btn-sm"
                      v-if="target.mode === 'standalone' && isTargetAttached(target) && !isCurrentTarget(target)"
                      :disabled="isTargetBusy(target, 'activate')"
                      @click="$emit('activate', target)">
                <span class="mdi" :class="isTargetBusy(target, 'activate') ? 'mdi-loading mdi-spin' : 'mdi-target'"></span>
                {{ isTargetBusy(target, 'activate') ? 'Activating...' : 'Activate' }}
              </button>
              <button class="btn btn-sm"
                      v-if="target.mode === 'pool-member'"
                      @click="$emit('open-pool', target)">
                <span class="mdi mdi-open-in-app"></span>
                Open Pool
              </button>
              <button class="btn btn-sm" v-if="target.can_manage !== false" :aria-label="'Edit ' + target.name" @click="$emit('edit', target)">
                <span class="mdi mdi-pencil-outline"></span>
              </button>
              <button class="btn btn-sm" v-if="target.can_manage !== false" :aria-label="'Remove ' + target.name" @click="$emit('remove', target.id)">
                <span class="mdi mdi-delete-outline"></span>
              </button>
            </div>
          </div>
        </div>
        <div v-else class="empty-state" style="padding:18px 12px">Register standalone hosts or queue hosts as members of a saved pool target.</div>
        <div class="form-error" v-if="targetError" style="text-align:left">{{ targetError }}</div>
      </div>
    </floating-window>
  `,
  methods: {
    visibilityLabel(visibility) {
      return visibility === 'shared' ? 'Shared' : 'Private';
    },
    ownershipLabel(target) {
      if (target.is_owner) return 'Owned by you';
      return `Owner ${target.owner_display_name || target.owner_username}`;
    },
    isTargetAttached(target) {
      return isHostTargetAttached(this.attachedTargets, target);
    },
    isCurrentTarget(target) {
      return isCurrentHostTarget(this.attachedTargets, target);
    },
    isTargetBusy(target, kind) {
      return isHostTargetBusy(this.targetActionBusyId, this.targetActionBusyKind, target, kind);
    },
  },
};
