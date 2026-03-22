import type {
  DeleteMeRequest,
  PrivacySummary,
  SupportedLocale,
  ThemePreference,
  UserPreferences,
} from '@japanese-learn/shared';

export const DEFAULT_PRIVACY_SUMMARY: PrivacySummary = {
  raw_event_retention_days: 365,
  agg_retention_days: 730,
  export_supported: true,
  dsr_delete_supported: true,
  research_opt_in_default: false,
};

export const SUPPORTED_LOCALES = ['ko', 'en', 'ja'] as const;
export const THEME_PREFERENCES = ['system', 'light', 'dark'] as const;
export const DELETE_ME_CONFIRM_PHRASE = 'DELETE MY ACCOUNT';
export const DEFAULT_LOCALE: SupportedLocale = 'ko';
export const DEFAULT_THEME: ThemePreference = 'system';

const SUPPORTED_LOCALE_SET = new Set<SupportedLocale>(SUPPORTED_LOCALES);
const THEME_PREFERENCE_SET = new Set<ThemePreference>(THEME_PREFERENCES);

export function normalizeSupportedLocale(
  value?: string | null,
  fallback: SupportedLocale = DEFAULT_LOCALE,
): SupportedLocale {
  if (!value) return fallback;
  const normalized = value.trim().toLowerCase();
  if (normalized.startsWith('ko')) return 'ko';
  if (normalized.startsWith('en')) return 'en';
  if (normalized.startsWith('ja')) return 'ja';
  return fallback;
}

export function resolveLocaleFromAcceptLanguage(
  header?: string | null,
  fallback: SupportedLocale = DEFAULT_LOCALE,
): SupportedLocale {
  if (!header) return fallback;

  const candidates = header
    .split(',')
    .map((part) => part.split(';')[0]?.trim())
    .filter((value): value is string => Boolean(value));

  for (const candidate of candidates) {
    const normalized = normalizeSupportedLocale(candidate, fallback);
    if (SUPPORTED_LOCALE_SET.has(normalized)) {
      return normalized;
    }
  }

  return fallback;
}

export function normalizeThemePreference(
  value?: string | null,
  fallback: ThemePreference = DEFAULT_THEME,
): ThemePreference {
  if (!value) return fallback;
  const normalized = value.trim().toLowerCase();
  return THEME_PREFERENCE_SET.has(normalized as ThemePreference)
    ? normalized as ThemePreference
    : fallback;
}

export function buildUserPreferences(input: {
  locale?: string | null;
  theme?: string | null;
  acceptLanguage?: string | null;
}): UserPreferences {
  const locale = input.locale
    ? normalizeSupportedLocale(input.locale, DEFAULT_LOCALE)
    : resolveLocaleFromAcceptLanguage(input.acceptLanguage, DEFAULT_LOCALE);

  return {
    locale,
    theme: normalizeThemePreference(input.theme, DEFAULT_THEME),
  };
}

export function validatePreferencesUpdate(payload: unknown): {
  ok: true;
  locale?: SupportedLocale;
  theme?: ThemePreference;
} | {
  ok: false;
  error: string;
} {
  if (!payload || typeof payload !== 'object') {
    return { ok: false, error: 'locale or theme must be provided.' };
  }

  const body = payload as Record<string, unknown>;
  const hasLocale = body.locale !== undefined;
  const hasTheme = body.theme !== undefined;

  if (!hasLocale && !hasTheme) {
    return { ok: false, error: 'locale or theme must be provided.' };
  }

  const result: { ok: true; locale?: SupportedLocale; theme?: ThemePreference } = { ok: true };

  if (hasLocale) {
    if (typeof body.locale !== 'string') {
      return { ok: false, error: 'locale must be one of ko, en, ja.' };
    }
    result.locale = normalizeSupportedLocale(body.locale, DEFAULT_LOCALE);
    if (result.locale !== body.locale.trim().toLowerCase()) {
      return { ok: false, error: 'locale must be one of ko, en, ja.' };
    }
  }

  if (hasTheme) {
    if (typeof body.theme !== 'string') {
      return { ok: false, error: 'theme must be one of system, light, dark.' };
    }
    result.theme = normalizeThemePreference(body.theme, DEFAULT_THEME);
    if (result.theme !== body.theme.trim().toLowerCase()) {
      return { ok: false, error: 'theme must be one of system, light, dark.' };
    }
  }

  return result;
}

export function validateDeleteMePayload(payload: unknown): {
  ok: true;
  value: DeleteMeRequest;
} | {
  ok: false;
  error: string;
} {
  if (!payload || typeof payload !== 'object') {
    return { ok: false, error: 'confirm_phrase and export_acknowledged are required.' };
  }

  const body = payload as Record<string, unknown>;
  if (typeof body.confirm_phrase !== 'string' || typeof body.export_acknowledged !== 'boolean') {
    return { ok: false, error: 'confirm_phrase and export_acknowledged are required.' };
  }

  if (body.confirm_phrase.trim() !== DELETE_ME_CONFIRM_PHRASE) {
    return { ok: false, error: 'Confirmation phrase does not match.' };
  }

  if (body.export_acknowledged !== true) {
    return { ok: false, error: 'Export acknowledgement is required before deletion.' };
  }

  return {
    ok: true,
    value: {
      confirm_phrase: DELETE_ME_CONFIRM_PHRASE,
      export_acknowledged: true,
    },
  };
}
