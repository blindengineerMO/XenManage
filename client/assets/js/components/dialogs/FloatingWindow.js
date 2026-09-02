const FloatingWindow = {
  props: ['title', 'show', 'width', 'height', 'x', 'y'],
  emits: ['close'],
  template: `
    <div ref="windowRoot"
         class="floating-window"
         v-if="show"
         role="dialog"
         aria-modal="false"
         :aria-labelledby="titleId"
         tabindex="-1"
         :style="{ width: resolvedWidth + 'px', left: posX + 'px', top: posY + 'px', zIndex, maxHeight: maxWindowHeight + 'px' }"
         @mousedown="bringToFront">
      <div class="fw-header" @mousedown="startDrag">
        <span class="mdi mdi-window-restore" style="font-size:14px;color:var(--text-muted)"></span>
        <span :id="titleId" class="fw-title">{{ title }}</span>
        <button class="fw-close" type="button" :aria-label="'Close ' + title" @click.stop="$emit('close')">
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
    titleId() {
      return `floating-window-title-${this.zIndex}`;
    },
  },
  watch: {
    show(value) {
      if (value) {
        this.bringToFront();
        this.syncViewport();
        this.constrainPosition();
        this.$nextTick(() => this.focusFirstControl());
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
    isTopmostWindow() {
      const windows = Array.from(document.querySelectorAll('.floating-window'));
      const zIndexes = windows
        .map((entry) => Number(window.getComputedStyle(entry).zIndex || 0))
        .filter((value) => Number.isFinite(value));
      const topZIndex = zIndexes.length ? Math.max(...zIndexes) : this.zIndex;
      return this.zIndex >= topZIndex;
    },
    onKeydown(event) {
      if (!this.show || event.defaultPrevented || !this.isTopmostWindow()) return;
      if (event.key === 'Escape') {
        this.$emit('close');
        return;
      }
      if (event.key !== 'Tab') return;

      const focusable = Array.from(this.$refs.windowRoot?.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      ) || []).filter((element) => element.offsetParent !== null);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    },
    focusFirstControl() {
      const focusable = this.$refs.windowRoot?.querySelector(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      (focusable || this.$refs.windowRoot)?.focus();
    },
  },
  mounted() {
    window.addEventListener('resize', this.onResize);
    document.addEventListener('keydown', this.onKeydown);
    this.constrainPosition();
    if (this.show) this.$nextTick(() => this.focusFirstControl());
  },
  beforeUnmount() {
    this.stopDrag();
    window.removeEventListener('resize', this.onResize);
    document.removeEventListener('keydown', this.onKeydown);
  },
};
