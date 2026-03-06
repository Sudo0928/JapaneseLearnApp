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
import { validateReviewEventBatch } from '../services/event-validator';
import { requireAuth } from '../middleware/auth';
import { applyReviewResultWithStatus } from '../services/card-state-service';
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

  try {
    const insertedIds: string[] = [];
    const duplicateIds: string[] = [];
    const sortedAccepted = [...(accepted as ReviewEvent[])].sort(
      (a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime()
    );

    for (const event of sortedAccepted) {
      const result = await applyReviewResultWithStatus(event);
      if (result.inserted) {
        insertedIds.push(event.event_id);
      } else {
        duplicateIds.push(event.event_id);
      }
    }

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
  } catch (err) {
    console.error('[events] DB 오류:', err);
    res.status(500).json({ error: '이벤트 저장 중 서버 오류가 발생했습니다.' });
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
