import { v4 as uuidv4 } from 'uuid';
import type {
  PlanExplanationReceipt,
  PlanResponse as ApiPlanResponse,
  RecoveryPlan,
} from '@japanese-learn/shared';
import { pool } from '../db/pool';
import { computeStrategyVector, deriveWeaknessFlags, StrategyVector } from './strategy-analyzer';
import { applyRules, PlanConfig } from './rule-engine';
import { getVariant } from './experiment-service';

export interface PlanRequest {
  user_id: string;
  date: string;
  goal: {
    target_level?: string;
    target_date?: string;
    focus?: string[];
  };
  constraints: {
    daily_minutes: number;
    max_new?: number;
    offline_expected?: boolean;
  };
  analysis_result?: {
    strategy_vector?: StrategyVector;
    retention_target?: number;
  };
}

export interface PlanResponse extends ApiPlanResponse {
  debug?: { rule_log: string[]; strategy_vector: StrategyVector };
}

type PlanMixRecord = PlanConfig['mix'];

export async function generatePlan(req: PlanRequest): Promise<PlanResponse> {
  const { user_id, date, constraints, goal, analysis_result } = req;
  const level = inferLevel(goal.target_level);
  const diagnosisVector = analysis_result?.strategy_vector ?? await loadLatestDiagnosisVector(user_id);
  const behaviorProfile = await computeStrategyVector(user_id, 28);
  const hasBehaviorBlend = behaviorProfile.event_count >= 10;

  let vector = diagnosisVector
    ? blendVectors(diagnosisVector, behaviorProfile.vector, hasBehaviorBlend ? 0.6 : 1)
    : behaviorProfile.vector;

  vector = {
    ...vector,
    lateness_fragile: hasBehaviorBlend ? round3(behaviorProfile.vector.lateness_fragile ?? 0) : 0,
  };

  const flags = deriveWeaknessFlags(vector);
  let retentionTarget = analysis_result?.retention_target
    ?? (level === 'beginner' ? 0.85 : level === 'intermediate' ? 0.89 : 0.92);
  const explanationReceipt: PlanExplanationReceipt[] = [];

  const config = applyRules({
    vector,
    flags,
    daily_minutes: Math.max(5, Math.min(120, constraints.daily_minutes)),
    retention_target: retentionTarget,
    level,
    max_new_override: constraints.max_new,
  });

  if (hasBehaviorBlend) {
    explanationReceipt.push({
      factor: 'behavior_blend',
      basis: 'behavior',
      evidence: `recent_review_events=${behaviorProfile.event_count}`,
      effect: 'Behavior data contributes to the final strategy vector and keeps lateness risk behavior-only.',
    });
  }

  applyGoalAwareAdjustments({
    goal,
    constraints,
    config,
    receipt: explanationReceipt,
    retentionTargetRef: (value) => {
      retentionTarget = value;
    },
  });

  const experimentVariant = await getVariant(user_id, 'ab_plan_mix').catch(() => 'not_in_experiment');
  if (experimentVariant === 'treatment') {
    config.mix = shiftMix(config.mix, 'SURFACE_TO_READING', 0.1, 'SURFACE_TO_MEANING');
    config.notes.push('Experiment treatment increases reading prompts by 10 percentage points.');
    explanationReceipt.push({
      factor: 'ab_plan_mix',
      basis: 'behavior',
      evidence: 'variant=treatment',
      effect: 'SURFACE_TO_READING share increased by 10 percentage points for experiment exposure.',
    });
  }

  pushWeaknessReceipts(vector, flags, explanationReceipt);

  const overdueCount = await getOverdueCount(user_id);
  const recoveryPlan = buildRecoveryPlan(overdueCount, config.daily_budget.minutes);
  if (recoveryPlan?.active) {
    explanationReceipt.push({
      factor: 'recovery_plan',
      basis: 'recovery',
      evidence: `overdue_cards=${overdueCount}`,
      effect: recoveryPlan.summary,
    });
  }

  const plan_id = `plan_${date.replace(/-/g, '')}_${uuidv4().slice(0, 8)}`;

  return {
    plan_id,
    date,
    user_id,
    daily_budget: config.daily_budget,
    mix: normalizeMix(config.mix),
    ui_policy: config.ui_policy,
    retention_target: round3(retentionTarget),
    notes: [...config.notes],
    experiment_variant: experimentVariant !== 'not_in_experiment' ? experimentVariant : undefined,
    explanation_receipt: explanationReceipt,
    recovery_plan: recoveryPlan,
    debug: {
      rule_log: config.rule_log,
      strategy_vector: vector,
    },
  };
}

export function recallProbability(halfLifeDays: number, elapsedDays: number): number {
  if (halfLifeDays <= 0) return 0;
  return Math.pow(2, -elapsedDays / halfLifeDays);
}

export function nextInterval(halfLifeDays: number, retentionTarget: number): number {
  if (halfLifeDays <= 0 || retentionTarget <= 0 || retentionTarget >= 1) return 1;
  return Math.max(1, -halfLifeDays * Math.log2(retentionTarget));
}

export function updateHalfLife(
  currentHalfLife: number,
  correct: boolean,
  hintLevel = 0,
): number {
  const minHalfLife = 0.5;
  const maxHalfLife = 365;
  let multiplier = correct ? 1.15 : 0.7;
  if (correct && hintLevel >= 2) multiplier = 1.05;
  return Math.min(maxHalfLife, Math.max(minHalfLife, currentHalfLife * multiplier));
}

function inferLevel(targetLevel?: string): 'beginner' | 'intermediate' | 'advanced' {
  if (!targetLevel) return 'beginner';
  const level = targetLevel.toUpperCase();
  if (level.includes('N5') || level.includes('N4')) return 'beginner';
  if (level.includes('N3') || level.includes('N2')) return 'intermediate';
  return 'advanced';
}

async function loadLatestDiagnosisVector(userId: string): Promise<StrategyVector | null> {
  const { rows } = await pool.query<{ strategy_vector: StrategyVector }>(
    `
    SELECT strategy_vector
    FROM diagnosis_results
    WHERE user_id = $1
    ORDER BY completed_at DESC
    LIMIT 1
    `,
    [userId],
  );

  return rows[0]?.strategy_vector ?? null;
}

async function getOverdueCount(userId: string): Promise<number> {
  const { rows } = await pool.query<{ count: string }>(
    `
    SELECT COUNT(*)::TEXT AS count
    FROM card_state
    WHERE user_id = $1
      AND state IN ('learning', 'review', 'relearning')
      AND due_ts < NOW() - INTERVAL '1 day'
    `,
    [userId],
  );

  return Number(rows[0]?.count ?? 0);
}

export function applyGoalAwareAdjustments(input: {
  goal: PlanRequest['goal'];
  constraints: PlanRequest['constraints'];
  config: PlanConfig;
  receipt: PlanExplanationReceipt[];
  retentionTargetRef: (value: number) => void;
}): void {
  const { goal, constraints, config, receipt, retentionTargetRef } = input;

  if (goal.target_date) {
    const daysToTarget = Math.ceil((new Date(goal.target_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (daysToTarget > 0 && daysToTarget <= 30) {
      const previousReviewCount = config.daily_budget.review_count;
      const previousNewCount = config.daily_budget.new_count;
      retentionTargetRef(round3(config.retention_target + 0.03));
      config.daily_budget.review_count = Math.round(config.daily_budget.review_count * 1.2);
      config.daily_budget.new_count = Math.max(0, Math.round(config.daily_budget.new_count * 0.8));
      receipt.push({
        factor: 'target_date',
        basis: 'goal',
        evidence: `days_to_target=${daysToTarget}`,
        effect: 'Retention target +0.03, review budget +20%, new cards -20%.',
        counterfactual: `Without target_date, review_count would stay ${previousReviewCount} and new_count would stay ${previousNewCount}.`,
      });
      config.notes.push('The target date is close, so review load increased and new cards were reduced.');
    }
  }

  const focus = new Set(goal.focus ?? []);
  if (focus.has('READING')) {
    const previousShare = round3(config.mix.SURFACE_TO_READING);
    config.mix = shiftMix(config.mix, 'SURFACE_TO_READING', 0.15, 'SURFACE_TO_MEANING');
    receipt.push({
      factor: 'focus_reading',
      basis: 'goal',
      evidence: 'goal.focus includes READING',
      effect: 'SURFACE_TO_READING share increased by 15 percentage points.',
      counterfactual: `Without READING focus, SURFACE_TO_READING would stay ${Math.round(previousShare * 100)}%.`,
    });
  }

  if (focus.has('VOCAB') || focus.has('PRODUCTION')) {
    const previousShare = round3(config.mix.MEANING_TO_SURFACE);
    config.mix = shiftMix(config.mix, 'MEANING_TO_SURFACE', 0.1, 'MCQ');
    receipt.push({
      factor: 'focus_production',
      basis: 'goal',
      evidence: `goal.focus=${[...focus].join(',')}`,
      effect: 'MEANING_TO_SURFACE share increased by 10 percentage points.',
      counterfactual: `Without VOCAB/PRODUCTION focus, MEANING_TO_SURFACE would stay ${Math.round(previousShare * 100)}%.`,
    });
  }

  if (constraints.offline_expected) {
    const previousChunk = config.ui_policy.session_chunk_min;
    const previousNewCount = config.daily_budget.new_count;
    config.ui_policy.session_chunk_min = Math.min(config.ui_policy.session_chunk_min, 10);
    config.daily_budget.new_count = Math.max(0, Math.round(config.daily_budget.new_count * 0.9));
    receipt.push({
      factor: 'offline_expected',
      basis: 'goal',
      evidence: 'constraints.offline_expected=true',
      effect: 'Session chunk capped at 10 minutes and new cards reduced by 10%.',
      counterfactual: `Without offline_expected, session_chunk_min would stay ${previousChunk} and new_count would stay ${previousNewCount}.`,
    });
  }
}

function pushWeaknessReceipts(
  vector: StrategyVector,
  flags: Record<string, boolean>,
  receipt: PlanExplanationReceipt[],
): void {
  if (flags.recall_weak) {
    receipt.push({
      factor: 'recall_gap',
      basis: 'diagnosis',
      evidence: `recall_gap=${round3(vector.recall_gap)}`,
      effect: 'Retrieval-heavy prompts stay elevated before recognition share expands again.',
    });
  }
  if (flags.reading_weak) {
    receipt.push({
      factor: 'reading_weak',
      basis: 'diagnosis',
      evidence: `reading_weak=${round3(vector.reading_weak)}`,
      effect: 'Reading prompts are emphasized because surface-to-reading remains unstable.',
    });
  }
  if (flags.form_weak) {
    receipt.push({
      factor: 'form_weak',
      basis: 'diagnosis',
      evidence: `form_weak=${round3(vector.form_weak)}`,
      effect: 'Production checks stay active to reduce form confusion.',
    });
  }
  if (flags.load_sensitive) {
    receipt.push({
      factor: 'load_sensitive',
      basis: 'diagnosis',
      evidence: `load_sensitive=${round3(vector.load_sensitive)}`,
      effect: 'Hint steps remain conservative and session chunks shorten under cognitive load.',
    });
  }
  if (flags.lateness_risk) {
    receipt.push({
      factor: 'lateness_fragile',
      basis: 'behavior',
      evidence: `lateness_fragile=${round3(vector.lateness_fragile ?? 0)}`,
      effect: 'New-card pace is reduced because late reviews already correlate with performance drop.',
    });
  }
}

function buildRecoveryPlan(overdueCount: number, baselineMinutes: number): RecoveryPlan | undefined {
  if (overdueCount <= 0) return undefined;

  if (overdueCount >= 30) {
    return {
      active: true,
      overdue_count: overdueCount,
      recommended_minutes: Math.max(15, baselineMinutes),
      mode: 'seven_day',
      summary: 'Overdue backlog is high, so a 7-day recovery plan is active with reduced new-card pressure.',
    };
  }

  if (overdueCount >= 12) {
    return {
      active: true,
      overdue_count: overdueCount,
      recommended_minutes: Math.max(12, Math.round(baselineMinutes * 0.85)),
      mode: 'three_day',
      summary: 'A 3-day recovery plan is active to clear overdue cards without creating a review spike.',
    };
  }

  return {
    active: true,
    overdue_count: overdueCount,
    recommended_minutes: 15,
    mode: 'focus_15',
    summary: 'A short 15-minute recovery session is recommended to prevent the backlog from compounding.',
  };
}

function blendVectors(
  diagnosisVector: StrategyVector,
  behaviorVector: StrategyVector,
  diagnosisWeight: number,
): StrategyVector {
  const behaviorWeight = 1 - diagnosisWeight;

  return {
    recall_gap: round3(diagnosisVector.recall_gap * diagnosisWeight + behaviorVector.recall_gap * behaviorWeight),
    reading_weak: round3(diagnosisVector.reading_weak * diagnosisWeight + behaviorVector.reading_weak * behaviorWeight),
    form_weak: round3(diagnosisVector.form_weak * diagnosisWeight + behaviorVector.form_weak * behaviorWeight),
    load_sensitive: round3(diagnosisVector.load_sensitive * diagnosisWeight + behaviorVector.load_sensitive * behaviorWeight),
    lateness_fragile: round3(behaviorVector.lateness_fragile ?? 0),
  };
}

function shiftMix(
  mix: PlanMixRecord,
  increaseKey: keyof PlanMixRecord,
  delta: number,
  decreaseKey: keyof PlanMixRecord,
): PlanMixRecord {
  const next = { ...mix };
  const usableDelta = Math.min(delta, next[decreaseKey]);
  next[increaseKey] = next[increaseKey] + usableDelta;
  next[decreaseKey] = Math.max(0, next[decreaseKey] - usableDelta);
  return normalizeMix(next);
}

function normalizeMix(mix: PlanMixRecord): PlanMixRecord {
  const total = Object.values(mix).reduce((sum, value) => sum + value, 0);
  if (total <= 0) return mix;

  const normalized = { ...mix };
  (Object.keys(normalized) as Array<keyof PlanMixRecord>).forEach((key) => {
    normalized[key] = round3(normalized[key] / total);
  });

  return normalized;
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}
