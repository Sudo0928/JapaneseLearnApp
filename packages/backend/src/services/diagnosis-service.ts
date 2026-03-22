import type {
  DiagnosisAxisConfidence,
  DiagnosisBootstrapResponse,
  DiagnosisCognitiveMetrics,
  DiagnosisEvaluateBlockResponse,
  DiagnosisLanguageMicroAnswer,
  DiagnosisLanguageMicroItem,
  DiagnosisPromptType,
  DiagnosisResultResponse,
  DiagnosisSourceWeights,
  OnboardingProfile,
} from '@japanese-learn/shared';
import { deriveWeaknessFlags, type StrategyVector } from './strategy-analyzer';

export interface DiagnosisResultRowLike {
  strategy_vector: Partial<StrategyVector>;
  weakness_flags: Record<string, boolean>;
  notes?: string[] | null;
  evidence?: DiagnosisResultResponse['evidence'] | null;
  source_weights?: DiagnosisSourceWeights | null;
  version?: string | null;
  completed_at?: string | Date | null;
  question_count?: number | null;
  confidence_by_axis?: DiagnosisAxisConfidence | null;
  adaptive_reason_codes?: string[] | null;
}

type DiagnosticAxis = keyof DiagnosisAxisConfidence;

type LegacyDiagItem = DiagnosisLanguageMicroItem & {
  measures: 'recall_gap' | 'reading_weak' | 'form_weak';
  answer: string;
  tier: 'core' | 'adaptive';
};

interface PromptPerformance {
  accuracy: number;
  avgRt: number;
  count: number;
  slowConflict: boolean;
}

const DEFAULT_ONBOARDING_PROFILE: OnboardingProfile = {
  target_level: 'JLPT_N5',
  target_date: null,
  focus: [],
  daily_minutes: 20,
  weekly_variability: 'medium',
  offline_expected: false,
  kanji_background: 'none',
  notifications_opt_in: false,
  weak_areas: [],
};

const BASE_SOURCE_WEIGHTS: DiagnosisSourceWeights = {
  self_report: 0.2,
  cognitive: 0.45,
  language_micro: 0.35,
};

const V3_MICRO_MIX: Array<{ prompt_type: DiagnosisPromptType; count: number }> = [
  { prompt_type: 'SURFACE_TO_MEANING', count: 2 },
  { prompt_type: 'SURFACE_TO_READING', count: 2 },
  { prompt_type: 'MEANING_TO_SURFACE', count: 1 },
  { prompt_type: 'MCQ', count: 1 },
];
const DIAGNOSIS_PROMPT_TYPES: DiagnosisPromptType[] = [
  'SURFACE_TO_MEANING',
  'SURFACE_TO_READING',
  'MEANING_TO_SURFACE',
  'MCQ',
];
const INITIAL_PROMPT_COUNT = 6;

let diagBankCache: LegacyDiagItem[] | null = null;
let allPublicItemsCache: DiagnosisLanguageMicroItem[] | null = null;
let itemsByPromptCache: Record<DiagnosisPromptType, DiagnosisLanguageMicroItem[]> | null = null;
let diagLookupCache: Map<string, LegacyDiagItem> | null = null;

function getDiagBank(): LegacyDiagItem[] {
  if (!diagBankCache) {
    diagBankCache = [
      ...buildGeneratedSurfaceToMeaningItems(),
      ...buildGeneratedSurfaceToReadingItems(),
      ...buildGeneratedMeaningToSurfaceItems(),
      ...buildGeneratedMcqItems(),
    ];
  }

  return diagBankCache;
}

function getAllPublicItems(): DiagnosisLanguageMicroItem[] {
  if (!allPublicItemsCache) {
    allPublicItemsCache = getDiagBank().map(toPublicItem);
  }

  return allPublicItemsCache;
}

function getItemsByPrompt(): Record<DiagnosisPromptType, DiagnosisLanguageMicroItem[]> {
  if (!itemsByPromptCache) {
    const allItems = getAllPublicItems();
    itemsByPromptCache = DIAGNOSIS_PROMPT_TYPES.reduce<Record<DiagnosisPromptType, DiagnosisLanguageMicroItem[]>>(
      (acc, promptType) => {
        acc[promptType] = allItems.filter((item) => item.prompt_type === promptType);
        return acc;
      },
      {
        SURFACE_TO_MEANING: [],
        SURFACE_TO_READING: [],
        MEANING_TO_SURFACE: [],
        MCQ: [],
      },
    );
  }

  return itemsByPromptCache;
}

function getDiagLookup(): Map<string, LegacyDiagItem> {
  if (!diagLookupCache) {
    diagLookupCache = new Map(getDiagBank().map((item) => [item.id, item]));
  }

  return diagLookupCache;
}

export function getDefaultOnboardingProfile(
  partial?: Partial<OnboardingProfile> | null,
): OnboardingProfile {
  return {
    ...DEFAULT_ONBOARDING_PROFILE,
    ...partial,
    focus: Array.isArray(partial?.focus)
      ? partial?.focus.filter((value): value is string => typeof value === 'string')
      : [],
    daily_minutes: Math.max(5, Math.min(120, partial?.daily_minutes ?? DEFAULT_ONBOARDING_PROFILE.daily_minutes)),
    weekly_variability: partial?.weekly_variability ?? DEFAULT_ONBOARDING_PROFILE.weekly_variability,
    offline_expected: partial?.offline_expected ?? DEFAULT_ONBOARDING_PROFILE.offline_expected,
    kanji_background: partial?.kanji_background ?? DEFAULT_ONBOARDING_PROFILE.kanji_background,
    notifications_opt_in: partial?.notifications_opt_in ?? DEFAULT_ONBOARDING_PROFILE.notifications_opt_in,
    weak_areas: partial?.weak_areas ?? DEFAULT_ONBOARDING_PROFILE.weak_areas,
  };
}

export function getDecayedSourceWeights(
  acceptedReviewEvents: number,
  completedAt?: string | Date | null,
): DiagnosisSourceWeights {
  let selfWeight = BASE_SOURCE_WEIGHTS.self_report;
  const completedAtMs = completedAt ? new Date(completedAt).getTime() : Date.now();
  const ageMs = Date.now() - completedAtMs;
  const threeDaysMs = 3 * 24 * 60 * 60 * 1000;

  if (acceptedReviewEvents >= 50) {
    selfWeight = 0;
  } else if (acceptedReviewEvents >= 20 || ageMs >= threeDaysMs) {
    selfWeight = 0.1;
  }

  const remaining = 1 - selfWeight;
  const cognitiveShare = BASE_SOURCE_WEIGHTS.cognitive / (BASE_SOURCE_WEIGHTS.cognitive + BASE_SOURCE_WEIGHTS.language_micro);
  const languageShare = BASE_SOURCE_WEIGHTS.language_micro / (BASE_SOURCE_WEIGHTS.cognitive + BASE_SOURCE_WEIGHTS.language_micro);

  return {
    self_report: round3(selfWeight),
    cognitive: round3(remaining * cognitiveShare),
    language_micro: round3(remaining * languageShare),
  };
}

export function sampleLanguageMicroItems(): DiagnosisLanguageMicroItem[] {
  const picked: DiagnosisLanguageMicroItem[] = [];
  const usedItemIds = new Set<string>();

  for (const rule of V3_MICRO_MIX) {
    const matches = shuffleItems(getItemsByPrompt()[rule.prompt_type].map(clonePublicItem));
    for (const item of matches) {
      if (usedItemIds.has(item.item_id)) continue;
      picked.push(clonePublicItem(item));
      usedItemIds.add(item.item_id);
      if (picked.filter((candidate) => candidate.prompt_type === rule.prompt_type).length >= rule.count) {
        break;
      }
    }
  }

  return picked;
}

export function getDiagnosisCoreItems(): DiagnosisLanguageMicroItem[] {
  const picked: DiagnosisLanguageMicroItem[] = [];
  for (const promptType of DIAGNOSIS_PROMPT_TYPES) {
    picked.push(...shuffleItems(getItemsByPrompt()[promptType].map(clonePublicItem)).slice(0, INITIAL_PROMPT_COUNT));
  }
  return shuffleItems(picked);
}

export function getDiagnosisAdaptivePool(): DiagnosisLanguageMicroItem[] {
  return shuffleItems(getAllPublicItems().map(clonePublicItem));
}

export function buildDiagnosisBootstrap(
  previousResult?: DiagnosisResultResponse,
  onboardingProfile?: Partial<OnboardingProfile> | null,
): DiagnosisBootstrapResponse {
  return {
    core_items: getDiagnosisCoreItems(),
    adaptive_pool: getDiagnosisAdaptivePool(),
    previous_result: previousResult,
    onboarding_defaults: getDefaultOnboardingProfile(onboardingProfile),
    language_micro_items: sampleLanguageMicroItems(),
  };
}

export function evaluateDiagnosisBlock(input: {
  answered_items: DiagnosisLanguageMicroAnswer[];
  cognitive_metrics: DiagnosisCognitiveMetrics;
  onboarding_profile: OnboardingProfile;
}): DiagnosisEvaluateBlockResponse {
  const answers = dedupeAnswers(input.answered_items);
  const onboarding = getDefaultOnboardingProfile(input.onboarding_profile);
  const languageScores = scoreLanguageAnswers(answers);
  const confidenceByAxis = buildConfidenceByAxis(languageScores, input.cognitive_metrics, answers.length);
  const reasonCodes = deriveAdaptiveReasonCodes(languageScores, confidenceByAxis, answers.length);

  if (answers.length >= 36 || reasonCodes.length === 0) {
    return {
      done: true,
      next_items: [],
      reason_codes: [],
      confidence_by_axis: confidenceByAxis,
    };
  }

  const nextItems = selectAdaptiveItems(reasonCodes, answers, onboarding);
  return {
    done: nextItems.length === 0,
    next_items: nextItems,
    reason_codes: reasonCodes,
    confidence_by_axis: confidenceByAxis,
  };
}

export function scoreDiagnosisV3(input: {
  onboarding_profile: OnboardingProfile;
  cognitive_metrics: DiagnosisCognitiveMetrics;
  language_micro_answers: DiagnosisLanguageMicroAnswer[];
  accepted_review_events: number;
}): DiagnosisResultResponse {
  return scoreDiagnosisV4({
    onboarding_profile: input.onboarding_profile,
    cognitive_metrics: input.cognitive_metrics,
    answers: input.language_micro_answers,
    accepted_review_events: input.accepted_review_events,
    version: 'v3',
  });
}

export function scoreDiagnosisV4(input: {
  onboarding_profile: OnboardingProfile;
  cognitive_metrics: DiagnosisCognitiveMetrics;
  answers: DiagnosisLanguageMicroAnswer[];
  accepted_review_events: number;
  version?: 'v3' | 'v4';
}): DiagnosisResultResponse {
  const onboarding = getDefaultOnboardingProfile(input.onboarding_profile);
  const answers = dedupeAnswers(input.answers);
  const sourceWeights = getDecayedSourceWeights(input.accepted_review_events);
  const languageScores = scoreLanguageAnswers(answers);
  const cognitiveScores = scoreCognitive(input.cognitive_metrics);
  const selfScores = scoreSelfReport(onboarding);
  const confidenceByAxis = buildConfidenceByAxis(languageScores, input.cognitive_metrics, answers.length);
  const adaptiveReasonCodes = deriveAdaptiveReasonTrail(answers, input.cognitive_metrics, onboarding);

  const strategyVector: StrategyVector = {
    recall_gap: clamp01(
      sourceWeights.cognitive * cognitiveScores.recall_gap +
      sourceWeights.language_micro * languageScores.recall_gap,
    ),
    reading_weak: clamp01(
      sourceWeights.cognitive * cognitiveScores.reading_weak +
      sourceWeights.language_micro * languageScores.reading_weak,
    ),
    form_weak: clamp01(
      sourceWeights.cognitive * cognitiveScores.form_weak +
      sourceWeights.language_micro * languageScores.form_weak,
    ),
    load_sensitive: clamp01(
      sourceWeights.self_report * selfScores.load_sensitive +
      sourceWeights.cognitive * cognitiveScores.load_sensitive +
      sourceWeights.language_micro * languageScores.load_sensitive,
    ),
    lateness_fragile: 0,
  };

  const weaknessFlags = deriveWeaknessFlags(strategyVector);
  const evidence: DiagnosisResultResponse['evidence'] = [
    {
      factor: 'recall_gap',
      source: 'cognitive',
      value: round2(cognitiveScores.recognition_rate - cognitiveScores.recall_rate),
      note: `recognition=${percent(cognitiveScores.recognition_rate)}, recall=${percent(cognitiveScores.recall_rate)}`,
    },
    {
      factor: 'recall_gap',
      source: 'language_micro',
      value: round2(languageScores.recall_gap),
      note: `recall_accuracy=${percent(languageScores.recall_accuracy)}, mcq_accuracy=${percent(languageScores.mcq_accuracy)}`,
    },
    {
      factor: 'reading_weak',
      source: 'language_micro',
      value: round2(languageScores.reading_weak),
      note: `surface_to_reading accuracy=${percent(languageScores.reading.accuracy)}, avg_rt=${Math.round(languageScores.reading.avgRt)}ms`,
    },
    {
      factor: 'form_weak',
      source: 'language_micro',
      value: round2(languageScores.form_weak),
      note: `meaning_to_surface accuracy=${percent(languageScores.form.accuracy)}, avg_rt=${Math.round(languageScores.form.avgRt)}ms`,
    },
    {
      factor: 'load_sensitive',
      source: 'cognitive',
      value: round2(cognitiveScores.load_sensitive),
      note: `digit_span=${input.cognitive_metrics.digit_span.max_correct_span}, memory_avg_rt=${Math.round(input.cognitive_metrics.memory_pairs.avg_rt_ms)}ms`,
    },
    {
      factor: 'load_sensitive',
      source: 'self_report',
      value: round2(selfScores.load_sensitive),
      note: `daily_minutes=${onboarding.daily_minutes}, weekly_variability=${onboarding.weekly_variability}, offline_expected=${String(onboarding.offline_expected)}`,
    },
  ];

  return {
    strategy_vector: {
      recall_gap: round2(strategyVector.recall_gap),
      reading_weak: round2(strategyVector.reading_weak),
      form_weak: round2(strategyVector.form_weak),
      load_sensitive: round2(strategyVector.load_sensitive),
      lateness_fragile: 0,
    },
    weakness_flags: Object.entries(weaknessFlags)
      .filter(([, active]) => active)
      .map(([key]) => key),
    notes: buildDiagnosisNotes(strategyVector, weaknessFlags),
    evidence,
    source_weights: sourceWeights,
    version: input.version ?? 'v4',
    question_count: answers.length,
    confidence_by_axis: confidenceByAxis,
    adaptive_reason_codes: adaptiveReasonCodes,
  };
}

export function hydrateDiagnosisResult(
  row: DiagnosisResultRowLike,
  acceptedReviewEvents = 0,
): DiagnosisResultResponse {
  return {
    strategy_vector: {
      recall_gap: round2(row.strategy_vector.recall_gap ?? 0),
      reading_weak: round2(row.strategy_vector.reading_weak ?? 0),
      form_weak: round2(row.strategy_vector.form_weak ?? 0),
      load_sensitive: round2(row.strategy_vector.load_sensitive ?? 0),
      lateness_fragile: round2(row.strategy_vector.lateness_fragile ?? 0),
    },
    weakness_flags: Object.entries(row.weakness_flags ?? {})
      .filter(([, value]) => value)
      .map(([key]) => key),
    notes: row.notes?.length ? row.notes : buildDiagnosisNotes(row.strategy_vector, row.weakness_flags ?? {}),
    evidence: row.evidence ?? [],
    source_weights: row.source_weights
      ? {
          ...row.source_weights,
          ...getDecayedSourceWeights(acceptedReviewEvents, row.completed_at),
        }
      : getDecayedSourceWeights(acceptedReviewEvents, row.completed_at),
    version: row.version ?? 'v2',
    question_count: row.question_count ?? 0,
    confidence_by_axis: row.confidence_by_axis ?? defaultConfidenceByAxis(row.question_count ?? 0),
    adaptive_reason_codes: row.adaptive_reason_codes ?? [],
  };
}

export function buildDiagnosisNotes(
  vector: Partial<StrategyVector>,
  flags: Record<string, boolean>,
): string[] {
  const notes: string[] = [];

  if (flags.reading_weak) {
    notes.push('Reading prompts start with extra emphasis because surface-to-reading accuracy is currently the weakest signal.');
  }
  if (flags.recall_weak) {
    notes.push('Recognition is ahead of free recall, so early plans keep more retrieval practice before increasing MCQ share again.');
  }
  if (flags.form_weak) {
    notes.push('Production and form-confusion checks stay active until meaning-to-surface accuracy stabilizes.');
  }
  if (flags.load_sensitive) {
    notes.push('Shorter chunks and lighter new-card intake are recommended because working-memory load looks fragile.');
  }
  if ((vector.lateness_fragile ?? 0) > 0.4 || flags.lateness_risk) {
    notes.push('Overdue recovery is handled conservatively because late reviews correlate with recall drop.');
  }
  if (notes.length === 0) {
    notes.push('The current profile is balanced, so the default plan keeps a mixed prompt distribution and a standard session chunk.');
  }

  return notes;
}

export function shouldAllowLegacyDiagnosisV2(
  nodeEnv = process.env.NODE_ENV ?? 'development',
  allowFlag = process.env.ALLOW_LEGACY_DIAG_V2 ?? 'false',
): boolean {
  if (nodeEnv === 'production' || nodeEnv === 'staging') {
    return false;
  }

  return allowFlag === 'true';
}

function scoreSelfReport(onboarding: OnboardingProfile): { load_sensitive: number } {
  const variabilityScore = onboarding.weekly_variability === 'high'
    ? 0.55
    : onboarding.weekly_variability === 'medium'
    ? 0.35
    : 0.15;
  const dailyMinutesPenalty = onboarding.daily_minutes <= 10
    ? 0.25
    : onboarding.daily_minutes <= 20
    ? 0.1
    : 0;

  return {
    load_sensitive: clamp01(
      variabilityScore +
      dailyMinutesPenalty +
      (onboarding.offline_expected ? 0.15 : 0) +
      (onboarding.kanji_background === 'none' ? 0.05 : 0),
    ),
  };
}

function scoreCognitive(metrics: DiagnosisCognitiveMetrics): {
  recall_gap: number;
  reading_weak: number;
  form_weak: number;
  load_sensitive: number;
  recall_rate: number;
  recognition_rate: number;
  visual_accuracy: number;
} {
  const recallRate = safeRatio(metrics.memory_pairs.recall_correct, metrics.memory_pairs.recall_total);
  const recognitionRate = safeRatio(metrics.memory_pairs.recognition_correct, metrics.memory_pairs.recognition_total);
  const recallGap = Math.max(0, recognitionRate - recallRate);
  const visualAccuracy = safeRatio(metrics.visual_discrimination.correct, metrics.visual_discrimination.total);
  const digitSpan = metrics.digit_span.max_correct_span ?? 4;

  const memoryRtPenalty = normalizeRt(metrics.memory_pairs.avg_rt_ms);
  const visualRtPenalty = normalizeRt(metrics.visual_discrimination.avg_rt_ms);
  const spanPenalty = clamp01(1 - digitSpan / 7);

  return {
    recall_gap: recallGap,
    reading_weak: recallGap * 0.35,
    form_weak: clamp01((1 - visualAccuracy) * 0.9),
    load_sensitive: clamp01(spanPenalty * 0.55 + memoryRtPenalty * 0.25 + visualRtPenalty * 0.2),
    recall_rate: recallRate,
    recognition_rate: recognitionRate,
    visual_accuracy: visualAccuracy,
  };
}

function scoreLanguageAnswers(answers: DiagnosisLanguageMicroAnswer[]) {
  const rows = answers
    .map((answer) => {
    const item = getDiagLookup().get(answer.id);
      if (!item) return null;

      return {
        item,
        answer,
        correct: normalizeAnswer(answer.answer) === normalizeAnswer(item.answer),
      };
    })
    .filter(Boolean) as Array<{
    item: LegacyDiagItem;
    answer: DiagnosisLanguageMicroAnswer;
    correct: boolean;
  }>;

  const recallRows = rows.filter((row) => row.item.prompt_type !== 'MCQ');
  const mcqRows = rows.filter((row) => row.item.prompt_type === 'MCQ');
  const readingRows = rows.filter((row) => row.item.prompt_type === 'SURFACE_TO_READING');
  const formRows = rows.filter((row) => row.item.prompt_type === 'MEANING_TO_SURFACE');
  const meaningRows = rows.filter((row) => row.item.prompt_type === 'SURFACE_TO_MEANING');

  const recallPerformance = summarizePromptPerformance(recallRows);
  const mcqPerformance = summarizePromptPerformance(mcqRows);
  const readingPerformance = summarizePromptPerformance(readingRows);
  const formPerformance = summarizePromptPerformance(formRows);
  const meaningPerformance = summarizePromptPerformance(meaningRows);
  const globalAverageRt = average(rows.map((row) => row.answer.rt_ms));
  const readingSlowPenalty = readingPerformance.count > 0 && globalAverageRt > 0 && readingPerformance.avgRt > globalAverageRt * 1.15
    ? 0.25
    : 0;

  return {
    recall_gap: Math.max(0, mcqPerformance.accuracy - recallPerformance.accuracy),
    reading_weak: clamp01((1 - readingPerformance.accuracy) * 0.75 + readingSlowPenalty),
    form_weak: clamp01((1 - formPerformance.accuracy) * 0.85 + (formPerformance.slowConflict ? 0.1 : 0)),
    load_sensitive: clamp01(normalizeRt(globalAverageRt) * 0.6 + (1 - recallPerformance.accuracy) * 0.4),
    recall_accuracy: recallPerformance.accuracy,
    mcq_accuracy: mcqPerformance.accuracy,
    reading: readingPerformance,
    form: formPerformance,
    meaning: meaningPerformance,
    counts_by_prompt: {
      SURFACE_TO_MEANING: meaningPerformance.count,
      SURFACE_TO_READING: readingPerformance.count,
      MEANING_TO_SURFACE: formPerformance.count,
      MCQ: mcqPerformance.count,
    },
    conflict_detected: [
      recallPerformance.slowConflict,
      readingPerformance.slowConflict,
      formPerformance.slowConflict,
      meaningPerformance.slowConflict,
    ].some(Boolean),
  };
}

function buildConfidenceByAxis(
  languageScores: ReturnType<typeof scoreLanguageAnswers>,
  cognitiveMetrics: DiagnosisCognitiveMetrics,
  answerCount: number,
): DiagnosisAxisConfidence {
  const loadBase = clamp01(0.45 + Math.min(1, answerCount / 24) * 0.25 + Math.min(1, (cognitiveMetrics.digit_span.max_correct_span ?? 0) / 7) * 0.2);
  const readingBase = axisConfidence(languageScores.reading.count, languageScores.reading.accuracy, languageScores.reading.slowConflict);
  const formBase = axisConfidence(languageScores.form.count, languageScores.form.accuracy, languageScores.form.slowConflict);
  const recallBase = clamp01(
    0.35 +
    Math.min(1, languageScores.counts_by_prompt.SURFACE_TO_MEANING / 6) * 0.25 +
    Math.min(1, languageScores.counts_by_prompt.MCQ / 6) * 0.25 -
    (languageScores.conflict_detected ? 0.15 : 0),
  );

  return {
    recall_gap: round2(recallBase),
    reading_weak: round2(readingBase),
    form_weak: round2(formBase),
    load_sensitive: round2(clamp01(loadBase - (languageScores.conflict_detected ? 0.1 : 0))),
  };
}

function deriveAdaptiveReasonCodes(
  languageScores: ReturnType<typeof scoreLanguageAnswers>,
  confidenceByAxis: DiagnosisAxisConfidence,
  answerCount: number,
): string[] {
  if (answerCount < 24) return [];

  const reasons = new Set<string>();
  const counts = languageScores.counts_by_prompt;

  if (counts.SURFACE_TO_MEANING < 6) reasons.add('insufficient_surface_to_meaning');
  if (counts.SURFACE_TO_READING < 6) reasons.add('insufficient_surface_to_reading');
  if (counts.MEANING_TO_SURFACE < 6) reasons.add('insufficient_meaning_to_surface');
  if (counts.MCQ < 6) reasons.add('insufficient_mcq');

  if (confidenceByAxis.recall_gap < 0.72) reasons.add('low_confidence_recall_gap');
  if (confidenceByAxis.reading_weak < 0.72) reasons.add('low_confidence_reading');
  if (confidenceByAxis.form_weak < 0.72) reasons.add('low_confidence_form');

  if (languageScores.conflict_detected) reasons.add('accuracy_rt_conflict');

  return [...reasons];
}

function deriveAdaptiveReasonTrail(
  answers: DiagnosisLanguageMicroAnswer[],
  cognitiveMetrics: DiagnosisCognitiveMetrics,
  onboarding: OnboardingProfile,
): string[] {
  const reasons = new Set<string>();
  const checkpoints = [24, 30];

  for (const checkpoint of checkpoints) {
    if (answers.length <= checkpoint) continue;
    const result = evaluateDiagnosisBlock({
      answered_items: answers.slice(0, checkpoint),
      cognitive_metrics: cognitiveMetrics,
      onboarding_profile: onboarding,
    });
    result.reason_codes.forEach((reasonCode) => reasons.add(reasonCode));
  }

  return [...reasons];
}

function selectAdaptiveItems(
  reasonCodes: string[],
  answers: DiagnosisLanguageMicroAnswer[],
  onboarding: OnboardingProfile,
): DiagnosisLanguageMicroItem[] {
  const usedIds = new Set(answers.map((answer) => answer.id));
  const remaining = getAllPublicItems().filter((item) => !usedIds.has(item.id));
  if (remaining.length === 0) return [];

  const promptPriority = new Set<DiagnosisPromptType>();
  if (reasonCodes.some((code) => code.includes('recall') || code.includes('surface_to_meaning') || code.includes('mcq'))) {
    promptPriority.add('SURFACE_TO_MEANING');
    promptPriority.add('MCQ');
  }
  if (reasonCodes.some((code) => code.includes('reading'))) {
    promptPriority.add('SURFACE_TO_READING');
  }
  if (reasonCodes.some((code) => code.includes('form') || code.includes('meaning_to_surface'))) {
    promptPriority.add('MEANING_TO_SURFACE');
  }
  if (reasonCodes.includes('accuracy_rt_conflict') && promptPriority.size === 0) {
    promptPriority.add('SURFACE_TO_MEANING');
    promptPriority.add('SURFACE_TO_READING');
    promptPriority.add('MEANING_TO_SURFACE');
  }
  if (onboarding.offline_expected) {
    promptPriority.add('SURFACE_TO_READING');
  }

  const preferred = [
    ...shuffleItems(remaining.filter((item) => promptPriority.has(item.prompt_type))),
    ...shuffleItems(remaining.filter((item) => !promptPriority.has(item.prompt_type))),
  ];

  return preferred.slice(0, 6).map(clonePublicItem);
}

function summarizePromptPerformance(
  rows: Array<{ answer: DiagnosisLanguageMicroAnswer; correct: boolean }>,
): PromptPerformance {
  const accuracyValue = accuracy(rows);
  const averageRt = average(rows.map((row) => row.answer.rt_ms));
  const slowConflict = rows.length >= 3
    ? (accuracyValue >= 0.75 && averageRt >= 3200) || (accuracyValue <= 0.45 && averageRt <= 1500)
    : false;

  return {
    accuracy: accuracyValue,
    avgRt: averageRt,
    count: rows.length,
    slowConflict,
  };
}

function axisConfidence(
  count: number,
  accuracyValue: number,
  slowConflict: boolean,
): number {
  const sampleConfidence = Math.min(1, count / 6);
  const ambiguityPenalty = Math.abs(accuracyValue - 0.5) <= 0.15 ? 0.15 : 0;
  const conflictPenalty = slowConflict ? 0.15 : 0;

  return clamp01(0.35 + sampleConfidence * 0.45 + accuracyValue * 0.2 - ambiguityPenalty - conflictPenalty);
}

function dedupeAnswers(answers: DiagnosisLanguageMicroAnswer[]): DiagnosisLanguageMicroAnswer[] {
  const latestById = new Map<string, DiagnosisLanguageMicroAnswer>();
  for (const answer of answers) {
    latestById.set(answer.id, answer);
  }
  return [...latestById.values()];
}

function toPublicItem(item: LegacyDiagItem): DiagnosisLanguageMicroItem {
  return {
    id: item.id,
    item_id: item.item_id,
    prompt_type: item.prompt_type,
    surface: item.surface,
    reading: item.reading,
    meaning_ko: item.meaning_ko,
    choices: item.choices,
  };
}

function clonePublicItem(item: DiagnosisLanguageMicroItem): DiagnosisLanguageMicroItem {
  return {
    ...item,
    choices: item.choices ? shuffleItems([...item.choices]) : undefined,
  };
}

function shuffleItems<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function defaultConfidenceByAxis(questionCount: number): DiagnosisAxisConfidence {
  const base = questionCount >= 24 ? 0.72 : questionCount >= 6 ? 0.45 : 0.25;
  return {
    recall_gap: base,
    reading_weak: base,
    form_weak: base,
    load_sensitive: base,
  };
}

function normalizeAnswer(value: string): string {
  return value.trim().replace(/\s+/g, '').toLowerCase();
}

function accuracy(rows: Array<{ correct: boolean }>): number {
  if (rows.length === 0) return 0;
  return rows.filter((row) => row.correct).length / rows.length;
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function normalizeRt(rtMs: number): number {
  if (!rtMs || rtMs <= 0) return 0;
  if (rtMs <= 1200) return 0.05;
  if (rtMs <= 2200) return 0.2;
  if (rtMs <= 3200) return 0.4;
  if (rtMs <= 5000) return 0.65;
  return 0.85;
}

function safeRatio(numerator: number, denominator: number): number {
  return denominator > 0 ? numerator / denominator : 0;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

type DiagnosisComponentSeed = {
  key: string;
  surface: string;
  reading: string;
  meaning: string;
};

type GeneratedDiagnosisSeed = {
  key: string;
  surface: string;
  reading: string;
  meaning: string;
};

const PLACE_SEEDS: DiagnosisComponentSeed[] = [
  { key: 'gakkou', surface: '学校', reading: 'がっこう', meaning: '학교' },
  { key: 'toshokan', surface: '図書館', reading: 'としょかん', meaning: '도서관' },
  { key: 'eki', surface: '駅前', reading: 'えきまえ', meaning: '역 앞' },
  { key: 'kyoushitsu', surface: '教室', reading: 'きょうしつ', meaning: '교실' },
  { key: 'byouin', surface: '病院', reading: 'びょういん', meaning: '병원' },
  { key: 'kouen', surface: '公園', reading: 'こうえん', meaning: '공원' },
  { key: 'kenkyuushitsu', surface: '研究室', reading: 'けんきゅうしつ', meaning: '연구실' },
  { key: 'kaigishitsu', surface: '会議室', reading: 'かいぎしつ', meaning: '회의실' },
];

const ACTION_SEEDS: DiagnosisComponentSeed[] = [
  { key: 'benkyou', surface: '勉強する', reading: 'べんきょうする', meaning: '공부하다' },
  { key: 'machiawase', surface: '待ち合わせする', reading: 'まちあわせする', meaning: '만나다' },
  { key: 'soudan', surface: '相談する', reading: 'そうだんする', meaning: '상담하다' },
  { key: 'kyuukei', surface: '休憩する', reading: 'きゅうけいする', meaning: '휴식하다' },
  { key: 'setsumei', surface: '説明する', reading: 'せつめいする', meaning: '설명하다' },
  { key: 'seiri', surface: '整理する', reading: 'せいりする', meaning: '정리하다' },
  { key: 'kiroku', surface: '記録する', reading: 'きろくする', meaning: '기록하다' },
  { key: 'kakunin', surface: '確認する', reading: 'かくにんする', meaning: '확인하다' },
];

const TIME_SEEDS: DiagnosisComponentSeed[] = [
  { key: 'asa', surface: '朝', reading: 'あさ', meaning: '아침' },
  { key: 'hiruyasumi', surface: '昼休み', reading: 'ひるやすみ', meaning: '점심시간' },
  { key: 'houkago', surface: '放課後', reading: 'ほうかご', meaning: '방과 후' },
  { key: 'yuugata', surface: '夕方', reading: 'ゆうがた', meaning: '저녁 무렵' },
  { key: 'konshuu', surface: '今週', reading: 'こんしゅう', meaning: '이번 주' },
  { key: 'ashita', surface: '明日', reading: 'あした', meaning: '내일' },
  { key: 'shuumatsu', surface: '週末', reading: 'しゅうまつ', meaning: '주말' },
  { key: 'kaigigo', surface: '会議後', reading: 'かいぎご', meaning: '회의 후' },
];

const ROUTINE_SEEDS: DiagnosisComponentSeed[] = [
  { key: 'fukushuu', surface: '復習する', reading: 'ふくしゅうする', meaning: '복습하다' },
  { key: 'renraku', surface: '連絡する', reading: 'れんらくする', meaning: '연락하다' },
  { key: 'shuppatsu', surface: '出発する', reading: 'しゅっぱつする', meaning: '출발하다' },
  { key: 'junbi', surface: '準備する', reading: 'じゅんびする', meaning: '준비하다' },
  { key: 'knyuu', surface: '記入する', reading: 'きにゅうする', meaning: '기입하다' },
  { key: 'teishutsu', surface: '提出する', reading: 'ていしゅつする', meaning: '제출하다' },
  { key: 'kyouyuu', surface: '共有する', reading: 'きょうゆうする', meaning: '공유하다' },
  { key: 'renshuu', surface: '練習する', reading: 'れんしゅうする', meaning: '연습하다' },
];

const TOPIC_SEEDS: DiagnosisComponentSeed[] = [
  { key: 'tenki', surface: '天気', reading: 'てんき', meaning: '날씨' },
  { key: 'yotei', surface: '予定', reading: 'よてい', meaning: '예정' },
  { key: 'taichou', surface: '体調', reading: 'たいちょう', meaning: '컨디션' },
  { key: 'yosan', surface: '予算', reading: 'よさん', meaning: '예산' },
  { key: 'tejun', surface: '手順', reading: 'てじゅん', meaning: '절차' },
  { key: 'shiryou', surface: '資料', reading: 'しりょう', meaning: '자료' },
  { key: 'kadai', surface: '課題', reading: 'かだい', meaning: '과제' },
  { key: 'kekka', surface: '結果', reading: 'けっか', meaning: '결과' },
];

const PAIR_SEEDS: DiagnosisComponentSeed[] = [
  { key: 'houshin', surface: '方針', reading: 'ほうしん', meaning: '방침' },
  { key: 'kigen', surface: '期限', reading: 'きげん', meaning: '기한' },
  { key: 'mokuhyou', surface: '目標', reading: 'もくひょう', meaning: '목표' },
  { key: 'jyouhou', surface: '情報', reading: 'じょうほう', meaning: '정보' },
  { key: 'hyouka', surface: '評価', reading: 'ひょうか', meaning: '평가' },
  { key: 'jouken', surface: '条件', reading: 'じょうけん', meaning: '조건' },
  { key: 'keikaku', surface: '計画', reading: 'けいかく', meaning: '계획' },
  { key: 'taiou', surface: '対応', reading: 'たいおう', meaning: '대응' },
];

const CONTEXT_SEEDS: DiagnosisComponentSeed[] = [
  { key: 'kyou', surface: '今日', reading: 'きょう', meaning: '오늘' },
  { key: 'raishuu', surface: '来週', reading: 'らいしゅう', meaning: '다음 주' },
  { key: 'kaigimae', surface: '会議前', reading: 'かいぎまえ', meaning: '회의 전' },
  { key: 'kitakugo', surface: '帰宅後', reading: 'きたくご', meaning: '귀가 후' },
  { key: 'shuppatsumae', surface: '出発前', reading: 'しゅっぱつまえ', meaning: '출발 전' },
  { key: 'renkyuuchuu', surface: '連休中', reading: 'れんきゅうちゅう', meaning: '연휴 중' },
  { key: 'jugyougo', surface: '授業後', reading: 'じゅぎょうご', meaning: '수업 후' },
  { key: 'shinseiji', surface: '申請時', reading: 'しんせいじ', meaning: '신청 시' },
];

const EVENT_SEEDS: DiagnosisComponentSeed[] = [
  { key: 'renraku', surface: '連絡', reading: 'れんらく', meaning: '연락' },
  { key: 'soudan', surface: '相談', reading: 'そうだん', meaning: '상담' },
  { key: 'kakunin', surface: '確認', reading: 'かくにん', meaning: '확인' },
  { key: 'fukushuu', surface: '復習', reading: 'ふくしゅう', meaning: '복습' },
  { key: 'seiri', surface: '整理', reading: 'せいり', meaning: '정리' },
  { key: 'kyouyuu', surface: '共有', reading: 'きょうゆう', meaning: '공유' },
  { key: 'kiroku', surface: '記録', reading: 'きろく', meaning: '기록' },
  { key: 'junbi', surface: '準備', reading: 'じゅんび', meaning: '준비' },
];

function buildGeneratedSurfaceToMeaningItems(): LegacyDiagItem[] {
  const seeds = buildPhraseSeeds('stm', PLACE_SEEDS, ACTION_SEEDS, {
    surfaceJoin: 'で',
    readingJoin: 'で',
    meaningJoin: '에서 ',
  }).slice(0, 48);

  return seeds.map((seed, index) => ({
    id: `diag_stm_${seed.key}`,
    item_id: `diag_item_${seed.key}`,
    prompt_type: 'SURFACE_TO_MEANING',
    surface: seed.surface,
    reading: seed.reading,
    meaning_ko: seed.meaning,
    answer: seed.meaning,
    measures: 'recall_gap',
    tier: index < INITIAL_PROMPT_COUNT ? 'core' : 'adaptive',
  }));
}

function buildGeneratedSurfaceToReadingItems(): LegacyDiagItem[] {
  const seeds = buildPhraseSeeds('str', TIME_SEEDS, ROUTINE_SEEDS, {
    surfaceJoin: 'に',
    readingJoin: 'に',
    meaningJoin: '에 ',
  }).slice(0, 48);

  return seeds.map((seed, index) => ({
    id: `diag_str_${seed.key}`,
    item_id: `diag_item_${seed.key}`,
    prompt_type: 'SURFACE_TO_READING',
    surface: seed.surface,
    reading: seed.reading,
    meaning_ko: seed.meaning,
    answer: seed.reading,
    measures: 'reading_weak',
    tier: index < INITIAL_PROMPT_COUNT ? 'core' : 'adaptive',
  }));
}

function buildGeneratedMeaningToSurfaceItems(): LegacyDiagItem[] {
  const seeds = buildPhraseSeeds('mts', TOPIC_SEEDS, PAIR_SEEDS, {
    surfaceJoin: 'と',
    readingJoin: 'と',
    meaningJoin: '와 ',
  }).slice(0, 48);

  return seeds.map((seed, index, entries) => ({
    id: `diag_mts_${seed.key}`,
    item_id: `diag_item_${seed.key}`,
    prompt_type: 'MEANING_TO_SURFACE',
    surface: seed.surface,
    reading: seed.reading,
    meaning_ko: seed.meaning,
    choices: buildSurfaceChoices(entries, index),
    answer: seed.surface,
    measures: 'form_weak',
    tier: index < INITIAL_PROMPT_COUNT ? 'core' : 'adaptive',
  }));
}

function buildGeneratedMcqItems(): LegacyDiagItem[] {
  const seeds = buildPhraseSeeds('mcq', CONTEXT_SEEDS, EVENT_SEEDS, {
    surfaceJoin: 'の',
    readingJoin: 'の',
    meaningJoin: '의 ',
  }).slice(0, 48);

  return seeds.map((seed, index, entries) => ({
    id: `diag_mcq_${seed.key}`,
    item_id: `diag_item_${seed.key}`,
    prompt_type: 'MCQ',
    surface: seed.surface,
    reading: seed.reading,
    meaning_ko: seed.meaning,
    choices: buildMeaningChoices(entries, index),
    answer: seed.meaning,
    measures: 'recall_gap',
    tier: index < INITIAL_PROMPT_COUNT ? 'core' : 'adaptive',
  }));
}

function buildPhraseSeeds(
  prefix: string,
  leftSeeds: DiagnosisComponentSeed[],
  rightSeeds: DiagnosisComponentSeed[],
  options: {
    surfaceJoin: string;
    readingJoin: string;
    meaningJoin: string;
    surfaceSuffix?: string;
    readingSuffix?: string;
    meaningSuffix?: string;
  },
): GeneratedDiagnosisSeed[] {
  const generated: GeneratedDiagnosisSeed[] = [];

  for (const left of leftSeeds) {
    for (const right of rightSeeds) {
      generated.push({
        key: `${prefix}_${left.key}_${right.key}`,
        surface: `${left.surface}${options.surfaceJoin}${right.surface}${options.surfaceSuffix ?? ''}`,
        reading: `${left.reading}${options.readingJoin}${right.reading}${options.readingSuffix ?? ''}`,
        meaning: `${left.meaning}${options.meaningJoin}${right.meaning}${options.meaningSuffix ?? ''}`,
      });
    }
  }

  return shuffleItems(generated);
}

function buildSurfaceChoices(entries: GeneratedDiagnosisSeed[], index: number): string[] {
  const correct = entries[index].surface;
  const decoys = uniqueValues([
    entries[(index + 1) % entries.length].surface,
    entries[(index + 7) % entries.length].surface,
    entries[(index + 13) % entries.length].surface,
  ]).filter((value) => value !== correct).slice(0, 3);

  return [correct, ...decoys];
}

function buildMeaningChoices(entries: GeneratedDiagnosisSeed[], index: number): string[] {
  const correct = entries[index].meaning;
  const decoys = uniqueValues([
    entries[(index + 2) % entries.length].meaning,
    entries[(index + 9) % entries.length].meaning,
    entries[(index + 15) % entries.length].meaning,
  ]).filter((value) => value !== correct).slice(0, 3);

  return [correct, ...decoys];
}

function uniqueValues(values: string[]): string[] {
  return [...new Set(values)];
}

function buildSurfaceToMeaningItems(): LegacyDiagItem[] {
  const seeds = [
    ['gakkou', '学校', 'school'],
    ['jikan', '時間', 'time'],
    ['yakusoku', '約束', 'promise'],
    ['tomodachi', '友達', 'friend'],
    ['byouin', '病院', 'hospital'],
    ['keiken', '経験', 'experience'],
    ['daigaku', '大学', 'university'],
    ['kyoushitsu', '教室', 'classroom'],
    ['toshokan', '図書館', 'library'],
  ] as const;

  return seeds.map(([key, surface, meaning], index) => ({
    id: `diag_stm_${index + 1}`,
    item_id: `diag_item_stm_${key}`,
    prompt_type: 'SURFACE_TO_MEANING',
    surface,
    reading: key,
    meaning_ko: meaning,
    answer: meaning,
    measures: 'recall_gap',
    tier: index < 6 ? 'core' : 'adaptive',
  }));
}

function buildSurfaceToReadingItems(): LegacyDiagItem[] {
  const seeds = [
    ['kaisha', '会社', 'company'],
    ['shigoto', '仕事', 'work'],
    ['densha', '電車', 'train'],
    ['kuruma', '車', 'car'],
    ['hon', '本', 'book'],
    ['mizu', '水', 'water'],
    ['tenki', '天気', 'weather'],
    ['ryokou', '旅行', 'trip'],
    ['benkyou', '勉強', 'study'],
  ] as const;

  return seeds.map(([reading, surface, meaning], index) => ({
    id: `diag_str_${index + 1}`,
    item_id: `diag_item_str_${reading}`,
    prompt_type: 'SURFACE_TO_READING',
    surface,
    reading,
    meaning_ko: meaning,
    answer: reading,
    measures: 'reading_weak',
    tier: index < 6 ? 'core' : 'adaptive',
  }));
}

function buildMeaningToSurfaceItems(): LegacyDiagItem[] {
  const seeds = [
    { key: 'dog', surface: '犬', reading: 'inu', meaning: 'dog', choices: ['犬', '猫', '山', '海'] },
    { key: 'cat', surface: '猫', reading: 'neko', meaning: 'cat', choices: ['海', '猫', '家', '店'] },
    { key: 'mountain', surface: '山', reading: 'yama', meaning: 'mountain', choices: ['朝', '夜', '山', '電話'] },
    { key: 'sea', surface: '海', reading: 'umi', meaning: 'sea', choices: ['海', '映画', '新聞', '手紙'] },
    { key: 'house', surface: '家', reading: 'ie', meaning: 'house', choices: ['店', '家', '犬', '図書館'] },
    { key: 'store', surface: '店', reading: 'mise', meaning: 'store', choices: ['教室', '店', '友達', '大学'] },
    { key: 'morning', surface: '朝', reading: 'asa', meaning: 'morning', choices: ['夜', '朝', '天気', '病院'] },
    { key: 'night', surface: '夜', reading: 'yoru', meaning: 'night', choices: ['夜', '約束', '時間', '本'] },
    { key: 'phone', surface: '電話', reading: 'denwa', meaning: 'phone', choices: ['電車', '電話', '経験', '会社'] },
  ] as const;

  return seeds.map((seed, index) => ({
    id: `diag_mts_${index + 1}`,
    item_id: `diag_item_mts_${seed.key}`,
    prompt_type: 'MEANING_TO_SURFACE',
    surface: seed.surface,
    reading: seed.reading,
    meaning_ko: seed.meaning,
    choices: [...seed.choices],
    answer: seed.surface,
    measures: 'form_weak',
    tier: index < 6 ? 'core' : 'adaptive',
  }));
}

function buildMcqItems(): LegacyDiagItem[] {
  const seeds = [
    { key: 'today', surface: '今日', reading: 'kyou', meaning: 'today', choices: ['tomorrow', 'teacher', 'today', 'movie'] },
    { key: 'tomorrow', surface: '明日', reading: 'ashita', meaning: 'tomorrow', choices: ['today', 'letter', 'food', 'tomorrow'] },
    { key: 'teacher', surface: '先生', reading: 'sensei', meaning: 'teacher', choices: ['teacher', 'meeting', 'drink', 'newspaper'] },
    { key: 'meeting', surface: '会議', reading: 'kaigi', meaning: 'meeting', choices: ['newspaper', 'meeting', 'movie', 'food'] },
    { key: 'newspaper', surface: '新聞', reading: 'shinbun', meaning: 'newspaper', choices: ['trip', 'drink', 'newspaper', 'teacher'] },
    { key: 'movie', surface: '映画', reading: 'eiga', meaning: 'movie', choices: ['movie', 'book', 'letter', 'today'] },
    { key: 'food', surface: '食べ物', reading: 'tabemono', meaning: 'food', choices: ['drink', 'food', 'friend', 'morning'] },
    { key: 'drink', surface: '飲み物', reading: 'nomimono', meaning: 'drink', choices: ['food', 'drink', 'weather', 'night'] },
    { key: 'letter', surface: '手紙', reading: 'tegami', meaning: 'letter', choices: ['letter', 'meeting', 'teacher', 'company'] },
  ] as const;

  return seeds.map((seed, index) => ({
    id: `diag_mcq_${index + 1}`,
    item_id: `diag_item_mcq_${seed.key}`,
    prompt_type: 'MCQ',
    surface: seed.surface,
    reading: seed.reading,
    meaning_ko: seed.meaning,
    choices: [...seed.choices],
    answer: seed.meaning,
    measures: 'recall_gap',
    tier: index < 6 ? 'core' : 'adaptive',
  }));
}
