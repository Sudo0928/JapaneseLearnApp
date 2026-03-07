/**
 * GET /v1/today — 오늘 할 일 카드 목록 API
 *
 * 응답:
 * - reviewCards: 복습 예정 카드 (due_ts <= 현재, 최대 40장)
 * - newCards: 신규 카드 (최대 6장)
 * - totalCount: 전체 오늘 할 일 수
 *
 * POST /v1/today/review — 복습 결과 제출 (card_state 갱신 + review_log 동시 저장)
 */

import { Router, Request, Response } from 'express';
import { getTodayCards, applyReviewResult, ensureAllCardStatesForUser } from '../services/card-state-service';
import { validateReviewEvent } from '../services/event-validator';
import { requireAuth } from '../middleware/auth';
import { getConfusionDrillCards } from '../services/confusion-drill-service';
import { ReviewEvent } from '@japanese-learn/shared';
import { generatePlan } from '../services/plan-generator';
import { selectCardsByMix } from '../services/queue-compiler';

const router = Router();

/**
 * GET /v1/today?maxReview=40&maxNew=6
 *
 * P0-2: requireAuth 적용 — userId는 req.userId(JWT)에서 단일 소스로 추출.
 * 쿼리 파라미터 userId는 더 이상 사용하지 않는다.
 */
router.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId!;

  const maxReview = parseInt((req.query.maxReview as string) ?? '40', 10);
  const maxNew = parseInt((req.query.maxNew as string) ?? '6', 10);
  const dailyMinutes = parseInt((req.query.dailyMinutes as string) ?? '20', 10);

  if (maxReview < 0 || maxReview > 200 || maxNew < 0 || maxNew > 50 || dailyMinutes < 5 || dailyMinutes > 120) {
    res.status(400).json({ error: 'maxReview(0~200), maxNew(0~50), dailyMinutes(5~120) 범위를 확인하세요.' });
    return;
  }

  try {
    await ensureAllCardStatesForUser(userId);

    const plan = await generatePlan({
      user_id: userId,
      date: new Date().toISOString().slice(0, 10),
      goal: {},
      constraints: {
        daily_minutes: dailyMinutes,
        max_new: maxNew,
        offline_expected: false,
      },
    });

    const reviewCandidateLimit = Math.min(200, Math.max(maxReview, plan.daily_budget.review_count * 3));
    const newCandidateLimit = Math.min(50, Math.max(maxNew, plan.daily_budget.new_count * 3));

    const [{ reviewCards: rawReviewCards, newCards: rawNewCards }, confusionDrills] = await Promise.all([
      getTodayCards(userId, reviewCandidateLimit, newCandidateLimit),
      getConfusionDrillCards(userId, Math.min(3, plan.daily_budget.error_drill_count)),
    ]);

    const reviewCards = selectCardsByMix(
      rawReviewCards,
      plan.mix,
      Math.min(maxReview, plan.daily_budget.review_count)
    );

    const newCards = selectCardsByMix(
      rawNewCards,
      plan.mix,
      Math.min(maxNew, plan.daily_budget.new_count)
    );

    res.json({
      date: new Date().toISOString().slice(0, 10),
      userId,
      reviewCards,
      newCards,
      confusionDrills,
      totalCount: reviewCards.length + newCards.length + confusionDrills.length,
      plan,
      uiPolicy: plan.ui_policy,
    });
  } catch (err) {
    console.error('[today] 조회 오류:', err);
    res.status(500).json({ error: '오늘 할 일 조회 중 서버 오류가 발생했습니다.' });
  }
});

/**
 * POST /v1/today/review — 복습 결과 제출
 * Body: ReviewEventInput (단건)
 *
 * P0-2: requireAuth 적용 — event.user_id를 req.userId로 강제 덮어쓴다.
 * 이 엔드포인트는 review_log 저장 + card_state 갱신을 트랜잭션으로 처리한다.
 */
router.post('/review', requireAuth, async (req: Request, res: Response): Promise<void> => {
  // user_id를 클라이언트 주장 값 대신 토큰에서 강제 적용 (P0-2)
  const eventWithAuth = { ...req.body, user_id: req.userId! };

  const { valid, errors } = validateReviewEvent(eventWithAuth);
  if (!valid) {
    res.status(400).json({ error: '이벤트 검증 실패', details: errors });
    return;
  }

  try {
    const updatedState = await applyReviewResult(eventWithAuth as ReviewEvent);
    res.status(200).json({
      message: '복습 결과 저장 완료',
      nextDue: updatedState.due_ts,
      intervalDays: updatedState.interval_days,
      state: updatedState.state,
    });
  } catch (err) {
    console.error('[today/review] 처리 오류:', err);
    res.status(500).json({ error: '복습 결과 저장 중 서버 오류가 발생했습니다.' });
  }
});

export default router;
