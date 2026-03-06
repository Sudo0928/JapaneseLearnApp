import { PlanResponse } from './plan-generator';
import { CardWithItem } from './card-state-service';

type PromptMix = PlanResponse['mix'];

/**
 * 플랜의 문항 비율을 실제 세션 큐 선택으로 번역한다.
 * - 먼저 prompt_type별 목표 수를 계산한다.
 * - 각 그룹에서 due/created_at 순서를 유지한 채 카드 선택
 * - 모자란 슬롯은 남은 카드로 채운다.
 */
export function selectCardsByMix(
  cards: CardWithItem[],
  mix: PromptMix,
  limit: number
): CardWithItem[] {
  if (limit <= 0 || cards.length === 0) return [];

  const limited = Math.min(limit, cards.length);
  const selected: CardWithItem[] = [];
  const groups = groupByPrompt(cards);
  const targetCounts = computeTargetCounts(cards, mix, limited);

  for (const [promptType, target] of Object.entries(targetCounts)) {
    const bucket = groups.get(promptType) ?? [];
    selected.push(...bucket.slice(0, target));
  }

  if (selected.length < limited) {
    const selectedIds = new Set(selected.map((card) => card.card_id));
    for (const card of cards) {
      if (selectedIds.has(card.card_id)) continue;
      selected.push(card);
      selectedIds.add(card.card_id);
      if (selected.length >= limited) break;
    }
  }

  return selected.slice(0, limited);
}

function groupByPrompt(cards: CardWithItem[]): Map<string, CardWithItem[]> {
  const groups = new Map<string, CardWithItem[]>();
  for (const card of cards) {
    const bucket = groups.get(card.prompt_type) ?? [];
    bucket.push(card);
    groups.set(card.prompt_type, bucket);
  }
  return groups;
}

function computeTargetCounts(
  cards: CardWithItem[],
  mix: PromptMix,
  limit: number
): Record<string, number> {
  const availableCounts = cards.reduce<Record<string, number>>((acc, card) => {
    acc[card.prompt_type] = (acc[card.prompt_type] ?? 0) + 1;
    return acc;
  }, {});

  const promptTypes = Object.keys(availableCounts);
  if (promptTypes.length === 0) return {};

  const totalWeight = promptTypes.reduce((sum, type) => sum + (mix[type as keyof PromptMix] ?? 0), 0);

  // 사용 가능한 타입에 weight가 하나도 없으면 기존 순서를 유지하도록 첫 타입부터 채운다.
  if (totalWeight <= 0) {
    return promptTypes.reduce<Record<string, number>>((acc, type, index) => {
      acc[type] = index === 0 ? Math.min(limit, availableCounts[type]) : 0;
      return acc;
    }, {});
  }

  const counts: Record<string, number> = {};
  let allocated = 0;

  for (const type of promptTypes) {
    const normalizedWeight = (mix[type as keyof PromptMix] ?? 0) / totalWeight;
    const raw = Math.floor(normalizedWeight * limit);
    counts[type] = Math.min(raw, availableCounts[type]);
    allocated += counts[type];
  }

  // 남은 슬롯은 weight가 높은 타입부터 채운다.
  const byPriority = [...promptTypes].sort(
    (a, b) => (mix[b as keyof PromptMix] ?? 0) - (mix[a as keyof PromptMix] ?? 0)
  );

  let remaining = limit - allocated;
  while (remaining > 0) {
    let filled = false;
    for (const type of byPriority) {
      if (counts[type] < availableCounts[type]) {
        counts[type] += 1;
        remaining -= 1;
        filled = true;
        if (remaining === 0) break;
      }
    }
    if (!filled) break;
  }

  return counts;
}
