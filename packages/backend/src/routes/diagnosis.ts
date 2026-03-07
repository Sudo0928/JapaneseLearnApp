/**
 * GET  /v1/diagnosis/result    — 저장된 진단 결과 조회
 * POST /v1/diagnosis/submit-v2 — 인지심리학 기반 진단 제출
 */

import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import type {
  DiagnosisResultResponse,
  DiagnosisSubmitV2Request,
} from '@japanese-learn/shared';

const router = Router();
type DiagnosisStrategyVector = DiagnosisResultResponse['strategy_vector'];

/**
 * GET /v1/diagnosis/result
 * 저장된 진단 결과 반환 (플랜 화면에서 사용)
 */
router.get('/result', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId!;
  try {
    const { rows } = await (await import('../db/pool')).pool.query(
      `SELECT strategy_vector, weakness_flags
       FROM diagnosis_results
       WHERE user_id = $1
       ORDER BY completed_at DESC LIMIT 1`,
      [userId],
    );
    if (!rows.length) {
      res.status(404).json({ error: '진단 결과가 없습니다.' });
      return;
    }
    const row = rows[0] as {
      strategy_vector: DiagnosisStrategyVector;
      weakness_flags: Record<string, boolean>;
    };
    const weakFlags = Object.entries(row.weakness_flags ?? {})
      .filter(([, v]) => v)
      .map(([k]) => k);
    const response: DiagnosisResultResponse = {
      strategy_vector: row.strategy_vector,
      weakness_flags: weakFlags,
      notes: buildDiagNotes(row.weakness_flags ?? {}),
    };
    res.json(response);
  } catch (err) {
    console.error('[diagnosis/result] 오류:', err);
    res.status(500).json({ error: '서버 오류' });
  }
});

/**
 * POST /v1/diagnosis/submit-v2
 * 인지심리학 기반 새 진단 형식 제출 (표준 계약)
 * Body: {
 *   phase: 'cognitive_v2',
 *   self_assessment: { target_level, daily_minutes, weak_areas[] },
 *   memory_pairs: { recall_correct, recall_total, recognition_correct, recognition_total, avg_rt_ms },
 *   digit_span: { max_correct_span },
 *   visual_discrimination: { correct, total, avg_rt_ms }
 * }
 */
router.post('/submit-v2', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId!;
  const {
    self_assessment,
    memory_pairs,
    digit_span,
    visual_discrimination,
  } = (req.body ?? {}) as Partial<DiagnosisSubmitV2Request>;

  if (!memory_pairs || !digit_span || !visual_discrimination) {
    res.status(400).json({ error: '필수 진단 데이터가 없습니다.' });
    return;
  }

  try {
    const recall_rate  = (memory_pairs.recall_correct ?? 0) / Math.max(memory_pairs.recall_total ?? 1, 1);
    const recog_rate   = (memory_pairs.recognition_correct ?? 0) / Math.max(memory_pairs.recognition_total ?? 1, 1);
    const recall_gap   = parseFloat(Math.max(0, recog_rate - recall_rate).toFixed(3));

    const span         = digit_span.max_correct_span ?? 4;
    const load_sensitive = parseFloat(Math.max(0, Math.min(1, 1 - span / 7)).toFixed(3));

    const vis_acc     = (visual_discrimination.correct ?? 0) / Math.max(visual_discrimination.total ?? 1, 1);
    const form_weak   = parseFloat(Math.max(0, 1 - vis_acc).toFixed(3));

    const weak_areas  = (self_assessment?.weak_areas ?? []) as string[];
    const reading_weak = parseFloat((weak_areas.includes('reading') ? 0.7 : 0.3).toFixed(3));

    const strategy_vector = { recall_gap, reading_weak, form_weak, load_sensitive };

    const weakness_flags: Record<string, boolean> = {
      recall_weak:    recall_gap >= 0.4,
      reading_weak:   reading_weak >= 0.6,
      form_weak:      form_weak >= 0.5,
      load_sensitive: load_sensitive >= 0.6,
    };

    const { pool } = await import('../db/pool');
    await pool.query(
      `INSERT INTO diagnosis_results (user_id, strategy_vector, weakness_flags, accuracy, event_count, completed_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         strategy_vector = EXCLUDED.strategy_vector,
         weakness_flags  = EXCLUDED.weakness_flags,
         accuracy        = EXCLUDED.accuracy,
         event_count     = EXCLUDED.event_count,
         completed_at    = EXCLUDED.completed_at`,
      [
        userId,
        JSON.stringify(strategy_vector),
        JSON.stringify(weakness_flags),
        recall_rate,
        (memory_pairs.recall_total ?? 0) + (memory_pairs.recognition_total ?? 0) + (visual_discrimination.total ?? 0),
      ],
    );

    const response: DiagnosisResultResponse = {
      strategy_vector,
      weakness_flags: Object.entries(weakness_flags).filter(([, v]) => v).map(([k]) => k),
      notes: buildDiagNotes(weakness_flags),
    };

    res.status(201).json(response);
  } catch (err) {
    console.error('[diagnosis/submit-v2] 오류:', err);
    res.status(500).json({ error: '진단 처리 중 서버 오류' });
  }
});

/**
 * 진단 결과 설명 문장 생성 (3~5문장, 설명 가능성 원칙)
 */
function buildDiagNotes(flags: Record<string, boolean>): string[] {
  const notes: string[] = [];
  if (flags.reading_weak) notes.push('읽기(히라가나) 혼동이 많습니다. 표기→읽기 문항 비중을 높였습니다.');
  if (flags.recall_weak) notes.push('선택형(MCQ)보다 입력형 정확도가 낮습니다. 인출 연습을 강화합니다.');
  if (flags.form_weak)   notes.push('형태(한자 표기) 회상이 취약합니다. 미니 쓰기 문항을 추가합니다.');
  if (flags.load_sensitive) notes.push('힌트 사용 빈도가 높습니다. 짧은 세션으로 나눠 진행합니다.');
  if (notes.length === 0) notes.push('전반적으로 균형 잡힌 결과입니다. 기본 학습 플랜을 시작합니다.');
  return notes;
}

export default router;
