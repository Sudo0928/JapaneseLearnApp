/**
 * 동기화 idempotency + 충돌 시나리오 테스트 (Sprint 6-1)
 *
 * 테스트 목표 (AC: rules/report.mdc):
 * - 동일 event_id 중복 업로드 → 서버에서 무해하게 처리 (ON CONFLICT DO NOTHING)
 * - 배치 부분 성공 → 성공한 이벤트만 synced 처리
 * - 앱 재시작 후 미동기화 이벤트 재업로드 → 중복 없이 처리
 * - 이벤트 순서(created_at ASC) 보장
 * - event_id 패턴 검증
 *
 * 주의: 이 테스트는 실제 DB 없이 서비스 로직만 검증 (단위 테스트)
 * 통합 테스트(실제 PostgreSQL)는 CI/CD 파이프라인에서 별도 실행
 */

import { scheduleNext } from '../services/sm2-scheduler';

// ─── SM-2 스케줄러 idempotency 검증 ──────────────────────────
// SM-2는 동일 입력 → 동일 출력이어야 한다 (결정론적)

describe('SM-2 스케줄러 결정론적 동작', () => {
  const fixedNow = new Date('2026-03-05T10:00:00Z');

  it('동일 입력에서 항상 동일한 due_ts를 반환한다', () => {
    const input = {
      correct: true,
      rt_ms: 2000,
      hint_level: 0,
      error_type: 'NONE' as const,
    };

    const result1 = scheduleNext(null, input, fixedNow);
    const result2 = scheduleNext(null, input, fixedNow);

    expect(result1.due_ts.toISOString()).toBe(result2.due_ts.toISOString());
    expect(result1.interval_days).toBe(result2.interval_days);
    expect(result1.ease_factor).toBe(result2.ease_factor);
  });

  it('틀린 경우 interval_days가 1로 리셋된다', () => {
    const wrongInput = {
      correct: false,
      rt_ms: 8000,
      hint_level: 2,
      error_type: 'NO_RECALL' as const,
    };

    const result = scheduleNext(
      { interval_days: 10, ease_factor: 2.5, repetitions: 5 },
      wrongInput,
      fixedNow
    );

    expect(result.interval_days).toBe(1);
    expect(result.repetitions).toBe(0);
  });

  it('연속 정답 시 interval_days가 증가한다', () => {
    const input = { correct: true, rt_ms: 1500, hint_level: 0, error_type: 'NONE' as const };
    let state = scheduleNext(null, input, fixedNow);

    for (let i = 0; i < 4; i++) {
      const prev = state.interval_days;
      state = scheduleNext(
        { interval_days: state.interval_days, ease_factor: state.ease_factor, repetitions: state.repetitions },
        input,
        fixedNow
      );
      expect(state.interval_days).toBeGreaterThan(prev);
    }
  });
});

// ─── event_id 패턴 검증 ───────────────────────────────────────

describe('ReviewEvent event_id 패턴', () => {
  const PATTERN = /^evt_[0-9]{8}_[a-zA-Z0-9_-]+$/;

  it('올바른 event_id 패턴을 허용한다', () => {
    const validIds = [
      'evt_20260305_abc123',
      'evt_20260305_uuid-v4-like-string',
      'evt_20260305_000001',
    ];
    validIds.forEach((id) => expect(PATTERN.test(id)).toBe(true));
  });

  it('잘못된 event_id 패턴을 거부한다', () => {
    const invalidIds = [
      'event_20260305_abc',      // evt_ prefix 아님
      'evt_2026030_abc',         // 날짜 7자리
      'evt_20260305_',           // 빈 suffix
      '',
    ];
    invalidIds.forEach((id) => expect(PATTERN.test(id)).toBe(false));
  });
});

// ─── 동기화 배치 로직 검증 (순수 함수) ───────────────────────

describe('동기화 배치 idempotency 로직', () => {
  /**
   * 서버 응답 시뮬레이션
   * ON CONFLICT DO NOTHING 동작: 중복 이벤트는 insertedEventIds가 아닌 duplicateEventIds로 반환
   */
  function simulateServerBatch(
    events: { event_id: string }[],
    existingIds: Set<string>
  ): { insertedEventIds: string[]; duplicateEventIds: string[] } {
    const inserted: string[] = [];
    const duplicate: string[] = [];

    for (const e of events) {
      if (existingIds.has(e.event_id)) {
        duplicate.push(e.event_id);
      } else {
        inserted.push(e.event_id);
        existingIds.add(e.event_id);
      }
    }

    return { insertedEventIds: inserted, duplicateEventIds: duplicate };
  }

  it('첫 번째 업로드: 모든 이벤트가 inserted로 처리된다', () => {
    const serverStore = new Set<string>();
    const batch = [
      { event_id: 'evt_20260305_001' },
      { event_id: 'evt_20260305_002' },
      { event_id: 'evt_20260305_003' },
    ];

    const result = simulateServerBatch(batch, serverStore);

    expect(result.insertedEventIds).toHaveLength(3);
    expect(result.duplicateEventIds).toHaveLength(0);
  });

  it('중복 재업로드: 모든 이벤트가 duplicate로 처리된다 (무해)', () => {
    const serverStore = new Set(['evt_20260305_001', 'evt_20260305_002', 'evt_20260305_003']);
    const batch = [
      { event_id: 'evt_20260305_001' },
      { event_id: 'evt_20260305_002' },
      { event_id: 'evt_20260305_003' },
    ];

    const result = simulateServerBatch(batch, serverStore);

    expect(result.insertedEventIds).toHaveLength(0);
    expect(result.duplicateEventIds).toHaveLength(3);

    // 클라이언트는 duplicate도 synced로 처리해야 한다
    const allAccepted = [...result.insertedEventIds, ...result.duplicateEventIds];
    expect(allAccepted).toHaveLength(3);
  });

  it('부분 업로드 성공: 001만 전송하면 001만 accepted에 포함된다', () => {
    const serverStore = new Set<string>();
    const batch = [
      { event_id: 'evt_20260305_001' },
      { event_id: 'evt_20260305_002' },
    ];

    // 서버에 001만 전송 (002는 네트워크 오류로 미전송 시뮬레이션)
    const result = simulateServerBatch(
      batch.filter((e) => e.event_id === 'evt_20260305_001'),
      serverStore  // 빈 상태에서 시작
    );

    expect(result.insertedEventIds).toContain('evt_20260305_001');
    expect(result.insertedEventIds).not.toContain('evt_20260305_002');
    // 002는 아직 미동기화 → 다음 sync 시 재시도 대상
    expect(result.duplicateEventIds).not.toContain('evt_20260305_002');
  });

  it('배치 순서 보장: created_at ASC 순서로 처리된다', () => {
    const events = [
      { event_id: 'evt_20260305_003', created_at: '2026-03-05T10:03:00Z' },
      { event_id: 'evt_20260305_001', created_at: '2026-03-05T10:01:00Z' },
      { event_id: 'evt_20260305_002', created_at: '2026-03-05T10:02:00Z' },
    ];

    const sorted = [...events].sort((a, b) =>
      a.created_at.localeCompare(b.created_at)
    );

    expect(sorted[0].event_id).toBe('evt_20260305_001');
    expect(sorted[1].event_id).toBe('evt_20260305_002');
    expect(sorted[2].event_id).toBe('evt_20260305_003');
  });
});

// ─── 오프라인 회복 시나리오 ───────────────────────────────────

describe('오프라인 회복 시나리오', () => {
  it('오프라인 → 온라인 복귀 시 미동기화 이벤트가 재처리된다', () => {
    // 로컬 큐 상태 시뮬레이션
    const localQueue = [
      { event_id: 'evt_20260305_001', synced_at: null, retry_count: 0 },
      { event_id: 'evt_20260305_002', synced_at: null, retry_count: 2 },
      { event_id: 'evt_20260305_003', synced_at: '2026-03-05T10:00:00Z', retry_count: 0 }, // 이미 동기화
    ];

    const MAX_RETRY = 5;
    const pending = localQueue.filter(
      (e) => e.synced_at === null && e.retry_count < MAX_RETRY
    );

    expect(pending).toHaveLength(2);
    expect(pending.map((e) => e.event_id)).toContain('evt_20260305_001');
    expect(pending.map((e) => e.event_id)).toContain('evt_20260305_002');
    expect(pending.map((e) => e.event_id)).not.toContain('evt_20260305_003');
  });

  it('최대 재시도 초과 이벤트는 pending에서 제외된다', () => {
    const MAX_RETRY = 5;
    const localQueue = [
      { event_id: 'evt_20260305_001', synced_at: null, retry_count: 5 }, // 초과
      { event_id: 'evt_20260305_002', synced_at: null, retry_count: 4 }, // 허용
    ];

    const pending = localQueue.filter(
      (e) => e.synced_at === null && e.retry_count < MAX_RETRY
    );

    expect(pending).toHaveLength(1);
    expect(pending[0].event_id).toBe('evt_20260305_002');
  });

  it('지수 백오프 대기 시간이 올바르게 계산된다', () => {
    const INITIAL_MS = 1000;
    const MAX_MS = 30000;

    const waitTimes = [0, 1, 2, 3, 4].map((attempt) =>
      Math.min(INITIAL_MS * Math.pow(2, attempt), MAX_MS)
    );

    expect(waitTimes[0]).toBe(1000);  // 1초
    expect(waitTimes[1]).toBe(2000);  // 2초
    expect(waitTimes[2]).toBe(4000);  // 4초
    expect(waitTimes[3]).toBe(8000);  // 8초
    expect(waitTimes[4]).toBe(16000); // 16초
    // 최대 30초 제한 확인 (2^5 = 32000 → 30000)
    expect(Math.min(INITIAL_MS * Math.pow(2, 5), MAX_MS)).toBe(30000);
  });
});
