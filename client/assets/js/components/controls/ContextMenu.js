const ContextMenu = {
  props: ['show', 'x', 'y', 'items'],
  emits: ['close', 'select'],
  template: `
    <div class="context-menu-backdrop" v-if="show" @click="$emit('close')" @contextmenu.prevent="$emit('close')">
      <div ref="menu" class="context-menu" role="menu" aria-label="Actions" tabindex="-1" :style="{ left: clampedX + 'px', top: clampedY + 'px' }" @click.stop @keydown="onKeydown">
        <template v-for="(item, index) in items" :key="index">
          <div v-if="item.divider" class="context-menu-divider"></div>
          <button v-else
               ref="menuItems"
               type="button"
               role="menuitem"
               class="context-menu-item"
               :class="{ disabled: item.disabled, danger: item.danger }"
               :disabled="item.disabled"
               @click="onSelect(item)">
            <span class="mdi" :class="item.icon || 'mdi-circle-small'"></span>
            <span>{{ item.label }}</span>
          </button>
        </template>
      </div>
    </div>
  `,
  computed: {
    clampedX() {
      const menuWidth = 220;
      return Math.min(Number(this.x || 0), Math.max(8, window.innerWidth - menuWidth - 8));
    },
    clampedY() {
      const menuHeight = Math.max(80, (this.items || []).length * 32);
      return Math.min(Number(this.y || 0), Math.max(8, window.innerHeight - menuHeight - 8));
    },
  },
  watch: {
    show(visible) {
      if (visible) this.$nextTick(() => this.focusItem(0));
    },
  },
  methods: {
    onSelect(item) {
      if (item.disabled) return;
      this.$emit('select', item.action);
      this.$emit('close');
    },
    enabledItems() {
      return (Array.isArray(this.$refs.menuItems) ? this.$refs.menuItems : [this.$refs.menuItems])
        .filter((item) => item && !item.disabled);
    },
    focusItem(index) {
      const items = this.enabledItems();
      if (!items.length) return;
      items[(index + items.length) % items.length].focus();
    },
    onKeydown(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        this.$emit('close');
        return;
      }
      const items = this.enabledItems();
      const current = items.indexOf(document.activeElement);
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        this.focusItem(current + 1);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        this.focusItem(current - 1);
      } else if (event.key === 'Home') {
        event.preventDefault();
        this.focusItem(0);
      } else if (event.key === 'End') {
        event.preventDefault();
        this.focusItem(items.length - 1);
      }
    },
  },
};
