/**
 * 백엔드 API 클라이언트 (웹 대시보드)
 *
 * P1-1: packages/shared/api-contracts 타입으로 필드명·응답 구조 통일
 * - loginWithToken: id_token → idToken (백엔드 실제 필드명 맞춤)
 * - fetchTodayCards: { cards, total } → { reviewCards, newCards, confusionDrills, totalCount }
 * - fetchMe: 실제 백엔드 응답 타입 사용
 */

import type {
  AuthGoogleResponse,
  MeResponse,
  TodayResponse,
  WeeklyReport,
  AssignmentsResponse,
  AaValidationResponse,
  PlanResponse,
} from '@japanese-learn/shared';

const BASE = '/v1';

function getToken(): string | null {
  return localStorage.getItem('app_token');
}

export function setToken(token: string) {
  localStorage.setItem('app_token', token);
}

export function clearToken() {
  localStorage.removeItem('app_token');
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error: string }).error || res.statusText);
  }
  return res.json() as Promise<T>;
}

// ─── 인증 ───────────────────────────────────────────────────

/**
 * Google ID Token → 앱 JWT 교환
 * P1-1 수정: 'id_token' → 'idToken' (백엔드 /v1/auth/google 필드명)
 */
export async function loginWithToken(idToken: string): Promise<AuthGoogleResponse> {
  return request<AuthGoogleResponse>('/auth/google', {
    method: 'POST',
    body: JSON.stringify({ idToken }),   // ← 수정: id_token → idToken
  });
}

/**
 * 현재 사용자 정보 조회
 * P1-1 수정: 실제 응답 필드(user_id, tz, locale, consent_flags, created_at)로 갱신
 */
export async function fetchMe(): Promise<MeResponse> {
  return request<MeResponse>('/auth/me');
}

// ─── 오늘 할 일 ──────────────────────────────────────────────

// 웹 대시보드 전용 뷰 타입 (화면 렌더링 편의)
export type { TodayResponse };
export type { TodayCard } from '@japanese-learn/shared';

/**
 * 오늘 복습 카드 목록 조회
 * P1-1 수정: 백엔드 실제 응답 { reviewCards, newCards, confusionDrills, totalCount } 사용
 */
export async function fetchTodayCards(): Promise<TodayResponse> {
  return request<TodayResponse>('/today');
}

// ─── 주간 리포트 ─────────────────────────────────────────────

export type { WeeklyReport };

export async function fetchWeeklyReport(): Promise<WeeklyReport> {
  return request<WeeklyReport>('/report/weekly');
}

// ─── 실험 현황 ───────────────────────────────────────────────

export type { AssignmentsResponse, AaValidationResponse };

export async function fetchExperiments(): Promise<AssignmentsResponse> {
  return request<AssignmentsResponse>('/experiments/assignments');
}

export async function fetchAaValidation(): Promise<AaValidationResponse> {
  return request<AaValidationResponse>('/experiments/aa-validate');
}

// ─── 플랜 생성 ───────────────────────────────────────────────

export type { PlanResponse };

export async function generatePlan(dailyMinutes = 20): Promise<PlanResponse> {
  return request<PlanResponse>('/plan/generate', {
    method: 'POST',
    body: JSON.stringify({
      date: new Date().toISOString().slice(0, 10),
      constraints: { daily_minutes: dailyMinutes, max_new: 10, offline_expected: false },
    }),
  });
}
