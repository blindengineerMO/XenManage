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
      <div v-if="aggregatePoints.length">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px">
          <div>
            <div class="dash-card-value" :class="valueClass">{{ latestValue }}</div>
            <div class="text-muted mono" style="font-size:11px">{{ latestTimestamp }}</div>
          </div>
          <status-badge :status="accentStatus"></status-badge>
        </div>
        <div v-if="subtitle" class="text-muted" style="margin-top:6px;font-size:12px">{{ subtitle }}</div>
        <div v-if="trendSeries.length > 1" style="display:flex;gap:10px;flex-wrap:wrap;margin-top:10px">
          <div v-for="entry in trendSeries"
               :key="entry.key"
               class="text-muted mono"
               style="display:flex;align-items:center;gap:6px;font-size:11px">
            <span :style="{ width: '10px', height: '10px', borderRadius: '999px', background: entry.color, boxShadow: '0 0 10px rgba(0,0,0,0.18)' }"></span>
            <span>{{ entry.label }}</span>
            <span>{{ formatValue(entry.latestValue) }}</span>
          </div>
        </div>
        <svg viewBox="0 0 100 32" preserveAspectRatio="none" style="width:100%;height:140px;margin-top:12px;display:block">
          <polyline v-for="entry in polylineSeries"
                    :key="entry.key"
                    fill="none"
                    :stroke="entry.color"
                    :stroke-width="entry.strokeWidth"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    vector-effect="non-scaling-stroke"
                    :points="entry.points"></polyline>
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
    trendSeries() {
      return this.buildTrendSeries(this.series);
    },
    aggregatePoints() {
      return this.buildAggregatePoints(this.trendSeries);
    },
    latestPoint() {
      return this.aggregatePoints[this.aggregatePoints.length - 1] || null;
    },
    minPoint() {
      if (!this.aggregatePoints.length) return null;
      return this.aggregatePoints.reduce((lowest, point) => Number(point.value) < Number(lowest.value) ? point : lowest, this.aggregatePoints[0]);
    },
    maxPoint() {
      if (!this.aggregatePoints.length) return null;
      return this.aggregatePoints.reduce((highest, point) => Number(point.value) > Number(highest.value) ? point : highest, this.aggregatePoints[0]);
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
    polylineSeries() {
      if (!this.trendSeries.length) return [];

      const bounds = this.buildTrendBounds(this.trendSeries);
      return this.trendSeries.map((entry) => ({
        ...entry,
        strokeWidth: this.trendSeries.length > 1 ? 1.25 : 1,
        points: this.buildPolylinePoints(entry.points, bounds),
      }));
    },
    valueClass() {
      if (this.accentStatus === 'critical' || this.accentStatus === 'failure') return 'text-red';
      if (this.accentStatus === 'warning' || this.accentStatus === 'pending') return 'text-amber';
      if (this.accentStatus === 'success' || this.accentStatus === 'running') return 'text-green';
      return 'text-cyan';
    },
  },
  methods: {
    buildTrendSeries(input = []) {
      const entries = Array.isArray(input) ? input : [];
      const grouped = entries.some((entry) => Array.isArray(entry?.points));

      if (!grouped) {
        const points = entries.filter((entry) => Number.isFinite(Number(entry?.value)));
        return points.length
          ? [{
            key: 'series-0',
            label: 'Total',
            color: this.resolveTrendColor(null, 0),
            latestValue: Number(points[points.length - 1]?.value || 0),
            points,
          }]
          : [];
      }

      return entries
        .map((entry, index) => {
          const points = Array.isArray(entry?.points)
            ? entry.points.filter((point) => Number.isFinite(Number(point?.value)))
            : [];

          if (!points.length) return null;

          return {
            key: String(entry?.key || entry?.label || `series-${index}`),
            label: String(entry?.label || `Series ${index + 1}`),
            color: entry?.color || this.resolveTrendColor(entry, index),
            latestValue: Number(points[points.length - 1]?.value || 0),
            points,
          };
        })
        .filter(Boolean);
    },
    buildAggregatePoints(series = []) {
      const entries = Array.isArray(series) ? series : [];
      if (!entries.length) return [];
      if (entries.length === 1) return entries[0].points;

      const buckets = new Map();
      entries.forEach((entry) => {
        entry.points.forEach((point, index) => {
          const key = this.normalizePointKey(point, index);
          const current = buckets.get(key) || {
            key,
            ts: Number(point?.ts || 0) || 0,
            index,
            value: 0,
          };
          current.value += Number(point?.value || 0);
          buckets.set(key, current);
        });
      });

      return [...buckets.values()]
        .sort((left, right) => {
          if (left.ts && right.ts) return left.ts - right.ts;
          if (left.ts) return -1;
          if (right.ts) return 1;
          return left.index - right.index;
        })
        .map(({ ts, value }) => ({ ts, value }));
    },
    buildTrendBounds(series = []) {
      const entries = Array.isArray(series) ? series : [];
      const axisEntries = [];
      const values = [];

      entries.forEach((entry) => {
        entry.points.forEach((point, index) => {
          const key = this.normalizePointKey(point, index);
          axisEntries.push({
            key,
            ts: Number(point?.ts || 0) || 0,
            index,
          });
          values.push(Number(point?.value || 0));
        });
      });

      const axis = [...new Map(axisEntries.map((entry) => [entry.key, entry])).values()]
        .sort((left, right) => {
          if (left.ts && right.ts) return left.ts - right.ts;
          if (left.ts) return -1;
          if (right.ts) return 1;
          return left.index - right.index;
        });

      const min = values.length ? Math.min(...values) : 0;
      const max = values.length ? Math.max(...values) : 0;

      return {
        axisIndexByKey: Object.fromEntries(axis.map((entry, index) => [entry.key, index])),
        axisLength: axis.length,
        min,
        max,
        spread: max - min || 1,
      };
    },
    buildPolylinePoints(points = [], bounds = {}) {
      const entries = Array.isArray(points) ? points : [];
      if (!entries.length) return '';

      return entries.map((point, index) => {
        const key = this.normalizePointKey(point, index);
        const axisIndex = Number(bounds.axisIndexByKey?.[key] ?? index);
        const x = (bounds.axisLength || entries.length) === 1
          ? 50
          : (axisIndex / ((bounds.axisLength || entries.length) - 1)) * 100;
        const y = 28 - (((Number(point?.value || 0) - Number(bounds.min || 0)) / Number(bounds.spread || 1)) * 24);
        return `${x},${y}`;
      }).join(' ');
    },
    normalizePointKey(point = {}, index = 0) {
      const ts = Number(point?.ts || 0);
      return ts ? `ts:${ts}` : `index:${index}`;
    },
    resolveTrendColor(entry = null, index = 0) {
      const metricKey = String(entry?.key || entry?.label || '').toLowerCase();
      if (metricKey.includes('rx') || metricKey.includes('read') || metricKey.includes('ingress')) return 'rgba(95, 235, 185, 0.95)';
      if (metricKey.includes('tx') || metricKey.includes('write') || metricKey.includes('egress')) return 'rgba(91, 192, 255, 0.95)';
      if (metricKey.includes('cpu')) return 'rgba(255, 186, 73, 0.95)';
      if (metricKey.includes('memory')) return 'rgba(117, 245, 255, 0.95)';

      const palette = [
        'rgba(95, 235, 185, 0.95)',
        'rgba(91, 192, 255, 0.95)',
        'rgba(255, 186, 73, 0.95)',
        'rgba(255, 111, 145, 0.95)',
        'rgba(200, 169, 255, 0.95)',
      ];
      return palette[index % palette.length];
    },
    formatValue(value) {
      const numeric = Number(value || 0);
      if (this.valueKind === 'bytes') return formatBytes(numeric);
      if (this.valueKind === 'throughput') return formatThroughput(numeric);
      if (this.valueKind === 'count') return String(Math.round(numeric));
      return `${Math.round(numeric)}%`;
    },
  },
};

if (typeof module !== 'undefined') {
  module.exports = MetricTrendCard;
}
