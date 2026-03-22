import { useEffect, useMemo, useState } from 'react';
import type { SupportedLocale, ThemePreference } from '@japanese-learn/shared';
import { LOCALE_LABELS, THEME_OPTIONS, UI_LOCALES } from '@japanese-learn/shared';
import { useNavigate } from 'react-router-dom';
import {
  clearToken,
  deleteMe,
  exportUserData,
  fetchMe,
} from '../services/api';
import { useSettings } from '../context/settings';
import styles from '../styles';

const DELETE_CONFIRM_PHRASE = 'DELETE MY ACCOUNT';

export default function SettingsPage() {
  const { me, preferences, t, updatePreferences, resetLocalPreferences, syncFromMe } = useSettings();
  const navigate = useNavigate();
  const [deletePhrase, setDeletePhrase] = useState('');
  const [deleteAck, setDeleteAck] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (me) return;
    fetchMe().then(syncFromMe).catch(() => {});
  }, [me, syncFromMe]);

  const infoRows = useMemo(() => [
    [t('settings.requiredConsent'), String(me?.consent_flags.required ?? false)],
    [t('settings.researchOptIn'), String(me?.consent_flags.research ?? false)],
    [t('settings.rawRetention'), t('settings.days', { count: me?.privacy_summary.raw_event_retention_days ?? 365 })],
    [t('settings.aggRetention'), t('settings.days', { count: me?.privacy_summary.agg_retention_days ?? 730 })],
  ], [me, t]);

  async function handleThemeChange(theme: ThemePreference) {
    setLoading(true);
    setError('');
    try {
      await updatePreferences({ theme });
      setStatus(t('settings.themeSaved'));
    } catch (eventError) {
      setError(eventError instanceof Error ? eventError.message : String(eventError));
    } finally {
      setLoading(false);
    }
  }

  async function handleLocaleChange(locale: SupportedLocale) {
    setLoading(true);
    setError('');
    try {
      await updatePreferences({ locale });
      setStatus(t('settings.languageSaved'));
    } catch (eventError) {
      setError(eventError instanceof Error ? eventError.message : String(eventError));
    } finally {
      setLoading(false);
    }
  }

  async function handleExport() {
    setLoading(true);
    setError('');
    try {
      const payload = await exportUserData();
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${payload.user.user_id}-export.json`;
      link.click();
      URL.revokeObjectURL(url);
      setStatus(t('common.export'));
    } catch (eventError) {
      setError(eventError instanceof Error ? eventError.message : String(eventError));
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (deletePhrase.trim() !== DELETE_CONFIRM_PHRASE) {
      setError(t('settings.deleteConfirmHint'));
      return;
    }
    if (!deleteAck) {
      setError(t('settings.deleteAck'));
      return;
    }

    setLoading(true);
    setError('');
    try {
      await deleteMe(DELETE_CONFIRM_PHRASE, true);
      clearToken();
      resetLocalPreferences();
      navigate('/login', { replace: true });
    } catch (eventError) {
      setError(eventError instanceof Error ? eventError.message : String(eventError));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.page}>
      <h2 style={styles.heading}>{t('web.settings.title')}</h2>
      <p style={styles.subtext}>{t('web.settings.subtitle')}</p>
      {status ? <div style={styles.successBox}>{status}</div> : null}
      {error ? <div style={styles.errorBox}>{error}</div> : null}

      <section style={styles.adminPanel}>
        <h3 style={styles.sectionTitle}>{t('settings.appearance')}</h3>
        <div style={styles.buttonRow}>
          {THEME_OPTIONS.map((theme) => (
            <button
              key={theme}
              type="button"
              disabled={loading}
              onClick={() => void handleThemeChange(theme)}
              style={preferences.theme === theme ? styles.primaryButton : styles.secondaryButton}
            >
              {t(`theme.${theme}` as const)}
            </button>
          ))}
        </div>
      </section>

      <section style={styles.adminPanel}>
        <h3 style={styles.sectionTitle}>{t('settings.language')}</h3>
        <div style={styles.buttonRow}>
          {UI_LOCALES.map((locale) => (
            <button
              key={locale}
              type="button"
              disabled={loading}
              onClick={() => void handleLocaleChange(locale)}
              style={preferences.locale === locale ? styles.primaryButton : styles.secondaryButton}
            >
              {LOCALE_LABELS[locale]}
            </button>
          ))}
        </div>
      </section>

      <section style={styles.adminPanel}>
        <h3 style={styles.sectionTitle}>{t('settings.privacy')}</h3>
        <div style={styles.resultBox}>
          {infoRows.map(([label, value]) => (
            <div key={label} style={styles.resultRow}>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 14 }}>
          <button type="button" style={styles.secondaryButton} onClick={() => void handleExport()} disabled={loading}>
            {t('common.export')}
          </button>
        </div>
      </section>

      <section style={styles.adminPanel}>
        <h3 style={styles.sectionTitle}>{t('settings.deleteTitle')}</h3>
        <p style={styles.subtext}>{t('settings.deleteDescription')}</p>
        <p style={styles.formHint}>{t('settings.deleteConfirmHint')}</p>
        <div style={styles.inlineCode}>{DELETE_CONFIRM_PHRASE}</div>
        <div style={{ height: 12 }} />
        <input
          type="text"
          value={deletePhrase}
          onChange={(event) => setDeletePhrase(event.target.value)}
          style={styles.formInput}
          placeholder={DELETE_CONFIRM_PHRASE}
        />
        <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', color: 'var(--app-text-muted)', marginBottom: 16 }}>
          <input type="checkbox" checked={deleteAck} onChange={(event) => setDeleteAck(event.target.checked)} />
          <span>{t('settings.deleteAck')}</span>
        </label>
        <button type="button" style={styles.primaryButton} onClick={() => void handleDelete()} disabled={loading}>
          {t('settings.deleteCta')}
        </button>
        <p style={{ ...styles.subtext, marginTop: 12 }}>{t('web.delete.redirect')}</p>
      </section>
    </div>
  );
}
