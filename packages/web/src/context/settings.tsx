import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type {
  MeResponse,
  SupportedLocale,
  ThemePreference,
  UiCopyKey,
  UpdatePreferencesRequest,
  UserPreferences,
} from '@japanese-learn/shared';
import { getUiCopy } from '@japanese-learn/shared';
import { fetchMe, getToken, updatePreferences as updatePreferencesRequest } from '../services/api';

const LOCALE_CACHE_KEY = 'jla_web_locale_pref';
const THEME_CACHE_KEY = 'jla_web_theme_pref';

interface SettingsContextValue {
  hydrated: boolean;
  me: MeResponse | null;
  preferences: UserPreferences;
  resolvedTheme: 'light' | 'dark';
  t: (key: UiCopyKey, params?: Record<string, string | number>) => string;
  syncFromMe: (me: MeResponse) => void;
  refreshFromServer: () => Promise<void>;
  updatePreferences: (payload: UpdatePreferencesRequest) => Promise<MeResponse>;
  resetLocalPreferences: () => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

const DEFAULT_PREFERENCES: UserPreferences = {
  locale: 'ko',
  theme: 'system',
};

const THEME_VARS = {
  light: {
    '--app-bg': '#f4f7fb',
    '--app-surface': '#ffffff',
    '--app-surface-alt': '#eef3ff',
    '--app-border': '#d6dce8',
    '--app-text': '#132238',
    '--app-text-muted': '#5f6f86',
    '--app-primary': '#2d6bff',
    '--app-primary-soft': '#e7f0ff',
    '--app-primary-contrast': '#ffffff',
    '--app-success-bg': '#f0fdf4',
    '--app-success-text': '#166534',
    '--app-error-bg': '#fef2f2',
    '--app-error-text': '#b91c1c',
    '--app-shadow': '0 12px 30px rgba(18, 31, 54, 0.08)',
  },
  dark: {
    '--app-bg': '#0e1624',
    '--app-surface': '#162133',
    '--app-surface-alt': '#1b2a41',
    '--app-border': '#29384e',
    '--app-text': '#f4f7fb',
    '--app-text-muted': '#b5c0d4',
    '--app-primary': '#75a7ff',
    '--app-primary-soft': '#243451',
    '--app-primary-contrast': '#0e1624',
    '--app-success-bg': '#163325',
    '--app-success-text': '#6fe0b8',
    '--app-error-bg': '#3b1e27',
    '--app-error-text': '#ff9ea3',
    '--app-shadow': '0 18px 36px rgba(0, 0, 0, 0.34)',
  },
} as const;

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);

  const resolvedTheme = useMemo<'light' | 'dark'>(() => {
    if (preferences.theme === 'light' || preferences.theme === 'dark') {
      return preferences.theme;
    }
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }, [preferences.theme]);

  useEffect(() => {
    hydrateFromCache();
  }, []);

  useEffect(() => {
    applyTheme(resolvedTheme);
  }, [resolvedTheme]);

  useEffect(() => {
    if (!getToken()) return;
    void refreshFromServer();
  }, []);

  const persistPreferences = useCallback((next: UserPreferences) => {
    localStorage.setItem(LOCALE_CACHE_KEY, next.locale);
    localStorage.setItem(THEME_CACHE_KEY, next.theme);
    setPreferences(next);
  }, []);

  const syncFromMe = useCallback((nextMe: MeResponse) => {
    setMe(nextMe);
    persistPreferences(nextMe.preferences);
  }, [persistPreferences]);

  const refreshFromServer = useCallback(async () => {
    if (!getToken()) return;
    const nextMe = await fetchMe();
    syncFromMe(nextMe);
  }, [syncFromMe]);

  const updatePreferences = useCallback(async (payload: UpdatePreferencesRequest) => {
    const optimistic: UserPreferences = {
      locale: payload.locale ?? preferences.locale,
      theme: payload.theme ?? preferences.theme,
    };

    if (!getToken()) {
      persistPreferences(optimistic);
      const localMe = buildLocalMe(me, optimistic);
      setMe(localMe);
      return localMe;
    }

    const nextMe = await updatePreferencesRequest(payload);
    syncFromMe(nextMe);
    return nextMe;
  }, [me, persistPreferences, preferences.locale, preferences.theme, syncFromMe]);

  const resetLocalPreferences = useCallback(() => {
    localStorage.removeItem(LOCALE_CACHE_KEY);
    localStorage.removeItem(THEME_CACHE_KEY);
    setMe(null);
    setPreferences(DEFAULT_PREFERENCES);
  }, []);

  const t = useCallback((key: UiCopyKey, params?: Record<string, string | number>) => {
    return getUiCopy(preferences.locale, key, params);
  }, [preferences.locale]);

  function hydrateFromCache() {
    const locale = normalizeLocale(localStorage.getItem(LOCALE_CACHE_KEY));
    const theme = normalizeTheme(localStorage.getItem(THEME_CACHE_KEY));
    setPreferences({ locale, theme });
    setHydrated(true);
  }

  const value = useMemo<SettingsContextValue>(() => ({
    hydrated,
    me,
    preferences,
    resolvedTheme,
    t,
    syncFromMe,
    refreshFromServer,
    updatePreferences,
    resetLocalPreferences,
  }), [
    hydrated,
    me,
    preferences,
    refreshFromServer,
    resetLocalPreferences,
    resolvedTheme,
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

function applyTheme(mode: 'light' | 'dark') {
  const vars = THEME_VARS[mode];
  Object.entries(vars).forEach(([key, value]) => {
    document.documentElement.style.setProperty(key, value);
  });
  document.body.style.background = vars['--app-bg'];
  document.body.style.color = vars['--app-text'];
  document.body.style.margin = '0';
  document.body.style.fontFamily = '"Segoe UI", "Noto Sans KR", sans-serif';
}

function normalizeLocale(value: string | null): SupportedLocale {
  if (value === 'en' || value === 'ja' || value === 'ko') return value;
  return 'ko';
}

function normalizeTheme(value: string | null): ThemePreference {
  if (value === 'light' || value === 'dark' || value === 'system') return value;
  return 'system';
}

function buildLocalMe(me: MeResponse | null, preferences: UserPreferences): MeResponse {
  if (me) {
    return {
      ...me,
      preferences,
    };
  }

  return {
    user_id: 'local-preview',
    tz: null,
    locale: preferences.locale,
    consent_flags: {
      required: false,
      optional: false,
      research: false,
    },
    created_at: new Date(0).toISOString(),
    onboarding_profile: null,
    privacy_summary: {
      raw_event_retention_days: 365,
      agg_retention_days: 730,
      export_supported: true,
      dsr_delete_supported: true,
      research_opt_in_default: false,
    },
    preferences,
  };
}
