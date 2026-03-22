import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import NetInfo from '@react-native-community/netinfo';
import {
  clampHintSteps,
  filterLiveSessionCards,
  getClozeSentence,
  getListeningPromptText,
  getMcqChoices,
  getReservedExamplePolicyNote,
  sessionCardLimit as getSessionCardLimit,
  shouldPauseForChunk,
  type SupportedLocale,
} from '@japanese-learn/shared';
import { getSessionUiCopy, type SessionUiCopy } from '../i18n/session-ui';
import { translateKnownNarrative, translateMeaningValue } from '../i18n/diagnosis-plan';
import { markAsSynced } from '../db/local-queue';
import { useSettings } from '../providers/settings-provider';
import { logReviewEvent } from '../services/event-logger';
import { type CardWithItem, fetchTodayCards, submitReview } from '../services/today-api';
import type { ThemeColors } from '../theme';

type SessionPhase = 'loading' | 'prompt' | 'feedback' | 'break' | 'complete';

interface FeedbackData {
  correct: boolean;
  correctAnswer: string;
  userAnswer: string;
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
  if (!sentence.includes(surface)) return `${sentence}\n\n____`;
  return sentence.replace(surface, '____');
}

export default function SessionScreen({ userId, onSessionEnd }: SessionScreenProps) {
  const { colors, preferences } = useSettings();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const sessionCopy = useMemo(() => getSessionUiCopy(preferences.locale), [preferences.locale]);
  const [phase, setPhase] = useState<SessionPhase>('loading');
  const [queue, setQueue] = useState<SessionCard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [hintLevel, setHintLevel] = useState(0);
  const [attemptCount, setAttemptCount] = useState(1);
  const [feedback, setFeedback] = useState<FeedbackData | null>(null);
  const [maxHintSteps, setMaxHintSteps] = useState(2);
  const [sessionChunkMin, setSessionChunkMin] = useState(20);
  const [chunkCardLimit, setChunkCardLimit] = useState(Number.POSITIVE_INFINITY);
  const [miniHandwriting, setMiniHandwriting] = useState(false);
  const [planNotes, setPlanNotes] = useState<string[]>([]);
  const [reservedExampleNote, setReservedExampleNote] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const cardShownAt = useRef<number>(Date.now());
  const currentCard = queue[currentIndex];
  const promptLabel = currentCard ? getPromptLabel(currentCard, miniHandwriting, sessionCopy) : '';
  const responseValue = currentCard?.prompt_type === 'MCQ' ? selectedChoice ?? '' : answer;
  const mcqChoices = currentCard?.prompt_type === 'MCQ'
    ? stableShuffle(getMcqChoices(currentCard), currentCard.card_id)
    : [];
  const sentenceMeaningClue = currentCard
    ? getSentenceMeaningClue(currentCard, preferences.locale, sessionCopy.translationPrefix)
    : null;
  const translatedPlanNotes = useMemo(
    () => planNotes.map((note) => translateKnownNarrative(preferences.locale, note)),
    [planNotes, preferences.locale],
  );

  const loadSession = useCallback(async () => {
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
      setReservedExampleNote(getReservedExamplePolicyNote(data.uiPolicy, preferences.locale));

      const regular = filterLiveSessionCards<SessionCard>([
        ...data.reviewCards,
        ...data.newCards,
      ]);
      const drills = filterLiveSessionCards<SessionCard>(
        (data.confusionDrills ?? []).map((card) => ({ ...card, isDrill: true })),
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
      Alert.alert(sessionCopy.loadErrorTitle, sessionCopy.loadErrorBody);
      setPhase('complete');
    }
  }, [preferences.locale, sessionCopy.loadErrorBody, sessionCopy.loadErrorTitle, userId]);

  useEffect(() => {
    void loadSession();
    return () => {
      void Speech.stop();
    };
  }, [loadSession]);

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
      Alert.alert(sessionCopy.audioErrorTitle, sessionCopy.audioErrorBody);
    }
  }, [currentCard, sessionCopy.audioErrorBody, sessionCopy.audioErrorTitle]);

  const handleSubmit = useCallback(async () => {
    if (!currentCard || !responseValue.trim()) return;

    const rt_ms = Math.min(Date.now() - cardShownAt.current, 300_000);
    const correct = judgeAnswer(responseValue, currentCard, miniHandwriting, preferences.locale);
    const correctAnswer = getCorrectAnswer(currentCard, preferences.locale);
    const netInfo = await NetInfo.fetch();
    const networkState: 'offline' | 'wifi' | 'cellular' | 'unknown' = !netInfo.isConnected
      ? 'offline'
      : netInfo.type === 'wifi' || netInfo.type === 'ethernet'
      ? 'wifi'
      : netInfo.type === 'cellular'
      ? 'cellular'
      : 'unknown';

    const device = Platform.OS === 'ios'
      ? 'IOS'
      : Platform.OS === 'android'
      ? 'ANDROID'
      : 'WEB';

    const event = await logReviewEvent({
      card_id: currentCard.card_id,
      item_id: currentCard.item_id,
      prompt_type: currentCard.prompt_type as any,
      correct,
      rt_ms,
      attempt_count: attemptCount,
      hint_level: hintLevel,
      error_type: buildErrorType(currentCard, responseValue, correct) as any,
      device,
      offline: networkState === 'offline',
      network_state: networkState,
    });

    let nextDue: string | undefined;
    try {
      const result = await submitReview(event);
      nextDue = result.nextDue;
      await markAsSynced([event.event_id]);
    } catch (error) {
      console.error('[SessionScreen] submitReview failed (kept in local queue):', error);
    }

    setFeedback({
      correct,
      correctAnswer,
      userAnswer: responseValue,
      nextDue,
    });
    setPhase('feedback');
  }, [attemptCount, currentCard, hintLevel, miniHandwriting, preferences.locale, responseValue]);

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

  const handleHint = useCallback(() => {
    if (maxHintSteps <= 0) return;
    setHintLevel((prev) => Math.min(prev + 1, maxHintSteps));
    setAttemptCount((prev) => prev + 1);
  }, [maxHintSteps]);

  if (phase === 'loading') {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>{sessionCopy.loading}</Text>
      </SafeAreaView>
    );
  }

  if (phase === 'complete') {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.completeEmoji}>{sessionCopy.completeBadge}</Text>
        <Text style={styles.completeTitle}>{sessionCopy.completeTitle}</Text>
        <Text style={styles.completeSubtitle}>{sessionCopy.completeSubtitle(queue.length)}</Text>
        <TouchableOpacity style={styles.btn} onPress={() => void loadSession()}>
          <Text style={styles.btnText}>{sessionCopy.restartSession}</Text>
        </TouchableOpacity>
        {onSessionEnd ? (
          <TouchableOpacity style={[styles.btn, styles.secondaryBtn]} onPress={onSessionEnd}>
            <Text style={styles.btnText}>{sessionCopy.backHome}</Text>
          </TouchableOpacity>
        ) : null}
      </SafeAreaView>
    );
  }

  if (phase === 'break') {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.completeEmoji}>{sessionCopy.breakBadge}</Text>
        <Text style={styles.completeTitle}>{sessionCopy.breakTitle}</Text>
        <Text style={styles.completeSubtitle}>{sessionCopy.breakSubtitle(currentIndex, sessionChunkMin)}</Text>
        <TouchableOpacity style={styles.btn} onPress={() => setPhase('prompt')}>
          <Text style={styles.btnText}>{sessionCopy.continueLabel}</Text>
        </TouchableOpacity>
        {onSessionEnd ? (
          <TouchableOpacity style={[styles.btn, styles.secondaryBtn]} onPress={onSessionEnd}>
            <Text style={styles.btnText}>{sessionCopy.backHome}</Text>
          </TouchableOpacity>
        ) : null}
      </SafeAreaView>
    );
  }

  if (!currentCard) return null;

  const hintText = getHintText(currentCard, hintLevel, sessionCopy.hintPrefix, preferences.locale);
  const progress = `${currentIndex + 1} / ${queue.length}`;
  const showSubmitDisabled = currentCard.prompt_type === 'MCQ' ? !selectedChoice : !answer.trim();
  const displayText = getCardDisplayText(currentCard, preferences.locale, sessionCopy.listenBeforeAnswer);

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.progress} accessibilityLabel={sessionCopy.progressA11y(currentIndex + 1, queue.length)}>
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

          {(planNotes.length > 0 || sessionChunkMin <= 5 || miniHandwriting || reservedExampleNote) ? (
            <View style={styles.policyBox}>
              {translatedPlanNotes.slice(0, 2).map((note, idx) => (
                <Text key={`${idx}-${note}`} style={styles.policyText}>{note}</Text>
              ))}
              {sessionChunkMin <= 5 ? (
                <Text style={styles.policyText}>{sessionCopy.shortSessionMode}</Text>
              ) : null}
              {miniHandwriting ? (
                <Text style={styles.policyText}>{sessionCopy.strictSurfaceMode}</Text>
              ) : null}
              {reservedExampleNote ? (
                <Text style={styles.policyText}>{reservedExampleNote}</Text>
              ) : null}
            </View>
          ) : null}

          <View style={[styles.card, currentCard.isDrill && styles.drillCard]}>
            <Text style={[styles.stateLabel, currentCard.isDrill && styles.drillLabel]}>
              {currentCard.isDrill
                ? sessionCopy.drillLabel
                : currentCard.state === 'new'
                ? sessionCopy.newLabel
                : sessionCopy.reviewLabel}
            </Text>

            {currentCard.prompt_type === 'LISTENING' ? (
              <View style={styles.audioPromptBox}>
                <Text style={styles.audioEmoji}>{sessionCopy.audioLabel}</Text>
                <Text style={styles.audioPromptTitle}>{sessionCopy.audioPromptTitle}</Text>
                <TouchableOpacity
                  style={[styles.audioBtn, isSpeaking && styles.audioBtnBusy]}
                  onPress={() => void handleReplayAudio()}
                  accessibilityRole="button"
                  accessibilityLabel={sessionCopy.playAudioA11y}
                >
                  <Text style={styles.audioBtnText}>
                    {isSpeaking ? sessionCopy.playingAudio : sessionCopy.playAudio}
                  </Text>
                </TouchableOpacity>
                {hasText(currentCard.audio_ref) ? (
                  <Text style={styles.audioCaption}>{sessionCopy.audioSource(currentCard.audio_ref)}</Text>
                ) : null}
              </View>
            ) : (
              <Text
                style={[
                  styles.surface,
                  currentCard.prompt_type === 'CLOZE' && styles.contextSurface,
                  currentCard.prompt_type === 'MCQ' && styles.meaningSurface,
                ]}
                accessibilityLanguage="ja"
                accessibilityLabel={displayText}
              >
                {displayText}
              </Text>
            )}

            {hintText ? (
              <Text style={styles.hint} accessibilityLiveRegion="polite">
                {hintText}
              </Text>
            ) : null}
            {sentenceMeaningClue && phase !== 'feedback' ? (
              <Text style={styles.contextNote}>{sentenceMeaningClue}</Text>
            ) : null}
          </View>

          {phase === 'feedback' && feedback ? (
            <View style={styles.feedbackBox} accessible accessibilityLiveRegion="assertive">
              <Text
                style={[styles.feedbackResult, feedback.correct ? styles.correct : styles.incorrect]}
                accessibilityLabel={feedback.correct ? sessionCopy.correct : sessionCopy.incorrect}
              >
                {feedback.correct ? sessionCopy.correct : sessionCopy.incorrect}
              </Text>
              {!feedback.correct ? (
                <Text style={styles.feedbackAnswer}>
                  {sessionCopy.answerPrefix}: <Text style={styles.answerHighlight}>{feedback.correctAnswer}</Text>
                </Text>
              ) : null}
              {currentCard.prompt_type === 'CLOZE' && hasText(currentCard.example_sentence_ko) ? (
                <Text style={styles.contextAnswer}>
                  {sessionCopy.translationPrefix}: {currentCard.example_sentence_ko}
                </Text>
              ) : null}
              {feedback.nextDue ? (
                <Text style={styles.nextDue}>
                  {sessionCopy.nextReview(new Date(feedback.nextDue).toLocaleDateString(preferences.locale))}
                </Text>
              ) : null}
              <TouchableOpacity
                style={styles.btn}
                onPress={handleNext}
                accessibilityRole="button"
                accessibilityLabel={sessionCopy.nextCardA11y}
              >
                <Text style={styles.btnText}>{sessionCopy.nextCard}</Text>
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
                        accessibilityLabel={sessionCopy.choiceA11y(choice)}
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
                      ? sessionCopy.listeningPlaceholder
                      : miniHandwriting && (currentCard.prompt_type === 'MEANING_TO_SURFACE' || currentCard.prompt_type === 'CLOZE')
                      ? sessionCopy.exactSurfacePlaceholder
                      : sessionCopy.answerPlaceholder
                  }
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="done"
                  onSubmitEditing={() => void handleSubmit()}
                  accessibilityLabel={promptLabel}
                  accessibilityHint={sessionCopy.enterAnswerHint}
                />
              )}

              <TouchableOpacity
                style={[styles.btn, showSubmitDisabled && styles.btnDisabled]}
                onPress={() => void handleSubmit()}
                disabled={showSubmitDisabled}
                accessibilityRole="button"
                accessibilityLabel={sessionCopy.submitA11y}
                accessibilityState={{ disabled: showSubmitDisabled }}
              >
                <Text style={styles.btnText}>{sessionCopy.submit}</Text>
              </TouchableOpacity>

              {currentCard.prompt_type === 'LISTENING' ? (
                <TouchableOpacity
                  style={styles.secondaryAction}
                  onPress={() => void handleReplayAudio()}
                  accessibilityRole="button"
                  accessibilityLabel={sessionCopy.replayAudioA11y}
                >
                  <Text style={styles.secondaryActionText}>
                    {isSpeaking ? sessionCopy.playingAudio : sessionCopy.replayAudio}
                  </Text>
                </TouchableOpacity>
              ) : null}

              {hintLevel < maxHintSteps ? (
                <TouchableOpacity
                  style={styles.hintBtn}
                  onPress={handleHint}
                  accessibilityRole="button"
                  accessibilityLabel={sessionCopy.showHint(hintLevel + 1, maxHintSteps)}
                  hitSlop={{ top: 8, bottom: 8, left: 16, right: 16 }}
                >
                  <Text style={styles.hintBtnText}>{sessionCopy.showHint(hintLevel + 1, maxHintSteps)}</Text>
                </TouchableOpacity>
              ) : null}

              {currentCard.prompt_type === 'MCQ' && hasText(responseValue) ? (
                <Text style={styles.choiceCaption}>{sessionCopy.selectedChoice(responseValue)}</Text>
              ) : null}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function buildErrorType(card: SessionCard, responseValue: string, correct: boolean): string {
  if (correct) return 'NONE';
  if (!responseValue.trim()) return 'NO_RECALL';
  if (card.prompt_type === 'SURFACE_TO_READING' || card.prompt_type === 'LISTENING') {
    return 'READING_CONFUSION';
  }
  if (card.prompt_type === 'SURFACE_TO_MEANING' || card.prompt_type === 'MCQ') {
    return 'MEANING_NEAR';
  }
  return 'FORM_SIMILAR';
}

function judgeAnswer(
  userInput: string,
  card: SessionCard,
  miniHandwriting: boolean,
  locale: SupportedLocale,
): boolean {
  const normalize = (value: string) => value.trim().replace(/\s/g, '').toLowerCase();
  const normalizeStrictSurface = (value: string) => value.trim();
  const input = normalize(userInput);

  switch (card.prompt_type) {
    case 'SURFACE_TO_MEANING':
      return getAcceptedMeaningAnswers(card.meaning_ko, locale).some((candidate) => input === candidate);
    case 'SURFACE_TO_READING':
      return input === normalize(card.reading ?? '');
    case 'MEANING_TO_SURFACE':
    case 'CLOZE':
    case 'LISTENING':
      return miniHandwriting
        ? normalizeStrictSurface(userInput) === normalizeStrictSurface(card.surface)
        : input === normalize(card.surface);
    case 'MCQ':
      return userInput === card.surface;
    default:
      return false;
  }
}

function getAcceptedMeaningAnswers(meaning: string | null, locale: SupportedLocale): string[] {
  if (!meaning) return [];

  const normalize = (value: string) => value.trim().replace(/\s/g, '').toLowerCase();
  const rawCandidates = splitMeaningCandidates(meaning);
  const candidates = new Set<string>([normalize(meaning)]);

  for (const candidate of rawCandidates) {
    candidates.add(normalize(candidate));
    candidates.add(normalize(translateMeaningValue(locale, candidate)));
    const withoutParens = candidate.replace(/\([^)]*\)/g, '').trim();
    if (withoutParens) {
      candidates.add(normalize(withoutParens));
      candidates.add(normalize(translateMeaningValue(locale, withoutParens)));
    }
  }

  return [...candidates];
}

function getCorrectAnswer(card: SessionCard, locale: SupportedLocale): string {
  switch (card.prompt_type) {
    case 'SURFACE_TO_MEANING':
      return localizeMeaningText(locale, card.meaning_ko);
    case 'SURFACE_TO_READING':
      return card.reading ?? '';
    default:
      return card.surface;
  }
}

function getPromptLabel(card: SessionCard, miniHandwriting: boolean, copy: SessionUiCopy): string {
  switch (card.prompt_type) {
    case 'SURFACE_TO_MEANING':
      return copy.promptMeaning;
    case 'SURFACE_TO_READING':
      return copy.promptReading;
    case 'MEANING_TO_SURFACE':
      return miniHandwriting ? copy.promptExactSurface : copy.promptSurface;
    case 'MCQ':
      return copy.promptChoose;
    case 'CLOZE':
      return copy.promptCloze;
    case 'LISTENING':
      return copy.promptListening;
    default:
      return copy.promptDefault;
  }
}

function getCardDisplayText(
  card: SessionCard,
  locale: SupportedLocale,
  listeningLabel: string,
): string {
  switch (card.prompt_type) {
    case 'SURFACE_TO_MEANING':
    case 'SURFACE_TO_READING':
      return card.surface;
    case 'MEANING_TO_SURFACE':
    case 'MCQ':
      return localizeMeaningText(locale, card.meaning_ko) || card.surface;
    case 'CLOZE':
      return maskSurfaceInSentence(getClozeSentence(card) ?? card.surface, card.surface);
    case 'LISTENING':
      return listeningLabel;
    default:
      return card.surface;
  }
}

function getHintText(card: SessionCard, level: number, hintPrefix: string, locale: SupportedLocale): string | null {
  if (level === 0) return null;

  switch (card.prompt_type) {
    case 'SURFACE_TO_MEANING':
    case 'SURFACE_TO_READING':
    case 'MCQ': {
      const reading = card.reading ?? '';
      if (level === 1) return hasText(reading) ? `${hintPrefix}: ${reading[0]}...` : null;
      return hasText(reading) ? `${hintPrefix}: ${reading}` : null;
    }
    case 'MEANING_TO_SURFACE':
    case 'LISTENING': {
      if (level === 1) return hasText(card.surface) ? `${hintPrefix}: ${card.surface[0]}...` : null;
      return hasText(card.reading) ? `${hintPrefix}: ${card.reading}` : `${hintPrefix}: ${card.surface}`;
    }
    case 'CLOZE': {
      const localizedMeaning = localizeMeaningText(locale, card.meaning_ko);
      if (level === 1 && hasText(localizedMeaning)) {
        return `${hintPrefix}: ${localizedMeaning}`;
      }
      if (level === 1) return hasText(card.surface) ? `${hintPrefix}: ${card.surface[0]}...` : null;
      return hasText(card.reading) ? `${hintPrefix}: ${card.reading}` : `${hintPrefix}: ${card.surface}`;
    }
    default:
      return null;
  }
}

function getSentenceMeaningClue(
  card: SessionCard,
  locale: SupportedLocale,
  translationPrefix: string,
): string | null {
  if (card.prompt_type !== 'CLOZE') return null;

  if (locale === 'ko' && hasText(card.example_sentence_ko)) {
    return `${translationPrefix}: ${card.example_sentence_ko}`;
  }

  const localizedMeaning = localizeMeaningText(locale, card.meaning_ko);
  return hasText(localizedMeaning) ? `${translationPrefix}: ${localizedMeaning}` : null;
}

function splitMeaningCandidates(meaning: string): string[] {
  return meaning
    .split(/[,/;|]|(?:\s+or\s+)|(?:\s+\uB610\uB294\s+)|(?:\s+\u307E\u305F\u306F\s+)|(?:\s*[·\u30FB]\s*)/i)
    .map((value) => value.trim())
    .filter(Boolean);
}

function localizeMeaningText(locale: SupportedLocale, meaning: string | null): string {
  if (!meaning) return '';

  const segments = splitMeaningCandidates(meaning);
  if (segments.length === 0) return meaning;

  return segments
    .map((segment) => translateMeaningValue(locale, segment))
    .join(' / ');
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      backgroundColor: colors.background,
    },
    scroll: { padding: 24, paddingBottom: 48, backgroundColor: colors.background },
    progress: { textAlign: 'right', color: colors.textMuted, fontSize: 13, marginBottom: 4 },
    progressBar: {
      height: 4,
      backgroundColor: colors.border,
      borderRadius: 2,
      marginBottom: 32,
    },
    progressFill: {
      height: 4,
      backgroundColor: colors.primary,
      borderRadius: 2,
    },
    policyBox: {
      backgroundColor: colors.surfaceAlt,
      borderRadius: 12,
      padding: 12,
      marginBottom: 20,
      gap: 6,
    },
    policyText: {
      color: colors.textMuted,
      fontSize: 12,
      lineHeight: 18,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 32,
      alignItems: 'center',
      marginBottom: 32,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.12,
      shadowRadius: 10,
      elevation: 4,
    },
    drillCard: {
      borderLeftWidth: 3,
      borderLeftColor: colors.warning,
    },
    stateLabel: {
      fontSize: 12,
      color: colors.textMuted,
      marginBottom: 12,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    drillLabel: {
      color: colors.warning,
      fontWeight: '600',
    },
    surface: {
      fontSize: 52,
      fontWeight: 'bold',
      color: colors.text,
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
      color: colors.textMuted,
      textAlign: 'center',
    },
    audioPromptBox: {
      width: '100%',
      alignItems: 'center',
      gap: 12,
    },
    audioEmoji: {
      fontSize: 36,
      color: colors.text,
      fontWeight: '700',
    },
    audioPromptTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
    },
    audioBtn: {
      backgroundColor: colors.primary,
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: 999,
    },
    audioBtnBusy: {
      opacity: 0.82,
    },
    audioBtnText: {
      color: colors.onPrimary,
      fontSize: 15,
      fontWeight: '700',
    },
    audioCaption: {
      fontSize: 11,
      color: colors.textMuted,
    },
    hint: { marginTop: 16, fontSize: 14, color: colors.warning, textAlign: 'center' },
    promptLabel: { fontSize: 15, color: colors.textMuted, marginBottom: 12 },
    input: {
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 14,
      fontSize: 18,
      marginBottom: 16,
      backgroundColor: colors.surface,
      color: colors.text,
    },
    btn: {
      backgroundColor: colors.primary,
      paddingVertical: 14,
      borderRadius: 12,
      alignItems: 'center',
      marginBottom: 12,
    },
    secondaryBtn: {
      backgroundColor: colors.text,
      marginTop: 0,
    },
    btnDisabled: { backgroundColor: colors.border },
    btnText: { color: colors.onPrimary, fontSize: 16, fontWeight: '600' },
    hintBtn: {
      paddingVertical: 10,
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    hintBtnText: { color: colors.warning, fontSize: 14 },
    feedbackBox: { gap: 12 },
    feedbackResult: { fontSize: 22, fontWeight: 'bold', textAlign: 'center', marginBottom: 4 },
    correct: { color: colors.success },
    incorrect: { color: colors.danger },
    feedbackAnswer: { fontSize: 16, color: colors.text, textAlign: 'center' },
    contextAnswer: { fontSize: 13, color: colors.textMuted, textAlign: 'center' },
    answerHighlight: { fontWeight: 'bold', color: colors.text },
    nextDue: { fontSize: 13, color: colors.textMuted, textAlign: 'center' },
    loadingText: { marginTop: 16, color: colors.textMuted },
    completeEmoji: { fontSize: 44, marginBottom: 16, color: colors.text, fontWeight: '700' },
    completeTitle: { fontSize: 24, fontWeight: 'bold', color: colors.text, marginBottom: 8 },
    completeSubtitle: {
      fontSize: 15,
      color: colors.textMuted,
      textAlign: 'center',
      marginBottom: 32,
      lineHeight: 22,
    },
    choiceList: {
      gap: 10,
      marginBottom: 16,
    },
    choiceButton: {
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: 12,
      paddingVertical: 14,
      paddingHorizontal: 16,
      backgroundColor: colors.surface,
    },
    choiceButtonSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primarySoft,
    },
    choiceText: {
      fontSize: 18,
      color: colors.text,
      textAlign: 'center',
      fontWeight: '600',
    },
    choiceTextSelected: {
      color: colors.primary,
    },
    secondaryAction: {
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 44,
      marginBottom: 4,
    },
    secondaryActionText: {
      color: colors.primary,
      fontSize: 14,
      fontWeight: '600',
    },
    choiceCaption: {
      marginTop: 8,
      fontSize: 12,
      color: colors.textMuted,
      textAlign: 'center',
    },
  });
}
