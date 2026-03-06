/**
 * POST /v1/events — ReviewEvent Ingest API
 *
 * 설계 원칙:
 * - idempotency: event_id가 이미 존재하면 201 대신 200을 반환하고 중복 삽입하지 않는다.
 * - append-only: 삽입 후 수정/삭제 불가.
 * - 배치: 단건 또는 배열([]) 모두 수용.
 * - 스키마 검증 실패 이벤트는 거부 로그를 남기고 202(부분 성공)로 반환.
 */

import { Router, Request, Response } from 'express';
import { pool } from '../db/pool';
import { validateReviewEventBatch, validateReviewEvent } from '../services/event-validator';
import { requireAuth } from '../middleware/auth';
import { replayEventsToCardState } from '../services/card-state-service';
import { ReviewEvent } from '@japanese-learn/shared';

const router = Router();

/**
 * POST /v1/events
 * Body: ReviewEvent | ReviewEvent[]
 *
 * 응답:
 * - 201: 모두 신규 삽입 성공
 * - 200: 전부 중복 (이미 처리됨)
 * - 202: 일부 삽입 성공, 일부 거부 (rejectedEvents 포함)
 * - 400: 요청 형식 오류
 * - 500: 서버 오류
 */
router.post('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const body = req.body;

  // 단건 → 배열로 정규화
  const rawEvents: unknown[] = Array.isArray(body) ? body : [body];

  // P0-2: user_id를 토큰(req.userId)으로 강제 덮어쓰기 (클라이언트 주장 user_id 무시)
  const events: unknown[] = rawEvents.map((e) =>
    typeof e === 'object' && e !== null
      ? { ...(e as Record<string, unknown>), user_id: req.userId! }
      : e
  );

  if (events.length === 0) {
    res.status(400).json({ error: 'events 배열이 비어있습니다.' });
    return;
  }

  if (events.length > 500) {
    res.status(400).json({ error: '배치 최대 크기는 500개입니다.' });
    return;
  }

  // 스키마 검증
  const { accepted, rejected } = validateReviewEventBatch(events);

  if (accepted.length === 0) {
    res.status(400).json({
      error: '검증을 통과한 이벤트가 없습니다.',
      rejectedEvents: rejected,
    });
    return;
  }

  const client = await pool.connect();
  try {
    const insertedIds: string[] = [];
    const duplicateIds: string[] = [];

    await client.query('BEGIN');

    for (const event of accepted as ReviewEvent[]) {
      const result = await client.query<{ event_id: string }>(
        `
        INSERT INTO review_log (
          event_id, user_id, card_id, item_id, ts,
          prompt_type, correct, rt_ms, attempt_count, hint_level,
          confidence, error_type, device, offline, schema_version
        ) VALUES (
          $1, $2, $3, $4, $5::TIMESTAMPTZ,
          $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15
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
        ]
      );

      if (result.rows.length > 0) {
        insertedIds.push(event.event_id);
      } else {
        duplicateIds.push(event.event_id);
      }
    }

    await client.query('COMMIT');

    const hasRejected = rejected.length > 0;
    const statusCode =
      hasRejected
        ? 202
        : insertedIds.length === 0
        ? 200
        : 201;

    res.status(statusCode).json({
      insertedCount: insertedIds.length,
      duplicateCount: duplicateIds.length,
      rejectedCount: rejected.length,
      insertedEventIds: insertedIds,
      duplicateEventIds: duplicateIds,
      ...(hasRejected ? { rejectedEvents: rejected } : {}),
    });

    // P0-4: 새로 삽입된 이벤트를 card_state에 비동기 재적용 (베스트에포트)
    if (insertedIds.length > 0) {
      const insertedEvents = (accepted as ReviewEvent[]).filter((e) =>
        insertedIds.includes(e.event_id)
      );
      replayEventsToCardState(insertedEvents).catch((err) => {
        console.error('[events] card_state 재적용 오류 (비치명):', err);
      });
    }
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[events] DB 오류:', err);
    res.status(500).json({ error: '이벤트 저장 중 서버 오류가 발생했습니다.' });
  } finally {
    client.release();
  }
});

/**
 * GET /v1/events/:eventId — 단건 조회 (디버그/확인용)
 * P0-2: requireAuth 적용 — 자신의 이벤트만 조회 가능
 */
router.get('/:eventId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { eventId } = req.params;
  const { rows } = await pool.query(
    'SELECT * FROM review_log WHERE event_id = $1 AND user_id = $2',
    [eventId, req.userId!]
  );
  if (rows.length === 0) {
    res.status(404).json({ error: '이벤트를 찾을 수 없습니다.' });
    return;
  }
  res.json(rows[0]);
});

export default router;
