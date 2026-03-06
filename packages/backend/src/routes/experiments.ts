/**
 * GET  /v1/experiments/assignments   — 사용자 실험 배정 조회
 * GET  /v1/experiments/aa-validate   — A/A 균형 검증 (관리자)
 */

import { Router, Request, Response } from 'express';
import { requireAdminKey, requireAuth } from '../middleware/auth';
import {
  getUserAssignments,
  validateAaBalance,
} from '../services/experiment-service';

const router = Router();

/**
 * GET /v1/experiments/assignments
 * 현재 사용자의 모든 활성 실험 배정 반환
 * 클라이언트는 이 값을 캐싱하고 해당 variant에 맞는 경험을 노출한다.
 */
router.get('/assignments', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId!;

  try {
    const result = await getUserAssignments(userId);
    res.json(result);
  } catch (err) {
    console.error('[experiments/assignments] 오류:', err);
    res.status(500).json({ error: '실험 배정 조회 중 오류가 발생했습니다.' });
  }
});

/**
 * GET /v1/experiments/aa-validate?exp_id=aa_baseline_v1
 * A/A 테스트 균형 검증 (개발/운영 도구)
 */
router.get('/aa-validate', requireAdminKey, async (req: Request, res: Response): Promise<void> => {
  const expId = req.query.exp_id as string;
  if (!expId) {
    res.status(400).json({ error: 'exp_id 쿼리 파라미터가 필요합니다.' });
    return;
  }

  try {
    const result = await validateAaBalance(expId);
    res.json({
      ...result,
      note: result.is_balanced
        ? '✅ 그룹 균형 정상 (0.9 ~ 1.1 범위).'
        : '⚠️ 그룹 불균형 감지. 계측 오류 또는 배정 로직을 확인하세요.',
    });
  } catch (err) {
    console.error('[experiments/aa-validate] 오류:', err);
    res.status(500).json({ error: 'A/A 검증 중 오류가 발생했습니다.' });
  }
});

export default router;
