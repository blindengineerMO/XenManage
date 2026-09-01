const StorageBrowserWindow = {
  components: {
    FloatingWindow,
  },
  props: {
    show: {
      type: Boolean,
      default: false,
    },
    selectedSr: {
      type: Object,
      default: null,
    },
    currentPath: {
      type: String,
      default: '',
    },
    entries: {
      type: Array,
      default: () => [],
    },
    loading: {
      type: Boolean,
      default: false,
    },
    error: {
      type: String,
      default: '',
    },
    actionBusy: {
      type: String,
      default: '',
    },
  },
  emits: [
    'close',
    'navigate',
    'mkdir',
    'upload',
    'download',
    'rename',
    'delete',
  ],
  data() {
    return {
      newFolderName: '',
    };
  },
  computed: {
    breadcrumbs() {
      const segments = String(this.currentPath || '').split('/').filter(Boolean);
      const crumbs = [{ label: this.selectedSr?.name_label || 'Root', path: '' }];
      let accumulated = '';
      for (const segment of segments) {
        accumulated = accumulated ? `${accumulated}/${segment}` : segment;
        crumbs.push({ label: segment, path: accumulated });
      }
      return crumbs;
    },
  },
  template: `
    <floating-window :show="show" title="Storage File Browser" :width="760" :height="560" @close="$emit('close')">
      <div v-if="selectedSr">
        <div class="mono" style="font-size:12px;margin-bottom:12px;display:flex;flex-wrap:wrap;gap:4px;align-items:center">
          <template v-for="(crumb, index) in breadcrumbs" :key="crumb.path">
            <span v-if="index" class="text-muted">/</span>
            <a href="#" @click.prevent="$emit('navigate', crumb.path)">{{ crumb.label }}</a>
          </template>
        </div>

        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
          <input class="form-input" style="max-width:220px" type="text" v-model="newFolderName" placeholder="New folder name" />
          <button class="btn btn-sm" :disabled="!newFolderName.trim() || Boolean(actionBusy)" @click="submitMkdir">
            <span class="mdi mdi-folder-plus-outline"></span>
            Create Folder
          </button>
          <label class="btn btn-sm" style="cursor:pointer">
            <span class="mdi mdi-upload"></span>
            {{ actionBusy === 'upload' ? 'Uploading...' : 'Upload File' }}
            <input type="file" style="display:none" @change="submitUpload" :disabled="Boolean(actionBusy)" />
          </label>
        </div>

        <div class="form-error" v-if="error" style="margin-bottom:12px">{{ error }}</div>

        <div class="stack-list">
          <div class="stack-item" v-if="loading">
            <span class="loading-spinner"></span>
            <span class="mono">Loading directory listing...</span>
          </div>
          <div class="stack-item" v-else-if="!entries.length">
            <span class="mdi mdi-folder-open-outline text-muted"></span>
            <span class="mono">This folder is empty.</span>
          </div>
          <div class="stack-item" v-for="entry in entries" :key="entry.name">
            <div style="display:flex;align-items:center;gap:8px;cursor:pointer" @click="entry.type === 'directory' ? $emit('navigate', joinPath(entry.name)) : null">
              <span class="mdi" :class="entry.type === 'directory' ? 'mdi-folder-outline' : 'mdi-file-outline'"></span>
              <div>
                <strong>{{ entry.name }}</strong>
                <div class="text-muted mono" style="font-size:11px">
                  {{ entry.type === 'directory' ? 'Folder' : formatBytes(entry.sizeBytes) }} · {{ entry.modifiedAt ? new Date(entry.modifiedAt).toLocaleString() : '-' }}
                </div>
              </div>
            </div>
            <div style="display:flex;gap:8px;align-items:center">
              <a v-if="entry.type === 'file'" class="btn btn-sm" :href="downloadUrl(entry)" target="_blank" rel="noopener">
                <span class="mdi mdi-download-outline"></span>
                Download
              </a>
              <button class="btn btn-sm"
                      :disabled="Boolean(actionBusy)"
                      @click="promptRename(entry)">
                <span class="mdi mdi-rename-outline"></span>
                Rename
              </button>
              <button class="btn btn-sm"
                      :disabled="Boolean(actionBusy)"
                      @click="$emit('delete', entry)">
                <span class="mdi mdi-delete-outline"></span>
                {{ actionBusy === 'delete:' + entry.name ? 'Deleting...' : 'Delete' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </floating-window>
  `,
  methods: {
    formatBytes,
    joinPath(name) {
      return this.currentPath ? `${this.currentPath}/${name}` : name;
    },
    downloadUrl(entry) {
      if (!this.selectedSr?.ref) return '#';
      return api.downloadStorageFileUrl(this.selectedSr.ref, this.joinPath(entry.name));
    },
    submitMkdir() {
      const name = this.newFolderName.trim();
      if (!name) return;
      this.$emit('mkdir', { path: this.currentPath, name });
      this.newFolderName = '';
    },
    submitUpload(event) {
      const file = event.target.files && event.target.files[0];
      if (!file) return;
      this.$emit('upload', { path: this.currentPath, file });
      event.target.value = '';
    },
    promptRename(entry) {
      const nextName = typeof window === 'undefined' ? entry.name : window.prompt('Rename to:', entry.name);
      if (!nextName || nextName === entry.name) return;
      const toPath = this.currentPath ? `${this.currentPath}/${nextName}` : nextName;
      this.$emit('rename', { fromPath: this.joinPath(entry.name), toPath });
    },
  },
};
