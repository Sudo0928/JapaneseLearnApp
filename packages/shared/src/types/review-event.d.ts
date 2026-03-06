/**
 * ReviewEvent — 학습 세션 중 발생하는 단일 카드 복습 이벤트 타입 정의
 * JSON Schema: packages/shared/schemas/review-event.schema.json (v1.0.0)
 *
 * append-only 원칙: 이미 저장된 이벤트는 수정하지 않는다.
 * idempotency: event_id를 기준으로 중복 수신 시 무시한다.
 */
export type PromptType = 'SURFACE_TO_MEANING' | 'MEANING_TO_SURFACE' | 'SURFACE_TO_READING' | 'MCQ' | 'CLOZE' | 'LISTENING';
export type ErrorType = 'NONE' | 'READING_CONFUSION' | 'FORM_SIMILAR' | 'MEANING_NEAR' | 'NO_RECALL' | 'TYPO';
export type DeviceType = 'IOS' | 'ANDROID' | 'WEB' | 'UNKNOWN';
/**
 * 학습 이벤트 전체 구조 (저장 및 전송 공용)
 */
export interface ReviewEvent {
    /** 이벤트 고유 식별자 (idempotency 키). 형식: evt_{YYYYMMDD}_{uuid} */
    event_id: string;
    /** 가명 처리된 사용자 식별자 */
    user_id: string;
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
 * 서버 수신용 — 필수 필드 + 기본값 보장된 정규화 버전
 */
export interface NormalizedReviewEvent extends Required<Omit<ReviewEvent, 'item_id' | 'confidence'>> {
    item_id?: string;
    confidence?: number;
}
/**
 * ReviewEvent 기본값 적용 헬퍼
 */
export declare function normalizeReviewEvent(event: ReviewEvent): NormalizedReviewEvent;
/**
 * event_id 생성 헬퍼 (클라이언트·서버 공용)
 * 형식: evt_{YYYYMMDD}_{6자리 랜덤}
 */
export declare function generateEventId(): string;
/**
 * 클라이언트측 간이 스키마 검증 (필수 필드 존재 여부 확인)
 * 서버측에서는 JSON Schema 전체 검증을 수행한다.
 */
export declare function validateReviewEventBasic(event: unknown): event is ReviewEvent;
