const MetricTrendCard = require('../../../../client/assets/js/components/common/MetricTrendCard');

describe('MetricTrendCard', () => {
  beforeAll(() => {
    global.formatDateTime = (value) => `ts:${value}`;
    global.formatBytes = (value) => `${Math.round(Number(value || 0))}B`;
    global.formatThroughput = (value) => `${Math.round(Number(value || 0))}KiB/s`;
  });

  afterAll(() => {
    delete global.formatDateTime;
    delete global.formatBytes;
    delete global.formatThroughput;
  });

  function createCardVm(overrides = {}) {
    const vm = {
      title: 'Metric Trend',
      subtitle: '',
      series: [],
      valueKind: 'percent',
      accentStatus: 'info',
      emptyLabel: 'No telemetry history available yet.',
      ...MetricTrendCard.methods,
      ...overrides,
    };

    vm.trendSeries = MetricTrendCard.computed.trendSeries.call(vm);
    vm.aggregatePoints = MetricTrendCard.computed.aggregatePoints.call(vm);
    vm.latestPoint = MetricTrendCard.computed.latestPoint.call(vm);
    vm.minPoint = MetricTrendCard.computed.minPoint.call(vm);
    vm.maxPoint = MetricTrendCard.computed.maxPoint.call(vm);
    vm.latestValue = MetricTrendCard.computed.latestValue.call(vm);
    vm.latestTimestamp = MetricTrendCard.computed.latestTimestamp.call(vm);
    vm.minValue = MetricTrendCard.computed.minValue.call(vm);
    vm.maxValue = MetricTrendCard.computed.maxValue.call(vm);
    vm.polylineSeries = MetricTrendCard.computed.polylineSeries.call(vm);
    vm.valueClass = MetricTrendCard.computed.valueClass.call(vm);

    return vm;
  }

  it('treats a flat point array as one legacy trend series', () => {
    const card = createCardVm({
      series: [
        { ts: 1, value: 15 },
        { ts: 2, value: 25 },
        { ts: 3, value: 20 },
      ],
      accentStatus: 'warning',
    });

    expect(card.trendSeries).toHaveLength(1);
    expect(card.trendSeries[0].label).toBe('Total');
    expect(card.aggregatePoints).toEqual(card.trendSeries[0].points);
    expect(card.latestValue).toBe('20%');
    expect(card.latestTimestamp).toBe('ts:3');
    expect(card.minValue).toBe('15%');
    expect(card.maxValue).toBe('25%');
    expect(card.polylineSeries).toHaveLength(1);
    expect(card.polylineSeries[0].strokeWidth).toBe(1);
    expect(card.polylineSeries[0].points.split(' ')).toHaveLength(3);
    expect(card.valueClass).toBe('text-amber');
  });

  it('renders grouped trend series and keeps aggregate summary totals', () => {
    const card = createCardVm({
      valueKind: 'throughput',
      series: [
        {
          key: 'network_rx_kib_per_s',
          label: 'RX',
          color: 'rgba(95, 235, 185, 0.95)',
          points: [
            { ts: 1, value: 20 },
            { ts: 2, value: 40 },
          ],
        },
        {
          key: 'network_tx_kib_per_s',
          label: 'TX',
          color: 'rgba(91, 192, 255, 0.95)',
          points: [
            { ts: 1, value: 10 },
            { ts: 2, value: 5 },
          ],
        },
      ],
    });

    expect(card.trendSeries).toHaveLength(2);
    expect(card.trendSeries.map((entry) => entry.label)).toEqual(['RX', 'TX']);
    expect(card.aggregatePoints).toEqual([
      { ts: 1, value: 30 },
      { ts: 2, value: 45 },
    ]);
    expect(card.latestValue).toBe('45KiB/s');
    expect(card.minValue).toBe('30KiB/s');
    expect(card.maxValue).toBe('45KiB/s');
    expect(card.latestTimestamp).toBe('ts:2');
    expect(card.polylineSeries).toHaveLength(2);
    expect(card.polylineSeries.every((entry) => entry.strokeWidth === 1.25)).toBe(true);
    expect(card.polylineSeries[0].points).not.toBe(card.polylineSeries[1].points);
  });
});
