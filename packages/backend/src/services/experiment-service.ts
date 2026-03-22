/**
 * 실험 플래그 서비스 (Sprint 5-3)
 *
 * 설계 원칙 (rules/report.mdc):
 * - user_id 기반 해시로 고정 배정 (같은 사용자는 항상 같은 variant)
 * - A/A 먼저 실행하여 계측 무결성 검증
 * - OEC: 7/14일 지연 인출률
 * - 가드레일: 이탈률, 연체율, 알림 차단률
 * - 실험 공지/옵트아웃 정책 필수 (실험 윤리)
 *
 * 배정 방식:
 *   hash = murmurhash(user_id + exp_id) % 100
 *   hash < traffic_pct * 100 → 실험 그룹
 *   hash < traffic_pct * 50  → control, else → treatment
 */

import { pool } from '../db/pool';
import { createHash } from 'crypto';

export interface ExperimentVariant {
  exp_id: string;
  variant: 'control' | 'treatment' | 'aa_control' | 'aa_treatment' | 'not_in_experiment';
  assigned_at?: string;
  purpose?: string;
  opt_out_supported?: boolean;
  exposure_count?: number;
}

export interface AssignmentsResponse {
  assignments: ExperimentVariant[];
  computed_at: string;
}

// ─── 결정론적 해시 기반 배정 ─────────────────────────────────

/**
 * user_id + exp_id → 0~99 사이의 결정론적 버킷 번호
 * SHA-256의 첫 4바이트로 uint32 계산 후 100으로 나머지
 */
export function hashBucket(userId: string, expId: string): number {
  const input = `${userId}:${expId}`;
  const digest = createHash('sha256').update(input, 'utf8').digest();
  const uint32 = ((digest[0] << 24) | (digest[1] << 16) | (digest[2] << 8) | digest[3]) >>> 0;
  return uint32 % 100;
}

/**
 * 단일 실험에 대한 variant 결정
 */
export function assignVariant(
  userId: string,
  expId: string,
  trafficPct: number,  // 0.0 ~ 1.0
  isAaTest: boolean
): ExperimentVariant['variant'] {
  const bucket = hashBucket(userId, expId);
  const threshold = Math.round(trafficPct * 100);

  if (bucket >= threshold) return 'not_in_experiment';

  if (isAaTest) {
    return bucket < threshold / 2 ? 'aa_control' : 'aa_treatment';
  }
  return bucket < threshold / 2 ? 'control' : 'treatment';
}

// ─── DB 기반 배정 조회/저장 ───────────────────────────────────

/**
 * 사용자의 모든 활성 실험 배정 조회 (없으면 신규 배정 후 저장)
 */
export async function getUserAssignments(userId: string): Promise<AssignmentsResponse> {
  // 활성 실험 목록 조회
  const { rows: defs } = await pool.query<{
    exp_id: string;
    traffic_pct: number;
    is_aa_test: boolean;
    purpose: string | null;
    opt_out_supported: boolean | null;
  }>(
    `SELECT exp_id, traffic_pct, is_aa_test, purpose, opt_out_supported
     FROM experiment_definitions
     WHERE status = 'running'`
  );

  const assignments: ExperimentVariant[] = [];

  for (const def of defs) {
    // 기존 배정 확인
    const { rows: existing } = await pool.query<{
      variant: string;
      assigned_at: Date;
      exposure_count: number;
    }>(
      `SELECT variant, assigned_at, exposure_count FROM experiments WHERE user_id = $1 AND exp_id = $2`,
      [userId, def.exp_id]
    );

    let variant: ExperimentVariant['variant'];

    if (existing.length > 0) {
      variant = existing[0].variant as ExperimentVariant['variant'];
      // 노출 횟수 증가
      await pool.query(
        `UPDATE experiments
         SET exposure_count = exposure_count + 1, last_exposed_at = NOW()
         WHERE user_id = $1 AND exp_id = $2`,
        [userId, def.exp_id]
      );
    } else {
      // 신규 배정
      variant = assignVariant(userId, def.exp_id, def.traffic_pct, def.is_aa_test);
      await pool.query(
        `INSERT INTO experiments (user_id, exp_id, variant, exposure_count, last_exposed_at)
         VALUES ($1, $2, $3, 1, NOW())
         ON CONFLICT (user_id, exp_id) DO UPDATE
           SET exposure_count = experiments.exposure_count + 1, last_exposed_at = NOW()`,
        [userId, def.exp_id, variant]
      );
    }

    assignments.push({
      exp_id: def.exp_id,
      variant,
      assigned_at: existing[0]?.assigned_at?.toISOString(),
      purpose: def.purpose ?? undefined,
      opt_out_supported: def.opt_out_supported ?? true,
      exposure_count: existing[0]?.exposure_count ?? 1,
    });
  }

  return { assignments, computed_at: new Date().toISOString() };
}

/**
 * 특정 실험의 variant 조회 (간편 버전)
 */
export async function getVariant(
  userId: string,
  expId: string
): Promise<ExperimentVariant['variant']> {
  const { rows } = await pool.query<{ variant: string }>(
    `SELECT variant FROM experiments WHERE user_id = $1 AND exp_id = $2`,
    [userId, expId]
  );

  if (rows.length > 0) return rows[0].variant as ExperimentVariant['variant'];

  // 배정 없으면 전체 조회 후 반환
  const all = await getUserAssignments(userId);
  return all.assignments.find((a) => a.exp_id === expId)?.variant ?? 'not_in_experiment';
}

// ─── 실험 분석 집계 (A/A 검증용) ─────────────────────────────

export interface AaValidationResult {
  exp_id: string;
  control_count: number;
  treatment_count: number;
  balance_ratio: number;  // treatment / control (1.0에 가까울수록 균형)
  is_balanced: boolean;   // 0.9 ~ 1.1 범위면 균형
}

/**
 * A/A 테스트 균형 검증
 * 두 그룹 크기가 유사한지 확인 (계측 오류 탐지)
 */
export async function validateAaBalance(expId: string): Promise<AaValidationResult> {
  const { rows } = await pool.query<{ variant: string; count: string }>(
    `SELECT variant, COUNT(*) AS count
     FROM experiments
     WHERE exp_id = $1 AND variant IN ('aa_control', 'aa_treatment')
     GROUP BY variant`,
    [expId]
  );

  const controlCount = Number(rows.find((r) => r.variant === 'aa_control')?.count ?? 0);
  const treatmentCount = Number(rows.find((r) => r.variant === 'aa_treatment')?.count ?? 0);
  const ratio = controlCount > 0 ? treatmentCount / controlCount : 0;

  return {
    exp_id: expId,
    control_count: controlCount,
    treatment_count: treatmentCount,
    balance_ratio: Math.round(ratio * 1000) / 1000,
    is_balanced: ratio >= 0.9 && ratio <= 1.1,
  };
}
