import { ReviewEventInput, validateReviewEventBasic } from '@japanese-learn/shared';

const MAX_RETRY = 5;
const BATCH_SIZE = 100;

interface QueueRow {
  event_id: string;
  payload: ReviewEventInput;
  created_at: string;
  synced_at: string | null;
  retry_count: number;
  last_error: string | null;
}

const webQueue = new Map<string, QueueRow>();

export async function enqueueEvent(event: ReviewEventInput): Promise<void> {
  if (!validateReviewEventBasic(event)) {
    throw new Error('ReviewEvent validation failed');
  }

  if (webQueue.has(event.event_id)) return;

  webQueue.set(event.event_id, {
    event_id: event.event_id,
    payload: event,
    created_at: new Date().toISOString(),
    synced_at: null,
    retry_count: 0,
    last_error: null,
  });
}

export async function getPendingEvents(limit = BATCH_SIZE): Promise<ReviewEventInput[]> {
  return Array.from(webQueue.values())
    .filter((row) => row.synced_at === null && row.retry_count < MAX_RETRY)
    .sort((left, right) => left.created_at.localeCompare(right.created_at))
    .slice(0, limit)
    .map((row) => row.payload);
}

export async function markAsSynced(eventIds: string[]): Promise<void> {
  if (eventIds.length === 0) return;

  const syncedAt = new Date().toISOString();
  for (const eventId of eventIds) {
    const row = webQueue.get(eventId);
    if (row) {
      row.synced_at = syncedAt;
    }
  }
}

export async function markSyncFailed(eventId: string, error: string): Promise<void> {
  const row = webQueue.get(eventId);
  if (!row) return;

  row.retry_count += 1;
  row.last_error = error;
}

export async function getQueueStats(): Promise<{
  total: number;
  pending: number;
  synced: number;
  failed: number;
}> {
  const rows = Array.from(webQueue.values());

  return {
    total: rows.length,
    pending: rows.filter((row) => row.synced_at === null && row.retry_count < MAX_RETRY).length,
    synced: rows.filter((row) => row.synced_at !== null).length,
    failed: rows.filter((row) => row.synced_at === null && row.retry_count >= MAX_RETRY).length,
  };
}
