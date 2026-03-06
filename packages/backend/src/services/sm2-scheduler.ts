/**
 * SM-2 기반 SRS 스케줄러
 *
 * 알고리즘 출처: SuperMemo SM-2 (공개 알고리즘)
 * 참고: https://www.supermemo.com/en/blog/application-of-a-computer-to-improve-the-results-obtained-in-working-with-the-super-memo-method
 *
 * 핵심 수식:
 *   - q (품질 점수): 0~5
 *   - EF(n+1) = EF(n) + (0.1 - (5-q) * (0.08 + (5-q) * 0.02))
 *   - EF 하한: 1.3
 *   - I(1) = 1일, I(2) = 6일, I(n≥3) = I(n-1) * EF
 *   - q < 3이면 반복 횟수 초기화 (relearning)
 *
 * 품질 점수 매핑 (ReviewEvent → SM-2 quality):
 *   5: 정답 + 빠른 반응 (rt_ms < 빠름 기준, 힌트 없음)
 *   4: 정답 + 보통 반응 (힌트 없음)
 *   3: 정답 + 느린 반응 또는 힌트 1단계 사용
 *   2: 오답이지만 힌트로 기억함 (hint_level > 0, correct=false)
 *   1: 오답 + 전혀 모름 (NO_RECALL)
 *   0: 완전 망각 (NO_RECALL + hint_level ≥ 2)
 */

export interface CardState {
  user_id: string;
  card_id: string;
  due_ts: Date;
  interval_days: number;
  ease_factor: number;
  repetitions: number;
  stability: number;
  state: 'new' | 'learning' | 'review' | 'relearning';
  last_reviewed_at: Date | null;
}

export interface ReviewInput {
  correct: boolean;
  rt_ms: number;
  hint_level: number;
  error_type: string;
}

export interface ScheduleResult {
  due_ts: Date;
  interval_days: number;
  ease_factor: number;
  repetitions: number;
  state: CardState['state'];
  quality: number;
}

// SM-2 상수
const EF_MIN = 1.3;
const EF_MAX = 4.0;
const EF_DEFAULT = 2.5;

// 반응시간 기준 (밀리초)
const RT_FAST_MS = 2000;   // 2초 미만 = 빠름
const RT_SLOW_MS = 8000;   // 8초 초과 = 느림

/**
 * ReviewEvent 데이터를 SM-2 품질 점수(0~5)로 변환
 */
export function deriveQuality(input: ReviewInput): number {
  const { correct, rt_ms, hint_level, error_type } = input;

  if (!correct) {
    if (error_type === 'NO_RECALL' && hint_level >= 2) return 0;
    if (error_type === 'NO_RECALL') return 1;
    return 2;
  }

  // 정답 케이스
  if (hint_level >= 2) return 3;
  if (hint_level === 1) return 3;
  if (rt_ms > RT_SLOW_MS) return 3;
  if (rt_ms <= RT_FAST_MS) return 5;
  return 4;
}

/**
 * SM-2 EF 업데이트
 * EF = EF + (0.1 - (5-q) * (0.08 + (5-q) * 0.02))
 */
function updateEaseFactor(ef: number, quality: number): number {
  const delta = 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02);
  return Math.min(EF_MAX, Math.max(EF_MIN, ef + delta));
}

/**
 * 카드 상태에 복습 결과를 적용하고 다음 스케줄을 계산한다.
 *
 * @param current 현재 카드 상태 (없으면 신규 카드 기본값 사용)
 * @param input   복습 입력 데이터
 * @param now     현재 시각 (기본: new Date())
 */
export function scheduleNext(
  current: Partial<CardState> | null,
  input: ReviewInput,
  now: Date = new Date()
): ScheduleResult {
  const quality = deriveQuality(input);
  const prevRep = current?.repetitions ?? 0;
  const prevEF = current?.ease_factor ?? EF_DEFAULT;
  const prevInterval = current?.interval_days ?? 0;

  let newInterval: number;
  let newRepetitions: number;
  let newState: CardState['state'];
  let newEF: number;

  if (quality < 3) {
    // 오답: relearning 상태로 전환, 간격 초기화
    newInterval = 1;
    newRepetitions = 0;
    newEF = updateEaseFactor(prevEF, quality);
    newState = 'relearning';
  } else {
    // 정답: SM-2 간격 계산
    newEF = updateEaseFactor(prevEF, quality);

    if (prevRep === 0) {
      newInterval = 1;
      newRepetitions = 1;
      newState = 'learning';
    } else if (prevRep === 1) {
      newInterval = 6;
      newRepetitions = 2;
      newState = 'learning';
    } else {
      newInterval = Math.round(prevInterval * newEF);
      newRepetitions = prevRep + 1;
      newState = 'review';
    }
  }

  // due_ts = now + interval_days
  const dueTs = new Date(now.getTime() + newInterval * 24 * 60 * 60 * 1000);

  return {
    due_ts: dueTs,
    interval_days: newInterval,
    ease_factor: newEF,
    repetitions: newRepetitions,
    state: newState,
    quality,
  };
}

/**
 * 신규 카드의 기본 card_state 값 생성
 */
export function createInitialCardState(
  userId: string,
  cardId: string
): Omit<CardState, 'last_reviewed_at'> & { last_reviewed_at: null } {
  return {
    user_id: userId,
    card_id: cardId,
    due_ts: new Date(),
    interval_days: 0,
    ease_factor: EF_DEFAULT,
    repetitions: 0,
    stability: 0,
    state: 'new',
    last_reviewed_at: null,
  };
}
