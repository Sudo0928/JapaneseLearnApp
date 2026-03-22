import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type {
  DiagnosisEvidence,
  DiagnosisResultResponse,
  MeResponse,
  PlanResponse,
  SupportedLocale,
} from '@japanese-learn/shared';
import { getValidAppToken } from '../services/secure-storage';
import { useSettings } from '../providers/settings-provider';
import {
  translateCounterfactual,
  translateDiagnosisEvidenceNote,
  translateKnownNarrative,
  translatePlanBasis,
  translatePlanEvidence,
  translatePlanFactor,
} from '../i18n/diagnosis-plan';
import type { ThemeColors } from '../theme';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL ?? 'http://localhost:3000';

type StrategyVector = DiagnosisResultResponse['strategy_vector'];

interface PlanScreenProps {
  userId: string;
  onRestartDiagnosis: () => void;
}

type PlanCopy = {
  axisLabels: Record<keyof StrategyVector, string>;
  planRows: {
    newCards: string;
    reviewCards: string;
    readingShare: string;
    productionShare: string;
    hintSteps: string;
    chunkMin: string;
  };
  recovery: {
    mode: string;
    overdue: string;
    minutes: string;
  };
  evidenceSource: Record<DiagnosisEvidence['source'], string>;
  versionSummary: (version: string, questionCount: number) => string;
  minuteUnit: (count: number) => string;
};

const PLAN_COPY: Record<SupportedLocale, PlanCopy> = {
  ko: {
    axisLabels: {
      recall_gap: '회상 격차',
      reading_weak: '읽기 취약',
      form_weak: '표기 취약',
      load_sensitive: '인지 부하 민감',
      lateness_fragile: '연체 취약',
    },
    planRows: {
      newCards: '신규 카드',
      reviewCards: '복습 카드',
      readingShare: '읽기 비중',
      productionShare: '산출 비중',
      hintSteps: '힌트 단계',
      chunkMin: '세션 청크',
    },
    recovery: {
      mode: '모드',
      overdue: '연체 카드',
      minutes: '권장 시간',
    },
    evidenceSource: {
      self_report: '자기 보고',
      cognitive: '인지',
      language_micro: '언어 마이크로',
      behavior: '행동',
    },
    versionSummary: (version, questionCount) => `버전 ${version} · 문항 ${questionCount}개`,
    minuteUnit: (count) => `${count}분`,
  },
  en: {
    axisLabels: {
      recall_gap: 'Recall gap',
      reading_weak: 'Reading weakness',
      form_weak: 'Form weakness',
      load_sensitive: 'Load sensitivity',
      lateness_fragile: 'Lateness fragility',
    },
    planRows: {
      newCards: 'New cards',
      reviewCards: 'Review cards',
      readingShare: 'Reading share',
      productionShare: 'Production share',
      hintSteps: 'Hint steps',
      chunkMin: 'Session chunk',
    },
    recovery: {
      mode: 'Mode',
      overdue: 'Overdue cards',
      minutes: 'Recommended time',
    },
    evidenceSource: {
      self_report: 'Self report',
      cognitive: 'Cognitive',
      language_micro: 'Language micro',
      behavior: 'Behavior',
    },
    versionSummary: (version, questionCount) => `Version ${version} · ${questionCount} questions`,
    minuteUnit: (count) => `${count} min`,
  },
  ja: {
    axisLabels: {
      recall_gap: '想起ギャップ',
      reading_weak: '読みの弱点',
      form_weak: '表記の弱点',
      load_sensitive: '認知負荷感度',
      lateness_fragile: '延滞脆弱性',
    },
    planRows: {
      newCards: '新規カード',
      reviewCards: '復習カード',
      readingShare: '読み比率',
      productionShare: '産出比率',
      hintSteps: 'ヒント段階',
      chunkMin: 'セッション区切り',
    },
    recovery: {
      mode: 'モード',
      overdue: '延滞カード',
      minutes: '推奨時間',
    },
    evidenceSource: {
      self_report: '自己報告',
      cognitive: '認知',
      language_micro: '言語マイクロ',
      behavior: '行動',
    },
    versionSummary: (version, questionCount) => `バージョン ${version} ・ ${questionCount} 問`,
    minuteUnit: (count) => `${count}分`,
  },
};

const AXIS_KEYS: Array<keyof StrategyVector> = [
  'recall_gap',
  'reading_weak',
  'form_weak',
  'load_sensitive',
];

export default function PlanScreen({ onRestartDiagnosis }: PlanScreenProps) {
  const { colors, preferences, t } = useSettings();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const locale = preferences.locale;
  const copy = PLAN_COPY[locale];
  const [diagnosis, setDiagnosis] = useState<DiagnosisResultResponse | null>(null);
  const [plan, setPlan] = useState<PlanResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getValidAppToken();
      if (!token) {
        setDiagnosis(null);
        setPlan(null);
        return;
      }

      const [diagRes, meRes] = await Promise.all([
        fetch(`${BACKEND_URL}/v1/diagnosis/result`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${BACKEND_URL}/v1/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (!diagRes.ok) {
        setDiagnosis(null);
        setPlan(null);
        return;
      }

      const nextDiagnosis = await diagRes.json() as DiagnosisResultResponse;
      setDiagnosis(nextDiagnosis);
      const mePayload = meRes.ok ? await meRes.json() as MeResponse : null;

      const response = await fetch(`${BACKEND_URL}/v1/plan/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          goal: {
            target_level: mePayload?.onboarding_profile?.target_level,
            target_date: mePayload?.onboarding_profile?.target_date ?? undefined,
            focus: mePayload?.onboarding_profile?.focus ?? [],
          },
          constraints: {
            daily_minutes: mePayload?.onboarding_profile?.daily_minutes ?? 20,
            max_new: 10,
            offline_expected: Boolean(mePayload?.onboarding_profile?.offline_expected),
          },
          analysis_result: {
            strategy_vector: nextDiagnosis.strategy_vector,
          },
        }),
      });

      setPlan(response.ok ? await response.json() as PlanResponse : null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!diagnosis) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>{t('plan.missingTitle')}</Text>
        <Text style={styles.emptyDescription}>{t('plan.missingDesc')}</Text>
        <TouchableOpacity onPress={() => void onRestartDiagnosis()} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>{t('plan.restartDiagnosis')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.pageTitle}>{t('plan.title')}</Text>
      <Text style={styles.pageDescription}>{t('plan.subtitle')}</Text>

      <SectionCard colors={colors} title={t('plan.strategyVector')}>
        {AXIS_KEYS.map((axisKey) => {
          const value = diagnosis.strategy_vector[axisKey] ?? 0;
          return (
            <View key={axisKey} style={styles.axisBlock}>
              <View style={styles.axisHeader}>
                <Text style={styles.axisLabel}>{copy.axisLabels[axisKey]}</Text>
                <Text style={styles.axisValue}>{Math.round(value * 100)}%</Text>
              </View>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${Math.round(value * 100)}%` }]} />
              </View>
            </View>
          );
        })}
      </SectionCard>

      <SectionCard colors={colors} title={t('plan.notes')}>
        <Text style={styles.metaLine}>{copy.versionSummary(diagnosis.version, diagnosis.question_count ?? 0)}</Text>
        {diagnosis.notes.map((note) => (
          <Text key={note} style={styles.listText}>
            • {translateKnownNarrative(locale, note)}
          </Text>
        ))}
      </SectionCard>

      {plan ? (
        <SectionCard colors={colors} title={t('plan.summary')}>
          {buildPlanRows(plan, copy).map((row) => (
            <View key={row.label} style={styles.row}>
              <Text style={styles.rowLabel}>{row.label}</Text>
              <Text style={styles.rowValue}>{row.value}</Text>
            </View>
          ))}
        </SectionCard>
      ) : null}

      {plan?.explanation_receipt?.length ? (
        <SectionCard colors={colors} title={t('plan.explanation')}>
          {plan.explanation_receipt.map((receipt, index) => (
            <View key={`${receipt.factor}-${index}`} style={styles.listBlock}>
              <Text style={styles.listTitle}>
                {translatePlanFactor(locale, receipt.factor)} · {translatePlanBasis(locale, receipt.basis)}
              </Text>
              <Text style={styles.listText}>{translatePlanEvidence(locale, receipt.evidence)}</Text>
              <Text style={styles.listText}>{translateKnownNarrative(locale, receipt.effect)}</Text>
              {receipt.counterfactual ? (
                <Text style={styles.counterfactual}>
                  {t('plan.counterfactual')}: {translateCounterfactual(locale, receipt.counterfactual)}
                </Text>
              ) : null}
            </View>
          ))}
        </SectionCard>
      ) : null}

      {plan?.recovery_plan?.active ? (
        <SectionCard colors={colors} title={t('plan.recovery')}>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>{copy.recovery.mode}</Text>
            <Text style={styles.rowValue}>{translateRecoveryMode(locale, plan.recovery_plan.mode)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>{copy.recovery.overdue}</Text>
            <Text style={styles.rowValue}>{plan.recovery_plan.overdue_count}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>{copy.recovery.minutes}</Text>
            <Text style={styles.rowValue}>{copy.minuteUnit(plan.recovery_plan.recommended_minutes)}</Text>
          </View>
          <Text style={styles.listText}>{translateKnownNarrative(locale, plan.recovery_plan.summary)}</Text>
        </SectionCard>
      ) : null}

      {diagnosis.evidence.length ? (
        <SectionCard colors={colors} title={t('plan.evidence')}>
          {diagnosis.evidence.map((item, index) => (
            <View key={`${item.factor}-${index}`} style={styles.listBlock}>
              <Text style={styles.listTitle}>
                {translatePlanFactor(locale, item.factor)} · {copy.evidenceSource[item.source]}
              </Text>
              <Text style={styles.listText}>{String(item.value)}</Text>
              <Text style={styles.listText}>{translateDiagnosisEvidenceNote(locale, item.note)}</Text>
            </View>
          ))}
        </SectionCard>
      ) : null}

      {diagnosis.confidence_by_axis ? (
        <SectionCard colors={colors} title={t('plan.confidence')}>
          {Object.entries(diagnosis.confidence_by_axis).map(([key, value]) => {
            const axisKey = key as keyof StrategyVector;
            return (
              <View key={key} style={styles.row}>
                <Text style={styles.rowLabel}>{copy.axisLabels[axisKey] ?? key}</Text>
                <Text style={styles.rowValue}>{Math.round(value * 100)}%</Text>
              </View>
            );
          })}
        </SectionCard>
      ) : null}

      <TouchableOpacity onPress={() => void onRestartDiagnosis()} style={styles.secondaryButton}>
        <Text style={styles.secondaryButtonText}>{t('plan.restartDiagnosis')}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function buildPlanRows(plan: PlanResponse, copy: PlanCopy): Array<{ label: string; value: string }> {
  return [
    { label: copy.planRows.newCards, value: String(plan.daily_budget.new_count) },
    { label: copy.planRows.reviewCards, value: String(plan.daily_budget.review_count) },
    { label: copy.planRows.readingShare, value: `${Math.round(plan.mix.SURFACE_TO_READING * 100)}%` },
    { label: copy.planRows.productionShare, value: `${Math.round(plan.mix.MEANING_TO_SURFACE * 100)}%` },
    { label: copy.planRows.hintSteps, value: String(plan.ui_policy.hint_steps) },
    { label: copy.planRows.chunkMin, value: copy.minuteUnit(plan.ui_policy.session_chunk_min) },
  ];
}

function translateRecoveryMode(locale: SupportedLocale, mode: NonNullable<PlanResponse['recovery_plan']>['mode']): string {
  if (locale === 'ko') {
    if (mode === 'seven_day') return '7일';
    if (mode === 'three_day') return '3일';
    return '15분 집중';
  }
  if (locale === 'ja') {
    if (mode === 'seven_day') return '7日';
    if (mode === 'three_day') return '3日';
    return '15分集中';
  }
  if (mode === 'seven_day') return '7-day';
  if (mode === 'three_day') return '3-day';
  return '15-min focus';
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

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      padding: 20,
      paddingBottom: 36,
      backgroundColor: colors.background,
      flexGrow: 1,
    },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 28,
      backgroundColor: colors.background,
      gap: 12,
    },
    pageTitle: {
      fontSize: 26,
      fontWeight: '800',
      color: colors.text,
      marginBottom: 8,
    },
    pageDescription: {
      fontSize: 14,
      color: colors.textMuted,
      lineHeight: 21,
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
    cardTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 12,
    },
    axisBlock: {
      marginBottom: 12,
    },
    axisHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 6,
    },
    axisLabel: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: '600',
    },
    axisValue: {
      color: colors.primary,
      fontWeight: '700',
    },
    barTrack: {
      height: 8,
      borderRadius: 999,
      backgroundColor: colors.surfaceAlt,
      overflow: 'hidden',
    },
    barFill: {
      height: 8,
      borderRadius: 999,
      backgroundColor: colors.primary,
    },
    metaLine: {
      color: colors.textSoft,
      marginBottom: 10,
      fontSize: 12,
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 12,
      marginBottom: 10,
    },
    rowLabel: {
      color: colors.textMuted,
      fontSize: 13,
    },
    rowValue: {
      color: colors.text,
      fontWeight: '700',
      fontSize: 13,
    },
    listBlock: {
      marginBottom: 12,
    },
    listTitle: {
      color: colors.text,
      fontWeight: '700',
      marginBottom: 4,
    },
    listText: {
      color: colors.textMuted,
      lineHeight: 20,
      marginBottom: 6,
      fontSize: 13,
    },
    counterfactual: {
      color: colors.warning,
      lineHeight: 20,
      fontSize: 13,
    },
    emptyTitle: {
      fontSize: 22,
      fontWeight: '800',
      color: colors.text,
    },
    emptyDescription: {
      textAlign: 'center',
      color: colors.textMuted,
      lineHeight: 21,
    },
    primaryButton: {
      minHeight: 50,
      minWidth: 200,
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
    secondaryButton: {
      minHeight: 48,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.primaryBorder,
      backgroundColor: colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    secondaryButtonText: {
      color: colors.primary,
      fontWeight: '700',
    },
  });
}
