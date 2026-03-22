export interface AuthGoogleRequest {
  idToken: string;
  device?: string;
  locale?: SupportedLocale;
}

export interface ConsentFlags {
  required: boolean;
  optional: boolean;
  research: boolean;
  version?: string;
  agreed_at?: string;
}

export interface AuthGoogleResponse {
  appToken: string;
  expiresAt: string;
  userId: string;
  isNewUser: boolean;
  readyForStudy: boolean;
}

export type SupportedLocale = 'ko' | 'en' | 'ja';
export type ThemePreference = 'system' | 'light' | 'dark';
export type WeeklyVariability = 'low' | 'medium' | 'high';
export type KanjiBackground = 'none' | 'basic' | 'native';

export interface UserPreferences {
  locale: SupportedLocale;
  theme: ThemePreference;
}

export interface OnboardingProfile {
  target_level?: string;
  target_date?: string | null;
  focus?: string[];
  daily_minutes: number;
  weekly_variability: WeeklyVariability;
  offline_expected: boolean;
  kanji_background: KanjiBackground;
  notifications_opt_in: boolean;
  weak_areas?: string[];
}

export interface PrivacySummary {
  raw_event_retention_days: number;
  agg_retention_days: number;
  export_supported: boolean;
  dsr_delete_supported: boolean;
  research_opt_in_default: boolean;
}

export interface MeResponse {
  user_id: string;
  tz: string | null;
  locale: string | null;
  consent_flags: ConsentFlags;
  created_at: string;
  onboarding_profile: OnboardingProfile | null;
  privacy_summary: PrivacySummary;
  preferences: UserPreferences;
}

export interface UpdatePreferencesRequest {
  locale?: SupportedLocale;
  theme?: ThemePreference;
}

export interface DeleteMeRequest {
  confirm_phrase: string;
  export_acknowledged: boolean;
}

export interface DeleteMeResponse {
  deleted: true;
  deleted_at: string;
}

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
  example_sentence_ja?: string | null;
  example_sentence_ko?: string | null;
  audio_ref?: string | null;
  prompt_payload?: Record<string, unknown> | null;
  isDrill?: boolean;
}

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

export interface PlanExplanationReceipt {
  factor: string;
  basis: 'diagnosis' | 'behavior' | 'goal' | 'recovery';
  evidence: string;
  effect: string;
  counterfactual?: string;
}

export interface RecoveryPlan {
  active: boolean;
  overdue_count: number;
  recommended_minutes: number;
  mode: 'three_day' | 'seven_day' | 'focus_15';
  summary: string;
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
  experiment_variant?: string;
  explanation_receipt: PlanExplanationReceipt[];
  recovery_plan?: RecoveryPlan;
}

export interface TodayResponse {
  date: string;
  userId: string;
  reviewCards: TodayCard[];
  newCards: TodayCard[];
  confusionDrills: TodayCard[];
  totalCount: number;
  plan: PlanResponse;
  uiPolicy: PlanUiPolicy;
}

export interface DiagnosisMemoryPairs {
  recall_correct: number;
  recall_total: number;
  recognition_correct: number;
  recognition_total: number;
  avg_rt_ms: number;
}

export interface DiagnosisDigitSpan {
  max_correct_span: number;
}

export interface DiagnosisVisualDiscrimination {
  correct: number;
  total: number;
  avg_rt_ms: number;
}

export interface DiagnosisCognitiveMetrics {
  memory_pairs: DiagnosisMemoryPairs;
  digit_span: DiagnosisDigitSpan;
  visual_discrimination: DiagnosisVisualDiscrimination;
}

export interface DiagnosisSubmitV2Request {
  phase: 'cognitive_v2';
  self_assessment?: {
    target_level?: string;
    daily_minutes?: number;
    weak_areas?: string[];
  };
  memory_pairs: DiagnosisMemoryPairs;
  digit_span: DiagnosisDigitSpan;
  visual_discrimination: DiagnosisVisualDiscrimination;
}

export type DiagnosisPromptType =
  | 'SURFACE_TO_MEANING'
  | 'SURFACE_TO_READING'
  | 'MEANING_TO_SURFACE'
  | 'MCQ';

export interface DiagnosisLanguageMicroItem {
  id: string;
  item_id: string;
  prompt_type: DiagnosisPromptType;
  surface: string;
  reading: string;
  meaning_ko: string;
  choices?: string[];
}

export interface DiagnosisLanguageMicroAnswer {
  id: string;
  prompt_type: DiagnosisPromptType;
  answer: string;
  rt_ms: number;
}

export interface DiagnosisAxisConfidence {
  recall_gap: number;
  reading_weak: number;
  form_weak: number;
  load_sensitive: number;
}

export interface DiagnosisSubmitV3Request {
  phase: 'cognitive_v3';
  onboarding_profile: OnboardingProfile;
  cognitive_metrics: DiagnosisCognitiveMetrics;
  language_micro_answers: DiagnosisLanguageMicroAnswer[];
}

export interface DiagnosisEvaluateBlockRequest {
  answered_items: DiagnosisLanguageMicroAnswer[];
  cognitive_metrics: DiagnosisCognitiveMetrics;
  onboarding_profile: OnboardingProfile;
}

export interface DiagnosisEvaluateBlockResponse {
  done: boolean;
  next_items: DiagnosisLanguageMicroItem[];
  reason_codes: string[];
  confidence_by_axis: DiagnosisAxisConfidence;
}

export interface DiagnosisSubmitV4Request {
  phase: 'cognitive_v4';
  onboarding_profile: OnboardingProfile;
  cognitive_metrics: DiagnosisCognitiveMetrics;
  answers: DiagnosisLanguageMicroAnswer[];
}

export interface DiagnosisEvidence {
  factor: string;
  source: 'self_report' | 'cognitive' | 'language_micro' | 'behavior';
  value: number | string;
  note: string;
}

export interface DiagnosisSourceWeights {
  self_report: number;
  cognitive: number;
  language_micro: number;
  behavior?: number;
}

export interface DiagnosisResultResponse {
  strategy_vector: {
    recall_gap: number;
    reading_weak: number;
    form_weak: number;
    load_sensitive: number;
    lateness_fragile?: number;
  };
  weakness_flags: string[];
  notes: string[];
  evidence: DiagnosisEvidence[];
  source_weights: DiagnosisSourceWeights;
  version: string;
  question_count?: number;
  confidence_by_axis?: DiagnosisAxisConfidence;
  adaptive_reason_codes?: string[];
}

export interface DiagnosisBootstrapResponse {
  core_items: DiagnosisLanguageMicroItem[];
  adaptive_pool: DiagnosisLanguageMicroItem[];
  previous_result?: DiagnosisResultResponse;
  onboarding_defaults: OnboardingProfile;
  language_micro_items?: DiagnosisLanguageMicroItem[];
}

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

export interface ExperimentAssignment {
  exp_id: string;
  variant: 'control' | 'treatment' | 'aa_control' | 'aa_treatment' | 'not_in_experiment';
  assigned_at?: string;
  purpose?: string;
  opt_out_supported?: boolean;
  exposure_count?: number;
}

export interface AssignmentsResponse {
  assignments: ExperimentAssignment[];
  computed_at: string;
}

export interface UserExportResponse {
  user: {
    user_id: string;
    tz: string | null;
    locale: string | null;
    created_at: string;
  };
  onboarding_profile: OnboardingProfile | null;
  consent_flags: ConsentFlags;
  diagnosis_result_latest: DiagnosisResultResponse | null;
  card_state: unknown[];
  review_log: unknown[];
  daily_agg: unknown[];
  error_agg: unknown[];
  experiments: ExperimentAssignment[];
  notification_prefs_redacted: {
    enabled: boolean;
    window_start: string | null;
    window_end: string | null;
    timezone: string;
    recovery_plan: boolean;
    has_push_token: boolean;
  } | null;
  exported_at: string;
  schema_version: string;
}
