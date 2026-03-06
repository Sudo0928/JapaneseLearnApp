/**
 * 진단 테스트 서비스
 *
 * 목적 (rules/report.mdc):
 *   진단은 "레벨테스트"가 아니라 **전략 프로파일 초기값**을 측정한다.
 *   - recall_gap   : 회상형(입력) vs 인지형(MCQ) 정확도 격차
 *   - reading_weak : 읽기(히라가나) 회상 취약 여부
 *   - form_weak    : 표기(한자) 회상 취약 여부
 *   - load_sensitive: 반응시간 상위/힌트 사용 빈도 기반 인지부하 민감도
 *
 * 문항 설계 원칙:
 *   1) 동일 어휘를 여러 prompt_type으로 배치해 회상·인지 격차를 측정한다.
 *   2) MCQ 선택지는 "혼동쌍"으로 구성해 인지적 변별력을 측정한다.
 *   3) MCQ 선택지에 중복 없음 — React key warning 방지.
 *   4) 36문항 이내, 비율: STM 30% · STR 30% · MTS 20% · MCQ 20%
 */

import { pool } from '../db/pool';
import {
  StrategyVector,
  WeaknessFlags,
  deriveWeaknessFlags,
} from './strategy-analyzer';

export type DiagPromptType =
  | 'SURFACE_TO_MEANING'
  | 'SURFACE_TO_READING'
  | 'MEANING_TO_SURFACE'
  | 'MCQ';

export interface DiagItem {
  id: string;
  prompt_type: DiagPromptType;
  surface: string;
  reading: string;
  meaning_ko: string;
  mcq_options?: string[];
  mcq_answer?: string;
  level: 'N5' | 'N4' | 'N3';
  /** 측정 목적: 이 문항이 어느 축을 주로 측정하는지 */
  measures: 'recall_gap' | 'reading_weak' | 'form_weak' | 'load_check';
}

export interface DiagAnswer {
  item_id: string;
  prompt_type: DiagPromptType;
  user_answer: string;
  correct: boolean;
  rt_ms: number;
  hint_used: boolean;
}

export interface DiagnosisResult {
  strategy_vector: StrategyVector;
  weakness_flags: WeaknessFlags;
  accuracy: { recall: number; cognitive: number; reading: number };
  event_count: number;
  completed_at: string;
}

// ─── 진단 문항 36개 ──────────────────────────────────────────
//
// 설계: 동일 어휘를 STM/STR/MTS/MCQ로 교차 배치
//   → 같은 단어에서 회상(입력) vs 인지(선택) 차이를 측정
//
// MCQ 선택지: 모든 항목이 서로 다른 한자 — 혼동쌍 포함, 중복 없음

const DIAG_ITEMS: DiagItem[] = [

  // ── SURFACE_TO_MEANING (한자 → 뜻 입력): recall_gap 측정 ─────
  { id: 'd01', prompt_type: 'SURFACE_TO_MEANING', surface: '勉強', reading: 'べんきょう', meaning_ko: '공부', level: 'N5', measures: 'recall_gap' },
  { id: 'd02', prompt_type: 'SURFACE_TO_MEANING', surface: '電話', reading: 'でんわ',   meaning_ko: '전화', level: 'N5', measures: 'recall_gap' },
  { id: 'd03', prompt_type: 'SURFACE_TO_MEANING', surface: '旅行', reading: 'りょこう',  meaning_ko: '여행', level: 'N5', measures: 'recall_gap' },
  { id: 'd04', prompt_type: 'SURFACE_TO_MEANING', surface: '約束', reading: 'やくそく',  meaning_ko: '약속', level: 'N4', measures: 'recall_gap' },
  { id: 'd05', prompt_type: 'SURFACE_TO_MEANING', surface: '準備', reading: 'じゅんび',  meaning_ko: '준비', level: 'N4', measures: 'recall_gap' },
  { id: 'd06', prompt_type: 'SURFACE_TO_MEANING', surface: '注意', reading: 'ちゅうい',  meaning_ko: '주의', level: 'N4', measures: 'recall_gap' },
  { id: 'd07', prompt_type: 'SURFACE_TO_MEANING', surface: '失敗', reading: 'しっぱい',  meaning_ko: '실패', level: 'N4', measures: 'recall_gap' },
  { id: 'd08', prompt_type: 'SURFACE_TO_MEANING', surface: '大切', reading: 'たいせつ',  meaning_ko: '소중함·중요함', level: 'N5', measures: 'recall_gap' },

  // ── SURFACE_TO_READING (한자 → 히라가나 입력): reading_weak 측정 ──
  { id: 'd09', prompt_type: 'SURFACE_TO_READING', surface: '友達', reading: 'ともだち',   meaning_ko: '친구', level: 'N5', measures: 'reading_weak' },
  { id: 'd10', prompt_type: 'SURFACE_TO_READING', surface: '音楽', reading: 'おんがく',   meaning_ko: '음악', level: 'N5', measures: 'reading_weak' },
  { id: 'd11', prompt_type: 'SURFACE_TO_READING', surface: '病院', reading: 'びょういん',  meaning_ko: '병원', level: 'N5', measures: 'reading_weak' },
  { id: 'd12', prompt_type: 'SURFACE_TO_READING', surface: '電車', reading: 'でんしゃ',   meaning_ko: '전철', level: 'N5', measures: 'reading_weak' },
  { id: 'd13', prompt_type: 'SURFACE_TO_READING', surface: '練習', reading: 'れんしゅう',  meaning_ko: '연습', level: 'N4', measures: 'reading_weak' },
  { id: 'd14', prompt_type: 'SURFACE_TO_READING', surface: '授業', reading: 'じゅぎょう',  meaning_ko: '수업', level: 'N4', measures: 'reading_weak' },
  { id: 'd15', prompt_type: 'SURFACE_TO_READING', surface: '宿題', reading: 'しゅくだい',  meaning_ko: '숙제', level: 'N5', measures: 'reading_weak' },
  { id: 'd16', prompt_type: 'SURFACE_TO_READING', surface: '図書館', reading: 'としょかん', meaning_ko: '도서관', level: 'N4', measures: 'reading_weak' },
  { id: 'd17', prompt_type: 'SURFACE_TO_READING', surface: '新幹線', reading: 'しんかんせん',meaning_ko: '신칸센', level: 'N4', measures: 'reading_weak' },

  // ── MEANING_TO_SURFACE (뜻+읽기 → 한자 입력): form_weak 측정 ───
  { id: 'd18', prompt_type: 'MEANING_TO_SURFACE', surface: '時間', reading: 'じかん',   meaning_ko: '시간', level: 'N5', measures: 'form_weak' },
  { id: 'd19', prompt_type: 'MEANING_TO_SURFACE', surface: '生活', reading: 'せいかつ', meaning_ko: '생활', level: 'N4', measures: 'form_weak' },
  { id: 'd20', prompt_type: 'MEANING_TO_SURFACE', surface: '社会', reading: 'しゃかい', meaning_ko: '사회', level: 'N4', measures: 'form_weak' },
  { id: 'd21', prompt_type: 'MEANING_TO_SURFACE', surface: '卒業', reading: 'そつぎょう',meaning_ko: '졸업', level: 'N4', measures: 'form_weak' },
  { id: 'd22', prompt_type: 'MEANING_TO_SURFACE', surface: '経験', reading: 'けいけん', meaning_ko: '경험', level: 'N4', measures: 'form_weak' },
  { id: 'd23', prompt_type: 'MEANING_TO_SURFACE', surface: '予定', reading: 'よてい',   meaning_ko: '예정', level: 'N4', measures: 'form_weak' },

  // ── MCQ (인지형·혼동쌍): recall_gap 비교 기준선 측정 ────────────
  // 규칙: 선택지 4개 모두 서로 다른 한자, 정답 1개만 포함
  {
    id: 'd24', prompt_type: 'MCQ', surface: '유명(famous)',
    reading: 'ゆうめい', meaning_ko: '유명함',
    mcq_options: ['有名', '有明', '友名', '由名'],
    mcq_answer:  '有名',
    level: 'N4', measures: 'recall_gap',
  },
  {
    id: 'd25', prompt_type: 'MCQ', surface: '약속(promise)',
    reading: 'やくそく', meaning_ko: '약속',
    mcq_options: ['約束', '役束', '薬束', '約測'],
    mcq_answer:  '約束',
    level: 'N4', measures: 'recall_gap',
  },
  {
    id: 'd26', prompt_type: 'MCQ', surface: '실패(failure)',
    reading: 'しっぱい', meaning_ko: '실패',
    mcq_options: ['失敗', '失配', '失排', '逸敗'],
    mcq_answer:  '失敗',
    level: 'N4', measures: 'recall_gap',
  },
  {
    id: 'd27', prompt_type: 'MCQ', surface: '졸업(graduation)',
    reading: 'そつぎょう', meaning_ko: '졸업',
    mcq_options: ['卒業', '率業', '卒葉', '卒英'],
    mcq_answer:  '卒業',
    level: 'N4', measures: 'recall_gap',
  },
  {
    id: 'd28', prompt_type: 'MCQ', surface: '경험(experience)',
    reading: 'けいけん', meaning_ko: '경험',
    mcq_options: ['経験', '軽験', '系験', '経検'],
    mcq_answer:  '経験',
    level: 'N4', measures: 'recall_gap',
  },
  {
    id: 'd29', prompt_type: 'MCQ', surface: '연습(practice)',
    reading: 'れんしゅう', meaning_ko: '연습',
    mcq_options: ['練習', '練翠', '連習', '練拾'],
    mcq_answer:  '練習',
    level: 'N4', measures: 'recall_gap',
  },
  {
    id: 'd30', prompt_type: 'MCQ', surface: '주의(caution)',
    reading: 'ちゅうい', meaning_ko: '주의',
    mcq_options: ['注意', '注異', '住意', '注育'],
    mcq_answer:  '注意',
    level: 'N4', measures: 'recall_gap',
  },
];

/**
 * 진단 문항 반환
 * - 각 prompt_type 비율을 유지하면서 최대 count개 반환
 * - 동일 축(measures)별로 균형 셔플
 */
export function getDiagItems(count = 30): DiagItem[] {
  const groups: Record<string, DiagItem[]> = {};
  for (const item of DIAG_ITEMS) {
    if (!groups[item.prompt_type]) groups[item.prompt_type] = [];
    groups[item.prompt_type].push(item);
  }

  // 각 그룹 내 셔플
  for (const key of Object.keys(groups)) {
    groups[key] = groups[key].sort(() => Math.random() - 0.5);
  }

  // 목표 비율: STM 30%, STR 30%, MTS 20%, MCQ 20%
  const n = Math.min(count, DIAG_ITEMS.length);
  const targets: Record<string, number> = {
    SURFACE_TO_MEANING: Math.round(n * 0.30),
    SURFACE_TO_READING: Math.round(n * 0.30),
    MEANING_TO_SURFACE: Math.round(n * 0.20),
    MCQ:                Math.round(n * 0.20),
  };

  const result: DiagItem[] = [];
  for (const [type, target] of Object.entries(targets)) {
    result.push(...(groups[type] ?? []).slice(0, target));
  }

  // 섞어서 반환
  return result.sort(() => Math.random() - 0.5);
}

/**
 * 진단 답변 처리 → strategy_vector v0 산출 + DB 저장
 */
export async function processDiagnosisAnswers(
  userId: string,
  answers: DiagAnswer[]
): Promise<DiagnosisResult> {

  const recallTypes: DiagPromptType[] = ['SURFACE_TO_MEANING', 'MEANING_TO_SURFACE', 'SURFACE_TO_READING'];
  const cogTypes: DiagPromptType[] = ['MCQ'];

  const recallAnswers = answers.filter((a) => recallTypes.includes(a.prompt_type as DiagPromptType));
  const cogAnswers    = answers.filter((a) => cogTypes.includes(a.prompt_type as DiagPromptType));
  const readingAnswers = answers.filter((a) => a.prompt_type === 'SURFACE_TO_READING');
  const formAnswers    = answers.filter((a) => a.prompt_type === 'MEANING_TO_SURFACE');

  const recallAcc  = avgCorrect(recallAnswers);
  const cogAcc     = avgCorrect(cogAnswers);
  const readingAcc = avgCorrect(readingAnswers);
  const formAcc    = avgCorrect(formAnswers);

  // recall_gap: MCQ보다 회상(입력)이 현저히 낮으면 취약
  const recall_gap = cogAnswers.length >= 2
    ? Math.max(0, cogAcc - recallAcc)
    : 0;

  // reading_weak: 읽기 정확도 낮거나 RT가 높으면 취약
  const allRts    = answers.map((a) => a.rt_ms).filter((r) => r > 0);
  const readingRts = readingAnswers.map((a) => a.rt_ms).filter((r) => r > 0);
  const p70Rt      = percentile(allRts.sort((a, b) => a - b), 0.7);
  const p90ReadingRt = percentile(readingRts.sort((a, b) => a - b), 0.9);

  const reading_weak = readingAnswers.length >= 2
    ? Math.min(1, (1 - readingAcc) * 0.6 + (p90ReadingRt > p70Rt * 1.2 ? 0.4 : 0))
    : 0;

  // form_weak: 한자 표기 회상 취약
  const form_weak = formAnswers.length >= 2
    ? Math.max(0, 1 - formAcc) * 0.8
    : 0;

  // load_sensitive: 힌트 많이 쓰거나 읽기 RT 급등 시 민감
  const hintRate = answers.filter((a) => a.hint_used).length / Math.max(answers.length, 1);
  const load_sensitive = Math.min(1, hintRate * 0.5 + (p90ReadingRt > p70Rt * 1.5 ? 0.5 : 0));

  const vector: StrategyVector = {
    recall_gap:       round2(recall_gap),
    reading_weak:     round2(reading_weak),
    form_weak:        round2(form_weak),
    lateness_fragile: 0, // 진단 시점에는 연체 데이터 없음
    load_sensitive:   round2(load_sensitive),
  };

  const flags = deriveWeaknessFlags(vector);

  // DB 저장
  await pool.query(
    `INSERT INTO diagnosis_results (user_id, strategy_vector, weakness_flags, event_count)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT DO NOTHING`,
    [userId, JSON.stringify(vector), JSON.stringify(flags), answers.length]
  );

  return {
    strategy_vector: vector,
    weakness_flags:  flags,
    accuracy: {
      recall:    round2(recallAcc),
      cognitive: round2(cogAcc),
      reading:   round2(readingAcc),
    },
    event_count:  answers.length,
    completed_at: new Date().toISOString(),
  };
}

function avgCorrect(answers: DiagAnswer[]): number {
  if (answers.length === 0) return 1;
  return answers.filter((a) => a.correct).length / answers.length;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  return sorted[Math.floor(sorted.length * p)] ?? sorted[sorted.length - 1];
}

function round2(v: number): number {
  return Math.round(Math.max(0, Math.min(1, v)) * 100) / 100;
}
