const StorageWorkspaceDialogs = {
  components: {
    FloatingWindow,
    StorageSrConfigForm,
    StorageVdiForm,
    StorageVdiResizeForm,
  },
  props: {
    selectedSr: {
      type: Object,
      default: null,
    },
    storageDetailProfile: {
      type: Object,
      default: () => ({
        accessHosts: [],
        localCacheSummary: '',
        localCacheBlockedReason: '',
        destroyBlockedReason: '',
        attachmentCounts: {},
      }),
    },
    relatedVms: {
      type: Array,
      default: () => [],
    },
    vdis: {
      type: Array,
      default: () => [],
    },
    focusedVdiRef: {
      type: String,
      default: '',
    },
    detailActionBusy: {
      type: String,
      default: '',
    },
    localCacheHostRef: {
      type: String,
      default: '',
    },
    showSrIdentityWindow: {
      type: Boolean,
      default: false,
    },
    showSrActionsWindow: {
      type: Boolean,
      default: false,
    },
    showSrCreateVdiWindow: {
      type: Boolean,
      default: false,
    },
    showSrResizeVdiWindow: {
      type: Boolean,
      default: false,
    },
  },
  emits: [
    'close-sr-identity',
    'close-sr-actions',
    'close-sr-create-vdi',
    'close-sr-resize-vdi',
    'submit-sr-config',
    'apply-detail-storage-action',
    'update:local-cache-host-ref',
    'toggle-local-cache',
    'forget-sr',
    'destroy-sr',
    'submit-detached-vdi',
    'submit-resize-vdi',
  ],
  template: `
    <div>
      <floating-window :show="showSrIdentityWindow"
                       title="Repository Identity"
                       :width="760"
                       :height="520"
                       @close="$emit('close-sr-identity')">
        <div class="detail-section" v-if="selectedSr">
          <div class="detail-title">Repository Metadata</div>
          <p class="text-muted" style="margin-bottom:12px">Update the operator-facing repository name, description, and tag set without leaving the Storage detail workspace.</p>
          <storage-sr-config-form
            :initial-value="selectedSr"
            :submit-label="'Save Repository Metadata'"
            :saving="detailActionBusy === 'config'"
            @submit="$emit('submit-sr-config', $event)">
          </storage-sr-config-form>
        </div>
      </floating-window>

      <floating-window :show="showSrActionsWindow"
                       title="Repository Actions"
                       :width="760"
                       :height="560"
                       @close="$emit('close-sr-actions')">
        <div class="detail-section" v-if="selectedSr">
          <div class="detail-title">Repository Action Rail</div>
          <p class="text-muted" style="margin-bottom:12px">Refresh the selected SR so new LUNs, scan results, or detached disk records are visible immediately inside this workspace.</p>
          <div class="stack-list" style="margin-bottom:12px">
            <div class="stack-item">
              <div>
                <strong>{{ selectedSr.name_label || 'Selected repository' }}</strong>
                <div class="text-muted mono" style="font-size:11px">
                  {{ selectedSr.uuid || selectedSr.ref || 'SR ref unavailable' }} · {{ formatBytes(selectedSr.virtual_allocation) }} allocated
                </div>
              </div>
              <span class="badge badge-info">{{ selectedSr.type || 'sr' }}</span>
            </div>
            <div class="stack-item" v-if="selectedSr.other_config?.last_rescan_at">
              <div>
                <strong>Last Rescan</strong>
                <div class="text-muted mono" style="font-size:11px">{{ selectedSr.other_config.last_rescan_at }}</div>
              </div>
              <span class="badge badge-running">tracked</span>
            </div>
            <div class="stack-item" v-if="selectedSr.other_config?.last_repair_at">
              <div>
                <strong>Last Repair</strong>
                <div class="text-muted mono" style="font-size:11px">{{ selectedSr.other_config.last_repair_at }}</div>
              </div>
              <span class="badge badge-info">tracked</span>
            </div>
            <div class="stack-item">
              <div>
                <strong>Local Cache</strong>
                <div class="text-muted mono" style="font-size:11px">{{ storageDetailProfile.localCacheSummary }}</div>
              </div>
              <span class="badge" :class="selectedSr.local_cache_enabled ? 'badge-running' : 'badge-info'">
                {{ selectedSr.local_cache_enabled ? 'enabled' : 'disabled' }}
              </span>
            </div>
          </div>
          <div class="form-group" v-if="storageDetailProfile.accessHosts.length" style="margin-bottom:12px">
            <label for="storage-local-cache-host">Cache Host Path</label>
            <select id="storage-local-cache-host"
                    class="form-input"
                    :value="localCacheHostRef"
                    @change="$emit('update:local-cache-host-ref', $event.target.value)"
                    :disabled="Boolean(detailActionBusy) || !storageDetailProfile.accessHosts.length">
              <option v-for="host in storageDetailProfile.accessHosts" :key="host.ref" :value="host.ref">
                {{ host.name_label || host.address || host.ref }} · {{ host.address || host.uuid || 'no address' }}
              </option>
            </select>
          </div>
          <button class="form-btn"
                  type="button"
                  :disabled="Boolean(detailActionBusy)"
                  @click="$emit('apply-detail-storage-action', 'rescan')">
            <span class="mdi mdi-refresh-circle"></span>
            {{ detailActionBusy === 'rescan' ? 'Rescanning...' : 'Rescan Repository' }}
          </button>
          <button class="btn btn-sm"
                  type="button"
                  style="margin-top:10px"
                  :disabled="Boolean(detailActionBusy)"
                  @click="$emit('apply-detail-storage-action', 'repair')">
            <span class="mdi mdi-wrench-outline"></span>
            {{ detailActionBusy === 'repair' ? 'Repairing...' : 'Repair Repository' }}
          </button>
          <button class="btn btn-sm"
                  type="button"
                  style="margin-top:10px"
                  :disabled="Boolean(detailActionBusy) || Boolean(storageDetailProfile.localCacheBlockedReason)"
                  @click="$emit('toggle-local-cache')">
            <span class="mdi mdi-cached"></span>
            {{ detailActionBusy === 'local-cache' ? 'Applying Cache Change...' : (selectedSr.local_cache_enabled ? 'Disable Local Cache' : 'Enable Local Cache') }}
          </button>
          <div class="text-muted mono" v-if="storageDetailProfile.localCacheBlockedReason" style="font-size:11px;margin-top:10px">
            {{ storageDetailProfile.localCacheBlockedReason }}
          </div>
          <button class="btn btn-sm"
                  type="button"
                  style="margin-top:10px"
                  :disabled="Boolean(detailActionBusy)"
                  @click="$emit('forget-sr')">
            <span class="mdi mdi-database-remove-outline"></span>
            {{ detailActionBusy === 'forget-sr' ? 'Forgetting...' : 'Forget Repository' }}
          </button>
          <button class="btn btn-sm"
                  type="button"
                  style="margin-top:10px"
                  :disabled="Boolean(detailActionBusy) || Boolean(storageDetailProfile.destroyBlockedReason)"
                  @click="$emit('destroy-sr')">
            <span class="mdi mdi-delete-forever-outline"></span>
            {{ detailActionBusy === 'destroy-sr' ? 'Destroying...' : 'Destroy Repository' }}
          </button>
          <div class="text-muted mono" v-if="storageDetailProfile.destroyBlockedReason" style="font-size:11px;margin-top:10px">
            {{ storageDetailProfile.destroyBlockedReason }}
          </div>
        </div>
      </floating-window>

      <floating-window :show="showSrCreateVdiWindow"
                       title="Create Or Attach VDI"
                       :width="760"
                       :height="520"
                       @close="$emit('close-sr-create-vdi')">
        <div class="detail-section" v-if="selectedSr">
          <div class="detail-title">VDI Provisioning</div>
          <p class="text-muted" style="margin-bottom:12px">Provision a standalone VDI on this repository or attach new capacity directly to a selected workload without leaving the Storage detail workspace.</p>
          <storage-vdi-form
            :sr="selectedSr"
            :vm-options="relatedVms"
            :saving="detailActionBusy === 'create-vdi'"
            :submit-label="'Create VDI'"
            @submit="$emit('submit-detached-vdi', $event)">
          </storage-vdi-form>
        </div>
      </floating-window>

      <floating-window :show="showSrResizeVdiWindow"
                       title="Resize Existing VDI"
                       :width="760"
                       :height="520"
                       @close="$emit('close-sr-resize-vdi')">
        <div class="detail-section" v-if="selectedSr">
          <div class="detail-title">VDI Capacity Change</div>
          <p class="text-muted" style="margin-bottom:12px">Adjust the capacity of a VDI already tracked by this repository without leaving the Storage detail workspace.</p>
          <storage-vdi-resize-form
            :vdi-options="vdis"
            :focused-vdi-ref="focusedVdiRef"
            :attachment-counts="storageDetailProfile.attachmentCounts"
            :saving="detailActionBusy === 'resize-vdi'"
            :submit-label="'Resize VDI'"
            @submit="$emit('submit-resize-vdi', $event)">
          </storage-vdi-resize-form>
        </div>
      </floating-window>
    </div>
  `,
  methods: {
    formatBytes,
  },
};
