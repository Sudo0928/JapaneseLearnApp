import { useState } from 'react';
import type { AaValidationResponse, ReportBatchResponse, ShadowStatusResponse } from '@japanese-learn/shared';
import type { AdminKeySnapshot } from '../services/admin-api';
import {
  clearAdminKey,
  fetchAaValidation,
  fetchShadowStatus,
  getAdminKeySnapshot,
  runReportBatch,
  setAdminKey,
} from '../services/admin-api';
import styles from '../styles';

type ActivityStatus = 'info' | 'success' | 'error';

interface ActivityEntry {
  id: string;
  action: string;
  status: ActivityStatus;
  message: string;
  at: string;
}

function formatDateTime(value: string | null): string {
  if (!value) return '-';
  return new Date(value).toLocaleString();
}

function makeActivity(action: string, status: ActivityStatus, message: string): ActivityEntry {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    action,
    status,
    message,
    at: new Date().toISOString(),
  };
}

function loadKeySnapshot(): AdminKeySnapshot {
  return getAdminKeySnapshot();
}

export default function AdminOperationsPage() {
  const [keySnapshot, setKeySnapshot] = useState(loadKeySnapshot);
  const [adminKeyInput, setAdminKeyInput] = useState(() => loadKeySnapshot().value ?? '');
  const [experimentId, setExperimentId] = useState('aa_baseline_v1');
  const [aaBalance, setAaBalance] = useState<AaValidationResponse | null>(null);
  const [batchResult, setBatchResult] = useState<ReportBatchResponse | null>(null);
  const [lastAaValidatedAt, setLastAaValidatedAt] = useState<string | null>(null);
  const [lastBatchRunAt, setLastBatchRunAt] = useState<string | null>(null);
  const [shadowStatus, setShadowStatus] = useState<ShadowStatusResponse | null>(null);
  const [lastShadowLoadedAt, setLastShadowLoadedAt] = useState<string | null>(null);
  const [loadingAction, setLoadingAction] = useState<'aa' | 'batch' | 'shadow' | ''>('');
  const [error, setError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [activity, setActivity] = useState<ActivityEntry[]>([]);

  const hasSavedKey = keySnapshot.hasKey;
  const savedKeyValue = keySnapshot.value ?? '';
  const trimmedInput = adminKeyInput.trim();
  const isDirty = trimmedInput !== savedKeyValue;

  function refreshKeySnapshot() {
    setKeySnapshot(loadKeySnapshot());
  }

  function pushActivity(entry: ActivityEntry) {
    setActivity((prev) => [entry, ...prev].slice(0, 8));
  }

  function handleSaveAdminKey() {
    if (!trimmedInput) {
      const message = 'Enter an Admin API key before saving.';
      setError(message);
      setStatusMessage('');
      pushActivity(makeActivity('key.save', 'error', message));
      return;
    }

    setAdminKey(trimmedInput);
    setAdminKeyInput(trimmedInput);
    refreshKeySnapshot();
    setError('');
    setStatusMessage('Admin API key saved. All admin actions now use the saved key only.');
    pushActivity(makeActivity('key.save', 'success', 'Admin API key saved'));
  }

  function handleClearAdminKey() {
    clearAdminKey();
    refreshKeySnapshot();
    setAdminKeyInput('');
    setError('');
    setStatusMessage('Saved Admin API key removed.');
    setAaBalance(null);
    setBatchResult(null);
    setLastAaValidatedAt(null);
    setLastBatchRunAt(null);
    pushActivity(makeActivity('key.clear', 'info', 'Admin API key removed'));
  }

  async function handleValidateAa() {
    if (!hasSavedKey) {
      const message = 'Save an Admin API key before running A/A validation.';
      setError(message);
      setStatusMessage('');
      pushActivity(makeActivity('aa.validate', 'error', message));
      return;
    }

    setLoadingAction('aa');
    setError('');
    setStatusMessage('');
    try {
      const result = await fetchAaValidation(experimentId.trim() || 'aa_baseline_v1');
      const executedAt = new Date().toISOString();
      setAaBalance(result);
      setLastAaValidatedAt(executedAt);
      refreshKeySnapshot();
      setStatusMessage('A/A validation completed.');
      pushActivity(
        makeActivity(
          'aa.validate',
          'success',
          `${result.exp_id} validated (ratio=${result.balance_ratio.toFixed(3)})`
        )
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      pushActivity(makeActivity('aa.validate', 'error', message));
    } finally {
      setLoadingAction('');
    }
  }

  async function handleRunBatch() {
    if (!hasSavedKey) {
      const message = 'Save an Admin API key before running the report batch.';
      setError(message);
      setStatusMessage('');
      pushActivity(makeActivity('report.batch', 'error', message));
      return;
    }

    setLoadingAction('shadow');
    setError('');
    setStatusMessage('');
    try {
      const result = await runReportBatch();
      const executedAt = new Date().toISOString();
      setBatchResult(result);
      setLastBatchRunAt(executedAt);
      refreshKeySnapshot();
      setStatusMessage('Report batch completed.');
      pushActivity(
        makeActivity(
          'report.batch',
          'success',
          `${result.generated_reports ?? 0} generated / ${result.failed_users ?? 0} failed`
        )
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      pushActivity(makeActivity('report.batch', 'error', message));
    } finally {
      setLoadingAction('');
    }
  }

  async function handleLoadShadowStatus() {
    if (!hasSavedKey) {
      const message = 'Save an Admin API key before loading shadow status.';
      setError(message);
      setStatusMessage('');
      pushActivity(makeActivity('shadow.status', 'error', message));
      return;
    }

    setLoadingAction('batch');
    setError('');
    setStatusMessage('');
    try {
      const result = await fetchShadowStatus();
      const loadedAt = new Date().toISOString();
      setShadowStatus(result);
      setLastShadowLoadedAt(loadedAt);
      refreshKeySnapshot();
      setStatusMessage('Shadow status loaded.');
      pushActivity(makeActivity('shadow.status', 'success', `Loaded ${result.users.length} user rows and cohort status.`));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      pushActivity(makeActivity('shadow.status', 'error', message));
    } finally {
      setLoadingAction('');
    }
  }

  return (
    <div style={styles.page}>
      <h2 style={styles.heading}>Admin Operations</h2>
      <p style={styles.subtext}>Separate admin-only surface for A/A validation and manual report jobs.</p>

      {statusMessage && <div style={styles.successBox}>{statusMessage}</div>}
      {error && <div style={styles.errorBox}>{error}</div>}

      <section style={styles.adminPanel}>
        <h3 style={styles.sectionTitle}>Admin Auth</h3>
        <div style={styles.statusGrid}>
          <div style={styles.statusCard}>
            <div style={styles.statusLabel}>Stored State</div>
            <div style={styles.statusValue}>{hasSavedKey ? 'saved' : 'missing'}</div>
          </div>
          <div style={styles.statusCard}>
            <div style={styles.statusLabel}>Saved Key</div>
            <div style={styles.statusValue}>{keySnapshot.maskedValue ?? '-'}</div>
          </div>
          <div style={styles.statusCard}>
            <div style={styles.statusLabel}>Last Saved</div>
            <div style={styles.statusValue}>{formatDateTime(keySnapshot.savedAt)}</div>
          </div>
          <div style={styles.statusCard}>
            <div style={styles.statusLabel}>Last Used</div>
            <div style={styles.statusValue}>{formatDateTime(keySnapshot.lastUsedAt)}</div>
          </div>
        </div>

        <p style={styles.formHint}>
          Requests are sent only with the stored <code style={styles.inlineCode}>x-admin-key</code>.
          Unsaved input is never used for execution.
        </p>

        <label style={styles.formLabel} htmlFor="admin-key">Admin API Key</label>
        <input
          id="admin-key"
          type="password"
          value={adminKeyInput}
          onChange={(e) => setAdminKeyInput(e.target.value)}
          placeholder="Enter x-admin-key"
          autoComplete="off"
          style={styles.formInput}
        />
        <div style={styles.buttonRow}>
          <button
            type="button"
            style={styles.primaryButton}
            onClick={handleSaveAdminKey}
            disabled={!trimmedInput || !isDirty || loadingAction !== ''}
          >
            {isDirty ? 'Save Key' : 'Saved'}
          </button>
          <button
            type="button"
            style={styles.secondaryButton}
            onClick={handleClearAdminKey}
            disabled={loadingAction !== '' || (!hasSavedKey && !trimmedInput)}
          >
            Remove Key
          </button>
        </div>
      </section>

      <section style={styles.adminPanel}>
        <h3 style={styles.sectionTitle}>A/A Validation</h3>
        <p style={styles.subtext}>Check whether assignment balance remains within the expected range.</p>
        <label style={styles.formLabel} htmlFor="experiment-id">Experiment ID</label>
        <input
          id="experiment-id"
          value={experimentId}
          onChange={(e) => setExperimentId(e.target.value)}
          placeholder="aa_baseline_v1"
          style={styles.formInput}
        />
        {!hasSavedKey && (
          <p style={styles.warningText}>A saved Admin API key is required before validation can run.</p>
        )}
        <div style={styles.buttonRow}>
          <button
            type="button"
            style={styles.primaryButton}
            onClick={handleValidateAa}
            disabled={loadingAction !== '' || !hasSavedKey}
          >
            {loadingAction === 'aa' ? 'Validating...' : 'Run A/A Validation'}
          </button>
        </div>

        {aaBalance && (
          <>
            <div style={styles.metricGrid}>
              <div style={styles.metricCard}>
                <div style={styles.metricValue}>{aaBalance.control_count}</div>
                <div style={styles.metricLabel}>Control</div>
              </div>
              <div style={styles.metricCard}>
                <div style={styles.metricValue}>{aaBalance.treatment_count}</div>
                <div style={styles.metricLabel}>Treatment</div>
              </div>
              <div style={styles.metricCard}>
                <div style={styles.metricValue}>{aaBalance.balance_ratio.toFixed(3)}</div>
                <div style={styles.metricLabel}>Balance Ratio</div>
              </div>
              <div style={styles.metricCard}>
                <div style={{ ...styles.metricValue, color: aaBalance.is_balanced ? '#166534' : '#b91c1c' }}>
                  {aaBalance.is_balanced ? 'Balanced' : 'Review Needed'}
                </div>
                <div style={styles.metricLabel}>Status</div>
              </div>
            </div>
            <div style={styles.resultBox}>
              <div style={styles.resultRow}>
                <strong>Experiment</strong>
                <span>{aaBalance.exp_id}</span>
              </div>
              <div style={styles.resultRow}>
                <strong>Executed At</strong>
                <span>{formatDateTime(lastAaValidatedAt)}</span>
              </div>
            </div>
          </>
        )}
      </section>

      <section style={styles.adminPanel}>
        <h3 style={styles.sectionTitle}>Report Batch</h3>
        <p style={styles.subtext}>Manual batch trigger for report generation and recovery checks.</p>
        {!hasSavedKey && (
          <p style={styles.warningText}>A saved Admin API key is required before the batch can run.</p>
        )}
        <div style={styles.buttonRow}>
          <button
            type="button"
            style={styles.primaryButton}
            onClick={handleRunBatch}
            disabled={loadingAction !== '' || !hasSavedKey}
          >
            {loadingAction === 'batch' ? 'Running...' : 'Run Report Batch'}
          </button>
        </div>

        {batchResult && (
          <div style={styles.resultBox}>
            <div style={styles.resultRow}>
              <strong>Message</strong>
              <span>{batchResult.message}</span>
            </div>
            <div style={styles.resultRow}>
              <strong>Executed At</strong>
              <span>{formatDateTime(lastBatchRunAt)}</span>
            </div>
            <div style={styles.resultRow}>
              <strong>Processed Users</strong>
              <span>{batchResult.processed_users ?? '-'}</span>
            </div>
            <div style={styles.resultRow}>
              <strong>Generated Reports</strong>
              <span>{batchResult.generated_reports ?? '-'}</span>
            </div>
            <div style={styles.resultRow}>
              <strong>Failed Users</strong>
              <span>{batchResult.failed_users ?? '-'}</span>
            </div>
            <div style={styles.resultRow}>
              <strong>Shadow Models Refreshed</strong>
              <span>{batchResult.shadow_models_refreshed ?? '-'}</span>
            </div>
          </div>
        )}
      </section>

      <section style={styles.adminPanel}>
        <h3 style={styles.sectionTitle}>Shadow Gate Status</h3>
        <p style={styles.subtext}>Readiness snapshot for user-level and cohort-level HLR promotion.</p>
        {!hasSavedKey && (
          <p style={styles.warningText}>A saved Admin API key is required before shadow status can load.</p>
        )}
        <div style={styles.buttonRow}>
          <button
            type="button"
            style={styles.primaryButton}
            onClick={handleLoadShadowStatus}
            disabled={loadingAction !== '' || !hasSavedKey}
          >
            {loadingAction === 'shadow' ? 'Loading...' : 'Load Shadow Status'}
          </button>
        </div>

        {shadowStatus?.cohort ? (
          <div style={styles.resultBox}>
            <div style={styles.resultRow}>
              <strong>Cohort State</strong>
              <span>{shadowStatus.cohort.eligibility_state}</span>
            </div>
            <div style={styles.resultRow}>
              <strong>Cohort Failure Reason</strong>
              <span>{shadowStatus.cohort.failure_reason ?? '-'}</span>
            </div>
            <div style={styles.resultRow}>
              <strong>Cohort Log Loss</strong>
              <span>{shadowStatus.cohort.calibration_score.log_loss.toFixed(4)}</span>
            </div>
            <div style={styles.resultRow}>
              <strong>Cohort Baseline</strong>
              <span>{shadowStatus.cohort.calibration_score.baseline_log_loss.toFixed(4)}</span>
            </div>
            <div style={styles.resultRow}>
              <strong>Loaded At</strong>
              <span>{formatDateTime(lastShadowLoadedAt)}</span>
            </div>
          </div>
        ) : null}

        {shadowStatus?.users?.length ? (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>scope</th>
                <th style={styles.th}>subject</th>
                <th style={styles.th}>state</th>
                <th style={styles.th}>log_loss</th>
                <th style={styles.th}>baseline</th>
                <th style={styles.th}>reason</th>
                <th style={styles.th}>evaluated_at</th>
              </tr>
            </thead>
            <tbody>
              {shadowStatus.users.map((entry, index) => (
                <tr key={`${entry.scope}-${entry.subject_id}`} style={index % 2 === 0 ? styles.trEven : styles.trOdd}>
                  <td style={styles.td}>{entry.scope}</td>
                  <td style={styles.td}>{entry.subject_id}</td>
                  <td style={styles.td}>{entry.eligibility_state}</td>
                  <td style={styles.td}>{entry.calibration_score.log_loss.toFixed(4)}</td>
                  <td style={styles.td}>{entry.calibration_score.baseline_log_loss.toFixed(4)}</td>
                  <td style={styles.td}>{entry.failure_reason ?? '-'}</td>
                  <td style={styles.td}>{entry.last_shadow_eval_at ? new Date(entry.last_shadow_eval_at).toLocaleString() : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </section>

      <section style={styles.adminPanel}>
        <h3 style={styles.sectionTitle}>Recent Activity</h3>
        {activity.length === 0 ? (
          <p style={styles.subtext}>No admin actions have been run in this browser yet.</p>
        ) : (
          <div style={styles.activityList}>
            {activity.map((entry) => (
              <div key={entry.id} style={styles.activityItem}>
                <div style={styles.activityMeta}>
                  <span style={styles.activityAction}>{entry.action}</span>
                  <span
                    style={{
                      ...styles.activityStatus,
                      color: entry.status === 'success' ? '#166534' : entry.status === 'error' ? '#b91c1c' : '#1d4ed8',
                    }}
                  >
                    {entry.status}
                  </span>
                  <span>{formatDateTime(entry.at)}</span>
                </div>
                <div style={styles.activityMessage}>{entry.message}</div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
