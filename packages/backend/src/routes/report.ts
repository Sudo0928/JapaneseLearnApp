/**
 * GET  /v1/report/weekly  — 주간 리포트
 * POST /v1/report/batch   — 일배치 수동 트리거 (관리자용)
 */

import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { generateWeeklyReport, runDailyAggBatch, upsertDailyAgg } from '../services/report-service';

const router = Router();

/**
 * GET /v1/report/weekly
 * 현재 사용자의 최근 7일 주간 리포트 반환
 */
router.get('/weekly', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId!;

  try {
    // 오늘 집계가 없으면 즉시 갱신
    await upsertDailyAgg(userId, new Date());

    const report = await generateWeeklyReport(userId);
    res.json(report);
  } catch (err) {
    console.error('[report/weekly] 오류:', err);
    res.status(500).json({ error: '리포트 생성 중 오류가 발생했습니다.' });
  }
});

/**
 * POST /v1/report/batch
 * 일배치 수동 트리거 (개발/관리자용, 프로덕션에서는 크론으로 실행)
 */
router.post('/batch', async (_req: Request, res: Response): Promise<void> => {
  if (process.env.NODE_ENV === 'production') {
    res.status(403).json({ error: '프로덕션에서는 크론 스케줄러를 사용하세요.' });
    return;
  }

  try {
    const result = await runDailyAggBatch();
    res.json({ message: '일배치 완료', ...result });
  } catch (err) {
    console.error('[report/batch] 오류:', err);
    res.status(500).json({ error: '배치 처리 중 오류가 발생했습니다.' });
  }
});

export default router;
