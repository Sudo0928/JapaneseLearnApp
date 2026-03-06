/**
 * 혼동쌍 드릴 카드 서비스 (P1-3)
 *
 * 목적:
 *   review_log의 오답 패턴에서 "자주 틀리는 아이템"을 추출하여
 *   다음 세션의 /v1/today 응답에 drillCards로 자동 포함한다.
 *
 * 설계 원칙:
 *   - 혼동 드릴은 기존 복습 카드와 별도 큐로 제공 (강제 혼합 금지)
 *   - 세션당 최대 3개 (인지부하 관리, report.mdc §인지부하)
 *   - 이미 오늘 복습 스케줄에 포함된 카드는 드릴에서 제외 (중복 방지)
 *   - 오답 재발률 7~14일 윈도우로 관찰 (OEC 연결)
 */

import { pool } from '../db/pool';
import type { CardWithItem } from './card-state-service';

/**
 * 세션에 투입할 혼동 드릴 카드 목록 조회
 *
 * @param userId  대상 사용자
 * @param maxDrills 최대 드릴 수 (기본 3)
 */
export async function getConfusionDrillCards(
  userId: string,
  maxDrills = 3
): Promise<(CardWithItem & { isDrill: true })[]> {
  // 최근 7일 내 오답이 2회 이상인 item_id 집계 (오류율 높은 순)
  const { rows: confusionItems } = await pool.query<{ item_id: string; error_count: string }>(
    `
    SELECT
      c.item_id,
      COUNT(*) FILTER (WHERE NOT rl.correct) AS error_count
    FROM review_log rl
    JOIN cards c ON c.card_id = rl.card_id
    WHERE rl.user_id = $1
      AND rl.ts >= NOW() - INTERVAL '7 days'
      AND rl.error_type != 'NONE'
    GROUP BY c.item_id
    HAVING COUNT(*) FILTER (WHERE NOT rl.correct) >= 2
    ORDER BY error_count DESC
    LIMIT $2
    `,
    [userId, maxDrills * 2]  // 여유분 확보 후 아래서 필터링
  );

  if (confusionItems.length === 0) return [];

  const confusionItemIds = confusionItems.map((r) => r.item_id);

  // 해당 item의 card_state 조회
  // 오늘 이미 due인 카드(일반 복습 큐)는 제외 → 중복 방지
  const placeholders = confusionItemIds.map((_, i) => `$${i + 2}`).join(', ');

  const { rows } = await pool.query<CardWithItem>(
    `
    SELECT
      cs.card_id,
      cs.user_id,
      cs.due_ts,
      cs.interval_days,
      cs.ease_factor,
      cs.repetitions,
      cs.state,
      c.prompt_type,
      i.surface,
      i.reading,
      i.meaning_ko,
      i.item_id
    FROM card_state cs
    JOIN cards c ON c.card_id = cs.card_id
    JOIN items i ON i.item_id = c.item_id
    WHERE cs.user_id = $1
      AND i.item_id IN (${placeholders})
      AND cs.due_ts > NOW()       -- 오늘 복습 큐에 없는 카드만 드릴로 투입
      AND cs.state != 'new'       -- 신규 카드는 드릴 제외
    ORDER BY cs.due_ts ASC
    LIMIT ${maxDrills}
    `,
    [userId, ...confusionItemIds]
  );

  return rows.map((r) => ({ ...r, isDrill: true as const }));
}
