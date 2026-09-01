const ContextMenu = {
  props: ['show', 'x', 'y', 'items'],
  emits: ['close', 'select'],
  template: `
    <div class="context-menu-backdrop" v-if="show" @click="$emit('close')" @contextmenu.prevent="$emit('close')">
      <div class="context-menu" :style="{ left: clampedX + 'px', top: clampedY + 'px' }" @click.stop>
        <template v-for="(item, index) in items" :key="index">
          <div v-if="item.divider" class="context-menu-divider"></div>
          <div v-else
               class="context-menu-item"
               :class="{ disabled: item.disabled, danger: item.danger }"
               @click="onSelect(item)">
            <span class="mdi" :class="item.icon || 'mdi-circle-small'"></span>
            <span>{{ item.label }}</span>
          </div>
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
  methods: {
    onSelect(item) {
      if (item.disabled) return;
      this.$emit('select', item.action);
      this.$emit('close');
    },
  },
};
