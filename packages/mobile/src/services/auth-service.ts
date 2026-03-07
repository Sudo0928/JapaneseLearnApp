import * as AuthSession from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import { saveAppToken, clearAuthData, STORAGE_KEYS, secureSet } from './secure-storage';

WebBrowser.maybeCompleteAuthSession();

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL ?? 'http://localhost:3000';

function normalizeGoogleClientId(value?: string): string {
  const trimmed = value?.trim() ?? '';
  return trimmed.endsWith('.apps.googleusercontent.com') ? trimmed : '';
}

const GOOGLE_WEB_CLIENT_ID = normalizeGoogleClientId(process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB);
const GOOGLE_IOS_CLIENT_ID = normalizeGoogleClientId(process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS);
const GOOGLE_ANDROID_CLIENT_ID = normalizeGoogleClientId(process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID);

function getCurrentPlatformClientId(): string {
  if (Platform.OS === 'ios') return GOOGLE_IOS_CLIENT_ID;
  if (Platform.OS === 'android') return GOOGLE_ANDROID_CLIENT_ID;
  return GOOGLE_WEB_CLIENT_ID;
}

export interface LoginResult {
  success: boolean;
  userId?: string;
  isNewUser?: boolean;
  error?: string;
}

function getMissingClientIdError(): LoginResult {
  return {
    success: false,
    error: `Google OAuth client ID is missing for ${Platform.OS}. Check packages/mobile/.env.`,
  };
}

function useGoogleWebLogin() {
  const [request, , promptAsync] = Google.useIdTokenAuthRequest(
    {
      webClientId: GOOGLE_WEB_CLIENT_ID,
      scopes: ['openid', 'email', 'profile'],
      selectAccount: true,
    },
    { scheme: 'japaneselearn' }
  );

  async function login(): Promise<LoginResult> {
    if (!GOOGLE_WEB_CLIENT_ID) {
      return getMissingClientIdError();
    }

    if (!request) {
      return { success: false, error: 'OAuth request is still loading. Try again in a moment.' };
    }

    const result = await promptAsync();

    if (result.type === 'cancel' || result.type === 'dismiss') {
      return { success: false, error: 'Login was cancelled.' };
    }

    if (result.type === 'error') {
      return { success: false, error: result.error?.message ?? 'OAuth error occurred.' };
    }

    if (result.type !== 'success') {
      return { success: false, error: 'Unexpected OAuth result.' };
    }

    const idToken = result.params.id_token;
    if (!idToken) {
      return { success: false, error: 'Google did not return an ID token.' };
    }

    return exchangeIdTokenForAppToken(idToken);
  }

  return { login, isLoading: !request };
}

function useGoogleNativeLogin() {
  const discovery = AuthSession.useAutoDiscovery('https://accounts.google.com');
  const nativeClientId = getCurrentPlatformClientId();
  const redirectUri = AuthSession.makeRedirectUri({ scheme: 'japaneselearn' });

  const [request, , promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: nativeClientId,
      redirectUri,
      scopes: ['openid', 'email', 'profile'],
      responseType: AuthSession.ResponseType.Code,
      usePKCE: true,
    },
    discovery
  );

  async function login(): Promise<LoginResult> {
    if (!nativeClientId) {
      return getMissingClientIdError();
    }

    if (!request) {
      return { success: false, error: 'OAuth request is still loading. Try again in a moment.' };
    }

    const result = await promptAsync();

    if (result.type === 'cancel' || result.type === 'dismiss') {
      return { success: false, error: 'Login was cancelled.' };
    }

    if (result.type === 'error') {
      return { success: false, error: result.error?.message ?? 'OAuth error occurred.' };
    }

    if (result.type !== 'success') {
      return { success: false, error: 'Unexpected OAuth result.' };
    }

    const tokenResponse = await AuthSession.exchangeCodeAsync(
      {
        clientId: nativeClientId,
        redirectUri,
        code: result.params.code,
        extraParams: { code_verifier: request.codeVerifier ?? '' },
      },
      discovery!
    );

    const idToken = tokenResponse.idToken;
    if (!idToken) {
      return { success: false, error: 'Google did not return an ID token.' };
    }

    return exchangeIdTokenForAppToken(idToken);
  }

  return { login, isLoading: !request };
}

export function useGoogleLogin() {
  const clientId = getCurrentPlatformClientId();

  if (!clientId) {
    return {
      login: async (): Promise<LoginResult> => getMissingClientIdError(),
      isLoading: false,
    };
  }

  if (Platform.OS === 'web') {
    return useGoogleWebLogin();
  }

  return useGoogleNativeLogin();
}

export async function exchangeIdTokenForAppToken(idToken: string): Promise<LoginResult> {
  try {
    const res = await fetch(`${BACKEND_URL}/v1/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        idToken,
        device: Platform.OS === 'ios'
          ? 'IOS'
          : Platform.OS === 'android'
            ? 'ANDROID'
            : 'WEB',
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: `Server error: ${res.status}` }));
      return { success: false, error: body.error ?? `Server error: ${res.status}` };
    }

    const { appToken, expiresAt, userId, isNewUser } = await res.json();
    await saveAppToken(appToken, expiresAt);
    await secureSet(STORAGE_KEYS.USER_ID, userId);

    return { success: true, userId, isNewUser };
  } catch (err) {
    return { success: false, error: `Network error: ${String(err)}` };
  }
}

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
