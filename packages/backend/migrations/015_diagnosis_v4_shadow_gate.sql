BEGIN;

ALTER TABLE diagnosis_results
  ADD COLUMN IF NOT EXISTS question_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS confidence_by_axis JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS adaptive_reason_codes JSONB NOT NULL DEFAULT '[]';

COMMENT ON COLUMN diagnosis_results.question_count IS
  'Actual number of adaptive language questions answered for diagnosis v4.';

COMMENT ON COLUMN diagnosis_results.confidence_by_axis IS
  'Per-axis confidence estimates used to decide whether adaptive follow-up was required.';

COMMENT ON COLUMN diagnosis_results.adaptive_reason_codes IS
  'Reason codes that explain why adaptive follow-up blocks were opened.';

ALTER TABLE model_params
  ADD COLUMN IF NOT EXISTS eligibility_state TEXT NOT NULL DEFAULT 'hold',
  ADD COLUMN IF NOT EXISTS metrics_json JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS recommended_action TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_model_params_eligibility_state'
  ) THEN
    ALTER TABLE model_params
      ADD CONSTRAINT chk_model_params_eligibility_state
      CHECK (eligibility_state IN ('ready', 'hold', 'insufficient_data'));
  END IF;
END $$;

COMMENT ON COLUMN model_params.eligibility_state IS
  'Shadow gate readiness state for user-level HLR promotion.';

COMMENT ON COLUMN model_params.metrics_json IS
  'Detailed shadow-vs-baseline metrics for prompt types and overdue segments.';

COMMENT ON COLUMN model_params.recommended_action IS
  'Primary reason code that explains why the shadow gate is still holding.';

COMMIT;
