import { useEffect, useState } from 'react';
import { fetchExperiments, fetchAaValidation, ExperimentAssignment } from '../services/api';
import styles from '../styles';

export default function ExperimentsPage() {
  const [assignments, setAssignments] = useState<ExperimentAssignment[]>([]);
  const [aaBalance, setAaBalance] = useState<{ control_count: number; treatment_count: number; balance_ok: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([fetchExperiments(), fetchAaValidation()])
      .then(([exp, aa]) => {
        setAssignments(exp.assignments);
        setAaBalance(aa);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={styles.center}>불러오는 중...</div>;
  if (error)   return <div style={styles.errorBox}>{error}</div>;

  return (
    <div style={styles.page}>
      <h2 style={styles.heading}>실험 현황 (A/B)</h2>

      {/* A/A 균형 검증 */}
      {aaBalance && (
        <div style={{ ...styles.insightBox, marginBottom: 24 }}>
          <h3 style={styles.sectionTitle}>A/A 균형 검증</h3>
          <div style={styles.kpiRow}>
            <div style={styles.kpiCard}>
              <div style={{ ...styles.kpiValue, color: '#6366f1' }}>{aaBalance.control_count}</div>
              <div style={styles.kpiLabel}>Control</div>
            </div>
            <div style={styles.kpiCard}>
              <div style={{ ...styles.kpiValue, color: '#059669' }}>{aaBalance.treatment_count}</div>
              <div style={styles.kpiLabel}>Treatment</div>
            </div>
            <div style={styles.kpiCard}>
              <div style={{
                ...styles.kpiValue,
                color: aaBalance.balance_ok ? '#059669' : '#ef4444',
              }}>
                {aaBalance.balance_ok ? '균형 OK' : '불균형 주의'}
              </div>
              <div style={styles.kpiLabel}>상태</div>
            </div>
          </div>
        </div>
      )}

      {/* 배정 목록 */}
      <div style={styles.confusionBox}>
        <h3 style={styles.sectionTitle}>내 실험 배정</h3>
        {assignments.length === 0 ? (
          <p style={{ color: '#64748b' }}>배정된 실험 없음</p>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>실험 ID</th>
                <th style={styles.th}>배정 변형</th>
                <th style={styles.th}>배정 일시</th>
              </tr>
            </thead>
            <tbody>
              {assignments.map((a, i) => (
                <tr key={a.exp_id} style={i % 2 === 0 ? styles.trEven : styles.trOdd}>
                  <td style={styles.td}>{a.exp_id}</td>
                  <td style={styles.td}>
                    <span style={{
                      ...styles.kpiLabel,
                      background: a.variant === 'control' ? '#e0e7ff' : '#dcfce7',
                      color: a.variant === 'control' ? '#4338ca' : '#166534',
                      borderRadius: 4,
                      padding: '2px 8px',
                    }}>
                      {a.variant}
                    </span>
                  </td>
                  <td style={styles.td}>{new Date(a.assigned_at).toLocaleString('ko-KR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
