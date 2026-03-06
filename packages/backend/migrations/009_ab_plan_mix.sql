-- Migration 009: A/B 실험 정의 추가 (P1-2 실험 variant → 플랜 반영)
--
-- ab_plan_mix: 표기→읽기 비중을 높이는 실험 (treatment: +10%p)
-- 목표: SURFACE_TO_READING 비중 증가가 7일 지연 인출률을 개선하는지 검증
-- OEC: 7일 지연 인출률
-- 가드레일: 이탈률, 연체율

BEGIN;

INSERT INTO experiment_definitions (exp_id, title, description, oec_metric, guardrail_metrics, status, traffic_pct, is_aa_test)
VALUES (
  'ab_plan_mix',
  'Plan Mix A/B: 표기→읽기 비중 증가',
  'SURFACE_TO_READING 비중 +10%p (treatment) vs 기본 믹스 (control). OEC: 7일 지연 인출률.',
  'delayed_recall_7d',
  ARRAY['overdue_rate', 'dropout_rate'],
  'running',
  0.5,
  false
)
ON CONFLICT (exp_id) DO UPDATE
  SET title             = EXCLUDED.title,
      description       = EXCLUDED.description,
      oec_metric        = EXCLUDED.oec_metric,
      guardrail_metrics = EXCLUDED.guardrail_metrics,
      status            = EXCLUDED.status,
      traffic_pct       = EXCLUDED.traffic_pct,
      is_aa_test        = EXCLUDED.is_aa_test;

COMMIT;
