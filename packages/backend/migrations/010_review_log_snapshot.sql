-- ============================================================
-- Migration 010: review_log event-time snapshot columns
-- 목적: 과거 이벤트 분석이 현재 card_state에 오염되지 않도록
--       리뷰 시점의 카드 상태 스냅샷을 review_log에 함께 저장한다.
-- ============================================================

BEGIN;

ALTER TABLE review_log
  ADD COLUMN IF NOT EXISTS due_ts_at_review TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS interval_days_at_review REAL,
  ADD COLUMN IF NOT EXISTS ease_factor_at_review REAL,
  ADD COLUMN IF NOT EXISTS repetitions_at_review INTEGER,
  ADD COLUMN IF NOT EXISTS state_at_review TEXT
    CHECK (state_at_review IN ('new', 'learning', 'review', 'relearning')),
  ADD COLUMN IF NOT EXISTS is_new_at_review BOOLEAN;

COMMENT ON COLUMN review_log.due_ts_at_review IS '리뷰 직전 card_state.due_ts 스냅샷';
COMMENT ON COLUMN review_log.interval_days_at_review IS '리뷰 직전 card_state.interval_days 스냅샷';
COMMENT ON COLUMN review_log.ease_factor_at_review IS '리뷰 직전 card_state.ease_factor 스냅샷';
COMMENT ON COLUMN review_log.repetitions_at_review IS '리뷰 직전 card_state.repetitions 스냅샷';
COMMENT ON COLUMN review_log.state_at_review IS '리뷰 직전 card_state.state 스냅샷';
COMMENT ON COLUMN review_log.is_new_at_review IS '리뷰 직전 카드가 신규(new) 상태였는지 여부';

CREATE INDEX IF NOT EXISTS idx_review_log_user_ts_snapshot
  ON review_log(user_id, ts DESC, due_ts_at_review);

COMMIT;
