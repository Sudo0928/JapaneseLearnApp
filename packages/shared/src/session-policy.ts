import type { PlanUiPolicy } from './types/api-contracts';

export const LIVE_SESSION_PROMPT_TYPES = [
  'SURFACE_TO_MEANING',
  'SURFACE_TO_READING',
  'MEANING_TO_SURFACE',
  'MCQ',
  'CLOZE',
  'LISTENING',
] as const;

export type LiveSessionPromptType = (typeof LIVE_SESSION_PROMPT_TYPES)[number];

export interface SessionPolicyCard {
  prompt_type: string;
  surface?: string | null;
  reading?: string | null;
  example_sentence_ja?: string | null;
  audio_ref?: string | null;
  prompt_payload?: Record<string, unknown> | null;
}

const LIVE_SESSION_PROMPT_TYPE_SET = new Set<string>(LIVE_SESSION_PROMPT_TYPES);

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function getPromptPayload(card: SessionPolicyCard): Record<string, unknown> {
  return card.prompt_payload && typeof card.prompt_payload === 'object'
    ? card.prompt_payload
    : {};
}

function getPayloadString(card: SessionPolicyCard, key: string): string | null {
  const value = getPromptPayload(card)[key];
  return hasText(value) ? value : null;
}

function getPayloadStringArray(card: SessionPolicyCard, key: string): string[] {
  const value = getPromptPayload(card)[key];
  if (!Array.isArray(value)) return [];

  return value.filter(hasText);
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  const result: string[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    if (!hasText(value) || seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }

  return result;
}

export function isLiveSessionPromptType(promptType: string): promptType is LiveSessionPromptType {
  return LIVE_SESSION_PROMPT_TYPE_SET.has(promptType);
}

export function getMcqChoices(card: SessionPolicyCard): string[] {
  return uniqueStrings([card.surface, ...getPayloadStringArray(card, 'future_mcq_distractors')]);
}

export function getClozeSentence(card: SessionPolicyCard): string | null {
  return getPayloadString(card, 'future_cloze_sentence') ?? card.example_sentence_ja ?? null;
}

export function getListeningPromptText(card: SessionPolicyCard): string {
  return getPayloadString(card, 'tts_text') ?? card.reading ?? card.surface ?? '';
}

export function isSessionCardReady(card: SessionPolicyCard): boolean {
  if (!isLiveSessionPromptType(card.prompt_type)) return false;

  switch (card.prompt_type) {
    case 'SURFACE_TO_MEANING':
    case 'SURFACE_TO_READING':
    case 'MEANING_TO_SURFACE':
      return true;
    case 'MCQ':
      return getMcqChoices(card).length >= 3 && hasText(card.surface);
    case 'CLOZE':
      return hasText(card.surface) && hasText(getClozeSentence(card));
    case 'LISTENING':
      return hasText(card.surface) && hasText(card.audio_ref) && hasText(getListeningPromptText(card));
    default:
      return false;
  }
}

export function filterLiveSessionCards<T extends SessionPolicyCard>(cards: T[]): T[] {
  return cards.filter((card) => isSessionCardReady(card));
}

export function clampHintSteps(hintSteps?: number): number {
  return Math.max(0, Math.min(3, hintSteps ?? 2));
}

export function sessionCardLimit(sessionChunkMin = 20): number {
  if (sessionChunkMin <= 5) return 5;
  if (sessionChunkMin <= 10) return 8;
  return Number.POSITIVE_INFINITY;
}

export function shouldPauseForChunk(
  nextIndex: number,
  queueLength: number,
  chunkLimit: number
): boolean {
  return Number.isFinite(chunkLimit) && chunkLimit > 0 && nextIndex < queueLength && nextIndex % chunkLimit === 0;
}

export function getReservedExamplePolicyNote(
  policy?: Pick<PlanUiPolicy, 'show_example_by_default'>
): string | null {
  if (!policy?.show_example_by_default) return null;
  return '예문 기본 노출은 콘텐츠 메타데이터 확장 전까지 비활성 상태입니다.';
}
