import type { SupportedLocale } from '@japanese-learn/shared';

type LocaleText = Record<SupportedLocale, string>;

const FACTOR_LABELS: Record<string, LocaleText> = {
  behavior_blend: {
    ko: '\uD589\uB3D9 \uB370\uC774\uD130 \uBC18\uC601',
    en: 'Behavior blend',
    ja: '\u884C\u52D5\u30C7\u30FC\u30BF\u53CD\u6620',
  },
  ab_plan_mix: {
    ko: '\uD50C\uB79C \uC2E4\uD5D8',
    en: 'Plan experiment',
    ja: '\u30D7\u30E9\u30F3\u5B9F\u9A13',
  },
  recovery_plan: {
    ko: '\uD68C\uBCF5 \uACC4\uD68D',
    en: 'Recovery plan',
    ja: '\u56DE\u5FA9\u30D7\u30E9\u30F3',
  },
  target_date: {
    ko: '\uBAA9\uD45C\uC77C',
    en: 'Target date',
    ja: '\u76EE\u6A19\u65E5',
  },
  focus_reading: {
    ko: '\uC77D\uAE30 \uC9D1\uC911',
    en: 'Reading focus',
    ja: '\u8AAD\u307F\u91CD\u8996',
  },
  focus_production: {
    ko: '\uC0DD\uC131 \uC9D1\uC911',
    en: 'Production focus',
    ja: '\u751F\u6210\u91CD\u8996',
  },
  offline_expected: {
    ko: '\uC624\uD504\uB77C\uC778 \uC608\uC0C1',
    en: 'Offline expected',
    ja: '\u30AA\u30D5\u30E9\u30A4\u30F3\u60F3\u5B9A',
  },
  recall_gap: {
    ko: '\uC778\uCD9C \uACA9\uCC28',
    en: 'Recall gap',
    ja: '\u60F3\u8D77\u30AE\u30E3\u30C3\u30D7',
  },
  reading_weak: {
    ko: '\uC77D\uAE30 \uCDE8\uC57D',
    en: 'Reading weakness',
    ja: '\u8AAD\u307F\u306E\u5F31\u3055',
  },
  form_weak: {
    ko: '\uD45C\uAE30 \uCDE8\uC57D',
    en: 'Form weakness',
    ja: '\u8868\u8A18\u306E\u5F31\u3055',
  },
  load_sensitive: {
    ko: '\uC778\uC9C0 \uBD80\uD558 \uBBFC\uAC10',
    en: 'Load sensitivity',
    ja: '\u8CA0\u8377\u611F\u5EA6',
  },
  lateness_fragile: {
    ko: '\uC9C0\uC5F0 \uCDE8\uC57D',
    en: 'Lateness fragility',
    ja: '\u9045\u5EF6\u8106\u5F31\u6027',
  },
};

const BASIS_LABELS: Record<string, LocaleText> = {
  diagnosis: {
    ko: '\uC9C4\uB2E8',
    en: 'Diagnosis',
    ja: '\u8A3A\u65AD',
  },
  behavior: {
    ko: '\uD589\uB3D9',
    en: 'Behavior',
    ja: '\u884C\u52D5',
  },
  goal: {
    ko: '\uBAA9\uD45C',
    en: 'Goal',
    ja: '\u76EE\u6A19',
  },
  recovery: {
    ko: '\uD68C\uBCF5',
    en: 'Recovery',
    ja: '\u56DE\u5FA9',
  },
};

const GENERIC_LABELS: Record<string, LocaleText> = {
  recent_review_events: {
    ko: '\uCD5C\uADFC \uBCF5\uC2B5 \uC774\uBCA4\uD2B8',
    en: 'Recent review events',
    ja: '\u76F4\u8FD1\u306E\u5FA9\u7FD2\u30A4\u30D9\u30F3\u30C8',
  },
  variant: {
    ko: '\uC2E4\uD5D8 \uBC84\uC804',
    en: 'Variant',
    ja: '\u30D0\u30EA\u30A2\u30F3\u30C8',
  },
  overdue_cards: {
    ko: '\uC5F0\uCCB4 \uCE74\uB4DC',
    en: 'Overdue cards',
    ja: '\u5EF6\u6EDE\u30AB\u30FC\u30C9',
  },
  days_to_target: {
    ko: '\uBAA9\uD45C\uC77C\uAE4C\uC9C0',
    en: 'Days to target',
    ja: '\u76EE\u6A19\u307E\u3067\u306E\u65E5\u6570',
  },
  recall_gap: FACTOR_LABELS.recall_gap,
  reading_weak: FACTOR_LABELS.reading_weak,
  form_weak: FACTOR_LABELS.form_weak,
  load_sensitive: FACTOR_LABELS.load_sensitive,
  lateness_fragile: FACTOR_LABELS.lateness_fragile,
};

const FOCUS_LABELS: Record<string, LocaleText> = {
  READING: {
    ko: '\uC77D\uAE30',
    en: 'Reading',
    ja: '\u8AAD\u307F',
  },
  VOCAB: {
    ko: '\uC5B4\uD718',
    en: 'Vocab',
    ja: '\u8A9E\u5F59',
  },
  PRODUCTION: {
    ko: '\uC0DD\uC131',
    en: 'Production',
    ja: '\u751F\u6210',
  },
};

const BOOLEAN_LABELS: Record<'true' | 'false', LocaleText> = {
  true: {
    ko: '\uC608',
    en: 'Yes',
    ja: '\u306F\u3044',
  },
  false: {
    ko: '\uC544\uB2C8\uC624',
    en: 'No',
    ja: '\u3044\u3044\u3048',
  },
};

const NARRATIVE_LABELS: Record<string, LocaleText> = {
  'Behavior data contributes to the final strategy vector and keeps lateness risk behavior-only.': {
    ko: '\uD589\uB3D9 \uB370\uC774\uD130\uAC00 \uCD5C\uC885 \uC804\uB7B5 \uBCE1\uD130\uC5D0 \uBC18\uC601\uB418\uACE0, \uC9C0\uC5F0 \uC704\uD5D8\uC740 \uD589\uB3D9 \uB370\uC774\uD130 \uAE30\uBC18\uC73C\uB85C \uC720\uC9C0\uB429\uB2C8\uB2E4.',
    en: 'Behavior data contributes to the final strategy vector and keeps lateness risk behavior-only.',
    ja: '\u884C\u52D5\u30C7\u30FC\u30BF\u304C\u6700\u7D42\u6226\u7565\u30D9\u30AF\u30C8\u30EB\u306B\u53CD\u6620\u3055\u308C\u3001\u9045\u5EF6\u30EA\u30B9\u30AF\u306F\u884C\u52D5\u30C7\u30FC\u30BF\u306E\u307F\u3067\u8A55\u4FA1\u3055\u308C\u307E\u3059\u3002',
  },
  'SURFACE_TO_READING share increased by 10 percentage points for experiment exposure.': {
    ko: '\uC2E4\uD5D8 \uB178\uCD9C\uC744 \uC704\uD574 SURFACE_TO_READING \uBE44\uC911\uC744 10%p \uB192\uC600\uC2B5\uB2C8\uB2E4.',
    en: 'SURFACE_TO_READING share increased by 10 percentage points for experiment exposure.',
    ja: '\u5B9F\u9A13\u66DD\u9732\u306E\u305F\u3081\u306B SURFACE_TO_READING \u306E\u6BD4\u7387\u3092 10 \u30DD\u30A4\u30F3\u30C8\u4E0A\u3052\u307E\u3057\u305F\u3002',
  },
  'Retention target +0.03, review budget +20%, new cards -20%.': {
    ko: '\uC720\uC9C0\uC728 \uBAA9\uD45C\uB97C +0.03, \uBCF5\uC2B5 \uC608\uC0B0\uC744 +20%, \uC2E0\uADDC \uCE74\uB4DC\uB97C -20%\uB85C \uC870\uC815\uD588\uC2B5\uB2C8\uB2E4.',
    en: 'Retention target +0.03, review budget +20%, new cards -20%.',
    ja: '\u5B9A\u7740\u7387\u76EE\u6A19\u3092 +0.03\u3001\u5FA9\u7FD2\u4E88\u7B97\u3092 +20%\u3001\u65B0\u898F\u30AB\u30FC\u30C9\u3092 -20% \u306B\u8ABF\u6574\u3057\u307E\u3057\u305F\u3002',
  },
  'SURFACE_TO_READING share increased by 15 percentage points.': {
    ko: 'SURFACE_TO_READING \uBE44\uC911\uC744 15%p \uB192\uC600\uC2B5\uB2C8\uB2E4.',
    en: 'SURFACE_TO_READING share increased by 15 percentage points.',
    ja: 'SURFACE_TO_READING \u306E\u6BD4\u7387\u3092 15 \u30DD\u30A4\u30F3\u30C8\u4E0A\u3052\u307E\u3057\u305F\u3002',
  },
  'MEANING_TO_SURFACE share increased by 10 percentage points.': {
    ko: 'MEANING_TO_SURFACE \uBE44\uC911\uC744 10%p \uB192\uC600\uC2B5\uB2C8\uB2E4.',
    en: 'MEANING_TO_SURFACE share increased by 10 percentage points.',
    ja: 'MEANING_TO_SURFACE \u306E\u6BD4\u7387\u3092 10 \u30DD\u30A4\u30F3\u30C8\u4E0A\u3052\u307E\u3057\u305F\u3002',
  },
  'Session chunk capped at 10 minutes and new cards reduced by 10%.': {
    ko: '\uC138\uC158 \uCCAD\uD06C\uB97C \uCD5C\uB300 10\uBD84\uC73C\uB85C \uC81C\uD55C\uD558\uACE0 \uC2E0\uADDC \uCE74\uB4DC\uB97C 10% \uC904\uC600\uC2B5\uB2C8\uB2E4.',
    en: 'Session chunk capped at 10 minutes and new cards reduced by 10%.',
    ja: '\u30BB\u30C3\u30B7\u30E7\u30F3\u30C1\u30E3\u30F3\u30AF\u3092 10 \u5206\u4EE5\u5185\u306B\u6291\u3048\u3001\u65B0\u898F\u30AB\u30FC\u30C9\u3092 10% \u6E1B\u3089\u3057\u307E\u3057\u305F\u3002',
  },
  'Retrieval-heavy prompts stay elevated before recognition share expands again.': {
    ko: '\uC778\uC2DD \uBE44\uC911\uC744 \uB2E4\uC2DC \uB298\uB9AC\uAE30 \uC804\uAE4C\uC9C0 \uC778\uCD9C \uC911\uC2EC \uD504\uB86C\uD504\uD2B8\uB97C \uB192\uAC8C \uC720\uC9C0\uD569\uB2C8\uB2E4.',
    en: 'Retrieval-heavy prompts stay elevated before recognition share expands again.',
    ja: '\u518D\u3073\u8A8D\u8B58\u6BD4\u7387\u3092\u62E1\u5927\u3059\u308B\u524D\u306B\u3001\u60F3\u8D77\u91CD\u8996\u306E\u30D7\u30ED\u30F3\u30D7\u30C8\u3092\u9AD8\u3081\u306B\u7DAD\u6301\u3057\u307E\u3059\u3002',
  },
  'Reading prompts are emphasized because surface-to-reading remains unstable.': {
    ko: '\uD45C\uAE30-\uC77D\uAE30 \uCD95\uC774 \uC544\uC9C1 \uBD88\uC548\uC815\uD574\uC11C \uC77D\uAE30 \uD504\uB86C\uD504\uD2B8\uB97C \uAC15\uD654\uD569\uB2C8\uB2E4.',
    en: 'Reading prompts are emphasized because surface-to-reading remains unstable.',
    ja: '\u8868\u8A18\u304B\u3089\u8AAD\u307F\u3078\u306E\u8EF8\u304C\u307E\u3060\u4E0D\u5B89\u5B9A\u306A\u305F\u3081\u3001\u8AAD\u307F\u30D7\u30ED\u30F3\u30D7\u30C8\u3092\u5F37\u3081\u307E\u3059\u3002',
  },
  'Production checks stay active to reduce form confusion.': {
    ko: '\uD45C\uAE30 \uD63C\uB3D9\uC744 \uC904\uC774\uAE30 \uC704\uD574 \uC0DD\uC131 \uAC80\uC0AC\uB97C \uACC4\uC18D \uC720\uC9C0\uD569\uB2C8\uB2E4.',
    en: 'Production checks stay active to reduce form confusion.',
    ja: '\u8868\u8A18\u306E\u6DF7\u540C\u3092\u6E1B\u3089\u3059\u305F\u3081\u3001\u751F\u6210\u30C1\u30A7\u30C3\u30AF\u3092\u7D99\u7D9A\u3057\u307E\u3059\u3002',
  },
  'Hint steps remain conservative and session chunks shorten under cognitive load.': {
    ko: '\uC778\uC9C0 \uBD80\uD558 \uAD6C\uAC04\uC5D0\uC11C\uB294 \uD78C\uD2B8 \uB2E8\uACC4\uB97C \uBCF4\uC218\uC801\uC73C\uB85C \uC720\uC9C0\uD558\uACE0 \uC138\uC158 \uCCAD\uD06C\uB97C \uC904\uC785\uB2C8\uB2E4.',
    en: 'Hint steps remain conservative and session chunks shorten under cognitive load.',
    ja: '\u8CA0\u8377\u304C\u9AD8\u3044\u533A\u9593\u3067\u306F\u30D2\u30F3\u30C8\u6BB5\u968E\u3092\u4FDD\u5B88\u7684\u306B\u4FDD\u3061\u3001\u30BB\u30C3\u30B7\u30E7\u30F3\u30C1\u30E3\u30F3\u30AF\u3092\u77ED\u304F\u3057\u307E\u3059\u3002',
  },
  'New-card pace is reduced because late reviews already correlate with performance drop.': {
    ko: '\uC9C0\uC5F0 \uBCF5\uC2B5\uC774 \uC131\uACFC \uD558\uB77D\uACFC \uC5F0\uACB0\uB418\uC5B4 \uC788\uC5B4 \uC2E0\uADDC \uCE74\uB4DC \uD398\uC774\uC2A4\uB97C \uB0AE\uCDA5\uB2C8\uB2E4.',
    en: 'New-card pace is reduced because late reviews already correlate with performance drop.',
    ja: '\u9045\u308C\u305F\u5FA9\u7FD2\u304C\u30D1\u30D5\u30A9\u30FC\u30DE\u30F3\u30B9\u4F4E\u4E0B\u3068\u95A2\u4FC2\u3057\u3066\u3044\u308B\u305F\u3081\u3001\u65B0\u898F\u30AB\u30FC\u30C9\u306E\u30DA\u30FC\u30B9\u3092\u4E0B\u3052\u307E\u3059\u3002',
  },
  'Overdue backlog is high, so a 7-day recovery plan is active with reduced new-card pressure.': {
    ko: '\uC5F0\uCCB4 \uBC31\uB85C\uADF8\uAC00 \uD06C\uAE30 \uB54C\uBB38\uC5D0 \uC2E0\uADDC \uCE74\uB4DC \uBD80\uB2F4\uC744 \uC904\uC778 7\uC77C \uD68C\uBCF5 \uACC4\uD68D\uC774 \uD65C\uC131\uD654\uB429\uB2C8\uB2E4.',
    en: 'Overdue backlog is high, so a 7-day recovery plan is active with reduced new-card pressure.',
    ja: '\u5EF6\u6EDE\u30D0\u30C3\u30AF\u30ED\u30B0\u304C\u5927\u304D\u3044\u305F\u3081\u3001\u65B0\u898F\u30AB\u30FC\u30C9\u306E\u8CA0\u62C5\u3092\u6291\u3048\u305F 7 \u65E5\u306E\u56DE\u5FA9\u30D7\u30E9\u30F3\u304C\u6709\u52B9\u3067\u3059\u3002',
  },
  'A 3-day recovery plan is active to clear overdue cards without creating a review spike.': {
    ko: '\uBCF5\uC2B5 \uD53C\uD06C \uC5C6\uC774 \uC5F0\uCCB4 \uCE74\uB4DC\uB97C \uC815\uB9AC\uD558\uAE30 \uC704\uD574 3\uC77C \uD68C\uBCF5 \uACC4\uD68D\uC774 \uD65C\uC131\uD654\uB429\uB2C8\uB2E4.',
    en: 'A 3-day recovery plan is active to clear overdue cards without creating a review spike.',
    ja: '\u5FA9\u7FD2\u30B9\u30D1\u30A4\u30AF\u3092\u4F5C\u3089\u305A\u306B\u5EF6\u6EDE\u30AB\u30FC\u30C9\u3092\u6574\u7406\u3059\u308B\u305F\u3081\u30013 \u65E5\u306E\u56DE\u5FA9\u30D7\u30E9\u30F3\u304C\u6709\u52B9\u3067\u3059\u3002',
  },
  'A short 15-minute recovery session is recommended to prevent the backlog from compounding.': {
    ko: '\uBC31\uB85C\uADF8\uAC00 \uB204\uC801\uB418\uC9C0 \uC54A\uB3C4\uB85D 15\uBD84 \uC9DC\uB9AC \uC9E7\uC740 \uD68C\uBCF5 \uC138\uC158\uC744 \uAD8C\uC7A5\uD569\uB2C8\uB2E4.',
    en: 'A short 15-minute recovery session is recommended to prevent the backlog from compounding.',
    ja: '\u30D0\u30C3\u30AF\u30ED\u30B0\u306E\u7D2F\u7A4D\u3092\u9632\u3050\u305F\u3081\u300115 \u5206\u306E\u77ED\u3044\u56DE\u5FA9\u30BB\u30C3\u30B7\u30E7\u30F3\u304C\u63A8\u5968\u3055\u308C\u307E\u3059\u3002',
  },
  'The target date is close, so review load increased and new cards were reduced.': {
    ko: '\uBAA9\uD45C\uC77C\uC774 \uAC00\uAE4C\uC6CC \uBCF5\uC2B5 \uBD80\uD558\uB97C \uB192\uC774\uACE0 \uC2E0\uADDC \uCE74\uB4DC\uB97C \uC904\uC600\uC2B5\uB2C8\uB2E4.',
    en: 'The target date is close, so review load increased and new cards were reduced.',
    ja: '\u76EE\u6A19\u65E5\u304C\u8FD1\u3044\u305F\u3081\u3001\u5FA9\u7FD2\u8CA0\u8377\u3092\u4E0A\u3052\u3001\u65B0\u898F\u30AB\u30FC\u30C9\u3092\u6E1B\u3089\u3057\u307E\u3057\u305F\u3002',
  },
  'Experiment treatment increases reading prompts by 10 percentage points.': {
    ko: '\uC2E4\uD5D8 treatment\uC5D0\uC11C \uC77D\uAE30 \uD504\uB86C\uD504\uD2B8 \uBE44\uC911\uC744 10%p \uB192\uC785\uB2C8\uB2E4.',
    en: 'Experiment treatment increases reading prompts by 10 percentage points.',
    ja: '\u5B9F\u9A13 treatment \u3067\u306F\u8AAD\u307F\u30D7\u30ED\u30F3\u30D7\u30C8\u6BD4\u7387\u3092 10 \u30DD\u30A4\u30F3\u30C8\u4E0A\u3052\u307E\u3059\u3002',
  },
};

export function translatePlanFactor(locale: SupportedLocale, factor: string): string {
  return FACTOR_LABELS[factor]?.[locale] ?? factor;
}

export function translatePlanBasis(locale: SupportedLocale, basis: string): string {
  return BASIS_LABELS[basis]?.[locale] ?? basis;
}

export function translatePlanNarrative(locale: SupportedLocale, text: string): string {
  return NARRATIVE_LABELS[text]?.[locale] ?? text;
}

export function translatePlanEvidence(locale: SupportedLocale, text: string): string {
  if (text === 'goal.focus includes READING') {
    if (locale === 'ko') return '\uBAA9\uD45C focus\uC5D0 \uC77D\uAE30\uAC00 \uD3EC\uD568\uB429\uB2C8\uB2E4';
    if (locale === 'ja') return '\u76EE\u6A19 focus \u306B\u8AAD\u307F\u304C\u542B\u307E\u308C\u307E\u3059';
    return 'Goal focus includes reading';
  }

  if (text === 'constraints.offline_expected=true') {
    if (locale === 'ko') return '\uC81C\uC57D \uC870\uAC74 offline_expected = \uC608';
    if (locale === 'ja') return '\u5236\u7D04 offline_expected = \u306F\u3044';
    return 'Constraint offline_expected = yes';
  }

  if (text.startsWith('goal.focus=')) {
    const values = text
      .slice('goal.focus='.length)
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
      .map((value) => FOCUS_LABELS[value]?.[locale] ?? value)
      .join(', ');
    if (locale === 'ko') return `\uBAA9\uD45C focus: ${values}`;
    if (locale === 'ja') return `\u76EE\u6A19 focus: ${values}`;
    return `Goal focus: ${values}`;
  }

  const match = text.match(/^([a-z_]+)=(.+)$/i);
  if (!match) return text;

  const [, key, rawValue] = match;
  const label = GENERIC_LABELS[key]?.[locale] ?? key;
  return `${label}: ${translateScalarValue(locale, key, rawValue.trim())}`;
}

export function translatePlanCounterfactual(locale: SupportedLocale, text: string): string {
  let match = text.match(/^Without target_date, review_count would stay (\d+) and new_count would stay (\d+)\.$/);
  if (match) {
    const [, reviewCount, newCount] = match;
    if (locale === 'ko') {
      return `target_date\uAC00 \uC5C6\uC73C\uBA74 review_count\uB294 ${reviewCount}, new_count\uB294 ${newCount}\uB85C \uC720\uC9C0\uB429\uB2C8\uB2E4.`;
    }
    if (locale === 'ja') {
      return `target_date \u304C\u306A\u3051\u308C\u3070 review_count \u306F ${reviewCount}\u3001new_count \u306F ${newCount} \u306E\u307E\u307E\u3067\u3059\u3002`;
    }
    return text;
  }

  match = text.match(/^Without READING focus, SURFACE_TO_READING would stay (\d+)%\.$/);
  if (match) {
    const [, percent] = match;
    if (locale === 'ko') {
      return `READING focus\uAC00 \uC5C6\uC73C\uBA74 SURFACE_TO_READING\uC740 ${percent}%\uB85C \uC720\uC9C0\uB429\uB2C8\uB2E4.`;
    }
    if (locale === 'ja') {
      return `READING focus \u304C\u306A\u3051\u308C\u3070 SURFACE_TO_READING \u306F ${percent}% \u306E\u307E\u307E\u3067\u3059\u3002`;
    }
    return text;
  }

  match = text.match(/^Without VOCAB\/PRODUCTION focus, MEANING_TO_SURFACE would stay (\d+)%\.$/);
  if (match) {
    const [, percent] = match;
    if (locale === 'ko') {
      return `VOCAB/PRODUCTION focus\uAC00 \uC5C6\uC73C\uBA74 MEANING_TO_SURFACE\uB294 ${percent}%\uB85C \uC720\uC9C0\uB429\uB2C8\uB2E4.`;
    }
    if (locale === 'ja') {
      return `VOCAB/PRODUCTION focus \u304C\u306A\u3051\u308C\u3070 MEANING_TO_SURFACE \u306F ${percent}% \u306E\u307E\u307E\u3067\u3059\u3002`;
    }
    return text;
  }

  match = text.match(/^Without offline_expected, session_chunk_min would stay (\d+) and new_count would stay (\d+)\.$/);
  if (match) {
    const [, chunk, newCount] = match;
    if (locale === 'ko') {
      return `offline_expected\uAC00 \uC5C6\uC73C\uBA74 session_chunk_min\uC740 ${chunk}, new_count\uB294 ${newCount}\uB85C \uC720\uC9C0\uB429\uB2C8\uB2E4.`;
    }
    if (locale === 'ja') {
      return `offline_expected \u304C\u306A\u3051\u308C\u3070 session_chunk_min \u306F ${chunk}\u3001new_count \u306F ${newCount} \u306E\u307E\u307E\u3067\u3059\u3002`;
    }
    return text;
  }

  return text;
}

function translateScalarValue(locale: SupportedLocale, key: string, value: string): string {
  if (key === 'variant' && value === 'treatment') {
    return 'treatment';
  }

  if (key === 'offline_expected') {
    return BOOLEAN_LABELS[value.toLowerCase() as 'true' | 'false']?.[locale] ?? value;
  }

  return value;
}
