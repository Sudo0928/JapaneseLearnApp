/**
 * 로컬 SQLite 큐 (오프라인 이벤트 저장 및 동기화 관리)
 *
 * 설계 원칙:
 * - 오프라인 중 발생한 ReviewEvent를 로컬 SQLite에 저장한다.
 * - 온라인 복귀 시 idempotency 키(event_id)로 서버에 업로드한다.
 * - 업로드 성공한 이벤트는 synced_at을 기록하고 보관 (삭제 안 함).
 * - 실패한 이벤트는 retry_count를 증가시켜 재시도 스케줄링에 활용한다.
 */

import { Platform } from 'react-native';
import * as ExpoSQLite from 'expo-sqlite';
import { ReviewEvent, validateReviewEventBasic } from '@japanese-learn/shared';

const MAX_RETRY = 5;
const BATCH_SIZE = 100;

// ─── 웹 폴백: 메모리 내 큐 ───────────────────────────────────
interface QueueRow {
  event_id: string;
  payload: ReviewEvent;
  created_at: string;
  synced_at: string | null;
  retry_count: number;
  last_error: string | null;
}
const _webQueue = new Map<string, QueueRow>();

// ─── 플랫폼 분기 ──────────────────────────────────────────────
const IS_WEB = Platform.OS === 'web';

// 네이티브 전용 — 웹에서는 import 자체를 건너뜀
let _db: import('expo-sqlite').SQLiteDatabase | null = null;

async function getNativeDb() {
  if (_db) return _db;
  _db = await ExpoSQLite.openDatabaseAsync('japanese_learn_queue.db');
  await _db.execAsync(`
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
  return _db;
}

/**
 * 이벤트를 로컬 큐에 추가
 * 이미 존재하는 event_id는 무시 (idempotency)
 */
export async function enqueueEvent(event: ReviewEvent): Promise<void> {
  if (!validateReviewEventBasic(event)) {
    throw new Error('ReviewEvent 검증 실패');
  }
  if (IS_WEB) {
    if (!_webQueue.has(event.event_id)) {
      _webQueue.set(event.event_id, {
        event_id: event.event_id, payload: event,
        created_at: new Date().toISOString(),
        synced_at: null, retry_count: 0, last_error: null,
      });
    }
    return;
  }
  const db = await getNativeDb();
  await db.runAsync(
    `INSERT OR IGNORE INTO event_queue (event_id, payload, created_at) VALUES (?, ?, ?)`,
    [event.event_id, JSON.stringify(event), new Date().toISOString()]
  );
}

/**
 * 동기화되지 않은 이벤트 목록 조회 (배치 단위)
 */
export async function getPendingEvents(limit = BATCH_SIZE): Promise<ReviewEvent[]> {
  if (IS_WEB) {
    return Array.from(_webQueue.values())
      .filter(r => r.synced_at === null && r.retry_count < MAX_RETRY)
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .slice(0, limit)
      .map(r => r.payload);
  }
  const db = await getNativeDb();
  const rows = await db.getAllAsync<{ payload: string }>(
    `SELECT payload FROM event_queue WHERE synced_at IS NULL AND retry_count < ? ORDER BY created_at ASC LIMIT ?`,
    [MAX_RETRY, limit]
  );
  return rows.map((r) => JSON.parse(r.payload) as ReviewEvent);
}

/**
 * 동기화 성공 마킹
 */
export async function markAsSynced(eventIds: string[]): Promise<void> {
  if (eventIds.length === 0) return;
  if (IS_WEB) {
    const now = new Date().toISOString();
    eventIds.forEach(id => {
      const row = _webQueue.get(id);
      if (row) row.synced_at = now;
    });
    return;
  }
  const db = await getNativeDb();
  const placeholders = eventIds.map(() => '?').join(', ');
  await db.runAsync(
    `UPDATE event_queue SET synced_at = ? WHERE event_id IN (${placeholders})`,
    [new Date().toISOString(), ...eventIds]
  );
}

/**
 * 동기화 실패 마킹 (retry_count 증가, 오류 기록)
 */
export async function markSyncFailed(eventId: string, error: string): Promise<void> {
  if (IS_WEB) {
    const row = _webQueue.get(eventId);
    if (row) { row.retry_count += 1; row.last_error = error; }
    return;
  }
  const db = await getNativeDb();
  await db.runAsync(
    `UPDATE event_queue SET retry_count = retry_count + 1, last_error = ? WHERE event_id = ?`,
    [error, eventId]
  );
}

/**
 * 큐 통계 조회 (모니터링 / 리포트용)
 */
export async function getQueueStats(): Promise<{
  total: number; pending: number; synced: number; failed: number;
}> {
  if (IS_WEB) {
    const rows = Array.from(_webQueue.values());
    return {
      total: rows.length,
      pending: rows.filter(r => r.synced_at === null && r.retry_count < MAX_RETRY).length,
      synced:  rows.filter(r => r.synced_at !== null).length,
      failed:  rows.filter(r => r.synced_at === null && r.retry_count >= MAX_RETRY).length,
    };
  }
  const db = await getNativeDb();
  const rows = await db.getAllAsync<{ total: number; pending: number; synced: number; failed: number }>(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN synced_at IS NULL AND retry_count < ${MAX_RETRY} THEN 1 ELSE 0 END) AS pending,
      SUM(CASE WHEN synced_at IS NOT NULL THEN 1 ELSE 0 END) AS synced,
      SUM(CASE WHEN synced_at IS NULL AND retry_count >= ${MAX_RETRY} THEN 1 ELSE 0 END) AS failed
    FROM event_queue
  `);
  return rows[0] ?? { total: 0, pending: 0, synced: 0, failed: 0 };
}
