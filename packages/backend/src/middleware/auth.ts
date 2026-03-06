/**
 * 인증 미들웨어
 *
 * 보안 원칙:
 * - Google ID Token은 google-auth-library로 검증 (audience, issuer, 서명 모두 확인)
 * - 앱 내부 JWT는 HS256 + jti(UUID) 기반으로 발급
 * - jti를 user_sessions 테이블에 기록해 로그아웃(토큰 폐기) 구현
 * - 만료된 토큰 / 폐기된 jti는 401 반환
 */

import { Request, Response, NextFunction } from 'express';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import { pool } from '../db/pool';
import crypto from 'crypto';

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// ─── 타입 확장 ──────────────────────────────────────────────
declare global {
  namespace Express {
    interface Request {
      userId?: string;
      sessionId?: string;
    }
  }
}

// ─── 앱 JWT 유틸 ────────────────────────────────────────────

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? '7d';

export interface AppTokenPayload {
  sub: string;   // user_id (가명)
  jti: string;   // 세션 ID (UUID)
  iat: number;
  exp: number;
}

/**
 * 앱 JWT 발급 (로그인 성공 시 호출)
 */
export function issueAppToken(userId: string): {
  token: string;
  jti: string;
  expiresAt: Date;
} {
  const jti = crypto.randomUUID();
  const token = jwt.sign({ sub: userId, jti }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
    algorithm: 'HS256',
  });

  const decoded = jwt.decode(token) as AppTokenPayload;
  const expiresAt = new Date(decoded.exp * 1000);

  return { token, jti, expiresAt };
}

/**
 * 앱 JWT 검증 미들웨어
 * Authorization: Bearer <token> 헤더에서 추출
 */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: '인증이 필요합니다.' });
    return;
  }

  const token = authHeader.slice(7);

  try {
    const payload = jwt.verify(token, JWT_SECRET, {
      algorithms: ['HS256'],
    }) as AppTokenPayload;

    // jti가 폐기되지 않았는지 확인 (로그아웃 여부)
    const { rows } = await pool.query(
      `SELECT session_id FROM user_sessions
       WHERE session_id = $1 AND revoked_at IS NULL AND expires_at > NOW()`,
      [payload.jti]
    );

    if (rows.length === 0) {
      res.status(401).json({ error: '세션이 만료되었거나 로그아웃된 토큰입니다.' });
      return;
    }

    req.userId = payload.sub;
    req.sessionId = payload.jti;
    next();
  } catch {
    res.status(401).json({ error: '유효하지 않은 토큰입니다.' });
  }
}

/**
 * 운영용 관리자 보호 미들웨어
 * - 개발 환경에서는 호출을 허용한다.
 * - 프로덕션에서는 x-admin-key 헤더가 ADMIN_API_KEY 와 일치해야 한다.
 */
export function requireAdminKey(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (process.env.NODE_ENV !== 'production') {
    next();
    return;
  }

  const expected = process.env.ADMIN_API_KEY;
  const provided = req.header('x-admin-key');

  if (!expected || !provided || provided !== expected) {
    res.status(403).json({ error: '관리자 권한이 필요합니다.' });
    return;
  }

  next();
}

/**
 * Google ID Token 검증 (POST /v1/auth/google 에서 사용)
 */
export async function verifyGoogleIdToken(idToken: string): Promise<{
  sub: string;
  emailHash: string;
}> {
  const ticket = await googleClient.verifyIdToken({
    idToken,
    audience: process.env.GOOGLE_CLIENT_ID,
  });

  const payload = ticket.getPayload();
  if (!payload?.sub) {
    throw new Error('Google ID Token 페이로드가 유효하지 않습니다.');
  }

  const emailHash = payload.email
    ? crypto.createHash('sha256').update(payload.email).digest('hex')
    : '';

  return { sub: payload.sub, emailHash };
}
