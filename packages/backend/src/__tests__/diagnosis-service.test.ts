import {
  evaluateDiagnosisBlock,
  getDecayedSourceWeights,
  getDiagnosisAdaptivePool,
  getDiagnosisCoreItems,
  scoreDiagnosisV4,
  shouldAllowLegacyDiagnosisV2,
} from '../services/diagnosis-service';

const cognitiveMetrics = {
  memory_pairs: {
    recall_correct: 2,
    recall_total: 3,
    recognition_correct: 3,
    recognition_total: 3,
    avg_rt_ms: 1900,
  },
  digit_span: { max_correct_span: 5 },
  visual_discrimination: {
    correct: 2,
    total: 3,
    avg_rt_ms: 1800,
  },
};

const onboarding = {
  target_level: 'JLPT_N5',
  target_date: null,
  focus: ['READING'],
  daily_minutes: 20,
  weekly_variability: 'medium' as const,
  offline_expected: false,
  kanji_background: 'none' as const,
  notifications_opt_in: false,
  weak_areas: ['reading'],
};

describe('diagnosis-service', () => {
  it('builds a 24-question core and 12-question adaptive pool without duplicate item ids', () => {
    const core = getDiagnosisCoreItems();
    const adaptive = getDiagnosisAdaptivePool();
    const all = [...core, ...adaptive];

    expect(core).toHaveLength(24);
    expect(adaptive).toHaveLength(12);
    expect(new Set(all.map((item) => item.item_id)).size).toBe(36);

    const coreCounts = countByPrompt(core);
    const adaptiveCounts = countByPrompt(adaptive);
    expect(coreCounts.SURFACE_TO_MEANING).toBe(6);
    expect(coreCounts.SURFACE_TO_READING).toBe(6);
    expect(coreCounts.MEANING_TO_SURFACE).toBe(6);
    expect(coreCounts.MCQ).toBe(6);
    expect(adaptiveCounts.SURFACE_TO_MEANING).toBe(3);
    expect(adaptiveCounts.SURFACE_TO_READING).toBe(3);
    expect(adaptiveCounts.MEANING_TO_SURFACE).toBe(3);
    expect(adaptiveCounts.MCQ).toBe(3);
  });

  it('does not derive reading weakness directly from self-report when language evidence is unchanged', () => {
    const baseAnswers = getDiagnosisCoreItems()
      .slice(0, 24)
      .map((item) => ({
        id: item.id,
        prompt_type: item.prompt_type,
        answer: answerFor(item),
        rt_ms: 1600,
      }));

    const resultA = scoreDiagnosisV4({
      onboarding_profile: { ...onboarding, weak_areas: [] },
      cognitive_metrics: cognitiveMetrics,
      answers: baseAnswers,
      accepted_review_events: 0,
    });

    const resultB = scoreDiagnosisV4({
      onboarding_profile: { ...onboarding, weak_areas: ['reading'] },
      cognitive_metrics: cognitiveMetrics,
      answers: baseAnswers,
      accepted_review_events: 0,
    });

    expect(resultA.strategy_vector.reading_weak).toBe(resultB.strategy_vector.reading_weak);
  });

  it('opens an adaptive block when reading confidence stays low after the core 24', () => {
    let readingIndex = 0;
    const answers = getDiagnosisCoreItems().map((item) => {
      if (item.prompt_type !== 'SURFACE_TO_READING') {
        return {
          id: item.id,
          prompt_type: item.prompt_type,
          answer: answerFor(item),
          rt_ms: 1400,
        };
      }

      readingIndex += 1;
      const keepCorrect = readingIndex <= 1;

      return {
        id: item.id,
        prompt_type: item.prompt_type,
        answer: keepCorrect ? answerFor(item) : 'wrong',
        rt_ms: 1200,
      };
    });

    const evaluation = evaluateDiagnosisBlock({
      answered_items: answers,
      cognitive_metrics: cognitiveMetrics,
      onboarding_profile: onboarding,
    });

    expect(evaluation.done).toBe(false);
    expect(evaluation.next_items).toHaveLength(6);
    expect(evaluation.reason_codes).toEqual(expect.arrayContaining(['low_confidence_reading']));
    expect(evaluation.confidence_by_axis.reading_weak).toBeLessThan(0.72);
  });

  it('returns question_count and adaptive reason trail in diagnosis v4 results', () => {
    const core = getDiagnosisCoreItems();
    const adaptive = getDiagnosisAdaptivePool();
    const answers = [...core, ...adaptive.slice(0, 6)].map((item) => ({
      id: item.id,
      prompt_type: item.prompt_type,
      answer: item.prompt_type === 'SURFACE_TO_READING' && adaptive.slice(0, 6).some((candidate) => candidate.id === item.id)
        ? 'wrong'
        : answerFor(item),
      rt_ms: 1800,
    }));

    const result = scoreDiagnosisV4({
      onboarding_profile: onboarding,
      cognitive_metrics: cognitiveMetrics,
      answers,
      accepted_review_events: 12,
    });

    expect(result.version).toBe('v4');
    expect(result.question_count).toBe(30);
    expect(result.confidence_by_axis).toBeDefined();
    expect(result.adaptive_reason_codes).toBeDefined();
  });

  it('decays self-report source weight at 20 and 50 accepted review events', () => {
    expect(getDecayedSourceWeights(0).self_report).toBe(0.2);
    expect(getDecayedSourceWeights(20).self_report).toBe(0.1);
    expect(getDecayedSourceWeights(50).self_report).toBe(0);
  });

  it('retires diagnosis v2 unless an explicit dev fallback flag is enabled', () => {
    expect(shouldAllowLegacyDiagnosisV2('production', 'true')).toBe(false);
    expect(shouldAllowLegacyDiagnosisV2('staging', 'true')).toBe(false);
    expect(shouldAllowLegacyDiagnosisV2('development', 'false')).toBe(false);
    expect(shouldAllowLegacyDiagnosisV2('development', 'true')).toBe(true);
  });
});

function countByPrompt(items: Array<{ prompt_type: string }>) {
  return items.reduce<Record<string, number>>((acc, item) => {
    acc[item.prompt_type] = (acc[item.prompt_type] ?? 0) + 1;
    return acc;
  }, {});
}

function answerFor(item: { prompt_type: string; surface: string; reading: string; meaning_ko: string; choices?: string[] }) {
  if (item.prompt_type === 'SURFACE_TO_MEANING' || item.prompt_type === 'MCQ') return item.meaning_ko;
  if (item.prompt_type === 'SURFACE_TO_READING') return item.reading;
  return item.surface;
}
