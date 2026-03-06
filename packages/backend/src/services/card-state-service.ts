/**
 * card_state CRUD + SM-2 스케줄 갱신 서비스
 *
 * 사용 흐름:
 * 1) 복습 완료 → applyReviewResult() 호출 → card_state 갱신 + review_log 동시 삽입
 * 2) 오늘 할 일 조회 → getTodayCards() 호출
 */

import { PoolClient } from 'pg';
import { pool } from '../db/pool';
import { scheduleNext, createInitialCardState, CardState } from './sm2-scheduler';
import { ReviewEvent } from '@japanese-learn/shared';

/**
 * 오늘 복습할 카드 목록 조회
 *
 * @param userId         사용자 ID
 * @param maxReview      복습 카드 최대 개수 (기본 40)
 * @param maxNew         신규 카드 최대 개수 (기본 6)
 */
export async function getTodayCards(
  userId: string,
  maxReview = 40,
  maxNew = 6
): Promise<{
  reviewCards: CardWithItem[];
  newCards: CardWithItem[];
}> {
  const now = new Date();

  const { rows: reviewCards } = await pool.query<CardWithItem>(
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
      AND cs.state IN ('learning', 'review', 'relearning')
      AND cs.due_ts <= $2
    ORDER BY cs.due_ts ASC
    LIMIT $3
    `,
    [userId, now, maxReview]
  );

  const { rows: newCards } = await pool.query<CardWithItem>(
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
      AND cs.state = 'new'
    ORDER BY cs.created_at ASC
    LIMIT $2
    `,
    [userId, maxNew]
  );

  return { reviewCards, newCards };
}

/**
 * 복습 결과 적용: review_log 삽입 + card_state 갱신 (트랜잭션)
 *
 * review_log는 append-only이므로 INSERT만 수행한다.
 * card_state는 UPSERT로 갱신한다.
 */
export interface ApplyReviewResultResult {
  state: CardState;
  inserted: boolean;
}

function buildReviewSnapshot(current: CardState | null) {
  return {
    due_ts_at_review: current?.due_ts ?? null,
    interval_days_at_review: current?.interval_days ?? null,
    ease_factor_at_review: current?.ease_factor ?? null,
    repetitions_at_review: current?.repetitions ?? null,
    state_at_review: current?.state ?? null,
    is_new_at_review: current ? current.state === 'new' : null,
  };
}

export async function applyReviewResultWithStatus(
  event: ReviewEvent
): Promise<ApplyReviewResultResult> {
  const client: PoolClient = await pool.connect();

  try {
    await client.query('BEGIN');

    // 현재 card_state 조회
    const { rows } = await client.query<CardState>(
      `SELECT * FROM card_state WHERE user_id = $1 AND card_id = $2`,
      [event.user_id, event.card_id]
    );

    const current = rows[0] ?? null;

    const snapshot = buildReviewSnapshot(current);

    // SM-2 다음 스케줄 계산
    const schedule = scheduleNext(
      current,
      {
        correct: event.correct,
        rt_ms: event.rt_ms,
        hint_level: event.hint_level ?? 0,
        error_type: event.error_type ?? 'NONE',
      },
      new Date(event.ts)
    );

    // review_log 삽입이 성공한 경우에만 card_state를 갱신한다.
    // 이렇게 해야 동일 event_id 재전송 시 스케줄이 두 번 전진하지 않는다.
    const { rows: insertedRows } = await client.query<{ event_id: string }>(
      `
      INSERT INTO review_log (
        event_id, user_id, card_id, item_id, ts,
        prompt_type, correct, rt_ms, attempt_count, hint_level,
        confidence, error_type, device, offline, schema_version,
        due_ts_at_review, interval_days_at_review, ease_factor_at_review,
        repetitions_at_review, state_at_review, is_new_at_review
      ) VALUES (
        $1, $2, $3, $4, $5::TIMESTAMPTZ,
        $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15,
        $16, $17, $18, $19, $20, $21
      )
      ON CONFLICT (event_id) DO NOTHING
      RETURNING event_id
      `,
      [
        event.event_id,
        event.user_id,
        event.card_id,
        event.item_id ?? null,
        event.ts,
        event.prompt_type,
        event.correct,
        event.rt_ms,
        event.attempt_count ?? 1,
        event.hint_level ?? 0,
        event.confidence ?? null,
        event.error_type ?? 'NONE',
        event.device ?? 'UNKNOWN',
        event.offline ?? false,
        event.schema_version ?? '1.0.0',
        snapshot.due_ts_at_review,
        snapshot.interval_days_at_review,
        snapshot.ease_factor_at_review,
        snapshot.repetitions_at_review,
        snapshot.state_at_review,
        snapshot.is_new_at_review,
      ]
    );

    if (insertedRows.length === 0) {
      const { rows: latestRows } = await client.query<CardState>(
        `SELECT * FROM card_state WHERE user_id = $1 AND card_id = $2`,
        [event.user_id, event.card_id]
      );

      await client.query('COMMIT');

      if (latestRows.length === 0) {
        throw new Error(`중복 이벤트(${event.event_id})가 존재하지만 card_state가 없습니다.`);
      }

      return { state: latestRows[0], inserted: false };
    }

    // card_state UPSERT
    const { rows: updatedRows } = await client.query<CardState>(
      `
      INSERT INTO card_state (
        user_id, card_id,
        due_ts, interval_days, ease_factor, repetitions, stability, state,
        last_reviewed_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (user_id, card_id) DO UPDATE SET
        due_ts           = EXCLUDED.due_ts,
        interval_days    = EXCLUDED.interval_days,
        ease_factor      = EXCLUDED.ease_factor,
        repetitions      = EXCLUDED.repetitions,
        stability        = EXCLUDED.stability,
        state            = EXCLUDED.state,
        last_reviewed_at = EXCLUDED.last_reviewed_at
      RETURNING *
      `,
      [
        event.user_id,
        event.card_id,
        schedule.due_ts,
        schedule.interval_days,
        schedule.ease_factor,
        schedule.repetitions,
        current?.stability ?? 0,
        schedule.state,
        new Date(event.ts),
      ]
    );

    await client.query('COMMIT');
    return { state: updatedRows[0], inserted: true };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function applyReviewResult(event: ReviewEvent): Promise<CardState> {
  const result = await applyReviewResultWithStatus(event);
  return result.state;
}

/**
 * 오프라인 이벤트 배치를 card_state에 재적용 (P0-4)
 *
 * /v1/events 로 ingest된 신규 이벤트들을 ts 오름차순으로 정렬해
 * applyReviewResult 와 동일 SM-2 로직으로 card_state 를 갱신한다.
 *
 * - review_log 에는 이미 삽입되어 있으므로 중복 삽입은 ON CONFLICT DO NOTHING 으로 무해.
 * - 처리 실패는 비치명(best-effort): 이벤트 원본은 review_log 에 보존됨.
 */
export async function replayEventsToCardState(events: ReviewEvent[]): Promise<void> {
  if (events.length === 0) return;

  // ts 오름차순 정렬 — 과거 이벤트부터 순서대로 적용해야 SM-2 상태가 일관됨
  const sorted = [...events].sort(
    (a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime()
  );

  for (const event of sorted) {
    try {
      await applyReviewResultWithStatus(event);
    } catch (err) {
      console.warn(
        `[replayEventsToCardState] event_id=${event.event_id} 처리 실패 (건너뜀):`,
        err
      );
    }
  }
}

/**
 * 신규 아이템에 대해 card_state 초기 레코드 생성
 * (아이템 추가 시 일괄 호출)
 */
export async function initCardStatesForUser(
  userId: string,
  cardIds: string[]
): Promise<void> {
  if (cardIds.length === 0) return;

  const values = cardIds
    .map((_, i) => `($1, $${i * 2 + 2}, $${i * 2 + 3}, 'new')`)
    .join(', ');

  const params: unknown[] = [userId];
  cardIds.forEach(() => {
    params.push(/* card_id */ cardIds[params.length - 1 < cardIds.length ? params.length - 1 : 0]);
    params.push(new Date());
  });

  // 간단하게 개별 삽입 (배치 최적화는 P1)
  for (const cardId of cardIds) {
    const initial = createInitialCardState(userId, cardId);
    await pool.query(
      `
      INSERT INTO card_state (
        user_id, card_id, due_ts, interval_days, ease_factor, repetitions, stability, state
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (user_id, card_id) DO NOTHING
      `,
      [
        initial.user_id,
        initial.card_id,
        initial.due_ts,
        initial.interval_days,
        initial.ease_factor,
        initial.repetitions,
        initial.stability,
        initial.state,
      ]
    );
  }
}

// 조회용 타입
export interface CardWithItem {
  card_id: string;
  user_id: string;
  due_ts: Date;
  interval_days: number;
  ease_factor: number;
  repetitions: number;
  state: string;
  prompt_type: string;
  surface: string;
  reading: string | null;
  meaning_ko: string | null;
  item_id: string;
}
