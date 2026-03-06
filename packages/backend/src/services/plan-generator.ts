/**
 * 개인화 학습 플랜 생성기 (HLR-lite + 규칙 믹서)
 *
 * HLR-lite 수식 (rules/report.mdc):
 *   p = 2^(-t / half_life)          — 회상확률 근사
 *   t_next = -half_life * log2(r*)  — 목표 유지율 r* 만족 간격
 *   맞으면: half_life *= 1.15
 *   틀리면: half_life *= 0.70
 *
 * 플랜 생성 흐름:
 * 1) strategy_vector 조회 (또는 진단 결과로부터 직접 수신)
 * 2) 룰 엔진으로 daily_budget + mix + ui_policy 생성
 * 3) HLR-lite로 카드별 우선순위 보완 (선택적, P1 고도화)
 * 4) plan_id + 결과 반환
 */

import { v4 as uuidv4 } from 'uuid';
import { computeStrategyVector, deriveWeaknessFlags, StrategyVector } from './strategy-analyzer';
import { applyRules, PlanConfig } from './rule-engine';
import { getVariant } from './experiment-service';

export interface PlanRequest {
  user_id: string;
  date: string;                          // YYYY-MM-DD
  goal: {
    target_level?: string;               // 'JLPT_N5' | 'JLPT_N4' | ...
    target_date?: string;
    focus?: string[];                    // ['READING', 'VOCAB', ...]
  };
  constraints: {
    daily_minutes: number;
    max_new?: number;
    offline_expected?: boolean;
  };
  analysis_result?: {
    strategy_vector?: StrategyVector;    // 클라이언트 제공 (진단 결과)
    retention_target?: number;           // 0.8 ~ 0.95
  };
}

export interface PlanResponse {
  plan_id: string;
  date: string;
  user_id: string;
  daily_budget: PlanConfig['daily_budget'];
  mix: PlanConfig['mix'];
  ui_policy: PlanConfig['ui_policy'];
  retention_target: number;
  notes: string[];
  experiment_variant?: string;   // P1-2: 어떤 실험 variant가 적용됐는지 투명하게 노출
  debug?: { rule_log: string[]; strategy_vector: StrategyVector };
}

/**
 * 일일 학습 플랜 생성
 */
export async function generatePlan(req: PlanRequest): Promise<PlanResponse> {
  const { user_id, date, constraints, goal, analysis_result } = req;

  // 1) strategy_vector 확정
  //    진단 결과가 있으면 사용, 없으면 review_log에서 계산
  let vector: StrategyVector;
  if (analysis_result?.strategy_vector) {
    vector = analysis_result.strategy_vector;
  } else {
    const profile = await computeStrategyVector(user_id, 28);
    vector = profile.vector;
  }

  const flags = deriveWeaknessFlags(vector);

  // 2) 레벨 추정
  const level = inferLevel(goal.target_level);

  // 3) 목표 유지율 확정
  const retention_target = analysis_result?.retention_target
    ?? (level === 'beginner' ? 0.85 : 0.90);

  // 4) 룰 엔진 실행
  const config = applyRules({
    vector,
    flags,
    daily_minutes: Math.max(5, Math.min(120, constraints.daily_minutes)),
    retention_target,
    level,
    max_new_override: constraints.max_new,
  });

  // 5) P1-2: 실험 variant 조회 및 믹스 오버라이드
  //    ab_plan_mix treatment: SURFACE_TO_READING +10%p (다른 비중 감산으로 정규화)
  const experimentVariant = await getVariant(user_id, 'ab_plan_mix').catch(() => 'not_in_experiment');
  let finalMix = { ...config.mix };
  const experimentNotes: string[] = [];

  if (experimentVariant === 'treatment') {
    const delta = 0.10;
    const before = finalMix.SURFACE_TO_READING ?? 0;
    finalMix.SURFACE_TO_READING = Math.min(1, before + delta);

    // 증가분을 SURFACE_TO_MEANING에서 차감 (합계 1.0 유지)
    const excess = finalMix.SURFACE_TO_READING - before;
    finalMix.SURFACE_TO_MEANING = Math.max(0, (finalMix.SURFACE_TO_MEANING ?? 0) - excess);

    // 재정규화 (소수점 오차 보정)
    const total = Object.values(finalMix).reduce((a, b) => a + b, 0);
    if (total > 0) {
      for (const key of Object.keys(finalMix) as Array<keyof typeof finalMix>) {
        finalMix[key] = Math.round((finalMix[key] / total) * 1000) / 1000;
      }
    }

    experimentNotes.push('[실험] ab_plan_mix treatment: 표기→읽기 비중 +10%p 적용');
  }

  const plan_id = `plan_${date.replace(/-/g, '')}_${uuidv4().slice(0, 8)}`;

  return {
    plan_id,
    date,
    user_id,
    daily_budget: config.daily_budget,
    mix: finalMix,
    ui_policy: config.ui_policy,
    retention_target: config.retention_target,
    notes: [...config.notes, ...experimentNotes],
    experiment_variant: experimentVariant !== 'not_in_experiment' ? experimentVariant : undefined,
    debug: {
      rule_log: config.rule_log,
      strategy_vector: vector,
    },
  };
}

// ─── HLR-lite 유틸 ───────────────────────────────────────────

/**
 * 현재 시점에서의 회상확률 계산
 * p = 2^(-t / half_life)
 *
 * @param halfLifeDays  반감기(일)
 * @param elapsedDays   마지막 복습 이후 경과(일)
 */
export function recallProbability(halfLifeDays: number, elapsedDays: number): number {
  if (halfLifeDays <= 0) return 0;
  return Math.pow(2, -elapsedDays / halfLifeDays);
}

/**
 * 목표 유지율을 만족하는 다음 복습 간격 계산
 * t_next = -half_life * log2(r*)
 *
 * @param halfLifeDays  현재 반감기(일)
 * @param retentionTarget  목표 회상확률 (0~1)
 */
export function nextInterval(halfLifeDays: number, retentionTarget: number): number {
  if (halfLifeDays <= 0 || retentionTarget <= 0 || retentionTarget >= 1) return 1;
  return Math.max(1, -halfLifeDays * Math.log2(retentionTarget));
}

/**
 * 복습 결과에 따른 반감기 업데이트
 */
export function updateHalfLife(
  currentHalfLife: number,
  correct: boolean,
  hintLevel = 0
): number {
  const MIN_HALF_LIFE = 0.5; // 최소 0.5일
  const MAX_HALF_LIFE = 365; // 최대 1년

  let multiplier = correct ? 1.15 : 0.70;

  // 힌트를 많이 사용했으면 증가 폭 제한
  if (correct && hintLevel >= 2) multiplier = 1.05;

  return Math.min(MAX_HALF_LIFE, Math.max(MIN_HALF_LIFE, currentHalfLife * multiplier));
}

// ─── 레벨 추정 ───────────────────────────────────────────────

function inferLevel(
  targetLevel?: string
): 'beginner' | 'intermediate' | 'advanced' {
  if (!targetLevel) return 'beginner';
  const level = targetLevel.toUpperCase();
  if (level.includes('N5') || level.includes('N4')) return 'beginner';
  if (level.includes('N3') || level.includes('N2')) return 'intermediate';
  return 'advanced';
}
