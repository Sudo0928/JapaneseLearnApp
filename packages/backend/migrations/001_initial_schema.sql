-- ============================================================
-- Migration 001: 초기 스키마 (Sprint 1 - P0)
-- 목적: review_log(append-only 원천 이벤트) 테이블 생성
-- ============================================================

BEGIN;

-- 확장: uuid 생성 지원
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -------------------------------------------------------
-- users: 사용자 프로필 (최소 수집, 가명 처리)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    user_id         TEXT        PRIMARY KEY,           -- 가명 처리 ID (u_xxxx 형식)
    tz              TEXT        NOT NULL DEFAULT 'Asia/Tokyo',
    locale          TEXT        NOT NULL DEFAULT 'ja',
    consent_flags   JSONB       NOT NULL DEFAULT '{}', -- { required: bool, optional: bool, research: bool }
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE users IS '사용자 프로필. 최소 수집 원칙: 실명/이메일 미저장, 가명 ID만 사용.';
COMMENT ON COLUMN users.consent_flags IS '동의 플래그. { required: 필수 동의, optional: 선택 동의, research: 연구 참여(기본 false) }';

-- -------------------------------------------------------
-- items: 단어/한자 콘텐츠 (카드의 원천)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS items (
    item_id         TEXT        PRIMARY KEY,           -- it_xxxx 형식
    surface         TEXT        NOT NULL,              -- 표기 (한자 포함). 예: 経験
    reading         TEXT,                              -- 읽기 (히라가나). 예: けいけん
    meaning_ko      TEXT,                              -- 뜻 (한국어). 예: 경험
    tags            TEXT[]      NOT NULL DEFAULT '{}', -- 분류 태그. 예: ['N3', 'verb']
    license_meta    JSONB       NOT NULL DEFAULT '{}', -- 콘텐츠 라이선스 메타 (미지정 → 추후 확정)
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE items IS '학습 콘텐츠 단위. 라이선스 정책 확정 전까지 license_meta 필수 추적.';

-- -------------------------------------------------------
-- cards: 카드 단위 (item + prompt_type 조합)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS cards (
    card_id         TEXT        PRIMARY KEY,           -- c_it_xxxx_PROMPT_TYPE 형식
    item_id         TEXT        NOT NULL REFERENCES items(item_id) ON DELETE CASCADE,
    prompt_type     TEXT        NOT NULL
                    CHECK (prompt_type IN (
                        'SURFACE_TO_MEANING', 'MEANING_TO_SURFACE',
                        'SURFACE_TO_READING', 'MCQ', 'CLOZE', 'LISTENING'
                    )),
    template_ver    TEXT        NOT NULL DEFAULT '1.0',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (item_id, prompt_type)
);

COMMENT ON TABLE cards IS '카드 = item × prompt_type 조합. 같은 아이템도 문항 유형마다 별도 카드.';

-- -------------------------------------------------------
-- review_log: 학습 이벤트 원천 로그 (append-only)
-- 절대 UPDATE/DELETE 금지. 오류 보정은 보정 이벤트로 처리.
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS review_log (
    event_id        TEXT        PRIMARY KEY,           -- idempotency 키 (evt_YYYYMMDD_xxxx)
    user_id         TEXT        NOT NULL REFERENCES users(user_id),
    card_id         TEXT        NOT NULL REFERENCES cards(card_id),
    item_id         TEXT,                              -- 비정규화 (조회 성능)
    ts              TIMESTAMPTZ NOT NULL,              -- 이벤트 발생 시각 (클라이언트 제공)
    ingested_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),-- 서버 수신 시각
    prompt_type     TEXT        NOT NULL,
    correct         BOOLEAN     NOT NULL,
    rt_ms           INTEGER     NOT NULL CHECK (rt_ms >= 0 AND rt_ms <= 300000),
    attempt_count   SMALLINT    NOT NULL DEFAULT 1,
    hint_level      SMALLINT    NOT NULL DEFAULT 0,
    confidence      REAL,                              -- 0.0~1.0, NULL 허용
    error_type      TEXT        NOT NULL DEFAULT 'NONE'
                    CHECK (error_type IN (
                        'NONE', 'READING_CONFUSION', 'FORM_SIMILAR',
                        'MEANING_NEAR', 'NO_RECALL', 'TYPO'
                    )),
    device          TEXT        NOT NULL DEFAULT 'UNKNOWN'
                    CHECK (device IN ('IOS', 'ANDROID', 'WEB', 'UNKNOWN')),
    offline         BOOLEAN     NOT NULL DEFAULT FALSE,
    schema_version  TEXT        NOT NULL DEFAULT '1.0.0'
);

-- 조회 최적화 인덱스
CREATE INDEX IF NOT EXISTS idx_review_log_user_ts    ON review_log(user_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_review_log_card       ON review_log(card_id);
CREATE INDEX IF NOT EXISTS idx_review_log_item       ON review_log(item_id);
CREATE INDEX IF NOT EXISTS idx_review_log_ingested   ON review_log(ingested_at DESC);

COMMENT ON TABLE review_log IS 'append-only 학습 이벤트 로그. UPDATE/DELETE 금지. idempotency: event_id PK로 중복 삽입 무시.';
COMMENT ON COLUMN review_log.ts IS '클라이언트가 기록한 이벤트 발생 시각. 오프라인 학습 시 과거 시각일 수 있음.';
COMMENT ON COLUMN review_log.ingested_at IS '서버 수신 시각. 동기화 지연 분석에 사용.';

COMMIT;
