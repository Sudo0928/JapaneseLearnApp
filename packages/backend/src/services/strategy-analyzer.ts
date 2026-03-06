/**
 * 전략 벡터(strategy_vector) 분석 서비스
 *
 * 설계 원칙 (rules/report.mdc):
 * - 분류 축은 "학습 스타일(선호)" 기반이 아니라 "성과/부하" 기반이다.
 * - 행동 데이터(정확도, RT, 힌트, 오류 유형, 연체)로만 개인차를 다룬다.
 *
 * 분류 축:
 * 1) recall_gap       : 회상형(입력) vs 인지형(선택) 성과 차이
 * 2) reading_weak     : 읽기(SURFACE_TO_READING) 취약도
 * 3) form_weak        : 형태(MEANING_TO_SURFACE) 취약도
 * 4) lateness_fragile : 연체 시 성과 붕괴 정도
 * 5) load_sensitive   : 인지부하 민감도 (RT 상승·힌트 사용)
 *
 * 전처리 규칙:
 * - RT: log(1 + rt_ms) 변환 + 상위 0.5% 윈저라이징
 * - lateness: 삭제하지 않고 별도 피처로 유지
 * - 일본어 입력 정규화: TYPO vs READING_CONFUSION 분리
 */

import { pool } from '../db/pool';

export interface StrategyVector {
  recall_gap: number;        // 0~1: 높을수록 회상 취약
  reading_weak: number;      // 0~1: 높을수록 읽기 취약
  form_weak: number;         // 0~1: 높을수록 형태 취약
  lateness_fragile: number;  // 0~1: 높을수록 연체 시 성과 붕괴
  load_sensitive: number;    // 0~1: 높을수록 인지부하 민감
}

export interface WeaknessFlags {
  recall_weak: boolean;     // recall_gap >= 0.15
  reading_weak: boolean;    // reading_weak >= 0.5
  form_weak: boolean;       // form_weak >= 0.5
  lateness_risk: boolean;   // lateness_fragile >= 0.4
  load_sensitive: boolean;  // load_sensitive >= 0.5
  [key: string]: boolean;   // 인덱스 시그니처 (Record<string, boolean> 호환)
}

export interface StrategyProfile {
  vector: StrategyVector;
  flags: WeaknessFlags;
  computed_at: string;
  event_count: number;
}

// ─── RT 전처리 유틸 ──────────────────────────────────────────

function logTransform(rt: number): number {
  return Math.log(1 + rt);
}

function winsorize(values: number[], pct = 0.005): number[] {
  if (values.length === 0) return values;
  const sorted = [...values].sort((a, b) => a - b);
  const lo = sorted[Math.floor(values.length * pct)] ?? sorted[0];
  const hi = sorted[Math.floor(values.length * (1 - pct))] ?? sorted[sorted.length - 1];
  return values.map((v) => Math.min(Math.max(v, lo), hi));
}

// ─── 분석 쿼리 ───────────────────────────────────────────────

interface RawRow {
  prompt_type: string;
  correct: boolean;
  rt_ms: number;
  hint_level: number;
  error_type: string;
  lateness_sec: number | null;
}

/**
 * review_log 기반 strategy_vector 계산
 *
 * @param userId  대상 사용자 ID
 * @param days    분석 기간(일). 기본 28일
 */
export async function computeStrategyVector(
  userId: string,
  days = 28
): Promise<StrategyProfile> {
  const { rows } = await pool.query<RawRow>(
    `
    SELECT
      rl.prompt_type,
      rl.correct,
      rl.rt_ms,
      rl.hint_level,
      rl.error_type,
      EXTRACT(EPOCH FROM (rl.ts - cs.due_ts)) AS lateness_sec
    FROM review_log rl
    LEFT JOIN card_state cs ON cs.user_id = rl.user_id AND cs.card_id = rl.card_id
    WHERE rl.user_id = $1
      AND rl.ts >= NOW() - ($2 || ' days')::INTERVAL
    ORDER BY rl.ts DESC
    `,
    [userId, days]
  );

  const n = rows.length;

  if (n < 5) {
    // 데이터 부족 → 기본값 반환
    return defaultStrategyProfile(n);
  }

  // ─── 1) 회상-인지 격차 ──────────────────────────────────────
  const recallTypes = new Set(['SURFACE_TO_MEANING', 'MEANING_TO_SURFACE', 'SURFACE_TO_READING']);
  const cogTypes = new Set(['MCQ', 'CLOZE', 'LISTENING']);

  const recallRows = rows.filter((r) => recallTypes.has(r.prompt_type));
  const cogRows = rows.filter((r) => cogTypes.has(r.prompt_type));

  const recallAcc = accuracy(recallRows);
  const cogAcc = accuracy(cogRows);
  // recall_gap: 회상이 인지보다 낮은 정도 (음수면 인지가 더 낮음)
  const recall_gap = cogRows.length >= 3
    ? Math.max(0, cogAcc - recallAcc)
    : 0;

  // ─── 2) 읽기 취약도 ─────────────────────────────────────────
  const readingRows = rows.filter((r) => r.prompt_type === 'SURFACE_TO_READING');
  const readingAcc = accuracy(readingRows);
  const readingRtP90 = percentile(
    winsorize(readingRows.map((r) => logTransform(r.rt_ms))),
    0.9
  );
  const globalRtP70 = percentile(
    winsorize(rows.map((r) => logTransform(r.rt_ms))),
    0.7
  );
  // 읽기 정확도 낮거나 RT 상위 30%이면 취약
  const reading_weak = readingRows.length >= 3
    ? clamp01(
        (1 - readingAcc) * 0.6 +
        (readingRtP90 > globalRtP70 ? 0.4 : 0)
      )
    : 0;

  // ─── 3) 형태 취약도 ─────────────────────────────────────────
  const formRows = rows.filter((r) => r.prompt_type === 'MEANING_TO_SURFACE');
  const formAcc = accuracy(formRows);
  const formErrors = formRows.filter((r) =>
    ['FORM_SIMILAR', 'NO_RECALL'].includes(r.error_type)
  ).length;
  const form_weak = formRows.length >= 3
    ? clamp01((1 - formAcc) * 0.7 + (formErrors / Math.max(formRows.length, 1)) * 0.3)
    : 0;

  // ─── 4) 연체 탄력성 ─────────────────────────────────────────
  const lateRows = rows.filter((r) => (r.lateness_sec ?? 0) > 86400); // 1일 이상 연체
  const lateAcc = accuracy(lateRows);
  const onTimeAcc = accuracy(rows.filter((r) => (r.lateness_sec ?? 0) <= 86400));
  const lateness_fragile = lateRows.length >= 3
    ? clamp01(Math.max(0, onTimeAcc - lateAcc))
    : 0;

  // ─── 5) 부하 민감도 ─────────────────────────────────────────
  const hintUsageRate = rows.filter((r) => r.hint_level > 0).length / n;
  const allRtLog = winsorize(rows.map((r) => logTransform(r.rt_ms)));
  const p50 = percentile(allRtLog, 0.5);
  const p90 = percentile(allRtLog, 0.9);
  // RT 분산이 크거나 힌트 사용률 높으면 부하 민감
  const rtSpread = p50 > 0 ? (p90 - p50) / p50 : 0;
  const load_sensitive = clamp01(hintUsageRate * 0.5 + rtSpread * 0.5);

  const vector: StrategyVector = {
    recall_gap: round2(recall_gap),
    reading_weak: round2(reading_weak),
    form_weak: round2(form_weak),
    lateness_fragile: round2(lateness_fragile),
    load_sensitive: round2(load_sensitive),
  };

  const flags = deriveWeaknessFlags(vector);

  return { vector, flags, computed_at: new Date().toISOString(), event_count: n };
}

export function deriveWeaknessFlags(v: StrategyVector): WeaknessFlags {
  return {
    recall_weak: v.recall_gap >= 0.15,
    reading_weak: v.reading_weak >= 0.5,
    form_weak: v.form_weak >= 0.5,
    lateness_risk: v.lateness_fragile >= 0.4,
    load_sensitive: v.load_sensitive >= 0.5,
  };
}

// ─── 유틸 ────────────────────────────────────────────────────

function accuracy(rows: { correct: boolean }[]): number {
  if (rows.length === 0) return 1;
  return rows.filter((r) => r.correct).length / rows.length;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.floor(sorted.length * p);
  return sorted[Math.min(idx, sorted.length - 1)];
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

function defaultStrategyProfile(eventCount: number): StrategyProfile {
  return {
    vector: {
      recall_gap: 0,
      reading_weak: 0,
      form_weak: 0,
      lateness_fragile: 0,
      load_sensitive: 0,
    },
    flags: {
      recall_weak: false,
      reading_weak: false,
      form_weak: false,
      lateness_risk: false,
      load_sensitive: false,
    },
    computed_at: new Date().toISOString(),
    event_count: eventCount,
  };
}
