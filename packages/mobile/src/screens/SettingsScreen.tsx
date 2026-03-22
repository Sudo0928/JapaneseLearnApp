import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type { DiagnosisResultResponse, MeResponse, SupportedLocale, ThemePreference } from '@japanese-learn/shared';
import { LOCALE_LABELS, THEME_OPTIONS, UI_LOCALES } from '@japanese-learn/shared';
import { clearQueue } from '../db/local-queue';
import { useSettings } from '../providers/settings-provider';
import { clearLocalUserState, getValidAppToken } from '../services/secure-storage';
import type { ThemeColors } from '../theme';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL ?? 'http://localhost:3000';
const DELETE_CONFIRM_PHRASE = 'DELETE MY ACCOUNT';

interface SettingsScreenProps {
  userId: string;
  onLogout: () => void | Promise<void>;
}

export default function SettingsScreen({ userId, onLogout }: SettingsScreenProps) {
  const {
    colors,
    preferences,
    resetPreferences,
    t,
    updatePreferences,
  } = useSettings();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const locale = preferences.locale;
  const [me, setMe] = useState<MeResponse | null>(null);
  const [diagnosis, setDiagnosis] = useState<DiagnosisResultResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingPreference, setSavingPreference] = useState<'theme' | 'locale' | ''>('');
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [deletePhrase, setDeletePhrase] = useState('');
  const [deleteAck, setDeleteAck] = useState(false);
  const scrollRef = useRef<ScrollView | null>(null);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const token = await getValidAppToken();
      if (!token) {
        setMe(null);
        setDiagnosis(null);
        return;
      }

      const [meResponse, diagnosisResponse] = await Promise.all([
        fetch(`${BACKEND_URL}/v1/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${BACKEND_URL}/v1/diagnosis/result`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (meResponse.ok) {
        setMe(await meResponse.json() as MeResponse);
      }
      if (diagnosisResponse.ok) {
        setDiagnosis(await diagnosisResponse.json() as DiagnosisResultResponse);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleThemeChange(theme: ThemePreference) {
    setSavingPreference('theme');
    try {
      await updatePreferences({ theme });
      await load();
      Alert.alert(t('settings.appearance'), t('settings.themeSaved'));
    } catch (error) {
      Alert.alert(t('settings.appearance'), error instanceof Error ? error.message : String(error));
    } finally {
      setSavingPreference('');
    }
  }

  async function handleLocaleChange(locale: SupportedLocale) {
    setSavingPreference('locale');
    try {
      await updatePreferences({ locale });
      await load();
      Alert.alert(t('settings.language'), t('settings.languageSaved'));
    } catch (error) {
      Alert.alert(t('settings.language'), error instanceof Error ? error.message : String(error));
    } finally {
      setSavingPreference('');
    }
  }

  async function handleExport() {
    setExporting(true);
    try {
      const token = await getValidAppToken();
      if (!token) {
        Alert.alert(t('common.export'), t('settings.deleteFailure'));
        return;
      }

      const response = await fetch(`${BACKEND_URL}/v1/user/export`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({})) as { error?: string };
        Alert.alert(t('common.export'), body.error ?? `HTTP ${response.status}`);
        return;
      }

      const payload = await response.text();
      await Share.share({
        title: `${userId}-export.json`,
        message: payload,
      });
    } finally {
      setExporting(false);
    }
  }

  async function handleLogout() {
    setLoggingOut(true);
    try {
      const token = await getValidAppToken();
      if (token) {
        await fetch(`${BACKEND_URL}/v1/auth/logout`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => {});
      }
      await onLogout();
    } finally {
      setLoggingOut(false);
    }
  }

  function confirmDelete() {
    if (deletePhrase.trim() !== DELETE_CONFIRM_PHRASE) {
      Alert.alert(t('settings.deleteTitle'), t('settings.deleteConfirmHint'));
      return;
    }

    if (!deleteAck) {
      Alert.alert(t('settings.deleteTitle'), t('settings.deleteAck'));
      return;
    }

    if (Platform.OS === 'web' && typeof globalThis.confirm === 'function') {
      if (globalThis.confirm(t('settings.deleteDescription'))) {
        void handleDelete();
      }
      return;
    }

    Alert.alert(
      t('settings.deleteTitle'),
      t('settings.deleteDescription'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.delete'), style: 'destructive', onPress: () => void handleDelete() },
      ],
    );
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const token = await getValidAppToken();
      if (!token) {
        Alert.alert(t('settings.deleteTitle'), t('settings.deleteFailure'));
        return;
      }

      const response = await fetch(`${BACKEND_URL}/v1/auth/me`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          confirm_phrase: DELETE_CONFIRM_PHRASE,
          export_acknowledged: deleteAck,
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({})) as { error?: string };
        Alert.alert(t('settings.deleteTitle'), body.error ?? t('settings.deleteFailure'));
        return;
      }

      await Promise.allSettled([
        clearQueue(),
        clearLocalUserState(userId),
        resetPreferences(),
      ]);

      setMe(null);
      setDiagnosis(null);
      setDeletePhrase('');
      setDeleteAck(false);

      if (Platform.OS !== 'web') {
        Alert.alert(t('settings.deleteTitle'), t('settings.deleteSuccess'));
      }

      await onLogout();
    } finally {
      setDeleting(false);
    }
  }

  function focusDeleteSection() {
    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 180);
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 16 : 0}
    >
      <SafeAreaView style={styles.container}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
        <Text style={styles.pageTitle}>{t('settings.title')}</Text>

        <SectionCard colors={colors} title={t('settings.appearance')}>
          <OptionRow
            options={THEME_OPTIONS}
            selected={preferences.theme}
            labelForOption={(option) => t(`theme.${option}` as const)}
            onSelect={(option) => void handleThemeChange(option)}
            disabled={savingPreference === 'theme' || deleting || loggingOut}
            colors={colors}
          />
          <InfoRow label={t('settings.themeLabel')} value={t(`theme.${preferences.theme}` as const)} colors={colors} />
        </SectionCard>

        <SectionCard colors={colors} title={t('settings.language')}>
          <OptionRow
            options={UI_LOCALES}
            selected={preferences.locale}
            labelForOption={(option) => LOCALE_LABELS[option]}
            onSelect={(option) => void handleLocaleChange(option)}
            disabled={savingPreference === 'locale' || deleting || loggingOut}
            colors={colors}
          />
          <InfoRow label={t('settings.localeLabel')} value={LOCALE_LABELS[preferences.locale]} colors={colors} />
        </SectionCard>

        <SectionCard colors={colors} title={t('settings.privacy')}>
          <InfoRow label={t('settings.requiredConsent')} value={formatBooleanLabel(locale, me?.consent_flags.required ?? false)} colors={colors} />
          <InfoRow label={t('settings.researchOptIn')} value={formatBooleanLabel(locale, me?.consent_flags.research ?? false)} colors={colors} />
          <InfoRow label={t('settings.diagnosisVersion')} value={diagnosis?.version ?? t('settings.unset')} colors={colors} />
          <InfoRow label={t('settings.rawRetention')} value={t('settings.days', { count: me?.privacy_summary.raw_event_retention_days ?? 365 })} colors={colors} />
          <InfoRow label={t('settings.aggRetention')} value={t('settings.days', { count: me?.privacy_summary.agg_retention_days ?? 730 })} colors={colors} />
          <InfoRow label={t('settings.exportSupport')} value={formatBooleanLabel(locale, me?.privacy_summary.export_supported ?? true)} colors={colors} />
          <InfoRow label={t('settings.deleteSupport')} value={formatBooleanLabel(locale, me?.privacy_summary.dsr_delete_supported ?? true)} colors={colors} />
          <InfoRow label={t('settings.notificationOptIn')} value={formatBooleanLabel(locale, me?.onboarding_profile?.notifications_opt_in ?? false)} colors={colors} />
          <Text style={styles.hintText}>{t('settings.exportHint')}</Text>
          <TouchableOpacity
            onPress={() => void handleExport()}
            style={styles.secondaryButton}
            disabled={exporting || deleting || loggingOut}
          >
            {exporting ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <Text style={styles.secondaryButtonText}>{t('common.export')}</Text>
            )}
          </TouchableOpacity>
        </SectionCard>

        <SectionCard colors={colors} title={t('settings.account')}>
          <InfoRow label={t('settings.targetLevel')} value={me?.onboarding_profile?.target_level ?? t('settings.unset')} colors={colors} />
          <InfoRow label={t('settings.targetDate')} value={me?.onboarding_profile?.target_date ?? t('settings.unset')} colors={colors} />
          <InfoRow label={t('settings.dailyMinutes')} value={t('settings.minutes', { count: me?.onboarding_profile?.daily_minutes ?? 0 })} colors={colors} />
          <InfoRow label={t('settings.weeklyVariability')} value={formatVariabilityLabel(locale, me?.onboarding_profile?.weekly_variability)} colors={colors} />
          <InfoRow label={t('settings.offlineExpected')} value={formatBooleanLabel(locale, me?.onboarding_profile?.offline_expected ?? false)} colors={colors} />
          <InfoRow label={t('settings.kanjiBackground')} value={formatKanjiBackgroundLabel(locale, me?.onboarding_profile?.kanji_background)} colors={colors} />

          <TouchableOpacity
            onPress={() => void handleLogout()}
            style={styles.secondaryButton}
            disabled={loggingOut || deleting}
          >
            {loggingOut ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <Text style={styles.secondaryButtonText}>{t('common.logout')}</Text>
            )}
          </TouchableOpacity>
        </SectionCard>

        <SectionCard colors={colors} title={t('settings.deleteTitle')}>
          <Text style={styles.dangerText}>{t('settings.deleteDescription')}</Text>
          <Text style={styles.inputLabel}>{t('settings.deleteConfirmLabel')}</Text>
          <Text style={styles.hintText}>{t('settings.deleteConfirmHint')}</Text>
          <Text style={styles.phraseBox}>{t('settings.deletePhrase')}</Text>
          <TextInput
            autoCapitalize="characters"
            autoCorrect={false}
            editable={!deleting}
            onChangeText={setDeletePhrase}
            onFocus={focusDeleteSection}
            onSubmitEditing={confirmDelete}
            placeholder={DELETE_CONFIRM_PHRASE}
            placeholderTextColor={colors.textSoft}
            returnKeyType="done"
            style={styles.textInput}
            value={deletePhrase}
          />
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>{t('settings.deleteAck')}</Text>
            <Switch
              value={deleteAck}
              onValueChange={setDeleteAck}
              trackColor={{ true: colors.danger }}
              thumbColor="#fff"
            />
          </View>
          <TouchableOpacity
            onPress={confirmDelete}
            style={[styles.dangerButton, deleting && styles.disabledButton]}
            disabled={deleting || loggingOut}
          >
            {deleting ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <Text style={styles.dangerButtonText}>{t('settings.deleteCta')}</Text>
            )}
          </TouchableOpacity>
        </SectionCard>
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

function formatBooleanLabel(locale: SupportedLocale, value: boolean): string {
  if (locale === 'ja') return value ? 'はい' : 'いいえ';
  if (locale === 'en') return value ? 'Yes' : 'No';
  return value ? '예' : '아니오';
}

function formatVariabilityLabel(
  locale: SupportedLocale,
  value: 'low' | 'medium' | 'high' | null | undefined,
): string {
  if (!value) {
    return locale === 'ja' ? '未設定' : locale === 'en' ? 'Unset' : '미설정';
  }

  const labels: Record<'low' | 'medium' | 'high', Record<SupportedLocale, string>> = {
    low: { ko: '낮음', en: 'Low', ja: '低め' },
    medium: { ko: '보통', en: 'Medium', ja: '標準' },
    high: { ko: '높음', en: 'High', ja: '高め' },
  };

  return labels[value]?.[locale] ?? value;
}

function formatKanjiBackgroundLabel(
  locale: SupportedLocale,
  value: 'none' | 'basic' | 'native' | null | undefined,
): string {
  if (!value) {
    return locale === 'ja' ? '未設定' : locale === 'en' ? 'Unset' : '미설정';
  }

  const labels: Record<'none' | 'basic' | 'native', Record<SupportedLocale, string>> = {
    none: { ko: '없음', en: 'None', ja: 'なし' },
    basic: { ko: '기초', en: 'Basic', ja: '基礎' },
    native: { ko: '원어민 수준', en: 'Native-level', ja: '母語話者レベル' },
  };

  return labels[value]?.[locale] ?? value;
}

function SectionCard(props: { colors: ThemeColors; title: string; children: React.ReactNode }) {
  const styles = createStyles(props.colors);
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{props.title}</Text>
      {props.children}
    </View>
  );
}

function OptionRow<T extends string>(props: {
  options: readonly T[];
  selected: T;
  labelForOption: (option: T) => string;
  onSelect: (option: T) => void;
  disabled: boolean;
  colors: ThemeColors;
}) {
  const styles = createStyles(props.colors);
  return (
    <View style={styles.optionRow}>
      {props.options.map((option) => {
        const active = props.selected === option;
        return (
          <TouchableOpacity
            key={option}
            onPress={() => props.onSelect(option)}
            disabled={props.disabled}
            style={[styles.optionChip, active && styles.optionChipActive]}
          >
            <Text style={[styles.optionChipText, active && styles.optionChipTextActive]}>
              {props.labelForOption(option)}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function InfoRow(props: { label: string; value: string; colors: ThemeColors }) {
  const styles = createStyles(props.colors);
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{props.label}</Text>
      <Text style={styles.infoValue}>{props.value}</Text>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background,
    },
    scroll: {
      padding: 20,
      paddingBottom: 140,
    },
    pageTitle: {
      fontSize: 26,
      fontWeight: '800',
      color: colors.text,
      marginBottom: 16,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 18,
      marginBottom: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cardTitle: {
      color: colors.text,
      fontWeight: '700',
      fontSize: 15,
      marginBottom: 12,
    },
    optionRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 10,
    },
    optionChip: {
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 14,
      paddingVertical: 8,
      backgroundColor: colors.surfaceAlt,
    },
    optionChipActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primarySoft,
    },
    optionChipText: {
      color: colors.textMuted,
      fontWeight: '600',
    },
    optionChipTextActive: {
      color: colors.primary,
    },
    infoRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 12,
      marginBottom: 9,
    },
    infoLabel: {
      color: colors.textMuted,
      fontSize: 13,
      flex: 1,
    },
    infoValue: {
      color: colors.text,
      fontWeight: '700',
      fontSize: 13,
      maxWidth: '45%',
      textAlign: 'right',
    },
    hintText: {
      color: colors.textSoft,
      fontSize: 12,
      lineHeight: 18,
      marginBottom: 10,
    },
    secondaryButton: {
      minHeight: 48,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.primaryBorder,
      backgroundColor: colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 8,
    },
    secondaryButtonText: {
      color: colors.primary,
      fontWeight: '700',
    },
    dangerText: {
      color: colors.textMuted,
      fontSize: 13,
      lineHeight: 20,
      marginBottom: 12,
    },
    inputLabel: {
      color: colors.text,
      fontWeight: '700',
      fontSize: 13,
      marginBottom: 6,
    },
    phraseBox: {
      color: colors.danger,
      backgroundColor: colors.dangerSoft,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontWeight: '700',
      marginBottom: 10,
    },
    textInput: {
      minHeight: 46,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 14,
      color: colors.text,
      backgroundColor: colors.background,
      marginBottom: 12,
    },
    switchRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 12,
      marginBottom: 14,
    },
    switchLabel: {
      color: colors.textMuted,
      flex: 1,
      lineHeight: 19,
      fontSize: 13,
    },
    dangerButton: {
      minHeight: 48,
      borderRadius: 14,
      backgroundColor: colors.danger,
      alignItems: 'center',
      justifyContent: 'center',
    },
    disabledButton: {
      opacity: 0.7,
    },
    dangerButtonText: {
      color: colors.onPrimary,
      fontWeight: '700',
    },
  });
}
