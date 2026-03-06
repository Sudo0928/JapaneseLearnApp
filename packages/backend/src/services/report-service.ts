/**
 * 주간 리포트 서비스 (Sprint 5-1)
 *
 * 설계 원칙 (rules/report.mdc):
 * - 리포트는 "학습량"이 아니라 "지연 인출/혼동쌍 감소/연체 회복" 중심 (학습-수행의 괴리 관리)
 * - OEC는 즉시 정답률이 아닌 지연 인출률로 고정
 * - 피드백 메시지: "지연 인출/혼동쌍 감소/연체 회복" 중심 3~5문장
 */

import { pool } from '../db/pool';
import { getCachedConfusionPairs } from './confusion-pairs';

// ─── 타입 ─────────────────────────────────────────────────────

export interface DailyStats {
  day: string;          // YYYY-MM-DD
  reviews: number;
  new_cards: number;
  correct_rate: number;
  p50_rt_ms: number;
  p90_rt_ms: number;
  lateness_p50_sec: number;
}

export interface RetentionBucketMetric {
  window_days: number;
  eligible_count: number;
  correct_count: number;
  recall_rate: number;
  avg_lateness_days: number;
}

export interface RetentionMetrics {
  due_7d: RetentionBucketMetric;
  due_14d: RetentionBucketMetric;
  due_30d: RetentionBucketMetric;
  overdue_adjusted_recall_rate: number;
  total_eligible_reviews: number;
}

export interface ConfusionMetric {
  surface: string;
  error_type: string;
  error_count: number;
}

export interface ConfusionMetrics {
  top_confusions: ConfusionMetric[];
  total_confusion_errors: number;
  dominant_error_type: string | null;
}

export interface RecoveryMetrics {
  overdue_backlog_days: number;
  recovery_completion_rate: number;
  recovery_time_to_normal_days: number | null;
  post_recovery_retention: number | null;
}

export interface WeeklyReport {
  user_id: string;
  period: { from: string; to: string };
  summary: {
    total_reviews: number;
    total_new_cards: number;
    avg_correct_rate: number;
    avg_rt_ms: number;
    overdue_days: number;       // 연체 일수 (lateness_p50 > 0인 날)
    streak_days: number;        // 연속 학습일
  };
  daily_stats: DailyStats[];
  retention_metrics: RetentionMetrics;
  confusion_metrics: ConfusionMetrics;
  recovery_metrics: RecoveryMetrics;
  insights: string[];           // 설명 가능한 3~5문장 인사이트
  generated_at: string;
}

// ─── 일배치: user_daily_agg 갱신 ──────────────────────────────

/**
 * 특정 사용자의 어제 통계를 user_daily_agg에 UPSERT
 * 실제 배포에서는 크론 또는 큐 기반으로 전체 활성 사용자 대상으로 실행
 */
export async function upsertDailyAgg(userId: string, day: Date): Promise<void> {
  const dayStr = day.toISOString().slice(0, 10);

  await pool.query(
    `
    INSERT INTO user_daily_agg (
      user_id, day, reviews, new_cards, correct_rate,
      p50_rt_ms, p90_rt_ms, lateness_p50_sec
    )
    SELECT
      rl.user_id,
      $2::DATE AS day,
      COUNT(*) AS reviews,
      COUNT(*) FILTER (WHERE COALESCE(rl.is_new_at_review, FALSE)) AS new_cards,
      ROUND(AVG(CASE WHEN rl.correct THEN 1.0 ELSE 0.0 END)::NUMERIC, 3) AS correct_rate,
      COALESCE(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY rl.rt_ms)::INTEGER, 0) AS p50_rt_ms,
      COALESCE(PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY rl.rt_ms)::INTEGER, 0) AS p90_rt_ms,
      COALESCE(
        PERCENTILE_CONT(0.5) WITHIN GROUP (
          ORDER BY EXTRACT(EPOCH FROM (rl.ts - rl.due_ts_at_review))
        ), 0
      ) AS lateness_p50_sec
    FROM review_log rl
    WHERE rl.user_id = $1
      AND rl.ts::DATE = $2::DATE
    GROUP BY rl.user_id
    ON CONFLICT (user_id, day) DO UPDATE
      SET reviews          = EXCLUDED.reviews,
          new_cards        = EXCLUDED.new_cards,
          correct_rate     = EXCLUDED.correct_rate,
          p50_rt_ms        = EXCLUDED.p50_rt_ms,
          p90_rt_ms        = EXCLUDED.p90_rt_ms,
          lateness_p50_sec = EXCLUDED.lateness_p50_sec,
          computed_at      = NOW()
    `,
    [userId, dayStr]
  );
}

/**
 * 전체 활성 사용자 일배치 (어제 기준)
 */
export async function runDailyAggBatch(): Promise<{ processed: number }> {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  const { rows: users } = await pool.query<{ user_id: string }>(
    `SELECT DISTINCT user_id FROM review_log WHERE ts >= NOW() - INTERVAL '2 days'`
  );

  for (const { user_id } of users) {
    await upsertDailyAgg(user_id, yesterday);
  }

  return { processed: users.length };
}

// ─── 주간 리포트 생성 ─────────────────────────────────────────

export async function generateWeeklyReport(userId: string): Promise<WeeklyReport> {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - 6);

  const fromStr = from.toISOString().slice(0, 10);
  const toStr = to.toISOString().slice(0, 10);

  // ─── 1) 일별 통계 ────────────────────────────────────────
  const { rows: dailyRows } = await pool.query<DailyStats>(
    `
    SELECT
      day::TEXT,
      reviews,
      new_cards,
      correct_rate,
      COALESCE(p50_rt_ms, 0) AS p50_rt_ms,
      COALESCE(p90_rt_ms, 0) AS p90_rt_ms,
      COALESCE(lateness_p50_sec, 0) AS lateness_p50_sec
    FROM user_daily_agg
    WHERE user_id = $1 AND day BETWEEN $2 AND $3
    ORDER BY day ASC
    `,
    [userId, fromStr, toStr]
  );

  // ─── 2) 요약 통계 ────────────────────────────────────────
  const totalReviews = dailyRows.reduce((s, r) => s + Number(r.reviews), 0);
  const totalNew = dailyRows.reduce((s, r) => s + Number(r.new_cards), 0);
  const activeDays = dailyRows.filter((r) => Number(r.reviews) > 0);
  const avgCorrect = activeDays.length > 0
    ? activeDays.reduce((s, r) => s + Number(r.correct_rate), 0) / activeDays.length
    : 0;
  const avgRt = activeDays.length > 0
    ? activeDays.reduce((s, r) => s + Number(r.p50_rt_ms), 0) / activeDays.length
    : 0;
  const overdueDays = dailyRows.filter((r) => Number(r.lateness_p50_sec) > 0).length;
  const streakDays = computeStreak(dailyRows);

  // ─── 3) retention / recovery metric ─────────────────────
  const retentionRows = await getRetentionObservations(userId, fromStr, toStr);
  const retentionMetrics = buildRetentionMetrics(retentionRows);
  const recoveryMetrics = buildRecoveryMetrics(retentionRows, dailyRows, retentionMetrics);

  // ─── 4) 혼동쌍 top-5 ─────────────────────────────────────
  const confusions = await getCachedConfusionPairs(userId, 7);
  const topConfusions = confusions.slice(0, 5).map((c) => ({
    surface: c.surface,
    error_type: c.error_type,
    error_count: c.error_count,
  }));
  const confusionMetrics: ConfusionMetrics = {
    top_confusions: topConfusions,
    total_confusion_errors: confusions.reduce((sum, item) => sum + item.error_count, 0),
    dominant_error_type: topConfusions[0]?.error_type ?? null,
  };

  // ─── 5) 인사이트 생성 (설명 가능한 3~5문장) ─────────────
  const insights = buildInsights({
    activeDays: activeDays.length,
    avgCorrect,
    retentionMetrics,
    overdueDays,
    confusionMetrics,
    recoveryMetrics,
    streakDays,
  });

  return {
    user_id: userId,
    period: { from: fromStr, to: toStr },
    summary: {
      total_reviews: totalReviews,
      total_new_cards: totalNew,
      avg_correct_rate: round2(avgCorrect),
      avg_rt_ms: Math.round(avgRt),
      overdue_days: overdueDays,
      streak_days: streakDays,
    },
    daily_stats: dailyRows,
    retention_metrics: retentionMetrics,
    confusion_metrics: confusionMetrics,
    recovery_metrics: recoveryMetrics,
    insights,
    generated_at: new Date().toISOString(),
  };
}

// ─── retention / recovery metric ───────────────────────────────

interface RetentionObservation {
  correct: boolean;
  ts: string;
  due_ts_at_review: string | null;
  interval_days_at_review: number | null;
}

async function getRetentionObservations(
  userId: string,
  from: string,
  to: string
): Promise<RetentionObservation[]> {
  const { rows } = await pool.query<RetentionObservation>(
    `
    SELECT
      correct,
      ts::TEXT,
      due_ts_at_review::TEXT,
      interval_days_at_review
    FROM review_log
    WHERE user_id = $1
      AND ts::DATE BETWEEN $2::DATE AND $3::DATE
      AND due_ts_at_review IS NOT NULL
      AND interval_days_at_review IS NOT NULL
    ORDER BY ts ASC
    `,
    [userId, from, to]
  );

  return rows;
}

export function buildRetentionMetrics(rows: RetentionObservation[]): RetentionMetrics {
  const eligible = rows.filter((row) => isDueBasedReview(row));

  return {
    due_7d: computeRetentionBucketMetric(eligible, 7, 5, 9),
    due_14d: computeRetentionBucketMetric(eligible, 14, 10, 18),
    due_30d: computeRetentionBucketMetric(eligible, 30, 21, 45),
    overdue_adjusted_recall_rate: computeOverdueAdjustedRecallRate(eligible),
    total_eligible_reviews: eligible.length,
  };
}

export function computeRetentionBucketMetric(
  rows: RetentionObservation[],
  windowDays: number,
  minIntervalDays: number,
  maxIntervalDays: number
): RetentionBucketMetric {
  const bucket = rows.filter((row) => {
    const interval = row.interval_days_at_review ?? 0;
    return interval >= minIntervalDays && interval <= maxIntervalDays;
  });

  const correctCount = bucket.filter((row) => row.correct).length;
  const avgLateness = bucket.length > 0
    ? bucket.reduce((sum, row) => sum + latenessDays(row), 0) / bucket.length
    : 0;

  return {
    window_days: windowDays,
    eligible_count: bucket.length,
    correct_count: correctCount,
    recall_rate: bucket.length > 0 ? round2(correctCount / bucket.length) : 0,
    avg_lateness_days: round2(avgLateness),
  };
}

export function computeOverdueAdjustedRecallRate(rows: RetentionObservation[]): number {
  if (rows.length === 0) return 0;

  // 연체가 길수록 가중치를 낮춰 "늦게 맞힌 정답"의 과대평가를 줄인다.
  const totals = rows.reduce(
    (acc, row) => {
      const weight = 1 / (1 + Math.max(0, latenessDays(row)));
      acc.weightedTotal += weight;
      acc.weightedCorrect += row.correct ? weight : 0;
      return acc;
    },
    { weightedCorrect: 0, weightedTotal: 0 }
  );

  return totals.weightedTotal > 0 ? round2(totals.weightedCorrect / totals.weightedTotal) : 0;
}

export function buildRecoveryMetrics(
  rows: RetentionObservation[],
  dailyRows: DailyStats[],
  retentionMetrics: RetentionMetrics
): RecoveryMetrics {
  const eligible = rows.filter((row) => isDueBasedReview(row));
  const overdueRows = eligible.filter((row) => latenessDays(row) > 1);
  const onTimeRows = eligible.filter((row) => latenessDays(row) <= 1);

  const overdueBacklogDays = overdueRows.length > 0
    ? round2(overdueRows.reduce((sum, row) => sum + latenessDays(row), 0) / overdueRows.length)
    : 0;

  const recoveryCompletionRate = eligible.length > 0
    ? round2(onTimeRows.length / eligible.length)
    : 0;

  const recoveryTimeToNormalDays = estimateRecoveryTimeToNormalDays(dailyRows);
  const postRecoveryRetention = recoveryTimeToNormalDays !== null
    ? retentionMetrics.due_7d.recall_rate
    : null;

  return {
    overdue_backlog_days: overdueBacklogDays,
    recovery_completion_rate: recoveryCompletionRate,
    recovery_time_to_normal_days: recoveryTimeToNormalDays,
    post_recovery_retention: postRecoveryRetention,
  };
}

// ─── 인사이트 문장 생성 ───────────────────────────────────────

function buildInsights(data: {
  activeDays: number;
  avgCorrect: number;
  retentionMetrics: RetentionMetrics;
  overdueDays: number;
  confusionMetrics: ConfusionMetrics;
  recoveryMetrics: RecoveryMetrics;
  streakDays: number;
}): string[] {
  const insights: string[] = [];

  if (data.activeDays === 0) {
    insights.push('이번 주 학습 기록이 없습니다. 짧은 세션으로 다시 시작해 보세요.');
    return insights;
  }

  insights.push(`이번 주 ${data.activeDays}일 학습하셨습니다.`);

  // true OEC 중심 인사이트
  if (data.retentionMetrics.due_7d.eligible_count >= 3) {
    const pct = Math.round(data.retentionMetrics.due_7d.recall_rate * 100);
    if (pct >= 75) {
      insights.push(`7일 목표 간격 복습의 ${pct}%를 정확히 회상했습니다. 장기 기억 유지가 안정적입니다.`);
    } else if (pct >= 50) {
      insights.push(`7일 목표 간격 복습의 ${pct}%를 회상했습니다. 간격 유지와 추가 복습의 균형을 조정할 필요가 있습니다.`);
    } else {
      insights.push(`7일 목표 간격 복습의 ${pct}%만 회상했습니다. 현재 간격이 길거나 연체 영향이 클 수 있습니다.`);
    }
  }

  // 혼동쌍 감소
  if (data.confusionMetrics.top_confusions.length > 0) {
    const top = data.confusionMetrics.top_confusions[0];
    insights.push(`이번 주 가장 많이 틀린 항목은 '${top.surface}'입니다 (오류 유형: ${errorLabel(top.error_type)}).`);
  }

  // 연체 회복
  if (data.overdueDays >= 3) {
    insights.push(`${data.overdueDays}일 연체가 발생했습니다. 회복 플랜을 통해 복습 부담을 분산하겠습니다.`);
  }

  if (data.recoveryMetrics.recovery_completion_rate > 0) {
    const pct = Math.round(data.recoveryMetrics.recovery_completion_rate * 100);
    insights.push(`예정 시점에 가깝게 수행한 복습 비율은 ${pct}%입니다.`);
  }

  // 스트릭 (벌점이 아닌 긍정 메시지만)
  if (data.streakDays >= 3) {
    insights.push(`${data.streakDays}일 연속 학습 중입니다.`);
  }

  return insights;
}

// ─── 유틸 ────────────────────────────────────────────────────

function computeStreak(daily: DailyStats[]): number {
  const today = new Date().toISOString().slice(0, 10);
  let streak = 0;
  const sorted = [...daily].sort((a, b) => b.day.localeCompare(a.day));
  for (let i = 0; i < sorted.length; i++) {
    const expected = new Date();
    expected.setDate(expected.getDate() - i);
    const expectedStr = expected.toISOString().slice(0, 10);
    if (sorted[i]?.day === expectedStr && Number(sorted[i].reviews) > 0) {
      streak++;
    } else {
      break;
    }
  }
  void today;
  return streak;
}

function errorLabel(errorType: string): string {
  const map: Record<string, string> = {
    READING_CONFUSION: '읽기 혼동',
    FORM_SIMILAR: '형태 유사',
    MEANING_NEAR: '의미 혼동',
    NO_RECALL: '완전 망각',
    TYPO: '오타',
  };
  return map[errorType] ?? errorType;
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

function isDueBasedReview(row: RetentionObservation): boolean {
  if (!row.due_ts_at_review || row.interval_days_at_review == null) return false;
  return new Date(row.ts).getTime() >= new Date(row.due_ts_at_review).getTime();
}

function latenessDays(row: RetentionObservation): number {
  if (!row.due_ts_at_review) return 0;
  const latenessMs = new Date(row.ts).getTime() - new Date(row.due_ts_at_review).getTime();
  return Math.max(0, latenessMs / (1000 * 60 * 60 * 24));
}

function estimateRecoveryTimeToNormalDays(dailyRows: DailyStats[]): number | null {
  const latestOverdueIndex = dailyRows.reduce((latest, row, index) => {
    return Number(row.lateness_p50_sec) > 0 ? index : latest;
  }, -1);

  if (latestOverdueIndex === -1) return 0;

  for (let i = latestOverdueIndex + 1; i < dailyRows.length; i++) {
    if (Number(dailyRows[i].reviews) > 0 && Number(dailyRows[i].lateness_p50_sec) <= 0) {
      return i - latestOverdueIndex;
    }
  }

  return null;
}
