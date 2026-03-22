import type { RecoveryMetrics, SupportedLocale, WeeklyReport } from './types/api-contracts';

type LocaleText = Record<SupportedLocale, string>;

const PROMPT_TYPE_LABELS: Record<string, LocaleText> = {
  SURFACE_TO_MEANING: {
    ko: '\uD45C\uAE30 \u2192 \uB73B',
    en: 'Surface to meaning',
    ja: '\u8868\u8A18\u2192\u610F\u5473',
  },
  MEANING_TO_SURFACE: {
    ko: '\uB73B \u2192 \uD45C\uAE30',
    en: 'Meaning to surface',
    ja: '\u610F\u5473\u2192\u8868\u8A18',
  },
  SURFACE_TO_READING: {
    ko: '\uD45C\uAE30 \u2192 \uC77D\uAE30',
    en: 'Surface to reading',
    ja: '\u8868\u8A18\u2192\u8AAD\u307F',
  },
  MCQ: {
    ko: '\uAC1D\uAD00\uC2DD',
    en: 'MCQ',
    ja: '\u9078\u629E\u5F0F',
  },
  CLOZE: {
    ko: '\uBE48\uCE78',
    en: 'Cloze',
    ja: '\u7A74\u57CB\u3081',
  },
  LISTENING: {
    ko: '\uB4E3\uAE30',
    en: 'Listening',
    ja: '\u30EA\u30B9\u30CB\u30F3\u30B0',
  },
};

const META_TAG_LABELS = {
  example: {
    ko: '\uC608\uBB38',
    en: 'Example',
    ja: '\u4F8B\u6587',
  },
  audio: {
    ko: '\uC624\uB514\uC624',
    en: 'Audio',
    ja: '\u97F3\u58F0',
  },
  payload: {
    ko: '\uD398\uC774\uB85C\uB4DC',
    en: 'Payload',
    ja: '\u30DA\u30A4\u30ED\u30FC\u30C9',
  },
} as const satisfies Record<'example' | 'audio' | 'payload', LocaleText>;

const REPORT_ERROR_LABELS: Record<string, LocaleText> = {
  NONE: {
    ko: '\uC815\uB2F5',
    en: 'None',
    ja: '\u306A\u3057',
  },
  READING_CONFUSION: {
    ko: '\uC77D\uAE30 \uD63C\uB3D9',
    en: 'Reading confusion',
    ja: '\u8AAD\u307F\u306E\u6DF7\u540C',
  },
  FORM_SIMILAR: {
    ko: '\uD615\uD0DC \uC720\uC0AC',
    en: 'Form similarity',
    ja: '\u5F62\u306E\u985E\u4F3C',
  },
  MEANING_NEAR: {
    ko: '\uB73B \uC720\uC0AC',
    en: 'Meaning similarity',
    ja: '\u610F\u5473\u306E\u8FD1\u63A5',
  },
  NO_RECALL: {
    ko: '\uC644\uC804 \uB9DD\uAC01',
    en: 'No recall',
    ja: '\u60F3\u8D77\u4E0D\u80FD',
  },
  TYPO: {
    ko: '\uC624\uD0C0',
    en: 'Typo',
    ja: '\u30BF\u30A4\u30DD',
  },
};

const RECOVERY_METRIC_LABELS: Record<keyof RecoveryMetrics, LocaleText> = {
  overdue_backlog_days: {
    ko: '\uC5F0\uCCB4 \uBC31\uB85C\uADF8 \uC77C\uC218',
    en: 'Overdue backlog days',
    ja: '\u5EF6\u6EDE\u30D0\u30C3\u30AF\u30ED\u30B0\u65E5\u6570',
  },
  recovery_completion_rate: {
    ko: '\uD68C\uBCF5 \uC644\uB8CC \uBE44\uC728',
    en: 'Recovery completion rate',
    ja: '\u56DE\u5FA9\u5B8C\u4E86\u7387',
  },
  recovery_time_to_normal_days: {
    ko: '\uC815\uC0C1 \uBCF5\uADC0 \uC77C\uC218',
    en: 'Days to normalize',
    ja: '\u6B63\u5E38\u5316\u307E\u3067\u306E\u65E5\u6570',
  },
  post_recovery_retention: {
    ko: '\uD68C\uBCF5 \uD6C4 \uC720\uC9C0\uC728',
    en: 'Post-recovery retention',
    ja: '\u56DE\u5FA9\u5F8C\u306E\u5B9A\u7740\u7387',
  },
};

const REPORT_DETAIL_COPY = {
  ko: {
    overduePerDay: '\uC77C\uBCC4 \uC5F0\uCCB4',
    tableSurface: '\uD45C\uAE30',
    tableErrorType: '\uC624\uB958 \uC720\uD615',
    tableCount: '\uD69F\uC218',
    periodConnector: ' ~ ',
    activeDays: (days: number) => `\uC774\uBC88 \uC8FC ${days}\uC77C \uD559\uC2B5\uD588\uC2B5\uB2C8\uB2E4.`,
    noActivity:
      '\uC774\uBC88 \uC8FC \uD559\uC2B5 \uAE30\uB85D\uC774 \uC5C6\uC2B5\uB2C8\uB2E4. \uC9E7\uC740 \uC138\uC158\uC73C\uB85C \uB2E4\uC2DC \uC2DC\uC791\uD574 \uBCF4\uC138\uC694.',
    strongRetention: (pct: number) => `7\uC77C \uBAA9\uD45C \uAC04\uACA9 \uBCF5\uC2B5\uC744 ${pct}% \uC815\uD655\uB3C4\uB85C \uC720\uC9C0\uD588\uC2B5\uB2C8\uB2E4. \uC7A5\uAE30 \uAE30\uC5B5 \uD750\uB984\uC774 \uC548\uC815\uC801\uC785\uB2C8\uB2E4.`,
    midRetention: (pct: number) => `7\uC77C \uBAA9\uD45C \uAC04\uACA9 \uBCF5\uC2B5\uC740 ${pct}%\uC785\uB2C8\uB2E4. \uAC04\uACA9 \uC870\uC815\uACFC \uCD94\uAC00 \uBCF5\uC2B5\uC774 \uD544\uC694\uD569\uB2C8\uB2E4.`,
    lowRetention: (pct: number) => `7\uC77C \uBAA9\uD45C \uAC04\uACA9 \uBCF5\uC2B5\uC740 ${pct}%\uC785\uB2C8\uB2E4. \uD604\uC7AC \uAC04\uACA9 \uB610\uB294 \uC9C0\uC5F0 \uC601\uD5A5\uC774 \uD07D\uB2C8\uB2E4.`,
    topConfusion: (surface: string, errorLabel: string) => `\uC774\uBC88 \uC8FC \uAC00\uC7A5 \uB9CE\uC774 \uD2C0\uB9B0 \uD56D\uBAA9\uC740 '${surface}'\uC785\uB2C8\uB2E4 (\uC624\uB958 \uC720\uD615: ${errorLabel}).`,
    overdueWarning: (days: number) => `${days}\uC77C\uC758 \uC5F0\uCCB4\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4. \uD68C\uBCF5 \uACC4\uD68D\uC73C\uB85C \uBCF5\uC2B5 \uBD80\uD558\uB97C \uBD84\uC0B0\uD558\uC138\uC694.`,
    recoveryRate: (pct: number) => `\uC608\uC815 \uC2DC\uC810\uC5D0 \uAC00\uAE5D\uAC8C \uC218\uD589\uD55C \uBCF5\uC2B5 \uBE44\uC728\uC740 ${pct}%\uC785\uB2C8\uB2E4.`,
    streak: (days: number) => `${days}\uC77C \uC5F0\uC18D \uD559\uC2B5 \uC911\uC785\uB2C8\uB2E4.`,
  },
  en: {
    overduePerDay: 'Overdue/day',
    tableSurface: 'Surface',
    tableErrorType: 'Error type',
    tableCount: 'Count',
    periodConnector: ' to ',
    activeDays: (days: number) => `You studied on ${days} day${days === 1 ? '' : 's'} this week.`,
    noActivity: 'No study activity was recorded this week. Restart with a short session.',
    strongRetention: (pct: number) => `7-day target reviews held at ${pct}% accuracy. Long-term retention looks stable.`,
    midRetention: (pct: number) => `7-day target reviews are at ${pct}% accuracy. Interval tuning and extra review are still needed.`,
    lowRetention: (pct: number) => `7-day target reviews are at ${pct}% accuracy. The current interval or lateness cost is still high.`,
    topConfusion: (surface: string, errorLabel: string) => `The most-missed item this week was '${surface}' (${errorLabel}).`,
    overdueWarning: (days: number) => `${days} overdue day${days === 1 ? '' : 's'} were recorded. Spread review load with a recovery plan.`,
    recoveryRate: (pct: number) => `${pct}% of reviews were completed close to their scheduled time.`,
    streak: (days: number) => `You are on a ${days}-day study streak.`,
  },
  ja: {
    overduePerDay: '1\u65E5\u3042\u305F\u308A\u5EF6\u6EDE',
    tableSurface: '\u8868\u8A18',
    tableErrorType: '\u8AA4\u308A\u30BF\u30A4\u30D7',
    tableCount: '\u56DE\u6570',
    periodConnector: ' \u301C ',
    activeDays: (days: number) => `\u4ECA\u9031\u306F${days}\u65E5\u5B66\u7FD2\u3057\u307E\u3057\u305F\u3002`,
    noActivity:
      '\u4ECA\u9031\u306E\u5B66\u7FD2\u8A18\u9332\u306F\u3042\u308A\u307E\u305B\u3093\u3002\u77ED\u3044\u30BB\u30C3\u30B7\u30E7\u30F3\u304B\u3089\u518D\u958B\u3057\u3066\u304F\u3060\u3055\u3044\u3002',
    strongRetention: (pct: number) => `7\u65E5\u76EE\u6A19\u306E\u5FA9\u7FD2\u306F${pct}%\u306E\u6B63\u7B54\u7387\u3067\u7DAD\u6301\u3067\u304D\u3066\u3044\u307E\u3059\u3002\u9577\u671F\u8A18\u61B6\u306F\u5B89\u5B9A\u3057\u3066\u3044\u307E\u3059\u3002`,
    midRetention: (pct: number) => `7\u65E5\u76EE\u6A19\u306E\u5FA9\u7FD2\u306F${pct}%\u3067\u3059\u3002\u9593\u9694\u306E\u8ABF\u6574\u3068\u8FFD\u52A0\u5FA9\u7FD2\u304C\u307E\u3060\u5FC5\u8981\u3067\u3059\u3002`,
    lowRetention: (pct: number) => `7\u65E5\u76EE\u6A19\u306E\u5FA9\u7FD2\u306F${pct}%\u3067\u3059\u3002\u73FE\u5728\u306E\u9593\u9694\u307E\u305F\u306F\u9045\u5EF6\u306E\u5F71\u97FF\u304C\u5927\u304D\u3044\u3067\u3059\u3002`,
    topConfusion: (surface: string, errorLabel: string) => `\u4ECA\u9031\u6700\u3082\u9593\u9055\u3048\u305F\u9805\u76EE\u306F\u300E${surface}\u300F\u3067\u3057\u305F\uff08${errorLabel}\uff09\u3002`,
    overdueWarning: (days: number) => `${days}\u65E5\u5206\u306E\u5EF6\u6EDE\u304C\u767A\u751F\u3057\u3066\u3044\u307E\u3059\u3002\u56DE\u5FA9\u30D7\u30E9\u30F3\u3067\u5FA9\u7FD2\u8CA0\u8377\u3092\u5206\u6563\u3057\u307E\u3057\u3087\u3046\u3002`,
    recoveryRate: (pct: number) => `\u4E88\u5B9A\u6642\u70B9\u306B\u8FD1\u3044\u5FA9\u7FD2\u306E\u6BD4\u7387\u306F${pct}%\u3067\u3059\u3002`,
    streak: (days: number) => `${days}\u65E5\u9023\u7D9A\u3067\u5B66\u7FD2\u4E2D\u3067\u3059\u3002`,
  },
} as const;

export function getPromptTypeLabel(locale: SupportedLocale, promptType: string): string {
  return PROMPT_TYPE_LABELS[promptType]?.[locale] ?? promptType;
}

export function getStudyMetadataTagLabel(
  locale: SupportedLocale,
  tag: keyof typeof META_TAG_LABELS,
): string {
  return META_TAG_LABELS[tag][locale];
}

export function translateReportErrorType(locale: SupportedLocale, errorType: string): string {
  return REPORT_ERROR_LABELS[errorType]?.[locale] ?? errorType;
}

export function translateRecoveryMetricLabel(
  locale: SupportedLocale,
  key: keyof RecoveryMetrics,
): string {
  return RECOVERY_METRIC_LABELS[key][locale];
}

export function getReportOverduePerDayLabel(locale: SupportedLocale): string {
  return REPORT_DETAIL_COPY[locale].overduePerDay;
}

export function getReportTableColumnLabel(
  locale: SupportedLocale,
  key: 'surface' | 'errorType' | 'count',
): string {
  if (key === 'surface') return REPORT_DETAIL_COPY[locale].tableSurface;
  if (key === 'errorType') return REPORT_DETAIL_COPY[locale].tableErrorType;
  return REPORT_DETAIL_COPY[locale].tableCount;
}

export function formatReportPeriod(locale: SupportedLocale, from: string, to: string): string {
  return `${from}${REPORT_DETAIL_COPY[locale].periodConnector}${to}`;
}

export function buildLocalizedReportInsights(locale: SupportedLocale, report: WeeklyReport): string[] {
  const activeDays = report.daily_stats.filter((row) => Number(row.reviews) > 0).length;
  const copy = REPORT_DETAIL_COPY[locale];

  if (activeDays === 0) {
    return [copy.noActivity];
  }

  const insights = [copy.activeDays(activeDays)];

  if (report.retention_metrics.due_7d.eligible_count >= 3) {
    const pct = Math.round(report.retention_metrics.due_7d.recall_rate * 100);
    if (pct >= 75) {
      insights.push(copy.strongRetention(pct));
    } else if (pct >= 50) {
      insights.push(copy.midRetention(pct));
    } else {
      insights.push(copy.lowRetention(pct));
    }
  }

  const top = report.confusion_metrics.top_confusions[0];
  if (top) {
    insights.push(copy.topConfusion(top.surface, translateReportErrorType(locale, top.error_type)));
  }

  if (report.summary.overdue_days >= 3) {
    insights.push(copy.overdueWarning(report.summary.overdue_days));
  }

  if (report.recovery_metrics.recovery_completion_rate > 0) {
    const pct = Math.round(report.recovery_metrics.recovery_completion_rate * 100);
    insights.push(copy.recoveryRate(pct));
  }

  if (report.summary.streak_days >= 3) {
    insights.push(copy.streak(report.summary.streak_days));
  }

  return insights;
}
