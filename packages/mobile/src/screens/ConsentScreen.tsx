import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { SupportedLocale } from '@japanese-learn/shared';
import { useSettings } from '../providers/settings-provider';
import { getValidAppToken } from '../services/secure-storage';
import type { ThemeColors } from '../theme';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL ?? 'http://localhost:3000';
const CONSENT_POLICY_VERSION = '1.0';

export interface ConsentFlags {
  required: boolean;
  optional: boolean;
  research: boolean;
  version: string;
  agreed_at: string;
}

interface ConsentScreenProps {
  onConsentComplete: (flags: ConsentFlags) => void;
}

export default function ConsentScreen({ onConsentComplete }: ConsentScreenProps) {
  const { colors, preferences, t } = useSettings();
  const styles = createStyles(colors);
  const [requiredChecked, setRequiredChecked] = useState(false);
  const [optionalChecked, setOptionalChecked] = useState(false);
  const [researchChecked, setResearchChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!requiredChecked) {
      Alert.alert(t('consent.requiredTitle'), t('consent.requiredNeeded'));
      return;
    }

    const flags: ConsentFlags = {
      required: true,
      optional: optionalChecked,
      research: researchChecked,
      version: CONSENT_POLICY_VERSION,
      agreed_at: new Date().toISOString(),
    };

    setSubmitting(true);
    try {
      const token = await getValidAppToken();
      if (token) {
        await fetch(`${BACKEND_URL}/v1/auth/consent`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(flags),
        });
      }
      onConsentComplete(flags);
    } catch {
      onConsentComplete(flags);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>{t('consent.title')}</Text>
        <Text style={styles.subtitle}>{t('consent.subtitle')}</Text>

        <ConsentCard
          colors={colors}
          locale={preferences.locale}
          title={t('consent.requiredTitle')}
          description={t('consent.requiredDesc')}
          value={requiredChecked}
          onValueChange={setRequiredChecked}
          required
        />
        <ConsentCard
          colors={colors}
          locale={preferences.locale}
          title={t('consent.optionalTitle')}
          description={t('consent.optionalDesc')}
          value={optionalChecked}
          onValueChange={setOptionalChecked}
        />
        <ConsentCard
          colors={colors}
          locale={preferences.locale}
          title={t('consent.researchTitle')}
          description={t('consent.researchDesc')}
          value={researchChecked}
          onValueChange={setResearchChecked}
        />

        <TouchableOpacity
          disabled={!requiredChecked || submitting}
          onPress={() => void handleSubmit()}
          style={[styles.primaryButton, (!requiredChecked || submitting) && styles.primaryButtonDisabled]}
        >
          {submitting ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <Text style={styles.primaryButtonText}>{t('consent.submit')}</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function ConsentCard(props: {
  colors: ThemeColors;
  locale: SupportedLocale;
  title: string;
  description: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  required?: boolean;
}) {
  const styles = createStyles(props.colors);
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{props.title}</Text>
        {props.required ? <Text style={styles.requiredBadge}>{getRequiredBadge(props.locale)}</Text> : null}
      </View>
      <Text style={styles.cardDescription}>{props.description}</Text>
      <Switch
        value={props.value}
        onValueChange={props.onValueChange}
        trackColor={{ true: props.colors.primary }}
        thumbColor="#fff"
      />
    </View>
  );
}

function getRequiredBadge(locale: SupportedLocale): string {
  if (locale === 'ja') return '必須';
  if (locale === 'en') return 'Required';
  return '필수';
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scroll: {
      padding: 24,
      paddingBottom: 48,
    },
    title: {
      fontSize: 24,
      fontWeight: '800',
      color: colors.text,
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 14,
      lineHeight: 21,
      color: colors.textMuted,
      marginBottom: 18,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 18,
      marginBottom: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    cardTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
    },
    requiredBadge: {
      color: colors.danger,
      fontSize: 12,
      fontWeight: '700',
    },
    cardDescription: {
      color: colors.textMuted,
      lineHeight: 20,
      marginBottom: 12,
      fontSize: 13,
    },
    primaryButton: {
      minHeight: 52,
      borderRadius: 14,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 6,
    },
    primaryButtonDisabled: {
      opacity: 0.6,
    },
    primaryButtonText: {
      color: colors.onPrimary,
      fontSize: 16,
      fontWeight: '700',
    },
  });
}
