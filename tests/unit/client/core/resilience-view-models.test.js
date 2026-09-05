const { buildResilienceDrillAnalytics, buildResiliencePlanChecklist } = require('../../../../client/assets/js/core/resilience-view-models.js');

beforeAll(() => {
  global.formatDateTime = (value) => `formatted:${value}`;
});

afterAll(() => {
  delete global.formatDateTime;
});

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

describe('buildResiliencePlanChecklist drill recency', () => {
  it('includes the next-due date when the plan carries nextDrillDueAt', () => {
    const checklist = buildResiliencePlanChecklist({
      lastDrillAt: '2026-08-20T09:35:00.000Z',
      lastDrillStatus: 'warning',
      nextDrillDueAt: '2026-10-04T09:35:00.000Z',
    });
    const recency = checklist.find((item) => item.label === 'Drill Recency');
    expect(recency.detail).toContain('Last drill logged formatted:2026-08-20T09:35:00.000Z.');
    expect(recency.detail).toContain('Next drill due formatted:2026-10-04T09:35:00.000Z.');
  });

  it('omits the next-due sentence when no next-due date is present', () => {
    const checklist = buildResiliencePlanChecklist({ lastDrillAt: '2026-08-20T09:35:00.000Z', lastDrillStatus: 'success' });
    const recency = checklist.find((item) => item.label === 'Drill Recency');
    expect(recency.detail).not.toContain('Next drill due');
  });
});
