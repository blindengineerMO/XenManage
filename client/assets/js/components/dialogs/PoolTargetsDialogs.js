const PoolTargetsDialogs = {
  components: {
    FloatingWindow,
    StatusBadge,
  },
  props: {
    showAttachedTargetsWindow: { type: Boolean, default: false },
    showRegisteredTargetsWindow: { type: Boolean, default: false },
    attachedTargets: { type: Array, default: () => [] },
    connections: { type: Array, default: () => [] },
    connectionError: { type: String, default: '' },
  },
  emits: [
    'close-attached-targets',
    'close-registered-targets',
    'activate-live-target',
    'disconnect-live-target',
    'open-connect-dialog',
    'activate-connection',
    'open-registration',
    'make-default',
    'remove-connection',
  ],
  template: `
    <div>
      <floating-window :show="showAttachedTargetsWindow"
                       title="Attached Live Targets"
                       :width="760"
                       :height="500"
                       @close="$emit('close-attached-targets')">
        <div class="detail-section" style="margin-top:0">
          <div class="detail-section-title">Current Session Targets</div>
          <div class="stack-list" v-if="attachedTargets.length">
            <div class="stack-item" v-for="target in attachedTargets" :key="target.targetKey">
              <div>
                <strong>{{ target.connectionName || target.host }}</strong>
                <div class="text-muted mono" style="font-size:11px">{{ target.host }} · {{ target.username }} · :{{ target.port || 443 }}</div>
                <div class="text-muted" style="font-size:12px;margin-top:6px">
                  Attached {{ formatDateTime(target.connectedAt) }}
                  <span v-if="target.lastActivatedAt"> · active since {{ formatDateTime(target.lastActivatedAt) }}</span>
                </div>
              </div>
              <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;justify-content:flex-end">
                <status-badge :status="target.active ? 'connected' : 'success'"></status-badge>
                <button class="btn btn-sm" v-if="!target.active" @click="$emit('activate-live-target', target)">
                  <span class="mdi mdi-target"></span>
                  Activate
                </button>
                <button class="btn btn-sm" @click="$emit('disconnect-live-target', target)">
                  <span class="mdi mdi-link-variant-remove"></span>
                  Detach
                </button>
              </div>
            </div>
          </div>
          <div v-else class="empty-state" style="padding:18px 12px">No live Xen targets are currently attached to this control-plane session.</div>
        </div>
      </floating-window>

      <floating-window :show="showRegisteredTargetsWindow"
                       title="Registered Pool Targets"
                       :width="820"
                       :height="560"
                       @close="$emit('close-registered-targets')">
        <div class="detail-section" style="margin-top:0">
          <div class="detail-section-title">Saved Pool Targets</div>
          <div class="stack-list" v-if="connections.length">
            <div class="stack-item" v-for="connection in connections" :key="connection.id">
              <div>
                <strong>{{ connection.name }}</strong>
                <div class="text-muted mono" style="font-size:11px">{{ connection.host }} · {{ connection.username }} · :{{ connection.port || 443 }}</div>
                <div class="text-muted" style="font-size:12px;margin-top:6px">
                  {{ connection.is_default ? 'Default saved target' : 'Saved pool target' }}
                  <span v-if="isCurrentConnection(connection)"> · connected now</span>
                  <span v-else-if="isConnectionAttached(connection)"> · attached in session</span>
                  <span v-if="connection.vault_credential_id"> · vault credential linked</span>
                </div>
                <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
                  <span class="badge" :class="connection.visibility === 'shared' ? 'badge-info' : 'badge-success'">{{ visibilityLabel(connection.visibility) }}</span>
                  <span class="badge badge-info" v-if="connection.owner_display_name || connection.owner_username">{{ ownershipLabel(connection) }}</span>
                </div>
              </div>
              <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;justify-content:flex-end">
                <status-badge :status="isCurrentConnection(connection) ? 'connected' : (isConnectionAttached(connection) ? 'success' : (connection.is_default ? 'success' : 'notice'))"></status-badge>
                <button class="btn btn-sm"
                        v-if="!isConnectionAttached(connection)"
                        @click="$emit('open-connect-dialog', connection)">
                  <span class="mdi mdi-connection"></span>
                  Connect
                </button>
                <button class="btn btn-sm"
                        v-if="isConnectionAttached(connection) && !isCurrentConnection(connection)"
                        @click="$emit('activate-connection', connection)">
                  <span class="mdi mdi-target"></span>
                  Activate
                </button>
                <button class="btn btn-sm" v-if="connection.can_manage !== false" @click="$emit('open-registration', connection)">
                  <span class="mdi mdi-pencil-outline"></span>
                </button>
                <button class="btn btn-sm" v-if="!connection.is_default && connection.can_manage !== false" @click="$emit('make-default', connection.id)">
                  <span class="mdi mdi-star-outline"></span>
                </button>
                <button class="btn btn-sm" v-if="connection.can_manage !== false" @click="$emit('remove-connection', connection.id)">
                  <span class="mdi mdi-delete-outline"></span>
                </button>
              </div>
            </div>
          </div>
          <div v-else class="empty-state" style="padding:18px 12px">Register pool targets here for future logins and multi-pool operations.</div>
          <div class="form-error" v-if="connectionError" style="text-align:left">{{ connectionError }}</div>
        </div>
      </floating-window>
    </div>
  `,
  methods: {
    formatDateTime,
    visibilityLabel(visibility) {
      return buildPoolVisibilityLabel(visibility);
    },
    ownershipLabel(connection) {
      return buildPoolOwnershipLabel(connection);
    },
    isCurrentConnection(connection) {
      return isPoolCurrentConnection(this.attachedTargets, connection);
    },
    isConnectionAttached(connection) {
      return isPoolConnectionAttached(this.attachedTargets, connection);
    },
  },
};
