/**
 * POST /v1/plan/generate — 일일 학습 플랜 생성 API
 * GET  /v1/plan/latest   — 마지막 플랜 조회
 */

import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { generatePlan, PlanRequest } from '../services/plan-generator';

const router = Router();

/**
 * POST /v1/plan/generate
 *
 * 요청 예시 (rules/report.mdc API 스펙과 동일):
 * {
 *   "date": "2026-03-05",
 *   "goal": { "target_level": "JLPT_N3", "focus": ["READING", "VOCAB"] },
 *   "constraints": { "daily_minutes": 20, "max_new": 10 },
 *   "analysis_result": { "strategy_vector": {...}, "retention_target": 0.90 }
 * }
 */
router.post('/generate', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId!;
  const { date, goal, constraints, analysis_result } = req.body ?? {};

  if (!constraints?.daily_minutes) {
    res.status(400).json({ error: 'constraints.daily_minutes 가 필요합니다.' });
    return;
  }

  const planReq: PlanRequest = {
    user_id: userId,
    date: date ?? new Date().toISOString().slice(0, 10),
    goal: goal ?? {},
    constraints: {
      daily_minutes: Number(constraints.daily_minutes),
      max_new: constraints.max_new ? Number(constraints.max_new) : undefined,
      offline_expected: Boolean(constraints.offline_expected),
    },
    analysis_result,
  };

  try {
    const plan = await generatePlan(planReq);

    // 프로덕션에서 debug 필드 제거
    if (process.env.NODE_ENV === 'production') {
      delete (plan as unknown as Record<string, unknown>).debug;
    }

    res.status(200).json(plan);
  } catch (err) {
    console.error('[plan/generate] 오류:', err);
    res.status(500).json({ error: '플랜 생성 중 서버 오류가 발생했습니다.' });
  }
});

export default router;
