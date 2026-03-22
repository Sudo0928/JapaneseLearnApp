# Release Gate Checklist

This checklist is the required gate for the alignment v4/v5 cycle.

## 1. Migration rollout

Run in order:

```bash
npm run migrate --workspace=packages/backend
```

Verify:

```sql
SELECT filename FROM migration_log ORDER BY id DESC LIMIT 5;
SELECT column_name FROM information_schema.columns WHERE table_name = 'diagnosis_results';
SELECT column_name FROM information_schema.columns WHERE table_name = 'model_params';
```

Required outcomes:

- `014_alignment_v3.sql` is present in `migration_log`
- `015_diagnosis_v4_shadow_gate.sql` is present in `migration_log`
- `diagnosis_results` includes `question_count`, `confidence_by_axis`, `adaptive_reason_codes`
- `model_params` includes `eligibility_state`, `metrics_json`, `recommended_action`

## 2. Automatic gates

Run all:

```bash
npm run build --workspace=packages/shared
npm test --workspace=packages/backend
npx tsc --noEmit -p packages/backend/tsconfig.json
npx tsc --noEmit --project packages/mobile/tsconfig.json
npm run build --workspace=packages/web
npm run check:generated
```

## 3. Manual device checklist

Mobile:

1. Login -> consent -> diagnosis -> plan -> session completion
2. Record reviews while offline -> reconnect -> sync succeeds
3. Download export from privacy cockpit
4. Delete account -> app requires login again

Web:

1. `/login` succeeds and bootstraps `/today`
2. `/report` renders normally
3. `/experiments` renders normally
4. `/admin/operations` can load shadow status with a valid admin key

## 4. Admin checks

- Run report batch once
- Confirm `shadow_models_refreshed` is non-zero
- Load shadow status
- Confirm cohort state is visible
- Confirm at least one user row includes `eligibility_state`, `log_loss`, `baseline_log_loss`, and `failure_reason`
