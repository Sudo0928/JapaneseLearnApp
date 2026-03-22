import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import {
  getPendingEvents,
  markAsSynced,
  markSyncFailed,
  getQueueStats,
} from '../db/local-queue';
import { getValidAppToken, setLastSuccessfulSyncAt } from './secure-storage';
import { ReviewEventInput } from '@japanese-learn/shared';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL ?? 'http://localhost:3000';

const BATCH_SIZE = 50;
const MAX_RETRY_WAIT_MS = 30_000;
const INITIAL_RETRY_MS = 1_000;
const MAX_RETRIES = 5;

export interface SyncResult {
  synced: number;
  failed: number;
  skipped: number;
  error?: string;
}

export interface SyncStatus {
  isSyncing: boolean;
  lastSyncAt: string | null;
  pendingCount: number;
  failedCount: number;
}

let isSyncing = false;
let lastSyncAt: string | null = null;
const listeners = new Set<(status: SyncStatus) => void>();
let unsubscribeNetInfo: (() => void) | null = null;

export function onSyncStatusChange(cb: (status: SyncStatus) => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

async function emitStatus(): Promise<void> {
  const stats = await getQueueStats();
  const status: SyncStatus = {
    isSyncing,
    lastSyncAt,
    pendingCount: stats.pending,
    failedCount: stats.failed,
  };
  listeners.forEach((listener) => listener(status));
}

async function uploadBatch(
  events: ReviewEventInput[],
  token: string,
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
    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  }

  const body = await response.json() as {
    insertedEventIds?: string[];
    duplicateEventIds?: string[];
  };

  const accepted = [...(body.insertedEventIds ?? []), ...(body.duplicateEventIds ?? [])];
  const allIds = events.map((event) => event.event_id);
  const rejected = allIds.filter((id) => !accepted.includes(id));
  return { accepted, rejected };
}

async function withRetry<T>(fn: () => Promise<T>, maxRetries = MAX_RETRIES): Promise<T> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < maxRetries) {
        const waitMs = Math.min(INITIAL_RETRY_MS * Math.pow(2, attempt), MAX_RETRY_WAIT_MS);
        await sleep(waitMs);
      }
    }
  }
  throw lastError!;
}

export async function runSync(): Promise<SyncResult> {
  if (isSyncing) return { synced: 0, failed: 0, skipped: 0, error: 'already_syncing' };

  const netState = await NetInfo.fetch();
  if (!netState.isConnected) return { synced: 0, failed: 0, skipped: 0, error: 'offline' };

  isSyncing = true;
  await emitStatus();

  let totalSynced = 0;
  let totalFailed = 0;

  try {
    const token = await getValidAppToken();
    if (!token) {
      return { synced: 0, failed: 0, skipped: 0, error: 'no_auth_token' };
    }

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
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        for (const event of pending) {
          await markSyncFailed(event.event_id, message);
        }
        totalFailed += pending.length;
        break;
      }
    }

    lastSyncAt = new Date().toISOString();
    await setLastSuccessfulSyncAt(lastSyncAt);
    return { synced: totalSynced, failed: totalFailed, skipped: 0 };
  } finally {
    isSyncing = false;
    await emitStatus();
  }
}

export function startAutoSync(): void {
  if (unsubscribeNetInfo) return;

  unsubscribeNetInfo = NetInfo.addEventListener((state: NetInfoState) => {
    if (state.isConnected) {
      runSync().catch(() => {});
    }
  });
}

export function stopAutoSync(): void {
  unsubscribeNetInfo?.();
  unsubscribeNetInfo = null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
