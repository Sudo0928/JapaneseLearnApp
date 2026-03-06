-- ============================================================
-- Migration 007: N5 기초 단어 시드 데이터
-- 50개 단어 + 카드 (SURFACE_TO_MEANING, SURFACE_TO_READING)
-- ============================================================
BEGIN;

INSERT INTO items (item_id, surface, reading, meaning_ko, tags) VALUES
  ('it_NIHONGO',   '日本語',   'にほんご',   '일본어',       ARRAY['N5','noun']),
  ('it_GAKKOU',    '学校',     'がっこう',   '학교',         ARRAY['N5','noun']),
  ('it_SENSEI',    '先生',     'せんせい',   '선생님',       ARRAY['N5','noun']),
  ('it_GAKUSEI',   '学生',     'がくせい',   '학생',         ARRAY['N5','noun']),
  ('it_TOMODACHI', '友達',     'ともだち',   '친구',         ARRAY['N5','noun']),
  ('it_KAZOKU',    '家族',     'かぞく',     '가족',         ARRAY['N5','noun']),
  ('it_UCHI',      '家',       'うち',       '집',           ARRAY['N5','noun']),
  ('it_KAISHA',    '会社',     'かいしゃ',   '회사',         ARRAY['N5','noun']),
  ('it_SHIGOTO',   '仕事',     'しごと',     '일, 직업',     ARRAY['N5','noun']),
  ('it_OKANE',     'お金',     'おかね',     '돈',           ARRAY['N5','noun']),
  ('it_NOMIMONO',  '飲み物',   'のみもの',   '음료, 마실 것',ARRAY['N5','noun']),
  ('it_TABEMONO',  '食べ物',   'たべもの',   '음식',         ARRAY['N5','noun']),
  ('it_MIZU',      '水',       'みず',       '물',           ARRAY['N5','noun']),
  ('it_GOHAN',     'ご飯',     'ごはん',     '밥',           ARRAY['N5','noun']),
  ('it_TEREBI',    'テレビ',   'てれび',     '텔레비전',     ARRAY['N5','noun']),
  ('it_DENSHA',    '電車',     'でんしゃ',   '전철',         ARRAY['N5','noun']),
  ('it_KURUMA',    '車',       'くるま',     '자동차',       ARRAY['N5','noun']),
  ('it_EKI',       '駅',       'えき',       '역',           ARRAY['N5','noun']),
  ('it_MISE',      '店',       'みせ',       '가게',         ARRAY['N5','noun']),
  ('it_HON',       '本',       'ほん',       '책',           ARRAY['N5','noun']),
  ('it_JIKAN',     '時間',     'じかん',     '시간',         ARRAY['N5','noun']),
  ('it_MAINICHI',  '毎日',     'まいにち',   '매일',         ARRAY['N5','adverb']),
  ('it_ASHITA',    '明日',     'あした',     '내일',         ARRAY['N5','noun']),
  ('it_KINOU',     '昨日',     'きのう',     '어제',         ARRAY['N5','noun']),
  ('it_KYOU',      '今日',     'きょう',     '오늘',         ARRAY['N5','noun']),
  ('it_IMA',       '今',       'いま',       '지금',         ARRAY['N5','adverb']),
  ('it_HAYAI',     '早い',     'はやい',     '빠르다, 이르다',ARRAY['N5','adjective']),
  ('it_OSOI',      '遅い',     'おそい',     '느리다, 늦다', ARRAY['N5','adjective']),
  ('it_OOKII',     '大きい',   'おおきい',   '크다',         ARRAY['N5','adjective']),
  ('it_CHIISAI',   '小さい',   'ちいさい',   '작다',         ARRAY['N5','adjective']),
  ('it_TAKAI',     '高い',     'たかい',     '높다, 비싸다', ARRAY['N5','adjective']),
  ('it_YASUI',     '安い',     'やすい',     '싸다',         ARRAY['N5','adjective']),
  ('it_ATARASHII', '新しい',   'あたらしい', '새롭다',       ARRAY['N5','adjective']),
  ('it_FURUI',     '古い',     'ふるい',     '오래되다',     ARRAY['N5','adjective']),
  ('it_TANOSHII',  '楽しい',   'たのしい',   '즐겁다',       ARRAY['N5','adjective']),
  ('it_MUZUKASHII','難しい',   'むずかしい', '어렵다',       ARRAY['N5','adjective']),
  ('it_YASASHII',  '優しい',   'やさしい',   '친절하다',     ARRAY['N5','adjective']),
  ('it_TABERU',    '食べる',   'たべる',     '먹다',         ARRAY['N5','verb']),
  ('it_NOMU',      '飲む',     'のむ',       '마시다',       ARRAY['N5','verb']),
  ('it_IKU',       '行く',     'いく',       '가다',         ARRAY['N5','verb']),
  ('it_KURU',      '来る',     'くる',       '오다',         ARRAY['N5','verb']),
  ('it_KAERU',     '帰る',     'かえる',     '돌아가다',     ARRAY['N5','verb']),
  ('it_MIRU',      '見る',     'みる',       '보다',         ARRAY['N5','verb']),
  ('it_KIKU',      '聞く',     'きく',       '듣다, 묻다',   ARRAY['N5','verb']),
  ('it_HANASU',    '話す',     'はなす',     '말하다',       ARRAY['N5','verb']),
  ('it_YOMU',      '読む',     'よむ',       '읽다',         ARRAY['N5','verb']),
  ('it_KAKU',      '書く',     'かく',       '쓰다',         ARRAY['N5','verb']),
  ('it_AU',        '会う',     'あう',       '만나다',       ARRAY['N5','verb']),
  ('it_WAKARU',    '分かる',   'わかる',     '알다, 이해하다',ARRAY['N5','verb']),
  ('it_BENKYOU',   '勉強',     'べんきょう', '공부',         ARRAY['N5','noun'])
ON CONFLICT (item_id) DO NOTHING;

-- 카드 생성: 표기→뜻, 표기→읽기, 뜻→표기 3종
INSERT INTO cards (card_id, item_id, prompt_type)
SELECT
  'c_' || item_id || '_STM', item_id, 'SURFACE_TO_MEANING'
FROM items
WHERE item_id LIKE 'it_%'
  AND item_id IN (
    'it_NIHONGO','it_GAKKOU','it_SENSEI','it_GAKUSEI','it_TOMODACHI',
    'it_KAZOKU','it_UCHI','it_KAISHA','it_SHIGOTO','it_OKANE',
    'it_NOMIMONO','it_TABEMONO','it_MIZU','it_GOHAN','it_TEREBI',
    'it_DENSHA','it_KURUMA','it_EKI','it_MISE','it_HON',
    'it_JIKAN','it_MAINICHI','it_ASHITA','it_KINOU','it_KYOU',
    'it_IMA','it_HAYAI','it_OSOI','it_OOKII','it_CHIISAI',
    'it_TAKAI','it_YASUI','it_ATARASHII','it_FURUI','it_TANOSHII',
    'it_MUZUKASHII','it_YASASHII','it_TABERU','it_NOMU','it_IKU',
    'it_KURU','it_KAERU','it_MIRU','it_KIKU','it_HANASU',
    'it_YOMU','it_KAKU','it_AU','it_WAKARU','it_BENKYOU'
  )
ON CONFLICT DO NOTHING;

INSERT INTO cards (card_id, item_id, prompt_type)
SELECT
  'c_' || item_id || '_STR', item_id, 'SURFACE_TO_READING'
FROM items
WHERE item_id IN (
    'it_NIHONGO','it_GAKKOU','it_SENSEI','it_GAKUSEI','it_TOMODACHI',
    'it_KAZOKU','it_UCHI','it_KAISHA','it_SHIGOTO','it_OKANE',
    'it_NOMIMONO','it_TABEMONO','it_MIZU','it_GOHAN','it_TEREBI',
    'it_DENSHA','it_KURUMA','it_EKI','it_MISE','it_HON',
    'it_JIKAN','it_MAINICHI','it_ASHITA','it_KINOU','it_KYOU',
    'it_IMA','it_HAYAI','it_OSOI','it_OOKII','it_CHIISAI',
    'it_TAKAI','it_YASUI','it_ATARASHII','it_FURUI','it_TANOSHII',
    'it_MUZUKASHII','it_YASASHII','it_TABERU','it_NOMU','it_IKU',
    'it_KURU','it_KAERU','it_MIRU','it_KIKU','it_HANASU',
    'it_YOMU','it_KAKU','it_AU','it_WAKARU','it_BENKYOU'
  )
ON CONFLICT DO NOTHING;

INSERT INTO cards (card_id, item_id, prompt_type)
SELECT
  'c_' || item_id || '_MTS', item_id, 'MEANING_TO_SURFACE'
FROM items
WHERE item_id IN (
    'it_NIHONGO','it_GAKKOU','it_SENSEI','it_GAKUSEI','it_TOMODACHI',
    'it_KAZOKU','it_UCHI','it_KAISHA','it_SHIGOTO','it_OKANE',
    'it_TABERU','it_NOMU','it_IKU','it_KURU','it_MIRU',
    'it_KIKU','it_HANASU','it_YOMU','it_KAKU','it_WAKARU'
  )
ON CONFLICT DO NOTHING;

COMMIT;
