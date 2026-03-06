/**
 * PlanScreen — 개인화 학습 플랜
 *
 * report.mdc 설계 원칙:
 *  - strategy_vector(recall_gap, reading_weak, form_weak, load_sensitive) 시각화
 *  - 행동 데이터 기반 개인화(학습 스타일 자기보고 X)
 *  - 설명 가능한 3–5문장 인사이트
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { getValidAppToken } from '../services/secure-storage';
import type { PlanResponse } from '@japanese-learn/shared';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL ?? 'http://localhost:3000';

interface StrategyVector {
  recall_gap: number;
  reading_weak: number;
  form_weak: number;
  load_sensitive: number;
  lateness_fragile?: number;
}

interface DiagResult {
  strategy_vector: StrategyVector;
  weakness_flags: string[];
  notes?: string[];
}

interface PlanScreenProps {
  userId: string;
  onRestartDiagnosis: () => void;
}

export default function PlanScreen({ userId, onRestartDiagnosis }: PlanScreenProps) {
  const [diagResult, setDiagResult] = useState<DiagResult | null>(null);
  const [plan, setPlan] = useState<PlanResponse | null>(null);
  const [loading, setLoading]       = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getValidAppToken();
      if (!token) { setLoading(false); return; }

      const res = await fetch(
        `${BACKEND_URL}/v1/diagnosis/result`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (res.ok) {
        const data = await res.json() as DiagResult;
        setDiagResult(data);

        const planRes = await fetch(`${BACKEND_URL}/v1/plan/generate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            constraints: { daily_minutes: data.strategy_vector.load_sensitive >= 0.6 ? 10 : 20, max_new: 10 },
            analysis_result: { strategy_vector: data.strategy_vector },
          }),
        });

        if (planRes.ok) {
          const planData = await planRes.json() as PlanResponse;
          setPlan(planData);
        } else {
          setPlan(null);
        }
      }
    } catch {
      // 오프라인
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#4A6CF7" />
      </View>
    );
  }

  if (!diagResult) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyIcon}>🎯</Text>
        <Text style={styles.emptyTitle}>진단 결과가 없습니다</Text>
        <Text style={styles.emptyDesc}>
          학습 방식 진단을 완료하면{'\n'}맞춤형 플랜을 생성할 수 있습니다.
        </Text>
        <TouchableOpacity onPress={onRestartDiagnosis} style={styles.diagBtn}>
          <Text style={styles.diagBtnText}>📋 학습 방식 진단 시작</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const sv = diagResult.strategy_vector;

  const axes: { key: keyof StrategyVector; label: string; desc: string; icon: string }[] = [
    { key: 'recall_gap',   label: '회상 vs 재인 격차', desc: '스스로 떠올리기 vs 보고 고르기',    icon: '🧠' },
    { key: 'reading_weak', label: '읽기 취약도',       desc: '표기→읽기(발음) 정확도 저하 수준',  icon: '📖' },
    { key: 'form_weak',    label: '형태 혼동 민감도',  desc: '유사 형태 오답 비율',               icon: '👁' },
    { key: 'load_sensitive', label: '인지 부하 민감도', desc: '작업기억 용량과 복잡도 내성',       icon: '⚡' },
  ];

  const insights = plan?.notes?.length ? plan.notes : buildInsights(sv, diagResult.weakness_flags ?? []);
  const planItems = plan ? buildPlanFromServer(plan) : buildPlan(sv);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.pageTitle}>📊 학습 전략 프로파일</Text>
      <Text style={styles.pageDesc}>
        진단 결과를 기반으로 생성된 맞춤형 학습 플랜입니다.
      </Text>

      {/* 전략 벡터 */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>학습 방식 벡터</Text>
        {axes.map(({ key, label, desc, icon }) => {
          const value = sv[key] ?? 0;
          return (
            <View key={key} style={styles.axisRow}>
              <Text style={styles.axisIcon}>{icon}</Text>
              <View style={{ flex: 1 }}>
                <View style={styles.axisHeader}>
                  <Text style={styles.axisLabel}>{label}</Text>
                  <Text style={styles.axisValue}>{Math.round(value * 100)}%</Text>
                </View>
                <Text style={styles.axisDesc}>{desc}</Text>
                <View style={styles.barTrack}>
                  <View
                    style={[styles.barFill, { width: `${Math.round(value * 100)}%` as any, backgroundColor: barColor(value) }]}
                  />
                </View>
              </View>
            </View>
          );
        })}
      </View>

      {/* 인사이트 */}
      {insights.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>💡 진단 인사이트</Text>
          {insights.map((note, i) => (
            <View key={i} style={styles.insightRow}>
              <Text style={styles.insightBullet}>•</Text>
              <Text style={styles.insightText}>{note}</Text>
            </View>
          ))}
        </View>
      )}

      {/* 집중 강화 영역 */}
      {diagResult.weakness_flags.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>⚠️ 집중 강화 영역</Text>
          <View style={styles.flagRow}>
            {diagResult.weakness_flags.map((f) => (
              <View key={f} style={styles.flagBadge}>
                <Text style={styles.flagText}>{flagLabel(f)}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* 오늘의 학습 플랜 */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>📅 오늘의 학습 플랜</Text>
        {planItems.map((item, i) => (
          <View key={i} style={styles.planRow}>
            <Text style={styles.planBullet}>{item.icon}</Text>
            <View>
              <Text style={styles.planLabel}>{item.label}</Text>
              <Text style={styles.planValue}>{item.value}</Text>
            </View>
          </View>
        ))}
      </View>

      {plan?.experiment_variant && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>🧪 현재 적용 실험</Text>
          <Text style={styles.insightText}>
            현재 플랜은 `{plan.experiment_variant}` 변형을 기반으로 계산되었습니다.
          </Text>
        </View>
      )}

      <TouchableOpacity onPress={onRestartDiagnosis} style={styles.reDiagBtn}>
        <Text style={styles.reDiagText}>🔄 진단 다시 받기</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ─── 유틸 ──────────────────────────────────────────────────────

function barColor(v: number): string {
  if (v >= 0.7) return '#ef4444';
  if (v >= 0.4) return '#f59e0b';
  return '#10b981';
}

function flagLabel(flag: string): string {
  const map: Record<string, string> = {
    recall_weak:      '회상 강화 필요',
    reading_weak:     '읽기 취약',
    form_weak:        '형태 혼동',
    load_sensitive:   '인지 부하 주의',
    lateness_fragile: '연체 위험',
  };
  return map[flag] ?? flag;
}

function buildInsights(sv: StrategyVector, flags: string[]): string[] {
  const notes: string[] = [];
  if (sv.recall_gap >= 0.5)
    notes.push('선택지를 보면 맞히지만 스스로 떠올리기가 어렵습니다. 빈칸 채우기 중심으로 연습이 필요합니다.');
  else if (sv.recall_gap < 0.2)
    notes.push('회상력과 재인력 모두 고른 편입니다. 다양한 문항 유형을 활용해 보세요.');

  if (sv.reading_weak >= 0.6)
    notes.push('표기는 알지만 읽기(발음)에서 오류가 잦습니다. 표기→읽기 카드 비중을 높입니다.');

  if (sv.form_weak >= 0.5)
    notes.push('비슷하게 생긴 단어/한자를 혼동하는 경향이 있습니다. 혼동쌍 특별 복습이 필요합니다.');

  if (sv.load_sensitive >= 0.6)
    notes.push('한 번에 많은 정보를 처리하기 어렵습니다. 신규 카드 수를 줄이고 세그먼트를 활용합니다.');

  if (flags.length === 0 && notes.length === 0)
    notes.push('고른 학습 능력을 갖추고 있습니다. 간격 반복 스케줄을 유지하세요.');

  return notes;
}

function buildPlan(sv: StrategyVector): { icon: string; label: string; value: string }[] {
  const daily_new   = sv.load_sensitive >= 0.6 ? 5 : sv.load_sensitive >= 0.4 ? 8 : 10;
  const reading_pct = sv.reading_weak >= 0.6 ? 40 : 25;
  const recall_pct  = sv.recall_gap >= 0.4 ? 60 : 50;
  const mcq_pct     = 100 - recall_pct;

  return [
    { icon: '📌', label: '신규 카드/일', value: `${daily_new}장` },
    { icon: '🔁', label: '회상형 문항 비율', value: `${recall_pct}%` },
    { icon: '🔘', label: '선택형(MCQ) 비율', value: `${mcq_pct}%` },
    { icon: '📖', label: '읽기 특화 비율', value: `+${reading_pct}%p` },
    { icon: '💡', label: '힌트 단계', value: sv.load_sensitive >= 0.6 ? '2단계' : '1단계' },
  ];
}

function buildPlanFromServer(plan: PlanResponse): { icon: string; label: string; value: string }[] {
  return [
    { icon: '📌', label: '신규 카드/일', value: `${plan.daily_budget.new_count}장` },
    { icon: '🔁', label: '복습 카드/일', value: `${plan.daily_budget.review_count}장` },
    {
      icon: '📖',
      label: '읽기 문항 비율',
      value: `${Math.round((plan.mix.SURFACE_TO_READING ?? 0) * 100)}%`,
    },
    {
      icon: '🔘',
      label: '선택형(MCQ) 비율',
      value: `${Math.round((plan.mix.MCQ ?? 0) * 100)}%`,
    },
    {
      icon: '💡',
      label: '힌트 단계',
      value: `${plan.ui_policy.hint_steps}단계`,
    },
    {
      icon: '⏱',
      label: '세션 단위',
      value: `${plan.ui_policy.session_chunk_min}분`,
    },
  ];
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32 },
  emptyIcon:  { fontSize: 56 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#1A1A2E' },
  emptyDesc:  { textAlign: 'center', color: '#666', lineHeight: 22 },
  diagBtn: {
    marginTop: 8, backgroundColor: '#4A6CF7',
    paddingHorizontal: 24, paddingVertical: 14, borderRadius: 12,
  },
  diagBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  container:   { padding: 20, backgroundColor: '#F8F9FF', flexGrow: 1 },
  pageTitle:   { fontSize: 20, fontWeight: '800', color: '#1A1A2E', marginBottom: 6 },
  pageDesc:    { fontSize: 13, color: '#666', marginBottom: 20, lineHeight: 20 },

  card: {
    backgroundColor: '#fff', borderRadius: 16, padding: 20,
    marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#1A1A2E', marginBottom: 14 },

  axisRow:    { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
  axisIcon:   { fontSize: 20, marginTop: 2 },
  axisHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  axisLabel:  { fontSize: 13, fontWeight: '600', color: '#333' },
  axisValue:  { fontSize: 13, fontWeight: '700', color: '#4A6CF7' },
  axisDesc:   { fontSize: 11, color: '#999', marginBottom: 6 },
  barTrack: { height: 6, backgroundColor: '#F0F0F0', borderRadius: 3, overflow: 'hidden' },
  barFill:  { height: 6, borderRadius: 3 },

  insightRow:   { flexDirection: 'row', gap: 8, marginBottom: 10 },
  insightBullet:{ fontSize: 14, color: '#4A6CF7', marginTop: 1 },
  insightText:  { flex: 1, fontSize: 13, color: '#444', lineHeight: 20 },

  flagRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  flagBadge:{
    backgroundColor: '#FEF3C7', paddingHorizontal: 12,
    paddingVertical: 6, borderRadius: 100,
  },
  flagText: { fontSize: 12, color: '#D97706', fontWeight: '600' },

  planRow:   { flexDirection: 'row', gap: 12, alignItems: 'flex-start', marginBottom: 12 },
  planBullet:{ fontSize: 18 },
  planLabel: { fontSize: 12, color: '#888', marginBottom: 2 },
  planValue: { fontSize: 15, fontWeight: '700', color: '#1A1A2E' },

  reDiagBtn: {
    borderWidth: 1.5, borderColor: '#4A6CF7', borderRadius: 12,
    padding: 14, alignItems: 'center', marginBottom: 32,
  },
  reDiagText: { color: '#4A6CF7', fontWeight: '700' },
});
