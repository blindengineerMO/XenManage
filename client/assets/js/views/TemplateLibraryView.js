const COMPOSE_DEPLOYMENT_JSON_SCHEMA = {
  type: 'object',
  properties: {
    version: { type: 'string', enum: ['1'] },
    name: { type: 'string', minLength: 1 },
    variables: { type: 'object', additionalProperties: { type: ['string', 'number', 'boolean'] } },
    networks: {
      type: 'object',
      additionalProperties: { type: 'object', properties: { ref: { type: 'string' } }, required: ['ref'] },
    },
    storageRepositories: {
      type: 'object',
      additionalProperties: { type: 'object', properties: { ref: { type: 'string' } }, required: ['ref'] },
    },
    startAfter: { type: 'boolean' },
    vms: {
      type: 'object',
      additionalProperties: {
        type: 'object',
        properties: {
          template: { type: 'string', minLength: 1 },
          creationMode: { type: 'string', enum: ['template', 'operating-system'] },
          source: { type: 'string', minLength: 1 },
          operatingSystemProfileId: { type: 'string' },
          nameLabel: { type: 'string', minLength: 1 },
          nameDescription: { type: 'string' },
          memoryStaticMax: { type: ['number', 'string'] },
          memoryDynamicMin: { type: ['number', 'string'] },
          memoryDynamicMax: { type: ['number', 'string'] },
          vcpusAtStartup: { type: ['number', 'string'] },
          vcpusMax: { type: ['number', 'string'] },
          affinity: { type: ['string', 'null'] },
          disks: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                sr: { type: 'string' },
                sizeGb: { type: ['number', 'string'] },
                bootable: { type: 'boolean' },
                mode: { type: 'string', enum: ['RW', 'RO'] },
              },
              required: ['sr', 'sizeGb'],
            },
          },
          networkInterfaces: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                network: { type: 'string' },
                device: { type: 'string' },
              },
              required: ['network'],
            },
          },
          otherConfig: { type: 'object' },
          xenstoreData: { type: 'object' },
          tags: { type: 'array', items: { type: 'string' } },
          dependsOn: { type: 'array', items: { type: 'string' } },
          startAfter: { type: 'boolean' },
        },
        required: ['nameLabel', 'memoryStaticMax'],
        allOf: [{ if: { properties: { creationMode: { const: 'operating-system' } }, required: ['creationMode'] }, then: { required: ['source'] }, else: { required: ['template'] } }],
      },
    },
  },
};

const TemplateLibraryView = {
  components: { FloatingWindow, ContextMenu, TemplateLibraryTreeNode, PromptWindow, ConfirmWindow },
  template: `
    <div class="template-library-view animate-fade-in">
      <div class="tl-toolbar">
        <button class="btn btn-sm" @click="explorerVisible = !explorerVisible">
          <span class="mdi mdi-file-tree-outline"></span> Explorer
        </button>
        <span class="tl-active-name" v-if="activeItem">
          {{ activeItem.name }}<span class="tl-dirty-dot" v-if="dirty"></span>
        </span>
        <span class="tl-active-name" v-else>No file open</span>
        <button class="btn btn-sm btn-primary" :disabled="!activeItem || !dirty || saving" @click="saveActive">
          <span class="mdi mdi-content-save-outline"></span> Save
        </button>
        <button class="btn btn-sm" :disabled="!isComposeItem || deploying" @click="deployActive">
          <span class="mdi mdi-rocket-launch-outline"></span> Deploy
        </button>
      </div>

      <div v-if="errorMessage" class="form-error">{{ errorMessage }}</div>
      <div v-if="deployMessage" class="form-success">{{ deployMessage }}</div>

      <div class="tl-editor-pane">
        <div v-if="!activeItem" class="tl-editor-empty">Select a script from the explorer to begin editing.</div>
        <div v-show="activeItem" ref="editorHost" style="height: 100%;"></div>
      </div>

      <floating-window
        title="Template Explorer"
        :show="explorerVisible"
        :width="320"
        :height="440"
        :x="80"
        :y="96"
        @close="explorerVisible = false">
        <div class="tl-explorer-toolbar">
          <button class="btn btn-sm" @click="openContextMenuForRoot">
            <span class="mdi mdi-plus"></span> New
          </button>
          <button class="btn btn-sm" @click="loadTree">
            <span class="mdi mdi-refresh"></span>
          </button>
        </div>
        <div class="tl-tree">
          <div v-if="!tree.length" class="tl-tree-empty">No folders or scripts yet. Click New to create one.</div>
          <template-library-tree-node
            v-for="node in tree"
            :key="node.type + '-' + node.id"
            :node="node"
            :active-id="activeNode ? activeNode.id : null"
            :active-type="activeNode ? activeNode.type : null"
            @select="onSelectNode"
            @contextmenu="onNodeContextMenu">
          </template-library-tree-node>
        </div>
      </floating-window>

      <context-menu
        :show="contextMenu.show"
        :x="contextMenu.x"
        :y="contextMenu.y"
        :items="contextMenu.items"
        @close="contextMenu.show = false"
        @select="onContextMenuSelect">
      </context-menu>

      <prompt-window
        :show="promptDialog.show"
        :title="promptDialog.title"
        :label="promptDialog.label"
        :placeholder="promptDialog.placeholder"
        :initial-value="promptDialog.initialValue"
        :confirm-label="promptDialog.confirmLabel"
        :error-message="promptDialog.errorMessage"
        @close="promptDialog.show = false"
        @confirm="submitPromptDialog">
      </prompt-window>

      <confirm-window
        :show="discardConfirm.show"
        title="Discard Changes"
        message="Discard unsaved changes to the current file?"
        confirm-label="Discard"
        :danger="true"
        @close="discardConfirm.show = false"
        @confirm="confirmDiscardChanges">
      </confirm-window>

      <confirm-window
        :show="deleteConfirm.show"
        title="Delete"
        :message="deleteConfirm.message"
        confirm-label="Delete"
        :danger="true"
        @close="deleteConfirm.show = false"
        @confirm="confirmDeleteNode">
      </confirm-window>

      <confirm-window
        :show="deployConfirm.show"
        title="Deploy Compose Spec"
        :message="deployConfirm.message"
        confirm-label="Deploy"
        @close="deployConfirm.show = false"
        @confirm="confirmDeploy">
      </confirm-window>
    </div>
  `,
  data() {
    return {
      tree: [],
      activeNode: null,
      activeItem: null,
      dirty: false,
      saving: false,
      deploying: false,
      errorMessage: '',
      deployMessage: '',
      explorerVisible: true,
      contextMenu: { show: false, x: 0, y: 0, items: [], targetNode: null },
      editorInstance: null,
      monacoModule: null,
      promptDialog: {
        show: false,
        mode: '',
        title: '',
        label: '',
        placeholder: '',
        initialValue: '',
        confirmLabel: 'OK',
        errorMessage: '',
        targetNode: null,
        parentFolderId: null,
      },
      discardConfirm: { show: false, pendingNode: null },
      deleteConfirm: { show: false, message: '', targetNode: null },
      deployConfirm: { show: false, message: '', spec: null },
    };
  },
  computed: {
    isComposeItem() {
      return Boolean(this.activeItem && this.activeItem.language !== 'yaml');
    },
  },
  async mounted() {
    await this.loadTree();
  },
  beforeUnmount() {
    if (this.editorInstance) {
      this.editorInstance.dispose();
      this.editorInstance = null;
    }
  },
  methods: {
    async ensureEditor() {
      if (this.editorInstance) return;
      const monaco = await this.loadMonaco();
      if (monaco.languages?.json?.jsonDefaults) {
        monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
          validate: true,
          allowComments: false,
          schemas: [{
            uri: 'https://xenmange.internal/schemas/compose-deployment.json',
            fileMatch: ['*'],
            schema: COMPOSE_DEPLOYMENT_JSON_SCHEMA,
          }],
        });
      }
      this.editorInstance = Vue.markRaw(monaco.editor.create(this.$refs.editorHost, {
        value: '',
        language: 'json',
        theme: 'vs-dark',
        automaticLayout: true,
        minimap: { enabled: false },
        fontSize: 13,
        readOnly: false,
        domReadOnly: false,
        editContext: false,
        // A template editor must treat Enter as a newline, not as a completion action.
        acceptSuggestionOnEnter: 'off',
        quickSuggestions: false,
        suggestOnTriggerCharacters: false,
        wordBasedSuggestions: 'off',
      }));
      this.editorInstance.onDidChangeModelContent(() => {
        this.dirty = true;
      });
    },
    setEditorContent(content, language) {
      if (!this.editorInstance) return;
      const model = this.editorInstance.getModel();
      this.monacoModule.editor.setModelLanguage(model, language === 'yaml' ? 'yaml' : 'json');
      this.editorInstance.setValue(content);
      this.dirty = false;
      this.editorInstance.focus();
    },
    async loadMonaco() {
      if (this.monacoModule) return this.monacoModule;
      const base = '/dist/vendor/monaco';
      window.MonacoEnvironment = {
        getWorker(_moduleId, label) {
          const entry = label === 'json' ? `${base}/json.worker.js` : `${base}/editor.worker.js`;
          return new Worker(entry, { type: 'module' });
        },
      };
      const module = await import(`${base}/monaco.js`);
      this.monacoModule = Vue.markRaw(module.default);
      return this.monacoModule;
    },
    async loadTree() {
      this.errorMessage = '';
      try {
        const response = await api.getTemplateLibraryTree();
        this.tree = response.data || [];
      } catch (error) {
        this.errorMessage = error.message || 'Unable to load the template library.';
      }
    },
    findFolder(nodes, id) {
      for (const node of nodes) {
        if (node.type === 'folder' && node.id === id) return node;
        if (node.type === 'folder') {
          const found = this.findFolder(node.children || [], id);
          if (found) return found;
        }
      }
      return null;
    },
    async onSelectNode(node) {
      if (this.dirty) {
        this.discardConfirm = { show: true, pendingNode: node };
        return;
      }
      await this.openNode(node);
    },
    async confirmDiscardChanges() {
      const node = this.discardConfirm.pendingNode;
      this.discardConfirm = { show: false, pendingNode: null };
      if (node) await this.openNode(node);
    },
    async openNode(node) {
      this.errorMessage = '';
      try {
        const item = await api.getTemplateLibraryItem(node.id);
        this.activeNode = node;
        this.activeItem = item;
        this.dirty = false;
        await this.ensureEditor();
        this.setEditorContent(item.content || '', item.language || 'json');
      } catch (error) {
        this.errorMessage = error.message || 'Unable to open that file.';
      }
    },
    async saveActive() {
      if (!this.activeItem || !this.dirty) return;
      this.saving = true;
      this.errorMessage = '';
      try {
        const updated = await api.saveTemplateLibraryItem(this.activeItem.id, this.editorInstance.getValue());
        this.activeItem = { ...this.activeItem, ...updated };
        this.dirty = false;
      } catch (error) {
        this.errorMessage = error.message || 'Unable to save this file.';
      } finally {
        this.saving = false;
      }
    },
    async deployActive() {
      if (!this.activeItem || this.deploying) return;
      this.errorMessage = '';
      this.deployMessage = '';
      let spec;
      try {
        spec = JSON.parse(this.editorInstance ? this.editorInstance.getValue() : this.activeItem.content || '');
      } catch (error) {
        this.errorMessage = 'This file is not valid JSON, so it cannot be deployed as a compose spec.';
        return;
      }
      if (!spec || typeof spec !== 'object' || !spec.vms) {
        this.errorMessage = 'This file does not look like a compose deployment spec (missing a "vms" section).';
        return;
      }

      this.deploying = true;
      try {
        const plan = await api.dryRunCompose(spec);
        const vmCount = (plan.plans || []).length;
        const summary = (plan.plans || [])
          .map((entry) => `${entry.nameLabel} (from ${entry.template})`)
          .join('\n');
        this.deployConfirm = {
          show: true,
          spec,
          message: `This will deploy ${vmCount} VM(s):\n\n${summary}`,
        };
      } catch (error) {
        this.errorMessage = error.message || 'Unable to plan this compose deployment.';
      } finally {
        this.deploying = false;
      }
    },
    async confirmDeploy() {
      const spec = this.deployConfirm.spec;
      this.deployConfirm = { show: false, message: '', spec: null };
      if (!spec) return;

      this.errorMessage = '';
      this.deploying = true;
      try {
        const run = await api.deployCompose(spec);
        this.deployMessage = run.result || `Compose deployment "${spec.name}" submitted.`;
      } catch (error) {
        this.errorMessage = error.message || 'Unable to deploy this compose spec.';
      } finally {
        this.deploying = false;
      }
    },
    openContextMenuForRoot(event) {
      const trigger = event?.currentTarget;
      const rect = trigger ? trigger.getBoundingClientRect() : null;
      this.contextMenu = {
        show: true,
        x: rect ? Math.round(rect.left) : 120,
        y: rect ? Math.round(rect.bottom + 6) : 140,
        targetNode: null,
        items: this.buildMenuItems(null),
      };
    },
    onNodeContextMenu({ node, x, y }) {
      this.contextMenu = { show: true, x, y, targetNode: node, items: this.buildMenuItems(node) };
    },
    buildMenuItems(node) {
      const isFolder = node && node.type === 'folder';
      const items = [
        { label: 'New Folder', icon: 'mdi-folder-plus-outline', action: 'new-folder' },
        { label: 'New Script', icon: 'mdi-file-plus-outline', action: 'new-item' },
      ];
      if (node) {
        items.push({ divider: true });
        items.push({ label: 'Rename', icon: 'mdi-pencil-outline', action: 'rename', disabled: !node.canManage });
        items.push({ label: 'Delete', icon: 'mdi-trash-can-outline', action: 'delete', danger: true, disabled: !node.canManage });
      }
      return items.map((item) => (item.divider ? item : { ...item, node, isFolder }));
    },
    async onContextMenuSelect(action) {
      const node = this.contextMenu.targetNode;
      const parentFolderId = node ? (node.type === 'folder' ? node.id : node.folderId) : null;
      if (action === 'new-folder') {
        this.promptDialog = {
          show: true,
          mode: 'new-folder',
          title: 'New Folder',
          label: 'Folder name',
          placeholder: 'folder-name',
          initialValue: '',
          confirmLabel: 'Create',
          errorMessage: '',
          targetNode: null,
          parentFolderId,
        };
      } else if (action === 'new-item') {
        this.promptDialog = {
          show: true,
          mode: 'new-item',
          title: 'New Script',
          label: 'Script name',
          placeholder: 'compose.json',
          initialValue: '',
          confirmLabel: 'Create',
          errorMessage: '',
          targetNode: null,
          parentFolderId,
        };
      } else if (action === 'rename' && node) {
        this.promptDialog = {
          show: true,
          mode: 'rename',
          title: 'Rename',
          label: 'New name',
          placeholder: '',
          initialValue: node.name,
          confirmLabel: 'Rename',
          errorMessage: '',
          targetNode: node,
          parentFolderId: null,
        };
      } else if (action === 'delete' && node) {
        const label = node.type === 'folder' ? 'this folder and everything inside it' : 'this script';
        this.deleteConfirm = {
          show: true,
          targetNode: node,
          message: `Delete ${label}? This cannot be undone.`,
        };
      }
    },
    async submitPromptDialog(value) {
      const dialog = this.promptDialog;
      try {
        if (dialog.mode === 'new-folder') {
          await api.createTemplateLibraryFolder({ parentId: dialog.parentFolderId, name: value });
        } else if (dialog.mode === 'new-item') {
          const language = value.trim().toLowerCase().endsWith('.yaml') || value.trim().toLowerCase().endsWith('.yml') ? 'yaml' : 'json';
          await api.createTemplateLibraryItem({ folderId: dialog.parentFolderId, name: value, language, content: '' });
        } else if (dialog.mode === 'rename' && dialog.targetNode) {
          const node = dialog.targetNode;
          if (value === node.name) {
            this.promptDialog.show = false;
            return;
          }
          if (node.type === 'folder') {
            await api.renameTemplateLibraryFolder(node.id, value);
          } else {
            await api.renameTemplateLibraryItem(node.id, value);
            if (this.activeNode && this.activeNode.type === 'item' && this.activeNode.id === node.id) {
              this.activeItem = { ...this.activeItem, name: value };
            }
          }
        }
        this.promptDialog.show = false;
        await this.loadTree();
      } catch (error) {
        this.promptDialog.errorMessage = error.message || 'Unable to complete that action.';
      }
    },
    async confirmDeleteNode() {
      const node = this.deleteConfirm.targetNode;
      this.deleteConfirm = { show: false, message: '', targetNode: null };
      if (!node) return;

      try {
        if (node.type === 'folder') {
          await api.deleteTemplateLibraryFolder(node.id);
        } else {
          await api.deleteTemplateLibraryItem(node.id);
        }
        if (this.activeNode && this.activeNode.type === node.type && this.activeNode.id === node.id) {
          this.activeNode = null;
          this.activeItem = null;
          this.dirty = false;
        }
        await this.loadTree();
      } catch (error) {
        this.errorMessage = error.message || 'Unable to complete that action.';
      }
    },
  },
};
