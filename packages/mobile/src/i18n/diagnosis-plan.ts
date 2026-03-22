import type { SupportedLocale } from '@japanese-learn/shared';

type LocaleText = Record<SupportedLocale, string>;

const MEANING_TRANSLATIONS: Record<string, LocaleText> = {
  wind: { ko: '바람', en: 'wind', ja: '風' },
  school: { ko: '학교', en: 'school', ja: '学校' },
  friend: { ko: '친구', en: 'friend', ja: '友達' },
  promise: { ko: '약속', en: 'promise', ja: '約束' },
  time: { ko: '시간', en: 'time', ja: '時間' },
  train: { ko: '기차', en: 'train', ja: '電車' },
  drink: { ko: '음료', en: 'drink', ja: '飲み物' },
  movie: { ko: '영화', en: 'movie', ja: '映画' },
  meeting: { ko: '회의', en: 'meeting', ja: '会議' },
  book: { ko: '책', en: 'book', ja: '本' },
  water: { ko: '물', en: 'water', ja: '水' },
  trip: { ko: '여행', en: 'trip', ja: '旅行' },
  dog: { ko: '개', en: 'dog', ja: '犬' },
  cat: { ko: '고양이', en: 'cat', ja: '猫' },
  mountain: { ko: '산', en: 'mountain', ja: '山' },
  sea: { ko: '바다', en: 'sea', ja: '海' },
  house: { ko: '집', en: 'house', ja: '家' },
  store: { ko: '가게', en: 'store', ja: '店' },
  morning: { ko: '아침', en: 'morning', ja: '朝' },
  night: { ko: '밤', en: 'night', ja: '夜' },
  phone: { ko: '전화', en: 'phone', ja: '電話' },
  today: { ko: '오늘', en: 'today', ja: '今日' },
  tomorrow: { ko: '내일', en: 'tomorrow', ja: '明日' },
  teacher: { ko: '선생님', en: 'teacher', ja: '先生' },
  newspaper: { ko: '신문', en: 'newspaper', ja: '新聞' },
  food: { ko: '음식', en: 'food', ja: '食べ物' },
  company: { ko: '회사', en: 'company', ja: '会社' },
  hospital: { ko: '병원', en: 'hospital', ja: '病院' },
  experience: { ko: '경험', en: 'experience', ja: '経験' },
  university: { ko: '대학교', en: 'university', ja: '大学' },
  classroom: { ko: '교실', en: 'classroom', ja: '教室' },
  library: { ko: '도서관', en: 'library', ja: '図書館' },
  work: { ko: '일', en: 'work', ja: '仕事' },
  car: { ko: '자동차', en: 'car', ja: '車' },
  weather: { ko: '날씨', en: 'weather', ja: '天気' },
  study: { ko: '공부', en: 'study', ja: '勉強' },
  letter: { ko: '편지', en: 'letter', ja: '手紙' },
};

const ADAPTIVE_REASON_TRANSLATIONS: Record<string, LocaleText> = {
  insufficient_surface_to_meaning: {
    ko: '표기에서 뜻으로 가는 샘플이 더 필요합니다.',
    en: 'More surface-to-meaning samples are needed.',
    ja: '表記から意味へのサンプルがさらに必要です。',
  },
  insufficient_surface_to_reading: {
    ko: '표기에서 읽기로 가는 샘플이 더 필요합니다.',
    en: 'More reading samples are needed.',
    ja: '表記から読みへのサンプルがさらに必要です。',
  },
  insufficient_meaning_to_surface: {
    ko: '뜻에서 표기로 가는 샘플이 더 필요합니다.',
    en: 'More form samples are needed.',
    ja: '意味から表記へのサンプルがさらに必要です。',
  },
  insufficient_mcq: {
    ko: '선택형 인식 샘플이 더 필요합니다.',
    en: 'More recognition samples are needed.',
    ja: '選択式の認識サンプルがさらに必要です。',
  },
  low_confidence_recall_gap: {
    ko: '회상과 인식의 차이를 아직 확정하기 어렵습니다.',
    en: 'Recall vs recognition is still ambiguous.',
    ja: '想起と認識の差はまだ曖昧です。',
  },
  low_confidence_reading: {
    ko: '읽기 취약 신뢰도가 아직 낮습니다.',
    en: 'Reading weakness confidence is still low.',
    ja: '読みの弱点に対する信頼度はまだ低いです。',
  },
  low_confidence_form: {
    ko: '표기 취약 신뢰도가 아직 낮습니다.',
    en: 'Form weakness confidence is still low.',
    ja: '表記の弱点に対する信頼度はまだ低いです。',
  },
  accuracy_rt_conflict: {
    ko: '정확도와 반응 시간 신호가 충돌합니다.',
    en: 'Accuracy and response time disagree.',
    ja: '正答率と反応時間のシグナルが一致していません。',
  },
};

const EXACT_MESSAGES: Array<{ sources: string[]; values: LocaleText }> = [
  {
    sources: [
      'Reading prompts start with extra emphasis because surface-to-reading accuracy is currently the weakest signal.',
    ],
    values: {
      ko: '현재는 표기→읽기 정확도가 가장 약한 신호라서 읽기 프롬프트를 더 강하게 반영합니다.',
      en: 'Reading prompts start with extra emphasis because surface-to-reading accuracy is currently the weakest signal.',
      ja: '現在は表記から読みへの正答率が最も弱いシグナルなので、読みの出題を強めに反映します。',
    },
  },
  {
    sources: [
      'Recognition is ahead of free recall, so early plans keep more retrieval practice before increasing MCQ share again.',
    ],
    values: {
      ko: '자유 회상보다 인식이 앞서 있으므로, 초반 플랜은 MCQ 비중을 다시 늘리기 전에 인출 연습을 더 유지합니다.',
      en: 'Recognition is ahead of free recall, so early plans keep more retrieval practice before increasing MCQ share again.',
      ja: '自由想起より認識が先行しているため、序盤のプランでは MCQ 比率を戻す前に想起練習を多めに維持します。',
    },
  },
  {
    sources: [
      'Production and form-confusion checks stay active until meaning-to-surface accuracy stabilizes.',
    ],
    values: {
      ko: '뜻→표기 정확도가 안정될 때까지 산출과 표기 혼동 점검을 계속 유지합니다.',
      en: 'Production and form-confusion checks stay active until meaning-to-surface accuracy stabilizes.',
      ja: '意味から表記への正答率が安定するまで、産出と表記混同チェックを継続します。',
    },
  },
  {
    sources: [
      'Shorter chunks and lighter new-card intake are recommended because working-memory load looks fragile.',
    ],
    values: {
      ko: '작업 기억 부하가 취약해 보여 세션 청크를 짧게 하고 신규 카드 투입을 가볍게 유지합니다.',
      en: 'Shorter chunks and lighter new-card intake are recommended because working-memory load looks fragile.',
      ja: 'ワーキングメモリ負荷が不安定に見えるため、セッションを短めに区切り、新規カード投入を軽めに保ちます。',
    },
  },
  {
    sources: [
      'Overdue recovery is handled conservatively because late reviews correlate with recall drop.',
    ],
    values: {
      ko: '연체 복구는 늦은 복습이 회상 저하와 연결되므로 보수적으로 처리합니다.',
      en: 'Overdue recovery is handled conservatively because late reviews correlate with recall drop.',
      ja: '遅延レビューは想起低下と相関するため、延滞回復は保守的に処理します。',
    },
  },
  {
    sources: [
      'The current profile is balanced, so the default plan keeps a mixed prompt distribution and a standard session chunk.',
    ],
    values: {
      ko: '현재 프로필은 균형적이므로 기본 플랜은 프롬프트를 고르게 섞고 표준 세션 청크를 유지합니다.',
      en: 'The current profile is balanced, so the default plan keeps a mixed prompt distribution and a standard session chunk.',
      ja: '現在のプロファイルはバランス型なので、基本プランは出題タイプを均等に混ぜ、標準的なセッション長を維持します。',
    },
  },
  {
    sources: [
      '회상 취약이 감지되어 선택형(MCQ) 비중을 일시 상향했습니다. 2주차에 회상 비중이 복귀됩니다.',
    ],
    values: {
      ko: '회상 취약이 감지되어 선택형(MCQ) 비중을 일시 상향했습니다. 2주차에 회상 비중이 복귀됩니다.',
      en: 'Recall weakness was detected, so MCQ share was raised temporarily. Retrieval-heavy balance returns in week 2.',
      ja: '想起の弱さが検出されたため、MCQ 比率を一時的に引き上げました。2 週目に想起比率を戻します。',
    },
  },
  {
    sources: [
      '읽기 혼동이 높아 표기→읽기 리콜 비중을 상향했습니다.',
    ],
    values: {
      ko: '읽기 혼동이 높아 표기→읽기 리콜 비중을 상향했습니다.',
      en: 'Reading confusion is high, so the surface-to-reading recall share was increased.',
      ja: '読みの混同が大きいため、表記から読みへの想起比率を引き上げました。',
    },
  },
  {
    sources: [
      '형태(표기) 취약이 감지되었습니다. 세션당 1-2문항의 미니 쓰기를 투입합니다.',
    ],
    values: {
      ko: '형태(표기) 취약이 감지되었습니다. 세션당 1-2문항의 미니 쓰기를 투입합니다.',
      en: 'Form weakness was detected. One or two mini-writing prompts are added per session.',
      ja: '表記の弱さが検出されました。各セッションに 1〜2 問のミニ書字問題を追加します。',
    },
  },
  {
    sources: [
      '연체 위험이 있어 신규 카드를 줄이고 복습 상한을 분산했습니다.',
    ],
    values: {
      ko: '연체 위험이 있어 신규 카드를 줄이고 복습 상한을 분산했습니다.',
      en: 'Lateness risk is elevated, so new cards were reduced and the review ceiling was spread out.',
      ja: '延滞リスクが高いため、新規カードを減らし、復習上限を分散しました。',
    },
  },
  {
    sources: [
      '인지부하 민감 패턴이 감지되었습니다. 세션을 5분 단위로 나눕니다.',
    ],
    values: {
      ko: '인지부하 민감 패턴이 감지되었습니다. 세션을 5분 단위로 나눕니다.',
      en: 'A cognitive-load sensitive pattern was detected. Sessions are split into 5-minute chunks.',
      ja: '認知負荷に敏感なパターンが検出されました。セッションを 5 分単位に分割します。',
    },
  },
  {
    sources: [
      'Behavior data contributes to the final strategy vector and keeps lateness risk behavior-only.',
    ],
    values: {
      ko: '행동 데이터가 최종 전략 벡터에 반영되며, 연체 위험 축은 행동 데이터만으로 유지합니다.',
      en: 'Behavior data contributes to the final strategy vector and keeps lateness risk behavior-only.',
      ja: '行動データを最終戦略ベクトルに反映し、延滞リスク軸は行動データのみで維持します。',
    },
  },
  {
    sources: [
      'SURFACE_TO_READING share increased by 10 percentage points for experiment exposure.',
    ],
    values: {
      ko: '실험 노출로 인해 표기→읽기 비중이 10%p 증가했습니다.',
      en: 'SURFACE_TO_READING share increased by 10 percentage points for experiment exposure.',
      ja: '実験割り当てにより、表記から読みの比率が 10 ポイント増加しました。',
    },
  },
  {
    sources: [
      'Retention target +0.03, review budget +20%, new cards -20%.',
    ],
    values: {
      ko: '목표 유지율은 +0.03, 복습 예산은 +20%, 신규 카드는 -20%로 조정되었습니다.',
      en: 'Retention target +0.03, review budget +20%, new cards -20%.',
      ja: '保持目標は +0.03、復習予算は +20%、新規カードは -20% に調整されました。',
    },
  },
  {
    sources: [
      'SURFACE_TO_READING share increased by 15 percentage points.',
    ],
    values: {
      ko: '표기→읽기 비중이 15%p 증가했습니다.',
      en: 'SURFACE_TO_READING share increased by 15 percentage points.',
      ja: '表記から読みの比率が 15 ポイント増加しました。',
    },
  },
  {
    sources: [
      'MEANING_TO_SURFACE share increased by 10 percentage points.',
    ],
    values: {
      ko: '뜻→표기 비중이 10%p 증가했습니다.',
      en: 'MEANING_TO_SURFACE share increased by 10 percentage points.',
      ja: '意味から表記の比率が 10 ポイント増加しました。',
    },
  },
  {
    sources: [
      'Session chunk capped at 10 minutes and new cards reduced by 10%.',
    ],
    values: {
      ko: '세션 청크는 최대 10분으로 제한되고 신규 카드는 10% 줄었습니다.',
      en: 'Session chunk capped at 10 minutes and new cards reduced by 10%.',
      ja: 'セッションの区切りは最大 10 分に制限され、新規カードは 10% 減りました。',
    },
  },
  {
    sources: [
      'Retrieval-heavy prompts stay elevated before recognition share expands again.',
    ],
    values: {
      ko: '인식 비중을 다시 늘리기 전까지 인출 중심 프롬프트를 높게 유지합니다.',
      en: 'Retrieval-heavy prompts stay elevated before recognition share expands again.',
      ja: '認識比率を再び増やす前に、想起中心の出題を高めに維持します。',
    },
  },
  {
    sources: [
      'Reading prompts are emphasized because surface-to-reading remains unstable.',
    ],
    values: {
      ko: '표기→읽기 축이 아직 불안정하므로 읽기 프롬프트를 강조합니다.',
      en: 'Reading prompts are emphasized because surface-to-reading remains unstable.',
      ja: '表記から読みの軸がまだ不安定なため、読みの出題を強調します。',
    },
  },
  {
    sources: [
      'Production checks stay active to reduce form confusion.',
    ],
    values: {
      ko: '표기 혼동을 줄이기 위해 산출 점검을 계속 유지합니다.',
      en: 'Production checks stay active to reduce form confusion.',
      ja: '表記混同を減らすため、産出チェックを継続します。',
    },
  },
  {
    sources: [
      'Hint steps remain conservative and session chunks shorten under cognitive load.',
    ],
    values: {
      ko: '인지 부하 구간에서는 힌트 단계를 보수적으로 유지하고 세션 청크를 줄입니다.',
      en: 'Hint steps remain conservative and session chunks shorten under cognitive load.',
      ja: '認知負荷が高い区間ではヒント段階を控えめに保ち、セッションを短くします。',
    },
  },
  {
    sources: [
      'New-card pace is reduced because late reviews already correlate with performance drop.',
    ],
    values: {
      ko: '늦은 복습이 성과 저하와 연결되므로 신규 카드 속도를 낮춥니다.',
      en: 'New-card pace is reduced because late reviews already correlate with performance drop.',
      ja: '遅延レビューが成績低下と相関しているため、新規カードの投入速度を下げます。',
    },
  },
  {
    sources: [
      'Overdue backlog is high, so a 7-day recovery plan is active with reduced new-card pressure.',
    ],
    values: {
      ko: '연체 백로그가 커서 신규 카드 압박을 낮춘 7일 회복 플랜이 활성화되었습니다.',
      en: 'Overdue backlog is high, so a 7-day recovery plan is active with reduced new-card pressure.',
      ja: '延滞バックログが大きいため、新規カード負荷を下げた 7 日回復プランが有効です。',
    },
  },
  {
    sources: [
      'A 3-day recovery plan is active to clear overdue cards without creating a review spike.',
    ],
    values: {
      ko: '복습 급증 없이 연체 카드를 정리하기 위해 3일 회복 플랜이 활성화되었습니다.',
      en: 'A 3-day recovery plan is active to clear overdue cards without creating a review spike.',
      ja: '復習の急増を起こさずに延滞カードを片づけるため、3 日回復プランが有効です。',
    },
  },
  {
    sources: [
      'A short 15-minute recovery session is recommended to prevent the backlog from compounding.',
    ],
    values: {
      ko: '백로그 누적을 막기 위해 15분짜리 짧은 회복 세션을 권장합니다.',
      en: 'A short 15-minute recovery session is recommended to prevent the backlog from compounding.',
      ja: 'バックログの積み上がりを防ぐため、15 分の短い回復セッションを勧めます。',
    },
  },
  {
    sources: [
      'The target date is close, so review load increased and new cards were reduced.',
    ],
    values: {
      ko: '목표일이 가까워 복습량을 늘리고 신규 카드를 줄였습니다.',
      en: 'The target date is close, so review load increased and new cards were reduced.',
      ja: '目標日が近いため、復習量を増やし、新規カードを減らしました。',
    },
  },
  {
    sources: [
      'Experiment treatment increases reading prompts by 10 percentage points.',
    ],
    values: {
      ko: '실험 처리군에서는 읽기 프롬프트 비중이 10%p 증가합니다.',
      en: 'Experiment treatment increases reading prompts by 10 percentage points.',
      ja: '実験の treatment 群では、読みの出題比率が 10 ポイント増加します。',
    },
  },
];

const PLAN_FACTOR_LABELS: Record<string, LocaleText> = {
  behavior_blend: { ko: '행동 데이터 반영', en: 'Behavior blend', ja: '行動データ反映' },
  ab_plan_mix: { ko: '플랜 실험', en: 'Plan experiment', ja: 'プラン実験' },
  recovery_plan: { ko: '회복 플랜', en: 'Recovery plan', ja: '回復プラン' },
  target_date: { ko: '목표일', en: 'Target date', ja: '目標日' },
  focus_reading: { ko: '읽기 집중', en: 'Reading focus', ja: '読み重視' },
  focus_production: { ko: '산출 집중', en: 'Production focus', ja: '産出重視' },
  offline_expected: { ko: '오프라인 예상', en: 'Offline expected', ja: 'オフライン想定' },
  recall_gap: { ko: '회상 격차', en: 'Recall gap', ja: '想起ギャップ' },
  reading_weak: { ko: '읽기 취약', en: 'Reading weakness', ja: '読みの弱点' },
  form_weak: { ko: '표기 취약', en: 'Form weakness', ja: '表記の弱点' },
  load_sensitive: { ko: '인지 부하 민감', en: 'Load sensitivity', ja: '認知負荷感度' },
  lateness_fragile: { ko: '연체 취약', en: 'Lateness fragility', ja: '延滞脆弱性' },
};

const PLAN_BASIS_LABELS: Record<string, LocaleText> = {
  diagnosis: { ko: '진단', en: 'Diagnosis', ja: '診断' },
  behavior: { ko: '행동', en: 'Behavior', ja: '行動' },
  goal: { ko: '목표', en: 'Goal', ja: '目標' },
  recovery: { ko: '회복', en: 'Recovery', ja: '回復' },
};

const GENERIC_LABELS = {
  recent_review_events: { ko: '최근 복습 이벤트', en: 'Recent review events', ja: '最近の復習イベント' },
  variant: { ko: '실험 variant', en: 'Variant', ja: 'variant' },
  overdue_cards: { ko: '연체 카드', en: 'Overdue cards', ja: '延滞カード' },
  days_to_target: { ko: '목표일까지', en: 'Days to target', ja: '目標日まで' },
  recall_gap: { ko: '회상 격차', en: 'Recall gap', ja: '想起ギャップ' },
  reading_weak: { ko: '읽기 취약', en: 'Reading weakness', ja: '読みの弱点' },
  form_weak: { ko: '표기 취약', en: 'Form weakness', ja: '表記の弱点' },
  load_sensitive: { ko: '인지 부하 민감', en: 'Load sensitivity', ja: '認知負荷感度' },
  lateness_fragile: { ko: '연체 취약', en: 'Lateness fragility', ja: '延滞脆弱性' },
  recognition: { ko: '인식', en: 'Recognition', ja: '認識' },
  recall: { ko: '회상', en: 'Recall', ja: '想起' },
  recall_accuracy: { ko: '회상 정확도', en: 'Recall accuracy', ja: '想起正答率' },
  mcq_accuracy: { ko: 'MCQ 정확도', en: 'MCQ accuracy', ja: 'MCQ 正答率' },
  surface_to_reading: { ko: '표기→읽기', en: 'Surface to reading', ja: '表記→読み' },
  meaning_to_surface: { ko: '뜻→표기', en: 'Meaning to surface', ja: '意味→表記' },
  accuracy: { ko: '정확도', en: 'Accuracy', ja: '正答率' },
  avg_rt: { ko: '평균 반응시간', en: 'Average response time', ja: '平均反応時間' },
  digit_span: { ko: '숫자 span', en: 'Digit span', ja: '数字スパン' },
  memory_avg_rt: { ko: '기억 평균 반응시간', en: 'Memory average response time', ja: '記憶平均反応時間' },
  daily_minutes: { ko: '일일 학습 시간', en: 'Daily study time', ja: '1日の学習時間' },
  weekly_variability: { ko: '주간 변동성', en: 'Weekly variability', ja: '週次変動' },
  offline_expected: { ko: '오프라인 예상', en: 'Offline expected', ja: 'オフライン想定' },
} as const;

const BOOLEAN_LABELS: Record<'true' | 'false', LocaleText> = {
  true: { ko: '예', en: 'Yes', ja: 'はい' },
  false: { ko: '아니오', en: 'No', ja: 'いいえ' },
};

const WEEKLY_VARIABILITY_LABELS: Record<'low' | 'medium' | 'high', LocaleText> = {
  low: { ko: '낮음', en: 'Low', ja: '低い' },
  medium: { ko: '보통', en: 'Medium', ja: '中' },
  high: { ko: '높음', en: 'High', ja: '高い' },
};

const FOCUS_VALUE_LABELS: Record<'READING' | 'VOCAB' | 'PRODUCTION', LocaleText> = {
  READING: { ko: '읽기', en: 'Reading', ja: '読み' },
  VOCAB: { ko: '어휘', en: 'Vocab', ja: '語彙' },
  PRODUCTION: { ko: '산출', en: 'Production', ja: '産出' },
};

const REVERSE_MEANING_LOOKUPS: Record<SupportedLocale, Map<string, string>> = {
  ko: new Map<string, string>(),
  en: new Map<string, string>(),
  ja: new Map<string, string>(),
};

for (const [canonical, labels] of Object.entries(MEANING_TRANSLATIONS)) {
  for (const locale of Object.keys(REVERSE_MEANING_LOOKUPS) as SupportedLocale[]) {
    REVERSE_MEANING_LOOKUPS[locale].set(normalize(labels[locale]), labels.en);
    REVERSE_MEANING_LOOKUPS[locale].set(normalize(labels.en), labels.en);
  }
}

export function translateMeaningValue(locale: SupportedLocale, value: string): string {
  const translated = MEANING_TRANSLATIONS[normalize(value)];
  return translated?.[locale] ?? value;
}

export function toCanonicalMeaningValue(locale: SupportedLocale, value: string): string {
  const normalized = normalize(value);
  return REVERSE_MEANING_LOOKUPS[locale].get(normalized)
    ?? REVERSE_MEANING_LOOKUPS.en.get(normalized)
    ?? value.trim();
}

export function translateAdaptiveReason(locale: SupportedLocale, code: string): string {
  return ADAPTIVE_REASON_TRANSLATIONS[code]?.[locale] ?? code;
}

export function translateKnownNarrative(locale: SupportedLocale, text: string): string {
  const entry = EXACT_MESSAGES.find((message) => message.sources.includes(text));
  return entry ? entry.values[locale] : text;
}

export function translatePlanFactor(locale: SupportedLocale, factor: string): string {
  return PLAN_FACTOR_LABELS[factor]?.[locale] ?? factor;
}

export function translatePlanBasis(locale: SupportedLocale, basis: string): string {
  return PLAN_BASIS_LABELS[basis]?.[locale] ?? basis;
}

export function translatePlanEvidence(locale: SupportedLocale, text: string): string {
  if (text === 'goal.focus includes READING') {
    return locale === 'ko'
      ? '목표 focus에 읽기가 포함됨'
      : locale === 'ja'
      ? '目標 focus に読みが含まれる'
      : 'Goal focus includes reading';
  }

  if (text === 'constraints.offline_expected=true') {
    return locale === 'ko'
      ? '제약 조건 offline_expected = 예'
      : locale === 'ja'
      ? '制約 offline_expected = はい'
      : 'Constraint offline_expected = yes';
  }

  if (text.startsWith('goal.focus=')) {
    const values = text.slice('goal.focus='.length)
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
      .map((value) => FOCUS_VALUE_LABELS[value as keyof typeof FOCUS_VALUE_LABELS]?.[locale] ?? value)
      .join(', ');
    return locale === 'ko'
      ? `목표 focus: ${values}`
      : locale === 'ja'
      ? `目標 focus: ${values}`
      : `Goal focus: ${values}`;
  }

  const match = text.match(/^([a-z_]+)=(.+)$/i);
  if (!match) return text;

  const [, key, rawValue] = match;
  const label = GENERIC_LABELS[key as keyof typeof GENERIC_LABELS]?.[locale] ?? key;
  return `${label}: ${translateScalarValue(locale, key, rawValue)}`;
}

export function translateCounterfactual(locale: SupportedLocale, text: string): string {
  let match = text.match(/^Without target_date, review_count would stay (\d+) and new_count would stay (\d+)\.$/);
  if (match) {
    const [, reviewCount, newCount] = match;
    return locale === 'ko'
      ? `target_date가 없었다면 review_count는 ${reviewCount}, new_count는 ${newCount}로 유지됩니다.`
      : locale === 'ja'
      ? `target_date がなければ review_count は ${reviewCount}、new_count は ${newCount} のままです。`
      : text;
  }

  match = text.match(/^Without READING focus, SURFACE_TO_READING would stay (\d+)%\.$/);
  if (match) {
    const [, percent] = match;
    return locale === 'ko'
      ? `READING focus가 없었다면 SURFACE_TO_READING은 ${percent}%로 유지됩니다.`
      : locale === 'ja'
      ? `READING focus がなければ SURFACE_TO_READING は ${percent}% のままです。`
      : text;
  }

  match = text.match(/^Without VOCAB\/PRODUCTION focus, MEANING_TO_SURFACE would stay (\d+)%\.$/);
  if (match) {
    const [, percent] = match;
    return locale === 'ko'
      ? `VOCAB/PRODUCTION focus가 없었다면 MEANING_TO_SURFACE는 ${percent}%로 유지됩니다.`
      : locale === 'ja'
      ? `VOCAB/PRODUCTION focus がなければ MEANING_TO_SURFACE は ${percent}% のままです。`
      : text;
  }

  match = text.match(/^Without offline_expected, session_chunk_min would stay (\d+) and new_count would stay (\d+)\.$/);
  if (match) {
    const [, chunk, newCount] = match;
    return locale === 'ko'
      ? `offline_expected가 없었다면 session_chunk_min은 ${chunk}, new_count는 ${newCount}로 유지됩니다.`
      : locale === 'ja'
      ? `offline_expected がなければ session_chunk_min は ${chunk}、new_count は ${newCount} のままです。`
      : text;
  }

  return text;
}

export function translateDiagnosisEvidenceNote(locale: SupportedLocale, text: string): string {
  return text
    .replace('recognition=', `${GENERIC_LABELS.recognition[locale]}: `)
    .replace(', recall=', `, ${GENERIC_LABELS.recall[locale]}: `)
    .replace('recall_accuracy=', `${GENERIC_LABELS.recall_accuracy[locale]}: `)
    .replace(', mcq_accuracy=', `, ${GENERIC_LABELS.mcq_accuracy[locale]}: `)
    .replace('surface_to_reading accuracy=', `${GENERIC_LABELS.surface_to_reading[locale]} ${GENERIC_LABELS.accuracy[locale]}: `)
    .replace('meaning_to_surface accuracy=', `${GENERIC_LABELS.meaning_to_surface[locale]} ${GENERIC_LABELS.accuracy[locale]}: `)
    .replace(', avg_rt=', `, ${GENERIC_LABELS.avg_rt[locale]}: `)
    .replace('digit_span=', `${GENERIC_LABELS.digit_span[locale]}: `)
    .replace(', memory_avg_rt=', `, ${GENERIC_LABELS.memory_avg_rt[locale]}: `)
    .replace('daily_minutes=', `${GENERIC_LABELS.daily_minutes[locale]}: `)
    .replace(', weekly_variability=', `, ${GENERIC_LABELS.weekly_variability[locale]}: `)
    .replace(', offline_expected=', `, ${GENERIC_LABELS.offline_expected[locale]}: `)
    .replace(/(offline_expected:\s*)(true|false)/i, (_, prefix: string, value: string) => {
      const translated = BOOLEAN_LABELS[value.toLowerCase() as 'true' | 'false']?.[locale] ?? value;
      return `${prefix}${translated}`;
    })
    .replace(/(weekly_variability:\s*)(low|medium|high)/i, (_, prefix: string, value: string) => {
      const translated = WEEKLY_VARIABILITY_LABELS[value.toLowerCase() as 'low' | 'medium' | 'high']?.[locale] ?? value;
      return `${prefix}${translated}`;
    });
}

function translateScalarValue(locale: SupportedLocale, key: string, rawValue: string): string {
  const trimmed = rawValue.trim();

  if (key === 'variant' && trimmed === 'treatment') {
    return locale === 'ko' ? 'treatment' : locale === 'ja' ? 'treatment' : 'treatment';
  }

  if (key === 'offline_expected' || key === 'constraints.offline_expected') {
    return BOOLEAN_LABELS[trimmed.toLowerCase() as 'true' | 'false']?.[locale] ?? trimmed;
  }

  if (key === 'weekly_variability') {
    return WEEKLY_VARIABILITY_LABELS[trimmed.toLowerCase() as 'low' | 'medium' | 'high']?.[locale] ?? trimmed;
  }

  return trimmed;
}

function normalize(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}
