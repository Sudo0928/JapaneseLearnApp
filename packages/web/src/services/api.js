/**
 * 백엔드 API 클라이언트 (웹 대시보드)
 *
 * P1-1: packages/shared/api-contracts 타입으로 필드명·응답 구조 통일
 * - loginWithToken: id_token → idToken (백엔드 실제 필드명 맞춤)
 * - fetchTodayCards: { cards, total } → { reviewCards, newCards, confusionDrills, totalCount }
 * - fetchMe: 실제 백엔드 응답 타입 사용
 */
const BASE = '/v1';
function getToken() {
    return localStorage.getItem('app_token');
}
export function setToken(token) {
    localStorage.setItem('app_token', token);
}
export function clearToken() {
    localStorage.removeItem('app_token');
}
async function request(path, options = {}) {
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
        throw new Error(err.error || res.statusText);
    }
    return res.json();
}
// ─── 인증 ───────────────────────────────────────────────────
/**
 * Google ID Token → 앱 JWT 교환
 * P1-1 수정: 'id_token' → 'idToken' (백엔드 /v1/auth/google 필드명)
 */
export async function loginWithToken(idToken) {
    return request('/auth/google', {
        method: 'POST',
        body: JSON.stringify({ idToken }), // ← 수정: id_token → idToken
    });
}
/**
 * 현재 사용자 정보 조회
 * P1-1 수정: 실제 응답 필드(user_id, tz, locale, consent_flags, created_at)로 갱신
 */
export async function fetchMe() {
    return request('/auth/me');
}
/**
 * 오늘 복습 카드 목록 조회
 * P1-1 수정: 백엔드 실제 응답 { reviewCards, newCards, confusionDrills, totalCount } 사용
 */
export async function fetchTodayCards() {
    return request('/today');
}
export async function fetchWeeklyReport() {
    return request('/report/weekly');
}
export async function fetchExperiments() {
    return request('/experiments/assignments');
}
export async function fetchAaValidation() {
    return request('/experiments/aa-validate');
}
export async function generatePlan(dailyMinutes = 20) {
    return request('/plan/generate', {
        method: 'POST',
        body: JSON.stringify({
            date: new Date().toISOString().slice(0, 10),
            constraints: { daily_minutes: dailyMinutes, max_new: 10, offline_expected: false },
        }),
    });
}
