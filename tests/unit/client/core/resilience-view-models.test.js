const { buildResilienceDrillAnalytics } = require('../../../../client/assets/js/core/resilience-view-models.js');

describe('buildResilienceDrillAnalytics', () => {
  it('returns zeroed stats for no drills', () => {
    expect(buildResilienceDrillAnalytics([])).toEqual({
      totalDrills: 0,
      successCount: 0,
      passRatePercent: 0,
      avgDurationMinutes: 0,
    });
  });

  it('computes pass rate and average duration across mixed drills', () => {
    const drills = [
      { status: 'success', durationMinutes: 30 },
      { status: 'warning', durationMinutes: 50 },
      { status: 'success', durationMinutes: 40 },
      { status: 'critical', durationMinutes: 0 },
    ];
    const result = buildResilienceDrillAnalytics(drills);
    expect(result.totalDrills).toBe(4);
    expect(result.successCount).toBe(2);
    expect(result.passRatePercent).toBe(50);
    expect(result.avgDurationMinutes).toBe(40);
  });

  it('ignores drills with no recorded duration when averaging', () => {
    const drills = [
      { status: 'success', durationMinutes: 0 },
      { status: 'success', durationMinutes: 60 },
    ];
    expect(buildResilienceDrillAnalytics(drills).avgDurationMinutes).toBe(60);
  });
});
