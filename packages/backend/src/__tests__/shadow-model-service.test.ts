import { evaluateShadowRows } from '../services/shadow-model-service';

describe('shadow-model-service', () => {
  it('marks a user as ready when shadow metrics beat the baseline with enough data', () => {
    const rows = Array.from({ length: 500 }, (_, index) => ({
      prompt_type: index % 2 === 0 ? 'SURFACE_TO_READING' : 'MEANING_TO_SURFACE',
      shadow_pred_recall: index % 2 === 0 ? 0.88 : 0.82,
      correct: true,
      shadow_half_life_at_review: 4.5,
      interval_days_at_review: 2,
      due_ts_at_review: new Date('2026-03-01T00:00:00Z'),
      ts: new Date('2026-03-02T00:00:00Z'),
    }));

    const result = evaluateShadowRows(rows, { scope: 'user', minimumEventCount: 500 });
    expect(result.eligibility_state).toBe('ready');
    expect(result.recommended_action).toBeNull();
  });

  it('holds when prompt-type regressions exceed the guardrail', () => {
    const rows = Array.from({ length: 500 }, (_, index) => ({
      prompt_type: index < 50 ? 'SURFACE_TO_READING' : 'MEANING_TO_SURFACE',
      shadow_pred_recall: index < 50 ? 0.33 : 0.92,
      correct: true,
      shadow_half_life_at_review: 2,
      interval_days_at_review: 2,
      due_ts_at_review: new Date('2026-03-01T00:00:00Z'),
      ts: new Date('2026-03-02T00:00:00Z'),
    }));

    const result = evaluateShadowRows(rows, { scope: 'user', minimumEventCount: 500 });
    expect(result.eligibility_state).toBe('hold');
    expect(result.recommended_action).toBeTruthy();
  });

  it('returns insufficient_data when the event threshold is not met', () => {
    const rows = Array.from({ length: 32 }, () => ({
      prompt_type: 'SURFACE_TO_READING',
      shadow_pred_recall: 0.8,
      correct: true,
      shadow_half_life_at_review: 3,
      interval_days_at_review: 2,
      due_ts_at_review: new Date('2026-03-01T00:00:00Z'),
      ts: new Date('2026-03-02T00:00:00Z'),
    }));

    const result = evaluateShadowRows(rows, { scope: 'user', minimumEventCount: 500 });
    expect(result.eligibility_state).toBe('insufficient_data');
    expect(result.recommended_action).toBe('need_more_user_events');
  });
});
