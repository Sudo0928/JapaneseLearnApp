/**
 * 앱 루트 컴포넌트
 *
 * 탭 구조:
 *  🏠 홈     — 오늘 할 일 + 기능 카드
 *  📖 학습   — 인출 연습 세션
 *  📊 플랜   — 전략 프로파일 (진단 결과 + 개인화 플랜)
 *  📈 리포트 — 주간 학습 리포트
 *
 * 온보딩 흐름:
 *  로그인 → (첫 방문 시) 진단 테스트 → 메인
 */

import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import {
  getValidAppToken,
  clearAuthData,
  secureGet,
  secureSet,
  STORAGE_KEYS,
} from './src/services/secure-storage';
import LoginScreen    from './src/screens/LoginScreen';
import HomeScreen     from './src/screens/HomeScreen';
import SessionScreen  from './src/screens/SessionScreen';
import DiagnosisScreen from './src/screens/DiagnosisScreen';
import ReportScreen   from './src/screens/ReportScreen';
import PlanScreen     from './src/screens/PlanScreen';
import SettingsScreen from './src/screens/SettingsScreen';

export type AppTab = 'home' | 'session' | 'plan' | 'report' | 'settings';
type AppState = 'loading' | 'unauthenticated' | 'diagnosis' | 'authenticated';

export default function App() {
  const [appState, setAppState] = useState<AppState>('loading');
  const [userId, setUserId]     = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<AppTab>('home');

  useEffect(() => { checkAuth(); }, []);

  async function checkAuth() {
    const token = await getValidAppToken();
    if (token) {
      const uid      = await secureGet(STORAGE_KEYS.USER_ID);
      const diagDone = await secureGet(STORAGE_KEYS.DIAGNOSIS_DONE);

      // 구 user ID(dev-user-web) 마이그레이션: 스키마 패턴 ^u_[...] 를 만족하지 않으면 로그아웃
      if (uid && !uid.startsWith('u_')) {
        await clearAuthData();
        setAppState('unauthenticated');
        return;
      }

      setUserId(uid);
      setAppState(diagDone === '1' ? 'authenticated' : 'diagnosis');
    } else {
      setAppState('unauthenticated');
    }
  }

  async function handleLoginComplete(uid: string) {
    setUserId(uid);
    const diagDone = await secureGet(STORAGE_KEYS.DIAGNOSIS_DONE);
    setAppState(diagDone === '1' ? 'authenticated' : 'diagnosis');
  }

  async function handleDiagnosisComplete() {
    await secureSet(STORAGE_KEYS.DIAGNOSIS_DONE, '1');
    setAppState('authenticated');
    setActiveTab('home');
  }

  async function handleDiagnosisSkip() {
    await secureSet(STORAGE_KEYS.DIAGNOSIS_DONE, '1');
    setAppState('authenticated');
    setActiveTab('home');
  }

  async function handleRestartDiagnosis() {
    await secureSet(STORAGE_KEYS.DIAGNOSIS_DONE, '0');
    setAppState('diagnosis');
  }

  if (appState === 'loading') {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4A6CF7" />
      </View>
    );
  }

  if (appState === 'unauthenticated') {
    return (
      <>
        <StatusBar style="auto" />
        <LoginScreen onLoginComplete={handleLoginComplete} />
      </>
    );
  }

  if (appState === 'diagnosis') {
    return (
      <>
        <StatusBar style="auto" />
        <DiagnosisScreen
          onComplete={handleDiagnosisComplete}
          onSkip={handleDiagnosisSkip}
        />
      </>
    );
  }

  const uid = userId ?? 'u_dev_web';

  return (
    <View style={{ flex: 1 }}>
      <StatusBar style="auto" />

      <View style={{ flex: 1 }}>
        {activeTab === 'home' && (
          <HomeScreen
            userId={uid}
            onNavigate={(tab: AppTab) => setActiveTab(tab)}
            onRestartDiagnosis={handleRestartDiagnosis}
          />
        )}
        {activeTab === 'session' && (
          <SessionScreen
            userId={uid}
            onSessionEnd={() => setActiveTab('home')}
          />
        )}
        {activeTab === 'plan' && (
          <PlanScreen
            userId={uid}
            onRestartDiagnosis={handleRestartDiagnosis}
          />
        )}
        {activeTab === 'report' && (
          <ReportScreen userId={uid} />
        )}
        {activeTab === 'settings' && (
          <SettingsScreen
            userId={uid}
            onLogout={async () => {
              await clearAuthData();
              setAppState('unauthenticated');
              setUserId(null);
            }}
          />
        )}
      </View>

      {/* 탭 바 */}
      <View style={styles.tabBar}>
        {TAB_ITEMS.map(({ key, label, icon }) => (
          <TouchableOpacity
            key={key}
            style={styles.tab}
            onPress={() => setActiveTab(key as AppTab)}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === key }}
          >
            <Text style={styles.tabIcon}>{icon}</Text>
            <Text style={[styles.tabText, activeTab === key && styles.tabActive]}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const TAB_ITEMS = [
  { key: 'home',     label: '홈',    icon: '🏠' },
  { key: 'session',  label: '학습',   icon: '📖' },
  { key: 'plan',     label: '플랜',   icon: '📊' },
  { key: 'report',   label: '리포트', icon: '📈' },
  { key: 'settings', label: '설정',   icon: '⚙️' },
];

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
    backgroundColor: '#fff',
  },
  tab:      { flex: 1, paddingVertical: 10, alignItems: 'center', gap: 2 },
  tabIcon:  { fontSize: 18 },
  tabText:  { fontSize: 11, color: '#999' },
  tabActive:{ color: '#4A6CF7', fontWeight: '700' },
});
