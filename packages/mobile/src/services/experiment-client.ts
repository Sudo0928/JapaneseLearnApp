/**
 * 실험 플래그 클라이언트 (Sprint 5-3)
 *
 * 사용법:
 *   const variant = await getVariant('exp_recall_mix_v1');
 *   if (variant === 'treatment') { ... }
 *
 * 특징:
 * - 서버에서 배정받은 variant를 로컬 캐시에 저장
 * - 오프라인 시 캐시 사용
 * - 앱 시작 시 한 번 동기화
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getValidAppToken } from './secure-storage';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL ?? 'http://localhost:3000';
const CACHE_KEY = 'experiment_assignments';
const CACHE_TTL_MS = 60 * 60 * 1000; // 1시간

interface Assignment {
  exp_id: string;
  variant: string;
}

interface CachedAssignments {
  assignments: Assignment[];
  fetched_at: number;
}

/**
 * 앱 시작 시 실험 배정 동기화
 */
export async function syncExperiments(): Promise<void> {
  const token = await getValidAppToken();
  if (!token) return;

  try {
    const res = await fetch(`${BACKEND_URL}/v1/experiments/assignments`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;

    const data = await res.json() as { assignments: Assignment[] };
    const cache: CachedAssignments = {
      assignments: data.assignments,
      fetched_at: Date.now(),
    };
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // 오프라인 시 캐시 사용, 무시
  }
}

/**
 * 특정 실험의 variant 조회
 * 캐시 우선, 만료 시 재동기화
 */
export async function getVariant(
  expId: string
): Promise<string> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (raw) {
      const cache = JSON.parse(raw) as CachedAssignments;
      const isExpired = Date.now() - cache.fetched_at > CACHE_TTL_MS;

      if (!isExpired) {
        const found = cache.assignments.find((a) => a.exp_id === expId);
        if (found) return found.variant;
      } else {
        // 만료 시 백그라운드 갱신
        syncExperiments().catch(() => {});
      }
    }
  } catch {
    // AsyncStorage 오류 무시
  }

  return 'not_in_experiment';
}

/**
 * 특정 실험이 treatment variant인지 확인 (간편 헬퍼)
 */
export async function isTreatment(expId: string): Promise<boolean> {
  const v = await getVariant(expId);
  return v === 'treatment';
}
