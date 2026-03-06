import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { fetchWeeklyReport, WeeklyReport } from '../services/api';
import styles from '../styles';

function pct(v: number) { return `${(v * 100).toFixed(1)}%`; }

export default function ReportPage() {
  const [report, setReport] = useState<WeeklyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchWeeklyReport()
      .then(setReport)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={styles.center}>불러오는 중...</div>;
  if (error)   return <div style={styles.errorBox}>{error}</div>;
  if (!report) return null;

  const avgCorrectRate = report.summary.avg_correct_rate;
  const delayedRecallRate = report.retention_metrics.due_7d.recall_rate;
  const overdueRate = report.daily_stats.length > 0
    ? report.summary.overdue_days / report.daily_stats.length
    : 0;

  const kpiData = [
    { name: '정답률',       value: avgCorrectRate,     color: '#6366f1' },
    { name: '지연 인출률',  value: delayedRecallRate,  color: '#059669' },
    { name: '연체율',       value: overdueRate,        color: '#ef4444' },
  ];

  return (
    <div style={styles.page}>
      <h2 style={styles.heading}>주간 리포트</h2>
      <p style={styles.subtext}>{report.period.from} ~ {report.period.to}</p>

      {/* KPI 카드 */}
      <div style={styles.kpiRow}>
        <KpiCard label="총 리뷰"      value={`${report.summary.total_reviews}건`} />
        <KpiCard label="스트릭"        value={`${report.summary.streak_days}일`} color="#f59e0b" />
        <KpiCard label="지연 인출률"  value={pct(delayedRecallRate)} color="#059669" />
        <KpiCard label="연체율"        value={pct(overdueRate)} color="#ef4444" />
      </div>

      <div style={styles.kpiRow}>
        <KpiCard label="14일 유지" value={pct(report.retention_metrics.due_14d.recall_rate)} color="#0ea5e9" />
        <KpiCard label="30일 유지" value={pct(report.retention_metrics.due_30d.recall_rate)} color="#8b5cf6" />
        <KpiCard label="연체 보정" value={pct(report.retention_metrics.overdue_adjusted_recall_rate)} color="#f97316" />
        <KpiCard label="회복 완료율" value={pct(report.recovery_metrics.recovery_completion_rate)} color="#22c55e" />
      </div>

      {/* 바 차트 */}
      <div style={styles.chartBox}>
        <h3 style={styles.sectionTitle}>핵심 지표</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={kpiData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="name" tick={{ fontSize: 13 }} />
            <YAxis tickFormatter={(v: number) => pct(v)} domain={[0, 1]} tick={{ fontSize: 12 }} />
            <Tooltip formatter={(v: number) => pct(v)} />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {kpiData.map((d, i) => <Cell key={i} fill={d.color} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 인사이트 */}
      {report.insights.length > 0 && (
        <div style={styles.insightBox}>
          <h3 style={styles.sectionTitle}>인사이트</h3>
          <ul style={styles.insightList}>
            {report.insights.map((ins, i) => (
              <li key={i} style={styles.insightItem}>{ins}</li>
            ))}
          </ul>
        </div>
      )}

      {/* 혼동쌍 */}
      {report.confusion_metrics.top_confusions.length > 0 && (
        <div style={styles.confusionBox}>
          <h3 style={styles.sectionTitle}>자주 흔들리는 항목 Top 5</h3>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>표기</th>
                <th style={styles.th}>오류 유형</th>
                <th style={styles.th}>오류 횟수</th>
              </tr>
            </thead>
            <tbody>
              {report.confusion_metrics.top_confusions.map((p, i) => (
                <tr key={i} style={i % 2 === 0 ? styles.trEven : styles.trOdd}>
                  <td style={styles.td}>{p.surface}</td>
                  <td style={styles.td}>{p.error_type}</td>
                  <td style={{ ...styles.td, textAlign: 'center' }}>{p.error_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={styles.insightBox}>
        <h3 style={styles.sectionTitle}>회복 지표</h3>
        <ul style={styles.insightList}>
          <li style={styles.insightItem}>평균 연체 백로그: {report.recovery_metrics.overdue_backlog_days.toFixed(1)}일</li>
          <li style={styles.insightItem}>정상화까지 소요: {report.recovery_metrics.recovery_time_to_normal_days ?? '-'}일</li>
          <li style={styles.insightItem}>
            회복 후 유지율: {report.recovery_metrics.post_recovery_retention !== null
              ? pct(report.recovery_metrics.post_recovery_retention)
              : '데이터 부족'}
          </li>
        </ul>
      </div>
    </div>
  );
}

function KpiCard({ label, value, color = '#6366f1' }: { label: string; value: string; color?: string }) {
  return (
    <div style={styles.kpiCard}>
      <div style={{ ...styles.kpiValue, color }}>{value}</div>
      <div style={styles.kpiLabel}>{label}</div>
    </div>
  );
}
