/**
 * 개인정보 동의 화면 (Sprint 3)
 *
 * 설계 원칙 (rules/report.mdc + GDPR Art.5/25 + EDPB 가이드):
 * - 필수 동의와 선택 동의를 명확히 분리한다.
 * - 선택 항목은 기본값이 OFF(비동의)다. (privacy by default)
 * - 연구 참여는 별도 옵트인, 기본 OFF.
 * - 동의 없이 필수 동의를 건너뛸 수 없다.
 * - 동의 버전과 시각을 서버에 기록한다.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  StyleSheet,
  SafeAreaView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { secureGet, STORAGE_KEYS } from '../services/secure-storage';

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
  const [requiredChecked, setRequiredChecked] = useState(false);
  const [optionalChecked, setOptionalChecked] = useState(false);  // 기본 OFF
  const [researchChecked, setResearchChecked] = useState(false);  // 기본 OFF
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleAgree() {
    if (!requiredChecked) {
      Alert.alert('필수 동의 필요', '서비스 이용을 위해 필수 항목에 동의해주세요.');
      return;
    }

    setIsSubmitting(true);

    const flags: ConsentFlags = {
      required: true,
      optional: optionalChecked,
      research: researchChecked,
      version: CONSENT_POLICY_VERSION,
      agreed_at: new Date().toISOString(),
    };

    try {
      const appToken = await secureGet(STORAGE_KEYS.APP_TOKEN);
      if (appToken) {
        // 서버에 consent_flags 저장
        await fetch(`${BACKEND_URL}/v1/auth/consent`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${appToken}`,
          },
          body: JSON.stringify(flags),
        });
      }
      onConsentComplete(flags);
    } catch {
      // 네트워크 오류 시에도 로컬에서는 동의 처리 진행 (서버 동기화는 나중에)
      onConsentComplete(flags);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>개인정보 수집·이용 동의</Text>
        <Text style={styles.subtitle}>서비스 이용 전 아래 내용을 확인해주세요.</Text>

        {/* ─ 필수 동의 ─ */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>필수 동의</Text>
            <Text style={styles.required}>(필수)</Text>
          </View>

          <View style={styles.infoBox}>
            <ConsentItem label="수집 목적" value="학습 스케줄 개인화 및 성과 개선" />
            <ConsentItem label="수집 항목" value="문항 응답(정오/반응시간/힌트), 앱 버전, 오프라인 여부" />
            <ConsentItem label="보관 기간" value="서비스 이용 기간 + 3개월 (탈퇴 시 즉시 삭제)" />
            <ConsentItem label="제3자 제공" value="원칙적으로 없음 (법령 요구 시 별도 고지)" />
          </View>

          <View style={styles.deleteNotice}>
            <Text style={styles.deleteNoticeText}>
              📌 앱 내 [데이터 삭제] 버튼으로 언제든 철회·삭제할 수 있습니다.
            </Text>
          </View>

          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>위 내용에 동의합니다</Text>
            <Switch
              value={requiredChecked}
              onValueChange={setRequiredChecked}
              trackColor={{ true: '#4A6CF7' }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {/* ─ 선택 동의 ─ */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>선택 동의</Text>
            <Text style={styles.optional}>(선택 — 기본: 미동의)</Text>
          </View>

          <View style={styles.infoBox}>
            <ConsentItem label="선택 항목" value="학습 패턴 통계 (성과 리포트, 혼동쌍 분석)" />
            <ConsentItem label="목적" value="개인화 정확도 향상 (거부 시에도 기본 서비스 이용 가능)" />
          </View>

          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>선택 항목에 동의합니다</Text>
            <Switch
              value={optionalChecked}
              onValueChange={setOptionalChecked}
              trackColor={{ true: '#4A6CF7' }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {/* ─ 연구 참여 (별도 옵트인) ─ */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>연구 참여</Text>
            <Text style={styles.optional}>(별도 옵트인 — 기본: 미동의)</Text>
          </View>

          <View style={styles.infoBox}>
            <ConsentItem label="수집 항목" value="음성 원본, 필기 원본 (연구 세션 중에만)" />
            <ConsentItem label="목적" value="학습 효과 연구 (논문·발표 참고, 익명 처리)" />
            <ConsentItem label="참고" value="거부해도 서비스 이용에 전혀 영향 없음" />
          </View>

          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>연구에 참여하겠습니다</Text>
            <Switch
              value={researchChecked}
              onValueChange={setResearchChecked}
              trackColor={{ true: '#10B981' }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {/* ─ 동의 버튼 ─ */}
        <TouchableOpacity
          style={[styles.agreeBtn, !requiredChecked && styles.agreeBtnDisabled]}
          onPress={handleAgree}
          disabled={!requiredChecked || isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.agreeBtnText}>
              {requiredChecked ? '동의하고 시작하기' : '필수 항목에 동의 후 시작 가능'}
            </Text>
          )}
        </TouchableOpacity>

        <Text style={styles.footerNote}>
          동의 내용은 앱 설정에서 언제든 변경하거나 철회할 수 있습니다.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function ConsentItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.consentItem}>
      <Text style={styles.consentLabel}>{label}</Text>
      <Text style={styles.consentValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA' },
  scroll: { padding: 24, paddingBottom: 48 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#1A1A2E', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#666', marginBottom: 28, lineHeight: 20 },
  section: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#1A1A2E' },
  required: { fontSize: 13, color: '#EF4444', fontWeight: '500' },
  optional: { fontSize: 13, color: '#888' },
  infoBox: {
    backgroundColor: '#F8F9FF',
    borderRadius: 10,
    padding: 14,
    marginBottom: 14,
    gap: 10,
  },
  consentItem: { gap: 2 },
  consentLabel: { fontSize: 12, color: '#888', fontWeight: '500' },
  consentValue: { fontSize: 13, color: '#333', lineHeight: 18 },
  deleteNotice: {
    backgroundColor: '#FFF7ED',
    borderRadius: 8,
    padding: 12,
    marginBottom: 14,
  },
  deleteNoticeText: { fontSize: 13, color: '#92400E', lineHeight: 18 },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  toggleLabel: { fontSize: 14, color: '#333', fontWeight: '500', flex: 1 },
  agreeBtn: {
    backgroundColor: '#4A6CF7',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  agreeBtnDisabled: { backgroundColor: '#C5CCE8' },
  agreeBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  footerNote: { fontSize: 12, color: '#999', textAlign: 'center', lineHeight: 18 },
});
