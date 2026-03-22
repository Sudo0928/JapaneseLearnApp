import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { WeeklyReport } from '@japanese-learn/shared';
import {
  buildLocalizedReportInsights,
  formatReportPeriod,
  translateRecoveryMetricLabel,
  translateReportErrorType,
} from '@japanese-learn/shared';
import { getValidAppToken } from '../services/secure-storage';
import { useSettings } from '../providers/settings-provider';
import type { ThemeColors } from '../theme';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL ?? 'http://localhost:3000';

export default function ReportScreen({ userId }: { userId?: string }) {
  const { colors, preferences, t } = useSettings();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [report, setReport] = useState<WeeklyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    const token = await getValidAppToken();
    if (!token) {
      setError(t('report.empty'));
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      const response = await fetch(`${BACKEND_URL}/v1/report/weekly`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({})) as { error?: string };
        setError(body.error ?? `HTTP ${response.status}`);
        setReport(null);
      } else {
        setReport(await response.json() as WeeklyReport);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setReport(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.helperText}>{t('report.loading')}</Text>
      </SafeAreaView>
    );
  }

  if (!report) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.pageTitle}>{t('report.title')}</Text>
        <Text style={styles.helperText}>{error || t('report.empty')}</Text>
        <TouchableOpacity onPress={() => void load()} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>{t('common.retry')}</Text>
        </TouchableOpacity>
        {userId ? <Text style={styles.debugText}>user_id: {userId}</Text> : null}
      </SafeAreaView>
    );
  }

  const locale = preferences.locale;
  const insights = buildLocalizedReportInsights(locale, report);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load();
            }}
          />
        }
      >
        <Text style={styles.pageTitle}>{t('report.title')}</Text>
        <Text style={styles.periodText}>{formatReportPeriod(locale, report.period.from, report.period.to)}</Text>

        <SectionCard colors={colors} title={t('report.analysis')}>
          {insights.map((insight) => (
            <Text key={insight} style={styles.listText}>{`\u2022 ${insight}`}</Text>
          ))}
        </SectionCard>

        <View style={styles.grid}>
          <MetricCard
            colors={colors}
            label={t('report.delayedRecall')}
            value={`${Math.round(report.retention_metrics.due_7d.recall_rate * 100)}%`}
          />
          <MetricCard colors={colors} label={t('report.totalReviews')} value={String(report.summary.total_reviews)} />
          <MetricCard colors={colors} label={t('report.newCards')} value={String(report.summary.total_new_cards)} />
          <MetricCard colors={colors} label={t('report.streak')} value={String(report.summary.streak_days)} />
        </View>

        {report.confusion_metrics.top_confusions.length > 0 ? (
          <SectionCard colors={colors} title={t('report.confusions')}>
            {report.confusion_metrics.top_confusions.map((item, index) => (
              <View key={`${item.surface}-${index}`} style={styles.row}>
                <Text style={styles.rowLabel}>{item.surface}</Text>
                <Text style={styles.rowValue}>
                  {translateReportErrorType(locale, item.error_type)} {'\u00B7'} {item.error_count}
                </Text>
              </View>
            ))}
          </SectionCard>
        ) : null}

        <SectionCard colors={colors} title={t('report.recovery')}>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>{translateRecoveryMetricLabel(locale, 'overdue_backlog_days')}</Text>
            <Text style={styles.rowValue}>{report.recovery_metrics.overdue_backlog_days.toFixed(1)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>{translateRecoveryMetricLabel(locale, 'recovery_completion_rate')}</Text>
            <Text style={styles.rowValue}>{Math.round(report.recovery_metrics.recovery_completion_rate * 100)}%</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>{translateRecoveryMetricLabel(locale, 'post_recovery_retention')}</Text>
            <Text style={styles.rowValue}>
              {report.recovery_metrics.post_recovery_retention !== null
                ? `${Math.round(report.recovery_metrics.post_recovery_retention * 100)}%`
                : '-'}
            </Text>
          </View>
        </SectionCard>

        <Text style={styles.generatedText}>
          {new Date(report.generated_at).toLocaleString(preferences.locale)}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
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

function MetricCard(props: { colors: ThemeColors; label: string; value: string }) {
  const styles = createStyles(props.colors);
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricValue}>{props.value}</Text>
      <Text style={styles.metricLabel}>{props.label}</Text>
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
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 28,
      gap: 12,
    },
    scroll: {
      padding: 20,
      paddingBottom: 40,
    },
    pageTitle: {
      fontSize: 26,
      fontWeight: '800',
      color: colors.text,
      marginBottom: 6,
    },
    periodText: {
      color: colors.textSoft,
      marginBottom: 18,
    },
    helperText: {
      color: colors.textMuted,
      textAlign: 'center',
      lineHeight: 21,
    },
    primaryButton: {
      marginTop: 8,
      minHeight: 48,
      minWidth: 180,
      borderRadius: 14,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 20,
    },
    primaryButtonText: {
      color: colors.onPrimary,
      fontWeight: '700',
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
      marginBottom: 10,
      fontSize: 15,
    },
    listText: {
      color: colors.textMuted,
      lineHeight: 20,
      fontSize: 13,
      marginBottom: 6,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      marginBottom: 6,
    },
    metricCard: {
      width: '47%',
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 18,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 12,
    },
    metricValue: {
      color: colors.primary,
      fontSize: 24,
      fontWeight: '800',
      marginBottom: 4,
    },
    metricLabel: {
      color: colors.textMuted,
      fontSize: 12,
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 12,
      marginBottom: 8,
    },
    rowLabel: {
      color: colors.textMuted,
      fontSize: 13,
      flex: 1,
    },
    rowValue: {
      color: colors.text,
      fontWeight: '700',
      fontSize: 13,
      textAlign: 'right',
      maxWidth: '45%',
    },
    generatedText: {
      color: colors.textSoft,
      fontSize: 11,
      textAlign: 'center',
      marginTop: 6,
    },
    debugText: {
      color: colors.textSoft,
      fontSize: 11,
    },
  });
}
