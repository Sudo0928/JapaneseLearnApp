/**
 * 백엔드 API 응답 계약 타입 (P1-1: 단일 소스)
 *
 * 이 파일을 web/mobile/backend에서 공통으로 import하여
 * 필드명·구조 불일치를 컴파일 타임에 차단한다.
 */

// ─── 인증 ────────────────────────────────────────────────────

export interface AuthGoogleRequest {
  idToken: string;   // ← backend expects 'idToken' (not 'id_token')
  device?: string;
}

export interface AuthGoogleResponse {
  appToken: string;
  expiresAt: string;
  userId: string;
  isNewUser: boolean;
}

export interface MeResponse {
  user_id: string;
  tz: string | null;
  locale: string | null;
  consent_flags: Record<string, unknown>;
  created_at: string;
}

// ─── 오늘 할 일 ──────────────────────────────────────────────

export interface TodayCard {
  card_id: string;
  user_id: string;
  due_ts: string;
  interval_days: number;
  ease_factor: number;
  repetitions: number;
  state: string;
  prompt_type: string;
  surface: string;
  reading: string | null;
  meaning_ko: string | null;
  item_id: string;
  isDrill?: boolean;   // true면 혼동쌍 처방 드릴 (P1-3)
}

export interface TodayResponse {
  date: string;
  userId: string;
  reviewCards: TodayCard[];
  newCards: TodayCard[];
  confusionDrills: TodayCard[];   // P1-3: 혼동쌍 처방 카드
  totalCount: number;
  plan: PlanResponse;
  uiPolicy: PlanUiPolicy;
}

// ─── 플랜 ────────────────────────────────────────────────────

export interface PlanMix {
  SURFACE_TO_MEANING: number;
  MEANING_TO_SURFACE: number;
  SURFACE_TO_READING: number;
  MCQ: number;
  CLOZE: number;
  LISTENING: number;
}

export interface PlanDailyBudget {
  minutes: number;
  new_count: number;
  review_count: number;
  error_drill_count: number;
}

export interface PlanUiPolicy {
  hint_steps: number;
  show_example_by_default: boolean;
  mini_handwriting: boolean;
  session_chunk_min: number;
}

export interface PlanResponse {
  plan_id: string;
  date: string;
  user_id: string;
  daily_budget: PlanDailyBudget;
  mix: PlanMix;
  ui_policy: PlanUiPolicy;
  retention_target: number;
  notes: string[];
  experiment_variant?: string;   // P1-2: 실험 배정 정보
}

// ─── 리포트 ──────────────────────────────────────────────────

export interface DailyStats {
  day: string;
  reviews: number;
  new_cards: number;
  correct_rate: number;
  p50_rt_ms: number;
  p90_rt_ms: number;
  lateness_p50_sec: number;
}

export interface DelayedRecallEstimate {
  items_7d_ago: number;
  recalled_today: number;
  recall_rate: number;
}

export interface RetentionBucketMetric {
  window_days: number;
  eligible_count: number;
  correct_count: number;
  recall_rate: number;
  avg_lateness_days: number;
}

export interface RetentionMetrics {
  due_7d: RetentionBucketMetric;
  due_14d: RetentionBucketMetric;
  due_30d: RetentionBucketMetric;
  overdue_adjusted_recall_rate: number;
  total_eligible_reviews: number;
}

export interface ConfusionMetric {
  surface: string;
  error_type: string;
  error_count: number;
}

export interface ConfusionMetrics {
  top_confusions: ConfusionMetric[];
  total_confusion_errors: number;
  dominant_error_type: string | null;
}

export interface RecoveryMetrics {
  overdue_backlog_days: number;
  recovery_completion_rate: number;
  recovery_time_to_normal_days: number | null;
  post_recovery_retention: number | null;
}

export interface WeeklyReport {
  user_id: string;
  period: { from: string; to: string };
  summary: {
    total_reviews: number;
    total_new_cards: number;
    avg_correct_rate: number;
    avg_rt_ms: number;
    overdue_days: number;
    streak_days: number;
  };
  daily_stats: DailyStats[];
  retention_metrics: RetentionMetrics;
  confusion_metrics: ConfusionMetrics;
  recovery_metrics: RecoveryMetrics;
  insights: string[];
  generated_at: string;
}

// ─── 실험 ────────────────────────────────────────────────────

export interface ExperimentAssignment {
  exp_id: string;
  variant: 'control' | 'treatment' | 'aa_control' | 'aa_treatment' | 'not_in_experiment';
  assigned_at?: string;
}

export interface AssignmentsResponse {
  assignments: ExperimentAssignment[];
  computed_at: string;
}

export interface AaValidationResponse {
  exp_id: string;
  control_count: number;
  treatment_count: number;
  balance_ratio: number;
  is_balanced: boolean;
}
