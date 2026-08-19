const FloatingWindow = {
  props: ['title', 'show', 'width', 'height', 'x', 'y'],
  emits: ['close'],
  template: `
    <div class="floating-window"
         v-if="show"
         :style="{ width: width + 'px', left: posX + 'px', top: posY + 'px', zIndex }"
         @mousedown="bringToFront">
      <div class="fw-header" @mousedown="startDrag">
        <span class="mdi mdi-window-restore" style="font-size:14px;color:var(--text-muted)"></span>
        <span class="fw-title">{{ title }}</span>
        <button class="fw-close" @click.stop="$emit('close')">
          <span class="mdi mdi-close"></span>
        </button>
      </div>
      <div class="fw-body" :style="{ height: height ? height + 'px' : 'auto' }">
        <slot></slot>
      </div>
    </div>
  `,
  data() {
    return {
      posX: this.x || 200,
      posY: this.y || 100,
      dragging: false,
      dragOffsetX: 0,
      dragOffsetY: 0,
      zIndex: windowManager.next(),
    };
  },
  watch: {
    show(value) {
      if (value) {
        this.bringToFront();
      }
    },
  },
  methods: {
    startDrag(event) {
      this.dragging = true;
      this.dragOffsetX = event.clientX - this.posX;
      this.dragOffsetY = event.clientY - this.posY;
      this.bringToFront();
      document.addEventListener('mousemove', this.onDrag);
      document.addEventListener('mouseup', this.stopDrag);
    },
    onDrag(event) {
      if (!this.dragging) return;
      this.posX = Math.max(12, event.clientX - this.dragOffsetX);
      this.posY = Math.max(60, event.clientY - this.dragOffsetY);
    },
    stopDrag() {
      this.dragging = false;
      document.removeEventListener('mousemove', this.onDrag);
      document.removeEventListener('mouseup', this.stopDrag);
    },
    bringToFront() {
      this.zIndex = windowManager.next();
    },
  },
  beforeUnmount() {
    this.stopDrag();
  },
};

