import { useEffect, useState } from 'react';
import type { PlanResponse, TodayCard } from '@japanese-learn/shared';
import { getPromptTypeLabel, getStudyMetadataTagLabel } from '@japanese-learn/shared';
import { fetchTodayCards } from '../services/api';
import { useSettings } from '../context/settings';
import {
  translatePlanBasis,
  translatePlanCounterfactual,
  translatePlanEvidence,
  translatePlanFactor,
  translatePlanNarrative,
} from '../i18n/plan-copy';
import styles from '../styles';

function getMetadataTags(card: TodayCard, locale: Parameters<typeof getPromptTypeLabel>[0]): string[] {
  const tags: string[] = [];
  if (card.example_sentence_ja) tags.push(getStudyMetadataTagLabel(locale, 'example'));
  if (card.audio_ref) tags.push(getStudyMetadataTagLabel(locale, 'audio'));
  if (card.prompt_payload && Object.keys(card.prompt_payload).length > 0) {
    tags.push(getStudyMetadataTagLabel(locale, 'payload'));
  }
  return tags;
}

export default function TodayPage() {
  const { t, preferences } = useSettings();
  const [reviewCards, setReviewCards] = useState<TodayCard[]>([]);
  const [newCards, setNewCards] = useState<TodayCard[]>([]);
  const [drills, setDrills] = useState<TodayCard[]>([]);
  const [plan, setPlan] = useState<PlanResponse | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchTodayCards()
      .then((data) => {
        setReviewCards(data.reviewCards);
        setNewCards(data.newCards);
        setDrills(data.confusionDrills ?? []);
        setPlan(data.plan);
        setTotal(data.totalCount);
      })
      .catch((fetchError: Error) => setError(fetchError.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={styles.center}>{t('common.loading')}</div>;
  if (error) return <div style={styles.errorBox}>{error}</div>;

  const cards = [...reviewCards, ...newCards];
  const locale = preferences.locale;

  return (
    <div style={styles.page}>
      <h2 style={styles.heading}>
        {t('web.today.title')}
        <span style={styles.badge}>{total}</span>
      </h2>

      {cards.length === 0 ? (
        <div style={styles.emptyBox}>
          <p>{t('web.today.empty')}</p>
        </div>
      ) : (
        <div style={styles.cardGrid}>
          {cards.map((card) => {
            const tags = getMetadataTags(card, locale);
            return (
              <div key={card.card_id} style={styles.card}>
                <div style={styles.cardSurface}>{card.surface}</div>
                <div style={styles.cardReading}>{card.reading}</div>
                <div style={styles.cardMeaning}>{card.meaning_ko}</div>
                <div style={styles.cardTag}>{getPromptTypeLabel(locale, card.prompt_type)}</div>
                {tags.length > 0 ? (
                  <div style={styles.metaRow}>
                    {tags.map((tag) => (
                      <span key={`${card.card_id}-${tag}`} style={styles.metaTag}>{tag}</span>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      {drills.length > 0 ? (
        <>
          <h3 style={{ ...styles.heading, fontSize: 16, marginTop: 24 }}>
            {t('web.today.drills')}
            <span style={styles.badge}>{drills.length}</span>
          </h3>
          <div style={styles.cardGrid}>
            {drills.map((card) => (
              <div
                key={`drill-${card.card_id}`}
                style={{ ...styles.card, borderLeft: '3px solid var(--app-primary)' }}
              >
                <div style={styles.cardSurface}>{card.surface}</div>
                <div style={styles.cardReading}>{card.reading}</div>
                <div style={styles.cardMeaning}>{card.meaning_ko}</div>
              </div>
            ))}
          </div>
        </>
      ) : null}

      {plan?.explanation_receipt?.length ? (
        <div style={styles.adminPanel}>
          <h3 style={styles.sectionTitle}>{t('web.today.plan')}</h3>
          <div style={styles.activityList}>
            {plan.explanation_receipt.map((receipt, index) => (
              <div key={`${receipt.factor}-${index}`} style={styles.activityItem}>
                <div style={styles.activityMeta}>
                  <span style={styles.activityAction}>{translatePlanFactor(locale, receipt.factor)}</span>
                  <span>{translatePlanBasis(locale, receipt.basis)}</span>
                </div>
                <div style={styles.activityMessage}>{translatePlanEvidence(locale, receipt.evidence)}</div>
                <div style={styles.activityMessage}>{translatePlanNarrative(locale, receipt.effect)}</div>
                {receipt.counterfactual ? (
                  <div style={{ ...styles.subtext, margin: '6px 0 0' }}>
                    {translatePlanCounterfactual(locale, receipt.counterfactual)}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
