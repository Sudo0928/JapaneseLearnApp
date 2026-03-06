-- ============================================================
-- Migration 002: card_state 테이블 (Sprint 2 - P0)
-- 목적: SM-2 기반 사용자별 카드 스케줄 상태 저장
-- ============================================================

BEGIN;

-- -------------------------------------------------------
-- card_state: 사용자 × 카드 학습 상태 (SRS 스케줄)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS card_state (
    user_id         TEXT        NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    card_id         TEXT        NOT NULL REFERENCES cards(card_id) ON DELETE CASCADE,

    -- SRS 스케줄 핵심 필드
    due_ts          TIMESTAMPTZ NOT NULL DEFAULT NOW(),  -- 다음 복습 예정 시각
    interval_days   REAL        NOT NULL DEFAULT 0,      -- 현재 복습 간격(일). 0=신규
    ease_factor     REAL        NOT NULL DEFAULT 2.5,    -- SM-2 EF (1.3 ~ 4.0)
    repetitions     INTEGER     NOT NULL DEFAULT 0,      -- 연속 정답 횟수 (SM-2 n)
    stability       REAL        NOT NULL DEFAULT 0.0,    -- HLR-lite 반감기(일) — 향후 사용

    -- 상태 분류
    state           TEXT        NOT NULL DEFAULT 'new'
                    CHECK (state IN ('new', 'learning', 'review', 'relearning')),

    -- 이력
    last_reviewed_at TIMESTAMPTZ,                        -- 마지막 복습 시각
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (user_id, card_id)
);

-- 오늘 할 일 쿼리 최적화: due_ts 기준 정렬
CREATE INDEX IF NOT EXISTS idx_card_state_due
    ON card_state (user_id, due_ts ASC)
    WHERE state IN ('learning', 'review', 'relearning');

-- 신규 카드 조회 최적화
CREATE INDEX IF NOT EXISTS idx_card_state_new
    ON card_state (user_id, created_at ASC)
    WHERE state = 'new';

COMMENT ON TABLE card_state IS '사용자별 카드 SRS 상태. SM-2 기반 스케줄 관리. 서버에서 review_log를 재적용해 재계산 가능.';
COMMENT ON COLUMN card_state.ease_factor IS 'SM-2 Ease Factor. 범위: 1.3~4.0, 초기값: 2.5';
COMMENT ON COLUMN card_state.stability IS 'HLR-lite 반감기(일). Sprint 4 이후 활성화.';

-- -------------------------------------------------------
-- updated_at 자동 갱신 트리거
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION update_card_state_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_card_state_updated_at
    BEFORE UPDATE ON card_state
    FOR EACH ROW EXECUTE FUNCTION update_card_state_timestamp();

COMMIT;
