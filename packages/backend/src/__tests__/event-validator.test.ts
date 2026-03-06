/**
 * ReviewEvent 스키마 검증기 단위 테스트
 *
 * AC: 이벤트 누락 < 0.1% 목표 달성을 위해
 *     유효 이벤트는 100% 통과, 무효 이벤트는 100% 거부되어야 한다.
 */

import { validateReviewEvent, validateReviewEventBatch } from '../services/event-validator';

const validEvent = {
  event_id: 'evt_20260305_abc123',
  user_id: 'u_testuser01',
  card_id: 'c_it_KEIKEN_SURFACE_TO_READING',
  item_id: 'it_KEIKEN',
  ts: '2026-03-05T10:21:34+09:00',
  prompt_type: 'SURFACE_TO_READING',
  correct: false,
  rt_ms: 4820,
  attempt_count: 1,
  hint_level: 1,
  confidence: 0.6,
  error_type: 'READING_CONFUSION',
  device: 'ANDROID',
  offline: true,
  schema_version: '1.0.0',
};

describe('validateReviewEvent — 단건 검증', () => {
  test('유효한 이벤트는 통과한다', () => {
    const result = validateReviewEvent(validEvent);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('최소 필수 필드만 있어도 통과한다', () => {
    const minimal = {
      event_id: 'evt_20260305_min001',
      user_id: 'u_minuser01',
      card_id: 'c_it_SUJI_MCQ',
      ts: '2026-03-05T00:00:00Z',
      prompt_type: 'MCQ',
      correct: true,
      rt_ms: 1200,
    };
    const result = validateReviewEvent(minimal);
    expect(result.valid).toBe(true);
  });

  test('event_id 누락 시 실패한다', () => {
    const { event_id: _, ...noId } = validEvent;
    const result = validateReviewEvent(noId);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('event_id'))).toBe(true);
  });

  test('rt_ms 음수 시 실패한다', () => {
    const result = validateReviewEvent({ ...validEvent, rt_ms: -1 });
    expect(result.valid).toBe(false);
  });

  test('rt_ms 300,000 초과 시 실패한다', () => {
    const result = validateReviewEvent({ ...validEvent, rt_ms: 300001 });
    expect(result.valid).toBe(false);
  });

  test('prompt_type 허용 범위 외 값은 실패한다', () => {
    const result = validateReviewEvent({ ...validEvent, prompt_type: 'INVALID_TYPE' });
    expect(result.valid).toBe(false);
  });

  test('error_type 허용 범위 외 값은 실패한다', () => {
    const result = validateReviewEvent({ ...validEvent, error_type: 'UNKNOWN_ERROR' });
    expect(result.valid).toBe(false);
  });

  test('confidence 범위 초과(1.1) 시 실패한다', () => {
    const result = validateReviewEvent({ ...validEvent, confidence: 1.1 });
    expect(result.valid).toBe(false);
  });

  test('correct 타입 불일치(문자열) 시 실패한다', () => {
    const result = validateReviewEvent({ ...validEvent, correct: 'yes' });
    expect(result.valid).toBe(false);
  });

  test('null 입력은 실패한다', () => {
    const result = validateReviewEvent(null);
    expect(result.valid).toBe(false);
  });
});

describe('validateReviewEventBatch — 배치 검증', () => {
  test('모두 유효한 배치는 전부 accepted로 분리된다', () => {
    const batch = [validEvent, { ...validEvent, event_id: 'evt_20260305_abc124' }];
    const result = validateReviewEventBatch(batch);
    expect(result.accepted).toHaveLength(2);
    expect(result.rejected).toHaveLength(0);
  });

  test('일부 무효 항목은 rejected에 인덱스와 함께 분리된다', () => {
    const batch = [validEvent, { ...validEvent, event_id: 'evt_20260305_abc125', rt_ms: -1 }];
    const result = validateReviewEventBatch(batch);
    expect(result.accepted).toHaveLength(1);
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0].index).toBe(1);
  });

  test('빈 배치는 결과도 비어있다', () => {
    const result = validateReviewEventBatch([]);
    expect(result.accepted).toHaveLength(0);
    expect(result.rejected).toHaveLength(0);
  });
});
