import { Router, Request, Response } from 'express';
import type {
  DiagnosisEvaluateBlockRequest,
  DiagnosisResultResponse,
  DiagnosisSubmitV2Request,
  DiagnosisSubmitV3Request,
  DiagnosisSubmitV4Request,
} from '@japanese-learn/shared';
import { requireAuth } from '../middleware/auth';
import { pool } from '../db/pool';
import {
  buildDiagnosisBootstrap,
  buildDiagnosisNotes,
  evaluateDiagnosisBlock,
  getDefaultOnboardingProfile,
  hydrateDiagnosisResult,
  scoreDiagnosisV3,
  scoreDiagnosisV4,
  shouldAllowLegacyDiagnosisV2,
} from '../services/diagnosis-service';

const router = Router();

type DiagnosisDbRow = {
  strategy_vector: DiagnosisResultResponse['strategy_vector'];
  weakness_flags: Record<string, boolean>;
  notes: string[] | null;
  evidence: DiagnosisResultResponse['evidence'] | null;
  source_weights: DiagnosisResultResponse['source_weights'] | null;
  version: string | null;
  completed_at: Date | null;
  question_count: number | null;
  confidence_by_axis: DiagnosisResultResponse['confidence_by_axis'] | null;
  adaptive_reason_codes: string[] | null;
};

router.get('/bootstrap', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId!;

  try {
    const [{ rows: userRows }, { rows: resultRows }, reviewCountResult] = await Promise.all([
      pool.query<{ onboarding_profile: Record<string, unknown> | null }>(
        `SELECT onboarding_profile FROM users WHERE user_id = $1`,
        [userId],
      ),
      pool.query<DiagnosisDbRow>(
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
      pool.query<{ count: string }>(
        `SELECT COUNT(*)::TEXT AS count FROM review_log WHERE user_id = $1`,
        [userId],
      ),
    ]);

    const acceptedReviewEvents = Number(reviewCountResult.rows[0]?.count ?? 0);
    const previousResult = resultRows[0]
      ? hydrateDiagnosisResult(resultRows[0], acceptedReviewEvents)
      : undefined;

    res.json(
      buildDiagnosisBootstrap(
        previousResult,
        userRows[0]?.onboarding_profile as Partial<ReturnType<typeof getDefaultOnboardingProfile>> | null,
      ),
    );
  } catch (error) {
    console.error('[diagnosis/bootstrap] error:', error);
    res.status(500).json({ error: 'Failed to prepare diagnosis bootstrap.' });
  }
});

router.get('/result', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId!;

  try {
    const [{ rows }, reviewCountResult] = await Promise.all([
      pool.query<DiagnosisDbRow>(
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
      pool.query<{ count: string }>(
        `SELECT COUNT(*)::TEXT AS count FROM review_log WHERE user_id = $1`,
        [userId],
      ),
    ]);

    if (rows.length === 0) {
      res.status(404).json({ error: 'Diagnosis result not found.' });
      return;
    }

    const acceptedReviewEvents = Number(reviewCountResult.rows[0]?.count ?? 0);
    res.json(hydrateDiagnosisResult(rows[0], acceptedReviewEvents));
  } catch (error) {
    console.error('[diagnosis/result] error:', error);
    res.status(500).json({ error: 'Failed to load diagnosis result.' });
  }
});

router.post('/evaluate-block', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const body = (req.body ?? {}) as Partial<DiagnosisEvaluateBlockRequest>;

  if (!Array.isArray(body.answered_items) || !body.cognitive_metrics || !body.onboarding_profile) {
    res.status(400).json({ error: 'answered_items, cognitive_metrics, and onboarding_profile are required.' });
    return;
  }

  const answeredItems = dedupeDiagnosisAnswers(body.answered_items);

  if (answeredItems.length < 24 || answeredItems.length > 36 || answeredItems.length % 6 !== 0) {
    res.status(400).json({ error: 'answered_items must contain 24, 30, or 36 answers.' });
    return;
  }

  try {
    const result = evaluateDiagnosisBlock({
      answered_items: answeredItems,
      cognitive_metrics: body.cognitive_metrics,
      onboarding_profile: getDefaultOnboardingProfile(body.onboarding_profile),
    });
    res.json(result);
  } catch (error) {
    console.error('[diagnosis/evaluate-block] error:', error);
    res.status(500).json({ error: 'Failed to evaluate diagnosis block.' });
  }
});

router.post('/submit-v4', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId!;
  const body = (req.body ?? {}) as Partial<DiagnosisSubmitV4Request>;

  if (!body.onboarding_profile || !body.cognitive_metrics || !Array.isArray(body.answers)) {
    res.status(400).json({ error: 'onboarding_profile, cognitive_metrics, and answers are required.' });
    return;
  }

  const answers = dedupeDiagnosisAnswers(body.answers);

  if (answers.length < 24 || answers.length > 36 || answers.length % 6 !== 0) {
    res.status(400).json({ error: 'answers must contain 24, 30, or 36 items.' });
    return;
  }

  try {
    const { rows: reviewCountRows } = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::TEXT AS count FROM review_log WHERE user_id = $1`,
      [userId],
    );
    const acceptedReviewEvents = Number(reviewCountRows[0]?.count ?? 0);
    const onboardingProfile = getDefaultOnboardingProfile(body.onboarding_profile);
    const result = scoreDiagnosisV4({
      onboarding_profile: onboardingProfile,
      cognitive_metrics: body.cognitive_metrics,
      answers,
      accepted_review_events: acceptedReviewEvents,
      version: 'v4',
    });

    await upsertDiagnosisResult(userId, onboardingProfile, result, buildEventCount(answers.length, body.cognitive_metrics));
    res.status(201).json(result);
  } catch (error) {
    console.error('[diagnosis/submit-v4] error:', error);
    res.status(500).json({ error: 'Failed to store diagnosis v4 result.' });
  }
});

router.post('/submit-v3', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId!;
  const body = (req.body ?? {}) as Partial<DiagnosisSubmitV3Request>;

  if (!body.onboarding_profile || !body.cognitive_metrics || !Array.isArray(body.language_micro_answers)) {
    res.status(400).json({ error: 'onboarding_profile, cognitive_metrics, and language_micro_answers are required.' });
    return;
  }

  if (body.language_micro_answers.length !== 6) {
    res.status(400).json({ error: 'language_micro_answers must contain exactly 6 answers.' });
    return;
  }

  try {
    const { rows: reviewCountRows } = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::TEXT AS count FROM review_log WHERE user_id = $1`,
      [userId],
    );
    const acceptedReviewEvents = Number(reviewCountRows[0]?.count ?? 0);
    const onboardingProfile = getDefaultOnboardingProfile(body.onboarding_profile);
    const result = scoreDiagnosisV3({
      onboarding_profile: onboardingProfile,
      cognitive_metrics: body.cognitive_metrics,
      language_micro_answers: body.language_micro_answers,
      accepted_review_events: acceptedReviewEvents,
    });

    await upsertDiagnosisResult(
      userId,
      onboardingProfile,
      result,
      buildEventCount(body.language_micro_answers.length, body.cognitive_metrics),
    );

    res.status(201).json(result);
  } catch (error) {
    console.error('[diagnosis/submit-v3] error:', error);
    res.status(500).json({ error: 'Failed to store diagnosis v3 result.' });
  }
});

router.post('/submit-v2', requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!shouldAllowLegacyDiagnosisV2()) {
    res.status(410).json({ error: 'Diagnosis v2 is retired. Use submit-v4 instead.' });
    return;
  }

  const userId = req.userId!;
  const body = (req.body ?? {}) as Partial<DiagnosisSubmitV2Request>;
  const { self_assessment, memory_pairs, digit_span, visual_discrimination } = body;

  if (!memory_pairs || !digit_span || !visual_discrimination) {
    res.status(400).json({ error: 'memory_pairs, digit_span, and visual_discrimination are required.' });
    return;
  }

  try {
    const recallRate = ratio(memory_pairs.recall_correct, memory_pairs.recall_total);
    const recognitionRate = ratio(memory_pairs.recognition_correct, memory_pairs.recognition_total);
    const recallGap = clamp01(recognitionRate - recallRate);
    const spanPenalty = clamp01(1 - (digit_span.max_correct_span ?? 4) / 7);
    const visualAccuracy = ratio(visual_discrimination.correct, visual_discrimination.total);
    const formWeak = clamp01(1 - visualAccuracy);
    const readingWeak = 0.35;

    const strategy_vector = {
      recall_gap: round3(recallGap),
      reading_weak: round3(readingWeak),
      form_weak: round3(formWeak),
      load_sensitive: round3(clamp01(spanPenalty * 0.65 + normalizeRt(memory_pairs.avg_rt_ms) * 0.35)),
      lateness_fragile: 0,
    };

    const weaknessFlags = toWeaknessFlagRecord(
      Object.entries({
        recall_weak: strategy_vector.recall_gap >= 0.4,
        reading_weak: strategy_vector.reading_weak >= 0.6,
        form_weak: strategy_vector.form_weak >= 0.5,
        load_sensitive: strategy_vector.load_sensitive >= 0.6,
      })
        .filter(([, active]) => active)
        .map(([key]) => key),
    );

    const response: DiagnosisResultResponse = {
      strategy_vector,
      weakness_flags: Object.entries(weaknessFlags)
        .filter(([, active]) => active)
        .map(([key]) => key),
      notes: buildDiagnosisNotes(strategy_vector, weaknessFlags),
      evidence: [
        {
          factor: 'recall_gap',
          source: 'cognitive',
          value: round3(recallGap),
          note: `recognition=${Math.round(recognitionRate * 100)}%, recall=${Math.round(recallRate * 100)}%`,
        },
        {
          factor: 'form_weak',
          source: 'cognitive',
          value: round3(formWeak),
          note: `visual discrimination accuracy=${Math.round(visualAccuracy * 100)}%`,
        },
        {
          factor: 'reading_weak',
          source: 'self_report',
          value: round3(readingWeak),
          note: `legacy weak_areas=${(self_assessment?.weak_areas ?? []).join(',') || 'none'}`,
        },
      ],
      source_weights: {
        self_report: 0.15,
        cognitive: 0.85,
        language_micro: 0,
      },
      version: 'v2',
      question_count: 0,
      confidence_by_axis: {
        recall_gap: 0.3,
        reading_weak: 0.2,
        form_weak: 0.3,
        load_sensitive: 0.5,
      },
      adaptive_reason_codes: [],
    };

    await upsertDiagnosisResult(
      userId,
      getDefaultOnboardingProfile({
        target_level: self_assessment?.target_level,
        daily_minutes: self_assessment?.daily_minutes,
        weak_areas: self_assessment?.weak_areas,
      }),
      response,
      (memory_pairs.recall_total ?? 0) + (memory_pairs.recognition_total ?? 0) + (visual_discrimination.total ?? 0),
    );

    res.status(201).json(response);
  } catch (error) {
    console.error('[diagnosis/submit-v2] error:', error);
    res.status(500).json({ error: 'Failed to store diagnosis v2 result.' });
  }
});

export default router;

async function upsertDiagnosisResult(
  userId: string,
  onboardingProfile: ReturnType<typeof getDefaultOnboardingProfile>,
  result: DiagnosisResultResponse,
  eventCount: number,
): Promise<void> {
  await pool.query(
    `
    UPDATE users
    SET onboarding_profile = $2, updated_at = NOW()
    WHERE user_id = $1
    `,
    [userId, JSON.stringify(onboardingProfile)],
  );

  await pool.query(
    `
    INSERT INTO diagnosis_results (
      user_id,
      strategy_vector,
      weakness_flags,
      accuracy,
      event_count,
      completed_at,
      version,
      evidence,
      source_weights,
      notes,
      question_count,
      confidence_by_axis,
      adaptive_reason_codes
    ) VALUES ($1, $2, $3, $4, $5, NOW(), $6, $7, $8, $9, $10, $11, $12)
    ON CONFLICT (user_id) DO UPDATE SET
      strategy_vector = EXCLUDED.strategy_vector,
      weakness_flags = EXCLUDED.weakness_flags,
      accuracy = EXCLUDED.accuracy,
      event_count = EXCLUDED.event_count,
      completed_at = EXCLUDED.completed_at,
      version = EXCLUDED.version,
      evidence = EXCLUDED.evidence,
      source_weights = EXCLUDED.source_weights,
      notes = EXCLUDED.notes,
      question_count = EXCLUDED.question_count,
      confidence_by_axis = EXCLUDED.confidence_by_axis,
      adaptive_reason_codes = EXCLUDED.adaptive_reason_codes
    `,
    [
      userId,
      JSON.stringify(result.strategy_vector),
      JSON.stringify(toWeaknessFlagRecord(result.weakness_flags)),
      result.strategy_vector.recall_gap,
      eventCount,
      result.version,
      JSON.stringify(result.evidence),
      JSON.stringify(result.source_weights),
      JSON.stringify(result.notes),
      result.question_count ?? 0,
      JSON.stringify(result.confidence_by_axis ?? {}),
      JSON.stringify(result.adaptive_reason_codes ?? []),
    ],
  );
}

function buildEventCount(languageQuestionCount: number, metrics: DiagnosisSubmitV3Request['cognitive_metrics']): number {
  return languageQuestionCount
    + metrics.memory_pairs.recall_total
    + metrics.memory_pairs.recognition_total
    + metrics.visual_discrimination.total;
}

function dedupeDiagnosisAnswers<T extends { id: string }>(answers: T[]): T[] {
  const latestById = new Map<string, T>();
  for (const answer of answers) {
    latestById.set(answer.id, answer);
  }
  return [...latestById.values()];
}

function toWeaknessFlagRecord(flags: string[] | Record<string, boolean>): Record<string, boolean> {
  if (!Array.isArray(flags)) {
    return flags;
  }

  return flags.reduce<Record<string, boolean>>((acc, key) => {
    acc[key] = true;
    return acc;
  }, {});
}

function ratio(numerator = 0, denominator = 0): number {
  return denominator > 0 ? numerator / denominator : 0;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function normalizeRt(rtMs = 0): number {
  if (rtMs <= 0) return 0;
  if (rtMs <= 1200) return 0.05;
  if (rtMs <= 2200) return 0.2;
  if (rtMs <= 3200) return 0.4;
  if (rtMs <= 5000) return 0.65;
  return 0.85;
}
