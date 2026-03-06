/**
 * POST /v1/auth/google  — Google ID Token → 앱 JWT 교환
 * POST /v1/auth/logout  — 세션(jti) 폐기
 * GET  /v1/auth/me      — 현재 사용자 정보
 *
 * 흐름:
 * 1) 모바일에서 Google ID Token을 백엔드로 전송
 * 2) 백엔드가 Google 서버에서 토큰 검증 (audience, issuer, 서명)
 * 3) oauth_accounts에서 기존 사용자 조회 또는 신규 생성
 * 4) 앱 JWT(jti 포함) 발급 → user_sessions 기록
 * 5) 앱 JWT를 모바일에 반환 → Keychain 저장
 */

import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../db/pool';
import {
  verifyGoogleIdToken,
  issueAppToken,
  requireAuth,
} from '../middleware/auth';

const router = Router();

/**
 * POST /v1/auth/google
 * Body: { idToken: string, device?: string }
 */
router.post('/google', async (req: Request, res: Response): Promise<void> => {
  const { idToken, device = 'UNKNOWN' } = req.body ?? {};

  if (!idToken || typeof idToken !== 'string') {
    res.status(400).json({ error: 'idToken이 필요합니다.' });
    return;
  }

  if (!process.env.GOOGLE_CLIENT_ID) {
    res.status(500).json({ error: 'Google OAuth가 설정되지 않았습니다.' });
    return;
  }

  const client = await pool.connect();
  try {
    // 1) Google ID Token 검증
    const { sub: googleSub, emailHash } = await verifyGoogleIdToken(idToken);

    await client.query('BEGIN');

    // 2) 기존 OAuth 계정 조회
    const { rows: existing } = await client.query<{ user_id: string }>(
      `SELECT user_id FROM oauth_accounts WHERE provider = 'google' AND provider_sub = $1`,
      [googleSub]
    );

    let userId: string;
    let isNewUser = false;

    if (existing.length > 0) {
      userId = existing[0].user_id;
    } else {
      // 3) 신규 사용자 생성
      userId = `u_${uuidv4().replace(/-/g, '').slice(0, 16)}`;
      isNewUser = true;

      await client.query(
        `INSERT INTO users (user_id, consent_flags) VALUES ($1, $2)`,
        [userId, JSON.stringify({ required: false, optional: false, research: false })]
      );

      await client.query(
        `INSERT INTO oauth_accounts (user_id, provider, provider_sub, email_hash)
         VALUES ($1, 'google', $2, $3)`,
        [userId, googleSub, emailHash]
      );

      // 3-1) 신규 사용자 bootstrap: 모든 카드에 대한 초기 card_state 생성
      const bootstrapResult = await client.query(
        `INSERT INTO card_state (
           user_id, card_id, due_ts, interval_days, ease_factor, repetitions, stability, state
         )
         SELECT
           $1,
           c.card_id,
           NOW(),
           0,
           2.5,
           0,
           0,
           'new'
         FROM cards c
         ON CONFLICT (user_id, card_id) DO NOTHING`,
        [userId]
      );

      if ((bootstrapResult.rowCount ?? 0) === 0) {
        throw new Error('초기 학습 카드가 준비되지 않았습니다. seed 데이터 상태를 확인하세요.');
      }
    }

    // 4) 앱 JWT 발급
    const { token, jti, expiresAt } = issueAppToken(userId);

    // 5) 세션 기록 (감사 로그)
    await client.query(
      `INSERT INTO user_sessions (session_id, user_id, expires_at, device_hint)
       VALUES ($1, $2, $3, $4)`,
      [jti, userId, expiresAt, device]
    );

    await client.query('COMMIT');

    res.status(isNewUser ? 201 : 200).json({
      appToken: token,
      expiresAt: expiresAt.toISOString(),
      userId,
      isNewUser,
      readyForStudy: true,
    });
  } catch (err) {
    await client.query('ROLLBACK');

    if (err instanceof Error && err.message.includes('Token used too late')) {
      res.status(401).json({ error: 'Google ID Token이 만료되었습니다.' });
      return;
    }
    if (err instanceof Error && err.message.includes('Wrong recipient')) {
      res.status(401).json({ error: 'Google ID Token audience가 일치하지 않습니다.' });
      return;
    }

    console.error('[auth/google] 오류:', err);
    res.status(500).json({ error: '로그인 처리 중 서버 오류가 발생했습니다.' });
  } finally {
    client.release();
  }
});

/**
 * POST /v1/auth/logout — 현재 세션 폐기
 */
router.post('/logout', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { sessionId } = req;
  if (!sessionId) {
    res.status(400).json({ error: '세션 정보가 없습니다.' });
    return;
  }

  await pool.query(
    `UPDATE user_sessions SET revoked_at = NOW() WHERE session_id = $1`,
    [sessionId]
  );

  res.json({ message: '로그아웃 완료' });
});

/**
 * GET /v1/auth/me — 현재 사용자 정보 조회
 */
router.get('/me', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { userId } = req;

  const { rows } = await pool.query(
    `SELECT user_id, tz, locale, consent_flags, created_at FROM users WHERE user_id = $1`,
    [userId]
  );

  if (rows.length === 0) {
    res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
    return;
  }

  res.json(rows[0]);
});

/**
 * POST /v1/auth/consent — 동의 플래그 저장/갱신
 * Body: { required, optional, research, version, agreed_at }
 */
router.post('/consent', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { userId } = req;
  const { required, optional, research, version, agreed_at } = req.body ?? {};

  if (required === undefined || optional === undefined || research === undefined) {
    res.status(400).json({ error: 'required, optional, research 필드가 필요합니다.' });
    return;
  }

  if (!required) {
    res.status(400).json({ error: '필수 동의 없이 저장할 수 없습니다.' });
    return;
  }

  const flags = {
    required: Boolean(required),
    optional: Boolean(optional),
    research: Boolean(research),
    version: version ?? '1.0',
    agreed_at: agreed_at ?? new Date().toISOString(),
  };

  await pool.query(
    `UPDATE users SET consent_flags = $1, updated_at = NOW() WHERE user_id = $2`,
    [JSON.stringify(flags), userId]
  );

  res.json({ message: '동의 저장 완료', consentFlags: flags });
});

/**
 * DELETE /v1/user/me — 계정 및 모든 개인 데이터 삭제 (DSR, P0-3)
 *
 * 삭제 순서:
 * 1) 모든 세션 폐기 (토큰 즉시 무효)
 * 2) review_log, card_state, diagnosis_results, user_error_agg, user_daily_agg 삭제
 * 3) oauth_accounts 삭제
 * 4) users 레코드 익명화(soft) 또는 삭제
 *
 * AC:
 * - 삭제 후 토큰 사용 시 401
 * - DB에 users, review_log 등 사용자 데이터 미존재
 */
router.delete('/me', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId!;
  const sessionId = req.sessionId!;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1) 모든 세션 폐기 후 삭제 (DSR: 개인 데이터 완전 제거)
    await client.query(`DELETE FROM user_sessions WHERE user_id = $1`, [userId]);

    // 2) 학습 데이터 삭제
    await client.query(`DELETE FROM review_log WHERE user_id = $1`, [userId]);
    await client.query(`DELETE FROM card_state WHERE user_id = $1`, [userId]);
    await client.query(`DELETE FROM diagnosis_results WHERE user_id = $1`, [userId]);
    await client.query(`DELETE FROM user_error_agg WHERE user_id = $1`, [userId]);
    await client.query(`DELETE FROM user_daily_agg WHERE user_id = $1`, [userId]);
    await client.query(`DELETE FROM notification_prefs WHERE user_id = $1`, [userId]);
    await client.query(`DELETE FROM experiments WHERE user_id = $1`, [userId]);

    // 3) OAuth 연결 삭제
    await client.query(`DELETE FROM oauth_accounts WHERE user_id = $1`, [userId]);

    // 4) 사용자 레코드 삭제
    await client.query(`DELETE FROM users WHERE user_id = $1`, [userId]);

    await client.query('COMMIT');

    console.info(`[auth/delete-me] userId=${userId} 데이터 삭제 완료 (DSR)`);
    res.status(204).send();
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[auth/delete-me] 오류:', err);
    res.status(500).json({ error: '데이터 삭제 중 서버 오류가 발생했습니다.' });
  } finally {
    client.release();
  }
});

/**
 * POST /v1/auth/dev-init
 * 개발 모드 전용: 사용자 생성 + N5 카드 초기화 + 실제 JWT 발급
 * 반환된 appToken을 Keychain에 저장하면 requireAuth 미들웨어를 통과한다.
 */
router.post('/dev-init', async (req: Request, res: Response): Promise<void> => {
  if (process.env.NODE_ENV === 'production') {
    res.status(404).json({ error: '찾을 수 없는 엔드포인트입니다.' });
    return;
  }

  const { userId, device = 'WEB' } = req.body as { userId?: string; device?: string };
  if (!userId) {
    res.status(400).json({ error: 'userId 필요' });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1) 사용자 없으면 생성
    await client.query(
      `INSERT INTO users (user_id, consent_flags) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [userId, JSON.stringify({ required: true, optional: false, research: false })]
    );

    // 2) 카드 상태가 없는 카드만 초기화
    const { rowCount } = await client.query(
      `INSERT INTO card_state (user_id, card_id, due_ts, state)
       SELECT $1, c.card_id, NOW(), 'new'
       FROM cards c
       WHERE NOT EXISTS (
         SELECT 1 FROM card_state cs
         WHERE cs.user_id = $1 AND cs.card_id = c.card_id
       )`,
      [userId]
    );

    // 3) JWT 발급 + 세션 등록 (이전 세션은 폐기하지 않음 — dev 모드에서는 동시 세션 허용)
    const { token, jti, expiresAt } = issueAppToken(userId);
    await client.query(
      `INSERT INTO user_sessions (session_id, user_id, expires_at, device_hint)
       VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
      [jti, userId, expiresAt, device]
    );

    await client.query('COMMIT');

    res.json({
      message: '초기화 완료',
      userId,
      newCards: rowCount ?? 0,
      appToken: token,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[dev-init] 오류:', err);
    res.status(500).json({ error: '초기화 실패', detail: String(err) });
  } finally {
    client.release();
  }
});

export default router;
