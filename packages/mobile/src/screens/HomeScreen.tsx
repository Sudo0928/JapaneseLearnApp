import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { AppTab } from '../../App';
import { getQueueStats } from '../db/local-queue';
import { scheduleRecoveryReminder, loadPrefsFromServer } from '../services/notification-service';
import { fetchTodayCards } from '../services/today-api';
import { useSettings } from '../providers/settings-provider';
import type { ThemeColors } from '../theme';

interface HomeScreenProps {
  userId: string;
  onNavigate: (tab: AppTab) => void;
  onRestartDiagnosis: () => void;
}

export default function HomeScreen({ userId, onNavigate, onRestartDiagnosis }: HomeScreenProps) {
  const { colors, t } = useSettings();
  const styles = createStyles(colors);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [todayCount, setTodayCount] = useState(0);
  const [reviewCount, setReviewCount] = useState(0);
  const [newCount, setNewCount] = useState(0);
  const [offlinePending, setOfflinePending] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchTodayCards(userId);
      setTodayCount(data.totalCount);
      setReviewCount(data.reviewCards.length);
      setNewCount(data.newCards.length);

      if (data.plan?.recovery_plan?.active) {
        const prefs = await loadPrefsFromServer();
        if (prefs?.enabled) {
          await scheduleRecoveryReminder(prefs, data.plan.recovery_plan.overdue_count);
        }
      }

      const queueStats = await getQueueStats();
      setOfflinePending(queueStats.pending);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>{t('home.title')}</Text>
      <Text style={styles.subtitle}>{t('home.subtitle')}</Text>

      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : error ? (
        <View style={styles.messageCard}>
          <Text style={styles.messageText}>{error}</Text>
          <TouchableOpacity onPress={() => void load()} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>{t('common.retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity onPress={() => onNavigate('session')} style={styles.heroCard}>
          <Text style={styles.heroLabel}>{t('home.todayQueue')}</Text>
          <Text style={styles.heroCount}>{todayCount}</Text>
          <Text style={styles.heroMeta}>
            {t('home.reviewCount', { count: reviewCount })} · {t('home.newCount', { count: newCount })}
          </Text>
          <View style={styles.heroButton}>
            <Text style={styles.heroButtonText}>
              {todayCount > 0 ? t('home.startSession') : t('home.allClear')}
            </Text>
          </View>
        </TouchableOpacity>
      )}

      <Text style={styles.sectionTitle}>{t('home.features')}</Text>
      <View style={styles.grid}>
        <FeatureCard
          colors={colors}
          title={t('home.feature.srsTitle')}
          description={t('home.feature.srsDesc')}
          onPress={() => onNavigate('report')}
        />
        <FeatureCard
          colors={colors}
          title={t('home.feature.retrievalTitle')}
          description={t('home.feature.retrievalDesc')}
          onPress={() => onNavigate('session')}
        />
        <FeatureCard
          colors={colors}
          title={t('home.feature.planTitle')}
          description={t('home.feature.planDesc')}
          onPress={() => onNavigate('plan')}
        />
        <FeatureCard
          colors={colors}
          title={t('home.feature.offlineTitle')}
          description={t('home.feature.offlineDesc', { count: offlinePending })}
          onPress={() => onNavigate('report')}
        />
      </View>

      <TouchableOpacity onPress={() => void onRestartDiagnosis()} style={styles.secondaryButton}>
        <Text style={styles.secondaryButtonText}>{t('home.rediagnose')}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => void load()} style={styles.refreshLink}>
        <Text style={styles.refreshText}>{t('home.refresh')}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function FeatureCard(props: {
  colors: ThemeColors;
  title: string;
  description: string;
  onPress: () => void;
}) {
  const styles = createStyles(props.colors);
  return (
    <TouchableOpacity onPress={props.onPress} style={styles.featureCard}>
      <Text style={styles.featureTitle}>{props.title}</Text>
      <Text style={styles.featureDescription}>{props.description}</Text>
    </TouchableOpacity>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      padding: 20,
      paddingBottom: 40,
      backgroundColor: colors.background,
      flexGrow: 1,
    },
    title: {
      fontSize: 26,
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
    centerBox: {
      backgroundColor: colors.surface,
      borderRadius: 18,
      minHeight: 180,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 18,
    },
    messageCard: {
      backgroundColor: colors.surface,
      borderRadius: 18,
      padding: 18,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 18,
    },
    messageText: {
      color: colors.textMuted,
      lineHeight: 21,
      marginBottom: 12,
    },
    heroCard: {
      backgroundColor: colors.primary,
      borderRadius: 22,
      padding: 24,
      marginBottom: 20,
    },
    heroLabel: {
      color: colors.onPrimary,
      opacity: 0.82,
      fontSize: 14,
      marginBottom: 6,
    },
    heroCount: {
      color: colors.onPrimary,
      fontSize: 64,
      fontWeight: '800',
      lineHeight: 72,
    },
    heroMeta: {
      color: colors.onPrimary,
      opacity: 0.88,
      marginBottom: 16,
      fontSize: 13,
    },
    heroButton: {
      alignSelf: 'flex-start',
      backgroundColor: 'rgba(255,255,255,0.18)',
      borderRadius: 999,
      paddingHorizontal: 16,
      paddingVertical: 9,
    },
    heroButtonText: {
      color: colors.onPrimary,
      fontWeight: '700',
    },
    sectionTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.textMuted,
      marginBottom: 12,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      marginBottom: 20,
    },
    featureCard: {
      width: '47%',
      minHeight: 118,
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
      justifyContent: 'space-between',
    },
    featureTitle: {
      color: colors.text,
      fontWeight: '700',
      fontSize: 15,
    },
    featureDescription: {
      color: colors.textMuted,
      lineHeight: 19,
      fontSize: 12,
    },
    secondaryButton: {
      minHeight: 48,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.primaryBorder,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primarySoft,
      marginBottom: 10,
    },
    secondaryButtonText: {
      color: colors.primary,
      fontWeight: '700',
    },
    refreshLink: {
      alignItems: 'center',
      paddingVertical: 10,
    },
    refreshText: {
      color: colors.textSoft,
      fontSize: 12,
    },
  });
}
