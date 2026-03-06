"use strict";
/**
 * ReviewEvent — 학습 세션 중 발생하는 단일 카드 복습 이벤트 타입 정의
 * JSON Schema: packages/shared/schemas/review-event.schema.json (v1.0.0)
 *
 * append-only 원칙: 이미 저장된 이벤트는 수정하지 않는다.
 * idempotency: event_id를 기준으로 중복 수신 시 무시한다.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeReviewEvent = normalizeReviewEvent;
exports.generateEventId = generateEventId;
exports.validateReviewEventBasic = validateReviewEventBasic;
/**
 * ReviewEvent 기본값 적용 헬퍼
 */
function normalizeReviewEvent(event) {
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
function generateEventId() {
    const now = new Date();
    const date = now.toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.random().toString(36).slice(2, 8).padEnd(6, '0');
    return `evt_${date}_${rand}`;
}
/**
 * 클라이언트측 간이 스키마 검증 (필수 필드 존재 여부 확인)
 * 서버측에서는 JSON Schema 전체 검증을 수행한다.
 */
function validateReviewEventBasic(event) {
    if (typeof event !== 'object' || event === null)
        return false;
    const e = event;
    return (typeof e.event_id === 'string' &&
        typeof e.user_id === 'string' &&
        typeof e.card_id === 'string' &&
        typeof e.ts === 'string' &&
        typeof e.prompt_type === 'string' &&
        typeof e.correct === 'boolean' &&
        typeof e.rt_ms === 'number' &&
        e.rt_ms >= 0);
}
//# sourceMappingURL=review-event.js.map