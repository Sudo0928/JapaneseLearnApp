-- ============================================================
-- Migration 012: seed content metadata backfill
-- Purpose: fill example/audio/prompt_payload for sample cards
-- Note: this migration does not create or activate MCQ/CLOZE/LISTENING cards.
-- ============================================================

BEGIN;

UPDATE items AS i
SET
  example_sentence_ja = COALESCE(i.example_sentence_ja, seed.example_sentence_ja),
  example_sentence_ko = COALESCE(i.example_sentence_ko, seed.example_sentence_ko),
  audio_ref = COALESCE(i.audio_ref, seed.audio_ref)
FROM (
  VALUES
    ('it_NIHONGO', '日本語を毎日少しずつ勉強しています。', '일본어를 매일 조금씩 공부하고 있습니다.', 'seed/audio/it_NIHONGO.mp3'),
    ('it_SENSEI', '先生の説明はとても分かりやすいです。', '선생님의 설명은 아주 이해하기 쉽습니다.', 'seed/audio/it_SENSEI.mp3'),
    ('it_GAKKOU', '明日は学校へ早く行きます。', '내일은 학교에 일찍 갑니다.', 'seed/audio/it_GAKKOU.mp3'),
    ('it_TOMODACHI', '友達と駅で会ってから一緒にご飯を食べます。', '친구와 역에서 만나고 같이 밥을 먹습니다.', 'seed/audio/it_TOMODACHI.mp3'),
    ('it_DENSHA', '朝の電車はいつも混んでいます。', '아침 전철은 항상 붐빕니다.', 'seed/audio/it_DENSHA.mp3'),
    ('it_JIKAN', '時間があるときに本を読みます。', '시간이 있을 때 책을 읽습니다.', 'seed/audio/it_JIKAN.mp3'),
    ('it_MAINICHI', '毎日十分だけ日本語を話します。', '매일 10분만 일본어를 말합니다.', 'seed/audio/it_MAINICHI.mp3'),
    ('it_TABERU', '朝ご飯を食べてから学校へ行きます。', '아침밥을 먹고 학교에 갑니다.', 'seed/audio/it_TABERU.mp3'),
    ('it_YOMU', '寝る前に少しだけ本を読みます。', '자기 전에 조금만 책을 읽습니다.', 'seed/audio/it_YOMU.mp3'),
    ('it_KIKU', '分からない言葉は先生に聞きます。', '모르는 말은 선생님께 묻습니다.', 'seed/audio/it_KIKU.mp3')
) AS seed(item_id, example_sentence_ja, example_sentence_ko, audio_ref)
WHERE i.item_id = seed.item_id;

UPDATE cards AS c
SET prompt_payload = c.prompt_payload || jsonb_strip_nulls(
  jsonb_build_object(
    'content_ready',
    jsonb_build_object(
      'example_sentence', i.example_sentence_ja IS NOT NULL,
      'audio', i.audio_ref IS NOT NULL
    ),
    'future_modes',
    CASE
      WHEN i.audio_ref IS NOT NULL THEN '["MCQ","CLOZE","LISTENING"]'::jsonb
      WHEN i.example_sentence_ja IS NOT NULL THEN '["MCQ","CLOZE"]'::jsonb
      ELSE '["MCQ"]'::jsonb
    END,
    'future_cloze_sentence', i.example_sentence_ja,
    'audio_ref', i.audio_ref,
    'future_mcq_distractors',
    CASE i.item_id
      WHEN 'it_GAKKOU' THEN '["先生","学生","会社"]'::jsonb
      WHEN 'it_TOMODACHI' THEN '["家族","先生","学生"]'::jsonb
      WHEN 'it_DENSHA' THEN '["駅","車","テレビ"]'::jsonb
      WHEN 'it_JIKAN' THEN '["今日","明日","毎日"]'::jsonb
      WHEN 'it_MAINICHI' THEN '["今日","時間","明日"]'::jsonb
      WHEN 'it_TABERU' THEN '["飲む","聞く","読む"]'::jsonb
      WHEN 'it_YOMU' THEN '["書く","見る","聞く"]'::jsonb
      WHEN 'it_KIKU' THEN '["話す","読む","行く"]'::jsonb
      ELSE NULL
    END,
    'accepted_answers',
    CASE
      WHEN c.prompt_type = 'SURFACE_TO_MEANING' AND i.meaning_ko IS NOT NULL THEN to_jsonb(ARRAY[i.meaning_ko])
      WHEN c.prompt_type = 'SURFACE_TO_READING' AND i.reading IS NOT NULL THEN to_jsonb(ARRAY[i.reading])
      WHEN c.prompt_type = 'MEANING_TO_SURFACE' THEN to_jsonb(ARRAY[i.surface])
      ELSE NULL
    END
  )
)
FROM items AS i
WHERE i.item_id = c.item_id
  AND i.item_id IN (
    'it_NIHONGO',
    'it_SENSEI',
    'it_GAKKOU',
    'it_TOMODACHI',
    'it_DENSHA',
    'it_JIKAN',
    'it_MAINICHI',
    'it_TABERU',
    'it_YOMU',
    'it_KIKU'
  );

COMMIT;
