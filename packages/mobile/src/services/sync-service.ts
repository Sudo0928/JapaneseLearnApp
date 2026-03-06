/**
 * 오프라인 동기화 서비스 (Sprint 6-1 강화 버전)
 *
 * 설계 원칙 (rules/report.mdc):
 * - 상태 덮어쓰기 금지. 이벤트(append-only) 업로드 후 서버가 재계산
 * - 오프라인 큐: 로컬 SQLite에 ReviewEvent 저장 → 온라인 복귀 시 idempotency 키로 업로드
 * - 충돌 처리: event_id 기준 중복 제거 + 시간 순 재적용
 *
 * 강화 사항:
 * - 지수 백오프(exponential backoff) 재시도
 * - 배치 분할 전송 (대량 큐 처리)
 * - 부분 업로드 실패 시 개별 이벤트 단위 롤백
 * - 네트워크 상태 변경 감지 → 자동 재시도
 * - 동기화 상태 이벤트 이미터 (UI 연동)
 */

import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import {
  getPendingEvents,
  markAsSynced,
  markSyncFailed,
  getQueueStats,
} from '../db/local-queue';
import { getValidAppToken } from './secure-storage';
import { ReviewEvent } from '@japanese-learn/shared';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL ?? 'http://localhost:3000';

const BATCH_SIZE = 50;
const MAX_RETRY_WAIT_MS = 30_000;   // 최대 30초 대기
const INITIAL_RETRY_MS = 1_000;     // 첫 재시도 1초
const MAX_RETRIES = 5;

// ─── 동기화 결과 타입 ─────────────────────────────────────────

export interface SyncResult {
  synced: number;
  failed: number;
  skipped: number;  // 이미 동기화됨
  error?: string;
}

export interface SyncStatus {
  isSyncing: boolean;
  lastSyncAt: string | null;
  pendingCount: number;
  failedCount: number;
}

// ─── 동기화 상태 관리 ─────────────────────────────────────────

let _isSyncing = false;
let _lastSyncAt: string | null = null;
const _listeners = new Set<(status: SyncStatus) => void>();

export function onSyncStatusChange(cb: (status: SyncStatus) => void): () => void {
  _listeners.add(cb);
  return () => _listeners.delete(cb);
}

async function emitStatus(): Promise<void> {
  const stats = await getQueueStats();
  const status: SyncStatus = {
    isSyncing: _isSyncing,
    lastSyncAt: _lastSyncAt,
    pendingCount: stats.pending,
    failedCount: stats.failed,
  };
  _listeners.forEach((cb) => cb(status));
}

// ─── 핵심 동기화 로직 ─────────────────────────────────────────

/**
 * 단일 배치 전송 (idempotency 보장)
 * 서버의 ON CONFLICT DO NOTHING으로 중복은 안전하게 무시됨
 */
async function uploadBatch(
  events: ReviewEvent[],
  token: string
): Promise<{ accepted: string[]; rejected: string[] }> {
  const response = await fetch(`${BACKEND_URL}/v1/events`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(events),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: ${text}`);
  }

  const body = await response.json() as {
    insertedEventIds?: string[];
    duplicateEventIds?: string[];
  };

  const accepted = [
    ...(body.insertedEventIds ?? []),
    ...(body.duplicateEventIds ?? []),   // 중복도 서버에 도달했으므로 synced 처리
  ];
  const allIds = events.map((e) => e.event_id);
  const rejected = allIds.filter((id) => !accepted.includes(id));

  return { accepted, rejected };
}

/**
 * 지수 백오프 재시도
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = MAX_RETRIES
): Promise<T> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < maxRetries) {
        const waitMs = Math.min(
          INITIAL_RETRY_MS * Math.pow(2, attempt),
          MAX_RETRY_WAIT_MS
        );
        await sleep(waitMs);
      }
    }
  }
  throw lastError!;
}

/**
 * 전체 동기화 실행 (배치 분할 처리)
 *
 * 시나리오 처리:
 * 1) 중복 이벤트 → 서버 ON CONFLICT DO NOTHING, 클라이언트 markAsSynced
 * 2) 네트워크 중단 → markSyncFailed 후 다음 호출 시 재시도
 * 3) 앱 재시작 → 미동기화 이벤트 재조회 (idempotent)
 * 4) 서버 오류 → 지수 백오프 후 최대 5회 재시도
 */
export async function runSync(): Promise<SyncResult> {
  if (_isSyncing) return { synced: 0, failed: 0, skipped: 0, error: 'already_syncing' };

  const netState = await NetInfo.fetch();
  if (!netState.isConnected) return { synced: 0, failed: 0, skipped: 0, error: 'offline' };

  _isSyncing = true;
  await emitStatus();

  let totalSynced = 0;
  let totalFailed = 0;

  try {
    const token = await getValidAppToken();
    if (!token) {
      return { synced: 0, failed: 0, skipped: 0, error: 'no_auth_token' };
    }

    // 배치 반복 처리 (큐가 빌 때까지)
    while (true) {
      const pending = await getPendingEvents(BATCH_SIZE);
      if (pending.length === 0) break;

      try {
        const { accepted, rejected } = await withRetry(() => uploadBatch(pending, token));

        if (accepted.length > 0) {
          await markAsSynced(accepted);
          totalSynced += accepted.length;
        }
        if (rejected.length > 0) {
          for (const id of rejected) {
            await markSyncFailed(id, 'server_rejected');
          }
          totalFailed += rejected.length;
        }
      } catch (err) {
        // 배치 전체 실패 → 개별 이벤트에 오류 기록
        const errMsg = err instanceof Error ? err.message : String(err);
        for (const event of pending) {
          await markSyncFailed(event.event_id, errMsg);
        }
        totalFailed += pending.length;
        break; // 네트워크 오류면 루프 중단
      }
    }

    _lastSyncAt = new Date().toISOString();
    return { synced: totalSynced, failed: totalFailed, skipped: 0 };
  } finally {
    _isSyncing = false;
    await emitStatus();
  }
}

// ─── 네트워크 상태 변경 감지 ──────────────────────────────────

let _unsubscribeNetInfo: (() => void) | null = null;

/**
 * 앱 초기화 시 등록 — 온라인 복귀 시 자동 동기화
 */
export function startAutoSync(): void {
  if (_unsubscribeNetInfo) return;

  _unsubscribeNetInfo = NetInfo.addEventListener((state: NetInfoState) => {
    if (state.isConnected) {
      runSync().catch(() => {});
    }
  });
}

export function stopAutoSync(): void {
  _unsubscribeNetInfo?.();
  _unsubscribeNetInfo = null;
}

// ─── 유틸 ────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
