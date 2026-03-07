-- ============================================================
-- Migration 013: activate extended prompt cards for seeded items
-- Purpose: create MCQ/CLOZE/LISTENING cards only for items with ready metadata.
-- ============================================================

BEGIN;

INSERT INTO cards (card_id, item_id, prompt_type, prompt_payload)
SELECT
  'c_' || i.item_id || '_MCQ',
  i.item_id,
  'MCQ',
  jsonb_strip_nulls(
    base.prompt_payload ||
    jsonb_build_object(
      'mode', 'meaning_to_surface',
      'question_text', i.meaning_ko,
      'correct_answer', i.surface
    )
  )
FROM items i
JOIN cards base
  ON base.item_id = i.item_id
 AND base.prompt_type = 'SURFACE_TO_MEANING'
WHERE jsonb_typeof(base.prompt_payload -> 'future_mcq_distractors') = 'array'
  AND jsonb_array_length(base.prompt_payload -> 'future_mcq_distractors') >= 2
ON CONFLICT DO NOTHING;

INSERT INTO cards (card_id, item_id, prompt_type, prompt_payload)
SELECT
  'c_' || i.item_id || '_CLOZE',
  i.item_id,
  'CLOZE',
  jsonb_strip_nulls(
    base.prompt_payload ||
    jsonb_build_object(
      'mode', 'fill_surface',
      'cloze_sentence', COALESCE(base.prompt_payload ->> 'future_cloze_sentence', i.example_sentence_ja),
      'correct_answer', i.surface
    )
  )
FROM items i
JOIN cards base
  ON base.item_id = i.item_id
 AND base.prompt_type = 'SURFACE_TO_MEANING'
WHERE COALESCE(base.prompt_payload ->> 'future_cloze_sentence', i.example_sentence_ja) IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO cards (card_id, item_id, prompt_type, prompt_payload)
SELECT
  'c_' || i.item_id || '_LISTENING',
  i.item_id,
  'LISTENING',
  jsonb_strip_nulls(
    base.prompt_payload ||
    jsonb_build_object(
      'mode', 'audio_to_surface',
      'tts_text', COALESCE(i.reading, i.surface),
      'audio_ref', i.audio_ref,
      'correct_answer', i.surface
    )
  )
FROM items i
JOIN cards base
  ON base.item_id = i.item_id
 AND base.prompt_type = 'SURFACE_TO_MEANING'
WHERE i.audio_ref IS NOT NULL
ON CONFLICT DO NOTHING;

COMMIT;
