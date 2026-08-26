const MetricTrendCard = {
  props: {
    title: { type: String, default: 'Metric Trend' },
    subtitle: { type: String, default: '' },
    series: { type: Array, default: () => [] },
    valueKind: { type: String, default: 'percent' },
    accentStatus: { type: String, default: 'info' },
    emptyLabel: { type: String, default: 'No telemetry history available yet.' },
  },
  template: `
    <div class="dash-card">
      <div class="dash-card-label">{{ title }}</div>
      <div v-if="points.length">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px">
          <div>
            <div class="dash-card-value" :class="valueClass">{{ latestValue }}</div>
            <div class="text-muted mono" style="font-size:11px">{{ latestTimestamp }}</div>
          </div>
          <status-badge :status="accentStatus"></status-badge>
        </div>
        <div v-if="subtitle" class="text-muted" style="margin-top:6px;font-size:12px">{{ subtitle }}</div>
        <svg viewBox="0 0 100 32" preserveAspectRatio="none" style="width:100%;height:140px;margin-top:12px;display:block">
          <polyline fill="none"
                    stroke="rgba(95, 235, 185, 0.95)"
                    stroke-width="2.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    :points="polylinePoints"></polyline>
        </svg>
        <div style="display:flex;justify-content:space-between;gap:12px;margin-top:6px">
          <span class="text-muted mono" style="font-size:11px">Low {{ minValue }}</span>
          <span class="text-muted mono" style="font-size:11px">High {{ maxValue }}</span>
        </div>
      </div>
      <div v-else class="empty-state" style="padding:18px 12px">{{ emptyLabel }}</div>
    </div>
  `,
  computed: {
    points() {
      return Array.isArray(this.series) ? this.series.filter((entry) => Number.isFinite(Number(entry?.value))) : [];
    },
    latestPoint() {
      return this.points[this.points.length - 1] || null;
    },
    minPoint() {
      if (!this.points.length) return null;
      return this.points.reduce((lowest, point) => Number(point.value) < Number(lowest.value) ? point : lowest, this.points[0]);
    },
    maxPoint() {
      if (!this.points.length) return null;
      return this.points.reduce((highest, point) => Number(point.value) > Number(highest.value) ? point : highest, this.points[0]);
    },
    latestValue() {
      return this.formatValue(this.latestPoint?.value);
    },
    latestTimestamp() {
      return this.latestPoint?.ts ? formatDateTime(this.latestPoint.ts) : '-';
    },
    minValue() {
      return this.formatValue(this.minPoint?.value);
    },
    maxValue() {
      return this.formatValue(this.maxPoint?.value);
    },
    polylinePoints() {
      if (!this.points.length) return '';
      const values = this.points.map((point) => Number(point.value || 0));
      const min = Math.min(...values);
      const max = Math.max(...values);
      const spread = max - min || 1;

      return this.points.map((point, index) => {
        const x = this.points.length === 1 ? 50 : (index / (this.points.length - 1)) * 100;
        const y = 28 - (((Number(point.value || 0) - min) / spread) * 24);
        return `${x},${y}`;
      }).join(' ');
    },
    valueClass() {
      if (this.accentStatus === 'critical' || this.accentStatus === 'failure') return 'text-red';
      if (this.accentStatus === 'warning' || this.accentStatus === 'pending') return 'text-amber';
      if (this.accentStatus === 'success' || this.accentStatus === 'running') return 'text-green';
      return 'text-cyan';
    },
  },
  methods: {
    formatValue(value) {
      const numeric = Number(value || 0);
      if (this.valueKind === 'bytes') return formatBytes(numeric);
      if (this.valueKind === 'throughput') return formatThroughput(numeric);
      if (this.valueKind === 'count') return String(Math.round(numeric));
      return `${Math.round(numeric)}%`;
    },
  },
};
