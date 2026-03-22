import { useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import type { SupportedLocale, ThemePreference } from '@japanese-learn/shared';
import { useSettings } from '../context/settings';

const LOCALES: SupportedLocale[] = ['ko', 'en', 'ja'];
const THEMES: ThemePreference[] = ['system', 'light', 'dark'];

const LOCALE_SHORT_LABELS: Record<SupportedLocale, string> = {
  ko: 'KO',
  en: 'EN',
  ja: 'JA',
};

const THEME_SHORT_LABELS: Record<ThemePreference, string> = {
  system: 'AUTO',
  light: 'LIGHT',
  dark: 'DARK',
};

export default function QuickSettingsControls() {
  const { preferences, t, updatePreferences } = useSettings();
  const [pending, setPending] = useState<'locale' | 'theme' | ''>('');

  async function handleLocaleChange(locale: SupportedLocale) {
    if (locale === preferences.locale) return;
    setPending('locale');
    try {
      await updatePreferences({ locale });
    } finally {
      setPending('');
    }
  }

  async function handleThemeChange(theme: ThemePreference) {
    if (theme === preferences.theme) return;
    setPending('theme');
    try {
      await updatePreferences({ theme });
    } finally {
      setPending('');
    }
  }

  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
      <ControlGroup label={t('settings.language')}>
        {LOCALES.map((locale) => (
          <button
            key={locale}
            type="button"
            onClick={() => void handleLocaleChange(locale)}
            disabled={pending !== ''}
            aria-label={`${t('settings.language')}: ${LOCALE_SHORT_LABELS[locale]}`}
            style={chipStyle(preferences.locale === locale)}
          >
            {LOCALE_SHORT_LABELS[locale]}
          </button>
        ))}
      </ControlGroup>
      <ControlGroup label={t('settings.appearance')}>
        {THEMES.map((theme) => (
          <button
            key={theme}
            type="button"
            onClick={() => void handleThemeChange(theme)}
            disabled={pending !== ''}
            aria-label={`${t('settings.appearance')}: ${t(`theme.${theme}` as const)}`}
            style={chipStyle(preferences.theme === theme)}
          >
            {THEME_SHORT_LABELS[theme]}
          </button>
        ))}
      </ControlGroup>
    </div>
  );
}

function ControlGroup(props: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--app-text-muted)' }}>{props.label}</span>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{props.children}</div>
    </div>
  );
}

function chipStyle(active: boolean) {
  return {
    border: active ? '1px solid var(--app-primary)' : '1px solid var(--app-border)',
    background: active ? 'var(--app-primary-soft)' : 'var(--app-surface)',
    color: active ? 'var(--app-primary)' : 'var(--app-text-muted)',
    borderRadius: 999,
    padding: '6px 10px',
    fontSize: 11,
    fontWeight: 800,
    cursor: 'pointer',
    minWidth: 52,
  } satisfies CSSProperties;
}
