import { useEffect, useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import type { WeeklyReport } from '@japanese-learn/shared';
import {
  buildLocalizedReportInsights,
  formatReportPeriod,
  getReportOverduePerDayLabel,
  getReportTableColumnLabel,
  translateReportErrorType,
} from '@japanese-learn/shared';
import { fetchWeeklyReport } from '../services/api';
import { useSettings } from '../context/settings';
import styles from '../styles';

function pct(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

export default function ReportPage() {
  const { t, preferences } = useSettings();
  const [report, setReport] = useState<WeeklyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchWeeklyReport()
      .then(setReport)
      .catch((fetchError: Error) => setError(fetchError.message))
      .finally(() => setLoading(false));
  }, []);

  const locale = preferences.locale;
  const overdueLabel = getReportOverduePerDayLabel(locale);
  const insights = useMemo(
    () => (report ? buildLocalizedReportInsights(locale, report) : []),
    [locale, report],
  );

  if (loading) return <div style={styles.center}>{t('common.loading')}</div>;
  if (error) return <div style={styles.errorBox}>{error}</div>;
  if (!report) return null;

  const avgCorrectRate = report.summary.avg_correct_rate;
  const delayedRecallRate = report.retention_metrics.due_7d.recall_rate;
  const overdueRate = report.daily_stats.length > 0
    ? report.summary.overdue_days / report.daily_stats.length
    : 0;

  const kpiData = [
    { name: t('report.accuracy'), value: avgCorrectRate, color: 'var(--app-primary)' },
    { name: t('report.delayedRecall'), value: delayedRecallRate, color: '#0f9d73' },
    { name: overdueLabel, value: overdueRate, color: '#d14343' },
  ];

  return (
    <div style={styles.page}>
      <h2 style={styles.heading}>{t('web.report.title')}</h2>
      <p style={styles.subtext}>{formatReportPeriod(locale, report.period.from, report.period.to)}</p>

      <div style={styles.kpiRow}>
        <KpiCard label={t('report.totalReviews')} value={String(report.summary.total_reviews)} />
        <KpiCard label={t('report.streak')} value={`${report.summary.streak_days}d`} color="#f59e0b" />
        <KpiCard label={t('report.delayedRecall')} value={pct(delayedRecallRate)} color="#0f9d73" />
        <KpiCard label={overdueLabel} value={pct(overdueRate)} color="#d14343" />
      </div>

      <div style={styles.chartBox}>
        <h3 style={styles.sectionTitle}>{t('report.analysis')}</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={kpiData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--app-border)" />
            <XAxis dataKey="name" tick={{ fontSize: 13, fill: 'var(--app-text-muted)' }} />
            <YAxis
              tickFormatter={(value: number) => pct(value)}
              domain={[0, 1]}
              tick={{ fontSize: 12, fill: 'var(--app-text-muted)' }}
            />
            <Tooltip formatter={(value: number) => pct(value)} />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {kpiData.map((datum) => <Cell key={datum.name} fill={datum.color} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {insights.length > 0 ? (
        <div style={styles.insightBox}>
          <h3 style={styles.sectionTitle}>{t('report.analysis')}</h3>
          <ul style={styles.insightList}>
            {insights.map((insight) => (
              <li key={insight} style={styles.insightItem}>{insight}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {report.confusion_metrics.top_confusions.length > 0 ? (
        <div style={styles.confusionBox}>
          <h3 style={styles.sectionTitle}>{t('report.confusions')}</h3>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>{getReportTableColumnLabel(locale, 'surface')}</th>
                <th style={styles.th}>{getReportTableColumnLabel(locale, 'errorType')}</th>
                <th style={styles.th}>{getReportTableColumnLabel(locale, 'count')}</th>
              </tr>
            </thead>
            <tbody>
              {report.confusion_metrics.top_confusions.map((item, index) => (
                <tr
                  key={`${item.surface}-${item.error_type}`}
                  style={index % 2 === 0 ? styles.trEven : styles.trOdd}
                >
                  <td style={styles.td}>{item.surface}</td>
                  <td style={styles.td}>{translateReportErrorType(locale, item.error_type)}</td>
                  <td style={{ ...styles.td, textAlign: 'center' }}>{item.error_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

function KpiCard({ label, value, color = 'var(--app-primary)' }: { label: string; value: string; color?: string }) {
  return (
    <div style={styles.kpiCard}>
      <div style={{ ...styles.kpiValue, color }}>{value}</div>
      <div style={styles.kpiLabel}>{label}</div>
    </div>
  );
}
