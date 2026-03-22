import { Router, Request, Response } from 'express';
import { requireAdminKey, requireAuth } from '../middleware/auth';
import { generateWeeklyReport, runDailyAggBatch, upsertDailyAgg } from '../services/report-service';
import { getShadowStatusOverview, refreshShadowModelsForActiveUsers } from '../services/shadow-model-service';

const router = Router();

router.get('/weekly', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId!;

  try {
    await upsertDailyAgg(userId, new Date());
    const report = await generateWeeklyReport(userId);
    res.json(report);
  } catch (err) {
    console.error('[report/weekly] error:', err);
    res.status(500).json({ error: 'Failed to generate weekly report.' });
  }
});

router.post('/batch', requireAdminKey, async (_req: Request, res: Response): Promise<void> => {
  try {
    const [aggResult, shadowCount] = await Promise.all([
      runDailyAggBatch(),
      refreshShadowModelsForActiveUsers(),
    ]);

    res.json({
      message: 'Batch completed.',
      processed_users: aggResult.processed,
      generated_reports: aggResult.processed,
      failed_users: 0,
      shadow_models_refreshed: shadowCount,
    });
  } catch (err) {
    console.error('[report/batch] error:', err);
    res.status(500).json({ error: 'Failed to run report batch.' });
  }
});

router.get('/shadow-status', requireAdminKey, async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await getShadowStatusOverview();
    res.json(result);
  } catch (err) {
    console.error('[report/shadow-status] error:', err);
    res.status(500).json({ error: 'Failed to load shadow status.' });
  }
});

export default router;
