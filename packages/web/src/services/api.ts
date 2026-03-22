import type {
  AssignmentsResponse,
  AuthGoogleResponse,
  DeleteMeResponse,
  ExperimentAssignment,
  MeResponse,
  PlanResponse,
  TodayCard,
  TodayResponse,
  UpdatePreferencesRequest,
  UserExportResponse,
  WeeklyReport,
} from '@japanese-learn/shared';

const BASE = '/v1';

export function getToken(): string | null {
  return localStorage.getItem('app_token');
}

export function hasToken(): boolean {
  return Boolean(getToken());
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
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (res.status === 401) {
    clearToken();
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error ?? res.statusText);
  }

  return res.json() as Promise<T>;
}

export async function loginWithToken(idToken: string): Promise<AuthGoogleResponse> {
  return request<AuthGoogleResponse>('/auth/google', {
    method: 'POST',
    body: JSON.stringify({ idToken, device: 'WEB' }),
  });
}

export async function fetchMe(): Promise<MeResponse> {
  return request<MeResponse>('/auth/me');
}

export async function updatePreferences(payload: UpdatePreferencesRequest): Promise<MeResponse> {
  return request<MeResponse>('/auth/preferences', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function fetchTodayCards(): Promise<TodayResponse> {
  return request<TodayResponse>('/today');
}

export async function fetchWeeklyReport(): Promise<WeeklyReport> {
  return request<WeeklyReport>('/report/weekly');
}

export async function fetchExperiments(): Promise<AssignmentsResponse> {
  return request<AssignmentsResponse>('/experiments/assignments');
}

export async function exportUserData(): Promise<UserExportResponse> {
  return request<UserExportResponse>('/user/export');
}

export async function deleteMe(confirmPhrase: string, exportAcknowledged: boolean): Promise<DeleteMeResponse> {
  return request<DeleteMeResponse>('/auth/me', {
    method: 'DELETE',
    body: JSON.stringify({
      confirm_phrase: confirmPhrase,
      export_acknowledged: exportAcknowledged,
    }),
  });
}

export async function generatePlan(dailyMinutes = 20): Promise<PlanResponse> {
  return request<PlanResponse>('/plan/generate', {
    method: 'POST',
    body: JSON.stringify({
      date: new Date().toISOString().slice(0, 10),
      constraints: { daily_minutes: dailyMinutes, max_new: 10, offline_expected: false },
    }),
  });
}

export type { ExperimentAssignment, TodayCard, WeeklyReport };
