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

export interface DelayedRecallEstimate {
  // 7일 전 학습 항목 중 오늘도 정답을 맞힌 비율 (지연 인출 근사치)
  items_7d_ago: number;
  recalled_today: number;
  recall_rate: number;
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
  delayed_recall: DelayedRecallEstimate;
  top_confusions: { surface: string; error_type: string; error_count: number }[];
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
      COUNT(*) FILTER (WHERE cs.repetitions = 0) AS new_cards,
      ROUND(AVG(CASE WHEN rl.correct THEN 1.0 ELSE 0.0 END)::NUMERIC, 3) AS correct_rate,
      COALESCE(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY rl.rt_ms)::INTEGER, 0) AS p50_rt_ms,
      COALESCE(PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY rl.rt_ms)::INTEGER, 0) AS p90_rt_ms,
      COALESCE(
        PERCENTILE_CONT(0.5) WITHIN GROUP (
          ORDER BY EXTRACT(EPOCH FROM (rl.ts - cs.due_ts))
        ), 0
      ) AS lateness_p50_sec
    FROM review_log rl
    LEFT JOIN card_state cs ON cs.user_id = rl.user_id AND cs.card_id = rl.card_id
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

  // ─── 3) 지연 인출 추정 ───────────────────────────────────
  // 7일 전에 복습한 카드 중 오늘도 정답을 맞힌 비율
  const delayedRecall = await estimateDelayedRecall(userId);

  // ─── 4) 혼동쌍 top-5 ─────────────────────────────────────
  const confusions = await getCachedConfusionPairs(userId, 7);
  const topConfusions = confusions.slice(0, 5).map((c) => ({
    surface: c.surface,
    error_type: c.error_type,
    error_count: c.error_count,
  }));

  // ─── 5) 인사이트 생성 (설명 가능한 3~5문장) ─────────────
  const insights = buildInsights({
    activeDays: activeDays.length,
    avgCorrect,
    delayedRecall,
    overdueDays,
    topConfusions,
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
    delayed_recall: delayedRecall,
    top_confusions: topConfusions,
    insights,
    generated_at: new Date().toISOString(),
  };
}

// ─── 지연 인출 추정 ───────────────────────────────────────────

async function estimateDelayedRecall(userId: string): Promise<DelayedRecallEstimate> {
  // 7~10일 전에 처음 복습했던 카드 중 최근 3일 내에도 정답을 맞힌 카드 비율
  const { rows } = await pool.query<{
    items_7d_ago: string;
    recalled_today: string;
  }>(
    `
    WITH cards_7d_ago AS (
      SELECT DISTINCT card_id
      FROM review_log
      WHERE user_id = $1
        AND ts BETWEEN NOW() - INTERVAL '10 days' AND NOW() - INTERVAL '7 days'
        AND correct = true
    ),
    recalled AS (
      SELECT DISTINCT rl.card_id
      FROM review_log rl
      JOIN cards_7d_ago c ON c.card_id = rl.card_id
      WHERE rl.user_id = $1
        AND rl.ts >= NOW() - INTERVAL '3 days'
        AND rl.correct = true
    )
    SELECT
      (SELECT COUNT(*) FROM cards_7d_ago) AS items_7d_ago,
      (SELECT COUNT(*) FROM recalled) AS recalled_today
    `,
    [userId]
  );

  const items = Number(rows[0]?.items_7d_ago ?? 0);
  const recalled = Number(rows[0]?.recalled_today ?? 0);

  return {
    items_7d_ago: items,
    recalled_today: recalled,
    recall_rate: items > 0 ? round2(recalled / items) : 0,
  };
}

// ─── 인사이트 문장 생성 ───────────────────────────────────────

function buildInsights(data: {
  activeDays: number;
  avgCorrect: number;
  delayedRecall: DelayedRecallEstimate;
  overdueDays: number;
  topConfusions: { surface: string; error_type: string }[];
  streakDays: number;
}): string[] {
  const insights: string[] = [];

  if (data.activeDays === 0) {
    insights.push('이번 주 학습 기록이 없습니다. 짧은 세션으로 다시 시작해 보세요.');
    return insights;
  }

  insights.push(`이번 주 ${data.activeDays}일 학습하셨습니다.`);

  // 지연 인출 중심 OEC
  if (data.delayedRecall.items_7d_ago >= 5) {
    const pct = Math.round(data.delayedRecall.recall_rate * 100);
    if (pct >= 75) {
      insights.push(`7일 전 학습 항목의 ${pct}%를 오늘도 정확히 기억했습니다. 장기 기억이 잘 형성되고 있습니다.`);
    } else if (pct >= 50) {
      insights.push(`7일 전 학습 항목의 ${pct}%를 오늘 기억했습니다. 복습 빈도를 높이면 유지율이 올라갑니다.`);
    } else {
      insights.push(`7일 전 학습 항목의 ${pct}%만 기억했습니다. 오늘 복습을 집중적으로 진행하는 것을 권장합니다.`);
    }
  }

  // 혼동쌍 감소
  if (data.topConfusions.length > 0) {
    const top = data.topConfusions[0];
    insights.push(`이번 주 가장 많이 틀린 항목은 '${top.surface}'입니다 (오류 유형: ${errorLabel(top.error_type)}).`);
  }

  // 연체 회복
  if (data.overdueDays >= 3) {
    insights.push(`${data.overdueDays}일 연체가 발생했습니다. 회복 플랜을 통해 복습 부담을 분산하겠습니다.`);
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
