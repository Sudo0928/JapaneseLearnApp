import { useEffect, useState } from 'react';
import type { ExperimentAssignment } from '@japanese-learn/shared';
import { fetchExperiments } from '../services/api';
import { useSettings } from '../context/settings';
import styles from '../styles';

export default function ExperimentsPage() {
  const { t, preferences } = useSettings();
  const [assignments, setAssignments] = useState<ExperimentAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchExperiments()
      .then((response) => setAssignments(response.assignments))
      .catch((fetchError: Error) => setError(fetchError.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={styles.center}>{t('common.loading')}</div>;
  if (error) return <div style={styles.errorBox}>{error}</div>;

  return (
    <div style={styles.page}>
      <h2 style={styles.heading}>{t('web.experiments.title')}</h2>
      <p style={styles.subtext}>{t('web.experiments.subtitle')}</p>

      <div style={styles.confusionBox}>
        <h3 style={styles.sectionTitle}>Active experiments</h3>
        {assignments.length === 0 ? (
          <p style={{ color: 'var(--app-text-muted)' }}>No active experiments.</p>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>exp_id</th>
                <th style={styles.th}>variant</th>
                <th style={styles.th}>assigned_at</th>
                <th style={styles.th}>purpose</th>
                <th style={styles.th}>opt_out</th>
              </tr>
            </thead>
            <tbody>
              {assignments.map((assignment, index) => (
                <tr key={`${assignment.exp_id}-${index}`} style={index % 2 === 0 ? styles.trEven : styles.trOdd}>
                  <td style={styles.td}>{assignment.exp_id}</td>
                  <td style={styles.td}>{assignment.variant}</td>
                  <td style={styles.td}>
                    {assignment.assigned_at ? new Date(assignment.assigned_at).toLocaleString(preferences.locale) : '-'}
                  </td>
                  <td style={styles.td}>{assignment.purpose ?? '-'}</td>
                  <td style={styles.td}>{String(assignment.opt_out_supported ?? true)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
