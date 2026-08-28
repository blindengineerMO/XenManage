const InventorySavedWorkspacesWindow = {
  components: {
    FloatingWindow,
  },
  props: {
    showSavedWorkspacesWindow: {
      type: Boolean,
      default: false,
    },
    workspaceName: {
      type: String,
      default: '',
    },
    workspaceTargetConnectionId: {
      type: String,
      default: '',
    },
    workspaceVisibility: {
      type: String,
      default: 'private',
    },
    safeConnections: {
      type: Array,
      default: () => [],
    },
    savedWorkspaces: {
      type: Array,
      default: () => [],
    },
    workspaceSaving: {
      type: Boolean,
      default: false,
    },
    workspaceError: {
      type: String,
      default: '',
    },
    canSaveWorkspace: {
      type: Boolean,
      default: false,
    },
  },
  emits: [
    'close',
    'update-workspace-name',
    'update-workspace-target-connection-id',
    'update-workspace-visibility',
    'save-workspace',
    'apply-workspace',
    'open-workspace-target',
    'remove-workspace',
  ],
  template: `
    <floating-window :show="showSavedWorkspacesWindow"
                     title="Saved Workspaces"
                     :width="840"
                     :height="560"
                     @close="$emit('close')">
      <div class="detail-section" style="margin-top:0">
        <div class="detail-section-title">Save Workspace Preset</div>
        <div class="inventory-toolbar">
          <input class="data-table-search"
                 placeholder="Name this search preset..."
                 :value="workspaceName"
                 @input="$emit('update-workspace-name', $event.target.value)">
          <select class="form-input"
                  style="max-width:240px"
                  :value="workspaceTargetConnectionId"
                  @change="$emit('update-workspace-target-connection-id', $event.target.value)">
            <option value="">No target binding</option>
            <option v-for="connection in safeConnections"
                    :key="connection.id"
                    :value="String(connection.id)">
              {{ connection.name || connection.host }}
            </option>
          </select>
          <select class="form-input"
                  style="max-width:240px"
                  :value="workspaceVisibility"
                  @change="$emit('update-workspace-visibility', $event.target.value)">
            <option value="private">Private Workspace</option>
            <option value="shared">Shared Workspace</option>
          </select>
          <button class="btn btn-primary btn-sm"
                  @click="$emit('save-workspace')"
                  :disabled="!canSaveWorkspace || workspaceSaving">
            <span class="mdi mdi-content-save-outline"></span>
            {{ workspaceSaving ? 'Saving...' : 'Save Workspace' }}
          </button>
        </div>
        <div class="text-muted mono" style="font-size:11px;margin-top:6px">
          Workspace presets now persist through the server and can optionally bind to a saved target for deliberate connection switching.
        </div>
        <div class="form-error" v-if="workspaceError" style="text-align:left">{{ workspaceError }}</div>
      </div>

      <div class="detail-section">
        <div class="detail-section-title">Workspace Library</div>
        <div class="stack-list" v-if="savedWorkspaces.length">
          <div class="stack-item" v-for="workspace in savedWorkspaces" :key="workspace.id">
            <div>
              <strong>{{ workspace.name }}</strong>
              <div class="text-muted mono" style="font-size:11px">{{ workspace.scope }} · {{ workspace.query || 'no query filter' }}</div>
              <div class="text-muted mono" style="font-size:11px">
                {{ resolveWorkspaceTargetLabel(workspace) }}
                <span v-if="workspace.updatedAt"> · updated {{ formatDateTime(workspace.updatedAt) }}</span>
              </div>
              <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
                <span class="badge" :class="workspace.visibility === 'shared' ? 'badge-info' : 'badge-success'">{{ visibilityLabel(workspace.visibility) }}</span>
                <span class="badge badge-info" v-if="workspace.owner_display_name || workspace.owner_username">{{ ownershipLabel(workspace) }}</span>
              </div>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              <button class="btn btn-sm" @click="$emit('apply-workspace', workspace)">
                <span class="mdi mdi-target-variant"></span>
                Apply
              </button>
              <button class="btn btn-sm"
                      v-if="workspace.targetConnectionId"
                      @click="$emit('open-workspace-target', workspace)">
                <span class="mdi mdi-login-variant"></span>
                Open Target
              </button>
              <button class="btn btn-sm"
                      v-if="workspace.can_manage !== false"
                      @click="$emit('remove-workspace', workspace.id)">
                <span class="mdi mdi-delete-outline"></span>
                Remove
              </button>
            </div>
          </div>
        </div>
        <div v-else class="empty-state" style="padding:18px 12px">Save frequent search scopes as reusable operator workspaces.</div>
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
    resolveWorkspaceTargetLabel(workspace) {
      return resolveInventoryWorkspaceTargetLabel(workspace, this.safeConnections);
    },
  },
};
