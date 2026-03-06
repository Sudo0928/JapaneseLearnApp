import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, ScrollView,
} from 'react-native';
import type { AppTab } from '../../App';
import { fetchTodayCards } from '../services/today-api';
import { getQueueStats } from '../db/local-queue';

interface HomeScreenProps {
  userId: string;
  onNavigate: (tab: AppTab) => void;
  onRestartDiagnosis: () => void;
}

export default function HomeScreen({ userId, onNavigate, onRestartDiagnosis }: HomeScreenProps) {
  const [loading, setLoading]       = useState(true);
  const [todayCount, setTodayCount] = useState(0);
  const [reviewCount, setReviewCount] = useState(0);
  const [newCount, setNewCount]     = useState(0);
  const [offlinePending, setOfflinePending] = useState(0);
  const [error, setError]           = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchTodayCards(userId);
      setTodayCount(data.totalCount);
      setReviewCount(data.reviewCards.length);
      setNewCount(data.newCards.length);

      const stats = await getQueueStats();
      setOfflinePending(stats.pending);
    } catch {
      setError('데이터를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* 헤더 */}
      <View style={styles.header}>
        <Text style={styles.logo}>🇯🇵</Text>
        <Text style={styles.title}>일본어 학습 앱</Text>
        <Text style={styles.subtitle}>간격 반복 + 인출 연습으로 장기 기억</Text>
      </View>

      {/* 오늘 학습 카드 */}
      {loading ? (
        <ActivityIndicator size="large" color="#4A6CF7" style={{ marginVertical: 40 }} />
      ) : error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={load} style={styles.retryBtn}>
            <Text style={styles.retryText}>다시 시도</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <TouchableOpacity
            style={styles.todayCard}
            onPress={() => onNavigate('session')}
            accessibilityRole="button"
            accessibilityLabel={`오늘 복습할 카드 ${todayCount}장, 탭하여 학습 시작`}
          >
            <Text style={styles.todayLabel}>오늘 복습할 카드</Text>
            <Text style={styles.todayCount}>{todayCount}</Text>
            <Text style={styles.todayUnit}>장</Text>
            {todayCount > 0 && (
              <View style={styles.todayBreakdown}>
                <Text style={styles.breakdownText}>복습 {reviewCount}</Text>
                <Text style={styles.breakdownDot}>·</Text>
                <Text style={styles.breakdownText}>신규 {newCount}</Text>
              </View>
            )}
            <View style={styles.startPill}>
              <Text style={styles.startPillText}>
                {todayCount === 0 ? '✅ 오늘 완료!' : '📖 학습 시작 →'}
              </Text>
            </View>
          </TouchableOpacity>
        </>
      )}

      {/* 기능 카드 (각 탭/기능으로 이동) */}
      <Text style={styles.sectionTitle}>기능</Text>
      <View style={styles.grid}>
        <FeatureCard
          icon="🔁"
          title="간격 반복"
          desc={`SM-2 스케줄러\n복습 ${reviewCount} · 신규 ${newCount}`}
          color="#EEF2FF"
          accent="#4A6CF7"
          onPress={() => onNavigate('report')}
        />
        <FeatureCard
          icon="🧠"
          title="인출 연습"
          desc={`정답 먼저 보기 없음\n지금 바로 시작`}
          color="#F0FDF4"
          accent="#059669"
          onPress={() => onNavigate('session')}
        />
        <FeatureCard
          icon="📊"
          title="개인화 플랜"
          desc={`진단 결과 기반\n전략 프로파일`}
          color="#FEF3C7"
          accent="#D97706"
          onPress={() => onNavigate('plan')}
        />
        <FeatureCard
          icon="📶"
          title="오프라인"
          desc={`동기화 대기 ${offlinePending}건\n자동 업로드`}
          color="#FFF1F2"
          accent="#E11D48"
          onPress={() => onNavigate('report')}
        />
      </View>

      {/* 진단 재시작 */}
      <TouchableOpacity onPress={onRestartDiagnosis} style={styles.diagBtn}>
        <Text style={styles.diagBtnText}>🎯 학습 방식 진단 다시 받기</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={load} style={styles.refreshBtn}>
        <Text style={styles.refreshText}>🔄 새로고침</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function FeatureCard({
  icon, title, desc, color, accent, onPress,
}: {
  icon: string; title: string; desc: string;
  color: string; accent: string; onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.featureCard, { backgroundColor: color }]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <Text style={styles.featureCardIcon}>{icon}</Text>
      <Text style={[styles.featureCardTitle, { color: accent }]}>{title}</Text>
      <Text style={styles.featureCardDesc}>{desc}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container:   { padding: 20, backgroundColor: '#F8F9FF', flexGrow: 1 },
  header:      { alignItems: 'center', marginBottom: 24 },
  logo:        { fontSize: 48, marginBottom: 8 },
  title:       { fontSize: 22, fontWeight: '700', color: '#1A1A2E' },
  subtitle:    { fontSize: 13, color: '#888', marginTop: 4 },

  todayCard: {
    backgroundColor: '#4A6CF7', borderRadius: 20, padding: 28,
    alignItems: 'center', marginBottom: 24,
    shadowColor: '#4A6CF7', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3, shadowRadius: 16, elevation: 8,
  },
  todayLabel:   { color: 'rgba(255,255,255,0.8)', fontSize: 14, marginBottom: 6 },
  todayCount:   { color: '#fff', fontSize: 72, fontWeight: '800', lineHeight: 80 },
  todayUnit:    { color: 'rgba(255,255,255,0.7)', fontSize: 20, marginBottom: 8 },
  todayBreakdown: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  breakdownText:  { color: 'rgba(255,255,255,0.9)', fontSize: 13 },
  breakdownDot:   { color: 'rgba(255,255,255,0.4)', fontSize: 13 },
  startPill: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 20, paddingVertical: 10, borderRadius: 100,
  },
  startPillText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  errorBox:  { alignItems: 'center', padding: 24, gap: 12 },
  errorText: { color: '#ef4444', textAlign: 'center' },
  retryBtn:  { backgroundColor: '#4A6CF7', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  retryText: { color: '#fff', fontWeight: '600' },

  sectionTitle: { fontSize: 13, fontWeight: '600', color: '#888', marginBottom: 12, letterSpacing: 0.5 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 20 },
  featureCard: {
    width: '47%', borderRadius: 16, padding: 16,
    minHeight: 110, justifyContent: 'space-between',
  },
  featureCardIcon:  { fontSize: 28, marginBottom: 6 },
  featureCardTitle: { fontSize: 14, fontWeight: '700', marginBottom: 4 },
  featureCardDesc:  { fontSize: 11, color: '#555', lineHeight: 16 },

  diagBtn: {
    borderWidth: 1, borderColor: '#4A6CF7', borderStyle: 'dashed',
    borderRadius: 12, padding: 14, alignItems: 'center', marginBottom: 12,
  },
  diagBtnText: { color: '#4A6CF7', fontSize: 14, fontWeight: '600' },

  refreshBtn:  { alignItems: 'center', padding: 12 },
  refreshText: { color: '#aaa', fontSize: 12 },
});
