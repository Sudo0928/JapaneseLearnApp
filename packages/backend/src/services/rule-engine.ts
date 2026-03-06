/**
 * 초기 설정값 룰 엔진 (Sprint 4-3)
 *
 * 규칙 출처 (rules/report.mdc — 초기 설정값 산출 룰):
 *   R1: 회상 정확도 − 인지 정확도 ≥ 15%p → 회상 취약: 인지 비중 +10%p (1주), 2주차에 복귀
 *   R2: 읽기 RT 상위 30% & 읽기 오류 다발 → 표기→읽기 비중 +20%p
 *   R3: 형태 오류 다발 & 부하 플래그 false → 미니 쓰기 투입 (세션당 1-2문항)
 *
 * 중요: 이 룰은 "사용자 스타일(선호)"이 아니라 "성능/부하" 기반이다.
 */

import { StrategyVector, WeaknessFlags } from './strategy-analyzer';

// ─── 타입 정의 ───────────────────────────────────────────────

export interface PromptMix {
  SURFACE_TO_MEANING: number;
  MEANING_TO_SURFACE: number;
  SURFACE_TO_READING: number;
  MCQ: number;
  CLOZE: number;
  LISTENING: number;
}

export interface UIPolicy {
  hint_steps: number;               // 최대 힌트 단계 (1~3)
  show_example_by_default: boolean; // 예문 기본 노출 여부
  mini_handwriting: boolean;        // 미니 쓰기 문항 투입 여부
  session_chunk_min: number;        // 세션 단위(분). 부하 민감 시 5분
}

export interface DailyBudget {
  minutes: number;
  new_count: number;
  review_count: number;
  error_drill_count: number;
}

export interface PlanConfig {
  retention_target: number;
  daily_budget: DailyBudget;
  mix: PromptMix;
  ui_policy: UIPolicy;
  notes: string[];
  rule_log: string[];  // 어떤 룰이 발동됐는지 감사 기록
}

// ─── 기본 믹스 (페르소나별 초기값) ─────────────────────────

const BASE_MIX_BEGINNER: PromptMix = {
  SURFACE_TO_MEANING: 0.40,
  MEANING_TO_SURFACE: 0.10,
  SURFACE_TO_READING: 0.25,
  MCQ: 0.20,
  CLOZE: 0.05,
  LISTENING: 0.00,
};

const BASE_MIX_INTERMEDIATE: PromptMix = {
  SURFACE_TO_MEANING: 0.30,
  MEANING_TO_SURFACE: 0.15,
  SURFACE_TO_READING: 0.25,
  MCQ: 0.15,
  CLOZE: 0.10,
  LISTENING: 0.05,
};

const BASE_MIX_ADVANCED: PromptMix = {
  SURFACE_TO_MEANING: 0.20,
  MEANING_TO_SURFACE: 0.25,
  SURFACE_TO_READING: 0.20,
  MCQ: 0.10,
  CLOZE: 0.15,
  LISTENING: 0.10,
};

// ─── 룰 엔진 ─────────────────────────────────────────────────

export interface RuleEngineInput {
  vector: StrategyVector;
  flags: WeaknessFlags;
  daily_minutes: number;
  retention_target: number;
  level: 'beginner' | 'intermediate' | 'advanced';
  max_new_override?: number;
}

/**
 * 취약 플래그와 전략 벡터를 기반으로 개인화된 플랜 설정값을 생성한다.
 */
export function applyRules(input: RuleEngineInput): PlanConfig {
  const { vector, flags, daily_minutes, retention_target, level } = input;
  const notes: string[] = [];
  const rule_log: string[] = [];

  // ─── 기본 믹스 선택 ───────────────────────────────────────
  let mix: PromptMix = {
    ...(level === 'beginner'
      ? BASE_MIX_BEGINNER
      : level === 'advanced'
      ? BASE_MIX_ADVANCED
      : BASE_MIX_INTERMEDIATE),
  };

  // ─── 기본 예산 ────────────────────────────────────────────
  const baseNewPerMin = level === 'beginner' ? 0.4 : level === 'intermediate' ? 0.5 : 0.6;
  let new_count = input.max_new_override
    ?? Math.min(Math.round(daily_minutes * baseNewPerMin), level === 'beginner' ? 6 : 10);
  let review_count = Math.min(
    Math.round(daily_minutes * 2),
    level === 'beginner' ? 40 : level === 'intermediate' ? 70 : 110
  );
  let error_drill_count = Math.max(0, Math.round(review_count * 0.1));
  let hint_steps = 2;
  let mini_handwriting = false;
  let session_chunk_min = 20;

  // ─── R1: 회상 취약 규칙 ──────────────────────────────────
  // 회상 정확도 − 인지 정확도 ≥ 15%p → 인지 비중 +10%p
  if (flags.recall_weak && vector.recall_gap >= 0.15) {
    const shift = 0.10;
    mix = adjustMix(mix, 'MCQ', +shift, 'SURFACE_TO_MEANING', -shift);
    notes.push('회상 취약이 감지되어 선택형(MCQ) 비중을 일시 상향했습니다. 2주차에 회상 비중이 복귀됩니다.');
    rule_log.push(`R1_RECALL_WEAK: recall_gap=${vector.recall_gap}, MCQ +${shift}`);
  }

  // ─── R2: 읽기 취약 규칙 ──────────────────────────────────
  // 읽기 RT 상위 30% & 읽기 오류 다발 → 표기→읽기 비중 +20%p
  if (flags.reading_weak && vector.reading_weak >= 0.5) {
    const shift = 0.20;
    mix = adjustMix(mix, 'SURFACE_TO_READING', +shift, 'SURFACE_TO_MEANING', -shift);
    notes.push('읽기 혼동이 높아 표기→읽기 리콜 비중을 상향했습니다.');
    rule_log.push(`R2_READING_WEAK: reading_weak=${vector.reading_weak}, SURFACE_TO_READING +${shift}`);
  }

  // ─── R3: 형태 취약 규칙 ──────────────────────────────────
  // 형태 오류 다발 & 부하 민감하지 않을 때 → 미니 쓰기 투입
  if (flags.form_weak && !flags.load_sensitive) {
    mini_handwriting = true;
    notes.push('형태(표기) 취약이 감지되었습니다. 세션당 1-2문항의 미니 쓰기를 투입합니다.');
    rule_log.push(`R3_FORM_WEAK: form_weak=${vector.form_weak}, mini_handwriting=true`);
  }

  // ─── 연체 위험 규칙: 신규 감산 + 예산 분산 ──────────────
  if (flags.lateness_risk) {
    new_count = Math.max(0, Math.round(new_count * 0.7));
    review_count = Math.min(review_count, 30);
    notes.push('연체 위험이 있어 신규 카드를 줄이고 복습 상한을 분산했습니다.');
    rule_log.push(`R4_LATENESS_RISK: lateness_fragile=${vector.lateness_fragile}, new_count*=0.7`);
  }

  // ─── 부하 민감 규칙: 세션 단위 축소 ─────────────────────
  if (flags.load_sensitive) {
    hint_steps = Math.min(hint_steps, 1);
    session_chunk_min = 5;
    notes.push('인지부하 민감 패턴이 감지되었습니다. 세션을 5분 단위로 나눕니다.');
    rule_log.push(`R5_LOAD_SENSITIVE: load_sensitive=${vector.load_sensitive}, chunk=5min`);
  }

  // ─── 믹스 정규화 (합 = 1.0 보장) ────────────────────────
  mix = normalizeMix(mix);

  return {
    retention_target,
    daily_budget: {
      minutes: daily_minutes,
      new_count,
      review_count,
      error_drill_count,
    },
    mix,
    ui_policy: {
      hint_steps,
      show_example_by_default: false,
      mini_handwriting,
      session_chunk_min,
    },
    notes,
    rule_log,
  };
}

// ─── 믹스 조정 유틸 ──────────────────────────────────────────

function adjustMix(
  mix: PromptMix,
  increaseKey: keyof PromptMix,
  delta: number,
  decreaseKey: keyof PromptMix,
  deltaNeg: number
): PromptMix {
  const next = { ...mix };
  next[increaseKey] = Math.min(1, next[increaseKey] + delta);
  next[decreaseKey] = Math.max(0, next[decreaseKey] + deltaNeg);
  return next;
}

function normalizeMix(mix: PromptMix): PromptMix {
  const total = Object.values(mix).reduce((s, v) => s + v, 0);
  if (total === 0) return mix;
  const result = {} as PromptMix;
  for (const key of Object.keys(mix) as (keyof PromptMix)[]) {
    result[key] = Math.round((mix[key] / total) * 100) / 100;
  }
  return result;
}
