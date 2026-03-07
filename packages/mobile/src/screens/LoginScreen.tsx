/**
 * 로그인 화면 (Sprint 3)
 *
 * 흐름:
 * 1) Google 로그인 버튼 → 외부 브라우저(RFC 8252) → PKCE 인증
 * 2) 토큰 저장 후 App.tsx bootstrap으로 이동
 * 3) consent 여부는 `/v1/auth/me` 기반으로 App 루트에서 판정
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useGoogleLogin } from '../services/auth-service';
import { saveAppToken, secureSet, STORAGE_KEYS } from '../services/secure-storage';

interface LoginScreenProps {
  onLoginComplete: (userId: string) => void;
}

export default function LoginScreen({ onLoginComplete }: LoginScreenProps) {
  const [isLoading, setIsLoading] = useState(false);

  const { login, isLoading: oauthLoading } = useGoogleLogin();

  async function handleGoogleLogin() {
    setIsLoading(true);
    try {
      const result = await login();

      if (!result.success) {
        Alert.alert('로그인 실패', result.error ?? '알 수 없는 오류가 발생했습니다.');
        return;
      }

      const { userId, isNewUser } = result;
      void isNewUser;
      onLoginComplete(userId!);
    } finally {
      setIsLoading(false);
    }
  }

  // 웹 개발 모드: dev-init API로 실제 JWT를 받아 저장
  // user_id는 스키마 패턴 ^u_[a-zA-Z0-9_-]+$ 를 만족해야 함
  async function handleDevLogin() {
    setIsLoading(true);
    try {
      const devUserId = 'u_dev_web';
      const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL ?? 'http://localhost:3000';
      const res = await fetch(`${backendUrl}/v1/auth/dev-init`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: devUserId, device: 'WEB' }),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`dev-init 실패: ${res.status} — ${body}`);
      }
      const data = await res.json() as { appToken: string; expiresAt: string };
      await saveAppToken(data.appToken, data.expiresAt);
      await secureSet(STORAGE_KEYS.USER_ID, devUserId);
      onLoginComplete(devUserId);
    } catch (e) {
      Alert.alert('개발 모드 오류', `백엔드에 연결할 수 없습니다.\n${String(e)}`);
    } finally {
      setIsLoading(false);
    }
  }

  const busy = isLoading || oauthLoading;
  const isWeb = Platform.OS === 'web';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.inner}>
        {/* 앱 소개 */}
        <Text style={styles.logo}>🇯🇵</Text>
        <Text style={styles.title}>일본어 학습 앱</Text>
        <Text style={styles.subtitle}>
          간격 반복 + 인출 연습으로{'\n'}한자·단어를 오래 기억하세요
        </Text>

        {/* Google 로그인 버튼 */}
        <TouchableOpacity
          style={[styles.googleBtn, busy && styles.googleBtnDisabled]}
          onPress={handleGoogleLogin}
          disabled={busy}
        >
          {busy ? (
            <ActivityIndicator color="#4A6CF7" />
          ) : (
            <>
              <Text style={styles.googleIcon}>G</Text>
              <Text style={styles.googleBtnText}>Google로 로그인</Text>
            </>
          )}
        </TouchableOpacity>

        {/* 보안 안내 */}
        <Text style={styles.securityNote}>
          🔒 외부 브라우저를 통해 안전하게 로그인합니다.{'\n'}
          비밀번호나 Google 계정 정보는 앱에 저장되지 않습니다.
        </Text>

        {/* 웹 개발 모드 버튼 */}
        {isWeb && (
          <TouchableOpacity
            style={styles.devBtn}
            onPress={handleDevLogin}
            disabled={busy}
          >
            <Text style={styles.devBtnText}>🛠 개발 모드로 바로 접속</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA' },
  inner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  logo: { fontSize: 72, marginBottom: 16 },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1A1A2E',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 48,
  },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#DDD',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: '100%',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
    marginBottom: 24,
  },
  googleBtnDisabled: { opacity: 0.6 },
  googleIcon: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4A6CF7',
    width: 24,
    textAlign: 'center',
  },
  googleBtnText: { fontSize: 16, color: '#1A1A2E', fontWeight: '600' },
  securityNote: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    lineHeight: 18,
  },
  devBtn: {
    marginTop: 24,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ccc',
    borderStyle: 'dashed' as const,
  },
  devBtnText: {
    fontSize: 13,
    color: '#888',
    textAlign: 'center',
  },
});
