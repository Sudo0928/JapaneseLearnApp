import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const IS_WEB = Platform.OS === 'web';

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

export const STORAGE_KEYS = {
  APP_TOKEN: 'jla_app_token',
  APP_TOKEN_EXPIRES: 'jla_token_exp',
  USER_ID: 'jla_user_id',
  CONSENT_VERSION: 'jla_consent_ver',
  DIAGNOSIS_DONE: 'jla_diag_done',
  LAST_SUCCESSFUL_SYNC_AT: 'jla_last_successful_sync_at',
  THEME_PREF: 'jla_theme_pref',
  LOCALE_PREF: 'jla_locale_pref',
} as const;

type StorageKey = string;

export async function secureSet(key: StorageKey, value: string): Promise<void> {
  if (IS_WEB) {
    await webStorage.setItemAsync(key, value);
    return;
  }

  await SecureStore.setItemAsync(key, value, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

export async function secureGet(key: StorageKey): Promise<string | null> {
  if (IS_WEB) return webStorage.getItemAsync(key);
  return SecureStore.getItemAsync(key);
}

export async function secureDelete(key: StorageKey): Promise<void> {
  if (IS_WEB) {
    await webStorage.deleteItemAsync(key);
    return;
  }

  await SecureStore.deleteItemAsync(key);
}

export async function saveAppToken(token: string, expiresAt: string): Promise<void> {
  await secureSet(STORAGE_KEYS.APP_TOKEN, token);
  await secureSet(STORAGE_KEYS.APP_TOKEN_EXPIRES, expiresAt);
}

export async function getValidAppToken(): Promise<string | null> {
  const [token, expiresAt] = await Promise.all([
    secureGet(STORAGE_KEYS.APP_TOKEN),
    secureGet(STORAGE_KEYS.APP_TOKEN_EXPIRES),
  ]);

  if (!token || !expiresAt) return null;

  const expiresMs = new Date(expiresAt).getTime();
  const nowMs = Date.now();
  const bufferMs = 5 * 60 * 1000;

  if (nowMs + bufferMs >= expiresMs) {
    await clearAuthData();
    return null;
  }

  return token;
}

export async function clearAuthData(): Promise<void> {
  await Promise.all([
    secureDelete(STORAGE_KEYS.APP_TOKEN),
    secureDelete(STORAGE_KEYS.APP_TOKEN_EXPIRES),
    secureDelete(STORAGE_KEYS.USER_ID),
    secureDelete(STORAGE_KEYS.LAST_SUCCESSFUL_SYNC_AT),
  ]);
}

export async function getStoredThemePreference(): Promise<string | null> {
  return secureGet(STORAGE_KEYS.THEME_PREF);
}

export async function setStoredThemePreference(value: string): Promise<void> {
  await secureSet(STORAGE_KEYS.THEME_PREF, value);
}

export async function clearStoredThemePreference(): Promise<void> {
  await secureDelete(STORAGE_KEYS.THEME_PREF);
}

export async function getStoredLocalePreference(): Promise<string | null> {
  return secureGet(STORAGE_KEYS.LOCALE_PREF);
}

export async function setStoredLocalePreference(value: string): Promise<void> {
  await secureSet(STORAGE_KEYS.LOCALE_PREF, value);
}

export async function clearStoredLocalePreference(): Promise<void> {
  await secureDelete(STORAGE_KEYS.LOCALE_PREF);
}

export function getDiagnosisDoneKey(userId: string): string {
  return `${STORAGE_KEYS.DIAGNOSIS_DONE}:${userId}`;
}

export async function getDiagnosisDone(userId: string): Promise<boolean> {
  const value = await secureGet(getDiagnosisDoneKey(userId));
  return value === '1';
}

export async function setDiagnosisDone(userId: string, done: boolean): Promise<void> {
  await secureSet(getDiagnosisDoneKey(userId), done ? '1' : '0');
}

export async function clearDiagnosisDone(userId: string): Promise<void> {
  await secureDelete(getDiagnosisDoneKey(userId));
}

export async function getLastSuccessfulSyncAt(): Promise<string | null> {
  return secureGet(STORAGE_KEYS.LAST_SUCCESSFUL_SYNC_AT);
}

export async function setLastSuccessfulSyncAt(value: string): Promise<void> {
  await secureSet(STORAGE_KEYS.LAST_SUCCESSFUL_SYNC_AT, value);
}

export async function clearLocalUserState(userId?: string | null): Promise<void> {
  const tasks: Array<Promise<void>> = [
    clearAuthData(),
    secureDelete(STORAGE_KEYS.CONSENT_VERSION),
    clearStoredThemePreference(),
    clearStoredLocalePreference(),
  ];

  if (userId) {
    tasks.push(clearDiagnosisDone(userId));
  }

  await Promise.all(tasks);
}
