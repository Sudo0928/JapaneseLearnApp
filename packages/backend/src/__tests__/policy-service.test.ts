import {
  buildUserPreferences,
  DELETE_ME_CONFIRM_PHRASE,
  normalizeSupportedLocale,
  normalizeThemePreference,
  validateDeleteMePayload,
  validatePreferencesUpdate,
} from '../services/policy-service';

describe('policy-service', () => {
  it('normalizes supported locales and falls back to ko', () => {
    expect(normalizeSupportedLocale('ko-KR')).toBe('ko');
    expect(normalizeSupportedLocale('EN-us')).toBe('en');
    expect(normalizeSupportedLocale('ja')).toBe('ja');
    expect(normalizeSupportedLocale('fr-FR')).toBe('ko');
  });

  it('normalizes theme preference and falls back to system', () => {
    expect(normalizeThemePreference('light')).toBe('light');
    expect(normalizeThemePreference('DARK')).toBe('dark');
    expect(normalizeThemePreference('weird')).toBe('system');
  });

  it('builds user preferences from stored values or accept-language header', () => {
    expect(buildUserPreferences({ locale: 'en', theme: 'dark' })).toEqual({
      locale: 'en',
      theme: 'dark',
    });

    expect(buildUserPreferences({ acceptLanguage: 'ja-JP,ko;q=0.9', theme: null })).toEqual({
      locale: 'ja',
      theme: 'system',
    });
  });

  it('validates preferences update payload', () => {
    expect(validatePreferencesUpdate({ locale: 'ko' })).toEqual({ ok: true, locale: 'ko' });
    expect(validatePreferencesUpdate({ theme: 'dark' })).toEqual({ ok: true, theme: 'dark' });
    expect(validatePreferencesUpdate({ locale: 'es' })).toEqual({
      ok: false,
      error: 'locale must be one of ko, en, ja.',
    });
  });

  it('validates delete payload with confirmation phrase and export acknowledgement', () => {
    expect(
      validateDeleteMePayload({
        confirm_phrase: DELETE_ME_CONFIRM_PHRASE,
        export_acknowledged: true,
      }),
    ).toEqual({
      ok: true,
      value: {
        confirm_phrase: DELETE_ME_CONFIRM_PHRASE,
        export_acknowledged: true,
      },
    });

    expect(
      validateDeleteMePayload({
        confirm_phrase: 'DELETE',
        export_acknowledged: true,
      }),
    ).toEqual({
      ok: false,
      error: 'Confirmation phrase does not match.',
    });

    expect(
      validateDeleteMePayload({
        confirm_phrase: DELETE_ME_CONFIRM_PHRASE,
        export_acknowledged: false,
      }),
    ).toEqual({
      ok: false,
      error: 'Export acknowledgement is required before deletion.',
    });
  });
});
