/**
 * 학습 세션 화면 (Sprint 2)
 *
 * 설계 원칙 (rules/report.mdc):
 * - 인출 연습 우선: 정답을 먼저 보여주지 않는다.
 * - 인출 시도 → 제출 → 피드백 순서로 고정한다.
 * - 힌트는 단계별 공개 (최대 2단계, 정답 공개는 hint_level=3으로 별도 기록).
 * - 반응시간(rt_ms)은 카드 표시 시점부터 제출까지 측정한다.
 *
 * 문항 유형별 표시:
 * - SURFACE_TO_MEANING: 표기(한자) 표시 → 뜻 입력
 * - SURFACE_TO_READING: 표기(한자) 표시 → 읽기(히라가나) 입력
 * - MEANING_TO_SURFACE: 뜻 표시 → 표기 입력
 * - MCQ: 선택지 제공 (인지형)
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { logReviewEvent } from '../services/event-logger';
import { markAsSynced } from '../db/local-queue';
import { fetchTodayCards, submitReview, CardWithItem } from '../services/today-api';

type SessionPhase = 'loading' | 'prompt' | 'feedback' | 'complete';

interface FeedbackData {
  correct: boolean;
  correctAnswer: string;
  userAnswer: string;
  hintLevel: number;
  nextDue?: string;
}

interface SessionScreenProps {
  userId: string;
  onSessionEnd?: () => void;
}

export default function SessionScreen({ userId, onSessionEnd }: SessionScreenProps) {
  const [phase, setPhase] = useState<SessionPhase>('loading');
  const [queue, setQueue] = useState<CardWithItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [hintLevel, setHintLevel] = useState(0);
  const [feedback, setFeedback] = useState<FeedbackData | null>(null);
  const [attemptCount, setAttemptCount] = useState(1);
  const [maxHintSteps, setMaxHintSteps] = useState(2);
  const [sessionChunkMin, setSessionChunkMin] = useState(20);
  const [miniHandwriting, setMiniHandwriting] = useState(false);
  const [planNotes, setPlanNotes] = useState<string[]>([]);

  // 반응시간 측정 (카드 표시 시점 기록)
  const cardShownAt = useRef<number>(Date.now());

  useEffect(() => {
    loadSession();
  }, []);

  async function loadSession() {
    setPhase('loading');
    try {
      const data = await fetchTodayCards(userId);
      setMaxHintSteps(Math.max(0, Math.min(3, data.uiPolicy?.hint_steps ?? 2)));
      setSessionChunkMin(data.uiPolicy?.session_chunk_min ?? 20);
      setMiniHandwriting(Boolean(data.uiPolicy?.mini_handwriting));
      setPlanNotes(data.plan?.notes ?? []);
      // P1-3: 혼동 드릴은 복습 카드 사이에 균등 배분 (첫 카드부터 너무 몰리지 않도록)
      const regular = [...data.reviewCards, ...data.newCards];
      const drills  = (data.confusionDrills ?? []).map((c) => ({ ...c, isDrill: true }));

      // 드릴을 regular 사이에 균등 삽입 (약 3장마다 1개 드릴)
      const combined: CardWithItem[] = [];
      const step = drills.length > 0 ? Math.ceil(regular.length / drills.length) : Infinity;
      let drillIdx = 0;
      for (let i = 0; i < regular.length; i++) {
        combined.push(regular[i]);
        if (drills[drillIdx] && (i + 1) % step === 0) {
          combined.push(drills[drillIdx++]);
        }
      }
      // 남은 드릴 후미에 추가
      while (drillIdx < drills.length) combined.push(drills[drillIdx++]);

      const chunkCardLimit = sessionCardLimit(data.uiPolicy?.session_chunk_min ?? 20);
      const chunked = combined.slice(0, chunkCardLimit);

      if (chunked.length === 0) {
        setPhase('complete');
        return;
      }
      setQueue(chunked);
      setCurrentIndex(0);
      setPhase('prompt');
      cardShownAt.current = Date.now();
    } catch {
      Alert.alert('오류', '오늘 할 일을 불러오지 못했습니다. 네트워크를 확인해주세요.');
      setPhase('complete');
    }
  }

  const currentCard = queue[currentIndex];

  // 정답 판정 (히라가나/가타카나 정규화 포함)
  function judgeAnswer(userInput: string, card: CardWithItem): boolean {
    const normalize = (s: string) => s.trim().replace(/\s/g, '').toLowerCase();
    const input = normalize(userInput);

    switch (card.prompt_type) {
      case 'SURFACE_TO_MEANING':
        return input === normalize(card.meaning_ko ?? '');
      case 'SURFACE_TO_READING':
        return input === normalize(card.reading ?? '');
      case 'MEANING_TO_SURFACE':
        return input === normalize(card.surface);
      default:
        return false;
    }
  }

  function getCorrectAnswer(card: CardWithItem): string {
    switch (card.prompt_type) {
      case 'SURFACE_TO_MEANING': return card.meaning_ko ?? '';
      case 'SURFACE_TO_READING': return card.reading ?? '';
      case 'MEANING_TO_SURFACE': return card.surface;
      default: return '';
    }
  }

  function getPromptLabel(promptType: string): string {
    switch (promptType) {
      case 'SURFACE_TO_MEANING': return '뜻을 한국어로 입력하세요';
      case 'SURFACE_TO_READING': return '읽기를 히라가나로 입력하세요';
      case 'MEANING_TO_SURFACE': return '한자(표기)를 입력하세요';
      default: return '답을 입력하세요';
    }
  }

  function getDisplayText(card: CardWithItem): string {
    switch (card.prompt_type) {
      case 'SURFACE_TO_MEANING':
      case 'SURFACE_TO_READING':
        return card.surface;
      case 'MEANING_TO_SURFACE':
        return card.meaning_ko ?? card.surface;
      default:
        return card.surface;
    }
  }

  function getHintText(card: CardWithItem, level: number): string | null {
    if (level === 0) return null;
    if (level === 1) {
      // 첫 번째 힌트: 읽기의 첫 글자만 공개
      const reading = card.reading ?? '';
      return reading.length > 0 ? `힌트: ${reading[0]}...` : null;
    }
    if (level >= 2) {
      // 두 번째 힌트: 읽기 전체 공개
      return `힌트: ${card.reading ?? ''}`;
    }
    return null;
  }

  const handleSubmit = useCallback(async () => {
    if (!currentCard || !answer.trim()) return;

    const rt_ms = Math.min(Date.now() - cardShownAt.current, 300000);
    const correct = judgeAnswer(answer, currentCard);
    const correctAnswer = getCorrectAnswer(currentCard);

    // 오류 유형 추정
    let errorType: string = 'NONE';
    if (!correct) {
      if (answer.trim() === '') errorType = 'NO_RECALL';
      else if (currentCard.prompt_type === 'SURFACE_TO_READING') errorType = 'READING_CONFUSION';
      else if (currentCard.prompt_type === 'SURFACE_TO_MEANING') errorType = 'MEANING_NEAR';
      else errorType = 'FORM_SIMILAR';
    }

    const deviceOS = Platform.OS === 'ios' ? 'IOS' as const
      : Platform.OS === 'android' ? 'ANDROID' as const
      : 'WEB' as const;

    const event = {
      user_id: userId,
      card_id: currentCard.card_id,
      item_id: currentCard.item_id,
      prompt_type: currentCard.prompt_type as any,
      correct,
      rt_ms,
      attempt_count: attemptCount,
      hint_level: hintLevel,
      error_type: errorType as any,
      device: deviceOS,
      offline: false,
    };

    // 로컬 큐에 저장 (event_id가 여기서 확정됨)
    const loggedEvent = await logReviewEvent(event);

    // 온라인 즉시 스케줄 갱신 시도 — 동일 event_id 사용 (P0-1 단일성 보장)
    let nextDue: string | undefined;
    try {
      const result = await submitReview(loggedEvent);
      nextDue = result.nextDue;
      // 즉시 제출 성공 → 로컬 큐에서 synced 처리 (다음 syncPendingEvents에서 중복 전송 방지)
      await markAsSynced([loggedEvent.event_id]);
    } catch (err) {
      // 오프라인이거나 일시적 오류 — 로컬 큐에 남아서 다음 동기화 시 재전송
      console.error('[SessionScreen] submitReview 실패 (로컬 큐에 저장됨):', err);
    }

    setFeedback({ correct, correctAnswer, userAnswer: answer, hintLevel, nextDue });
    setPhase('feedback');
  }, [currentCard, answer, hintLevel, attemptCount]);

  const handleNext = useCallback(() => {
    const nextIndex = currentIndex + 1;
    if (nextIndex >= queue.length) {
      setPhase('complete');
      return;
    }
    setCurrentIndex(nextIndex);
    setAnswer('');
    setHintLevel(0);
    setAttemptCount(1);
    setFeedback(null);
    setPhase('prompt');
    cardShownAt.current = Date.now();
  }, [currentIndex, queue.length]);

  const handleHint = useCallback(() => {
    setHintLevel((prev) => Math.min(prev + 1, 2));
    setAttemptCount((prev) => prev + 1);
  }, []);

  // ─── 렌더링 ────────────────────────────────────────────────

  if (phase === 'loading') {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color="#4A6CF7" />
        <Text style={styles.loadingText}>오늘 할 일 불러오는 중...</Text>
      </SafeAreaView>
    );
  }

  if (phase === 'complete') {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.completeEmoji}>🎉</Text>
        <Text style={styles.completeTitle}>오늘 복습 완료!</Text>
        <Text style={styles.completeSubtitle}>
          총 {currentIndex}장을 학습했습니다.{'\n'}내일도 꾸준히 복습해 보세요.
        </Text>
        <TouchableOpacity style={styles.btn} onPress={loadSession}>
          <Text style={styles.btnText}>한 번 더</Text>
        </TouchableOpacity>
        {onSessionEnd && (
          <TouchableOpacity style={[styles.btn, { backgroundColor: '#1A1A2E', marginTop: 0 }]} onPress={onSessionEnd}>
            <Text style={styles.btnText}>홈으로 돌아가기</Text>
          </TouchableOpacity>
        )}
      </SafeAreaView>
    );
  }

  if (!currentCard) return null;

  const hintText = getHintText(currentCard, hintLevel);
  const progress = `${currentIndex + 1} / ${queue.length}`;

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          {/* 진행률 — accessibilityValue로 보조 기술에 진행 상태 전달 */}
          <Text
            style={styles.progress}
            accessibilityLabel={`${currentIndex + 1}번째 문항, 전체 ${queue.length}개`}
          >
            {progress}
          </Text>
          <View
            style={styles.progressBar}
            accessible
            accessibilityRole="progressbar"
            accessibilityValue={{ min: 0, max: queue.length, now: currentIndex + 1 }}
          >
            <View style={[styles.progressFill, { width: `${((currentIndex + 1) / queue.length) * 100}%` }]} />
          </View>

          {(planNotes.length > 0 || sessionChunkMin <= 5 || miniHandwriting) && (
            <View style={styles.policyBox}>
              {planNotes.slice(0, 2).map((note, idx) => (
                <Text key={`${idx}-${note}`} style={styles.policyText}>{note}</Text>
              ))}
              {sessionChunkMin <= 5 && (
                <Text style={styles.policyText}>집중도 보호를 위해 짧은 세션 모드가 적용되었습니다.</Text>
              )}
              {miniHandwriting && (
                <Text style={styles.policyText}>형태 회상 강화를 위해 표기 입력을 더 엄격하게 연습합니다.</Text>
              )}
            </View>
          )}

          {/* 카드 표시 영역 */}
          <View style={[styles.card, (currentCard as any).isDrill && styles.drillCard]}>
            <Text style={[styles.stateLabel, (currentCard as any).isDrill && styles.drillLabel]}>
              {(currentCard as any).isDrill ? '⚡ 혼동 드릴' : currentCard.state === 'new' ? '신규' : '복습'}
            </Text>
            {/* 일본어 텍스트: accessibilityLanguage + 읽기 힌트 */}
            <Text
              style={styles.surface}
              accessibilityLanguage="ja"
              accessibilityLabel={getDisplayText(currentCard)}
            >
              {getDisplayText(currentCard)}
            </Text>
            {hintText && (
              <Text style={styles.hint} accessibilityLiveRegion="polite">
                {hintText}
              </Text>
            )}
          </View>

          {/* 피드백 단계 */}
          {phase === 'feedback' && feedback ? (
            <View style={styles.feedbackBox} accessible accessibilityLiveRegion="assertive">
              <Text
                style={[styles.feedbackResult, feedback.correct ? styles.correct : styles.incorrect]}
                accessibilityLabel={feedback.correct ? '정답입니다' : '오답입니다'}
              >
                {feedback.correct ? '✓ 정답' : '✗ 오답'}
              </Text>
              {!feedback.correct && (
                <Text style={styles.feedbackAnswer}>
                  정답: <Text style={styles.answerHighlight}>{feedback.correctAnswer}</Text>
                </Text>
              )}
              {feedback.nextDue && (
                <Text style={styles.nextDue}>
                  다음 복습: {new Date(feedback.nextDue).toLocaleDateString('ko-KR')}
                </Text>
              )}
              <TouchableOpacity
                style={styles.btn}
                onPress={handleNext}
                accessible
                accessibilityRole="button"
                accessibilityLabel="다음 문항으로 이동"
              >
                <Text style={styles.btnText}>다음 →</Text>
              </TouchableOpacity>
            </View>
          ) : (
            /* 입력 단계 */
            <View>
              <Text style={styles.promptLabel}>{getPromptLabel(currentCard.prompt_type)}</Text>
              <TextInput
                style={styles.input}
                value={answer}
                onChangeText={setAnswer}
                placeholder="답 입력..."
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={handleSubmit}
                accessibilityLabel={getPromptLabel(currentCard.prompt_type)}
                accessibilityHint="답을 입력하고 제출 버튼을 누르세요"
              />
              <TouchableOpacity
                style={[styles.btn, !answer.trim() && styles.btnDisabled]}
                onPress={handleSubmit}
                disabled={!answer.trim()}
                accessible
                accessibilityRole="button"
                accessibilityLabel="답안 제출"
                accessibilityState={{ disabled: !answer.trim() }}
              >
                <Text style={styles.btnText}>제출</Text>
              </TouchableOpacity>
              {hintLevel < maxHintSteps && (
                <TouchableOpacity
                  style={styles.hintBtn}
                  onPress={handleHint}
                  accessible
                  accessibilityRole="button"
                  accessibilityLabel={`힌트 보기, ${hintLevel + 1}단계 중 ${maxHintSteps}단계`}
                  hitSlop={{ top: 8, bottom: 8, left: 16, right: 16 }}
                >
                  <Text style={styles.hintBtnText}>
                    힌트 보기 ({hintLevel + 1}/{maxHintSteps})
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  scroll: { padding: 24, paddingBottom: 48 },
  progress: { textAlign: 'right', color: '#888', fontSize: 13, marginBottom: 4 },
  progressBar: {
    height: 4, backgroundColor: '#E5E5E5', borderRadius: 2, marginBottom: 32,
  },
  progressFill: {
    height: 4, backgroundColor: '#4A6CF7', borderRadius: 2,
  },
  policyBox: {
    backgroundColor: '#EEF2FF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
    gap: 6,
  },
  policyText: {
    color: '#374151',
    fontSize: 12,
    lineHeight: 18,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    marginBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  drillCard: {
    borderLeftWidth: 3,
    borderLeftColor: '#F59E0B',
  },
  stateLabel: {
    fontSize: 12,
    color: '#aaa',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  drillLabel: {
    color: '#F59E0B',
    fontWeight: '600',
  },
  surface: { fontSize: 52, fontWeight: 'bold', color: '#1A1A2E', textAlign: 'center' },
  hint: { marginTop: 16, fontSize: 14, color: '#F59E0B', textAlign: 'center' },
  promptLabel: { fontSize: 15, color: '#555', marginBottom: 12 },
  input: {
    borderWidth: 1.5,
    borderColor: '#DDD',
    borderRadius: 12,
    padding: 14,
    fontSize: 18,
    marginBottom: 16,
    backgroundColor: '#fff',
    color: '#1A1A2E',
  },
  btn: {
    backgroundColor: '#4A6CF7',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  btnDisabled: { backgroundColor: '#C5CCE8' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  hintBtn: {
    paddingVertical: 10,
    minHeight: 44,   // WCAG 2.5.8 터치 타깃 최소 44pt
    alignItems: 'center',
    justifyContent: 'center',
  },
  hintBtnText: { color: '#F59E0B', fontSize: 14 },
  feedbackBox: { gap: 12 },
  feedbackResult: { fontSize: 22, fontWeight: 'bold', textAlign: 'center', marginBottom: 4 },
  correct: { color: '#059669' },   // WCAG 1.4.3: 대비비 4.6:1 (흰 배경)
  incorrect: { color: '#EF4444' },
  feedbackAnswer: { fontSize: 16, color: '#333', textAlign: 'center' },
  answerHighlight: { fontWeight: 'bold', color: '#1A1A2E' },
  nextDue: { fontSize: 13, color: '#888', textAlign: 'center' },
  loadingText: { marginTop: 16, color: '#888' },
  completeEmoji: { fontSize: 56, marginBottom: 16 },
  completeTitle: { fontSize: 24, fontWeight: 'bold', color: '#1A1A2E', marginBottom: 8 },
  completeSubtitle: { fontSize: 15, color: '#666', textAlign: 'center', marginBottom: 32, lineHeight: 22 },
});

function sessionCardLimit(sessionChunkMin: number): number {
  if (sessionChunkMin <= 5) return 5;
  if (sessionChunkMin <= 10) return 8;
  return 999;
}
