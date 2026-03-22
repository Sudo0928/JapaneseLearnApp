import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useGoogleLogin } from '../services/auth-service';
import { useSettings } from '../providers/settings-provider';
import type { ThemeColors } from '../theme';
import { saveAppToken, secureSet, STORAGE_KEYS } from '../services/secure-storage';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL ?? 'http://localhost:3000';

interface LoginScreenProps {
  onLoginComplete: (userId: string) => void;
}

export default function LoginScreen({ onLoginComplete }: LoginScreenProps) {
  const { colors, t } = useSettings();
  const styles = createStyles(colors);
  const { login, isLoading: oauthLoading } = useGoogleLogin();
  const [submitting, setSubmitting] = useState(false);

  async function handleGoogleLogin() {
    setSubmitting(true);
    try {
      const result = await login();
      if (!result.success || !result.userId) {
        Alert.alert(t('login.failed'), result.error ?? t('common.retry'));
        return;
      }
      onLoginComplete(result.userId);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDevLogin() {
    setSubmitting(true);
    try {
      const devUserId = 'u_dev_web';
      const response = await fetch(`${BACKEND_URL}/v1/auth/dev-init`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: devUserId, device: 'WEB', locale: 'ko' }),
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(body || `HTTP ${response.status}`);
      }

      const data = await response.json() as { appToken: string; expiresAt: string };
      await saveAppToken(data.appToken, data.expiresAt);
      await secureSet(STORAGE_KEYS.USER_ID, devUserId);
      onLoginComplete(devUserId);
    } catch (error) {
      Alert.alert(t('login.failed'), error instanceof Error ? error.message : String(error));
    } finally {
      setSubmitting(false);
    }
  }

  const busy = submitting || oauthLoading;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.inner}>
        <Text style={styles.logo}>JP</Text>
        <Text style={styles.title}>{t('login.title')}</Text>
        <Text style={styles.subtitle}>{t('login.subtitle')}</Text>

        <TouchableOpacity
          disabled={busy}
          onPress={() => void handleGoogleLogin()}
          style={[styles.primaryButton, busy && styles.disabledButton]}
        >
          {busy ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <Text style={styles.primaryButtonText}>{t('login.google')}</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.securityNote}>{t('login.security')}</Text>

        {Platform.OS === 'web' ? (
          <TouchableOpacity disabled={busy} onPress={() => void handleDevLogin()}>
            <Text style={styles.devHint}>{t('login.dev')}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    inner: {
      flex: 1,
      justifyContent: 'center',
      paddingHorizontal: 28,
    },
    logo: {
      width: 72,
      height: 72,
      borderRadius: 20,
      overflow: 'hidden',
      textAlign: 'center',
      textAlignVertical: 'center',
      backgroundColor: colors.primarySoft,
      color: colors.primary,
      fontSize: 28,
      fontWeight: '800',
      lineHeight: 72,
      marginBottom: 20,
    },
    title: {
      fontSize: 28,
      fontWeight: '800',
      color: colors.text,
      marginBottom: 10,
    },
    subtitle: {
      fontSize: 15,
      color: colors.textMuted,
      lineHeight: 22,
      marginBottom: 28,
    },
    primaryButton: {
      minHeight: 52,
      borderRadius: 14,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 18,
    },
    disabledButton: {
      opacity: 0.7,
    },
    primaryButtonText: {
      color: colors.onPrimary,
      fontSize: 16,
      fontWeight: '700',
    },
    securityNote: {
      color: colors.textSoft,
      lineHeight: 20,
      fontSize: 13,
    },
    devHint: {
      marginTop: 14,
      color: colors.textSoft,
      fontSize: 12,
    },
  });
}
