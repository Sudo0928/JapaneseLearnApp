import { selectCardsByMix } from '../services/queue-compiler';

function makeCard(card_id: string, prompt_type: string) {
  return {
    card_id,
    user_id: 'u_test',
    due_ts: new Date('2026-03-06T10:00:00Z'),
    interval_days: 1,
    ease_factor: 2.5,
    repetitions: 1,
    state: 'review',
    prompt_type,
    surface: card_id,
    reading: null,
    meaning_ko: null,
    item_id: `it_${card_id}`,
  };
}

describe('queue compiler', () => {
  const mix = {
    SURFACE_TO_MEANING: 0.2,
    MEANING_TO_SURFACE: 0.1,
    SURFACE_TO_READING: 0.6,
    MCQ: 0.1,
    CLOZE: 0,
    LISTENING: 0,
  };

  it('높은 mix 비중의 prompt_type을 우선 선택한다', () => {
    const cards = [
      makeCard('stm1', 'SURFACE_TO_MEANING'),
      makeCard('stm2', 'SURFACE_TO_MEANING'),
      makeCard('str1', 'SURFACE_TO_READING'),
      makeCard('str2', 'SURFACE_TO_READING'),
      makeCard('str3', 'SURFACE_TO_READING'),
      makeCard('mts1', 'MEANING_TO_SURFACE'),
    ];

    const selected = selectCardsByMix(cards, mix, 4);

    expect(selected).toHaveLength(4);
    expect(selected.filter((card) => card.prompt_type === 'SURFACE_TO_READING').length).toBeGreaterThanOrEqual(2);
  });

  it('선택 슬롯이 남으면 원래 순서의 카드로 채운다', () => {
    const cards = [
      makeCard('a1', 'SURFACE_TO_MEANING'),
      makeCard('a2', 'SURFACE_TO_MEANING'),
      makeCard('a3', 'SURFACE_TO_MEANING'),
    ];

    const selected = selectCardsByMix(cards, mix, 3);

    expect(selected.map((card) => card.card_id)).toEqual(['a1', 'a2', 'a3']);
  });

  it('limit보다 카드 수가 적으면 가능한 카드만 반환한다', () => {
    const cards = [
      makeCard('only1', 'SURFACE_TO_READING'),
      makeCard('only2', 'SURFACE_TO_READING'),
    ];

    const selected = selectCardsByMix(cards, mix, 5);

    expect(selected).toHaveLength(2);
  });

  it('new prompt cards are selected when the mix weights them and they exist', () => {
    const cards = [
      makeCard('mcq1', 'MCQ'),
      makeCard('mcq2', 'MCQ'),
      makeCard('cloze1', 'CLOZE'),
      makeCard('listening1', 'LISTENING'),
      makeCard('stm1', 'SURFACE_TO_MEANING'),
    ];

    const selected = selectCardsByMix(cards, {
      SURFACE_TO_MEANING: 0.1,
      MEANING_TO_SURFACE: 0,
      SURFACE_TO_READING: 0,
      MCQ: 0.4,
      CLOZE: 0.3,
      LISTENING: 0.2,
    }, 4);

    expect(selected.map((card) => card.prompt_type)).toEqual(
      expect.arrayContaining(['MCQ', 'CLOZE', 'LISTENING'])
    );
  });
});
