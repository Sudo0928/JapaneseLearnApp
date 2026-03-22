import NetInfo from '@react-native-community/netinfo';
import { ReviewEventDraft, ReviewEventInput, generateEventId } from '@japanese-learn/shared';
import { enqueueEvent, getPendingEvents, getQueueStats, markAsSynced, markSyncFailed } from '../db/local-queue';
import { getLastSuccessfulSyncAt, getValidAppToken } from './secure-storage';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL ?? 'http://localhost:3000';
const SYNC_BATCH_SIZE = 50;

export type LogEventInput = ReviewEventDraft;

export async function logReviewEvent(input: LogEventInput): Promise<ReviewEventInput> {
  const netState = await NetInfo.fetch();
  const queueStats = await getQueueStats();
  const lastSuccessfulSyncAt = await getLastSuccessfulSyncAt();

  const networkState = input.network_state ?? deriveNetworkState(netState);
  const offline = typeof input.offline === 'boolean'
    ? input.offline
    : networkState === 'offline';

  const event: ReviewEventInput = {
    ...input,
    event_id: generateEventId(),
    ts: input.ts ?? new Date().toISOString(),
    offline,
    network_state: networkState,
    last_successful_sync_at: input.last_successful_sync_at ?? lastSuccessfulSyncAt ?? undefined,
    queue_depth: input.queue_depth ?? queueStats.pending + 1,
    schema_version: '1.0.0',
  };

  await enqueueEvent(event);
  syncPendingEvents().catch(() => {});
  return event;
}

export async function syncPendingEvents(): Promise<{ synced: number; failed: number }> {
  const netState = await NetInfo.fetch();
  if (!netState.isConnected) {
    return { synced: 0, failed: 0 };
  }

  const pending = await getPendingEvents(SYNC_BATCH_SIZE);
  if (pending.length === 0) return { synced: 0, failed: 0 };

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

    if (!response.ok) {
      const errorText = await response.text();
      for (const event of pending) {
        await markSyncFailed(event.event_id, `HTTP ${response.status}: ${errorText}`);
      }
      return { synced: 0, failed: pending.length };
    }

    const body = await response.json() as {
      insertedEventIds?: string[];
      duplicateEventIds?: string[];
    };

    const acceptedIds = [...(body.insertedEventIds ?? []), ...(body.duplicateEventIds ?? [])];
    await markAsSynced(acceptedIds);
    return { synced: acceptedIds.length, failed: 0 };
  } catch (error) {
    for (const event of pending) {
      await markSyncFailed(event.event_id, String(error));
    }
    return { synced: 0, failed: pending.length };
  }
}

function deriveNetworkState(
  netState: Awaited<ReturnType<typeof NetInfo.fetch>>,
): ReviewEventInput['network_state'] {
  if (!netState.isConnected) return 'offline';
  if (netState.type === 'wifi' || netState.type === 'ethernet') return 'wifi';
  if (netState.type === 'cellular') return 'cellular';
  return 'unknown';
}
