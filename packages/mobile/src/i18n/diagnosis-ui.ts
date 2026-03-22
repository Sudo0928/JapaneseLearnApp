import type { SupportedLocale } from '@japanese-learn/shared';

export interface DiagnosisUiCopy {
  introTitle: string;
  introDescription: string;
  startDiagnosis: string;
  skip: string;
  skipTitle: string;
  skipMessage: string;
  cancel: string;
  onboarding: string;
  memoryStudy: string;
  freeRecall: string;
  recognition: string;
  digitSpan: string;
  visual: string;
  language: (index: number, total: number) => string;
  targetLevel: string;
  focus: string;
  dailyMinutes: string;
  variability: string;
  kanji: string;
  flags: string;
  offlineExpected: string;
  notifications: string;
  targetDatePlaceholder: string;
  continue: string;
  memorizeFor: (seconds: number) => string;
  typeMeaning: string;
  reverseDigits: string;
  visualPrompt: string;
  typeAnswer: string;
  readingLabel: (reading: string) => string;
  savingResult: string;
  diagnosisComplete: string;
  diagnosisResultSummary: (version: string, questionCount: number) => string;
  noDiagnosisResult: string;
  continueToPlan: string;
  continueWithDefaultPlan: string;
  promptLabels: {
    surfaceToMeaning: string;
    surfaceToReading: string;
    meaningToSurface: string;
    mcq: string;
  };
  focusLabels: Record<'READING' | 'VOCAB' | 'PRODUCTION', string>;
  variabilityLabels: Record<'low' | 'medium' | 'high', string>;
  kanjiLabels: Record<'none' | 'basic' | 'native', string>;
}

const DIAGNOSIS_UI_COPY: Record<SupportedLocale, DiagnosisUiCopy> = {
  ko: {
    introTitle: '적응형 진단',
    introDescription: '온보딩, 인지 과제, 언어 문항 24~36개로 초기 전략을 만듭니다.',
    startDiagnosis: '진단 시작',
    skip: '건너뛰기',
    skipTitle: '진단 건너뛰기',
    skipMessage: '기본 플랜으로 시작하고 이후 행동 데이터를 바탕으로 적응합니다. 계속할까요?',
    cancel: '취소',
    onboarding: '온보딩',
    memoryStudy: '기억 학습',
    freeRecall: '자유 회상',
    recognition: '인식',
    digitSpan: '숫자 span',
    visual: '시각 구분',
    language: (index, total) => `언어 ${index}/${total}`,
    targetLevel: '목표 레벨',
    focus: '집중 영역',
    dailyMinutes: '일일 학습 시간',
    variability: '주간 변동성',
    kanji: '한자 배경',
    flags: '추가 설정',
    offlineExpected: '오프라인 사용 예정',
    notifications: '알림 허용',
    targetDatePlaceholder: '목표일 (YYYY-MM-DD)',
    continue: '계속',
    memorizeFor: (seconds) => `${seconds}초 동안 외우세요`,
    typeMeaning: '뜻을 입력하세요',
    reverseDigits: '거꾸로 입력하세요',
    visualPrompt: '다른 하나를 고르세요.',
    typeAnswer: '정답을 입력하세요',
    readingLabel: (reading) => `읽기: ${reading}`,
    savingResult: '진단 결과를 저장하는 중입니다...',
    diagnosisComplete: '진단 완료',
    diagnosisResultSummary: (version, questionCount) => `버전 ${version}, 언어 문항 ${questionCount}개`,
    noDiagnosisResult: '진단 결과가 없습니다',
    continueToPlan: '플랜으로 이동',
    continueWithDefaultPlan: '기본 플랜으로 계속',
    promptLabels: {
      surfaceToMeaning: '표기를 보고 뜻을 입력하세요.',
      surfaceToReading: '읽기를 로마자로 입력하세요.',
      meaningToSurface: '뜻에 맞는 일본어 표기를 고르세요.',
      mcq: '표기에 맞는 뜻을 고르세요.',
    },
    focusLabels: {
      READING: '읽기',
      VOCAB: '어휘',
      PRODUCTION: '산출',
    },
    variabilityLabels: {
      low: '낮음',
      medium: '보통',
      high: '높음',
    },
    kanjiLabels: {
      none: '없음',
      basic: '기초',
      native: '상급',
    },
  },
  en: {
    introTitle: 'Adaptive diagnosis',
    introDescription: 'Onboarding, cognitive probes, and 24 to 36 language prompts shape the initial strategy.',
    startDiagnosis: 'Start diagnosis',
    skip: 'Skip',
    skipTitle: 'Skip diagnosis',
    skipMessage: 'The app will start from a default plan and adapt later from behavior data. Continue?',
    cancel: 'Cancel',
    onboarding: 'Onboarding',
    memoryStudy: 'Memory study',
    freeRecall: 'Free recall',
    recognition: 'Recognition',
    digitSpan: 'Digit span',
    visual: 'Visual',
    language: (index, total) => `Language ${index}/${total}`,
    targetLevel: 'Target level',
    focus: 'Focus',
    dailyMinutes: 'Daily minutes',
    variability: 'Variability',
    kanji: 'Kanji',
    flags: 'Flags',
    offlineExpected: 'Offline expected',
    notifications: 'Notifications',
    targetDatePlaceholder: 'Target date (YYYY-MM-DD)',
    continue: 'Continue',
    memorizeFor: (seconds) => `Memorize for ${seconds}s`,
    typeMeaning: 'Type the meaning',
    reverseDigits: 'Reverse digits',
    visualPrompt: 'Pick the one that is different.',
    typeAnswer: 'Type your answer',
    readingLabel: (reading) => `Reading: ${reading}`,
    savingResult: 'Saving diagnosis result...',
    diagnosisComplete: 'Diagnosis complete',
    diagnosisResultSummary: (version, questionCount) => `Version ${version}, ${questionCount} language questions`,
    noDiagnosisResult: 'No diagnosis result',
    continueToPlan: 'Continue to plan',
    continueWithDefaultPlan: 'Continue with default plan',
    promptLabels: {
      surfaceToMeaning: 'Type the meaning shown by the surface.',
      surfaceToReading: 'Type the reading in romaji.',
      meaningToSurface: 'Pick the correct Japanese surface.',
      mcq: 'Pick the correct meaning for the surface.',
    },
    focusLabels: {
      READING: 'Reading',
      VOCAB: 'Vocab',
      PRODUCTION: 'Production',
    },
    variabilityLabels: {
      low: 'Low',
      medium: 'Medium',
      high: 'High',
    },
    kanjiLabels: {
      none: 'None',
      basic: 'Basic',
      native: 'Native',
    },
  },
  ja: {
    introTitle: '適応型診断',
    introDescription: 'オンボーディング、認知課題、24〜36 問の言語問題で初期戦略を作ります。',
    startDiagnosis: '診断を始める',
    skip: 'スキップ',
    skipTitle: '診断をスキップ',
    skipMessage: 'まずは標準プランで開始し、その後の行動データから適応します。続けますか？',
    cancel: 'キャンセル',
    onboarding: 'オンボーディング',
    memoryStudy: '記憶学習',
    freeRecall: '自由想起',
    recognition: '認識',
    digitSpan: '数字スパン',
    visual: '視覚識別',
    language: (index, total) => `言語 ${index}/${total}`,
    targetLevel: '目標レベル',
    focus: '重点領域',
    dailyMinutes: '1日の学習時間',
    variability: '変動性',
    kanji: '漢字背景',
    flags: '追加設定',
    offlineExpected: 'オフライン利用予定',
    notifications: '通知',
    targetDatePlaceholder: '目標日 (YYYY-MM-DD)',
    continue: '続ける',
    memorizeFor: (seconds) => `${seconds}秒間覚えてください`,
    typeMeaning: '意味を入力してください',
    reverseDigits: '逆順で入力してください',
    visualPrompt: '異なるものを1つ選んでください。',
    typeAnswer: '答えを入力してください',
    readingLabel: (reading) => `読み: ${reading}`,
    savingResult: '診断結果を保存しています...',
    diagnosisComplete: '診断完了',
    diagnosisResultSummary: (version, questionCount) => `バージョン ${version}、言語問題 ${questionCount} 問`,
    noDiagnosisResult: '診断結果がありません',
    continueToPlan: 'プランへ進む',
    continueWithDefaultPlan: '標準プランで続ける',
    promptLabels: {
      surfaceToMeaning: '表記を見て意味を入力してください。',
      surfaceToReading: '読みをローマ字で入力してください。',
      meaningToSurface: '意味に合う日本語表記を選んでください。',
      mcq: '表記に合う意味を選んでください。',
    },
    focusLabels: {
      READING: '読み',
      VOCAB: '語彙',
      PRODUCTION: '産出',
    },
    variabilityLabels: {
      low: '低い',
      medium: '中',
      high: '高い',
    },
    kanjiLabels: {
      none: 'なし',
      basic: '基礎',
      native: '上級',
    },
  },
};

export function getDiagnosisUiCopy(locale: SupportedLocale): DiagnosisUiCopy {
  return DIAGNOSIS_UI_COPY[locale];
}
