/**
 * AES-256-GCM 암호화 유틸 (P1-4)
 *
 * 용도: notification_prefs.push_token 등 DB에 저장되는 PII 토큰 암호화
 *
 * 설계 원칙 (report.mdc / OWASP):
 * - 키: PUSH_TOKEN_ENCRYPTION_KEY 환경변수 (32바이트 hex = 64자)
 * - 각 암호화 호출마다 랜덤 IV(12바이트) 생성 → replay attack 방지
 * - 출력 포맷: "iv_hex:authTag_hex:ciphertext_hex"
 * - 복호화 실패 시 null 반환 (로그 + 무음 처리)
 *
 * 키 생성 예시 (개발):
 *   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LEN = 12;       // GCM 표준 IV 길이
const TAG_LEN = 16;      // GCM 인증 태그 길이

/**
 * 환경변수에서 32바이트 암호화 키를 로드
 * 키가 없거나 형식 오류면 개발용 임시 키 경고 후 사용
 */
function getEncryptionKey(): Buffer {
  const keyHex = process.env.PUSH_TOKEN_ENCRYPTION_KEY;
  if (keyHex && /^[0-9a-fA-F]{64}$/.test(keyHex)) {
    return Buffer.from(keyHex, 'hex');
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      '[crypto-service] PUSH_TOKEN_ENCRYPTION_KEY 환경변수가 설정되지 않았습니다. ' +
      '64자 hex 문자열(32바이트)이 필요합니다.'
    );
  }

  // 개발 환경 전용 고정 키 (프로덕션 절대 사용 금지)
  console.warn('[crypto-service] 개발용 임시 암호화 키를 사용합니다. 프로덕션에서 PUSH_TOKEN_ENCRYPTION_KEY를 설정하세요.');
  return Buffer.from('0'.repeat(64), 'hex');
}

/**
 * 평문 문자열을 AES-256-GCM으로 암호화
 * @returns "iv_hex:authTag_hex:ciphertext_hex"
 */
export function encryptToken(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [iv.toString('hex'), authTag.toString('hex'), encrypted.toString('hex')].join(':');
}

/**
 * "iv_hex:authTag_hex:ciphertext_hex" 형식의 암호문을 복호화
 * @returns 복호화된 평문 또는 null (복호화 실패 시)
 */
export function decryptToken(ciphertext: string): string | null {
  try {
    const [ivHex, tagHex, encHex] = ciphertext.split(':');
    if (!ivHex || !tagHex || !encHex) return null;

    const key = getEncryptionKey();
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(tagHex, 'hex');
    const encrypted = Buffer.from(encHex, 'hex');

    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  } catch (err) {
    console.warn('[crypto-service] push_token 복호화 실패:', err);
    return null;
  }
}

/**
 * 문자열이 암호화된 포맷인지 확인
 * (iv:tag:cipher 형식 = 3개 ':' 구분)
 */
export function isEncrypted(value: string): boolean {
  return value.split(':').length === 3;
}
