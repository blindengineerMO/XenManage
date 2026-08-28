const InventoryConnectionAtlasWindow = {
  components: {
    FloatingWindow,
    StatusBadge,
  },
  props: {
    showConnectionAtlasWindow: {
      type: Boolean,
      default: false,
    },
    safeConnections: {
      type: Array,
      default: () => [],
    },
    topTags: {
      type: Array,
      default: () => [],
    },
    connectionDefaultPendingId: {
      type: Number,
      default: null,
    },
    connectionActionError: {
      type: String,
      default: '',
    },
  },
  emits: [
    'close',
    'apply-tag',
    'set-default-connection',
    'open-connection-target',
  ],
  template: `
    <floating-window :show="showConnectionAtlasWindow"
                     title="Connection Atlas"
                     :width="820"
                     :height="560"
                     @close="$emit('close')">
      <div class="detail-section" style="margin-top:0">
        <div class="detail-section-title">Saved Targets</div>
        <div class="stack-list" v-if="safeConnections.length">
          <div class="stack-item" v-for="connection in safeConnections" :key="connection.id">
            <div>
              <strong>{{ connection.name || 'Saved Target' }}</strong>
              <div class="text-muted mono" style="font-size:11px">{{ connection.host || '-' }} · {{ connection.username || '-' }} · :{{ connection.port || 443 }}</div>
              <div class="text-muted" style="font-size:12px;margin-top:6px">
                {{ connection.is_default ? 'Default saved target' : 'Saved connection target' }}
                <span v-if="connection.last_connected_at"> · last used {{ formatDateTime(connection.last_connected_at) }}</span>
              </div>
              <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
                <span class="badge" :class="connection.visibility === 'shared' ? 'badge-info' : 'badge-success'">{{ visibilityLabel(connection.visibility) }}</span>
                <span class="badge badge-info" v-if="connection.owner_display_name || connection.owner_username">{{ ownershipLabel(connection) }}</span>
              </div>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;justify-content:flex-end">
              <status-badge :status="connectionStatus(connection)"></status-badge>
              <button class="btn btn-sm"
                      @click="$emit('set-default-connection', connection)"
                      :disabled="connectionDefaultPendingId === connection.id || connection.is_default || connection.can_manage === false">
                <span class="mdi mdi-pin-outline"></span>
                {{ connection.is_default ? 'Default' : (connectionDefaultPendingId === connection.id ? 'Saving...' : 'Set Default') }}
              </button>
              <button class="btn btn-sm" @click="$emit('open-connection-target', connection)">
                <span class="mdi mdi-login-variant"></span>
                Open Login
              </button>
            </div>
          </div>
        </div>
        <div v-else class="empty-state" style="padding:18px 12px">No saved connection targets yet.</div>
        <div class="form-error" v-if="connectionActionError" style="text-align:left">{{ connectionActionError }}</div>
      </div>

      <div class="detail-section">
        <div class="detail-section-title">Top Tags</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="badge badge-info inventory-tag-button"
                  v-for="tag in topTags"
                  :key="tag.label"
                  @click="$emit('apply-tag', tag.label)">
            {{ tag.label }} · {{ tag.count }}
          </button>
        </div>
        <div v-if="!topTags.length" class="text-muted mono" style="font-size:11px">No tags discovered in the current live inventory.</div>
      </div>
    </floating-window>
  `,
  methods: {
    formatDateTime,
    visibilityLabel(visibility) {
      return buildInventoryVisibilityLabel(visibility);
    },
    ownershipLabel(record) {
      return buildInventoryOwnershipLabel(record);
    },
    connectionStatus(connection) {
      return this.isConnectionActive(connection)
        ? 'connected'
        : (connection.is_default ? 'success' : 'notice');
    },
    isConnectionActive(connection) {
      return isInventoryConnectionActive(store.connectedTargets || [], connection);
    },
  },
};
