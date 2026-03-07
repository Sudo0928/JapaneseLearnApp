-- ============================================================
-- Migration 011: 콘텐츠 메타데이터 확장
-- 목적: MCQ / CLOZE / LISTENING / 예문 노출에 필요한 페이로드 저장 공간 확보
-- 주의: 이 마이그레이션은 메타데이터만 추가하며, 새 prompt_type 카드를 live로 활성화하지 않는다.
-- ============================================================

BEGIN;

ALTER TABLE items
  ADD COLUMN IF NOT EXISTS example_sentence_ja TEXT,
  ADD COLUMN IF NOT EXISTS example_sentence_ko TEXT,
  ADD COLUMN IF NOT EXISTS audio_ref TEXT;

ALTER TABLE cards
  ADD COLUMN IF NOT EXISTS prompt_payload JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN items.example_sentence_ja IS '예문 일본어 원문. show_example_by_default가 실제로 사용되기 전까지 선택 메타데이터로만 유지.';
COMMENT ON COLUMN items.example_sentence_ko IS '예문 한국어 번역.';
COMMENT ON COLUMN items.audio_ref IS 'LISTENING prompt용 오디오 참조 경로 또는 CDN 키.';
COMMENT ON COLUMN cards.prompt_payload IS 'MCQ distractors, cloze 템플릿, listening 보조 메타데이터를 담는 JSONB 필드.';

UPDATE items
SET
  example_sentence_ja = COALESCE(example_sentence_ja, '日本語を毎日少しずつ勉強しています。'),
  example_sentence_ko = COALESCE(example_sentence_ko, '일본어를 매일 조금씩 공부하고 있습니다.')
WHERE item_id = 'it_NIHONGO';

UPDATE items
SET
  example_sentence_ja = COALESCE(example_sentence_ja, '先生の説明はとても分かりやすいです。'),
  example_sentence_ko = COALESCE(example_sentence_ko, '선생님의 설명은 아주 이해하기 쉽습니다.')
WHERE item_id = 'it_SENSEI';

UPDATE items
SET
  example_sentence_ja = COALESCE(example_sentence_ja, '明日は学校へ早く行きます。'),
  example_sentence_ko = COALESCE(example_sentence_ko, '내일은 학교에 일찍 갑니다.')
WHERE item_id = 'it_GAKKOU';

COMMIT;
