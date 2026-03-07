/**
 * ReviewEvent — 학습 세션 중 발생하는 단일 카드 복습 이벤트 타입 정의
 * JSON Schema: packages/shared/schemas/review-event.schema.json (v1.0.0)
 *
 * append-only 원칙: 이미 저장된 이벤트는 수정하지 않는다.
 * idempotency: event_id를 기준으로 중복 수신 시 무시한다.
 */

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

/**
 * 클라이언트가 로컬 큐와 HTTP 요청에서 사용하는 공개 이벤트 계약.
 * user_id는 서버가 JWT에서 주입하므로 포함하지 않는다.
 */
export interface ReviewEventInput {
  /** 이벤트 고유 식별자 (idempotency 키). 형식: evt_{YYYYMMDD}_{uuid} */
  event_id: string;
  /** 카드 식별자. 형식: c_{item_id}_{prompt_type} */
  card_id: string;
  /** 단어/한자 아이템 식별자 */
  item_id?: string;
  /** 이벤트 발생 시각 (ISO 8601) */
  ts: string;
  /** 문항 유형 */
  prompt_type: PromptType;
  /** 정답 여부 */
  correct: boolean;
  /** 반응시간(밀리초). 최대 300,000ms */
  rt_ms: number;
  /** 시도 횟수 (기본값: 1) */
  attempt_count?: number;
  /** 힌트 단계 (0=사용 안 함, 최대 3) */
  hint_level?: number;
  /** 사용자 자기 확신도 0.0~1.0 (선택 수집) */
  confidence?: number;
  /** 오답 유형 (기본값: NONE) */
  error_type?: ErrorType;
  /** 학습 디바이스 종류 */
  device?: DeviceType;
  /** 오프라인 상태 여부 */
  offline?: boolean;
  /** 스키마 버전 */
  schema_version?: string;
}

/**
 * 서버가 저장하는 최종 이벤트 구조.
 * user_id는 클라이언트 입력이 아니라 서버 인증 정보에서만 채운다.
 */
export interface ReviewEvent extends ReviewEventInput {
  /** 가명 처리된 사용자 식별자. 서버가 JWT에서 주입한다. */
  user_id: string;
}

/**
 * 세션 화면이 제출 직전에 생성하는 이벤트 초안.
 */
export type ReviewEventDraft = Omit<ReviewEventInput, 'event_id' | 'ts' | 'schema_version'> & {
  ts?: string;
};

/**
 * 서버 수신용 — 필수 필드 + 기본값 보장된 정규화 버전
 */
export interface NormalizedReviewEvent extends Required<Omit<ReviewEvent, 'item_id' | 'confidence'>> {
  item_id?: string;
  confidence?: number;
}

/**
 * ReviewEvent 기본값 적용 헬퍼
 */
export function normalizeReviewEvent(event: ReviewEvent): NormalizedReviewEvent {
  return {
    ...event,
    attempt_count: event.attempt_count ?? 1,
    hint_level: event.hint_level ?? 0,
    error_type: event.error_type ?? 'NONE',
    device: event.device ?? 'UNKNOWN',
    offline: event.offline ?? false,
    schema_version: event.schema_version ?? '1.0.0',
  };
}

/**
 * event_id 생성 헬퍼 (클라이언트·서버 공용)
 * 형식: evt_{YYYYMMDD}_{6자리 랜덤}
 */
export function generateEventId(): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).slice(2, 8).padEnd(6, '0');
  return `evt_${date}_${rand}`;
}

/**
 * 클라이언트측 간이 스키마 검증 (공개 입력 계약 기준)
 * 서버측에서는 user_id를 주입한 뒤 JSON Schema 전체 검증을 수행한다.
 */
export function validateReviewEventBasic(event: unknown): event is ReviewEventInput {
  if (typeof event !== 'object' || event === null) return false;
  const e = event as Record<string, unknown>;
  return (
    typeof e.event_id === 'string' &&
    typeof e.card_id === 'string' &&
    typeof e.ts === 'string' &&
    typeof e.prompt_type === 'string' &&
    typeof e.correct === 'boolean' &&
    typeof e.rt_ms === 'number' &&
    e.rt_ms >= 0
  );
}
