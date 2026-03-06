/**
 * SM-2 스케줄러 단위 테스트
 *
 * AC: due_ts 생성이 정확해야 한다.
 * - 신규 카드 첫 정답 → 1일 후
 * - 두 번째 정답 → 6일 후
 * - 세 번째 이상 → I(n-1) * EF
 * - 오답 → 1일 후 + relearning 상태
 */

import { scheduleNext, deriveQuality } from '../services/sm2-scheduler';

const NOW = new Date('2026-03-05T10:00:00Z');

function daysDiff(a: Date, b: Date): number {
  return (b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24);
}

describe('deriveQuality — 품질 점수 변환', () => {
  test('정답 + 빠름 + 힌트 없음 → 5', () => {
    expect(deriveQuality({ correct: true, rt_ms: 1500, hint_level: 0, error_type: 'NONE' })).toBe(5);
  });

  test('정답 + 보통 속도 + 힌트 없음 → 4', () => {
    expect(deriveQuality({ correct: true, rt_ms: 4000, hint_level: 0, error_type: 'NONE' })).toBe(4);
  });

  test('정답 + 느림 → 3', () => {
    expect(deriveQuality({ correct: true, rt_ms: 9000, hint_level: 0, error_type: 'NONE' })).toBe(3);
  });

  test('정답 + 힌트 1단계 → 3', () => {
    expect(deriveQuality({ correct: true, rt_ms: 3000, hint_level: 1, error_type: 'NONE' })).toBe(3);
  });

  test('오답 + 일반 → 2', () => {
    expect(deriveQuality({ correct: false, rt_ms: 5000, hint_level: 0, error_type: 'READING_CONFUSION' })).toBe(2);
  });

  test('오답 + NO_RECALL → 1', () => {
    expect(deriveQuality({ correct: false, rt_ms: 5000, hint_level: 0, error_type: 'NO_RECALL' })).toBe(1);
  });

  test('오답 + NO_RECALL + 힌트 2단계 → 0', () => {
    expect(deriveQuality({ correct: false, rt_ms: 5000, hint_level: 2, error_type: 'NO_RECALL' })).toBe(0);
  });
});

describe('scheduleNext — 신규 카드 스케줄', () => {
  const correctFast = { correct: true, rt_ms: 1500, hint_level: 0, error_type: 'NONE' };

  test('첫 번째 정답: interval = 1일, state = learning', () => {
    const result = scheduleNext(null, correctFast, NOW);
    expect(result.interval_days).toBe(1);
    expect(result.repetitions).toBe(1);
    expect(result.state).toBe('learning');
    expect(daysDiff(NOW, result.due_ts)).toBeCloseTo(1, 1);
  });

  test('두 번째 정답: interval = 6일', () => {
    const prev = { repetitions: 1, interval_days: 1, ease_factor: 2.5 };
    const result = scheduleNext(prev, correctFast, NOW);
    expect(result.interval_days).toBe(6);
    expect(result.repetitions).toBe(2);
    expect(result.state).toBe('learning');
  });

  test('세 번째 정답: interval = round(6 * EF)', () => {
    const ef = 2.6; // 이전 정답으로 EF 상승
    const prev = { repetitions: 2, interval_days: 6, ease_factor: ef };
    const result = scheduleNext(prev, correctFast, NOW);
    expect(result.interval_days).toBe(Math.round(6 * result.ease_factor));
    expect(result.state).toBe('review');
  });

  test('네 번째 정답: 계속 간격 증가', () => {
    const prev = { repetitions: 3, interval_days: 16, ease_factor: 2.5 };
    const result = scheduleNext(prev, correctFast, NOW);
    expect(result.interval_days).toBeGreaterThan(16);
  });
});

describe('scheduleNext — 오답 처리', () => {
  test('오답(q=1): interval = 1일, relearning, repetitions 초기화', () => {
    const prev = { repetitions: 5, interval_days: 30, ease_factor: 2.5 };
    const wrong = { correct: false, rt_ms: 5000, hint_level: 0, error_type: 'NO_RECALL' };
    const result = scheduleNext(prev, wrong, NOW);
    expect(result.interval_days).toBe(1);
    expect(result.repetitions).toBe(0);
    expect(result.state).toBe('relearning');
    expect(daysDiff(NOW, result.due_ts)).toBeCloseTo(1, 1);
  });

  test('오답 후 EF 감소', () => {
    const prev = { repetitions: 3, interval_days: 10, ease_factor: 2.5 };
    const wrong = { correct: false, rt_ms: 5000, hint_level: 0, error_type: 'READING_CONFUSION' };
    const result = scheduleNext(prev, wrong, NOW);
    expect(result.ease_factor).toBeLessThan(2.5);
  });

  test('EF는 최솟값 1.3 아래로 내려가지 않는다', () => {
    const prev = { repetitions: 1, interval_days: 1, ease_factor: 1.3 };
    const wrong = { correct: false, rt_ms: 5000, hint_level: 2, error_type: 'NO_RECALL' };
    const result = scheduleNext(prev, wrong, NOW);
    expect(result.ease_factor).toBeGreaterThanOrEqual(1.3);
  });
});

describe('scheduleNext — 힌트 패널티', () => {
  test('힌트 사용(hint_level=2) 정답: quality=3으로 처리, EF 약간 감소', () => {
    const prev = { repetitions: 2, interval_days: 6, ease_factor: 2.5 };
    const withHint = { correct: true, rt_ms: 3000, hint_level: 2, error_type: 'NONE' };
    const noHint = { correct: true, rt_ms: 1500, hint_level: 0, error_type: 'NONE' };

    const resultHint = scheduleNext(prev, withHint, NOW);
    const resultNoHint = scheduleNext(prev, noHint, NOW);

    expect(resultHint.ease_factor).toBeLessThanOrEqual(resultNoHint.ease_factor);
  });
});
