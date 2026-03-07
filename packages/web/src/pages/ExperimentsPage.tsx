import { useEffect, useState } from 'react';
import { fetchExperiments, ExperimentAssignment } from '../services/api';
import styles from '../styles';

export default function ExperimentsPage() {
  const [assignments, setAssignments] = useState<ExperimentAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchExperiments()
      .then((exp) => {
        setAssignments(exp.assignments);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={styles.center}>불러오는 중...</div>;
  if (error)   return <div style={styles.errorBox}>{error}</div>;

  return (
    <div style={styles.page}>
      <h2 style={styles.heading}>내 실험 배정</h2>
      <p style={styles.subtext}>운영 검증(A/A 균형, 배치 실행)은 관리자 도구에서만 확인합니다.</p>

      {/* 배정 목록 */}
      <div style={styles.confusionBox}>
        <h3 style={styles.sectionTitle}>활성 실험</h3>
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
                  <td style={styles.td}>
                    {a.assigned_at ? new Date(a.assigned_at).toLocaleString('ko-KR') : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
