import type { PlanUiPolicy, SupportedLocale } from './types/api-contracts';

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
  chunkLimit: number,
): boolean {
  return Number.isFinite(chunkLimit) && chunkLimit > 0 && nextIndex < queueLength && nextIndex % chunkLimit === 0;
}

export function getReservedExamplePolicyNote(
  policy?: Pick<PlanUiPolicy, 'show_example_by_default'>,
  locale: SupportedLocale = 'ko',
): string | null {
  if (!policy?.show_example_by_default) return null;

  if (locale === 'en') {
    return 'Examples stay visible by default until content metadata expansion is complete.';
  }
  if (locale === 'ja') {
    return '\u30B3\u30F3\u30C6\u30F3\u30C4\u306E\u30E1\u30BF\u30C7\u30FC\u30BF\u62E1\u5F35\u304C\u5B8C\u4E86\u3059\u308B\u307E\u3067\u3001\u4F8B\u6587\u306F\u30C7\u30D5\u30A9\u30EB\u30C8\u3067\u8868\u793A\u3055\u308C\u307E\u3059\u3002';
  }
  return '\uCF58\uD150\uCE20 \uBA54\uD0C0\uB370\uC774\uD130 \uD655\uC7A5\uC774 \uC644\uB8CC\uB420 \uB54C\uAE4C\uC9C0 \uC608\uBB38\uC744 \uAE30\uBCF8 \uB178\uCD9C\uB85C \uC720\uC9C0\uD569\uB2C8\uB2E4.';
}
