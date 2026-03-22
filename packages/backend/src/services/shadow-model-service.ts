import type { ShadowStatusEntry, ShadowStatusResponse } from '@japanese-learn/shared';
import type { PoolClient } from 'pg';
import { pool } from '../db/pool';
import { recallProbability } from './plan-generator';

type Queryable = Pick<PoolClient, 'query'> | Pick<typeof pool, 'query'>;

type EligibilityState = ShadowStatusEntry['eligibility_state'];

interface ShadowReviewRow {
  prompt_type: string;
  shadow_pred_recall: number | null;
  correct: boolean;
  shadow_half_life_at_review: number | null;
  interval_days_at_review: number | null;
  due_ts_at_review: Date | null;
  ts: Date;
}

interface ShadowGateEvaluation {
  scope: 'user' | 'cohort';
  source_event_count: number;
  log_loss: number;
  baseline_log_loss: number;
  brier_score: number;
  baseline_brier_score: number;
  rmse: number;
  log_loss_improvement_pct: number;
  prompt_type_delta_brier: Record<string, number>;
  overdue_segment: {
    shadow_brier: number;
    baseline_brier: number;
  };
  eligibility_state: EligibilityState;
  recommended_action: string | null;
}

const SHADOW_MODEL_VERSION = 'hlr_shadow_v1';
const WINDOW_DAYS = 28;
const USER_EVENT_THRESHOLD = 500;
const COHORT_EVENT_THRESHOLD = 5000;

export async function refreshShadowModel(
  userId: string,
  db: Queryable = pool,
): Promise<void> {
  const rows = await loadShadowRows(
    db,
    `WHERE user_id = $1 AND ts >= NOW() - INTERVAL '${WINDOW_DAYS} days'`,
    [userId],
  );
  const evaluation = evaluateShadowRows(rows, { scope: 'user', minimumEventCount: USER_EVENT_THRESHOLD });

  await db.query(
    `
    INSERT INTO model_params (
      user_id,
      model_ver,
      params_json,
      calibration_score,
      source_event_count,
      fitted_at,
      last_shadow_eval_at,
      eligibility_state,
      metrics_json,
      recommended_action
    ) VALUES ($1, $2, $3, $4, $5, NOW(), NOW(), $6, $7, $8)
    ON CONFLICT (user_id) DO UPDATE SET
      model_ver = EXCLUDED.model_ver,
      params_json = EXCLUDED.params_json,
      calibration_score = EXCLUDED.calibration_score,
      source_event_count = EXCLUDED.source_event_count,
      fitted_at = EXCLUDED.fitted_at,
      last_shadow_eval_at = EXCLUDED.last_shadow_eval_at,
      eligibility_state = EXCLUDED.eligibility_state,
      metrics_json = EXCLUDED.metrics_json,
      recommended_action = EXCLUDED.recommended_action
    `,
    [
      userId,
      SHADOW_MODEL_VERSION,
      JSON.stringify({
        avg_half_life_days: round3(average(rows.map((row) => Number(row.shadow_half_life_at_review ?? 0)))),
        window_days: WINDOW_DAYS,
      }),
      JSON.stringify({
        log_loss: round4(evaluation.log_loss),
        baseline_log_loss: round4(evaluation.baseline_log_loss),
        brier_score: round4(evaluation.brier_score),
        rmse: round4(evaluation.rmse),
      }),
      evaluation.source_event_count,
      evaluation.eligibility_state,
      JSON.stringify({
        log_loss_improvement_pct: round4(evaluation.log_loss_improvement_pct),
        prompt_type_delta_brier: mapNumbers(evaluation.prompt_type_delta_brier, round4),
        overdue_segment: {
          shadow_brier: round4(evaluation.overdue_segment.shadow_brier),
          baseline_brier: round4(evaluation.overdue_segment.baseline_brier),
        },
        window_days: WINDOW_DAYS,
      }),
      evaluation.recommended_action,
    ],
  );
}

export async function refreshShadowModelsForActiveUsers(
  db: Queryable = pool,
): Promise<number> {
  const { rows } = await db.query<{ user_id: string }>(
    `SELECT DISTINCT user_id FROM review_log WHERE ts >= NOW() - INTERVAL '${WINDOW_DAYS} days'`,
  );

  for (const { user_id } of rows) {
    await refreshShadowModel(user_id, db);
  }

  return rows.length;
}

export async function getShadowStatusOverview(
  db: Queryable = pool,
): Promise<ShadowStatusResponse> {
  const [cohortRows, userRows] = await Promise.all([
    loadShadowRows(db, `WHERE ts >= NOW() - INTERVAL '${WINDOW_DAYS} days'`, []),
    db.query<{
      user_id: string;
      last_shadow_eval_at: Date | null;
      eligibility_state: EligibilityState;
      recommended_action: string | null;
      calibration_score: {
        log_loss?: number;
        baseline_log_loss?: number;
        brier_score?: number;
        rmse?: number;
      } | null;
    }>(
      `
      SELECT user_id, last_shadow_eval_at, eligibility_state, recommended_action, calibration_score
      FROM model_params
      ORDER BY last_shadow_eval_at DESC NULLS LAST
      LIMIT 25
      `,
    ),
  ]);

  const cohortEvaluation = cohortRows.length > 0
    ? evaluateShadowRows(cohortRows, { scope: 'cohort', minimumEventCount: COHORT_EVENT_THRESHOLD })
    : null;

  return {
    generated_at: new Date().toISOString(),
    cohort: cohortEvaluation
      ? toShadowStatusEntry({
          scope: 'cohort',
          subject_id: 'cohort_28d',
          eligibility_state: cohortEvaluation.eligibility_state,
          last_shadow_eval_at: new Date().toISOString(),
          calibration_score: {
            log_loss: round4(cohortEvaluation.log_loss),
            baseline_log_loss: round4(cohortEvaluation.baseline_log_loss),
            brier_score: round4(cohortEvaluation.brier_score),
            rmse: round4(cohortEvaluation.rmse),
          },
          failure_reason: cohortEvaluation.recommended_action,
        })
      : null,
    users: userRows.rows.map((row) =>
      toShadowStatusEntry({
        scope: 'user',
        subject_id: row.user_id,
        eligibility_state: row.eligibility_state ?? 'hold',
        last_shadow_eval_at: row.last_shadow_eval_at?.toISOString() ?? null,
        calibration_score: {
          log_loss: Number(row.calibration_score?.log_loss ?? 0),
          baseline_log_loss: Number(row.calibration_score?.baseline_log_loss ?? 0),
          brier_score: Number(row.calibration_score?.brier_score ?? 0),
          rmse: Number(row.calibration_score?.rmse ?? 0),
        },
        failure_reason: row.recommended_action,
      }),
    ),
  };
}

export function evaluateShadowRows(
  rows: ShadowReviewRow[],
  options: { scope: 'user' | 'cohort'; minimumEventCount: number },
): ShadowGateEvaluation {
  const clippedShadow = rows.map((row) => clipProbability(Number(row.shadow_pred_recall ?? 0.5)));
  const baseline = rows.map((row) => clipProbability(buildBaselineProxy(row)));
  const outcomes = rows.map((row) => (row.correct ? 1 : 0));

  const shadowLogLoss = computeLogLoss(clippedShadow, outcomes);
  const baselineLogLoss = computeLogLoss(baseline, outcomes);
  const shadowBrier = computeBrier(clippedShadow, outcomes);
  const baselineBrier = computeBrier(baseline, outcomes);
  const rmse = Math.sqrt(shadowBrier);
  const logLossImprovementPct = baselineLogLoss > 0
    ? (baselineLogLoss - shadowLogLoss) / baselineLogLoss
    : 0;

  const promptTypeDeltaBrier = Object.fromEntries(
    Object.entries(groupByPromptType(rows)).map(([promptType, group]) => {
      const groupOutcomes = group.map((row) => (row.correct ? 1 : 0));
      const groupShadow = group.map((row) => clipProbability(Number(row.shadow_pred_recall ?? 0.5)));
      const groupBaseline = group.map((row) => clipProbability(buildBaselineProxy(row)));
      return [promptType, computeBrier(groupShadow, groupOutcomes) - computeBrier(groupBaseline, groupOutcomes)];
    }),
  );

  const overdueRows = rows.filter((row) => row.due_ts_at_review && row.ts.getTime() > row.due_ts_at_review.getTime());
  const overdueOutcomes = overdueRows.map((row) => (row.correct ? 1 : 0));
  const overdueShadow = overdueRows.map((row) => clipProbability(Number(row.shadow_pred_recall ?? 0.5)));
  const overdueBaseline = overdueRows.map((row) => clipProbability(buildBaselineProxy(row)));
  const overdueSegment = {
    shadow_brier: overdueRows.length ? computeBrier(overdueShadow, overdueOutcomes) : 0,
    baseline_brier: overdueRows.length ? computeBrier(overdueBaseline, overdueOutcomes) : 0,
  };

  const eligibilityChecks = [
    rows.length >= options.minimumEventCount,
    logLossImprovementPct >= 0.05,
    shadowBrier <= 0.18,
    !Object.values(promptTypeDeltaBrier).some((delta) => delta > 0.02),
    overdueRows.length === 0 || overdueSegment.shadow_brier <= overdueSegment.baseline_brier,
  ];

  const recommendedAction = rows.length < options.minimumEventCount
    ? options.scope === 'user'
      ? 'need_more_user_events'
      : 'need_more_cohort_events'
    : logLossImprovementPct < 0.05
    ? 'logloss_not_improved'
    : shadowBrier > 0.18
    ? 'brier_above_threshold'
    : Object.values(promptTypeDeltaBrier).some((delta) => delta > 0.02)
    ? 'prompt_type_regression'
    : overdueRows.length > 0 && overdueSegment.shadow_brier > overdueSegment.baseline_brier
    ? 'overdue_segment_regression'
    : null;

  const eligibilityState: EligibilityState = rows.length < options.minimumEventCount
    ? 'insufficient_data'
    : eligibilityChecks.every(Boolean)
    ? 'ready'
    : 'hold';

  return {
    scope: options.scope,
    source_event_count: rows.length,
    log_loss: shadowLogLoss,
    baseline_log_loss: baselineLogLoss,
    brier_score: shadowBrier,
    baseline_brier_score: baselineBrier,
    rmse,
    log_loss_improvement_pct: logLossImprovementPct,
    prompt_type_delta_brier: promptTypeDeltaBrier,
    overdue_segment: overdueSegment,
    eligibility_state: eligibilityState,
    recommended_action: recommendedAction,
  };
}

async function loadShadowRows(
  db: Queryable,
  whereClause: string,
  params: unknown[],
): Promise<ShadowReviewRow[]> {
  const { rows } = await db.query<ShadowReviewRow>(
    `
    SELECT
      prompt_type,
      shadow_pred_recall,
      correct,
      shadow_half_life_at_review,
      interval_days_at_review,
      due_ts_at_review,
      ts
    FROM review_log
    ${whereClause}
      AND shadow_pred_recall IS NOT NULL
    ORDER BY ts DESC
    `,
    params,
  );

  return rows.map((row) => ({
    ...row,
    ts: new Date(row.ts),
    due_ts_at_review: row.due_ts_at_review ? new Date(row.due_ts_at_review) : null,
  }));
}

function buildBaselineProxy(row: ShadowReviewRow): number {
  const scheduledInterval = Math.max(1, Number(row.interval_days_at_review ?? row.shadow_half_life_at_review ?? 1));
  const overdueDays = row.due_ts_at_review
    ? Math.max(0, (row.ts.getTime() - row.due_ts_at_review.getTime()) / (1000 * 60 * 60 * 24))
    : 0;
  return recallProbability(scheduledInterval, scheduledInterval + overdueDays);
}

function clipProbability(value: number): number {
  return Math.max(0.001, Math.min(0.999, value));
}

function computeLogLoss(probabilities: number[], outcomes: number[]): number {
  if (probabilities.length === 0) return 0;
  return -probabilities.reduce((sum, probability, index) => {
    const y = outcomes[index];
    return sum + y * Math.log(probability) + (1 - y) * Math.log(1 - probability);
  }, 0) / probabilities.length;
}

function computeBrier(probabilities: number[], outcomes: number[]): number {
  if (probabilities.length === 0) return 0;
  return probabilities.reduce((sum, probability, index) => {
    return sum + Math.pow(probability - outcomes[index], 2);
  }, 0) / probabilities.length;
}

function groupByPromptType(rows: ShadowReviewRow[]): Record<string, ShadowReviewRow[]> {
  return rows.reduce<Record<string, ShadowReviewRow[]>>((acc, row) => {
    acc[row.prompt_type] = acc[row.prompt_type] ?? [];
    acc[row.prompt_type].push(row);
    return acc;
  }, {});
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function mapNumbers(
  value: Record<string, number>,
  mapper: (num: number) => number,
): Record<string, number> {
  return Object.fromEntries(Object.entries(value).map(([key, num]) => [key, mapper(num)]));
}

function toShadowStatusEntry(entry: ShadowStatusEntry): ShadowStatusEntry {
  return entry;
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}
