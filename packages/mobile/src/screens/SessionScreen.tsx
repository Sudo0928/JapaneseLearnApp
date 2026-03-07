/**
 * 학습 세션 화면
 *
 * rules/report.mdc 반영:
 * - 정답은 제출 전까지 노출하지 않는다.
 * - plan.ui_policy를 세션 힌트/휴식 정책에 직접 연결한다.
 * - 준비된 prompt만 세션에 투입한다.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Speech from 'expo-speech';
import {
  clampHintSteps,
  filterLiveSessionCards,
  getClozeSentence,
  getListeningPromptText,
  getMcqChoices,
  getReservedExamplePolicyNote,
  sessionCardLimit as getSessionCardLimit,
  shouldPauseForChunk,
} from '@japanese-learn/shared';
import { logReviewEvent } from '../services/event-logger';
import { markAsSynced } from '../db/local-queue';
import { CardWithItem, fetchTodayCards, submitReview } from '../services/today-api';

type SessionPhase = 'loading' | 'prompt' | 'feedback' | 'break' | 'complete';

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

type SessionCard = CardWithItem & { isDrill?: boolean };

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function stableShuffle(values: string[], seed: string): string[] {
  const hash = (input: string) => {
    let result = 0;
    for (let i = 0; i < input.length; i += 1) {
      result = (result * 31 + input.charCodeAt(i)) >>> 0;
    }
    return result;
  };

  return [...values].sort((a, b) => hash(`${seed}:${a}`) - hash(`${seed}:${b}`));
}

function maskSurfaceInSentence(sentence: string, surface: string): string {
  if (!hasText(sentence) || !hasText(surface)) return sentence;
  if (!sentence.includes(surface)) return `${sentence}\n\n빈칸 답: ____`;
  return sentence.replace(surface, '____');
}

export default function SessionScreen({ userId, onSessionEnd }: SessionScreenProps) {
  const [phase, setPhase] = useState<SessionPhase>('loading');
  const [queue, setQueue] = useState<SessionCard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [hintLevel, setHintLevel] = useState(0);
  const [feedback, setFeedback] = useState<FeedbackData | null>(null);
  const [attemptCount, setAttemptCount] = useState(1);
  const [maxHintSteps, setMaxHintSteps] = useState(2);
  const [sessionChunkMin, setSessionChunkMin] = useState(20);
  const [chunkCardLimit, setChunkCardLimit] = useState(Number.POSITIVE_INFINITY);
  const [miniHandwriting, setMiniHandwriting] = useState(false);
  const [planNotes, setPlanNotes] = useState<string[]>([]);
  const [reservedExampleNote, setReservedExampleNote] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const cardShownAt = useRef<number>(Date.now());

  const currentCard = queue[currentIndex];
  const mcqChoices = currentCard?.prompt_type === 'MCQ'
    ? stableShuffle(getMcqChoices(currentCard), currentCard.card_id)
    : [];

  useEffect(() => {
    void loadSession();

    return () => {
      void Speech.stop();
    };
  }, []);

  useEffect(() => {
    setAnswer('');
    setSelectedChoice(null);
    setHintLevel(0);
    setAttemptCount(1);
    setFeedback(null);
    setIsSpeaking(false);
    cardShownAt.current = Date.now();
    void Speech.stop();
  }, [currentCard?.card_id]);

  async function loadSession() {
    setPhase('loading');
    try {
      const data = await fetchTodayCards(userId);
      const nextSessionChunkMin = data.uiPolicy?.session_chunk_min ?? 20;
      const nextChunkCardLimit = getSessionCardLimit(nextSessionChunkMin);

      setMaxHintSteps(clampHintSteps(data.uiPolicy?.hint_steps));
      setSessionChunkMin(nextSessionChunkMin);
      setChunkCardLimit(nextChunkCardLimit);
      setMiniHandwriting(Boolean(data.uiPolicy?.mini_handwriting));
      setPlanNotes(data.plan?.notes ?? []);
      setReservedExampleNote(getReservedExamplePolicyNote(data.uiPolicy));

      const regular = filterLiveSessionCards<SessionCard>([
        ...data.reviewCards,
        ...data.newCards,
      ]);
      const drills = filterLiveSessionCards<SessionCard>(
        (data.confusionDrills ?? []).map((card) => ({ ...card, isDrill: true }))
      );

      const combined: SessionCard[] = [];
      const step = drills.length > 0 ? Math.ceil(regular.length / drills.length) : Number.POSITIVE_INFINITY;
      let drillIdx = 0;

      for (let i = 0; i < regular.length; i += 1) {
        combined.push(regular[i]);
        if (drills[drillIdx] && (i + 1) % step === 0) {
          combined.push(drills[drillIdx]);
          drillIdx += 1;
        }
      }

      while (drillIdx < drills.length) {
        combined.push(drills[drillIdx]);
        drillIdx += 1;
      }

      if (combined.length === 0) {
        setQueue([]);
        setCurrentIndex(0);
        setPhase('complete');
        return;
      }

      setQueue(combined);
      setCurrentIndex(0);
      setPhase('prompt');
      cardShownAt.current = Date.now();
    } catch {
      Alert.alert('오류', '오늘 할 일을 불러오지 못했습니다. 네트워크를 확인해 주세요.');
      setPhase('complete');
    }
  }

  function getResponseValue(): string {
    return currentCard?.prompt_type === 'MCQ' ? selectedChoice ?? '' : answer;
  }

  function judgeAnswer(userInput: string, card: SessionCard): boolean {
    const normalize = (value: string) => value.trim().replace(/\s/g, '').toLowerCase();
    const normalizeStrictSurface = (value: string) => value.trim();
    const input = normalize(userInput);

    switch (card.prompt_type) {
      case 'SURFACE_TO_MEANING':
        return input === normalize(card.meaning_ko ?? '');
      case 'SURFACE_TO_READING':
        return input === normalize(card.reading ?? '');
      case 'MEANING_TO_SURFACE':
        return miniHandwriting
          ? normalizeStrictSurface(userInput) === normalizeStrictSurface(card.surface)
          : input === normalize(card.surface);
      case 'MCQ':
        return userInput === card.surface;
      case 'CLOZE':
      case 'LISTENING':
        return miniHandwriting
          ? normalizeStrictSurface(userInput) === normalizeStrictSurface(card.surface)
          : input === normalize(card.surface);
      default:
        return false;
    }
  }

  function getCorrectAnswer(card: SessionCard): string {
    switch (card.prompt_type) {
      case 'SURFACE_TO_MEANING':
        return card.meaning_ko ?? '';
      case 'SURFACE_TO_READING':
        return card.reading ?? '';
      default:
        return card.surface;
    }
  }

  function getPromptLabel(card: SessionCard): string {
    switch (card.prompt_type) {
      case 'SURFACE_TO_MEANING':
        return '뜻을 한국어로 입력하세요.';
      case 'SURFACE_TO_READING':
        return '읽기를 히라가나로 입력하세요.';
      case 'MEANING_TO_SURFACE':
        return miniHandwriting
          ? '정확한 일본어 표기를 그대로 입력하세요.'
          : '일본어 표기를 입력하세요.';
      case 'MCQ':
        return '뜻에 맞는 일본어 단어를 선택하세요.';
      case 'CLOZE':
        return '문맥에 맞는 단어를 입력하세요.';
      case 'LISTENING':
        return '오디오를 듣고 일본어 단어를 입력하세요.';
      default:
        return '답을 입력하세요.';
    }
  }

  function getCardDisplayText(card: SessionCard): string {
    switch (card.prompt_type) {
      case 'SURFACE_TO_MEANING':
      case 'SURFACE_TO_READING':
        return card.surface;
      case 'MEANING_TO_SURFACE':
      case 'MCQ':
        return card.meaning_ko ?? card.surface;
      case 'CLOZE':
        return maskSurfaceInSentence(getClozeSentence(card) ?? card.surface, card.surface);
      case 'LISTENING':
        return '🔊 오디오를 먼저 재생하세요';
      default:
        return card.surface;
    }
  }

  function getHintText(card: SessionCard, level: number): string | null {
    if (level === 0) return null;

    switch (card.prompt_type) {
      case 'SURFACE_TO_MEANING': {
        const reading = card.reading ?? '';
        if (level === 1) return hasText(reading) ? `힌트: ${reading[0]}...` : null;
        return hasText(reading) ? `힌트: ${reading}` : null;
      }
      case 'SURFACE_TO_READING':
      case 'MCQ': {
        const reading = card.reading ?? '';
        if (level === 1) return hasText(reading) ? `힌트: ${reading[0]}...` : null;
        return hasText(reading) ? `힌트: ${reading}` : null;
      }
      case 'MEANING_TO_SURFACE':
      case 'CLOZE':
      case 'LISTENING': {
        if (level === 1) return hasText(card.surface) ? `힌트: ${card.surface[0]}...` : null;
        return hasText(card.reading) ? `힌트: ${card.reading}` : `힌트: ${card.surface}`;
      }
      default:
        return null;
    }
  }

  const handleReplayAudio = useCallback(async () => {
    if (!currentCard || currentCard.prompt_type !== 'LISTENING') return;

    try {
      setIsSpeaking(true);
      await Speech.stop();
      Speech.speak(getListeningPromptText(currentCard), {
        language: 'ja-JP',
        rate: 0.85,
        onDone: () => setIsSpeaking(false),
        onStopped: () => setIsSpeaking(false),
        onError: () => setIsSpeaking(false),
      });
    } catch {
      setIsSpeaking(false);
      Alert.alert('오류', '오디오를 재생하지 못했습니다.');
    }
  }, [currentCard]);

  const handleSubmit = useCallback(async () => {
    if (!currentCard) return;

    const responseValue = getResponseValue();
    if (!responseValue.trim()) return;

    const rt_ms = Math.min(Date.now() - cardShownAt.current, 300000);
    const correct = judgeAnswer(responseValue, currentCard);
    const correctAnswer = getCorrectAnswer(currentCard);

    let errorType: string = 'NONE';
    if (!correct) {
      if (responseValue.trim() === '') errorType = 'NO_RECALL';
      else if (currentCard.prompt_type === 'SURFACE_TO_READING' || currentCard.prompt_type === 'LISTENING') {
        errorType = 'READING_CONFUSION';
      } else if (currentCard.prompt_type === 'SURFACE_TO_MEANING' || currentCard.prompt_type === 'MCQ') {
        errorType = 'MEANING_NEAR';
      } else {
        errorType = 'FORM_SIMILAR';
      }
    }

    const deviceOS = Platform.OS === 'ios'
      ? 'IOS' as const
      : Platform.OS === 'android'
      ? 'ANDROID' as const
      : 'WEB' as const;

    const event = {
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

    const loggedEvent = await logReviewEvent(event);

    let nextDue: string | undefined;
    try {
      const result = await submitReview(loggedEvent);
      nextDue = result.nextDue;
      await markAsSynced([loggedEvent.event_id]);
    } catch (err) {
      console.error('[SessionScreen] submitReview failed (kept in local queue):', err);
    }

    setFeedback({
      correct,
      correctAnswer,
      userAnswer: responseValue,
      hintLevel,
      nextDue,
    });
    setPhase('feedback');
  }, [answer, attemptCount, currentCard, hintLevel, miniHandwriting, selectedChoice]);

  const handleNext = useCallback(() => {
    const nextIndex = currentIndex + 1;
    void Speech.stop();
    setIsSpeaking(false);

    if (nextIndex >= queue.length) {
      setPhase('complete');
      return;
    }

    setCurrentIndex(nextIndex);

    if (shouldPauseForChunk(nextIndex, queue.length, chunkCardLimit)) {
      setPhase('break');
      return;
    }

    setPhase('prompt');
  }, [chunkCardLimit, currentIndex, queue.length]);

  const handleResumeAfterBreak = useCallback(() => {
    setPhase('prompt');
    cardShownAt.current = Date.now();
  }, []);

  const handleHint = useCallback(() => {
    if (maxHintSteps <= 0) return;
    setHintLevel((prev) => Math.min(prev + 1, maxHintSteps));
    setAttemptCount((prev) => prev + 1);
  }, [maxHintSteps]);

  if (phase === 'loading') {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color="#4A6CF7" />
        <Text style={styles.loadingText}>오늘 할 일을 불러오는 중...</Text>
      </SafeAreaView>
    );
  }

  if (phase === 'complete') {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.completeEmoji}>🎉</Text>
        <Text style={styles.completeTitle}>오늘 복습 완료!</Text>
        <Text style={styles.completeSubtitle}>
          총 {queue.length}문항을 학습했습니다.{'\n'}내일도 이어서 복습해 보세요.
        </Text>
        <TouchableOpacity style={styles.btn} onPress={loadSession}>
          <Text style={styles.btnText}>한 번 더</Text>
        </TouchableOpacity>
        {onSessionEnd && (
          <TouchableOpacity style={[styles.btn, styles.secondaryBtn]} onPress={onSessionEnd}>
            <Text style={styles.btnText}>홈으로 돌아가기</Text>
          </TouchableOpacity>
        )}
      </SafeAreaView>
    );
  }

  if (phase === 'break') {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.completeEmoji}>⏸</Text>
        <Text style={styles.completeTitle}>잠시 쉬고 이어서 진행하세요</Text>
        <Text style={styles.completeSubtitle}>
          {currentIndex}문항까지 완료했습니다.{'\n'}
          집중력 보호를 위해 세션을 {sessionChunkMin}분 기준으로 나눴습니다.
        </Text>
        <TouchableOpacity style={styles.btn} onPress={handleResumeAfterBreak}>
          <Text style={styles.btnText}>계속 학습하기</Text>
        </TouchableOpacity>
        {onSessionEnd && (
          <TouchableOpacity style={[styles.btn, styles.secondaryBtn]} onPress={onSessionEnd}>
            <Text style={styles.btnText}>홈으로 돌아가기</Text>
          </TouchableOpacity>
        )}
      </SafeAreaView>
    );
  }

  if (!currentCard) return null;

  const hintText = getHintText(currentCard, hintLevel);
  const progress = `${currentIndex + 1} / ${queue.length}`;
  const promptLabel = getPromptLabel(currentCard);
  const responseValue = getResponseValue();
  const showSubmitDisabled = currentCard.prompt_type === 'MCQ' ? !selectedChoice : !answer.trim();
  const clozeTranslation = currentCard.prompt_type === 'CLOZE' ? currentCard.example_sentence_ko : null;

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
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

          {(planNotes.length > 0 || sessionChunkMin <= 5 || miniHandwriting || reservedExampleNote) && (
            <View style={styles.policyBox}>
              {planNotes.slice(0, 2).map((note, idx) => (
                <Text key={`${idx}-${note}`} style={styles.policyText}>{note}</Text>
              ))}
              {sessionChunkMin <= 5 && (
                <Text style={styles.policyText}>인지부하 보호를 위해 짧은 세션 모드가 적용됐습니다.</Text>
              )}
              {miniHandwriting && (
                <Text style={styles.policyText}>형태 정확도를 위해 표기 입력을 더 엄격하게 채점합니다.</Text>
              )}
              {reservedExampleNote && (
                <Text style={styles.policyText}>{reservedExampleNote}</Text>
              )}
            </View>
          )}

          <View style={[styles.card, currentCard.isDrill && styles.drillCard]}>
            <Text style={[styles.stateLabel, currentCard.isDrill && styles.drillLabel]}>
              {currentCard.isDrill ? '혼동 드릴' : currentCard.state === 'new' ? '신규' : '복습'}
            </Text>

            {currentCard.prompt_type === 'LISTENING' ? (
              <View style={styles.audioPromptBox}>
                <Text style={styles.audioEmoji}>🔊</Text>
                <Text style={styles.audioPromptTitle}>오디오를 듣고 답을 입력하세요</Text>
                <TouchableOpacity
                  style={[styles.audioBtn, isSpeaking && styles.audioBtnBusy]}
                  onPress={handleReplayAudio}
                  accessibilityRole="button"
                  accessibilityLabel="일본어 오디오 재생"
                >
                  <Text style={styles.audioBtnText}>{isSpeaking ? '재생 중...' : '오디오 재생'}</Text>
                </TouchableOpacity>
                {hasText(currentCard.audio_ref) && (
                  <Text style={styles.audioCaption}>source: {currentCard.audio_ref}</Text>
                )}
              </View>
            ) : (
              <Text
                style={[
                  styles.surface,
                  currentCard.prompt_type === 'CLOZE' && styles.contextSurface,
                  currentCard.prompt_type === 'MCQ' && styles.meaningSurface,
                ]}
                accessibilityLanguage="ja"
                accessibilityLabel={getCardDisplayText(currentCard)}
              >
                {getCardDisplayText(currentCard)}
              </Text>
            )}

            {hintText && (
              <Text style={styles.hint} accessibilityLiveRegion="polite">
                {hintText}
              </Text>
            )}
            {clozeTranslation && phase !== 'feedback' && (
              <Text style={styles.contextNote}>문맥 번역은 정답 확인 후에만 노출됩니다.</Text>
            )}
          </View>

          {phase === 'feedback' && feedback ? (
            <View style={styles.feedbackBox} accessible accessibilityLiveRegion="assertive">
              <Text
                style={[styles.feedbackResult, feedback.correct ? styles.correct : styles.incorrect]}
                accessibilityLabel={feedback.correct ? '정답입니다.' : '오답입니다.'}
              >
                {feedback.correct ? '정답' : '오답'}
              </Text>
              {!feedback.correct && (
                <Text style={styles.feedbackAnswer}>
                  정답: <Text style={styles.answerHighlight}>{feedback.correctAnswer}</Text>
                </Text>
              )}
              {currentCard.prompt_type === 'CLOZE' && hasText(currentCard.example_sentence_ko) && (
                <Text style={styles.contextAnswer}>문맥 번역: {currentCard.example_sentence_ko}</Text>
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
                <Text style={styles.btnText}>다음 문제</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View>
              <Text style={styles.promptLabel}>{promptLabel}</Text>

              {currentCard.prompt_type === 'MCQ' ? (
                <View style={styles.choiceList}>
                  {mcqChoices.map((choice) => {
                    const selected = selectedChoice === choice;
                    return (
                      <TouchableOpacity
                        key={`${currentCard.card_id}-${choice}`}
                        style={[styles.choiceButton, selected && styles.choiceButtonSelected]}
                        onPress={() => setSelectedChoice(choice)}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        accessibilityLabel={`선택지 ${choice}`}
                      >
                        <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>{choice}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : (
                <TextInput
                  style={styles.input}
                  value={answer}
                  onChangeText={setAnswer}
                  placeholder={
                    currentCard.prompt_type === 'LISTENING'
                      ? '들은 단어를 입력...'
                      : miniHandwriting && (currentCard.prompt_type === 'MEANING_TO_SURFACE' || currentCard.prompt_type === 'CLOZE')
                      ? '정확한 표기를 입력...'
                      : '답을 입력...'
                  }
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="done"
                  onSubmitEditing={handleSubmit}
                  accessibilityLabel={promptLabel}
                  accessibilityHint="답을 입력하고 제출 버튼을 누르세요"
                />
              )}

              <TouchableOpacity
                style={[styles.btn, showSubmitDisabled && styles.btnDisabled]}
                onPress={handleSubmit}
                disabled={showSubmitDisabled}
                accessible
                accessibilityRole="button"
                accessibilityLabel="답안 제출"
                accessibilityState={{ disabled: showSubmitDisabled }}
              >
                <Text style={styles.btnText}>제출</Text>
              </TouchableOpacity>

              {currentCard.prompt_type === 'LISTENING' && (
                <TouchableOpacity
                  style={styles.secondaryAction}
                  onPress={handleReplayAudio}
                  accessibilityRole="button"
                  accessibilityLabel="오디오 다시 듣기"
                >
                  <Text style={styles.secondaryActionText}>{isSpeaking ? '재생 중...' : '다시 듣기'}</Text>
                </TouchableOpacity>
              )}

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

              {currentCard.prompt_type === 'MCQ' && hasText(responseValue) && (
                <Text style={styles.choiceCaption}>선택한 답: {responseValue}</Text>
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
    height: 4,
    backgroundColor: '#E5E5E5',
    borderRadius: 2,
    marginBottom: 32,
  },
  progressFill: {
    height: 4,
    backgroundColor: '#4A6CF7',
    borderRadius: 2,
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
  surface: {
    fontSize: 52,
    fontWeight: 'bold',
    color: '#1A1A2E',
    textAlign: 'center',
  },
  contextSurface: {
    fontSize: 30,
    lineHeight: 42,
  },
  meaningSurface: {
    fontSize: 36,
    lineHeight: 44,
  },
  contextNote: {
    marginTop: 12,
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
  },
  audioPromptBox: {
    width: '100%',
    alignItems: 'center',
    gap: 12,
  },
  audioEmoji: {
    fontSize: 48,
  },
  audioPromptTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A2E',
    textAlign: 'center',
  },
  audioBtn: {
    backgroundColor: '#1D4ED8',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 999,
  },
  audioBtnBusy: {
    backgroundColor: '#60A5FA',
  },
  audioBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  audioCaption: {
    fontSize: 11,
    color: '#94A3B8',
  },
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
  secondaryBtn: {
    backgroundColor: '#1A1A2E',
    marginTop: 0,
  },
  btnDisabled: { backgroundColor: '#C5CCE8' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  hintBtn: {
    paddingVertical: 10,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hintBtnText: { color: '#F59E0B', fontSize: 14 },
  feedbackBox: { gap: 12 },
  feedbackResult: { fontSize: 22, fontWeight: 'bold', textAlign: 'center', marginBottom: 4 },
  correct: { color: '#059669' },
  incorrect: { color: '#EF4444' },
  feedbackAnswer: { fontSize: 16, color: '#333', textAlign: 'center' },
  contextAnswer: { fontSize: 13, color: '#475569', textAlign: 'center' },
  answerHighlight: { fontWeight: 'bold', color: '#1A1A2E' },
  nextDue: { fontSize: 13, color: '#888', textAlign: 'center' },
  loadingText: { marginTop: 16, color: '#888' },
  completeEmoji: { fontSize: 56, marginBottom: 16 },
  completeTitle: { fontSize: 24, fontWeight: 'bold', color: '#1A1A2E', marginBottom: 8 },
  completeSubtitle: { fontSize: 15, color: '#666', textAlign: 'center', marginBottom: 32, lineHeight: 22 },
  choiceList: {
    gap: 10,
    marginBottom: 16,
  },
  choiceButton: {
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
  },
  choiceButtonSelected: {
    borderColor: '#4A6CF7',
    backgroundColor: '#EEF2FF',
  },
  choiceText: {
    fontSize: 18,
    color: '#1E293B',
    textAlign: 'center',
    fontWeight: '600',
  },
  choiceTextSelected: {
    color: '#1D4ED8',
  },
  secondaryAction: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    marginBottom: 4,
  },
  secondaryActionText: {
    color: '#1D4ED8',
    fontSize: 14,
    fontWeight: '600',
  },
  choiceCaption: {
    marginTop: 8,
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
  },
});
