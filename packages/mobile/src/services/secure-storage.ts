/**
 * 보안 저장소 래퍼 (expo-secure-store 기반)
 *
 * 보안 원칙 (OWASP Mobile Security / RFC 9700):
 * - 토큰·민감 데이터는 반드시 Keychain(iOS) / Keystore(Android)에 저장
 * - 웹(개발/대시보드)에서는 localStorage 폴백 사용 (보안 등급 낮음, 개발 전용)
 */

import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// 웹 환경 여부
const IS_WEB = Platform.OS === 'web';

// 웹 폴백: localStorage
const webStorage = {
  setItemAsync: async (key: string, value: string) => {
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
  },
  getItemAsync: async (key: string): Promise<string | null> => {
    if (typeof localStorage !== 'undefined') return localStorage.getItem(key);
    return null;
  },
  deleteItemAsync: async (key: string) => {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(key);
  },
};

// ─── 저장소 키 상수 ───────────────────────────────────────────
export const STORAGE_KEYS = {
  APP_TOKEN: 'jla_app_token',         // 백엔드 발급 JWT
  APP_TOKEN_EXPIRES: 'jla_token_exp', // 만료 시각 (ISO 8601)
  USER_ID: 'jla_user_id',             // 가명 처리 사용자 ID
  CONSENT_VERSION: 'jla_consent_ver', // 동의한 정책 버전
  DIAGNOSIS_DONE: 'jla_diag_done',    // 진단 완료 여부 ('1' = 완료)
} as const;

type StorageKey = typeof STORAGE_KEYS[keyof typeof STORAGE_KEYS];

/**
 * 문자열 값을 보안 저장소에 저장
 */
export async function secureSet(key: StorageKey, value: string): Promise<void> {
  if (IS_WEB) {
    await webStorage.setItemAsync(key, value);
  } else {
    await SecureStore.setItemAsync(key, value, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  }
}

/**
 * 보안 저장소에서 값 조회 (없으면 null)
 */
export async function secureGet(key: StorageKey): Promise<string | null> {
  if (IS_WEB) return webStorage.getItemAsync(key);
  return SecureStore.getItemAsync(key);
}

/**
 * 보안 저장소에서 값 삭제
 */
export async function secureDelete(key: StorageKey): Promise<void> {
  if (IS_WEB) {
    await webStorage.deleteItemAsync(key);
  } else {
    await SecureStore.deleteItemAsync(key);
  }
}

/**
 * 앱 토큰 저장 (토큰 + 만료 시각 함께 저장)
 */
export async function saveAppToken(token: string, expiresAt: string): Promise<void> {
  await secureSet(STORAGE_KEYS.APP_TOKEN, token);
  await secureSet(STORAGE_KEYS.APP_TOKEN_EXPIRES, expiresAt);
}

/**
 * 저장된 앱 토큰 조회 + 만료 여부 확인
 */
export async function getValidAppToken(): Promise<string | null> {
  const [token, expiresAt] = await Promise.all([
    secureGet(STORAGE_KEYS.APP_TOKEN),
    secureGet(STORAGE_KEYS.APP_TOKEN_EXPIRES),
  ]);

  if (!token || !expiresAt) return null;

  // 만료 5분 전부터 갱신 필요로 간주
  const expiresMs = new Date(expiresAt).getTime();
  const nowMs = Date.now();
  const bufferMs = 5 * 60 * 1000;

  if (nowMs + bufferMs >= expiresMs) {
    await clearAuthData();
    return null;
  }

  return token;
}

/**
 * 로그아웃 시 모든 인증 데이터 삭제
 */
export async function clearAuthData(): Promise<void> {
  await Promise.all([
    secureDelete(STORAGE_KEYS.APP_TOKEN),
    secureDelete(STORAGE_KEYS.APP_TOKEN_EXPIRES),
    secureDelete(STORAGE_KEYS.USER_ID),
  ]);
}
