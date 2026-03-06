-- ============================================================
-- Migration 005: 집계 테이블 (Sprint 4-4, Sprint 5-1용)
-- ============================================================

BEGIN;

-- -------------------------------------------------------
-- user_error_agg: 사용자별 오류 유형 집계 (혼동쌍 캐시)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_error_agg (
    user_id         TEXT        NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    window_days     INTEGER     NOT NULL CHECK (window_days IN (7, 28)),
    top_pairs_json  JSONB       NOT NULL DEFAULT '[]',
    computed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (user_id, window_days)
);

COMMENT ON TABLE user_error_agg IS '혼동쌍 집계 캐시. 일배치로 갱신. top_pairs_json: ConfusionPair[]';

-- -------------------------------------------------------
-- user_daily_agg: 일별 학습 통계 (주간 리포트용)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_daily_agg (
    user_id         TEXT        NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    day             DATE        NOT NULL,
    reviews         INTEGER     NOT NULL DEFAULT 0,
    new_cards       INTEGER     NOT NULL DEFAULT 0,
    correct_rate    REAL,
    p50_rt_ms       INTEGER,
    p90_rt_ms       INTEGER,
    lateness_p50_sec REAL,
    computed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (user_id, day)
);

CREATE INDEX IF NOT EXISTS idx_user_daily_agg_user_day
    ON user_daily_agg (user_id, day DESC);

COMMENT ON TABLE user_daily_agg IS '사용자 일별 학습 통계. 일배치로 갱신.';

-- -------------------------------------------------------
-- diagnosis_results: 진단 테스트 결과 저장
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS diagnosis_results (
    id              SERIAL      PRIMARY KEY,
    user_id         TEXT        NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    strategy_vector JSONB       NOT NULL,
    weakness_flags  JSONB       NOT NULL,
    event_count     INTEGER     NOT NULL DEFAULT 0,
    completed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    version         TEXT        NOT NULL DEFAULT 'v1'
);

CREATE INDEX IF NOT EXISTS idx_diagnosis_results_user
    ON diagnosis_results (user_id, completed_at DESC);

COMMENT ON TABLE diagnosis_results IS '진단 테스트 결과. strategy_vector v0 저장.';

COMMIT;
