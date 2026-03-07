import {
  clampHintSteps,
  filterLiveSessionCards,
  sessionCardLimit,
  shouldPauseForChunk,
} from '@japanese-learn/shared';

describe('session policy helpers', () => {
  it('includes only prompts that are renderable in the live session', () => {
    const cards = [
      { card_id: 'stm', prompt_type: 'SURFACE_TO_MEANING' },
      { card_id: 'str', prompt_type: 'SURFACE_TO_READING' },
      { card_id: 'mts', prompt_type: 'MEANING_TO_SURFACE' },
      {
        card_id: 'mcq',
        prompt_type: 'MCQ',
        surface: '学校',
        prompt_payload: { future_mcq_distractors: ['先生', '会社', '学生'] },
      },
      {
        card_id: 'cloze',
        prompt_type: 'CLOZE',
        surface: '時間',
        example_sentence_ja: '時間があるときに本を読みます。',
      },
      {
        card_id: 'listening',
        prompt_type: 'LISTENING',
        surface: '日本語',
        reading: 'にほんご',
        audio_ref: 'seed/audio/it_NIHONGO.mp3',
      },
      { card_id: 'mcq-missing', prompt_type: 'MCQ', surface: '学校' },
      { card_id: 'cloze-missing', prompt_type: 'CLOZE', surface: '時間' },
      { card_id: 'listening-missing', prompt_type: 'LISTENING', surface: '日本語' },
    ];

    expect(filterLiveSessionCards(cards).map((card) => card.card_id)).toEqual([
      'stm',
      'str',
      'mts',
      'mcq',
      'cloze',
      'listening',
    ]);
  });

  it('clamps hint_steps to the 0~3 range', () => {
    expect(clampHintSteps(undefined)).toBe(2);
    expect(clampHintSteps(-1)).toBe(0);
    expect(clampHintSteps(2)).toBe(2);
    expect(clampHintSteps(99)).toBe(3);
  });

  it('maps session_chunk_min to card breakpoints', () => {
    expect(sessionCardLimit(5)).toBe(5);
    expect(sessionCardLimit(10)).toBe(8);
    expect(sessionCardLimit(20)).toBe(Number.POSITIVE_INFINITY);
  });

  it('pauses only on chunk boundaries before the queue ends', () => {
    expect(shouldPauseForChunk(5, 12, 5)).toBe(true);
    expect(shouldPauseForChunk(10, 10, 5)).toBe(false);
    expect(shouldPauseForChunk(3, 12, Number.POSITIVE_INFINITY)).toBe(false);
  });
});
