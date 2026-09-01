const TemplateLibraryTreeNode = {
  name: 'TemplateLibraryTreeNode',
  props: ['node', 'activeId', 'activeType', 'depth'],
  emits: ['select', 'contextmenu'],
  template: `
    <div>
      <div class="tl-tree-node"
           :class="{ active: node.type === activeType && node.id === activeId }"
           :style="{ paddingLeft: (8 + (depth || 0) * 14) + 'px' }"
           @click="onClick"
           @contextmenu.prevent="onContextMenu">
        <span class="mdi" :class="iconClass"></span>
        <span>{{ node.name }}</span>
      </div>
      <div class="tl-tree-children" v-if="node.type === 'folder' && expanded">
        <template-library-tree-node
          v-for="child in node.children"
          :key="child.type + '-' + child.id"
          :node="child"
          :active-id="activeId"
          :active-type="activeType"
          :depth="(depth || 0) + 1"
          @select="$emit('select', $event)"
          @contextmenu="$emit('contextmenu', $event)">
        </template-library-tree-node>
      </div>
    </div>
  `,
  data() {
    return { expanded: true };
  },
  computed: {
    iconClass() {
      if (this.node.type === 'folder') {
        return this.expanded ? 'mdi-folder-open-outline' : 'mdi-folder-outline';
      }
      return this.node.language === 'yaml' ? 'mdi-file-code-outline' : 'mdi-code-json';
    },
  },
  methods: {
    onClick() {
      if (this.node.type === 'folder') {
        this.expanded = !this.expanded;
      } else {
        this.$emit('select', this.node);
      }
    },
    onContextMenu(event) {
      this.$emit('contextmenu', { node: this.node, x: event.clientX, y: event.clientY });
    },
  },
};

TemplateLibraryTreeNode.components = { TemplateLibraryTreeNode };
