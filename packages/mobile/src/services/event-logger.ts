/**
 * ReviewEvent 로거 (모바일 클라이언트)
 *
 * 역할:
 * 1) 학습 세션 중 이벤트를 생성하고 즉시 로컬 큐에 저장한다.
 * 2) 네트워크 가용 여부에 따라 직접 서버 전송 또는 큐 보관을 선택한다.
 *
 * AC: 이벤트 누락 < 0.1% 목표
 * → 로컬 큐에 먼저 저장 후 서버 전송 (저장 실패 시 전체 실패로 처리)
 */

import NetInfo from '@react-native-community/netinfo';
import { ReviewEventDraft, ReviewEventInput, generateEventId } from '@japanese-learn/shared';
import { enqueueEvent, getPendingEvents, markAsSynced, markSyncFailed } from '../db/local-queue';
import { getValidAppToken } from './secure-storage';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL ?? 'http://localhost:3000';
const SYNC_BATCH_SIZE = 50;

export type LogEventInput = ReviewEventDraft;

/**
 * 학습 이벤트 기록 진입점
 *
 * 호출 위치: 학습 세션 화면에서 문항 제출 시
 */
export async function logReviewEvent(input: LogEventInput): Promise<ReviewEventInput> {
  const event: ReviewEventInput = {
    ...input,
    event_id: generateEventId(),
    ts: input.ts ?? new Date().toISOString(),
    schema_version: '1.0.0',
  };

  // 1) 로컬 큐에 즉시 저장 (네트워크 독립)
  await enqueueEvent(event);

  // 2) 온라인이면 바로 동기화 시도 (백그라운드, 실패해도 큐에 남음)
  syncPendingEvents().catch(() => {
    // 동기화 실패는 무음 처리 — 큐에서 재시도
  });

  return event;
}

/**
 * 큐에 쌓인 미전송 이벤트를 서버로 전송
 * 앱 포그라운드 진입 시 또는 주기적으로 호출한다.
 */
export async function syncPendingEvents(): Promise<{
  synced: number;
  failed: number;
}> {
  const netState = await NetInfo.fetch();
  if (!netState.isConnected) {
    return { synced: 0, failed: 0 };
  }

  const pending = await getPendingEvents(SYNC_BATCH_SIZE);
  if (pending.length === 0) return { synced: 0, failed: 0 };

  let synced = 0;
  let failed = 0;

  try {
    const token = await getValidAppToken();
    const response = await fetch(`${BACKEND_URL}/v1/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(pending),
    });

    if (response.ok) {
      const body = await response.json();
      const insertedIds: string[] = body.insertedEventIds ?? [];
      const duplicateIds: string[] = body.duplicateEventIds ?? [];
      // 서버가 수락(신규 + 중복)한 이벤트는 모두 synced 처리
      const acceptedIds = [...insertedIds, ...duplicateIds];
      await markAsSynced(acceptedIds);
      synced = acceptedIds.length;
    } else {
      // HTTP 오류 — 모든 이벤트 실패 처리
      const errorText = await response.text();
      for (const event of pending) {
        await markSyncFailed(event.event_id, `HTTP ${response.status}: ${errorText}`);
      }
      failed = pending.length;
    }
  } catch (err) {
    // 네트워크 오류 — 모든 이벤트 실패 처리
    for (const event of pending) {
      await markSyncFailed(event.event_id, String(err));
    }
    failed = pending.length;
  }

  return { synced, failed };
}
