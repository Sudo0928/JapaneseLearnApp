/**
 * 혼동쌍(confusion pairs) 집계 배치 서비스
 *
 * 목적: review_log에서 오류 유형별로 가장 많이 틀린 아이템을 집계하여
 *       다음 플랜 생성 및 주간 리포트에 활용한다.
 *
 * 집계 단위: 7일 / 28일 윈도우
 * 출력: user_error_agg 테이블 (배치 실행 후 저장)
 */

import { pool } from '../db/pool';

export interface ConfusionPair {
  item_id: string;
  surface: string;
  error_type: string;
  error_count: number;
  total_attempts: number;
  error_rate: number;
}

export interface ErrorAggregation {
  user_id: string;
  window: '7d' | '28d';
  top_pairs: ConfusionPair[];
  computed_at: string;
}

/**
 * 사용자별 혼동쌍 집계 (즉시 조회용)
 *
 * @param userId  대상 사용자
 * @param days    집계 기간 (7 또는 28)
 * @param topK    상위 K개 반환
 */
export async function getConfusionPairs(
  userId: string,
  days: 7 | 28 = 28,
  topK = 10
): Promise<ConfusionPair[]> {
  const { rows } = await pool.query<ConfusionPair>(
    `
    SELECT
      i.item_id,
      i.surface,
      rl.error_type,
      COUNT(*) FILTER (WHERE NOT rl.correct) AS error_count,
      COUNT(*) AS total_attempts,
      ROUND(
        COUNT(*) FILTER (WHERE NOT rl.correct)::NUMERIC / NULLIF(COUNT(*), 0),
        3
      ) AS error_rate
    FROM review_log rl
    JOIN cards c ON c.card_id = rl.card_id
    JOIN items i ON i.item_id = c.item_id
    WHERE rl.user_id = $1
      AND rl.ts >= NOW() - ($2 || ' days')::INTERVAL
      AND rl.error_type != 'NONE'
    GROUP BY i.item_id, i.surface, rl.error_type
    HAVING COUNT(*) FILTER (WHERE NOT rl.correct) >= 2
    ORDER BY error_count DESC, error_rate DESC
    LIMIT $3
    `,
    [userId, days, topK]
  );

  return rows.map((r) => ({
    ...r,
    error_count: Number(r.error_count),
    total_attempts: Number(r.total_attempts),
    error_rate: Number(r.error_rate),
  }));
}

/**
 * 전체 사용자 일배치 집계 (배치 스케줄러에서 호출)
 * 결과를 user_error_agg 테이블에 UPSERT
 */
export async function runConfusionPairsBatch(): Promise<{ processed: number }> {
  // 활성 사용자 (최근 28일 이내 복습 기록 있는 사용자)
  const { rows: users } = await pool.query<{ user_id: string }>(
    `SELECT DISTINCT user_id FROM review_log WHERE ts >= NOW() - INTERVAL '28 days'`
  );

  let processed = 0;

  for (const { user_id } of users) {
    for (const days of [7, 28] as const) {
      const pairs = await getConfusionPairs(user_id, days, 20);

      await pool.query(
        `
        INSERT INTO user_error_agg (user_id, window_days, top_pairs_json, computed_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (user_id, window_days)
        DO UPDATE SET top_pairs_json = EXCLUDED.top_pairs_json, computed_at = EXCLUDED.computed_at
        `,
        [user_id, days, JSON.stringify(pairs)]
      );
    }
    processed++;
  }

  return { processed };
}

/**
 * 저장된 혼동쌍 집계 조회
 */
export async function getCachedConfusionPairs(
  userId: string,
  days: 7 | 28 = 28
): Promise<ConfusionPair[]> {
  const { rows } = await pool.query<{ top_pairs_json: string }>(
    `SELECT top_pairs_json FROM user_error_agg WHERE user_id = $1 AND window_days = $2`,
    [userId, days]
  );

  if (rows.length === 0) {
    // 캐시 없으면 즉시 계산
    return getConfusionPairs(userId, days);
  }

  return JSON.parse(rows[0].top_pairs_json) as ConfusionPair[];
}
