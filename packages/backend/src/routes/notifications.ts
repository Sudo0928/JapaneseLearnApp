/**
 * GET  /v1/notifications/prefs   — 알림 설정 조회
 * PUT  /v1/notifications/prefs   — 알림 설정 저장
 * POST /v1/notifications/token   — Expo Push Token 등록
 *
 * 설계 원칙 (rules/report.mdc):
 * - 스트릭 강제/벌점형 알림 금지
 * - 알림은 사용자 설정 시간창 내에서만
 * - "회복 플랜" 제공(연체 폭탄 분산)
 * - enabled 기본값 false (옵트인)
 */

import { Router, Request, Response } from 'express';
import { pool } from '../db/pool';
import { requireAuth } from '../middleware/auth';
import { encryptToken, decryptToken, isEncrypted } from '../services/crypto-service';

const router = Router();

interface NotificationPrefs {
  enabled: boolean;
  window_start: string | null;
  window_end: string | null;
  timezone: string;
  recovery_plan: boolean;
}

/**
 * GET /v1/notifications/prefs
 */
router.get('/prefs', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId!;

  const { rows } = await pool.query(
    `SELECT enabled, window_start::TEXT, window_end::TEXT, timezone, recovery_plan, push_token
     FROM notification_prefs WHERE user_id = $1`,
    [userId]
  );

  if (rows.length === 0) {
    // 설정 없으면 기본값 반환 (기본 OFF)
    res.json({
      enabled: false,
      window_start: '08:00',
      window_end: '22:00',
      timezone: 'Asia/Seoul',
      recovery_plan: true,
    });
    return;
  }

  // P1-4: push_token은 클라이언트에 반환하지 않음 (has_token 여부만 전달)
  const { push_token: storedToken, ...prefs } = rows[0] as typeof rows[0] & { push_token?: string };
  res.json({ ...prefs, has_push_token: Boolean(storedToken) });
});

/**
 * PUT /v1/notifications/prefs
 * Body: NotificationPrefs
 */
router.put('/prefs', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId!;
  const body = req.body as Partial<NotificationPrefs>;

  // 기본값 병합
  const enabled = typeof body.enabled === 'boolean' ? body.enabled : false;
  const windowStart = body.window_start ?? '08:00';
  const windowEnd = body.window_end ?? '22:00';
  const timezone = body.timezone ?? 'Asia/Seoul';
  const recoveryPlan = typeof body.recovery_plan === 'boolean' ? body.recovery_plan : true;

  // 시간창 유효성 검사
  if (!isValidTime(windowStart) || !isValidTime(windowEnd)) {
    res.status(400).json({ error: 'window_start, window_end 형식이 올바르지 않습니다. (예: "08:00")' });
    return;
  }

  await pool.query(
    `
    INSERT INTO notification_prefs (user_id, enabled, window_start, window_end, timezone, recovery_plan, updated_at)
    VALUES ($1, $2, $3::TIME, $4::TIME, $5, $6, NOW())
    ON CONFLICT (user_id) DO UPDATE
      SET enabled = EXCLUDED.enabled,
          window_start = EXCLUDED.window_start,
          window_end = EXCLUDED.window_end,
          timezone = EXCLUDED.timezone,
          recovery_plan = EXCLUDED.recovery_plan,
          updated_at = NOW()
    `,
    [userId, enabled, windowStart, windowEnd, timezone, recoveryPlan]
  );

  res.json({ message: '알림 설정이 저장되었습니다.', enabled });
});

/**
 * POST /v1/notifications/token
 * Expo Push Token 등록 (PII 처리 주의)
 */
router.post('/token', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId!;
  const { push_token } = req.body ?? {};

  if (!push_token || typeof push_token !== 'string') {
    res.status(400).json({ error: 'push_token이 필요합니다.' });
    return;
  }

  // Expo Push Token 형식 검증
  if (!push_token.startsWith('ExponentPushToken[') && !push_token.startsWith('ExpoPushToken[')) {
    res.status(400).json({ error: '유효하지 않은 Expo Push Token 형식입니다.' });
    return;
  }

  // P1-4: push_token은 AES-256-GCM으로 암호화하여 저장 (DB 덤프에 평문 노출 방지)
  const encryptedToken = encryptToken(push_token);

  await pool.query(
    `
    INSERT INTO notification_prefs (user_id, push_token, updated_at)
    VALUES ($1, $2, NOW())
    ON CONFLICT (user_id) DO UPDATE
      SET push_token = EXCLUDED.push_token, updated_at = NOW()
    `,
    [userId, encryptedToken]
  );

  res.json({ message: 'Push Token이 등록되었습니다.' });
});

function isValidTime(t: string): boolean {
  return /^\d{2}:\d{2}$/.test(t);
}

/**
 * 알림 발송 서비스에서 사용: push_token 복호화 조회
 * P1-4: 평문 토큰은 DB에 저장되지 않으므로 복호화 후 사용
 */
export async function getDecryptedPushToken(userId: string): Promise<string | null> {
  const { rows } = await pool.query<{ push_token: string | null }>(
    `SELECT push_token FROM notification_prefs WHERE user_id = $1 AND enabled = true`,
    [userId]
  );
  if (!rows[0]?.push_token) return null;

  const raw = rows[0].push_token;
  // 구 데이터(평문) 호환: 암호화 포맷이 아니면 그대로 반환 (마이그레이션 기간)
  if (!isEncrypted(raw)) return raw;
  return decryptToken(raw);
}

export default router;
