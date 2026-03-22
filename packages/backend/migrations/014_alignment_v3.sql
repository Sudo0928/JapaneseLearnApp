BEGIN;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS onboarding_profile JSONB;

COMMENT ON COLUMN users.onboarding_profile IS
  'Structured onboarding profile used by diagnosis v3 and goal-aware plan generation.';

ALTER TABLE diagnosis_results
  ADD COLUMN IF NOT EXISTS evidence JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS source_weights JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS notes JSONB NOT NULL DEFAULT '[]';

ALTER TABLE review_log
  ADD COLUMN IF NOT EXISTS shadow_half_life_at_review REAL,
  ADD COLUMN IF NOT EXISTS shadow_pred_recall REAL,
  ADD COLUMN IF NOT EXISTS shadow_model_ver TEXT,
  ADD COLUMN IF NOT EXISTS client_network_state TEXT,
  ADD COLUMN IF NOT EXISTS client_last_successful_sync_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS client_queue_depth INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_review_log_client_network_state'
  ) THEN
    ALTER TABLE review_log
      ADD CONSTRAINT chk_review_log_client_network_state
      CHECK (
        client_network_state IS NULL
        OR client_network_state IN ('offline', 'wifi', 'cellular', 'unknown')
      );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS model_params (
  user_id TEXT PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
  model_ver TEXT NOT NULL,
  params_json JSONB NOT NULL DEFAULT '{}',
  calibration_score JSONB NOT NULL DEFAULT '{}',
  source_event_count INTEGER NOT NULL DEFAULT 0,
  fitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_shadow_eval_at TIMESTAMPTZ
);

COMMENT ON TABLE model_params IS
  'Per-user shadow model metadata for HLR-lite evaluation and later model fitting.';

ALTER TABLE experiment_definitions
  ADD COLUMN IF NOT EXISTS purpose TEXT,
  ADD COLUMN IF NOT EXISTS opt_out_supported BOOLEAN NOT NULL DEFAULT true;

UPDATE experiment_definitions
SET purpose = COALESCE(
      purpose,
      CASE exp_id
        WHEN 'aa_baseline_v1' THEN 'Validate assignment balance before behavior-changing rollouts.'
        WHEN 'ab_plan_mix' THEN 'Evaluate whether reading-heavy plan mix improves downstream recall.'
        ELSE description
      END
    ),
    opt_out_supported = COALESCE(opt_out_supported, true);

COMMIT;
