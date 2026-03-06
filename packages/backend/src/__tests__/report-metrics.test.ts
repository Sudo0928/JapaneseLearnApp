import {
  buildRetentionMetrics,
  computeOverdueAdjustedRecallRate,
  computeRetentionBucketMetric,
} from '../services/report-service';

describe('report retention metrics', () => {
  const baseRows = [
    {
      correct: true,
      ts: '2026-03-06T10:00:00Z',
      due_ts_at_review: '2026-03-06T09:00:00Z',
      interval_days_at_review: 7,
    },
    {
      correct: false,
      ts: '2026-03-06T10:00:00Z',
      due_ts_at_review: '2026-03-05T10:00:00Z',
      interval_days_at_review: 7,
    },
    {
      correct: true,
      ts: '2026-03-06T10:00:00Z',
      due_ts_at_review: '2026-03-06T08:00:00Z',
      interval_days_at_review: 14,
    },
    {
      correct: true,
      ts: '2026-03-06T10:00:00Z',
      due_ts_at_review: '2026-03-06T08:00:00Z',
      interval_days_at_review: 30,
    },
  ];

  it('7일 버킷을 due 기반 interval로 계산한다', () => {
    const metric = computeRetentionBucketMetric(baseRows, 7, 5, 9);

    expect(metric.window_days).toBe(7);
    expect(metric.eligible_count).toBe(2);
    expect(metric.correct_count).toBe(1);
    expect(metric.recall_rate).toBe(0.5);
  });

  it('retention metrics가 7/14/30 버킷을 각각 산출한다', () => {
    const metrics = buildRetentionMetrics(baseRows);

    expect(metrics.due_7d.eligible_count).toBe(2);
    expect(metrics.due_14d.eligible_count).toBe(1);
    expect(metrics.due_30d.eligible_count).toBe(1);
    expect(metrics.total_eligible_reviews).toBe(4);
  });

  it('연체가 길수록 overdue adjusted recall이 낮아진다', () => {
    const onTimeRows = [
      {
        correct: true,
        ts: '2026-03-06T10:00:00Z',
        due_ts_at_review: '2026-03-06T10:00:00Z',
        interval_days_at_review: 7,
      },
      {
        correct: true,
        ts: '2026-03-06T10:00:00Z',
        due_ts_at_review: '2026-03-06T10:00:00Z',
        interval_days_at_review: 7,
      },
    ];

    const overdueRows = [
      {
        correct: true,
        ts: '2026-03-10T10:00:00Z',
        due_ts_at_review: '2026-03-06T10:00:00Z',
        interval_days_at_review: 7,
      },
      {
        correct: false,
        ts: '2026-03-10T10:00:00Z',
        due_ts_at_review: '2026-03-06T10:00:00Z',
        interval_days_at_review: 7,
      },
    ];

    const onTime = computeOverdueAdjustedRecallRate(onTimeRows);
    const overdue = computeOverdueAdjustedRecallRate(overdueRows);

    expect(onTime).toBeGreaterThan(overdue);
  });
});
