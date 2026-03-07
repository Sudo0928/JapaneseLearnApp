import { Request, Response, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../db/pool';
import {
  hasGoogleOAuthConfig,
  issueAppToken,
  requireAuth,
  verifyGoogleIdToken,
} from '../middleware/auth';
import { ensureAllCardStatesForUser } from '../services/card-state-service';

const router = Router();

router.post('/google', async (req: Request, res: Response): Promise<void> => {
  const { idToken, device = 'UNKNOWN' } = req.body ?? {};

  if (!idToken || typeof idToken !== 'string') {
    res.status(400).json({ error: 'idToken is required.' });
    return;
  }

  if (!hasGoogleOAuthConfig()) {
    res.status(500).json({
      error: 'Google OAuth is not configured on the backend. Set GOOGLE_CLIENT_ID or GOOGLE_CLIENT_ID_WEB.',
    });
    return;
  }

  const client = await pool.connect();
  try {
    const { sub: googleSub, emailHash } = await verifyGoogleIdToken(idToken);

    await client.query('BEGIN');

    const { rows: existing } = await client.query<{ user_id: string }>(
      `SELECT user_id FROM oauth_accounts WHERE provider = 'google' AND provider_sub = $1`,
      [googleSub]
    );

    let userId: string;
    let isNewUser = false;

    if (existing.length > 0) {
      userId = existing[0].user_id;
    } else {
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

      const insertedCardStates = await ensureAllCardStatesForUser(userId, client);
      if (insertedCardStates === 0) {
        throw new Error('Initial study cards are missing. Check seed data before creating users.');
      }
    }

    const { token, jti, expiresAt } = issueAppToken(userId);

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
      res.status(401).json({ error: 'Google ID token has expired.' });
      return;
    }

    if (err instanceof Error && err.message.includes('Wrong recipient')) {
      res.status(401).json({ error: 'Google ID token audience does not match the configured client IDs.' });
      return;
    }

    if (err instanceof Error && err.message.includes('Google OAuth client IDs are not configured')) {
      res.status(500).json({ error: 'Google OAuth client IDs are missing on the backend.' });
      return;
    }

    console.error('[auth/google] error:', err);
    res.status(500).json({ error: 'Failed to complete Google login.' });
  } finally {
    client.release();
  }
});

router.post('/logout', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { sessionId } = req;
  if (!sessionId) {
    res.status(400).json({ error: 'Session information is missing.' });
    return;
  }

  await pool.query(
    `UPDATE user_sessions SET revoked_at = NOW() WHERE session_id = $1`,
    [sessionId]
  );

  res.json({ message: 'Logout complete.' });
});

router.get('/me', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { userId } = req;

  const { rows } = await pool.query(
    `SELECT user_id, tz, locale, consent_flags, created_at FROM users WHERE user_id = $1`,
    [userId]
  );

  if (rows.length === 0) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }

  res.json(rows[0]);
});

router.post('/consent', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { userId } = req;
  const { required, optional, research, version, agreed_at } = req.body ?? {};

  if (required === undefined || optional === undefined || research === undefined) {
    res.status(400).json({ error: 'required, optional, and research fields are required.' });
    return;
  }

  if (!required) {
    res.status(400).json({ error: 'Required consent must be accepted.' });
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

  res.json({ message: 'Consent saved.', consentFlags: flags });
});

router.delete('/me', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId!;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`DELETE FROM user_sessions WHERE user_id = $1`, [userId]);
    await client.query(`DELETE FROM review_log WHERE user_id = $1`, [userId]);
    await client.query(`DELETE FROM card_state WHERE user_id = $1`, [userId]);
    await client.query(`DELETE FROM diagnosis_results WHERE user_id = $1`, [userId]);
    await client.query(`DELETE FROM user_error_agg WHERE user_id = $1`, [userId]);
    await client.query(`DELETE FROM user_daily_agg WHERE user_id = $1`, [userId]);
    await client.query(`DELETE FROM notification_prefs WHERE user_id = $1`, [userId]);
    await client.query(`DELETE FROM experiments WHERE user_id = $1`, [userId]);
    await client.query(`DELETE FROM oauth_accounts WHERE user_id = $1`, [userId]);
    await client.query(`DELETE FROM users WHERE user_id = $1`, [userId]);

    await client.query('COMMIT');

    console.info(`[auth/delete-me] userId=${userId} deleted`);
    res.status(204).send();
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[auth/delete-me] error:', err);
    res.status(500).json({ error: 'Failed to delete user data.' });
  } finally {
    client.release();
  }
});

router.post('/dev-init', async (req: Request, res: Response): Promise<void> => {
  if (process.env.NODE_ENV === 'production') {
    res.status(404).json({ error: 'Not found.' });
    return;
  }

  const { userId, device = 'WEB' } = req.body as { userId?: string; device?: string };
  if (!userId) {
    res.status(400).json({ error: 'userId is required.' });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(
      `INSERT INTO users (user_id, consent_flags) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [userId, JSON.stringify({ required: true, optional: false, research: false })]
    );

    const insertedCardStates = await ensureAllCardStatesForUser(userId, client);

    const { token, jti, expiresAt } = issueAppToken(userId);
    await client.query(
      `INSERT INTO user_sessions (session_id, user_id, expires_at, device_hint)
       VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
      [jti, userId, expiresAt, device]
    );

    await client.query('COMMIT');

    res.json({
      message: 'Development bootstrap complete.',
      userId,
      newCards: insertedCardStates,
      appToken: token,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[dev-init] error:', err);
    res.status(500).json({ error: 'Development bootstrap failed.', detail: String(err) });
  } finally {
    client.release();
  }
});

export default router;
