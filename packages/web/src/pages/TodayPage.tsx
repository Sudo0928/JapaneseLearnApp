import { useEffect, useState } from 'react';
import { fetchTodayCards, TodayCard } from '../services/api';
import styles from '../styles';

const PROMPT_LABEL: Record<string, string> = {
  SURFACE_TO_MEANING: '표기→뜻',
  MEANING_TO_SURFACE: '뜻→표기',
  SURFACE_TO_READING: '표기→읽기',
  MCQ: '선택형',
  CLOZE: '문맥',
  LISTENING: '듣기',
};

export default function TodayPage() {
  const [reviewCards, setReviewCards] = useState<TodayCard[]>([]);
  const [newCards, setNewCards] = useState<TodayCard[]>([]);
  const [drills, setDrills] = useState<TodayCard[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchTodayCards()
      .then((data) => {
        setReviewCards(data.reviewCards);
        setNewCards(data.newCards);
        setDrills(data.confusionDrills ?? []);
        setTotal(data.totalCount);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={styles.center}>불러오는 중...</div>;
  if (error)   return <div style={styles.errorBox}>{error}</div>;

  const allCards = [...reviewCards, ...newCards];

  return (
    <div style={styles.page}>
      <h2 style={styles.heading}>오늘 할 일 <span style={styles.badge}>{total}건</span></h2>

      {allCards.length === 0 ? (
        <div style={styles.emptyBox}>
          <span style={{ fontSize: 40 }}>🎉</span>
          <p>오늘 복습이 모두 완료됐습니다!</p>
        </div>
      ) : (
        <div style={styles.cardGrid}>
          {allCards.map((c) => (
            <div key={c.card_id} style={styles.card}>
              <div style={styles.cardSurface}>{c.surface}</div>
              <div style={styles.cardReading}>{c.reading}</div>
              <div style={styles.cardMeaning}>{c.meaning_ko}</div>
              <div style={styles.cardTag}>{PROMPT_LABEL[c.prompt_type] ?? c.prompt_type}</div>
              <div style={{ fontSize: 11, color: '#888' }}>{c.state === 'new' ? '신규' : '복습'}</div>
            </div>
          ))}
        </div>
      )}

      {drills.length > 0 && (
        <>
          <h3 style={{ ...styles.heading, fontSize: 16, marginTop: 24 }}>
            혼동쌍 드릴 <span style={styles.badge}>{drills.length}건</span>
          </h3>
          <div style={styles.cardGrid}>
            {drills.map((c) => (
              <div key={`drill-${c.card_id}`} style={{ ...styles.card, borderLeft: '3px solid #F59E0B' }}>
                <div style={styles.cardSurface}>{c.surface}</div>
                <div style={styles.cardReading}>{c.reading}</div>
                <div style={styles.cardMeaning}>{c.meaning_ko}</div>
                <div style={{ ...styles.cardTag, color: '#F59E0B' }}>드릴</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
