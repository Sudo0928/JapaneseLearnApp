-- 008_diagnosis_v2.sql
-- diagnosis_results: accuracy 컬럼 추가 + user_id unique constraint
-- (submit-v2 endpoint 및 플랜 화면 지원)

BEGIN;

-- accuracy 컬럼 추가 (없는 경우에만)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'diagnosis_results' AND column_name = 'accuracy'
  ) THEN
    ALTER TABLE diagnosis_results ADD COLUMN accuracy NUMERIC(5,3) DEFAULT 0;
  END IF;
END $$;

-- user_id unique constraint 추가 (사용자당 최신 결과 1개 유지)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_diagnosis_results_user_id'
  ) THEN
    -- 중복 행 제거 (keep latest)
    DELETE FROM diagnosis_results dr
    WHERE dr.id NOT IN (
      SELECT DISTINCT ON (user_id) id
      FROM diagnosis_results
      ORDER BY user_id, completed_at DESC
    );

    ALTER TABLE diagnosis_results
      ADD CONSTRAINT uq_diagnosis_results_user_id UNIQUE (user_id);
  END IF;
END $$;

COMMIT;
