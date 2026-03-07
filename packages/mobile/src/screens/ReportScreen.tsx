/**
 * 주간 리포트 화면 (Sprint 5-1)
 *
 * 설계 원칙:
 * - 리포트는 "학습량"이 아닌 "지연 인출/혼동쌍 감소/연체 회복" 중심
 * - OEC = 즉시 정답률 ❌ → 지연 인출률 ✅
 * - 3~5문장 설명 가능한 인사이트 표시
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { getValidAppToken } from '../services/secure-storage';
import type { WeeklyReport } from '@japanese-learn/shared';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL ?? 'http://localhost:3000';

export default function ReportScreen({ userId }: { userId?: string }) {
  const [report, setReport]     = useState<WeeklyReport | null>(null);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errMsg, setErrMsg]     = useState('');

  useEffect(() => { fetchReport(); }, []);

  async function fetchReport() {
    setErrMsg('');
    const token = await getValidAppToken();
    if (!token) {
      setErrMsg('로그인이 필요합니다.');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`${BACKEND_URL}/v1/report/weekly`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setReport(await res.json() as WeeklyReport);
      } else {
        const body = await res.json().catch(() => ({})) as { error?: string };
        setErrMsg(body.error ?? `서버 오류 ${res.status}`);
      }
    } catch (err) {
      console.error('[ReportScreen] fetchReport 오류:', err);
      setErrMsg('네트워크 오류. 백엔드가 실행 중인지 확인하세요.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color="#4A6CF7" />
        <Text style={styles.loadingText}>리포트 생성 중...</Text>
      </SafeAreaView>
    );
  }

  if (errMsg || !report) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={{ fontSize: 48, marginBottom: 16 }}>📊</Text>
        <Text style={styles.emptyText}>
          {errMsg || '아직 학습 기록이 없습니다'}
        </Text>
        <Text style={styles.emptySubText}>
          {errMsg
            ? '백엔드 서버가 실행 중인지 확인하세요.'
            : '학습 탭에서 첫 복습을 완료하면 리포트가 생성됩니다.'}
        </Text>
        <TouchableOpacity
          onPress={() => { setLoading(true); fetchReport(); }}
          style={styles.retryBtn}
        >
          <Text style={styles.retryBtnText}>🔄 다시 불러오기</Text>
        </TouchableOpacity>
        {userId && (
          <Text style={{ fontSize: 11, color: '#ccc', marginTop: 8 }}>userId: {userId}</Text>
        )}
      </SafeAreaView>
    );
  }

  const { summary, retention_metrics, confusion_metrics, recovery_metrics, insights, daily_stats, period } = report;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchReport(); }} />
        }
      >
        {/* 헤더 */}
        <Text style={styles.title}>주간 리포트</Text>
        <Text style={styles.period}>{period.from} ~ {period.to}</Text>

        {/* 인사이트 (3~5문장) — 핵심 OEC 표시 */}
        <View style={styles.insightBox}>
          <Text style={styles.sectionTitle}>이번 주 분석</Text>
          {insights.map((txt, i) => (
            <View key={i} style={styles.insightRow}>
              <Text style={styles.insightBullet}>💡</Text>
              <Text style={styles.insightText}>{txt}</Text>
            </View>
          ))}
        </View>

        {/* 지연 인출 OEC — 즉시 정답률 대신 강조 */}
        {retention_metrics.due_7d.eligible_count >= 1 && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>7일 지연 인출률</Text>
            <Text style={styles.bigNumber}>
              {Math.round(retention_metrics.due_7d.recall_rate * 100)}%
            </Text>
            <Text style={styles.subText}>
              대상 {retention_metrics.due_7d.eligible_count}회 중{' '}
              {retention_metrics.due_7d.correct_count}회 정확 회상
            </Text>
          </View>
        )}

        <View style={styles.statsGrid}>
          <StatCard label="14일 지연" value={`${Math.round(retention_metrics.due_14d.recall_rate * 100)}`} unit="%" />
          <StatCard label="30일 지연" value={`${Math.round(retention_metrics.due_30d.recall_rate * 100)}`} unit="%" />
          <StatCard label="연체 보정" value={`${Math.round(retention_metrics.overdue_adjusted_recall_rate * 100)}`} unit="%" />
          <StatCard label="회복 완료율" value={`${Math.round(recovery_metrics.recovery_completion_rate * 100)}`} unit="%" />
        </View>

        {/* 요약 통계 */}
        <View style={styles.statsGrid}>
          <StatCard label="총 복습" value={summary.total_reviews.toString()} unit="회" />
          <StatCard label="신규 카드" value={summary.total_new_cards.toString()} unit="개" />
          <StatCard label="평균 정답률" value={`${Math.round(summary.avg_correct_rate * 100)}`} unit="%" />
          <StatCard label="연속 학습" value={summary.streak_days.toString()} unit="일" />
        </View>

        {/* 연체 경고 */}
        {summary.overdue_days >= 2 && (
          <View style={styles.warningBox}>
            <Text style={styles.warningText}>
              ⚠️ {summary.overdue_days}일 연체 발생. 회복 플랜으로 부담 없이 분산해 보세요.
            </Text>
          </View>
        )}

        {/* 혼동쌍 top-5 */}
        {confusion_metrics.top_confusions.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>자주 틀린 항목</Text>
            {confusion_metrics.top_confusions.map((c, i) => (
              <View key={i} style={styles.confusionRow}>
                <Text style={styles.confusionRank}>{i + 1}</Text>
                <Text style={styles.confusionSurface}>{c.surface}</Text>
                <Text style={styles.confusionType}>{c.error_type}</Text>
                <Text style={styles.confusionCount}>{c.error_count}회</Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>회복 지표</Text>
          <Text style={styles.insightText}>
            평균 연체 백로그: {recovery_metrics.overdue_backlog_days.toFixed(1)}일
          </Text>
          <Text style={styles.insightText}>
            정상화까지 소요: {recovery_metrics.recovery_time_to_normal_days ?? '-'}일
          </Text>
          <Text style={styles.insightText}>
            회복 후 유지율: {recovery_metrics.post_recovery_retention !== null
              ? `${Math.round(recovery_metrics.post_recovery_retention * 100)}%`
              : '데이터 부족'}
          </Text>
        </View>

        {/* 일별 학습 바 차트 (간단 텍스트 기반) */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>일별 학습량</Text>
          {daily_stats.map((d) => (
            <View key={d.day} style={styles.barRow}>
              <Text style={styles.barDay}>{d.day.slice(5)}</Text>
              <View style={styles.barBg}>
                <View
                  style={[
                    styles.barFill,
                    { width: `${Math.min(100, (Number(d.reviews) / 80) * 100)}%` },
                  ]}
                />
              </View>
              <Text style={styles.barCount}>{d.reviews}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.generated}>생성: {new Date(report.generated_at).toLocaleString('ko-KR')}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}<Text style={styles.statUnit}>{unit}</Text></Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  loadingText: { marginTop: 16, color: '#888' },
  emptyText: { fontSize: 18, fontWeight: '600', color: '#1A1A2E', marginBottom: 8, textAlign: 'center' },
  emptySubText: { fontSize: 14, color: '#888', textAlign: 'center', lineHeight: 22, marginBottom: 20 },
  retryBtn: { backgroundColor: '#4A6CF7', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 },
  retryBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  scroll: { padding: 24, paddingBottom: 48 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#1A1A2E', marginBottom: 2 },
  period: { fontSize: 13, color: '#999', marginBottom: 24 },
  insightBox: {
    backgroundColor: '#EEF2FF',
    borderRadius: 14,
    padding: 18,
    marginBottom: 16,
    gap: 10,
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#1A1A2E', marginBottom: 8 },
  insightRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  insightBullet: { fontSize: 14 },
  insightText: { flex: 1, fontSize: 13, color: '#374151', lineHeight: 20 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 18,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  bigNumber: { fontSize: 52, fontWeight: 'bold', color: '#4A6CF7', textAlign: 'center' },
  subText: { fontSize: 13, color: '#888', textAlign: 'center', marginTop: 4 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  statValue: { fontSize: 28, fontWeight: 'bold', color: '#1A1A2E' },
  statUnit: { fontSize: 14, color: '#888' },
  statLabel: { fontSize: 12, color: '#999', marginTop: 4 },
  warningBox: {
    backgroundColor: '#FEF9C3',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  warningText: { fontSize: 13, color: '#854D0E', lineHeight: 20 },
  confusionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
    gap: 12,
  },
  confusionRank: { fontSize: 13, color: '#bbb', width: 20, textAlign: 'center' },
  confusionSurface: { fontSize: 18, fontWeight: '600', color: '#1A1A2E', flex: 1 },
  confusionType: { fontSize: 11, color: '#F59E0B', backgroundColor: '#FEF3C7', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  confusionCount: { fontSize: 13, color: '#EF4444', fontWeight: '600' },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  barDay: { fontSize: 12, color: '#888', width: 32 },
  barBg: { flex: 1, height: 8, backgroundColor: '#F3F4F6', borderRadius: 4 },
  barFill: { height: 8, backgroundColor: '#4A6CF7', borderRadius: 4 },
  barCount: { fontSize: 12, color: '#888', width: 30, textAlign: 'right' },
  generated: { fontSize: 11, color: '#ccc', textAlign: 'center', marginTop: 8 },
});
