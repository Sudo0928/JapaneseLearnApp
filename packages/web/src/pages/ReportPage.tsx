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

  const kpiData = [
    { name: '정답률',       value: report.correct_rate,       color: '#6366f1' },
    { name: '지연 인출률',  value: report.delayed_recall_rate, color: '#059669' },
    { name: '연체율',       value: report.overdue_rate,        color: '#ef4444' },
  ];

  return (
    <div style={styles.page}>
      <h2 style={styles.heading}>주간 리포트</h2>
      <p style={styles.subtext}>{report.week_start} ~ {report.week_end}</p>

      {/* KPI 카드 */}
      <div style={styles.kpiRow}>
        <KpiCard label="총 리뷰"      value={`${report.total_reviews}건`} />
        <KpiCard label="스트릭"        value={`${report.streak_days}일`} color="#f59e0b" />
        <KpiCard label="지연 인출률"  value={pct(report.delayed_recall_rate)} color="#059669" />
        <KpiCard label="연체율"        value={pct(report.overdue_rate)} color="#ef4444" />
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
      {report.top_confusion_pairs.length > 0 && (
        <div style={styles.confusionBox}>
          <h3 style={styles.sectionTitle}>자주 혼동하는 단어 Top 5</h3>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>단어 A</th>
                <th style={styles.th}>단어 B</th>
                <th style={styles.th}>혼동 횟수</th>
              </tr>
            </thead>
            <tbody>
              {report.top_confusion_pairs.map((p, i) => (
                <tr key={i} style={i % 2 === 0 ? styles.trEven : styles.trOdd}>
                  <td style={styles.td}>{p.item_a}</td>
                  <td style={styles.td}>{p.item_b}</td>
                  <td style={{ ...styles.td, textAlign: 'center' }}>{p.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
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
