/**
 * 알림 서비스 (Sprint 5-2)
 *
 * 설계 원칙 (rules/report.mdc):
 * - 스트릭 강제/벌점형 알림 금지
 * - 알림은 사용자 설정 시간창 내에서만 발송
 * - "회복 플랜" 알림 제공 (연체 폭탄 분산)
 * - 알림 허용 여부는 옵트인 기반 (기본 OFF)
 *
 * 기술: expo-notifications (로컬 스케줄 알림)
 * 중요: 원격 푸시는 Phase 2에서 별도 구현 예정
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { getValidAppToken } from './secure-storage';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL ?? 'http://localhost:3000';

export interface NotificationPrefs {
  enabled: boolean;
  window_start: string;   // 'HH:MM'
  window_end: string;     // 'HH:MM'
  timezone: string;
  recovery_plan: boolean;
}

// ─── 권한 요청 ────────────────────────────────────────────────

export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('study-reminders', {
      name: '학습 알림',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250, 250, 250],
      sound: 'default',
    });
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

// ─── Push Token 등록 ──────────────────────────────────────────

export async function registerPushToken(): Promise<string | null> {
  const granted = await requestNotificationPermission();
  if (!granted) return null;

  try {
    const tokenData = await Notifications.getExpoPushTokenAsync();
    const token = tokenData.data;

    // 서버에 토큰 등록
    const appToken = await getValidAppToken();
    if (appToken) {
      await fetch(`${BACKEND_URL}/v1/notifications/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${appToken}`,
        },
        body: JSON.stringify({ push_token: token }),
      });
    }

    return token;
  } catch {
    return null;
  }
}

// ─── 로컬 알림 스케줄 ─────────────────────────────────────────

/**
 * 오늘의 학습 알림 스케줄 (사용자 시간창 내에서만)
 *
 * 중요:
 * - 긍정 메시지만 사용, 벌점/강요 표현 금지
 * - 연체 회복 알림은 부담이 아닌 도움 메시지
 */
export async function scheduleDailyStudyReminder(prefs: NotificationPrefs): Promise<void> {
  // 기존 알림 취소
  await Notifications.cancelAllScheduledNotificationsAsync();

  if (!prefs.enabled) return;

  const [startH, startM] = prefs.window_start.split(':').map(Number);

  // 시간창 내 학습 리마인드 (긍정 메시지)
  const studyMessages = [
    { title: '오늘의 학습 🌟', body: '잠깐, 복습 카드가 기다리고 있어요. 5분만 투자해볼까요?' },
    { title: '학습 시간이에요 📖', body: '어제 배운 내용을 얼마나 기억하고 있을까요?' },
    { title: '복습할 카드가 있어요', body: '짧은 복습이 장기 기억을 만듭니다.' },
  ];

  const msg = studyMessages[Math.floor(Math.random() * studyMessages.length)];

  await Notifications.scheduleNotificationAsync({
    content: {
      title: msg.title,
      body: msg.body,
      sound: 'default',
      data: { type: 'study_reminder' },
    },
    trigger: {
      hour: startH,
      minute: startM ?? 0,
      repeats: true,
    },
  });
}

/**
 * 연체 회복 알림 (연체 카드가 많을 때)
 * 부담이 아닌 회복 플랜 제안 메시지
 */
export async function scheduleRecoveryReminder(
  prefs: NotificationPrefs,
  overdueCount: number
): Promise<void> {
  if (!prefs.enabled || !prefs.recovery_plan) return;
  if (overdueCount <= 0) return;

  const [endH, endM] = prefs.window_end.split(':').map(Number);
  const reminderHour = Math.max(0, (endH ?? 22) - 2);  // 시간창 종료 2시간 전

  await Notifications.scheduleNotificationAsync({
    content: {
      title: '회복 플랜 📋',
      body: `복습 카드 ${overdueCount}장이 있어요. 오늘 조금씩 나눠서 해결해볼까요?`,
      sound: 'default',
      data: { type: 'recovery_plan', overdue_count: overdueCount },
    },
    trigger: {
      hour: reminderHour,
      minute: endM ?? 0,
      repeats: false,
    },
  });
}

// ─── 알림 설정 서버 동기화 ────────────────────────────────────

export async function syncPrefsToServer(prefs: NotificationPrefs): Promise<void> {
  const token = await getValidAppToken();
  if (!token) return;

  await fetch(`${BACKEND_URL}/v1/notifications/prefs`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(prefs),
  });
}

export async function loadPrefsFromServer(): Promise<NotificationPrefs | null> {
  const token = await getValidAppToken();
  if (!token) return null;

  try {
    const res = await fetch(`${BACKEND_URL}/v1/notifications/prefs`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.ok ? (await res.json() as NotificationPrefs) : null;
  } catch {
    return null;
  }
}

// ─── 알림 핸들러 설정 ─────────────────────────────────────────

export function setupNotificationHandlers(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}
