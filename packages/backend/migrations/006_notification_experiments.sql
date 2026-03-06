-- ============================================================
-- Migration 006: 알림 설정 + 실험 플래그 테이블 (Sprint 5-2, 5-3)
-- ============================================================

BEGIN;

-- -------------------------------------------------------
-- notification_prefs: 사용자 알림 설정 (옵트아웃 기본 원칙)
-- -------------------------------------------------------
-- 설계 원칙 (rules/report.mdc):
--   - 스트릭 강제/벌점형 알림 금지
--   - 알림은 사용자 설정 시간창 내에서만
--   - "회복 플랜" 제공(연체 폭탄 분산)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS notification_prefs (
    user_id         TEXT        NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    enabled         BOOLEAN     NOT NULL DEFAULT false,  -- 기본 OFF (옵트인)
    window_start    TIME,                               -- 허용 시간 시작 (예: '08:00')
    window_end      TIME,                               -- 허용 시간 종료 (예: '22:00')
    timezone        TEXT        NOT NULL DEFAULT 'Asia/Seoul',
    push_token      TEXT,                               -- expo push token (암호화 필요)
    recovery_plan   BOOLEAN     NOT NULL DEFAULT true,  -- 연체 회복 알림
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (user_id)
);

COMMENT ON TABLE notification_prefs IS
  '사용자 알림 설정. 기본 OFF(옵트인). 스트릭 강제/벌점 알림 금지.';
COMMENT ON COLUMN notification_prefs.push_token IS
  'Expo Push Token. PII에 해당하므로 저장 전 암호화 권장 (운영 정책으로 별도 확정).';

-- -------------------------------------------------------
-- experiments: 실험 배정 테이블 (A/A + A/B 준비)
-- -------------------------------------------------------
-- 설계 원칙 (rules/report.mdc):
--   - user_id 기반 해시로 고정 배정(같은 사용자는 항상 같은 variant)
--   - A/A 먼저 실행하여 계측 무결성 검증
--   - OEC: 7/14일 지연 인출률, 가드레일: 이탈률/연체율/알림 차단률
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS experiments (
    id              SERIAL      PRIMARY KEY,
    user_id         TEXT        NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    exp_id          TEXT        NOT NULL,  -- 실험 식별자 (예: 'exp_recall_mix_v1')
    variant         TEXT        NOT NULL,  -- 'control' | 'treatment' | 'aa_control' | 'aa_treatment'
    assigned_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    exposure_count  INTEGER     NOT NULL DEFAULT 0,  -- 실험 노출 횟수
    last_exposed_at TIMESTAMPTZ,

    UNIQUE (user_id, exp_id)
);

CREATE INDEX IF NOT EXISTS idx_experiments_exp_id
    ON experiments (exp_id, variant);

COMMENT ON TABLE experiments IS
  '실험(A/B, A/A) 배정 테이블. user_id+exp_id 해시로 결정론적 배정.';
COMMENT ON COLUMN experiments.variant IS
  'control | treatment | aa_control | aa_treatment. A/A는 aa_ prefix 사용.';

-- -------------------------------------------------------
-- experiment_definitions: 실험 메타데이터
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS experiment_definitions (
    exp_id          TEXT        PRIMARY KEY,
    title           TEXT        NOT NULL,
    description     TEXT,
    oec_metric      TEXT        NOT NULL,  -- 주효과 지표 (예: 'delayed_recall_7d')
    guardrail_metrics TEXT[],              -- 가드레일 지표
    traffic_pct     REAL        NOT NULL DEFAULT 0.5,  -- 실험 트래픽 비율
    is_aa_test      BOOLEAN     NOT NULL DEFAULT false,
    status          TEXT        NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'running', 'paused', 'completed')),
    started_at      TIMESTAMPTZ,
    ended_at        TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE experiment_definitions IS
  '실험 정의. A/A 테스트는 is_aa_test=true로 표시. status=running일 때만 배정.';

-- 초기 A/A 테스트 정의 삽입
INSERT INTO experiment_definitions (
  exp_id, title, description, oec_metric, guardrail_metrics, traffic_pct, is_aa_test, status
) VALUES (
  'aa_baseline_v1',
  'A/A 기준 검증 (계측 무결성)',
  '배포 전 계측 오류 탐지용 A/A 테스트. 두 그룹 모두 동일 경험.',
  'delayed_recall_7d',
  ARRAY['churn_rate', 'overdue_rate', 'notification_block_rate'],
  1.0,   -- 전체 트래픽 대상
  true,
  'running'
) ON CONFLICT (exp_id) DO NOTHING;

COMMIT;
