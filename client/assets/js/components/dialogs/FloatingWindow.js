const FloatingWindow = {
  props: ['title', 'show', 'width', 'height', 'x', 'y'],
  emits: ['close'],
  template: `
    <div class="floating-window"
         v-if="show"
         :style="{ width: resolvedWidth + 'px', left: posX + 'px', top: posY + 'px', zIndex, maxHeight: maxWindowHeight + 'px' }"
         @mousedown="bringToFront">
      <div class="fw-header" @mousedown="startDrag">
        <span class="mdi mdi-window-restore" style="font-size:14px;color:var(--text-muted)"></span>
        <span class="fw-title">{{ title }}</span>
        <button class="fw-close" @click.stop="$emit('close')">
          <span class="mdi mdi-close"></span>
        </button>
      </div>
      <div class="fw-body" :style="{ height: resolvedBodyHeight + 'px' }">
        <slot></slot>
      </div>
    </div>
  `,
  data() {
    return {
      posX: this.x || 200,
      posY: this.y || 80,
      dragging: false,
      dragOffsetX: 0,
      dragOffsetY: 0,
      zIndex: windowManager.next(),
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    };
  },
  computed: {
    resolvedWidth() {
      const requested = Number(this.width || 560);
      return Math.min(requested, this.viewportWidth - 24);
    },
    maxWindowHeight() {
      return Math.max(220, this.viewportHeight - 88 - 28);
    },
    resolvedBodyHeight() {
      const headerHeight = 40;
      const requested = Number(this.height || 320);
      const available = this.viewportHeight - this.posY - headerHeight - 28 - 18;
      return Math.max(160, Math.min(requested, available));
    },
  },
  watch: {
    show(value) {
      if (value) {
        this.bringToFront();
        this.syncViewport();
        this.constrainPosition();
      }
    },
  },
  methods: {
    syncViewport() {
      this.viewportWidth = window.innerWidth;
      this.viewportHeight = window.innerHeight;
    },
    getWorkspaceLeftInset() {
      const mainContent = document.querySelector('.main-content');
      if (!mainContent) return 12;
      return Math.max(12, Math.round(mainContent.getBoundingClientRect().left) + 12);
    },
    constrainPosition() {
      const minX = this.getWorkspaceLeftInset();
      const maxX = Math.max(minX, this.viewportWidth - this.resolvedWidth - 12);
      const maxY = Math.max(60, this.viewportHeight - this.resolvedBodyHeight - 40 - 28 - 12);
      this.posX = Math.min(Math.max(minX, this.posX), maxX);
      this.posY = Math.min(Math.max(60, this.posY), maxY);
    },
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
      this.posX = event.clientX - this.dragOffsetX;
      this.posY = event.clientY - this.dragOffsetY;
      this.constrainPosition();
    },
    stopDrag() {
      this.dragging = false;
      document.removeEventListener('mousemove', this.onDrag);
      document.removeEventListener('mouseup', this.stopDrag);
    },
    bringToFront() {
      this.zIndex = windowManager.next();
    },
    onResize() {
      this.syncViewport();
      this.constrainPosition();
    },
  },
  mounted() {
    window.addEventListener('resize', this.onResize);
    this.constrainPosition();
  },
  beforeUnmount() {
    this.stopDrag();
    window.removeEventListener('resize', this.onResize);
  },
};
