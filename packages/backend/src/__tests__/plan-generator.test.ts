import type { PlanExplanationReceipt } from '@japanese-learn/shared';
import type { PlanConfig } from '../services/rule-engine';
import { applyGoalAwareAdjustments } from '../services/plan-generator';

function makeConfig(): PlanConfig {
  return {
    retention_target: 0.85,
    daily_budget: {
      minutes: 20,
      new_count: 10,
      review_count: 20,
      error_drill_count: 2,
    },
    mix: {
      SURFACE_TO_MEANING: 0.4,
      MEANING_TO_SURFACE: 0.1,
      SURFACE_TO_READING: 0.25,
      MCQ: 0.2,
      CLOZE: 0.05,
      LISTENING: 0,
    },
    ui_policy: {
      hint_steps: 2,
      show_example_by_default: false,
      mini_handwriting: false,
      session_chunk_min: 20,
    },
    notes: [],
    rule_log: [],
  };
}

describe('plan-generator goal-aware counterfactuals', () => {
  it('adds counterfactuals only for target_date, focus, and offline_expected', () => {
    const config = makeConfig();
    const receipt: PlanExplanationReceipt[] = [];
    let retentionTarget = config.retention_target;

    applyGoalAwareAdjustments({
      goal: {
        target_level: 'JLPT_N5',
        target_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        focus: ['READING', 'VOCAB'],
      },
      constraints: {
        daily_minutes: 20,
        offline_expected: true,
      },
      config,
      receipt,
      retentionTargetRef: (value) => {
        retentionTarget = value;
      },
    });

    expect(retentionTarget).toBeGreaterThan(0.85);
    expect(receipt).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ factor: 'target_date', counterfactual: expect.stringContaining('Without target_date') }),
        expect.objectContaining({ factor: 'focus_reading', counterfactual: expect.stringContaining('Without READING focus') }),
        expect.objectContaining({ factor: 'focus_production', counterfactual: expect.stringContaining('Without VOCAB/PRODUCTION focus') }),
        expect.objectContaining({ factor: 'offline_expected', counterfactual: expect.stringContaining('Without offline_expected') }),
      ]),
    );
  });
});
