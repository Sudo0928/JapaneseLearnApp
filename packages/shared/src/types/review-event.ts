export type PromptType =
  | 'SURFACE_TO_MEANING'
  | 'MEANING_TO_SURFACE'
  | 'SURFACE_TO_READING'
  | 'MCQ'
  | 'CLOZE'
  | 'LISTENING';

export type ErrorType =
  | 'NONE'
  | 'READING_CONFUSION'
  | 'FORM_SIMILAR'
  | 'MEANING_NEAR'
  | 'NO_RECALL'
  | 'TYPO';

export type DeviceType = 'IOS' | 'ANDROID' | 'WEB' | 'UNKNOWN';
export type NetworkState = 'offline' | 'wifi' | 'cellular' | 'unknown';

export interface ReviewEventInput {
  event_id: string;
  card_id: string;
  item_id?: string;
  ts: string;
  prompt_type: PromptType;
  correct: boolean;
  rt_ms: number;
  attempt_count?: number;
  hint_level?: number;
  confidence?: number;
  error_type?: ErrorType;
  device?: DeviceType;
  offline?: boolean;
  network_state?: NetworkState;
  last_successful_sync_at?: string;
  queue_depth?: number;
  schema_version?: string;
}

export interface ReviewEvent extends ReviewEventInput {
  user_id: string;
}

export type ReviewEventDraft = Omit<ReviewEventInput, 'event_id' | 'ts' | 'schema_version'> & {
  ts?: string;
};

export interface NormalizedReviewEvent
  extends Required<
    Omit<
      ReviewEvent,
      'item_id' | 'confidence' | 'last_successful_sync_at' | 'queue_depth'
    >
  > {
  item_id?: string;
  confidence?: number;
  last_successful_sync_at?: string;
  queue_depth?: number;
}

export function normalizeReviewEvent(event: ReviewEvent): NormalizedReviewEvent {
  return {
    ...event,
    attempt_count: event.attempt_count ?? 1,
    hint_level: event.hint_level ?? 0,
    error_type: event.error_type ?? 'NONE',
    device: event.device ?? 'UNKNOWN',
    offline: event.offline ?? false,
    network_state: event.network_state ?? 'unknown',
    schema_version: event.schema_version ?? '1.0.0',
  };
}

export function generateEventId(): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).slice(2, 8).padEnd(6, '0');
  return `evt_${date}_${rand}`;
}

export function validateReviewEventBasic(event: unknown): event is ReviewEventInput {
  if (typeof event !== 'object' || event === null) return false;
  const e = event as Record<string, unknown>;

  const queueDepthValid = e.queue_depth === undefined
    || (typeof e.queue_depth === 'number' && Number.isFinite(e.queue_depth) && e.queue_depth >= 0);

  const networkValid = e.network_state === undefined
    || ['offline', 'wifi', 'cellular', 'unknown'].includes(String(e.network_state));

  return (
    typeof e.event_id === 'string' &&
    typeof e.card_id === 'string' &&
    typeof e.ts === 'string' &&
    typeof e.prompt_type === 'string' &&
    typeof e.correct === 'boolean' &&
    typeof e.rt_ms === 'number' &&
    e.rt_ms >= 0 &&
    queueDepthValid &&
    networkValid
  );
}
