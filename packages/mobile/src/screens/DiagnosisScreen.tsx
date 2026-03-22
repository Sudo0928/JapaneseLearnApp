import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type {
  DiagnosisBootstrapResponse,
  DiagnosisCognitiveMetrics,
  DiagnosisEvaluateBlockRequest,
  DiagnosisEvaluateBlockResponse,
  DiagnosisLanguageMicroAnswer,
  DiagnosisLanguageMicroItem,
  DiagnosisPromptType,
  DiagnosisResultResponse,
  DiagnosisSubmitV4Request,
  OnboardingProfile,
  SupportedLocale,
} from '@japanese-learn/shared';
import { getDiagnosisUiCopy } from '../i18n/diagnosis-ui';
import {
  toCanonicalMeaningValue,
  translateAdaptiveReason,
  translateKnownNarrative,
  translateMeaningValue,
} from '../i18n/diagnosis-plan';
import { useSettings } from '../providers/settings-provider';
import { fetchWithTimeout } from '../services/network';
import { getValidAppToken } from '../services/secure-storage';
import type { ThemeColors } from '../theme';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL ?? 'http://localhost:3000';

type Phase = 'intro' | 'onboarding' | 'memory_study' | 'memory_recall' | 'memory_recognition' | 'digit_span' | 'visual' | 'language' | 'result';
type DigitSpanMode = 'forward' | 'reverse' | 'ascending' | 'odd_only';
type DigitSpanTrial = {
  digits: number[];
  mode: DigitSpanMode;
  expected: string;
};
type MemoryMeaning = Record<SupportedLocale, string>;
type MemoryPairSeed = {
  id: string;
  symbol: string;
  meaning: MemoryMeaning;
  decoys: MemoryMeaning[];
};
type VisualTrial = {
  options: string[];
  answer: number;
};

const MEMORY_SYMBOL_POOL = [
  'KA', 'MI', 'RA', 'ZU', 'NO', 'TE', 'SHI', 'YU', 'KO', 'NE',
  'TA', 'FU', 'RE', 'SO', 'HI', 'ME', 'NA', 'RU', 'SE', 'YO',
  'GI', 'MO', 'KE', 'TO', 'WA', 'SA', 'CHI', 'NI', 'HO', 'MA',
];
const MEMORY_MEANING_POOL: MemoryMeaning[] = [
  { ko: '바람', en: 'wind', ja: '風' },
  { ko: '약속', en: 'promise', ja: '約束' },
  { ko: '친구', en: 'friend', ja: '友達' },
  { ko: '기차', en: 'train', ja: '電車' },
  { ko: '물', en: 'water', ja: '水' },
  { ko: '책', en: 'book', ja: '本' },
  { ko: '티켓', en: 'ticket', ja: '切符' },
  { ko: '다리', en: 'bridge', ja: '橋' },
  { ko: '거울', en: 'mirror', ja: '鏡' },
  { ko: '정원', en: 'garden', ja: '庭' },
  { ko: '등불', en: 'lantern', ja: '灯り' },
  { ko: '역', en: 'station', ja: '駅' },
  { ko: '실', en: 'thread', ja: '糸' },
  { ko: '카메라', en: 'camera', ja: 'カメラ' },
  { ko: '신호', en: 'signal', ja: '信号' },
  { ko: '피아노', en: 'piano', ja: 'ピアノ' },
  { ko: '항구', en: 'harbor', ja: '港' },
  { ko: '커피', en: 'coffee', ja: 'コーヒー' },
  { ko: '그림자', en: 'shadow', ja: '影' },
  { ko: '행성', en: 'planet', ja: '惑星' },
  { ko: '시장', en: 'market', ja: '市場' },
  { ko: '창문', en: 'window', ja: '窓' },
  { ko: '계곡', en: 'valley', ja: '谷' },
  { ko: '강', en: 'river', ja: '川' },
  { ko: '깃털', en: 'feather', ja: '羽' },
  { ko: '일정', en: 'schedule', ja: '予定' },
  { ko: '엔진', en: 'engine', ja: 'エンジン' },
  { ko: '숲', en: 'forest', ja: '森' },
  { ko: '편지', en: 'letter', ja: '手紙' },
  { ko: '선반', en: 'shelf', ja: '棚' },
];
const DIGIT_TRIAL_MODES: DigitSpanMode[] = ['forward', 'reverse', 'ascending', 'odd_only'];
const DIGIT_TRIAL_LENGTHS = [4, 5, 6];
const VISUAL_CHAR_POOL = ['A', 'H', 'K', 'M', 'N', 'P', 'R', 'T', 'V', 'W', 'X', 'Y', '7', '8', '0', '1'];
const DEFAULT_ONBOARDING: OnboardingProfile = {
  target_level: 'JLPT_N5',
  target_date: null,
  focus: [],
  daily_minutes: 20,
  weekly_variability: 'medium',
  offline_expected: false,
  kanji_background: 'none',
  notifications_opt_in: false,
  weak_areas: [],
};
const TARGET_LEVEL_OPTIONS = ['JLPT_N5', 'JLPT_N4', 'JLPT_N3', 'JLPT_N2', 'JLPT_N1'] as const;
const DIAGNOSIS_PROMPT_TYPES: DiagnosisPromptType[] = [
  'SURFACE_TO_MEANING',
  'SURFACE_TO_READING',
  'MEANING_TO_SURFACE',
  'MCQ',
];
interface DiagnosisScreenProps {
  onComplete: (result?: DiagnosisResultResponse) => void;
  onSkip: () => void;
}

export default function DiagnosisScreen({ onComplete, onSkip }: DiagnosisScreenProps) {
  const { colors, preferences } = useSettings();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const copy = useMemo(() => getDiagnosisUiCopy(preferences.locale), [preferences.locale]);
  const [phase, setPhase] = useState<Phase>('intro');
  const [bootstrap, setBootstrap] = useState<DiagnosisBootstrapResponse | null>(null);
  const [loadingBootstrap, setLoadingBootstrap] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<DiagnosisResultResponse | null>(null);
  const [onboarding, setOnboarding] = useState<OnboardingProfile>(DEFAULT_ONBOARDING);
  const [queue, setQueue] = useState<DiagnosisLanguageMicroItem[]>([]);
  const [adaptiveReasons, setAdaptiveReasons] = useState<string[]>([]);
  const [confidencePreview, setConfidencePreview] = useState<DiagnosisEvaluateBlockResponse['confidence_by_axis'] | null>(null);
  const [studyTimerLeft, setStudyTimerLeft] = useState(20);
  const [currentRecallIndex, setCurrentRecallIndex] = useState(0);
  const [recallInput, setRecallInput] = useState('');
  const [pairStartTime, setPairStartTime] = useState(Date.now());
  const [memoryAnswers, setMemoryAnswers] = useState<Array<{ type: 'recall' | 'recognition'; correct: boolean; rt_ms: number }>>([]);
  const [digitIndex, setDigitIndex] = useState(0);
  const [showDigits, setShowDigits] = useState(true);
  const [digitInput, setDigitInput] = useState('');
  const [digitSpanMax, setDigitSpanMax] = useState(3);
  const [visualIndex, setVisualIndex] = useState(0);
  const [visualStartTime, setVisualStartTime] = useState(Date.now());
  const [visualAnswers, setVisualAnswers] = useState<Array<{ correct: boolean; rt_ms: number }>>([]);
  const [languageIndex, setLanguageIndex] = useState(0);
  const [languageInput, setLanguageInput] = useState('');
  const [languageAnswers, setLanguageAnswers] = useState<DiagnosisLanguageMicroAnswer[]>([]);
  const languageSubmitLock = useRef(false);
  const studyTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const digitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const languageStartTime = useRef(Date.now());
  const memoryDeck = useMemo(() => buildMemoryPairSeeds(), []);
  const digitDeck = useMemo(() => buildDigitTrials(), []);
  const visualDeck = useMemo(() => buildVisualTrials(), []);
  const question = queue[languageIndex];
  const memoryPairs = useMemo(
    () => memoryDeck.map((pair) => ({
      ...pair,
      meaning: pair.meaning[preferences.locale],
      decoys: pair.decoys.map((choice) => choice[preferences.locale]),
    })),
    [memoryDeck, preferences.locale],
  );
  const recallPairs = useMemo(() => memoryPairs.slice(0, 3), [memoryPairs]);
  const recognitionPairs = useMemo(() => memoryPairs.slice(3, 6), [memoryPairs]);

  useEffect(() => {
    void loadBootstrap();
    return () => {
      if (studyTimerRef.current) clearInterval(studyTimerRef.current);
      if (digitTimerRef.current) clearTimeout(digitTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (phase !== 'memory_study') return;
    setStudyTimerLeft(20);
    studyTimerRef.current = setInterval(() => {
      setStudyTimerLeft((prev) => {
        if (prev <= 1) {
          if (studyTimerRef.current) clearInterval(studyTimerRef.current);
          setCurrentRecallIndex(0);
          setPairStartTime(Date.now());
          setPhase('memory_recall');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (studyTimerRef.current) clearInterval(studyTimerRef.current);
    };
  }, [phase]);

  useEffect(() => {
    if (phase !== 'digit_span') return;
    setShowDigits(true);
    setDigitInput('');
    digitTimerRef.current = setTimeout(() => setShowDigits(false), 2200);
    return () => {
      if (digitTimerRef.current) clearTimeout(digitTimerRef.current);
    };
  }, [phase, digitIndex]);

  useEffect(() => {
    if (phase === 'visual') setVisualStartTime(Date.now());
    if (phase === 'language') {
      languageStartTime.current = Date.now();
      setLanguageInput('');
    }
  }, [phase, visualIndex, languageIndex]);

  async function loadBootstrap() {
    setLoadingBootstrap(true);
    try {
      const token = await getValidAppToken();
      const response = await fetchWithTimeout(`${BACKEND_URL}/v1/diagnosis/bootstrap`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) return;
      const data = await response.json() as DiagnosisBootstrapResponse;
      setBootstrap(data);
      setOnboarding(data.onboarding_defaults ?? DEFAULT_ONBOARDING);
      setQueue(buildDiagnosisQueue(data.core_items ?? []));
      if (data.previous_result) setResult(data.previous_result);
    } finally {
      setLoadingBootstrap(false);
    }
  }

  function buildCognitiveMetrics(): DiagnosisCognitiveMetrics {
    const recallAnswers = memoryAnswers.filter((answer) => answer.type === 'recall');
    const recognitionAnswers = memoryAnswers.filter((answer) => answer.type === 'recognition');
    const memoryAvgRt = memoryAnswers.length
      ? Math.round(memoryAnswers.reduce((sum, answer) => sum + answer.rt_ms, 0) / memoryAnswers.length)
      : 2500;
    const visualCorrect = visualAnswers.filter((answer) => answer.correct).length;
    const visualAvgRt = visualAnswers.length
      ? Math.round(visualAnswers.reduce((sum, answer) => sum + answer.rt_ms, 0) / visualAnswers.length)
      : 2500;

    return {
      memory_pairs: {
        recall_correct: recallAnswers.filter((answer) => answer.correct).length,
        recall_total: recallPairs.length,
        recognition_correct: recognitionAnswers.filter((answer) => answer.correct).length,
        recognition_total: recognitionPairs.length,
        avg_rt_ms: memoryAvgRt,
      },
      digit_span: { max_correct_span: digitSpanMax },
      visual_discrimination: {
        correct: visualCorrect,
        total: visualDeck.length,
        avg_rt_ms: visualAvgRt,
      },
    };
  }

  function toggleFocus(focus: string) {
    setOnboarding((prev) => {
      const current = new Set(prev.focus ?? []);
      if (current.has(focus)) current.delete(focus);
      else current.add(focus);
      return { ...prev, focus: [...current] };
    });
  }

  function handleRecallAnswer() {
    const pair = recallPairs[currentRecallIndex];
    if (!pair) return;
    setMemoryAnswers((prev) => [...prev, { type: 'recall', correct: normalizeAnswer(recallInput) === normalizeAnswer(pair.meaning), rt_ms: Date.now() - pairStartTime }]);
    setRecallInput('');
    if (currentRecallIndex + 1 < recallPairs.length) {
      setCurrentRecallIndex((prev) => prev + 1);
      setPairStartTime(Date.now());
      return;
    }
    setCurrentRecallIndex(0);
    setPairStartTime(Date.now());
    setPhase('memory_recognition');
  }

  function handleRecognitionAnswer(choice: string) {
    const pair = recognitionPairs[currentRecallIndex];
    if (!pair) return;
    setMemoryAnswers((prev) => [...prev, { type: 'recognition', correct: choice === pair.meaning, rt_ms: Date.now() - pairStartTime }]);
    if (currentRecallIndex + 1 < recognitionPairs.length) {
      setCurrentRecallIndex((prev) => prev + 1);
      setPairStartTime(Date.now());
      return;
    }
    setDigitIndex(0);
    setPhase('digit_span');
  }

  function handleDigitAnswer() {
    if (normalizeDigitAnswer(digitInput) === digitDeck[digitIndex].expected) {
      setDigitSpanMax(digitDeck[digitIndex].digits.length);
    }
    if (digitIndex + 1 < digitDeck.length) {
      setDigitIndex((prev) => prev + 1);
      return;
    }
    setVisualIndex(0);
    setPhase('visual');
  }

  function handleVisualAnswer(choice: number) {
    const trial = visualDeck[visualIndex];
    setVisualAnswers((prev) => [...prev, { correct: choice === trial.answer, rt_ms: Date.now() - visualStartTime }]);
    if (visualIndex + 1 < visualDeck.length) {
      setVisualIndex((prev) => prev + 1);
      return;
    }
    setPhase('language');
  }

  async function handleLanguageAnswer(answer: string) {
    if (!question || languageSubmitLock.current) return;
    languageSubmitLock.current = true;

    try {
      const normalizedAnswer = question.prompt_type === 'SURFACE_TO_MEANING'
        ? toCanonicalMeaningValue(preferences.locale, answer)
        : answer;
      const nextAnswers = [...languageAnswers, {
        id: question.id,
        prompt_type: question.prompt_type,
        answer: normalizedAnswer,
        rt_ms: Date.now() - languageStartTime.current,
      }];
      setLanguageAnswers(nextAnswers);
      setLanguageInput('');

      if (languageIndex + 1 < queue.length) {
        setLanguageIndex((prev) => prev + 1);
        return;
      }

      if (queue.length >= 24 && queue.length < 36) {
        const evaluation = await evaluateBlock(nextAnswers);
        if (evaluation && !evaluation.done && evaluation.next_items.length > 0) {
          setAdaptiveReasons(evaluation.reason_codes);
          setConfidencePreview(evaluation.confidence_by_axis);
          setQueue((prev) => [...prev, ...evaluation.next_items]);
          setLanguageIndex((prev) => prev + 1);
          return;
        }
      }

      await submitDiagnosis(nextAnswers);
    } finally {
      languageSubmitLock.current = false;
    }
  }

  async function evaluateBlock(answeredItems: DiagnosisLanguageMicroAnswer[]) {
    const token = await getValidAppToken();
    const payload: DiagnosisEvaluateBlockRequest = {
      answered_items: answeredItems,
      cognitive_metrics: buildCognitiveMetrics(),
      onboarding_profile: onboarding,
    };
    try {
      const response = await fetch(`${BACKEND_URL}/v1/diagnosis/evaluate-block`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(payload),
      });
      if (!response.ok) return null;
      return await response.json() as DiagnosisEvaluateBlockResponse;
    } catch {
      return null;
    }
  }

  async function submitDiagnosis(answers: DiagnosisLanguageMicroAnswer[]) {
    setSubmitting(true);
    setPhase('result');
    const token = await getValidAppToken();
    const payload: DiagnosisSubmitV4Request = {
      phase: 'cognitive_v4',
      onboarding_profile: onboarding,
      cognitive_metrics: buildCognitiveMetrics(),
      answers,
    };
    try {
      const response = await fetch(`${BACKEND_URL}/v1/diagnosis/submit-v4`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? `HTTP ${response.status}`);
      }
      setResult(await response.json() as DiagnosisResultResponse);
    } catch (error) {
      Alert.alert(copy.noDiagnosisResult, String(error));
      setResult(result ?? bootstrap?.previous_result ?? null);
    } finally {
      setSubmitting(false);
    }
  }

  function handleSkip() {
    if (Platform.OS === 'web' && typeof globalThis.confirm === 'function') {
      if (globalThis.confirm(copy.skipMessage)) {
        onSkip();
      }
      return;
    }

    Alert.alert(copy.skipTitle, copy.skipMessage, [
      { text: copy.cancel, style: 'cancel' },
      { text: copy.skip, onPress: onSkip },
    ]);
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {phase === 'intro' && (
          <View style={styles.panel}>
            <Text style={styles.title}>{copy.introTitle}</Text>
            <Text style={styles.desc}>{copy.introDescription}</Text>
            {loadingBootstrap ? <ActivityIndicator color={colors.primary} /> : null}
            <Action styles={styles} title={copy.startDiagnosis} onPress={() => setPhase('onboarding')} />
            <Action styles={styles} title={copy.skip} onPress={handleSkip} secondary />
          </View>
        )}

        {phase === 'onboarding' && (
          <View style={styles.panel}>
            <Progress styles={styles} label={copy.onboarding} current={1} />
            <Section styles={styles} label={copy.targetLevel}>{TARGET_LEVEL_OPTIONS.map((value) => chip(styles, value, onboarding.target_level === value, () => setOnboarding((prev) => ({ ...prev, target_level: value }))))}</Section>
            <Section styles={styles} label={copy.focus}>{(['READING', 'VOCAB', 'PRODUCTION'] as const).map((value) => chip(styles, copy.focusLabels[value], (onboarding.focus ?? []).includes(value), () => toggleFocus(value)))}</Section>
            <Section styles={styles} label={copy.dailyMinutes}>{[10, 20, 30, 45].map((value) => chip(styles, formatMinuteLabel(preferences.locale, value), onboarding.daily_minutes === value, () => setOnboarding((prev) => ({ ...prev, daily_minutes: value }))))}</Section>
            <Section styles={styles} label={copy.variability}>{(['low', 'medium', 'high'] as const).map((value) => chip(styles, copy.variabilityLabels[value], onboarding.weekly_variability === value, () => setOnboarding((prev) => ({ ...prev, weekly_variability: value as OnboardingProfile['weekly_variability'] }))))}</Section>
            <Section styles={styles} label={copy.kanji}>{(['none', 'basic', 'native'] as const).map((value) => chip(styles, copy.kanjiLabels[value], onboarding.kanji_background === value, () => setOnboarding((prev) => ({ ...prev, kanji_background: value as OnboardingProfile['kanji_background'] }))))}</Section>
            <Section styles={styles} label={copy.flags}>
              {chip(styles, copy.offlineExpected, onboarding.offline_expected, () => setOnboarding((prev) => ({ ...prev, offline_expected: !prev.offline_expected })))}
              {chip(styles, copy.notifications, onboarding.notifications_opt_in, () => setOnboarding((prev) => ({ ...prev, notifications_opt_in: !prev.notifications_opt_in })))}
            </Section>
            <TextInput style={styles.input} placeholder={copy.targetDatePlaceholder} placeholderTextColor={colors.textSoft} value={onboarding.target_date ?? ''} onChangeText={(value) => setOnboarding((prev) => ({ ...prev, target_date: value || null }))} />
            <Action styles={styles} title={copy.continue} onPress={() => setPhase('memory_study')} />
          </View>
        )}

        {phase === 'memory_study' && (
          <View style={styles.panel}>
            <Progress styles={styles} label={copy.memoryStudy} current={2} />
            <Text style={styles.title}>{copy.memorizeFor(studyTimerLeft)}</Text>
            <View style={styles.grid}>{memoryPairs.map((pair) => <View key={pair.id} style={styles.card}><Text style={styles.cardTitle}>{pair.symbol}</Text><Text style={styles.cardBody}>{pair.meaning}</Text></View>)}</View>
          </View>
        )}

        {phase === 'memory_recall' && (
          <View style={styles.panel}>
            <Progress styles={styles} label={copy.freeRecall} current={2} />
            <Text style={styles.big}>{recallPairs[currentRecallIndex]?.symbol}</Text>
            <TextInput style={styles.input} placeholder={copy.typeMeaning} placeholderTextColor={colors.textSoft} value={recallInput} onChangeText={setRecallInput} onSubmitEditing={handleRecallAnswer} />
            <Action styles={styles} title={copy.continue} onPress={handleRecallAnswer} />
          </View>
        )}

        {phase === 'memory_recognition' && (
          <View style={styles.panel}>
            <Progress styles={styles} label={copy.recognition} current={2} />
            <Text style={styles.big}>{recognitionPairs[currentRecallIndex]?.symbol}</Text>
            <View style={styles.stack}>{shuffle([recognitionPairs[currentRecallIndex]?.meaning ?? '', ...(recognitionPairs[currentRecallIndex]?.decoys ?? [])]).map((option) => <Action styles={styles} key={`${currentRecallIndex}-${option}`} title={option} onPress={() => handleRecognitionAnswer(option)} secondary />)}</View>
          </View>
        )}

        {phase === 'digit_span' && (
          <View style={styles.panel}>
            <Progress styles={styles} label={copy.digitSpan} current={3} />
            <Text style={styles.desc}>{digitInstruction(preferences.locale, digitDeck[digitIndex]?.mode ?? 'reverse')}</Text>
            {showDigits ? <Text style={styles.big}>{digitDeck[digitIndex].digits.join(' ')}</Text> : <>
              <TextInput style={styles.input} placeholder={digitPlaceholder(preferences.locale, digitDeck[digitIndex]?.mode ?? 'reverse', copy.reverseDigits)} placeholderTextColor={colors.textSoft} keyboardType="numeric" value={digitInput} onChangeText={setDigitInput} onSubmitEditing={handleDigitAnswer} />
              <Action styles={styles} title={copy.continue} onPress={handleDigitAnswer} />
            </>}
          </View>
        )}

        {phase === 'visual' && (
          <View style={styles.panel}>
            <Progress styles={styles} label={copy.visual} current={4} />
            <Text style={styles.desc}>{copy.visualPrompt}</Text>
            <View style={styles.stack}>{visualDeck[visualIndex].options.map((option, index) => <Action styles={styles} key={`${option}-${index}`} title={option} onPress={() => handleVisualAnswer(index)} secondary />)}</View>
          </View>
        )}

        {phase === 'language' && question && (
          <View style={styles.panel}>
            <Progress styles={styles} label={copy.language(languageIndex + 1, queue.length)} current={5} />
            {adaptiveReasons.length > 0 && languageIndex >= 24 ? <View style={styles.notice}>{adaptiveReasons.map((reason) => <Text key={reason} style={styles.noticeText}>{translateAdaptiveReason(preferences.locale, reason)}</Text>)}</View> : null}
            {confidencePreview ? <View style={styles.notice}>{Object.entries(confidencePreview).map(([key, value]) => <Text key={key} style={styles.noticeText}>{translateAxisLabel(preferences.locale, key)}: {Math.round(value * 100)}%</Text>)}</View> : null}
            <Text style={styles.desc}>{promptLabel(question, copy)}</Text>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{questionPrompt(preferences.locale, question)}</Text>
              <Text style={styles.cardBody}>{questionHint(question, copy)}</Text>
            </View>
            {question.choices?.length ? <View style={styles.stack}>{question.choices.map((choice) => <Action styles={styles} key={`${question.id}-${choice}`} title={questionChoiceLabel(preferences.locale, question, choice)} onPress={() => void handleLanguageAnswer(choice)} secondary />)}</View> : <>
              <TextInput style={styles.input} placeholder={copy.typeAnswer} placeholderTextColor={colors.textSoft} value={languageInput} onChangeText={setLanguageInput} onSubmitEditing={() => void handleLanguageAnswer(languageInput)} />
              <Action styles={styles} title={copy.continue} onPress={() => void handleLanguageAnswer(languageInput)} />
            </>}
          </View>
        )}

        {phase === 'result' && (
          <View style={styles.panel}>
            {submitting ? <><ActivityIndicator color={colors.primary} /><Text style={styles.desc}>{copy.savingResult}</Text></> : result ? <>
              <Text style={styles.title}>{copy.diagnosisComplete}</Text>
              <Text style={styles.desc}>{copy.diagnosisResultSummary(result.version, result.question_count ?? 0)}</Text>
              <View style={styles.notice}>{Object.entries(result.strategy_vector).map(([key, value]) => <Text key={key} style={styles.noticeText}>{translateAxisLabel(preferences.locale, key)}: {Math.round((value ?? 0) * 100)}%</Text>)}</View>
              {result.confidence_by_axis ? <View style={styles.notice}>{Object.entries(result.confidence_by_axis).map(([key, value]) => <Text key={key} style={styles.noticeText}>{translateAxisLabel(preferences.locale, key)}: {Math.round(value * 100)}%</Text>)}</View> : null}
              {result.adaptive_reason_codes?.length ? <View style={styles.notice}>{result.adaptive_reason_codes.map((reason) => <Text key={reason} style={styles.noticeText}>{translateAdaptiveReason(preferences.locale, reason)}</Text>)}</View> : null}
              <View style={styles.notice}>{result.notes.map((note) => <Text key={note} style={styles.noticeText}>{translateKnownNarrative(preferences.locale, note)}</Text>)}</View>
              <Action styles={styles} title={copy.continueToPlan} onPress={() => onComplete(result)} />
            </> : <>
              <Text style={styles.title}>{copy.noDiagnosisResult}</Text>
              <Action styles={styles} title={copy.continueWithDefaultPlan} onPress={() => onComplete()} />
            </>}
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function promptLabel(item: DiagnosisLanguageMicroItem, copy: ReturnType<typeof getDiagnosisUiCopy>): string {
  if (item.prompt_type === 'SURFACE_TO_MEANING') return copy.promptLabels.surfaceToMeaning;
  if (item.prompt_type === 'SURFACE_TO_READING') return copy.promptLabels.surfaceToReading;
  if (item.prompt_type === 'MEANING_TO_SURFACE') return copy.promptLabels.meaningToSurface;
  return copy.promptLabels.mcq;
}

function questionPrompt(locale: Parameters<typeof getDiagnosisUiCopy>[0], item: DiagnosisLanguageMicroItem): string {
  return item.prompt_type === 'MEANING_TO_SURFACE'
    ? translateMeaningValue(locale, item.meaning_ko)
    : item.surface;
}

function questionChoiceLabel(locale: Parameters<typeof getDiagnosisUiCopy>[0], item: DiagnosisLanguageMicroItem, choice: string): string {
  return item.prompt_type === 'MCQ'
    ? translateMeaningValue(locale, choice)
    : choice;
}

function questionHint(item: DiagnosisLanguageMicroItem, copy: ReturnType<typeof getDiagnosisUiCopy>): string {
  return copy.readingLabel(item.reading);
}

function translateAxisLabel(locale: Parameters<typeof getDiagnosisUiCopy>[0], key: string): string {
  const labels: Record<string, Record<'ko' | 'en' | 'ja', string>> = {
    recall_gap: { ko: '회상 격차', en: 'Recall gap', ja: '想起ギャップ' },
    reading_weak: { ko: '읽기 취약', en: 'Reading weakness', ja: '読みの弱点' },
    form_weak: { ko: '표기 취약', en: 'Form weakness', ja: '表記の弱点' },
    load_sensitive: { ko: '인지 부하 민감', en: 'Load sensitivity', ja: '認知負荷感度' },
    lateness_fragile: { ko: '연체 취약', en: 'Lateness fragility', ja: '延滞脆弱性' },
  };
  return labels[key]?.[locale] ?? key;
}

type DiagnosisStyles = ReturnType<typeof createStyles>;

function Progress({ label, current, styles }: { label: string; current: number; styles: DiagnosisStyles }) {
  return <Text style={styles.progress}>{current}/5 - {label}</Text>;
}

function Section({ label, children, styles }: { label: string; children: React.ReactNode; styles: DiagnosisStyles }) {
  return <View style={{ width: '100%', marginBottom: 16 }}><Text style={styles.label}>{label}</Text><View style={styles.row}>{children}</View></View>;
}

function Action({ title, onPress, secondary, styles }: { title: string; onPress: () => void; secondary?: boolean; styles: DiagnosisStyles }) {
  return <TouchableOpacity style={[styles.button, secondary && styles.buttonSecondary]} onPress={onPress}><Text style={[styles.buttonText, secondary && styles.buttonTextSecondary]}>{title}</Text></TouchableOpacity>;
}

function chip(styles: DiagnosisStyles, label: string, selected: boolean, onPress: () => void) {
  return <TouchableOpacity key={label} style={[styles.chip, selected && styles.chipSelected]} onPress={onPress}><Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text></TouchableOpacity>;
}

function shuffle<T>(values: T[]): T[] {
  const copy = [...values];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function shuffleVisualTrial(trial: VisualTrial): VisualTrial {
  const decorated = shuffle(trial.options.map((option, index) => ({ option, index })));
  return {
    options: decorated.map((item) => item.option),
    answer: decorated.findIndex((item) => item.index === trial.answer),
  };
}

function buildMemoryPairSeeds(): MemoryPairSeed[] {
  const symbols = shuffle([...MEMORY_SYMBOL_POOL]).slice(0, 6);
  const meanings = shuffle([...MEMORY_MEANING_POOL]).slice(0, 6);
  return symbols.map((symbol, index) => ({
    id: `p${index + 1}`,
    symbol,
    meaning: meanings[index],
    decoys: shuffle(meanings.filter((_, meaningIndex) => meaningIndex !== index)).slice(0, 3),
  }));
}

function buildDigitTrials(): DigitSpanTrial[] {
  const modes = shuffle([...DIGIT_TRIAL_MODES]).slice(0, DIGIT_TRIAL_LENGTHS.length);
  return DIGIT_TRIAL_LENGTHS.map((length, index) => {
    const mode = modes[index] ?? 'reverse';
    const digits = buildDigitSequence(length, mode);
    return {
      digits,
      mode,
      expected: computeDigitExpectedAnswer(digits, mode),
    };
  });
}

function buildDigitSequence(length: number, mode: DigitSpanMode): number[] {
  const pool = shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  const digits = pool.slice(0, length);

  if (mode === 'odd_only' && digits.every((digit) => digit % 2 === 0)) {
    digits[length - 1] = 7;
  }

  return digits;
}

function computeDigitExpectedAnswer(digits: number[], mode: DigitSpanMode): string {
  if (mode === 'forward') return digits.join('');
  if (mode === 'ascending') return [...digits].sort((left, right) => left - right).join('');
  if (mode === 'odd_only') return digits.filter((digit) => digit % 2 === 1).join('');
  return [...digits].reverse().join('');
}

function normalizeDigitAnswer(value: string): string {
  return value.replace(/\D+/g, '');
}

function digitInstruction(locale: Parameters<typeof getDiagnosisUiCopy>[0], mode: DigitSpanMode): string {
  if (locale === 'ko') {
    if (mode === 'forward') return '숫자가 사라지면 본 순서 그대로 입력하세요.';
    if (mode === 'ascending') return '숫자가 사라지면 작은 수부터 순서대로 입력하세요.';
    if (mode === 'odd_only') return '숫자가 사라지면 홀수만 본 순서대로 입력하세요.';
    return '숫자가 사라지면 거꾸로 입력하세요.';
  }
  if (locale === 'ja') {
    if (mode === 'forward') return '数字が消えたら見た順番のまま入力してください。';
    if (mode === 'ascending') return '数字が消えたら小さい順に入力してください。';
    if (mode === 'odd_only') return '数字が消えたら奇数だけを見た順に入力してください。';
    return '数字が消えたら逆順で入力してください。';
  }
  if (mode === 'forward') return 'When the digits disappear, enter them in the same order.';
  if (mode === 'ascending') return 'When the digits disappear, enter them from smallest to largest.';
  if (mode === 'odd_only') return 'When the digits disappear, enter only the odd digits in order.';
  return 'When the digits disappear, enter them in reverse order.';
}

function digitPlaceholder(locale: Parameters<typeof getDiagnosisUiCopy>[0], mode: DigitSpanMode, fallback: string): string {
  if (mode === 'reverse') return fallback;
  if (locale === 'ko') {
    if (mode === 'forward') return '본 순서대로 입력';
    if (mode === 'ascending') return '작은 수부터 입력';
    return '홀수만 입력';
  }
  if (locale === 'ja') {
    if (mode === 'forward') return '見た順に入力';
    if (mode === 'ascending') return '小さい順に入力';
    return '奇数だけ入力';
  }
  if (mode === 'forward') return 'Enter the same order';
  if (mode === 'ascending') return 'Enter from smallest';
  return 'Enter odd digits only';
}

function buildVisualTrials(): VisualTrial[] {
  return Array.from({ length: 4 }, () => shuffleVisualTrial(generateVisualTrial()));
}

function generateVisualTrial(): VisualTrial {
  const base = buildVisualToken(3);
  const odd = mutateVisualToken(base);
  return {
    options: [base, odd, base, base],
    answer: 1,
  };
}

function buildVisualToken(length: number): string {
  return Array.from({ length }, () => sampleOne(VISUAL_CHAR_POOL)).join('');
}

function mutateVisualToken(token: string): string {
  const position = Math.floor(Math.random() * token.length);
  const current = token[position];
  const alternatives = VISUAL_CHAR_POOL.filter((char) => char !== current);
  const replacement = sampleOne(alternatives);
  return `${token.slice(0, position)}${replacement}${token.slice(position + 1)}`;
}

function sampleOne<T>(values: T[]): T {
  return values[Math.floor(Math.random() * values.length)];
}

function buildDiagnosisQueue(
  coreItems: DiagnosisLanguageMicroItem[],
): DiagnosisLanguageMicroItem[] {
  if (coreItems.length === 0) {
    return [];
  }

  const targetCounts = coreItems.reduce<Record<DiagnosisPromptType, number>>((acc, item) => {
    acc[item.prompt_type] = (acc[item.prompt_type] ?? 0) + 1;
    return acc;
  }, {
    SURFACE_TO_MEANING: 0,
    SURFACE_TO_READING: 0,
    MEANING_TO_SURFACE: 0,
    MCQ: 0,
  });

  const combinedPool = shuffle(coreItems.map(cloneDiagnosisItem));
  const picked: DiagnosisLanguageMicroItem[] = [];
  const usedIds = new Set<string>();

  for (const promptType of DIAGNOSIS_PROMPT_TYPES) {
    const requiredCount = targetCounts[promptType];
    if (requiredCount <= 0) continue;

    for (const item of combinedPool) {
      if (item.prompt_type !== promptType || usedIds.has(item.id)) continue;
      picked.push(item);
      usedIds.add(item.id);
      if (picked.filter((candidate) => candidate.prompt_type === promptType).length >= requiredCount) {
        break;
      }
    }
  }

  return shuffle(picked).slice(0, coreItems.length);
}

function cloneDiagnosisItem(item: DiagnosisLanguageMicroItem): DiagnosisLanguageMicroItem {
  return {
    ...item,
    choices: item.choices ? shuffle(item.choices) : undefined,
  };
}

function normalizeAnswer(value: string): string {
  return value.trim().replace(/\s+/g, '').toLowerCase();
}

function formatMinuteLabel(locale: Parameters<typeof getDiagnosisUiCopy>[0], value: number): string {
  if (locale === 'ko') return `${value}분`;
  if (locale === 'ja') return `${value}分`;
  return `${value} min`;
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      padding: 20,
      backgroundColor: colors.background,
      flexGrow: 1,
    },
    panel: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 20,
      gap: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },
    title: {
      fontSize: 24,
      fontWeight: '800',
      color: colors.text,
      textAlign: 'center',
    },
    desc: {
      fontSize: 14,
      color: colors.textMuted,
      textAlign: 'center',
      lineHeight: 20,
    },
    progress: {
      fontSize: 12,
      color: colors.textMuted,
      textAlign: 'center',
    },
    label: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 8,
    },
    row: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 99,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceAlt,
    },
    chipSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    chipText: {
      color: colors.text,
      fontSize: 13,
    },
    chipTextSelected: {
      color: colors.onPrimary,
      fontWeight: '700',
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 14,
      fontSize: 16,
      textAlign: 'center',
      color: colors.text,
      backgroundColor: colors.background,
    },
    button: {
      backgroundColor: colors.primary,
      padding: 16,
      borderRadius: 12,
      alignItems: 'center',
    },
    buttonSecondary: {
      backgroundColor: colors.primarySoft,
      borderWidth: 1,
      borderColor: colors.primaryBorder,
    },
    buttonText: {
      color: colors.onPrimary,
      fontSize: 15,
      fontWeight: '700',
    },
    buttonTextSecondary: {
      color: colors.primary,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    card: {
      backgroundColor: colors.surfaceAlt,
      borderRadius: 14,
      padding: 16,
      alignItems: 'center',
    },
    cardTitle: {
      fontSize: 24,
      fontWeight: '800',
      color: colors.text,
    },
    cardBody: {
      fontSize: 13,
      color: colors.textMuted,
      marginTop: 8,
      textAlign: 'center',
    },
    big: {
      fontSize: 40,
      fontWeight: '800',
      color: colors.text,
      textAlign: 'center',
    },
    stack: {
      gap: 10,
    },
    notice: {
      backgroundColor: colors.surfaceAlt,
      borderRadius: 12,
      padding: 14,
      gap: 4,
    },
    noticeText: {
      fontSize: 13,
      color: colors.text,
      lineHeight: 18,
    },
  });
}
