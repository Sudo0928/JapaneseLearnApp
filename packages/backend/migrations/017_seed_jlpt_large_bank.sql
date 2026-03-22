-- ============================================================
-- Migration 017: large JLPT problem-bank expansion
-- Purpose: expand N5/N4/N3 sharply, add N2/N1, and guarantee
--          at least 10,000 total cards in the system.
-- Strategy: generate 2,250 source items (450 per level) and
--           create 5 live-session prompts per item.
-- ============================================================

BEGIN;

WITH
n5_places(surface, reading, meaning_ko) AS (
  VALUES
    ('学校', 'がっこう', '학교'),
    ('家', 'いえ', '집'),
    ('図書館', 'としょかん', '도서관'),
    ('駅', 'えき', '역'),
    ('店', 'みせ', '가게'),
    ('教室', 'きょうしつ', '교실'),
    ('公園', 'こうえん', '공원'),
    ('会社', 'かいしゃ', '회사'),
    ('病院', 'びょういん', '병원'),
    ('食堂', 'しょくどう', '식당'),
    ('喫茶店', 'きっさてん', '찻집'),
    ('友達の家', 'ともだちのいえ', '친구 집'),
    ('部屋', 'へや', '방'),
    ('台所', 'だいどころ', '부엌'),
    ('バス停', 'ばすてい', '버스 정류장')
),
n5_actions(surface, reading, meaning_ko) AS (
  VALUES
    ('勉強する', 'べんきょうする', '공부하다'),
    ('本を読む', 'ほんをよむ', '책을 읽다'),
    ('日本語を話す', 'にほんごをはなす', '일본어를 말하다'),
    ('音楽を聞く', 'おんがくをきく', '음악을 듣다'),
    ('写真を撮る', 'しゃしんをとる', '사진을 찍다'),
    ('買い物をする', 'かいものをする', '장을 보다'),
    ('手紙を書く', 'てがみをかく', '편지를 쓰다'),
    ('ご飯を食べる', 'ごはんをたべる', '밥을 먹다'),
    ('水を飲む', 'みずをのむ', '물을 마시다'),
    ('宿題をする', 'しゅくだいをする', '숙제를 하다'),
    ('友達を待つ', 'ともだちをまつ', '친구를 기다리다'),
    ('テレビを見る', 'てれびをみる', '텔레비전을 보다'),
    ('電話をかける', 'でんわをかける', '전화를 걸다'),
    ('休む', 'やすむ', '쉬다'),
    ('仕事をする', 'しごとをする', '일을 하다')
),
n5_times(surface, reading, meaning_ko) AS (
  VALUES
    ('朝', 'あさ', '아침'),
    ('昼', 'ひる', '점심때'),
    ('夜', 'よる', '밤'),
    ('休み時間', 'やすみじかん', '쉬는 시간'),
    ('週末', 'しゅうまつ', '주말'),
    ('出発前', 'しゅっぱつまえ', '출발 전'),
    ('帰宅後', 'きたくご', '귀가 후'),
    ('授業前', 'じゅぎょうまえ', '수업 전'),
    ('授業後', 'じゅぎょうご', '수업 후'),
    ('夕方', 'ゆうがた', '저녁 무렵'),
    ('今朝', 'けさ', '오늘 아침'),
    ('今晩', 'こんばん', '오늘 밤'),
    ('食事前', 'しょくじまえ', '식사 전'),
    ('食事後', 'しょくじご', '식사 후'),
    ('寝る前', 'ねるまえ', '자기 전')
),
n5_activities(surface, reading, meaning_ko) AS (
  VALUES
    ('復習', 'ふくしゅう', '복습'),
    ('散歩', 'さんぽ', '산책'),
    ('練習', 'れんしゅう', '연습'),
    ('会話', 'かいわ', '회화'),
    ('掃除', 'そうじ', '청소'),
    ('洗濯', 'せんたく', '세탁'),
    ('料理', 'りょうり', '요리'),
    ('買い物', 'かいもの', '장보기'),
    ('勉強', 'べんきょう', '공부'),
    ('仕事', 'しごと', '일'),
    ('読書', 'どくしょ', '독서'),
    ('宿題', 'しゅくだい', '숙제'),
    ('準備', 'じゅんび', '준비'),
    ('休憩', 'きゅうけい', '휴식'),
    ('運動', 'うんどう', '운동')
),
n5_pattern_a AS (
  SELECT
    row_number() OVER (ORDER BY p.surface, a.surface) AS seq,
    p.surface || 'で' || a.surface AS surface,
    p.reading || 'で' || a.reading AS reading,
    p.meaning_ko || '에서 ' || a.meaning_ko AS meaning_ko,
    ARRAY['N5', 'generated', 'place_action', 'jlpt_bank_v2']::TEXT[] AS tags,
    '今日は' || p.surface || 'で' || a.surface || '。' AS example_sentence_ja,
    '오늘은 ' || p.meaning_ko || '에서 ' || a.meaning_ko || '.' AS example_sentence_ko,
    'generated/audio/N5/A/' || LPAD(row_number() OVER (ORDER BY p.surface, a.surface)::TEXT, 4, '0') || '.mp3' AS audio_ref,
    'place_action' AS pattern_key
  FROM n5_places AS p
  CROSS JOIN n5_actions AS a
),
n5_pattern_b AS (
  SELECT
    row_number() OVER (ORDER BY t.surface, a.surface) AS seq,
    t.surface || 'に' || a.surface || 'をする' AS surface,
    t.reading || 'に' || a.reading || 'をする' AS reading,
    t.meaning_ko || '에 ' || a.meaning_ko || '를 하다' AS meaning_ko,
    ARRAY['N5', 'generated', 'time_routine', 'jlpt_bank_v2']::TEXT[] AS tags,
    t.surface || 'に' || a.surface || 'をする予定です。' AS example_sentence_ja,
    t.meaning_ko || '에 ' || a.meaning_ko || '를 할 예정이다.' AS example_sentence_ko,
    'generated/audio/N5/B/' || LPAD(row_number() OVER (ORDER BY t.surface, a.surface)::TEXT, 4, '0') || '.mp3' AS audio_ref,
    'time_routine' AS pattern_key
  FROM n5_times AS t
  CROSS JOIN n5_activities AS a
)
INSERT INTO items (
  item_id,
  surface,
  reading,
  meaning_ko,
  tags,
  license_meta,
  example_sentence_ja,
  example_sentence_ko,
  audio_ref
)
SELECT
  'it_JLPT_GEN_N5_' || LPAD(seq::TEXT, 4, '0'),
  surface,
  reading,
  meaning_ko,
  tags,
  jsonb_build_object(
    'source', 'generated_jlpt_bank_v2',
    'level', 'N5',
    'pattern', pattern_key,
    'content_type', 'template_composition'
  ),
  example_sentence_ja,
  example_sentence_ko,
  audio_ref
FROM (
  SELECT seq, surface, reading, meaning_ko, tags, example_sentence_ja, example_sentence_ko, audio_ref, pattern_key
  FROM n5_pattern_a
  UNION ALL
  SELECT seq + 225, surface, reading, meaning_ko, tags, example_sentence_ja, example_sentence_ko, audio_ref, pattern_key
  FROM n5_pattern_b
) AS generated
ON CONFLICT (item_id) DO NOTHING;

WITH
n4_places(surface, reading, meaning_ko) AS (
  VALUES
    ('市役所', 'しやくしょ', '시청'),
    ('郵便局', 'ゆうびんきょく', '우체국'),
    ('会議室', 'かいぎしつ', '회의실'),
    ('研究室', 'けんきゅうしつ', '연구실'),
    ('案内所', 'あんないじょ', '안내소'),
    ('空港', 'くうこう', '공항'),
    ('銀行', 'ぎんこう', '은행'),
    ('体育館', 'たいいくかん', '체육관'),
    ('美術館', 'びじゅつかん', '미술관'),
    ('書店', 'しょてん', '서점'),
    ('工場', 'こうじょう', '공장'),
    ('受付', 'うけつけ', '접수처'),
    ('売り場', 'うりば', '판매장'),
    ('駐車場', 'ちゅうしゃじょう', '주차장'),
    ('ホテル', 'ほてる', '호텔')
),
n4_verbs(surface, reading, meaning_ko) AS (
  VALUES
    ('相談する', 'そうだんする', '상담하다'),
    ('確認する', 'かくにんする', '확인하다'),
    ('予約する', 'よやくする', '예약하다'),
    ('説明する', 'せつめいする', '설명하다'),
    ('整理する', 'せいりする', '정리하다'),
    ('提出する', 'ていしゅつする', '제출하다'),
    ('記録する', 'きろくする', '기록하다'),
    ('比較する', 'ひかくする', '비교하다'),
    ('印刷する', 'いんさつする', '인쇄하다'),
    ('準備する', 'じゅんびする', '준비하다'),
    ('連絡する', 'れんらくする', '연락하다'),
    ('修理する', 'しゅうりする', '수리하다'),
    ('配達する', 'はいたつする', '배달하다'),
    ('調整する', 'ちょうせいする', '조정하다'),
    ('選択する', 'せんたくする', '선택하다')
),
n4_moments(surface, reading, meaning_ko) AS (
  VALUES
    ('出発前', 'しゅっぱつまえ', '출발 전'),
    ('到着後', 'とうちゃくご', '도착 후'),
    ('面接前', 'めんせつまえ', '면접 전'),
    ('試験後', 'しけんご', '시험 후'),
    ('会議前', 'かいぎまえ', '회의 전'),
    ('授業後', 'じゅぎょうご', '수업 후'),
    ('休暇中', 'きゅうかちゅう', '휴가 중'),
    ('移動中', 'いどうちゅう', '이동 중'),
    ('連休前', 'れんきゅうまえ', '연휴 전'),
    ('週明け', 'しゅうあけ', '주초'),
    ('締切前', 'しめきりまえ', '마감 전'),
    ('退勤後', 'たいきんご', '퇴근 후'),
    ('夕食後', 'ゆうしょくご', '저녁 식사 후'),
    ('通学前', 'つうがくまえ', '통학 전'),
    ('帰宅後', 'きたくご', '귀가 후')
),
n4_targets(surface, reading, meaning_ko) AS (
  VALUES
    ('書類', 'しょるい', '서류'),
    ('予定', 'よてい', '일정'),
    ('荷物', 'にもつ', '짐'),
    ('宿題', 'しゅくだい', '숙제'),
    ('報告内容', 'ほうこくないよう', '보고 내용'),
    ('申請内容', 'しんせいないよう', '신청 내용'),
    ('連絡事項', 'れんらくじこう', '연락 사항'),
    ('旅程', 'りょてい', '여행 일정'),
    ('予習範囲', 'よしゅうはんい', '예습 범위'),
    ('復習内容', 'ふくしゅうないよう', '복습 내용'),
    ('記録', 'きろく', '기록'),
    ('資料', 'しりょう', '자료'),
    ('部屋番号', 'へやばんごう', '방 번호'),
    ('体調', 'たいちょう', '컨디션'),
    ('持ち物', 'もちもの', '소지품')
),
n4_pattern_a AS (
  SELECT
    row_number() OVER (ORDER BY p.surface, v.surface) AS seq,
    p.surface || 'で' || v.surface AS surface,
    p.reading || 'で' || v.reading AS reading,
    p.meaning_ko || '에서 ' || v.meaning_ko AS meaning_ko,
    ARRAY['N4', 'generated', 'practical_place_action', 'jlpt_bank_v2']::TEXT[] AS tags,
    '担当者は' || p.surface || 'で' || v.surface || '。' AS example_sentence_ja,
    '담당자는 ' || p.meaning_ko || '에서 ' || v.meaning_ko || '.' AS example_sentence_ko,
    'generated/audio/N4/A/' || LPAD(row_number() OVER (ORDER BY p.surface, v.surface)::TEXT, 4, '0') || '.mp3' AS audio_ref,
    'practical_place_action' AS pattern_key
  FROM n4_places AS p
  CROSS JOIN n4_verbs AS v
),
n4_pattern_b AS (
  SELECT
    row_number() OVER (ORDER BY m.surface, t.surface) AS seq,
    m.surface || 'に' || t.surface || 'を確認する' AS surface,
    m.reading || 'に' || t.reading || 'をかくにんする' AS reading,
    m.meaning_ko || '에 ' || t.meaning_ko || '를 확인하다' AS meaning_ko,
    ARRAY['N4', 'generated', 'timed_check', 'jlpt_bank_v2']::TEXT[] AS tags,
    m.surface || 'に' || t.surface || 'を確認しておく。' AS example_sentence_ja,
    m.meaning_ko || '에 ' || t.meaning_ko || '를 미리 확인해 둔다.' AS example_sentence_ko,
    'generated/audio/N4/B/' || LPAD(row_number() OVER (ORDER BY m.surface, t.surface)::TEXT, 4, '0') || '.mp3' AS audio_ref,
    'timed_check' AS pattern_key
  FROM n4_moments AS m
  CROSS JOIN n4_targets AS t
)
INSERT INTO items (
  item_id,
  surface,
  reading,
  meaning_ko,
  tags,
  license_meta,
  example_sentence_ja,
  example_sentence_ko,
  audio_ref
)
SELECT
  'it_JLPT_GEN_N4_' || LPAD(seq::TEXT, 4, '0'),
  surface,
  reading,
  meaning_ko,
  tags,
  jsonb_build_object(
    'source', 'generated_jlpt_bank_v2',
    'level', 'N4',
    'pattern', pattern_key,
    'content_type', 'template_composition'
  ),
  example_sentence_ja,
  example_sentence_ko,
  audio_ref
FROM (
  SELECT seq, surface, reading, meaning_ko, tags, example_sentence_ja, example_sentence_ko, audio_ref, pattern_key
  FROM n4_pattern_a
  UNION ALL
  SELECT seq + 225, surface, reading, meaning_ko, tags, example_sentence_ja, example_sentence_ko, audio_ref, pattern_key
  FROM n4_pattern_b
) AS generated
ON CONFLICT (item_id) DO NOTHING;

WITH
n3_topics(surface, reading, meaning_ko) AS (
  VALUES
    ('環境問題', 'かんきょうもんだい', '환경 문제'),
    ('地域社会', 'ちいきしゃかい', '지역 사회'),
    ('教育制度', 'きょういくせいど', '교육 제도'),
    ('文化交流', 'ぶんかこうりゅう', '문화 교류'),
    ('健康管理', 'けんこうかんり', '건강 관리'),
    ('消費行動', 'しょうひこうどう', '소비 행동'),
    ('情報発信', 'じょうほうはっしん', '정보 발신'),
    ('国際関係', 'こくさいかんけい', '국제 관계'),
    ('労働環境', 'ろうどうかんきょう', '노동 환경'),
    ('生活習慣', 'せいかつしゅうかん', '생활 습관'),
    ('交通政策', 'こうつうせいさく', '교통 정책'),
    ('防災意識', 'ぼうさいいしき', '방재 의식'),
    ('観光資源', 'かんこうしげん', '관광 자원'),
    ('若者文化', 'わかものぶんか', '청년 문화'),
    ('技術革新', 'ぎじゅつかくしん', '기술 혁신')
),
n3_verbs(surface, reading, meaning_ko) AS (
  VALUES
    ('議論する', 'ぎろんする', '논의하다'),
    ('分析する', 'ぶんせきする', '분석하다'),
    ('比較する', 'ひかくする', '비교하다'),
    ('検討する', 'けんとうする', '검토하다'),
    ('見直す', 'みなおす', '재검토하다'),
    ('整理する', 'せいりする', '정리하다'),
    ('説明する', 'せつめいする', '설명하다'),
    ('共有する', 'きょうゆうする', '공유하다'),
    ('発表する', 'はっぴょうする', '발표하다'),
    ('評価する', 'ひょうかする', '평가하다'),
    ('理解する', 'りかいする', '이해하다'),
    ('研究する', 'けんきゅうする', '연구하다'),
    ('確認する', 'かくにんする', '확인하다'),
    ('深める', 'ふかめる', '심화하다'),
    ('振り返る', 'ふりかえる', '돌아보다')
),
n3_factors(surface, reading, meaning_ko) AS (
  VALUES
    ('経済成長', 'けいざいせいちょう', '경제 성장'),
    ('少子化', 'しょうしか', '저출산'),
    ('高齢化', 'こうれいか', '고령화'),
    ('都市化', 'としか', '도시화'),
    ('情報化', 'じょうほうか', '정보화'),
    ('国際化', 'こくさいか', '국제화'),
    ('規制緩和', 'きせいかんわ', '규제 완화'),
    ('物価上昇', 'ぶっかじょうしょう', '물가 상승'),
    ('天候不順', 'てんこうふじゅん', '날씨 불안정'),
    ('観光需要', 'かんこうじゅよう', '관광 수요'),
    ('学習習慣', 'がくしゅうしゅうかん', '학습 습관'),
    ('生活リズム', 'せいかつりずむ', '생활 리듬'),
    ('就業経験', 'しゅうぎょうけいけん', '취업 경험'),
    ('価値観', 'かちかん', '가치관'),
    ('技術発達', 'ぎじゅつはったつ', '기술 발달')
),
n3_targets(surface, reading, meaning_ko) AS (
  VALUES
    ('生活意識', 'せいかついしき', '생활 의식'),
    ('消費傾向', 'しょうひけいこう', '소비 경향'),
    ('地域経済', 'ちいきけいざい', '지역 경제'),
    ('学習成果', 'がくしゅうせいか', '학습 성과'),
    ('就職活動', 'しゅうしょくかつどう', '취업 활동'),
    ('行動選択', 'こうどうせんたく', '행동 선택'),
    ('政策判断', 'せいさくはんだん', '정책 판단'),
    ('交流機会', 'こうりゅうきかい', '교류 기회'),
    ('情報格差', 'じょうほうかくさ', '정보 격차'),
    ('働き方', 'はたらきかた', '일하는 방식'),
    ('進路選択', 'しんろせんたく', '진로 선택'),
    ('読書量', 'どくしょりょう', '독서량'),
    ('移動時間', 'いどうじかん', '이동 시간'),
    ('健康状態', 'けんこうじょうたい', '건강 상태'),
    ('参加率', 'さんかりつ', '참여율')
),
n3_pattern_a AS (
  SELECT
    row_number() OVER (ORDER BY t.surface, v.surface) AS seq,
    t.surface || 'について' || v.surface AS surface,
    t.reading || 'について' || v.reading AS reading,
    t.meaning_ko || '에 대해 ' || v.meaning_ko AS meaning_ko,
    ARRAY['N3', 'generated', 'topic_discussion', 'jlpt_bank_v2']::TEXT[] AS tags,
    t.surface || 'について' || v.surface || 'ことが重要だ。' AS example_sentence_ja,
    t.meaning_ko || '에 대해 ' || v.meaning_ko || ' 것이 중요하다.' AS example_sentence_ko,
    'generated/audio/N3/A/' || LPAD(row_number() OVER (ORDER BY t.surface, v.surface)::TEXT, 4, '0') || '.mp3' AS audio_ref,
    'topic_discussion' AS pattern_key
  FROM n3_topics AS t
  CROSS JOIN n3_verbs AS v
),
n3_pattern_b AS (
  SELECT
    row_number() OVER (ORDER BY f.surface, t.surface) AS seq,
    f.surface || 'が' || t.surface || 'を左右する' AS surface,
    f.reading || 'が' || t.reading || 'をさゆうする' AS reading,
    f.meaning_ko || '이 ' || t.meaning_ko || '를 좌우하다' AS meaning_ko,
    ARRAY['N3', 'generated', 'factor_impact', 'jlpt_bank_v2']::TEXT[] AS tags,
    f.surface || 'が' || t.surface || 'を左右すると考えられる。' AS example_sentence_ja,
    f.meaning_ko || '이 ' || t.meaning_ko || '를 좌우한다고 여겨진다.' AS example_sentence_ko,
    'generated/audio/N3/B/' || LPAD(row_number() OVER (ORDER BY f.surface, t.surface)::TEXT, 4, '0') || '.mp3' AS audio_ref,
    'factor_impact' AS pattern_key
  FROM n3_factors AS f
  CROSS JOIN n3_targets AS t
)
INSERT INTO items (
  item_id,
  surface,
  reading,
  meaning_ko,
  tags,
  license_meta,
  example_sentence_ja,
  example_sentence_ko,
  audio_ref
)
SELECT
  'it_JLPT_GEN_N3_' || LPAD(seq::TEXT, 4, '0'),
  surface,
  reading,
  meaning_ko,
  tags,
  jsonb_build_object(
    'source', 'generated_jlpt_bank_v2',
    'level', 'N3',
    'pattern', pattern_key,
    'content_type', 'template_composition'
  ),
  example_sentence_ja,
  example_sentence_ko,
  audio_ref
FROM (
  SELECT seq, surface, reading, meaning_ko, tags, example_sentence_ja, example_sentence_ko, audio_ref, pattern_key
  FROM n3_pattern_a
  UNION ALL
  SELECT seq + 225, surface, reading, meaning_ko, tags, example_sentence_ja, example_sentence_ko, audio_ref, pattern_key
  FROM n3_pattern_b
) AS generated
ON CONFLICT (item_id) DO NOTHING;

WITH
n2_subjects(surface, reading, meaning_ko) AS (
  VALUES
    ('方針', 'ほうしん', '방침'),
    ('制度', 'せいど', '제도'),
    ('基準', 'きじゅん', '기준'),
    ('条件', 'じょうけん', '조건'),
    ('体制', 'たいせい', '체제'),
    ('方策', 'ほうさく', '방책'),
    ('手順', 'てじゅん', '절차'),
    ('対策', 'たいさく', '대책'),
    ('計画', 'けいかく', '계획'),
    ('予算', 'よさん', '예산'),
    ('契約', 'けいやく', '계약'),
    ('方針案', 'ほうしんあん', '방침안'),
    ('運用', 'うんよう', '운영'),
    ('施策', 'しさく', '시책'),
    ('規定', 'きてい', '규정')
),
n2_verbs(surface, reading, meaning_ko) AS (
  VALUES
    ('策定する', 'さくていする', '수립하다'),
    ('改定する', 'かいていする', '개정하다'),
    ('検証する', 'けんしょうする', '검증하다'),
    ('共有する', 'きょうゆうする', '공유하다'),
    ('調整する', 'ちょうせいする', '조정하다'),
    ('導入する', 'どうにゅうする', '도입하다'),
    ('強化する', 'きょうかする', '강화하다'),
    ('充実させる', 'じゅうじつさせる', '충실하게 하다'),
    ('見直す', 'みなおす', '재검토하다'),
    ('申請する', 'しんせいする', '신청하다'),
    ('実施する', 'じっしする', '실시하다'),
    ('推進する', 'すいしんする', '추진하다'),
    ('公表する', 'こうひょうする', '공표하다'),
    ('整備する', 'せいびする', '정비하다'),
    ('統一する', 'とういつする', '통일하다')
),
n2_premises(surface, reading, meaning_ko) AS (
  VALUES
    ('現場の意見', 'げんばのいけん', '현장 의견'),
    ('調査結果', 'ちょうさけっか', '조사 결과'),
    ('長期的な影響', 'ちょうきてきなえいきょう', '장기적 영향'),
    ('予算の制約', 'よさんのせいやく', '예산 제약'),
    ('関係者の要望', 'かんけいしゃのようぼう', '관계자 요구'),
    ('市場の変化', 'しじょうのへんか', '시장 변화'),
    ('安全性の観点', 'あんぜんせいのかんてん', '안전성 관점'),
    ('法律上の課題', 'ほうりつじょうのかだい', '법률상 과제'),
    ('利用者の声', 'りようしゃのこえ', '이용자 의견'),
    ('過去の事例', 'かこのじれい', '과거 사례'),
    ('運用実績', 'うんようじっせき', '운영 실적'),
    ('最新データ', 'さいしんでーた', '최신 데이터'),
    ('国際的な動向', 'こくさいてきなどうこう', '국제적 동향'),
    ('地域差', 'ちいきさ', '지역 차이'),
    ('優先順位', 'ゆうせんじゅんい', '우선순위')
),
n2_decisions(surface, reading, meaning_ko) AS (
  VALUES
    ('判断する', 'はんだんする', '판단하다'),
    ('検討する', 'けんとうする', '검토하다'),
    ('決定する', 'けっていする', '결정하다'),
    ('再編する', 'さいへんする', '재편하다'),
    ('運用する', 'うんようする', '운영하다'),
    ('調整する', 'ちょうせいする', '조정하다'),
    ('提案する', 'ていあんする', '제안하다'),
    ('承認する', 'しょうにんする', '승인하다'),
    ('配分する', 'はいぶんする', '배분하다'),
    ('公開する', 'こうかいする', '공개하다'),
    ('交渉する', 'こうしょうする', '협상하다'),
    ('立案する', 'りつあんする', '입안하다'),
    ('修正する', 'しゅうせいする', '수정하다'),
    ('選定する', 'せんていする', '선정하다'),
    ('管理する', 'かんりする', '관리하다')
),
n2_pattern_a AS (
  SELECT
    row_number() OVER (ORDER BY s.surface, v.surface) AS seq,
    s.surface || 'を' || v.surface AS surface,
    s.reading || 'を' || v.reading AS reading,
    s.meaning_ko || '을 ' || v.meaning_ko AS meaning_ko,
    ARRAY['N2', 'generated', 'formal_object_action', 'jlpt_bank_v2']::TEXT[] AS tags,
    '担当部署は' || s.surface || 'を' || v.surface || '。' AS example_sentence_ja,
    '담당 부서는 ' || s.meaning_ko || '을 ' || v.meaning_ko || '.' AS example_sentence_ko,
    'generated/audio/N2/A/' || LPAD(row_number() OVER (ORDER BY s.surface, v.surface)::TEXT, 4, '0') || '.mp3' AS audio_ref,
    'formal_object_action' AS pattern_key
  FROM n2_subjects AS s
  CROSS JOIN n2_verbs AS v
),
n2_pattern_b AS (
  SELECT
    row_number() OVER (ORDER BY p.surface, d.surface) AS seq,
    p.surface || 'を踏まえて' || d.surface AS surface,
    p.reading || 'をふまえて' || d.reading AS reading,
    p.meaning_ko || '을 바탕으로 ' || d.meaning_ko AS meaning_ko,
    ARRAY['N2', 'generated', 'premise_decision', 'jlpt_bank_v2']::TEXT[] AS tags,
    p.surface || 'を踏まえて' || d.surface || '方針だ。' AS example_sentence_ja,
    p.meaning_ko || '을 바탕으로 ' || d.meaning_ko || ' 방침이다.' AS example_sentence_ko,
    'generated/audio/N2/B/' || LPAD(row_number() OVER (ORDER BY p.surface, d.surface)::TEXT, 4, '0') || '.mp3' AS audio_ref,
    'premise_decision' AS pattern_key
  FROM n2_premises AS p
  CROSS JOIN n2_decisions AS d
)
INSERT INTO items (
  item_id,
  surface,
  reading,
  meaning_ko,
  tags,
  license_meta,
  example_sentence_ja,
  example_sentence_ko,
  audio_ref
)
SELECT
  'it_JLPT_GEN_N2_' || LPAD(seq::TEXT, 4, '0'),
  surface,
  reading,
  meaning_ko,
  tags,
  jsonb_build_object(
    'source', 'generated_jlpt_bank_v2',
    'level', 'N2',
    'pattern', pattern_key,
    'content_type', 'template_composition'
  ),
  example_sentence_ja,
  example_sentence_ko,
  audio_ref
FROM (
  SELECT seq, surface, reading, meaning_ko, tags, example_sentence_ja, example_sentence_ko, audio_ref, pattern_key
  FROM n2_pattern_a
  UNION ALL
  SELECT seq + 225, surface, reading, meaning_ko, tags, example_sentence_ja, example_sentence_ko, audio_ref, pattern_key
  FROM n2_pattern_b
) AS generated
ON CONFLICT (item_id) DO NOTHING;

WITH
n1_objects(surface, reading, meaning_ko) AS (
  VALUES
    ('仮説', 'かせつ', '가설'),
    ('前提', 'ぜんてい', '전제'),
    ('文脈', 'ぶんみゃく', '맥락'),
    ('論拠', 'ろんきょ', '논거'),
    ('解釈', 'かいしゃく', '해석'),
    ('命題', 'めいだい', '명제'),
    ('視座', 'しざ', '시좌'),
    ('公共性', 'こうきょうせい', '공공성'),
    ('妥当性', 'だとうせい', '타당성'),
    ('実効性', 'じっこうせい', '실효성'),
    ('再現性', 'さいげんせい', '재현성'),
    ('正統性', 'せいとうせい', '정당성'),
    ('論理性', 'ろんりせい', '논리성'),
    ('因果関係', 'いんがかんけい', '인과 관계'),
    ('規範意識', 'きはんいしき', '규범 의식')
),
n1_verbs(surface, reading, meaning_ko) AS (
  VALUES
    ('援用する', 'えんようする', '원용하다'),
    ('再考する', 'さいこうする', '재고하다'),
    ('検証する', 'けんしょうする', '검증하다'),
    ('立証する', 'りっしょうする', '입증하다'),
    ('相対化する', 'そうたいかする', '상대화하다'),
    ('補強する', 'ほきょうする', '보강하다'),
    ('批判する', 'ひはんする', '비판하다'),
    ('再構成する', 'さいこうせいする', '재구성하다'),
    ('精査する', 'せいさする', '정밀 검토하다'),
    ('敷衍する', 'ふえんする', '부연하다'),
    ('抽象化する', 'ちゅうしょうかする', '추상화하다'),
    ('具体化する', 'ぐたいかする', '구체화하다'),
    ('問い直す', 'といなおす', '다시 묻다'),
    ('裏づける', 'うらづける', '뒷받침하다'),
    ('接続する', 'せつぞくする', '접속하다')
),
n1_issues(surface, reading, meaning_ko) AS (
  VALUES
    ('制度改革', 'せいどかいかく', '제도 개혁'),
    ('言語政策', 'げんごせいさく', '언어 정책'),
    ('社会規範', 'しゃかいきはん', '사회 규범'),
    ('研究倫理', 'けんきゅうりんり', '연구 윤리'),
    ('文化資本', 'ぶんかしほん', '문화 자본'),
    ('情報統制', 'じょうほうとうせい', '정보 통제'),
    ('世論形成', 'せろんけいせい', '여론 형성'),
    ('地域主権', 'ちいきしゅけん', '지역 주권'),
    ('教育格差', 'きょういくかくさ', '교육 격차'),
    ('労働流動性', 'ろうどうりゅうどうせい', '노동 유동성'),
    ('科学的根拠', 'かがくてきこんきょ', '과학적 근거'),
    ('表現の自由', 'ひょうげんのじゆう', '표현의 자유'),
    ('環境正義', 'かんきょうせいぎ', '환경 정의'),
    ('歴史認識', 'れきしにんしき', '역사 인식'),
    ('組織文化', 'そしきぶんか', '조직 문화')
),
n1_meta_verbs(surface, reading, meaning_ko) AS (
  VALUES
    ('再検討する', 'さいけんとうする', '재검토하다'),
    ('論証する', 'ろんしょうする', '논증하다'),
    ('再定義する', 'さいていぎする', '재정의하다'),
    ('批評する', 'ひひょうする', '비평하다'),
    ('総括する', 'そうかつする', '총괄하다'),
    ('再評価する', 'さいひょうかする', '재평가하다'),
    ('問題化する', 'もんだいかする', '문제화하다'),
    ('読み替える', 'よみかえる', '다시 읽어내다'),
    ('検討し直す', 'けんとうしなおす', '다시 검토하다'),
    ('再編成する', 'さいへんせいする', '재편성하다'),
    ('掘り下げる', 'ほりさげる', '깊이 파고들다'),
    ('再構築する', 'さいこうちくする', '재구축하다'),
    ('吟味する', 'ぎんみする', '음미하다'),
    ('位置づける', 'いちづける', '위치짓다'),
    ('深掘りする', 'ふかぼりする', '심층 분석하다')
),
n1_pattern_a AS (
  SELECT
    row_number() OVER (ORDER BY o.surface, v.surface) AS seq,
    o.surface || 'を' || v.surface AS surface,
    o.reading || 'を' || v.reading AS reading,
    o.meaning_ko || '을 ' || v.meaning_ko AS meaning_ko,
    ARRAY['N1', 'generated', 'abstract_argument', 'jlpt_bank_v2']::TEXT[] AS tags,
    '報告書では' || o.surface || 'を' || v.surface || '必要がある。' AS example_sentence_ja,
    '보고서에서는 ' || o.meaning_ko || '을 ' || v.meaning_ko || ' 필요가 있다.' AS example_sentence_ko,
    'generated/audio/N1/A/' || LPAD(row_number() OVER (ORDER BY o.surface, v.surface)::TEXT, 4, '0') || '.mp3' AS audio_ref,
    'abstract_argument' AS pattern_key
  FROM n1_objects AS o
  CROSS JOIN n1_verbs AS v
),
n1_pattern_b AS (
  SELECT
    row_number() OVER (ORDER BY i.surface, v.surface) AS seq,
    i.surface || 'を巡って' || v.surface AS surface,
    i.reading || 'をめぐって' || v.reading AS reading,
    i.meaning_ko || '을 둘러싸고 ' || v.meaning_ko AS meaning_ko,
    ARRAY['N1', 'generated', 'issue_meta_review', 'jlpt_bank_v2']::TEXT[] AS tags,
    i.surface || 'を巡って' || v.surface || '議論が続いている。' AS example_sentence_ja,
    i.meaning_ko || '을 둘러싸고 ' || v.meaning_ko || ' 논의가 이어지고 있다.' AS example_sentence_ko,
    'generated/audio/N1/B/' || LPAD(row_number() OVER (ORDER BY i.surface, v.surface)::TEXT, 4, '0') || '.mp3' AS audio_ref,
    'issue_meta_review' AS pattern_key
  FROM n1_issues AS i
  CROSS JOIN n1_meta_verbs AS v
)
INSERT INTO items (
  item_id,
  surface,
  reading,
  meaning_ko,
  tags,
  license_meta,
  example_sentence_ja,
  example_sentence_ko,
  audio_ref
)
SELECT
  'it_JLPT_GEN_N1_' || LPAD(seq::TEXT, 4, '0'),
  surface,
  reading,
  meaning_ko,
  tags,
  jsonb_build_object(
    'source', 'generated_jlpt_bank_v2',
    'level', 'N1',
    'pattern', pattern_key,
    'content_type', 'template_composition'
  ),
  example_sentence_ja,
  example_sentence_ko,
  audio_ref
FROM (
  SELECT seq, surface, reading, meaning_ko, tags, example_sentence_ja, example_sentence_ko, audio_ref, pattern_key
  FROM n1_pattern_a
  UNION ALL
  SELECT seq + 225, surface, reading, meaning_ko, tags, example_sentence_ja, example_sentence_ko, audio_ref, pattern_key
  FROM n1_pattern_b
) AS generated
ON CONFLICT (item_id) DO NOTHING;

CREATE TEMP TABLE tmp_jlpt_generated_items AS
SELECT
  item_id,
  surface,
  reading,
  meaning_ko,
  example_sentence_ja,
  example_sentence_ko,
  audio_ref,
  CASE
    WHEN 'N5' = ANY(tags) THEN 'N5'
    WHEN 'N4' = ANY(tags) THEN 'N4'
    WHEN 'N3' = ANY(tags) THEN 'N3'
    WHEN 'N2' = ANY(tags) THEN 'N2'
    WHEN 'N1' = ANY(tags) THEN 'N1'
    ELSE 'UNKNOWN'
  END AS jlpt_level
FROM items
WHERE item_id LIKE 'it_JLPT_GEN_%';

CREATE TEMP TABLE tmp_jlpt_generated_card_seed AS
SELECT
  item_id,
  surface,
  reading,
  meaning_ko,
  example_sentence_ja,
  example_sentence_ko,
  audio_ref,
  jlpt_level,
  ARRAY[
    COALESCE(
      LEAD(surface, 1) OVER (PARTITION BY jlpt_level ORDER BY item_id),
      LAG(surface, 1) OVER (PARTITION BY jlpt_level ORDER BY item_id)
    ),
    COALESCE(
      LEAD(surface, 2) OVER (PARTITION BY jlpt_level ORDER BY item_id),
      LAG(surface, 2) OVER (PARTITION BY jlpt_level ORDER BY item_id),
      LEAD(surface, 1) OVER (PARTITION BY jlpt_level ORDER BY item_id),
      LAG(surface, 1) OVER (PARTITION BY jlpt_level ORDER BY item_id)
    ),
    COALESCE(
      LEAD(surface, 3) OVER (PARTITION BY jlpt_level ORDER BY item_id),
      LAG(surface, 3) OVER (PARTITION BY jlpt_level ORDER BY item_id),
      LEAD(surface, 2) OVER (PARTITION BY jlpt_level ORDER BY item_id),
      LAG(surface, 2) OVER (PARTITION BY jlpt_level ORDER BY item_id),
      LEAD(surface, 1) OVER (PARTITION BY jlpt_level ORDER BY item_id),
      LAG(surface, 1) OVER (PARTITION BY jlpt_level ORDER BY item_id)
    )
  ]::TEXT[] AS distractors
FROM tmp_jlpt_generated_items;

INSERT INTO cards (card_id, item_id, prompt_type, prompt_payload)
SELECT
  'c_' || item_id || '_STM',
  item_id,
  'SURFACE_TO_MEANING',
  jsonb_build_object(
    'accepted_answers', to_jsonb(ARRAY[meaning_ko]),
    'future_mcq_distractors', to_jsonb(distractors),
    'future_cloze_sentence', example_sentence_ja,
    'future_modes', '["MCQ","CLOZE"]'::jsonb,
    'content_ready', jsonb_build_object('example_sentence', true, 'audio', false)
  )
FROM tmp_jlpt_generated_card_seed
ON CONFLICT DO NOTHING;

INSERT INTO cards (card_id, item_id, prompt_type, prompt_payload)
SELECT
  'c_' || item_id || '_STR',
  item_id,
  'SURFACE_TO_READING',
  jsonb_build_object(
    'accepted_answers', to_jsonb(ARRAY[reading]),
    'future_cloze_sentence', example_sentence_ja,
    'content_ready', jsonb_build_object('example_sentence', true, 'audio', false)
  )
FROM tmp_jlpt_generated_card_seed
ON CONFLICT DO NOTHING;

INSERT INTO cards (card_id, item_id, prompt_type, prompt_payload)
SELECT
  'c_' || item_id || '_MTS',
  item_id,
  'MEANING_TO_SURFACE',
  jsonb_build_object(
    'accepted_answers', to_jsonb(ARRAY[surface]),
    'future_cloze_sentence', example_sentence_ja,
    'content_ready', jsonb_build_object('example_sentence', true, 'audio', false)
  )
FROM tmp_jlpt_generated_card_seed
ON CONFLICT DO NOTHING;

INSERT INTO cards (card_id, item_id, prompt_type, prompt_payload)
SELECT
  'c_' || item_id || '_MCQ',
  item_id,
  'MCQ',
  jsonb_build_object(
    'future_mcq_distractors', to_jsonb(distractors),
    'accepted_answers', to_jsonb(ARRAY[surface]),
    'future_cloze_sentence', example_sentence_ja,
    'content_ready', jsonb_build_object('example_sentence', true, 'audio', false)
  )
FROM tmp_jlpt_generated_card_seed
ON CONFLICT DO NOTHING;

INSERT INTO cards (card_id, item_id, prompt_type, prompt_payload)
SELECT
  'c_' || item_id || '_CLOZE',
  item_id,
  'CLOZE',
  jsonb_build_object(
    'future_cloze_sentence', example_sentence_ja,
    'accepted_answers', to_jsonb(ARRAY[surface]),
    'content_ready', jsonb_build_object('example_sentence', true, 'audio', false)
  )
FROM tmp_jlpt_generated_card_seed
ON CONFLICT DO NOTHING;

DROP TABLE IF EXISTS tmp_jlpt_generated_card_seed;
DROP TABLE IF EXISTS tmp_jlpt_generated_items;

DO $$
DECLARE
  generated_item_count INTEGER;
  generated_card_count INTEGER;
  total_card_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO generated_item_count
  FROM items
  WHERE item_id LIKE 'it_JLPT_GEN_%';

  SELECT COUNT(*) INTO generated_card_count
  FROM cards
  WHERE item_id LIKE 'it_JLPT_GEN_%';

  SELECT COUNT(*) INTO total_card_count
  FROM cards;

  IF generated_item_count < 2250 THEN
    RAISE EXCEPTION 'Expected at least 2250 generated JLPT items, found %', generated_item_count;
  END IF;

  IF generated_card_count < 11250 THEN
    RAISE EXCEPTION 'Expected at least 11250 generated JLPT cards, found %', generated_card_count;
  END IF;

  IF total_card_count < 10000 THEN
    RAISE EXCEPTION 'Expected at least 10000 total cards after migration, found %', total_card_count;
  END IF;
END $$;

COMMIT;
