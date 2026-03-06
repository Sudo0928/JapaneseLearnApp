/**
 * DiagnosisScreen — 학습 방식 진단 (인지심리학 기반)
 *
 * report.mdc 원칙:
 *  - 진단 목적: 레벨테스트 X, 전략 프로파일(strategy_vector) 초기값 산출
 *  - 측정 축: recall_gap, form_weak, load_sensitive (행동 기반)
 *  - 일본어 단어 X → 중립적 기호·숫자로 측정
 *
 * 4단계 구성 (총 약 6~8분):
 *  Phase 1: 자기평가    (목표·시간·약점 선택)
 *  Phase 2: 기억쌍 테스트 (기호-의미 학습 → 인출 vs 재인)  → recall_gap
 *  Phase 3: 역순 기억   (작업기억 스팬 테스트)              → load_sensitive
 *  Phase 4: 시각 변별   (유사 형태 구별)                   → form_weak
 *  Result:  전략 벡터 시각화
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
} from 'react-native';
import { getValidAppToken } from '../services/secure-storage';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL ?? 'http://localhost:3000';

// ─── 타입 ──────────────────────────────────────────────────────

interface DiagResult {
  strategy_vector: {
    recall_gap: number;
    reading_weak: number;
    form_weak: number;
    load_sensitive: number;
  };
  weakness_flags: string[];
  notes: string[];
}

type DiagPhase =
  | 'intro'
  | 'self_assessment'
  | 'memory_study'
  | 'memory_recall'
  | 'memory_recognition'
  | 'digit_span'
  | 'visual_discrimination'
  | 'result'
  | 'error';

interface SelfAssessmentData {
  target_level: string;
  daily_minutes: number;
  weak_areas: string[];
}

interface MemoryAnswer {
  pair_id: string;
  type: 'recall' | 'recognition';
  correct: boolean;
  rt_ms: number;
}

// ─── 기호-의미 쌍 (일본어 없음, 중립 기호) ─────────────────────

const SYMBOL_PAIRS = [
  { id: 'p1', symbol: '🌙', meaning: '잔잔함', decoys: ['격렬함', '차가움', '빠름'] },
  { id: 'p2', symbol: '🔥', meaning: '격렬함', decoys: ['잔잔함', '흐름', '부드러움'] },
  { id: 'p3', symbol: '❄️', meaning: '차가움', decoys: ['빠름', '잔잔함', '격렬함'] },
  { id: 'p4', symbol: '⚡', meaning: '빠름',   decoys: ['차가움', '흐름', '잔잔함'] },
  { id: 'p5', symbol: '🌊', meaning: '흐름',   decoys: ['빠름', '부드러움', '격렬함'] },
  { id: 'p6', symbol: '🍃', meaning: '부드러움', decoys: ['차가움', '격렬함', '흐름'] },
];

// 회상 테스트용 3개 / 재인 테스트용 3개로 분리
const RECALL_PAIRS       = SYMBOL_PAIRS.slice(0, 3);
const RECOGNITION_PAIRS  = SYMBOL_PAIRS.slice(3, 6);

// ─── 숫자 역순 테스트 ──────────────────────────────────────────

const DIGIT_SEQUENCES = [
  { id: 'd4a', digits: [3, 7, 1, 9],       reverse: '9173' },
  { id: 'd5a', digits: [5, 2, 8, 4, 1],    reverse: '14825' },
  { id: 'd5b', digits: [6, 3, 9, 2, 7],    reverse: '72936' },
  { id: 'd6a', digits: [4, 8, 1, 5, 3, 7], reverse: '735184' },
];

// ─── 시각 변별 (4지선다 중 다른 1개 찾기) ───────────────────────

const VISUAL_TRIALS = [
  {
    id: 'v1', prompt: '다른 하나는?',
    options: ['ㅇ', 'ㅇ', 'ㅁ', 'ㅇ'], answer: 2,
  },
  {
    id: 'v2', prompt: '다른 하나는?',
    options: ['△', '▲', '△', '△'], answer: 1,
  },
  {
    id: 'v3', prompt: '다른 하나는?',
    options: ['ㅎ', 'ㅎ', 'ㅎ', 'ㅓ'], answer: 3,
  },
  {
    id: 'v4', prompt: '다른 하나는?',
    options: ['水', '水', '氷', '水'], answer: 2,
  },
];

// ─── 메인 컴포넌트 ─────────────────────────────────────────────

interface DiagnosisScreenProps {
  onComplete: (result?: DiagResult) => void;
  onSkip: () => void;
}

export default function DiagnosisScreen({ onComplete, onSkip }: DiagnosisScreenProps) {
  const [phase, setPhase]   = useState<DiagPhase>('intro');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [result, setResult] = useState<DiagResult | null>(null);

  // Phase 1: 자기평가
  const [selfAssessment, setSelfAssessment] = useState<SelfAssessmentData>({
    target_level: '',
    daily_minutes: 0,
    weak_areas: [],
  });

  // Phase 2: 기억쌍
  const [studyTimerLeft, setStudyTimerLeft] = useState(20);
  const studyTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [memoryAnswers, setMemoryAnswers]   = useState<MemoryAnswer[]>([]);
  const [currentPairIdx, setCurrentPairIdx] = useState(0);
  const [recallInput, setRecallInput]       = useState('');
  const [pairStartTime, setPairStartTime]   = useState(Date.now());

  // Phase 3: 역순 기억
  const [digitIdx, setDigitIdx]       = useState(0);
  const [showDigits, setShowDigits]   = useState(true);
  const [digitInput, setDigitInput]   = useState('');
  const [digitStartTime, setDigitStartTime] = useState(Date.now());
  const [digitSpanMax, setDigitSpanMax] = useState(3);
  const [digitAnswers, setDigitAnswers] = useState<{ id: string; correct: boolean }[]>([]);
  const digitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Phase 4: 시각 변별
  const [visualIdx, setVisualIdx]     = useState(0);
  const [visualStartTime, setVisualStartTime] = useState(Date.now());
  const [visualAnswers, setVisualAnswers] = useState<{ id: string; correct: boolean; rt_ms: number }[]>([]);

  // ── Study 타이머 시작 ────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'memory_study') return;
    setStudyTimerLeft(20);
    studyTimerRef.current = setInterval(() => {
      setStudyTimerLeft((t) => {
        if (t <= 1) {
          if (studyTimerRef.current) clearInterval(studyTimerRef.current);
          setCurrentPairIdx(0);
          setPairStartTime(Date.now());
          setPhase('memory_recall');
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => { if (studyTimerRef.current) clearInterval(studyTimerRef.current); };
  }, [phase]);

  // ── 숫자 표시 타이머 ────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'digit_span') return;
    setShowDigits(true);
    setDigitInput('');
    digitTimerRef.current = setTimeout(() => {
      setShowDigits(false);
      setDigitStartTime(Date.now());
    }, 2500);
    return () => { if (digitTimerRef.current) clearTimeout(digitTimerRef.current); };
  }, [phase, digitIdx]);

  // ── 시각 변별 시작 시간 ──────────────────────────────────────
  useEffect(() => {
    if (phase === 'visual_discrimination') setVisualStartTime(Date.now());
  }, [phase, visualIdx]);

  // ── 회상 답변 처리 ───────────────────────────────────────────
  const handleRecallAnswer = useCallback(() => {
    const pair = RECALL_PAIRS[currentPairIdx];
    const rt   = Date.now() - pairStartTime;
    const correct = recallInput.trim() === pair.meaning;

    setMemoryAnswers((prev) => [...prev, { pair_id: pair.id, type: 'recall', correct, rt_ms: rt }]);
    setRecallInput('');

    if (currentPairIdx + 1 < RECALL_PAIRS.length) {
      setCurrentPairIdx((i) => i + 1);
      setPairStartTime(Date.now());
    } else {
      setCurrentPairIdx(0);
      setPairStartTime(Date.now());
      setPhase('memory_recognition');
    }
  }, [currentPairIdx, pairStartTime, recallInput]);

  // ── 재인 답변 처리 ───────────────────────────────────────────
  const handleRecognitionAnswer = useCallback((chosen: string) => {
    const pair = RECOGNITION_PAIRS[currentPairIdx];
    const rt   = Date.now() - pairStartTime;
    const correct = chosen === pair.meaning;

    setMemoryAnswers((prev) => [...prev, { pair_id: pair.id, type: 'recognition', correct, rt_ms: rt }]);

    if (currentPairIdx + 1 < RECOGNITION_PAIRS.length) {
      setCurrentPairIdx((i) => i + 1);
      setPairStartTime(Date.now());
    } else {
      setDigitIdx(0);
      setPhase('digit_span');
    }
  }, [currentPairIdx, pairStartTime]);

  // ── 역순 숫자 답변 처리 ─────────────────────────────────────
  const handleDigitAnswer = useCallback(() => {
    const seq = DIGIT_SEQUENCES[digitIdx];
    const correct = digitInput.trim() === seq.reverse;
    const newAnswers = [...digitAnswers, { id: seq.id, correct }];
    setDigitAnswers(newAnswers);

    if (correct) setDigitSpanMax(seq.digits.length);

    if (digitIdx + 1 < DIGIT_SEQUENCES.length) {
      setDigitIdx((i) => i + 1);
    } else {
      setVisualIdx(0);
      setPhase('visual_discrimination');
    }
  }, [digitIdx, digitInput, digitAnswers]);

  // ── 시각 변별 처리 ──────────────────────────────────────────
  const handleVisualAnswer = useCallback((chosen: number) => {
    const trial = VISUAL_TRIALS[visualIdx];
    const rt    = Date.now() - visualStartTime;
    const correct = chosen === trial.answer;
    const newAnswers = [...visualAnswers, { id: trial.id, correct, rt_ms: rt }];
    setVisualAnswers(newAnswers);

    if (visualIdx + 1 < VISUAL_TRIALS.length) {
      setVisualIdx((i) => i + 1);
    } else {
      submitCognitiveDiagnosis(newAnswers);
    }
  }, [visualIdx, visualStartTime, visualAnswers, memoryAnswers, selfAssessment, digitSpanMax]);

  // ── 최종 제출 ───────────────────────────────────────────────
  async function submitCognitiveDiagnosis(
    finalVisualAnswers: { id: string; correct: boolean; rt_ms: number }[],
  ) {
    setLoading(true);
    setPhase('result');

    const recallAnswers  = memoryAnswers.filter((a) => a.type === 'recall');
    const recogAnswers   = memoryAnswers.filter((a) => a.type === 'recognition');
    const recallCorrect  = recallAnswers.filter((a) => a.correct).length;
    const recogCorrect   = recogAnswers.filter((a) => a.correct).length;
    const visualCorrect  = finalVisualAnswers.filter((a) => a.correct).length;

    const payload = {
      phase: 'cognitive_v2',
      self_assessment: selfAssessment,
      memory_pairs: {
        recall_correct:      recallCorrect,
        recall_total:        RECALL_PAIRS.length,
        recognition_correct: recogCorrect,
        recognition_total:   RECOGNITION_PAIRS.length,
        avg_rt_ms: memoryAnswers.length
          ? Math.round(memoryAnswers.reduce((s, a) => s + a.rt_ms, 0) / memoryAnswers.length)
          : 3000,
      },
      digit_span:       { max_correct_span: digitSpanMax },
      visual_discrimination: {
        correct: visualCorrect,
        total:   VISUAL_TRIALS.length,
        avg_rt_ms: finalVisualAnswers.length
          ? Math.round(finalVisualAnswers.reduce((s, a) => s + a.rt_ms, 0) / finalVisualAnswers.length)
          : 3000,
      },
    };

    try {
      const token = await getValidAppToken();
      const res = await fetch(`${BACKEND_URL}/v1/diagnosis/submit-v2`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json() as DiagResult;
        setResult(data);
      } else {
        setResult(buildFallbackResult(recallCorrect, recogCorrect, digitalSpanToSensitivity(digitSpanMax), visualCorrect));
      }
    } catch {
      setResult(buildFallbackResult(recallCorrect, recogCorrect, digitalSpanToSensitivity(digitSpanMax), visualCorrect));
    } finally {
      setLoading(false);
    }
  }

  function digitalSpanToSensitivity(span: number): number {
    if (span >= 6) return 0.1;
    if (span >= 5) return 0.35;
    if (span >= 4) return 0.55;
    return 0.75;
  }

  function buildFallbackResult(
    recallCorrect: number, recogCorrect: number,
    loadSens: number, visualCorrect: number,
  ): DiagResult {
    const recallRate  = recallCorrect / RECALL_PAIRS.length;
    const recogRate   = recogCorrect / RECOGNITION_PAIRS.length;
    const recall_gap  = Math.max(0, recogRate - recallRate);
    const form_weak   = 1 - visualCorrect / VISUAL_TRIALS.length;
    const reading_weak = selfAssessment.weak_areas.includes('reading') ? 0.7 : 0.3;

    return {
      strategy_vector: { recall_gap, reading_weak, form_weak, load_sensitive: loadSens },
      weakness_flags: [
        ...(recall_gap >= 0.4 ? ['recall_weak'] : []),
        ...(reading_weak >= 0.6 ? ['reading_weak'] : []),
        ...(form_weak >= 0.5 ? ['form_weak'] : []),
        ...(loadSens >= 0.6 ? ['load_sensitive'] : []),
      ],
      notes: [],
    };
  }

  // ── 스킵 ────────────────────────────────────────────────────
  function handleSkip() {
    Alert.alert(
      '진단 건너뛰기',
      '진단 없이 시작하면 기본 플랜이 적용됩니다. 나중에 홈에서 다시 받을 수 있어요.',
      [
        { text: '계속 진단', style: 'cancel' },
        { text: '건너뛰기', onPress: () => onSkip() },
      ],
    );
  }

  // ─────────────────── 렌더링 ─────────────────────────────────

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">

        {/* ── 인트로 ───────────────────────────────────── */}
        {phase === 'intro' && (
          <View style={styles.phaseContainer}>
            <Text style={styles.bigEmoji}>🎯</Text>
            <Text style={styles.pageTitle}>학습 방식 진단</Text>
            <Text style={styles.pageDesc}>
              일본어 실력을 테스트하는 것이 아닙니다.{'\n'}
              당신의 <Text style={{ fontWeight: '700' }}>기억 전략 유형</Text>을 파악합니다.
            </Text>

            <View style={styles.infoCard}>
              <InfoRow icon="🧠" text="기억 인출 방식 (스스로 떠올리기 vs 보고 고르기)" />
              <InfoRow icon="⚡" text="작업기억 용량 (한 번에 처리 가능한 정보량)" />
              <InfoRow icon="👁" text="형태 변별력 (유사한 패턴 구분 능력)" />
            </View>

            <View style={styles.metaRow}>
              <Text style={styles.metaText}>⏱ 약 6~8분</Text>
              <Text style={styles.metaText}>📊 4단계</Text>
            </View>

            <TouchableOpacity style={styles.primaryBtn} onPress={() => setPhase('self_assessment')}>
              <Text style={styles.primaryBtnText}>진단 시작 →</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleSkip} style={styles.skipBtn}>
              <Text style={styles.skipText}>나중에 하기</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Phase 1: 자기평가 ────────────────────────── */}
        {phase === 'self_assessment' && (
          <View style={styles.phaseContainer}>
            <PhaseIndicator current={1} total={4} label="자기평가" />
            <Text style={styles.sectionTitle}>학습 목표와 환경을 알려주세요</Text>

            <Question label="목표 레벨">
              {['N5', 'N4', 'N3', '회화 위주'].map((lv) => (
                <SelectChip
                  key={lv} label={lv}
                  selected={selfAssessment.target_level === lv}
                  onPress={() => setSelfAssessment((s) => ({ ...s, target_level: lv }))}
                />
              ))}
            </Question>

            <Question label="하루 학습 가능 시간">
              {[5, 10, 20, 30].map((m) => (
                <SelectChip
                  key={m} label={`${m}분`}
                  selected={selfAssessment.daily_minutes === m}
                  onPress={() => setSelfAssessment((s) => ({ ...s, daily_minutes: m }))}
                />
              ))}
            </Question>

            <Question label="가장 어렵게 느끼는 부분 (복수 선택)">
              {[
                { key: 'reading', label: '읽기(발음)' },
                { key: 'writing', label: '쓰기(표기)' },
                { key: 'vocab',   label: '단어 암기' },
                { key: 'grammar', label: '문법' },
              ].map(({ key, label }) => (
                <SelectChip
                  key={key} label={label}
                  selected={selfAssessment.weak_areas.includes(key)}
                  onPress={() => {
                    setSelfAssessment((s) => {
                      const has = s.weak_areas.includes(key);
                      return {
                        ...s,
                        weak_areas: has
                          ? s.weak_areas.filter((x) => x !== key)
                          : [...s.weak_areas, key],
                      };
                    });
                  }}
                />
              ))}
            </Question>

            <TouchableOpacity
              style={[
                styles.primaryBtn,
                (!selfAssessment.target_level || !selfAssessment.daily_minutes)
                  && styles.primaryBtnDisabled,
              ]}
              disabled={!selfAssessment.target_level || !selfAssessment.daily_minutes}
              onPress={() => setPhase('memory_study')}
            >
              <Text style={styles.primaryBtnText}>다음 →</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Phase 2a: 기억쌍 학습 ─────────────────────── */}
        {phase === 'memory_study' && (
          <View style={styles.phaseContainer}>
            <PhaseIndicator current={2} total={4} label="기억 방식 테스트" />
            <Text style={styles.sectionTitle}>아래 기호-의미 쌍을 기억하세요</Text>
            <Text style={styles.sectionDesc}>
              {studyTimerLeft}초 후 자동으로 테스트가 시작됩니다.
            </Text>

            <View style={styles.studyTimer}>
              <Text style={styles.timerText}>{studyTimerLeft}</Text>
            </View>

            <View style={styles.pairsGrid}>
              {SYMBOL_PAIRS.map(({ id, symbol, meaning }) => (
                <View key={id} style={styles.pairCard}>
                  <Text style={styles.pairSymbol}>{symbol}</Text>
                  <Text style={styles.pairArrow}>→</Text>
                  <Text style={styles.pairMeaning}>{meaning}</Text>
                </View>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: '#6B7280' }]}
              onPress={() => {
                if (studyTimerRef.current) clearInterval(studyTimerRef.current);
                setCurrentPairIdx(0);
                setPairStartTime(Date.now());
                setPhase('memory_recall');
              }}
            >
              <Text style={styles.primaryBtnText}>기억했어요 →</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Phase 2b: 회상 테스트 ────────────────────── */}
        {phase === 'memory_recall' && (
          <View style={styles.phaseContainer}>
            <PhaseIndicator current={2} total={4} label="기억 테스트 — 인출" />
            <Text style={styles.sectionTitle}>
              {currentPairIdx + 1}/{RECALL_PAIRS.length} — 이 기호의 의미는?
            </Text>
            <Text style={styles.sectionDesc}>
              직접 입력해 보세요 (힌트 없이)
            </Text>

            <Text style={styles.bigSymbol}>{RECALL_PAIRS[currentPairIdx]?.symbol}</Text>

            <TextInput
              style={styles.textInput}
              placeholder="의미를 입력하세요"
              value={recallInput}
              onChangeText={setRecallInput}
              autoFocus
              onSubmitEditing={handleRecallAnswer}
            />

            <TouchableOpacity style={styles.primaryBtn} onPress={handleRecallAnswer}>
              <Text style={styles.primaryBtnText}>확인 →</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                setRecallInput('모름');
                setTimeout(handleRecallAnswer, 50);
              }}
              style={styles.skipBtn}
            >
              <Text style={styles.skipText}>모르겠어요</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Phase 2c: 재인 테스트 ────────────────────── */}
        {phase === 'memory_recognition' && (
          <View style={styles.phaseContainer}>
            <PhaseIndicator current={2} total={4} label="기억 테스트 — 재인" />
            <Text style={styles.sectionTitle}>
              {currentPairIdx + 1}/{RECOGNITION_PAIRS.length} — 이 기호의 의미는?
            </Text>
            <Text style={styles.sectionDesc}>보기에서 선택하세요</Text>

            <Text style={styles.bigSymbol}>{RECOGNITION_PAIRS[currentPairIdx]?.symbol}</Text>

            <View style={styles.mcqGrid}>
              {shuffle([
                RECOGNITION_PAIRS[currentPairIdx]?.meaning ?? '',
                ...RECOGNITION_PAIRS[currentPairIdx]?.decoys ?? [],
              ]).map((opt, i) => (
                <TouchableOpacity
                  key={`${opt}-${i}`}
                  style={styles.mcqOption}
                  onPress={() => handleRecognitionAnswer(opt)}
                >
                  <Text style={styles.mcqOptionText}>{opt}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* ── Phase 3: 역순 기억 ───────────────────────── */}
        {phase === 'digit_span' && digitIdx < DIGIT_SEQUENCES.length && (
          <View style={styles.phaseContainer}>
            <PhaseIndicator current={3} total={4} label="작업기억 테스트" />
            <Text style={styles.sectionTitle}>
              {digitIdx + 1}/{DIGIT_SEQUENCES.length} — 숫자를 <Text style={{ color: '#ef4444' }}>역순</Text>으로 입력하세요
            </Text>
            <Text style={styles.sectionDesc}>
              {showDigits
                ? '숫자를 기억하세요'
                : '방금 본 숫자를 거꾸로 입력하세요'}
            </Text>

            {showDigits ? (
              <View style={styles.digitRow}>
                {DIGIT_SEQUENCES[digitIdx].digits.map((d, i) => (
                  <Text key={i} style={styles.digitChar}>{d}</Text>
                ))}
              </View>
            ) : (
              <>
                <TextInput
                  style={styles.textInput}
                  placeholder="역순으로 입력 (예: 9 3 7 → 739)"
                  keyboardType="numeric"
                  value={digitInput}
                  onChangeText={setDigitInput}
                  autoFocus
                  onSubmitEditing={handleDigitAnswer}
                />
                <TouchableOpacity style={styles.primaryBtn} onPress={handleDigitAnswer}>
                  <Text style={styles.primaryBtnText}>확인 →</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => { setDigitInput('?'); setTimeout(handleDigitAnswer, 50); }}
                  style={styles.skipBtn}
                >
                  <Text style={styles.skipText}>모르겠어요</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

        {/* ── Phase 4: 시각 변별 ───────────────────────── */}
        {phase === 'visual_discrimination' && visualIdx < VISUAL_TRIALS.length && (
          <View style={styles.phaseContainer}>
            <PhaseIndicator current={4} total={4} label="시각 변별 테스트" />
            <Text style={styles.sectionTitle}>
              {visualIdx + 1}/{VISUAL_TRIALS.length} — {VISUAL_TRIALS[visualIdx].prompt}
            </Text>
            <Text style={styles.sectionDesc}>나머지와 다른 하나를 고르세요</Text>

            <View style={styles.visualGrid}>
              {VISUAL_TRIALS[visualIdx].options.map((opt, i) => (
                <TouchableOpacity
                  key={`${opt}-${i}`}
                  style={styles.visualOption}
                  onPress={() => handleVisualAnswer(i)}
                >
                  <Text style={styles.visualOptionText}>{opt}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* ── 결과 ─────────────────────────────────────── */}
        {phase === 'result' && (
          <View style={styles.phaseContainer}>
            {loading ? (
              <View style={{ alignItems: 'center', gap: 16, paddingVertical: 60 }}>
                <ActivityIndicator size="large" color="#4A6CF7" />
                <Text style={{ color: '#666' }}>결과를 분석 중입니다...</Text>
              </View>
            ) : result ? (
              <ResultView result={result} onComplete={() => onComplete(result)} />
            ) : (
              <View style={{ alignItems: 'center', gap: 16 }}>
                <Text style={styles.bigEmoji}>⚠️</Text>
                <Text style={styles.sectionTitle}>결과 저장 중 오류</Text>
                <TouchableOpacity style={styles.primaryBtn} onPress={() => onComplete()}>
                  <Text style={styles.primaryBtnText}>기본 플랜으로 시작</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── 결과 뷰 ──────────────────────────────────────────────────

function ResultView({ result, onComplete }: { result: DiagResult; onComplete: () => void }) {
  const sv     = result.strategy_vector;
  const axes = [
    { key: 'recall_gap' as const,    label: '회상 ↔ 재인 격차', icon: '🧠' },
    { key: 'reading_weak' as const,  label: '읽기 취약도',      icon: '📖' },
    { key: 'form_weak' as const,     label: '형태 혼동',        icon: '👁' },
    { key: 'load_sensitive' as const,label: '인지 부하 민감도', icon: '⚡' },
  ];

  return (
    <View>
      <Text style={styles.bigEmoji}>🎉</Text>
      <Text style={styles.pageTitle}>진단 완료!</Text>
      <Text style={styles.pageDesc}>당신의 학습 전략 프로파일입니다.</Text>

      <View style={styles.infoCard}>
        {axes.map(({ key, label, icon }) => {
          const v = sv[key] ?? 0;
          return (
            <View key={key} style={{ marginBottom: 14 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 13, color: '#444' }}>{icon} {label}</Text>
                <Text style={{ fontSize: 13, fontWeight: '700', color: barColor(v) }}>
                  {Math.round(v * 100)}%
                </Text>
              </View>
              <View style={styles.barTrack}>
                <View
                  style={[styles.barFill, {
                    width: `${Math.round(v * 100)}%` as any,
                    backgroundColor: barColor(v),
                  }]}
                />
              </View>
            </View>
          );
        })}
      </View>

      {result.notes && result.notes.length > 0 && (
        <View style={styles.infoCard}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: '#1A1A2E', marginBottom: 10 }}>
            💡 맞춤 인사이트
          </Text>
          {result.notes.map((n, i) => (
            <Text key={i} style={{ fontSize: 13, color: '#444', lineHeight: 20, marginBottom: 6 }}>
              • {n}
            </Text>
          ))}
        </View>
      )}

      <TouchableOpacity style={styles.primaryBtn} onPress={onComplete}>
        <Text style={styles.primaryBtnText}>맞춤 플랜으로 시작 →</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── 유틸 컴포넌트 ─────────────────────────────────────────────

function PhaseIndicator({ current, total, label }: { current: number; total: number; label: string }) {
  return (
    <View style={{ marginBottom: 20 }}>
      <View style={{ flexDirection: 'row', gap: 6, marginBottom: 6 }}>
        {Array.from({ length: total }, (_, i) => (
          <View
            key={i}
            style={{
              height: 4, flex: 1, borderRadius: 2,
              backgroundColor: i < current ? '#4A6CF7' : '#E5E7EB',
            }}
          />
        ))}
      </View>
      <Text style={{ fontSize: 12, color: '#888' }}>
        {current}/{total} — {label}
      </Text>
    </View>
  );
}

function InfoRow({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10, alignItems: 'flex-start' }}>
      <Text style={{ fontSize: 16 }}>{icon}</Text>
      <Text style={{ flex: 1, fontSize: 13, color: '#444', lineHeight: 20 }}>{text}</Text>
    </View>
  );
}

function Question({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: 20 }}>
      <Text style={styles.questionLabel}>{label}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{children}</View>
    </View>
  );
}

function SelectChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[styles.chip, selected && styles.chipSelected]}
      onPress={onPress}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </TouchableOpacity>
  );
}

function barColor(v: number): string {
  if (v >= 0.7) return '#ef4444';
  if (v >= 0.4) return '#f59e0b';
  return '#10b981';
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── 스타일 ───────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:      { padding: 24, backgroundColor: '#F8F9FF', flexGrow: 1 },
  phaseContainer: { flex: 1, alignItems: 'center' },

  bigEmoji:  { fontSize: 60, marginBottom: 12, textAlign: 'center' },
  pageTitle: { fontSize: 24, fontWeight: '800', color: '#1A1A2E', textAlign: 'center', marginBottom: 8 },
  pageDesc:  { fontSize: 14, color: '#666', textAlign: 'center', lineHeight: 22, marginBottom: 24 },

  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#1A1A2E', textAlign: 'center', marginBottom: 8 },
  sectionDesc:  { fontSize: 13, color: '#888', textAlign: 'center', marginBottom: 20 },

  infoCard: {
    width: '100%', backgroundColor: '#fff', borderRadius: 16, padding: 20,
    marginBottom: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  metaRow:  { flexDirection: 'row', gap: 20, marginBottom: 24 },
  metaText: { fontSize: 13, color: '#666' },

  primaryBtn: {
    width: '100%', backgroundColor: '#4A6CF7', borderRadius: 14,
    padding: 18, alignItems: 'center', marginBottom: 12,
  },
  primaryBtnDisabled: { backgroundColor: '#CBD5E1' },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  skipBtn:  { padding: 10, alignItems: 'center' },
  skipText: { color: '#aaa', fontSize: 14 },

  studyTimer: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#4A6CF7', alignItems: 'center', justifyContent: 'center', marginBottom: 24,
  },
  timerText: { color: '#fff', fontSize: 32, fontWeight: '800' },

  pairsGrid: { width: '100%', flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  pairCard: {
    width: '47%', backgroundColor: '#fff', borderRadius: 12,
    padding: 16, flexDirection: 'row', alignItems: 'center', gap: 8,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  pairSymbol:  { fontSize: 28 },
  pairArrow:   { fontSize: 14, color: '#aaa' },
  pairMeaning: { fontSize: 15, fontWeight: '600', color: '#1A1A2E' },

  bigSymbol: { fontSize: 80, marginVertical: 24, textAlign: 'center' },

  textInput: {
    width: '100%', borderWidth: 2, borderColor: '#E5E7EB',
    borderRadius: 12, padding: 16, fontSize: 18,
    backgroundColor: '#fff', marginBottom: 16, textAlign: 'center',
  },

  mcqGrid: { width: '100%', gap: 10, marginBottom: 24 },
  mcqOption: {
    backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#E5E7EB',
    borderRadius: 12, padding: 18, alignItems: 'center',
  },
  mcqOptionText: { fontSize: 16, fontWeight: '600', color: '#1A1A2E' },

  digitRow:  { flexDirection: 'row', gap: 12, marginBottom: 32 },
  digitChar: { fontSize: 40, fontWeight: '800', color: '#4A6CF7' },

  visualGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 16,
    justifyContent: 'center', marginBottom: 24,
  },
  visualOption: {
    width: 90, height: 90, backgroundColor: '#fff',
    borderRadius: 16, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#E5E7EB',
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  visualOptionText: { fontSize: 36, fontWeight: '700' },

  questionLabel: { fontSize: 14, fontWeight: '600', color: '#444', marginBottom: 8 },
  chip: {
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 100,
    borderWidth: 1.5, borderColor: '#E5E7EB', backgroundColor: '#fff',
  },
  chipSelected:    { backgroundColor: '#4A6CF7', borderColor: '#4A6CF7' },
  chipText:        { fontSize: 14, color: '#555' },
  chipTextSelected:{ color: '#fff', fontWeight: '700' },

  barTrack: { height: 6, backgroundColor: '#F0F0F0', borderRadius: 3, overflow: 'hidden', marginTop: 4 },
  barFill:  { height: 6, borderRadius: 3 },
});
