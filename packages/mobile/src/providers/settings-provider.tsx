import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useColorScheme } from 'react-native';
import type {
  MeResponse,
  SupportedLocale,
  ThemePreference,
  UiCopyKey,
  UpdatePreferencesRequest,
  UserPreferences,
} from '@japanese-learn/shared';
import { getUiCopy } from '@japanese-learn/shared';
import {
  clearStoredLocalePreference,
  clearStoredThemePreference,
  getStoredLocalePreference,
  getStoredThemePreference,
  getValidAppToken,
  setStoredLocalePreference,
  setStoredThemePreference,
} from '../services/secure-storage';
import { getThemeColors, type ThemeColors } from '../theme';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL ?? 'http://localhost:3000';
const DEFAULT_PREFERENCES: UserPreferences = {
  locale: 'ko',
  theme: 'system',
};

interface SettingsContextValue {
  hydrated: boolean;
  preferences: UserPreferences;
  resolvedTheme: 'light' | 'dark';
  colors: ThemeColors;
  t: (key: UiCopyKey, params?: Record<string, string | number>) => string;
  syncFromMe: (me: MeResponse) => Promise<void>;
  refreshFromServer: () => Promise<void>;
  updatePreferences: (patch: UpdatePreferencesRequest) => Promise<UserPreferences>;
  resetPreferences: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const deviceScheme = useColorScheme();
  const [hydrated, setHydrated] = useState(false);
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);

  const resolvedTheme = preferences.theme === 'system'
    ? (deviceScheme === 'dark' ? 'dark' : 'light')
    : preferences.theme;
  const colors = useMemo(() => getThemeColors(resolvedTheme), [resolvedTheme]);

  useEffect(() => {
    void hydrateFromCache();
  }, []);

  const persistPreferences = useCallback(async (next: UserPreferences) => {
    await Promise.all([
      setStoredLocalePreference(next.locale),
      setStoredThemePreference(next.theme),
    ]);
    setPreferences(next);
  }, []);

  const syncFromMe = useCallback(async (me: MeResponse) => {
    await persistPreferences(me.preferences);
  }, [persistPreferences]);

  const refreshFromServer = useCallback(async () => {
    const token = await getValidAppToken();
    if (!token) return;

    const response = await fetch(`${BACKEND_URL}/v1/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) return;
    const me = await response.json() as MeResponse;
    await syncFromMe(me);
  }, [syncFromMe]);

  const updatePreferences = useCallback(async (patch: UpdatePreferencesRequest) => {
    const optimistic: UserPreferences = {
      locale: patch.locale ?? preferences.locale,
      theme: patch.theme ?? preferences.theme,
    };

    const token = await getValidAppToken();
    if (!token) {
      await persistPreferences(optimistic);
      return optimistic;
    }

    const response = await fetch(`${BACKEND_URL}/v1/auth/preferences`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(patch),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({})) as { error?: string };
      throw new Error(body.error ?? `HTTP ${response.status}`);
    }

    const me = await response.json() as MeResponse;
    await syncFromMe(me);
    return me.preferences;
  }, [persistPreferences, preferences.locale, preferences.theme, syncFromMe]);

  const resetPreferences = useCallback(async () => {
    await Promise.all([
      clearStoredLocalePreference(),
      clearStoredThemePreference(),
    ]);
    setPreferences(DEFAULT_PREFERENCES);
  }, []);

  const t = useCallback((key: UiCopyKey, params?: Record<string, string | number>) => {
    return getUiCopy(preferences.locale, key, params);
  }, [preferences.locale]);

  async function hydrateFromCache() {
    const [storedLocale, storedTheme] = await Promise.all([
      getStoredLocalePreference(),
      getStoredThemePreference(),
    ]);

    setPreferences({
      locale: normalizeLocale(storedLocale),
      theme: normalizeTheme(storedTheme),
    });
    setHydrated(true);
  }

  const value = useMemo<SettingsContextValue>(() => ({
    hydrated,
    preferences,
    resolvedTheme,
    colors,
    t,
    syncFromMe,
    refreshFromServer,
    updatePreferences,
    resetPreferences,
  }), [
    colors,
    hydrated,
    preferences,
    refreshFromServer,
    resolvedTheme,
    resetPreferences,
    syncFromMe,
    t,
    updatePreferences,
  ]);

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within SettingsProvider');
  }
  return context;
}

function normalizeLocale(value: string | null): SupportedLocale {
  if (value === 'en' || value === 'ja' || value === 'ko') return value;
  return 'ko';
}

function normalizeTheme(value: string | null): ThemePreference {
  if (value === 'light' || value === 'dark' || value === 'system') return value;
  return 'system';
}
