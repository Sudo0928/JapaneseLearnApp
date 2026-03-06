/**
 * 설정 화면 (P0-3: 데이터 삭제/철회 DSR)
 *
 * 제공 기능:
 * - 계정 정보 조회 (현재 사용자 ID, 진단 완료 여부)
 * - 데이터 삭제: DELETE /v1/auth/me → 모든 개인 데이터 삭제 + 로그아웃
 * - 로그아웃: POST /v1/auth/logout
 *
 * 설계 원칙 (report.mdc):
 * - 동의 문구의 "데이터 삭제 가능" 약속을 실제 버튼으로 구현
 * - 삭제 전 명확한 확인 다이얼로그 표시
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { getValidAppToken, clearAuthData } from '../services/secure-storage';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL ?? 'http://localhost:3000';

interface SettingsScreenProps {
  userId: string;
  onLogout: () => void;
}

export default function SettingsScreen({ userId, onLogout }: SettingsScreenProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      const token = await getValidAppToken();
      if (token) {
        await fetch(`${BACKEND_URL}/v1/auth/logout`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => {});
      }
    } finally {
      await clearAuthData();
      setIsLoggingOut(false);
      onLogout();
    }
  }

  function confirmDeleteAccount() {
    Alert.alert(
      '계정 및 데이터 삭제',
      '모든 학습 기록, 진단 결과, 개인화 데이터가 영구적으로 삭제됩니다.\n\n이 작업은 되돌릴 수 없습니다.',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: handleDeleteAccount,
        },
      ]
    );
  }

  async function handleDeleteAccount() {
    setIsDeleting(true);
    try {
      const token = await getValidAppToken();
      if (!token) {
        Alert.alert('오류', '인증 정보가 없습니다. 다시 로그인해주세요.');
        return;
      }

      const res = await fetch(`${BACKEND_URL}/v1/auth/me`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok || res.status === 204) {
        await clearAuthData();
        Alert.alert(
          '삭제 완료',
          '모든 데이터가 삭제되었습니다.',
          [{ text: '확인', onPress: onLogout }]
        );
      } else {
        const body = await res.json().catch(() => ({}));
        Alert.alert('삭제 실패', body.error ?? `서버 오류 (${res.status})`);
      }
    } catch (err) {
      Alert.alert('오류', '데이터 삭제 중 오류가 발생했습니다. 네트워크를 확인해주세요.');
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>설정</Text>

        {/* 계정 정보 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>계정 정보</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>사용자 ID</Text>
            <Text style={styles.infoValue} numberOfLines={1} ellipsizeMode="middle">
              {userId}
            </Text>
          </View>
        </View>

        {/* 개인정보 보호 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>개인정보 보호</Text>
          <Text style={styles.privacyNote}>
            본 앱은 학습 성과 개선 목적으로만 학습 이벤트(응답/반응시간/힌트)를 수집합니다.
            수집된 데이터는 아래 버튼으로 언제든지 삭제할 수 있습니다.
          </Text>
        </View>

        {/* 로그아웃 */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.logoutBtn}
            onPress={handleLogout}
            disabled={isLoggingOut || isDeleting}
            accessibilityRole="button"
            accessibilityLabel="로그아웃"
          >
            {isLoggingOut ? (
              <ActivityIndicator color="#4A6CF7" size="small" />
            ) : (
              <Text style={styles.logoutBtnText}>로그아웃</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* 데이터 삭제 (DSR) */}
        <View style={styles.section}>
          <Text style={styles.dangerTitle}>위험 구역</Text>
          <Text style={styles.dangerNote}>
            아래 버튼을 누르면 모든 학습 기록, 진단 결과, 계정 정보가 서버에서 영구 삭제됩니다.
          </Text>
          <TouchableOpacity
            style={[styles.deleteBtn, (isDeleting || isLoggingOut) && styles.deleteBtnDisabled]}
            onPress={confirmDeleteAccount}
            disabled={isDeleting || isLoggingOut}
            accessibilityRole="button"
            accessibilityLabel="계정 및 모든 데이터 삭제"
          >
            {isDeleting ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.deleteBtnText}>계정 및 모든 데이터 삭제</Text>
            )}
          </TouchableOpacity>
        </View>

        <Text style={styles.version}>문의: support@japaneselearn.app</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA' },
  scroll: { padding: 24, paddingBottom: 48 },
  title: { fontSize: 26, fontWeight: '700', color: '#1A1A2E', marginBottom: 28 },

  section: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: '#999', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  infoLabel: { fontSize: 15, color: '#333', flexShrink: 0 },
  infoValue: { fontSize: 13, color: '#888', flex: 1, textAlign: 'right' },

  privacyNote: { fontSize: 13, color: '#666', lineHeight: 20 },

  logoutBtn: {
    borderWidth: 1.5,
    borderColor: '#4A6CF7',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  logoutBtnText: { color: '#4A6CF7', fontSize: 15, fontWeight: '600' },

  dangerTitle: { fontSize: 13, fontWeight: '600', color: '#EF4444', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  dangerNote: { fontSize: 13, color: '#888', lineHeight: 20, marginBottom: 16 },
  deleteBtn: {
    backgroundColor: '#EF4444',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  deleteBtnDisabled: { backgroundColor: '#FECACA' },
  deleteBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },

  version: { textAlign: 'center', color: '#CCC', fontSize: 12, marginTop: 12 },
});
