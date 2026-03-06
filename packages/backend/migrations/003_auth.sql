-- ============================================================
-- Migration 003: OAuth 계정 연결 테이블 (Sprint 3 - P0)
-- 목적: Google OAuth 연결 정보 저장 (토큰 직접 저장 금지)
-- ============================================================

BEGIN;

-- -------------------------------------------------------
-- oauth_accounts: OAuth 제공자 연결 정보
-- 보안: email 원문 미저장 → 해시만 저장, 토큰은 참조 ID만 기록
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS oauth_accounts (
    id              SERIAL      PRIMARY KEY,
    user_id         TEXT        NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    provider        TEXT        NOT NULL DEFAULT 'google'
                    CHECK (provider IN ('google')),
    provider_sub    TEXT        NOT NULL,               -- Google의 sub (불변 고유 ID)
    email_hash      TEXT,                               -- SHA-256(email) — 원문 미저장
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (provider, provider_sub)
);

CREATE INDEX IF NOT EXISTS idx_oauth_accounts_user ON oauth_accounts(user_id);

COMMENT ON TABLE oauth_accounts IS 'OAuth 제공자 연결. email 원문 저장 금지, SHA-256 해시만 보관.';
COMMENT ON COLUMN oauth_accounts.provider_sub IS 'Google ID Token의 sub 클레임. 불변 고유 식별자.';
COMMENT ON COLUMN oauth_accounts.email_hash IS 'SHA-256(email). 탈퇴/계정 조회용. 원문 복원 불가.';

-- -------------------------------------------------------
-- user_sessions: 앱 발급 JWT 세션 이력 (감사 로그용)
-- 실제 토큰 원문은 저장하지 않는다.
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_sessions (
    session_id      TEXT        PRIMARY KEY,            -- JWT jti (UUID)
    user_id         TEXT        NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    issued_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at      TIMESTAMPTZ NOT NULL,
    revoked_at      TIMESTAMPTZ,                        -- 로그아웃 시 기록
    device_hint     TEXT                                -- 'IOS' | 'ANDROID' | 'WEB'
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id, expires_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_sessions_jti  ON user_sessions(session_id);

COMMENT ON TABLE user_sessions IS 'JWT 세션 이력. 토큰 원문 미저장, jti(UUID)로 추적. 로그아웃/만료 토큰 차단에 활용.';

-- -------------------------------------------------------
-- users 테이블: consent_flags 컬럼 기본값 보완
-- -------------------------------------------------------
COMMENT ON COLUMN users.consent_flags IS
  '동의 플래그. 예: {"required": true, "optional": false, "research": false, "version": "1.0", "agreed_at": "2026-03-05T..."}';

COMMIT;
