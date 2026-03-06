/**
 * Google OAuth 2.0 + PKCE 로그인 서비스
 *
 * 보안 원칙 (RFC 8252 / RFC 9700):
 * - 외부 시스템 브라우저 사용 (인앱 WebView 금지)
 * - PKCE code_challenge_method = S256
 * - state 파라미터로 CSRF 방지
 * - 토큰은 expo-secure-store(Keychain/Keystore)에만 저장
 * - Google ID Token은 백엔드로 전달해 앱 JWT로 교환
 */

import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import { saveAppToken, clearAuthData, STORAGE_KEYS, secureSet } from './secure-storage';

// 외부 브라우저 인증 완료 후 앱으로 복귀하기 위한 준비
WebBrowser.maybeCompleteAuthSession();

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL ?? 'http://localhost:3000';

// 플랫폼별 Google OAuth 클라이언트 ID
const GOOGLE_CLIENT_ID =
  Platform.OS === 'ios'
    ? process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS ?? ''
    : Platform.OS === 'web'
    ? process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB ?? ''
    : process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID ?? '';

export interface LoginResult {
  success: boolean;
  userId?: string;
  isNewUser?: boolean;
  error?: string;
}

/**
 * Google OAuth PKCE 로그인 훅
 *
 * 사용 예시:
 *   const { login, isLoading } = useGoogleLogin();
 *   <Button onPress={login} />
 */
export function useGoogleLogin() {
  // useAutoDiscovery는 반드시 Hook 내부에서 호출 (Rules of Hooks)
  const discovery = AuthSession.useAutoDiscovery('https://accounts.google.com');

  // PKCE + state를 자동 관리하는 AuthSession 훅
  const [request, , promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: GOOGLE_CLIENT_ID,
      redirectUri: AuthSession.makeRedirectUri({ scheme: 'japaneselearn' }),
      scopes: ['openid', 'email', 'profile'],
      responseType: AuthSession.ResponseType.Code,
      // PKCE는 expo-auth-session이 자동으로 code_verifier/code_challenge 생성
      usePKCE: true,
    },
    discovery
  );

  async function login(): Promise<LoginResult> {
    if (!request) {
      return { success: false, error: 'OAuth 요청 준비 중입니다. 잠시 후 다시 시도하세요.' };
    }

    // 외부 브라우저(시스템 브라우저)로 인증 화면 열기
    const result = await promptAsync();

    if (result.type === 'cancel' || result.type === 'dismiss') {
      return { success: false, error: '로그인이 취소되었습니다.' };
    }

    if (result.type === 'error') {
      return { success: false, error: result.error?.message ?? '인증 오류가 발생했습니다.' };
    }

    if (result.type !== 'success') {
      return { success: false, error: '알 수 없는 오류가 발생했습니다.' };
    }

    // Authorization Code → ID Token 교환 (PKCE code_verifier 포함)
    const tokenResponse = await AuthSession.exchangeCodeAsync(
      {
        clientId: GOOGLE_CLIENT_ID,
        redirectUri: AuthSession.makeRedirectUri({ scheme: 'japaneselearn' }),
        code: result.params.code,
        extraParams: { code_verifier: request.codeVerifier ?? '' },
      },
      discovery!
    );

    const idToken = tokenResponse.idToken;
    if (!idToken) {
      return { success: false, error: 'Google ID Token을 받지 못했습니다.' };
    }

    // 백엔드에 ID Token 전달 → 앱 JWT 수령
    return exchangeIdTokenForAppToken(idToken);
  }

  return { login, isLoading: !request };
}

/**
 * Google ID Token → 백엔드 앱 JWT 교환
 * (직접 호출 시에도 사용 가능)
 */
export async function exchangeIdTokenForAppToken(idToken: string): Promise<LoginResult> {
  try {
    const res = await fetch(`${BACKEND_URL}/v1/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        idToken,
        device: Platform.OS === 'ios' ? 'IOS' : 'ANDROID',
      }),
    });

    if (!res.ok) {
      const body = await res.json();
      return { success: false, error: body.error ?? `서버 오류: ${res.status}` };
    }

    const { appToken, expiresAt, userId, isNewUser } = await res.json();

    // 앱 JWT + 만료시각 → Keychain/Keystore 저장
    await saveAppToken(appToken, expiresAt);
    await secureSet(STORAGE_KEYS.USER_ID, userId);

    return { success: true, userId, isNewUser };
  } catch (err) {
    return { success: false, error: `네트워크 오류: ${String(err)}` };
  }
}

/**
 * 로그아웃 — 서버 세션 폐기 + 로컬 토큰 삭제
 */
export async function logout(appToken: string): Promise<void> {
  try {
    await fetch(`${BACKEND_URL}/v1/auth/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${appToken}` },
    });
  } finally {
    await clearAuthData();
  }
}
