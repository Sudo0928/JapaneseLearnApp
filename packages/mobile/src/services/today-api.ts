/**
 * 오늘 할 일 API 클라이언트 (모바일)
 *
 * P0-2: 모든 요청에 Authorization: Bearer <token> 헤더 첨부
 */

import type { ReviewEventInput, TodayCard, TodayResponse } from '@japanese-learn/shared';
import { fetchWithTimeout } from './network';
import { getValidAppToken } from './secure-storage';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL ?? 'http://localhost:3000';

export type CardWithItem = TodayCard;

async function authHeaders(): Promise<Record<string, string>> {
  const token = await getValidAppToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function fetchTodayCards(
  _userId: string,
  maxReview = 40,
  maxNew = 6
): Promise<TodayResponse> {
  const url = `${BACKEND_URL}/v1/today?maxReview=${maxReview}&maxNew=${maxNew}`;
  const res = await fetchWithTimeout(url, { headers: await authHeaders() });
  if (!res.ok) throw new Error(`오늘 할 일 조회 실패: ${res.status}`);
  return res.json();
}

export async function submitReview(event: ReviewEventInput): Promise<{
  nextDue: string;
  intervalDays: number;
  state: string;
}> {
  const res = await fetchWithTimeout(`${BACKEND_URL}/v1/today/review`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(event),
  });
  if (!res.ok) throw new Error(`복습 제출 실패: ${res.status}`);
  return res.json();
}
