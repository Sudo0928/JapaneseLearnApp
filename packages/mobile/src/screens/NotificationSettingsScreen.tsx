/**
 * 알림 설정 화면 (Sprint 5-2)
 *
 * 설계 원칙:
 * - 스트릭 강제/벌점형 설명 금지 — 긍정적 학습 지원 메시지만
 * - enabled 기본 OFF (옵트인)
 * - 시간창 설정으로 방해 방지
 * - "회복 플랜" 알림 옵션 (연체 시 도움 메시지)
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Switch,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import {
  loadPrefsFromServer,
  syncPrefsToServer,
  scheduleDailyStudyReminder,
  requestNotificationPermission,
  registerPushToken,
  NotificationPrefs,
} from '../services/notification-service';

const DEFAULT_PREFS: NotificationPrefs = {
  enabled: false,
  window_start: '08:00',
  window_end: '22:00',
  timezone: 'Asia/Seoul',
  recovery_plan: true,
};

const HOURS = Array.from({ length: 24 }, (_, i) =>
  i.toString().padStart(2, '0') + ':00'
);

export default function NotificationSettingsScreen() {
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadPrefsFromServer().then((loaded) => {
      if (loaded) setPrefs(loaded);
      setLoading(false);
    });
  }, []);

  async function handleToggleEnabled(value: boolean) {
    if (value) {
      const granted = await requestNotificationPermission();
      if (!granted) {
        Alert.alert(
          '알림 권한 필요',
          '설정 앱에서 알림을 허용해 주세요.',
          [{ text: '확인' }]
        );
        return;
      }
      await registerPushToken();
    }
    setPrefs((p) => ({ ...p, enabled: value }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await syncPrefsToServer(prefs);
      if (prefs.enabled) {
        await scheduleDailyStudyReminder(prefs);
      }
      Alert.alert('저장 완료', '알림 설정이 저장되었습니다.');
    } catch {
      Alert.alert('오류', '설정 저장에 실패했습니다. 다시 시도해 주세요.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color="#4A6CF7" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>알림 설정</Text>
        <Text style={styles.subtitle}>
          학습 알림은 부담이 아니라 도움이 되어야 합니다.{'\n'}
          원하는 시간대에만 받을 수 있도록 설정하세요.
        </Text>

        {/* 알림 ON/OFF */}
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.label}>학습 알림</Text>
              <Text style={styles.desc}>하루 한 번, 설정 시간에 복습 리마인드</Text>
            </View>
            <Switch
              value={prefs.enabled}
              onValueChange={handleToggleEnabled}
              trackColor={{ true: '#4A6CF7' }}
              thumbColor={Platform.OS === 'android' ? '#fff' : undefined}
            />
          </View>
        </View>

        {prefs.enabled && (
          <>
            {/* 시간창 설정 */}
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>허용 시간대</Text>
              <Text style={styles.desc}>이 시간 밖에는 알림을 보내지 않습니다.</Text>

              <View style={styles.timeRow}>
                <View style={styles.timeBlock}>
                  <Text style={styles.timeLabel}>시작</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.timePicker}
                  >
                    {HOURS.filter((_, i) => i <= 20).map((h) => (
                      <TouchableOpacity
                        key={h}
                        style={[
                          styles.timeChip,
                          prefs.window_start === h && styles.timeChipActive,
                        ]}
                        onPress={() => setPrefs((p) => ({ ...p, window_start: h }))}
                      >
                        <Text
                          style={[
                            styles.timeChipText,
                            prefs.window_start === h && styles.timeChipTextActive,
                          ]}
                        >
                          {h}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                <View style={styles.timeBlock}>
                  <Text style={styles.timeLabel}>종료</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.timePicker}
                  >
                    {HOURS.filter((_, i) => i >= 4).map((h) => (
                      <TouchableOpacity
                        key={h}
                        style={[
                          styles.timeChip,
                          prefs.window_end === h && styles.timeChipActive,
                        ]}
                        onPress={() => setPrefs((p) => ({ ...p, window_end: h }))}
                      >
                        <Text
                          style={[
                            styles.timeChipText,
                            prefs.window_end === h && styles.timeChipTextActive,
                          ]}
                        >
                          {h}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </View>
            </View>

            {/* 회복 플랜 알림 */}
            <View style={styles.card}>
              <View style={styles.row}>
                <View style={styles.rowText}>
                  <Text style={styles.label}>회복 플랜 알림</Text>
                  <Text style={styles.desc}>
                    복습이 밀렸을 때 부담 없이 분산할 수 있도록 안내해드립니다.
                  </Text>
                </View>
                <Switch
                  value={prefs.recovery_plan}
                  onValueChange={(v) => setPrefs((p) => ({ ...p, recovery_plan: v }))}
                  trackColor={{ true: '#4A6CF7' }}
                />
              </View>
            </View>
          </>
        )}

        {/* 안내 메시지 */}
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            💡 알림은 언제든지 끌 수 있습니다. 스트릭 유지나 패널티 알림은 없습니다.
          </Text>
        </View>

        {/* 저장 버튼 */}
        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveBtnText}>설정 저장</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 24, paddingBottom: 48 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#1A1A2E', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#666', marginBottom: 24, lineHeight: 22 },
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
    gap: 12,
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowText: { flex: 1, marginRight: 16 },
  label: { fontSize: 16, fontWeight: '600', color: '#1A1A2E', marginBottom: 2 },
  desc: { fontSize: 13, color: '#888', lineHeight: 18 },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: '#1A1A2E' },
  timeRow: { gap: 16 },
  timeBlock: { gap: 8 },
  timeLabel: { fontSize: 13, color: '#888' },
  timePicker: { flexDirection: 'row' },
  timeChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#DDD',
    marginRight: 8,
    backgroundColor: '#fff',
  },
  timeChipActive: { backgroundColor: '#4A6CF7', borderColor: '#4A6CF7' },
  timeChipText: { fontSize: 13, color: '#555' },
  timeChipTextActive: { color: '#fff', fontWeight: '600' },
  infoBox: {
    backgroundColor: '#F0F4FF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 24,
  },
  infoText: { fontSize: 13, color: '#4A6CF7', lineHeight: 20 },
  saveBtn: {
    backgroundColor: '#4A6CF7',
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveBtnDisabled: { backgroundColor: '#C5CCE8' },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
