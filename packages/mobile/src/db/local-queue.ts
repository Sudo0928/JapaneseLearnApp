import * as ExpoSQLite from 'expo-sqlite';
import { ReviewEventInput, validateReviewEventBasic } from '@japanese-learn/shared';

const MAX_RETRY = 5;
const BATCH_SIZE = 100;

let db: import('expo-sqlite').SQLiteDatabase | null = null;

async function getNativeDb() {
  if (db) return db;

  db = await ExpoSQLite.openDatabaseAsync('japanese_learn_queue.db');
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS event_queue (
      event_id    TEXT PRIMARY KEY,
      payload     TEXT NOT NULL,
      created_at  TEXT NOT NULL,
      synced_at   TEXT,
      retry_count INTEGER NOT NULL DEFAULT 0,
      last_error  TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_event_queue_unsynced
      ON event_queue (created_at ASC) WHERE synced_at IS NULL;
  `);

  return db;
}

export async function enqueueEvent(event: ReviewEventInput): Promise<void> {
  if (!validateReviewEventBasic(event)) {
    throw new Error('ReviewEvent validation failed');
  }

  const sqlite = await getNativeDb();
  await sqlite.runAsync(
    'INSERT OR IGNORE INTO event_queue (event_id, payload, created_at) VALUES (?, ?, ?)',
    [event.event_id, JSON.stringify(event), new Date().toISOString()]
  );
}

export async function getPendingEvents(limit = BATCH_SIZE): Promise<ReviewEventInput[]> {
  const sqlite = await getNativeDb();
  const rows = await sqlite.getAllAsync<{ payload: string }>(
    'SELECT payload FROM event_queue WHERE synced_at IS NULL AND retry_count < ? ORDER BY created_at ASC LIMIT ?',
    [MAX_RETRY, limit]
  );

  return rows.map((row) => JSON.parse(row.payload) as ReviewEventInput);
}

export async function markAsSynced(eventIds: string[]): Promise<void> {
  if (eventIds.length === 0) return;

  const sqlite = await getNativeDb();
  const placeholders = eventIds.map(() => '?').join(', ');
  await sqlite.runAsync(
    `UPDATE event_queue SET synced_at = ? WHERE event_id IN (${placeholders})`,
    [new Date().toISOString(), ...eventIds]
  );
}

export async function markSyncFailed(eventId: string, error: string): Promise<void> {
  const sqlite = await getNativeDb();
  await sqlite.runAsync(
    'UPDATE event_queue SET retry_count = retry_count + 1, last_error = ? WHERE event_id = ?',
    [error, eventId]
  );
}

export async function getQueueStats(): Promise<{
  total: number;
  pending: number;
  synced: number;
  failed: number;
}> {
  const sqlite = await getNativeDb();
  const rows = await sqlite.getAllAsync<{
    total: number;
    pending: number;
    synced: number;
    failed: number;
  }>(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN synced_at IS NULL AND retry_count < ${MAX_RETRY} THEN 1 ELSE 0 END) AS pending,
      SUM(CASE WHEN synced_at IS NOT NULL THEN 1 ELSE 0 END) AS synced,
      SUM(CASE WHEN synced_at IS NULL AND retry_count >= ${MAX_RETRY} THEN 1 ELSE 0 END) AS failed
    FROM event_queue
  `);

  return rows[0] ?? { total: 0, pending: 0, synced: 0, failed: 0 };
}

export async function clearQueue(): Promise<void> {
  const sqlite = await getNativeDb();
  await sqlite.runAsync('DELETE FROM event_queue');
}
