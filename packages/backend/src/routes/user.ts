import { Router, Request, Response } from 'express';
import type { ExperimentAssignment, UserExportResponse } from '@japanese-learn/shared';
import { requireAuth } from '../middleware/auth';
import { pool } from '../db/pool';
import { hydrateDiagnosisResult } from '../services/diagnosis-service';

const router = Router();

router.get('/export', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId!;

  try {
    const [
      userResult,
      diagnosisResult,
      reviewCountResult,
      cardStateResult,
      reviewLogResult,
      dailyAggResult,
      errorAggResult,
      experimentsResult,
      notificationPrefsResult,
    ] = await Promise.all([
      pool.query<{
        user_id: string;
        tz: string | null;
        locale: string | null;
        created_at: Date;
        consent_flags: UserExportResponse['consent_flags'];
        onboarding_profile: UserExportResponse['onboarding_profile'];
      }>(
        `
        SELECT user_id, tz, locale, created_at, consent_flags, onboarding_profile
        FROM users
        WHERE user_id = $1
        `,
        [userId],
      ),
      pool.query<{
        strategy_vector: any;
        weakness_flags: Record<string, boolean>;
        notes: string[] | null;
        evidence: any[] | null;
        source_weights: any | null;
        version: string | null;
        completed_at: Date | null;
        question_count: number | null;
        confidence_by_axis: any | null;
        adaptive_reason_codes: string[] | null;
      }>(
        `
        SELECT
          strategy_vector,
          weakness_flags,
          notes,
          evidence,
          source_weights,
          version,
          completed_at,
          question_count,
          confidence_by_axis,
          adaptive_reason_codes
        FROM diagnosis_results
        WHERE user_id = $1
        ORDER BY completed_at DESC
        LIMIT 1
        `,
        [userId],
      ),
      pool.query<{ count: string }>(`SELECT COUNT(*)::TEXT AS count FROM review_log WHERE user_id = $1`, [userId]),
      pool.query(`SELECT * FROM card_state WHERE user_id = $1 ORDER BY due_ts ASC`, [userId]),
      pool.query(
        `
        SELECT
          event_id, card_id, item_id, ts, ingested_at, prompt_type, correct, rt_ms,
          attempt_count, hint_level, confidence, error_type, device, offline,
          client_network_state, client_last_successful_sync_at, client_queue_depth,
          shadow_half_life_at_review, shadow_pred_recall, shadow_model_ver,
          due_ts_at_review, interval_days_at_review, ease_factor_at_review,
          repetitions_at_review, state_at_review, is_new_at_review, schema_version
        FROM review_log
        WHERE user_id = $1
        ORDER BY ts DESC
        `,
        [userId],
      ),
      pool.query(`SELECT * FROM user_daily_agg WHERE user_id = $1 ORDER BY day DESC`, [userId]),
      pool.query(`SELECT * FROM user_error_agg WHERE user_id = $1 ORDER BY window_days ASC`, [userId]),
      pool.query<ExperimentAssignment>(
        `
        SELECT e.exp_id, e.variant, e.assigned_at, e.exposure_count, d.purpose, d.opt_out_supported
        FROM experiments e
        LEFT JOIN experiment_definitions d ON d.exp_id = e.exp_id
        WHERE e.user_id = $1
        ORDER BY e.assigned_at DESC
        `,
        [userId],
      ),
      pool.query<{
        enabled: boolean;
        window_start: string | null;
        window_end: string | null;
        timezone: string;
        recovery_plan: boolean;
        push_token: string | null;
      }>(
        `
        SELECT enabled, window_start::TEXT, window_end::TEXT, timezone, recovery_plan, push_token
        FROM notification_prefs
        WHERE user_id = $1
        `,
        [userId],
      ),
    ]);

    if (userResult.rows.length === 0) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    const reviewCount = Number(reviewCountResult.rows[0]?.count ?? 0);
    const diagnosisRow = diagnosisResult.rows[0];

    const payload: UserExportResponse = {
      user: {
        user_id: userResult.rows[0].user_id,
        tz: userResult.rows[0].tz,
        locale: userResult.rows[0].locale,
        created_at: userResult.rows[0].created_at.toISOString(),
      },
      onboarding_profile: userResult.rows[0].onboarding_profile,
      consent_flags: userResult.rows[0].consent_flags,
      diagnosis_result_latest: diagnosisRow ? hydrateDiagnosisResult(diagnosisRow, reviewCount) : null,
      card_state: cardStateResult.rows,
      review_log: reviewLogResult.rows,
      daily_agg: dailyAggResult.rows,
      error_agg: errorAggResult.rows,
      experiments: experimentsResult.rows,
      notification_prefs_redacted: notificationPrefsResult.rows[0]
        ? {
            enabled: notificationPrefsResult.rows[0].enabled,
            window_start: notificationPrefsResult.rows[0].window_start,
            window_end: notificationPrefsResult.rows[0].window_end,
            timezone: notificationPrefsResult.rows[0].timezone,
            recovery_plan: notificationPrefsResult.rows[0].recovery_plan,
            has_push_token: Boolean(notificationPrefsResult.rows[0].push_token),
          }
        : null,
      exported_at: new Date().toISOString(),
      schema_version: '2026-03-v1',
    };

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${userId}-export.json"`);
    res.status(200).send(JSON.stringify(payload, null, 2));
  } catch (error) {
    console.error('[user/export] error:', error);
    res.status(500).json({ error: 'Failed to export user data.' });
  }
});

export default router;
