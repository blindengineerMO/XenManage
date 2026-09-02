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
        <button class="btn btn-sm" @click="helpVisible = true">
          <span class="mdi mdi-help-circle-outline"></span> Variables &amp; Options
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
          <button class="btn btn-sm" type="button" aria-label="Refresh template library" title="Refresh" @click="loadTree">
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

      <floating-window
        title="Variables &amp; Options"
        :show="helpVisible"
        :width="600"
        :height="640"
        :x="100"
        :y="60"
        @close="helpVisible = false">
        <div class="tl-help">
          <div class="tl-help-section">
            <h4 class="tl-help-heading">Variables</h4>
            <p class="tl-help-text">
              Compose deployment specs can declare reusable values in a top-level
              <code class="tl-help-code-inline">variables</code> object as key/value pairs, for example
              <code class="tl-help-code-inline">TEST=BLAH</code>:
            </p>
            <pre class="tl-help-code">{
  "variables": {
    "TEST": "BLAH",
    "ENV": "prod"
  }
}</pre>
            <p class="tl-help-text">
              Reference a declared variable anywhere else in the spec &mdash; VM names, descriptions, disk sizes,
              tags, or any other string field &mdash; using
              <code class="tl-help-code-inline">${VARIABLE_NAME}</code> syntax:
            </p>
            <pre class="tl-help-code">{
  "vms": {
    "web1": {
      "nameLabel": "web-${ENV}-01",
      "nameDescription": "Built with TEST=${TEST}"
    }
  }
}</pre>
            <p class="tl-help-text">
              Variables are substituted recursively through strings, arrays, and nested objects at deploy time.
              Referencing a name that isn't declared in <code class="tl-help-code-inline">variables</code> fails
              the deployment before anything is created.
            </p>
          </div>
          <div class="tl-help-section">
            <h4 class="tl-help-heading">Built-in variables</h4>
            <p class="tl-help-text">
              These names resolve automatically and don't need to be declared in
              <code class="tl-help-code-inline">variables</code> yourself:
            </p>
            <dl class="tl-help-field-list">
              <div class="tl-help-field">
                <dt><code class="tl-help-code-inline">${catalogName}</code></dt>
                <dd>
                  Available only when this compose spec is published as a self-service Catalog source. It resolves
                  to the auto-generated instance name (e.g. <code class="tl-help-code-inline">NODE-0007</code>)
                  produced from the catalog entry's naming pattern. A catalog compose source must reference
                  <code class="tl-help-code-inline">${catalogName}</code> in at least one VM name to be published.
                  A catalog admin can also attach fixed variables to the catalog entry, and a subscriber's form
                  answers are merged in as variables too &mdash; both take effect the same way as one you declare.
                </dd>
              </div>
            </dl>
            <p class="tl-help-text">
              Opening and deploying a spec directly from this editor (the Deploy button above) does <em>not</em>
              go through the Catalog, so none of the above are injected there &mdash; only variables you declare
              yourself in <code class="tl-help-code-inline">variables</code> are available.
            </p>
          </div>
          <div class="tl-help-section">
            <h4 class="tl-help-heading">Top-level fields</h4>
            <dl class="tl-help-field-list">
              <div class="tl-help-field"><dt><code class="tl-help-code-inline">version</code></dt><dd>Spec format version. Always <code class="tl-help-code-inline">"1"</code>.</dd></div>
              <div class="tl-help-field"><dt><code class="tl-help-code-inline">name</code></dt><dd>Display name for the compose deployment as a whole.</dd></div>
              <div class="tl-help-field"><dt><code class="tl-help-code-inline">variables</code></dt><dd>Key/value pairs available to <code class="tl-help-code-inline">${VARIABLE_NAME}</code> interpolation, see above.</dd></div>
              <div class="tl-help-field"><dt><code class="tl-help-code-inline">networks</code></dt><dd>Named lookup map, e.g. <code class="tl-help-code-inline">{ "lan": { "ref": "&lt;network OpaqueRef&gt;" } }</code>, referenced from a VM's <code class="tl-help-code-inline">networkInterfaces</code>.</dd></div>
              <div class="tl-help-field"><dt><code class="tl-help-code-inline">storageRepositories</code></dt><dd>Named lookup map, e.g. <code class="tl-help-code-inline">{ "local": { "ref": "&lt;SR OpaqueRef&gt;" } }</code>, referenced from a VM's <code class="tl-help-code-inline">disks</code>.</dd></div>
              <div class="tl-help-field"><dt><code class="tl-help-code-inline">startAfter</code></dt><dd>Boolean. Power on every VM once created.</dd></div>
              <div class="tl-help-field"><dt><code class="tl-help-code-inline">vms</code></dt><dd>Object keyed by an internal VM id (e.g. <code class="tl-help-code-inline">"web1"</code>) &mdash; the fields for each entry are listed below.</dd></div>
            </dl>
          </div>
          <div class="tl-help-section">
            <h4 class="tl-help-heading">Per-VM fields (<code class="tl-help-code-inline">vms.&lt;id&gt;</code>)</h4>
            <dl class="tl-help-field-list">
              <div class="tl-help-field"><dt><code class="tl-help-code-inline">template</code></dt><dd>Source template ref. Required unless <code class="tl-help-code-inline">creationMode</code> is <code class="tl-help-code-inline">operating-system</code>.</dd></div>
              <div class="tl-help-field"><dt><code class="tl-help-code-inline">creationMode</code></dt><dd><code class="tl-help-code-inline">"template"</code> (default) or <code class="tl-help-code-inline">"operating-system"</code>.</dd></div>
              <div class="tl-help-field"><dt><code class="tl-help-code-inline">source</code></dt><dd>OS install source. Required when <code class="tl-help-code-inline">creationMode</code> is <code class="tl-help-code-inline">operating-system</code>.</dd></div>
              <div class="tl-help-field"><dt><code class="tl-help-code-inline">operatingSystemProfileId</code></dt><dd>Optional OS profile id to apply during install.</dd></div>
              <div class="tl-help-field"><dt><code class="tl-help-code-inline">nameLabel</code></dt><dd>Required. The VM's display name.</dd></div>
              <div class="tl-help-field"><dt><code class="tl-help-code-inline">nameDescription</code></dt><dd>Optional description text.</dd></div>
              <div class="tl-help-field"><dt><code class="tl-help-code-inline">memoryStaticMax</code></dt><dd>Required. Bytes of RAM (static max).</dd></div>
              <div class="tl-help-field"><dt><code class="tl-help-code-inline">memoryDynamicMin</code> / <code class="tl-help-code-inline">memoryDynamicMax</code></dt><dd>Optional dynamic memory ballooning range, in bytes.</dd></div>
              <div class="tl-help-field"><dt><code class="tl-help-code-inline">vcpusAtStartup</code> / <code class="tl-help-code-inline">vcpusMax</code></dt><dd>Optional vCPU counts.</dd></div>
              <div class="tl-help-field"><dt><code class="tl-help-code-inline">affinity</code></dt><dd>Optional preferred host ref.</dd></div>
              <div class="tl-help-field"><dt><code class="tl-help-code-inline">disks</code></dt><dd>Array of <code class="tl-help-code-inline">{ sr, sizeGb, bootable, mode }</code>. <code class="tl-help-code-inline">sr</code> is a key from <code class="tl-help-code-inline">storageRepositories</code>; <code class="tl-help-code-inline">mode</code> is <code class="tl-help-code-inline">"RW"</code> or <code class="tl-help-code-inline">"RO"</code>.</dd></div>
              <div class="tl-help-field"><dt><code class="tl-help-code-inline">networkInterfaces</code></dt><dd>Array of <code class="tl-help-code-inline">{ network, device }</code>. <code class="tl-help-code-inline">network</code> is a key from <code class="tl-help-code-inline">networks</code>.</dd></div>
              <div class="tl-help-field"><dt><code class="tl-help-code-inline">otherConfig</code></dt><dd>Arbitrary key/value pairs written to the VM's <code class="tl-help-code-inline">other-config</code> (e.g. <code class="tl-help-code-inline">{ "TEST": "BLAH" }</code>).</dd></div>
              <div class="tl-help-field"><dt><code class="tl-help-code-inline">xenstoreData</code></dt><dd>Arbitrary key/value pairs written to XenStore &mdash; use the <code class="tl-help-code-inline">vm-data</code> key to hand a guest-facing script (e.g. cloud-init user-data) to the VM.</dd></div>
              <div class="tl-help-field"><dt><code class="tl-help-code-inline">tags</code></dt><dd>Array of string tags applied to the VM.</dd></div>
              <div class="tl-help-field"><dt><code class="tl-help-code-inline">dependsOn</code></dt><dd>Array of other VM ids in this spec that must be created first.</dd></div>
              <div class="tl-help-field"><dt><code class="tl-help-code-inline">startAfter</code></dt><dd>Per-VM override of the top-level <code class="tl-help-code-inline">startAfter</code>.</dd></div>
            </dl>
            <p class="tl-help-text">
              Use the New button in the explorer to start a blank template, or Deploy to dry-run and apply the
              currently open spec.
            </p>
          </div>
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
      helpVisible: false,
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
